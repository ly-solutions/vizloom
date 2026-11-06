import type { Meta, StoryObj } from '@storybook/react';
import { useEffect, useMemo, useRef, useState } from 'react';

import {
  ChartDataTable,
  ChartTooltip,
  Crosshair,
  DeltaBadge,
  Legend,
  LiveNumber,
  Pulse,
  Skeleton,
  StateView,
  Swatch,
  TooltipContent,
  seriesColor,
  useElementSize,
  useFormat,
  useSeriesState,
  type BlockState,
} from '..';

const meta: Meta = {
  title: 'Core/Shared UI',
  parameters: { docs: { description: { component: 'Building blocks every chart, table and dashboard block shares.' } } },
};
export default meta;
type Story = StoryObj;

const SERIES = [
  { id: 'floor', label: 'Dance floor' },
  { id: 'balcony', label: 'Balcony' },
  { id: 'vip', label: 'VIP lounge' },
  { id: 'early', label: 'Early bird' },
  { id: 'student', label: 'Student ticket with a very long name that wraps' },
] as const;

export const LegendInteractive: Story = {
  name: 'Legend — toggle, solo, focus',
  render: function Render() {
    const state = useSeriesState(SERIES.map((s) => s.id));
    return (
      <div className="sb-stack">
        <Legend
          items={SERIES.map((s, i) => ({ id: s.id, label: s.label, color: seriesColor(i) }))}
          hidden={state.hidden}
          focus={state.focus}
          onToggle={state.toggle}
          onSolo={state.solo}
          onFocus={state.setFocus}
        />
        <p className="sb-note">
          Click hides, double click (or Alt+Enter) keeps only one, hover highlights. The last visible series never hides.
        </p>
        <p className="sb-note">
          Hidden: {[...state.hidden].join(', ') || 'none'} · focus: {state.focus ?? 'none'}
        </p>
      </div>
    );
  },
};

export const LegendShapes: Story = {
  name: 'Legend — shapes, values, layouts',
  render: () => (
    <div className="sb-stack">
      <Legend shape="line" items={SERIES.slice(0, 3).map((s, i) => ({ id: s.id, label: s.label, color: seriesColor(i) }))} />
      <Legend
        shape="square"
        items={SERIES.slice(0, 3).map((s, i) => ({ id: s.id, label: s.label, color: seriesColor(i), value: `${[48, 31, 21][i]}%` }))}
      />
      <Legend
        items={[
          { id: 'this', label: 'This year', color: seriesColor(0), shape: 'line' },
          { id: 'last', label: 'Last year', color: 'var(--vl-compare-1)', shape: 'dashed' },
        ]}
      />
      <div className="sb-narrow">
        <Legend layout="scroll" items={SERIES.map((s, i) => ({ id: s.id, label: s.label, color: seriesColor(i) }))} />
      </div>
      <Legend loading items={[]} />
    </div>
  ),
};

export const Swatches: Story = {
  render: () => (
    <div className="sb-row">
      {Array.from({ length: 8 }, (_, i) => (
        <Swatch key={i} color={seriesColor(i)} />
      ))}
      <Swatch color={seriesColor(0)} shape="line" />
      <Swatch color={seriesColor(1)} shape="square" />
      <Swatch color="var(--vl-compare-1)" shape="dashed" />
      <Swatch color={seriesColor(2)} off />
    </div>
  ),
};

export const Deltas: Story = {
  name: 'DeltaBadge — all tones and variants',
  render: () => (
    <div className="sb-stack">
      <div className="sb-row">
        <DeltaBadge value={24} />
        <DeltaBadge value={-12} />
        <DeltaBadge value={0.2} />
        <DeltaBadge value={Number.NaN} />
        <DeltaBadge value={18} invert />
        <DeltaBadge value={-7} invert />
      </div>
      <div className="sb-row">
        <DeltaBadge value={24} variant="text" />
        <DeltaBadge value={-12} variant="text" />
        <DeltaBadge value={3.46} fractionDigits={1} size="s" />
        <DeltaBadge value={12} suffix="vs last week" />
        <DeltaBadge value={5} label="+1,240" />
      </div>
    </div>
  ),
};

