/**
 * Placement of a tooltip inside a chart container (no portal): beside the anchor point,
 * flipped to the other side when it does not fit, clamped to the container. On narrow
 * containers (phones) it docks above the plot so it never covers the finger.
 */

export interface ChartTooltipInput {
  /** Anchor in container coordinates, px. `width` — a band (bar) the bubble must not cover. */
  readonly anchor: { readonly x: number; readonly y: number; readonly width?: number };
  readonly size: { readonly width: number; readonly height: number };
  readonly bounds: { readonly width: number; readonly height: number };
  /** Preferred side. `auto`: right of the anchor, left near the right edge. */
  readonly prefer?: 'auto' | 'top' | 'bottom' | 'left' | 'right';
  readonly gap?: number;
  /** Container width below which the tooltip docks to the top edge. */
  readonly dockBelow?: number;
}

export interface ChartTooltipPosition {
  readonly x: number;
  readonly y: number;
  readonly side: 'top' | 'bottom' | 'left' | 'right' | 'dock';
}

const clampTo = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function placeChartTooltip({
  anchor,
  size,
  bounds,
  prefer = 'auto',
  gap = 12,
  dockBelow = 0,
}: ChartTooltipInput): ChartTooltipPosition {
  const half = (anchor.width ?? 0) / 2;
  const maxX = Math.max(0, bounds.width - size.width);
  const maxY = Math.max(0, bounds.height - size.height);
  if (bounds.width < dockBelow) {
    return { x: clampTo(anchor.x - size.width / 2, 0, maxX), y: -size.height - gap / 2, side: 'dock' };
  }
  const right = anchor.x + half + gap;
  const left = anchor.x - half - gap - size.width;
  const top = anchor.y - gap - size.height;
  const bottom = anchor.y + gap;
  const midY = clampTo(anchor.y - size.height / 2, 0, maxY);
  const midX = clampTo(anchor.x - size.width / 2, 0, maxX);
  const fitsRight = right + size.width <= bounds.width;
  const fitsLeft = left >= 0;
  switch (prefer) {
    case 'top':
      return top >= 0 ? { x: midX, y: top, side: 'top' } : { x: midX, y: clampTo(bottom, 0, maxY), side: 'bottom' };
    case 'bottom':
      return bottom + size.height <= bounds.height
        ? { x: midX, y: bottom, side: 'bottom' }
        : { x: midX, y: clampTo(top, 0, maxY), side: 'top' };
    case 'left':
      return fitsLeft ? { x: left, y: midY, side: 'left' } : { x: clampTo(right, 0, maxX), y: midY, side: 'right' };
    default:
      if (fitsRight) return { x: right, y: midY, side: 'right' };
      if (fitsLeft) return { x: left, y: midY, side: 'left' };
      return top >= 0 ? { x: midX, y: top, side: 'top' } : { x: midX, y: clampTo(bottom, 0, maxY), side: 'bottom' };
  }
}
