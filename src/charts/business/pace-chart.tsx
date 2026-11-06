import { useEffect, useId, useMemo, useRef } from 'react';

import {
  type BaseChartProps,
  ChartDataTable,
  ChartTooltip,
  cx,
  DAY,
  niceCeil,
  niceStep,
  seriesColor,
  type TooltipRow,
  UNIT_COUNT,
  useElementSize,
  useFormat,
  useTweenedValues,
  yTicks,
} from '../../core';
import { useHeldValue } from '../shared/hooks';
import { PACE_BASIS, type Pace } from '../model/pace';
import { type PaceLabels, paceLabels } from './labels';
import { DaySheet, DayTip, type KeyItem, StateOverlay, StaticKey, SummaryHead, type Tone, useDayPointer } from './parts';
import { bandPath, dayTicks, linePath } from './svg-paths';

export interface PaceChartProps extends BaseChartProps {
  /** Result of `paceStats`. */
  readonly pace: Pace;
  /** The daily sales that went into `paceStats`: "that day" in the tooltip. */
  readonly daily: readonly number[];
  readonly labels?: Partial<PaceLabels>;
  /** Headline over the chart: pace against the usual curve (or the plan) and the sell-out projection. */
  readonly summary?: boolean;
}

const TOP = 30;
const BOTTOM = 26;
const LEFT = 48;
const RIGHT = 10;
const DEFAULT_HEIGHT = 276;
/** Pace within ±5% reads as "as usual". */
const USUAL_BAND = 0.05;

/** Tone of the pace: faster, slower or as usual. */
export function paceTone(pace: number): Tone {
  if (!(pace === pace)) return 'flat';
  if (pace > 1 + USUAL_BAND) return 'up';
  if (pace < 1 - USUAL_BAND) return 'down';
  return 'flat';
}

/** Sell-out verdict: sold out, on track (date), off track (share by the event) or stalled. */
export function selloutVerdict(pace: Pace): {
  readonly kind: 'soldOut' | 'onTrack' | 'offTrack' | 'stalled' | 'none';
  readonly tone: Tone;
} {
  if (pace.target === null) return { kind: 'none', tone: 'flat' };
  if (pace.remaining === 0) return { kind: 'soldOut', tone: 'up' };
  if (pace.selloutDay !== null) return { kind: 'onTrack', tone: 'up' };
  if (pace.speed > 0) return { kind: 'offTrack', tone: 'down' };
  return { kind: 'stalled', tone: 'flat' };
}

/**
 * Sales pace: cumulative sales from the start of sales to the event against the usual curve of
 * past events (with its range) or an even plan, the forecast at the recent speed, the capacity
 * line and the sell-out projection. The headline answers the card's question — are we faster
 * or slower than usual, and will it sell out.
 */
