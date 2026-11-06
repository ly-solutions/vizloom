import { type ReactNode, type Ref, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  type BlockState,
  compareColor,
  cx,
  DATA_STATUS,
  frameCoverage,
  type Granularity,
  type GranularityThresholds,
  Legend,
  type LegendItem,
  type MarkerEffect,
  type SeriesFrame,
  StateView,
  type TimeExtent,
  type TimeMarker,
  type TimeRange,
  type TimeSeriesChartProps,
  type TileSource,
  useElementSize,
  useFormat,
  useGranularity,
  useLatest,
  useOverviewData,
  useTileData,
  useViewport,
  useViewportTarget,
  type Viewport,
} from '../../core';
import { colorOf, useSeriesVisibility } from '../shared/series';
import {
  CHART_STATUS,
  type ChartGuide,
  type ChartStatus,
  type PointsMode,
  type TimeEngine,
  type TimeEngineOptions,
  type ZoneHit,
} from './engine/time-engine';
import { columnGranularityThresholds } from './granularity';
import { timeChartLabels, type TimeChartLabels } from './labels';
import { alignCompare, daysBeforeTicks } from './model/compare';
import { Navigator } from './navigator';
import { type ChartSeries, type MarkerEffectContext, type SeriesSummaryContext, TimeCanvas, type TimeTooltipContext } from './time-canvas';
import { ZoomControls } from './zoom-controls';

/** A live event: a pulse at moment `t` on series `id`, with an optional floating caption ("+2"). */
export interface LiveEvent<Id extends string = string> {
  /** Unique key: a new key fires a new pulse. */
  readonly key: string;
  readonly id: Id;
  readonly t: number;
  readonly text?: string;
}

export interface TimeSeriesChartExtraProps<Id extends string = string, Kind extends string = string> {
  /** Whole-period strip under the chart. Default: true when zoomable. */
  readonly navigator?: boolean;
  /** Zoom buttons over the chart. Default: true when zoomable. */
  readonly zoomControls?: boolean;
  /** Dots on the line: auto (when buckets are wide), always, none. */
  readonly points?: PointsMode;
  /** Fill density under lines, 0…1 (area). */
  readonly gradient?: number;
  readonly lineWidth?: number;
  /** Caption at the maximum ("peak · 1,240 · 12 Oct"). */
  readonly peak?: boolean;
  /** Dashed horizontal guides: average, target. */
  readonly guides?: readonly ChartGuide[];
  /** Y axis: `left` outside the plot, `right` inside it, `auto` — right on narrow containers. */
  readonly axis?: 'auto' | 'left' | 'right';
  /** Grid lines. Default true. */
  readonly grid?: boolean;
  /** Animation speed multiplier (stories: 4 = slow motion). */
  readonly slow?: number;
  /** Words on the chart. */
  readonly labels?: Partial<TimeChartLabels>;
  /** Live pulses and floating "+N" captions. */
  readonly liveEvents?: readonly LiveEvent<Id>[];
  /** Zone drawing: dragging selects a period and reports it. */
  readonly zoneDraw?: boolean;
  readonly onZoneDraft?: (range: TimeRange | null, done: boolean) => void;
  readonly onZoneRemove?: (id: string) => void;
  readonly onZoneHover?: (hit: ZoneHit | null) => void;
  /** Screen-reader name of a marker. */
  readonly markerLabel?: (marker: TimeMarker<Id, Kind>) => string;
  readonly selectedMarker?: string | null;
  readonly onSelectedMarkerChange?: (id: string | null) => void;
  /** Series summary popover / phone sheet after a click on a series. */
  readonly renderSummary?: (context: SeriesSummaryContext<Id>) => ReactNode;
  /** Replace the "before → after" card of a marker; `null` hides it. */
  readonly renderEffect?: ((context: MarkerEffectContext<Id, Kind>) => ReactNode) | null;
  /** Granularity thresholds (px per bucket) when the granularity follows the zoom. */
  readonly granularityThresholds?: Partial<Record<Granularity, GranularityThresholds>>;
  /** Pause before the hover tooltip returns after a pinned one was closed, ms. */
  readonly tooltipDelay?: number;
  /** Caption of the event moment in the navigator. */
  readonly eventLabel?: string;
  /** Custom X ticks and bucket captions (minutes, offsets). */
  readonly xTicks?: TimeEngineOptions['xTicks'];
  readonly bucketLabel?: TimeEngineOptions['bucketLabel'];
  /** Smallest window, ms. Default 3 hours (or 6 buckets of the frame). */
  readonly minSpan?: number;
  /** Extra content on the right of the toolbar (mode switches). */
  readonly toolbar?: ReactNode;
  readonly engineRef?: Ref<TimeEngine | null>;
  readonly onRangeChange?: (range: TimeRange) => void;
}

