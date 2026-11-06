import { describe, expect, it } from 'vitest';

import { lodTimes } from './lod';

describe('lodTimes', () => {
  const values = Array.from({ length: 1000 }, (_, k) => (k === 500 ? 999 : k % 7));
  const grid = { c0: 0.5, step: 1, kA: 0, kB: 999 };

  it('keeps at most two points per pixel plus the ends', () => {
    const ts = lodTimes(grid, 0, 1000, 100, (k) => values[k]);
    expect(ts.length).toBeLessThanOrEqual(2 * 100 + 2);
    expect(ts[0]).toBe(0);
    expect(ts.at(-1)).toBe(1000);
  });

  it('keeps the peak and stays in time order', () => {
    const ts = lodTimes(grid, 0, 1000, 100, (k) => values[k]);
    expect(ts).toContain(500.5);
    for (let i = 1; i < ts.length; i++) expect(ts[i]).toBeGreaterThan(ts[i - 1]);
  });

  it('keeps a gap visible', () => {
    const ts = lodTimes(grid, 0, 1000, 100, (k) => (k >= 300 && k < 320 ? Number.NaN : 1));
    expect(ts.some((t) => t >= 300 && t < 320)).toBe(true);
  });
});
