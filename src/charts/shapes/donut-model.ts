import { type ColorSlot, type Datum } from '../../core';

/** Gap between slices, degrees. */
export const GAP_DEG = 3;
/** A slice thinner than this is widened so a 0.5 % share stays visible, degrees. */
export const MIN_DEG = 5;
/** Key of the merged "other" row. */
export const OTHER_KEY = '__other__';

export const DONUT_VARIANT = { ring: 'ring', pie: 'pie', semi: 'semi' } as const;
export type DonutVariant = (typeof DONUT_VARIANT)[keyof typeof DONUT_VARIANT];

/** Angular span of a variant, degrees, and where it starts (0° = 12 o'clock, clockwise). */
export const DONUT_SPAN = { ring: { span: 360, start: 0 }, pie: { span: 360, start: 0 }, semi: { span: 180, start: -90 } } as const;

export interface DonutRow {
  readonly key: string;
  readonly label: string;
  /** Non-negative value used for the slice. */
  readonly value: number;
  /** Colour slot, `'other'` for the merged bucket. */
  readonly slot: ColorSlot;
  readonly color?: string;
  readonly hint?: string;
  /** Index in the source data, `-1` for the merged bucket. */
  readonly source: number;
  /** How many source items are merged into this row (1 for a plain row). */
  readonly merged: number;
}

export interface DonutRowsOptions {
  readonly sort?: 'none' | 'desc' | 'asc';
  /** Keep this many biggest rows, the rest collapses into one "other" row. */
  readonly visibleRows?: number;
  readonly otherLabel: string;
}

const clean = (v: number): number => (Number.isFinite(v) && v > 0 ? v : 0);

/**
 * Rows of the donut: sorted, with the tail collapsed into "other". Colours stay tied to the source
 * order (the same item keeps its colour when sorting changes); the "other" bucket is grey.
 */
export function donutRows<Key extends string>(data: readonly Datum<Key>[], options: DonutRowsOptions): DonutRow[] {
  const rows: DonutRow[] = data.map((d, i) => ({
    key: d.key,
    label: d.label,
    value: clean(d.value),
    slot: d.slot ?? i,
    color: d.color,
    hint: d.hint,
    source: i,
    merged: 1,
  }));
  const limit = options.visibleRows;
  let picked = rows;
  let tail: DonutRow[] = [];
  if (limit !== undefined && limit >= 1 && rows.length > limit + 1) {
    const keep = new Set(
      [...rows]
        .sort((a, b) => b.value - a.value || a.source - b.source)
        .slice(0, limit)
        .map((r) => r.source),
    );
    picked = rows.filter((r) => keep.has(r.source));
    tail = rows.filter((r) => !keep.has(r.source));
  }
  if (options.sort === 'desc') picked = [...picked].sort((a, b) => b.value - a.value || a.source - b.source);
  if (options.sort === 'asc') picked = [...picked].sort((a, b) => a.value - b.value || a.source - b.source);
  if (tail.length === 0) return picked;
  const other: DonutRow = {
    key: OTHER_KEY,
    label: options.otherLabel,
    value: tail.reduce((s, r) => s + r.value, 0),
    slot: 'other',
    source: -1,
    merged: tail.length,
  };
  return [...picked, other];
}

/**
 * Angles of the slices with a minimum width: thin ones are lifted to `MIN_DEG`, big ones give up
 * the difference in proportion. `span` is the whole sweep; gaps between live slices are reserved.
 */
export function sliceSweeps(fractions: readonly number[], span = 360): number[] {
  const live = fractions.filter((f) => f > 0).length;
  const free = span - (live > 1 ? GAP_DEG * live : 0);
  const raw = fractions.map((f) => f * free);
  const small = raw.map((d) => d > 0 && d < MIN_DEG);
  const lift = raw.reduce((sum, d, i) => sum + (small[i] ? MIN_DEG - d : 0), 0);
  const big = raw.reduce((sum, d, i) => sum + (!small[i] ? d : 0), 0);
  return raw.map((d, i) => {
    if (d <= 0) return 0;
    if (small[i]) return MIN_DEG;
    return big > 0 ? d - (lift * d) / big : d;
  });
}

export interface Arc {
  readonly index: number;
  readonly a0: number;
  readonly a1: number;
  readonly mid: number;
}

