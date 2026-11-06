import { createFormatter, type Formatter, UNIT_COUNT, type ValueUnit } from '../../../core';
import type { ZoneTone } from '../../../core';
import { niceCeil, niceStep } from '../../../core';
import { HOUR, MINUTE, type TickLevel, type TimeRange } from '../../../core';
import type { SeriesFrame, StackMode, TimeMarker, TimeZoneBand } from '../../../core';
import type { Viewport } from '../../../core';
import { lodTimes } from '../model/lod';
import { stackAt } from '../model/stack';
import { type CanvasColors, readCanvasColors, resolveTheme, type Rgba, resolveColor, type ThemeName } from './colors';
import { buildLayer, easeLayer, layerFilled, layerKnot, layerValue, refreshTangents, type DataLayer } from './layer';
import type { ChartRenderer, ChartPoint } from './renderer';

export const CHART_STATUS = {
  loading: 'loading',
  ready: 'ready',
  empty: 'empty',
  error: 'error',
} as const;

export type ChartStatus = (typeof CHART_STATUS)[keyof typeof CHART_STATUS];

/** Words drawn on the canvas. An empty string hides the caption. */
export interface TimeCanvasLabels {
  /** Next to the "now" line. */
  readonly now: string;
  /** Over a gap in the data. */
  readonly gap: string;
  /** Before the value of the maximum. */
  readonly peak: string;
  /** Before the sum next to a lone point when there are several series. */
  readonly total: string;
  /** After the date of a bucket that is still running. */
  readonly current: string;
}

export const DEFAULT_CANVAS_LABELS: TimeCanvasLabels = {
  now: 'now',
  gap: 'no data',
  peak: 'peak',
  total: 'Total',
  current: 'in progress',
};

/** "Before → after" windows around a marker. */
export interface EffectWindow {
  readonly t: number;
  /** Length of the "before" window, ms. */
  readonly window: number;
  readonly afterEnd: number;
  readonly color?: string;
  readonly beforeLabel?: string;
  readonly afterLabel?: string;
}

export const POINTS_MODE = { auto: 'auto', always: 'always', none: 'none' } as const;
export type PointsMode = (typeof POINTS_MODE)[keyof typeof POINTS_MODE];

/** A horizontal dashed guide: average, target, threshold. */
export interface ChartGuide {
  readonly value: number;
  readonly label?: string;
  /** CSS colour; default the secondary text colour. */
  readonly color?: string;
}

/** A tick of a custom X axis. */
export interface AxisTick {
  readonly t: number;
  readonly label: string;
  /** Major ticks (day starts, zero) are drawn brighter. */
  readonly major?: boolean;
}

export interface TimeEngineOptions {
  readonly mode: StackMode;
  /** 0 — polyline, 1 — smooth monotone curve; values between blend the two. */
  readonly smooth: number;
  /** Fill density under the line, 0…1. 0 makes a pure line chart. */
  readonly gradient: number;
  readonly lineWidth: number;
  readonly points: PointsMode;
  readonly grid: boolean;
  readonly zones: boolean;
  /** Caption at the maximum. */
  readonly peak: boolean;
  /** Animation duration multiplier: 1 — as designed, 4 — slow motion, 0 — no animation. */
  readonly slow: number;
  readonly unit: ValueUnit;
  /** Number formatting, dates and the time zone of the axis. */
  readonly format: Formatter;
  /** Custom Y label formatter (wins over `unit`). */
  readonly formatY: ((value: number) => string) | null;
  /** Custom X ticks (minutes, "days before"): replaces the calendar axis. */
  readonly xTicks: ((range: TimeRange, widthPx: number) => readonly AxisTick[]) | null;
  /** Y axis on the left (outside the plot) or on the right inside it (phones). */
  readonly axis: 'left' | 'right';
  readonly guides: readonly ChartGuide[];
  /** Zone drawing mode: dragging selects a period instead of panning. */
  readonly zoneDraw: boolean;
  readonly zoneDrawTone: ZoneTone;
  /** Zones brighter than usual (onboarding, highlight). */
  readonly zoneFocus: boolean;
  /** Live data: beacons at the line ends. */
  readonly live: boolean;
  /** Smallest step the zone-draw edges snap to, ms. Default: the bucket of the current frame. */
  readonly snapStep: number | null;
  /** Custom bucket caption (minutes, "day 12 of 30"). */
  readonly bucketLabel: ((start: number, step: number) => string) | null;
  readonly labels: TimeCanvasLabels;
}

export const DEFAULT_TIME_OPTIONS: TimeEngineOptions = {
  mode: 'overlay',
  smooth: 1,
  gradient: 0.6,
  lineWidth: 2,
  points: 'auto',
  grid: true,
  zones: true,
  peak: false,
  slow: 1,
  unit: UNIT_COUNT,
  format: createFormatter(),
  formatY: null,
  xTicks: null,
  axis: 'left',
  guides: [],
  zoneDraw: false,
  zoneDrawTone: 'accent',
  zoneFocus: false,
  live: false,
  snapStep: null,
  bucketLabel: null,
  labels: DEFAULT_CANVAS_LABELS,
};

export interface TimeEngineSeries {
  readonly id: string;
  /** Any CSS color. */
  readonly color: string;
}

export interface TimeHover {
  /** Segment index in the current frame. */
  readonly k: number;
  readonly start: number;
  readonly step: number;
  /** Segment midpoint X, CSS pixels from the canvas left edge. */
  readonly x: number;
  /** Where on the line the tooltip anchor sits, CSS pixels from the canvas top. */
  readonly y: number;
  /** Series under the cursor (on the line or inside its fill). */
  readonly seriesId: string | null;
}

