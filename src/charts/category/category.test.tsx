import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { BarChart } from './bar-chart';
import { BarList } from './bar-list';
import { Gauge } from './gauge';
import { Sparkline } from './sparkline';
import { SplitBar } from './split-bar';

describe('Sparkline', () => {
  it('summarises values for screen readers', () => {
    render(<Sparkline values={[1, 5, Number.NaN, 3]} width={80} />);
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'min 1, max 5, last 3');
  });
  it('selects bars', () => {
    const onSelect = vi.fn();
    render(<Sparkline values={[1, 2, 3]} width={60} kind="bars" onSelect={onSelect} />);
    fireEvent.click(screen.getAllByRole('button')[1]);
    expect(onSelect).toHaveBeenCalledWith(1);
  });
});

describe('BarChart', () => {
  const props = {
    title: 'Sales by type',
    categories: [
      { key: 'a', label: 'Floor' },
      { key: 'b', label: 'Balcony' },
    ],
    series: [
      { id: 'mon', label: 'Monday' },
      { id: 'tue', label: 'Tuesday' },
    ],
    values: { mon: [10, 20], tue: [5, 15] },
  } as const;
  it('renders a data table and a legend', () => {
    render(<BarChart {...props} animate={false} />);
    expect(screen.getByRole('table')).toHaveTextContent('Floor');
    expect(screen.getByRole('button', { name: 'Monday' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('group', { name: 'Sales by type' })).toBeInTheDocument();
  });
  it('moves the active category with arrow keys', () => {
    const onHover = vi.fn();
    render(<BarChart {...props} mode="stack" onHover={onHover} animate={false} />);
    const plot = screen.getByRole('group', { name: 'Sales by type' });
    fireEvent.keyDown(plot, { key: 'ArrowRight' });
    fireEvent.keyDown(plot, { key: 'ArrowRight' });
    expect(onHover).toHaveBeenLastCalledWith(1);
  });
  it('shows states', () => {
    render(<BarChart title="x" data={[]} state={{ status: 'error' }} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});

describe('BarList', () => {
  it('collapses and selects', () => {
    const onSelect = vi.fn();
    render(
      <BarList
        title="Promo codes"
        limit={2}
        onSelect={onSelect}
        items={[
          { key: 'a', label: 'FRIENDS10', value: 10 },
          { key: 'b', label: 'SUMMER', value: 30 },
          { key: 'c', label: 'VIPONLY', value: 0, tone: 'negative' },
        ]}
      />,
    );
    expect(screen.getAllByRole('listitem')[0]).toHaveTextContent('SUMMER');
    fireEvent.click(screen.getByRole('button', { name: '1 more' }));
    expect(screen.getByText('VIPONLY')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /FRIENDS10/ }));
    expect(onSelect).toHaveBeenCalledWith('a');
  });
});

describe('SplitBar and Gauge', () => {
  it('announces shares', () => {
    render(
      <SplitBar
        title="Check-in"
        parts={[
          { key: 'in', label: 'Came', value: 78 },
          { key: 'no', label: 'Not yet', value: 22, tone: 'muted' },
        ]}
      />,
    );
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'Check-in: Came 78%, Not yet 22%');
  });
  it('gauge is a meter', () => {
    render(<Gauge title="Sold" value={750} max={1000} animate={false} />);
    const meter = screen.getByRole('meter', { name: 'Sold' });
    expect(meter).toHaveAttribute('aria-valuenow', '750');
    expect(screen.getByText('75%')).toBeInTheDocument();
  });
});
