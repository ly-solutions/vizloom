import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';

import { cx } from '../../core/ui/cx';
import { useIsomorphicLayoutEffect } from './dom-hooks';

/** Below this viewport width popovers open as a bottom sheet. */
export const SHEET_BELOW = 640;
const EXIT_MS = 160;
const GAP = 6;
const EDGE = 8;

function prefersSheet(): boolean {
  return typeof window !== 'undefined' && window.innerWidth < SHEET_BELOW;
}

/**
 * Keeps an element mounted for the exit animation after `open` turns false. Returns the
 * phase the CSS animates on: `open`, `closing`, or null when unmounted.
 */
export function usePresence(open: boolean, duration = EXIT_MS): 'open' | 'closing' | null {
  const [phase, setPhase] = useState<'open' | 'closing' | null>(open ? 'open' : null);
  useEffect(() => {
    if (open) {
      setPhase('open');
      return undefined;
    }
    setPhase((current) => (current === null ? null : 'closing'));
    const timer = setTimeout(() => setPhase(null), duration);
    return () => clearTimeout(timer);
  }, [open, duration]);
  return phase;
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

export interface PopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anchor: RefObject<HTMLElement | null>;
  align?: 'start' | 'end';
  /** Accessible name of the dialog. */
  label: string;
  /** Title of the bottom sheet on phones. */
  sheetTitle?: string;
  /** Close button label of the sheet. */
  closeLabel?: string;
  role?: 'dialog' | 'menu';
  className?: string;
  maxHeight?: number;
  /** `sheet` always opens as a bottom sheet (row details on a narrow container). */
  mode?: 'auto' | 'sheet';
  children: ReactNode;
}

/**
 * Anchored panel: under the anchor (flips above when there is no room), closes on outside press
 * and Escape, returns focus to the anchor, animates closing. On a narrow viewport — a bottom sheet.
 */
export function Popover({
  open,
  onOpenChange,
  anchor,
  align = 'start',
  label,
  sheetTitle,
  closeLabel = 'Close',
  role = 'dialog',
  className,
  maxHeight = 520,
  mode = 'auto',
  children,
}: PopoverProps) {
  const phase = usePresence(open);
  const panel = useRef<HTMLDivElement | null>(null);
  const [sheet, setSheet] = useState(false);
  const [placed, setPlaced] = useState(false);
  const titleId = useId();

  const place = useCallback(() => {
    const anchorEl = anchor.current;
    const panelEl = panel.current;
    if (anchorEl === null || panelEl === null) return;
    const rect = anchorEl.getBoundingClientRect();
    const width = panelEl.offsetWidth;
    const height = panelEl.scrollHeight;
    const below = window.innerHeight - rect.bottom - GAP - EDGE;
    const above = rect.top - GAP - EDGE;
    const openAbove = height > below && above > below;
    const room = Math.max(120, Math.min(maxHeight, openAbove ? above : below));
    const top = openAbove ? Math.max(EDGE, rect.top - GAP - Math.min(height, room)) : rect.bottom + GAP;
    const rawLeft = align === 'end' ? rect.right - width : rect.left;
    const left = Math.min(Math.max(EDGE, rawLeft), window.innerWidth - width - EDGE);
    panelEl.style.setProperty('top', `${Math.round(top)}px`);
    panelEl.style.setProperty('left', `${Math.round(left)}px`);
    panelEl.style.setProperty('max-block-size', `${Math.round(room)}px`);
    setPlaced(true);
  }, [anchor, align, maxHeight]);

  useIsomorphicLayoutEffect(() => {
    if (phase !== 'open') return undefined;
    const asSheet = mode === 'sheet' || prefersSheet();
    setSheet(asSheet);
    if (asSheet) {
      for (const name of ['top', 'left', 'max-block-size']) panel.current?.style.removeProperty(name);
      return undefined;
    }
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [phase, place, mode]);

  // Focus the first control on open; give focus back to the anchor on close.
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement as HTMLElement | null;
    const anchorEl = anchor.current;
    const frame = requestAnimationFrame(() => {
      const target =
        panel.current?.querySelector<HTMLElement>('[autofocus], [data-autofocus]') ?? panel.current?.querySelector<HTMLElement>(FOCUSABLE);
      (target ?? panel.current)?.focus({ preventScroll: true });
    });
    return () => {
      cancelAnimationFrame(frame);
      const back = anchorEl ?? previous;
      // Focus left inside the closing panel (or on body after it unmounts): give it back.
      const active = document.activeElement;
      if (back !== null && (active === null || active === document.body || active.closest('.vl-table-popover') !== null))
        back.focus({ preventScroll: true });
    };
  }, [open, anchor]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panel.current?.contains(target) || anchor.current?.contains(target)) return;
      onOpenChange(false);
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open, anchor, onOpenChange]);

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onOpenChange(false);
    }
  };

  if (phase === null || typeof document === 'undefined') return null;

  return createPortal(
    <div className="vl-table-layer" data-sheet={sheet || undefined}>
      {sheet ? <div className="vl-table-sheet-backdrop" data-phase={phase} aria-hidden="true" /> : null}
      <div
        ref={panel}
        role={role}
        aria-label={sheet && sheetTitle ? undefined : label}
        aria-labelledby={sheet && sheetTitle ? titleId : undefined}
        aria-modal={sheet || undefined}
        tabIndex={-1}
        className={cx('vl-table-popover', sheet && 'vl-table-popover--sheet', className)}
        data-phase={phase}
        data-placed={sheet || placed || undefined}
        onKeyDown={onKeyDown}
      >
        {sheet ? (
          <header className="vl-table-popover__sheet-head">
            <span className="vl-table-popover__handle" aria-hidden="true" />
            {sheetTitle ? (
              <h2 id={titleId} className="vl-table-popover__sheet-title">
                {sheetTitle}
              </h2>
            ) : null}
            <button type="button" className="vl-table-icon-button" aria-label={closeLabel} onClick={() => onOpenChange(false)}>
              <CloseIcon />
            </button>
          </header>
        ) : null}
        <div className="vl-table-popover__body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

export interface MenuItem {
  id: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
  /** Checked radio-like item. */
  checked?: boolean;
  destructive?: boolean;
  onSelect: () => void;
}

export type MenuEntry = MenuItem | 'separator';

export interface MenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anchor: RefObject<HTMLElement | null>;
  label: string;
  items: readonly MenuEntry[];
  align?: 'start' | 'end';
  closeLabel?: string;
}

