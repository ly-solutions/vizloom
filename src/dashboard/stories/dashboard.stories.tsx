import type { Meta, StoryObj } from '@storybook/react';
import { useEffect, useState } from 'react';

import { currencyUnit, seriesColor, UNIT_COUNT, UNIT_PERCENT, useFormat } from '../../core';
import {
  ActivityFeed,
  CalcCard,
  ChartCard,
  DashboardGrid,
  GridItem,
  InfoHint,
  InsightList,
  KpiStrip,
  LiveIndicator,
  Segmented,
  StatTile,
  Tabs,
  TileRow,
  startLiveSimulation,
  type KpiItem,
} from '..';
import { dailyTotals, makeOrders, NOW, PRICES, TICKET_SERIES } from '../../../stories/demo-data';
import { MiniBars, SplitStrip } from './mini';

const meta: Meta = { title: 'Dashboard/Blocks' };
export default meta;
type Story = StoryObj;

const USD = currencyUnit('USD');

const revenueCalc = (
  <CalcCard
    title="How revenue is calculated"
    formula="Turnover − refunds − service fee"
    lines={[
      { label: 'Turnover', value: '$128,400' },
      { label: 'Refunds', value: '−$3,120' },
      { label: 'Service fee 6%', value: '−$7,517' },
    ]}
    result={{ label: 'Revenue', value: '$117,763' }}
    note="Fees are taken when a payout is made."
    source="Orders and refunds, updated every minute."
  />
);

const KPIS: KpiItem[] = [
  {
    id: 'turnover',
    label: 'Turnover',
    value: 128400,
    unit: USD,
    delta: 12,
    deltaSuffix: 'vs last week',
    sub: 'after refunds',
    info: 'All payments for tickets, minus refunds.',
  },
  { id: 'revenue', label: 'Revenue', value: 117763, unit: USD, delta: 9, sub: 'without service fee', info: revenueCalc },
  { id: 'tickets', label: 'Tickets sold', value: 2874, unit: UNIT_COUNT, delta: 18, sub: '1,912 orders' },
  { id: 'guests', label: 'Guests', value: 2611, unit: UNIT_COUNT, delta: -3, sub: 'checked in 0%' },
  { id: 'avg', label: 'Average ticket', value: 44.7, format: (v) => `$${v.toFixed(2)}`, delta: 0.2 },
  { id: 'refunds', label: 'Refunds', value: 3120, unit: USD, delta: 27, invert: true, tone: 'negative', sub: '71 tickets' },
];

export const KpiStripStory: Story = {
  name: 'KPI strip',
  render: () => <KpiStrip aria-label="Key metrics" items={KPIS} />,
};

export const KpiGrid: Story = {
  name: 'KPI grid with sparklines',
  render: () => (
    <KpiStrip
      variant="grid"
      items={KPIS.slice(0, 4).map((k, i) => ({
        ...k,
        visual: <MiniBars values={dailyTotals(undefined, 14).map((v, j) => v * (1 + ((i + j) % 3) * 0.1))} color={seriesColor(i)} />,
      }))}
    />
  ),
};

export const KpiStates: Story = {
  name: 'KPI states',
  render: () => (
    <KpiStrip
      items={[
        { ...KPIS[0], state: { status: 'loading' } },
        { ...KPIS[1], state: { status: 'no-access' } },
        { ...KPIS[2], state: { status: 'empty', title: 'No sales yet', reason: 'Starts Oct 12' } },
        { ...KPIS[3], state: { status: 'error', onRetry: () => undefined } },
        { ...KPIS[4], state: { status: 'partial' } },
      ]}
    />
  ),
};

