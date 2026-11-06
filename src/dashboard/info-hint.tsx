import { type ReactNode, useCallback, useEffect, useId, useRef, useState } from 'react';

import { computePlacement, cx, type PlacementDirection, useIsomorphicLayoutEffect, useLocale } from '../core';

export interface InfoHintProps {
  /** Content of the bubble: text or a `CalcCard`. */
  readonly children: ReactNode;
  /** Accessible name of the "?" button. Default: locale "About this chart". */
  readonly label?: string;
  readonly direction?: PlacementDirection | readonly PlacementDirection[];
  readonly className?: string;
}

/**
 * "?" button with an explanation bubble. Opens on hover (after a short delay), focus or tap;
 * closes on Escape, outside tap or blur. The bubble never covers the button it explains
 * (placed above by default, flipped when there is no room).
 */
export function InfoHint({ children, label, direction = ['top', 'top-start', 'top-end', 'bottom'], className }: InfoHintProps) {
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const button = useRef<HTMLButtonElement | null>(null);
  const bubble = useRef<HTMLDivElement | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const id = useId();

  const show = useCallback(() => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setClosing(false);
    setOpen(true);
  }, []);
  const hide = useCallback(() => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setOpen((was) => {
      if (was) setClosing(true);
      return false;
    });
  }, []);

  useEffect(() => {
    if (!closing) return;
    const t = setTimeout(() => setClosing(false), 160);
    return () => clearTimeout(t);
  }, [closing]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && hide();
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!button.current?.contains(t) && !bubble.current?.contains(t)) hide();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [open, hide]);

  useIsomorphicLayoutEffect(() => {
    const b = button.current;
    const el = bubble.current;
    if (!b || !el || !(open || closing)) return;
    const r = b.getBoundingClientRect();
    const p = computePlacement({
      anchor: { top: r.top, left: r.left, width: r.width, height: r.height },
      bubble: { width: el.offsetWidth, height: el.offsetHeight },
      viewport: { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight },
      direction,
      offset: 8,
      centered: true,
      rtl: getComputedStyle(b).direction === 'rtl',
    });
    el.style.setProperty('--vl-hint-x', `${p.x}px`);
    el.style.setProperty('--vl-hint-y', `${p.y}px`);
    el.style.setProperty('--vl-beak-x', `${p.beakX}%`);
    el.dataset['direction'] = p.direction;
  });

  return (
    <span className={cx('vl-info', className)}>
      <button
        ref={button}
        type="button"
        className="vl-info__button"
        aria-label={label ?? locale.strings.help}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onPointerEnter={(e) => {
          if (e.pointerType !== 'mouse') return;
          hoverTimer.current = setTimeout(show, 120);
        }}
        onPointerLeave={(e) => e.pointerType === 'mouse' && hide()}
        onFocus={show}
        onBlur={hide}
        onClick={() => (open ? hide() : show())}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.3" />
          <path
            d="M6.3 6.2a1.8 1.8 0 1 1 2.6 1.6c-.6.3-.9.7-.9 1.3v.3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
          <circle cx="8" cy="11.4" r=".8" fill="currentColor" />
        </svg>
      </button>
      {open || closing ? (
        <div
          ref={bubble}
          id={id}
          role="tooltip"
          className={cx('vl-info__bubble', open ? 'vl-info__bubble--open' : 'vl-info__bubble--closing')}
        >
          {children}
        </div>
      ) : null}
    </span>
  );
}

export interface CalcCardProps {
  readonly title?: ReactNode;
  /** One-line formula: "Turnover − refunds − fees". */
  readonly formula?: ReactNode;
  readonly lines?: readonly { readonly label: ReactNode; readonly value: ReactNode }[];
  readonly result?: { readonly label: ReactNode; readonly value: ReactNode };
  readonly note?: ReactNode;
  /** Where the number comes from. */
  readonly source?: ReactNode;
}

/** How a number is calculated: formula, inputs, result, note, source. Content of `InfoHint`. */
export function CalcCard({ title, formula, lines, result, note, source }: CalcCardProps) {
  return (
    <div className="vl-calc">
      {title ? <div className="vl-calc__title">{title}</div> : null}
      {formula ? <div className="vl-calc__formula">{formula}</div> : null}
      {lines && lines.length ? (
        <dl className="vl-calc__lines">
          {lines.map((l, i) => (
            <div key={i} className="vl-calc__line">
              <dt>{l.label}</dt>
              <dd>{l.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {result ? (
        <div className="vl-calc__result">
          <span>{result.label}</span>
          <b>{result.value}</b>
        </div>
      ) : null}
      {note ? <p className="vl-calc__note">{note}</p> : null}
      {source ? <p className="vl-calc__source">{source}</p> : null}
    </div>
  );
}