/** Action menu: ↑/↓/Home/End move, Enter/Space choose, Escape closes. */
export function Menu({ open, onOpenChange, anchor, label, items, align = 'end', closeLabel }: MenuProps) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const move = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const buttons = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>('[role^="menuitem"]:not([disabled])') ?? []);
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    let next: HTMLButtonElement | undefined;
    if (event.key === 'ArrowDown') next = buttons[(index + 1) % buttons.length];
    else if (event.key === 'ArrowUp') next = buttons[(index - 1 + buttons.length) % buttons.length];
    else if (event.key === 'Home') next = buttons[0];
    else if (event.key === 'End') next = buttons.at(-1);
    else return;
    event.preventDefault();
    next?.focus();
  };
  return (
    <Popover
      open={open}
      onOpenChange={onOpenChange}
      anchor={anchor}
      label={label}
      sheetTitle={label}
      closeLabel={closeLabel}
      align={align}
      role="menu"
      className="vl-table-menu"
    >
      <div ref={listRef} className="vl-table-menu__list" onKeyDown={move}>
        {items.map((entry, index) =>
          entry === 'separator' ? (
            <div key={`sep-${index}`} role="separator" className="vl-table-menu__separator" />
          ) : (
            <button
              key={entry.id}
              type="button"
              role={entry.checked === undefined ? 'menuitem' : 'menuitemradio'}
              aria-checked={entry.checked}
              disabled={entry.disabled}
              className="vl-table-menu__item"
              data-destructive={entry.destructive || undefined}
              onClick={() => {
                onOpenChange(false);
                entry.onSelect();
              }}
            >
              <span className="vl-table-menu__icon" aria-hidden="true">
                {entry.checked === true ? <CheckIcon /> : entry.icon}
              </span>
              {entry.label}
            </button>
          ),
        )}
      </div>
    </Popover>
  );
}

export interface CheckboxProps {
  checked: boolean | 'indeterminate';
  onChange: (checked: boolean) => void;
  label?: ReactNode;
  'aria-label'?: string;
  disabled?: boolean;
  className?: string;
}

/** Native checkbox (keyboard and forms for free) with a themed box and the indeterminate state. */
export function Checkbox({ checked, onChange, label, 'aria-label': ariaLabel, disabled, className }: CheckboxProps) {
  const input = useRef<HTMLInputElement | null>(null);
  useIsomorphicLayoutEffect(() => {
    if (input.current !== null) input.current.indeterminate = checked === 'indeterminate';
  }, [checked]);
  return (
    <label className={cx('vl-table-check', className)} data-disabled={disabled || undefined} data-no-row-click="">
      <input
        ref={input}
        type="checkbox"
        className="vl-table-check__input"
        checked={checked === true}
        aria-checked={checked === 'indeterminate' ? 'mixed' : checked}
        aria-label={ariaLabel}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        onClick={(event) => event.stopPropagation()}
      />
      <span className="vl-table-check__box" aria-hidden="true">
        {checked === 'indeterminate' ? <MinusIcon /> : <CheckIcon />}
      </span>
      {label === undefined ? null : <span className="vl-table-check__label">{label}</span>}
    </label>
  );
}

export interface SegmentedProps<Value extends string> {
  value: Value;
  options: readonly { value: Value; label: string }[];
  onChange: (value: Value) => void;
  label: string;
}

