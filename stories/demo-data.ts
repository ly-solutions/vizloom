/**
 * Fictional demo data for stories and example dashboards: a concert ("Northern Lights Live")
 * selling four ticket types over ~8 weeks. Deterministic (seeded), no real people or companies.
 */
import {
  createLocalSource,
  DAY,
  HOUR,
  type HourlySeries,
  type TimeMarker,
  type TimeZoneBand,
  type Series,
  type TileSource,
} from '../src/core';

export function rng(seed = 7): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 1_000_000) / 1_000_000;
  };
}

export const TICKET_TYPES = ['floor', 'balcony', 'vip', 'early'] as const;
export type TicketType = (typeof TICKET_TYPES)[number];

export const TICKET_SERIES: readonly Series<TicketType>[] = [
  { id: 'floor', label: 'Dance floor', slot: 0 },
  { id: 'balcony', label: 'Balcony', slot: 1 },
  { id: 'vip', label: 'VIP lounge', slot: 2 },
  { id: 'early', label: 'Early bird', slot: 3 },
];

export const PRICES: Record<TicketType, number> = { floor: 45, balcony: 35, vip: 120, early: 29 };

/** "Now" of the demo: Oct 9 2026, 07:20 UTC. The event is Oct 24, 19:00 UTC. */
export const NOW = Date.UTC(2026, 9, 9, 7, 20);
export const EVENT = Date.UTC(2026, 9, 24, 19, 0);
export const START = Date.UTC(2026, 7, 17, 0, 0);

/** 24-hour purchase profile (evenings peak). */
const PROFILE = [
  0.2, 0.1, 0.06, 0.04, 0.04, 0.08, 0.2, 0.4, 0.6, 0.75, 0.85, 0.9, 1, 0.95, 0.9, 0.9, 0.95, 1.05, 1.2, 1.35, 1.4, 1.2, 0.8, 0.45,
];

export function makeHourly(seed = 7, end = NOW): HourlySeries<TicketType> {
  const r = rng(seed);
  const length = Math.floor((end - START) / HOUR);
  const values = {} as Record<TicketType, Float64Array>;
  const base: Record<TicketType, number> = { floor: 2.2, balcony: 1.3, vip: 0.35, early: 3 };
  for (const id of TICKET_TYPES) values[id] = new Float64Array(length);
  for (let i = 0; i < length; i++) {
    const t = START + i * HOUR;
    const h = new Date(t).getUTCHours();
    const day = (t - START) / DAY;
    const weekday = new Date(t).getUTCDay();
    const weekend = weekday === 0 || weekday === 6 ? 1.25 : 1;
    // Launch spike, price wave on day 21, ad campaign days 34-40, ramp towards the event.
    const launch = day < 2 ? 4 - day * 1.5 : 1;
    const ads = day > 34 && day < 40 ? 1.6 : 1;
    const ramp = 1 + Math.max(0, day - 30) / 25;
    for (const id of TICKET_TYPES) {
      let k = base[id] * PROFILE[h] * weekend * launch * ads * ramp;
      if (id === 'early') k *= day < 21 ? 1 : 0; // early bird ends on day 21
      if (id === 'vip' && day > 44) k *= 0.3; // VIP almost sold out
      values[id][i] = Math.max(0, Math.round(k * (0.4 + r() * 1.2)));
    }
  }
  return { start: START, length, values };
}

export const HOURLY = makeHourly();

export function turnoverOf(h: HourlySeries<TicketType>): HourlySeries<TicketType> {
  const values = {} as Record<TicketType, Float64Array>;
  for (const id of TICKET_TYPES) values[id] = Float64Array.from(h.values[id] as ArrayLike<number>, (v) => v * PRICES[id]);
  return { start: h.start, length: h.length, values };
}

export type DemoMetric = 'tickets' | 'turnover';

export function demoSource(options: { latency?: number; fail?: boolean } = {}): TileSource<TicketType, DemoMetric> {
  return createLocalSource<TicketType, DemoMetric>({
    hourly: { tickets: HOURLY, turnover: turnoverOf(HOURLY) },
    extent: { start: START, end: NOW, now: NOW, event: EVENT },
    latency: options.latency ?? 0,
    fail: options.fail ? () => true : undefined,
  });
}

