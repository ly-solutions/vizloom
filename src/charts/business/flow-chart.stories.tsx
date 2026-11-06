import type { Meta, StoryObj } from '@storybook/react';
import { useEffect, useMemo, useState } from 'react';

import { MINUTE, type SeriesFrame } from '../../core';
import { demoEntryFrame, ENTRY_START, GATE_IDS, GATE_LABELS, type GateId } from './demo-data';
import { FlowChart, type FlowSeries } from './flow-chart';

import './stories.css';

type Mode = 'all' | 'gates' | 'devices';

interface FlowDemoProps {
  readonly mode: Mode;
  readonly minutes: number;
  readonly live: boolean;
  readonly status: 'ready' | 'loading' | 'error' | 'empty' | 'no-access';
  readonly longLabels: boolean;
  readonly stats: boolean;
  readonly height: number;
  readonly width: 'card' | 'wide' | 'small';
}

const TOTAL = 210;
const START_AT = ENTRY_START + 60 * MINUTE;

/** The gates' frame, summed into one series or split into two devices per gate. */
function shape(frame: SeriesFrame<GateId>, mode: Mode, longLabels: boolean): { frame: SeriesFrame<string>; series: FlowSeries[] } {
  if (mode === 'all') {
    const sum = new Float64Array(frame.length);
    for (let k = 0; k < frame.length; k++) {
      let s = 0;
      let any = false;
      for (const id of GATE_IDS) {
        const v = frame.values[id][k];
        if (v === v) {
          s += v;
          any = true;
        }
      }
      sum[k] = any ? s : Number.NaN;
    }
    return { frame: { ...frame, values: { all: sum } }, series: [{ id: 'all', label: 'All gates' }] };
  }
  if (mode === 'gates') {
    const series = GATE_IDS.map((id) => ({
      id,
      label: longLabels ? `${GATE_LABELS[id]} — main square, accessible lane and fast track` : GATE_LABELS[id],
      note: '2 devices',
    }));
    return { frame: frame as SeriesFrame<string>, series };
  }
  const values: Record<string, Float64Array> = {};
  const series: FlowSeries[] = [];
  for (const id of GATE_IDS) {
    for (const part of [0, 1]) {
      const key = `${id}-${part + 1}`;
      const col = new Float64Array(frame.length);
      for (let k = 0; k < frame.length; k++) {
        const v = frame.values[id][k];
        col[k] = v === v ? Math.round(v * (part === 0 ? 0.6 : 0.4)) : Number.NaN;
      }
      values[key] = col;
      series.push({ id: key, label: `${GATE_LABELS[id]} · scanner ${part + 1}` });
    }
  }
  return { frame: { ...frame, values }, series };
}

function FlowDemo({ mode, minutes, live, status, longLabels, stats, height, width }: FlowDemoProps) {
  const [shown, setShown] = useState(live ? 95 : minutes);
  useEffect(() => {
    setShown(live ? 95 : minutes);
    if (!live) return;
    const id = setInterval(() => setShown((n) => (n >= TOTAL ? 95 : n + 1)), 1600);
    return () => clearInterval(id);
  }, [live, minutes]);
  const data = useMemo(
    () => shape(demoEntryFrame(live ? TOTAL : minutes, shown), mode, longLabels),
    [live, minutes, shown, mode, longLabels],
  );
  return (
    <div className={`sb-biz-frame sb-biz-frame--${width}`}>
      <FlowChart
        key={mode}
        title="Entry speed"
        description="People let in per minute"
        frame={data.frame}
        series={data.series}
        live={live}
        startAt={START_AT}
        state={status === 'ready' ? undefined : { status }}
        stats={stats}
        height={height}
      />
    </div>
  );
}

const meta = {
  title: 'Charts/Business/FlowChart',
  component: FlowDemo,
  args: { mode: 'gates', minutes: TOTAL, live: false, status: 'ready', longLabels: false, stats: true, height: 240, width: 'card' },
  argTypes: {
    mode: { control: 'inline-radio', options: ['all', 'gates', 'devices'] },
    status: { control: 'inline-radio', options: ['ready', 'loading', 'error', 'empty', 'no-access'] },
    width: { control: 'inline-radio', options: ['small', 'card', 'wide'] },
    minutes: { control: { type: 'range', min: 10, max: 2000, step: 10 } },
  },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof FlowDemo>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Gates: Story = {};
export const SingleLine: Story = { args: { mode: 'all' } };
/** Six lines: focus one by its card. */
export const ManyDevices: Story = { args: { mode: 'devices' } };
/** Live entry: a minute every 1.6 s, pulses on fresh minutes, an idle gate gets a badge. */
export const Live: Story = { args: { live: true } };
export const LiveSingleLine: Story = { args: { live: true, mode: 'all' } };
export const LongLabels: Story = { args: { longLabels: true } };
/** Two thousand minutes per line: canvas keeps zoom and hover smooth. */
export const Dense: Story = { args: { minutes: 2000, mode: 'devices' } };
export const NoStats: Story = { args: { stats: false } };
export const Loading: Story = { args: { status: 'loading' } };
export const LoadError: Story = { args: { status: 'error' } };
export const Empty: Story = { args: { status: 'empty' } };
export const NoAccess: Story = { args: { status: 'no-access' } };
export const SmallCard: Story = { args: { width: 'small', height: 200 } };
export const Wide: Story = { args: { width: 'wide', height: 320 } };
export const Phone: Story = { parameters: { viewport: { defaultViewport: 'phone' } } };
export const PhoneLive: Story = { args: { live: true, mode: 'devices' }, parameters: { viewport: { defaultViewport: 'phone' } } };
