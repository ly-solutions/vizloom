/**
 * Time model: granularity, bucket alignment in local time, axis ticks.
 *
 * Everything is UTC milliseconds; "local" time comes from a `TimeZone`, which is a function of
 * the offset rather than an IANA string. That keeps the model free of `Intl` in tests and
 * identical on the server and in the browser. `fixedOffsetZone` covers zones without DST;
 * `intlZone` covers any IANA zone through `Intl.DateTimeFormat`.
 */

export const MINUTE = 60_000;
export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;
export const WEEK = 7 * DAY;

export const GRANULARITY = {
  hour: 'hour',
  day: 'day',
  week: 'week',
} as const;

export type Granularity = (typeof GRANULARITY)[keyof typeof GRANULARITY];

/** Bucket length of every granularity. Weeks start on Monday. */
export const GRANULARITY_STEP = {
  hour: HOUR,
  day: DAY,
  week: WEEK,
} as const satisfies Record<Granularity, number>;

/** Finest first: the order matters when picking a granularity for a width. */
export const GRANULARITY_ORDER = ['hour', 'day', 'week'] as const satisfies readonly Granularity[];

export interface TimeZone {
  /** Offset of local time from UTC in milliseconds at moment `t`. */
  offset(t: number): number;
}

export function fixedOffsetZone(hours: number): TimeZone {
  const offset = hours * HOUR;
  return { offset: () => offset };
}

export const UTC_ZONE: TimeZone = fixedOffsetZone(0);

/** Any IANA zone (with DST) through Intl. Offsets are cached per hour. */
export function intlZone(timeZone: string): TimeZone {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  });
  const cache = new Map<number, number>();
  return {
    offset(t) {
      const key = Math.floor(t / HOUR);
      const hit = cache.get(key);
      if (hit !== undefined) return hit;
      const parts: Record<string, number> = {};
      for (const p of fmt.formatToParts(new Date(t))) if (p.type !== 'literal') parts[p.type] = Number(p.value);
      const local = Date.UTC(parts['year'], parts['month'] - 1, parts['day'], parts['hour'] % 24, parts['minute'], parts['second']);
      const offset = Math.round((local - Math.floor(t / 1000) * 1000) / MINUTE) * MINUTE;
      if (cache.size > 2048) cache.clear();
      cache.set(key, offset);
      return offset;
    },
  };
}

/** Thursday 1 Jan 1970 → Monday 5 Jan: shift to the start of a week. */
const MONDAY_SHIFT = 4 * DAY;

/** Start of the bucket of `granularity` that contains `t`. */
export function floorTo(t: number, granularity: Granularity, zone: TimeZone = UTC_ZONE): number {
  const offset = zone.offset(t);
  if (granularity === 'hour') return Math.floor((t + offset) / HOUR) * HOUR - offset;
  if (granularity === 'day') return Math.floor((t + offset) / DAY) * DAY - offset;
  return Math.floor((t + offset - MONDAY_SHIFT) / WEEK) * WEEK + MONDAY_SHIFT - offset;
}

export interface WallTime {
  readonly year: number;
  /** 0-based, like `Date#getMonth`. */
  readonly month: number;
  readonly day: number;
  readonly hours: number;
  readonly minutes: number;
  /** 0 is Sunday, like `Date#getDay`. */
  readonly weekday: number;
}

/** Local wall-clock parts without Intl: shift by the zone offset and read as UTC. */
export function wallTime(t: number, zone: TimeZone = UTC_ZONE): WallTime {
  const d = new Date(t + zone.offset(t));
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth(),
    day: d.getUTCDate(),
    hours: d.getUTCHours(),
    minutes: d.getUTCMinutes(),
    weekday: d.getUTCDay(),
  };
}

export function isMidnight(t: number, zone: TimeZone = UTC_ZONE): boolean {
  return floorTo(t, 'day', zone) === t;
}

export interface TimeRange {
  readonly start: number;
  readonly end: number;
}

export interface GranularityThresholds {
  /** Minimal bucket width in px to switch to this granularity. */
  readonly enter: number;
  /** Width below which it is left. Lower than `enter`: hysteresis against flicker. */
  readonly leave: number;
}

