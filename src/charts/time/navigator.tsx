import { type ReactNode, useEffect, useRef, useState } from 'react';

import {
  ChartTooltip,
  cx,
  type SeriesFrame,
  type TimeMarker,
  type TimeZoneBand,
  useFormat,
  useIsomorphicLayoutEffect,
  useReducedMotion,
  useViewportTarget,
  type Viewport,
} from '../../core';
import { NavigatorEngine } from './engine/navigator-engine';
import type { TimeEngine } from './engine/time-engine';
import { layoutMarkers, pxPerDay } from './model/markers';
import type { ChartSeries } from './time-canvas';

export interface NavigatorProps<Id extends string = string, Kind extends string = string> {
  readonly viewport: Viewport;
  readonly series: readonly ChartSeries<Id>[];
  /** Frame of the whole history (`useOverviewData`). */
  readonly frame: SeriesFrame<Id> | null;
  /** Data is there; otherwise a skeleton. */
  readonly ready: boolean;
  readonly refreshing?: boolean;
  readonly hidden?: ReadonlySet<Id>;
  readonly zones?: readonly TimeZoneBand[];
  readonly showZones?: boolean;
  readonly now?: number;
  /** The event moment and its caption in the future part of the strip. */
  readonly eventAt?: number | null;
  readonly eventLabel?: string;
  /** Markers over the strip: the main ones when zoomed out, all of them closer. */
  readonly markers?: readonly TimeMarker<Id, Kind>[];
  readonly renderMarkerIcon?: (marker: TimeMarker<Id, Kind>) => ReactNode;
  /** A marker was picked: the chart window moves to it. */
  readonly onMarkerSelect?: (marker: TimeMarker<Id, Kind>) => void;
  /** Align the strip with the plot of the chart above it. */
  readonly alignTo?: TimeEngine | null;
  /** Animation duration multiplier. */
  readonly slow?: number;
  readonly onInteract?: () => void;
  readonly className?: string;
  readonly 'aria-label'?: string;
}

const MARKER_GAP = 15;
/** The window we move to around a marker is at most 10 days wide. */
const MARKER_SPAN = 10 * 86_400_000;

/**
 * The "whole period" strip: the full history, the chart window with handles, markers. Works on
 * the same `Viewport` as the chart and moves with it. Drag the window, drag a handle to resize,
 * click outside to jump, wheel to zoom, pinch on touch, arrows/plus/minus/Home on the keyboard.
 */
