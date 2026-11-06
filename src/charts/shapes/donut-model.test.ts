import { describe, expect, it } from 'vitest';

import { donutRows, GAP_DEG, layoutArcs, MIN_DEG, OTHER_KEY, sliceSweeps, slicePath, GEOMETRY } from './donut-model';

const d = (key: string, value: number) => ({ key, label: key.toUpperCase(), value });

describe('donutRows', () => {
  it('keeps source order and colours by default', () => {
    const rows = donutRows([d('a', 1), d('b', 5)], { otherLabel: 'Other' });
    expect(rows.map((r) => r.key)).toEqual(['a', 'b']);
    expect(rows.map((r) => r.slot)).toEqual([0, 1]);
  });

  it('sorts without changing the colour of an item', () => {
    const rows = donutRows([d('a', 1), d('b', 5)], { sort: 'desc', otherLabel: 'Other' });
    expect(rows.map((r) => r.key)).toEqual(['b', 'a']);
    expect(rows.map((r) => r.slot)).toEqual([1, 0]);
  });

  it('collapses the tail into one "other" row by value', () => {
    const data = [d('a', 1), d('b', 50), d('c', 30), d('d', 2), d('e', 3)];
    const rows = donutRows(data, { visibleRows: 2, otherLabel: 'Other' });
    expect(rows.map((r) => r.key)).toEqual(['b', 'c', OTHER_KEY]);
    expect(rows[2]).toMatchObject({ value: 6, merged: 3, slot: 'other', label: 'Other' });
  });

  it('does not make an "other" row out of a single item', () => {
    const rows = donutRows([d('a', 3), d('b', 2), d('c', 1)], { visibleRows: 2, otherLabel: 'Other' });
    expect(rows.map((r) => r.key)).toEqual(['a', 'b', 'c']);
  });

  it('treats negative and NaN values as zero', () => {
    const rows = donutRows([d('a', -4), d('b', Number.NaN), d('c', 2)], { otherLabel: 'Other' });
    expect(rows.map((r) => r.value)).toEqual([0, 0, 2]);
  });
});

describe('sliceSweeps', () => {
  it('reserves a gap per slice and fills the circle', () => {
    const s = sliceSweeps([0.5, 0.5]);
    expect(s[0]).toBeCloseTo((360 - 2 * GAP_DEG) / 2);
    expect(s.reduce((a, b) => a + b, 0) + 2 * GAP_DEG).toBeCloseTo(360);
  });

  it('lifts a thin slice to the minimum and takes it from the big ones', () => {
    const s = sliceSweeps([0.001, 0.999]);
    expect(s[0]).toBe(MIN_DEG);
    expect(s.reduce((a, b) => a + b, 0) + 2 * GAP_DEG).toBeCloseTo(360);
  });

  it('a single slice has no gap and a zero slice has no arc', () => {
    expect(sliceSweeps([1])).toEqual([360]);
    expect(sliceSweeps([0, 1])[0]).toBe(0);
  });

  it('semi spans 180 degrees', () => {
    const s = sliceSweeps([0.25, 0.75], 180);
    expect(s.reduce((a, b) => a + b, 0) + 2 * GAP_DEG).toBeCloseTo(180);
  });
});

describe('layoutArcs / slicePath', () => {
  it('places slices one after another starting at the variant start', () => {
    const arcs = layoutArcs([90, 0, 90], 'semi');
    expect(arcs).toHaveLength(2);
    expect(arcs[0].a0).toBeCloseTo(-90 + GAP_DEG / 2);
    expect(arcs[1].a0).toBeCloseTo(arcs[0].a1 + GAP_DEG);
  });

  it('draws valid closed paths for ring, pie and a full circle', () => {
    expect(slicePath(GEOMETRY.ring, 0, 90)).toMatch(/^M .* Z$/);
    expect(slicePath(GEOMETRY.pie, 0, 200)).toContain('L');
    expect(slicePath(GEOMETRY.ring, 0, 360)).toContain('M');
    expect(slicePath(GEOMETRY.ring, 0, 90)).not.toContain('NaN');
  });
});
