import { useEffect, useRef, useState } from 'react';

import { useReducedMotion } from '../hooks/hooks';
import { easing } from '../motion/motion';
import { cx } from './cx';

export interface LiveNumberProps {
  readonly value: number;
  /** How to print the (animated) number. Default: integer in the provider locale via `Intl`. */
  readonly format?: (v: number) => string;
  /** Count-up duration, ms. */
  readonly duration?: number;
  /** First render counts from this value (default: no count-up on mount). */
  readonly from?: number;
  /** Flash a pulse (green up / red down) when the value changes. */
  readonly pulse?: boolean;
  /** Announce changes to screen readers (polite). Off by default: live tickers would be noisy. */
  readonly announce?: boolean;
  readonly className?: string;
}

/**
 * Animated number: eases from the old value to the new one with tabular digits, so the width
 * does not jump. Optional pulse on change. Reduced motion: instant.
 */
export function LiveNumber({ value, format, duration = 600, from, pulse = false, announce = false, className }: LiveNumberProps) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(from ?? value);
  const shownRef = useRef(shown);
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);
  const prev = useRef(value);
  useEffect(() => {
    const start = shownRef.current;
    const dir = value > prev.current ? 'up' : value < prev.current ? 'down' : null;
    prev.current = value;
    if (pulse && dir) {
      setFlash(dir);
      const t = setTimeout(() => setFlash(null), 900);
      if (reduced || typeof requestAnimationFrame !== 'function' || duration <= 0) {
        shownRef.current = value;
        setShown(value);
        return () => clearTimeout(t);
      }
    }
    if (reduced || typeof requestAnimationFrame !== 'function' || duration <= 0 || start === value) {
      shownRef.current = value;
      setShown(value);
      return;
    }
    const t0 = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const u = Math.min(1, (now - t0) / duration);
      const v = start + (value - start) * easing.outCubic(u);
      shownRef.current = v;
      setShown(v);
      if (u < 1) frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [value, duration, reduced, pulse]);
  const text = format ? format(shown) : Math.round(shown).toLocaleString();
  return (
    <span
      className={cx('vl-live-number', flash && `vl-live-number--${flash}`, className)}
      aria-live={announce ? 'polite' : undefined}
      aria-atomic={announce || undefined}
    >
      <span aria-hidden={announce ? undefined : true}>{text}</span>
      {!announce ? <span className="vl-sr-only">{format ? format(value) : value.toLocaleString()}</span> : null}
    </span>
  );
}

export interface PulseProps {
  /** Change this key to fire a pulse (e.g. the latest value or a counter). */
  readonly trigger: unknown;
  readonly tone?: 'accent' | 'positive' | 'negative';
  readonly className?: string;
}

/** A dot that ripples when `trigger` changes: "something just happened" for live data. */
export function Pulse({ trigger, tone = 'accent', className }: PulseProps) {
  const [beat, setBeat] = useState(0);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setBeat((b) => b + 1);
  }, [trigger]);
  return (
    <span className={cx('vl-pulse', className)} data-tone={tone} aria-hidden="true">
      <span key={beat} className={cx('vl-pulse__ring', beat > 0 && 'vl-pulse__ring--go')} />
      <span className="vl-pulse__dot" />
    </span>
  );
}
