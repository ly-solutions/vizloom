import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DAY, type SeriesFrame } from '../../core';
import { dailyFrame, DEMO_CHANNELS, demoSales } from './demo-data';
import { AreaChart, TimeColumnChart, TimeSeriesChart } from './time-series-chart';

const sales = demoSales({ days: 20, ahead: 5 });
const frame = dailyFrame(sales);
const series = DEMO_CHANNELS.map((c) => ({ id: c.id, label: c.label }));

describe('TimeSeriesChart', () => {
  it('renders a labelled chart, a legend and a screen-reader data table', () => {
    render(<AreaChart title="Tickets" series={series} frame={frame} />);
    expect(screen.getByRole('img', { name: 'Tickets' })).toBeInTheDocument();
    for (const c of DEMO_CHANNELS) expect(screen.getByRole('button', { name: new RegExp(c.label) })).toBeInTheDocument();
    const table = screen.getByRole('table');
    expect(within(table).getByText(/Chart data/)).toBeInTheDocument();
    expect(within(table).getAllByRole('row').length).toBeGreaterThan(1);
  });

  it('hides a series from the legend, never the last one', () => {
    const onHiddenChange = vi.fn();
    render(<AreaChart title="Tickets" series={series.slice(0, 2)} frame={frame} onHiddenChange={onHiddenChange} />);
    const web = screen.getByRole('button', { name: /Website/ });
    fireEvent.click(web);
    expect(onHiddenChange).toHaveBeenLastCalledWith(new Set(['web']));
    expect(web).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(screen.getByRole('button', { name: /Mobile app/ }));
    // Hiding the last visible series shows all instead.
    expect(onHiddenChange).toHaveBeenLastCalledWith(new Set());
  });

  it('shows the empty state for an all-zero frame and for state=empty', () => {
    const zeros: SeriesFrame<'web'> = { ...frame, values: { web: new Float64Array(frame.length) } };
    const { unmount } = render(<AreaChart title="Tickets" series={[{ id: 'web', label: 'Website' }]} frame={zeros} />);
    expect(screen.queryByRole('table')).toBeNull();
    unmount();
    render(<AreaChart title="Tickets" series={series} frame={frame} state={{ status: 'empty' }} />);
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('offers a retry in the error state', () => {
    const onRetry = vi.fn();
    render(<TimeColumnChart title="Tickets" series={series} frame={frame} state={{ status: 'error', onRetry }} />);
    fireEvent.click(screen.getByRole('button', { name: /retry|try again/i }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('zooms with the buttons and reports the range', async () => {
    const onRangeChange = vi.fn();
    render(<AreaChart title="Tickets" series={series} frame={frame} onRangeChange={onRangeChange} />);
    const first = onRangeChange.mock.calls.at(-1)?.[0] as { start: number; end: number };
    const zoomIn = screen.getByRole('button', { name: 'Zoom in' });
    expect(zoomIn).toBeEnabled();
    fireEvent.click(zoomIn);
    // The viewport reports the new target on its next animation frame.
    const span = () => {
      const r = onRangeChange.mock.calls.at(-1)?.[0] as { start: number; end: number };
      return r.end - r.start;
    };
    await waitFor(() => expect(span()).toBeLessThan(first.end - first.start));
    fireEvent.click(await screen.findByRole('button', { name: /Whole period/ }));
    await waitFor(() => expect(span()).toBe(first.end - first.start));
  });

  it('lines compared series up by days before the event', () => {
    const a = { ...frame, values: { value: frame.values.web } };
    const b = { ...frame, start: frame.start - 365 * DAY, values: { value: frame.values.app } };
    render(
      <TimeSeriesChart
        title="Seasons"
        series={[]}
        compare={[
          { id: 'now', label: 'This season', frame: a, event: sales.event, role: 'primary' },
          { id: 'last', label: 'Last season', frame: b, event: sales.event - 365 * DAY, role: 'compare' },
        ]}
        compareAlign="days-before"
      />,
    );
    expect(screen.getByRole('button', { name: /This season/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Last season/ })).toBeInTheDocument();
    // No zoom buttons in compare mode.
    expect(screen.queryByRole('button', { name: 'Zoom in' })).toBeNull();
  });
});
