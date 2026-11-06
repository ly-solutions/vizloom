import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';

/** Hold the finger this long to start reading values, ms. */
const HOLD_MS = 280;
/** Finger moved this far before the hold fired — the page is being scrolled. */
const SLOP_PX = 8;
/** After a scrub the released finger must not count as a tap. */
const CLICK_GUARD_MS = 450;

export interface ScrubOptions {
  readonly enabled: boolean;
  /** The finger is at `clientX/clientY` — show the value under it. */
  readonly onMove: (clientX: number, clientY: number) => void;
  /** The finger was lifted. */
  readonly onEnd: () => void;
}

export interface Scrub<T extends Element> {
  readonly ref: (node: T | null) => void;
  readonly node: T | null;
  /** The user is reading values with a finger right now. */
  readonly scrubbing: boolean;
  /** A tap right after a scrub is not a tap: returns `true` and the click should be skipped. */
  readonly swallowClick: () => boolean;
}

/**
 * Long press and drag on a phone: hold — the chart takes the gesture (the page does not scroll)
 * and values follow the finger; release — the tooltip goes away. Moving the finger right away
 * scrolls the page; a plain tap stays a tap.
 */
export function useScrub<T extends Element>(options: ScrubOptions): Scrub<T> {
  const latest = useRef(options);
  latest.current = options;
  const [node, setNode] = useState<T | null>(null);
  const [scrubbing, setScrubbing] = useState(false);
  const guardUntil = useRef(0);

  useEffect(() => {
    if (!node || !options.enabled) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let on = false;
    let sx = 0;
    let sy = 0;
    let lx = 0;
    let ly = 0;
    const stop = () => {
      clearTimeout(timer);
      timer = undefined;
      if (!on) return;
      on = false;
      setScrubbing(false);
      guardUntil.current = performance.now() + CLICK_GUARD_MS;
      latest.current.onEnd();
    };
    const onStart = (event: Event) => {
      const e = event as TouchEvent;
      if (e.touches.length !== 1) {
        stop();
        return;
      }
      sx = lx = e.touches[0].clientX;
      sy = ly = e.touches[0].clientY;
      clearTimeout(timer);
      timer = setTimeout(() => {
        timer = undefined;
        on = true;
        setScrubbing(true);
        if (typeof navigator !== 'undefined') navigator.vibrate?.(8);
        latest.current.onMove(lx, ly);
      }, HOLD_MS);
    };
    const onMove = (event: Event) => {
      const e = event as TouchEvent;
      const t = e.touches[0];
      if (!t) return;
      lx = t.clientX;
      ly = t.clientY;
      if (on) {
        if (e.cancelable) e.preventDefault();
        latest.current.onMove(lx, ly);
        return;
      }
      if (timer !== undefined && Math.hypot(lx - sx, ly - sy) > SLOP_PX) {
        clearTimeout(timer);
        timer = undefined;
      }
    };
    // A long press opens the copy/save menu on phones — not while reading values.
    const onMenu = (event: Event) => {
      if (on || timer !== undefined) event.preventDefault();
    };
    node.addEventListener('touchstart', onStart, { passive: true });
    node.addEventListener('touchmove', onMove, { passive: false });
    node.addEventListener('touchend', stop);
    node.addEventListener('touchcancel', stop);
    node.addEventListener('contextmenu', onMenu);
    return () => {
      clearTimeout(timer);
      node.removeEventListener('touchstart', onStart);
      node.removeEventListener('touchmove', onMove);
      node.removeEventListener('touchend', stop);
      node.removeEventListener('touchcancel', stop);
      node.removeEventListener('contextmenu', onMenu);
    };
  }, [node, options.enabled]);

  const swallowClick = useCallback(() => performance.now() < guardUntil.current, []);
  return { ref: setNode, node, scrubbing, swallowClick };
}

/**
 * A pause in showing: `poke()` hides the tooltip for `delay` ms (each call restarts the count).
 * Starts ready: a hover tooltip shows at once. `poke(true)` lifts the pause.
 */
export function useDwell(delay: number): { readonly ready: boolean; readonly poke: (immediate?: boolean) => void } {
  const [ready, setReady] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const poke = useCallback(
    (immediate = false) => {
      if (timer.current) clearTimeout(timer.current);
      if (immediate || delay <= 0) {
        setReady(true);
        return;
      }
      setReady(false);
      timer.current = setTimeout(() => setReady(true), delay);
    },
    [delay],
  );
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  return useMemo(() => ({ ready, poke }), [ready, poke]);
}

const PHONE_QUERY = '(max-width: 767px), (hover: none) and (pointer: coarse)';

function subscribePhone(notify: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => undefined;
  const mq = window.matchMedia(PHONE_QUERY);
  mq.addEventListener?.('change', notify);
  return () => mq.removeEventListener?.('change', notify);
}

/** A touch device without hover, or a narrow window: tooltips become taps and bottom sheets. */
export function useIsPhone(): boolean {
  return useSyncExternalStore(
    subscribePhone,
    () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(PHONE_QUERY).matches,
    () => false,
  );
}

/** The last non-empty value while `open`, and while it closes (exit animation keeps the content). */
export function useHeldValue<T>(value: T | null, open: boolean): T | null {
  const held = useRef<T | null>(value);
  if (open && value !== null) held.current = value;
  return held.current;
}
