import { type KeyboardEvent, type ReactNode, useMemo, useRef, useState } from 'react';

import {
  type CategoryChartProps,
  ChartDataTable,
  ChartTooltip,
  cx,
  DURATION,
  type BlockState,
  StateView,
  Swatch,
  TooltipContent,
  type TooltipContext,
  type TooltipRow,
  UNIT_COUNT,
  useControllableState,
  useElementSize,
  useFormat,
  useIsomorphicLayoutEffect,
  useLocale,
  useTweenedValues,
  VisuallyHidden,
} from '../../core';
import { useIsPhone } from '../shared/hooks';
import { colorOf } from '../shared/series';
import { arrowTarget, formatShare, isMouse, markState, type TooltipAnchor, useCssVars } from './common';
import {
  type DonutRow,
  type DonutVariant,
  DONUT_SPAN,
  donutRows,
  GEOMETRY,
  layoutArcs,
  polar,
  sliceSweeps,
  slicePath,
} from './donut-model';

/** Rows shown before the tail collapses into "Other": fits the 8-colour palette with the grey bucket. */
export const DEFAULT_VISIBLE_ROWS = 7;

export interface DonutChartProps<Key extends string = string> extends CategoryChartProps<Key> {
  /** `ring` (default), `pie` (full) or `semi` (half ring, a gauge-like share). */
  readonly variant?: DonutVariant;
  /**
   * Rows kept before the rest merges into one "Other" row (also in the legend and tooltip).
   * Default 7; `limit` from the category contract is an alias when this is not set.
   */
  readonly visibleRows?: number;
  /** Highlighted row key (`'__other__'` for the merged row). Pass it to control; `null` — nothing. */
  readonly highlight?: string | null;
  readonly onHighlight?: (key: string | null) => void;
  /** Caption under the centre value when nothing is highlighted. Default: "Total". */
  readonly caption?: string;
  /** Centre value when nothing is highlighted. Default: the total. */
  readonly centerValue?: string;
  /** The legend list with values and shares next to the drawing. Default true. */
  readonly legend?: boolean;
}

function rowColor(row: DonutRow, index: number): string {
  return colorOf({ color: row.color, slot: row.slot }, index);
}

/**
 * Share of a whole: ring, full pie or half ring. The centre shows the total and switches to the
 * hovered or focused slice; a legend lists values and shares. Slices sweep in on first draw and
 * morph on updates; highlight is controlled or uncontrolled.
 */
export function DonutChart<Key extends string = string>(props: DonutChartProps<Key>) {
  const { data, sort, limit, visibleRows, state, className, height } = props;
  const locale = useLocale();
  const rows = useMemo(
    () => donutRows(data, { sort, visibleRows: visibleRows ?? limit ?? DEFAULT_VISIBLE_ROWS, otherLabel: locale.strings.other }),
    [data, sort, visibleRows, limit, locale.strings.other],
  );
  const total = rows.reduce((s, r) => s + r.value, 0);
  let effective: BlockState = state ?? { status: 'ready' };
  if (effective.status === 'ready' && total <= 0) effective = { status: 'empty' };
  const rootRef = useCssVars<HTMLDivElement>(height ? { '--vl-donut-size': `${height}px` } : {});
  return (
    <div ref={rootRef} className={cx('vl-donut', `vl-donut--${props.variant ?? 'ring'}`, className)} data-testid={props['data-testid']}>
      <StateView state={effective} skeleton="circle">
        <DonutBody {...props} rows={rows} total={total} />
      </StateView>
    </div>
  );
}

interface BodyProps<Key extends string> extends DonutChartProps<Key> {
  readonly rows: readonly DonutRow[];
  readonly total: number;
}

