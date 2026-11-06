const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Top and bottom of each series at a single point in time.
 * `stack` (0…1) smoothly turns overlay into stack, `percent` (0…1) turns stack into shares of the total:
 * so view changes animate without separate logic for each mode.
 * Returns the sum of visible values.
 */
export function stackAt(values: ArrayLike<number>, stack: number, percent: number, tops: Float64Array, bottoms: Float64Array): number {
  const n = values.length;
  let total = 0;
  for (let i = 0; i < n; i++) {
    const v = values[i];
    if (v === v) total += v;
  }
  let cum = 0;
  for (let i = 0; i < n; i++) {
    const v = values[i];
    if (v !== v) {
      tops[i] = Number.NaN;
      bottoms[i] = Number.NaN;
      continue;
    }
    let bottom = cum * stack;
    let top = lerp(v, cum + v, stack);
    if (percent > 0) {
      const pb = total > 0 ? (cum / total) * 100 : 0;
      const pt = total > 0 ? ((cum + v) / total) * 100 : 0;
      bottom = lerp(bottom, pb, percent);
      top = lerp(top, pt, percent);
    }
    cum += v;
    tops[i] = top;
    bottoms[i] = bottom;
  }
  return total;
}