/** Start/end angle of every slice, placed one after another with gaps. Zero-width slices get no arc. */
export function layoutArcs(sweeps: readonly number[], variant: DonutVariant): Arc[] {
  const { start } = DONUT_SPAN[variant];
  const live = sweeps.filter((d) => d > 0).length;
  const gap = live > 1 ? GAP_DEG : 0;
  let cursor = start + gap / 2;
  const out: Arc[] = [];
  sweeps.forEach((d, index) => {
    if (d <= 0) return;
    out.push({ index, a0: cursor, a1: cursor + d, mid: cursor + d / 2 });
    cursor += d + gap;
  });
  return out;
}

export interface Geometry {
  /** Centre of the drawing. */
  readonly cx: number;
  readonly cy: number;
  /** Outer and inner radius; inner 0 is a pie. */
  readonly ro: number;
  readonly ri: number;
  /** Corner radius of a slice. */
  readonly corner: number;
  readonly width: number;
  readonly height: number;
}

const BOX = 200;
export const GEOMETRY: Readonly<Record<DonutVariant, Geometry>> = {
  ring: { cx: BOX / 2, cy: BOX / 2, ro: 90, ri: 66, corner: 6, width: BOX, height: BOX },
  pie: { cx: BOX / 2, cy: BOX / 2, ro: 92, ri: 0, corner: 0, width: BOX, height: BOX },
  semi: { cx: BOX / 2, cy: 100, ro: 92, ri: 66, corner: 6, width: BOX, height: 108 },
};

/** Point at `deg` (0° up, clockwise) and radius `r`. */
export function polar(g: Geometry, deg: number, r: number): { x: number; y: number } {
  const a = ((deg - 90) * Math.PI) / 180;
  return { x: g.cx + r * Math.cos(a), y: g.cy + r * Math.sin(a) };
}

const pt = (g: Geometry, deg: number, r: number): string => {
  const p = polar(g, deg, r);
  return `${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
};

/**
 * SVG path of a slice from `a0` to `a1` degrees. Ring slices have rounded corners: at each corner an
 * arc of radius `rc` touches both the radial edge and the circle (the corner shrinks on thin slices).
 * A full circle is drawn as two arcs; a pie slice is a plain wedge.
 */
export function slicePath(g: Geometry, a0: number, a1: number): string {
  const { ro, ri } = g;
  const sweep = a1 - a0;
  if (sweep >= 359.9) {
    if (ri === 0) return `M ${pt(g, 0, ro)} A ${ro} ${ro} 0 1 1 ${pt(g, 180, ro)} A ${ro} ${ro} 0 1 1 ${pt(g, 0, ro)} Z`;
    return (
      `M ${pt(g, 0, ro)} A ${ro} ${ro} 0 1 1 ${pt(g, 180, ro)} A ${ro} ${ro} 0 1 1 ${pt(g, 0, ro)} ` +
      `M ${pt(g, 0, ri)} A ${ri} ${ri} 0 1 0 ${pt(g, 180, ri)} A ${ri} ${ri} 0 1 0 ${pt(g, 0, ri)} Z`
    );
  }
  if (ri === 0) {
    const large = sweep > 180 ? 1 : 0;
    return `M ${g.cx} ${g.cy} L ${pt(g, a0, ro)} A ${ro} ${ro} 0 ${large} 1 ${pt(g, a1, ro)} Z`;
  }
  const rad = (sweep * Math.PI) / 180;
  const rc = Math.max(0, Math.min(g.corner, (ro - ri) / 2 - 0.5, rad * ri * 0.45));
  const deg = (x: number) => (x * 180) / Math.PI;
  const to = deg(Math.asin(rc / (ro - rc)));
  const ti = deg(Math.asin(rc / (ri + rc)));
  const lo = Math.sqrt((ro - rc) ** 2 - rc ** 2);
  const li = Math.sqrt((ri + rc) ** 2 - rc ** 2);
  const largeOuter = sweep - 2 * to > 180 ? 1 : 0;
  const largeInner = sweep - 2 * ti > 180 ? 1 : 0;
  return [
    `M ${pt(g, a0, lo)}`,
    `A ${rc} ${rc} 0 0 1 ${pt(g, a0 + to, ro)}`,
    `A ${ro} ${ro} 0 ${largeOuter} 1 ${pt(g, a1 - to, ro)}`,
    `A ${rc} ${rc} 0 0 1 ${pt(g, a1, lo)}`,
    `L ${pt(g, a1, li)}`,
    `A ${rc} ${rc} 0 0 1 ${pt(g, a1 - ti, ri)}`,
    `A ${ri} ${ri} 0 ${largeInner} 0 ${pt(g, a0 + ti, ri)}`,
    `A ${rc} ${rc} 0 0 1 ${pt(g, a0, li)}`,
    'Z',
  ].join(' ');
}