/** Radio group drawn as a segmented control; arrows move the choice. */
export function Segmented<Value extends string>({ value, options, onChange, label }: SegmentedProps<Value>) {
  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const index = options.findIndex((option) => option.value === value);
    const step =
      event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const next = options[(index + step + options.length) % options.length];
    if (next !== undefined) {
      onChange(next.value);
      const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]');
      buttons[(index + step + options.length) % options.length]?.focus();
    }
  };
  return (
    <div role="radiogroup" aria-label={label} className="vl-table-segmented" onKeyDown={onKeyDown}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          tabIndex={option.value === value ? 0 : -1}
          className="vl-table-segmented__item"
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

// ---------- icons (inline, currentColor, 16px grid) ----------

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      className="vl-table-icon"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export const CheckIcon = () => (
  <Icon>
    <path d="M3.5 8.5l3 3 6-7" />
  </Icon>
);
export const MinusIcon = () => (
  <Icon>
    <path d="M4 8h8" />
  </Icon>
);
export const CloseIcon = () => (
  <Icon>
    <path d="M4 4l8 8M12 4l-8 8" />
  </Icon>
);
export const ArrowUpIcon = () => (
  <Icon>
    <path d="M8 13V3M4 7l4-4 4 4" />
  </Icon>
);
export const ArrowDownIcon = () => (
  <Icon>
    <path d="M8 3v10M4 9l4 4 4-4" />
  </Icon>
);
export const SortIdleIcon = () => (
  <Icon>
    <path d="M5 6l3-3 3 3M5 10l3 3 3-3" />
  </Icon>
);
export const ChevronRightIcon = () => (
  <Icon>
    <path d="M6 3.5L10.5 8 6 12.5" />
  </Icon>
);
export const ChevronLeftIcon = () => (
  <Icon>
    <path d="M10 3.5L5.5 8l4.5 4.5" />
  </Icon>
);
export const ChevronDownIcon = () => (
  <Icon>
    <path d="M3.5 6L8 10.5 12.5 6" />
  </Icon>
);
export const DotsIcon = () => (
  <Icon>
    <circle cx="3.5" cy="8" r=".75" fill="currentColor" />
    <circle cx="8" cy="8" r=".75" fill="currentColor" />
    <circle cx="12.5" cy="8" r=".75" fill="currentColor" />
  </Icon>
);
export const FilterIcon = () => (
  <Icon>
    <path d="M2.5 4h11M4.5 8h7M6.5 12h3" />
  </Icon>
);
export const SearchIcon = () => (
  <Icon>
    <circle cx="7" cy="7" r="4.25" />
    <path d="M10.25 10.25L13.5 13.5" />
  </Icon>
);
export const SlidersIcon = () => (
  <Icon>
    <path d="M2.5 4.5h6M11.5 4.5h2M2.5 11.5h2M7.5 11.5h6" />
    <circle cx="10" cy="4.5" r="1.5" />
    <circle cx="6" cy="11.5" r="1.5" />
  </Icon>
);
export const PinIcon = () => (
  <Icon>
    <path d="M6 2.5h4M7 2.5v4L4.5 9h7L9 6.5v-4M8 9v4.5" />
  </Icon>
);
export const EyeOffIcon = () => (
  <Icon>
    <path d="M2 8s2.2-4 6-4 6 4 6 4-2.2 4-6 4-6-4-6-4z" />
    <path d="M3 13L13 3" />
  </Icon>
);
export const GripIcon = () => (
  <Icon>
    <circle cx="6" cy="4" r=".6" fill="currentColor" />
    <circle cx="10" cy="4" r=".6" fill="currentColor" />
    <circle cx="6" cy="8" r=".6" fill="currentColor" />
    <circle cx="10" cy="8" r=".6" fill="currentColor" />
    <circle cx="6" cy="12" r=".6" fill="currentColor" />
    <circle cx="10" cy="12" r=".6" fill="currentColor" />
  </Icon>
);
export const InfoIcon = () => (
  <Icon>
    <circle cx="8" cy="8" r="6" />
    <path d="M6.5 6.25a1.5 1.5 0 112.1 1.4c-.4.2-.6.5-.6.9v.2M8 11.25v.01" />
  </Icon>
);
export const DownloadIcon = () => (
  <Icon>
    <path d="M8 2.5v8M4.5 7L8 10.5 11.5 7M3 13.5h10" />
  </Icon>
);
export const LockIcon = () => (
  <Icon>
    <rect x="3.5" y="7" width="9" height="6.5" rx="1.5" />
    <path d="M5.5 7V5a2.5 2.5 0 015 0v2" />
  </Icon>
);
export const AlertIcon = () => (
  <Icon>
    <path d="M8 2.5L14 13H2L8 2.5z" />
    <path d="M8 6.5v3M8 11.25v.01" />
  </Icon>
);
export const InboxIcon = () => (
  <Icon>
    <path d="M2.5 9.5l1.5-6h8l1.5 6v3.5h-11z" />
    <path d="M2.5 9.5h3l1 1.5h3l1-1.5h3" />
  </Icon>
);
export const SearchOffIcon = () => (
  <Icon>
    <circle cx="7" cy="7" r="4.25" />
    <path d="M10.25 10.25L13.5 13.5M5.5 5.5l3 3M8.5 5.5l-3 3" />
  </Icon>
);
