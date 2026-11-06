/**
 * Example dashboards built only from the public API, on fictional data: a concert selling
 * four ticket types. Seven pages: Home, Sales, Ticket types, Audience, Marketing, Money, Check-in.
 */
import { type ReactNode, useEffect, useMemo, useState } from 'react';

import { currencyUnit, DAY, frameFromArrays, HOUR, percentChange, seriesColor, UNIT_COUNT, UNIT_PERCENT, useFormat } from '../../src/core';
import { BarChart, BarList, Gauge, Sparkline, SplitBar, TimeSeriesChart } from '../../src/charts';
import {
  ActivityFeed,
  ChartCard,
  DashboardGrid,
  InsightList,
  KpiStrip,
  LiveIndicator,
  Segmented,
  StatTile,
  Tabs,
  TileRow,
  startLiveSimulation,
  type KpiItem,
} from '../../src/dashboard';
import {
  dailyTotals,
  demoSource,
  EVENT,
  HOURLY,
  makeOrders,
  MARKERS,
  NOW,
  PRICES,
  rng,
  START,
  TICKET_SERIES,
  TICKET_TYPES,
  totals,
  ZONES,
  type DemoMetric,
} from '../demo-data';

const USD = currencyUnit('USD');

function Page({ title, meta, children }: { title: string; meta?: ReactNode; children: ReactNode }) {
  return (
    <div className="sb-page">
      <header className="sb-page__head">
        <h2 className="sb-page__title">{title}</h2>
        <span className="sb-page__meta">{meta ?? 'Northern Lights Live · Oct 24, 2026 · Riverside Hall · all time'}</span>
      </header>
      {children}
    </div>
  );
}

/** Shared live state: ticket count grows while the story is open. */
function useLive() {
  const [extra, setExtra] = useState(0);
  const [at, setAt] = useState(NOW);
  useEffect(
    () =>
      startLiveSimulation((n, t) => {
        setExtra((x) => x + n);
        setAt(t);
      }),
    [],
  );
  return { extra, at };
}

const T = totals();
const SOLD = TICKET_TYPES.reduce((s, id) => s + T[id], 0);
const TURNOVER = TICKET_TYPES.reduce((s, id) => s + T[id] * PRICES[id], 0);
const LAST7 = totals(HOURLY, NOW - 7 * DAY, NOW);
const PREV7 = totals(HOURLY, NOW - 14 * DAY, NOW - 7 * DAY);
const sum = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0);
const WEEK_DELTA = percentChange(sum(LAST7), sum(PREV7));
const CAPACITY = { floor: 3200, balcony: 1900, vip: 250, early: 1300 } as const;

function salesKpis(extra: number): KpiItem[] {
  const sold = SOLD + extra;
  const turnover = TURNOVER + extra * 45;
  const refunds = Math.round(turnover * 0.024);
  return [
    {
      id: 'turnover',
      label: 'Turnover',
      value: turnover,
      unit: USD,
      delta: WEEK_DELTA,
      deltaSuffix: 'vs prev. week',
      sub: 'after refunds',
      info: 'All ticket payments minus refunds.',
    },
    {
      id: 'revenue',
      label: 'Revenue',
      value: Math.round(turnover * 0.94 - refunds),
      unit: USD,
      delta: WEEK_DELTA - 1,
      sub: 'without service fee',
    },
    {
      id: 'sold',
      label: 'Tickets sold',
      value: sold,
      unit: UNIT_COUNT,
      delta: WEEK_DELTA + 2,
      sub: `${Math.round(sold * 0.66).toLocaleString('en-US')} orders`,
    },
    { id: 'guests', label: 'Guests', value: Math.round(sold * 0.97), unit: UNIT_COUNT, sub: 'tickets with a name' },
    { id: 'avg', label: 'Average ticket', value: turnover / sold, format: (v) => `$${v.toFixed(2)}`, delta: 1.4 },
    {
      id: 'refunds',
      label: 'Refunds',
      value: refunds,
      unit: USD,
      delta: 12,
      invert: true,
      tone: 'negative',
      sub: `${Math.round(refunds / 45)} tickets`,
    },
  ];
}

