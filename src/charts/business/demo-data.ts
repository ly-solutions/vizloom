/** Fictional demo data for stories and tests: a concert on sale, refunds, gate throughput. */
import { DAY, MINUTE, type SeriesFrame } from '../../core';

/** Small deterministic PRNG: stories look the same on every load. */
export function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const DEMO_START = Date.UTC(2026, 8, 1);

/** Daily ticket sales: an opening spike, a quiet middle, a rush to the event; weekends stronger. */
export function demoDailySales(days: number, factor = 1, seed = 7, stallLast = 0): number[] {
  const rnd = seeded(seed);
  const out: number[] = [];
  for (let i = 0; i < days; i++) {
    const opening = 90 * Math.exp(-i / 2.5);
    const base = 22 + i * 0.9;
    const weekend = new Date(DEMO_START + i * DAY).getUTCDay() % 6 === 0 ? 1.35 : 1;
    const v = Math.round((opening + base) * weekend * factor * (0.8 + rnd() * 0.4));
    out.push(i >= days - stallLast ? 0 : v);
  }
  return out;
}

/** Past events: cumulative share of capacity at equal points of the sales window (s-curves). */
export function demoHistory(count: number, seed = 3): number[][] {
  const rnd = seeded(seed);
  return Array.from({ length: count }, () => {
    const k = 3 + rnd() * 3;
    const finish = 0.82 + rnd() * 0.18;
    return Array.from({ length: 41 }, (_, i) => {
      const u = i / 40;
      return finish * (0.15 * u + 0.85 * u ** k * (1 + 0.2 * Math.sin(u * 3)));
    }).map((v) => Math.min(1, Math.max(0, v)));
  });
}

/** Daily turnover and refunds (money): a refund wave after a date change in the middle. */
export function demoRefunds(days: number, seed = 11, wave = true): { sales: number[]; refunds: number[] } {
  const rnd = seeded(seed);
  const sales: number[] = [];
  const refunds: number[] = [];
  for (let i = 0; i < days; i++) {
    const s = Math.round((1800 + 1400 * Math.sin(i / 5) ** 2 + rnd() * 900) * 10) * 10;
    let r = rnd() < 0.55 ? Math.round(s * rnd() * 0.08) : 0;
    if (wave && i >= Math.floor(days * 0.55) && i < Math.floor(days * 0.55) + 4) r = Math.round(s * (0.8 + rnd() * 0.7));
    sales.push(s);
    refunds.push(r);
  }
  return { sales, refunds };
}

export const GATE_IDS = ['north', 'south', 'east'] as const;
export type GateId = (typeof GATE_IDS)[number];
export const GATE_LABELS: Readonly<Record<GateId, string>> = { north: 'North gate', south: 'South gate', east: 'East gate' } as const;

export const ENTRY_START = Date.UTC(2026, 9, 12, 18, 0);

/**
 * Entry throughput per minute by gate: a slow trickle before the doors, a rush around the start,
 * a tail after. `shown` minutes are revealed (live mode reveals more each tick).
 */
export function demoEntryFrame(minutes: number, shown = minutes, seed = 5): SeriesFrame<GateId> {
  const rnd = seeded(seed);
  const weights: Readonly<Record<GateId, number>> = { north: 1, south: 0.7, east: 0.45 };
  const values = {} as Record<GateId, Float64Array>;
  for (const id of GATE_IDS) {
    const col = new Float64Array(minutes);
    for (let m = 0; m < minutes; m++) {
      if (m >= shown) {
        col[m] = Number.NaN;
        continue;
      }
      const rush = 38 * Math.exp(-(((m - 70) / 26) ** 2));
      const trickle = m < 30 ? 2 : 6;
      const idle = id === 'east' && m > 95 && m < 108;
      col[m] = idle ? 0 : Math.max(0, Math.round((trickle + rush) * weights[id] * (0.75 + rnd() * 0.5)));
    }
    values[id] = col;
  }
  return { start: ENTRY_START, step: MINUTE, length: minutes, values };
}
