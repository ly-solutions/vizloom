/**
 * Smooth curve through points: Fritsch–Carlson monotone tangents. Between two points
 * the curve stays within their values — a wave never dips below zero or draws an invented peak.
 * A gap (`NaN`) breaks the curve.
 */

/** Tangents in units of "value difference per segment"; written to `out`. */
export function monotoneTangents(y: ArrayLike<number>, out: Float64Array, length = y.length): Float64Array {
  for (let i = 0; i < length; i++) {
    const v = y[i];
    if (v !== v) {
      out[i] = 0;
      continue;
    }
    const dl = i > 0 ? v - y[i - 1] : Number.NaN;
    const dr = i < length - 1 ? y[i + 1] - v : Number.NaN;
    if (dl !== dl && dr !== dr) out[i] = 0;
    else if (dl !== dl) out[i] = dr * 0.5;
    else if (dr !== dr) out[i] = dl * 0.5;
    else out[i] = dl * dr <= 0 ? 0 : (2 * dl * dr) / (dl + dr);
  }
  return out;
}

/**
 * Value at fractional position `u` (0 — first point, `length − 1` — last).
 * `smooth` from 0 (polyline) to 1 (monotone curve) blends the two; below 0 — a step.
 */
export function evalCurve(y: ArrayLike<number>, tangents: ArrayLike<number>, u: number, smooth: number, length = y.length): number {
  if (length < 2 || !(u >= 0 && u <= length - 1)) return Number.NaN;
  const k = Math.min(Math.floor(u), length - 2);
  const f = u - k;
  const y0 = y[k];
  const y1 = y[k + 1];
  if (y0 !== y0 || y1 !== y1) return Number.NaN;
  // Negative smooth — a step: the value changes halfway between bucket centres.
  if (smooth < 0) return f < 0.5 ? y0 : y1;
  const lin = y0 + (y1 - y0) * f;
  if (smooth <= 0) return lin;
  const f2 = f * f;
  const f3 = f2 * f;
  const h = (2 * f3 - 3 * f2 + 1) * y0 + (f3 - 2 * f2 + f) * tangents[k] + (-2 * f3 + 3 * f2) * y1 + (f3 - f2) * tangents[k + 1];
  return lin + (h - lin) * smooth;
}