function DonutBody<Key extends string>({
  rows,
  total,
  title,
  description,
  variant = 'ring',
  unit = UNIT_COUNT,
  formatValue,
  animate = true,
  tooltip = true,
  highlight,
  onHighlight,
  onHover,
  onSelect,
  caption,
  centerValue,
  legend = true,
}: BodyProps<Key>) {
  const fmt = useFormat();
  const locale = useLocale();
  const phone = useIsPhone();
  const geometry = GEOMETRY[variant];
  const span = DONUT_SPAN[variant].span;
  const value = (v: number) => (formatValue ? formatValue(v) : fmt.value(v, unit, true));

  const fractions = useMemo(() => rows.map((r) => (total > 0 ? r.value / total : 0)), [rows, total]);
  const tweened = useTweenedValues(fractions, { duration: DURATION.data });
  const shown = animate ? tweened : fractions;
  const arcs = layoutArcs(sliceSweeps(shown, span), variant);

  const [active, setActive] = useControllableState<string | null>(highlight, null, onHighlight);
  const activeIndex = active === null ? -1 : rows.findIndex((r) => r.key === active);
  const activeRow = activeIndex >= 0 ? rows[activeIndex] : null;
  const activeArc = arcs.find((a) => a.index === activeIndex) ?? null;

  const [rootRef, rootSize, rootNode] = useElementSize<HTMLDivElement>();
  const plotRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [anchor, setAnchor] = useState<TooltipAnchor | null>(null);
  const mid = activeArc?.mid ?? null;
  useIsomorphicLayoutEffect(() => {
    const plot = plotRef.current;
    if (!rootNode || !plot || mid === null) return;
    const box = plot.getBoundingClientRect();
    const origin = rootNode.getBoundingClientRect();
    const p = polar(geometry, mid, geometry.ro);
    setAnchor({
      x: box.left - origin.left + (p.x / geometry.width) * box.width,
      y: box.top - origin.top + (p.y / geometry.height) * box.height,
    });
  }, [mid, rootNode, rootSize.width, rootSize.height, geometry]);

  function set(index: number | null) {
    const next = index === null ? null : (rows[index]?.key ?? null);
    setActive(next);
    onHover?.(index, null);
  }

  function onSliceKey(event: KeyboardEvent<SVGPathElement>, index: number) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect?.(index, null);
      return;
    }
    if (event.key === 'Escape') {
      event.currentTarget.blur();
      return;
    }
    const order = arcs.map((a) => a.index);
    const at = order.indexOf(index);
    const forward = event.key === 'ArrowRight' || event.key === 'ArrowDown';
    const backward = event.key === 'ArrowLeft' || event.key === 'ArrowUp';
    let to: number | null = null;
    if (forward) to = arrowTarget('ArrowRight', at, order.length);
    else if (backward) to = arrowTarget('ArrowLeft', at, order.length);
    else if (event.key === 'Home' || event.key === 'End') to = arrowTarget(event.key, at, order.length);
    if (to === null) return;
    event.preventDefault();
    svgRef.current?.querySelectorAll<SVGPathElement>('[data-slice]')[to]?.focus();
  }

  function describe(row: DonutRow): string {
    return `${row.label}: ${value(row.value)}, ${formatShare(fmt, total > 0 ? row.value / total : Number.NaN)}`;
  }

  function context(row: DonutRow, index: number): TooltipContext {
    const share = formatShare(fmt, total > 0 ? row.value / total : Number.NaN);
    const rowsOut: TooltipRow[] = [
      { id: row.key, label: row.label, value: value(row.value), color: rowColor(row, index), note: share, strong: true },
    ];
    return { title: row.label, rows: rowsOut, index, values: { [row.key]: row.value } };
  }

  function tooltipBody(row: DonutRow, index: number): ReactNode {
    const ctx = context(row, index);
    if (typeof tooltip === 'function') return tooltip(ctx);
    const footer = row.merged > 1 ? locale.strings.more(row.merged) : row.hint;
    return <TooltipContent rows={ctx.rows} footer={footer} />;
  }

  const showTooltip = tooltip !== false;
  const bigValue = activeRow ? value(activeRow.value) : (centerValue ?? value(total));
  const bigCaption = activeRow ? activeRow.label : (caption ?? locale.strings.total);
  const hasCenter = variant !== 'pie';
  const centerY = variant === 'semi' ? geometry.cy - 22 : geometry.cy - 2;

  return (
    <div ref={rootRef} className="vl-donut__body" onPointerLeave={() => set(null)}>
      <div ref={plotRef} className="vl-donut__plot">
        <svg ref={svgRef} className="vl-donut__svg" viewBox={`0 0 ${geometry.width} ${geometry.height}`} role="group" aria-label={title}>
          <title>{title}</title>
          {variant === 'ring' ? (
            <circle cx={geometry.cx} cy={geometry.cy} r={(geometry.ro + geometry.ri) / 2} className="vl-donut__track" />
          ) : null}
          {arcs.map((arc) => {
            const row = rows[arc.index];
            const state = markState(activeIndex, arc.index);
            return (
              <path
                key={row.key}
                d={slicePath(geometry, arc.a0, arc.a1)}
                fill={rowColor(row, arc.index)}
                className="vl-donut__slice"
                data-slice={row.key}
                data-state={state}
                role="img"
                tabIndex={0}
                aria-label={describe(row)}
                onPointerEnter={(e) => isMouse(e) && set(arc.index)}
                onFocus={() => set(arc.index)}
                onBlur={() => set(null)}
                onKeyDown={(e) => onSliceKey(e, arc.index)}
                onClick={() => {
                  if (phone) set(active === row.key ? null : arc.index);
                  onSelect?.(arc.index, null);
                }}
              />
            );
          })}
          {hasCenter ? (
            <g key={activeRow?.key ?? 'total'} className="vl-donut__center" aria-hidden="true">
              <text x={geometry.cx} y={centerY} textAnchor="middle" className="vl-donut__big">
                {bigValue}
              </text>
              <text x={geometry.cx} y={centerY + 20} textAnchor="middle" className="vl-donut__caption">
                {bigCaption}
              </text>
            </g>
          ) : null}
        </svg>
      </div>
      {legend ? (
        <ul className="vl-donut__legend" aria-hidden="true">
          {rows.map((row, i) => {
            const state = markState(activeIndex, i);
            return (
              <li
                key={row.key}
                className="vl-donut__row"
                data-state={state}
                data-empty={row.value <= 0 || undefined}
                onPointerEnter={(e) => isMouse(e) && set(i)}
                onClick={() => onSelect?.(i, null)}
              >
                <span className="vl-donut__label" title={row.label}>
                  <Swatch color={rowColor(row, i)} shape="square" />
                  <span className="vl-donut__name">{row.label}</span>
                </span>
                <span className="vl-donut__share">{formatShare(fmt, total > 0 ? row.value / total : Number.NaN)}</span>
                <span className="vl-donut__value">{value(row.value)}</span>
              </li>
            );
          })}
        </ul>
      ) : null}
      {showTooltip ? (
        <ChartTooltip
          open={activeRow !== null && anchor !== null}
          anchor={anchor}
          bounds={rootSize}
          dockBelow={phone ? Number.POSITIVE_INFINITY : 0}
          prefer="top"
          aria-label={title}
        >
          {activeRow ? tooltipBody(activeRow, activeIndex) : null}
        </ChartTooltip>
      ) : null}
      {description ? <VisuallyHidden>{description}</VisuallyHidden> : null}
      <ChartDataTable
        caption={title}
        columns={[locale.strings.legend, locale.strings.total, '%']}
        rows={rows.map((r) => [r.label, value(r.value), formatShare(fmt, total > 0 ? r.value / total : Number.NaN)])}
      />
    </div>
  );
}
