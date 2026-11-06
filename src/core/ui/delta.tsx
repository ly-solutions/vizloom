import { type ReactNode } from 'react';

import { deltaDirection, type DeltaDirection } from '../model/format';
import { useFormat } from '../theme/provider';
import { cx } from './cx';

export interface DeltaBadgeProps {
  /** Change in percent (`+24` is +24%). Use `percentChange(current, previous)`. */
  readonly value: number;
  /** Lower is better (refunds, churn): colours flip, arrows do not. */
  readonly invert?: boolean;
  /** `chip` — filled pill, `text` — coloured text only. */
  readonly variant?: 'chip' | 'text';
  readonly size?: 's' | 'm';
  /** Below this absolute value the change reads as "flat". Default 0.5. */
  readonly flatThreshold?: number;
  readonly fractionDigits?: number;
  /** Text after the value: "vs last week". */
  readonly suffix?: ReactNode;
  /** Custom text instead of the formatted percent (absolute deltas: "+1 240"). */
  readonly label?: string;
  readonly className?: string;
}

/**
 * Change badge: arrow, sign and percent — meaning never depends on colour alone. Colour is the
 * tone (positive/negative/neutral), flipped by `invert`. Announces "increase 24%" to readers.
 */
export function DeltaBadge({
  value,
  invert = false,
  variant = 'chip',
  size = 'm',
  flatThreshold = 0.5,
  fractionDigits = 0,
  suffix,
  label,
  className,
}: DeltaBadgeProps) {
  const format = useFormat();
  const direction: DeltaDirection = deltaDirection(value, flatThreshold);
  const good = direction === 'flat' ? 'neutral' : (direction === 'up') !== invert ? 'positive' : 'negative';
  const s = format.locale.strings;
  const spoken = direction === 'up' ? s.increase : direction === 'down' ? s.decrease : s.noChange;
  const text = label ?? format.delta(value, { arrow: false, fractionDigits });
  return (
    <span className={cx('vl-delta', `vl-delta--${variant}`, `vl-delta--${size}`, className)} data-tone={good} data-direction={direction}>
      <svg className="vl-delta__arrow" viewBox="0 0 10 10" aria-hidden="true">
        {direction === 'flat' ? (
          <path d="M2 5h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        ) : (
          <path
            d={direction === 'up' ? 'M5 8V2M2.5 4.5 5 2l2.5 2.5' : 'M5 2v6M2.5 5.5 5 8l2.5-2.5'}
            stroke="currentColor"
            strokeWidth="1.6"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>
      <span className="vl-sr-only">{spoken} </span>
      <span className="vl-delta__value">{Number.isFinite(value) || label ? text : '—'}</span>
      {suffix ? <span className="vl-delta__suffix">{suffix}</span> : null}
    </span>
  );
}
