import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';

import { clampWidth } from '../core/columns';

/** useLayoutEffect in the browser, nothing on the server (no SSR warning). */
export const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

const EDGE_EPSILON = 1;

function px(value: number): string {
  return `${Math.round(value)}px`;
}

function isStickyPinned(cell: HTMLElement, pin: 'start' | 'end'): boolean {
  return cell.dataset['pin'] === pin && getComputedStyle(cell).position === 'sticky';
}

export interface ScrollOverflow {
  overflowX: boolean;
  overflowY: boolean;
}

/**
 * Measures pinned header cells into `--vt-ps-N` / `--vt-pe-N` offsets, the pinned zones and the
 * scrollbar sizes, and keeps `data-edge-*` on the root: CSS shows a shadow only at an edge with
 * hidden content. Scroll updates are batched per frame and never re-render React.
 */
export function useScrollEdges(
  root: RefObject<HTMLElement | null>,
  scroller: RefObject<HTMLElement | null>,
  table: RefObject<HTMLTableElement | null>,
): ScrollOverflow {
  const [overflow, setOverflow] = useState<ScrollOverflow>({ overflowX: false, overflowY: false });

  const updateEdges = useCallback(() => {
    const rootEl = root.current;
    const scrollEl = scroller.current;
    if (rootEl === null || scrollEl === null) return;
    const maxX = scrollEl.scrollWidth - scrollEl.clientWidth;
    const maxY = scrollEl.scrollHeight - scrollEl.clientHeight;
    // RTL scrollLeft is negative: the distance from the start edge is its absolute value.
    const x = Math.abs(scrollEl.scrollLeft);
    rootEl.dataset['edgeStart'] = String(x > EDGE_EPSILON);
    rootEl.dataset['edgeEnd'] = String(x < maxX - EDGE_EPSILON);
    rootEl.dataset['edgeTop'] = String(scrollEl.scrollTop > EDGE_EPSILON);
    rootEl.dataset['edgeBottom'] = String(scrollEl.scrollTop < maxY - EDGE_EPSILON);
  }, [root, scroller]);

  const measure = useCallback(() => {
    const rootEl = root.current;
    const scrollEl = scroller.current;
    const tableEl = table.current;
    if (rootEl === null || scrollEl === null || tableEl === null) return;
    const headRow = tableEl.tHead?.rows[0];
    if (headRow !== undefined) {
      const cells = Array.from(headRow.cells);
      let start = 0;
      let startIndex = 0;
      for (const cell of cells) {
        if (!isStickyPinned(cell, 'start')) continue;
        tableEl.style.setProperty(`--vt-ps-${startIndex}`, px(start));
        start += cell.getBoundingClientRect().width;
        startIndex += 1;
      }
      let end = 0;
      let endIndex = 0;
      for (const cell of cells.reverse()) {
        if (!isStickyPinned(cell, 'end')) continue;
        tableEl.style.setProperty(`--vt-pe-${endIndex}`, px(end));
        end += cell.getBoundingClientRect().width;
        endIndex += 1;
      }
      rootEl.style.setProperty('--vt-zone-start', px(start));
      rootEl.style.setProperty('--vt-zone-end', px(end));
    }
    rootEl.style.setProperty('--vt-head-h', px(tableEl.tHead?.getBoundingClientRect().height ?? 0));
    rootEl.style.setProperty('--vt-foot-h', px(tableEl.tFoot?.getBoundingClientRect().height ?? 0));
    rootEl.style.setProperty('--vt-scrollbar-x', px(scrollEl.offsetHeight - scrollEl.clientHeight));
    rootEl.style.setProperty('--vt-scrollbar-y', px(scrollEl.offsetWidth - scrollEl.clientWidth));
    const overflowX = scrollEl.scrollWidth > scrollEl.clientWidth + EDGE_EPSILON;
    const overflowY = scrollEl.scrollHeight > scrollEl.clientHeight + EDGE_EPSILON;
    updateEdges();
    setOverflow((previous) => (previous.overflowX === overflowX && previous.overflowY === overflowY ? previous : { overflowX, overflowY }));
  }, [root, scroller, table, updateEdges]);

  // Pinned offsets depend on rendered widths: re-measure after every commit.
  useIsomorphicLayoutEffect(() => {
    measure();
  });

  useEffect(() => {
    const scrollEl = scroller.current;
    const tableEl = table.current;
    if (scrollEl === null) return undefined;
    let frame = 0;
    const onScroll = () => {
      if (frame !== 0) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        updateEdges();
      });
    };
    scrollEl.addEventListener('scroll', onScroll, { passive: true });
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => measure());
    observer?.observe(scrollEl);
    if (tableEl !== null) observer?.observe(tableEl);
    return () => {
      scrollEl.removeEventListener('scroll', onScroll);
      observer?.disconnect();
      if (frame !== 0) cancelAnimationFrame(frame);
    };
  }, [scroller, table, measure, updateEdges]);

  return overflow;
}

