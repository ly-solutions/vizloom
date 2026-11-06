/** Canvas plumbing shared by charts, sparklines and table cells. */

/** Size the backing store for `dpr` and return a context in CSS-px coordinates. */
export function setupCanvas(canvas: HTMLCanvasElement, width: number, height: number, dpr = 1): CanvasRenderingContext2D | null {
  const w = Math.max(1, Math.round(width * dpr));
  const h = Math.max(1, Math.round(height * dpr));
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  let ctx: CanvasRenderingContext2D | null = null;
  try {
    ctx = canvas.getContext('2d');
  } catch {
    ctx = null;
  }
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  return ctx;
}

/** Crisp 1px lines: shift to the pixel centre. */
export const crisp = (v: number) => Math.round(v) + 0.5;

/**
 * Min/max level-of-detail: for each pixel column keeps the first, min, max and last point, so
 * peaks survive at any zoom. Returns indices into the source array.
 */
export function minMaxIndices(values: ArrayLike<number>, from: number, to: number, buckets: number): number[] {
  const n = Math.max(0, Math.min(values.length, to) - Math.max(0, from));
  if (n <= buckets * 4 || buckets <= 0) {
    const all: number[] = [];
    for (let i = Math.max(0, from); i < Math.min(values.length, to); i++) all.push(i);
    return all;
  }
  const out: number[] = [];
  const size = n / buckets;
  for (let b = 0; b < buckets; b++) {
    const s = Math.floor(from + b * size);
    const e = Math.min(to, Math.floor(from + (b + 1) * size));
    let lo = -1;
    let hi = -1;
    for (let i = s; i < e; i++) {
      const v = values[i];
      if (v !== v) continue;
      if (lo < 0 || v < values[lo]) lo = i;
      if (hi < 0 || v > values[hi]) hi = i;
    }
    const picks = [s, lo, hi, e - 1].filter((i) => i >= s && i < e).sort((x, y) => x - y);
    for (const i of picks) if (out[out.length - 1] !== i) out.push(i);
  }
  return out;
}

/**
 * Largest-Triangle-Three-Buckets downsampling for smooth line shapes. Returns indices.
 */
export function lttbIndices(xs: ArrayLike<number>, ys: ArrayLike<number>, threshold: number): number[] {
  const n = Math.min(xs.length, ys.length);
  if (threshold >= n || threshold < 3) return Array.from({ length: n }, (_, i) => i);
  const out = [0];
  const every = (n - 2) / (threshold - 2);
  let a = 0;
  for (let i = 0; i < threshold - 2; i++) {
    const avgStart = Math.floor((i + 1) * every) + 1;
    const avgEnd = Math.min(n, Math.floor((i + 2) * every) + 1);
    let ax = 0;
    let ay = 0;
    const len = Math.max(1, avgEnd - avgStart);
    for (let j = avgStart; j < avgEnd; j++) {
      ax += xs[j];
      ay += ys[j] === ys[j] ? ys[j] : 0;
    }
    ax /= len;
    ay /= len;
    const rs = Math.floor(i * every) + 1;
    const re = Math.floor((i + 1) * every) + 1;
    let best = rs;
    let max = -1;
    for (let j = rs; j < re; j++) {
      const area = Math.abs((xs[a] - ax) * ((ys[j] || 0) - (ys[a] || 0)) - (xs[a] - xs[j]) * (ay - (ys[a] || 0)));
      if (area > max) {
        max = area;
        best = j;
      }
    }
    out.push(best);
    a = best;
  }
  out.push(n - 1);
  return out;
}
