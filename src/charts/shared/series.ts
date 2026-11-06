import { useCallback, useMemo, useState } from 'react';

import { type Series, seriesColor, useLatest } from '../../core';

/** Resolved colour of a series: explicit colour, else its palette slot, else its index. */
export function colorOf(series: Pick<Series, 'color' | 'slot'>, index: number): string {
  return series.color ?? seriesColor(series.slot ?? index);
}

export interface SeriesVisibility<Id extends string> {
  readonly hidden: ReadonlySet<Id>;
  readonly focus: Id | null;
  readonly setFocus: (id: Id | null) => void;
  /** Hide or show; never hides the last visible series — shows all instead. */
  readonly toggle: (id: Id) => void;
  /** Keep only this one; again — show all. */
  readonly solo: (id: Id) => void;
  readonly showAll: () => void;
}

/**
 * Hidden and focused series, controlled or not: pass `hidden`/`focus` with their change handlers
 * to own the state, or nothing to let the chart keep it.
 */
export function useSeriesVisibility<Id extends string>(
  ids: readonly Id[],
  options: {
    readonly hidden?: ReadonlySet<Id>;
    readonly onHiddenChange?: (hidden: ReadonlySet<Id>) => void;
    readonly focus?: Id | null;
    readonly onFocusChange?: (id: Id | null) => void;
    readonly initialHidden?: readonly Id[];
  } = {},
): SeriesVisibility<Id> {
  const [ownHidden, setOwnHidden] = useState<ReadonlySet<Id>>(() => new Set(options.initialHidden ?? []));
  const [ownFocus, setOwnFocus] = useState<Id | null>(null);
  const hidden = options.hidden ?? ownHidden;
  const focus = options.focus !== undefined ? options.focus : ownFocus;
  const latest = useLatest({ ids, hidden, options });

  const setHidden = useCallback(
    (next: ReadonlySet<Id>) => {
      const { options: o } = latest.current;
      if (!o.hidden) setOwnHidden(next);
      o.onHiddenChange?.(next);
    },
    [latest],
  );
  const setFocus = useCallback(
    (id: Id | null) => {
      const { options: o } = latest.current;
      if (o.focus === undefined) setOwnFocus(id);
      o.onFocusChange?.(id);
    },
    [latest],
  );
  const toggle = useCallback(
    (id: Id) => {
      const { ids: all, hidden: prev } = latest.current;
      const visible = all.filter((x) => !prev.has(x));
      if (!prev.has(id) && visible.length === 1) {
        setHidden(new Set());
        return;
      }
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setHidden(next);
    },
    [latest, setHidden],
  );
  const solo = useCallback(
    (id: Id) => {
      const { ids: all, hidden: prev } = latest.current;
      const only = all.every((x) => (x === id ? !prev.has(x) : prev.has(x)));
      setHidden(only ? new Set() : new Set(all.filter((x) => x !== id)));
    },
    [latest, setHidden],
  );
  const showAll = useCallback(() => setHidden(new Set()), [setHidden]);
  return useMemo(() => ({ hidden, focus, setFocus, toggle, solo, showAll }), [hidden, focus, setFocus, toggle, solo, showAll]);
}
