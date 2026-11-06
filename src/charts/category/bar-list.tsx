import { type ReactNode, useState } from 'react';

import { type BlockState, cx, type Datum, Skeleton, StateView, useFormat, useLocale, type ValueUnit } from '../../core';

export interface BarListItem<Key extends string = string> extends Datum<Key> {
  /** Second line: "142 of 200 · −10%". */
  readonly sub?: ReactNode;
  /** `negative` highlights a problem row ("0 purchases"), `muted` greys it. */
  readonly tone?: 'default' | 'negative' | 'muted';
  readonly icon?: ReactNode;
}

export interface BarListProps<Key extends string = string> {
  readonly items: readonly BarListItem<Key>[];
  /** Accessible name of the list. */
  readonly title: string;
  readonly unit?: ValueUnit;
  readonly formatValue?: (v: number) => string;
  /** Show N rows, the rest behind "N more". */
  readonly limit?: number;
  readonly sort?: 'none' | 'desc' | 'asc';
  /** Bar length relative to the max (default) or to the sum (shares). */
  readonly scale?: 'max' | 'sum';
  /** Show the share in percent next to the value. */
  readonly showShare?: boolean;
  readonly onSelect?: (key: Key) => void;
  readonly selected?: Key | null;
  readonly state?: BlockState;
  readonly className?: string;
}

/** Ranked list with bars: top promo codes, links, sources. Rows can be selected. */
export function BarList<Key extends string>({
  items,
  title,
  unit,
  formatValue,
  limit = 6,
  sort = 'desc',
  scale = 'max',
  showShare = false,
  onSelect,
  selected = null,
  state,
  className,
}: BarListProps<Key>) {
  const format = useFormat();
  const s = useLocale().strings;
  const [open, setOpen] = useState(false);
  if (state?.status === 'loading') {
    return (
      <div className={cx('vl-bar-list', className)} aria-busy="true">
        {Array.from({ length: Math.min(limit, 5) }, (_, i) => (
          <div key={i} className="vl-bar-list__skeleton">
            <Skeleton shape="text" size={(['l', 'm', 'xl', 's', 'm'] as const)[i % 5]} />
            <Skeleton shape="text" size="xs" />
          </div>
        ))}
      </div>
    );
  }
  if (state && state.status !== 'ready' && state.status !== 'partial') return <StateView state={state} size="compact" />;
  if (!items.length) return <StateView state={{ status: 'empty' }} size="compact" />;
  const sorted = sort === 'none' ? items : [...items].sort((a, b) => (sort === 'desc' ? b.value - a.value : a.value - b.value));
  const max = Math.max(...sorted.map((i) => Math.abs(i.value)), 0) || 1;
  const sum = sorted.reduce((t, i) => t + Math.max(0, i.value), 0) || 1;
  const visible = open ? sorted : sorted.slice(0, limit);
  const fmt = formatValue ?? ((v: number) => (unit ? format.value(v, unit, true) : format.number(v)));
  return (
    <div className={cx('vl-bar-list', className)}>
      <ul className="vl-bar-list__rows" aria-label={title}>
        {visible.map((item) => {
          const ratio = Math.max(0, item.value) / (scale === 'sum' ? sum : max);
          const content = (
            <>
              <span
                className="vl-bar-list__bar"
                aria-hidden="true"
                ref={(n) => {
                  if (!n) return;
                  n.style.setProperty('--vl-bar-w', `${(ratio * 100).toFixed(2)}%`);
                  if (item.color) n.style.setProperty('--vl-bar-color', item.color);
                }}
              />
              <span className="vl-bar-list__text">
                {item.icon ? <span className="vl-bar-list__icon">{item.icon}</span> : null}
                <span className="vl-bar-list__label" title={item.label}>
                  {item.label}
                </span>
                {item.sub ? <span className="vl-bar-list__sub">{item.sub}</span> : null}
              </span>
              <span className="vl-bar-list__value">
                {fmt(item.value)}
                {showShare ? <span className="vl-bar-list__share">{format.percent((Math.max(0, item.value) / sum) * 100, 0)}</span> : null}
              </span>
            </>
          );
          return (
            <li
              key={item.key}
              className="vl-bar-list__row"
              data-tone={item.tone ?? 'default'}
              data-selected={selected === item.key || undefined}
            >
              {onSelect ? (
                <button
                  type="button"
                  className="vl-bar-list__button"
                  aria-pressed={selected === item.key}
                  onClick={() => onSelect(item.key)}
                >
                  {content}
                </button>
              ) : (
                <div className="vl-bar-list__button">{content}</div>
              )}
            </li>
          );
        })}
      </ul>
      {sorted.length > limit ? (
        <button
          type="button"
          className="vl-button vl-button--ghost vl-bar-list__more"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? s.showLess : s.more(sorted.length - limit)}
        </button>
      ) : null}
    </div>
  );
}
