import { type ReactNode, useCallback, useMemo, useRef } from 'react';

import {
  type BaseChartProps,
  cx,
  frameCoverage,
  LiveNumber,
  type Series,
  type SeriesFrame,
  type TimeZoneBand,
  useControllableState,
  useFormat,
  useViewport,
} from '../../core';
import { colorOf } from '../shared/series';
import type { TimeEngine } from '../time/engine/time-engine';
import { type LiveEvent, TimeSeriesChart } from '../time/time-series-chart';
import { FLOW_MIN_WINDOW, flowStats, minuteTicks, selectionWindow } from './flow';
import { type FlowLabels, flowLabels } from './labels';

export interface FlowSeries<Id extends string = string> extends Series<Id> {
  /** Secondary caption on the card ("2 devices"). */
  readonly note?: string;
}

export interface FlowChartProps<Id extends string = string> extends BaseChartProps {
  /** Per-bucket throughput (people per minute, scans per minute…); `NaN` — not yet (live future). */
  readonly frame: SeriesFrame<Id>;
  readonly series: readonly FlowSeries<Id>[];
  /** Live: the "now" line, current values, pulses on fresh buckets. */
  readonly live?: boolean;
  /** "Now", ms; default — the end of the last bucket with data. */
  readonly now?: number;
  /** Start of the event: the stretch before it is shaded and captioned. */
  readonly startAt?: number;
  /** Extra shaded periods. */
  readonly zones?: readonly TimeZoneBand[];
  /** Focused series (controlled). */
  readonly focus?: Id | null;
  readonly onFocusChange?: (id: Id | null) => void;
  /** Series cards under the chart; default true when there is more than one series. */
  readonly cards?: boolean;
  /** Figures over the chart: now / peak / average (live) or average / peak / passed. Default true. */
  readonly stats?: boolean;
  /** Dragging across the chart zooms into the stretch. Default true. */
  readonly selectToZoom?: boolean;
  readonly labels?: Partial<FlowLabels>;
  /** Content on the right of the toolbar (mode switch: all / gates / devices). */
  readonly toolbar?: ReactNode;
}

const DEFAULT_HEIGHT = 240;

/**
 * Throughput over minutes (entry speed, scans, check-ins): one line per gate or device, cards
 * under the chart with the current (or average) rate and the peak, a click on a card focuses its
 * line. Drag across the plot to zoom into a stretch; ctrl + wheel, pinch or the buttons zoom too.
 * Built on the canvas time chart: thousands of minutes stay smooth.
 */
