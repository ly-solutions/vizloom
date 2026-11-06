import { type KeyboardEvent, type ReactNode, useId, useRef } from 'react';

import { cx, useIsomorphicLayoutEffect } from '../core';

export interface SegmentOption<V extends string = string> {
  readonly value: V;
  readonly label: ReactNode;
  /** Accessible text when `label` is an icon. */
  readonly ariaLabel?: string;
  readonly disabled?: boolean;
}

export interface SegmentedProps<V extends string = string> {
  readonly options: readonly SegmentOption<V>[];
  readonly value: V;
  readonly onChange: (value: V) => void;
  readonly 'aria-label': string;
  readonly size?: 's' | 'm';
  readonly className?: string;
}

function moveFocus<V extends string>(event: KeyboardEvent, options: readonly SegmentOption<V>[], value: V, onChange: (v: V) => void) {
  const enabled = options.filter((o) => !o.disabled);
  const i = enabled.findIndex((o) => o.value === value);
  let next = -1;
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (i + 1) % enabled.length;
  else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (i - 1 + enabled.length) % enabled.length;
  else if (event.key === 'Home') next = 0;
  else if (event.key === 'End') next = enabled.length - 1;
  if (next < 0) return;
  event.preventDefault();
  onChange(enabled[next].value);
  const group = event.currentTarget as HTMLElement;
  requestAnimationFrame(() => group.querySelector<HTMLElement>('[aria-checked="true"],[aria-selected="true"]')?.focus());
}

/** Moves the sliding indicator under the active option (CSS variables, no inline objects). */
function useIndicator(container: HTMLElement | null, value: string) {
  useIsomorphicLayoutEffect(() => {
    if (!container) return;
    const active = container.querySelector<HTMLElement>('[data-active]');
    if (!active) return;
    container.style.setProperty('--vl-ind-x', `${active.offsetLeft}px`);
    container.style.setProperty('--vl-ind-w', `${active.offsetWidth}px`);
  }, [container, value]);
}

/** Segmented control (radiogroup): metric switch "Units / Revenue", "All / Purchases / Refunds". */
export function Segmented<V extends string>({
  options,
  value,
  onChange,
  size = 'm',
  className,
  'aria-label': ariaLabel,
}: SegmentedProps<V>) {
  const ref = useRef<HTMLDivElement | null>(null);
  useIndicator(ref.current, value);
  return (
    <div
      ref={ref}
      role="radiogroup"
      aria-label={ariaLabel}
      className={cx('vl-segmented', `vl-segmented--${size}`, className)}
      onKeyDown={(e) => moveFocus(e, options, value, onChange)}
    >
      <span className="vl-segmented__indicator" aria-hidden="true" />
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={o.ariaLabel}
            disabled={o.disabled}
            tabIndex={active ? 0 : -1}
            data-active={active || undefined}
            className="vl-segmented__option"
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export interface TabsProps<V extends string = string> {
  readonly tabs: readonly SegmentOption<V>[];
  readonly value: V;
  readonly onChange: (value: V) => void;
  readonly 'aria-label': string;
  /** id prefix to link tabs to the panel (`aria-controls`). */
  readonly panelId?: string;
  readonly className?: string;
}

/** Tabs (tablist) switching chart modes inside a card. Arrow keys move, Home/End jump. */
export function Tabs<V extends string>({ tabs, value, onChange, panelId, className, 'aria-label': ariaLabel }: TabsProps<V>) {
  const ref = useRef<HTMLDivElement | null>(null);
  const auto = useId();
  useIndicator(ref.current, value);
  return (
    <div
      ref={ref}
      role="tablist"
      aria-label={ariaLabel}
      className={cx('vl-tabs', className)}
      onKeyDown={(e) => moveFocus(e, tabs, value, onChange)}
    >
      <span className="vl-tabs__indicator" aria-hidden="true" />
      {tabs.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            id={`${auto}-${t.value}`}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={panelId}
            aria-label={t.ariaLabel}
            disabled={t.disabled}
            tabIndex={active ? 0 : -1}
            data-active={active || undefined}
            className="vl-tabs__tab"
            onClick={() => onChange(t.value)}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