export function PaceChart({
  pace,
  daily,
  title,
  description,
  height = DEFAULT_HEIGHT,
  state,
  unit = UNIT_COUNT,
  formatValue,
  animate = true,
  className,
  labels: labelsProp,
  summary = true,
  'data-testid': testId,
}: PaceChartProps) {
  const fmt = useFormat();
  const l = useMemo(() => ({ ...paceLabels(fmt.locale), ...labelsProp }), [fmt.locale, labelsProp]);
  const [measure, size] = useElementSize<HTMLDivElement>();
  const width = size.width;
  const status = state?.status ?? 'ready';
  const skeleton = status === 'loading';
  const blocked = status === 'error' || status === 'empty' || status === 'no-access';
  const interactive = !skeleton && !blocked;
  const gradId = useId().replace(/:/g, '');
  const plotH = Math.max(80, height - TOP - BOTTOM);

  const factColor = seriesColor(0);
  const typicalColor = seriesColor(5);

  const peak = Math.max(1, pace.sold, pace.projected, pace.target ?? 0, ...(pace.corridor?.high ?? []), ...(pace.typical ?? []));
  const yMaxTarget = niceCeil(peak * 1.06);
  const duration = animate ? 700 : 0;
  const yMax = useTweenedValues([yMaxTarget], { duration, initial: [yMaxTarget] })[0] || 1;

  // Every curve tweens as one vector: a unit or data change flows instead of jumping.
  const flat = useMemo(() => {
    const out = [...pace.cumulative, ...pace.forecast];
    if (pace.typical) out.push(...pace.typical);
    if (pace.corridor) out.push(...pace.corridor.low, ...pace.corridor.high);
    return out;
  }, [pace]);
  const shown = useTweenedValues(flat, { duration });
  let at = 0;
  const take = (n: number) => {
    const out = shown.slice(at, at + n);
    at += n;
    return out;
  };
  const sCum = take(pace.cumulative.length);
  const sFore = take(pace.forecast.length);
  const sTyp = take(pace.typical?.length ?? 0);
  const sLow = take(pace.corridor?.low.length ?? 0);
  const sHigh = take(pace.corridor?.high.length ?? 0);

  const plotW = Math.max(0, width - LEFT - RIGHT);
  const svgH = TOP + plotH + BOTTOM;
  const xOf = (day: number) => LEFT + (plotW * day) / pace.days;
  const yOf = (v: number) => TOP + plotH - (plotH * v) / yMax;
  const xsFrom = (from: number, n: number) => Array.from({ length: n }, (_, i) => xOf(from + i));

  const svgRef = useRef<SVGSVGElement | null>(null);
  const dayAt = (clientX: number) => {
    const r = svgRef.current?.getBoundingClientRect();
    if (!r) return 0;
    const day = Math.round(((clientX - r.left - LEFT) / Math.max(1, plotW)) * pace.days);
    return Math.min(pace.days, Math.max(0, day));
  };
  const ptr = useDayPointer<SVGSVGElement>({
    enabled: interactive && width > 0,
    dayAt,
    clampTap: (day) => Math.min(pace.elapsed, Math.max(1, day)),
    first: 0,
    last: pace.days,
  });
  const { setSheet } = ptr;
  useEffect(() => setSheet(null), [pace, setSheet]);

  const valueAt = (day: number): number => {
    if (day <= pace.elapsed) return pace.cumulative[day] ?? 0;
    return pace.forecast[day - pace.elapsed] ?? pace.projected;
  };
  const v = (n: number) => (formatValue ? formatValue(n) : fmt.value(n, unit, true));
  const share = (x: number) => fmt.percent(x * 100, 0);
  const dateOf = (day: number) => fmt.day(pace.start + day * DAY);

  const dayRows = (day: number): TooltipRow[] => {
    const rows: TooltipRow[] = [];
    if (day <= pace.elapsed) {
      rows.push({ id: 'c', label: l.soldToDate, value: v(pace.cumulative[day] ?? 0), color: factColor, shape: 'line' });
      const d = day > 0 ? daily[day - 1] : Number.NaN;
      rows.push({ id: 'd', label: l.perDay, value: d !== undefined && d === d ? `+${v(d)}` : '—' });
    } else {
      rows.push({
        id: 'c',
        label: l.forecastToDate,
        value: `~${v(pace.forecast[day - pace.elapsed] ?? pace.projected)}`,
        color: factColor,
        shape: 'dashed',
      });
      rows.push({ id: 'd', label: l.perDay, value: `~${v(pace.speed)}` });
    }
    const t = pace.typical?.[day];
    rows.push({
      id: 't',
      label: l.typicalToDate,
      value: t !== undefined ? v(t) : '—',
      color: pace.typical ? typicalColor : undefined,
      shape: 'line',
      note: pace.corridor ? l.corridorRange(fmt.compact(pace.corridor.low[day]), fmt.compact(pace.corridor.high[day])) : undefined,
    });
    return rows;
  };
  const tipTitle = (day: number) => {
    let mark = '';
    if (day === pace.elapsed) mark = ` · ${l.now}`;
    else if (day === pace.days) mark = ` · ${l.event}`;
    return `${dateOf(day)}${mark}`;
  };

  const active = ptr.active;
  const tipOpen = (!ptr.phone || ptr.scrubbing) && interactive && active !== null && width > 0;
  const heldDay = useHeldValue(active, tipOpen);

  // Headline: pace against the usual curve (or the plan) and what supports it.
  const tone = paceTone(pace.pace);
  const byPlan = pace.basis === PACE_BASIS.plan;
  let verdict = byPlan ? l.onPlan : l.usual;
  if (tone === 'up') verdict = byPlan ? l.aheadPlan : l.faster;
  else if (tone === 'down') verdict = byPlan ? l.behindPlan : l.slower;
  let line = l.noBasis;
  if (pace.basis === PACE_BASIS.typical) line = l.expectedTypical(v(Math.round(pace.expected)), v(pace.sold));
  else if (pace.basis === PACE_BASIS.plan) line = l.expectedPlan(v(Math.round(pace.expected)), v(pace.sold));
  if (pace.basis === PACE_BASIS.typical && !pace.corridor) line = `${line} · ${l.fewHistory}`;

  const sellout = selloutVerdict(pace);
  let selloutText = '';
  if (sellout.kind === 'soldOut') selloutText = l.soldOut;
  else if (sellout.kind === 'onTrack' && pace.selloutDay !== null)
    selloutText = l.onTrack(dateOf(Math.round(pace.selloutDay)), fmt.number(Math.max(0, Math.round(pace.days - pace.selloutDay))));
  else if (sellout.kind === 'offTrack' && pace.target !== null) selloutText = l.offTrack(share(Math.min(1, pace.projected / pace.target)));
  else if (sellout.kind === 'stalled') selloutText = l.stalled;

  const step = niceStep(yMaxTarget / 4);
  const ticks = yTicks(yMax, step);
  const xTicks = dayTicks(0, pace.days, plotW).filter((d) => d < pace.days - Math.max(1, pace.days / 10) * 0.4);

  const nowX = xOf(pace.elapsed);
  const eventX = xOf(pace.days);
  const factXs = xsFrom(0, sCum.length);
  const foreXs = xsFrom(pace.elapsed, sFore.length);
  const typXs = xsFrom(0, sTyp.length);
  const sellX = pace.selloutDay !== null && pace.target !== null ? xOf(pace.selloutDay) : null;

  const keyItems: KeyItem[] = [
    { id: 'fact', label: l.fact, color: factColor, shape: 'line' },
    { id: 'forecast', label: l.forecast, color: factColor, shape: 'dashed' },
  ];
  if (pace.typical) keyItems.push({ id: 'typical', label: l.typical, color: typicalColor, shape: 'line' });
  if (pace.corridor) keyItems.push({ id: 'corridor', label: l.corridor, color: typicalColor, shape: 'band' });

  const tableRows = Array.from({ length: pace.days + 1 }, (_, day) => [
    dateOf(day),
    day <= pace.elapsed ? v(pace.cumulative[day] ?? 0) : '',
    day >= pace.elapsed ? v(pace.forecast[day - pace.elapsed] ?? pace.projected) : '',
    pace.typical ? v(pace.typical[day]) : '',
  ]);

  const sheetDay = ptr.sheet;
  const showSummary = summary && interactive;

  return (
    <div
      ref={measure}
      className={cx('vl-biz', 'vl-pace', skeleton && 'vl-biz--loading', className)}
      data-testid={testId}
      data-blocked={blocked || undefined}
    >
      {showSummary && pace.basis === PACE_BASIS.none ? <SummaryHead big={v(pace.sold)} line={selloutText || line} /> : null}
      {showSummary && pace.basis !== PACE_BASIS.none ? (
        <SummaryHead
          big={share(pace.pace)}
          captions={[pace.basis === PACE_BASIS.typical ? l.ofTypical : l.ofPlan]}
          tone={tone}
          verdict={verdict}
          line={
            <>
              <span>{line}</span>
              {selloutText ? (
                <span className="vl-biz__sellout" data-tone={sellout.tone}>
                  {selloutText}
                </span>
              ) : null}
            </>
          }
        />
      ) : null}
      {!skeleton && !blocked ? <StaticKey items={keyItems} /> : null}
      <div className="vl-biz__plot">
        <div className="vl-biz__stage" aria-busy={skeleton || undefined}>
          {width > 0 ? (
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
              onKeyDown={ptr.onKeyDown}
              onBlur={() => ptr.setActive(null)}
              {...ptr.handlers}
            >
              <defs>
                <linearGradient id={`${gradId}-fact`} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0" stopColor={factColor} stopOpacity="0.32" />
                  <stop offset="1" stopColor={factColor} stopOpacity="0" />
                </linearGradient>
              </defs>
              <line x1={LEFT} x2={width - RIGHT} y1={yOf(0)} y2={yOf(0)} className="vl-biz__base" />
              {ticks.map((t) => (
                <g key={t}>
                  <line x1={LEFT} x2={width - RIGHT} y1={yOf(t)} y2={yOf(t)} className="vl-biz__grid" />
                  {!skeleton ? (
                    <text x={LEFT - 8} y={yOf(t) + 4} textAnchor="end" className="vl-biz__axis">
                      {fmt.compact(t)}
                    </text>
                  ) : null}
                </g>
              ))}
              {!skeleton
                ? [...xTicks, pace.days].map((d) => (
                    <text key={d} x={xOf(d)} y={svgH - 6} textAnchor={d === pace.days ? 'end' : 'middle'} className="vl-biz__axis">
                      {dateOf(d)}
                    </text>
                  ))
                : null}

              {/* The future is a shade darker: only expectations live there. */}
              <rect x={nowX} y={TOP} width={Math.max(0, eventX - nowX)} height={plotH} className="vl-biz__future" />

              {!skeleton && !blocked && sTyp.length > 0 && sHigh.length > 0 ? (
                <path d={bandPath(typXs, sLow.map(yOf), sHigh.map(yOf))} fill={typicalColor} className="vl-pace__band" />
              ) : null}
              {!skeleton && !blocked && sTyp.length > 0 ? (
                <path d={linePath(typXs, sTyp.map(yOf))} stroke={typicalColor} className="vl-pace__typical" />
              ) : null}

              {pace.target !== null && !skeleton && !blocked ? (
                <g>
                  <line x1={LEFT} x2={width - RIGHT} y1={yOf(pace.target)} y2={yOf(pace.target)} className="vl-pace__capacity" />
                  <text x={width - RIGHT - 4} y={yOf(pace.target) - 6} textAnchor="end" className="vl-biz__note">
                    {l.capacity(fmt.number(pace.target))}
                  </text>
                </g>
              ) : null}

              {!skeleton && !blocked && sCum.length > 0 ? (
                <>
                  <path
                    d={`${linePath(factXs, sCum.map(yOf))} L ${factXs[factXs.length - 1].toFixed(1)} ${yOf(0)} L ${LEFT} ${yOf(0)} Z`}
                    fill={`url(#${gradId}-fact)`}
                    className="vl-pace__area"
                  />
                  <path d={linePath(factXs, sCum.map(yOf))} stroke={factColor} className="vl-pace__fact" />
                </>
              ) : null}
              {!skeleton && !blocked && sFore.length > 1 ? (
                <path d={linePath(foreXs, sFore.map(yOf))} stroke={factColor} className="vl-pace__forecast" />
              ) : null}

              {!skeleton && !blocked ? (
                <>
                  <line x1={nowX} x2={nowX} y1={TOP - 6} y2={yOf(0)} className="vl-biz__now" />
                  <text x={nowX} y={TOP - 12} textAnchor={nowX > width - 90 ? 'end' : 'middle'} className="vl-biz__mark">
                    {l.now}
                  </text>
                  <line x1={eventX} x2={eventX} y1={TOP - 6} y2={yOf(0)} className="vl-pace__event" />
                  {eventX - nowX > 120 ? (
                    <text x={eventX} y={TOP - 12} textAnchor="end" className="vl-biz__mark vl-pace__event-label">
                      {l.event}
                    </text>
                  ) : null}
                  {nowX - LEFT > 80 ? (
                    <text x={LEFT} y={TOP - 12} className="vl-biz__mark">
                      {l.start}
                    </text>
                  ) : null}
                  <circle cx={nowX} cy={yOf(sCum[sCum.length - 1] ?? 0)} r="4" fill={factColor} className="vl-biz__dot" />
                  {sellX !== null && pace.target !== null && pace.selloutDay !== null && pace.selloutDay > pace.elapsed ? (
                    <g>
                      <circle cx={sellX} cy={yOf(pace.target)} r="3.5" fill={factColor} className="vl-biz__dot" />
                      <text
                        x={Math.min(sellX, width - RIGHT - 4)}
                        y={yOf(pace.target) + 16}
                        textAnchor={sellX > width - 120 ? 'end' : 'middle'}
                        className="vl-biz__note"
                      >
                        {l.sellout(dateOf(Math.round(pace.selloutDay)))}
                      </text>
                    </g>
                  ) : null}
                </>
              ) : null}

              {active !== null && tipOpen ? (
                <g className="vl-biz__cursor">
                  <line x1={xOf(active)} x2={xOf(active)} y1={TOP} y2={yOf(0)} />
                  <circle cx={xOf(active)} cy={yOf(valueAt(active))} r="4" fill={factColor} />
                  {pace.typical?.[active] !== undefined ? (
                    <circle cx={xOf(active)} cy={yOf(pace.typical[active])} r="3.5" fill={typicalColor} />
                  ) : null}
                </g>
              ) : null}
            </svg>
          ) : null}
        </div>
        <ChartTooltip
          open={tipOpen}
          anchor={heldDay !== null ? { x: xOf(heldDay), y: yOf(valueAt(heldDay)) } : null}
          bounds={{ width, height: svgH }}
          aria-label={title}
        >
          {heldDay !== null ? <DayTip title={tipTitle(heldDay)} rows={dayRows(heldDay)} /> : null}
        </ChartTooltip>
        {state ? <StateOverlay state={state} /> : null}
      </div>
      <ChartDataTable
        caption={description ? `${title}. ${description}` : title}
        columns={[l.date, l.fact, l.forecast, l.typical]}
        rows={tableRows}
      />
      {ptr.phone && interactive ? (
        <DaySheet
          open={sheetDay !== null}
          onClose={() => setSheet(null)}
          title={sheetDay !== null ? dateOf(sheetDay) : ''}
          subtitle={sheetDay !== null ? l.dayOf(sheetDay, pace.days) : undefined}
          rows={sheetDay !== null ? dayRows(sheetDay) : []}
          color={factColor}
          closeLabel={l.close}
          prevLabel={l.prevDay}
          nextLabel={l.nextDay}
          onPrev={sheetDay !== null && sheetDay > 1 ? () => setSheet(sheetDay - 1) : null}
          onNext={sheetDay !== null && sheetDay < pace.elapsed ? () => setSheet(sheetDay + 1) : null}
          aria-label={title}
        />
      ) : null}
    </div>
  );
}
