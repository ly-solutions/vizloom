import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';

import { prefersReducedMotion } from '../motion/motion';
import { attachGestures, type GestureHandlers, type GestureOptions } from '../gestures/gestures';
import { pickGranularity, type Granularity, type GranularityThresholds, type TimeRange } from '../model/time';
import { Viewport, type ViewportOptions } from '../model/viewport';
import { readThemeColors, type ThemeColors } from '../theme/colors';
import { useVizConfig } from '../theme/provider';

/** `useLayoutEffect` in the browser, `useEffect` on the server (no SSR warning). */
export const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/** Latest value in a ref: handlers read fresh props without re-subscribing. */
export function useLatest<T>(value: T): { readonly current: T } {
  const ref = useRef(value);
  useIsomorphicLayoutEffect(() => {
    ref.current = value;
  });
  return ref;
}

/** Controlled when `value` is given, uncontrolled otherwise; `onChange` fires in both modes. */
export function useControllableState<T>(value: T | undefined, defaultValue: T, onChange?: (next: T) => void): [T, (next: T) => void] {
  const [inner, setInner] = useState(defaultValue);
  const controlled = value !== undefined;
  const current = controlled ? value : inner;
  const onChangeRef = useLatest(onChange);
  const set = useCallback(
    (next: T) => {
      if (!controlled) setInner(next);
      onChangeRef.current?.(next);
    },
    [controlled, onChangeRef],
  );
  return [current, set];
}

export interface ElementSize {
  readonly width: number;
  readonly height: number;
}

