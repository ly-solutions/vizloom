import { type KeyboardEvent, type ReactNode, useMemo, useRef, useState } from 'react';

import {
  type BaseChartProps,
  type BlockState,
  type ChartEvents,
  ChartDataTable,
  ChartTooltip,
  cx,
  DURATION,
  type HourlySeries,
  Skeleton,
  StateView,
  TooltipContent,
  type TooltipContext,
  type TooltipOptions,
  type TooltipRow,
  type TimeRange,
  type TimeZone,
  UNIT_COUNT,
  useElementSize,
  useFormat,
  useLocale,
  useTweenedValues,
  useVizConfig,
  VisuallyHidden,
} from '../../core';
import { DAY_HOURS, groupHours, heatmapStats, WEEK_DAYS, type WeekHourGrid, weekHourGrid } from '../model/heatmap';
import { useIsPhone } from '../shared/hooks';
import { anchorOf, formatShare, isMouse, type TooltipAnchor, VarBox } from './common';

/** Copy of the heatmap. Defaults are English; weekday names come from the locale. */
export interface HeatmapLabels {
  readonly value: string;
  readonly ofWeek: string;
  readonly vsUsual: string;
  readonly dayTotal: string;
  readonly noData: string;
  readonly few: string;
  readonly many: string;
  readonly perDay: string;
  readonly perHour: string;
  /** "Peak: Fri 20:00 · 142". */
  readonly peak: (slot: string, value: string) => string;
  /** "Strongest day: Fri — 21% of the week". */
  readonly bestDay: (day: string, share: string) => string;
  readonly day: string;
  readonly total: string;
}

export const DEFAULT_HEATMAP_LABELS: HeatmapLabels = {
  value: 'Sales',
  ofWeek: 'of the week',
  vsUsual: 'vs. an average slot',
  dayTotal: 'Whole day',
  noData: 'No data for this slot',
  few: 'less',
  many: 'more',
  perDay: 'per day',
  perHour: 'per hour',
  peak: (slot, value) => `Peak: ${slot} · ${value}`,
  bestDay: (day, share) => `Strongest day: ${day} — ${share} of the week`,
  day: 'Day',
  total: 'Total',
};

interface HeatmapCommon extends BaseChartProps, TooltipOptions, ChartEvents {
  /** Row and column totals along the edges. Default true. */
  readonly totals?: boolean;
  /** Headline: the peak slot and the strongest day. Default true. */
  readonly summary?: boolean;
  /** Colour legend ("less … more") under the grid. Default true. */
  readonly scale?: boolean;
  readonly labels?: Partial<HeatmapLabels>;
}

export interface HeatmapChartProps extends HeatmapCommon {
  /** `grid[day][hour]`, day 0 is Monday, 24 hours (`weekHourGrid`). `NaN` — no data, `0` — nothing sold. */
  readonly grid?: WeekHourGrid;
  /** Alternative to `grid`: an hourly series (UTC), folded into weekday x hour in the provider's time zone. */
  readonly hourly?: HourlySeries;
  /** With `hourly`: which series to add up. Default: all. */
  readonly ids?: readonly string[];
  readonly range?: TimeRange;
  /** Overrides the zone of `VizProvider`. */
  readonly zone?: TimeZone;
}

/** Cell colour mix: the share of the dark end of the ramp; empty-but-known slots stay at the light end. */
export const ALPHA_BASE = 0.14;
export const ALPHA_RANGE = 0.86;
export const ALPHA_GAMMA = 0.8;

/** How strongly a cell is coloured, 0…1: `.14 + .86 · (v / max)^.8`; zero and unknown are 0. */
export function cellAlpha(value: number, max: number): number {
  if (!(value > 0) || !(max > 0)) return 0;
  return ALPHA_BASE + ALPHA_RANGE * Math.min(1, value / max) ** ALPHA_GAMMA;
}

/** Hours per column so that a cell stays at least ~16 px wide. */
export function pickHourStep(plotWidth: number): 1 | 2 | 3 | 4 {
  for (const step of [1, 2, 3] as const) if (plotWidth / (DAY_HOURS / step) >= 16) return step;
  return 4;
}