export type TimeSeriesChartAllProps<Id extends string = string, Metric extends string = string, Kind extends string = string> = Omit<
  TimeSeriesChartProps<Id, Metric>,
  'markers' | 'renderMarkerIcon' | 'markerEffect'
> &
  TimeSeriesChartExtraProps<Id, Kind> & {
    readonly markers?: readonly TimeMarker<Id, Kind>[];
    readonly renderMarkerIcon?: (marker: TimeMarker<Id, Kind>) => ReactNode;
    readonly markerEffect?: (marker: TimeMarker<Id, Kind>) => MarkerEffect | null;
  };

const NARROW = 480;

const CURVE_SMOOTH = { smooth: 1, linear: 0, step: -1 } as const;

function extentOf(props: { extent?: TimeExtent; source?: TileSource<string, string>; frame?: SeriesFrame<string> }): TimeExtent {
  if (props.extent) return props.extent;
  if (props.source) return props.source.extent;
  if (props.frame) return frameCoverage(props.frame);
  return { start: 0, end: 1 };
}

function frameIsEmpty(frame: SeriesFrame<string>): boolean {
  for (const key of Object.keys(frame.values)) {
    const col = frame.values[key];
    for (let k = 0; k < col.length; k++) if (Number(col[k]) > 0) return false;
  }
  return true;
}

/**
 * A complete time-series block: legend, canvas chart (area, line, stacked, columns), zoom
 * buttons and the whole-period navigator. Data comes as a ready `frame` or from a tile `source`
 * (zoom loads finer tiles, stale requests are aborted, the previous frame morphs into the next).
 * Comparison mode lines up several events by date or by days before the event.
 */
