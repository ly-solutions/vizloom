/** Easing, reduced-motion and a frame-loop tween shared by every animated component. */

export type Easing = (t: number) => number;

export const easing = {
  linear: (t: number) => t,
  outCubic: (t: number) => 1 - (1 - t) ** 3,
  inOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  outQuint: (t: number) => 1 - (1 - t) ** 5,
  outBack: (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
  },
} as const satisfies Record<string, Easing>;

/** Standard durations, ms. Mirrored by `--vl-duration-*` in CSS. */
export const DURATION = { fast: 150, base: 250, slow: 450, data: 700 } as const;

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export interface TweenOptions {
  readonly duration?: number;
  readonly easing?: Easing;
  readonly onUpdate: (t: number) => void;
  readonly onDone?: () => void;
}

/**
 * Runs `onUpdate(progress)` every frame for `duration` ms. Reduced motion or no rAF (SSR, tests)
 * jumps straight to the end. Returns a cancel function.
 */
export function tween({ duration = DURATION.data, easing: ease = easing.outCubic, onUpdate, onDone }: TweenOptions): () => void {
  if (duration <= 0 || prefersReducedMotion() || typeof requestAnimationFrame !== 'function') {
    onUpdate(1);
    onDone?.();
    return () => undefined;
  }
  const started = performance.now();
  let frame = requestAnimationFrame(function tick(now) {
    const u = Math.min(1, (now - started) / duration);
    onUpdate(ease(u));
    if (u < 1) frame = requestAnimationFrame(tick);
    else onDone?.();
  });
  return () => cancelAnimationFrame(frame);
}

/** Interpolates two numeric arrays of possibly different length (new points grow from `fill`). */
export function interpolateArrays(from: ArrayLike<number>, to: ArrayLike<number>, t: number, fill = 0): number[] {
  const out = new Array<number>(to.length);
  for (let i = 0; i < to.length; i++) {
    const a = i < from.length && Number.isFinite(from[i]) ? from[i] : fill;
    const b = to[i];
    out[i] = Number.isFinite(b) ? a + (b - a) * t : b;
  }
  return out;
}

/**
 * Coalesces calls into one per animation frame: pointer moves, resize, live ticks. The last
 * arguments win.
 */
export function rafThrottle<A extends unknown[]>(fn: (...args: A) => void): ((...args: A) => void) & { cancel(): void } {
  let frame = 0;
  let last: A | null = null;
  const run = (...args: A) => {
    last = args;
    if (frame) return;
    if (typeof requestAnimationFrame !== 'function') {
      fn(...args);
      return;
    }
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (last) fn(...last);
    });
  };
  run.cancel = () => {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
  };
  return run;
}
