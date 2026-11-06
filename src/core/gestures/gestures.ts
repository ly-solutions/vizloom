/**
 * Pointer gestures for charts, framework-free: hover, tap, long-press, drag/pan, wheel zoom
 * (mouse wheel, trackpad pinch = ctrl+wheel), two-finger pinch with pan, double-tap.
 * Coordinates are relative to the element, CSS px.
 */

export interface GesturePoint {
  readonly x: number;
  readonly y: number;
}

export interface GestureHandlers {
  /** Pointer moved without buttons (mouse/pen hover). `null` — pointer left. */
  onHover?(point: GesturePoint | null, event: PointerEvent | null): void;
  /** Short press without movement. `pointerType` tells touch from mouse. */
  onTap?(point: GesturePoint, event: PointerEvent): void;
  onDoubleTap?(point: GesturePoint, event: PointerEvent): void;
  /** Press held ≥ `longPressMs` without moving: a touch scrub starts. */
  onLongPress?(point: GesturePoint, event: PointerEvent): void;
  onDragStart?(point: GesturePoint, event: PointerEvent): void;
  /** One-pointer drag: `dx`/`dy` since the previous move. */
  onDrag?(delta: { dx: number; dy: number; point: GesturePoint }, event: PointerEvent): void;
  onDragEnd?(point: GesturePoint, event: PointerEvent): void;
  /** Zoom by `factor` (< 1 zoom in) around `point`. From wheel, trackpad pinch or two fingers. */
  onZoom?(zoom: { factor: number; point: GesturePoint; source: 'wheel' | 'pinch' }): void;
  /** Horizontal wheel / trackpad swipe or two-finger pan, px. */
  onPan?(pan: { dx: number; dy: number; source: 'wheel' | 'pinch' }): void;
}

export interface GestureOptions {
  /** Movement in px that turns a press into a drag. */
  readonly dragThreshold?: number;
  readonly longPressMs?: number;
  readonly doubleTapMs?: number;
  /** Wheel zoom without a modifier. False: plain wheel scrolls the page, ctrl/⌘+wheel zooms. */
  readonly wheelZoom?: boolean;
  /**
   * On touch, a one-finger horizontal drag pans the chart; vertical movement scrolls the page.
   * Set `touch-action: pan-y` on the element (the `.vl-gesture-surface` class does it).
   */
  readonly touchPan?: boolean;
}

const WHEEL_LINE_PX = 16;

