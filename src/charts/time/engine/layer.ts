import type { Granularity } from '../../../core';
import type { SeriesFrame } from '../../../core';
import { evalCurve, monotoneTangents } from '../model/curve';

/**
 * A frame of one granularity, ready to draw: target values (`target`) and shown values
 * (`shown`) that ease toward them. This way new data, metric changes and live
 * sales flow rather than jump.
 */
export interface DataLayer {
  /** Granularity of the frame, when it has one. Layers are matched by `step`. */
  readonly granularity: Granularity | null;
  /** Order of the series in the arrays below. */
  readonly ids: readonly string[];
  readonly step: number;
  /** Start of the first segment. */
  readonly start: number;
  /** Midpoint of the first segment: curve points sit at midpoints. */
  readonly c0: number;
  readonly length: number;
  readonly target: readonly Float64Array[];
  readonly shown: readonly Float64Array[];
  readonly tangents: readonly Float64Array[];
  tangentsDirty: boolean;
  settled: boolean;
}

/**
 * Shown values of `previous` on the segments of a new frame at a different granularity: the sum of old
 * segments weighted by overlap. A day splits into 24 hours of 1/24 day each; hours merge into a day.
 */
function regroup(previous: DataLayer, s: number, frame: SeriesFrame, k: number): number {
  const shown = previous.shown[s];
  const a = frame.start + k * frame.step;
  const b = a + frame.step;
  const j0 = Math.max(0, Math.floor((a - previous.start) / previous.step));
  const j1 = Math.min(previous.length - 1, Math.floor((b - previous.start - 1) / previous.step));
  let sum = 0;
  for (let j = j0; j <= j1; j++) {
    const v = shown[j];
    if (v !== v) continue;
    const from = Math.max(a, previous.start + j * previous.step);
    const to = Math.min(b, previous.start + (j + 1) * previous.step);
    if (to > from) sum += (v * (to - from)) / previous.step;
  }
  return sum;
}

/**
 * Layer from a frame. A `previous` of the same granularity supplies shown values for matching
 * segments — new segments grow from zero, the rest ease toward the new values.
 * A `previous` of a different granularity — values are rebuilt by time (`regroup`).
 */
export function buildLayer(frame: SeriesFrame, ids: readonly string[], previous?: DataLayer | null): DataLayer {
  const values = frame.values as Readonly<Record<string, ArrayLike<number>>>;
  const target: Float64Array[] = [];
  const shown: Float64Array[] = [];
  const tangents: Float64Array[] = [];
  const reuse = previous && previous.step === frame.step ? previous : null;
  const regroupFrom = previous && !reuse && previous.length > 0 ? previous : null;
  const shift = reuse ? Math.round((frame.start - reuse.start) / frame.step) : 0;
  ids.forEach((id) => {
    const src = values[id];
    const t = new Float64Array(frame.length);
    for (let k = 0; k < frame.length; k++) t[k] = src && k < src.length ? Number(src[k]) : Number.NaN;
    const d = Float64Array.from(t);
    const old = reuse ? reuse.shown[reuse.ids.indexOf(id)] : undefined;
    const from = regroupFrom ? regroupFrom.ids.indexOf(id) : -1;
    if (regroupFrom && from >= 0) {
      for (let k = 0; k < frame.length; k++) if (t[k] === t[k]) d[k] = regroup(regroupFrom, from, frame, k);
    } else if (reuse && old) {
      for (let k = 0; k < frame.length; k++) {
        if (t[k] !== t[k]) continue;
        const j = k + shift;
        const v = j >= 0 && j < old.length ? old[j] : Number.NaN;
        d[k] = v === v ? v : 0;
      }
    }
    target.push(t);
    shown.push(d);
    tangents.push(new Float64Array(frame.length));
  });
  return {
    granularity: frame.granularity ?? null,
    ids: [...ids],
    step: frame.step,
    start: frame.start,
    c0: frame.start + frame.step / 2,
    length: frame.length,
    target,
    shown,
    tangents,
    tangentsDirty: true,
    settled: false,
  };
}

/** Eases shown values toward the targets. Returns whether anything is still moving. */
export function easeLayer(layer: DataLayer, dt: number, tau: number): boolean {
  if (layer.settled) return false;
  const k = tau <= 0 ? 1 : 1 - Math.exp(-dt / tau);
  let moving = false;
  let changed = false;
  for (let s = 0; s < layer.target.length; s++) {
    const target = layer.target[s];
    const shown = layer.shown[s];
    for (let i = 0; i < layer.length; i++) {
      const tv = target[i];
      const sv = shown[i];
      if (tv !== tv) {
        if (sv === sv) {
          shown[i] = Number.NaN;
          changed = true;
        }
        continue;
      }
      if (sv !== sv) {
        shown[i] = tv;
        changed = true;
        continue;
      }
      const diff = tv - sv;
      if (diff === 0) continue;
      changed = true;
      if (Math.abs(diff) <= Math.max(1e-3, Math.abs(tv) * 2e-4)) shown[i] = tv;
      else {
        shown[i] = sv + diff * k;
        moving = true;
      }
    }
  }
  if (changed) layer.tangentsDirty = true;
  if (!moving) layer.settled = true;
  return moving;
}

export function refreshTangents(layer: DataLayer): void {
  if (!layer.tangentsDirty) return;
  layer.tangentsDirty = false;
  for (let s = 0; s < layer.shown.length; s++) monotoneTangents(layer.shown[s], layer.tangents[s] as Float64Array, layer.length);
}

/** Shown value of series `s` at moment `t` (between points — along the curve). */
export function layerValue(layer: DataLayer, s: number, t: number, smooth: number): number {
  const shown = layer.shown[s];
  if (!shown) return Number.NaN;
  return evalCurve(shown, layer.tangents[s], (t - layer.c0) / layer.step, smooth, layer.length);
}

/** Exact value at node `k` (no interpolation). */
export function layerKnot(layer: DataLayer, s: number, k: number): number {
  const shown = layer.shown[s];
  return shown && k >= 0 && k < layer.length ? shown[k] : Number.NaN;
}

/** Number of segments with at least one value. */
export function layerFilled(layer: DataLayer): number {
  let count = 0;
  for (let k = 0; k < layer.length; k++) {
    for (const target of layer.target) {
      if (target[k] === target[k]) {
        count++;
        break;
      }
    }
  }
  return count;
}
