import { useEffect, useId, useMemo, useRef, useState } from 'react';

import {
  type BaseChartProps,
  ChartDataTable,
  ChartTooltip,
  currencyUnit,
  cx,
  DAY,
  niceCeil,
  niceStep,
  seriesColor,
  type TooltipRow,
  useElementSize,
  useFormat,
  useGestures,
  useTweenedValues,
  useViewport,
  useViewportCurrent,
  useViewportTarget,
  type Viewport,
  yTicks,
} from '../../core';
import type { Refunds } from '../model/refunds';
import { useHeldValue } from '../shared/hooks';
import { ZoomControls } from '../time/zoom-controls';
import { type RefundsLabels, refundsLabels } from './labels';
import { DaySheet, DayTip, type KeyItem, StateOverlay, StaticKey, SummaryHead, useDayPointer } from './parts';
import { smoothBand, smoothPath } from './svg-paths';

export interface RefundsChartProps extends BaseChartProps {
  /** Result of `refundStats`. */
  readonly refunds: Refunds;
  readonly labels?: Partial<RefundsLabels>;
  /** Headline: what was kept of the turnover and how much was refunded. */
  readonly summary?: boolean;
  /** A shared time window (with other charts of the block). Without it the chart keeps its own. */
  readonly viewport?: Viewport;
  /** Zoom buttons over the chart. Default true. */
  readonly zoomControls?: boolean;
}

/** The window is never narrower than a week: fewer days turn into a couple of segments. */
const MIN_SPAN = 7 * DAY;
const TOP = 12;
const BOTTOM = 26;
const LEFT = 56;
const RIGHT = 10;
const DEFAULT_HEIGHT = 258;
const DEFAULT_UNIT = currencyUnit('USD');

/**
 * Revenue after refunds by day: the top curve is the day's turnover, the fill from zero is what
 * was kept, the band between them is what was refunded. A refund belongs to the day the money
 * went back; refunding more than was sold that day sends "kept" below zero. Wheel with ctrl or
 * pinch zooms, horizontal wheel and drag pan; the headline sums the whole period.
 */
