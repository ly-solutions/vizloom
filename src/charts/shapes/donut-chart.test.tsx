import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DonutChart } from './donut-chart';

const data = [
  { key: 'web', label: 'Web', value: 600 },
  { key: 'app', label: 'App', value: 300 },
  { key: 'box', label: 'Box office', value: 100 },
];

describe('DonutChart', () => {
  it('draws a slice per row, a legend with shares and the total in the centre', () => {
    const { container } = render(<DonutChart title="Sales by channel" data={data} animate={false} />);
    expect(container.querySelectorAll('[data-slice]')).toHaveLength(3);
    expect(container.querySelector('.vl-donut__big')?.textContent).toBe('1,000');
    expect(container.querySelector('.vl-donut__caption')?.textContent).toBe('Total');
    const shares = [...container.querySelectorAll('.vl-donut__share')].map((n) => n.textContent);
    expect(shares).toEqual(['60%', '30%', '10%']);
  });

  it('gives screen readers a data table', () => {
    render(<DonutChart title="Sales by channel" data={data} animate={false} />);
    const table = screen.getByRole('table', { name: /Sales by channel/ });
    expect(table).toBeInTheDocument();
    expect(table.querySelectorAll('tbody tr')).toHaveLength(3);
  });

  it('switches the centre to the focused slice and shows a tooltip', () => {
    const { container } = render(<DonutChart title="Sales" data={data} animate={false} />);
    const slice = container.querySelector<SVGPathElement>('[data-slice="app"]');
    expect(slice).not.toBeNull();
    fireEvent.focus(slice as SVGPathElement);
    expect(container.querySelector('.vl-donut__big')?.textContent).toBe('300');
    expect(container.querySelector('.vl-donut__caption')?.textContent).toBe('App');
    expect(container.querySelector('.vl-donut__slice[data-state="dim"]')).not.toBeNull();
    expect(screen.getByRole('tooltip')).toHaveTextContent('App');
    fireEvent.blur(slice as SVGPathElement);
    expect(container.querySelector('.vl-donut__caption')?.textContent).toBe('Total');
  });

  it('moves focus with arrow keys and selects with Enter', () => {
    const onSelect = vi.fn();
    const { container } = render(<DonutChart title="Sales" data={data} animate={false} onSelect={onSelect} />);
    const slices = container.querySelectorAll<SVGPathElement>('[data-slice]');
    act(() => slices[0].focus());
    fireEvent.keyDown(slices[0], { key: 'ArrowRight' });
    expect(document.activeElement).toBe(slices[1]);
    fireEvent.keyDown(slices[1], { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith(1, null);
  });

  it('works controlled: highlight from props, changes reported', () => {
    const onHighlight = vi.fn();
    const { container, rerender } = render(
      <DonutChart title="Sales" data={data} animate={false} highlight="box" onHighlight={onHighlight} />,
    );
    expect(container.querySelector('.vl-donut__caption')?.textContent).toBe('Box office');
    fireEvent.pointerEnter(container.querySelector('[data-slice="web"]') as Element, { pointerType: 'mouse' });
    expect(onHighlight).toHaveBeenCalledWith('web');
    expect(container.querySelector('.vl-donut__caption')?.textContent).toBe('Box office');
    rerender(<DonutChart title="Sales" data={data} animate={false} highlight={null} onHighlight={onHighlight} />);
    expect(container.querySelector('.vl-donut__caption')?.textContent).toBe('Total');
  });

  it('merges the tail into "Other" with visibleRows', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ key: `k${i}`, label: `Item ${i}`, value: 100 - i }));
    const { container } = render(<DonutChart title="Many" data={many} animate={false} visibleRows={5} />);
    expect(container.querySelectorAll('.vl-donut__row')).toHaveLength(6);
    expect(container.querySelector('[data-slice="__other__"]')).not.toBeNull();
    expect(screen.getByRole('table')).toHaveTextContent('Other');
  });

  it('pie has no centre label, semi has one', () => {
    const pie = render(<DonutChart title="Pie" data={data} animate={false} variant="pie" />);
    expect(pie.container.querySelector('.vl-donut__big')).toBeNull();
    pie.unmount();
    const semi = render(<DonutChart title="Semi" data={data} animate={false} variant="semi" />);
    expect(semi.container.querySelector('.vl-donut__big')).not.toBeNull();
  });

  it('shows empty, loading and error states', () => {
    const empty = render(<DonutChart title="Empty" data={[]} />);
    expect(empty.container.querySelector('.vl-state--empty')).not.toBeNull();
    empty.unmount();
    const zero = render(<DonutChart title="Zero" data={[{ key: 'a', label: 'A', value: 0 }]} />);
    expect(zero.container.querySelector('.vl-state--empty')).not.toBeNull();
    zero.unmount();
    const loading = render(<DonutChart title="Loading" data={data} state={{ status: 'loading' }} />);
    expect(loading.container.querySelector('.vl-state--loading')).not.toBeNull();
    loading.unmount();
    const error = render(<DonutChart title="Err" data={data} state={{ status: 'error' }} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    error.unmount();
  });
});
