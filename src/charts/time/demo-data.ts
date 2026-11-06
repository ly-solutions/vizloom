/**
 * Fictional demo data for stories and tests: ticket sales of an open-air concert by channel,
 * hourly, with a daily rhythm, weekends, a rush before the event and campaign bumps.
 * Deterministic (seeded) so stories and snapshots are stable.
 */
import { createLocalSource, DAY, HOUR, type SeriesFrame, type TileSource, type TimeMarker, type TimeZoneBand } from '../../core';

export const DEMO_CHANNELS = [
  { id: 'web', label: 'Website' },
  { id: 'app', label: 'Mobile app' },
  { id: 'partners', label: 'Partner resellers' },
  { id: 'boxOffice', label: 'Box office' },
] as const;
export type DemoChannel = (typeof DEMO_CHANNELS)[number]['id'];
export type DemoMetric = 'tickets' | 'revenue';

/** Small fast PRNG (mulberry32). */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SHARE: Readonly<Record<DemoChannel, number>> = { web: 0.46, app: 0.3, partners: 0.17, boxOffice: 0.07 };
/** Average ticket price by channel, in currency units. */
const PRICE: Readonly<Record<DemoChannel, number>> = { web: 42, app: 39, partners: 47, boxOffice: 35 };

export interface DemoSales {
  readonly start: number;
  readonly days: number;
  /** "Now": the last hour with data. */
  readonly now: number;
  /** The concert. */
  readonly event: number;
  readonly hourly: Readonly<Record<DemoMetric, { start: number; length: number; values: Record<DemoChannel, Float64Array> }>>;
}

export interface DemoSalesOptions {
  /** Days of history before "now". */
  readonly days?: number;
  /** Days from "now" to the event. */
  readonly ahead?: number;
  readonly seed?: number;
  /** Tickets per day at the start. */
  readonly base?: number;
  /** Fixed start (UTC ms, hour-aligned). Default: 1 Sep 2026. */
  readonly start?: number;
}

const DEFAULT_START = Date.UTC(2026, 8, 1);

/** Hourly sales of four channels. Hours after "now" are NaN (no data yet). */
export function demoSales({ days = 60, ahead = 14, seed = 7, base = 120, start = DEFAULT_START }: DemoSalesOptions = {}): DemoSales {
  const rnd = seeded(seed);
  const length = (days + ahead) * 24;
  const nowIndex = days * 24 - 1;
  const event = start + (days + ahead) * DAY - 4 * HOUR;
  const tickets = {} as Record<DemoChannel, Float64Array>;
  const revenue = {} as Record<DemoChannel, Float64Array>;
  for (const c of DEMO_CHANNELS) {
    tickets[c.id] = new Float64Array(length).fill(Number.NaN);
    revenue[c.id] = new Float64Array(length).fill(Number.NaN);
  }
  for (let h = 0; h <= nowIndex; h++) {
    const t = start + h * HOUR;
    const hour = new Date(t).getUTCHours();
    const weekday = new Date(t).getUTCDay();
    const day = h / 24;
    // Evening peak, quiet nights, livelier weekends, a rush in the last weeks, two campaigns.
    const rhythm = 0.15 + Math.max(0, Math.sin(((hour - 7) / 24) * Math.PI * 2)) * 1.6 + (hour >= 19 && hour <= 22 ? 0.6 : 0);
    const weekend = weekday === 0 || weekday === 6 ? 1.35 : 1;
    const rush = 1 + Math.max(0, day - days * 0.55) * 0.05;
    const campaign = 1 + 1.4 * Math.exp(-(((day - days * 0.3) / 1.6) ** 2)) + 0.9 * Math.exp(-(((day - days * 0.75) / 1.2) ** 2));
    const level = (base / 24) * rhythm * weekend * rush * campaign;
    for (const c of DEMO_CHANNELS) {
      const n = Math.max(0, Math.round(level * SHARE[c.id] * (0.7 + rnd() * 0.6)));
      tickets[c.id][h] = n;
      revenue[c.id][h] = n * PRICE[c.id] * (0.92 + rnd() * 0.16);
    }
  }
  return {
    start,
    days,
    now: start + (nowIndex + 1) * HOUR,
    event,
    hourly: { tickets: { start, length, values: tickets }, revenue: { start, length, values: revenue } },
  };
}

