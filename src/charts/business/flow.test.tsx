import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { MINUTE, type SeriesFrame } from '../../core';
import { demoEntryFrame, GATE_IDS, GATE_LABELS } from './demo-data';
import { FLOW_MIN_WINDOW, flowStats, minuteTicks, selectionWindow } from './flow';
import { FlowChart } from './flow-chart';

const frame = (a: number[], b: number[]): SeriesFrame<'a' | 'b'> => ({
  start: 0,
  step: MINUTE,
  length: a.length,
  values: { a: Float64Array.from(a), b: Float64Array.from(b) },
});

describe('flowStats', () => {
  it('computes now, average, peak and total; NaN is "not yet"', () => {
    const s = flowStats(frame([1, 5, 3, 0, 0, 0, 0, 0, Number.NaN], [2, 2, 2, 2, 2, 2, 2, 2, Number.NaN]), ['a', 'b']);
    expect(s.filled).toBe(8);
    expect(s.series.a.peak).toBe(5);
    expect(s.series.a.peakAt).toBe(MINUTE);
    expect(s.series.a.total).toBe(9);
    expect(s.series.a.current).toBe(0);
    expect(s.series.a.idle).toBe(true);
    expect(s.series.b.idle).toBe(false);
    expect(s.series.b.average).toBe(2);
    expect(s.all.total).toBe(25);
    expect(s.all.peak).toBe(7);
  });
  it('has no peak time without data', () => {
    const s = flowStats(frame([Number.NaN], [Number.NaN]), ['a', 'b']);
    expect(s.filled).toBe(0);
    expect(Number.isNaN(s.all.peakAt)).toBe(true);
  });
});

describe('selectionWindow', () => {
  it('ignores clicks and widens short stretches', () => {
    expect(selectionWindow({ start: 0, end: MINUTE })).toBeNull();
    expect(selectionWindow({ start: 0, end: 3 * MINUTE })).toEqual({
      start: 1.5 * MINUTE - FLOW_MIN_WINDOW / 2,
      end: 1.5 * MINUTE + FLOW_MIN_WINDOW / 2,
    });
    expect(selectionWindow({ start: 0, end: 20 * MINUTE })).toEqual({ start: 0, end: 20 * MINUTE });
  });
});

describe('minuteTicks', () => {
  it('picks a round minute step that fits and marks whole hours', () => {
    const ticks = minuteTicks((t) => String(t / MINUTE))({ start: 0, end: 60 * MINUTE }, 640);
    expect(ticks.map((t) => t.label)).toEqual(['0', '10', '20', '30', '40', '50', '60']);
    expect(ticks[0].major).toBe(true);
    expect(ticks[1].major).toBe(false);
    const fine = minuteTicks((t) => String(t / MINUTE))({ start: 0, end: 5 * MINUTE }, 640);
    expect(fine.length).toBe(6);
  });
});

describe('FlowChart', () => {
  const data = demoEntryFrame(120);
  const series = GATE_IDS.map((id) => ({ id, label: GATE_LABELS[id] }));

  it('renders stats, a card per series and the data table', () => {
    render(<FlowChart title="Entry speed" frame={data} series={series} animate={false} />);
    expect(screen.getByRole('img', { name: 'Entry speed' })).toBeInTheDocument();
    expect(screen.getByText('Passed')).toBeInTheDocument();
    for (const s of series) expect(screen.getByRole('button', { name: new RegExp(s.label) })).toHaveAttribute('aria-pressed', 'false');
  });

  it('focuses a line by its card and releases it on a second click', () => {
    const onFocusChange = vi.fn();
    render(<FlowChart title="Entry speed" frame={data} series={series} onFocusChange={onFocusChange} animate={false} />);
    const card = screen.getByRole('button', { name: /North gate/ });
    fireEvent.click(card);
    expect(onFocusChange).toHaveBeenLastCalledWith('north');
    expect(card).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /South gate/ })).toHaveAttribute('data-off', 'true');
    fireEvent.click(card);
    expect(onFocusChange).toHaveBeenLastCalledWith(null);
  });

  it('shows "now" figures and idle badges when live', () => {
    const live = demoEntryFrame(120, 105);
    render(<FlowChart title="Entry speed" frame={live} series={series} live animate={false} />);
    expect(screen.getByText('Now')).toBeInTheDocument();
    expect(screen.getByText('idle')).toBeInTheDocument();
  });

  it('hides cards and stats on error', () => {
    render(<FlowChart title="Entry speed" frame={data} series={series} state={{ status: 'error' }} animate={false} />);
    expect(screen.queryByRole('button', { name: /North gate/ })).toBeNull();
    expect(screen.queryByText('Passed')).toBeNull();
  });
});
