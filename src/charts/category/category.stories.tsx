import type { Meta, StoryObj } from '@storybook/react';
import { useEffect, useState } from 'react';

import { currencyUnit, seriesColor, UNIT_COUNT } from '../../core';
import { ChartCard, DashboardGrid, Segmented } from '../../dashboard';
import { dailyTotals } from '../../../stories/demo-data';
import { BarChart } from './bar-chart';
import { BarList } from './bar-list';
import { Gauge } from './gauge';
import { Sparkline } from './sparkline';
import { SplitBar } from './split-bar';

const meta: Meta = { title: 'Charts/Category' };
export default meta;
type Story = StoryObj;

const TYPES = [
  { key: 'floor', label: 'Dance floor' },
  { key: 'balcony', label: 'Balcony' },
  { key: 'vip', label: 'VIP lounge' },
  { key: 'early', label: 'Early bird' },
  { key: 'student', label: 'Student ticket (ID required at the entrance)' },
] as const;
const WEEKS = [
  { id: 'w1', label: 'Week 1' },
  { id: 'w2', label: 'Week 2' },
  { id: 'w3', label: 'Week 3' },
] as const;
const VALUES = { w1: [420, 210, 48, 380, 60], w2: [510, 260, 61, 0, 82], w3: [640, 330, 30, 0, 95] };

export const Sparklines: Story = {
  render: () => {
    const v = dailyTotals(undefined, 30);
    return (
      <div className="sb-grid-3">
        <div className="sb-box sb-stack">
          line <Sparkline values={v} />
        </div>
        <div className="sb-box sb-stack">
          area + peak <Sparkline values={v} kind="area" showPeak color={seriesColor(2)} height={48} />
        </div>
        <div className="sb-box sb-stack">
          bars <Sparkline values={v.slice(-14)} kind="bars" color={seriesColor(1)} />
        </div>
        <div className="sb-box sb-stack">
          baseline (average) <Sparkline values={v} baseline={v.reduce((a, b) => a + b, 0) / v.length} />
        </div>
        <div className="sb-box sb-stack">
          gaps <Sparkline values={v.map((x, i) => (i % 7 === 3 ? Number.NaN : x))} />
        </div>
        <div className="sb-box sb-stack">
          ghost (empty) <Sparkline values={v} ghost kind="bars" />
        </div>
        <div className="sb-box sb-stack">
          fixed 80×20 inline{' '}
          <span>
            Trend <Sparkline values={v} width={80} height={20} />
          </span>
        </div>
      </div>
    );
  },
};

export const SparklineSelectable: Story = {
  name: 'Sparkline — selectable bars',
  render: function Render() {
    const v = dailyTotals(undefined, 14);
    const [i, setI] = useState<number | null>(13);
    return (
      <div className="sb-box sb-stack">
        <Sparkline values={v} kind="bars" height={56} activeIndex={i} onSelect={setI} />
        <span className="sb-note">Selected day: {i === null ? '—' : `${i + 1} · ${v[i]} tickets`}</span>
      </div>
    );
  },
};

export const VerticalSingle: Story = {
  name: 'Bars — vertical, single series, value labels',
  render: () => (
    <BarChart
      title="Tickets by type"
      data={TYPES.map((t, i) => ({ key: t.key, label: t.label, value: VALUES.w3[i] + VALUES.w2[i] }))}
      valueLabels
      unit={UNIT_COUNT}
      colorByCategory
    />
  ),
};

export const Grouped: Story = {
  name: 'Bars — grouped',
  render: () => <BarChart title="Tickets by type and week" categories={TYPES} series={WEEKS} values={VALUES} />,
};

export const Stacked: Story = {
  name: 'Bars — stacked with totals',
  render: () => <BarChart title="Tickets by type and week" categories={TYPES} series={WEEKS} values={VALUES} mode="stack" valueLabels />,
};

export const Percent: Story = {
  name: 'Bars — percent of total',
  render: () => <BarChart title="Share by week" categories={TYPES} series={WEEKS} values={VALUES} mode="percent" />,
};

export const Horizontal: Story = {
  name: 'Bars — horizontal, sorted, long labels',
  render: () => (
    <BarChart
      title="Revenue by type"
      orientation="horizontal"
      sort="desc"
      valueLabels
      unit={currencyUnit('USD')}
      data={TYPES.map((t, i) => ({
        key: t.key,
        label: t.label,
        value: (VALUES.w1[i] + VALUES.w2[i] + VALUES.w3[i]) * [45, 35, 120, 29, 20][i],
      }))}
    />
  ),
};

export const HorizontalStacked: Story = {
  name: 'Bars — horizontal stacked, legend bottom',
  render: () => (
    <BarChart
      title="Tickets by type and week"
      orientation="horizontal"
      categories={TYPES}
      series={WEEKS}
      values={VALUES}
      mode="stack"
      legend="bottom"
    />
  ),
};

export const Negative: Story = {
  name: 'Bars — negative values (net change)',
  render: () => (
    <BarChart
      title="Net change by day"
      data={['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d, i) => ({
        key: d,
        label: d,
        value: [120, -40, 60, -15, 210, 340, -80][i],
      }))}
      valueLabels
    />
  ),
};

export const Highlight: Story = {
  name: 'Bars — highlight one category',
  render: () => <BarChart title="Tickets by type" categories={TYPES} series={WEEKS} values={VALUES} highlight="vip" />,
};

export const ManyCategories: Story = {
  name: 'Bars — 60 categories (labels thin out)',
  render: () => (
    <BarChart
      title="Tickets per day"
      data={dailyTotals(undefined, 60).map((v, i) => ({ key: `d${i}`, label: `Day ${i + 1}`, value: v }))}
    />
  ),
};