export const DEFAULT_GRANULARITY_THRESHOLDS = {
  hour: { enter: 9, leave: 7 },
  day: { enter: 7, leave: 5 },
} as const satisfies Partial<Record<Granularity, GranularityThresholds>>;

/**
 * Granularity for a window width: the finest whose bucket is not narrower than the threshold.
 * `current` is left by `leave`, a new one is entered by `enter`.
 */
export function pickGranularity(
  spanMs: number,
  widthPx: number,
  current: Granularity | null = null,
  thresholds: Partial<Record<Granularity, GranularityThresholds>> = DEFAULT_GRANULARITY_THRESHOLDS,
): Granularity {
  for (const granularity of GRANULARITY_ORDER) {
    const limit = thresholds[granularity];
    if (!limit) continue;
    const bucketPx = (widthPx * GRANULARITY_STEP[granularity]) / Math.max(spanMs, 1);
    if (bucketPx >= (current === granularity ? limit.leave : limit.enter)) return granularity;
  }
  return 'week';
}

/** Granularity for the whole-period navigator: weeks only for very long histories. */
export function overviewGranularity(range: TimeRange): Granularity {
  const span = range.end - range.start;
  if (span <= 6 * DAY) return 'hour';
  if (span <= 400 * DAY) return 'day';
  return 'week';
}

/** Axis tick levels from an hour to a year. The densest level with a gap ≥ `minGapPx` wins. */
export const TICK_LEVELS = [
  HOUR,
  2 * HOUR,
  3 * HOUR,
  6 * HOUR,
  12 * HOUR,
  DAY,
  2 * DAY,
  WEEK,
  2 * WEEK,
  'month',
  'quarter',
  'year',
] as const;

export type TickLevel = (typeof TICK_LEVELS)[number];

const MONTH_APPROX = 30.4 * DAY;
const levelMs = (level: TickLevel): number => {
  if (level === 'month') return MONTH_APPROX;
  if (level === 'quarter') return 3 * MONTH_APPROX;
  if (level === 'year') return 365 * DAY;
  return level;
};

export function tickLevelFor(spanMs: number, widthPx: number, minGapPx = 64): TickLevel {
  for (const level of TICK_LEVELS) if ((widthPx * levelMs(level)) / Math.max(spanMs, 1) >= minGapPx) return level;
  return 'year';
}

/** Tick moments of `level` inside `[start, end]`, aligned to local time. */
export function ticksFor(level: TickLevel, range: TimeRange, zone: TimeZone = UTC_ZONE, limit = 400): number[] {
  const out: number[] = [];
  if (level === 'month' || level === 'quarter' || level === 'year') {
    const stepMonths = level === 'month' ? 1 : level === 'quarter' ? 3 : 12;
    const w = wallTime(range.start, zone);
    let year = w.year;
    let month = Math.floor(w.month / stepMonths) * stepMonths;
    for (let i = 0; i < 1200 && out.length < limit; i++) {
      const local = Date.UTC(year, month, 1);
      const t = local - zone.offset(local);
      if (t > range.end) break;
      if (t >= range.start) out.push(t);
      month += stepMonths;
      while (month > 11) {
        month -= 12;
        year++;
      }
    }
    return out;
  }
  const offset = zone.offset(range.start);
  const first =
    level < WEEK
      ? Math.floor((range.start + offset) / level) * level - offset
      : Math.floor((range.start + offset - MONDAY_SHIFT) / level) * level + MONDAY_SHIFT - offset;
  for (let t = first; t <= range.end && out.length < limit; t += level) if (t >= range.start) out.push(t);
  return out;
}

export function rangeSpan(range: TimeRange): number {
  return range.end - range.start;
}

export function clampRange(range: TimeRange, extent: TimeRange): TimeRange {
  const span = Math.min(range.end - range.start, extent.end - extent.start);
  let start = Math.max(extent.start, range.start);
  let end = start + span;
  if (end > extent.end) {
    end = extent.end;
    start = end - span;
  }
  return { start, end };
}