export function FlowChart<Id extends string = string>({
  frame,
  series,
  title,
  description,
  height = DEFAULT_HEIGHT,
  state,
  unit,
  formatValue,
  animate = true,
  className,
  live = false,
  now: nowProp,
  startAt,
  zones: zonesProp,
  focus: focusProp,
  onFocusChange,
  cards: cardsProp,
  stats: showStats = true,
  selectToZoom = true,
  labels: labelsProp,
  toolbar,
  'data-testid': testId,
}: FlowChartProps<Id>) {
  const fmt = useFormat();
  const l = useMemo(() => ({ ...flowLabels(fmt.locale), ...labelsProp }), [fmt.locale, labelsProp]);
  const [focus, setFocus] = useControllableState<Id | null>(focusProp, null, onFocusChange);
  const ids = useMemo(() => series.map((s) => s.id), [series]);
  const stats = useMemo(() => flowStats(frame, ids), [frame, ids]);
  const coverage = frameCoverage(frame);
  const extent = useMemo(() => ({ start: coverage.start, end: coverage.end }), [coverage.start, coverage.end]);
  const viewport = useViewport({ extent, minSpan: Math.min(FLOW_MIN_WINDOW, extent.end - extent.start) });
  const now = nowProp ?? (live ? frame.start + stats.filled * frame.step : 0);
  const engine = useRef<TimeEngine | null>(null);
  const showCards = cardsProp ?? series.length > 1;
  const blocked = state !== undefined && state.status !== 'ready' && state.status !== 'partial';

  const perMin = (v: number) => (formatValue ? formatValue(v) : fmt.number(v, v < 10 ? 1 : 0));
  const timeOf = (t: number) => (t === t ? fmt.time(t) : '—');

  const zones = useMemo(() => {
    const out: TimeZoneBand[] = [...(zonesProp ?? [])];
    if (startAt !== undefined && startAt > frame.start)
      out.push({ id: 'before-start', from: frame.start, to: startAt, label: l.beforeStart, tone: 'neutral' });
    return out;
  }, [zonesProp, startAt, frame.start, l.beforeStart]);

  // Live pulses: the newest filled bucket of each series that moved.
  const liveEvents = useMemo<LiveEvent<Id>[]>(() => {
    if (!live || stats.filled === 0) return [];
    const k = stats.filled - 1;
    const t = frame.start + k * frame.step + frame.step / 2;
    return ids
      .filter((id) => {
        const v = frame.values[id][k];
        return v !== undefined && v === v && v > 0;
      })
      .map((id) => ({ key: `${id}:${k}`, id, t, text: `+${fmt.number(Number(frame.values[id][k]))}` }));
  }, [live, stats.filled, frame, ids, fmt]);

  const onZoneDraft = useCallback(
    (range: { start: number; end: number } | null, done: boolean) => {
      if (!done) return;
      const e = engine.current;
      if (e) {
        e.draft = null;
        e.kick();
      }
      const next = range ? selectionWindow(range) : null;
      if (next) viewport.setRange(next);
    },
    [viewport],
  );

  const xTicks = useMemo(() => minuteTicks((t) => fmt.time(t)), [fmt]);
  const bucketLabel = useCallback((start: number, step: number) => `${fmt.time(start)}–${fmt.time(start + step)}`, [fmt]);

  const focused = focus !== null ? stats.series[focus] : null;
  const head = focused ?? stats.all;
  const statItems: { id: string; label: string; value: number; text: string; note?: string; live?: boolean }[] = [];
  if (live) statItems.push({ id: 'now', label: l.current, value: head.current, text: perMin(head.current), live: true });
  else statItems.push({ id: 'avg', label: l.average, value: head.average, text: perMin(head.average) });
  statItems.push({ id: 'peak', label: l.peak, value: head.peak, text: perMin(head.peak), note: timeOf(head.peakAt) });
  if (live) statItems.push({ id: 'avg', label: l.average, value: head.average, text: perMin(head.average) });
  else statItems.push({ id: 'total', label: l.total, value: head.total, text: fmt.number(head.total) });

  return (
    <div className={cx('vl-biz', 'vl-flow', className)} data-testid={testId}>
      {showStats && !blocked && state?.status !== 'loading' ? (
        <dl className="vl-flow__stats">
          {statItems.map((s) => (
            <div key={s.id} className="vl-flow__stat">
              <dt>{s.label}</dt>
              <dd>
                {s.live ? <LiveNumber value={s.value} format={perMin} pulse /> : <b>{s.text}</b>}
                {s.note ? <span>{s.note}</span> : null}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      <TimeSeriesChart<Id>
        title={title}
        description={description ? `${description} ${l.selectHint}` : l.selectHint}
        height={height}
        state={state}
        unit={unit}
        formatValue={formatValue}
        animate={animate}
        series={series}
        frame={frame}
        kind={series.length > 1 ? 'line' : 'area'}
        gradient={series.length > 1 ? 0 : 0.5}
        curve="smooth"
        legend={false}
        focus={focus}
        onFocusChange={setFocus}
        viewport={viewport}
        navigator={false}
        zoneDraw={selectToZoom}
        onZoneDraft={onZoneDraft}
        engineRef={engine}
        live={live}
        now={now}
        liveEvents={liveEvents}
        zones={zones}
        bucketLabel={bucketLabel}
        xTicks={frame.step < 3_600_000 ? xTicks : undefined}
        minSpan={FLOW_MIN_WINDOW}
        toolbar={toolbar}
        points="none"
      />
      {showCards && !blocked ? (
        <div className="vl-flow__cards" role="group" aria-label={`${l.cards}. ${l.seriesHint}`}>
          {series.map((s, i) => {
            const st = stats.series[s.id];
            const off = focus !== null && focus !== s.id;
            return (
              <button
                key={s.id}
                type="button"
                className="vl-flow__card"
                aria-pressed={focus === s.id}
                data-off={off || undefined}
                data-idle={(live && st.idle) || undefined}
                ref={(node) => node?.style.setProperty('--vl-flow-color', colorOf(s, i))}
                onClick={() => setFocus(focus === s.id ? null : s.id)}
              >
                <span className="vl-flow__card-name">
                  <span className="vl-flow__card-dot" aria-hidden="true" />
                  {s.label}
                  {live && st.idle ? <span className="vl-flow__idle">{l.idle}</span> : null}
                </span>
                <b className="vl-flow__card-value">{live ? l.perMinute(perMin(st.current)) : l.avgPerMinute(perMin(st.average))}</b>
                <span className="vl-flow__card-note">
                  {st.peakAt === st.peakAt ? l.peakAt(perMin(st.peak), timeOf(st.peakAt)) : s.note}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