function SalesChart({
  height = 300,
  title = 'Sales by day',
  stack = true,
  live = false,
}: {
  height?: number;
  title?: string;
  stack?: boolean;
  live?: boolean;
}) {
  const [metric, setMetric] = useState<DemoMetric>('tickets');
  const source = useMemo(() => demoSource({ latency: 250 }), []);
  return (
    <ChartCard
      title={title}
      info="Tickets sold per hour, day or week — the detail follows the zoom. Drag to pan, scroll or pinch to zoom, tap a bar to pin."
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
      status={live ? <LiveIndicator updatedAt={NOW} /> : undefined}
      span={8}
    >
      <TimeSeriesChart
        title={title}
        series={TICKET_SERIES}
        source={source}
        metric={metric}
        kind="area"
        stack={stack ? 'stack' : 'overlay'}
        unit={metric === 'turnover' ? USD : UNIT_COUNT}
        markers={MARKERS}
        zones={ZONES}
        extent={source.extent}
        height={height}
        live={live}
      />
    </ChartCard>
  );
}

function TypesShare() {
  const format = useFormat();
  return (
    <ChartCard title="Sales by ticket type" span={4} info="Share of tickets sold by type for the whole period.">
      <BarList
        title="Sales by ticket type"
        scale="sum"
        showShare
        unit={UNIT_COUNT}
        items={TICKET_SERIES.map((s, i) => ({
          key: s.id,
          label: s.label,
          value: T[s.id],
          color: seriesColor(i),
          sub: format.currency(T[s.id] * PRICES[s.id], 'USD'),
        }))}
      />
      <SplitBar
        title="Ticket types"
        mini
        parts={TICKET_SERIES.map((s, i) => ({ key: s.id, label: s.label, value: T[s.id], color: seriesColor(i) }))}
      />
    </ChartCard>
  );
}

const PROMOS = [
  { key: 'friends10', label: 'FRIENDS10', value: 4280, sub: '142 of 200 · −10%' },
  { key: 'summer', label: 'SUMMERNIGHTS', value: 2910, sub: '97 uses · −15%' },
  { key: 'radio', label: 'RADIO-WAVE', value: 1820, sub: '61 of 100 · −20%' },
  { key: 'student', label: 'STUDENT', value: 1210, sub: '81 uses · −25%' },
  { key: 'press', label: 'PRESS', value: 0, sub: '0 of 20 · free', tone: 'negative' as const },
];
const LINKS = [
  { key: 'ig', label: 'Instagram bio', value: 9120, sub: '4,210 visits' },
  { key: 'news', label: 'Newsletter Oct', value: 6340, sub: '2,980 visits' },
  { key: 'partner', label: 'Partner: City Guide', value: 0, sub: '214 visits', tone: 'negative' as const },
  { key: 'ads', label: 'Social ads', value: 3880, sub: '6,770 visits' },
];

