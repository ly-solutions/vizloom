import type { SeriesFrame } from '../../core';

/** Minutes averaged for "now". */
export const FLOW_CURRENT_WINDOW = 5;
/** Shortest stretch a drag selects, ms; shorter drags are clicks. */
export const FLOW_MIN_SELECT = 2 * 60_000;
/** A selection narrower than this widens around its middle, ms. */
export const FLOW_MIN_WINDOW = 5 * 60_000;

export interface FlowSeriesStats {
  /** Mean of the last `FLOW_CURRENT_WINDOW` buckets with data. */
  readonly current: number;
  /** Mean over the buckets with data. */
  readonly average: number;
  readonly peak: number;
  /** Start of the peak bucket; `NaN` — no data. */
  readonly peakAt: number;
  readonly total: number;
  /** Live and nothing passed in the last window while the series had passed before. */
  readonly idle: boolean;
}

export interface FlowStats<Id extends string> {
  readonly series: Readonly<Record<Id, FlowSeriesStats>>;
  /** Sum of all series. */
  readonly all: FlowSeriesStats;
  /** Index after the last bucket with data in any series. */
  readonly filled: number;
}

function statsOf(col: ArrayLike<number>, length: number, start: number, step: number, filled: number): FlowSeriesStats {
  let total = 0;
  let count = 0;
  let peak = 0;
  let peakAt = Number.NaN;
  for (let k = 0; k < length; k++) {
    const v = col[k];
    if (v === undefined || v !== v) continue;
    total += v;
    count++;
    if (v > peak || peakAt !== peakAt) {
      peak = v;
      peakAt = start + k * step;
    }
  }
  let recent = 0;
  let seen = 0;
  for (let k = filled - 1; k >= 0 && seen < FLOW_CURRENT_WINDOW; k--) {
    const v = col[k];
    if (v === undefined || v !== v) continue;
    recent += v;
    seen++;
  }
  const current = seen > 0 ? recent / seen : 0;
  return {
    current,
    average: count > 0 ? total / count : 0,
    peak,
    peakAt,
    total,
    idle: seen >= FLOW_CURRENT_WINDOW && recent === 0 && total > 0,
  };
}

/** Throughput figures per series and for all of them: now, average, peak and when, total. */
export function flowStats<Id extends string>(frame: SeriesFrame<Id>, ids: readonly Id[]): FlowStats<Id> {
  let filled = 0;
  for (const id of ids) {
    const col = frame.values[id];
    for (let k = frame.length - 1; k >= filled; k--) {
      const v = col[k];
      if (v !== undefined && v === v) {
        filled = k + 1;
        break;
      }
    }
  }
  const sum = new Float64Array(frame.length).fill(Number.NaN);
  const series = {} as Record<Id, FlowSeriesStats>;
  for (const id of ids) {
    const col = frame.values[id];
    for (let k = 0; k < frame.length; k++) {
      const v = col[k];
      if (v === undefined || v !== v) continue;
      sum[k] = (sum[k] !== sum[k] ? 0 : sum[k]) + v;
    }
    series[id] = statsOf(col, frame.length, frame.start, frame.step, filled);
  }
  return { series, all: statsOf(sum, frame.length, frame.start, frame.step, filled), filled };
}

/**
 * Turns a dragged stretch into a window: too short — `null` (it was a click); narrower than the
 * minimum — widened around its middle.
 */
export function selectionWindow(range: { start: number; end: number }): { start: number; end: number } | null {
  const span = range.end - range.start;
  if (span < FLOW_MIN_SELECT) return null;
  if (span >= FLOW_MIN_WINDOW) return range;
  const mid = (range.start + range.end) / 2;
  return { start: mid - FLOW_MIN_WINDOW / 2, end: mid + FLOW_MIN_WINDOW / 2 };
}

/** Minute steps of the X axis, in minutes. */
const MINUTE_STEPS = [1, 2, 5, 10, 15, 30, 60, 120, 180, 360] as const;

/**
 * Clock ticks for minute data: the step grows 1 → 2 → 5 → 15 → 30 minutes… so labels stay at
 * least `minGapPx` apart; whole hours are major.
 */
export function minuteTicks(timeLabel: (t: number) => string, minGapPx = 64) {
  return (range: { start: number; end: number }, widthPx: number): { t: number; label: string; major: boolean }[] => {
    const spanMin = Math.max(1, (range.end - range.start) / 60_000);
    const fit = Math.max(1, Math.floor(widthPx / minGapPx));
    const stepMin = MINUTE_STEPS.find((s) => spanMin / s <= fit) ?? MINUTE_STEPS[MINUTE_STEPS.length - 1];
    const step = stepMin * 60_000;
    const out: { t: number; label: string; major: boolean }[] = [];
    for (let t = Math.ceil(range.start / step) * step; t <= range.end && out.length < 200; t += step) {
      out.push({ t, label: timeLabel(t), major: t % 3_600_000 === 0 });
    }
    return out;
  };
}
