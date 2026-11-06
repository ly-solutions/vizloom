import type { Granularity, GranularityThresholds, StackMode } from '../../core';

/**
 * Granularity thresholds of time columns. A column narrower than ~4 px does not read, and in a
 * group every visible series stands side by side in a bucket — so the more series, the later the
 * chart switches to days and hours.
 */
export function columnGranularityThresholds(mode: StackMode, visibleSeries: number): Partial<Record<Granularity, GranularityThresholds>> {
  const side = mode === 'overlay' ? Math.max(1, visibleSeries) : 1;
  const enter = Math.max(10, side * 5 + 4);
  return { hour: { enter: enter + 4, leave: enter + 1 }, day: { enter, leave: enter - 2 } };
}
