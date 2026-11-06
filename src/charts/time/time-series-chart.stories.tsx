import './stories.css';

import type { Meta, StoryObj } from '@storybook/react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { type CompareSeries, DAY, HOUR, type SeriesFrame, type TimeRange, useViewport } from '../../core';
import {
  DEMO_CHANNELS,
  DEMO_MARKER_PATHS,
  type DemoChannel,
  type DemoMarkerKind,
  dailyFrame,
  demoMarkers,
  demoSales,
  demoSource,
  demoZones,
  randomWalkFrame,
} from './demo-data';
import { AreaChart, LineChart, type LiveEvent, StackedAreaChart, TimeColumnChart, TimeSeriesChart } from './time-series-chart';

const sales = demoSales();
const daily = dailyFrame(sales);
const series = DEMO_CHANNELS.map((c) => ({ id: c.id, label: c.label }));
const source = demoSource(sales, { latency: 250 });
const markers = demoMarkers(sales);
const zones = demoZones(sales);

function MarkerIcon({ kind }: { readonly kind: DemoMarkerKind }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d={DEMO_MARKER_PATHS[kind]} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

const meta = {
  title: 'Charts/Time/TimeSeriesChart',
  component: TimeSeriesChart,
  parameters: { layout: 'padded' },
  args: { title: 'Tickets sold by channel', series, frame: daily, unit: { kind: 'count' } },
  argTypes: {
    kind: { control: 'inline-radio', options: ['area', 'line', 'columns'] },
    stack: { control: 'inline-radio', options: ['overlay', 'stack', 'percent'] },
    curve: { control: 'inline-radio', options: ['smooth', 'linear', 'step'] },
  },
} satisfies Meta<typeof TimeSeriesChart<DemoChannel>>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Area: Story = {};

export const Line: Story = { render: (args) => <LineChart {...args} /> };

export const LineLinearAndStep: Story = {
  render: (args) => (
    <div className="sb-stack">
      <LineChart {...args} title="Linear" curve="linear" series={series.slice(0, 2)} />
      <LineChart {...args} title="Step" curve="step" series={series.slice(0, 2)} points="always" />
    </div>
  ),
};

export const Stacked: Story = { render: (args) => <StackedAreaChart {...args} /> };

export const StackedPercent: Story = { render: (args) => <StackedAreaChart {...args} stack="percent" /> };

export const Columns: Story = { render: (args) => <TimeColumnChart {...args} /> };

export const ColumnsStacked: Story = { render: (args) => <TimeColumnChart {...args} stack="stack" /> };

/** Tile source: zooming in switches day → hour columns, the old frame morphs into the new one. */
export const ColumnsGranularityMorph: Story = {
  args: { frame: undefined },
  render: (args) => (
    <TimeColumnChart
      {...args}
      source={source}
      metric="tickets"
      stack="stack"
      initialRange={{ start: sales.now - 21 * DAY, end: sales.now }}
    />
  ),
};

/** Tile source with zoom by wheel / drag / pinch / buttons and the whole-period navigator. */
export const ZoomAndNavigator: Story = {
  args: { frame: undefined },
  render: (args) => <AreaChart {...args} source={source} metric="tickets" initialRange={{ start: sales.now - 14 * DAY, end: sales.now }} />,
};

export const MarkersAndEffects: Story = {
  args: { frame: undefined },
  render: (args) => (
    <AreaChart
      {...args}
      source={source}
      metric="tickets"
      markers={markers}
      renderMarkerIcon={(m) => <MarkerIcon kind={m.kind as DemoMarkerKind} />}
    />
  ),
};

export const ZonesAndNow: Story = {
  args: { frame: undefined },
  render: (args) => <AreaChart {...args} source={source} metric="tickets" zones={zones} now={sales.now} />,
};

export const Guides: Story = {
  render: (args) => (
    <LineChart
      {...args}
      series={series.slice(0, 1)}
      peak
      guides={[
        { value: 70, label: 'Average 70' },
        { value: 110, label: 'Daily goal 110', color: 'var(--vl-positive)' },
      ]}
    />
  ),
};

export const RevenueCurrency: Story = {
  args: { frame: dailyFrame(sales, 'revenue'), title: 'Revenue by channel', unit: { kind: 'currency', currency: 'EUR' } },
};

export const ManySeries: Story = {
  args: {
    frame: randomWalkFrame(90, 12, DAY),
    series: Array.from({ length: 12 }, (_, i) => ({ id: `s${i + 1}`, label: `Venue zone ${String.fromCharCode(65 + i)}` })) as never,
  },
};

export const LongLabels: Story = {
  args: {
    series: DEMO_CHANNELS.map((c) => ({ id: c.id, label: `${c.label} — including resale and group bookings over the whole season` })),
  },
};

export const Small: Story = {
  args: { height: 160 },
  render: (args) => <AreaChart {...args} navigator={false} zoomControls={false} legend={false} />,
};

export const Tall: Story = { args: { height: 440 } };

export const Loading: Story = { args: { state: { status: 'loading' } } };

export const Empty: Story = { args: { state: { status: 'empty' } } };

export const ErrorState: Story = { args: { state: { status: 'error', onRetry: () => undefined } } };

export const NoAccess: Story = { args: { state: { status: 'no-access' } } };

export const Partial: Story = { args: { state: { status: 'partial' } } };

/** The source fails on finer tiles: the previous frame stays, a banner offers a retry. */
export const StaleError: Story = {
  args: { frame: undefined },
  render: function StaleErrorStory(args) {
    const failing = useMemo(() => demoSource(sales, { latency: 300, fail: () => Math.random() < 0.6 }), []);
    return <AreaChart {...args} source={failing} metric="tickets" />;
  },
};

export const Phone: Story = {
  args: { frame: undefined },
  parameters: { viewport: { defaultViewport: 'phone' } },
  render: (args) => (
    <AreaChart
      {...args}
      source={source}
      metric="tickets"
      markers={markers}
      renderMarkerIcon={(m) => <MarkerIcon kind={m.kind as DemoMarkerKind} />}
    />
  ),
};

export const PhoneColumns: Story = {
  parameters: { viewport: { defaultViewport: 'phone' } },
  render: (args) => <TimeColumnChart {...args} stack="stack" />,
};

/** Live: a new sale every 1.2 s, a pulse and a "+N" caption; the window follows "now". */
export const Live: Story = {
  args: { frame: undefined },
  render: function LiveStory(args) {
    const [state, setState] = useState(() => ({ frame: hourlyWindow(48), now: sales.now }));
    const [events, setEvents] = useState<LiveEvent<DemoChannel>[]>([]);
    const tick = useRef(0);
    useEffect(() => {
      const timer = setInterval(() => {
        tick.current += 1;
        const id = DEMO_CHANNELS[tick.current % DEMO_CHANNELS.length].id;
        const n = 1 + (tick.current % 3);
        setState((prev) => {
          const last = prev.frame.length - 1;
          const values = { ...prev.frame.values } as Record<DemoChannel, Float64Array>;
          values[id] = Float64Array.from(values[id]);
          values[id][last] = (values[id][last] || 0) + n;
          return { frame: { ...prev.frame, values }, now: prev.now + 60_000 };
        });
        setEvents((prev) => [...prev.slice(-20), { key: `e${tick.current}`, id, t: Date.now(), text: `+${n}` }]);
      }, 1200);
      return () => clearInterval(timer);
    }, []);
    const live = useMemo(() => events.map((e) => ({ ...e, t: state.now - 30 * 60_000 })), [events, state.now]);
    return <AreaChart {...args} title="Sales right now" frame={state.frame} now={state.now} live liveEvents={live} />;
  },
};

function hourlyWindow(hours: number): SeriesFrame<DemoChannel> {
  const h = sales.hourly.tickets;
  const end = Math.round((sales.now - h.start) / HOUR);
  const values = {} as Record<DemoChannel, Float64Array>;
  for (const c of DEMO_CHANNELS) values[c.id] = Float64Array.from(h.values[c.id].subarray(end - hours, end));
  return { start: sales.now - hours * HOUR, step: HOUR, length: hours, values, granularity: 'hour' };
}

const seasons = [2024, 2025, 2026].map((year, i) => {
  const s = demoSales({ seed: 11 + i, base: 90 + i * 25, start: Date.UTC(year, 8, 1), ahead: 0, days: 50 });
  const f = dailyFrame(s, 'tickets', ['web']);
  return { year, frame: { ...f, values: { value: f.values.web } }, event: s.event };
});

/** Three seasons lined up by "days before the event". */
export const CompareDaysBefore: Story = {
  args: { frame: undefined, title: 'Season against season' },
  render: (args) => {
    const compare: CompareSeries[] = seasons.map((s, i) => ({
      id: `y${s.year}`,
      label: `Season ${s.year}`,
      frame: s.frame,
      event: s.event,
      role: i === seasons.length - 1 ? 'primary' : 'compare',
    }));
    return <LineChart {...args} compare={compare} compareAlign="days-before" />;
  },
};

/** Two channels on real dates, side by side. */
export const CompareByDate: Story = {
  args: { frame: undefined },
  render: (args) => (
    <LineChart
      {...args}
      compare={[
        { id: 'web', label: 'Website', frame: { ...daily, values: { value: daily.values.web } }, role: 'primary' },
        { id: 'app', label: 'Mobile app', frame: { ...daily, values: { value: daily.values.app } }, role: 'compare' },
      ]}
      compareAlign="date"
    />
  ),
};

/** 10,000 points × 3 series on canvas: zoom and hover stay at 60 fps. */
export const Performance10k: Story = {
  args: { series: [1, 2, 3].map((n) => ({ id: `s${n}`, label: `Sensor ${n}` })) as never, frame: randomWalkFrame(10_000, 3, 15 * 60_000) },
};

/** Two charts on one viewport: zooming one moves the other. */
export const SharedViewport: Story = {
  render: function SharedViewportStory(args) {
    const viewport = useViewport({ extent: { start: daily.start, end: daily.start + daily.length * DAY } });
    const [range, setRange] = useState<TimeRange | null>(null);
    return (
      <div className="sb-stack">
        <AreaChart {...args} viewport={viewport} onRangeChange={setRange} navigator={false} />
        <TimeColumnChart {...args} title="Revenue" frame={dailyFrame(sales, 'revenue')} viewport={viewport} stack="stack" />
        <output>
          {range ? `${new Date(range.start).toISOString().slice(0, 10)} → ${new Date(range.end).toISOString().slice(0, 10)}` : ''}
        </output>
      </div>
    );
  },
};

export const ZoneDrawing: Story = {
  render: function ZoneDrawingStory(args) {
    const [draft, setDraft] = useState<TimeRange | null>(null);
    const drawn = draft
      ? [{ id: 'mine', from: draft.start, to: draft.end, label: 'My period', tone: 'accent' as const, removable: true }]
      : [];
    return <AreaChart {...args} zoneDraw zones={drawn} onZoneDraft={(r) => setDraft(r)} onZoneRemove={() => setDraft(null)} />;
  },
};
