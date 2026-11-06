import type { ReactNode } from 'react';

/**
 * State of any block (chart, table, KPI, card). One union for the whole library, so a dashboard
 * can pass the state of a request straight to whatever renders it.
 */
export type BlockState =
  | { readonly status: 'ready' }
  | { readonly status: 'loading'; readonly label?: string }
  | { readonly status: 'empty'; readonly title?: string; readonly reason?: string; readonly action?: ReactNode }
  | { readonly status: 'no-access'; readonly title?: string; readonly reason?: string; readonly action?: ReactNode }
  | { readonly status: 'partial'; readonly reason?: string }
  | {
      readonly status: 'error';
      readonly title?: string;
      readonly reason?: string;
      readonly onRetry?: () => void;
      readonly action?: ReactNode;
    };

export type BlockStatus = BlockState['status'];

export const READY: BlockState = { status: 'ready' };
export const LOADING: BlockState = { status: 'loading' };

/** Whether the block has content to draw (ready or partial). */
export function hasContent(state: BlockState | undefined): boolean {
  return !state || state.status === 'ready' || state.status === 'partial';
}
