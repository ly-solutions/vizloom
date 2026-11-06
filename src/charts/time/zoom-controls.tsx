import { cx, useViewportTarget, type Viewport } from '../../core';

export interface ZoomControlsLabels {
  readonly zoomIn: string;
  readonly zoomOut: string;
  readonly resetZoom: string;
}

export interface ZoomControlsProps {
  readonly viewport: Viewport;
  /** "Whole period" button — appears once the window is narrower than the history. */
  readonly reset?: boolean;
  readonly disabled?: boolean;
  readonly labels: ZoomControlsLabels;
  /** A button was pressed — close a pinned tooltip, say. */
  readonly onInteract?: () => void;
  readonly className?: string;
}

export const ZOOM_IN_FACTOR = 0.6;
const ZOOM_OUT_FACTOR = 1 / ZOOM_IN_FACTOR;

function Icon({ d }: { readonly d: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="vl-zoom__icon">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Zoom buttons: for phones and for people who use neither the wheel nor pinch. */
export function ZoomControls({ viewport, reset = true, disabled = false, labels, onInteract, className }: ZoomControlsProps) {
  const target = useViewportTarget(viewport);
  const extent = viewport.extent;
  const full = target.end - target.start >= extent.end - extent.start - 1;
  const zoom = (factor: number) => {
    onInteract?.();
    viewport.zoomAround((target.start + target.end) / 2, factor);
  };
  return (
    <div className={cx('vl-zoom', className)} role="group" aria-label={labels.resetZoom}>
      {reset && !full ? (
        <button
          type="button"
          className="vl-zoom__button vl-zoom__button--reset"
          disabled={disabled}
          onClick={() => {
            onInteract?.();
            viewport.setRange(extent);
          }}
        >
          <Icon d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10" />
          <span>{labels.resetZoom}</span>
        </button>
      ) : null}
      <button
        type="button"
        className="vl-zoom__button"
        aria-label={labels.zoomOut}
        disabled={disabled || full}
        onClick={() => zoom(ZOOM_OUT_FACTOR)}
      >
        <Icon d="M3.5 8h9" />
      </button>
      <button type="button" className="vl-zoom__button" aria-label={labels.zoomIn} disabled={disabled} onClick={() => zoom(ZOOM_IN_FACTOR)}>
        <Icon d="M3.5 8h9M8 3.5v9" />
      </button>
    </div>
  );
}