function Feed({ live }: { live: { at: number } }) {
  const format = useFormat();
  const [orders, setOrders] = useState(() => makeOrders(30));
  useEffect(() => {
    if (live.at === NOW) return;
    setOrders((o) => [{ ...o[(live.at / 1000) % o.length | 0], id: `live-${live.at}`, at: live.at, refund: false }, ...o].slice(0, 80));
  }, [live.at]);
  const label = (t: string) => TICKET_SERIES.find((s) => s.id === t)?.label ?? t;
  return (
    <ChartCard title="Purchases" span={4} status={<LiveIndicator updatedAt={live.at} />}>
      <ActivityFeed
        aria-label="Purchases"
        maxHeight={420}
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
}

export function HomePage() {
  const live = useLive();
  const days = dailyTotals(undefined, 14);
  return (
    <Page title="Overview">
      <TileRow aria-label="Sections">
        <StatTile
          label="Sales"
          value={SOLD + live.extra}
          unit={UNIT_COUNT}
          delta={WEEK_DELTA}
          tone={0}
          onOpen={() => undefined}
          visual={<Sparkline values={days} kind="bars" height={36} color="currentColor" />}
        />
        <StatTile
          label="Audience"
          value={3.8}
          unit={UNIT_PERCENT}
          delta={-0.4}
          sub="visit → purchase"
          tone={4}
          onOpen={() => undefined}
          visual={<Sparkline values={days.map((d, i) => d * (0.8 + (i % 3) * 0.1))} height={36} color="currentColor" />}
        />
        <StatTile
          label="Marketing"
          value={9120 + 6340 + 3880}
          unit={USD}
          sub="via your links"
          tone={1}
          onOpen={() => undefined}
          visual={<Sparkline values={days.map((d) => d * 0.6)} kind="area" height={36} color="currentColor" />}
        />
        <StatTile
          label="Money"
          value={Math.round(TURNOVER * 0.9)}
          unit={USD}
          tone={5}
          onOpen={() => undefined}
          visual={
            <SplitBar
              mini
              title="Payouts"
              parts={[
                { key: 'paid', label: 'Paid', value: 50, color: 'currentColor' },
                { key: 'pending', label: 'Pending', value: 50, tone: 'muted' },
              ]}
            />
          }
        />
        <StatTile
          label="Check-in"
          value={0}
          empty
          emptyText="Opens on event day"
          tone={2}
          visual={<Sparkline values={days} kind="bars" height={36} ghost />}
        />
      </TileRow>
      <InsightList
        title="Needs attention"
        collapseAfter={3}
        items={[
          {
            id: 'vip',
            tone: 'warn',
            title: 'VIP lounge: 12 left',
            detail: 'At the current pace sells out in ~2 days',
            visual: (
              <SplitBar
                mini
                title="VIP"
                parts={[
                  { key: 's', label: 'Sold', value: 138, color: 'var(--vl-warning)' },
                  { key: 'l', label: 'Left', value: 12, tone: 'muted' },
                ]}
              />
            ),
          },
          {
            id: 'pay',
            tone: 'risk',
            title: '86% drop off at payment',
            detail: 'Usual is 40% — check the payment page',
            action: { label: 'Open funnel', onClick: () => undefined },
          },
          { id: 'link', tone: 'risk', title: 'Partner: City Guide — 0 purchases', detail: '214 visits in 7 days' },
          {
            id: 'week',
            tone: 'warn',
            title: `Sales this week ${WEEK_DELTA >= 0 ? '+' : '−'}${Math.abs(Math.round(WEEK_DELTA))}%`,
            detail: 'vs the previous week',
          },
        ]}
      />
      <DashboardGrid>
        <TypesShare />
        <SalesChart live />
        <ChartCard title="Promo codes" span={4}>
          <BarList title="Promo codes" items={PROMOS} unit={USD} limit={4} />
        </ChartCard>
        <ChartCard title="Links" span={4}>
          <BarList title="Links" items={LINKS} unit={USD} limit={4} />
        </ChartCard>
        <Feed live={live} />
      </DashboardGrid>
    </Page>
  );
}

export function SalesPage() {
  const live = useLive();
  const format = useFormat();
  const left = TICKET_TYPES.map((id) => ({ id, left: Math.max(0, CAPACITY[id] - T[id]) }));
  const cap = Object.values(CAPACITY).reduce((a, b) => a + b, 0);
  const lead = [
    { key: 'm', label: 'More than a month', value: 812 },
    { key: '14', label: '14–30 days', value: 1240 },
    { key: '7', label: '7–13 days', value: 488, sub: 'starts Oct 11' },
    { key: '3', label: '3–6 days', value: 260, sub: 'ahead' },
    { key: '1', label: '1–2 days', value: 190, sub: 'ahead' },
    { key: '0', label: 'On the day', value: 140, sub: 'ahead' },
  ];
  return (
    <Page title="Sales">
      <KpiStrip items={salesKpis(live.extra)} />
      <DashboardGrid>
        <SalesChart title="Sales by day" />
        <ChartCard title="Sell-out" span={4} info="Share of the hall sold and the usual share at this point before your events.">
          <Gauge
            title="Hall sold"
            value={SOLD + live.extra}
            max={cap}
            target={cap * 0.62}
            targetLabel="Usual by now"
            sublabel={`${format.number(SOLD + live.extra)} of ${format.number(cap)}`}
          />
          <BarList
            title="Left by type"
            sort="asc"
            unit={UNIT_COUNT}
            items={left.map((l, i) => ({
              key: l.id,
              label: TICKET_SERIES[i].label,
              value: l.left,
              tone: l.left < 50 ? ('negative' as const) : undefined,
              sub: `of ${CAPACITY[l.id]}`,
            }))}
          />
        </ChartCard>
        <ChartCard title="How far ahead people buy" span={6} info="Days between purchase and the event.">
          <BarList title="Lead time" items={lead} unit={UNIT_COUNT} sort="none" showShare scale="sum" />
        </ChartCard>
        <ChartCard title="Tickets by week and type" span={6}>
          <BarChart
            title="Tickets by week and type"
            categories={Array.from({ length: 7 }, (_, w) => ({ key: `w${w}`, label: format.day(START + w * 7 * DAY) }))}
            series={TICKET_SERIES}
            values={
              Object.fromEntries(
                TICKET_TYPES.map((id) => [
                  id,
                  Array.from({ length: 7 }, (_, w) => totals(HOURLY, START + w * 7 * DAY, START + (w + 1) * 7 * DAY)[id]),
                ]),
              ) as Record<(typeof TICKET_TYPES)[number], number[]>
            }
            mode="stack"
            valueLabels
          />
        </ChartCard>
      </DashboardGrid>
    </Page>
  );
}

export function TicketTypesPage() {
  const format = useFormat();
  const [view, setView] = useState<'bars' | 'list'>('bars');
  return (
    <Page title="Ticket types">
      <KpiStrip items={salesKpis(0).slice(0, 4)} />
      <DashboardGrid>
        {TICKET_SERIES.map((s, i) => {
          const sold = T[s.id];
          const capacity = CAPACITY[s.id];
          return (
            <ChartCard
              key={s.id}
              title={s.label}
              span={3}
              description={`$${PRICES[s.id]} · ${format.percent((sold / capacity) * 100, 0)} sold`}
            >
              <Sparkline values={dailyTotals(undefined, 14).map((v) => v * (sold / SOLD))} kind="area" color={seriesColor(i)} height={40} />
              <SplitBar
                mini
                title={`${s.label} sold`}
                parts={[
                  { key: 'sold', label: 'Sold', value: sold, color: seriesColor(i) },
                  { key: 'left', label: 'Left', value: Math.max(0, capacity - sold), tone: 'muted' },
                ]}
              />
            </ChartCard>
          );
        })}
        <ChartCard
          title="Revenue by type"
          span={12}
          actions={
            <Tabs
              aria-label="View"
              value={view}
              onChange={setView}
              tabs={[
                { value: 'bars', label: 'Bars' },
                { value: 'list', label: 'List' },
              ]}
            />
          }
        >
          {view === 'bars' ? (
            <BarChart
              title="Revenue by type"
              orientation="horizontal"
              sort="desc"
              valueLabels
              unit={USD}
              colorByCategory
              data={TICKET_SERIES.map((s, i) => ({ key: s.id, label: s.label, value: T[s.id] * PRICES[s.id], slot: i }))}
            />
          ) : (
            <BarList
              title="Revenue by type"
              unit={USD}
              items={TICKET_SERIES.map((s, i) => ({ key: s.id, label: s.label, value: T[s.id] * PRICES[s.id], color: seriesColor(i) }))}
            />
          )}
        </ChartCard>
        <ChartCard title="What sales are made of" span={12} info="Share of each ticket type in daily sales.">
          <TimeSeriesChart
            title="What sales are made of"
            series={TICKET_SERIES}
            source={demoSource()}
            metric="tickets"
            stack="percent"
            kind="area"
            height={220}
            navigator={false}
            granularity="day"
          />
        </ChartCard>
      </DashboardGrid>
    </Page>
  );
}

const visits = (() => {
  const r = rng(5);
  const n = Math.floor((NOW - START) / DAY);
  const v = Array.from({ length: n }, (_, i) => Math.round(300 + 200 * Math.sin(i / 6) + r() * 160 + i * 6));
  const b = v.map((x) => Math.round(x * (0.03 + r() * 0.02)));
  return frameFromArrays(START, DAY, { visitors: v, buyers: b }, 'day');
})();

export function AudiencePage() {
  return (
    <Page title="Audience">
      <KpiStrip
        items={[
          { id: 'uv', label: 'Unique visitors', value: 31840, unit: UNIT_COUNT, delta: 6, sub: '+412 today' },
          { id: 'cr', label: 'Conversion', value: 3.8, unit: UNIT_PERCENT, delta: -0.4, sub: 'usual 4.1%' },
          { id: 'buyers', label: 'Buyers', value: 1912, unit: UNIT_COUNT, delta: 9, sub: '68% new' },
          { id: 'repeat', label: 'Came back', value: 32, unit: UNIT_PERCENT, sub: 'bought before' },
        ]}
      />
      <DashboardGrid>
        <ChartCard title="Visitors and buyers" span={8}>
          <TimeSeriesChart
            title="Visitors and buyers"
            series={[
              { id: 'visitors', label: 'Visitors', slot: 4 },
              { id: 'buyers', label: 'Buyers', slot: 0 },
            ]}
            frame={visits}
            kind="line"
            height={280}
            unit={UNIT_COUNT}
          />
        </ChartCard>
        <ChartCard title="New vs returning" span={4}>
          <SplitBar
            title="Buyers"
            parts={[
              { key: 'new', label: 'New', value: 1300 },
              { key: 'ret', label: 'Returning', value: 612 },
            ]}
            height={16}
          />
          <BarList
            title="Devices"
            scale="sum"
            showShare
            items={[
              { key: 'ios', label: 'iPhone', value: 61 },
              { key: 'and', label: 'Android', value: 27 },
              { key: 'desk', label: 'Desktop', value: 12 },
            ]}
            formatValue={(v) => `${v}%`}
          />
        </ChartCard>
        <ChartCard title="Group size" span={6}>
          <BarChart
            title="Tickets per order"
            data={['1', '2', '3', '4', '5+'].map((k, i) => ({
              key: k,
              label: `${k} ticket${k === '1' ? '' : 's'}`,
              value: [820, 640, 210, 160, 82][i],
            }))}
            valueLabels
            unit={UNIT_COUNT}
          />
        </ChartCard>
        <ChartCard title="Where buyers come from" span={6}>
          <BarChart
            title="Cities"
            orientation="horizontal"
            sort="desc"
            valueLabels
            data={['Riverside', 'North Bay', 'Lakeview', 'Old Town', 'Hillcrest', 'Other cities'].map((k, i) => ({
              key: k,
              label: k,
              value: [920, 410, 230, 160, 120, 72][i],
            }))}
          />
        </ChartCard>
      </DashboardGrid>
    </Page>
  );
}

export function MarketingPage() {
  const [metric, setMetric] = useState<'money' | 'tickets'>('money');
  return (
    <Page title="Marketing">
      <KpiStrip
        items={[
          { id: 'via', label: 'Sold via your links', value: 19340, unit: USD, sub: '71% of turnover · 430 tickets' },
          { id: 'cr', label: 'Visit → purchase', value: 4.6, unit: UNIT_PERCENT, sub: 'usual 3.9%', delta: 18 },
          { id: 'best', label: 'Best link', value: 9120, unit: USD, sub: 'Instagram bio' },
          { id: 'promo', label: 'Promo discounts', value: 1640, unit: USD, sub: '381 uses', invert: true, delta: 4 },
        ]}
      />
      <DashboardGrid>
        <ChartCard
          title="Sales by link"
          span={8}
          actions={
            <Segmented
              aria-label="Metric"
              size="s"
              value={metric}
              onChange={setMetric}
              options={[
                { value: 'money', label: '$' },
                { value: 'tickets', label: 'Tickets' },
              ]}
            />
          }
        >
          <BarChart
            title="Sales by link"
            orientation="horizontal"
            sort="desc"
            valueLabels
            unit={metric === 'money' ? USD : UNIT_COUNT}
            data={LINKS.map((l) => ({ key: l.key, label: l.label, value: metric === 'money' ? l.value : Math.round(l.value / 45) }))}
          />
        </ChartCard>
        <ChartCard title="Promo codes" span={4}>
          <BarList title="Promo codes" items={PROMOS} unit={USD} />
        </ChartCard>
        <ChartCard title="Newsletters" span={12}>
          <BarChart
            title="Newsletters"
            categories={['Announce', 'Lineup', 'Early bird ends', 'Last chance'].map((k) => ({ key: k, label: k }))}
            series={[
              { id: 'opened', label: 'Opened', slot: 4 },
              { id: 'clicked', label: 'Clicked', slot: 1 },
              { id: 'bought', label: 'Bought', slot: 5 },
            ]}
            values={{ opened: [4200, 3900, 4600, 5100], clicked: [820, 610, 1240, 1420], bought: [96, 54, 210, 260] }}
          />
        </ChartCard>
      </DashboardGrid>
    </Page>
  );
}

export function MoneyPage() {
  const format = useFormat();
  const refunds = Math.round(TURNOVER * 0.024);
  const fee = Math.round(TURNOVER * 0.06);
  const paid = Math.round((TURNOVER - refunds - fee) * 0.55);
  const pending = TURNOVER - refunds - fee - paid;
  return (
    <Page title="Money">
      <KpiStrip items={[salesKpis(0)[0], salesKpis(0)[1], salesKpis(0)[5]]} />
      <DashboardGrid>
        <ChartCard title="Where the money is" span={12} info="Turnover split into paid out, pending payout, refunds and fees.">
          <SplitBar
            title="Turnover"
            height={18}
            formatValue={(v) => format.currency(v, 'USD')}
            parts={[
              { key: 'paid', label: 'Paid out', value: paid, color: 'var(--vl-positive)' },
              { key: 'pending', label: 'Pending payout', value: pending, color: 'var(--vl-cat-5)' },
              { key: 'refunds', label: 'Refunds', value: refunds, color: 'var(--vl-negative)' },
              { key: 'fee', label: 'Service fee', value: fee, tone: 'muted' },
            ]}
          />
        </ChartCard>
        <ChartCard title="Turnover by day" span={8}>
          <TimeSeriesChart
            title="Turnover by day"
            series={[{ id: 'floor', label: 'Turnover' }]}
            source={demoSource()}
            metric="turnover"
            kind="columns"
            unit={USD}
            height={260}
            granularity="day"
          />
        </ChartCard>
        <ChartCard title="Payouts" span={4}>
          <BarList
            title="Payouts"
            sort="none"
            unit={USD}
            items={[
              { key: 'p1', label: 'Sep 15', value: Math.round(paid * 0.3), sub: 'paid' },
              { key: 'p2', label: 'Sep 30', value: Math.round(paid * 0.32), sub: 'paid' },
              { key: 'p3', label: 'Oct 15', value: paid - Math.round(paid * 0.62), sub: 'paid' },
              { key: 'p4', label: 'Oct 31', value: pending, sub: 'scheduled', tone: 'muted' },
            ]}
          />
        </ChartCard>
      </DashboardGrid>
    </Page>
  );
}

const entries = (() => {
  const r = rng(9);
  const start = EVENT - 2 * HOUR;
  const n = 4 * 12; // 5-minute buckets for 4 hours
  const curve = (i: number) => Math.max(0, Math.round(140 * Math.exp(-((i - 22) ** 2) / 90) + r() * 18));
  return frameFromArrays(start, 5 * 60_000, {
    main: Array.from({ length: n }, (_, i) => curve(i)),
    vip: Array.from({ length: n }, (_, i) => Math.round(curve(i) * 0.12)),
  });
})();

export function CheckInPage() {
  const [gate, setGate] = useState<'all' | 'main' | 'vip'>('all');
  return (
    <Page title="Check-in" meta="Event day · doors 17:00 · live">
      <KpiStrip
        items={[
          { id: 'scanned', label: 'Scanned', value: 2120, unit: UNIT_COUNT, sub: 'repeat 2%' },
          { id: 'came', label: 'Came', value: 1984, unit: UNIT_COUNT, sub: '76% of 2,611' },
          { id: 'yet', label: 'Not yet', value: 627, unit: UNIT_COUNT },
          { id: 'denied', label: 'Denied', value: 18, unit: UNIT_COUNT, tone: 'negative', sub: 'invalid or used' },
        ]}
      />
      <DashboardGrid>
        <ChartCard
          title="Entry speed"
          span={8}
          info="People per 5 minutes at each gate."
          actions={
            <Segmented
              aria-label="Gate"
              size="s"
              value={gate}
              onChange={setGate}
              options={[
                { value: 'all', label: 'All' },
                { value: 'main', label: 'Main' },
                { value: 'vip', label: 'VIP' },
              ]}
            />
          }
        >
          <TimeSeriesChart
            title="Entry speed"
            series={[
              { id: 'main', label: 'Main gate', slot: 0 },
              { id: 'vip', label: 'VIP gate', slot: 2 },
            ]}
            frame={entries}
            hidden={gate === 'all' ? new Set<'main' | 'vip'>() : new Set<'main' | 'vip'>([gate === 'main' ? 'vip' : 'main'])}
            kind="line"
            height={260}
            unit={UNIT_COUNT}
            navigator={false}
          />
        </ChartCard>
        <ChartCard title="Hall" span={4}>
          <Gauge
            title="Inside"
            value={1984}
            max={2611}
            thresholds={[
              { to: 1800, tone: 'positive' },
              { to: 2400, tone: 'warning' },
              { to: 2611, tone: 'negative' },
            ]}
            sublabel="inside of 2,611"
          />
          <SplitBar
            title="Came"
            parts={[
              { key: 'in', label: 'Came', value: 1984, color: 'var(--vl-positive)' },
              { key: 'no', label: 'Not yet', value: 627, tone: 'muted' },
            ]}
          />
        </ChartCard>
        <ChartCard title="By ticket type" span={12}>
          <BarChart
            title="Came by ticket type"
            orientation="horizontal"
            categories={TICKET_SERIES.map((s) => ({ key: s.id, label: s.label }))}
            series={[
              { id: 'came', label: 'Came', color: 'var(--vl-positive)' },
              { id: 'yet', label: 'Not yet', color: 'var(--vl-cat-other)' },
            ]}
            values={{ came: TICKET_TYPES.map((id) => Math.round(T[id] * 0.76)), yet: TICKET_TYPES.map((id) => Math.round(T[id] * 0.24)) }}
            mode="stack"
          />
        </ChartCard>
      </DashboardGrid>
    </Page>
  );
}
