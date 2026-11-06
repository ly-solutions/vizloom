import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { FUNNEL_VARIANT, FunnelChart, type FunnelVariant } from './funnel-chart';

const steps = [
  { id: 'visit', label: 'Event page', value: 10000 },
  { id: 'select', label: 'Choose tickets', value: 3000 },
  { id: 'checkout', label: 'Checkout', value: 1200 },
  { id: 'paid', label: 'Paid', value: 900 },
];

describe('FunnelChart', () => {
  it('headline: total conversion and the biggest drop', () => {
    const { container } = render(<FunnelChart title="Sales funnel" steps={steps} animate={false} />);
    expect(container.querySelector('.vl-funnel__total')?.textContent).toBe('9%');
    expect(container.querySelector('.vl-funnel__worst')?.textContent).toContain('Choose tickets');
    expect(container.querySelector('.vl-funnel__worst')?.textContent).toContain('70%');
  });

  it.each(Object.values(FUNNEL_VARIANT) as FunnelVariant[])('renders every step in the %s variant', async (variant) => {
    const { container } = render(<FunnelChart title="Sales funnel" steps={steps} variant={variant} animate={false} />);
    await screen.findByRole('table', { name: /Sales funnel/ });
    // SVG variants need a measured width; jsdom has none, so only the DOM rows render there.
    if (variant === 'funnel' || variant === 'dropoff') expect(container.querySelectorAll('[data-step]')).toHaveLength(4);
    expect(container.querySelector('.vl-funnel')).toHaveClass(`vl-funnel--${variant}`);
  });

  it('screen-reader table has conversion from start and from previous', () => {
    render(<FunnelChart title="Sales funnel" steps={steps} animate={false} />);
    const rows = screen.getByRole('table').querySelectorAll('tbody tr');
    expect(rows).toHaveLength(4);
    expect(rows[1]).toHaveTextContent('30%');
    expect(rows[2]).toHaveTextContent('40%');
  });

  it('marks the drop-off step and shows a tooltip on focus', () => {
    const { container } = render(<FunnelChart title="Sales funnel" steps={steps} animate={false} />);
    expect(container.querySelector('[data-step="1"]')).toHaveAttribute('data-worst');
    act(() => container.querySelector<HTMLElement>('[data-step="2"]')?.focus());
    expect(screen.getByRole('tooltip')).toHaveTextContent('Checkout');
    expect(container.querySelector('[data-step="0"]')).toHaveAttribute('data-state', 'dim');
  });

  it('keyboard: arrows move between steps, Enter selects', () => {
    const onSelect = vi.fn();
    const { container } = render(<FunnelChart title="Sales funnel" steps={steps} animate={false} onSelect={onSelect} />);
    const items = container.querySelectorAll<HTMLElement>('[data-step]');
    act(() => items[0].focus());
    fireEvent.keyDown(items[0], { key: 'ArrowDown' });
    expect(document.activeElement).toBe(items[1]);
    fireEvent.keyDown(items[1], { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith(1, null);
  });

  it('a step without data is "No data", not zero; the next step counts from the last known one', () => {
    const gappy = [steps[0], { id: 'select', label: 'Choose tickets', value: Number.NaN }, steps[2]];
    const { container } = render(<FunnelChart title="Gap" steps={gappy} animate={false} />);
    expect(container.querySelector('[data-step="1"]')).toHaveTextContent('No data');
    expect(container.querySelector('[data-step="2"]')).toHaveTextContent('12% of start');
  });

  it('a step bigger than the previous is flagged, not 100%', () => {
    const odd = [steps[0], { id: 'x', label: 'Direct link', value: 12000 }];
    const { container } = render(<FunnelChart title="Odd" steps={odd} animate={false} />);
    expect(container.querySelector('[data-step="1"] [data-skipped]')).not.toBeNull();
  });

  it('empty, loading and error states', () => {
    const empty = render(<FunnelChart title="Empty" steps={[]} />);
    expect(empty.container.querySelector('.vl-state--empty')).not.toBeNull();
    empty.unmount();
    const loading = render(<FunnelChart title="Loading" steps={steps} state={{ status: 'loading' }} />);
    expect(loading.container.querySelector('.vl-state--loading')).not.toBeNull();
    loading.unmount();
    render(<FunnelChart title="Err" steps={steps} state={{ status: 'error' }} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
