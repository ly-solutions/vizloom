import { describe, expect, it } from 'vitest';

import { bucketize } from '../model/aggregate';
import { minMaxIndices, lttbIndices } from '../model/canvas';
import { createFormatter, formatCompact, formatCurrency, formatDelta, formatValue, percentChange, pluralize } from '../model/format';
import { defineLocale, en, resolveLocale, ru } from '../model/locale';
import { contrastRatio, mixColors, parseColor, resolveColor, seriesColor } from '../model/palette';
import { bandScale, linearScale, niceDomain, niceStep } from '../model/scale';
import { DAY, fixedOffsetZone, floorTo, HOUR, intlZone, pickGranularity, tickLevelFor, ticksFor, WEEK } from '../model/time';
import { Viewport } from '../model/viewport';
import { createLocalSource, frameFromArrays, sliceFrame } from '../data/source';
import { computePlacement } from '../positioning/placement';
import { placeChartTooltip } from '../positioning/chart-tooltip';

const T0 = Date.UTC(2026, 9, 5, 0, 0); // Mon 5 Oct 2026

describe('time', () => {
  it('floors to local buckets and Monday weeks', () => {
    const msk = fixedOffsetZone(3);
    const t = T0 + 22 * HOUR + 30 * 60_000; // 01:30 next day in UTC+3
    expect(floorTo(t, 'day', msk)).toBe(T0 + DAY - 3 * HOUR);
    expect(new Date(floorTo(T0 + 3 * DAY, 'week')).getUTCDay()).toBe(1);
  });
  it('picks granularity with hysteresis', () => {
    expect(pickGranularity(2 * DAY, 800)).toBe('hour');
    expect(pickGranularity(60 * DAY, 800)).toBe('day');
    expect(pickGranularity(400 * DAY, 800)).toBe('week');
    // 8px per hour: below enter (9) but above leave (7) keeps hour
    const span = (800 * HOUR) / 8;
    expect(pickGranularity(span, 800, 'hour')).toBe('hour');
    expect(pickGranularity(span, 800, 'day')).toBe('day');
  });
  it('ticks months and weeks', () => {
    expect(tickLevelFor(7 * DAY, 700)).toBe(DAY);
    const months = ticksFor('month', { start: T0, end: T0 + 100 * DAY });
    expect(months.length).toBe(3);
    expect(ticksFor(WEEK, { start: T0, end: T0 + 21 * DAY }).length).toBe(4);
  });
  it('reads IANA offsets', () => {
    const berlin = intlZone('Europe/Berlin');
    expect(berlin.offset(Date.UTC(2026, 6, 1))).toBe(2 * HOUR);
    expect(berlin.offset(Date.UTC(2026, 0, 1))).toBe(HOUR);
  });
});

describe('format', () => {
  it('compacts in both locales', () => {
    expect(formatCompact(1234, en)).toBe('1.2K');
    expect(formatCompact(48_000, en)).toBe('48K');
    expect(formatCompact(999_999, en)).toBe('1M');
    expect(formatCompact(1234, ru)).toBe('1,2 тыс');
  });
  it('formats currency, percent, counts, deltas', () => {
    expect(formatCurrency(248000, 'USD', en)).toBe('$248,000');
    expect(formatCurrency(248000, 'RUB', ru)).toBe('248 000 ₽');
    expect(formatValue(5, { kind: 'count', forms: ['билет', 'билета', 'билетов'] }, { locale: ru, long: true })).toBe('5 билетов');
    expect(pluralize(1, ['ticket', 'tickets'])).toBe('ticket');
    expect(formatDelta(24, en)).toBe('↑ +24%');
    expect(formatDelta(-42.4, en)).toBe('↓ −42%');
    expect(percentChange(120, 100)).toBe(20);
    expect(Number.isNaN(percentChange(1, 0))).toBe(true);
  });
  it('formats days and buckets', () => {
    const f = createFormatter(en);
    expect(f.day(T0)).toBe('Oct 5');
    expect(createFormatter(ru).day(T0)).toBe('5 окт');
    expect(f.bucket(T0 + 14 * HOUR, 'hour', HOUR)).toBe('Oct 5, Mon · 14:00–15:00');
    expect(f.relative(T0 - 3 * 60_000, T0)).toBe('3 minutes ago');
  });
  it('resolves and extends locales', () => {
    expect(resolveLocale('ru-RU')).toBe(ru);
    const gb = defineLocale(en, { code: 'en-GB', dayFirst: true, strings: { retry: 'Try again' } });
    expect(gb.strings.retry).toBe('Try again');
    expect(gb.strings.noData).toBe(en.strings.noData);
  });
});

