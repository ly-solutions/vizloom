import type { TimeEngine } from './time-engine';

/** Point in canvas coordinates, CSS pixels. */
export interface ChartPoint {
  readonly x: number;
  readonly y: number;
  /**
   * Width of what the tooltip points at (a bar), centered on `x`. The bubble sits beside
   * it and does not cover the hovered bar. Absent — a point.
   */
  readonly width?: number;
}

/**
 * How a chart draws data: waves, bars. Everything else — window, layers, stack, axes, zones,
 * markers, input and tooltips — is shared by all time charts and lives in `TimeEngine`.
 */
export interface ChartRenderer {
  readonly kind: 'wave' | 'bar';
  /**
   * Granularity change: `blend` — curves flow over time from the old to the new,
   * `aggregate` — bars split into parts (day → hours) or merge (hours → day).
   */
  readonly morph: 'blend' | 'aggregate';
  /** Draws a whole frame. Returns whether another frame is needed. */
  paint(engine: TimeEngine, dt: number, now: number): boolean;
  /** Series under a canvas point. */
  hit(engine: TimeEngine, x: number, y: number): string | null;
  /**
   * Where the tooltip of segment `k` points: at series `seriesId` or at the top of the segment.
   * `follow` — follow the smoothly moving crosshair rather than sit exactly on the segment.
   */
  anchor(engine: TimeEngine, k: number, seriesId: string | null, follow: boolean): ChartPoint | null;
}
