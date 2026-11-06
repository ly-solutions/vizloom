import type { Meta, StoryObj } from '@storybook/react';
import { useEffect, useState } from 'react';

import { FunnelChart, type FunnelChartProps } from './funnel-chart';

const steps = [
  { id: 'visit', label: 'Event page', value: 10641 },
  { id: 'select', label: 'Choose tickets', value: 3090 },
  { id: 'cart', label: 'Cart', value: 1710 },
  { id: 'checkout', label: 'Checkout', value: 940 },
  { id: 'paid', label: 'Paid', value: 499 },
];

const longLabels = [
  { id: 'a', label: 'Landing page of the summer open-air festival', value: 8200 },
  { id: 'b', label: 'Seat map and ticket category selection', value: 2400 },
  { id: 'c', label: 'Attendee details and delivery method', value: 1500 },
  { id: 'd', label: 'Payment confirmation by the bank', value: 900 },
];

const many = Array.from({ length: 9 }, (_, i) => ({ id: `s${i}`, label: `Step ${i + 1}`, value: Math.round(12000 * 0.72 ** i) }));

const meta: Meta<typeof FunnelChart> = {
  title: 'Charts/Shapes/Funnel',
  component: FunnelChart,
  args: { title: 'Ticket purchase funnel', steps },
  argTypes: { variant: { control: 'inline-radio', options: ['funnel', 'columns', 'dropoff', 'flow'] } },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 720 }}>
        <Story />
      </div>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof FunnelChart>;

export const Funnel: Story = { args: { variant: 'funnel' } };
export const Columns: Story = { args: { variant: 'columns' } };
export const Dropoff: Story = { args: { variant: 'dropoff' } };
export const Flow: Story = { args: { variant: 'flow' } };
export const NoSummary: Story = { args: { summary: false } };
export const SmallCard: Story = {
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 320 }}>
        <Story />
      </div>
    ),
  ],
};
export const SmallCardColumns: Story = { ...SmallCard, args: { variant: 'columns' } };
export const Wide: Story = {
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 1100 }}>
        <Story />
      </div>
    ),
  ],
  args: { variant: 'flow', height: 340 },
};
export const LongLabels: Story = { args: { steps: longLabels } };
export const LongLabelsColumns: Story = { args: { steps: longLabels, variant: 'columns' } };
export const ManySteps: Story = { args: { steps: many } };
export const ManyStepsFlow: Story = { args: { steps: many, variant: 'flow' } };
export const GapInData: Story = {
  args: { steps: [steps[0], { ...steps[1], value: Number.NaN }, steps[2], steps[3], steps[4]], title: 'Funnel with an untracked step' },
};
export const SkippedStep: Story = {
  args: {
    steps: [steps[0], steps[1], { id: 'direct', label: 'Direct link to cart', value: 3400 }, steps[3], steps[4]],
    variant: 'dropoff',
  },
};
export const Empty: Story = { args: { steps: [] } };
export const Loading: Story = { args: { state: { status: 'loading' } } };
export const LoadingColumns: Story = { args: { state: { status: 'loading' }, variant: 'columns' } };
export const ErrorState: Story = { args: { state: { status: 'error', onRetry: () => undefined } } };
export const NoAccess: Story = { args: { state: { status: 'no-access' } } };
export const Partial: Story = { args: { state: { status: 'partial', reason: 'Checkout events are still being collected.' } } };

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
export const PhoneColumns: Story = { ...Phone, args: { variant: 'columns' } };
export const PhoneFlowManySteps: Story = { ...Phone, args: { variant: 'flow', steps: many } };

function LiveDemo(args: FunnelChartProps) {
  const [values, setValues] = useState<number[]>(steps.map((s) => s.value));
  useEffect(() => {
    const id = setInterval(() => {
      setValues((prev) => {
        const first = Math.max(2000, Math.round(prev[0] + (Math.random() - 0.4) * 1500));
        const rates = [0.29, 0.55, 0.55, 0.53].map((r) => r + (Math.random() - 0.5) * 0.12);
        const out = [first];
        rates.forEach((r, i) => out.push(Math.round(out[i] * r)));
        return out;
      });
    }, 2200);
    return () => clearInterval(id);
  }, []);
  return <FunnelChart {...args} steps={steps.map((s, i) => ({ ...s, value: values[i] }))} />;
}
export const LiveUpdates: Story = { render: (args) => <LiveDemo {...args} />, args: { variant: 'dropoff' } };
