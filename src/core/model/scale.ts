/** "Nice" multipliers of the grid step. */
const NICE_FRACTIONS = [1, 2, 2.5, 5, 10] as const;

/** Step of a "nice" series: 1, 2, 2.5, 5 × 10ⁿ. */
export function niceStep(x: number): number {
  if (!(x > 0)) return 1;
  const p = 10 ** Math.floor(Math.log10(x));
  const f = x / p;
  return (NICE_FRACTIONS.find((n) => f <= n) ?? 10) * p;
}

/** Axis top: a multiple of the step of about `divisions` divisions, not below `v`. */
export function niceCeil(v: number, divisions = 4): number {
  if (!(v > 0)) return 1;
  const step = niceStep(v / divisions);
  return Math.max(step, Math.ceil(v / step) * step);
}

export interface NiceDomain {
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly ticks: readonly number[];
}

/** Rounded domain and ticks covering `[min, max]` with about `count` divisions; 0 included when close. */
export function niceDomain(min: number, max: number, count = 4): NiceDomain {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: 0, max: 1, step: 0.25, ticks: [0, 0.25, 0.5, 0.75, 1] };
  if (min === max) {
    if (min === 0) return niceDomain(0, 1, count);
    return min > 0 ? niceDomain(0, min, count) : niceDomain(min, 0, count);
  }
  const step = niceStep((max - min) / Math.max(1, count));
  const lo = Math.floor(min / step + 1e-9) * step;
  const hi = Math.ceil(max / step - 1e-9) * step;
  const ticks: number[] = [];
  for (let v = lo, i = 0; v <= hi + step * 1e-6 && i < 200; v += step, i++) ticks.push(Math.abs(v) < step * 1e-9 ? 0 : +v.toPrecision(12));
  return { min: lo, max: hi, step, ticks };
}

/** Y ticks from the step up to the top. Zero is drawn separately as the baseline. */
export function yTicks(max: number, step: number, limit = 24): number[] {
  if (!(step > 0) || max / step > limit) return [];
  const out: number[] = [];
  for (let v = step; v <= max * 1.001; v += step) out.push(+v.toPrecision(12));
  return out;
}

export interface LinearScale {
  (v: number): number;
  readonly domain: readonly [number, number];
  readonly range: readonly [number, number];
  invert(px: number): number;
}

/** Linear map `domain → range`; degenerate domains map to the range start. */
export function linearScale(domain: readonly [number, number], range: readonly [number, number]): LinearScale {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const k = d1 === d0 ? 0 : (r1 - r0) / (d1 - d0);
  const scale = ((v: number) => r0 + (v - d0) * k) as LinearScale;
  Object.defineProperties(scale, {
    domain: { value: domain },
    range: { value: range },
    invert: { value: (px: number) => (k === 0 ? d0 : d0 + (px - r0) / k) },
  });
  return scale;
}

export interface BandScale<K> {
  (key: K): number;
  readonly bandwidth: number;
  readonly step: number;
  readonly keys: readonly K[];
  /** Key under a pixel, or null in the outer padding. */
  invert(px: number): K | null;
}

/** Bands for categories, with inner and outer padding as fractions of the step. */
export function bandScale<K>(
  keys: readonly K[],
  range: readonly [number, number],
  options: { paddingInner?: number; paddingOuter?: number } = {},
): BandScale<K> {
  const { paddingInner = 0.2, paddingOuter = 0.1 } = options;
  const [r0, r1] = range;
  const n = keys.length;
  const step = n ? (r1 - r0) / Math.max(1, n - paddingInner + paddingOuter * 2) : 0;
  const bandwidth = step * (1 - paddingInner);
  const start = r0 + step * paddingOuter;
  const index = new Map<K, number>();
  keys.forEach((k, i) => index.set(k, i));
  const scale = ((key: K) => start + (index.get(key) ?? 0) * step) as BandScale<K>;
  Object.defineProperties(scale, {
    bandwidth: { value: bandwidth },
    step: { value: step },
    keys: { value: keys },
    invert: {
      value: (px: number) => {
        if (!step) return null;
        const i = Math.floor((px - start + (step - bandwidth) / 2) / step);
        return i >= 0 && i < n ? keys[i] : null;
      },
    },
  });
  return scale;
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Min and max of finite values; `[NaN, NaN]` when there are none. */
export function extent(values: ArrayLike<number>, from = 0, to = values.length): [number, number] {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = Math.max(0, from); i < Math.min(values.length, to); i++) {
    const v = values[i];
    if (v !== v) continue;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  return lo <= hi ? [lo, hi] : [Number.NaN, Number.NaN];
}
