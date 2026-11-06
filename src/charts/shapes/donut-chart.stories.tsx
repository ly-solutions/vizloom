import type { Meta, StoryObj } from '@storybook/react';
import { useEffect, useState } from 'react';

import { currencyUnit, type Datum } from '../../core';
import { DonutChart, type DonutChartProps } from './donut-chart';

const channels: Datum[] = [
  { key: 'web', label: 'Website', value: 5240 },
  { key: 'app', label: 'Mobile app', value: 3180 },
  { key: 'partners', label: 'Partner sites', value: 1460 },
  { key: 'box', label: 'Box office', value: 820 },
  { key: 'promo', label: 'Promo codes', value: 210 },
];

const venues: Datum[] = [
  'Riverside Arena',
  'Old Town Theatre',
  'Harbour Hall',
  'The Foundry',
  'Grand Concert Hall',
  'Lakeside Amphitheatre',
  'North Station Club',
  'Botanical Garden Stage',
  'City Opera House',
  'Rooftop 21',
  'Library Courtyard',
  'Sunset Pier',
  'Warehouse No. 4',
  'Skyline Lounge',
].map((label, i) => ({ key: `v${i}`, label, value: Math.round(4200 / (i + 1.4)) }));

const tiny: Datum[] = [
  { key: 'a', label: 'Main hall', value: 9800 },
  { key: 'b', label: 'Balcony', value: 40 },
  { key: 'c', label: 'Backstage', value: 12 },
];

const longLabels: Datum[] = [
  { key: 'a', label: 'Annual open-air summer festival of jazz and blues, main stage, evening session', value: 420 },
  { key: 'b', label: 'Chamber orchestra: complete cycle of string quartets, season subscription', value: 310 },
  { key: 'c', label: 'Stand-up marathon', value: 190 },
];

const meta: Meta<typeof DonutChart> = {
  title: 'Charts/Shapes/Donut',
  component: DonutChart,
  args: { title: 'Tickets by channel', data: channels },
  argTypes: {
    variant: { control: 'inline-radio', options: ['ring', 'pie', 'semi'] },
    sort: { control: 'inline-radio', options: ['none', 'desc', 'asc'] },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 640 }}>
        <Story />
      </div>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof DonutChart>;

export const Default: Story = {};
export const Pie: Story = { args: { variant: 'pie', title: 'Tickets by channel (pie)' } };
export const Semi: Story = { args: { variant: 'semi', title: 'Tickets by channel (half ring)' } };
export const Sorted: Story = { args: { sort: 'desc' } };
export const Currency: Story = { args: { unit: currencyUnit('USD'), title: 'Revenue by channel', caption: 'Revenue' } };
export const CustomCenter: Story = { args: { centerValue: '10.9k', caption: 'tickets sold' } };
export const NoLegend: Story = {
  args: { legend: false },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 240 }}>
        <Story />
      </div>
    ),
  ],
};
export const SmallCard: Story = {
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 300 }}>
        <Story />
      </div>
    ),
  ],
};
export const Wide: Story = {
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 960 }}>
        <Story />
      </div>
    ),
  ],
  args: { height: 260 },
};
export const ThinSlices: Story = { args: { data: tiny, title: 'Seats sold by zone' } };
export const SingleItem: Story = { args: { data: [channels[0]], title: 'Only one channel' } };
export const LongLabels: Story = { args: { data: longLabels, title: 'Tickets by event' } };
export const ManyItemsCollapsed: Story = { args: { data: venues, title: 'Tickets by venue', visibleRows: 6, sort: 'desc' } };
export const ManyItemsVisible10: Story = { args: { data: venues, title: 'Tickets by venue', visibleRows: 10, sort: 'desc' } };
export const Empty: Story = { args: { data: [] } };
export const Loading: Story = { args: { state: { status: 'loading' } } };
export const ErrorState: Story = { args: { state: { status: 'error', onRetry: () => undefined } } };
export const NoAccess: Story = { args: { state: { status: 'no-access' } } };
export const Partial: Story = { args: { state: { status: 'partial' } } };
export const CustomTooltip: Story = {
  args: {
    tooltip: (ctx) => (
      <div>
        {ctx.title}: {ctx.rows[0]?.value} ({ctx.rows[0]?.note})
      </div>
    ),
  },
};

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
export const PhoneManyItems: Story = {
  ...Phone,
  args: { data: venues, title: 'Tickets by venue', visibleRows: 5, sort: 'desc' },
};

function ControlledDemo(args: DonutChartProps) {
  const [key, setKey] = useState<string | null>('app');
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {channels.map((c) => (
          <button key={c.key} type="button" onClick={() => setKey(key === c.key ? null : c.key)} aria-pressed={key === c.key}>
            {c.label}
          </button>
        ))}
      </div>
      <DonutChart {...args} highlight={key} onHighlight={setKey} />
    </div>
  );
}

function LiveDemo(args: DonutChartProps) {
  const [data, setData] = useState<Datum[]>(channels);
  useEffect(() => {
    const id = setInterval(
      () => setData((prev) => prev.map((d) => ({ ...d, value: Math.max(50, Math.round(d.value + (Math.random() - 0.4) * 400)) }))),
      1800,
    );
    return () => clearInterval(id);
  }, []);
  return <DonutChart {...args} data={data} />;
}

export const ControlledHighlight: Story = { render: (args) => <ControlledDemo {...args} /> };
export const LiveUpdates: Story = { render: (args) => <LiveDemo {...args} /> };
