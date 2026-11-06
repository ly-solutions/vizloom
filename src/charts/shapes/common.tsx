import { type ElementType, type HTMLAttributes, type ReactNode, useEffect, useRef, useState } from 'react';

import { type Formatter, useIsomorphicLayoutEffect } from '../../core';

/** CSS custom properties to set on an element (`--vl-*` → string). */
export type CssVars = Readonly<Record<string, string | number>>;

/** Sets custom properties on a ref'd element after every render: dynamic sizes without inline `style`. */
export function useCssVars<T extends HTMLElement | SVGElement>(vars: CssVars) {
  const ref = useRef<T | null>(null);
  useIsomorphicLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    for (const [name, value] of Object.entries(vars)) el.style.setProperty(name, String(value));
  });
  return ref;
}

export interface VarBoxProps extends HTMLAttributes<HTMLElement> {
  readonly vars: CssVars;
  readonly as?: ElementType;
  readonly children?: ReactNode;
}

/** An element whose dynamic dimensions come in as CSS variables (set through a ref). */
export function VarBox({ vars, as: Tag = 'div', children, ...rest }: VarBoxProps) {
  const ref = useCssVars<HTMLElement>(vars);
  return (
    <Tag ref={ref} {...rest}>
      {children}
    </Tag>
  );
}

/** Share of a whole, 0…1, as "42%" / "3.5%": under 10 % keeps one decimal. */
export function formatShare(fmt: Formatter, share: number): string {
  if (!Number.isFinite(share)) return '—';
  const pct = share * 100;
  return fmt.percent(pct, pct > 0 && pct < 10 ? 1 : 0);
}

export interface TooltipAnchor {
  readonly x: number;
  readonly y: number;
  readonly width?: number;
}

/** Anchor of an element in the coordinates of a container (top centre of the element's box). */
export function anchorOf(el: Element, container: Element): TooltipAnchor {
  const a = el.getBoundingClientRect();
  const c = container.getBoundingClientRect();
  return { x: a.left - c.left + a.width / 2, y: a.top - c.top, width: a.width };
}

/** Hover that only counts for a mouse: touch uses taps. */
export function isMouse(event: { readonly pointerType?: string }): boolean {
  return event.pointerType === 'mouse' || event.pointerType === 'pen' || event.pointerType === undefined;
}

/** `true` after the first client render: SSR output has no measured size, charts draw their static shell. */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

/** Moves focus among marks with arrow keys; `count` marks in a row, `columns` per row (1 = vertical list). */
export function arrowTarget(key: string, index: number, count: number, columns = count): number | null {
  const rows = Math.ceil(count / columns);
  const col = index % columns;
  const row = Math.floor(index / columns);
  switch (key) {
    case 'ArrowRight':
      return col + 1 < columns && index + 1 < count ? index + 1 : null;
    case 'ArrowLeft':
      return col > 0 ? index - 1 : null;
    case 'ArrowDown':
      return row + 1 < rows && index + columns < count ? index + columns : null;
    case 'ArrowUp':
      return row > 0 ? index - columns : null;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return null;
  }
}

/** Highlight state of a mark: nothing active → `undefined`, the active one `on`, the rest `dim`. */
export function markState(active: number | null, index: number): 'on' | 'dim' | undefined {
  if (active === null || active < 0) return undefined;
  return active === index ? 'on' : 'dim';
}
