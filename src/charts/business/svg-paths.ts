import { monotoneTangents } from '../time/model/curve';

/** Polyline through the points; `NaN` breaks the line. */
export function linePath(xs: readonly number[], ys: readonly number[]): string {
  let d = '';
  let pen = false;
  for (let i = 0; i < xs.length; i++) {
    const y = ys[i];
    if (y === undefined || y !== y) {
      pen = false;
      continue;
    }
    d += `${pen ? 'L' : 'M'} ${xs[i].toFixed(1)} ${y.toFixed(1)} `;
    pen = true;
  }
  return d.trim();
}

/** Band between two polylines. */
export function bandPath(xs: readonly number[], low: readonly number[], high: readonly number[]): string {
  if (xs.length === 0) return '';
  const top = xs.map((x, i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${high[i].toFixed(1)}`).join(' ');
  let bottom = '';
  for (let i = xs.length - 1; i >= 0; i--) bottom += ` L ${xs[i].toFixed(1)} ${low[i].toFixed(1)}`;
  return `${top}${bottom} Z`;
}

/** Smooth curve through the points (monotone tangents, like the waves): no invented peaks between days. */
export function smoothPath(xs: readonly number[], ys: readonly number[], move = true): string {
  const n = Math.min(xs.length, ys.length);
  if (n === 0) return '';
  const m = monotoneTangents(ys, new Float64Array(n), n);
  let d = `${move ? 'M' : 'L'} ${xs[0].toFixed(1)} ${ys[0].toFixed(1)}`;
  for (let i = 0; i + 1 < n; i++) {
    const h = (xs[i + 1] - xs[i]) / 3;
    d += ` C ${(xs[i] + h).toFixed(1)} ${(ys[i] + m[i] / 3).toFixed(1)} ${(xs[i + 1] - h).toFixed(1)} ${(ys[i + 1] - m[i + 1] / 3).toFixed(1)} ${xs[i + 1].toFixed(1)} ${ys[i + 1].toFixed(1)}`;
  }
  return d;
}

/** Smooth band between two curves. */
export function smoothBand(xs: readonly number[], low: readonly number[], high: readonly number[]): string {
  if (xs.length === 0) return '';
  return `${smoothPath(xs, high)} ${smoothPath([...xs].reverse(), [...low].reverse(), false)} Z`;
}

/** Day ticks that keep at least `minGap` px between labels. */
export function dayTicks(from: number, to: number, plotWidth: number, minGap = 72): number[] {
  const span = Math.max(1, to - from);
  const every = Math.max(1, Math.ceil(span / Math.max(2, Math.floor(plotWidth / minGap))));
  const out: number[] = [];
  for (let d = Math.ceil(from / every) * every; d <= to && out.length < 100; d += every) out.push(d);
  return out;
}