export function TimeSeriesChart<Id extends string = string, Metric extends string = string, Kind extends string = string>(
  props: TimeSeriesChartAllProps<Id, Metric, Kind>,
) {
  const {
    title,
    description,
    height,
    state,
    unit,
    formatValue,
    animate = true,
    className,
    legend = true,
    tooltip = true,
    pinnable = true,
    onHover,
    onSelect,
    series,
    source,
    metric,
    kind = 'area',
    stack = 'overlay',
    curve = 'smooth',
    initialRange,
    granularity: fixedGranularity,
    zones,
    markers,
    renderMarkerIcon,
    markerEffect,
    now: nowProp,
    zoomable = true,
    live = false,
    compare,
    compareAlign = 'date',
    navigator: navigatorProp,
    zoomControls: zoomControlsProp,
    points,
    gradient,
    lineWidth,
    peak = false,
    guides,
    axis = 'auto',
    grid = true,
    slow = 1,
    liveEvents,
    zoneDraw = false,
    onZoneDraft,
    onZoneRemove,
    onZoneHover,
    markerLabel,
    selectedMarker,
    onSelectedMarkerChange,
    renderSummary,
    renderEffect,
    granularityThresholds,
    tooltipDelay,
    eventLabel,
    xTicks,
    bucketLabel,
    minSpan,
    toolbar,
    engineRef,
    onRangeChange,
  } = props;
  const fmt = useFormat();
  const labels = useMemo(() => ({ ...timeChartLabels(fmt.locale), ...props.labels }), [fmt.locale, props.labels]);
  const [sizeRef, size] = useElementSize<HTMLDivElement>();
  const [engine, setEngine] = useState<TimeEngine | null>(null);
  const setEngineRef = useCallback(
    (e: TimeEngine | null) => {
      setEngine(e);
      if (typeof engineRef === 'function') engineRef(e);
      else if (engineRef) (engineRef as { current: TimeEngine | null }).current = e;
    },
    [engineRef],
  );

  // ───── comparison: series and frame come from the compared events ─────
  const aligned = useMemo(() => (compare?.length ? alignCompare(compare, compareAlign) : null), [compare, compareAlign]);
  const compareSeries = useMemo(
    () =>
      compare?.map((c, i) => ({
        id: c.id as Id,
        label: c.label,
        color: c.color ?? (c.role === 'compare' ? compareColor(i) : colorOf(c, i)),
      })),
    [compare],
  );

  const chartSeries: readonly ChartSeries<Id>[] = useMemo(
    () => compareSeries ?? series.map((s, i) => ({ id: s.id, label: s.label, color: colorOf(s, i) })),
    [compareSeries, series],
  );
  const ids = useMemo(() => chartSeries.map((s) => s.id), [chartSeries]);
  const vis = useSeriesVisibility(ids, {
    hidden: props.hidden,
    onHiddenChange: props.onHiddenChange,
    focus: props.focus,
    onFocusChange: props.onFocusChange,
  });

  const staticFrame = (aligned?.frame as SeriesFrame<Id> | undefined) ?? props.frame ?? null;
  const extent = useMemo(
    () =>
      extentOf({
        extent: aligned ? undefined : props.extent,
        source: aligned ? undefined : (source as TileSource<string, string> | undefined),
        frame: staticFrame ?? undefined,
      }),
    [aligned, props.extent, source, staticFrame],
  );
  const span = Math.max(1, extent.end - extent.start);
  const ownViewport = useViewport({
    extent,
    initial: initialRange,
    minSpan: minSpan ?? Math.min(span, Math.max(staticFrame ? staticFrame.step * 6 : 3 * 3_600_000, 60_000)),
  });
  const viewport: Viewport = props.viewport ?? ownViewport;
  const target = useViewportTarget(viewport);
  const latestRange = useLatest(onRangeChange);
  useEffect(() => {
    latestRange.current?.(target);
  }, [target, latestRange]);

  // ───── data ─────
  const plotWidth = Math.max(0, size.width - 60);
  const visibleCount = ids.filter((id) => !vis.hidden.has(id)).length;
  const thresholds = granularityThresholds ?? (kind === 'columns' ? columnGranularityThresholds(stack, visibleCount) : undefined);
  const granularity = useGranularity(target, plotWidth, { fixed: fixedGranularity, thresholds });
  const fallbackSource = useMemo<TileSource<Id, Metric>>(() => ({ extent, load: () => new Promise<never>(() => undefined) }), [extent]);
  const tiles = useTileData<Id, Metric>(source ?? fallbackSource, {
    metric: (metric ?? ('' as Metric)) as Metric,
    granularity,
    range: target,
    enabled: !!source && !aligned,
  });
  const showNavigator = (navigatorProp ?? zoomable) && !!(source || staticFrame);
  const overview = useOverviewData<Id, Metric>(
    source ?? fallbackSource,
    (metric ?? ('' as Metric)) as Metric,
    !!source && showNavigator && !aligned,
  );
  const frame: SeriesFrame<Id> | null = source && !aligned ? tiles.frame : staticFrame;
  const navFrame: SeriesFrame<Id> | null = source && !aligned ? overview.frame : staticFrame;

  // ───── status ─────
  const block: BlockState = state ?? { status: 'ready' };
  let status: ChartStatus = CHART_STATUS.ready;
  let overlayState: BlockState | null = null;
  if (block.status === 'loading') status = CHART_STATUS.loading;
  else if (block.status === 'error' || block.status === 'empty' || block.status === 'no-access') {
    status = block.status === 'error' ? CHART_STATUS.error : CHART_STATUS.empty;
    overlayState = block;
  } else if (source && !aligned) {
    if (tiles.status === DATA_STATUS.loading) status = CHART_STATUS.loading;
    else if (tiles.status === DATA_STATUS.error) {
      status = CHART_STATUS.error;
      overlayState = { status: 'error', onRetry: tiles.retry };
    }
  } else if (!frame) status = CHART_STATUS.loading;
  if (status === CHART_STATUS.ready && frame && frameIsEmpty(frame as SeriesFrame<string>)) {
    status = CHART_STATUS.empty;
    overlayState = { status: 'empty' };
  }
  const refreshing = !!source && !aligned && tiles.status === DATA_STATUS.refreshing;
  const stale = !!source && !aligned && tiles.status === DATA_STATUS.staleError;

  // ───── engine options ─────
  const narrow = size.width > 0 && size.width < NARROW;
  const axisSide = axis === 'auto' ? (narrow ? 'right' : 'left') : axis;
  const days = useCallback((n: number) => (n === 0 ? labels.event : fmt.locale.strings.daysBefore(-n)), [labels.event, fmt.locale]);
  const compareTicks = useMemo(() => (aligned?.align === 'days-before' ? daysBeforeTicks(days) : null), [aligned, days]);
  const compareBucketLabel = useMemo(
    () => (aligned?.align === 'days-before' ? (start: number, step: number) => days(Math.round((start + step / 2) / 86_400_000)) : null),
    [aligned, days],
  );
  const options = useMemo<Partial<TimeEngineOptions>>(
    () => ({
      mode: stack,
      smooth: CURVE_SMOOTH[curve],
      gradient: gradient ?? (kind === 'line' ? 0 : 0.6),
      lineWidth: lineWidth ?? (narrow ? 1.5 : 2),
      points: points ?? 'auto',
      grid,
      zones: true,
      peak,
      slow: animate ? slow : 0,
      unit: unit ?? undefined,
      formatY: formatValue ?? null,
      axis: axisSide,
      guides: guides ?? [],
      zoneDraw,
      live,
      xTicks: xTicks ?? compareTicks,
      bucketLabel: bucketLabel ?? compareBucketLabel,
    }),
    [
      stack,
      curve,
      gradient,
      kind,
      lineWidth,
      narrow,
      points,
      grid,
      peak,
      animate,
      slow,
      unit,
      formatValue,
      axisSide,
      guides,
      zoneDraw,
      live,
      xTicks,
      compareTicks,
      bucketLabel,
      compareBucketLabel,
    ],
  );
  const cleanOptions = useMemo(() => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(options)) if (v !== undefined) out[k] = v;
    return out as Partial<TimeEngineOptions>;
  }, [options]);

  // ───── live: the window follows "now" when it was at the right edge ─────
  const now = aligned ? 0 : (nowProp ?? extent.now ?? 0);
  const lastNow = useRef(now);
  useEffect(() => {
    if (!live || !now) return;
    const prev = lastNow.current;
    lastNow.current = now;
    const t = viewport.state.target;
    if (prev && t.end >= prev - 1 && now > prev) viewport.panBy(now - prev);
  }, [live, now, viewport]);

  // ───── live pulses ─────
  const seenLive = useRef(new Set<string>());
  useEffect(() => {
    if (!engine || !liveEvents?.length) return;
    const fresh = liveEvents.filter((e) => !seenLive.current.has(e.key));
    if (!fresh.length) return;
    for (const e of fresh) seenLive.current.add(e.key);
    engine.pulse(fresh.map((e) => ({ id: e.id, t: e.t })));
    const texts = fresh.filter((e) => e.text);
    if (texts.length) engine.float(texts.map((e) => ({ id: e.id, t: e.t, text: e.text ?? '' })));
  }, [engine, liveEvents]);

  // ───── tooltip hookups to the contract ─────
  const renderTooltip = useMemo(() => {
    if (tooltip === false) return null;
    const formatCell = (value: number) => {
      if (value !== value) return '—';
      if (formatValue) return formatValue(value);
      return fmt.value(value, unit ?? { kind: 'count' }, true);
    };
    if (typeof tooltip === 'function') {
      return (c: TimeTooltipContext<Id, Kind>) =>
        tooltip({
          title: c.title,
          index: c.k,
          t: c.start,
          values: Object.fromEntries(c.values.map((v) => [v.id, v.value])) as Partial<Record<Id, number>>,
          rows: c.values.map((v) => ({
            id: v.id,
            label: v.label,
            color: v.color,
            value: formatCell(v.value),
          })),
        });
    }
    return undefined;
  }, [tooltip, formatValue, fmt, unit]);

  const latestSelect = useLatest(onSelect);
  const onPress = useCallback(
    (press: { k: number; seriesId: string | null }) => latestSelect.current?.(press.k, press.seriesId as Id | null),
    [latestSelect],
  );

  const legendItems: LegendItem<Id>[] = useMemo(
    () =>
      chartSeries.map((s, i) => ({ id: s.id, label: s.label, color: s.color, shape: compare?.[i]?.role === 'compare' ? 'line' : 'dot' })),
    [chartSeries, compare],
  );
  let legendAt: 'top' | 'bottom' | null = legend === 'bottom' ? 'bottom' : 'top';
  if (legend === false) legendAt = null;
  const legendNode =
    legendAt && chartSeries.length > 1 ? (
      <Legend
        items={legendItems}
        hidden={vis.hidden}
        focus={vis.focus}
        onToggle={vis.toggle}
        onSolo={vis.solo}
        onFocus={vis.setFocus}
        loading={status === CHART_STATUS.loading && !frame}
        layout={narrow ? 'scroll' : 'wrap'}
      />
    ) : null;
  const showZoom = (zoomControlsProp ?? zoomable) && !aligned;

  const overlay = overlayState ? <StateView state={overlayState} size={narrow ? 'compact' : 'regular'} /> : null;

  return (
    <div ref={sizeRef} className={cx('vl-tschart', narrow && 'vl-tschart--narrow', className)} data-testid={props['data-testid']}>
      {legendAt === 'top' || showZoom || toolbar ? (
        <div className="vl-tschart__toolbar">
          <div className="vl-tschart__legend">{legendAt === 'top' ? legendNode : null}</div>
          {toolbar}
          {showZoom ? <ZoomControls viewport={viewport} labels={labels} disabled={status !== CHART_STATUS.ready} /> : null}
        </div>
      ) : null}
      {stale ? (
        <div className="vl-tschart__stale" role="status">
          <span>{labels.staleError}</span>
          <button type="button" onClick={tiles.retry}>
            {labels.retry}
          </button>
        </div>
      ) : null}
      {block.status === 'partial' ? (
        <div className="vl-tschart__partial" role="note">
          {block.reason ?? fmt.locale.strings.partialReason}
        </div>
      ) : null}
      <TimeCanvas<Id, Kind>
        series={chartSeries}
        frame={frame}
        status={status}
        refreshing={refreshing}
        viewport={viewport}
        renderer={kind === 'columns' ? 'bar' : 'wave'}
        options={cleanOptions}
        hidden={vis.hidden}
        focus={vis.focus}
        zones={aligned ? undefined : zones}
        markers={aligned ? undefined : markers}
        renderMarkerIcon={renderMarkerIcon}
        markerLabel={markerLabel}
        markerEffect={markerEffect}
        now={now}
        renderTooltip={renderTooltip}
        renderSummary={pinnable ? renderSummary : undefined}
        renderEffect={renderEffect}
        onPress={onPress}
        onHoverChange={onHover}
        onZoneDraft={onZoneDraft}
        onZoneRemove={onZoneRemove}
        onZoneHover={onZoneHover}
        selectedMarker={selectedMarker}
        onSelectedMarkerChange={onSelectedMarkerChange}
        labels={props.labels}
        tooltipDelay={tooltipDelay}
        height={height}
        overlay={overlay}
        engineRef={setEngineRef}
        aria-label={title}
        description={description}
      />
      {legendAt === 'bottom' ? <div className="vl-tschart__legend vl-tschart__legend--bottom">{legendNode}</div> : null}
      {showNavigator ? (
        <Navigator<Id, Kind>
          viewport={viewport}
          series={chartSeries}
          frame={navFrame}
          ready={!!navFrame && status !== CHART_STATUS.loading && status !== CHART_STATUS.error}
          refreshing={refreshing}
          hidden={vis.hidden}
          zones={aligned ? undefined : zones}
          now={now}
          eventAt={aligned ? null : (extent.event ?? null)}
          eventLabel={eventLabel ?? labels.event}
          markers={aligned ? undefined : markers}
          renderMarkerIcon={renderMarkerIcon}
          onMarkerSelect={(m) => onSelectedMarkerChange?.(m.id)}
          alignTo={engine}
          slow={animate ? slow : 0}
          aria-label={labels.navigator}
        />
      ) : null}
    </div>
  );
}

