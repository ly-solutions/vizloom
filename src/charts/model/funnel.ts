import type { ColorSlot } from '../../core';

/** Funnel step: how many people reached it. `NaN` — the step was not tracked. */
export interface FunnelStep<Id extends string = string> {
  readonly id: Id;
  readonly label: string;
  readonly value: number;
  /** Palette slot. Defaults to the step number. */
  readonly slot?: ColorSlot;
}

/** Step with computed conversion. Shares are 0 to 1, `NaN` — cannot be computed. */
export interface FunnelRow<Id extends string = string> extends FunnelStep<Id> {
  readonly index: number;
  /** Step data is present. A zero mid-funnel with live later steps is a collection gap, not "nobody". */
  readonly known: boolean;
  /** Share of the first step. */
  readonly fromStart: number;
  /** Share of the last known step before this one. */
  readonly fromPrevious: number;
  /** How many dropped off since the previous known step; `NaN` — unknown, or the step is larger than the previous one. */
  readonly lost: number;
  /** The step is larger than the previous one: it is skipped (people arrive via a direct link), conversion is not computed. */
  readonly skipped: boolean;
  /** Index of the last known step before this one; `-1` — it is the first. */
  readonly previous: number;
}

export interface FunnelStats<Id extends string = string> {
  readonly rows: readonly FunnelRow<Id>[];
  /** First known step — the base of percentages. */
  readonly start: number;
  /** Last known step. */
  readonly end: number;
  /** Whole-funnel conversion: last known step to the first. */
  readonly total: number;
  /** Step with the biggest drop-off (by share lost); `-1` — no drop-off. */
  readonly worstDrop: number;
  /** Largest value among steps — the drawing scale. */
  readonly max: number;
}

export interface FunnelStatsOptions {
  /**
   * Zero mid-funnel while later steps have people is a data collection gap (the event was
   * never sent), not "nobody got here". Defaults to true.
   */
  readonly zeroIsGap?: boolean;
}

/**
 * Per-step conversion. An unknown step is skipped: the next step's percentages are based on the last
 * known one. A step larger than the previous is not shown as "100%" — it is flagged `skipped`.
 */
export function funnelStats<Id extends string>(steps: readonly FunnelStep<Id>[], options: FunnelStatsOptions = {}): FunnelStats<Id> {
  const zeroIsGap = options.zeroIsGap ?? true;
  const known = steps.map((step, i) => {
    if (!Number.isFinite(step.value) || step.value < 0) return false;
    if (step.value === 0 && zeroIsGap && i > 0) return !steps.slice(i + 1).some((next) => next.value > 0);
    return true;
  });
  const start = known.indexOf(true);
  const base = start >= 0 ? steps[start].value : Number.NaN;
  let previous = -1;
  let worstDrop = -1;
  let worstShare = 0;
  let max = 0;
  const rows = steps.map((step, index): FunnelRow<Id> => {
    const isKnown = known[index];
    const prev = previous;
    const prevValue = prev >= 0 ? steps[prev].value : Number.NaN;
    let fromPrevious = Number.NaN;
    let lost = Number.NaN;
    let skipped = false;
    if (isKnown && prev >= 0) {
      if (step.value > prevValue) skipped = true;
      else {
        lost = prevValue - step.value;
        fromPrevious = prevValue > 0 ? step.value / prevValue : Number.NaN;
        const share = prevValue > 0 ? lost / prevValue : 0;
        if (share > worstShare) {
          worstShare = share;
          worstDrop = index;
        }
      }
    }
    if (isKnown) {
      previous = index;
      if (step.value > max) max = step.value;
    }
    return {
      ...step,
      index,
      known: isKnown,
      fromStart: isKnown && base > 0 ? step.value / base : Number.NaN,
      fromPrevious,
      lost,
      skipped,
      previous: prev,
    };
  });
  const end = previous;
  return {
    rows,
    start,
    end,
    total: start >= 0 && end > start && base > 0 ? steps[end].value / base : Number.NaN,
    worstDrop,
    max,
  };
}
