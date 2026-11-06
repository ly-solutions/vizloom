/**
 * Level of detail for dense series: when there are more buckets than pixels, keep only the
 * lowest and the highest bucket of every pixel column (in time order). Peaks and dips survive,
 * the path has at most two points per pixel, so thousands of points draw at 60 fps.
 */
export interface LodGrid {
  /** Centre of bucket 0, ms. */
  readonly c0: number;
  readonly step: number;
  /** Buckets in view, inclusive. */
  readonly kA: number;
  readonly kB: number;
}

/**
 * Times to sample, `start` and `end` included. `total(k)` is the value a bucket is ranked by
 * (the stacked total); NaN buckets are skipped, a column of only NaN keeps one NaN time so that
 * the gap stays visible.
 */
export function lodTimes(grid: LodGrid, start: number, end: number, widthPx: number, total: (k: number) => number): number[] {
  const out: number[] = [start];
  const columns = Math.max(1, Math.floor(widthPx));
  const span = end - start;
  let k = grid.kA;
  for (let col = 0; col < columns && k <= grid.kB; col++) {
    const colEnd = start + (span * (col + 1)) / columns;
    let lo = -1;
    let hi = -1;
    let gap = -1;
    for (; k <= grid.kB; k++) {
      const c = grid.c0 + k * grid.step;
      if (c >= colEnd) break;
      if (c <= start) continue;
      const v = total(k);
      if (v !== v) {
        if (gap < 0) gap = k;
        continue;
      }
      if (lo < 0 || v < total(lo)) lo = k;
      if (hi < 0 || v > total(hi)) hi = k;
    }
    if (lo < 0) {
      if (gap >= 0) out.push(grid.c0 + gap * grid.step);
      continue;
    }
    const a = Math.min(lo, hi);
    const b = Math.max(lo, hi);
    out.push(grid.c0 + a * grid.step);
    if (b !== a) out.push(grid.c0 + b * grid.step);
  }
  out.push(end);
  return out;
}
