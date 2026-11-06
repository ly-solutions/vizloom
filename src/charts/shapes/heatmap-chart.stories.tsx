import type { Meta, StoryObj } from '@storybook/react';
import { useEffect, useState } from 'react';

import { fixedOffsetZone, type HourlySeries, VizProvider } from '../../core';
import { HeatmapChart, type HeatmapChartProps } from './heatmap-chart';

/** Deterministic pseudo-random in [0, 1): demo data must not change between renders. */
function noise(seed: number): number {
  const x = Math.sin(seed * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

/** Ticket sales: evenings and weekends are hot, nights are quiet. */
function demoGrid(seed = 1, scale = 1): number[][] {
  return Array.from({ length: 7 }, (_, day) =>
    Array.from({ length: 24 }, (_, hour) => {
      const evening = Math.exp(-(((hour - 20) / 3) ** 2));
      const lunch = 0.45 * Math.exp(-(((hour - 13) / 2) ** 2));
      const weekend = day >= 4 ? 1.35 : 1;
      const base = (evening + lunch + 0.04) * weekend * 60 * scale;
      return Math.round(base * (0.7 + noise(seed + day * 31 + hour) * 0.6));
    }),
  );
}

/** A month of hourly sales in UTC for the time-zone story. */
function demoHourly(): HourlySeries<'sales'> {
  const start = Date.UTC(2026, 9, 5, 0, 0);
  const length = 28 * 24;
  const sales = new Array<number>(length);
  for (let i = 0; i < length; i++) {
    const hourUtc = i % 24;
    const mskHour = (hourUtc + 3) % 24;
    sales[i] = Math.round(Math.exp(-(((mskHour - 20) / 3) ** 2)) * 40 * (0.7 + noise(i) * 0.6));
  }
  return { start, length, values: { sales } };
}

const withGaps = demoGrid(3).map((row, day) => row.map((v, hour) => (day === 2 && hour >= 2 && hour <= 6 ? Number.NaN : v)));
const sparse = demoGrid(5, 0.05).map((row) => row.map((v) => (v < 2 ? 0 : v)));

const meta: Meta<typeof HeatmapChart> = {
  title: 'Charts/Shapes/Heatmap',
  component: HeatmapChart,
  args: { title: 'Ticket sales by weekday and hour', grid: demoGrid() },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 760 }}>
        <Story />
      </div>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof HeatmapChart>;

export const Default: Story = {};
export const NoTotals: Story = { args: { totals: false } };
export const NoSummaryNoScale: Story = { args: { summary: false, scale: false } };
export const CurrencyValues: Story = { args: { formatValue: (v) => `$${v * 24}`, title: 'Revenue by weekday and hour' } };
export const GapsInData: Story = { args: { grid: withGaps, title: 'Collection outage on Wednesday night' } };
export const SparseSales: Story = { args: { grid: sparse, title: 'Quiet event: many empty slots' } };
export const SmallCard: Story = {
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 360 }}>
        <Story />
      </div>
    ),
  ],
};
export const Wide: Story = {
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 1200 }}>
        <Story />
      </div>
    ),
  ],
};
export const Empty: Story = { args: { grid: Array.from({ length: 7 }, () => new Array<number>(24).fill(0)) } };
export const Loading: Story = { args: { state: { status: 'loading' } } };
export const ErrorState: Story = { args: { state: { status: 'error', onRetry: () => undefined } } };
export const NoAccess: Story = { args: { state: { status: 'no-access' } } };
export const Partial: Story = { args: { state: { status: 'partial', reason: 'The last day is still being collected.' } } };

export const Phone: Story = {
  parameters: { viewport: { defaultViewport: 'phone' } },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 358 }}>
        <Story />
      </div>
    ),
  ],
};

function ZoneDemo(args: HeatmapChartProps) {
  const [offset, setOffset] = useState(3);
  const hourly = demoHourly();
  return (
    <div>
      <label style={{ display: 'block', marginBottom: 12 }}>
        Time zone UTC{offset >= 0 ? '+' : ''}
        {offset} <input type="range" min={-8} max={12} value={offset} onChange={(e) => setOffset(Number(e.target.value))} />
      </label>
      <VizProvider zone={fixedOffsetZone(offset)}>
        <HeatmapChart {...args} grid={undefined} hourly={hourly} />
      </VizProvider>
      <p style={{ fontSize: 12, opacity: 0.7 }}>
        The same UTC series, folded into local weekdays and hours: the evening peak moves with the zone.
      </p>
    </div>
  );
}
export const TimeZoneAware: Story = { render: (args) => <ZoneDemo {...(args as HeatmapChartProps)} /> };

function LiveDemo(args: HeatmapChartProps) {
  const [tick, setTick] = useState(1);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 2000);
    return () => clearInterval(id);
  }, []);
  return <HeatmapChart {...args} grid={demoGrid(tick, 1 + (tick % 3) * 0.3)} />;
}
export const LiveUpdates: Story = { render: (args) => <LiveDemo {...(args as HeatmapChartProps)} /> };
