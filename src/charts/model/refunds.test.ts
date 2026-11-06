import { describe, expect, it } from 'vitest';

import { refundStats } from './refunds';

describe('refundStats', () => {
  it('accumulates sales and refunds; the remainder is the difference', () => {
    const r = refundStats({ start: 0, sales: [100, 50, Number.NaN], refunds: [0, 20, 10] });
    expect(r.sold).toEqual([100, 150, 150]);
    expect(r.refunded).toEqual([0, 20, 30]);
    expect(r.net).toEqual([100, 130, 120]);
    expect(r.share).toBeCloseTo(0.2);
    expect(r.maxDailyRefund).toBe(20);
    expect(r.dailyNet).toEqual([100, 30, -10]);
  });

  it('with no sales the refund share is zero, not NaN', () => {
    expect(refundStats({ start: 0, sales: [], refunds: [] }).share).toBe(0);
  });
});
