import { useEffect, useState } from 'react';

import { cx, Pulse, useFormat } from '../core';

export interface LiveIndicatorProps {
  /** Last update moment (ms). Changes fire a pulse. */
  readonly updatedAt: number;
  /** Paused / offline. */
  readonly paused?: boolean;
  /** Re-render period of the relative time, ms. */
  readonly tick?: number;
  readonly className?: string;
}

/** "● Live · updated 12 s ago" — pulses on each update. */
export function LiveIndicator({ updatedAt, paused = false, tick = 15_000, className }: LiveIndicatorProps) {
  const format = useFormat();
  const [now, setNow] = useState(() => updatedAt);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), tick);
    return () => clearInterval(t);
  }, [tick, updatedAt]);
  const s = format.locale.strings;
  return (
    <span className={cx('vl-live', paused && 'vl-live--paused', className)}>
      <Pulse trigger={updatedAt} tone={paused ? 'accent' : 'positive'} />
      <span className="vl-live__label">{s.live}</span>
      <span className="vl-live__time">· {format.relative(Math.min(updatedAt, now), Math.max(now, updatedAt))}</span>
    </span>
  );
}

/**
 * Simulated live stream for demos and stories: calls `onTick` every `min…max` ms with a random
 * increment. Returns a stop function. Deterministic when `seed` is given.
 */
export function startLiveSimulation(
  onTick: (increment: number, at: number) => void,
  { min = 1500, max = 4000, seed = 1 } = {},
): () => void {
  let state = seed;
  const rand = () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
  let timer: ReturnType<typeof setTimeout>;
  const next = () => {
    timer = setTimeout(
      () => {
        onTick(1 + Math.floor(rand() * 4), Date.now());
        next();
      },
      min + rand() * (max - min),
    );
  };
  next();
  return () => clearTimeout(timer);
}
