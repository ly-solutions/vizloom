import { bucketize, type HourlySeries } from '../model/aggregate';
import { type Granularity, type TimeRange, type TimeZone, UTC_ZONE } from '../model/time';
import type { SeriesFrame, TimeExtent } from '../model/types';

/** A tile request: which metric, at which granularity, for which period. */
export interface TileRequest<Metric extends string = string> {
  readonly metric: Metric;
  readonly granularity: Granularity;
  /** Period with overscan: panning does not hit the edge of loaded data at once. */
  readonly range: TimeRange;
  /** Aborted when the request is stale: metric, granularity or window changed. */
  readonly signal?: AbortSignal;
}

/**
 * Tile source of time series. The product implements `load` with its own request; the library
 * decides when to ask, cancels stale requests and keeps the previous frame on screen until the
 * next arrives. A frame may cover more than asked (the whole history, say).
 *
 * Contract: `load({ metric, granularity, range }) → { start, step, length, values }`.
 */
export interface TileSource<Id extends string = string, Metric extends string = string> {
  readonly extent: TimeExtent;
  load(request: TileRequest<Metric>): Promise<SeriesFrame<Id>>;
}

export interface LocalSourceOptions<Id extends string, Metric extends string> {
  /** Hourly series of each metric: granularities are aggregated on the client. */
  readonly hourly: Readonly<Record<Metric, HourlySeries<Id>>>;
  readonly extent: TimeExtent;
  readonly zone?: TimeZone;
  /** Artificial latency, ms — for stories and loading states. */
  readonly latency?: number | ((request: TileRequest<Metric>) => number);
  /** Fail a request — for error stories. */
  readonly fail?: (request: TileRequest<Metric>) => boolean;
}

export function abortError(): Error {
  const error = new Error('Request aborted');
  error.name = 'AbortError';
  return error;
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

/**
 * Source over data already on the client: granularities are aggregated from hours and memoised.
 * Answers with the whole history, so the window is never re-requested.
 */
export function createLocalSource<Id extends string, Metric extends string>(
  options: LocalSourceOptions<Id, Metric>,
): TileSource<Id, Metric> {
  const zone = options.zone ?? UTC_ZONE;
  const cache = new Map<string, SeriesFrame<Id>>();
  const build = (metric: Metric, granularity: Granularity) => {
    const key = `${metric}|${granularity}`;
    let frame = cache.get(key);
    if (!frame) {
      frame = bucketize(options.hourly[metric], granularity, zone);
      cache.set(key, frame);
    }
    return frame;
  };
  return {
    extent: options.extent,
    load(request) {
      const delay = typeof options.latency === 'function' ? options.latency(request) : (options.latency ?? 0);
      return new Promise<SeriesFrame<Id>>((resolve, reject) => {
        if (request.signal?.aborted) {
          reject(abortError());
          return;
        }
        const finish = () => {
          request.signal?.removeEventListener('abort', cancel);
          if (options.fail?.(request)) reject(new Error('Source did not respond'));
          else resolve(build(request.metric, request.granularity));
        };
        const timer = delay > 0 ? setTimeout(finish, delay) : null;
        const cancel = () => {
          if (timer) clearTimeout(timer);
          reject(abortError());
        };
        request.signal?.addEventListener('abort', cancel, { once: true });
        if (!timer) queueMicrotask(finish);
      });
    },
  };
}

/** Period a frame covers. */
export function frameCoverage(frame: Pick<SeriesFrame, 'start' | 'step' | 'length'>): TimeRange {
  return { start: frame.start, end: frame.start + frame.length * frame.step };
}

/** Slice a frame to the buckets that intersect `range` (server sources answering more than asked). */
export function sliceFrame<Id extends string>(frame: SeriesFrame<Id>, range: TimeRange): SeriesFrame<Id> {
  const k0 = Math.max(0, Math.floor((range.start - frame.start) / frame.step));
  const k1 = Math.min(frame.length, Math.ceil((range.end - frame.start) / frame.step));
  const length = Math.max(0, k1 - k0);
  const values = {} as Record<Id, Float64Array>;
  for (const id of Object.keys(frame.values) as Id[]) {
    const src = frame.values[id];
    const out = new Float64Array(length);
    for (let i = 0; i < length; i++) out[i] = src[k0 + i];
    values[id] = out;
  }
  return { granularity: frame.granularity, start: frame.start + k0 * frame.step, step: frame.step, length, values };
}

/** Frame from plain arrays — the shortest way to feed a time chart without a source. */
export function frameFromArrays<Id extends string>(
  start: number,
  step: number,
  values: Readonly<Record<Id, readonly number[]>>,
  granularity?: Granularity,
): SeriesFrame<Id> {
  const ids = Object.keys(values) as Id[];
  const length = ids.reduce((n, id) => Math.max(n, values[id].length), 0);
  return { granularity, start, step, length, values };
}