export interface TimePress {
  readonly seriesId: string | null;
  readonly k: number;
  readonly start: number;
  readonly pointerType: string;
}

export interface ZoneHit {
  readonly zone: TimeZoneBand;
  readonly x: number;
  readonly y: number;
  readonly width: number;
}

export interface TimeEngineCallbacks {
  onHover?(hover: TimeHover | null): void;
  onPress?(press: TimePress): void;
  onZoneHover?(hit: ZoneHit | null): void;
  onZoneRemove?(id: string): void;
  /** Drag in markup mode: draft of a period; `done` — finger/button released. */
  onZoneDraft?(range: TimeRange | null, done: boolean): void;
  /** The user took hold of the window themselves: wheel, drag, pinch. */
  onInteract?(): void;
  onEscape?(): void;
  /** Every drawn frame — overlays adjust their positions. */
  onPaint?(): void;
}

export interface PlotRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface SeriesAnim {
  id: string;
  color: Rgba;
  /** Visibility: series weight 0…1 and target. */
  w: number;
  wt: number;
  /** Brightness: 1 is normal, lower is dimmed by focus on another series. */
  e: number;
  et: number;
  /** Emphasis: 1 — the series is in focus. */
  f: number;
  ft: number;
  /** Appearance: 0 → 1. */
  rv: number;
}

export interface Pulse {
  readonly id: string;
  readonly t: number;
  readonly born: number;
}

export interface Float {
  readonly id: string;
  readonly t: number;
  readonly text: string;
  readonly born: number;
}

export interface Sample {
  readonly ts: Float64Array;
  readonly tops: Float64Array[];
  readonly bottoms: Float64Array[];
  readonly max: number;
  readonly bucketPx: number;
  readonly kA: number;
  readonly kB: number;
}

interface Down {
  x: number;
  y: number;
  start: TimeRange;
  moved: boolean;
  mode: 'pan' | 'zone';
  pointerType: string;
  hist: [number, number][];
  zone: { hit: ZoneHitBox | null };
}

export interface ZoneHitBox {
  readonly zone: TimeZoneBand;
  readonly x0: number;
  readonly x1: number;
  readonly y0: number;
  readonly y1: number;
  readonly close: { x0: number; x1: number } | null;
}

/** Band above 100% in shares mode, px: room for zone labels. */
const PERCENT_HEADROOM = 34;

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const approach = (cur: number, target: number, dt: number, tau: number) =>
  tau <= 0 ? target : cur + (target - cur) * (1 - Math.exp(-dt / tau));
const settle = (cur: number, target: number, dt: number, tau: number, eps = 1e-3) => {
  const next = approach(cur, target, dt, tau);
  return Math.abs(next - target) < eps ? target : next;
};

/**
 * Canvas time-chart engine: window, data layers, stack, axes, zones, markers, zoom, pan,
 * pinch and touch; reports outward what is under the cursor. How to draw the data itself — as waves or
 * bars — is decided by `renderer`. Knows nothing about React, tooltips or the legend: the components
 * around it read geometry via `xOf`/`yOf`/`plot`.
 */
export class TimeEngine {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  /** The canvas has no 2D support: nothing to draw with. */
  readonly inert: boolean;
  options: TimeEngineOptions = DEFAULT_TIME_OPTIONS;
  callbacks: TimeEngineCallbacks = {};

  series: SeriesAnim[] = [];
  layer: DataLayer | null = null;
  prev: DataLayer | null = null;
  morph = 1;
  status: ChartStatus = CHART_STATUS.loading;
  refreshing = false;
  refA = 0;
  stackMix = 0;
  pctMix = 0;
  ymax = 10;
  ysnap = true;
  ysets: { step: number; a: number }[] = [];
  xalpha = new Map<TickLevel, number>();
  reveal = 1;
  private revealAt = 0;
  zones: TimeZoneBand[] = [];
  zoneAlpha = new Map<string, number>();
  zoneHits: ZoneHitBox[] = [];
  zoneHoverId: string | null = null;
  markers: TimeMarker[] = [];
  markerFocus: string | null = null;
  now = 0;
  eventAt: number | null = null;
  hover: { k: number; y: number; snap: boolean } | null = null;
  cx: number | null = null;
  pick: string | null = null;
  legendFocus: string | null = null;
  pinned: string | null = null;
  affected: readonly string[] | null = null;
  draft: TimeRange | null = null;
  effectWindow: EffectWindow | null = null;
  /** Skeleton visibility 0…1. */
  skel = 1;
  pulses: Pulse[] = [];
  floats: Float[] = [];
  colors!: CanvasColors;
  theme: ThemeName = 'light';
  font = 'Inter, system-ui, sans-serif';
  dpr = 1;
  W = 0;
  H = 0;
  /** Left margin for Y-axis labels — adapts to the longest one. */
  axisLeft = 48;
  private axisSnap = true;
  readonly pad = { right: 14, top: 36, bottom: 26 };

  /** Formatter of the current options. */
  get fmt(): Formatter {
    return this.options.format;
  }