/** A tile source over the demo sales (granularity is aggregated on the client). */
export function demoSource(
  sales: DemoSales,
  options: { latency?: number; fail?: () => boolean } = {},
): TileSource<DemoChannel, DemoMetric> {
  return createLocalSource<DemoChannel, DemoMetric>({
    hourly: sales.hourly,
    extent: { start: sales.start, end: sales.event + DAY, now: sales.now, event: sales.event },
    latency: options.latency ?? 0,
    fail: options.fail,
  });
}

/** Daily frame of one metric, summing hours; days after "now" are NaN. */
export function dailyFrame(sales: DemoSales, metric: DemoMetric = 'tickets', ids: readonly DemoChannel[] = DEMO_CHANNELS.map((c) => c.id)) {
  const hourly = sales.hourly[metric];
  const days = Math.floor(hourly.length / 24);
  const values = {} as Record<DemoChannel, Float64Array>;
  for (const id of ids) {
    const col = new Float64Array(days).fill(Number.NaN);
    for (let d = 0; d < days; d++) {
      let sum = 0;
      let seen = false;
      for (let h = d * 24; h < d * 24 + 24; h++) {
        const v = hourly.values[id][h];
        if (v === v) {
          sum += v;
          seen = true;
        }
      }
      if (seen) col[d] = sum;
    }
    values[id] = col;
  }
  const frame: SeriesFrame<DemoChannel> = { start: sales.start, step: DAY, length: days, values, granularity: 'day' };
  return frame;
}

/** A frame of N random-walk points per series — for performance stories. */
export function randomWalkFrame(points: number, series = 3, step = HOUR, seed = 3): SeriesFrame<string> {
  const rnd = seeded(seed);
  const values: Record<string, Float64Array> = {};
  for (let s = 0; s < series; s++) {
    const col = new Float64Array(points);
    let v = 50 + s * 20;
    for (let k = 0; k < points; k++) {
      v = Math.max(0, v + (rnd() - 0.5) * 8);
      col[k] = v;
    }
    values[`s${s + 1}`] = col;
  }
  return { start: DEFAULT_START, step, length: points, values };
}

export type DemoMarkerKind = 'price' | 'promo' | 'post' | 'lineup';

export function demoMarkers(sales: DemoSales): TimeMarker<DemoChannel, DemoMarkerKind>[] {
  const at = (day: number, hour = 12) => sales.start + day * DAY + hour * HOUR;
  return [
    { id: 'm-open', t: at(0, 10), kind: 'lineup', label: 'Sales opened', priority: 1 },
    {
      id: 'm-early',
      t: at(Math.round(sales.days * 0.3), 9),
      kind: 'promo',
      label: 'Early bird code AUTUMN15',
      detail: '15% off, 3 days',
      priority: 2,
    },
    { id: 'm-post', t: at(Math.round(sales.days * 0.3) + 1, 18), kind: 'post', label: 'Social post: stage reveal', priority: 3 },
    {
      id: 'm-price',
      t: at(Math.round(sales.days * 0.5), 0),
      kind: 'price',
      label: 'Price step: €39 → €45',
      priority: 1,
      series: ['web', 'app'],
    },
    { id: 'm-headliner', t: at(Math.round(sales.days * 0.75), 11), kind: 'lineup', label: 'Headliner announced', priority: 1 },
    { id: 'm-mail', t: at(Math.round(sales.days * 0.75) + 2, 8), kind: 'post', label: 'Newsletter to past buyers', priority: 3 },
  ];
}

export function demoZones(sales: DemoSales): TimeZoneBand[] {
  const at = (day: number) => sales.start + day * DAY;
  const d = sales.days;
  return [
    { id: 'z-early', from: at(0), to: at(Math.round(d * 0.5)), label: 'Early bird', note: '€39', tone: 'positive' },
    { id: 'z-regular', from: at(Math.round(d * 0.5)), to: sales.event, label: 'Regular', note: '€45', tone: 'neutral' },
  ];
}

/** Marker icons for stories: tiny inline SVGs by kind. */
export const DEMO_MARKER_PATHS: Readonly<Record<DemoMarkerKind, string>> = {
  price: 'M3 8.5 8.5 3H13v4.5L7.5 13z M10.5 5.5h.01',
  promo: 'M3 5h10v2a1.5 1.5 0 0 0 0 3v2H3v-2a1.5 1.5 0 0 0 0-3z',
  post: 'M3 4h10v7H6l-3 2.5z',
  lineup: 'M8 2.5l1.6 3.3 3.6.5-2.6 2.5.6 3.6L8 10.7l-3.2 1.7.6-3.6-2.6-2.5 3.6-.5z',
};
