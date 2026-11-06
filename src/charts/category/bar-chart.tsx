import { type KeyboardEvent, type ReactNode, useMemo, useRef, useState } from 'react';

import {
  type BaseChartProps,
  ChartDataTable,
  ChartTooltip,
  type ChartEvents,
  cx,
  type Datum,
  hasContent,
  Legend,
  type LegendOptions,
  niceDomain,
  type Series,
  seriesColor,
  StateView,
  type TooltipContext,
  TooltipContent,
  type TooltipOptions,
  type TooltipRow,
  useElementSize,
  useFormat,
  useSeriesState,
  useTweenedValues,
} from '../../core';

export interface BarCategory<Key extends string = string> {
  readonly key: Key;
  readonly label: string;
}

export interface BarChartProps<Id extends string = string, Key extends string = string>
  extends BaseChartProps,
    TooltipOptions<Id>,
    ChartEvents<Id>,
    Omit<LegendOptions<Id>, 'focus' | 'onFocusChange'> {
  /** Single series shortcut: one bar per datum (colours from `slot`/`color` or one accent). */
  readonly data?: readonly Datum<Key>[];
  /** Multi-series: categories × series. */
  readonly categories?: readonly BarCategory<Key>[];
  readonly series?: readonly Series<Id>[];
  /** Values per series, one per category (same order). */
  readonly values?: Readonly<Record<Id, readonly number[]>>;
  readonly orientation?: 'vertical' | 'horizontal';
  /** How several series combine. */
  readonly mode?: 'group' | 'stack' | 'percent';
  /** Print values on bars (single series / totals of stacks). */
  readonly valueLabels?: boolean;
  /** Sort categories by total. */
  readonly sort?: 'none' | 'desc' | 'asc';
  /** Emphasise one category, dim the rest. */
  readonly highlight?: Key | null;
  /** Colour each bar of a single series differently. */
  readonly colorByCategory?: boolean;
}

interface Layout<Id extends string, Key extends string> {
  readonly cats: readonly BarCategory<Key>[];
  readonly ids: readonly Id[];
  readonly labels: Readonly<Record<string, string>>;
  readonly colors: Readonly<Record<string, string>>;
  /** values[seriesIndex][categoryIndex] */
  readonly matrix: readonly (readonly number[])[];
}

const PAD = { top: 8, right: 8, bottom: 24, left: 40 } as const;

function useBarData<Id extends string, Key extends string>(props: BarChartProps<Id, Key>): Layout<Id, Key> {
  const { data, categories, series, values, sort = 'none', colorByCategory } = props;
  return useMemo(() => {
    let cats: BarCategory<Key>[];
    let ids: Id[];
    let matrix: number[][];
    const labels: Record<string, string> = {};
    const colors: Record<string, string> = {};
    if (data) {
      cats = data.map((d) => ({ key: d.key, label: d.label }));
      ids = ['value' as Id];
      matrix = [data.map((d) => d.value)];
      labels['value'] = props.title;
      colors['value'] = 'var(--vl-accent)';
      data.forEach((d, i) => {
        colors[`cat:${d.key}`] =
          d.color ?? (d.slot !== undefined ? seriesColor(d.slot) : colorByCategory ? seriesColor(i) : 'var(--vl-accent)');
      });
    } else {
      cats = [...(categories ?? [])];
      ids = (series ?? []).map((s) => s.id);
      matrix = ids.map((id) => [...((values?.[id] as readonly number[] | undefined) ?? [])]);
      (series ?? []).forEach((s, i) => {
        labels[s.id] = s.label;
        colors[s.id] = s.color ?? seriesColor(s.slot ?? i);
      });
      if (colorByCategory && ids.length === 1) cats.forEach((c, i) => (colors[`cat:${c.key}`] = seriesColor(i)));
    }
    if (sort !== 'none') {
      const order = cats
        .map((_, i) => i)
        .sort((a, b) => {
          const ta = matrix.reduce((s, row) => s + (row[a] || 0), 0);
          const tb = matrix.reduce((s, row) => s + (row[b] || 0), 0);
          return sort === 'desc' ? tb - ta : ta - tb;
        });
      cats = order.map((i) => cats[i]);
      matrix = matrix.map((row) => order.map((i) => row[i]));
    }
    return { cats, ids, labels, colors, matrix };
  }, [data, categories, series, values, sort, colorByCategory, props.title]);
}