export function Navigator<Id extends string = string, Kind extends string = string>({
  viewport,
  series,
  frame,
  ready,
  refreshing = false,
  hidden,
  zones,
  showZones = true,
  now = 0,
  eventAt = null,
  eventLabel = '',
  markers,
  renderMarkerIcon,
  onMarkerSelect,
  alignTo,
  slow = 1,
  onInteract,
  className,
  'aria-label': ariaLabel = 'Whole period',
}: NavigatorProps<Id, Kind>) {
  const fmt = useFormat();
  const reduced = useReducedMotion();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [engine, setEngine] = useState<NavigatorEngine | null>(null);
  const markerEls = useRef(new Map<string, HTMLButtonElement>());
  const [hint, setHint] = useState<{ id: string; x: number } | null>(null);
  const [width, setWidth] = useState(0);
  const target = useViewportTarget(viewport);
  const latest = useRef({ markers });
  latest.current = { markers };

  useIsomorphicLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const created = new NavigatorEngine(canvas, viewport);
    setEngine(created);
    return () => {
      created.destroy();
      setEngine(null);
    };
  }, [viewport]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof ResizeObserver !== 'function') return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!engine) return;
    engine.slow = reduced ? 0 : slow;
    engine.onInteract = onInteract ?? null;
  }, [engine, slow, reduced, onInteract]);
  useEffect(() => {
    engine?.setSeries(series, hidden ?? new Set());
  }, [engine, series, hidden]);
  useEffect(() => {
    engine?.setFrame(frame, ready);
  }, [engine, frame, ready]);
  useEffect(() => {
    engine?.setRefreshing(refreshing);
  }, [engine, refreshing]);
  useEffect(() => {
    engine?.setZones(zones ?? [], showZones);
  }, [engine, zones, showZones]);
  useEffect(() => {
    if (!engine) return;
    engine.now = now;
    engine.eventAt = eventAt;
    engine.eventLabel = eventLabel;
    engine.kick();
  }, [engine, now, eventAt, eventLabel]);

  // Same insets as the chart: the strip window stands exactly under the chart window.
  useEffect(() => {
    if (!engine || !alignTo) return;
    const sync = () => {
      const plot = alignTo.plot;
      engine.setInsets({ left: plot.left, right: Math.max(0, alignTo.W - plot.left - plot.width) });
    };
    sync();
    return alignTo.subscribePaint(sync);
  }, [engine, alignTo]);

  useEffect(() => {
    if (!engine) return;
    engine.onPaint = () => {
      const list = latest.current.markers;
      if (!list?.length) return;
      const strip = engine.strip;
      const extent = viewport.extent;
      const view = viewport.state.current;
      const layout = layoutMarkers(list, (t) => engine.xOf(t), {
        pxPerDay: pxPerDay(extent.end - extent.start, strip.right - strip.left),
        minGap: MARKER_GAP,
      });
      for (const m of list) {
        const el = markerEls.current.get(m.id);
        if (!el) continue;
        const x = engine.xOf(m.t);
        const visible = ready && !!layout.get(m.id)?.visible;
        el.style.setProperty('--vl-marker-x', `${x.toFixed(1)}px`);
        el.dataset['visible'] = visible ? 'true' : 'false';
        el.dataset['inside'] = m.t >= view.start && m.t <= view.end ? 'true' : 'false';
        el.tabIndex = visible ? 0 : -1;
      }
    };
    engine.kick();
  }, [engine, viewport, ready, markers]);

  const showHint = (m: TimeMarker<Id, Kind>) => engine && setHint({ id: m.id, x: engine.xOf(m.t) });
  const hintMarker = hint ? markers?.find((m) => m.id === hint.id) : null;

  return (
    <div ref={rootRef} className={cx('vl-nav', className)}>
      {markers?.length && renderMarkerIcon ? (
        <div className="vl-nav__markers">
          {markers.map((m) => (
            <button
              key={m.id}
              ref={(el) => {
                if (el) markerEls.current.set(m.id, el);
                else markerEls.current.delete(m.id);
              }}
              type="button"
              className="vl-nav__marker"
              data-visible="false"
              aria-label={`${m.label}, ${fmt.day(m.t)}`}
              onPointerEnter={() => showHint(m)}
              onPointerLeave={() => setHint(null)}
              onFocus={() => showHint(m)}
              onBlur={() => setHint(null)}
              onClick={() => {
                const span = Math.min(target.end - target.start, MARKER_SPAN);
                viewport.setRange({ start: m.t - span / 2, end: m.t + span / 2 });
                onMarkerSelect?.(m);
              }}
            >
              {renderMarkerIcon(m)}
            </button>
          ))}
        </div>
      ) : null}
      <canvas
        ref={canvasRef}
        className="vl-nav__canvas vl-gesture-surface"
        tabIndex={0}
        role="slider"
        aria-label={ariaLabel}
        aria-orientation="horizontal"
        aria-valuemin={viewport.extent.start}
        aria-valuemax={viewport.extent.end}
        aria-valuenow={Math.round((target.start + target.end) / 2)}
        aria-valuetext={fmt.range(target.start, target.end)}
      />
      <ChartTooltip open={!!hintMarker} anchor={hint ? { x: hint.x, y: 0 } : null} bounds={{ width, height: 48 }} prefer="top">
        {hintMarker ? <span className="vl-nav__hint">{`${hintMarker.label} · ${fmt.day(hintMarker.t)}`}</span> : null}
      </ChartTooltip>
    </div>
  );
}