/** Content-box size of an element, live (ResizeObserver). 0×0 on the server and before mount. */
export function useElementSize<T extends Element>(): [(node: T | null) => void, ElementSize, T | null] {
  const [size, setSize] = useState<ElementSize>({ width: 0, height: 0 });
  const [node, setNode] = useState<T | null>(null);
  useIsomorphicLayoutEffect(() => {
    if (!node) return;
    const rect = node.getBoundingClientRect();
    setSize({ width: rect.width, height: rect.height });
    if (typeof ResizeObserver !== 'function') return;
    const observer = new ResizeObserver(([entry]) => {
      const box = entry.contentRect;
      setSize((prev) => (prev.width === box.width && prev.height === box.height ? prev : { width: box.width, height: box.height }));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);
  return [setNode, size, node];
}

/** `prefers-reduced-motion` or the provider's `animate={false}`. */
export function useReducedMotion(): boolean {
  const { animate } = useVizConfig();
  const media = useSyncExternalStore(
    subscribeReducedMotion,
    () => prefersReducedMotion(),
    () => false,
  );
  return media || !animate;
}

function subscribeReducedMotion(notify: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => undefined;
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  mq.addEventListener?.('change', notify);
  return () => mq.removeEventListener?.('change', notify);
}

let themeVersion = 0;
const themeListeners = new Set<() => void>();
let themeObserver: MutationObserver | null = null;
let themeMedia: MediaQueryList | null = null;
const bumpTheme = () => {
  themeVersion++;
  for (const l of themeListeners) l();
};
function subscribeThemeVersion(notify: () => void): () => void {
  themeListeners.add(notify);
  if (themeListeners.size === 1 && typeof document !== 'undefined') {
    if (typeof MutationObserver === 'function') {
      themeObserver = new MutationObserver(bumpTheme);
      themeObserver.observe(document.documentElement, {
        attributes: true,
        subtree: true,
        attributeFilter: ['class', 'data-vl-theme', 'style'],
      });
    }
    if (typeof window.matchMedia === 'function') {
      themeMedia = window.matchMedia('(prefers-color-scheme: dark)');
      themeMedia.addEventListener?.('change', bumpTheme);
    }
  }
  return () => {
    themeListeners.delete(notify);
    if (themeListeners.size === 0) {
      themeObserver?.disconnect();
      themeObserver = null;
      themeMedia?.removeEventListener?.('change', bumpTheme);
      themeMedia = null;
    }
  };
}

/** Counter that changes whenever a theme attribute, class or colour scheme changes anywhere. */
export function useThemeVersion(): number {
  return useSyncExternalStore(
    subscribeThemeVersion,
    () => themeVersion,
    () => 0,
  );
}

/** Theme colours resolved at `element` (canvas drawing), re-read on theme change. */
export function useThemeColors(element: Element | null): ThemeColors {
  const version = useThemeVersion();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- version invalidates the computed style
  return useMemo(() => readThemeColors(element), [element, version]);
}

/** Effective theme at an element: `dark` when an ancestor sets `data-vl-theme="dark"` (or the OS does, in auto). */
export function useResolvedTheme(element: Element | null): 'light' | 'dark' {
  const version = useThemeVersion();
  return useMemo(() => {
    void version;
    const host = element?.closest('[data-vl-theme]');
    const attr = host?.getAttribute('data-vl-theme');
    if (attr === 'dark' || attr === 'light') return attr;
    if (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
    )
      return 'dark';
    return 'light';
  }, [element, version]);
}

/** Attach chart gestures to an element; handlers can change every render without re-binding. */
export function useGestures<T extends HTMLElement>(element: T | null, handlers: GestureHandlers, options: GestureOptions = {}): void {
  const latest = useLatest(handlers);
  const { dragThreshold, longPressMs, doubleTapMs, wheelZoom, touchPan } = options;
  useEffect(() => {
    if (!element) return;
    const proxy: GestureHandlers = {
      onHover: (...a) => latest.current.onHover?.(...a),
      onTap: (...a) => latest.current.onTap?.(...a),
      onDoubleTap: (...a) => latest.current.onDoubleTap?.(...a),
      onLongPress: (...a) => latest.current.onLongPress?.(...a),
      onDragStart: (...a) => latest.current.onDragStart?.(...a),
      onDrag: (...a) => latest.current.onDrag?.(...a),
      onDragEnd: (...a) => latest.current.onDragEnd?.(...a),
      onZoom: (...a) => latest.current.onZoom?.(...a),
      onPan: (...a) => latest.current.onPan?.(...a),
    };
    return attachGestures(element, proxy, { dragThreshold, longPressMs, doubleTapMs, wheelZoom, touchPan });
  }, [element, latest, dragThreshold, longPressMs, doubleTapMs, wheelZoom, touchPan]);
}

/** One time window for a chart, its navigator, markers and zoom buttons. Created once. */
export function useViewport(options: ViewportOptions): Viewport {
  const [viewport] = useState(() => new Viewport(options));
  const { start, end } = options.extent;
  useEffect(() => {
    viewport.setExtent({ start, end });
  }, [viewport, start, end]);
  useEffect(() => () => viewport.dispose(), [viewport]);
  return viewport;
}

/** The window the view is moving to: changes on user action, not every frame (drive requests by it). */
export function useViewportTarget(viewport: Viewport): TimeRange {
  return useSyncExternalStore(
    useCallback((notify) => viewport.subscribe(notify), [viewport]),
    () => viewport.state.target,
    () => viewport.state.target,
  );
}

/** The window drawn right now (every animation frame). */
export function useViewportCurrent(viewport: Viewport): TimeRange {
  return useSyncExternalStore(
    useCallback((notify) => viewport.subscribe(notify), [viewport]),
    () => viewport.state.current,
    () => viewport.state.current,
  );
}

/** Granularity for a window and width, with hysteresis at the hour/day boundary. `fixed` disables it. */
export function useGranularity(
  range: TimeRange,
  widthPx: number,
  options: { fixed?: Granularity; thresholds?: Partial<Record<Granularity, GranularityThresholds>> } = {},
): Granularity {
  const last = useRef<Granularity>(options.fixed ?? 'day');
  const next =
    options.fixed ?? (widthPx > 0 ? pickGranularity(range.end - range.start, widthPx, last.current, options.thresholds) : last.current);
  useEffect(() => {
    last.current = next;
  }, [next]);
  return next;
}

export interface SeriesState<Id extends string> {
  /** Hidden series. */
  readonly hidden: ReadonlySet<Id>;
  /** Series under the pointer in the legend: highlighted, the rest dimmed. */
  readonly focus: Id | null;
  readonly setFocus: (id: Id | null) => void;
  /** Hide or show. Never hides the last visible one — shows all instead. */
  readonly toggle: (id: Id) => void;
  /** Keep only this one; again — show all. */
  readonly solo: (id: Id) => void;
  readonly showAll: () => void;
  readonly isVisible: (id: Id) => boolean;
}

/** Series visibility and focus shared by a legend and a chart. */
export function useSeriesState<Id extends string>(ids: readonly Id[], initialHidden: readonly Id[] = []): SeriesState<Id> {
  const [hidden, setHidden] = useState<ReadonlySet<Id>>(() => new Set(initialHidden));
  const [focus, setFocus] = useState<Id | null>(null);
  const key = ids.join('\u0000');
  const idsRef = useLatest(ids);
  useEffect(() => {
    setHidden((prev) => {
      const next = new Set([...prev].filter((id) => idsRef.current.includes(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [key, idsRef]);
  const toggle = useCallback(
    (id: Id) => {
      setHidden((prev) => {
        const visible = idsRef.current.filter((x) => !prev.has(x));
        if (!prev.has(id) && visible.length === 1) return new Set();
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
      setFocus((f) => (f === id ? null : f));
    },
    [idsRef],
  );
  const solo = useCallback(
    (id: Id) => {
      setHidden((prev) => {
        const all = idsRef.current;
        const only = all.every((x) => (x === id ? !prev.has(x) : prev.has(x)));
        return only ? new Set() : new Set(all.filter((x) => x !== id));
      });
    },
    [idsRef],
  );
  const showAll = useCallback(() => setHidden(new Set()), []);
  const isVisible = useCallback((id: Id) => !hidden.has(id), [hidden]);
  return useMemo(() => ({ hidden, focus, setFocus, toggle, solo, showAll, isVisible }), [hidden, focus, toggle, solo, showAll, isVisible]);
}

/**
 * Numbers easing to new values: first appearance grows from `initial` (zero), new data morphs.
 * Reduced motion jumps. Returns the values to draw this frame.
 */
export function useTweenedValues(
  target: readonly number[],
  { duration = 700, initial }: { duration?: number; initial?: readonly number[] } = {},
): readonly number[] {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState<readonly number[]>(() => target.map((v, i) => (reduced ? v : (initial?.[i] ?? 0))));
  const current = useRef<readonly number[]>(shown);
  const key = target.join('|');
  const targetRef = useLatest(target);
  useEffect(() => {
    const goal = targetRef.current;
    if (duration <= 0 || reduced || typeof requestAnimationFrame !== 'function') {
      current.current = goal;
      setShown(goal);
      return;
    }
    const from = goal.map((_, i) => current.current[i] ?? 0);
    const started = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const u = Math.min(1, (now - started) / duration);
      const e = 1 - (1 - u) ** 3;
      const next = goal.map((v, i) => (Number.isFinite(v) ? from[i] + (v - from[i]) * e : v));
      current.current = next;
      setShown(next);
      if (u < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [key, duration, reduced, targetRef]);
  return shown.length === target.length ? shown : target.map((_, i) => shown[i] ?? 0);
}

/** Value kept while a tooltip closes: its exit animation must not see empty content. */
export function useHeld<T>(value: T | null, open: boolean): T | null {
  const held = useRef<T | null>(value);
  if (open && value !== null) held.current = value;
  return held.current;
}

/** Shows `true` with a delay and hides at once: skeletons that do not flash on fast loads. */
export function useDelayedFlag(flag: boolean, delay = 150): boolean {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!flag) {
      setShown(false);
      return;
    }
    const t = setTimeout(() => setShown(true), delay);
    return () => clearTimeout(t);
  }, [flag, delay]);
  return shown;
}

/** Device pixel ratio, capped (canvas memory on phones). */
export function useDevicePixelRatio(max = 2): number {
  return useSyncExternalStore(
    subscribeDpr,
    () => Math.min(max, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1),
    () => 1,
  );
}

function subscribeDpr(notify: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => undefined;
  const mq = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
  mq.addEventListener?.('change', notify);
  return () => mq.removeEventListener?.('change', notify);
}
