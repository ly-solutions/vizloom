import { describe, expect, it } from 'vitest';

import { DAY, HOUR } from '../../../core';
import type { SeriesFrame } from '../../../core';
import { columnGranularityThresholds } from '../granularity';
import { buildLayer } from './layer';

const day = (values: number[]): SeriesFrame => ({ granularity: 'day', start: 0, step: DAY, length: values.length, values: { a: values } });
const hours = (values: number[]): SeriesFrame => ({
  granularity: 'hour',
  start: 0,
  step: HOUR,
  length: values.length,
  values: { a: values },
});

describe('buildLayer: granularity change for bars', () => {
  it('a day splits into hours: each hour starts at 1/24 of the shown day', () => {
    const prev = buildLayer(day([240]), ['a']);
    prev.shown[0].set([240]);
    const next = buildLayer(hours(new Array(24).fill(3)), ['a'], prev);
    expect(Array.from(next.shown[0])).toEqual(new Array(24).fill(10));
    expect(Array.from(next.target[0])).toEqual(new Array(24).fill(3));
  });

  it('hours merge into a day: the day starts at the sum of the shown hours', () => {
    const prev = buildLayer(hours(new Array(48).fill(2)), ['a']);
    prev.shown[0].set(new Array(48).fill(2));
    const next = buildLayer(day([10, 20]), ['a'], prev);
    expect(Array.from(next.shown[0])).toEqual([48, 48]);
  });

  it('gaps in the old layer do not turn into NaN in the new one; a gap in the new layer stays a gap', () => {
    const prev = buildLayer(hours([Number.NaN, 4, ...new Array(22).fill(1)]), ['a']);
    prev.shown[0].set([Number.NaN, 4, ...new Array(22).fill(1)]);
    const next = buildLayer(day([Number.NaN]), ['a'], prev);
    expect(next.shown[0][0]).toBeNaN();
    const filled = buildLayer(day([30]), ['a'], prev);
    expect(filled.shown[0][0]).toBe(26);
  });
});

describe('columnGranularityThresholds', () => {
  it('stack: bar from 10 px on days and from 14 px on hours', () => {
    expect(columnGranularityThresholds('stack', 6)).toEqual({ hour: { enter: 14, leave: 11 }, day: { enter: 10, leave: 8 } });
  });

  it('group: the segment must fit all visible series side by side', () => {
    const six = columnGranularityThresholds('overlay', 6);
    const two = columnGranularityThresholds('overlay', 2);
    expect(six.day?.enter).toBe(34);
    expect(two.day?.enter).toBe(14);
    expect(six.hour!.enter).toBeGreaterThan(six.day!.enter);
  });
});
