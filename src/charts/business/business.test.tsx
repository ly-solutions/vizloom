import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { DAY } from '../../core';
import { paceStats } from '../model/pace';
import { refundStats } from '../model/refunds';
import { DEMO_START, demoDailySales, demoHistory } from './demo-data';
import { PaceChart, paceTone, selloutVerdict } from './pace-chart';
import { RefundsChart } from './refunds-chart';
import { SelloutStats } from './sellout-stats';
import { bandPath, dayTicks, linePath, smoothBand, smoothPath } from './svg-paths';

const rect = (width: number) =>
  ({ width, height: 300, top: 0, left: 0, right: width, bottom: 300, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;

beforeAll(() => {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(() => rect(640));
});
afterAll(() => {
  vi.restoreAllMocks();
});

describe('svg paths', () => {
  it('breaks a polyline on NaN', () => {
    expect(linePath([0, 10, 20, 30], [1, Number.NaN, 3, 4])).toBe('M 0.0 1.0 M 20.0 3.0 L 30.0 4.0');
  });
  it('closes bands', () => {
    expect(bandPath([0, 10], [5, 5], [1, 2])).toBe('M 0.0 1.0 L 10.0 2.0 L 10.0 5.0 L 0.0 5.0 Z');
    expect(smoothBand([0, 10], [5, 5], [1, 2]).endsWith('Z')).toBe(true);
    expect(bandPath([], [], [])).toBe('');
  });
  it('smooth path passes through every point', () => {
    const d = smoothPath([0, 10, 20], [5, 1, 5]);
    expect(d.startsWith('M 0.0 5.0')).toBe(true);
    expect(d).toContain('10.0 1.0');
    expect(d.endsWith('20.0 5.0')).toBe(true);
  });
  it('spaces day ticks by width', () => {
    expect(dayTicks(0, 40, 720)).toEqual([0, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40]);
    expect(dayTicks(0, 40, 144).length).toBeLessThanOrEqual(3);
  });
});

describe('pace verdicts', () => {
  it('reads ±5% as usual', () => {
    expect(paceTone(1.04)).toBe('flat');
    expect(paceTone(1.2)).toBe('up');
    expect(paceTone(0.7)).toBe('down');
    expect(paceTone(Number.NaN)).toBe('flat');
  });
  const base = { start: DEMO_START, event: DEMO_START + 40 * DAY };
  it('sold out, on track, off track, stalled, none', () => {
    expect(selloutVerdict(paceStats({ ...base, daily: [100, 100], target: 200 })).kind).toBe('soldOut');
    expect(selloutVerdict(paceStats({ ...base, daily: Array(10).fill(100), target: 2000 })).kind).toBe('onTrack');
    expect(selloutVerdict(paceStats({ ...base, daily: Array(10).fill(10), target: 2000 })).kind).toBe('offTrack');
    expect(selloutVerdict(paceStats({ ...base, daily: [50, 0, 0, 0, 0, 0, 0, 0], target: 2000 })).kind).toBe('stalled');
    expect(selloutVerdict(paceStats({ ...base, daily: [5, 5] })).kind).toBe('none');
  });
});

describe('PaceChart', () => {
  const daily = demoDailySales(26);
  const pace = paceStats({ start: DEMO_START, event: DEMO_START + 40 * DAY, daily, target: 2400, history: demoHistory(6) });

  it('renders the headline, key and a screen-reader table', () => {
    render(<PaceChart title="Sales pace" pace={pace} daily={daily} animate={false} />);
    expect(screen.getByRole('img', { name: 'Sales pace' })).toBeInTheDocument();
    expect(screen.getByText(/of the usual pace/)).toBeInTheDocument();
    const table = screen.getByRole('table');
    expect(table.querySelectorAll('tbody tr').length).toBe(41);
  });

  it('walks days with the keyboard and shows the tooltip', () => {
    render(<PaceChart title="Sales pace" pace={pace} daily={daily} animate={false} />);
    const plot = screen.getByRole('img', { name: 'Sales pace' });
    act(() => {
      fireEvent.keyDown(plot, { key: 'Home' });
    });
    expect(screen.getAllByText('Sold by this day').length).toBeGreaterThan(0);
    act(() => {
      fireEvent.keyDown(plot, { key: 'End' });
    });
    expect(screen.getAllByText('Forecast by this day').length).toBeGreaterThan(0);
  });

  it('compares with the plan when there is no history, and with nothing without capacity', () => {
    const plan = paceStats({ start: DEMO_START, event: DEMO_START + 40 * DAY, daily, target: 2400 });
    const { rerender } = render(<PaceChart title="p" pace={plan} daily={daily} animate={false} />);
    expect(screen.getByText(/of the even plan/)).toBeInTheDocument();
    const none = paceStats({ start: DEMO_START, event: DEMO_START + 40 * DAY, daily });
    rerender(<PaceChart title="p" pace={none} daily={daily} animate={false} />);
    expect(screen.getByText(/Nothing to compare with/)).toBeInTheDocument();
  });

  it('hides the headline and shows the state on error', () => {
    render(<PaceChart title="p" pace={pace} daily={daily} animate={false} state={{ status: 'error', title: 'Could not load' }} />);
    expect(screen.queryByText(/of the usual pace/)).toBeNull();
    expect(screen.getByText('Could not load')).toBeInTheDocument();
  });
});

describe('RefundsChart', () => {
  const r = refundStats({ start: DEMO_START, sales: [100, 200, 300, 100, 50, 80, 90, 120], refunds: [0, 20, 0, 150, 0, 0, 10, 0] });

  it('sums the period in the headline', () => {
    render(<RefundsChart title="Refunds" refunds={r} animate={false} formatValue={(v) => String(Math.round(v))} />);
    expect(screen.getByText('860')).toBeInTheDocument();
    expect(screen.getByText(/refunded 180/)).toBeInTheDocument();
    expect(screen.getByRole('table').querySelectorAll('tbody tr').length).toBe(8);
  });

  it('says so when nothing was refunded', () => {
    const clean = refundStats({ start: DEMO_START, sales: [100, 200], refunds: [0, 0] });
    render(<RefundsChart title="Refunds" refunds={clean} animate={false} />);
    expect(screen.getByText(/no refunds/)).toBeInTheDocument();
  });

  it('zooms from the keyboard and shows a day', () => {
    render(<RefundsChart title="Refunds" refunds={r} animate={false} />);
    const plot = screen.getByRole('img', { name: 'Refunds' });
    act(() => {
      fireEvent.keyDown(plot, { key: 'ArrowRight' });
    });
    expect(screen.getAllByText('Turnover that day').length).toBeGreaterThan(0);
  });
});

describe('SelloutStats', () => {
  const base = { start: DEMO_START, event: DEMO_START + 40 * DAY };
  it('counts days to sell-out when it comes before the event', () => {
    render(<SelloutStats pace={paceStats({ ...base, daily: Array(10).fill(100), target: 2000 })} />);
    expect(screen.getByText('1,000 of 2,000')).toBeInTheDocument();
    expect(screen.getByText('~10 days')).toBeInTheDocument();
    expect(screen.getByText('50% of capacity')).toBeInTheDocument();
  });
  it('says "after the event" with the late date as a hint', () => {
    render(<SelloutStats pace={paceStats({ ...base, daily: Array(10).fill(10), target: 2000 })} />);
    expect(screen.getByText('after the event')).toBeInTheDocument();
    expect(screen.getByText(/at this speed — by/)).toBeInTheDocument();
  });
  it('shows a dash when sold out', () => {
    render(<SelloutStats pace={paceStats({ ...base, daily: [1000, 1000], target: 2000 })} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});
