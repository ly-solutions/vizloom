import type { Meta, StoryObj } from '@storybook/react';
import { useEffect, useMemo, useState } from 'react';

import { currencyUnit, UNIT_COUNT, useViewport } from '../../core';
import { refundStats } from '../model/refunds';
import { DEMO_START, demoRefunds } from './demo-data';
import { RefundsChart } from './refunds-chart';

import './stories.css';

interface RefundsDemoProps {
  readonly days: number;
  readonly wave: boolean;
  readonly noRefunds: boolean;
  readonly overRefund: boolean;
  readonly status: 'ready' | 'loading' | 'error' | 'empty' | 'no-access';
  readonly tickets: boolean;
  readonly summary: boolean;
  readonly zoomControls: boolean;
  readonly live: boolean;
  readonly height: number;
  readonly width: 'card' | 'wide' | 'small';
}

function RefundsDemo({ days, wave, noRefunds, overRefund, status, tickets, summary, zoomControls, live, height, width }: RefundsDemoProps) {
  const [extra, setExtra] = useState(0);
  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => setExtra((n) => (n + 1) % 30), 2000);
    return () => clearInterval(id);
  }, [live]);
  const refunds = useMemo(() => {
    const { sales, refunds: back } = demoRefunds(days + extra, 11, wave);
    const scale = tickets ? 1 / 45 : 1;
    const s = sales.map((v) => Math.round(v * scale));
    let r = back.map((v) => (noRefunds ? 0 : Math.round(v * scale)));
    if (overRefund) r = r.map((v, i) => (i === Math.floor(days / 3) ? s[i] * 2.4 : v));
    return refundStats({ start: DEMO_START, sales: s, refunds: r });
  }, [days, extra, wave, noRefunds, overRefund, tickets]);
  return (
    <div className={`sb-biz-frame sb-biz-frame--${width}`}>
      <RefundsChart
        title="Revenue after refunds"
        refunds={refunds}
        unit={tickets ? UNIT_COUNT : currencyUnit('USD')}
        state={status === 'ready' ? undefined : { status }}
        summary={summary}
        zoomControls={zoomControls}
        height={height}
      />
    </div>
  );
}

const meta = {
  title: 'Charts/Business/RefundsChart',
  component: RefundsDemo,
  args: {
    days: 60,
    wave: true,
    noRefunds: false,
    overRefund: false,
    status: 'ready',
    tickets: false,
    summary: true,
    zoomControls: true,
    live: false,
    height: 258,
    width: 'card',
  },
  argTypes: {
    status: { control: 'inline-radio', options: ['ready', 'loading', 'error', 'empty', 'no-access'] },
    width: { control: 'inline-radio', options: ['small', 'card', 'wide'] },
    days: { control: { type: 'range', min: 2, max: 365, step: 1 } },
  },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof RefundsDemo>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const NoRefunds: Story = { args: { noRefunds: true } };
/** A day refunded more than it sold: "kept" goes below zero. */
export const RefundedMoreThanSold: Story = { args: { overRefund: true } };
export const Tickets: Story = { args: { tickets: true } };
export const ShortPeriod: Story = { args: { days: 5 } };
/** A year of days: zoom with ctrl + wheel, pinch or the buttons; drag to pan. */
export const LongPeriod: Story = { args: { days: 365 } };
export const Live: Story = { args: { live: true } };
export const NoHeadline: Story = { args: { summary: false, zoomControls: false } };
export const Loading: Story = { args: { status: 'loading' } };
export const LoadError: Story = { args: { status: 'error' } };
export const Empty: Story = { args: { status: 'empty' } };
export const NoAccess: Story = { args: { status: 'no-access' } };
export const SmallCard: Story = { args: { width: 'small', height: 220 } };
export const Wide: Story = { args: { width: 'wide', height: 320 } };
export const Phone: Story = { parameters: { viewport: { defaultViewport: 'phone' } } };

/** Two charts on one shared window: zooming one moves the other. */
function SharedWindowDemo() {
  const a = useMemo(() => {
    const { sales, refunds } = demoRefunds(90, 11, true);
    return refundStats({ start: DEMO_START, sales, refunds });
  }, []);
  const b = useMemo(() => {
    const { sales, refunds } = demoRefunds(90, 23, false);
    return refundStats({ start: DEMO_START, sales, refunds });
  }, []);
  const viewport = useViewport({ extent: { start: DEMO_START, end: DEMO_START + 89 * 86_400_000 }, minSpan: 7 * 86_400_000 });
  return (
    <div className="sb-biz-frame sb-biz-frame--card">
      <RefundsChart title="Arena" refunds={a} viewport={viewport} />
      <RefundsChart title="Club" refunds={b} viewport={viewport} zoomControls={false} />
    </div>
  );
}
export const SharedWindow: StoryObj = { render: () => <SharedWindowDemo /> };