export const MARKERS: readonly TimeMarker<TicketType>[] = [
  { id: 'm1', t: START + 2 * HOUR, kind: 'start', label: 'Sales opened', priority: 1 },
  { id: 'm2', t: START + 9 * DAY + 10 * HOUR, kind: 'promo', label: 'Promo code FRIENDS10', detail: '−10% for 3 days', priority: 2 },
  { id: 'm3', t: START + 21 * DAY, kind: 'price', label: 'Price wave 2', detail: 'Dance floor $39 → $45', series: ['floor'], priority: 1 },
  { id: 'm4', t: START + 34 * DAY + 12 * HOUR, kind: 'ads', label: 'Social ads campaign', priority: 2 },
  { id: 'm5', t: START + 44 * DAY + 18 * HOUR, kind: 'soldout', label: 'VIP almost sold out', series: ['vip'], priority: 1 },
  { id: 'm6', t: START + 48 * DAY + 9 * HOUR, kind: 'mail', label: 'Newsletter', priority: 3 },
];

export const ZONES: readonly TimeZoneBand[] = [
  { id: 'z1', from: START, to: START + 21 * DAY, label: 'Wave 1', note: 'floor $39', tone: 'accent' },
  { id: 'z2', from: START + 21 * DAY, to: NOW, label: 'Wave 2', note: 'floor $45', tone: 'neutral' },
  { id: 'z3', from: START + 34 * DAY, to: START + 40 * DAY, label: 'Ads', tone: 'warning' },
];

export function totals(h: HourlySeries<TicketType> = HOURLY, from = h.start, to = h.start + h.length * HOUR): Record<TicketType, number> {
  const out = { floor: 0, balcony: 0, vip: 0, early: 0 } as Record<TicketType, number>;
  const i0 = Math.max(0, Math.floor((from - h.start) / HOUR));
  const i1 = Math.min(h.length, Math.ceil((to - h.start) / HOUR));
  for (const id of TICKET_TYPES) for (let i = i0; i < i1; i++) out[id] += h.values[id][i];
  return out;
}

/** Daily totals of all types for sparklines. */
export function dailyTotals(h: HourlySeries<TicketType> = HOURLY, days = 30): number[] {
  const out: number[] = [];
  const perDay = 24;
  const last = h.length;
  for (let d = days; d > 0; d--) {
    let sum = 0;
    for (let i = last - d * perDay; i < last - (d - 1) * perDay; i++) if (i >= 0) for (const id of TICKET_TYPES) sum += h.values[id][i];
    out.push(sum);
  }
  return out;
}

export interface DemoOrder {
  readonly id: string;
  readonly at: number;
  readonly type: TicketType;
  readonly qty: number;
  readonly buyer: string;
  readonly channel: string;
  readonly refund: boolean;
}

const FIRST = ['Alex', 'Sam', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Jamie', 'Avery', 'Quinn', 'Rowan', 'Skyler'];
const LAST = ['K.', 'M.', 'R.', 'T.', 'L.', 'S.', 'B.', 'W.'];
const CHANNELS = ['Website', 'Newsletter', 'Social ads', 'Partner link', 'Direct'];

export function makeOrders(n = 60, seed = 11, now = NOW): DemoOrder[] {
  const r = rng(seed);
  const out: DemoOrder[] = [];
  let t = now;
  for (let i = 0; i < n; i++) {
    t -= Math.floor(r() * 50 * 60_000);
    out.push({
      id: `ord-${1000 + i}`,
      at: t,
      type: TICKET_TYPES[Math.floor(r() * 4)],
      qty: 1 + Math.floor(r() * 3),
      buyer: `${FIRST[Math.floor(r() * FIRST.length)]} ${LAST[Math.floor(r() * LAST.length)]}`,
      channel: CHANNELS[Math.floor(r() * CHANNELS.length)],
      refund: r() < 0.08,
    });
  }
  return out;
}