describe('scale', () => {
  it('nice steps and domains', () => {
    expect(niceStep(23)).toBe(25);
    expect(niceDomain(3, 97).ticks).toEqual([0, 25, 50, 75, 100]);
    expect(niceDomain(-12, 30).min).toBeLessThanOrEqual(-12);
  });
  it('linear and band', () => {
    const s = linearScale([0, 10], [0, 100]);
    expect(s(5)).toBe(50);
    expect(s.invert(25)).toBe(2.5);
    const b = bandScale(['a', 'b', 'c'], [0, 300], { paddingInner: 0, paddingOuter: 0 });
    expect(b('b')).toBe(100);
    expect(b.invert(250)).toBe('c');
  });
});

describe('palette', () => {
  it('parses, mixes and checks contrast', () => {
    expect(parseColor('#fff')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(contrastRatio(parseColor('#000')!, parseColor('#fff')!)).toBeCloseTo(21, 0);
    const mid = mixColors(parseColor('#000')!, parseColor('#fff')!, 0.5);
    expect(mid.r).toBeGreaterThan(90);
    expect(seriesColor(9)).toBe('var(--vl-cat-2)');
  });
});

describe('aggregate and source', () => {
  const hourly = {
    start: T0,
    length: 48,
    values: { a: Array.from({ length: 48 }, () => 1), b: Array.from({ length: 48 }, (_, i) => (i < 30 ? Number.NaN : 2)) },
  };
  it('bucketizes hours into days', () => {
    const f = bucketize(hourly, 'day');
    expect(f.length).toBe(2);
    expect(f.values.a[0]).toBe(24);
    expect(Number.isNaN(f.values.b[0])).toBe(true);
    expect(f.values.b[1]).toBe(36);
  });
  it('local source answers the contract', async () => {
    const source = createLocalSource({ hourly: { sales: hourly }, extent: { start: T0, end: T0 + 2 * DAY } });
    const frame = await source.load({ metric: 'sales', granularity: 'day', range: { start: T0, end: T0 + 2 * DAY } });
    expect(frame).toMatchObject({ start: T0, step: DAY, length: 2 });
  });
  it('slices frames and builds from arrays', () => {
    const f = frameFromArrays(T0, HOUR, { a: [1, 2, 3, 4] });
    const s = sliceFrame(f, { start: T0 + HOUR, end: T0 + 3 * HOUR });
    expect(Array.from(s.values.a)).toEqual([2, 3]);
  });
});

describe('viewport', () => {
  it('clamps, zooms and eases', () => {
    const v = new Viewport({ extent: { start: 0, end: 100 * HOUR }, tau: 100 });
    v.zoomAround(50 * HOUR, 0.5, { instant: true });
    expect(v.state.current).toEqual({ start: 25 * HOUR, end: 75 * HOUR });
    v.panBy(1000 * HOUR, { instant: true });
    expect(v.state.current.end).toBe(100 * HOUR);
    v.setRange({ start: 0, end: 10 * HOUR });
    for (let i = 0; i < 200 && v.step(16); i++);
    expect(v.state.current).toEqual(v.state.target);
  });
});

describe('lod', () => {
  it('keeps peaks', () => {
    const values = Array.from({ length: 10_000 }, (_, i) => (i === 5000 ? 100 : Math.sin(i / 50)));
    const idx = minMaxIndices(values, 0, values.length, 200);
    expect(idx.length).toBeLessThan(1000);
    expect(idx).toContain(5000);
    const xs = values.map((_, i) => i);
    expect(lttbIndices(xs, values, 100).length).toBe(100);
  });
});

describe('placement', () => {
  it('flips tooltips near edges and docks on phones', () => {
    const right = placeChartTooltip({ anchor: { x: 50, y: 50 }, size: { width: 100, height: 40 }, bounds: { width: 600, height: 300 } });
    expect(right.side).toBe('right');
    const left = placeChartTooltip({ anchor: { x: 560, y: 50 }, size: { width: 100, height: 40 }, bounds: { width: 600, height: 300 } });
    expect(left.side).toBe('left');
    const dock = placeChartTooltip({
      anchor: { x: 100, y: 50 },
      size: { width: 100, height: 40 },
      bounds: { width: 360, height: 300 },
      dockBelow: 480,
    });
    expect(dock.side).toBe('dock');
  });
  it('computes hint placement inside the viewport', () => {
    const p = computePlacement({
      anchor: { top: 100, left: 100, width: 20, height: 20 },
      bubble: { width: 120, height: 40 },
      viewport: { top: 0, left: 0, width: 800, height: 600 },
      direction: 'top',
      offset: 8,
      centered: true,
      rtl: false,
    });
    expect(p.direction).toBe('top');
    expect(p.y).toBe(52);
  });
});

describe('resolveColor with custom properties', () => {
  it('reads var() from the root element and falls back to the var() default', () => {
    document.documentElement.style.setProperty('--test-color', '#ff0000');
    expect(resolveColor('var(--test-color)')).toMatchObject({ r: 255, g: 0, b: 0 });
    expect(resolveColor('var(--missing-color, #00ff00)')).toMatchObject({ r: 0, g: 255, b: 0 });
    document.documentElement.style.removeProperty('--test-color');
  });
});
