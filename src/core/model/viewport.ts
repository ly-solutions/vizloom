import { HOUR, type TimeRange } from './time';

export interface ViewportOptions {
  /** Whole history: the window never leaves it. */
  readonly extent: TimeRange;
  /** Initial window. Defaults to the whole history. */
  readonly initial?: TimeRange;
  /** Narrowest window, ms. Defaults to 3 hours. */
  readonly minSpan?: number;
  /** Smoothing time constant, ms: larger is slower. 0 disables animation. */
  readonly tau?: number;
}

export interface ViewportState {
  /** Window drawn right now (while moving). */
  readonly current: TimeRange;
  /** Window it is moving to. */
  readonly target: TimeRange;
  readonly animating: boolean;
}

export type ViewportListener = (state: ViewportState) => void;

export interface SetRangeOptions {
  /** No animation: finger drag, navigator handle. */
  readonly instant?: boolean;
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const approach = (cur: number, target: number, dt: number, tau: number) => cur + (target - cur) * (1 - Math.exp(-dt / Math.max(tau, 1)));

/**
 * Time window shared by a chart, its navigator, markers and zoom buttons. Framework-free:
 * keeps a target and eases the current window towards it (centre and log-width, so zoom feels
 * uniform at any scale). Listeners get every animation frame.
 */
export class Viewport {
  private extentRange: TimeRange;
  private targetRange: TimeRange;
  private currentRange: TimeRange;
  private readonly listeners = new Set<ViewportListener>();
  private readonly minSpan: number;
  private tau: number;
  private frame = 0;
  private last = 0;

  constructor(options: ViewportOptions) {
    this.extentRange = options.extent;
    this.minSpan = options.minSpan ?? 3 * HOUR;
    this.tau = options.tau ?? 120;
    if (prefersReducedMotion()) this.tau = 0;
    const initial = this.clamp(options.initial ?? options.extent);
    this.targetRange = initial;
    this.currentRange = initial;
  }

  get extent(): TimeRange {
    return this.extentRange;
  }

  get state(): ViewportState {
    return { current: this.currentRange, target: this.targetRange, animating: this.frame !== 0 };
  }

  /** Animation time constant (slow motion in stories, 0 — instant). */
  setTau(tau: number): void {
    this.tau = tau;
  }

  subscribe(listener: ViewportListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  setExtent(extent: TimeRange): void {
    this.extentRange = extent;
    this.targetRange = this.clamp(this.targetRange);
    this.currentRange = this.clamp(this.currentRange);
    this.kick();
  }

  setRange(range: TimeRange, options: SetRangeOptions = {}): void {
    this.targetRange = this.clamp(range);
    if (options.instant || this.tau <= 0) {
      this.currentRange = this.targetRange;
      this.emit();
      return;
    }
    this.kick();
  }

  /** Zoom around moment `anchor`: `factor` < 1 zooms in, > 1 zooms out. */
  zoomAround(anchor: number, factor: number, options: SetRangeOptions = {}): void {
    const { start, end } = this.targetRange;
    this.setRange({ start: anchor - (anchor - start) * factor, end: anchor + (end - anchor) * factor }, options);
  }

  /** Shift the window by `ms` (positive is right, to the future). */
  panBy(ms: number, options: SetRangeOptions = {}): void {
    this.setRange({ start: this.targetRange.start + ms, end: this.targetRange.end + ms }, options);
  }

  /** One animation step of `dt` ms. Returns whether the window keeps moving. For tests and custom loops. */
  step(dt: number): boolean {
    const c = this.currentRange;
    const t = this.targetRange;
    const cc = (c.start + c.end) / 2;
    const cs = Math.log(c.end - c.start);
    const tc = (t.start + t.end) / 2;
    const ts = Math.log(t.end - t.start);
    let nc = approach(cc, tc, dt, this.tau);
    let ns = approach(cs, ts, dt, this.tau);
    const done = Math.abs(nc - tc) < (t.end - t.start) * 2e-4 && Math.abs(ns - ts) < 2e-4;
    if (done) {
      nc = tc;
      ns = ts;
    }
    const half = Math.exp(ns) / 2;
    this.currentRange = done ? t : { start: nc - half, end: nc + half };
    return !done;
  }

  /** Back to the whole history. */
  reset(options: SetRangeOptions = {}): void {
    this.setRange(this.extentRange, options);
  }

  dispose(): void {
    if (this.frame && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.listeners.clear();
  }

  private clamp(range: TimeRange): TimeRange {
    const e = this.extentRange;
    const full = Math.max(e.end - e.start, 1);
    const span = Math.min(Math.max(range.end - range.start, Math.min(this.minSpan, full)), full);
    const center = (range.start + range.end) / 2;
    let start = center - span / 2;
    let end = center + span / 2;
    if (start < e.start) {
      end += e.start - start;
      start = e.start;
    }
    if (end > e.end) {
      start -= end - e.end;
      end = e.end;
    }
    return { start: Math.max(e.start, start), end: Math.min(e.end, end) };
  }

  private kick(): void {
    if (this.frame || typeof requestAnimationFrame !== 'function') {
      if (typeof requestAnimationFrame !== 'function') {
        this.currentRange = this.targetRange;
        this.emit();
      }
      return;
    }
    this.last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(50, Math.max(0, now - this.last));
      this.last = now;
      const moving = this.step(dt);
      this.frame = moving ? requestAnimationFrame(tick) : 0;
      this.emit();
    };
    this.frame = requestAnimationFrame(tick);
  }

  private emit(): void {
    const state = this.state;
    for (const listener of this.listeners) listener(state);
  }
}
