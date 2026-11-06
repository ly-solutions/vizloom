import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useSeriesState } from '../hooks/hooks';
import { attachGestures } from '../gestures/gestures';
import { VizProvider } from '../theme/provider';
import { DeltaBadge } from '../ui/delta';
import { Legend } from '../ui/legend';
import { LiveNumber } from '../ui/live-number';
import { StateView } from '../ui/state';
import { ChartDataTable } from '../ui/data-table-fallback';

describe('Legend', () => {
  const items = [
    { id: 'a', label: 'Alpha', color: 'red' },
    { id: 'b', label: 'Beta', color: 'blue' },
  ] as const;
  it('toggles by keyboard click and announces pressed state', () => {
    const onToggle = vi.fn();
    render(<Legend items={items} onToggle={onToggle} />);
    const alpha = screen.getByRole('button', { name: 'Alpha' });
    expect(alpha).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(alpha, { detail: 0 });
    expect(onToggle).toHaveBeenCalledWith('a');
  });
  it('hides with one series unless always', () => {
    const { container } = render(<Legend items={[items[0]]} />);
    expect(container.firstChild).toBeNull();
  });
});

describe('useSeriesState', () => {
  it('never hides the last visible series', () => {
    const { result } = renderHook(() => useSeriesState(['a', 'b']));
    act(() => result.current.toggle('a'));
    expect(result.current.hidden.has('a')).toBe(true);
    act(() => result.current.toggle('b'));
    expect(result.current.hidden.size).toBe(0);
    act(() => result.current.solo('b'));
    expect([...result.current.hidden]).toEqual(['a']);
  });
});

describe('DeltaBadge', () => {
  it('reads direction without colour and flips tone when inverted', () => {
    const { container, rerender } = render(<DeltaBadge value={24} />);
    expect(container.textContent).toContain('increase');
    expect(container.textContent).toContain('+24%');
    expect(container.firstElementChild).toHaveAttribute('data-tone', 'positive');
    rerender(<DeltaBadge value={24} invert />);
    expect(container.firstElementChild).toHaveAttribute('data-tone', 'negative');
  });
  it('uses the provider locale', () => {
    const { container } = render(
      <VizProvider locale="ru">
        <DeltaBadge value={-5} />
      </VizProvider>,
    );
    expect(container.textContent).toContain('снижение');
  });
});

describe('LiveNumber', () => {
  it('renders the formatted final value for readers', () => {
    render(<LiveNumber value={1234} format={(v) => `${Math.round(v)} pcs`} />);
    expect(screen.getAllByText('1234 pcs').length).toBeGreaterThan(0);
  });
});

describe('StateView', () => {
  it('renders each state', () => {
    const retry = vi.fn();
    const { rerender } = render(<StateView state={{ status: 'error' }} onRetry={retry} />);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(retry).toHaveBeenCalled();
    rerender(<StateView state={{ status: 'no-access' }} />);
    expect(screen.getByText('No access')).toBeInTheDocument();
    rerender(<StateView state={{ status: 'empty', reason: 'No sales yet' }} />);
    expect(screen.getByText('No sales yet')).toBeInTheDocument();
    rerender(<StateView state={{ status: 'loading' }} />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    rerender(
      <StateView state={{ status: 'ready' }}>
        <p>content</p>
      </StateView>,
    );
    expect(screen.getByText('content')).toBeInTheDocument();
  });
});

describe('ChartDataTable', () => {
  it('caps rows', () => {
    render(<ChartDataTable caption="Sales" columns={['Day', 'Value']} rows={Array.from({ length: 300 }, (_, i) => [`d${i}`, i])} />);
    expect(screen.getAllByRole('row').length).toBe(201);
  });
});

describe('gestures', () => {
  it('fires tap, drag and wheel zoom', () => {
    const el = document.createElement('div');
    document.body.append(el);
    const onTap = vi.fn();
    const onDrag = vi.fn();
    const onZoom = vi.fn();
    const detach = attachGestures(el, { onTap, onDrag, onZoom });
    const ev = (type: string, x: number, init: Partial<PointerEventInit> = {}) =>
      el.dispatchEvent(
        Object.assign(new MouseEvent(type, { clientX: x, clientY: 10, bubbles: true, button: 0 }), {
          pointerId: 1,
          pointerType: 'mouse',
          ...init,
        }),
      );
    ev('pointerdown', 10);
    ev('pointerup', 10);
    expect(onTap).toHaveBeenCalled();
    ev('pointerdown', 10);
    ev('pointermove', 30);
    ev('pointerup', 30);
    expect(onDrag).toHaveBeenCalled();
    el.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true }));
    expect(onZoom.mock.calls[0][0].factor).toBeLessThan(1);
    detach();
  });
});
