import { type ReactNode, type Ref, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';

import { useIsomorphicLayoutEffect, useReducedMotion } from '../../core';
import { type ValueUnit } from '../../core';
import type { TimeRange } from '../../core';
import type { MarkerEffect, SeriesFrame, TimeMarker, TimeZoneBand } from '../../core';
import type { Viewport } from '../../core';
import { useFormat } from '../../core';
import { cx } from '../../core';
import { DeltaBadge } from '../../core';
import { VisuallyHidden } from '../../core';
import { ChartTooltip, TooltipContent, type TooltipRow } from '../../core';
import { BottomSheet } from '../shared/bottom-sheet';
import { useDwell, useHeldValue, useIsPhone, useScrub } from '../shared/hooks';
import { BAR_RENDERER } from './engine/bar-paint';
import type { ChartPoint, ChartRenderer } from './engine/renderer';
import {
  CHART_STATUS,
  type ChartStatus,
  DEFAULT_TIME_OPTIONS,
  TimeEngine,
  type TimeEngineOptions,
  type TimeHover,
  type TimePress,
  type ZoneHit,
} from './engine/time-engine';
import { WAVE_RENDERER } from './engine/wave-paint';
import { timeChartLabels, type TimeChartLabels } from './labels';
import { computeEffect, type Effect } from './model/effect';
import { layoutMarkers, pxPerDay } from './model/markers';

/** A series on a time chart with a resolved colour. */
export interface ChartSeries<Id extends string = string> {
  readonly id: Id;
  readonly label: string;
  /** Any CSS colour (`var(--vl-cat-1)` is fine: the canvas resolves it). */
  readonly color: string;
}

export interface BucketValue<Id extends string = string> extends ChartSeries<Id> {
  /** `NaN` — no data. */
  readonly value: number;
}

/** What is under the pointer: the bucket, visible series values, zone and markers inside it. */
export interface TimeTooltipContext<Id extends string = string, Kind extends string = string> {
  readonly k: number;
  readonly start: number;
  readonly step: number;
  readonly frame: SeriesFrame<Id>;
  readonly values: readonly BucketValue<Id>[];
  /** Sum of visible series in the previous bucket; `NaN` — none. */
  readonly previousTotal: number;
  /** The bucket is still running. */
  readonly current: boolean;
  readonly zone: TimeZoneBand | null;
  readonly markers: readonly TimeMarker<Id, Kind>[];
  readonly seriesId: Id | null;
  readonly percent: boolean;
  /** Pinned by a click off the data; `close` unpins. */
  readonly pinned: boolean;
  readonly close: () => void;
  /** Formatted caption of the bucket. */
  readonly title: string;
}

/** A pinned series: the product renders a summary of it. */
export interface SeriesSummaryContext<Id extends string = string> {
  readonly series: ChartSeries<Id>;
  readonly k: number;
  readonly start: number;
  readonly step: number;
  readonly frame: SeriesFrame<Id>;
  /** Window on screen — "for the period". */
  readonly range: TimeRange;
  readonly close: () => void;
  /** Rendered in a bottom sheet on phones. */
  readonly phone: boolean;
  readonly allSeries: readonly ChartSeries<Id>[];
  /** Switch the summary to another series without closing it. */
  readonly select: (id: Id) => void;
  /** Switch the bucket of the summary. */
  readonly selectBucket: (k: number) => void;
  /** Zoom into the bucket of the summary (days open into hours) and close it. */
  readonly zoomIn: () => void;
}

export interface MarkerEffectContext<Id extends string = string, Kind extends string = string> {
  readonly marker: TimeMarker<Id, Kind>;
  /** Markers collapsed under this one ("+N"). */
  readonly members: readonly TimeMarker<Id, Kind>[];
  readonly effect: Effect<Id>;
  readonly series: readonly ChartSeries<Id>[];
}

export type TimeRendererKind = 'wave' | 'bar';

export interface TimeCanvasProps<Id extends string = string, Kind extends string = string> {
  readonly series: readonly ChartSeries<Id>[];
  /** Latest frame. Keep the previous one while the next loads — the chart morphs into it. */
  readonly frame: SeriesFrame<Id> | null;
  readonly status: ChartStatus;
  /** A frame is on screen and a new one is loading: the chart dims a little. */
  readonly refreshing?: boolean;
  readonly viewport: Viewport;
  /** `wave` (area/line), `bar` (time columns) or your own renderer. */
  readonly renderer?: TimeRendererKind | ChartRenderer;
  readonly options?: Partial<TimeEngineOptions>;
  readonly hidden?: ReadonlySet<Id>;
  /** Series focused from outside (legend hover). */
  readonly focus?: Id | null;
  readonly zones?: readonly TimeZoneBand[];
  readonly markers?: readonly TimeMarker<Id, Kind>[];
  /** Icon of a marker by its kind. Without it markers are not drawn. */
  readonly renderMarkerIcon?: (marker: TimeMarker<Id, Kind>) => ReactNode;
  /** Screen-reader name of a marker. */
  readonly markerLabel?: (marker: TimeMarker<Id, Kind>) => string;
  /** Your own "before → after" numbers; default — daily averages in equal windows. */
  readonly markerEffect?: (marker: TimeMarker<Id, Kind>) => MarkerEffect | null;
  /** "Now": the future to the right is dimmed. */
  readonly now?: number;
  /** Bucket tooltip. Default — rows of series, total and change; `null` — no tooltip. */
  readonly renderTooltip?: ((context: TimeTooltipContext<Id, Kind>) => ReactNode) | null;
  /** Series summary after a click on a series. Without it a click pins the bucket tooltip. */
  readonly renderSummary?: (context: SeriesSummaryContext<Id>) => ReactNode;
  /** "What changed" card of a marker. `null` — none. */
  readonly renderEffect?: ((context: MarkerEffectContext<Id, Kind>) => ReactNode) | null;
  readonly onPress?: (press: TimePress) => void;
  /** Hovered bucket and series (or null) — sync charts on one dashboard. */
  readonly onHoverChange?: (index: number | null, series: Id | null) => void;
  /** Zone drawing (`options.zoneDraw`): draft period; `done` — released. */
  readonly onZoneDraft?: (range: TimeRange | null, done: boolean) => void;
  readonly onZoneRemove?: (id: string) => void;
  readonly onZoneHover?: (hit: ZoneHit | null) => void;
  /** Pinned marker (controlled). */
  readonly selectedMarker?: string | null;
  readonly onSelectedMarkerChange?: (id: string | null) => void;
  readonly labels?: Partial<TimeChartLabels>;
  /** Pause before the hover tooltip comes back after a pinned one was closed by a click, ms. */
  readonly tooltipDelay?: number;
  /** Stage height, px. */
  readonly height?: number;
  /** Over the chart: empty and error panels. */
  readonly overlay?: ReactNode;
  readonly engineRef?: Ref<TimeEngine | null>;
  readonly className?: string;
  readonly 'aria-label': string;
  /** Longer description for assistive tech. */
  readonly description?: string;
  /** Screen-reader table of the visible window. Default true. */
  readonly dataTable?: boolean;
}

interface Pin {
  readonly seriesId: string;
  readonly k: number;
}

const samePoint = (a: ChartPoint | null, b: ChartPoint | null) =>
  a === b || (!!a && !!b && Math.abs(a.x - b.x) < 0.3 && Math.abs(a.y - b.y) < 0.3 && Math.abs((a.width ?? 0) - (b.width ?? 0)) < 0.3);

const MARKER_GAP = 26;
const SR_ROWS = 60;

function rendererOf(renderer: TimeRendererKind | ChartRenderer | undefined): ChartRenderer {
  if (!renderer || renderer === 'wave') return WAVE_RENDERER;
  if (renderer === 'bar') return BAR_RENDERER;
  return renderer;
}

/**
 * The canvas time chart: waves (area/line) or time columns on one engine — smooth monotone
 * curves, overlay / stack / percent, zones, event markers with "before → after", zoom with the
 * wheel, drag with inertia, pinch, keyboard, granularity morphs, live pulses. Tooltips are DOM,
 * the series summary opens a bottom sheet on phones.
 */
export function TimeCanvas<Id extends string = string, Kind extends string = string>(props: TimeCanvasProps<Id, Kind>) {
  const {
    series,
    frame,
    status,
    refreshing = false,
    viewport,
    renderer,
    options,
    hidden,
    focus = null,
    zones,
    markers,
    renderMarkerIcon,
    markerLabel,
    now = 0,
    renderTooltip,
    renderSummary,
    renderEffect,
    height,
    overlay,
    engineRef,
    tooltipDelay = 1000,
    className,
    description,
    dataTable = true,
    'aria-label': ariaLabel,
  } = props;
  const fmt = useFormat();
  const reduced = useReducedMotion();
  const labels = useMemo(() => ({ ...timeChartLabels(fmt.locale), ...props.labels }), [fmt.locale, props.labels]);
  const phone = useIsPhone();
  const stageRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineNow = useRef<TimeEngine | null>(null);
  const scrub = useScrub<HTMLCanvasElement>({
    enabled: phone,
    onMove: (x, y) => engineNow.current?.scrubAt(x, y),
    onEnd: () => engineNow.current?.endScrub(),
  });
  const [engine, setEngine] = useState<TimeEngine | null>(null);
  engineNow.current = engine;
  const [hover, setHover] = useState<TimeHover | null>(null);
  const [tipPoint, setTipPoint] = useState<ChartPoint | null>(null);
  const [pin, setPin] = useState<Pin | null>(null);
  const [bucketPin, setBucketPin] = useState<number | null>(null);
  const [markerHover, setMarkerHover] = useState<string | null>(null);
  const [ownMarkerPin, setOwnMarkerPin] = useState<string | null>(null);
  const markerPin = props.selectedMarker !== undefined ? props.selectedMarker : ownMarkerPin;
  const [markerPoint, setMarkerPoint] = useState<ChartPoint | null>(null);
  const [members, setMembers] = useState<ReadonlyMap<string, readonly string[]>>(new Map());
  const [bounds, setBounds] = useState({ width: 0, height: 0 });
  const markerEls = useRef(new Map<string, HTMLButtonElement>());
  const keyboardId = useId();
  const descriptionId = useId();
  const latest = useRef(props);
  latest.current = props;
  const markerPinRef = useRef(markerPin);
  markerPinRef.current = markerPin;
  const setMarkerPin = useCallback((next: string | null | ((current: string | null) => string | null)) => {
    const value = typeof next === 'function' ? next(markerPinRef.current) : next;
    if (value === markerPinRef.current) return;
    markerPinRef.current = value;
    setOwnMarkerPin(value);
    latest.current.onSelectedMarkerChange?.(value);
  }, []);

  const paintRenderer = useMemo(() => rendererOf(renderer), [renderer]);

  useIsomorphicLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const created = new TimeEngine(canvas, viewport, paintRenderer);
    setEngine(created);
    return () => {
      created.destroy();
      setEngine(null);
    };
  }, [viewport, paintRenderer]);

  useEffect(() => {
    if (!engineRef) return;
    if (typeof engineRef === 'function') engineRef(engine);
    else (engineRef as { current: TimeEngine | null }).current = engine;
  }, [engine, engineRef]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || typeof ResizeObserver !== 'function') return;
    const ro = new ResizeObserver(() => setBounds({ width: stage.clientWidth, height: stage.clientHeight }));
    ro.observe(stage);
    setBounds({ width: stage.clientWidth, height: stage.clientHeight });
    return () => ro.disconnect();
  }, []);

  useIsomorphicLayoutEffect(() => {
    if (height) stageRef.current?.style.setProperty('--vl-time-height', `${height}px`);
    else stageRef.current?.style.removeProperty('--vl-time-height');
  }, [height]);

  const unpin = useCallback(() => setPin(null), []);
  const dismissRef = useRef<() => void>(() => undefined);
  const dismiss = useCallback(() => dismissRef.current(), []);
  dismissRef.current = () => {
    setPin(null);
    setBucketPin(null);
    setMarkerPin(null);
    engine?.lockHover(null);
    engine?.setHoverState(null);
  };
  // The window is moving (zoom, pan, inertia): the hover tooltip hides and returns once it stops.
  const viewQuiet = useDwell(160);
  // A pinned tooltip was closed by a click on the chart — the hover one returns after a pause.
  const afterDismiss = useDwell(tooltipDelay);
  const quietRef = useRef(viewQuiet.poke);
  quietRef.current = viewQuiet.poke;
  const pokeRef = useRef(afterDismiss.poke);
  pokeRef.current = afterDismiss.poke;
  useEffect(() => viewport.subscribe(() => quietRef.current()), [viewport]);
  const phoneRef = useRef(phone);
  phoneRef.current = phone;

  /** The visible series with the largest value in bucket `k`. */
  const topSeriesAt = (k: number): string | null => {
    const { frame: f, series: list, hidden: off } = latest.current;
    if (!f || k < 0 || k >= f.length) return null;
    let best: string | null = null;
    let bestValue = Number.NEGATIVE_INFINITY;
    for (const s of list) {
      if (off?.has(s.id)) continue;
      const v = Number(f.values[s.id]?.[k] ?? Number.NaN);
      if (v === v && v > bestValue) {
        bestValue = v;
        best = s.id;
      }
    }
    return best;
  };
  const pinnedRef = useRef(false);
  pinnedRef.current = pin !== null || bucketPin !== null;
  const markerFocus = markerPin ?? markerHover;

  // ───── props → engine ─────
  const slow = reduced ? 0 : (options?.slow ?? 1);
  const engineOptions = useMemo(() => ({ ...DEFAULT_TIME_OPTIONS, format: fmt, labels, ...options, slow }), [fmt, labels, options, slow]);
  useEffect(() => {
    engine?.setOptions(engineOptions);
  }, [engine, engineOptions]);
  useEffect(() => {
    engine?.setSeries(series);
  }, [engine, series]);
  useEffect(() => {
    engine?.setFrame(frame);
  }, [engine, frame]);
  useEffect(() => {
    engine?.setStatus(status, refreshing);
  }, [engine, status, refreshing]);
  useEffect(() => {
    engine?.setHidden(hidden ?? new Set());
  }, [engine, hidden]);
  useEffect(() => {
    engine?.setFocus(focus, pin?.seriesId ?? null);
  }, [engine, focus, pin]);
  useEffect(() => {
    engine?.lockHover(bucketPin);
  }, [engine, bucketPin]);
  // Granularity or data moved — the pinned bucket is another one now.
  useEffect(() => {
    setBucketPin(null);
  }, [frame?.step, frame?.start]);
  useEffect(() => {
    engine?.setZones(zones ?? []);
  }, [engine, zones]);
  useEffect(() => {
    engine?.setMarkers(markers ?? [], markerFocus);
  }, [engine, markers, markerFocus]);
  useEffect(() => {
    engine?.setTimeline(now);
  }, [engine, now]);

  // The pinned series disappeared or got hidden — close its summary.
  useEffect(() => {
    if (pin && (hidden?.has(pin.seriesId as Id) || !series.some((s) => s.id === pin.seriesId))) setPin(null);
  }, [pin, hidden, series]);

  // ───── marker effect ─────
  const effect = useMemo(() => {
    if (!markerFocus || !frame || status !== CHART_STATUS.ready) return null;
    const marker = markers?.find((m) => m.id === markerFocus);
    if (!marker || (now && marker.t > now)) return null;
    const custom = latest.current.markerEffect?.(marker);
    const computed = computeEffect(frame, marker, now || Number.POSITIVE_INFINITY);
    const fx: Effect<Id> = custom
      ? { ...computed, rows: [{ id: null, before: custom.before, after: custom.after, deltaPct: custom.change }] }
      : computed;
    const group = (members.get(marker.id) ?? [])
      .map((id) => markers?.find((m) => m.id === id))
      .filter((m): m is TimeMarker<Id, Kind> => !!m);
    return { marker, effect: fx, members: group };
  }, [markerFocus, frame, status, markers, now, members]);

  useEffect(() => {
    if (!engine) return;
    if (!effect) {
      engine.setEffectWindow(null);
      return;
    }
    const { marker, effect: fx } = effect;
    const ownId = fx.rows[0]?.id;
    const own = ownId ? series.find((s) => s.id === ownId) : null;
    const window = labels.effectWindow(fx.window);
    engine.setEffectWindow({
      t: marker.t,
      window: fx.window,
      afterEnd: fx.afterEnd,
      color: own?.color,
      beforeLabel: labels.effectBefore(window),
      afterLabel: labels.effectAfter(fx.partial ? labels.effectWindow(fx.afterEnd - marker.t) : window, fx.partial),
    });
  }, [engine, effect, series, labels]);

  // ───── engine events ─────
  useEffect(() => {
    if (!engine) return;
    engine.callbacks = {
      onHover: (h) => {
        setHover(h);
        latest.current.onHoverChange?.(h ? h.k : null, (h?.seriesId as Id | null) ?? null);
      },
      onPress: (press) => {
        if (scrub.swallowClick()) return;
        latest.current.onPress?.(press);
        // Something is pinned — a click outside only closes it; the next click pins anew.
        if (pinnedRef.current) {
          dismissRef.current();
          if (press.k >= 0) {
            const plot = engine.plot;
            engine.setHoverState({ k: press.k, y: plot.top + plot.height / 2 }, press.seriesId);
          }
          pokeRef.current();
          return;
        }
        setMarkerPin(null);
        // Phone: any tap opens the sheet — on empty space take the largest series of the bucket.
        const seriesId = press.seriesId ?? (phoneRef.current && latest.current.renderSummary ? topSeriesAt(press.k) : null);
        if (seriesId && latest.current.renderSummary) {
          setBucketPin(null);
          setPin((cur) => (cur && cur.seriesId === seriesId && cur.k === press.k ? null : { seriesId, k: press.k }));
          return;
        }
        setPin(null);
        setBucketPin((cur) => (cur === press.k || press.k < 0 ? null : press.k));
      },
      onZoneDraft: (range, done) => latest.current.onZoneDraft?.(range, done),
      onZoneRemove: (id) => latest.current.onZoneRemove?.(id),
      onZoneHover: (hit) => latest.current.onZoneHover?.(hit),
      onInteract: () => {
        setPin(null);
        setBucketPin(null);
        setMarkerPin(null);
      },
      onEscape: () => dismissRef.current(),
      onPaint: () => overlaysRef.current(),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- callbacks read fresh values through refs
  }, [engine]);

  const overlaysRef = useRef<() => void>(() => undefined);
  overlaysRef.current = () => {
    if (!engine) return;
    const plot = engine.plot;
    const target = pin ?? (engine.hover && !engine.isDragging ? { seriesId: engine.pick, k: engine.hover.k } : null);
    const point: ChartPoint | null =
      target && status === CHART_STATUS.ready ? engine.tooltipAnchor(target.k, target.seriesId, !!pin) : null;
    setTipPoint((prev) => (samePoint(prev, point) ? prev : point));

    // Markers: priorities by zoom, neighbours collapse into "+N".
    const list = latest.current.markers;
    if (!list?.length || !latest.current.renderMarkerIcon) return;
    const view = viewport.state.current;
    const show = status === CHART_STATUS.ready || status === CHART_STATUS.empty;
    const layout = layoutMarkers(list, (t) => engine.xOf(t), {
      pxPerDay: pxPerDay(view.end - view.start, plot.width),
      minGap: MARKER_GAP,
      focusId: markerPinRef.current ?? markerHover,
    });
    let focusPoint: ChartPoint | null = null;
    const nextMembers = new Map<string, readonly string[]>();
    for (const m of list) {
      const el = markerEls.current.get(m.id);
      const slot = layout.get(m.id);
      if (slot?.members.length) nextMembers.set(m.id, slot.members);
      if (!el) continue;
      const x = engine.xOf(m.t);
      const visible = show && !!slot?.visible && x >= plot.left - 2 && x <= plot.left + plot.width + 2;
      el.style.setProperty('--vl-marker-x', `${x.toFixed(1)}px`);
      el.dataset['visible'] = visible ? 'true' : 'false';
      el.tabIndex = visible ? 0 : -1;
      const extra = slot?.members.length ? `+${slot.members.length}` : '';
      const badge = el.lastElementChild as HTMLElement | null;
      if (badge && badge.textContent !== extra) badge.textContent = extra;
      if (m.id === (markerPinRef.current ?? markerHover) && visible) focusPoint = { x, y: el.offsetTop + el.offsetHeight };
    }
    setMarkerPoint((prev) => (samePoint(prev, focusPoint) ? prev : focusPoint));
    setMembers((prev) => (sameMembers(prev, nextMembers) ? prev : nextMembers));
  };

  useIsomorphicLayoutEffect(() => {
    engine?.kick();
  });

  // Pinned things close on a click outside and on page scroll.
  useEffect(() => {
    if (!pin && !markerPin && bucketPin === null) return;
    const inside = (event: Event, selector: string) =>
      event.composedPath().some((node) => node === canvasRef.current || (node instanceof Element && node.matches(selector)));
    const onDown = (event: PointerEvent) => {
      if (!inside(event, '.vl-tooltip--pinned, .vl-time__marker, .vl-sheet')) dismiss();
    };
    const onScroll = (event: Event) => {
      if (!inside(event, '.vl-tooltip--pinned, .vl-sheet')) dismiss();
    };
    document.addEventListener('pointerdown', onDown, true);
    if (!phone) window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [pin, markerPin, bucketPin, phone, dismiss]);

  // ───── tooltip content ─────
  const percent = (options?.mode ?? DEFAULT_TIME_OPTIONS.mode) === 'percent';
  const unit: ValueUnit = options?.unit ?? DEFAULT_TIME_OPTIONS.unit;
  const showZones = options?.zones ?? DEFAULT_TIME_OPTIONS.zones;
  const formatY = options?.formatY ?? null;
  const bucketCaption = options?.bucketLabel ?? null;
  const formatValue = useCallback((v: number) => (formatY ? formatY(v) : fmt.value(v, unit, true)), [formatY, fmt, unit]);

  const captionOf = useCallback(
    (start: number, step: number) => {
      if (bucketCaption) return bucketCaption(start, step);
      return frame?.granularity ? fmt.bucket(start, frame.granularity, step) : fmt.range(start, start + step);
    },
    [bucketCaption, frame?.granularity, fmt],
  );

  const tooltipContext = useMemo((): TimeTooltipContext<Id, Kind> | null => {
    if (!hover || !frame || pin) return null;
    const k = hover.k;
    if (k < 0 || k >= frame.length) return null;
    const start = frame.start + k * frame.step;
    const visible = series.filter((s) => !hidden?.has(s.id));
    const at = (id: Id, i: number) => {
      const v = frame.values[id]?.[i];
      return v === undefined ? Number.NaN : Number(v);
    };
    let previousTotal = Number.NaN;
    if (k > 0) {
      previousTotal = 0;
      for (const s of visible) {
        const v = at(s.id, k - 1);
        if (v === v) previousTotal += v;
      }
    }
    const mid = start + frame.step / 2;
    return {
      k,
      start,
      step: frame.step,
      frame,
      values: visible.map((s) => ({ ...s, value: at(s.id, k) })),
      previousTotal,
      current: !!now && now >= start && now < start + frame.step,
      zone: showZones ? (zones?.find((z) => mid >= z.from && mid < z.to) ?? null) : null,
      markers: markers?.filter((m) => m.t >= start && m.t < start + frame.step) ?? [],
      seriesId: (hover.seriesId as Id | null) ?? null,
      percent,
      pinned: bucketPin !== null,
      close: dismiss,
      title: captionOf(start, frame.step),
    };
  }, [hover, frame, pin, series, hidden, now, showZones, zones, markers, percent, bucketPin, dismiss, captionOf]);

  const tooltip = useMemo(() => {
    if (!tooltipContext || renderTooltip === null) return null;
    if (renderTooltip) return renderTooltip(tooltipContext);
    const c = tooltipContext;
    return (
      <BucketTooltip
        context={c}
        formatValue={formatValue}
        formatPercent={(v) => `${fmt.number(v, v < 10 ? 1 : 0)}%`}
        labels={labels}
        focusable={!!renderSummary}
        deltaSuffix={frame?.granularity ? labels.previous[frame.granularity] : undefined}
        renderMarkerIcon={renderMarkerIcon}
      />
    );
  }, [tooltipContext, renderTooltip, renderSummary, formatValue, fmt, labels, frame?.granularity, renderMarkerIcon]);

  const summary = useMemo(() => {
    if (!pin || !frame || !renderSummary) return null;
    const s = series.find((x) => x.id === pin.seriesId);
    if (!s) return null;
    return renderSummary({
      series: s,
      k: pin.k,
      start: frame.start + pin.k * frame.step,
      step: frame.step,
      frame,
      range: viewport.state.target,
      close: unpin,
      phone,
      allSeries: series.filter((x) => !hidden?.has(x.id)),
      select: (id) => setPin((cur) => (cur ? { ...cur, seriesId: id } : cur)),
      selectBucket: (k) => setPin((cur) => (cur && k >= 0 && k < frame.length ? { ...cur, k } : cur)),
      zoomIn: () => {
        const t = frame.start + pin.k * frame.step;
        unpin();
        viewport.setRange({ start: t - frame.step * 0.5, end: t + frame.step * 1.5 });
      },
    });
  }, [pin, frame, renderSummary, series, hidden, viewport, unpin, phone]);

  const effectCard = useMemo(() => {
    if (!effect || renderEffect === null) return null;
    if (renderEffect) return renderEffect({ ...effect, series });
    return (
      <EffectCard
        marker={effect.marker}
        members={effect.members}
        effect={effect.effect}
        series={series}
        labels={labels}
        formatValue={formatValue}
        kicker={`${fmt.day(effect.marker.t)}, ${fmt.time(effect.marker.t)}`}
        renderMarkerIcon={renderMarkerIcon}
      />
    );
  }, [effect, renderEffect, series, labels, formatValue, fmt, renderMarkerIcon]);

  // Phones get no hover bubbles: a tap opens the summary sheet, a long press scrubs.
  const hoverOpen =
    (!phone || scrub.scrubbing || bucketPin !== null) &&
    !!tooltip &&
    !!tipPoint &&
    !pin &&
    status === CHART_STATUS.ready &&
    ((viewQuiet.ready && afterDismiss.ready) || bucketPin !== null || scrub.scrubbing);
  const pinOpen = !!summary && !!tipPoint && !phone;
  const effectOpen = !!effectCard && !!markerPoint;
  const mainOpen = hoverOpen || pinOpen;
  const mainKey = pinOpen ? `p:${pin?.seriesId}:${pin?.k}` : `h:${hover?.k}`;
  const mainLive = pinOpen ? summary : tooltip;
  const mainContent = useHeldValue<ReactNode>(
    mainLive ? (
      <div key={mainKey} className="vl-swap">
        {mainLive}
      </div>
    ) : null,
    mainOpen,
  );
  const mainPoint = useHeldValue(tipPoint, mainOpen);
  const effectContent = useHeldValue<ReactNode>(effectCard, effectOpen);
  const effectPoint = useHeldValue(markerPoint, effectOpen);

  // ───── screen-reader table of the window on screen ─────
  const target = useViewportTargetRange(viewport);
  const srTable = useMemo(() => {
    if (!dataTable || !frame || status !== CHART_STATUS.ready) return null;
    const visible = series.filter((s) => !hidden?.has(s.id));
    const k0 = Math.max(0, Math.floor((target.start - frame.start) / frame.step));
    const k1 = Math.min(frame.length - 1, Math.ceil((target.end - frame.start) / frame.step));
    const rows: { k: number; start: number }[] = [];
    const stride = Math.max(1, Math.ceil((k1 - k0 + 1) / SR_ROWS));
    for (let k = k0; k <= k1; k += stride) rows.push({ k, start: frame.start + k * frame.step });
    return { visible, rows };
  }, [dataTable, frame, status, series, hidden, target.start, target.end]);

  const busy = status === CHART_STATUS.loading || refreshing;

  return (
    <div className={cx('vl-time', phone && 'vl-time--phone', className)}>
      <div ref={stageRef} className="vl-time__stage" data-overlay={overlay ? 'true' : undefined}>
        <canvas
          ref={(node) => {
            canvasRef.current = node;
            scrub.ref(node);
          }}
          className="vl-time__canvas vl-gesture-surface"
          tabIndex={0}
          role="img"
          aria-roledescription="chart"
          aria-label={ariaLabel}
          aria-describedby={description ? `${descriptionId} ${keyboardId}` : keyboardId}
          aria-busy={busy || undefined}
        />
        <VisuallyHidden id={keyboardId}>{labels.keyboard}</VisuallyHidden>
        {description ? <VisuallyHidden id={descriptionId}>{description}</VisuallyHidden> : null}
        {markers?.length && renderMarkerIcon ? (
          <div className="vl-time__markers">
            {markers.map((m) => (
              <button
                key={m.id}
                ref={(el) => {
                  if (el) markerEls.current.set(m.id, el);
                  else markerEls.current.delete(m.id);
                }}
                type="button"
                className="vl-time__marker"
                data-kind={m.kind}
                data-visible="false"
                data-focus={markerFocus === m.id || undefined}
                aria-pressed={markerPin === m.id}
                aria-label={markerLabel?.(m) ?? `${m.label}, ${fmt.day(m.t)} ${fmt.time(m.t)}`}
                onPointerEnter={() => setMarkerHover(m.id)}
                onPointerLeave={() => setMarkerHover((cur) => (cur === m.id ? null : cur))}
                onFocus={() => setMarkerHover(m.id)}
                onBlur={() => setMarkerHover((cur) => (cur === m.id ? null : cur))}
                onClick={() => {
                  setPin(null);
                  setMarkerPin((cur) => (cur === m.id ? null : m.id));
                }}
              >
                {renderMarkerIcon(m)}
                <span className="vl-time__marker-more" />
              </button>
            ))}
          </div>
        ) : null}
        <ChartTooltip
          open={mainOpen}
          anchor={mainPoint}
          bounds={bounds}
          pinned={pinOpen || bucketPin !== null}
          onUnpin={dismiss}
          dockBelow={scrub.scrubbing ? 10_000 : 0}
          className={cx('vl-time__tooltip', pinOpen && 'vl-time__tooltip--summary')}
          aria-label={pinOpen ? series.find((s) => s.id === pin?.seriesId)?.label : undefined}
        >
          {mainContent}
        </ChartTooltip>
        <ChartTooltip
          open={effectOpen}
          anchor={effectPoint}
          bounds={bounds}
          prefer="bottom"
          pinned={!!markerPin}
          onUnpin={() => setMarkerPin(null)}
          className="vl-time__tooltip vl-time__tooltip--effect"
        >
          {effectContent}
        </ChartTooltip>
        {overlay ? <div className="vl-time__overlay">{overlay}</div> : null}
        {refreshing ? <div className="vl-time__progress" aria-hidden="true" /> : null}
      </div>
      {srTable ? (
        <VisuallyHidden>
          <table>
            <caption>{`${ariaLabel} — ${labels.dataTable}`}</caption>
            <thead>
              <tr>
                <th scope="col">{''}</th>
                {srTable.visible.map((s) => (
                  <th key={s.id} scope="col">
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {srTable.rows.map((row) => (
                <tr key={row.k}>
                  <th scope="row">{captionOf(row.start, frame?.step ?? 0)}</th>
                  {srTable.visible.map((s) => {
                    const v = Number(frame?.values[s.id]?.[row.k] ?? Number.NaN);
                    return <td key={s.id}>{v === v ? formatValue(v) : '—'}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </VisuallyHidden>
      ) : null}
      {phone && renderSummary ? (
        <BottomSheet open={!!summary} onClose={unpin} closeLabel={labels.close}>
          {summary}
        </BottomSheet>
      ) : null}
    </div>
  );
}

function sameMembers(a: ReadonlyMap<string, readonly string[]>, b: ReadonlyMap<string, readonly string[]>): boolean {
  if (a.size !== b.size) return false;
  for (const [k, v] of a) {
    const w = b.get(k);
    if (!w || w.length !== v.length || w.some((x, i) => x !== v[i])) return false;
  }
  return true;
}

/** The target window, updated on user action (not on every animation frame). */
function useViewportTargetRange(viewport: Viewport): TimeRange {
  const [range, setRange] = useState(viewport.state.target);
  useEffect(() => {
    setRange(viewport.state.target);
    let last = viewport.state.target;
    return viewport.subscribe((s) => {
      if (s.target.start !== last.start || s.target.end !== last.end) {
        last = s.target;
        setRange(s.target);
      }
    });
  }, [viewport]);
  return range;
}

interface BucketTooltipProps<Id extends string, Kind extends string> {
  readonly context: TimeTooltipContext<Id, Kind>;
  readonly formatValue: (v: number) => string;
  readonly formatPercent: (v: number) => string;
  readonly labels: TimeChartLabels;
  /** A click on a series opens its summary: show the hint. */
  readonly focusable: boolean;
  readonly deltaSuffix?: string;
  readonly renderMarkerIcon?: (marker: TimeMarker<Id, Kind>) => ReactNode;
  readonly maxRows?: number;
}

/** Default bucket tooltip: series by value, total with the change, zone and markers. */
export function BucketTooltip<Id extends string, Kind extends string>({
  context: c,
  formatValue,
  formatPercent,
  labels,
  focusable,
  deltaSuffix,
  renderMarkerIcon,
  maxRows = 8,
}: BucketTooltipProps<Id, Kind>) {
  const known = c.values.filter((v) => v.value === v.value);
  const total = known.reduce((sum, v) => sum + v.value, 0);
  const sorted = [...known].sort((a, b) => b.value - a.value);
  const shown = sorted.slice(0, maxRows);
  const rest = sorted.length - shown.length;
  const rows: TooltipRow[] = shown.map((v) => ({
    id: v.id,
    label: v.label,
    color: v.color,
    value: c.percent ? formatPercent(total > 0 ? (v.value / total) * 100 : 0) : formatValue(v.value),
    strong: c.seriesId === v.id,
    muted: v.value === 0,
  }));
  if (rest > 0) rows.push({ id: '__more', label: labels.more(rest), value: '', muted: true });
  const change = c.previousTotal > 0 ? (total / c.previousTotal - 1) * 100 : Number.NaN;
  const title = c.current && labels.current ? `${c.title} · ${labels.current}` : c.title;
  return (
    <TooltipContent
      title={title}
      subtitle={
        c.zone ? (
          <span className="vl-time__zone-badge" data-tone={c.zone.tone ?? 'neutral'}>
            {c.zone.label}
          </span>
        ) : undefined
      }
      rows={known.length ? rows : undefined}
      footer={
        <>
          {known.length === 0 ? <span className="vl-time__tip-empty">{labels.emptyBucket}</span> : null}
          {known.length > 1 && !c.percent ? (
            <div className="vl-time__tip-total">
              <span>{labels.total}</span>
              <b>{formatValue(total)}</b>
              {change === change ? <DeltaBadge value={change} size="s" suffix={deltaSuffix} /> : null}
            </div>
          ) : null}
          {known.length === 1 && change === change ? <DeltaBadge value={change} size="s" suffix={deltaSuffix} /> : null}
          {c.markers.slice(0, 2).map((m) => (
            <div key={m.id} className="vl-time__tip-event">
              {renderMarkerIcon ? <span className="vl-time__tip-icon">{renderMarkerIcon(m)}</span> : null}
              <span>{m.label}</span>
            </div>
          ))}
          {focusable && c.seriesId && !c.pinned ? <div className="vl-time__tip-hint">{labels.clickForMore}</div> : null}
        </>
      }
    />
  );
}

interface EffectCardProps<Id extends string, Kind extends string> {
  readonly marker: TimeMarker<Id, Kind>;
  readonly members: readonly TimeMarker<Id, Kind>[];
  readonly effect: Effect<Id>;
  readonly series: readonly ChartSeries<Id>[];
  readonly labels: TimeChartLabels;
  readonly formatValue: (v: number) => string;
  readonly kicker: string;
  readonly renderMarkerIcon?: (marker: TimeMarker<Id, Kind>) => ReactNode;
}

/** "What moved": the marker and its effect on series — before and after, with the change. */
export function EffectCard<Id extends string, Kind extends string>({
  marker,
  members,
  effect: fx,
  series,
  labels,
  formatValue,
  kicker,
  renderMarkerIcon,
}: EffectCardProps<Id, Kind>) {
  const window = labels.effectWindow(fx.window);
  const after = fx.partial ? labels.effectWindow(fx.afterEnd - marker.t) : window;
  const perDay = (v: number) => (v === v ? formatValue(v) : '—');
  const justNow = fx.afterEnd - marker.t < 3_600_000;
  return (
    <div className="vl-effect">
      <div className="vl-effect__kicker">
        {renderMarkerIcon ? <span className="vl-effect__icon">{renderMarkerIcon(marker)}</span> : null}
        <span>{kicker}</span>
      </div>
      {members.length ? (
        <ul className="vl-effect__list">
          {[marker, ...members].map((m) => (
            <li key={m.id}>
              <b>{m.label}</b>
              {m.detail ? <span>{m.detail}</span> : null}
            </li>
          ))}
        </ul>
      ) : (
        <>
          <div className="vl-effect__title">{marker.label}</div>
          {marker.detail ? <div className="vl-effect__detail">{marker.detail}</div> : null}
        </>
      )}
      <dl className="vl-effect__rows">
        {fx.rows.map((r) => {
          const s = r.id ? series.find((x) => x.id === r.id) : null;
          const status = r.before > 0 ? labels.effectWaiting : labels.effectNoBase;
          return (
            <div key={r.id ?? 'all'} className="vl-effect__row">
              <dt>
                {s ? (
                  <span className="vl-effect__swatch" data-color={s.color} ref={(el) => el?.style.setProperty('--vl-swatch', s.color)} />
                ) : null}
                {s?.label ?? labels.allSeries}
              </dt>
              <dd>
                <span>{`${perDay(r.before)} → ${perDay(r.after)} ${labels.perDay}`}</span>
                {r.deltaPct === r.deltaPct ? (
                  <DeltaBadge value={r.deltaPct} size="s" />
                ) : (
                  <span className="vl-effect__status">{status}</span>
                )}
              </dd>
            </div>
          );
        })}
      </dl>
      <div className="vl-effect__note">{justNow ? labels.effectJustNow : labels.effectNote(window, after)}</div>
    </div>
  );
}
