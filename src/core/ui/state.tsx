import { type ReactNode } from 'react';

import { type BlockState } from '../contracts/state';
import { useLocale } from '../theme/provider';
import { cx } from './cx';
import { Skeleton, type SkeletonProps } from './primitives';

export interface StateViewProps {
  readonly state: BlockState;
  /** Skeleton shape while loading: matches the block (wave, bars, donut, rows). */
  readonly skeleton?: SkeletonProps['shape'] | ReactNode;
  readonly onRetry?: () => void;
  /** The content, rendered for `ready` and `partial` (with a notice on top). */
  readonly children?: ReactNode;
  readonly className?: string;
  /** `compact` — smaller icon and text (KPI tiles, table cells). */
  readonly size?: 'compact' | 'regular';
}

function Icon({ kind }: { kind: 'empty' | 'error' | 'lock' | 'partial' }) {
  const paths = {
    empty: 'M4 18h16M7 14l3-3 3 2 4-5',
    error: 'M12 8v5m0 3h.01M10.3 3.9 2.6 17.2A2 2 0 0 0 4.3 20h15.4a2 2 0 0 0 1.7-2.8L13.7 3.9a2 2 0 0 0-3.4 0Z',
    lock: 'M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z',
    partial: 'M12 3a9 9 0 1 0 9 9M12 7v5l3 2',
  } as const;
  return (
    <svg className="vl-state__icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d={paths[kind]} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * The five states of any block: loading (skeleton in the block's shape), empty (with a reason),
 * no access (lock), partial (content + notice), error (with retry). `ready` renders children.
 */
export function StateView({ state, skeleton = 'chart', onRetry, children, className, size = 'regular' }: StateViewProps) {
  const s = useLocale().strings;
  switch (state.status) {
    case 'ready':
      return <>{children}</>;
    case 'loading':
      return (
        <div
          className={cx('vl-state', 'vl-state--loading', className)}
          role="status"
          aria-label={state.label ?? s.loading}
          aria-busy="true"
        >
          {typeof skeleton === 'string' ? <Skeleton shape={skeleton as SkeletonProps['shape']} /> : skeleton}
        </div>
      );
    case 'partial':
      return (
        <div className={cx('vl-state-partial', className)}>
          <div className="vl-state-partial__notice" role="note">
            <Icon kind="partial" />
            <span>{state.reason ?? s.partialReason}</span>
          </div>
          {children}
        </div>
      );
    case 'empty':
    case 'error':
    case 'no-access': {
      const kind = state.status === 'empty' ? 'empty' : state.status === 'error' ? 'error' : 'lock';
      const title = state.title ?? (state.status === 'empty' ? s.noData : state.status === 'error' ? s.error : s.noAccess);
      const reason =
        state.reason ?? (state.status === 'empty' ? s.noDataReason : state.status === 'error' ? s.errorReason : s.noAccessReason);
      const retry = state.status === 'error' ? (state.onRetry ?? onRetry) : undefined;
      return (
        <div
          className={cx('vl-state', `vl-state--${state.status}`, `vl-state--${size}`, className)}
          role={state.status === 'error' ? 'alert' : 'status'}
        >
          <Icon kind={kind} />
          <div className="vl-state__title">{title}</div>
          {reason ? <div className="vl-state__reason">{reason}</div> : null}
          {state.action ?? null}
          {retry ? (
            <button type="button" className="vl-button vl-button--secondary" onClick={retry}>
              {s.retry}
            </button>
          ) : null}
        </div>
      );
    }
  }
}
