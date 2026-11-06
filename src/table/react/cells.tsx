import type { ReactNode } from 'react';

import { Sparkline } from '../../charts/category/sparkline';

import { DeltaBadge } from '../../core/ui/delta';
import { cx } from '../../core/ui/cx';
import type { StatusTone } from '../core/types';
import { cssVars } from './dom-hooks';

/**
 * Building blocks for `column.render`. All of them size to the cell, use theme variables
 * only and mark their text with `data-measure` so double-click "fit to content" sees it.
 */

export interface StatusCellProps {
  tone?: StatusTone;
  children: ReactNode;
  /** Dot before the label. Default: yes. */
  dot?: boolean;
}

/** Status pill. The label carries the meaning, the tone only reinforces it. */
export function StatusCell({ tone = 'neutral', dot = true, children }: StatusCellProps) {
  return (
    <span className="vl-cell-status" data-tone={tone} data-dot={dot || undefined} data-measure="">
      {children}
    </span>
  );
}

export interface DeltaCellProps {
  /** Change in percent: `+12` is +12%. */
  value: number | null;
  /** Lower is better (refunds): colours flip. */
  invert?: boolean;
  variant?: 'chip' | 'text';
  fractionDigits?: number;
  /** Text for an unknown delta. */
  unknownLabel?: string;
}

export function DeltaCell({ value, invert, variant = 'chip', fractionDigits = 0, unknownLabel }: DeltaCellProps) {
  if (value === null || !Number.isFinite(value)) return <UnknownCell reason={unknownLabel} />;
  return (
    <span data-measure="" className="vl-cell-delta">
      <DeltaBadge value={value} invert={invert} variant={variant} size="s" fractionDigits={fractionDigits} />
    </span>
  );
}

export interface BarCellProps {
  /** 0..1 share of the column maximum. */
  share: number | null;
  /** Formatted value printed next to the bar. */
  children: ReactNode;
  /** Where the bar sits relative to the value. */
  placement?: 'before' | 'after';
  tone?: 'accent' | 'positive' | 'negative' | 'neutral';
  best?: boolean;
}

/** Value with a short bar: the share of the best row. The bar hides in the phone card layout. */
export function BarCell({ share, children, placement = 'before', tone = 'accent', best = false }: BarCellProps) {
  return (
    <span className="vl-cell-bar" data-placement={placement} data-tone={tone} ref={cssVars({ '--vl-cell-share': String(share ?? 0) })}>
      <span className="vl-cell-bar__track" aria-hidden="true">
        <span className="vl-cell-bar__fill" />
      </span>
      <span className="vl-cell-bar__value" data-best={best || undefined} data-measure="">
        {children}
      </span>
    </span>
  );
}

export interface ProgressCellProps {
  value: number;
  max: number;
  /** Text after the bar; default `value / max`. */
  label?: ReactNode;
  /** Accessible name: "Sold 184 of 220". */
  'aria-label'?: string;
}

/** "N of M" with a progress bar; full reads as done, over capacity is clamped. */
export function ProgressCell({ value, max, label, 'aria-label': ariaLabel }: ProgressCellProps) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  return (
    <span className="vl-cell-progress" data-full={ratio >= 1 || undefined} ref={cssVars({ '--vl-cell-share': String(ratio) })}>
      <span
        className="vl-cell-progress__track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={Math.min(value, max)}
        aria-label={ariaLabel}
      >
        <span className="vl-cell-progress__fill" />
      </span>
      <span className="vl-cell-progress__label" data-measure="">
        {label ?? `${value} / ${max}`}
      </span>
    </span>
  );
}

export interface SparklineCellProps {
  values: readonly number[];
  /** Accessible summary, e.g. "Sales over 14 days, rising". Default: min, max and last value. */
  'aria-label'?: string;
  width?: number;
  height?: number;
  tone?: 'accent' | 'positive' | 'negative' | 'neutral';
  /** Fill the area under the line. */
  area?: boolean;
}

const SPARK_COLOR = {
  accent: 'var(--vl-accent)',
  positive: 'var(--vl-positive)',
  negative: 'var(--vl-negative)',
  neutral: 'var(--vl-text-muted)',
} as const;

/**
 * The charts `Sparkline` sized for a table row (fixed width, so no measuring per row).
 * NaN values are gaps. Needs `vizloom/charts.css` (or `vizloom/styles.css`) for its strokes.
 */
