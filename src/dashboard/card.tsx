import { forwardRef, type HTMLAttributes, type ReactNode, useId } from 'react';

import { type BlockState, cx, type SkeletonProps, StateView } from '../core';
import { InfoHint } from './info-hint';

export interface ChartCardProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  readonly title: ReactNode;
  /** "?" explanation next to the title. */
  readonly info?: ReactNode;
  readonly description?: ReactNode;
  /** Right side of the header: segments, menu, zoom buttons. Wraps under the title on narrow cards. */
  readonly actions?: ReactNode;
  /** Mode tabs under the header (`<Tabs>`); the body becomes their tabpanel. */
  readonly tabs?: ReactNode;
  /** Under the header: legend, filters. */
  readonly legend?: ReactNode;
  /** Under the body: navigator, footnotes. */
  readonly footer?: ReactNode;
  /** Live indicator / last updated in the header. */
  readonly status?: ReactNode;
  readonly state?: BlockState;
  readonly skeleton?: SkeletonProps['shape'] | ReactNode;
  readonly onRetry?: () => void;
  /** Columns of the 12-column dashboard grid (`DashboardGrid`). */
  readonly span?: number;
  /** `card` (default), `plain` — no frame when nested, `flush` — body touches the edges. */
  readonly variant?: 'card' | 'plain' | 'flush';
  /** Minimum body height, keeps states from collapsing the card. */
  readonly bodyHeight?: number;
  readonly children: ReactNode;
}

/**
 * Card of a dashboard block: header (title, "?", status, actions), tabs, legend, body with
 * the five block states, footer. Every chart of a dashboard sits in one, so all blocks share
 * one shape. A container query reflows the header on narrow cards.
 */
export const ChartCard = forwardRef<HTMLElement, ChartCardProps>(function ChartCard(
  {
    title,
    info,
    description,
    actions,
    tabs,
    legend,
    footer,
    status,
    state,
    skeleton,
    onRetry,
    span,
    variant = 'card',
    bodyHeight,
    className,
    children,
    ...rest
  },
  ref,
) {
  const titleId = useId();
  const panelId = useId();
  return (
    <section
      ref={ref}
      aria-labelledby={titleId}
      className={cx('vl-card', `vl-card--${variant}`, className)}
      data-span={span}
      data-body-height={bodyHeight ? '' : undefined}
      {...rest}
    >
      <header className="vl-card__header">
        <div className="vl-card__heading">
          <div className="vl-card__title-row">
            <h3 id={titleId} className="vl-card__title">
              {title}
            </h3>
            {info ? <InfoHint>{info}</InfoHint> : null}
            {status ? <span className="vl-card__status">{status}</span> : null}
          </div>
          {description ? <p className="vl-card__description">{description}</p> : null}
        </div>
        {actions ? <div className="vl-card__actions">{actions}</div> : null}
      </header>
      {tabs ? <div className="vl-card__tabs">{tabs}</div> : null}
      {legend ? <div className="vl-card__legend">{legend}</div> : null}
      <div
        id={panelId}
        role={tabs ? 'tabpanel' : undefined}
        className="vl-card__body"
        ref={(node) => {
          if (node && bodyHeight) node.style.setProperty('--vl-card-body-h', `${bodyHeight}px`);
        }}
      >
        {state && state.status !== 'ready' ? (
          <StateView state={state} skeleton={skeleton} onRetry={onRetry}>
            {children}
          </StateView>
        ) : (
          children
        )}
      </div>
      {footer ? <footer className="vl-card__footer">{footer}</footer> : null}
    </section>
  );
});