export const LiveNumbers: Story = {
  name: 'LiveNumber and Pulse — live updates',
  render: function Render() {
    const format = useFormat();
    const [value, setValue] = useState(12840);
    useEffect(() => {
      const t = setInterval(() => setValue((v) => v + Math.round(Math.random() * 400 - 120)), 1800);
      return () => clearInterval(t);
    }, []);
    return (
      <div className="sb-stack">
        <div className="sb-kpi-demo">
          <LiveNumber value={value} pulse format={(v) => format.currency(v, 'USD')} />
        </div>
        <div className="sb-row">
          <Pulse trigger={value} /> <Pulse trigger={value} tone="positive" /> <Pulse trigger={value} tone="negative" />
          <span className="sb-note">Pulses fire on every change; reduced motion turns animations off.</span>
        </div>
      </div>
    );
  },
};

export const Skeletons: Story = {
  render: () => (
    <div className="sb-grid-3">
      <div className="sb-box">
        <Skeleton shape="chart" />
      </div>
      <div className="sb-box">
        <Skeleton shape="bars" />
      </div>
      <div className="sb-box">
        <Skeleton shape="circle" />
      </div>
      <div className="sb-box sb-stack">
        <Skeleton shape="text" size="xl" />
        <Skeleton shape="text" size="l" />
        <Skeleton shape="text" size="s" />
      </div>
    </div>
  ),
};

const STATES: readonly BlockState[] = [
  { status: 'loading' },
  { status: 'empty', reason: 'Sales start on Oct 12 — the chart fills in with the first ticket.' },
  { status: 'no-access' },
  { status: 'error', onRetry: () => undefined },
  { status: 'partial', reason: 'Data for the last 2 hours is still being collected.' },
];

export const BlockStates: Story = {
  name: 'StateView — five block states',
  render: () => (
    <div className="sb-grid-3">
      {STATES.map((s) => (
        <div key={s.status} className="sb-box sb-box--tall">
          <StateView state={s} skeleton="chart">
            <div className="sb-placeholder">content</div>
          </StateView>
        </div>
      ))}
    </div>
  ),
};

export const TooltipAndCrosshair: Story = {
  name: 'ChartTooltip — follow, flip, pin, phone dock',
  render: function Render() {
    const [setRef, size] = useElementSize<HTMLDivElement>();
    const [pt, setPt] = useState<{ x: number; y: number } | null>(null);
    const [pinned, setPinned] = useState(false);
    const host = useRef<HTMLDivElement | null>(null);
    const rows = useMemo(
      () => [
        { id: 'floor', label: 'Dance floor', value: '124', color: seriesColor(0) },
        { id: 'balcony', label: 'Balcony', value: '58', color: seriesColor(1) },
        { id: 'vip', label: 'VIP lounge', value: '12', color: seriesColor(2), note: '$120' },
      ],
      [],
    );
    return (
      <div className="sb-stack">
        <div
          ref={(n) => {
            host.current = n;
            setRef(n);
          }}
          className="sb-surface"
          onPointerMove={(e) => {
            if (pinned) return;
            const r = e.currentTarget.getBoundingClientRect();
            setPt({ x: e.clientX - r.left, y: e.clientY - r.top });
          }}
          onPointerLeave={() => !pinned && setPt(null)}
          onClick={() => setPinned((p) => !p)}
        >
          <Crosshair x={pt?.x ?? null} />
          <ChartTooltip open={!!pt} anchor={pt} bounds={size} pinned={pinned} onUnpin={() => setPinned(false)}>
            <TooltipContent title="Oct 7, Tue · 14:00–15:00" rows={rows} footer={pinned ? 'Pinned' : 'Click to pin'} />
          </ChartTooltip>
          <span className="sb-note sb-center">Move the pointer; click to pin. Narrow the viewport to see the phone dock.</span>
        </div>
      </div>
    );
  },
};

export const ScreenReaderTable: Story = {
  name: 'ChartDataTable — visible variant',
  render: () => (
    <ChartDataTable
      visible
      caption="Tickets sold by type"
      columns={['Type', 'Tickets', 'Share']}
      rows={[
        ['Dance floor', 1240, '48%'],
        ['Balcony', 801, '31%'],
        ['VIP lounge', 312, '12%'],
      ]}
    />
  ),
};
