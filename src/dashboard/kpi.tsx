import { type ReactNode, useEffect, useRef, useState } from 'react';

import { type BlockState, cx, DeltaBadge, LiveNumber, Skeleton, StateView, useFormat, useReducedMotion, type ValueUnit } from '../core';
import { InfoHint } from './info-hint';

export interface KpiItem {
  readonly id: string;
  readonly label: string;
  readonly value: number;
  readonly unit?: ValueUnit;
  /** Custom formatter; wins over `unit`. */
  readonly format?: (value: number) => string;
  /** Change in percent vs the comparison period (shown under the number). */
  readonly delta?: number;
  /** Suffix after the delta: "vs last week". */
  readonly deltaSuffix?: ReactNode;
  /** Lower is better (refunds): the delta tone flips. */
  readonly invert?: boolean;
  /** Secondary line under the delta: "after refunds", "312 orders". */
  readonly sub?: ReactNode;
  /** "?" explanation: text or `CalcCard`. */
  readonly info?: ReactNode;
  /** Mini visual under the value (sparkline). */
  readonly visual?: ReactNode;
  /** Highlight as a problem metric. */
  readonly tone?: 'default' | 'negative' | 'positive';
  readonly state?: BlockState;
}

export interface KpiProps extends KpiItem {
  /** Show a floating "+N" when the value grows (live data). Default true. */
  readonly bump?: boolean;
  readonly className?: string;
}

/** Floating "+N" label for ~2.4 s after the value grows. */
function useBump(value: number, enabled: boolean): number | null {
  const prev = useRef(value);
  const [bump, setBump] = useState<number | null>(null);
  useEffect(() => {
    const diff = value - prev.current;
    prev.current = value;
    if (!enabled || !(diff > 0)) return;
    setBump(diff);
    const t = setTimeout(() => setBump(null), 2400);
    return () => clearTimeout(t);
  }, [value, enabled]);
  return bump;
}

/**
 * One KPI: label with "?", animated number, delta always under the number, sub line, optional
 * mini visual. Handles its own loading / empty / error / no-access.
 */
export function Kpi({
  label,
  value,
  unit,
  format: formatProp,
  delta,
  deltaSuffix,
  invert,
  sub,
  info,
  visual,
  tone = 'default',
  state,
  bump: bumpOn = true,
  className,
}: KpiProps) {
  const format = useFormat();
  const reduced = useReducedMotion();
  const fmt = formatProp ?? ((v: number) => (unit ? format.value(v, unit, true) : format.number(v)));
  const bump = useBump(value, bumpOn && !reduced);
  const status = state?.status ?? 'ready';
  return (
    <div className={cx('vl-kpi', className)} data-tone={tone} role="group" aria-label={label}>
      <div className="vl-kpi__label">
        <span>{label}</span>
        {info ? <InfoHint label={label}>{info}</InfoHint> : null}
      </div>
      {status === 'loading' ? (
        <div className="vl-kpi__skeleton" aria-busy="true">
          <Skeleton shape="text" size="l" />
          <Skeleton shape="text" size="s" />
        </div>
      ) : status === 'ready' || status === 'partial' ? (
        <>
          <div className="vl-kpi__value">
            <LiveNumber value={value} format={fmt} />
            {bump !== null ? (
              <span className="vl-kpi__bump" aria-hidden="true">
                +{fmt(bump)}
              </span>
            ) : null}
          </div>
          {delta !== undefined ? (
            <div className="vl-kpi__delta">
              <DeltaBadge value={delta} invert={invert} size="s" suffix={deltaSuffix} />
            </div>
          ) : null}
          {sub ? <div className="vl-kpi__sub">{sub}</div> : null}
          {visual ? <div className="vl-kpi__visual">{visual}</div> : null}
        </>
      ) : (
        <StateView state={state ?? { status: 'empty' }} size="compact" />
      )}
    </div>
  );
}

export interface KpiStripProps {
  readonly items: readonly KpiItem[];
  /** `strip` — a row with dividers (section headers); `grid` — separate tiles. */
  readonly variant?: 'strip' | 'grid';
  readonly bump?: boolean;
  readonly state?: BlockState;
  readonly className?: string;
  readonly 'aria-label'?: string;
}

/**
 * Row of KPIs. Wraps by container width (container queries): 6 → 3 → 2 columns; on phones it
 * scrolls horizontally with snap so numbers keep their size.
 */
export function KpiStrip({ items, variant = 'strip', bump, state, className, 'aria-label': ariaLabel }: KpiStripProps) {
  return (
    <section className={cx('vl-kpi-strip', `vl-kpi-strip--${variant}`, className)} aria-label={ariaLabel}>
      <div className="vl-kpi-strip__track">
        {items.map((item) => (
          <Kpi key={item.id} {...item} state={item.state ?? state} bump={bump} />
        ))}
      </div>
    </section>
  );
}
