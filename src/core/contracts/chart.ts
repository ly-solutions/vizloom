import type { ReactNode } from 'react';

import type { ValueUnit } from '../model/format';
import type { Granularity, TimeRange } from '../model/time';
import type { Datum, MarkerEffect, Series, SeriesFrame, StackMode, TimeExtent, TimeMarker, TimeZoneBand } from '../model/types';
import type { Viewport } from '../model/viewport';
import type { TileSource } from '../data/source';
import type { TooltipRow } from '../ui/tooltip';
import type { BlockState } from './state';

/**
 * Public contracts every chart follows. Charts are written against these types; the dashboard
 * and docs rely on them. Concrete charts extend `BaseChartProps` with their data props.
 */

/** Props shared by all charts. */
export interface BaseChartProps {
  /** Accessible name; also the caption of the screen-reader data table. Required. */
  readonly title: string;
  /** Longer description for assistive tech. */
  readonly description?: string;
  /** Height in px; width always follows the container (responsive). Default per chart. */
  readonly height?: number;
  /** Loading / empty / error / no-access / partial. Default `ready`. */
  readonly state?: BlockState;
  /** Value unit for axes and tooltips (`UNIT_COUNT`, `currencyUnit('USD')`, …). */
  readonly unit?: ValueUnit;
  /** Custom value formatter; wins over `unit`. */
  readonly formatValue?: (value: number) => string;
  /** Animate data changes (on top of reduced-motion and `VizProvider animate`). Default true. */
  readonly animate?: boolean;
  readonly className?: string;
  /** Test id on the root. */
  readonly 'data-testid'?: string;
}

/** Legend behaviour shared by multi-series charts. */
export interface LegendOptions<Id extends string = string> {
  /** `true` / `'top'` (default) / `'bottom'` / `false` — where the built-in legend goes. */
  readonly legend?: boolean | 'top' | 'bottom';
  /** Controlled hidden series. */
  readonly hidden?: ReadonlySet<Id>;
  readonly onHiddenChange?: (hidden: ReadonlySet<Id>) => void;
  /** Controlled focused series (highlight). */
  readonly focus?: Id | null;
  readonly onFocusChange?: (id: Id | null) => void;
}

/** What a tooltip renderer receives for a hovered bucket or datum. */
export interface TooltipContext<Id extends string = string> {
  /** Formatted heading (bucket time or category). */
  readonly title: string;
  readonly rows: readonly TooltipRow[];
  /** Index of the bucket / datum. */
  readonly index: number;
  /** Raw values by series. */
  readonly values: Readonly<Partial<Record<Id, number>>>;
  /** Moment of the bucket for time charts. */
  readonly t?: number;
}

export interface TooltipOptions<Id extends string = string> {
  /** `false` disables; a function replaces the body (`TooltipContent` is the default). */
  readonly tooltip?: boolean | ((context: TooltipContext<Id>) => ReactNode);
  /** Click/tap pins the tooltip; Escape or the close button unpins. Default true. */
  readonly pinnable?: boolean;
  /** Vertical crosshair on time charts. Default true. */
  readonly crosshair?: boolean;
}

/** Interaction events every chart emits. */
export interface ChartEvents<Id extends string = string> {
  /** Hovered bucket/datum index (or null) — sync several charts on one dashboard. */
  readonly onHover?: (index: number | null, series?: Id | null) => void;
  /** Click on a bucket/datum (drill-down). */
  readonly onSelect?: (index: number, series?: Id | null) => void;
}

/** Comparison of several series-events aligned by date or by "days before". */
export const COMPARE_ALIGN = { date: 'date', daysBefore: 'days-before' } as const;
export type CompareAlign = (typeof COMPARE_ALIGN)[keyof typeof COMPARE_ALIGN];

export interface CompareSeries<Id extends string = string> extends Series<Id> {
  readonly frame: SeriesFrame<'value'> | SeriesFrame<string>;
  /** The event moment of this series, for `days-before` alignment. */
  readonly event?: number;
  /** Primary (solid) or comparison (dashed, compare palette). */
  readonly role?: 'primary' | 'compare';
}

/**
 * Time-series chart contract (wave/area, line, stacked, time columns). Data comes either as a
 * ready `frame` or from a tile `source` (zoom loads finer tiles).
 */
export interface TimeSeriesChartProps<Id extends string = string, Metric extends string = string>
  extends BaseChartProps,
    LegendOptions<Id>,
    TooltipOptions<Id>,
    ChartEvents<Id> {
  readonly series: readonly Series<Id>[];
  readonly frame?: SeriesFrame<Id>;
  readonly source?: TileSource<Id, Metric>;
  readonly metric?: Metric;
  /** Rendering of series. */
  readonly kind?: 'area' | 'line' | 'columns' | 'step';
  readonly stack?: StackMode;
  readonly curve?: 'smooth' | 'linear' | 'step';
  /** Shared viewport (zoom/pan) with a navigator and zoom buttons. */
  readonly viewport?: Viewport;
  /** Initial window when uncontrolled. */
  readonly initialRange?: TimeRange;
  readonly onRangeChange?: (range: TimeRange) => void;
  /** Fixed granularity; default picks by zoom. */
  readonly granularity?: Granularity;
  readonly extent?: TimeExtent;
  readonly zones?: readonly TimeZoneBand[];
  readonly markers?: readonly TimeMarker<Id>[];
  /** Icon for a marker kind. */
  readonly renderMarkerIcon?: (marker: TimeMarker<Id>) => ReactNode;
  /** Before → after effect shown in the marker tooltip. */
  readonly markerEffect?: (marker: TimeMarker<Id>) => MarkerEffect | null;
  /** "Now" line; future is dimmed. Default `extent.now`. */
  readonly now?: number;
  /** Zoom & pan with wheel, drag, pinch and buttons. Default true. */
  readonly zoomable?: boolean;
  /** Live mode: new buckets slide in with animation, the window follows "now". */
  readonly live?: boolean;
  /** Comparison overlays. */
  readonly compare?: readonly CompareSeries[];
  readonly compareAlign?: CompareAlign;
}

/** Categorical charts (bars, bar list, donut, funnel, split bar). */
export interface CategoryChartProps<Key extends string = string> extends BaseChartProps, TooltipOptions<Key>, ChartEvents<Key> {
  readonly data: readonly Datum<Key>[];
  /** Sort: as given (default), descending or ascending by value. */
  readonly sort?: 'none' | 'desc' | 'asc';
  /** Show at most N items, the rest collapses into "Other" / "N more". */
  readonly limit?: number;
}

/** Sparkline contract — also used by table cells. */
export interface BaseSparklineProps {
  readonly values: ArrayLike<number>;
  readonly width?: number;
  readonly height?: number;
  readonly kind?: 'line' | 'area' | 'bars';
  /** CSS colour; default `var(--vl-accent)`. */
  readonly color?: string;
  /** Dot at the last point. */
  readonly showLast?: boolean;
  /** Reference line (average, target). */
  readonly baseline?: number;
  /** Accessible summary; default "min … max … last …". */
  readonly 'aria-label'?: string;
  readonly className?: string;
}
