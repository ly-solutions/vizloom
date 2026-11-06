import { useMemo } from 'react';

import { cx, DAY, type Formatter, Skeleton, UNIT_COUNT, useFormat, type ValueUnit } from '../../core';
import type { Pace } from '../model/pace';
import { type SelloutLabels, selloutLabels } from './labels';

export interface SelloutStatsProps {
  /** Result of `paceStats`; sold share and remaining need a `target`. */
  readonly pace: Pace;
  readonly unit?: ValueUnit;
  readonly loading?: boolean;
  readonly labels?: Partial<SelloutLabels>;
  readonly className?: string;
}

export interface SelloutRow {
  readonly id: 'sold' | 'speed' | 'toSellout' | 'remaining';
  readonly label: string;
  readonly value: string;
  readonly hint?: string;
}

/**
 * Rows that answer "will it sell out": sold of capacity, recent speed, days to sell-out (or
 * "after the event") and what is left. Pair it with a gauge of the sold share.
 */
export function selloutRows(pace: Pace, l: SelloutLabels, fmt: Formatter, unit: ValueUnit): SelloutRow[] {
  const target = pace.target ?? 0;
  const share = target > 0 ? Math.min(1, pace.sold / target) : 0;
  const n = (x: number) => (unit.kind === 'currency' ? fmt.value(x, unit) : fmt.number(Math.round(x)));
  const soldOut = target > 0 && pace.remaining === 0;
  let toSellout = l.never;
  let toSelloutHint: string | undefined;
  if (soldOut) toSellout = '—';
  else if (Number.isFinite(pace.daysToSellout)) {
    const date = fmt.day(pace.start + Math.round(pace.elapsed + pace.daysToSellout) * DAY);
    if (pace.selloutDay === null) toSelloutHint = l.selloutLate(date);
    else {
      toSellout = l.daysApprox(fmt.number(Math.ceil(pace.daysToSellout)));
      toSelloutHint = l.selloutBy(date);
    }
  }
  const remaining = pace.remaining === pace.remaining ? pace.remaining : 0;
  return [
    { id: 'sold', label: l.sold, value: l.soldOf(n(pace.sold), n(target)) },
    { id: 'speed', label: l.speed, value: l.perDay(fmt.value(Math.round(pace.speed), unit)), hint: l.speedHint(pace.speedDays) },
    { id: 'toSellout', label: l.toSellout, value: toSellout, hint: toSelloutHint },
    {
      id: 'remaining',
      label: l.remaining,
      value: fmt.value(remaining, unit, true),
      hint: target > 0 ? l.remainingHint(fmt.percent((1 - share) * 100, 0)) : undefined,
    },
  ];
}

export function SelloutStats({ pace, unit = UNIT_COUNT, loading = false, labels, className }: SelloutStatsProps) {
  const fmt = useFormat();
  const l = useMemo(() => ({ ...selloutLabels(fmt.locale), ...labels }), [fmt.locale, labels]);
  const rows = selloutRows(pace, l, fmt, unit);
  return (
    <dl className={cx('vl-sellout', className)} aria-busy={loading || undefined}>
      {rows.map((r) => (
        <div key={r.id} className="vl-sellout__row">
          <dt>
            {loading ? <Skeleton shape="text" size="s" /> : <span>{r.label}</span>}
            {!loading && r.hint ? <span className="vl-sellout__hint">{r.hint}</span> : null}
          </dt>
          <dd>{loading ? <Skeleton shape="text" size="xs" /> : <b>{r.value}</b>}</dd>
        </div>
      ))}
    </dl>
  );
}