export const KpiLive: Story = {
  name: 'KPI live (count-up, +N bump, pulse)',
  render: function Render() {
    const [tickets, setTickets] = useState(2874);
    const [at, setAt] = useState(NOW);
    useEffect(
      () =>
        startLiveSimulation((n, t) => {
          setTickets((v) => v + n);
          setAt(t);
        }),
      [],
    );
    return (
      <div className="sb-stack">
        <LiveIndicator updatedAt={at} />
        <KpiStrip
          items={[
            { ...KPIS[0], value: 128400 + (tickets - 2874) * 45 },
            { ...KPIS[2], value: tickets },
            { ...KPIS[4], value: (128400 + (tickets - 2874) * 45) / tickets, format: (v) => `$${v.toFixed(2)}` },
          ]}
        />
      </div>
    );
  },
};

export const KpiPhone: Story = {
  name: 'KPI strip — phone (scroll-snap)',
  parameters: { viewport: { defaultViewport: 'phone' } },
  render: () => <KpiStrip items={KPIS} />,
};

function Placeholder({ label = 'chart' }: { label?: string }) {
  return <div className="sb-box sb-box--tall sb-placeholder">{label}</div>;
}

export const Card: Story = {
  name: 'Chart card — header, ?, actions, tabs, segments',
  render: function Render() {
    const [mode, setMode] = useState<'day' | 'hour' | 'type'>('day');
    const [metric, setMetric] = useState<'tickets' | 'turnover'>('tickets');
    return (
      <ChartCard
        title="Sales by day"
        info="Tickets sold per day, stacked by ticket type. Drag to pan, pinch or scroll to zoom."
        description="Aug 17 – Oct 9 · all ticket types"
        status={<LiveIndicator updatedAt={NOW} />}
        actions={
          <Segmented
            aria-label="Metric"
            size="s"
            value={metric}
            onChange={setMetric}
            options={[
              { value: 'tickets', label: 'Tickets' },
              { value: 'turnover', label: 'Turnover' },
            ]}
          />
        }
        tabs={
          <Tabs
            aria-label="View"
            value={mode}
            onChange={setMode}
            tabs={[
              { value: 'day', label: 'By day' },
              { value: 'hour', label: 'By hour' },
              { value: 'type', label: 'By type' },
            ]}
          />
        }
        footer="Times in UTC"
      >
        <Placeholder label={`${metric} · ${mode}`} />
      </ChartCard>
    );
  },
};

export const CardStates: Story = {
  name: 'Chart card — five states',
  render: () => (
    <DashboardGrid>
      {(
        [
          { status: 'loading' },
          { status: 'empty', reason: 'No promo codes were used in this period.' },
          { status: 'no-access', reason: 'Finance data is visible to owners only.' },
          { status: 'error', onRetry: () => undefined },
          { status: 'partial', reason: 'Last 2 hours are still being collected.' },
        ] as const
      ).map((state, i) => (
        <ChartCard
          key={state.status}
          title={`State: ${state.status}`}
          span={i < 3 ? 4 : 6}
          state={state}
          skeleton={i % 2 ? 'bars' : 'chart'}
          bodyHeight={180}
        >
          <Placeholder />
        </ChartCard>
      ))}
    </DashboardGrid>
  ),
};

export const Grid: Story = {
  name: 'Grid — 12 columns, container queries',
  render: () => (
    <DashboardGrid>
      <GridItem span={12}>
        <KpiStrip items={KPIS} />
      </GridItem>
      <ChartCard title="span 8" span={8}>
        <Placeholder />
      </ChartCard>
      <ChartCard title="span 4" span={4}>
        <Placeholder />
      </ChartCard>
      {[1, 2, 3].map((i) => (
        <ChartCard key={i} title={`span 4 · ${i}`} span={4}>
          <Placeholder />
        </ChartCard>
      ))}
      <ChartCard title="span 6" span={6}>
        <Placeholder />
      </ChartCard>
      <ChartCard title="span 6" span={6}>
        <Placeholder />
      </ChartCard>
    </DashboardGrid>
  ),
};

export const GridPhone: Story = { ...Grid, name: 'Grid — phone', parameters: { viewport: { defaultViewport: 'phone' } } };

