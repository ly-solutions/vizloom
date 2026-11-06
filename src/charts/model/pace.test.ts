import { describe, expect, it } from 'vitest';

import { paceStats, PACE_BASIS } from './pace';
import { DAY } from '../../core';

const START = Date.UTC(2026, 8, 25);
const EVENT = START + 30 * DAY;

describe('paceStats', () => {
  it('accumulates actuals by day; a missed collection does not reset the accumulated total', () => {
    const p = paceStats({ start: START, event: EVENT, daily: [10, Number.NaN, 5] });
    expect(p.cumulative).toEqual([0, 10, 10, 15]);
    expect(p.sold).toBe(15);
    expect(p.elapsed).toBe(3);
    expect(p.days).toBe(30);
  });

  it('without a target or history there is nothing to compare against, no sell-out', () => {
    const p = paceStats({ start: START, event: EVENT, daily: [10, 10] });
    expect(p.basis).toBe(PACE_BASIS.none);
    expect(Number.isNaN(p.pace)).toBe(true);
    expect(p.selloutDay).toBeNull();
  });

  it('with a target but no history, pace is measured against an even plan', () => {
    const p = paceStats({ start: START, event: EVENT, daily: Array(10).fill(10), target: 600 });
    // The plan for day 10 is 200; 100 sold.
    expect(p.basis).toBe(PACE_BASIS.plan);
    expect(p.expected).toBeCloseTo(200);
    expect(p.pace).toBeCloseTo(0.5);
  });

  it('with history, pace is measured against the median of past events; the band needs two events', () => {
    const linear = Array.from({ length: 31 }, (_, i) => i / 30);
    const one = paceStats({ start: START, event: EVENT, daily: Array(15).fill(20), target: 600, history: [linear] });
    expect(one.basis).toBe(PACE_BASIS.typical);
    expect(one.corridor).toBeNull();
    expect(one.expected).toBeCloseTo(300);
    expect(one.pace).toBeCloseTo(1);
    const two = paceStats({
      start: START,
      event: EVENT,
      daily: Array(15).fill(20),
      target: 600,
      history: [linear, linear.map((v) => v * 0.5)],
    });
    expect(two.corridor).not.toBeNull();
    expect(two.corridor?.low[15]).toBeCloseTo(150);
    expect(two.corridor?.high[15]).toBeCloseTo(300);
  });

  it('forecast follows the recent daily rate and does not exceed the target; sell-out date', () => {
    const p = paceStats({ start: START, event: EVENT, daily: [0, 0, 0, 50, 50, 50, 50, 50, 50, 50], target: 600, speedDays: 7 });
    expect(p.speed).toBe(50);
    expect(p.forecast[0]).toBe(350);
    expect(Math.max(...p.forecast)).toBe(600);
    // 250 remaining at 50 per day — in 5 days, on day 15 of the window.
    expect(p.daysToSellout).toBeCloseTo(5);
    expect(p.selloutDay).toBeCloseTo(15);
  });

  it('the rate falls short of the event: no sell-out date, forecast at the date is below the target', () => {
    const p = paceStats({ start: START, event: EVENT, daily: Array(10).fill(5), target: 600 });
    expect(p.selloutDay).toBeNull();
    expect(p.projected).toBe(150);
    expect(p.daysLeft).toBe(20);
  });

  it('no sales: time to sell-out is infinite', () => {
    const p = paceStats({ start: START, event: EVENT, daily: [0, 0, 0], target: 600 });
    expect(p.daysToSellout).toBe(Number.POSITIVE_INFINITY);
    expect(p.selloutDay).toBeNull();
  });
});
