import { compareColor, DAY, type SeriesFrame, seriesColor } from '../core';

/**
 * Comparison mode: several series-events on one axis, aligned by calendar date or by
 * "days before the event". The primary series keeps its palette colour and a solid line;
 * comparisons take the muted compare palette and a dashed line, so the primary reads first.
 */

export interface CompareInput<Id extends string = string> {
  readonly id: Id;
  readonly label: string;
  /** Values over equal buckets. */
  readonly frame: SeriesFrame<'value'>;
  /** Event moment, required for `days-before`. */
  readonly event?: number;
  readonly role?: 'primary' | 'compare';
}

export interface AlignedSeries<Id extends string = string> {
  readonly id: Id;
  readonly label: string;
  readonly role: 'primary' | 'compare';
  readonly color: string;
  readonly dashed: boolean;
  /** x positions: ms timestamps (`date`) or days before the event, negative = before (`days-before`). */
  readonly xs: Float64Array;
  readonly values: Float64Array;
}

export type CompareAlignment = 'date' | 'days-before';

/** Aligns comparison series. For `days-before`, x = (t − event) / day (−30 … 0). */
export function alignComparison<Id extends string>(inputs: readonly CompareInput<Id>[], align: CompareAlignment): AlignedSeries<Id>[] {
  let compareIndex = 0;
  let primaryIndex = 0;
  return inputs.map((input) => {
    const role = input.role ?? (primaryIndex === 0 && compareIndex === 0 ? 'primary' : 'compare');
    const color = role === 'primary' ? seriesColor(primaryIndex++) : compareColor(compareIndex++);
    const { start, step, length } = input.frame;
    const xs = new Float64Array(length);
    const values = new Float64Array(length);
    const src = input.frame.values.value;
    const origin = align === 'days-before' ? (input.event ?? start + length * step) : 0;
    for (let i = 0; i < length; i++) {
      const t = start + i * step;
      xs[i] = align === 'days-before' ? (t - origin) / DAY : t;
      values[i] = src[i];
    }
    return { id: input.id, label: input.label, role, color, dashed: role === 'compare', xs, values };
  });
}

/** Cumulative running total (comparisons of sales curves are usually cumulative). */
export function cumulative(values: ArrayLike<number>): Float64Array {
  const out = new Float64Array(values.length);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v === v) sum += v;
    out[i] = v === v ? sum : Number.NaN;
  }
  return out;
}

/** Value of each series at the same aligned x (nearest bucket), for a comparison tooltip. */
export function valuesAt<Id extends string>(
  series: readonly AlignedSeries<Id>[],
  x: number,
): { id: Id; label: string; color: string; value: number }[] {
  return series.map((s) => {
    let best = -1;
    let dist = Infinity;
    for (let i = 0; i < s.xs.length; i++) {
      const d = Math.abs(s.xs[i] - x);
      if (d < dist) {
        dist = d;
        best = i;
      }
    }
    return { id: s.id, label: s.label, color: s.color, value: best >= 0 ? s.values[best] : Number.NaN };
  });
}
