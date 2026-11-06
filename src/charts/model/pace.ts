import { DAY } from '../../core';

/**
 * Sales pace: cumulative sales from launch to the event versus the usual curve of past
 * events (or an even-pace plan when there is no history), a forecast and the sell-out date.
 */
export interface PaceInput {
  /** Sales start and event date, ms. The chart window runs from start to event. */
  readonly start: number;
  readonly event: number;
  /** Sales per day from the start: `daily[i]` covers day `start + i·DAY`. Length is the number of days elapsed. `NaN` — data collection was down. */
  readonly daily: readonly number[];
  /** Target in the same unit: venue capacity in tickets, or full-house revenue. Absent — no plan and no sell-out. */
  readonly target?: number;
  /**
   * Past events: cumulative share of the target (0…1) at equally spaced points of the sales window,
   * from the start (first point) to the event (last point). Lengths may differ.
   */
  readonly history?: readonly (readonly number[])[];
  /** How many recent days to measure speed over. Defaults to 7. */
  readonly speedDays?: number;
}

export const PACE_BASIS = { typical: 'typical', plan: 'plan', none: 'none' } as const;
export type PaceBasis = (typeof PACE_BASIS)[keyof typeof PACE_BASIS];

export interface Pace {
  readonly start: number;
  readonly event: number;
  /** Days in the sales window; chart points are `0…days`. */
  readonly days: number;
  /** Days elapsed: actual data covers points `0…elapsed`. */
  readonly elapsed: number;
  /** Accumulated by the end of the day; `cumulative[0] = 0` is the start. Length is `elapsed + 1`. */
  readonly cumulative: readonly number[];
  /** Total sold. */
  readonly sold: number;
  readonly target: number | null;
  /** Average sales per day over the last `speedDays`. */
  readonly speed: number;
  readonly speedDays: number;
  /** Forecast from "now" to the event at the current speed, capped at the target: points `elapsed…days`. */
  readonly forecast: readonly number[];
  /** Usual curve (median of past events) and band (between quartiles), points `0…days`; `null` — no history. */
  readonly typical: readonly number[] | null;
  readonly corridor: { readonly low: readonly number[]; readonly high: readonly number[] } | null;
  /** What we compare against: the usual curve, an even plan to the target, or nothing. */
  readonly basis: PaceBasis;
  /** How much is usually sold by this day; `NaN` — nothing to compare with. */
  readonly expected: number;
  /** Pace: actual vs usual; `1` is as usual, `0.86` is 14% behind. `NaN` — nothing to compare with. */
  readonly pace: number;
  /** Day the target sells out at the current speed (index from start, fractional); `null` — won't sell out before the event, or no target. */
  readonly selloutDay: number | null;
  /** Days until sell-out from now at the current speed; `Infinity` — speed is zero. */
  readonly daysToSellout: number;
  /** Days from now until the event. */
  readonly daysLeft: number;
  /** Forecast as of the event date. */
  readonly projected: number;
  readonly remaining: number;
}

/** Median and quartiles — the band needs at least two past events. */
const CORRIDOR_MIN = 2;

/** Cumulative share at moment `u` (0…1) over equally spaced points. */
function sampleAt(points: readonly number[], u: number): number {
  if (points.length === 0) return Number.NaN;
  if (points.length === 1) return points[0];
  const x = Math.min(1, Math.max(0, u)) * (points.length - 1);
  const i = Math.min(points.length - 2, Math.floor(x));
  const f = x - i;
  return points[i] + (points[i + 1] - points[i]) * f;
}

function quantile(sorted: readonly number[], q: number): number {
  if (sorted.length === 0) return Number.NaN;
  const x = (sorted.length - 1) * q;
  const i = Math.floor(x);
  const f = x - i;
  return i + 1 < sorted.length ? sorted[i] + (sorted[i + 1] - sorted[i]) * f : sorted[i];
}

export function paceStats(input: PaceInput): Pace {
  const days = Math.max(1, Math.round((input.event - input.start) / DAY));
  const elapsed = Math.min(days, input.daily.length);
  const cumulative = [0];
  for (let i = 0; i < elapsed; i++) {
    const v = input.daily[i];
    cumulative.push(cumulative[i] + (v === v ? v : 0));
  }
  const sold = cumulative[elapsed];
  const target = input.target !== undefined && input.target > 0 ? input.target : null;

  const speedDays = Math.max(1, Math.min(input.speedDays ?? 7, elapsed || 1));
  let recent = 0;
  let seen = 0;
  for (let i = Math.max(0, elapsed - speedDays); i < elapsed; i++) {
    const v = input.daily[i];
    if (v !== v) continue;
    recent += v;
    seen++;
  }
  const speed = seen > 0 ? recent / seen : 0;

  const cap = target ?? Number.POSITIVE_INFINITY;
  const forecast: number[] = [];
  for (let i = elapsed; i <= days; i++) forecast.push(Math.min(cap, sold + speed * (i - elapsed)));
  const projected = forecast[forecast.length - 1] ?? sold;

  const history = (input.history ?? []).filter((h) => h.length > 0);
  let typical: number[] | null = null;
  let corridor: { low: number[]; high: number[] } | null = null;
  if (target !== null && history.length > 0) {
    typical = [];
    const low: number[] = [];
    const high: number[] = [];
    for (let i = 0; i <= days; i++) {
      const at = history.map((h) => sampleAt(h, i / days)).sort((a, b) => a - b);
      typical.push(quantile(at, 0.5) * target);
      low.push(quantile(at, history.length >= 4 ? 0.25 : 0) * target);
      high.push(quantile(at, history.length >= 4 ? 0.75 : 1) * target);
    }
    if (history.length >= CORRIDOR_MIN) corridor = { low, high };
  }

  let basis: PaceBasis = PACE_BASIS.none;
  let expected = Number.NaN;
  if (typical) {
    basis = PACE_BASIS.typical;
    expected = typical[elapsed];
  } else if (target !== null) {
    basis = PACE_BASIS.plan;
    expected = (target * elapsed) / days;
  }
  const pace = expected > 0 ? sold / expected : Number.NaN;

  const remaining = target !== null ? Math.max(0, target - sold) : Number.NaN;
  let daysToSellout = Number.POSITIVE_INFINITY;
  if (target !== null && remaining === 0) daysToSellout = 0;
  else if (target !== null && speed > 0) daysToSellout = remaining / speed;
  const selloutDay = elapsed + daysToSellout <= days ? elapsed + daysToSellout : null;

  return {
    start: input.start,
    event: input.event,
    days,
    elapsed,
    cumulative,
    sold,
    target,
    speed,
    speedDays,
    forecast,
    typical,
    corridor,
    basis,
    expected,
    pace,
    selloutDay,
    daysToSellout,
    daysLeft: days - elapsed,
    projected,
    remaining,
  };
}
