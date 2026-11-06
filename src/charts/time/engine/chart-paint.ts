import { DAY, isMidnight, TICK_LEVELS, type TickLevel, tickLevelFor, ticksFor } from '../../../core';
import { type Rgba, resolveColor, rgba, toneRgba } from './colors';
import type { TimeEngine, ZoneHitBox } from './time-engine';

export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const easeOut = (t: number) => 1 - (1 - t) ** 3;
export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
export const approach = (cur: number, target: number, dt: number, tau: number) =>
  tau <= 0 ? target : cur + (target - cur) * (1 - Math.exp(-dt / tau));

/** Caption of a bucket: calendar wording for hour/day/week frames, a plain range otherwise. */
export function bucketLabel(e: TimeEngine, start: number): string {
  const L = e.layer;
  if (!L) return '';
  if (e.options.bucketLabel) return e.options.bucketLabel(start, L.step);
  return L.granularity ? e.fmt.bucket(start, L.granularity, L.step) : e.fmt.range(start, start + L.step);
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Skeleton wave: a recognizable chart silhouette while there is no data. */
export function skeletonWave(x: number, w: number): number {
  const u = x / w;
  return (
    0.3 + 0.2 * Math.sin(u * 7.1 + 0.6) * Math.exp(-0.4 * u) + 0.12 * Math.sin(u * 17.3 + 1.7) + 0.22 * Math.exp(-(((u - 0.78) * 5) ** 2))
  );
}

export function dot(
  ctx: CanvasRenderingContext2D,
  surface: Rgba,
  x: number,
  y: number,
  color: Rgba,
  r: number,
  ring: number,
  alpha: number,
): void {
  ctx.beginPath();
  ctx.arc(x, y, r + ring, 0, Math.PI * 2);
  ctx.fillStyle = rgba(surface, alpha);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = rgba(color, alpha);
  ctx.fill();
}

/**
 * How to draw data over the shared frame (zones, grid, axes, "now", gaps, skeleton).
 * Specific to waves and bars; state between frame steps lives in the painter's closure.
 */
export interface ChartDataPainter {
  /** Prepares the frame and returns the maximum visible value — the top of the Y axis. */
  prepare(e: TimeEngine): number;
  /** Under the data, over the grid: the hovered segment's band. */
  under?(e: TimeEngine, dt: number): boolean;
  /** The data itself; `dim` is dimming while updating and for the skeleton. */
  data(e: TimeEngine, dt: number, now: number, dim: number): boolean;
  /** Over the data, under the axis labels: the hover crosshair. */
  over?(e: TimeEngine, dt: number): boolean;
}

/** Draws the canvas for a frame: the shared frame and the painter's data. Returns whether another frame is needed. */
export function paintChart(e: TimeEngine, dt: number, now: number, painter: ChartDataPainter): boolean {
  const { ctx } = e;
  if (e.W <= 0 || e.H <= 0) return false;
  ctx.setTransform(e.dpr, 0, 0, e.dpr, 0, 0);
  ctx.clearRect(0, 0, e.W, e.H);
  let busy = false;

  const skelTarget = e.status === 'loading' || e.status === 'error' ? 1 : 0;
  e.skel = Math.abs(e.skel - skelTarget) < 0.01 ? skelTarget : approach(e.skel, skelTarget, dt, 180 * e.options.slow);
  if (e.skel !== skelTarget) busy = true;

  const L = e.layer;
  const ready = e.status === 'ready' && !!L && L.length > 0;
  busy = e.fitY(ready ? painter.prepare(e) : 0, dt) || busy;
  if (e.options.axis !== 'right') busy = e.fitAxis(axisLabelWidth(e), dt) || busy;

  const showData = e.status === 'ready' || e.status === 'empty';
  const zones = showData && e.options.zones;
  if (zones) paintZones(e, 'fill');
  e.zoneHits = [];
  if (showData) {
    paintFuture(e);
    if (ready) paintGaps(e);
    if (e.effectWindow) paintEffect(e);
  }
  if (e.status !== 'loading' && e.status !== 'error') paintGrid(e);
  if (showData) {
    paintMarkerLine(e);
    paintNow(e);
  }
  if (ready) {
    if (e.hover && painter.under) busy = painter.under(e, dt) || busy;
    busy = painter.data(e, dt, now, lerp(1, 0.42, e.refA) * (1 - e.skel)) || busy;
    if (e.hover && painter.over) busy = painter.over(e, dt) || busy;
  }
  if (ready) paintGuides(e);
  if (zones) paintZones(e, 'labels');
  if (e.status !== 'loading' && e.status !== 'error') {
    paintYLabels(e);
    busy = paintXLabels(e, dt) || busy;
  }
  if (e.draft) paintDraft(e);
  if (e.skel > 0.01) {
    paintSkeleton(e, now, e.skel);
    busy = true;
  }
  return busy;
}

/** The crosshair glides to segment `k`: returns the current X and whether it is still moving. */
export function glideTo(e: TimeEngine, tx: number, dt: number): { x: number; busy: boolean } {
  const h = e.hover;
  if (e.cx == null || h?.snap) {
    e.cx = tx;
    if (h) h.snap = false;
  } else e.cx = approach(e.cx, tx, dt, 55 * e.options.slow);
  const busy = Math.abs(e.cx - tx) > 0.3;
  if (!busy) e.cx = tx;
  return { x: e.cx, busy };
}

function yLabel(e: TimeEngine, v: number): string {
  if (e.pctMix > 0.5) return `${e.fmt.number(v)}%`;
  return e.options.formatY ? e.options.formatY(v) : e.fmt.compact(v);
}

function axisLabelWidth(e: TimeEngine): number {
  const ctx = e.ctx;
  ctx.font = `500 11px ${e.font}`;
  let w = 0;
  for (const set of e.ysets) {
    if (set.a <= 0.02 || e.ymax / set.step > 24) continue;
    for (let v = set.step, i = 0; v <= Math.max(e.ymax, set.step) * 1.001 && i < 12; v += set.step, i++)
      w = Math.max(w, ctx.measureText(yLabel(e, v)).width);
  }
  return w;
}

/** Zone fill: tinted zones are more visible, neutral ones alternate so adjacent periods stay readable. */
export function zoneFill(toned: boolean, index: number, strength = 1): number {
  if (toned) return 0.07 * strength;
  return index % 2 ? 0.028 * strength : 0;
}

/**
 * Zones in two layers: tint under the data, labels on top (otherwise bars reaching the top, shares
 * and the stack cover them). `part` selects which layer to draw.
 */
function paintZones(e: TimeEngine, part: 'fill' | 'labels'): void {
  const { ctx, colors: C } = e;
  const p = e.plot;
  const right = p.left + p.width;
  const bottom = p.top + p.height;
  const hits: ZoneHitBox[] = [];
  ctx.save();
  ctx.font = `500 12px ${e.font}`;
  e.zones.forEach((z, i) => {
    const a = e.zoneAlpha.get(z.id) ?? 1;
    let x0 = e.xOf(z.from);
    let x1 = e.xOf(z.to);
    if (x1 < p.left || x0 > right) return;
    x0 = Math.max(p.left, x0);
    x1 = Math.min(right, x1);
    if (x1 - x0 < 1) return;
    const tone = z.tone ?? 'neutral';
    const toned = tone !== 'neutral';
    const color = toneRgba(tone, C);
    const hovered = e.zoneHoverId === z.id;
    const base = zoneFill(toned, i) * (e.options.zoneFocus ? 3 : 1);
    ctx.fillStyle = rgba(color, (base + (hovered ? 0.025 : 0)) * a);
    if (part === 'fill') {
      ctx.fillRect(x0, p.top, x1 - x0, bottom - p.top);
      return;
    }
    const room = x1 - x0 - 16;
    if (room <= 36) return;
    let label = z.label;
    let note = z.note ? ` · ${z.note}` : '';
    const close = z.removable ? 18 : 0;
    let wl = ctx.measureText(label).width;
    let wn = ctx.measureText(note).width;
    if (wl + wn + close > room) {
      note = '';
      wn = 0;
    }
    while (label.length > 2 && wl + close > room) {
      label = `${label.slice(0, -2)}…`;
      wl = ctx.measureText(label).width;
    }
    const ly = p.top + 17;
    ctx.fillStyle = rgba(e.options.zoneFocus ? C.text : C.textSecondary, Math.min(1, a * (hovered ? 1.3 : 1)));
    ctx.fillText(label, x0 + 8, ly);
    if (note) {
      ctx.fillStyle = rgba(C.textMuted, a);
      ctx.fillText(note, x0 + 8 + wl, ly);
    }
    let hitRight = x0 + 8 + wl + wn + 6;
    let closeBox: { x0: number; x1: number } | null = null;
    if (z.removable) {
      const cx = x0 + 8 + wl + wn + 10;
      const cy = ly - 4;
      ctx.strokeStyle = rgba(C.textSecondary, a * (hovered ? 1 : 0.55));
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(cx - 3.5, cy - 3.5);
      ctx.lineTo(cx + 3.5, cy + 3.5);
      ctx.moveTo(cx + 3.5, cy - 3.5);
      ctx.lineTo(cx - 3.5, cy + 3.5);
      ctx.stroke();
      closeBox = { x0: cx - 8, x1: cx + 8 };
      hitRight = cx + 8;
    }
    hits.push({ zone: z, x0: x0 + 2, x1: hitRight, y0: p.top, y1: p.top + 26, close: closeBox });
  });
  ctx.restore();
  e.zoneHits = hits;
}

/** The future after "now" — barely darker. */
function paintFuture(e: TimeEngine): void {
  if (!e.now) return;
  const p = e.plot;
  const x0 = Math.max(p.left, e.xOf(e.now));
  const x1 = p.left + p.width;
  if (x1 - x0 < 2) return;
  e.ctx.fillStyle = rgba(e.colors.text, 0.022);
  e.ctx.fillRect(x0, p.top, x1 - x0, p.height);
}

function paintGaps(e: TimeEngine): void {
  const L = e.layer;
  if (!L || !L.target.length) return;
  const { ctx, colors: C } = e;
  const p = e.plot;
  const right = p.left + p.width;
  const empty = (k: number) => L.target.every((v) => v[k] !== v[k]);
  let k = 0;
  while (k < L.length) {
    if (!empty(k)) {
      k++;
      continue;
    }
    const a = k;
    while (k < L.length && empty(k)) k++;
    const x0 = Math.max(p.left, e.xOf(L.c0 + (a - 1) * L.step));
    const x1 = Math.min(right, e.xOf(L.c0 + k * L.step));
    if (x1 - x0 <= 2) continue;
    ctx.fillStyle = rgba(C.text, 0.04);
    ctx.fillRect(x0, p.top, x1 - x0, p.height);
    if (x1 - x0 > 70 && e.options.labels.gap) {
      ctx.font = `500 12px ${e.font}`;
      ctx.fillStyle = rgba(C.textSecondary, 1);
      ctx.textAlign = 'center';
      ctx.fillText(e.options.labels.gap, (x0 + x1) / 2, p.top + p.height - 12);
      ctx.textAlign = 'left';
    }
  }
}

/** "Before" and "after" windows of a change: what the effect was compared against. */
function paintEffect(e: TimeEngine): void {
  const fx = e.effectWindow;
  if (!fx) return;
  const { ctx, colors: C } = e;
  const p = e.plot;
  const right = p.left + p.width;
  const xm = clamp(e.xOf(fx.t), p.left, right);
  const xa = Math.max(p.left, e.xOf(fx.t - fx.window));
  const xb = Math.min(right, e.xOf(fx.afterEnd));
  ctx.font = `500 11px ${e.font}`;
  if (xm - xa > 1) {
    ctx.fillStyle = rgba(C.text, 0.045);
    ctx.fillRect(xa, p.top, xm - xa, p.height);
    if (xm - xa > 70 && fx.beforeLabel) {
      ctx.fillStyle = rgba(C.textMuted, 1);
      ctx.fillText(fx.beforeLabel, xa + 8, p.top + p.height - 10);
    }
  }
  if (xb - xm > 1) {
    ctx.fillStyle = rgba(fx.color ? resolveColor(fx.color) : C.text, 0.09);
    ctx.fillRect(xm, p.top, xb - xm, p.height);
    if (xb - xm > 70 && fx.afterLabel) {
      ctx.fillStyle = rgba(C.textSecondary, 1);
      ctx.fillText(fx.afterLabel, xm + 8, p.top + p.height - 10);
    }
  }
}

function paintGrid(e: TimeEngine): void {
  const { ctx, colors: C } = e;
  const p = e.plot;
  if (e.options.grid) {
    for (const set of e.ysets) {
      if (set.a <= 0 || e.ymax / set.step > 24) continue;
      ctx.fillStyle = rgba(C.grid, set.a);
      for (let v = set.step; v <= e.ymax * 1.001; v += set.step) {
        const y = Math.round(e.yOf(v));
        if (y < p.top - 1) break;
        ctx.fillRect(p.left, y - 0.5, p.width, 1);
      }
    }
  }
  ctx.fillStyle = rgba(C.text, 0.14);
  ctx.fillRect(p.left, Math.round(p.top + p.height) - 0.5, p.width, 1);
}

function paintYLabels(e: TimeEngine): void {
  const { ctx, colors: C } = e;
  const p = e.plot;
  const bottom = p.top + p.height;
  const inside = e.options.axis === 'right';
  // Inside axis (phones): labels sit right-aligned just above their grid line.
  const x = inside ? p.left + p.width : p.left - 10;
  const dy = inside ? -6 : 0;
  ctx.font = `500 11px ${e.font}`;
  ctx.textAlign = 'right';
  ctx.textBaseline = inside ? 'alphabetic' : 'middle';
  if (!inside) {
    ctx.fillStyle = rgba(C.textMuted, 1);
    ctx.fillText('0', x, bottom);
  }
  for (const set of e.ysets) {
    if (set.a <= 0.02 || e.ymax / set.step > 24) continue;
    ctx.fillStyle = rgba(C.textMuted, set.a);
    for (let v = set.step; v <= e.ymax * 1.001; v += set.step) {
      const y = e.yOf(v);
      if (y < p.top - 4) break;
      if (inside) {
        // A soft halo keeps the label readable over the data.
        ctx.strokeStyle = rgba(C.surface, 0.85 * set.a);
        ctx.lineWidth = 3;
        ctx.strokeText(yLabel(e, v), x, y + dy);
      }
      ctx.fillText(yLabel(e, v), x, y + dy);
    }
  }
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

/** Horizontal dashed guides with a caption: average, target. */
function paintGuides(e: TimeEngine): void {
  const guides = e.options.guides;
  if (!guides.length) return;
  const { ctx, colors: C } = e;
  const p = e.plot;
  ctx.save();
  ctx.font = `500 11px ${e.font}`;
  ctx.setLineDash([4, 4]);
  for (const g of guides) {
    if (!(g.value >= 0) || g.value > e.ymax) continue;
    const y = Math.round(e.yOf(g.value)) - 0.5;
    const color = g.color ? resolveColor(g.color) : C.textSecondary;
    ctx.strokeStyle = rgba(color, 0.75);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p.left, y);
    ctx.lineTo(p.left + p.width, y);
    ctx.stroke();
    if (g.label) {
      ctx.fillStyle = rgba(color, 1);
      ctx.textAlign = 'right';
      ctx.fillText(g.label, p.left + p.width - 4, y - 5);
      ctx.textAlign = 'left';
    }
  }
  ctx.restore();
}

/** X-axis labels: the tick level follows the width, neighbouring levels cross-fade. */
function paintXLabels(e: TimeEngine, dt: number): boolean {
  const { ctx, colors: C } = e;
  const p = e.plot;
  const view = e.viewport.state.current;
  const span = view.end - view.start;
  const right = p.left + p.width;
  ctx.font = `500 11px ${e.font}`;
  ctx.textAlign = 'center';
  const custom = e.options.xTicks;
  if (custom) {
    // Custom axis (minutes, "days before", numbers): no cross-fade, the caller picks the ticks.
    for (const tick of custom(view, p.width)) {
      const x = e.xOf(tick.t);
      const edge = clamp(Math.min(x - p.left + 18, right + 18 - x) / 20, 0, 1);
      if (edge <= 0) continue;
      ctx.fillStyle = rgba(tick.major ? C.textSecondary : C.textMuted, edge);
      const half = ctx.measureText(tick.label).width / 2;
      ctx.fillText(tick.label, clamp(x, p.left - 8 + half, e.W - 2 - half), p.top + p.height + 17);
    }
    ctx.textAlign = 'left';
    return false;
  }
  const zone = e.fmt.zone;
  const chosen: TickLevel = tickLevelFor(span, p.width);
  let busy = false;
  for (const level of TICK_LEVELS) {
    const target = level === chosen ? 1 : 0;
    const a = e.xalpha.get(level) ?? target;
    const next = Math.abs(a - target) < 0.01 ? target : approach(a, target, dt, 150 * e.options.slow);
    if (next !== target) busy = true;
    e.xalpha.set(level, next);
  }
  const marks = new Map<number, number>();
  const range = { start: view.start - span * 0.05, end: view.end + span * 0.05 };
  for (const level of TICK_LEVELS) {
    const a = e.xalpha.get(level) ?? 0;
    if (a <= 0.01) continue;
    for (const t of ticksFor(level, range, zone)) marks.set(t, Math.max(marks.get(t) ?? 0, a));
  }
  const fine = typeof chosen === 'number' && chosen < DAY;
  for (const [t, a] of marks) {
    const x = e.xOf(t);
    const edge = clamp(Math.min(x - p.left + 18, right + 18 - x) / 20, 0, 1);
    if (edge <= 0) continue;
    const midnight = isMidnight(t, zone);
    ctx.fillStyle = rgba(midnight && fine ? C.textSecondary : C.textMuted, a * edge);
    let label = e.fmt.tick(t, chosen);
    if (fine) label = midnight ? e.fmt.day(t) : e.fmt.time(t);
    const half = ctx.measureText(label).width / 2;
    ctx.fillText(label, clamp(x, p.left - 8 + half, e.W - 2 - half), p.top + p.height + 17);
  }
  ctx.textAlign = 'left';
  return busy;
}

/** Vertical line at the focused marker. */
function paintMarkerLine(e: TimeEngine): void {
  if (!e.markerFocus) return;
  const m = e.markers.find((item) => item.id === e.markerFocus);
  if (!m) return;
  const p = e.plot;
  const x = e.xOf(m.t);
  if (x < p.left - 1 || x > p.left + p.width + 1) return;
  e.ctx.fillStyle = rgba(e.colors.text, 0.35);
  e.ctx.fillRect(Math.round(x) - 0.5, p.top - 8, 1, p.height + 8);
}

function paintNow(e: TimeEngine): void {
  if (!e.now) return;
  const { ctx, colors: C } = e;
  const p = e.plot;
  const x = e.xOf(e.now);
  const right = p.left + p.width;
  if (x < p.left || x > right) return;
  // The vertical does not run above the zone label row — it doesn't strike through "Last tickets · 3 200 ₽".
  const top = e.zoneHits.length ? p.top + 24 : p.top;
  ctx.fillStyle = rgba(C.text, 0.32);
  ctx.fillRect(Math.round(x) - 0.5, top, 1, p.top + p.height - top);
  const label = e.options.labels.now;
  if (!label) return;
  ctx.font = `600 10px ${e.font}`;
  ctx.fillStyle = rgba(C.textSecondary, 1);
  const atRight = x > right - 40;
  ctx.textAlign = atRight ? 'right' : 'left';
  ctx.fillText(label, atRight ? x - 5 : x + 5, p.top + 34);
  ctx.textAlign = 'left';
}

/** Draft of a new zone in markup mode. */
function paintDraft(e: TimeEngine): void {
  const d = e.draft;
  if (!d) return;
  const { ctx, colors: C } = e;
  const p = e.plot;
  const right = p.left + p.width;
  const x0 = clamp(e.xOf(d.start), p.left, right);
  const x1 = clamp(e.xOf(d.end), p.left, right);
  const col = toneRgba(e.options.zoneDrawTone, C);
  ctx.fillStyle = rgba(col, 0.14);
  ctx.fillRect(x0, p.top, x1 - x0, p.height);
  ctx.fillStyle = rgba(col, 0.9);
  ctx.fillRect(Math.round(x0) - 0.5, p.top, 1, p.height);
  ctx.fillRect(Math.round(x1) - 0.5, p.top, 1, p.height);
  ctx.fillRect(x0, p.top, x1 - x0, 1.5);
  if (d.end <= d.start) return;
  const text = e.fmt.range(d.start, d.end);
  ctx.font = `600 12px ${e.font}`;
  const w = ctx.measureText(text).width;
  const cx = clamp((x0 + x1) / 2, p.left + w / 2 + 10, right - w / 2 - 10);
  ctx.fillStyle = rgba(C.surfaceRaised, 0.96);
  roundRect(ctx, cx - w / 2 - 9, p.top + 8, w + 18, 24, 7);
  ctx.fill();
  ctx.fillStyle = rgba(C.text, 1);
  ctx.textAlign = 'center';
  ctx.fillText(text, cx, p.top + 24);
  ctx.textAlign = 'left';
}

/** Half-width of the skeleton shimmer, px. */
const SHIMMER_HALF = 160;

function paintSkeleton(e: TimeEngine, now: number, a: number): void {
  const { ctx, colors: C } = e;
  const p = e.plot;
  const right = p.left + p.width;
  const bottom = p.top + p.height;
  ctx.save();
  ctx.globalAlpha = a;
  for (let i = 0; i <= 4; i++) {
    const y = bottom - (p.height * i) / 4.4;
    ctx.fillStyle = rgba(C.grid, 1);
    ctx.fillRect(p.left, Math.round(y) - 0.5, p.width, 1);
    ctx.fillStyle = rgba(C.input, 1);
    roundRect(ctx, p.left - 34, y - 4, 24, 8, 4);
    ctx.fill();
  }
  for (let i = 0; i < 7; i++) {
    ctx.fillStyle = rgba(C.input, 1);
    roundRect(ctx, p.left + (p.width * (i + 0.5)) / 7 - 18, bottom + 10, 36, 8, 4);
    ctx.fill();
  }
  const period = 1800 * Math.max(e.options.slow, 0.25);
  const shimmer = (now % period) / period;
  for (const [k, alpha] of [
    [0, 0.9],
    [1, 0.55],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(p.left, bottom);
    for (let x = p.left; x <= right + 4; x += 4) {
      const xx = Math.min(x, right);
      const v = k === 0 ? skeletonWave(xx - p.left, p.width) : 0.55 * skeletonWave(right - xx, p.width);
      ctx.lineTo(xx, bottom - v * p.height);
    }
    ctx.lineTo(right, bottom);
    ctx.closePath();
    ctx.fillStyle = rgba(C.input, alpha);
    ctx.fill();
    ctx.save();
    ctx.clip();
    // The shimmer fully leaves the edges before restarting and moves with smooth easing in and out:
    // otherwise on a narrow chart it would visibly jump back.
    const eased = 0.5 - 0.5 * Math.cos(Math.PI * shimmer);
    const sx = p.left - SHIMMER_HALF + eased * (p.width + SHIMMER_HALF * 2);
    const sg = ctx.createLinearGradient(sx - SHIMMER_HALF, 0, sx + SHIMMER_HALF, 0);
    sg.addColorStop(0, rgba(C.text, 0));
    sg.addColorStop(0.5, rgba(C.text, e.theme === 'dark' ? 0.06 : 0.08));
    sg.addColorStop(1, rgba(C.text, 0));
    ctx.fillStyle = sg;
    ctx.fillRect(p.left, p.top, p.width, p.height);
    ctx.restore();
  }
  ctx.restore();
}
