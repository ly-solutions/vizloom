import { useRef } from 'react';

import { useLocale } from '../theme/provider';
import { cx } from './cx';
import { Skeleton, Swatch, type SwatchProps } from './primitives';

export interface LegendItem<Id extends string = string> {
  readonly id: Id;
  readonly label: string;
  /** Any CSS colour. */
  readonly color: string;
  readonly shape?: SwatchProps['shape'];
  /** Optional value shown after the label (share, total). */
  readonly value?: string;
}

export interface LegendProps<Id extends string = string> {
  readonly items: readonly LegendItem<Id>[];
  readonly hidden?: ReadonlySet<Id>;
  /** Series under the pointer: other items are dimmed. */
  readonly focus?: Id | null;
  /** Click — hide/show. */
  readonly onToggle?: (id: Id) => void;
  /** Double click (or Alt+Enter) — keep only this series. */
  readonly onSolo?: (id: Id) => void;
  /** Hover and keyboard focus — highlight the series on the chart. */
  readonly onFocus?: (id: Id | null) => void;
  /** Skeleton while the series are unknown. */
  readonly loading?: boolean;
  /** One series needs no legend (the title names it); `always` shows it anyway. */
  readonly always?: boolean;
  readonly shape?: SwatchProps['shape'];
  /** `wrap` (default) or a single scrollable row (`scroll`) — phones. */
  readonly layout?: 'wrap' | 'scroll' | 'column';
  readonly className?: string;
  readonly 'aria-label'?: string;
}

const SKELETON = ['s', 'l', 'xs', 'm', 's'] as const;
/** Wait between the first click and "it was a single click": a double click must not hide first. */
const DOUBLE_CLICK_WAIT = 200;

/**
 * Series legend: colour key and name. Shared by every chart. Click hides, double click solos,
 * hover/focus highlights. State lives in `useSeriesState`.
 */
export function Legend<Id extends string>({
  items,
  hidden,
  focus = null,
  onToggle,
  onSolo,
  onFocus,
  loading = false,
  always = false,
  shape = 'dot',
  layout = 'wrap',
  className,
  'aria-label': ariaLabel,
}: LegendProps<Id>) {
  const locale = useLocale();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  if (loading) {
    return (
      <div className={cx('vl-legend', 'vl-legend--loading', className)} aria-hidden="true">
        {SKELETON.map((w, i) => (
          <Skeleton key={i} shape="text" size={w} />
        ))}
      </div>
    );
  }
  if (items.length < 2 && !always) return null;
  const interactive = !!onToggle || !!onSolo;
  return (
    <div
      role="group"
      aria-label={ariaLabel ?? locale.strings.legend}
      className={cx('vl-legend', `vl-legend--${layout}`, focus !== null && 'vl-legend--focused', className)}
    >
      {items.map((item) => {
        const off = hidden?.has(item.id) ?? false;
        const content = (
          <>
            <Swatch color={item.color} shape={item.shape ?? shape} off={off} />
            <span className="vl-legend__label">{item.label}</span>
            {item.value ? <span className="vl-legend__value">{item.value}</span> : null}
          </>
        );
        if (!interactive) {
          return (
            <span key={item.id} className="vl-legend__item" data-off={off || undefined} data-focus={focus === item.id || undefined}>
              {content}
            </span>
          );
        }
        return (
          <button
            key={item.id}
            type="button"
            className="vl-legend__item"
            aria-pressed={!off}
            data-off={off || undefined}
            data-focus={focus === item.id || undefined}
            onPointerEnter={() => !off && onFocus?.(item.id)}
            onPointerLeave={() => onFocus?.(null)}
            onFocus={() => !off && onFocus?.(item.id)}
            onBlur={() => onFocus?.(null)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && event.altKey && onSolo) {
                event.preventDefault();
                onSolo(item.id);
              }
            }}
            onClick={(event) => {
              if (timer.current) clearTimeout(timer.current);
              if (event.detail > 1) return;
              const wait = event.detail === 0 || !onSolo ? 0 : DOUBLE_CLICK_WAIT;
              if (wait === 0) onToggle?.(item.id);
              else timer.current = setTimeout(() => onToggle?.(item.id), wait);
            }}
            onDoubleClick={() => {
              if (timer.current) clearTimeout(timer.current);
              onSolo?.(item.id);
            }}
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}