  private raf = 0;
  private last = 0;
  private readonly paintListeners = new Set<() => void>();
  private down: Down | null = null;
  private dragging = false;
  /** Finger is dragging across values (long press): the gesture neither scrolls the chart nor counts as a tap. */
  private scrubbing = false;
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private pinch: { dist: number; range: TimeRange; anchor: number } | null = null;
  private keyboard = false;
  private readonly unsubscribe: () => void;
  private readonly resizeObserver: ResizeObserver | null;
  private readonly themeObserver: MutationObserver | null;

  constructor(
    canvas: HTMLCanvasElement,
    readonly viewport: Viewport,
    readonly renderer: ChartRenderer,
  ) {
    this.canvas = canvas;
    this.canvas.dataset.chart = renderer.kind;
    const ctx = canvas.getContext('2d');
    // Without a 2D context (jsdom, old WebView) the engine does not draw, but accepts data and input.
    this.inert = !ctx;
    this.ctx = ctx as CanvasRenderingContext2D;
    this.readTheme();
    this.unsubscribe = viewport.subscribe(() => this.kick());
    this.resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(() => this.resize()) : null;
    this.resizeObserver?.observe(canvas);
    this.themeObserver = typeof MutationObserver === 'function' ? new MutationObserver(() => this.readTheme()) : null;
    this.themeObserver?.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-vl-theme', 'style'],
      subtree: true,
    });
    this.bind();
    this.resize();
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.unsubscribe();
    this.resizeObserver?.disconnect();
    this.themeObserver?.disconnect();
    this.unbind();
  }

  // ───────── input data ─────────

  setOptions(patch: Partial<TimeEngineOptions>): void {
    this.options = { ...this.options, ...patch };
    this.canvas.dataset.zoneDraw = this.options.zoneDraw ? 'true' : 'false';
    if (!this.options.zoneDraw && this.draft) {
      this.draft = null;
      this.callbacks.onZoneDraft?.(null, true);
    }
    this.kick();
  }

  setSeries(list: readonly TimeEngineSeries[]): void {
    const old = new Map(this.series.map((s) => [s.id, s]));
    this.series = list.map((item) => {
      const prev = old.get(item.id);
      return {
        id: item.id,
        color: resolveColor(item.color),
        w: prev?.w ?? 1,
        wt: prev?.wt ?? 1,
        e: prev?.e ?? 1,
        et: prev?.et ?? 1,
        f: prev?.f ?? 0,
        ft: prev?.ft ?? 0,
        rv: prev?.rv ?? 1,
      };
    });
    if (this.frame) this.setFrame(this.frame, true);
    this.kick();
  }

  /** Hidden series: ease down to zero, the stack is rebuilt. */
  setHidden(hidden: ReadonlySet<string>): void {
    for (const s of this.series) s.wt = hidden.has(s.id) ? 0 : 1;
    this.kick();
  }

  private frame: SeriesFrame | null = null;

  /**
   * New frame. Same granularity — values ease to the new ones; different — the chart flows
   * from the old granularity to the new one.
   */
  setFrame(frame: SeriesFrame | null, keepMotion = false): void {
    this.frame = frame;
    const ids = this.series.map((s) => s.id);
    if (!frame) {
      this.layer = null;
      this.prev = null;
      this.kick();
      return;
    }
    const first = !this.layer;
    if (this.layer && this.layer.step !== frame.step && this.renderer.morph === 'aggregate') {
      // Bars: a new segment grows from the sum of the old ones it covers (day → hours and back).
      this.layer = buildLayer(frame, ids, this.layer);
      this.prev = null;
      this.morph = 1;
    } else if (this.layer && this.layer.step !== frame.step) {
      this.prev = this.layer;
      this.layer = buildLayer(frame, ids, null);
      this.morph = 0;
    } else {
      this.layer = buildLayer(frame, ids, keepMotion || !first ? this.layer : null);
    }
    if (first) {
      this.ysnap = true;
      this.axisSnap = true;
    }
    this.kick();
  }

  setStatus(status: ChartStatus, refreshing = false): void {
    const was = this.status;
    this.status = status;
    this.refreshing = refreshing;
    if (status === CHART_STATUS.ready && was !== CHART_STATUS.ready) this.replay();
    if (status !== CHART_STATUS.ready) {
      this.hoverLock = null;
      this.setHoverState(null);
    }
    this.kick();
  }

  /** Replay the wave appearance. */
  replay(): void {
    this.reveal = 0;
    this.revealAt = 0;
    this.ysnap = true;
    this.kick();
  }

  setTimeline(now: number, eventAt: number | null = null): void {
    this.now = now;
    this.eventAt = eventAt;
    this.kick();
  }

  setZones(zones: readonly TimeZoneBand[]): void {
    const known = new Set(this.zones.map((z) => z.id));
    for (const z of zones) if (!known.has(z.id) && this.zoneAlpha.size > 0) this.zoneAlpha.set(z.id, 0);
    for (const z of zones) if (!this.zoneAlpha.has(z.id)) this.zoneAlpha.set(z.id, 1);
    this.zones = [...zones];
    this.kick();
  }

  /** Focused marker (hovered or pinned) and the series it affects. */
  setMarkers(markers: readonly TimeMarker[], focusId: string | null): void {
    this.markers = [...markers];
    this.markerFocus = focusId;
    const marker = focusId ? markers.find((m) => m.id === focusId) : null;
    this.affected = marker?.series?.length ? marker.series : null;
    this.kick();
  }

  /** Series under the cursor in the legend and the pinned series. */
  setFocus(legendFocus: string | null, pinned: string | null): void {
    this.legendFocus = legendFocus;
    this.pinned = pinned;
    this.kick();
  }

  setEffectWindow(window: EffectWindow | null): void {
    this.effectWindow = window;
    this.kick();
  }

  pulse(list: readonly { id: string; t: number }[]): void {
    const born = performance.now();
    for (const p of list) this.pulses.push({ ...p, born });
    this.kick();
  }

  float(list: readonly { id: string; t: number; text: string }[]): void {
    const born = performance.now();
    for (const f of list) this.floats.push({ ...f, born });
    this.kick();
  }

  /** Every drawn frame — for neighbors aligned to the chart (the "whole period" strip). */
  subscribePaint(listener: () => void): () => void {
    this.paintListeners.add(listener);
    return () => this.paintListeners.delete(listener);
  }

  // ───────── geometry for overlays ─────────

  get plot(): PlotRect {
    const inside = this.options.axis === 'right';
    const left = inside ? 6 : this.axisLeft;
    const right = inside ? 6 : this.pad.right;
    return {
      left,
      top: this.pad.top,
      width: Math.max(0, this.W - right - left),
      height: Math.max(0, this.H - this.pad.bottom - this.pad.top),
    };
  }

  xOf(t: number): number {
    const { start, end } = this.viewport.state.current;
    const p = this.plot;
    return p.left + ((t - start) / (end - start)) * p.width;
  }

  tOf(x: number): number {
    const { start, end } = this.viewport.state.current;
    const p = this.plot;
    return start + ((x - p.left) / Math.max(p.width, 1)) * (end - start);
  }

  yOf(v: number): number {
    const p = this.plot;
    return p.top + p.height - (v / this.ymax) * p.height;
  }

  /** Series values at moment `t` accounting for stack and visibility; `exact` — exactly at a segment node. */
  topsAt(t: number, exact = false): Float64Array {
    const n = this.series.length;
    const vals = new Float64Array(n);
    const tops = new Float64Array(n);
    const bottoms = new Float64Array(n);
    const L = this.layer;
    if (!L) return tops;
    const k = exact ? Math.round((t - L.c0) / L.step) : -1;
    for (let s = 0; s < n; s++) {
      const w = this.series[s].w;
      const v = exact && (L.length < 2 || this.morph >= 1) ? layerKnot(L, s, k) : this.valueAt(s, t);
      vals[s] = w < 1e-3 ? 0 : v * w;
    }
    stackAt(vals, this.stackMix, this.pctMix, tops, bottoms);
    return tops;
  }

  /** Midpoint of segment `k` of the current frame. */
  bucketCenter(k: number): number {
    return this.layer ? this.layer.c0 + k * this.layer.step : 0;
  }

  /** Value of series `s` at moment `t`: during a granularity change — a blend of old and new. */
  valueAt(s: number, t: number): number {
    const smooth = this.options.smooth;
    const L = this.layer;
    if (!L) return Number.NaN;
    refreshTangents(L);
    const a = layerValue(L, s, t, smooth);
    const P = this.prev;
    if (!P || this.morph >= 1) return a;
    refreshTangents(P);
    const b = layerValue(P, P.ids.indexOf(this.series[s].id), t, smooth);
    if (a !== a) return b;
    if (b !== b) return a;
    const m = this.morph;
    return b + (a - b) * (m < 0.5 ? 4 * m * m * m : 1 - (-2 * m + 2) ** 3 / 2);
  }

  // ───────── frame loop ─────────

  kick(): void {
    if (this.raf || this.inert) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame((t) => this.frameTick(t));
  }

  private frameTick(now: number): void {
    this.raf = 0;
    const dt = Math.min(50, Math.max(0, now - this.last));
    this.last = now;
    let busy = this.step(dt, now);
    busy = this.renderer.paint(this, dt, now) || busy;
    this.callbacks.onPaint?.();
    for (const listener of this.paintListeners) listener();
    if (busy || this.viewport.state.animating) this.raf = requestAnimationFrame((t) => this.frameTick(t));
  }

  private step(dt: number, now: number): boolean {
    const slow = this.options.slow;
    let busy = false;
    if (this.morph < 1) {
      this.morph = slow <= 0 ? 1 : Math.min(1, this.morph + dt / (620 * slow));
      busy = true;
      if (this.morph >= 1) this.prev = null;
    }
    if (this.layer && easeLayer(this.layer, dt, 190 * slow)) busy = true;
    if (this.prev) easeLayer(this.prev, dt, 190 * slow);
    const focus = this.legendFocus ?? this.pick ?? this.pinned;
    for (const s of this.series) {
      s.et = this.emphasis(s.id, focus);
      s.ft = focus === s.id ? 1 : 0;
      s.w = settle(s.w, s.wt, dt, 150 * slow);
      s.e = settle(s.e, s.et, dt, 110 * slow);
      s.f = settle(s.f, s.ft, dt, 110 * slow);
      if (s.w !== s.wt || s.e !== s.et || s.f !== s.ft) busy = true;
    }
    const mt = this.options.mode === 'overlay' ? 0 : 1;
    const pt = this.options.mode === 'percent' ? 1 : 0;
    this.stackMix = settle(this.stackMix, mt, dt, 170 * slow);
    this.pctMix = settle(this.pctMix, pt, dt, 170 * slow);
    if (this.stackMix !== mt || this.pctMix !== pt) busy = true;
    if (this.reveal < 1 && this.status === CHART_STATUS.ready && this.layer) {
      if (!this.revealAt) this.revealAt = now - this.reveal * 1300 * slow;
      this.reveal = slow <= 0 ? 1 : Math.min(1, Math.max(1e-6, (now - this.revealAt) / (1300 * slow)));
      busy = true;
    }
    const rt = this.refreshing ? 1 : 0;
    this.refA = settle(this.refA, rt, dt, 140 * slow, 0.01);
    if (this.refA !== rt) busy = true;
    for (const z of this.zones) {
      const a = this.zoneAlpha.get(z.id) ?? 1;
      if (a < 1) {
        this.zoneAlpha.set(z.id, slow <= 0 ? 1 : Math.min(1, a + dt / (420 * slow)));
        busy = true;
      }
    }
    const life = Math.max(slow, 0.25);
    this.pulses = this.pulses.filter((p) => now - p.born < 1300 * life);
    this.floats = this.floats.filter((f) => now - f.born < 1600 * life);
    if (this.pulses.length || this.floats.length) busy = true;
    return busy;
  }

  /** Series brightness: the legend dims most, then the series under the cursor, then the change marker. */
  private emphasis(id: string, focus: string | null): number {
    if (this.legendFocus) return id === this.legendFocus ? 1 : 0.12;
    if (focus) return id === focus ? 1 : 0.2;
    if (this.affected) return this.affected.includes(id) ? 1 : 0.16;
    return 1;
  }

  /** Curve sampling across the width: step of ~2.5 px plus exact nodes so peaks are not clipped. */
  sample(): Sample | null {
    const L = this.layer;
    const p = this.plot;
    if (!L || L.length === 0 || p.width <= 0) return null;
    const { start, end } = this.viewport.state.current;
    const span = end - start;
    const bucketPx = (p.width * L.step) / span;
    const kA = Math.max(0, Math.floor((start - L.c0) / L.step));
    const kB = Math.min(L.length - 1, Math.ceil((end - L.c0) / L.step));
    const ts: number[] = [];
    if (bucketPx >= 4 || this.prev) {
      const N = Math.ceil(p.width / 2.5);
      let k = kA;
      for (let i = 0; i <= N; i++) {
        const t = start + (span * i) / N;
        while (k <= kB && L.c0 + k * L.step < t) {
          const c = L.c0 + k * L.step;
          if (c > start) ts.push(c);
          k++;
        }
        ts.push(t);
      }
    } else if (bucketPx < 0.5) {
      // Denser than two buckets per pixel: min/max per pixel column (LOD).
      const ns = this.series.length;
      const total = (k: number) => {
        let sum = 0;
        let seen = false;
        for (let s = 0; s < ns; s++) {
          if (this.series[s].w < 1e-3) continue;
          const v = layerKnot(L, s, k);
          if (v === v) {
            sum += v;
            seen = true;
          }
        }
        return seen ? sum : Number.NaN;
      };
      for (const t of lodTimes({ c0: L.c0, step: L.step, kA, kB }, start, end, p.width, total)) ts.push(t);
    } else {
      ts.push(start);
      for (let k = kA; k <= kB; k++) {
        const c = L.c0 + k * L.step;
        if (c > start && c < end) ts.push(c);
      }
      ts.push(end);
    }
    const n = ts.length;
    const ns = this.series.length;
    const tops = this.series.map(() => new Float64Array(n));
    const bottoms = this.series.map(() => new Float64Array(n));
    const vals = new Float64Array(ns);
    const tp = new Float64Array(ns);
    const bt = new Float64Array(ns);
    let max = 0;
    for (let j = 0; j < n; j++) {
      for (let s = 0; s < ns; s++) {
        const w = this.series[s].w;
        vals[s] = w < 1e-3 ? 0 : this.valueAt(s, ts[j]) * w;
      }
      stackAt(vals, this.stackMix, this.pctMix, tp, bt);
      for (let s = 0; s < ns; s++) {
        tops[s][j] = tp[s];
        bottoms[s][j] = bt[s];
        if (tp[s] > max) max = tp[s];
      }
    }
    return { ts: Float64Array.from(ts), tops, bottoms, max, bucketPx, kA, kB };
  }

  /** Few points: label the value at the point and keep headroom above. */
  get sparse(): boolean {
    return !!this.layer && this.layer.length > 0 && layerFilled(this.layer) <= 2;
  }

  /** Y-axis top for the visible values: eases there, ticks flow. */
  fitY(maxValue: number, dt: number): boolean {
    const slow = this.options.slow;
    let yT = maxValue;
    const percent = this.options.mode === 'percent' && this.pctMix > 0.98;
    // Shares: above 100% — a band for zone and stage labels, otherwise bars and waves reaching the top cover them.
    if (percent) yT = (100 * this.plot.height) / Math.max(this.plot.height - Math.min(PERCENT_HEADROOM, this.plot.height * 0.18), 1);
    else if (yT > 0) yT = niceCeil(yT * (this.sparse ? 1.6 : 1.08));
    else yT = this.status === CHART_STATUS.ready ? this.ymax : 10;
    let busy = false;
    if (this.ysnap && (this.layer || this.status !== CHART_STATUS.ready)) {
      this.ymax = yT;
      this.ysnap = false;
      this.ysets = [];
    } else {
      this.ymax = approach(this.ymax, yT, dt, 210 * slow);
      if (Math.abs(this.ymax - yT) > yT * 1e-3) busy = true;
      else this.ymax = yT;
    }
    const step = percent ? 25 : niceStep(yT / 4);
    if (!this.ysets.some((s) => s.step === step)) this.ysets.push({ step, a: this.ysets.length ? 0 : 1 });
    for (const set of this.ysets) {
      const target = set.step === step ? 1 : 0;
      set.a = settle(set.a, target, dt, 160 * slow, 0.01);
      if (set.a !== target) busy = true;
    }
    this.ysets = this.ysets.filter((s) => s.a > 0 || s.step === step);
    return busy;
  }

  /** Left margin for labels: eases to the width of the longest axis label. */
  fitAxis(labelWidth: number, dt: number): boolean {
    const need = clamp(Math.ceil(labelWidth) + 20, 40, 96);
    if (Math.abs(need - this.axisLeft) < 0.5) return false;
    this.axisLeft = this.axisSnap ? need : approach(this.axisLeft, need, dt, 140 * this.options.slow);
    this.axisSnap = false;
    return true;
  }

  // ───────── hit testing ─────────

  /** Series under a canvas point — decided by the drawing method. */
  hitSeries(x: number, y: number): string | null {
    const p = this.plot;
    if (y < p.top || y > p.top + p.height || !this.layer) return null;
    return this.renderer.hit(this, x, y);
  }

  /**
   * Tooltip anchor: segment `k` and the series under the cursor (or the pinned one). `pinned` — stay
   * exactly on the segment, otherwise follow the smoothly moving crosshair.
   */
  tooltipAnchor(k: number, seriesId: string | null, pinned: boolean): ChartPoint | null {
    if (!this.layer || k < 0 || k >= this.layer.length) return null;
    const point = this.renderer.anchor(this, k, seriesId, !pinned);
    const p = this.plot;
    if (!point || point.x < p.left - 2 || point.x > p.left + p.width + 2) return null;
    return point;
  }

  private hitZone(x: number, y: number): ZoneHitBox | null {
    if (!this.options.zones) return null;
    return this.zoneHits.find((h) => x >= h.x0 && x <= h.x1 && y >= h.y0 && y <= h.y1) ?? null;
  }

  private bucketAt(x: number): number {
    const L = this.layer;
    if (!L || L.length === 0) return -1;
    return clamp(Math.round((this.tOf(x) - L.c0) / L.step), 0, L.length - 1);
  }

  /** Hover state; outward — only when the segment or series changed. */
  /** Pinned segment: the tooltip sits on it, mouse movement does not shift it. */
  private hoverLock: number | null = null;

  /**
   * Pin the tooltip to segment `k` (a click away from lines and bars) or unpin (`null`).
   * While a segment is pinned, mouse hover and the cursor leaving the chart do not affect the tooltip.
   */
  lockHover(k: number | null): void {
    if (this.hoverLock === k) return;
    this.hoverLock = k;
    const L = this.layer;
    if (k === null || !L || k < 0 || k >= L.length) {
      this.hoverLock = null;
      this.setHoverState(null);
      return;
    }
    this.setHoverState({ k, y: this.plot.top + this.plot.height / 2 });
  }

  setHoverState(next: { k: number; y: number } | null, seriesId: string | null = null): void {
    const before = this.hover;
    if (!next) {
      const had = !!before || this.pick !== null;
      this.hover = null;
      this.cx = null;
      this.pick = null;
      if (had) this.callbacks.onHover?.(null);
      this.kick();
      return;
    }
    this.hover = { k: next.k, y: next.y, snap: !before };
    const changed = !before || before.k !== next.k || this.pick !== seriesId;
    this.pick = seriesId;
    if (changed) this.emitHover();
    this.kick();
  }

  emitHover(): void {
    const L = this.layer;
    const h = this.hover;
    if (!L || !h) return;
    const point = this.renderer.anchor(this, h.k, this.pinned ?? this.pick, false);
    const x = point?.x ?? this.xOf(L.c0 + h.k * L.step);
    const y = point?.y ?? this.plot.top + this.plot.height - 8;
    this.callbacks.onHover?.({ k: h.k, start: L.start + h.k * L.step, step: L.step, x, y, seriesId: this.pick });
  }

  /** Finger held and dragged: the tooltip follows the segment under the finger, chart dragging is disabled. */
  scrubAt(clientX: number, clientY: number): void {
    this.scrubbing = true;
    this.down = null;
    this.dragging = false;
    delete this.canvas.dataset.dragging;
    const L = this.layer;
    if (!L || this.status !== CHART_STATUS.ready) return;
    const p = this.pos({ clientX, clientY });
    const x = clamp(p.x, this.plot.left, this.plot.left + this.plot.width);
    this.setHoverState({ k: this.bucketAt(x), y: p.y }, this.hitSeries(x, p.y));
  }

  endScrub(): void {
    if (!this.scrubbing) return;
    this.scrubbing = false;
    this.setHoverState(null);
  }

  /** The tooltip can be opened from the keyboard: arrows move between segments. */
  moveHover(delta: number): void {
    const L = this.layer;
    if (!L || L.length === 0) return;
    const p = this.plot;
    const k0 = this.hover ? this.hover.k : this.bucketAt(p.left + p.width - 10);
    const k = clamp(k0 + (this.hover ? delta : 0), 0, L.length - 1);
    const t = L.c0 + k * L.step;
    const { start, end } = this.viewport.state.target;
    if (t < start || t > end) {
      const span = end - start;
      this.viewport.setRange({ start: t - span / 2, end: t + span / 2 });
    }
    this.keyboard = true;
    this.setHoverState({ k, y: p.top + p.height * 0.35 });
  }

  // ───────── input ─────────

  private readonly handlers: [keyof HTMLElementEventMap, (event: never) => void, AddEventListenerOptions?][] = [];

  private bind(): void {
    const on = <K extends keyof HTMLElementEventMap>(
      type: K,
      fn: (event: HTMLElementEventMap[K]) => void,
      opts?: AddEventListenerOptions,
    ) => {
      this.canvas.addEventListener(type, fn as EventListener, opts);
      this.handlers.push([type, fn as (event: never) => void, opts]);
    };
    on('wheel', (e) => this.onWheel(e), { passive: false });
    on('pointerdown', (e) => this.onDown(e));
    on('pointermove', (e) => this.onMove(e));
    on('pointerup', (e) => this.onUp(e));
    on('pointercancel', (e) => this.onCancel(e));
    on('pointerleave', (e) => this.onLeave(e));
    on('keydown', (e) => this.onKey(e));
    on('blur', () => {
      if (this.keyboard) {
        this.keyboard = false;
        this.setHoverState(null);
      }
    });
  }

  private unbind(): void {
    for (const [type, fn, opts] of this.handlers) this.canvas.removeEventListener(type, fn as EventListener, opts);
    this.handlers.length = 0;
  }

  private pos(e: { clientX: number; clientY: number }) {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private interactive(): boolean {
    return this.status === CHART_STATUS.ready || this.status === CHART_STATUS.empty;
  }

  private onWheel(e: WheelEvent): void {
    if (!this.interactive()) return;
    e.preventDefault();
    this.callbacks.onInteract?.();
    const { start, end } = this.viewport.state.target;
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && !e.ctrlKey) {
      this.viewport.panBy((e.deltaX / Math.max(this.plot.width, 1)) * (end - start));
      return;
    }
    const p = this.pos(e);
    const plot = this.plot;
    const anchor = start + ((clamp(p.x, plot.left, plot.left + plot.width) - plot.left) / Math.max(plot.width, 1)) * (end - start);
    this.viewport.zoomAround(anchor, Math.exp(e.deltaY * (e.ctrlKey ? 0.012 : 0.0016)));
  }

  private onDown(e: PointerEvent): void {
    if (e.button !== 0 || !this.interactive()) return;
    const p = this.pos(e);
    this.pointers.set(e.pointerId, p);
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      const range = this.viewport.state.target;
      this.pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), range, anchor: this.tOf((a.x + b.x) / 2) };
      this.down = null;
      this.callbacks.onInteract?.();
      return;
    }
    this.down = {
      x: p.x,
      y: p.y,
      start: this.viewport.state.target,
      moved: false,
      mode: this.options.zoneDraw ? 'zone' : 'pan',
      pointerType: e.pointerType,
      hist: [[performance.now(), p.x]],
      zone: { hit: this.hitZone(p.x, p.y) },
    };
    this.canvas.setPointerCapture?.(e.pointerId);
  }

  private onMove(e: PointerEvent): void {
    const p = this.pos(e);
    if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, p);
    if (this.pinch && this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      const dist = Math.max(Math.hypot(a.x - b.x, a.y - b.y), 1);
      const f = this.pinch.dist / dist;
      const { range, anchor } = this.pinch;
      this.viewport.setRange({ start: anchor - (anchor - range.start) * f, end: anchor + (range.end - anchor) * f }, { instant: true });
      return;
    }
    if (this.scrubbing) return;
    const d = this.down;
    if (!d) {
      if (e.pointerType === 'mouse') this.onHover(p);
      return;
    }
    const dx = p.x - d.x;
    const dy = p.y - d.y;
    if (!d.moved) {
      if (Math.abs(dx) <= 3 && Math.abs(dy) <= 3) return;
      // The finger moved vertically — that is page scroll, not the chart.
      if (d.pointerType !== 'mouse' && Math.abs(dy) > Math.abs(dx)) {
        this.down = null;
        return;
      }
      d.moved = true;
      if (d.mode === 'pan') {
        this.dragging = true;
        this.canvas.dataset.dragging = 'true';
        this.setHoverState(null);
        this.callbacks.onInteract?.();
      }
    }
    if (d.mode === 'pan') {
      const span = d.start.end - d.start.start;
      const shift = -(dx / Math.max(this.plot.width, 1)) * span;
      this.viewport.setRange({ start: d.start.start + shift, end: d.start.end + shift }, { instant: true });
      d.hist.push([performance.now(), p.x]);
      if (d.hist.length > 6) d.hist.shift();
    } else {
      this.draft = this.snapRange(this.tOf(d.x), this.tOf(p.x));
      this.callbacks.onZoneDraft?.(this.draft, false);
      this.kick();
    }
  }

  private onUp(e: PointerEvent): void {
    this.pointers.delete(e.pointerId);
    if (this.pinch) {
      if (this.pointers.size < 2) this.pinch = null;
      return;
    }
    const d = this.down;
    this.down = null;
    this.dragging = false;
    delete this.canvas.dataset.dragging;
    if (!d || this.scrubbing) return;
    const p = this.pos(e);
    if (d.moved && d.mode === 'pan') {
      const [ta, xa] = d.hist[0];
      const [tb, xb] = d.hist[d.hist.length - 1];
      if (tb - ta > 0 && performance.now() - tb < 80) {
        const v = (xb - xa) / (tb - ta);
        const span = this.viewport.state.target.end - this.viewport.state.target.start;
        this.viewport.panBy(-((v * 260) / Math.max(this.plot.width, 1)) * span);
      }
      return;
    }
    if (d.moved && d.mode === 'zone') {
      this.callbacks.onZoneDraft?.(this.draft, true);
      return;
    }
    const hit = d.zone.hit;
    if (hit?.close && p.x >= hit.close.x0 && p.x <= hit.close.x1) {
      this.callbacks.onZoneRemove?.(hit.zone.id);
      return;
    }
    if (hit || this.options.zoneDraw || this.status !== CHART_STATUS.ready) return;
    const k = this.bucketAt(p.x);
    const seriesId = this.hitSeries(p.x, p.y);
    // Touch: first show the tooltip at the point, like a mouse hover.
    if (e.pointerType !== 'mouse' && k >= 0) this.setHoverState({ k, y: p.y }, seriesId);
    this.callbacks.onPress?.({ seriesId, k, start: this.layer ? this.layer.start + k * this.layer.step : 0, pointerType: e.pointerType });
  }

  private onCancel(e: PointerEvent): void {
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.pinch = null;
    this.down = null;
    this.dragging = false;
    delete this.canvas.dataset.dragging;
  }

  private onLeave(e: PointerEvent): void {
    if (this.down || e.pointerType !== 'mouse' || this.hoverLock !== null) return;
    this.setHoverState(null);
    if (this.zoneHoverId) {
      this.zoneHoverId = null;
      this.callbacks.onZoneHover?.(null);
    }
    this.canvas.dataset.pointer = 'false';
  }

  private onHover(p: { x: number; y: number }): void {
    if (this.hoverLock !== null) return;
    const zh = this.interactive() && !this.options.zoneDraw ? this.hitZone(p.x, p.y) : null;
    if ((zh?.zone.id ?? null) !== this.zoneHoverId) {
      this.zoneHoverId = zh?.zone.id ?? null;
      this.callbacks.onZoneHover?.(zh ? { zone: zh.zone, x: zh.x0, y: zh.y0, width: zh.x1 - zh.x0 } : null);
      this.kick();
    }
    if (zh) {
      this.canvas.dataset.pointer = zh.zone.removable ? 'true' : 'false';
      if (this.hover) this.setHoverState(null);
      return;
    }
    const plot = this.plot;
    if (
      this.status !== CHART_STATUS.ready ||
      !this.layer ||
      p.x < plot.left - 4 ||
      p.x > plot.left + plot.width + 4 ||
      p.y > plot.top + plot.height + 6
    ) {
      if (this.hover) this.setHoverState(null);
      this.canvas.dataset.pointer = 'false';
      return;
    }
    const seriesId = this.options.zoneDraw ? null : this.hitSeries(p.x, p.y);
    this.canvas.dataset.pointer = seriesId ? 'true' : 'false';
    this.setHoverState({ k: this.bucketAt(p.x), y: p.y }, seriesId);
  }

  private onKey(e: KeyboardEvent): void {
    if (this.status !== CHART_STATUS.ready || !this.layer) return;
    const plot = this.plot;
    const centre = this.cx ?? plot.left + plot.width / 2;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      this.moveHover(e.key === 'ArrowLeft' ? -1 : 1);
    } else if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      this.viewport.zoomAround(this.tOf(centre), 0.7);
    } else if (e.key === '-' || e.key === '_') {
      e.preventDefault();
      this.viewport.zoomAround(this.tOf(centre), 1.45);
    } else if (e.key === '0' || e.key === 'Home') {
      e.preventDefault();
      this.viewport.setRange(this.viewport.extent);
    } else if (e.key === 'Escape') {
      this.setHoverState(null);
      this.callbacks.onEscape?.();
    } else if (e.key === 'Enter' && this.hover) {
      e.preventDefault();
      const L = this.layer;
      this.callbacks.onPress?.({ seriesId: this.pick, k: this.hover.k, start: L.start + this.hover.k * L.step, pointerType: 'keyboard' });
    }
  }

  /** Draft zone edges snap to hours (when close) or days. */
  private snapRange(a: number, b: number): TimeRange {
    const layerStep = this.layer ? this.layer.step : HOUR;
    const step = this.options.snapStep ?? (layerStep <= HOUR ? Math.max(MINUTE, layerStep) : 24 * HOUR);
    const offset = this.options.format.zone.offset(a);
    const snap = (t: number) => {
      const f = Math.floor((t + offset) / step) * step - offset;
      return t - f > step / 2 ? f + step : f;
    };
    const x = snap(a);
    const y = snap(b);
    return { start: Math.min(x, y), end: Math.max(x, y) };
  }

  /** Re-read theme colours and font (call after a theme switch the observer cannot see). */
  readTheme(): void {
    this.colors = readCanvasColors(this.canvas);
    this.theme = resolveTheme(this.canvas);
    this.font = this.colors.font;
    this.kick();
  }

  resize(): void {
    const dpr = Math.min(2.5, globalThis.devicePixelRatio || 1);
    const W = this.canvas.clientWidth;
    const H = this.canvas.clientHeight;
    if (W <= 0 || H <= 0) return;
    this.dpr = dpr;
    this.W = W;
    this.H = H;
    this.canvas.width = Math.round(W * dpr);
    this.canvas.height = Math.round(H * dpr);
    this.kick();
  }

  get isDragging(): boolean {
    return this.dragging;
  }

  /** Default hourly step for sampling when there is no frame yet. */
  static readonly FALLBACK_STEP = HOUR;
}
