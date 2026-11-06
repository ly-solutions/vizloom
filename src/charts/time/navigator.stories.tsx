import './stories.css';

import type { Meta, StoryObj } from '@storybook/react';

import { DAY, useViewport, useViewportTarget } from '../../core';
import { dailyFrame, DEMO_CHANNELS, demoMarkers, demoSales, demoZones } from './demo-data';
import { Navigator } from './navigator';
import { ZoomControls } from './zoom-controls';

const sales = demoSales();
const frame = dailyFrame(sales);
const series = DEMO_CHANNELS.map((c, i) => ({ id: c.id, label: c.label, color: `var(--vl-cat-${i + 1})` }));
const ZOOM_LABELS = { zoomIn: 'Zoom in', zoomOut: 'Zoom out', resetZoom: 'Whole period' } as const;
const extent = { start: frame.start, end: frame.start + frame.length * DAY };

function NavigatorDemo({ withMarkers = false, ready = true }: { readonly withMarkers?: boolean; readonly ready?: boolean }) {
  const viewport = useViewport({ extent, initial: { start: sales.now - 14 * DAY, end: sales.now } });
  const target = useViewportTarget(viewport);
  return (
    <div className="sb-stack">
      <ZoomControls viewport={viewport} labels={ZOOM_LABELS} />
      <Navigator
        viewport={viewport}
        series={series}
        frame={ready ? frame : null}
        ready={ready}
        zones={demoZones(sales)}
        now={sales.now}
        eventAt={sales.event}
        eventLabel="Concert"
        markers={withMarkers ? demoMarkers(sales) : undefined}
        renderMarkerIcon={withMarkers ? () => <span aria-hidden="true">•</span> : undefined}
      />
      <output>{`${new Date(target.start).toISOString().slice(0, 10)} → ${new Date(target.end).toISOString().slice(0, 10)}`}</output>
    </div>
  );
}

const meta = {
  title: 'Charts/Time/Navigator',
  component: NavigatorDemo,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof NavigatorDemo>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Drag the window, drag its edges, click outside to jump, wheel to zoom; arrows, +/−, Home on the keyboard. */
export const Default: Story = {};

export const WithMarkers: Story = { args: { withMarkers: true } };

export const Loading: Story = { args: { ready: false } };

export const Phone: Story = { parameters: { viewport: { defaultViewport: 'phone' } } };