export const Hints: Story = {
  name: 'Info hint — text and calculation card',
  render: () => (
    <div className="sb-row">
      <span>Turnover</span>
      <InfoHint>All payments for tickets, minus refunds. Updated every minute.</InfoHint>
      <span>Revenue</span>
      <InfoHint label="How revenue is calculated">{revenueCalc}</InfoHint>
    </div>
  ),
};

export const Tiles: Story = {
  name: 'Section tiles',
  render: () => {
    const days = dailyTotals(undefined, 14);
    return (
      <TileRow aria-label="Sections">
        <StatTile
          label="Sales"
          value={2874}
          unit={UNIT_COUNT}
          delta={18}
          tone={0}
          onOpen={() => undefined}
          visual={<MiniBars values={days} />}
        />
        <StatTile
          label="Audience"
          value={3.8}
          unit={UNIT_PERCENT}
          delta={-0.4}
          sub="conversion"
          tone={4}
          onOpen={() => undefined}
          visual={<MiniBars values={days.map((v) => v * 0.7)} />}
        />
        <StatTile
          label="Money"
          value={117763}
          unit={USD}
          delta={9}
          tone={5}
          onOpen={() => undefined}
          visual={
            <SplitStrip
              parts={[
                { share: 0.5, color: 'var(--vl-cat-6)' },
                { share: 0.3, color: 'var(--vl-cat-2)' },
                { share: 0.2, color: 'var(--vl-cat-other)' },
              ]}
            />
          }
        />
        <StatTile label="Check-in" value={0} empty emptyText="Opens on event day" tone={2} visual={<MiniBars values={days} />} />
        <StatTile label="Marketing" value={0} loading tone={3} />
      </TileRow>
    );
  },
};

export const TilesPhone: Story = { ...Tiles, name: 'Section tiles — phone', parameters: { viewport: { defaultViewport: 'phone' } } };

export const Insights: Story = {
  name: 'Needs attention',
  render: () => (
    <InsightList
      title="Needs attention"
      collapseAfter={3}
      items={[
        {
          id: '1',
          tone: 'warn',
          title: 'Dance floor: 84 left',
          detail: 'At the current pace sells out in ~4 days',
          visual: (
            <SplitStrip
              parts={[
                { share: 0.92, color: 'var(--vl-warning)' },
                { share: 0.08, color: 'var(--vl-neutral-soft)' },
              ]}
            />
          ),
        },
        {
          id: '2',
          tone: 'risk',
          title: '86% drop off at payment',
          detail: 'Usual is 40%',
          action: { label: 'Open funnel', onClick: () => undefined },
        },
        { id: '3', tone: 'risk', title: 'Partner link: 0 purchases', detail: '214 visits in 7 days' },
        { id: '4', tone: 'info', title: 'VIP ends in ~2 days', detail: '12 of 150 left' },
        { id: '5', tone: 'warn', title: 'Sales this week −14%', detail: 'vs previous week' },
      ]}
    />
  ),
};

export const Feed: Story = {
  name: 'Activity feed — live',
  render: function Render() {
    const format = useFormat();
    const [orders, setOrders] = useState(() => makeOrders(24));
    useEffect(
      () =>
        startLiveSimulation((n, at) => {
          setOrders((o) => [{ ...o[Math.floor(Math.random() * o.length)], id: `live-${at}`, at, qty: n }, ...o].slice(0, 60));
        }),
      [],
    );
    const label = (t: string) => TICKET_SERIES.find((s) => s.id === t)?.label ?? t;
    return (
      <ChartCard title="Purchases" status={<LiveIndicator updatedAt={orders[0].at} />} variant="card">
        <ActivityFeed
          aria-label="Purchases"
          maxHeight={360}
          items={orders.map((o) => ({
            id: o.id,
            at: o.at,
            title: `${label(o.type)} × ${o.qty}`,
            sub: `${o.buyer} · ${o.channel}`,
            amount: `${o.refund ? '−' : '+'}${format.currency(o.qty * PRICES[o.type], 'USD')}`,
            tone: o.refund ? 'negative' : 'positive',
          }))}
        />
      </ChartCard>
    );
  },
};
