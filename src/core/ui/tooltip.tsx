import { type ReactNode, useRef, useState } from 'react';

import { useIsomorphicLayoutEffect } from '../hooks/hooks';
import { placeChartTooltip, type ChartTooltipInput } from '../positioning/chart-tooltip';
import { useLocale } from '../theme/provider';
import { cx } from './cx';
import { Swatch, type SwatchProps } from './primitives';

export interface TooltipRow {
  readonly id: string;
  readonly label: string;
  /** Formatted value. */
  readonly value: string;
  readonly color?: string;
  readonly shape?: SwatchProps['shape'];
  /** Secondary text after the value: share, delta. */
  readonly note?: ReactNode;
  /** Emphasised row (focused series, total). */
  readonly strong?: boolean;
  readonly muted?: boolean;
}

export interface TooltipContentProps {
  readonly title?: ReactNode;
  readonly subtitle?: ReactNode;
  readonly rows?: readonly TooltipRow[];
  /** Footer: total, hint "click to pin". */
  readonly footer?: ReactNode;
  readonly children?: ReactNode;
  readonly className?: string;
}

/** Standard tooltip body: title, rows with colour keys and values, footer. */
export function TooltipContent({ title, subtitle, rows, footer, children, className }: TooltipContentProps) {
  return (
    <div className={cx('vl-tooltip__content', className)}>
      {title ? <div className="vl-tooltip__title">{title}</div> : null}
      {subtitle ? <div className="vl-tooltip__subtitle">{subtitle}</div> : null}
      {rows && rows.length > 0 ? (
        <dl className="vl-tooltip__rows">
          {rows.map((row) => (
            <div key={row.id} className="vl-tooltip__row" data-strong={row.strong || undefined} data-muted={row.muted || undefined}>
              <dt className="vl-tooltip__label">
                {row.color ? <Swatch color={row.color} shape={row.shape ?? 'dot'} /> : null}
                <span>{row.label}</span>
              </dt>
              <dd className="vl-tooltip__value">
                {row.value}
                {row.note ? <span className="vl-tooltip__note">{row.note}</span> : null}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      {children}
      {footer ? <div className="vl-tooltip__footer">{footer}</div> : null}
    </div>
  );
}

export interface ChartTooltipProps {
  /** Shown or hidden; hiding keeps the last content during the exit animation. */
  readonly open: boolean;
  /** Anchor in the container's coordinates, px. */
  readonly anchor: ChartTooltipInput['anchor'] | null;
  /** Size of the positioning container (the chart). */
  readonly bounds: { readonly width: number; readonly height: number };
  readonly prefer?: ChartTooltipInput['prefer'];
  /** Below this container width the tooltip docks above the plot (phones). Default 480. */
  readonly dockBelow?: number;
  /** Pinned: stays after the pointer leaves, gets a close button, becomes interactive. */
  readonly pinned?: boolean;
  readonly onUnpin?: () => void;
  readonly children: ReactNode;
  readonly className?: string;
  /** Accessible name; the content is announced politely when it changes. */
  readonly 'aria-label'?: string;
}

/**
 * Tooltip layer of a chart: absolutely positioned in the chart container (no portal, SSR-safe),
 * beside the anchor, flipped near edges, docked above the plot on phones. Moves with a short
 * transition once settled; first appearance does not fly in from a corner.
 */
export function ChartTooltip({
  open,
  anchor,
  bounds,
  prefer,
  dockBelow = 480,
  pinned = false,
  onUnpin,
  children,
  className,
  'aria-label': ariaLabel,
}: ChartTooltipProps) {
  const locale = useLocale();
  const ref = useRef<HTMLDivElement | null>(null);
  const held = useRef<{ anchor: ChartTooltipInput['anchor']; children: ReactNode } | null>(null);
  const [settled, setSettled] = useState(false);
  if (open && anchor) held.current = { anchor, children };
  const shown = held.current;

  useIsomorphicLayoutEffect(() => {
    const el = ref.current;
    if (!el || !shown) return;
    const pos = placeChartTooltip({
      anchor: shown.anchor,
      size: { width: el.offsetWidth, height: el.offsetHeight },
      bounds,
      prefer,
      dockBelow,
    });
    el.style.setProperty('--vl-tooltip-x', `${Math.round(pos.x)}px`);
    el.style.setProperty('--vl-tooltip-y', `${Math.round(pos.y)}px`);
    el.dataset['side'] = pos.side;
  });

  useIsomorphicLayoutEffect(() => {
    if (!open) {
      setSettled(false);
      return;
    }
    if (typeof requestAnimationFrame !== 'function') return;
    const f = requestAnimationFrame(() => setSettled(true));
    return () => cancelAnimationFrame(f);
  }, [open]);

  if (!shown) return null;
  return (
    <div
      ref={ref}
      role={pinned ? 'dialog' : 'tooltip'}
      aria-label={ariaLabel}
      aria-live={pinned ? undefined : 'polite'}
      className={cx('vl-tooltip', open && 'vl-tooltip--open', settled && 'vl-tooltip--settled', pinned && 'vl-tooltip--pinned', className)}
    >
      {shown.children}
      {pinned && onUnpin ? (
        <button type="button" className="vl-tooltip__close" aria-label={locale.strings.unpin} onClick={onUnpin}>
          <svg viewBox="0 0 12 12" aria-hidden="true">
            <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}

export interface CrosshairProps {
  /** X of the vertical line in container px; `null` hides it. */
  readonly x: number | null;
  /** Optional Y of the horizontal line. */
  readonly y?: number | null;
  readonly top?: number;
  readonly bottom?: number;
  readonly className?: string;
}

/** DOM crosshair over a chart (canvas charts may draw their own). */
export function Crosshair({ x, y = null, top = 0, bottom = 0, className }: CrosshairProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  useIsomorphicLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty('--vl-cross-x', `${x ?? 0}px`);
    el.style.setProperty('--vl-cross-y', `${y ?? 0}px`);
    el.style.setProperty('--vl-cross-top', `${top}px`);
    el.style.setProperty('--vl-cross-bottom', `${bottom}px`);
  });
  return (
    <div ref={ref} className={cx('vl-crosshair', x !== null && 'vl-crosshair--on', className)} aria-hidden="true">
      <span className="vl-crosshair__v" />
      {y !== null ? <span className="vl-crosshair__h" /> : null}
    </div>
  );
}
