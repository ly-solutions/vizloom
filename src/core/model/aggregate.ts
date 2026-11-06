import { floorTo, GRANULARITY_STEP, HOUR, UTC_ZONE, type Granularity, type TimeZone } from './time';
import type { SeriesFrame } from './types';

/** Hourly values of series: the finest data any granularity is built from. */
export interface HourlySeries<Id extends string = string> {
  /** Start of the first hour, UTC ms (hour-aligned). */
  readonly start: number;
  /** Number of hours. */
  readonly length: number;
  readonly values: Readonly<Record<Id, ArrayLike<number>>>;
}

/** Prefix sums and gap counts: the sum of any range in O(1). */
export interface PrefixSums {
  readonly sum: Float64Array;
  readonly gaps: Int32Array;
}

export function prefixSums(values: ArrayLike<number>, length = values.length): PrefixSums {
  const sum = new Float64Array(length + 1);
  const gaps = new Int32Array(length + 1);
  for (let i = 0; i < length; i++) {
    const v = values[i];
    const gap = v !== v;
    sum[i + 1] = sum[i] + (gap ? 0 : v);
    gaps[i + 1] = gaps[i] + (gap ? 1 : 0);
  }
  return { sum, gaps };
}

/**
 * Sum over indices `[i0, i1)`. A bucket is a gap (`NaN`) when more than half of it is missing:
 * one empty hour does not make a whole day "no data".
 */
export function rangeSum(prefix: PrefixSums, i0: number, i1: number): number {
  const n = prefix.sum.length - 1;
  const a = Math.max(0, Math.min(n, i0));
  const b = Math.max(0, Math.min(n, i1));
  if (b <= a) return Number.NaN;
  if (prefix.gaps[b] - prefix.gaps[a] > (b - a) / 2) return Number.NaN;
  return prefix.sum[b] - prefix.sum[a];
}

/** Aggregates hourly series into `granularity` buckets aligned to local time. */
export function bucketize<Id extends string>(
  hourly: HourlySeries<Id>,
  granularity: Granularity,
  zone: TimeZone = UTC_ZONE,
): SeriesFrame<Id> {
  const step = GRANULARITY_STEP[granularity];
  const end = hourly.start + hourly.length * HOUR;
  const start = floorTo(hourly.start, granularity, zone);
  const length = hourly.length > 0 ? Math.max(0, Math.ceil((end - start) / step)) : 0;
  const values = {} as Record<Id, Float64Array>;
  for (const id of Object.keys(hourly.values) as Id[]) {
    const prefix = prefixSums(hourly.values[id], hourly.length);
    const out = new Float64Array(length);
    for (let k = 0; k < length; k++) {
      const a = start + k * step;
      out[k] = rangeSum(prefix, Math.round((a - hourly.start) / HOUR), Math.round((a + step - hourly.start) / HOUR));
    }
    values[id] = out;
  }
  return { granularity, start, step, length, values };
}

/** Index of the bucket containing `t` (may be outside the frame). */
export function bucketIndex(frame: Pick<SeriesFrame, 'start' | 'step'>, t: number): number {
  return Math.floor((t - frame.start) / frame.step);
}

/** Whether bucket `k` has at least one value. */
export function bucketHasData(frame: SeriesFrame, k: number): boolean {
  for (const id of Object.keys(frame.values)) {
    const v = frame.values[id][k];
    if (v === v) return true;
  }
  return false;
}

/**
 * Sum of a series over moments `[a, b)` from a frame: whole buckets plus shares of the edges.
 */
export function frameSum(frame: SeriesFrame, id: string, a: number, b: number): number {
  const values = (frame.values as Record<string, ArrayLike<number>>)[id];
  if (!values || b <= a) return 0;
  let total = 0;
  const k0 = Math.max(0, bucketIndex(frame, a));
  const k1 = Math.min(frame.length - 1, bucketIndex(frame, b - 1));
  for (let k = k0; k <= k1; k++) {
    const v = values[k];
    if (v !== v) continue;
    const s = frame.start + k * frame.step;
    const overlap = Math.min(b, s + frame.step) - Math.max(a, s);
    if (overlap > 0) total += (v * overlap) / frame.step;
  }
  return total;
}