/** Rounded width of an element, updated by ResizeObserver; null before the first measure. */
export function useElementWidth(ref: RefObject<HTMLElement | null>): number | null {
  const [width, setWidth] = useState<number | null>(null);
  useIsomorphicLayoutEffect(() => {
    const element = ref.current;
    if (element === null) return undefined;
    const read = () => {
      const next = Math.round(element.getBoundingClientRect().width);
      setWidth((previous) => (previous === next ? previous : next));
    };
    read();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(read);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}

export const RESIZE_STEP = 16;
export const RESIZE_STEP_LARGE = 64;

export interface ColumnResizeOptions {
  width: number;
  minWidth: number;
  onResize: (width: number) => void;
  onAutoFit: () => void;
}

/**
 * Pointer and keyboard handlers for a column edge: drag with pointer capture (one update per
 * frame), ←/→ by 16 px (Shift: 64), Enter or double click fits the content.
 */
export function useColumnResize({ width, minWidth, onResize, onAutoFit }: ColumnResizeOptions) {
  const drag = useRef<{ x: number; width: number; pointer: number } | null>(null);
  const frame = useRef(0);
  const pending = useRef<number | null>(null);

  const flush = useCallback(() => {
    frame.current = 0;
    if (pending.current !== null) onResize(pending.current);
    pending.current = null;
  }, [onResize]);

  const schedule = useCallback(
    (next: number) => {
      pending.current = next;
      if (frame.current === 0) frame.current = requestAnimationFrame(flush);
    },
    [flush],
  );

  const end = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (drag.current === null || drag.current.pointer !== event.pointerId) return;
      drag.current = null;
      event.currentTarget.releasePointerCapture?.(event.pointerId);
      delete event.currentTarget.dataset['dragging'];
      if (frame.current !== 0) cancelAnimationFrame(frame.current);
      flush();
    },
    [flush],
  );

  return {
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      drag.current = { x: event.clientX, width, pointer: event.pointerId };
      event.currentTarget.setPointerCapture?.(event.pointerId);
      event.currentTarget.dataset['dragging'] = 'true';
    },
    onPointerMove: (event: ReactPointerEvent<HTMLElement>) => {
      const current = drag.current;
      if (current === null || current.pointer !== event.pointerId) return;
      const direction = getComputedStyle(event.currentTarget).direction === 'rtl' ? -1 : 1;
      schedule(clampWidth(current.width + (event.clientX - current.x) * direction, minWidth));
    },
    onPointerUp: end,
    onPointerCancel: end,
    onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => {
      const step = event.shiftKey ? RESIZE_STEP_LARGE : RESIZE_STEP;
      if (event.key === 'ArrowLeft') onResize(clampWidth(width - step, minWidth));
      else if (event.key === 'ArrowRight') onResize(clampWidth(width + step, minWidth));
      else if (event.key === 'Enter') onAutoFit();
      else return;
      event.preventDefault();
    },
    onDoubleClick: onAutoFit,
  };
}