const pad2 = (n: number): string => String(n).padStart(2, '0');
const DAY_LABEL_W = 36;
const TOTAL_W = 52;

/**
 * Weekday × hour heatmap: when people buy. One hue from "less" to "more"; totals at the edges; hover
 * or keyboard focus on a cell shows its value, share of the week and how it compares to an average slot.
 * Narrow screens merge hours into 2–3 hour columns. Hours are read in the time zone of `VizProvider`.
 */
export function HeatmapChart(props: HeatmapChartProps) {
  const { state, className } = props;
  const zone = useVizConfig().zone;
  const grid = useMemo<WeekHourGrid>(() => {
    if (props.grid) return props.grid;
    if (!props.hourly) throw new Error('HeatmapChart needs either `grid` or `hourly`');
    return weekHourGrid(props.hourly, { ids: props.ids, range: props.range, zone: props.zone ?? zone });
  }, [props.grid, props.hourly, props.ids, props.range, props.zone, zone]);
  const stats = useMemo(() => heatmapStats(grid), [grid]);
  let effective: BlockState = state ?? { status: 'ready' };
  if (effective.status === 'ready' && stats.max <= 0) effective = { status: 'empty' };
  const skeleton = (
    <div className="vl-heatmap__skeleton">
      {Array.from({ length: WEEK_DAYS * 12 }, (_, i) => (
        <Skeleton key={i} shape="rect" />
      ))}
    </div>
  );
  return (
    <div className={cx('vl-heatmap', className)} data-testid={props['data-testid']}>
      <StateView state={effective} skeleton={skeleton}>
        <HeatmapBody {...props} grid={grid} />
      </StateView>
    </div>
  );
}

