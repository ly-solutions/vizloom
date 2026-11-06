import { type HTMLAttributes, type ReactNode } from 'react';

import { cx } from './cx';

export interface SwatchProps {
  /** Any CSS colour, including `var(--vl-cat-2)`. */
  readonly color: string;
  /** `line` — a short dash (line charts), `dot` — a dot, `square` — bars and areas, `dashed` — comparison series. */
  readonly shape?: 'dot' | 'line' | 'square' | 'dashed';
  /** Hidden series: hollow outline instead of fill. */
  readonly off?: boolean;
  readonly className?: string;
}

/** Colour key of a series. The colour is an SVG attribute, so any number of series needs no classes. */
export function Swatch({ color, shape = 'dot', off = false, className }: SwatchProps) {
  if (shape === 'line' || shape === 'dashed') {
    return (
      <svg className={cx('vl-swatch', 'vl-swatch--line', className)} viewBox="0 0 14 6" aria-hidden="true">
        {shape === 'dashed' ? (
          <line
            x1="1"
            y1="3"
            x2="13"
            y2="3"
            stroke={color}
            strokeWidth="2"
            strokeDasharray="3 2"
            strokeLinecap="round"
            opacity={off ? 0.4 : 1}
          />
        ) : (
          <rect x="1" y="1.5" width="12" height="3" rx="1.5" fill={off ? 'transparent' : color} stroke={color} strokeWidth={off ? 1 : 0} />
        )}
      </svg>
    );
  }
  if (shape === 'square') {
    return (
      <svg className={cx('vl-swatch', className)} viewBox="0 0 10 10" aria-hidden="true">
        <rect x="1" y="1" width="8" height="8" rx="2" fill={off ? 'transparent' : color} stroke={color} strokeWidth="1.5" />
      </svg>
    );
  }
  return (
    <svg className={cx('vl-swatch', className)} viewBox="0 0 10 10" aria-hidden="true">
      <circle cx="5" cy="5" r="4" fill={off ? 'transparent' : color} stroke={color} strokeWidth="1.5" />
    </svg>
  );
}

/** Text for screen readers only. */
export function VisuallyHidden({ children, ...rest }: HTMLAttributes<HTMLSpanElement> & { children: ReactNode }) {
  return (
    <span className="vl-sr-only" {...rest}>
      {children}
    </span>
  );
}

export interface SkeletonProps {
  /** `rect` — a block, `text` — a line of text, `circle` — a donut/avatar, `chart` — a wave silhouette, `bars` — columns. */
  readonly shape?: 'rect' | 'text' | 'circle' | 'chart' | 'bars';
  readonly className?: string;
  /** Size class: `xs`…`xl` for text width, ignored by other shapes. */
  readonly size?: 'xs' | 's' | 'm' | 'l' | 'xl';
}

/** Placeholder in the shape of what is coming. Static under reduced motion. */
export function Skeleton({ shape = 'rect', size = 'm', className }: SkeletonProps) {
  if (shape === 'chart') {
    return (
      <svg
        className={cx('vl-skeleton', 'vl-skeleton--chart', className)}
        viewBox="0 0 400 120"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path d="M0 96 C 40 90, 60 60, 100 66 S 160 30, 200 44 S 260 80, 300 52 S 360 20, 400 34 L 400 120 L 0 120 Z" />
      </svg>
    );
  }
  if (shape === 'bars') {
    const heights = [42, 66, 54, 88, 72, 96, 60, 80, 48, 70];
    return (
      <svg
        className={cx('vl-skeleton', 'vl-skeleton--chart', className)}
        viewBox="0 0 400 120"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {heights.map((h, i) => (
          <rect key={i} x={i * 40 + 8} y={120 - h} width={24} height={h} rx={4} />
        ))}
      </svg>
    );
  }
  return (
    <span
      className={cx('vl-skeleton', `vl-skeleton--${shape}`, shape === 'text' && `vl-skeleton--${size}`, className)}
      aria-hidden="true"
    />
  );
}