/** Widest content of a column (cells mark their content with `data-measure`) plus padding. */
export function measureColumn(table: HTMLElement, columnId: string): number {
  let widest = 0;
  for (const cell of table.querySelectorAll<HTMLElement>(`[data-col="${CSS.escape(columnId)}"]`)) {
    const content = cell.querySelector<HTMLElement>('[data-measure]');
    if (content === null) continue;
    const style = getComputedStyle(cell);
    const padding = Number.parseFloat(style.paddingInlineStart) + Number.parseFloat(style.paddingInlineEnd);
    widest = Math.max(widest, content.scrollWidth + padding);
  }
  return Math.ceil(widest);
}

export interface VirtualWindow {
  start: number;
  end: number;
  /** Space before and after the rendered rows, in px. */
  before: number;
  after: number;
}

export interface VirtualRowsOptions {
  scroller: RefObject<HTMLElement | null>;
  count: number;
  rowHeight: number;
  /** Height above the first row inside the scroller (the sticky header). */
  offset: number;
  enabled: boolean;
  overscan?: number;
}

/** Fallback viewport before the first measure (and on the server). */
const DEFAULT_VIEWPORT = 900;

/** Fixed-height row window. Re-renders only when the visible range changes. */
export function useVirtualRows({ scroller, count, rowHeight, offset, enabled, overscan = 8 }: VirtualRowsOptions): VirtualWindow {
  const [range, setRange] = useState({ start: 0, end: 0 });
  const compute = useCallback(
    (top: number, height: number) => {
      const viewport = height > 0 ? height : DEFAULT_VIEWPORT;
      const scrolled = Math.max(0, top - offset);
      const start = Math.min(count, Math.max(0, Math.floor(scrolled / rowHeight) - overscan));
      const end = Math.min(count, start + Math.ceil(viewport / rowHeight) + overscan * 2);
      return { start, end };
    },
    [count, offset, rowHeight, overscan],
  );

  useIsomorphicLayoutEffect(() => {
    const element = scroller.current;
    if (!enabled || element === null) return undefined;
    let frame = 0;
    const read = () => {
      frame = 0;
      const next = compute(element.scrollTop, element.clientHeight);
      setRange((previous) => (previous.start === next.start && previous.end === next.end ? previous : next));
    };
    const onScroll = () => {
      if (frame === 0) frame = requestAnimationFrame(read);
    };
    read();
    element.addEventListener('scroll', onScroll, { passive: true });
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(onScroll);
    observer?.observe(element);
    return () => {
      element.removeEventListener('scroll', onScroll);
      observer?.disconnect();
      if (frame !== 0) cancelAnimationFrame(frame);
    };
  }, [scroller, enabled, compute]);

  if (!enabled) return { start: 0, end: count, before: 0, after: 0 };
  // The stored range can be stale for one render after count shrinks: clamp it.
  const fallback = range.end === 0 ? compute(0, 0) : range;
  const start = Math.min(fallback.start, count);
  const end = Math.min(Math.max(fallback.end, start), count);
  return { start, end, before: start * rowHeight, after: (count - end) * rowHeight };
}

/** Calls `onReach` when the sentinel comes within 240 px of the scroller's (or the page's) bottom. */
export function useInfiniteLoad(
  sentinel: RefObject<HTMLElement | null>,
  root: RefObject<HTMLElement | null> | null,
  onReach: () => void,
  enabled: boolean,
): void {
  const callback = useRef(onReach);
  callback.current = onReach;
  useEffect(() => {
    const element = sentinel.current;
    if (!enabled || element === null || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) callback.current();
      },
      { root: root?.current ?? null, rootMargin: '0px 0px 240px 0px' },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [sentinel, root, enabled]);
}

/** Matches `prefers-reduced-motion: reduce`, live. False on the server. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(query.matches);
    const onChange = () => setReduced(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

/**
 * Callback ref that writes CSS properties and variables onto the element (inline style objects
 * are banned: they fight the cascade and themes). `null` removes the property.
 */
export function cssVars(vars: Readonly<Record<string, string | number | null>>): (element: HTMLElement | null) => void {
  return (element) => {
    if (element === null) return;
    for (const [name, value] of Object.entries(vars)) {
      if (value === null) element.style.removeProperty(name);
      else element.style.setProperty(name, typeof value === 'number' ? `${value}px` : value);
    }
  };
}