export function attachGestures(element: HTMLElement, handlers: GestureHandlers, options: GestureOptions = {}): () => void {
  const { dragThreshold = 4, longPressMs = 450, doubleTapMs = 300, wheelZoom = true, touchPan = true } = options;
  const pointers = new Map<number, GesturePoint>();
  let downAt: GesturePoint | null = null;
  let last: GesturePoint | null = null;
  let dragging = false;
  let longTimer: ReturnType<typeof setTimeout> | null = null;
  let longFired = false;
  let lastTap = 0;
  let pinch: { dist: number; mid: GesturePoint } | null = null;

  const local = (e: { clientX: number; clientY: number }): GesturePoint => {
    const r = element.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const clearLong = () => {
    if (longTimer) clearTimeout(longTimer);
    longTimer = null;
  };
  const pinchState = () => {
    const [a, b] = [...pointers.values()];
    return { dist: Math.hypot(a.x - b.x, a.y - b.y), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
  };

  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const p = local(e);
    pointers.set(e.pointerId, p);
    try {
      element.setPointerCapture(e.pointerId);
    } catch {
      /* capture is best-effort (synthetic events in tests) */
    }
    if (pointers.size === 2) {
      clearLong();
      if (dragging) handlers.onDragEnd?.(p, e);
      dragging = false;
      pinch = pinchState();
      return;
    }
    downAt = p;
    last = p;
    longFired = false;
    clearLong();
    if (handlers.onLongPress) {
      longTimer = setTimeout(() => {
        longFired = true;
        if (downAt) handlers.onLongPress?.(downAt, e);
      }, longPressMs);
    }
  };

  const onPointerMove = (e: PointerEvent) => {
    const p = local(e);
    if (!pointers.has(e.pointerId)) {
      if (e.pointerType !== 'touch') handlers.onHover?.(p, e);
      return;
    }
    pointers.set(e.pointerId, p);
    if (pointers.size === 2 && pinch) {
      const next = pinchState();
      if (next.dist > 0 && pinch.dist > 0) handlers.onZoom?.({ factor: pinch.dist / next.dist, point: next.mid, source: 'pinch' });
      handlers.onPan?.({ dx: next.mid.x - pinch.mid.x, dy: next.mid.y - pinch.mid.y, source: 'pinch' });
      pinch = next;
      e.preventDefault();
      return;
    }
    if (!downAt || !last) return;
    const moved = Math.hypot(p.x - downAt.x, p.y - downAt.y);
    if (!dragging && moved >= dragThreshold) {
      clearLong();
      // Touch: a mostly vertical move belongs to page scroll unless a scrub already started.
      if (e.pointerType === 'touch' && !longFired && (!touchPan || Math.abs(p.y - downAt.y) > Math.abs(p.x - downAt.x))) {
        pointers.delete(e.pointerId);
        downAt = null;
        return;
      }
      dragging = true;
      handlers.onDragStart?.(downAt, e);
    }
    if (dragging) {
      handlers.onDrag?.({ dx: p.x - last.x, dy: p.y - last.y, point: p }, e);
      if (e.pointerType === 'touch' && longFired) handlers.onHover?.(p, e);
    }
    last = p;
  };

  const finish = (e: PointerEvent, cancelled: boolean) => {
    const p = local(e);
    const had = pointers.delete(e.pointerId);
    clearLong();
    if (pointers.size === 1) {
      // Pinch ended with one finger still down: continue as a fresh press, no tap.
      const [rest] = [...pointers.values()];
      downAt = rest;
      last = rest;
      pinch = null;
      dragging = false;
      longFired = true;
      return;
    }
    pinch = null;
    if (!had) return;
    if (dragging) handlers.onDragEnd?.(p, e);
    else if (!cancelled && downAt && !longFired) {
      const now = e.timeStamp || Date.now();
      if (handlers.onDoubleTap && now - lastTap < doubleTapMs) {
        handlers.onDoubleTap(p, e);
        lastTap = 0;
      } else {
        handlers.onTap?.(p, e);
        lastTap = now;
      }
    }
    dragging = false;
    downAt = null;
    last = null;
  };

  const onPointerUp = (e: PointerEvent) => finish(e, false);
  const onPointerCancel = (e: PointerEvent) => finish(e, true);
  const onPointerLeave = (e: PointerEvent) => {
    if (e.pointerType !== 'touch' && !pointers.has(e.pointerId)) handlers.onHover?.(null, e);
  };

  const onWheel = (e: WheelEvent) => {
    const scale = e.deltaMode === 1 ? WHEEL_LINE_PX : e.deltaMode === 2 ? element.clientWidth : 1;
    const dx = e.deltaX * scale;
    const dy = e.deltaY * scale;
    const zoomIntent = e.ctrlKey || e.metaKey || (wheelZoom && Math.abs(dy) > Math.abs(dx));
    if (zoomIntent && handlers.onZoom) {
      e.preventDefault();
      // ctrl+wheel is a trackpad pinch: small deltas, stronger factor.
      const k = e.ctrlKey ? 0.01 : 0.0015;
      handlers.onZoom({ factor: Math.exp(dy * k), point: local(e), source: 'wheel' });
      return;
    }
    if (Math.abs(dx) > Math.abs(dy) && handlers.onPan) {
      e.preventDefault();
      handlers.onPan({ dx: -dx, dy: 0, source: 'wheel' });
    }
  };

  element.addEventListener('pointerdown', onPointerDown);
  element.addEventListener('pointermove', onPointerMove);
  element.addEventListener('pointerup', onPointerUp);
  element.addEventListener('pointercancel', onPointerCancel);
  element.addEventListener('pointerleave', onPointerLeave);
  element.addEventListener('wheel', onWheel, { passive: false });
  return () => {
    clearLong();
    element.removeEventListener('pointerdown', onPointerDown);
    element.removeEventListener('pointermove', onPointerMove);
    element.removeEventListener('pointerup', onPointerUp);
    element.removeEventListener('pointercancel', onPointerCancel);
    element.removeEventListener('pointerleave', onPointerLeave);
    element.removeEventListener('wheel', onWheel);
  };
}
