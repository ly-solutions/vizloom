import { type ReactNode } from 'react';

import { cx, DeltaBadge, LiveNumber, Skeleton, useFormat, type ValueUnit } from '../core';

export interface StatTileProps {
  readonly label: string;
  readonly value: number;
  readonly unit?: ValueUnit;
  readonly format?: (v: number) => string;
  readonly delta?: number;
  readonly invert?: boolean;
  readonly sub?: ReactNode;
  readonly icon?: ReactNode;
  /** Mini chart (sparkline, split bar, funnel silhouette). */
  readonly visual?: ReactNode;
  /** Palette slot tinting the icon and accent. */
  readonly tone?: number;
  readonly loading?: boolean;
  /** No data yet: shows `emptyText` and a ghost visual. */
  readonly empty?: boolean;
  readonly emptyText?: ReactNode;
  /** Makes the whole tile a button (open a section). */
  readonly onOpen?: () => void;
  readonly className?: string;
}

/** Section tile: icon, label, number, delta and a mini chart. Clickable when `onOpen` is set. */
export function StatTile({
  label,
  value,
  unit,
  format: formatProp,
  delta,
  invert,
  sub,
  icon,
  visual,
  tone = 0,
  loading,
  empty,
  emptyText,
  onOpen,
  className,
}: StatTileProps) {
  const format = useFormat();
  const fmt = formatProp ?? ((v: number) => (unit ? format.value(v, unit, true) : format.number(v)));
  const body = (
    <>
      <span className="vl-tile__head">
        {icon ? <span className="vl-tile__icon">{icon}</span> : null}
        <span className="vl-tile__label">{label}</span>
        {onOpen ? (
          <svg className="vl-tile__arrow" viewBox="0 0 16 16" aria-hidden="true">
            <path
              d="M6 3.5 10.5 8 6 12.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : null}
      </span>
      {loading ? (
        <span className="vl-tile__skeleton">
          <Skeleton shape="text" size="m" />
          <Skeleton shape="bars" />
        </span>
      ) : empty ? (
        <span className="vl-tile__empty">{emptyText ?? format.locale.strings.noData}</span>
      ) : (
        <>
          <span className="vl-tile__value">
            <LiveNumber value={value} format={fmt} />
          </span>
          <span className="vl-tile__meta">
            {delta !== undefined ? <DeltaBadge value={delta} invert={invert} size="s" /> : null}
            {sub ? <span className="vl-tile__sub">{sub}</span> : null}
          </span>
        </>
      )}
      {visual && !loading ? <span className={cx('vl-tile__visual', empty && 'vl-tile__visual--ghost')}>{visual}</span> : null}
    </>
  );
  const cls = cx('vl-tile', onOpen && 'vl-tile--interactive', className);
  if (onOpen) {
    return (
      <button type="button" className={cls} data-tone={tone % 8} onClick={onOpen}>
        {body}
      </button>
    );
  }
  return (
    <div className={cls} data-tone={tone % 8}>
      {body}
    </div>
  );
}

export interface TileRowProps {
  readonly children: ReactNode;
  readonly 'aria-label'?: string;
  readonly className?: string;
}

/** Row of tiles: grid on wide containers, horizontal scroll-snap with edge fade on phones. */
export function TileRow({ children, className, 'aria-label': ariaLabel }: TileRowProps) {
  return (
    <section className={cx('vl-tile-row', className)} aria-label={ariaLabel}>
      <div className="vl-tile-row__track">{children}</div>
    </section>
  );
}
