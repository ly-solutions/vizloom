import { useMemo } from 'react';

import { cx, type BaseSparklineProps, useElementSize, useFormat } from '../../core';

export interface SparklineProps extends BaseSparklineProps {
  /** Mark the maximum with a dot. */
  readonly showPeak?: boolean;
  /** Ghost look for empty/placeholder data. */
  readonly ghost?: boolean;
  /** Bars: index of the highlighted bar. */
  readonly activeIndex?: number | null;
  /** Bars: click selects a bar (makes bars buttons for keyboard users too). */
  readonly onSelect?: (index: number) => void;
  /** Fixed y domain; default min(0, data)…max(data). */
  readonly domain?: readonly [number, number];
}

/**
 * Tiny trend chart for KPI tiles and table cells: line, area or bars. Width follows the
 * container unless `width` is set. Gaps (NaN) break the line. Announces min, max and last value.
 */
export function Sparkline({
  values,
  width: fixedWidth,
  height = 32,
  kind = 'line',
  color = 'var(--vl-accent)',
  showLast = true,
  showPeak = false,
  baseline,
  ghost = false,
  activeIndex = null,
  onSelect,
  domain,
  className,
  'aria-label': ariaLabel,
}: SparklineProps) {
  const format = useFormat();
  const [ref, size] = useElementSize<HTMLSpanElement>();
  const width = fixedWidth ?? Math.max(0, Math.floor(size.width));
  const n = values.length;
  const geom = useMemo(() => {
    let lo = Infinity;
    let hi = -Infinity;
    let peak = -1;
    let last = -1;
    for (let i = 0; i < n; i++) {
      const v = values[i];
      if (v !== v) continue;
      if (v < lo) lo = v;
      if (v > hi) {
        hi = v;
        peak = i;
      }
      last = i;
    }
    if (lo > hi) {
      lo = 0;
      hi = 1;
    }
    const d0 = domain ? domain[0] : Math.min(0, lo);
    const d1 = domain ? domain[1] : hi === d0 ? d0 + 1 : hi;
    const pad = kind === 'bars' ? 0 : 2;
    const y = (v: number) => pad + (1 - (v - d0) / (d1 - d0 || 1)) * (height - pad * 2);
    const x = (i: number) => (n <= 1 ? width / 2 : pad + (i / (n - 1)) * (width - pad * 2));
    let line = '';
    let area = '';
    let open = false;
    let segStart = 0;
    for (let i = 0; i < n; i++) {
      const v = values[i];
      if (v !== v) {
        if (open) area += `L${x(i - 1).toFixed(1)},${y(d0).toFixed(1)}L${x(segStart).toFixed(1)},${y(d0).toFixed(1)}Z`;
        open = false;
        continue;
      }
      const cmd = open ? 'L' : 'M';
      if (!open) segStart = i;
      line += `${cmd}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      area += `${cmd}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      open = true;
    }
    if (open) area += `L${x(n - 1).toFixed(1)},${y(d0).toFixed(1)}L${x(segStart).toFixed(1)},${y(d0).toFixed(1)}Z`;
    return { lo, hi, peak, last, x, y, line, area, d0 };
  }, [values, n, width, height, kind, domain]);

  const summary =
    ariaLabel ??
    (geom.last >= 0
      ? `min ${format.compact(geom.lo)}, max ${format.compact(geom.hi)}, last ${format.compact(values[geom.last])}`
      : format.locale.strings.noData);

  const bars = kind === 'bars' && width > 0 && n > 0;
  const bw = bars ? width / n : 0;
  return (
    <span
      ref={ref}
      className={cx('vl-sparkline', ghost && 'vl-sparkline--ghost', fixedWidth !== undefined && 'vl-sparkline--fixed', className)}
      role="img"
      aria-label={summary}
    >
      {width > 0 ? (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" focusable="false">
          {baseline !== undefined ? (
            <line className="vl-sparkline__baseline" x1={0} x2={width} y1={geom.y(baseline)} y2={geom.y(baseline)} />
          ) : null}
          {bars
            ? Array.from({ length: n }, (_, i) => {
                const v = values[i];
                if (v !== v) return null;
                const top = Math.min(geom.y(v), geom.y(geom.d0) - 1);
                return (
                  <rect
                    key={i}
                    className="vl-sparkline__bar"
                    data-active={activeIndex === i || undefined}
                    data-dim={activeIndex !== null && activeIndex !== i ? '' : undefined}
                    x={i * bw + bw * 0.12}
                    y={top}
                    width={Math.max(1, bw * 0.76)}
                    height={Math.max(1, geom.y(geom.d0) - top)}
                    rx={Math.min(2, bw * 0.2)}
                    fill={color}
                    onClick={onSelect ? () => onSelect(i) : undefined}
                  />
                );
              })
            : null}
          {!bars && kind === 'area' ? <path className="vl-sparkline__area" d={geom.area} fill={color} /> : null}
          {!bars ? <path className="vl-sparkline__line" d={geom.line} stroke={color} /> : null}
          {!bars && showPeak && geom.peak >= 0 ? (
            <circle className="vl-sparkline__peak" cx={geom.x(geom.peak)} cy={geom.y(values[geom.peak])} r={2.5} fill={color} />
          ) : null}
          {!bars && showLast && geom.last >= 0 ? (
            <circle className="vl-sparkline__last" cx={geom.x(geom.last)} cy={geom.y(values[geom.last])} r={2.5} fill={color} />
          ) : null}
        </svg>
      ) : null}
      {onSelect && bars ? (
        <span className="vl-sr-only">
          {Array.from({ length: n }, (_, i) => (
            <button key={i} type="button" onClick={() => onSelect(i)} aria-pressed={activeIndex === i}>
              {format.number(values[i])}
            </button>
          ))}
        </span>
      ) : null}
    </span>
  );
}
