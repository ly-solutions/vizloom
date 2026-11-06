import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { currencyUnit, DAY, frameFromArrays } from '../core';
import { ChartCard } from './card';
import { alignComparison, cumulative, valuesAt } from './compare';
import { Segmented, Tabs } from './controls';
import { DashboardGrid, GridItem } from './grid';
import { CalcCard, InfoHint } from './info-hint';
import { InsightList } from './insights';
import { Kpi, KpiStrip } from './kpi';
import { ActivityFeed } from './feed';
import { StatTile } from './tiles';

describe('KpiStrip', () => {
  it('renders value, delta under the number and sub line', () => {
    render(
      <KpiStrip items={[{ id: 'rev', label: 'Revenue', value: 248000, unit: currencyUnit('USD'), delta: 12, sub: 'after refunds' }]} />,
    );
    const group = screen.getByRole('group', { name: 'Revenue' });
    expect(group).toHaveTextContent('$248,000');
    expect(group).toHaveTextContent('+12%');
    const value = group.querySelector('.vl-kpi__value')!;
    const delta = group.querySelector('.vl-kpi__delta')!;
    expect(value.compareDocumentPosition(delta) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(group).toHaveTextContent('after refunds');
  });
  it('shows states per KPI', () => {
    render(
      <KpiStrip
        items={[
          { id: 'a', label: 'A', value: 1, state: { status: 'loading' } },
          { id: 'b', label: 'B', value: 1, state: { status: 'no-access' } },
        ]}
      />,
    );
    expect(screen.getByText('No access')).toBeInTheDocument();
  });
  it('bumps on growth', () => {
    vi.useFakeTimers();
    const { rerender, container } = render(<Kpi id="x" label="Sold" value={10} />);
    rerender(<Kpi id="x" label="Sold" value={13} />);
    expect(container.querySelector('.vl-kpi__bump')).toHaveTextContent('+3');
    act(() => {
      vi.advanceTimersByTime(2500);
    });
    expect(container.querySelector('.vl-kpi__bump')).toBeNull();
    vi.useRealTimers();
  });
});

describe('InfoHint', () => {
  it('opens on click and closes on Escape', () => {
    render(
      <InfoHint label="How revenue is calculated">
        <CalcCard title="Revenue" formula="Turnover − refunds" result={{ label: 'Revenue', value: '$10' }} />
      </InfoHint>,
    );
    const btn = screen.getByRole('button', { name: 'How revenue is calculated' });
    fireEvent.click(btn);
    expect(screen.getByRole('tooltip')).toHaveTextContent('Turnover − refunds');
    expect(btn).toHaveAttribute('aria-expanded', 'true');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(btn).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('controls', () => {
  it('segmented is a radiogroup with arrow keys', () => {
    const onChange = vi.fn();
    render(
      <Segmented
        aria-label="Metric"
        value="units"
        onChange={onChange}
        options={[
          { value: 'units', label: 'Units' },
          { value: 'revenue', label: 'Revenue' },
        ]}
      />,
    );
    const group = screen.getByRole('radiogroup', { name: 'Metric' });
    expect(screen.getByRole('radio', { name: 'Units' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.keyDown(group, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith('revenue');
  });
  it('tabs link to a tabpanel inside ChartCard', () => {
    render(
      <ChartCard
        title="Sales"
        tabs={<Tabs aria-label="Mode" value="day" onChange={() => undefined} tabs={[{ value: 'day', label: 'By day' }]} />}
      >
        <p>chart</p>
      </ChartCard>,
    );
    expect(screen.getByRole('tab', { name: 'By day' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('chart');
    expect(screen.getByRole('region', { name: 'Sales' })).toBeInTheDocument();
  });
});

describe('ChartCard', () => {
  it('renders block states instead of the body', () => {
    const retry = vi.fn();
    render(
      <ChartCard title="Sales" state={{ status: 'error' }} onRetry={retry}>
        <p>chart</p>
      </ChartCard>,
    );
    expect(screen.queryByText('chart')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(retry).toHaveBeenCalled();
  });
});

describe('grid', () => {
  it('passes spans as data attributes', () => {
    const { container } = render(
      <DashboardGrid>
        <GridItem span={8}>a</GridItem>
        <ChartCard title="b" span={4}>
          b
        </ChartCard>
      </DashboardGrid>,
    );
    expect(container.querySelectorAll('[data-span="8"],[data-span="4"]').length).toBe(2);
  });
});

describe('compare', () => {
  it('aligns by days before the event', () => {
    const e1 = Date.UTC(2026, 9, 10);
    const e2 = Date.UTC(2025, 9, 20);
    const s = alignComparison(
      [
        { id: 'this', label: '2026', frame: frameFromArrays(e1 - 3 * DAY, DAY, { value: [1, 2, 3] }), event: e1 },
        { id: 'last', label: '2025', frame: frameFromArrays(e2 - 3 * DAY, DAY, { value: [2, 2, 2] }), event: e2 },
      ],
      'days-before',
    );
    expect(Array.from(s[0].xs)).toEqual([-3, -2, -1]);
    expect(Array.from(s[1].xs)).toEqual([-3, -2, -1]);
    expect(s[0].role).toBe('primary');
    expect(s[1].dashed).toBe(true);
    expect(valuesAt(s, -2).map((v) => v.value)).toEqual([2, 2]);
    expect(Array.from(cumulative([1, Number.NaN, 2]))).toEqual([1, Number.NaN, 3]);
  });
});

describe('tiles, insights, feed', () => {
  it('tile is a button when it opens a section', () => {
    const onOpen = vi.fn();
    render(<StatTile label="Sales" value={10} onOpen={onOpen} />);
    fireEvent.click(screen.getByRole('button', { name: /Sales/ }));
    expect(onOpen).toHaveBeenCalled();
  });
  it('insights sort risks first and collapse', () => {
    render(
      <InsightList
        title="Needs attention"
        collapseAfter={1}
        items={[
          { id: 'w', tone: 'warn', title: 'Warn' },
          { id: 'r', tone: 'risk', title: 'Risk' },
        ]}
      />,
    );
    expect(screen.getByText('Risk')).toBeInTheDocument();
    expect(screen.queryByText('Warn')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '1 more' }));
    expect(screen.getByText('Warn')).toBeInTheDocument();
  });
  it('feed groups by day', () => {
    const t = Date.UTC(2026, 9, 5, 12);
    render(
      <ActivityFeed
        aria-label="Purchases"
        now={t}
        items={[
          { id: '1', at: t - 60_000, title: 'VIP × 2', amount: '+$240', tone: 'positive' },
          { id: '2', at: t - DAY, title: 'Floor × 1', amount: '−$40', tone: 'negative' },
        ]}
      />,
    );
    expect(screen.getByRole('log')).toHaveTextContent('Oct 5');
    expect(screen.getByRole('log')).toHaveTextContent('Oct 4');
    expect(screen.getByText('1 minute ago')).toBeInTheDocument();
  });
});