export function RefundsChart({
  refunds: r,
  title,
  description,
  height = DEFAULT_HEIGHT,
  state,
  unit = DEFAULT_UNIT,
  formatValue,
  animate = true,
  className,
  labels: labelsProp,
  summary = true,
  viewport: external,
  zoomControls = true,
  'data-testid': testId,
}: RefundsChartProps) {
  const fmt = useFormat();
  const l = useMemo(() => ({ ...refundsLabels(fmt.locale), ...labelsProp }), [fmt.locale, labelsProp]);
  const [measure, size] = useElementSize<HTMLDivElement>();
  const width = size.width;
  const status = state?.status ?? 'ready';
  const skeleton = status === 'loading';
  const blocked = status === 'error' || status === 'empty' || status === 'no-access';
  const interactive = !skeleton && !blocked && r.days > 0;
  const gradId = useId().replace(/:/g, '');
  const plotH = Math.max(80, height - TOP - BOTTOM);
  const turnoverColor = seriesColor(4);
  const netColor = seriesColor(0);
  const refundColor = seriesColor(3);

  const extentEnd = r.start + Math.max(1, r.days - 1) * DAY;
  const extent = useMemo(() => ({ start: r.start, end: extentEnd }), [r.start, extentEnd]);
  const own = useViewport({ extent, minSpan: Math.min(MIN_SPAN, extentEnd - r.start) });
  const viewport = external ?? own;
  const view = useViewportCurrent(viewport);
  const target = useViewportTarget(viewport);

  // Visible days by the window we are heading to: the axis settles once, not every frame.
  const v0 = Math.max(0, Math.floor((target.start - r.start) / DAY));
  const v1 = Math.min(r.days - 1, Math.ceil((target.end - r.start) / DAY));
  const visSales = r.dailySales.slice(v0, v1 + 1);
  const visNet = r.dailyNet.slice(v0, v1 + 1);

  // Axis: from the lowest "kept" (may be below zero) to the turnover peak in the window.
  const hiTarget = niceCeil(Math.max(1, ...visSales) * 1.08);
  const minNet = Math.min(0, ...visNet);
  const loTarget = minNet < 0 ? -niceCeil(-minNet * 1.1, 2) : 0;
  const duration = animate ? 700 : 0;
  const [yHi, yLo] = useTweenedValues([hiTarget, loTarget], { duration, initial: [hiTarget, loTarget] });
  const flat = useMemo(() => [...r.dailySales, ...r.dailyNet], [r]);
  const shown = useTweenedValues(flat, { duration });
  const sSales = shown.slice(0, r.days);
  const sNet = shown.slice(r.days, r.days * 2);

  const plotW = Math.max(0, width - LEFT - RIGHT);
  const span = yHi - yLo || 1;
  const viewSpan = Math.max(1, view.end - view.start);
  const xOf = (i: number) => LEFT + (plotW * (r.start + i * DAY - view.start)) / viewSpan;
  const yOf = (value: number) => TOP + plotH - (plotH * (Math.min(yHi, Math.max(yLo, value)) - yLo)) / span;
  const svgH = TOP + plotH + BOTTOM;
  const xs = Array.from({ length: r.days }, (_, i) => xOf(i));

  const svgRef = useRef<SVGSVGElement | null>(null);
  const timeAtLocal = (x: number) => view.start + ((x - LEFT) / Math.max(1, plotW)) * viewSpan;
  const dayAtLocal = (x: number) => Math.min(r.days - 1, Math.max(0, Math.round((timeAtLocal(x) - r.start) / DAY)));
  const dayAt = (clientX: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    return dayAtLocal(rect ? clientX - rect.left : 0);
  };
  const ptr = useDayPointer<SVGSVGElement>({ enabled: interactive && width > 0, dayAt, first: v0, last: v1 });
  const { setSheet, setActive } = ptr;
  useEffect(() => setSheet(null), [r, setSheet]);

  // Wheel with ctrl / trackpad pinch / two fingers zoom; horizontal wheel and drag pan.
  const [stage, setStage] = useState<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState(false);
  useGestures(
    interactive ? stage : null,
    {
      onZoom: ({ factor, point, source }) => viewport.zoomAround(timeAtLocal(point.x), factor, { instant: source === 'pinch' }),
      onPan: ({ dx }) => {
        const cur = viewport.state.target;
        viewport.panBy((-dx / Math.max(1, plotW)) * (cur.end - cur.start), { instant: true });
      },
      onDragStart: () => {
        if (ptr.scrubbing) return;
        setDragging(true);
        setActive(null);
      },
      onDrag: ({ dx }) => {
        if (ptr.scrubbing) return;
        const cur = viewport.state.target;
        viewport.panBy((-dx / Math.max(1, plotW)) * (cur.end - cur.start), { instant: true });
      },
      onDragEnd: () => setDragging(false),
      // Pointer capture sends the tap to the stage, not the SVG: open the day sheet here.
      onTap: (point, event) => {
        if (event.pointerType === 'mouse' || !ptr.phone || ptr.swallowTap()) return;
        setSheet(dayAtLocal(point.x));
      },
    },
    { wheelZoom: false },
  );

  const v = (n: number) => (formatValue ? formatValue(n) : fmt.value(n, unit, true));
  const share = (x: number) => fmt.percent(x * 100, x < 0.1 ? 1 : 0);
  const dateOf = (i: number) => fmt.day(r.start + i * DAY);
  const hasRefunds = r.totalRefunded > 0;

  const dayRows = (i: number): TooltipRow[] => {
    const s = r.dailySales[i] ?? 0;
    const back = r.dailyRefunds[i] ?? 0;
    return [
      {
        id: 'n',
        label: l.dayNet,
        value: v(r.dailyNet[i] ?? 0),
        color: netColor,
        shape: 'square',
        note: l.netToDate(v(r.net[i] ?? 0)),
        strong: true,
      },
      { id: 't', label: l.dayTurnover, value: v(s), color: turnoverColor, shape: 'line' },
      {
        id: 'r',
        label: l.dayRefunds,
        value: back > 0 ? `−${v(back)}` : '—',
        color: refundColor,
        shape: 'square',
        note: back > 0 && s > 0 ? l.ofDay(share(back / s)) : undefined,
      },
    ];
  };

  const active = ptr.active;
  const tipOpen = (!ptr.phone || ptr.scrubbing) && interactive && !dragging && active !== null && width > 0;
  const heldDay = useHeldValue(active, tipOpen);

  const step = niceStep((hiTarget - loTarget) / 4);
  const ticks = [
    ...yTicks(yHi, step),
    ...yTicks(-yLo, step)
      .filter((t) => t > 0)
      .map((t) => -t),
  ];
  // Date labels by visible days, no denser than ~72 px.
  const shownDays = Math.max(1, viewSpan / DAY);
  const every = Math.max(1, Math.ceil(shownDays / Math.max(2, Math.floor(plotW / 72))));
  const firstTick = Math.max(0, Math.ceil((view.start - r.start) / DAY / every) * every);
  const xTicks: number[] = [];
  for (let i = firstTick; i < r.days && r.start + i * DAY <= view.end + 1; i += every) xTicks.push(i);
  const zero = yOf(0);
  const netY = sNet.map((n) => yOf(Math.max(0, n)));
  const salesY = sSales.map(yOf);

  const keyItems: KeyItem[] = [
    { id: 'turnover', label: l.turnover, color: turnoverColor, shape: 'line' },
    { id: 'net', label: l.net, color: netColor, shape: 'band' },
  ];
  if (hasRefunds) keyItems.push({ id: 'refunded', label: l.refunded, color: refundColor, shape: 'band' });

  const tableRows = Array.from({ length: r.days }, (_, i) => [dateOf(i), v(r.dailySales[i]), v(r.dailyRefunds[i]), v(r.dailyNet[i])]);
  const sheetDay = ptr.sheet;

  return (
    <div
      ref={measure}
      className={cx('vl-biz', 'vl-refunds', skeleton && 'vl-biz--loading', className)}
      data-testid={testId}
      data-blocked={blocked || undefined}
    >
      {summary && interactive ? (
        <SummaryHead
          big={v(r.totalNet)}
          captions={[l.left, l.ofSold(v(r.totalSold))]}
          line={hasRefunds ? <span className="vl-biz__lost">{l.refundedShare(v(r.totalRefunded), share(r.share))}</span> : l.noRefunds}
        />
      ) : null}
      {!skeleton && !blocked ? (
        <div className="vl-biz__bar">
          <StaticKey items={keyItems} />
          {zoomControls ? <ZoomControls viewport={viewport} labels={l} onInteract={() => setActive(null)} /> : null}
        </div>
      ) : null}
      <div className="vl-biz__plot">
        <div ref={setStage} className="vl-biz__stage vl-gesture-surface" aria-busy={skeleton || undefined}>
          {width > 0 && r.days > 0 ? (
            <svg
              ref={(node) => {
                svgRef.current = node;
                ptr.ref(node);
              }}
              className="vl-biz__svg vl-biz__scrub"
              width={width}
              height={svgH}
              viewBox={`0 0 ${width} ${svgH}`}
              role="img"
              aria-label={title}
              tabIndex={interactive ? 0 : -1}
              data-dragging={dragging || undefined}
              onKeyDown={(event) => {
                if (event.key === '+' || event.key === '=') viewport.zoomAround((target.start + target.end) / 2, 0.6);
                else if (event.key === '-') viewport.zoomAround((target.start + target.end) / 2, 1 / 0.6);
                else if (event.key === '0') viewport.setRange(viewport.extent);
                else ptr.onKeyDown(event);
              }}
              onBlur={() => setActive(null)}
              {...ptr.handlers}
            >
              <defs>
                <clipPath id={`${gradId}-plot`}>
                  <rect x={LEFT} y={0} width={plotW} height={TOP + plotH + 2} />
                </clipPath>
                <linearGradient id={`${gradId}-net`} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0" stopColor={netColor} stopOpacity="0.42" />
                  <stop offset="1" stopColor={netColor} stopOpacity="0.06" />
                </linearGradient>
              </defs>
              {ticks.map((t) => (
                <g key={t}>
                  <line x1={LEFT} x2={width - RIGHT} y1={yOf(t)} y2={yOf(t)} className="vl-biz__grid" />
                  {!skeleton ? (
                    <text x={LEFT - 8} y={yOf(t) + 4} textAnchor="end" className="vl-biz__axis">
                      {t < 0 ? `−${fmt.compact(-t)}` : fmt.compact(t)}
                    </text>
                  ) : null}
                </g>
              ))}
              {!skeleton
                ? xTicks.map((i) => (
                    <text key={i} x={xOf(i)} y={svgH - 6} textAnchor={i === 0 ? 'start' : 'middle'} className="vl-biz__axis">
                      {dateOf(i)}
                    </text>
                  ))
                : null}

              {!skeleton && !blocked ? (
                <g clipPath={`url(#${gradId}-plot)`}>
                  <path
                    d={`${smoothPath(xs, netY)} L ${xs[xs.length - 1].toFixed(1)} ${zero.toFixed(1)} L ${xs[0].toFixed(1)} ${zero.toFixed(1)} Z`}
                    fill={`url(#${gradId}-net)`}
                  />
                  {hasRefunds ? <path d={smoothBand(xs, sNet.map(yOf), salesY)} fill={refundColor} className="vl-refunds__gap" /> : null}
                  <path d={smoothPath(xs, salesY)} stroke={turnoverColor} className="vl-refunds__sold" />
                  {hasRefunds ? <path d={smoothPath(xs, sNet.map(yOf))} stroke={netColor} className="vl-refunds__net" /> : null}
                </g>
              ) : null}
              <line x1={LEFT} x2={width - RIGHT} y1={zero} y2={zero} className="vl-biz__base" />

              {active !== null && tipOpen ? (
                <g className="vl-biz__cursor">
                  <line x1={xOf(active)} x2={xOf(active)} y1={TOP} y2={TOP + plotH} />
                  <circle cx={xOf(active)} cy={yOf(r.dailySales[active] ?? 0)} r="3.5" fill={turnoverColor} />
                  <circle cx={xOf(active)} cy={yOf(r.dailyNet[active] ?? 0)} r="4" fill={netColor} />
                </g>
              ) : null}
            </svg>
          ) : null}
        </div>
        <ChartTooltip
          open={tipOpen}
          anchor={heldDay !== null ? { x: xOf(heldDay), y: yOf(r.dailySales[heldDay] ?? 0) } : null}
          bounds={{ width, height: svgH }}
          aria-label={title}
        >
          {heldDay !== null ? <DayTip title={dateOf(heldDay)} rows={dayRows(heldDay)} /> : null}
        </ChartTooltip>
        {state ? <StateOverlay state={state} /> : null}
      </div>
      <ChartDataTable
        caption={description ? `${title}. ${description}` : title}
        columns={[l.date, l.turnover, l.refunded, l.net]}
        rows={tableRows}
      />
      {ptr.phone && interactive ? (
        <DaySheet
          open={sheetDay !== null}
          onClose={() => setSheet(null)}
          title={sheetDay !== null ? dateOf(sheetDay) : ''}
          rows={sheetDay !== null ? dayRows(sheetDay) : []}
          color={netColor}
          closeLabel={l.close}
          prevLabel={l.prevDay}
          nextLabel={l.nextDay}
          onPrev={sheetDay !== null && sheetDay > 0 ? () => setSheet(sheetDay - 1) : null}
          onNext={sheetDay !== null && sheetDay < r.days - 1 ? () => setSheet(sheetDay + 1) : null}
          aria-label={title}
        />
      ) : null}
    </div>
  );
}
