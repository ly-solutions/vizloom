import { DAY } from '../../../core';
import type { TimeMarker, MarkerPriority } from '../../../core';

export interface MarkerSlot {
  readonly visible: boolean;
  /** Neighbours hidden behind this marker ("+2"). */
  readonly hidden: number;
  /** Ids of the hidden neighbours, in time order. */
  readonly members: readonly string[];
}

export interface MarkerLayoutOptions {
  /** Pixels per day at the current scale. */
  readonly pxPerDay: number;
  /** Minimum gap between markers, pixels. */
  readonly minGap: number;
  /** The focused marker is always visible. */
  readonly focusId?: string | null;
  /** Scale (px/day) from which priorities 2 and 3 are revealed. */
  readonly reveal?: Readonly<Record<2 | 3, number>>;
}

const DEFAULT_REVEAL = { 2: 30, 3: 70 } as const;

/** The lowest priority visible at scale `pxPerDay`. */
export function visiblePriority(pxPerDay: number, reveal: Readonly<Record<2 | 3, number>> = DEFAULT_REVEAL): MarkerPriority {
  if (pxPerDay >= reveal[3]) return 3;
  if (pxPerDay >= reveal[2]) return 2;
  return 1;
}

/**
 * Which markers to show: zoomed out — only the main ones, zooming in reveals
 * secondary ones. Neighbors closer than `minGap` hide behind a visible marker, which counts "+N".
 */
export function layoutMarkers(
  markers: readonly TimeMarker[],
  xOf: (t: number) => number,
  options: MarkerLayoutOptions,
): Map<string, MarkerSlot> {
  const level = visiblePriority(options.pxPerDay, options.reveal);
  const focus = options.focusId ?? null;
  const slots = new Map<string, { visible: boolean; hidden: number; members: string[] }>(
    markers.map((m) => [m.id, { visible: false, hidden: 0, members: [] }]),
  );
  const candidates = markers
    .filter((m) => (m.priority ?? 1) <= level || m.id === focus)
    .sort((a, b) => Number(b.id === focus) - Number(a.id === focus) || (a.priority ?? 1) - (b.priority ?? 1) || a.t - b.t);
  const placed: { id: string; x: number }[] = [];
  for (const m of candidates) {
    const x = xOf(m.t);
    const near = placed.find((p) => Math.abs(p.x - x) < options.minGap);
    const slot = near ? slots.get(near.id) : undefined;
    if (slot) {
      slot.hidden++;
      slot.members.push(m.id);
    }
    if (!slot) {
      placed.push({ id: m.id, x });
      const own = slots.get(m.id);
      if (own) own.visible = true;
    }
  }
  return slots;
}

/** Pixels per day for a window of `spanMs` and width `widthPx`. */
export function pxPerDay(spanMs: number, widthPx: number): number {
  return (widthPx * DAY) / Math.max(spanMs, 1);
}
