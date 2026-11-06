import type { HourlySeries } from '../../core';
import { HOUR, UTC_ZONE, type TimeRange, type TimeZone, wallTime } from '../../core';

/** Days in a week and hours in a day: the "weekday × hour" grid. */
export const WEEK_DAYS = 7;
export const DAY_HOURS = 24;

/**
 * "Weekday × hour" grid: `values[day][hour]`, day 0 is Monday. `NaN` — no data for the cell
 * (collection was down), `0` — no sales.
 */
export type WeekHourGrid = readonly (readonly number[])[];

export interface WeekHourOptions {
  /** Which series to sum. Defaults to all. */
  readonly ids?: readonly string[];
  /** Period. Defaults to the whole range. */
  readonly range?: TimeRange;
  readonly zone?: TimeZone;
}

/** Monday is 0: weeks start on Monday in Russia. */
export function mondayIndex(t: number, zone: TimeZone = UTC_ZONE): number {
  return (wallTime(t, zone).weekday + 6) % 7;
}

/** Sums hourly series into the "weekday × hour" grid in local time. */
export function weekHourGrid<Id extends string>(hourly: HourlySeries<Id>, options: WeekHourOptions = {}): number[][] {
  const zone = options.zone ?? UTC_ZONE;
  const ids = (options.ids ?? (Object.keys(hourly.values) as Id[])) as readonly Id[];
  const grid = Array.from({ length: WEEK_DAYS }, () => new Array<number>(DAY_HOURS).fill(Number.NaN));
  const from = options.range ? Math.max(0, Math.floor((options.range.start - hourly.start) / HOUR)) : 0;
  const to = options.range ? Math.min(hourly.length, Math.ceil((options.range.end - hourly.start) / HOUR)) : hourly.length;
  for (let i = from; i < to; i++) {
    const t = hourly.start + i * HOUR;
    let sum = 0;
    let seen = false;
    for (const id of ids) {
      const v = hourly.values[id as Id]?.[i];
      if (v === undefined || v !== v) continue;
      sum += v;
      seen = true;
    }
    if (!seen) continue;
    const day = mondayIndex(t, zone);
    const hour = wallTime(t, zone).hours;
    const cur = grid[day][hour];
    grid[day][hour] = (cur === cur ? cur : 0) + sum;
  }
  return grid;
}

/** Merge hours by `step` (2 or 3) — for narrow screens. */
export function groupHours(grid: WeekHourGrid, step: number): number[][] {
  return grid.map((row) => {
    const out: number[] = [];
    for (let h = 0; h < row.length; h += step) {
      let sum = 0;
      let seen = false;
      for (let j = h; j < Math.min(row.length, h + step); j++) {
        if (row[j] !== row[j]) continue;
        sum += row[j];
        seen = true;
      }
      out.push(seen ? sum : Number.NaN);
    }
    return out;
  });
}

export interface HeatmapCell {
  readonly day: number;
  /** Grid column (an hour or a group of hours). */
  readonly col: number;
  readonly value: number;
}

export interface HeatmapStats {
  readonly max: number;
  readonly total: number;
  /** Hottest cell; `null` — no sales. */
  readonly hot: HeatmapCell | null;
  /** Totals by weekday and by column; `NaN` — no data at all. */
  readonly dayTotals: readonly number[];
  readonly colTotals: readonly number[];
  /** Day with the largest total; `-1` — no sales. */
  readonly bestDay: number;
  /** Average cell with data — the base for "N times above usual". */
  readonly mean: number;
}

export function heatmapStats(grid: WeekHourGrid): HeatmapStats {
  const cols = grid[0]?.length ?? 0;
  const dayTotals = grid.map(() => Number.NaN);
  const colTotals = new Array<number>(cols).fill(Number.NaN);
  let max = 0;
  let total = 0;
  let filled = 0;
  let hot: HeatmapCell | null = null;
  grid.forEach((row, day) => {
    row.forEach((value, col) => {
      if (value !== value) return;
      dayTotals[day] = (dayTotals[day] === dayTotals[day] ? dayTotals[day] : 0) + value;
      colTotals[col] = (colTotals[col] === colTotals[col] ? colTotals[col] : 0) + value;
      total += value;
      filled++;
      if (value > max) {
        max = value;
        hot = { day, col, value };
      }
    });
  });
  let bestDay = -1;
  dayTotals.forEach((v, day) => {
    if (v > 0 && (bestDay < 0 || v > dayTotals[bestDay])) bestDay = day;
  });
  return { max, total, hot, dayTotals, colTotals, bestDay, mean: filled > 0 ? total / filled : 0 };
}