/**
 * Bar chart: vertical or horizontal, one series or several grouped, stacked or as percent of
 * the total. Negative values, value labels, long category labels (truncated with a full title),
 * sorting, highlight, legend with hide/solo, tooltip (hover, tap, keyboard), growth animation.
 */
export function BarChart<Id extends string = string, Key extends string = string>(props: BarChartProps<Id, Key>) {
  const {
    title,
    description,
    height: heightProp,
    state,
    unit,
    formatValue,
    animate = true,
    className,
    orientation = 'vertical',
    mode = 'group',
    valueLabels = false,
    highlight = null,
    tooltip = true,
    legend = true,
    hidden: hiddenProp,
    onHiddenChange,
    onHover,
    onSelect,
    'data-testid': testId,
  } = props;
  const format = useFormat();
  const layout = useBarData(props);
  const { cats, ids, labels, colors, matrix } = layout;
  const seriesState = useSeriesState(ids);
  const hidden = hiddenProp ?? seriesState.hidden;
  const fmt = formatValue ?? ((v: number) => (unit ? format.value(v, unit) : format.compact(v)));
  const fmtLong = formatValue ?? ((v: number) => (unit ? format.value(v, unit, true) : format.number(v)));
  const horizontal = orientation === 'horizontal';
  const [ref, size] = useElementSize<HTMLDivElement>();
  const height =
    heightProp ??
    (horizontal
      ? Math.max(120, cats.length * (ids.length > 1 && mode === 'group' ? 14 * ids.length + 12 : 30) + PAD.top + PAD.bottom)
      : 240);
  const [active, setActive] = useState<number | null>(null);
  const [pinned, setPinned] = useState(false);
  const host = useRef<HTMLDivElement | null>(null);

  const visibleIdx = ids.map((id, i) => (hidden.has(id) ? -1 : i)).filter((i) => i >= 0);
  // Flattened target values for the tween (hidden series shrink to 0).
  const flat = useMemo(() => {
    const out: number[] = [];
    matrix.forEach((row, si) => cats.forEach((_, ci) => out.push(hidden.has(ids[si]) ? 0 : Number.isFinite(row[ci]) ? row[ci] : 0)));
    return out;
  }, [matrix, cats, hidden, ids]);
  const tweened = useTweenedValues(flat, { duration: animate ? 600 : 0 });
  const val = (si: number, ci: number) => tweened[si * cats.length + ci] ?? 0;

  const totals = cats.map((_, ci) => visibleIdx.reduce((s, si) => s + Math.max(0, matrix[si][ci] || 0), 0));
  let lo = 0;
  let hi = 0;
  cats.forEach((_, ci) => {
    if (mode === 'percent') hi = 100;
    else if (mode === 'stack') {
      let pos = 0;
      let neg = 0;
      for (const si of visibleIdx) {
        const v = matrix[si][ci] || 0;
        if (v >= 0) pos += v;
        else neg += v;
      }
      hi = Math.max(hi, pos);
      lo = Math.min(lo, neg);
    } else
      for (const si of visibleIdx) {
        const v = matrix[si][ci] || 0;
        hi = Math.max(hi, v);
        lo = Math.min(lo, v);
      }
  });
  const dom = niceDomain(lo, hi || 1, horizontal ? 4 : 4);
  const labelWidth = horizontal ? Math.min(160, Math.max(60, size.width * 0.32)) : 0;
  const plot = {
    left: horizontal ? labelWidth + 8 : PAD.left,
    top: PAD.top,
    right: size.width - PAD.right - (horizontal && valueLabels ? 44 : 0),
    bottom: height - PAD.bottom,
  };
  const valueSpan = dom.max - dom.min || 1;
  const vpx = (v: number) =>
    horizontal
      ? plot.left + ((v - dom.min) / valueSpan) * (plot.right - plot.left)
      : plot.bottom - ((v - dom.min) / valueSpan) * (plot.bottom - plot.top);
  const bandLen = ((horizontal ? plot.bottom - plot.top : plot.right - plot.left) || 1) / Math.max(1, cats.length);
  const bandStart = (ci: number) => (horizontal ? plot.top : plot.left) + ci * bandLen;
  const inner = bandLen * 0.72;
  const groupN = mode === 'group' ? Math.max(1, visibleIdx.length) : 1;

  interface Rect {
    si: number;
    ci: number;
    x: number;
    y: number;
    w: number;
    h: number;
    color: string;
  }
  const rects: Rect[] = [];
  cats.forEach((cat, ci) => {
    const b0 = bandStart(ci) + (bandLen - inner) / 2;
    let pos = 0;
    let neg = 0;
    const total = totals[ci] || 1;
    ids.forEach((id, si) => {
      const raw = val(si, ci);
      if (Math.abs(raw) < 1e-9 && hidden.has(id)) return;
      let v0: number;
      let v1: number;
      let slot = 0;
      if (mode === 'group') {
        slot = visibleIdx.indexOf(si);
        if (slot < 0) slot = 0;
        v0 = 0;
        v1 = raw;
      } else {
        const v = mode === 'percent' ? (Math.max(0, raw) / total) * 100 : raw;
        if (v >= 0) {
          v0 = pos;
          pos += v;
          v1 = pos;
        } else {
          v0 = neg;
          neg += v;
          v1 = neg;
        }
      }
      const thick = mode === 'group' ? inner / groupN : inner;
      const off = b0 + (mode === 'group' ? slot * thick : 0);
      const a = vpx(Math.min(v0, v1));
      const b = vpx(Math.max(v0, v1));
      const color = colors[`cat:${cat.key}`] && ids.length === 1 ? colors[`cat:${cat.key}`] : colors[id];
      const gap = mode === 'group' && groupN > 1 ? Math.min(2, thick * 0.12) : 0;
      if (horizontal) rects.push({ si, ci, x: a, y: off + gap / 2, w: Math.max(0, b - a), h: Math.max(1, thick - gap), color });
      else rects.push({ si, ci, x: off + gap / 2, y: b, w: Math.max(1, thick - gap), h: Math.max(0, a - b), color });
    });
  });

  const rowsFor = (ci: number): TooltipRow[] =>
    visibleIdx.map((si) => ({
      id: ids[si],
      label: labels[ids[si]],
      value: fmtLong(matrix[si][ci]),
      color: colors[`cat:${cats[ci].key}`] && ids.length === 1 ? colors[`cat:${cats[ci].key}`] : colors[ids[si]],
      shape: 'square' as const,
      note: mode === 'percent' && totals[ci] ? format.percent((Math.max(0, matrix[si][ci]) / totals[ci]) * 100, 0) : undefined,
    }));

  const pick = (x: number, y: number): number | null => {
    const p = horizontal ? y : x;
    const ci = Math.floor((p - (horizontal ? plot.top : plot.left)) / bandLen);
    return ci >= 0 && ci < cats.length ? ci : null;
  };
  const setActiveIndex = (ci: number | null) => {
    setActive(ci);
    onHover?.(ci);
  };
  const anchor =
    active !== null
      ? horizontal
        ? {
            x: Math.min(
              plot.right,
              vpx(
                mode === 'percent'
                  ? 100
                  : Math.max(0, mode === 'stack' ? totals[active] : Math.max(...visibleIdx.map((si) => matrix[si][active] || 0))),
              ),
            ),
            y: bandStart(active) + bandLen / 2,
          }
        : { x: bandStart(active) + bandLen / 2, y: plot.top + 12, width: inner }
      : null;

  const onKey = (e: KeyboardEvent) => {
    if (!cats.length) return;
    const next: Readonly<Record<string, number>> = horizontal ? { ArrowDown: 1, ArrowUp: -1 } : { ArrowRight: 1, ArrowLeft: -1 };
    const step = next[e.key];
    if (step) {
      e.preventDefault();
      setActiveIndex(active === null ? 0 : (active + step + cats.length) % cats.length);
    } else if (e.key === 'Home') setActiveIndex(0);
    else if (e.key === 'End') setActiveIndex(cats.length - 1);
    else if (e.key === 'Escape') {
      setPinned(false);
      setActiveIndex(null);
    } else if ((e.key === 'Enter' || e.key === ' ') && active !== null) {
      e.preventDefault();
      onSelect?.(active);
      setPinned((p) => !p);
    }
  };

  const context: TooltipContext<Id> | null =
    active !== null
      ? {
          title: cats[active].label,
          rows: rowsFor(active),
          index: active,
          values: Object.fromEntries(ids.map((id, si) => [id, matrix[si][active]])) as Partial<Record<Id, number>>,
        }
      : null;
  const tooltipBody: ReactNode =
    context && tooltip ? (
      typeof tooltip === 'function' ? (
        tooltip(context)
      ) : (
        <TooltipContent
          title={context.title}
          rows={context.rows}
          footer={ids.length > 1 && mode !== 'group' ? `${format.locale.strings.total}: ${fmtLong(totals[active ?? 0])}` : undefined}
        />
      )
    ) : null;

  const legendItems = ids.length > 1 ? ids.map((id) => ({ id, label: labels[id], color: colors[id], shape: 'square' as const })) : [];
  const legendEl =
    legend && legendItems.length > 1 ? (
      <Legend
        items={legendItems}
        hidden={hidden}
        focus={seriesState.focus}
        onToggle={(id) => {
          seriesState.toggle(id);
          if (onHiddenChange) {
            const next = new Set(hidden);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            onHiddenChange(next);
          }
        }}
        onSolo={seriesState.solo}
        onFocus={seriesState.setFocus}
      />
    ) : null;

  if (!hasContent(state)) {
    return (
      <div className={cx('vl-bar-chart', className)} data-testid={testId}>
        <div className="vl-bar-chart__state" ref={(n) => n?.style.setProperty('--vl-chart-h', `${height}px`)}>
          <StateView state={state!} skeleton="bars" />
        </div>
      </div>
    );
  }

  const truncate = (s: string, px: number) => {
    const max = Math.max(3, Math.floor(px / 6.4));
    return s.length > max ? `${s.slice(0, max - 1)}…` : s;
  };

  return (
    <div className={cx('vl-bar-chart', `vl-bar-chart--${orientation}`, className)} data-testid={testId}>
      {legend !== 'bottom' ? legendEl : null}
      <div
        ref={(n) => {
          host.current = n;
          ref(n);
          n?.style.setProperty('--vl-chart-h', `${height}px`);
        }}
        className="vl-bar-chart__plot vl-gesture-surface"
        tabIndex={0}
        role="group"
        aria-roledescription="bar chart"
        aria-label={title}
        aria-description={description}
        onKeyDown={onKey}
        onPointerMove={(e) => {
          if (pinned || e.pointerType === 'touch') return;
          const r = e.currentTarget.getBoundingClientRect();
          const ci = pick(e.clientX - r.left, e.clientY - r.top);
          if (ci !== active) setActiveIndex(ci);
        }}
        onPointerLeave={() => !pinned && setActiveIndex(null)}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const ci = pick(e.clientX - r.left, e.clientY - r.top);
          if (ci === null) return;
          onSelect?.(ci);
          if (props.pinnable !== false) {
            setActiveIndex(ci);
            setPinned((p) => !(p && ci === active));
          }
        }}
        onBlur={() => !pinned && setActiveIndex(null)}
      >
        {size.width > 0 ? (
          <svg className="vl-bar-chart__svg" width={size.width} height={height} aria-hidden="true">
            {dom.ticks.map((t) => {
              const p = vpx(t);
              return horizontal ? (
                <g key={t}>
                  <line className={t === 0 ? 'vl-axis-zero' : 'vl-grid-line'} x1={p} x2={p} y1={plot.top} y2={plot.bottom} />
                  <text className="vl-axis-label" x={p} y={height - 6} textAnchor="middle">
                    {mode === 'percent' ? `${t}%` : fmt(t)}
                  </text>
                </g>
              ) : (
                <g key={t}>
                  <line className={t === 0 ? 'vl-axis-zero' : 'vl-grid-line'} x1={plot.left} x2={plot.right} y1={p} y2={p} />
                  <text className="vl-axis-label" x={plot.left - 6} y={p + 4} textAnchor="end">
                    {mode === 'percent' ? `${t}%` : fmt(t)}
                  </text>
                </g>
              );
            })}
            {active !== null ? (
              <rect
                className="vl-bar-chart__hover"
                x={horizontal ? plot.left : bandStart(active)}
                y={horizontal ? bandStart(active) : plot.top}
                width={horizontal ? plot.right - plot.left : bandLen}
                height={horizontal ? bandLen : plot.bottom - plot.top}
              />
            ) : null}
            {rects.map((r) => (
              <rect
                key={`${r.si}-${r.ci}`}
                className="vl-bar-chart__bar"
                data-dim={
                  (highlight !== null && cats[r.ci].key !== highlight) || (seriesState.focus !== null && ids[r.si] !== seriesState.focus)
                    ? ''
                    : undefined
                }
                x={r.x}
                y={r.y}
                width={r.w}
                height={r.h}
                rx={Math.min(3, (horizontal ? r.h : r.w) / 4)}
                fill={r.color}
              />
            ))}
            {cats.map((c, ci) => {
              const mid = bandStart(ci) + bandLen / 2;
              return horizontal ? (
                <text key={c.key} className="vl-axis-label vl-axis-label--category" x={labelWidth} y={mid + 4} textAnchor="end">
                  <title>{c.label}</title>
                  {truncate(c.label, labelWidth)}
                </text>
              ) : bandLen > 18 || ci % Math.ceil(18 / bandLen) === 0 ? (
                <text key={c.key} className="vl-axis-label vl-axis-label--category" x={mid} y={height - 6} textAnchor="middle">
                  <title>{c.label}</title>
                  {truncate(c.label, Math.max(bandLen, 18) - 4)}
                </text>
              ) : null;
            })}
            {valueLabels
              ? cats.map((c, ci) => {
                  const total =
                    mode === 'group' && visibleIdx.length === 1 ? val(visibleIdx[0], ci) : visibleIdx.reduce((s, si) => s + val(si, ci), 0);
                  if (mode === 'percent' || (mode === 'group' && visibleIdx.length > 1)) return null;
                  const p = vpx(Math.max(0, total));
                  const mid = bandStart(ci) + bandLen / 2;
                  return horizontal ? (
                    <text key={c.key} className="vl-bar-chart__value" x={p + 6} y={mid + 4}>
                      {fmt(total)}
                    </text>
                  ) : (
                    <text key={c.key} className="vl-bar-chart__value" x={mid} y={p - 6} textAnchor="middle">
                      {fmt(total)}
                    </text>
                  );
                })
              : null}
          </svg>
        ) : null}
        {tooltip ? (
          <ChartTooltip
            open={active !== null}
            anchor={anchor}
            bounds={{ width: size.width, height }}
            pinned={pinned}
            onUnpin={() => setPinned(false)}
            prefer={horizontal ? 'auto' : 'auto'}
          >
            {tooltipBody}
          </ChartTooltip>
        ) : null}
      </div>
      {legend === 'bottom' ? legendEl : null}
      <ChartDataTable
        caption={title}
        columns={['', ...ids.map((id) => labels[id])]}
        rows={cats.map((c, ci) => [c.label, ...ids.map((_, si) => fmtLong(matrix[si][ci]))])}
      />
    </div>
  );
}
