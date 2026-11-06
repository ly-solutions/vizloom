import type { Meta, StoryObj } from '@storybook/react';
import { useEffect, useMemo, useState } from 'react';

import { type CompareAlign, type CompareSeries, DAY, frameFromArrays, UNIT_COUNT } from '../../src/core';
import { TimeSeriesChart } from '../../src/charts';
import { cumulative, ChartCard, KpiStrip, LiveIndicator, Segmented, startLiveSimulation } from '../../src/dashboard';
import { demoSource, EVENT, MARKERS, NOW, rng, TICKET_SERIES, totals, ZONES } from '../demo-data';

const SOLD_TOTAL = Object.values(totals()).reduce((a, b) => a + b, 0);

const meta: Meta = { title: 'Recipes/Examples', parameters: { layout: 'padded' } };
export default meta;
type Story = StoryObj;

/** Live data: the KPI and the chart follow the same simulated stream. */
function LiveDemo() {
  const source = useMemo(() => demoSource(), []);
  const [sold, setSold] = useState(SOLD_TOTAL);
  const [at, setAt] = useState(NOW);
  useEffect(
    () =>
      startLiveSimulation((n, t) => {
        setSold((s) => s + n);
        setAt(t);
      }),
    [],
  );
  return (
    <div className="sb-stack">
      <KpiStrip items={[{ id: 'sold', label: 'Tickets sold', value: sold, unit: UNIT_COUNT, sub: 'updates live' }]} />
      <ChartCard title="Sales right now" status={<LiveIndicator updatedAt={at} />}>
        <TimeSeriesChart
          title="Sales right now"
          series={TICKET_SERIES}
          source={source}
          metric="tickets"
          stack="stack"
          live
          height={260}
          extent={source.extent}
        />
      </ChartCard>
    </div>
  );
}
export const LiveData: Story = { name: 'Live data', render: () => <LiveDemo /> };

/** Zoom with tiles: the source answers per granularity; the navigator shows the whole period. */
function ZoomDemo() {
  const source = useMemo(() => demoSource({ latency: 400 }), []);
  return (
    <ChartCard
      title="Sales"
      info="Scroll, pinch or use the buttons. Finer tiles load as you zoom; the last frame stays on screen meanwhile."
    >
      <TimeSeriesChart
        title="Sales"
        series={TICKET_SERIES}
        source={source}
        metric="tickets"
        stack="stack"
        navigator
        zoomControls
        markers={MARKERS}
        zones={ZONES}
        extent={source.extent}
        height={300}
      />
    </ChartCard>
  );
}
export const ZoomWithTiles: Story = { name: 'Zoom with tiles', render: () => <ZoomDemo /> };

/** Comparison: this event against two past ones, by date or by days before the event. */
const PAST = [
  { id: 'now', label: 'This concert', event: EVENT, role: 'primary' as const, days: 44, rate: 1 },
  { id: 'spring', label: 'Spring show', event: EVENT - 180 * DAY, role: 'compare' as const, days: 60, rate: 0.8 },
  { id: 'last', label: 'Last autumn', event: EVENT - 365 * DAY, role: 'compare' as const, days: 50, rate: 1.15 },
];
const COMPARE: CompareSeries[] = PAST.map((p, k) => {
  const r = rng(20 + k);
  const daily = Array.from({ length: p.days }, (_, i) => Math.round(p.rate * (30 + 4 * i ** 1.25 + r() * 25)));
  return {
    id: p.id,
    label: p.label,
    role: p.role,
    event: p.event,
    frame: frameFromArrays(p.event - p.days * DAY, DAY, { value: Array.from(cumulative(daily)) }, 'day'),
  };
});

function CompareDemo() {
  const [align, setAlign] = useState<CompareAlign>('days-before');
  return (
    <ChartCard
      title="Pace against past events"
      actions={
        <Segmented
          aria-label="Align by"
          size="s"
          value={align}
          onChange={setAlign}
          options={[
            { value: 'days-before', label: 'Days before' },
            { value: 'date', label: 'Date' },
          ]}
        />
      }
    >
      <TimeSeriesChart
        title="Pace against past events"
        series={[]}
        compare={COMPARE}
        compareAlign={align}
        kind="line"
        unit={UNIT_COUNT}
        height={280}
      />
    </ChartCard>
  );
}
export const Compare: Story = { name: 'Comparison', render: () => <CompareDemo /> };
