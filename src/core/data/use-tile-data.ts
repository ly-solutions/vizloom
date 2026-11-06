import { useCallback, useEffect, useRef, useState } from 'react';

import { overviewGranularity, type Granularity, type TimeRange } from '../model/time';
import type { SeriesFrame } from '../model/types';
import { isAbortError, type TileSource } from './source';

export const DATA_STATUS = {
  /** No frame yet: show a skeleton. */
  loading: 'loading',
  ready: 'ready',
  /** A frame is on screen, a new one is loading (granularity, metric, window). */
  refreshing: 'refreshing',
  /** No frame, the request failed. */
  error: 'error',
  /** A frame is on screen, but refreshing it failed. */
  staleError: 'stale-error',
} as const;

export type DataStatus = (typeof DATA_STATUS)[keyof typeof DATA_STATUS];

export interface UseTileDataOptions<Metric extends string> {
  readonly metric: Metric;
  readonly granularity: Granularity;
  /** Window on screen. Requests add `overscan` window widths on each side. */
  readonly range: TimeRange;
  readonly overscan?: number;
  /** Debounce while the window is moving, ms. The first request is immediate. */
  readonly debounce?: number;
  readonly enabled?: boolean;
}

export interface TileData<Id extends string> {
  /** Last frame received — kept while another granularity loads, so the chart morphs into it. */
  readonly frame: SeriesFrame<Id> | null;
  readonly status: DataStatus;
  readonly error: unknown;
  /** Granularity being loaded. */
  readonly pending: Granularity | null;
  retry(): void;
}

interface Entry<Id extends string> {
  readonly frame: SeriesFrame<Id>;
  /** Period asked for: the frame may end at "now" while coverage does not. */
  readonly asked: TimeRange;
}

interface Inflight {
  readonly key: string;
  readonly asked: TimeRange;
  readonly controller: AbortController;
}

const within = (outer: TimeRange, inner: TimeRange) => outer.start <= inner.start + 1 && outer.end >= inner.end - 1;

type State<Id extends string> = Omit<TileData<Id>, 'retry'>;

/**
 * Frame for a window. Asks the source only when the metric, granularity or window leaves what is
 * cached; aborts stale requests; keeps the previous frame until the next one arrives.
 */
export function useTileData<Id extends string, Metric extends string>(
  source: TileSource<Id, Metric>,
  options: UseTileDataOptions<Metric>,
): TileData<Id> {
  const { metric, granularity, range, overscan = 1, debounce = 120, enabled = true } = options;
  const [state, setState] = useState<State<Id>>({ frame: null, status: DATA_STATUS.loading, error: null, pending: granularity });
  const cache = useRef(new Map<string, Entry<Id>>());
  const inflight = useRef<Inflight | null>(null);
  const hasFrame = useRef(false);
  const [attempt, setAttempt] = useState(0);
  const handledAttempt = useRef(0);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    cache.current.clear();
    inflight.current?.controller.abort();
    inflight.current = null;
  }, [source]);

  useEffect(() => {
    if (!enabled) return;
    const extent = source.extent;
    const want = { start: Math.max(extent.start, range.start), end: Math.min(extent.end, range.end) };
    const key = `${metric}|${granularity}`;
    const forced = attempt !== handledAttempt.current;
    handledAttempt.current = attempt;
    const cached = cache.current.get(key);
    if (!forced && cached && within(cached.asked, want)) {
      inflight.current?.controller.abort();
      inflight.current = null;
      hasFrame.current = true;
      setState((s) =>
        s.frame === cached.frame && s.status === DATA_STATUS.ready
          ? s
          : { frame: cached.frame, status: DATA_STATUS.ready, error: null, pending: null },
      );
      return;
    }
    if (!forced && inflight.current?.key === key && within(inflight.current.asked, want)) return;
    setState((s) => ({ ...s, pending: granularity, status: s.frame ? DATA_STATUS.refreshing : DATA_STATUS.loading }));
    const span = range.end - range.start;
    const asked = {
      start: Math.max(extent.start, range.start - span * overscan),
      end: Math.min(extent.end, range.end + span * overscan),
    };
    const timer = setTimeout(
      () => {
        inflight.current?.controller.abort();
        const controller = new AbortController();
        inflight.current = { key, asked, controller };
        source.load({ metric, granularity, range: asked, signal: controller.signal }).then(
          (frame) => {
            if (controller.signal.aborted) return;
            cache.current.set(key, { frame, asked });
            inflight.current = null;
            hasFrame.current = true;
            setState({ frame, status: DATA_STATUS.ready, error: null, pending: null });
          },
          (error: unknown) => {
            if (controller.signal.aborted || isAbortError(error)) return;
            inflight.current = null;
            setState((s) => ({ ...s, status: s.frame ? DATA_STATUS.staleError : DATA_STATUS.error, error, pending: null }));
          },
        );
      },
      hasFrame.current && !forced ? debounce : 0,
    );
    return () => clearTimeout(timer);
  }, [source, metric, granularity, range.start, range.end, overscan, debounce, enabled, attempt]);

  useEffect(() => () => inflight.current?.controller.abort(), []);

  return { ...state, retry };
}

/** Whole-history frame for the navigator: one granularity, one request. */
export function useOverviewData<Id extends string, Metric extends string>(
  source: TileSource<Id, Metric>,
  metric: Metric,
  enabled = true,
): TileData<Id> {
  return useTileData(source, {
    metric,
    granularity: overviewGranularity(source.extent),
    range: source.extent,
    overscan: 0,
    debounce: 0,
    enabled,
  });
}
