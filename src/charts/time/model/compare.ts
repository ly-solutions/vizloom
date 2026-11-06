import { type CompareAlign, type CompareSeries, DAY, niceStep, type SeriesFrame } from '../../../core';
import type { AxisTick } from '../engine/time-engine';

export interface AlignedCompare {
  /** One frame with a column per compared series, on a shared axis. */
  readonly frame: SeriesFrame<string>;
  /** `date`: real time. `days-before`: ms relative to each series' event (0 — the event). */
  readonly align: CompareAlign;
}

const valueOf = (frame: SeriesFrame<string>, k: number): number => {
  const keys = Object.keys(frame.values);
  // A compare frame carries one column ('value' or the only key).
  const key = 'value' in frame.values ? 'value' : keys[0];
  const v = key === undefined ? undefined : frame.values[key]?.[k];
  return v === undefined ? Number.NaN : Number(v);
};

/**
 * Lines up several series-events on one axis. `date` keeps real time (a season against the
 * previous one shifted by the caller); `days-before` puts every event at 0 and counts buckets
 * back from it, so "30 days before" of different events stand one above the other.
 * Buckets must share one step; the first series sets it.
 */
export function alignCompare(list: readonly CompareSeries[], align: CompareAlign): AlignedCompare | null {
  if (!list.length) return null;
  const step = list[0].frame.step;
  const shift = (s: CompareSeries) => (align === 'days-before' ? -(s.event ?? s.frame.start + s.frame.length * s.frame.step) : 0);
  let start = Number.POSITIVE_INFINITY;
  let end = Number.NEGATIVE_INFINITY;
  for (const s of list) {
    const a = s.frame.start + shift(s);
    start = Math.min(start, a);
    end = Math.max(end, a + s.frame.length * step);
  }
  // Snap the shared grid to the step so that every series lands on whole buckets.
  start = Math.floor(start / step) * step;
  const length = Math.max(0, Math.ceil((end - start) / step));
  const values: Record<string, Float64Array> = {};
  for (const s of list) {
    const column = new Float64Array(length).fill(Number.NaN);
    const offset = s.frame.start + shift(s);
    for (let k = 0; k < s.frame.length; k++) {
      const j = Math.round((offset + k * step - start) / step);
      if (j >= 0 && j < length) column[j] = valueOf(s.frame as SeriesFrame<string>, k);
    }
    values[s.id] = column;
  }
  return { frame: { start, step, length, values, granularity: list[0].frame.granularity }, align };
}

/**
 * Ticks of a "days before the event" axis: 0 is the event, negatives before it. The step is a
 * round number of days that leaves at least `minGapPx` between labels.
 */
export function daysBeforeTicks(daysLabel: (n: number) => string, minGapPx = 56) {
  return (range: { start: number; end: number }, widthPx: number): AxisTick[] => {
    const spanDays = (range.end - range.start) / DAY;
    const fit = Math.max(1, Math.floor(widthPx / minGapPx));
    const stepDays = Math.max(1, niceStep(spanDays / fit));
    const out: AxisTick[] = [];
    const first = Math.ceil(range.start / DAY / stepDays) * stepDays;
    for (let d = first; d * DAY <= range.end && out.length < 200; d += stepDays)
      out.push({ t: d * DAY, label: daysLabel(d), major: d === 0 });
    return out;
  };
}
