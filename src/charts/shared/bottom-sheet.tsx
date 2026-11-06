import { type ReactNode, useEffect, useRef, useState } from 'react';

import { cx, useIsomorphicLayoutEffect } from '../../core';

export interface BottomSheetProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly children: ReactNode;
  /** Accessible name of the close button and the dialog. */
  readonly closeLabel?: string;
  readonly 'aria-label'?: string;
  readonly className?: string;
}

/** Drag the sheet down by this share of its height to close it. */
const CLOSE_SHARE = 0.28;
const EXIT_MS = 220;

/**
 * Bottom sheet for summaries on phones: as tall as its content, closes with a swipe down, a tap
 * on the backdrop or Escape. Keeps its content while sliding out.
 */
export function BottomSheet({ open, onClose, children, closeLabel = 'Close', 'aria-label': ariaLabel, className }: BottomSheetProps) {
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  const held = useRef<ReactNode>(children);
  if (open) held.current = children;
  const panel = useRef<HTMLDivElement | null>(null);
  const latest = useRef(onClose);
  latest.current = onClose;

  useEffect(() => {
    if (open) {
      setMounted(true);
      setClosing(false);
      return;
    }
    if (!mounted) return;
    setClosing(true);
    const t = setTimeout(() => {
      setMounted(false);
      setClosing(false);
    }, EXIT_MS);
    return () => clearTimeout(t);
  }, [open, mounted]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') latest.current();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  useIsomorphicLayoutEffect(() => {
    if (open) panel.current?.focus({ preventScroll: true });
  }, [open]);

  // Swipe down to close: the panel follows the finger, then either closes or springs back.
  useEffect(() => {
    const el = panel.current;
    if (!el || !mounted) return;
    let startY = 0;
    let dy = 0;
    let tracking = false;
    const onStart = (e: TouchEvent) => {
      // Inner scroll areas keep their own gesture until scrolled to the top.
      const scroller = (e.target as Element | null)?.closest?.('[data-sheet-scroll]');
      if (scroller && scroller.scrollTop > 0) return;
      tracking = true;
      startY = e.touches[0].clientY;
      dy = 0;
      el.dataset['dragging'] = 'true';
    };
    const onMove = (e: TouchEvent) => {
      if (!tracking) return;
      dy = Math.max(0, e.touches[0].clientY - startY);
      el.style.setProperty('--vl-sheet-drag', `${dy}px`);
      if (dy > 0 && e.cancelable) e.preventDefault();
    };
    const onEnd = () => {
      if (!tracking) return;
      tracking = false;
      delete el.dataset['dragging'];
      el.style.removeProperty('--vl-sheet-drag');
      if (dy > el.offsetHeight * CLOSE_SHARE) latest.current();
    };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, [mounted]);

  if (!mounted) return null;
  return (
    <div className={cx('vl-sheet', closing && 'vl-sheet--closing', className)}>
      <div className="vl-sheet__backdrop" onClick={onClose} aria-hidden="true" />
      <div ref={panel} className="vl-sheet__panel" role="dialog" aria-modal="true" aria-label={ariaLabel} tabIndex={-1}>
        <div className="vl-sheet__handle" aria-hidden="true" />
        <button type="button" className="vl-sheet__close" aria-label={closeLabel} onClick={onClose}>
          <svg viewBox="0 0 12 12" aria-hidden="true">
            <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
        <div className="vl-sheet__body" data-sheet-scroll="">
          {held.current}
        </div>
      </div>
    </div>
  );
}
