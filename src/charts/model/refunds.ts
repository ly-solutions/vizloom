/**
 * Revenue after refunds: sold and refunded as running totals, the remainder is the difference.
 * A refund belongs to the day the money was returned, not the purchase day.
 */
export interface RefundInput {
  /** Period start, ms; `sales[i]` and `refunds[i]` cover the day `start + i·DAY`. */
  readonly start: number;
  readonly sales: readonly number[];
  readonly refunds: readonly number[];
}

export interface Refunds {
  readonly start: number;
  readonly days: number;
  /** Running total up to the end of day `i`; length is `days`. */
  readonly sold: readonly number[];
  readonly refunded: readonly number[];
  readonly net: readonly number[];
  /** Per day: turnover, refunds and what is left (may be below zero — more refunded than sold). */
  readonly dailySales: readonly number[];
  readonly dailyRefunds: readonly number[];
  readonly dailyNet: readonly number[];
  readonly totalSold: number;
  readonly totalRefunded: number;
  readonly totalNet: number;
  /** Share of sales that was refunded; `0` if there are no sales. */
  readonly share: number;
  /** Largest single-day refund — the scale of the refund bars. */
  readonly maxDailyRefund: number;
}

const num = (v: number | undefined) => (v !== undefined && v === v ? v : 0);

export function refundStats(input: RefundInput): Refunds {
  const days = Math.max(input.sales.length, input.refunds.length);
  const sold: number[] = [];
  const refunded: number[] = [];
  const net: number[] = [];
  const dailySales: number[] = [];
  const dailyRefunds: number[] = [];
  const dailyNet: number[] = [];
  let s = 0;
  let r = 0;
  let maxDailyRefund = 0;
  for (let i = 0; i < days; i++) {
    const si = num(input.sales[i]);
    s += si;
    const ri = num(input.refunds[i]);
    dailySales.push(si);
    dailyRefunds.push(ri);
    dailyNet.push(si - ri);
    r += ri;
    maxDailyRefund = Math.max(maxDailyRefund, ri);
    sold.push(s);
    refunded.push(r);
    net.push(s - r);
  }
  return {
    start: input.start,
    days,
    sold,
    refunded,
    net,
    dailySales,
    dailyRefunds,
    dailyNet,
    totalSold: s,
    totalRefunded: r,
    totalNet: s - r,
    share: s > 0 ? r / s : 0,
    maxDailyRefund,
  };
}
