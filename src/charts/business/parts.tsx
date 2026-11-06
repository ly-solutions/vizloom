import { type ReactNode, useCallback, useRef, useState } from 'react';

import { type BlockState, cx, StateView, Swatch, type SwatchProps, TooltipContent, type TooltipRow } from '../../core';
import { BottomSheet } from '../shared/bottom-sheet';
import { useIsPhone, useScrub } from '../shared/hooks';

export type Tone = 'up' | 'down' | 'flat';

/** Headline over a business chart: one big number, its captions and a line of explanation. */
export function SummaryHead({
  big,
  captions,
  tone,
  verdict,
  line,
}: {
  readonly big: string;
  readonly captions?: readonly ReactNode[];
  readonly tone?: Tone;
  readonly verdict?: string;
  readonly line?: ReactNode;
}) {
  return (
    <div className="vl-biz__summary">
      <div className="vl-biz__headline">
        <b className="vl-biz__big">{big}</b>
        {captions?.map((c, i) => (
          <span key={i}>{c}</span>
        ))}
        {verdict ? (
          <span className="vl-biz__tone" data-tone={tone ?? 'flat'}>
            {verdict}
          </span>
        ) : null}
      </div>
      {line ? <div className="vl-biz__line">{line}</div> : null}
    </div>
  );
}

export interface KeyItem {
  readonly id: string;
  readonly label: string;
  readonly color: string;
  readonly shape: SwatchProps['shape'] | 'band';
}

/** Static key of what is drawn (not a toggling legend: these charts have fixed layers). */
export function StaticKey({ items }: { readonly items: readonly KeyItem[] }) {
  return (
    <div className="vl-biz__key" aria-hidden="true">
      {items.map((item) => (
        <span key={item.id} className="vl-biz__key-item">
          {item.shape === 'band' ? (
            <span className="vl-biz__band-swatch" ref={(node) => node?.style.setProperty('--vl-band', item.color)} />
          ) : (
            <Swatch color={item.color} shape={item.shape} />
          )}
          {item.label}
        </span>
      ))}
    </div>
  );
}

/** Content of a day tooltip: date title and value rows. */
export function DayTip({ title, rows }: { readonly title: string; readonly rows: readonly TooltipRow[] }) {
  return <TooltipContent title={title} rows={rows} />;
}

/** Error / empty / no-access over the plot; loading is the chart's own skeleton. */
export function StateOverlay({ state }: { readonly state: BlockState }) {
  if (state.status !== 'error' && state.status !== 'empty' && state.status !== 'no-access') return null;
  return (
    <div className="vl-biz__overlay">
      <StateView state={state} />
    </div>
  );
}

export interface DayPointer<T extends Element> {
  /** Day under the pointer or finger; `null` — none. */
  readonly active: number | null;
  readonly setActive: (day: number | null) => void;
  /** Day opened in the phone sheet. */
  readonly sheet: number | null;
  readonly setSheet: (day: number | null) => void;
  readonly phone: boolean;
  /** A finger is reading values right now. */
  readonly scrubbing: boolean;
  /** A tap right after a scrub is not a tap. */
  readonly swallowTap: () => boolean;
  readonly ref: (node: T | null) => void;
  readonly handlers: {
    readonly onPointerMove: (event: { pointerType: string; clientX: number }) => void;
    readonly onPointerLeave: (event: { pointerType: string }) => void;
    readonly onClick: (event: { clientX: number }) => void;
  };
  readonly onKeyDown: (event: { key: string; preventDefault: () => void }) => void;
}

/**
 * Pointer model of the day-based SVG charts: mouse hover follows the day, a long press on a phone
 * scrubs, a tap opens the day sheet, arrows walk the days from the keyboard, Escape closes.
 */
