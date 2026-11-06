import type { Meta, StoryObj } from '@storybook/react';
import { useEffect, useMemo, useState } from 'react';

import { currencyUnit, DAY } from '../../core';
import { paceStats, type PaceInput } from '../model/pace';
import { DEMO_START, demoDailySales, demoHistory } from './demo-data';
import { PaceChart } from './pace-chart';
import { SelloutStats } from './sellout-stats';

import './stories.css';

interface PaceDemoProps {
  readonly elapsed: number;
  readonly factor: number;
  readonly target: number | null;
  readonly history: number;
  readonly stallLast: number;
  readonly status: 'ready' | 'loading' | 'error' | 'empty' | 'no-access';
  readonly money: boolean;
  readonly summary: boolean;
  readonly live: boolean;
  readonly height: number;
  readonly width: 'card' | 'wide' | 'small';
}

const DAYS = 40;

/** Daily sales capped by what is left in the hall: the total never exceeds capacity. */
function capped(daily: readonly number[], target: number | null): number[] {
  if (target === null) return [...daily];
  let left = target;
  return daily.map((d) => {
    const v = Math.min(left, d);
    left -= v;
    return v;
  });
}

function PaceDemo({ elapsed, factor, target, history, stallLast, status, money, summary, live, height, width }: PaceDemoProps) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => setTick((t) => (t + 1) % (DAYS - elapsed + 1)), 1600);
    return () => clearInterval(id);
  }, [live, elapsed]);
  const shownDays = Math.min(DAYS, elapsed + tick);
  const price = 45;
  const daily = useMemo(() => {
    const units = capped(demoDailySales(shownDays, factor, 7, stallLast), target);
    return money ? units.map((u) => u * price) : units;
  }, [shownDays, factor, stallLast, target, money]);
  const input: PaceInput = {
    start: DEMO_START,
    event: DEMO_START + DAYS * DAY,
    daily,
    target: target === null ? undefined : target * (money ? price : 1),
    history: history > 0 ? demoHistory(history) : undefined,
  };
  const pace = paceStats(input);
  return (
    <div className={`sb-biz-frame sb-biz-frame--${width}`}>
      <PaceChart
        title="Sales pace"
        description="Cumulative tickets sold against past events"
        pace={pace}
        daily={daily}
        unit={money ? currencyUnit('USD') : undefined}
        state={status === 'ready' ? undefined : { status }}
        summary={summary}
        height={height}
      />
    </div>
  );
}

const meta = {
  title: 'Charts/Business/PaceChart',
  component: PaceDemo,
  args: {
    elapsed: 26,
    factor: 1,
    target: 2400,
    history: 6,
    stallLast: 0,
    status: 'ready',
    money: false,
    summary: true,
    live: false,
    height: 276,
    width: 'card',
  },
  argTypes: {
    status: { control: 'inline-radio', options: ['ready', 'loading', 'error', 'empty', 'no-access'] },
    width: { control: 'inline-radio', options: ['small', 'card', 'wide'] },
    factor: { control: { type: 'range', min: 0.3, max: 4, step: 0.1 } },
    elapsed: { control: { type: 'range', min: 1, max: 40, step: 1 } },
    history: { control: { type: 'range', min: 0, max: 8, step: 1 } },
  },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof PaceDemo>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const OnTrackToSellOut: Story = { args: { factor: 3.2 } };
export const OffTrack: Story = { args: { factor: 0.8 } };
export const SoldOut: Story = { args: { factor: 7 } };
export const SalesStalled: Story = { args: { stallLast: 7 } };
/** One past event: the usual curve, no range. */
export const FewPastEvents: Story = { args: { history: 1 } };
/** No history: compared with an even plan to capacity. */
export const AgainstPlan: Story = { args: { history: 0 } };
/** No capacity and no history: nothing to compare with — the headline shows the total. */
export const NothingToCompare: Story = { args: { history: 0, target: null } };
export const FirstDays: Story = { args: { elapsed: 3 } };
export const EventDay: Story = { args: { elapsed: 40, factor: 1.6 } };
export const Revenue: Story = { args: { money: true } };
export const NoHeadline: Story = { args: { summary: false } };
export const Live: Story = { args: { live: true, elapsed: 20 } };
export const Loading: Story = { args: { status: 'loading' } };
export const LoadError: Story = { args: { status: 'error' } };
export const Empty: Story = { args: { status: 'empty' } };
export const NoAccess: Story = { args: { status: 'no-access' } };
export const SmallCard: Story = { args: { width: 'small', height: 220 } };
export const Wide: Story = { args: { width: 'wide', height: 340 } };
export const Phone: Story = { parameters: { viewport: { defaultViewport: 'phone' } } };
export const PhoneSmall: Story = { args: { factor: 0.8 }, parameters: { viewport: { defaultViewport: 'phoneSmall' } } };

/** Sell-out rows from the same pace result: sold, speed, days to sell-out, left. */
function SelloutDemo({ factor, loading }: { readonly factor: number; readonly loading: boolean }) {
  const daily = capped(demoDailySales(26, factor), 2400);
  const pace = paceStats({ start: DEMO_START, event: DEMO_START + DAYS * DAY, daily, target: 2400, history: demoHistory(6) });
  return (
    <div className="sb-biz-frame sb-biz-frame--small">
      <SelloutStats pace={pace} loading={loading} />
    </div>
  );
}
export const SelloutRows: StoryObj = {
  render: () => (
    <div className="sb-biz-row">
      <SelloutDemo factor={3.2} loading={false} />
      <SelloutDemo factor={0.8} loading={false} />
      <SelloutDemo factor={7} loading={false} />
      <SelloutDemo factor={1} loading />
    </div>
  ),
};
