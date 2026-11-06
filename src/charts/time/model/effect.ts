import { frameSum } from '../../../core';
import { DAY, HOUR } from '../../../core';
import type { SeriesFrame, TimeMarker } from '../../../core';

export interface EffectRow<Id extends string = string> {
  /** Series or `null` — the sum across all series. */
  readonly id: Id | null;
  /** Average per day before the change. */
  readonly before: number;
  /** Average per day after; `NaN` until an hour has passed since the change. */
  readonly after: number;
  /** Change in percent; `NaN` if there were no sales before the change. */
  readonly deltaPct: number;
}

export interface Effect<Id extends string = string> {
  readonly markerId: string;
  /** Comparison window length, ms. */
  readonly window: number;
  /** End of the "after" window: no later than "now". */
  readonly afterEnd: number;
  /** The "after" window is shorter than "before": the change is recent. */
  readonly partial: boolean;
  readonly rows: readonly EffectRow<Id>[];
}

/**
 * Default comparison window is 3 days (1 day at hourly granularity). A week is too long:
 * adjacent events (sales start, a previous price) fall into "before" and produce a false drop.
 */
export function defaultEffectWindow(step: number): number {
  return step <= HOUR ? DAY : 3 * DAY;
}

/**
 * Effect of a change: average per day over the window before and after the marker, over the affected series
 * (or the sum of all if the marker affects all).
 */
export function computeEffect<Id extends string>(
  frame: SeriesFrame<Id>,
  marker: TimeMarker<Id>,
  now: number,
  window = defaultEffectWindow(frame.step),
): Effect<Id> {
  const afterEnd = Math.min(marker.t + window, now);
  const afterDays = Math.max(0, (afterEnd - marker.t) / DAY);
  const beforeDays = window / DAY;
  const ids = Object.keys(frame.values) as Id[];
  const own = marker.series?.length ? marker.series.filter((id) => ids.includes(id)) : null;
  const row = (id: Id | null, list: readonly Id[]): EffectRow<Id> => {
    let b = 0;
    let a = 0;
    for (const s of list) {
      b += frameSum(frame, s, marker.t - window, marker.t);
      a += frameSum(frame, s, marker.t, afterEnd);
    }
    const before = b / beforeDays;
    const after = afterEnd - marker.t >= HOUR ? a / afterDays : Number.NaN;
    return { id, before, after, deltaPct: before > 0 && after === after ? (after / before - 1) * 100 : Number.NaN };
  };
  return {
    markerId: marker.id,
    window,
    afterEnd,
    partial: afterDays < beforeDays - 0.01,
    rows: own ? own.map((id) => row(id, [id])) : [row(null, ids)],
  };
}