/** Area chart: smooth waves with a gradient fill. */
export function AreaChart<Id extends string = string, Metric extends string = string, Kind extends string = string>(
  props: TimeSeriesChartAllProps<Id, Metric, Kind>,
) {
  return <TimeSeriesChart<Id, Metric, Kind> {...props} kind="area" />;
}

/** Line chart: no fill, thin lines; dots appear when buckets get wide. */
export function LineChart<Id extends string = string, Metric extends string = string, Kind extends string = string>(
  props: TimeSeriesChartAllProps<Id, Metric, Kind>,
) {
  return <TimeSeriesChart<Id, Metric, Kind> {...props} kind="line" />;
}

/** Stacked areas; `stack="percent"` shows shares of the total. */
export function StackedAreaChart<Id extends string = string, Metric extends string = string, Kind extends string = string>(
  props: TimeSeriesChartAllProps<Id, Metric, Kind>,
) {
  return <TimeSeriesChart<Id, Metric, Kind> stack="stack" {...props} kind="area" />;
}

/** Columns over time: grouped, stacked or percent; days split into hours when zooming in. */
export function TimeColumnChart<Id extends string = string, Metric extends string = string, Kind extends string = string>(
  props: TimeSeriesChartAllProps<Id, Metric, Kind>,
) {
  return <TimeSeriesChart<Id, Metric, Kind> {...props} kind="columns" />;
}