export function SparklineCell({
  values,
  'aria-label': ariaLabel,
  width = 72,
  height = 20,
  tone = 'accent',
  area = true,
}: SparklineCellProps) {
  return (
    <span className="vl-cell-spark">
      <Sparkline
        values={values}
        width={width}
        height={height}
        kind={area ? 'area' : 'line'}
        color={SPARK_COLOR[tone]}
        aria-label={ariaLabel}
      />
    </span>
  );
}

export interface AvatarCellProps {
  name: string;
  /** Image URL; initials on a tinted circle without it. */
  src?: string;
  /** Second line: email, role. */
  secondary?: ReactNode;
  /** Icon instead of an avatar (any node: SVG, emoji). */
  icon?: ReactNode;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

function hueOf(text: string): number {
  let hash = 0;
  for (const char of text) hash = (hash * 31 + char.charCodeAt(0)) % 8;
  return hash + 1;
}

export function AvatarCell({ name, src, secondary, icon }: AvatarCellProps) {
  return (
    <span className="vl-cell-avatar">
      {icon !== undefined ? (
        <span className="vl-cell-avatar__icon" aria-hidden="true">
          {icon}
        </span>
      ) : src !== undefined ? (
        <img className="vl-cell-avatar__image" src={src} alt="" loading="lazy" decoding="async" />
      ) : (
        <span className="vl-cell-avatar__initials" data-slot={hueOf(name)} aria-hidden="true">
          {initials(name)}
        </span>
      )}
      <TwoLineCell primary={name} secondary={secondary} />
    </span>
  );
}

export interface TwoLineCellProps {
  primary: ReactNode;
  secondary?: ReactNode;
}

/** Main text with a muted second line; both ellipsize. */
export function TwoLineCell({ primary, secondary }: TwoLineCellProps) {
  return (
    <span className="vl-cell-lines">
      <span className="vl-cell-lines__primary" data-measure="">
        {primary}
      </span>
      {secondary === undefined || secondary === null ? null : <span className="vl-cell-lines__secondary">{secondary}</span>}
    </span>
  );
}

export interface DotCellProps {
  /** Any CSS colour or a palette variable. */
  color: string;
  children: ReactNode;
}

/** Colour dot and a label: the series or channel a row belongs to. */
export function DotCell({ color, children }: DotCellProps) {
  return (
    <span className="vl-cell-dot" ref={cssVars({ '--vl-cell-dot': color })}>
      <span className="vl-cell-dot__mark" aria-hidden="true" />
      <span data-measure="">{children}</span>
    </span>
  );
}

export interface PillCellProps {
  children: ReactNode;
  tone?: StatusTone;
}

/** Small rounded counter or tag. */
export function PillCell({ children, tone = 'neutral' }: PillCellProps) {
  return (
    <span className="vl-cell-pill" data-tone={tone} data-measure="">
      {children}
    </span>
  );
}

const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);

/** The href when its protocol is safe to put into a link (`javascript:` is not); null otherwise. */
export function safeHref(href: string): string | null {
  const trimmed = href.trim();
  if (trimmed === '') return null;
  try {
    const base = typeof window === 'undefined' ? 'http://localhost/' : window.location.href;
    return SAFE_PROTOCOLS.has(new URL(trimmed, base).protocol) ? trimmed : null;
  } catch {
    return null;
  }
}

export interface LinkCellProps {
  href: string;
  children: ReactNode;
  /** Opens in a new tab with `noopener`. */
  external?: boolean;
}

/** Link in a cell; unsafe URLs render as plain text. */
export function LinkCell({ href, children, external = false }: LinkCellProps) {
  const safe = safeHref(href);
  if (safe === null) return <span data-measure="">{children}</span>;
  return (
    <a
      className="vl-cell-link"
      href={safe}
      data-measure=""
      data-no-row-click=""
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
    >
      {children}
    </a>
  );
}

export interface UnknownCellProps {
  reason?: string;
  /** Accessible fallback when no reason is given. */
  label?: string;
}

/** A dash that explains itself: the reason shows on hover and focus and is read by screen readers. */
export function UnknownCell({ reason, label = 'No data' }: UnknownCellProps) {
  const text = reason ?? label;
  return (
    <span
      className={cx('vl-cell-unknown', reason !== undefined && 'vl-cell-unknown--reason')}
      tabIndex={reason === undefined ? undefined : 0}
      data-hint={reason}
      aria-label={text}
      role="img"
    >
      —
    </span>
  );
}
