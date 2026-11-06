import { type HTMLAttributes, type ReactNode } from 'react';

import { cx } from '../core';

export interface DashboardGridProps extends HTMLAttributes<HTMLDivElement> {
  readonly children: ReactNode;
  /** Gap size. */
  readonly gap?: 's' | 'm' | 'l';
}

/**
 * 12-column dashboard grid on container queries: children set `span` (1–12, via `ChartCard span`
 * or `GridItem`). Below 44rem of container width every block takes the full row; between 44
 * and 64rem spans under 6 become 6. Works inside any layout, not just full-width pages.
 */
export function DashboardGrid({ children, gap = 'm', className, ...rest }: DashboardGridProps) {
  return (
    <div className={cx('vl-grid', `vl-grid--gap-${gap}`, className)} {...rest}>
      <div className="vl-grid__inner">{children}</div>
    </div>
  );
}

export interface GridItemProps extends HTMLAttributes<HTMLDivElement> {
  /** Columns out of 12. */
  readonly span?: number;
  /** Rows to span (tall blocks). */
  readonly rowSpan?: number;
  readonly children: ReactNode;
}

/** Any content placed in the grid with a span. */
export function GridItem({ span = 12, rowSpan, children, className, ...rest }: GridItemProps) {
  return (
    <div className={cx('vl-grid__item', className)} data-span={span} data-row-span={rowSpan} {...rest}>
      {children}
    </div>
  );
}