export function useDayPointer<T extends Element>(options: {
  readonly enabled: boolean;
  readonly dayAt: (clientX: number) => number;
  /** Days a tap may open (e.g. only past days); default every day. */
  readonly clampTap?: (day: number) => number;
  readonly first: number;
  readonly last: number;
}): DayPointer<T> {
  const phone = useIsPhone();
  const [active, setActive] = useState<number | null>(null);
  const [sheet, setSheet] = useState<number | null>(null);
  const latest = useRef(options);
  latest.current = options;
  const scrub = useScrub<T>({
    enabled: phone && options.enabled,
    onMove: (x) => setActive(latest.current.dayAt(x)),
    onEnd: () => setActive(null),
  });
  const onKeyDown = useCallback((event: { key: string; preventDefault: () => void }) => {
    const o = latest.current;
    if (!o.enabled) return;
    if (event.key === 'Escape') {
      setActive(null);
      return;
    }
    let delta = 0;
    if (event.key === 'ArrowRight') delta = 1;
    else if (event.key === 'ArrowLeft') delta = -1;
    else if (event.key === 'Home') delta = -Infinity;
    else if (event.key === 'End') delta = Infinity;
    if (!delta) return;
    event.preventDefault();
    setActive((prev) => {
      if (delta === -Infinity) return o.first;
      if (delta === Infinity) return o.last;
      const from = prev ?? (delta > 0 ? o.first - 1 : o.last + 1);
      return Math.min(o.last, Math.max(o.first, from + delta));
    });
  }, []);
  return {
    active,
    setActive,
    sheet,
    setSheet,
    phone,
    scrubbing: scrub.scrubbing,
    swallowTap: () => scrub.scrubbing || scrub.swallowClick(),
    ref: scrub.ref,
    handlers: {
      onPointerMove: (event) => {
        if (latest.current.enabled && event.pointerType === 'mouse') setActive(latest.current.dayAt(event.clientX));
      },
      onPointerLeave: (event) => {
        if (event.pointerType === 'mouse') setActive(null);
      },
      onClick: (event) => {
        const o = latest.current;
        if (!phone || !o.enabled || scrub.swallowClick()) return;
        const day = o.dayAt(event.clientX);
        setSheet(o.clampTap ? o.clampTap(day) : day);
      },
    },
    onKeyDown,
  };
}

/** Phone sheet with the stats of one day and buttons to step through days. */
export function DaySheet({
  open,
  onClose,
  title,
  subtitle,
  rows,
  color,
  closeLabel,
  prevLabel,
  nextLabel,
  onPrev,
  onNext,
  'aria-label': ariaLabel,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly title: string;
  readonly subtitle?: string;
  readonly rows: readonly TooltipRow[];
  readonly color: string;
  readonly closeLabel: string;
  readonly prevLabel: string;
  readonly nextLabel: string;
  readonly onPrev?: (() => void) | null;
  readonly onNext?: (() => void) | null;
  readonly 'aria-label': string;
}) {
  return (
    <BottomSheet open={open} onClose={onClose} closeLabel={closeLabel} aria-label={ariaLabel}>
      <div className="vl-biz-sheet">
        <div className="vl-biz-sheet__head">
          <button type="button" className="vl-biz-sheet__step" aria-label={prevLabel} disabled={!onPrev} onClick={onPrev ?? undefined}>
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M10 3.5 5.5 8l4.5 4.5" />
            </svg>
          </button>
          <div className="vl-biz-sheet__title">
            <Swatch color={color} shape="line" />
            <b>{title}</b>
            {subtitle ? <span>{subtitle}</span> : null}
          </div>
          <button type="button" className="vl-biz-sheet__step" aria-label={nextLabel} disabled={!onNext} onClick={onNext ?? undefined}>
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M6 3.5 10.5 8 6 12.5" />
            </svg>
          </button>
        </div>
        <dl className={cx('vl-biz-sheet__rows')}>
          {rows.map((r) => (
            <div key={r.id} className="vl-biz-sheet__row">
              <dt>{r.label}</dt>
              <dd>
                <b>{r.value}</b>
                {r.note ? <span>{r.note}</span> : null}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </BottomSheet>
  );
}
