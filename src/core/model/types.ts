import type { ColorSlot, ZoneTone } from './palette';
import type { Granularity, TimeRange } from './time';

/**
 * A series of a chart. `Id` is the literal union of the product's keys (`'vip' | 'floor'`), so
 * the legend, the data and the highlight cannot drift apart through a typo.
 */
export interface Series<Id extends string = string> {
  readonly id: Id;
  /** Legend and tooltip caption. Rendered as text. */
  readonly label: string;
  /** Palette slot; defaults to the series index. */
  readonly slot?: ColorSlot;
  /** Any CSS colour; overrides the slot (`var(--brand)`, `#0a7`). */
  readonly color?: string;
}

/**
 * Values of series over equal buckets: what a tile source returns for a window.
 * `NaN` is a gap (no data), not zero: zero means "nothing happened".
 */
export interface SeriesFrame<Id extends string = string> {
  readonly granularity?: Granularity;
  /** Start of the first bucket, UTC ms. */
  readonly start: number;
  /** Bucket length, ms. */
  readonly step: number;
  /** Number of buckets. */
  readonly length: number;
  readonly values: Readonly<Record<Id, ArrayLike<number>>>;
}

/** Bounds of the whole history: what the navigator shows. */
export interface TimeExtent extends TimeRange {
  /** "Now": to the right is the future, there is no data there. */
  readonly now?: number;
  /** The moment of the event, if any: enables "days before" alignment. */
  readonly event?: number;
}

/** A period on the time axis: a price wave, a campaign, a user mark. */
export interface TimeZoneBand {
  readonly id: string;
  readonly from: number;
  readonly to: number;
  readonly label: string;
  /** Second, muted part of the caption. */
  readonly note?: string;
  readonly tone?: ZoneTone;
  /** A user's own zone: the caption gets a remove button. */
  readonly removable?: boolean;
}

/**
 * Marker priority: 1 — always visible (start, prices), 2 — when zoomed in (promo codes, ads),
 * 3 — only up close (posts, reminders).
 */
export type MarkerPriority = 1 | 2 | 3;

/** An event marker: something that happened at moment `t`. */
export interface TimeMarker<Id extends string = string, Kind extends string = string> {
  readonly id: string;
  readonly t: number;
  /** Kind of change: the product picks an icon by it. */
  readonly kind: Kind;
  readonly label: string;
  readonly detail?: string;
  /** Series it affected; empty — all. */
  readonly series?: readonly Id[];
  readonly priority?: MarkerPriority;
}

/** "Before → after" effect of a marker: average rate in equal windows around it. */
export interface MarkerEffect {
  readonly before: number;
  readonly after: number;
  /** Percent change; NaN when `before` is 0. */
  readonly change: number;
}

export const STACK_MODE = { overlay: 'overlay', stack: 'stack', percent: 'percent' } as const;
export type StackMode = (typeof STACK_MODE)[keyof typeof STACK_MODE];

/** A plain categorical datum: bars, donut slices, bar lists, funnels. */
export interface Datum<Key extends string = string> {
  readonly key: Key;
  readonly label: string;
  readonly value: number;
  readonly slot?: ColorSlot;
  readonly color?: string;
  /** Previous value for deltas and comparison. */
  readonly previous?: number;
  readonly hint?: string;
}

/** An x/y point series for generic line/area charts with numeric or time x. */
export interface XYPoint {
  readonly x: number;
  readonly y: number;
}

export interface XYSeries<Id extends string = string> extends Series<Id> {
  readonly points: readonly XYPoint[];
}