export const Live: Story = {
  name: 'Bars — live data morphs',
  render: function Render() {
    const [vals, setVals] = useState(VALUES);
    useEffect(() => {
      const t = setInterval(
        () => setVals((v) => ({ ...v, w3: v.w3.map((x) => Math.max(0, x + Math.round(Math.random() * 60 - 20))) })),
        1500,
      );
      return () => clearInterval(t);
    }, []);
    return <BarChart title="Tickets by type and week" categories={TYPES} series={WEEKS} values={vals} mode="stack" valueLabels />;
  },
};

export const BarStates: Story = {
  name: 'Bars — states',
  render: () => (
    <DashboardGrid>
      {(['loading', 'empty', 'error', 'no-access'] as const).map((s) => (
        <ChartCard key={s} title={s} span={6}>
          <BarChart title={s} data={[]} state={{ status: s }} height={180} />
        </ChartCard>
      ))}
    </DashboardGrid>
  ),
};

export const BarPhone: Story = { ...Grouped, name: 'Bars — phone', parameters: { viewport: { defaultViewport: 'phone' } } };

const PROMOS = [
  { key: 'friends10', label: 'FRIENDS10', value: 4280, sub: '142 of 200 · −10%' },
  { key: 'summer', label: 'SUMMERNIGHTS', value: 2910, sub: '97 of ∞ · −15%' },
  { key: 'press', label: 'PRESS', value: 0, sub: '0 of 20 · free', tone: 'negative' as const },
  { key: 'staff', label: 'STAFF-2026', value: 640, sub: '32 of 50 · −50%' },
  { key: 'radio', label: 'RADIO-WAVE', value: 1820, sub: '61 of 100 · −20%' },
  { key: 'student', label: 'STUDENT', value: 1210, sub: '81 of ∞ · −25%' },
  { key: 'late', label: 'LATEBIRD', value: 380, sub: '11 of 30 · −5%' },
];

export const BarLists: Story = {
  name: 'Bar list — promo codes, selectable, collapsible',
  render: function Render() {
    const [sel, setSel] = useState<string | null>(null);
    const [scale, setScale] = useState<'max' | 'sum'>('max');
    return (
      <ChartCard
        title="Promo codes"
        actions={
          <Segmented
            aria-label="Scale"
            size="s"
            value={scale}
            onChange={setScale}
            options={[
              { value: 'max', label: 'vs top' },
              { value: 'sum', label: 'share' },
            ]}
          />
        }
      >
        <BarList
          title="Promo codes"
          items={PROMOS}
          unit={currencyUnit('USD')}
          limit={5}
          selected={sel}
          onSelect={setSel}
          scale={scale}
          showShare={scale === 'sum'}
        />
      </ChartCard>
    );
  },
};

export const BarListStates: Story = {
  name: 'Bar list — loading and empty',
  render: () => (
    <DashboardGrid>
      <ChartCard title="Loading" span={6}>
        <BarList title="Links" items={[]} state={{ status: 'loading' }} />
      </ChartCard>
      <ChartCard title="Empty" span={6}>
        <BarList title="Links" items={[]} state={{ status: 'empty', reason: 'Create a tracking link to see where buyers come from.' }} />
      </ChartCard>
    </DashboardGrid>
  ),
};

export const SplitBars: Story = {
  name: 'Split bar — full and mini',
  render: () => (
    <div className="sb-stack">
      <SplitBar
        title="Payouts"
        formatValue={(v) => `$${v.toLocaleString('en-US')}`}
        parts={[
          { key: 'paid', label: 'Paid out', value: 58800 },
          { key: 'pending', label: 'Pending', value: 41200 },
          { key: 'refund', label: 'Refunded', value: 3120, color: 'var(--vl-negative)' },
          { key: 'fee', label: 'Fees', value: 7517, tone: 'muted' },
        ]}
      />
      <SplitBar
        title="Check-in"
        parts={[
          { key: 'in', label: 'Came', value: 1984, color: 'var(--vl-positive)' },
          { key: 'no', label: 'Not yet', value: 627, tone: 'muted' },
        ]}
        height={20}
      />
      <div className="sb-narrow">
        <SplitBar
          mini
          title="Ticket types"
          parts={[
            { key: 'a', label: 'Floor', value: 48 },
            { key: 'b', label: 'Balcony', value: 31 },
            { key: 'c', label: 'VIP', value: 12 },
            { key: 'd', label: 'Other', value: 9, tone: 'muted' },
          ]}
        />
      </div>
    </div>
  ),
};

export const Gauges: Story = {
  name: 'Gauge — sell-out, target, bands, arc',
  render: function Render() {
    const [v, setV] = useState(1840);
    useEffect(() => {
      const t = setInterval(() => setV((x) => (x >= 2400 ? 1200 : x + 60)), 1200);
      return () => clearInterval(t);
    }, []);
    return (
      <div className="sb-grid-3">
        <div className="sb-box">
          <Gauge title="Sold" value={v} max={2500} target={2100} targetLabel="Usual by now: 2,100" />
        </div>
        <div className="sb-box">
          <Gauge
            title="Hall load"
            value={v}
            max={2500}
            thresholds={[
              { to: 1500, tone: 'positive' },
              { to: 2200, tone: 'warning' },
              { to: 2500, tone: 'negative' },
            ]}
            sublabel="people inside"
          />
        </div>
        <div className="sb-box">
          <Gauge title="Check-in" value={v * 0.3} max={2500} shape="arc" label={`${Math.round(v * 0.3)}`} sublabel="checked in" />
        </div>
      </div>
    );
  },
};