function HeatmapBody({
  grid,
  title,
  description,
  unit = UNIT_COUNT,
  formatValue,
  animate = true,
  tooltip = true,
  totals = true,
  summary = true,
  scale: showScale = true,
  labels,
  onHover,
  onSelect,
}: HeatmapChartProps & { readonly grid: WeekHourGrid }) {
  const fmt = useFormat();
  const locale = useLocale();
  const phone = useIsPhone();
  const l = { ...DEFAULT_HEATMAP_LABELS, ...labels };
  const [boxRef, boxSize] = useElementSize<HTMLDivElement>();
  const plotWidth = Math.max(0, boxSize.width - DAY_LABEL_W - (totals ? TOTAL_W : 0));
  // Before the first measurement (and on the server) draw the full 24 columns.
  const step = boxSize.width > 0 ? pickHourStep(plotWidth) : 1;
  const cells = useMemo(() => (step > 1 ? groupHours(grid, step) : grid.map((row) => [...row])), [grid, step]);
  const stats = useMemo(() => heatmapStats(cells), [cells]);
  const cols = cells[0]?.length ?? DAY_HOURS;
  const value = (v: number) => (formatValue ? formatValue(v) : fmt.value(v, unit, true));
  const compact = (v: number) => (formatValue ? formatValue(v) : fmt.value(v, unit));

  const flat = useMemo(() => cells.flat(), [cells]);
  const tweened = useTweenedValues(
    flat.map((v) => (v === v ? v : 0)),
    { duration: DURATION.data },
  );
  const tweenedMax = useTweenedValues([stats.max], { duration: DURATION.data, initial: [stats.max] })[0];
  const shown = animate ? tweened : flat.map((v) => (v === v ? v : 0));
  const max = (animate ? tweenedMax : stats.max) || 1;

  const dayName = (d: number) => locale.weekdaysShort[(d + 1) % 7];
  const dayLong = (d: number) => locale.weekdaysLong[(d + 1) % 7];
  const slotRange = (col: number) => `${pad2(col * step)}:00–${pad2((col * step + step) % 24)}:00`;

  const [focusCell, setFocusCell] = useState<{ day: number; col: number }>({ day: 0, col: 0 });
  const [active, setActive] = useState<{ day: number; col: number } | null>(null);
  const [anchor, setAnchor] = useState<TooltipAnchor | null>(null);
  const plotRef = useRef<HTMLDivElement | null>(null);
  const held = useRef<{ day: number; col: number } | null>(null);
  if (active) held.current = active;

  function enter(day: number, col: number, el: Element) {
    setActive({ day, col });
    setFocusCell({ day, col });
    onHover?.(day * cols + col, null);
    if (plotRef.current) setAnchor(anchorOf(el, plotRef.current));
  }
  function leave() {
    setActive(null);
    setAnchor(null);
    onHover?.(null);
  }

  function onKey(event: KeyboardEvent<HTMLElement>, day: number, col: number) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect?.(day * cols + col, null);
      return;
    }
    if (event.key === 'Escape') {
      event.currentTarget.blur();
      return;
    }
    let d = day;
    let c = col;
    if (event.key === 'ArrowRight') c = Math.min(cols - 1, col + 1);
    else if (event.key === 'ArrowLeft') c = Math.max(0, col - 1);
    else if (event.key === 'ArrowDown') d = Math.min(WEEK_DAYS - 1, day + 1);
    else if (event.key === 'ArrowUp') d = Math.max(0, day - 1);
    else if (event.key === 'Home') c = 0;
    else if (event.key === 'End') c = cols - 1;
    else return;
    event.preventDefault();
    plotRef.current?.querySelector<HTMLElement>(`[data-cell="${d}:${c}"]`)?.focus();
  }

  function describe(day: number, col: number): string {
    const v = cells[day][col];
    const slot = `${dayLong(day)}, ${slotRange(col)}`;
    return v === v ? `${slot}: ${value(v)}` : `${slot}: ${l.noData}`;
  }

  function context(day: number, col: number): TooltipContext {
    const v = cells[day][col];
    const rows: TooltipRow[] = [];
    if (v !== v) {
      rows.push({ id: 'none', label: l.noData, value: '—', muted: true });
    } else {
      rows.push({ id: 'value', label: l.value, value: value(v), strong: true });
      rows.push({ id: 'share', label: l.ofWeek, value: formatShare(fmt, stats.total > 0 ? v / stats.total : Number.NaN) });
      if (stats.mean > 0) rows.push({ id: 'usual', label: l.vsUsual, value: `×${fmt.number(v / stats.mean, 1)}` });
      const dayTotal = stats.dayTotals[day];
      rows.push({ id: 'day', label: l.dayTotal, value: dayTotal === dayTotal ? value(dayTotal) : '—', muted: true });
    }
    return { title: `${dayLong(day)}, ${slotRange(col)}`, rows, index: day * cols + col, values: { value: v } };
  }

  const shownCell = active ?? held.current;
  let tipBody: ReactNode = null;
  if (shownCell) {
    const ctx = context(shownCell.day, shownCell.col);
    tipBody = typeof tooltip === 'function' ? tooltip(ctx) : <TooltipContent title={ctx.title} rows={ctx.rows} />;
  }

  const labelEvery = plotWidth / cols >= 22 ? 3 : 6;
  const maxColTotal = Math.max(0, ...stats.colTotals.filter((v) => v === v));
  const hot = stats.hot;
  const best = stats.bestDay;

  return (
    <div className="vl-heatmap__body" onPointerLeave={leave}>
      {summary && hot ? (
        <div className="vl-heatmap__summary">
          <div className="vl-heatmap__peak">{l.peak(`${dayName(hot.day)} ${pad2(hot.col * step)}:00`, value(hot.value))}</div>
          {best >= 0 ? (
            <div className="vl-heatmap__best">
              {l.bestDay(dayLong(best), formatShare(fmt, stats.total > 0 ? stats.dayTotals[best] / stats.total : Number.NaN))}
            </div>
          ) : null}
        </div>
      ) : null}
      <div ref={boxRef} className="vl-heatmap__plot-box">
        <VarBox
          vars={{ '--vl-heat-cols': cols, '--vl-heat-day-w': `${DAY_LABEL_W}px`, '--vl-heat-total-w': totals ? `${TOTAL_W}px` : '0px' }}
          className="vl-heatmap__plot"
          data-totals={totals || undefined}
        >
          <div ref={plotRef} className="vl-heatmap__grid" role="grid" aria-label={title} aria-readonly="true" data-step={step}>
            <div className="vl-heatmap__hours" aria-hidden="true">
              {Array.from({ length: cols }, (_, c) => {
                const hour = c * step;
                const on = c === active?.col;
                return (
                  <span key={c} className="vl-heatmap__hour" data-on={on || undefined}>
                    {hour % labelEvery === 0 ? pad2(hour) : ''}
                  </span>
                );
              })}
            </div>
            {cells.map((row, day) => (
              <div key={day} className="vl-heatmap__row" role="row">
                <span className="vl-heatmap__day" data-on={day === active?.day || undefined} role="rowheader">
                  {dayName(day)}
                </span>
                <div className="vl-heatmap__cells">
                  {row.map((v, col) => {
                    const known = v === v;
                    const t = cellAlpha(shown[day * cols + col], max);
                    const isActive = active?.day === day && active.col === col;
                    return (
                      <VarBox
                        key={col}
                        vars={{ '--vl-t': t }}
                        className="vl-heatmap__cell"
                        role="gridcell"
                        data-cell={`${day}:${col}`}
                        data-known={known}
                        data-zero={(known && v === 0) || undefined}
                        data-active={isActive || undefined}
                        data-hot={(hot?.day === day && hot.col === col) || undefined}
                        tabIndex={focusCell.day === day && focusCell.col === col ? 0 : -1}
                        aria-label={describe(day, col)}
                        onPointerEnter={(e) => isMouse(e) && enter(day, col, e.currentTarget)}
                        onFocus={(e) => enter(day, col, e.currentTarget)}
                        onBlur={leave}
                        onKeyDown={(e) => onKey(e, day, col)}
                        onClick={(e) => {
                          if (phone) {
                            if (isActive) leave();
                            else enter(day, col, e.currentTarget);
                          }
                          onSelect?.(day * cols + col, null);
                        }}
                      />
                    );
                  })}
                </div>
                {totals ? (
                  <span className="vl-heatmap__total" aria-hidden="true">
                    {stats.dayTotals[day] === stats.dayTotals[day] ? compact(stats.dayTotals[day]) : '—'}
                  </span>
                ) : null}
              </div>
            ))}
            {totals ? (
              <div className="vl-heatmap__col-totals" aria-hidden="true">
                {stats.colTotals.map((v, c) => (
                  <VarBox
                    key={c}
                    vars={{ '--vl-h': maxColTotal > 0 && v === v ? v / maxColTotal : 0 }}
                    className="vl-heatmap__col-total"
                    data-on={c === active?.col || undefined}
                  />
                ))}
              </div>
            ) : null}
          </div>
          {showScale ? (
            <div className="vl-heatmap__scale" aria-hidden="true">
              <span>{l.few}</span>
              <span className="vl-heatmap__ramp" />
              <span>{l.many}</span>
            </div>
          ) : null}
          {tooltip !== false ? (
            <ChartTooltip open={active !== null && anchor !== null} anchor={anchor} bounds={boxSize} prefer="top" aria-label={title}>
              {tipBody}
            </ChartTooltip>
          ) : null}
        </VarBox>
      </div>
      {description ? <VisuallyHidden>{description}</VisuallyHidden> : null}
      <ChartDataTable
        caption={title}
        columns={[l.day, ...Array.from({ length: DAY_HOURS }, (_, h) => `${pad2(h)}:00`), l.total]}
        rows={grid.map((row, day) => [
          dayLong(day),
          ...row.map((v) => (v === v ? value(v) : '—')),
          stats.dayTotals[day] === stats.dayTotals[day] ? value(stats.dayTotals[day]) : '—',
        ])}
      />
    </div>
  );
}
