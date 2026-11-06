/**
 * Colours. Components never hard-code colours: series take `var(--vl-cat-N)` and canvases read
 * the resolved CSS variables of their element (`readThemeColors`). The palette values live in
 * `styles/tokens.css`; these helpers generate sequential and diverging ramps and check contrast.
 */

export const CATEGORICAL_SIZE = 8;

export type ColorSlot = number | 'other';

/** CSS colour of a categorical slot: `var(--vl-cat-3)`, `var(--vl-cat-other)`. */
export function seriesColor(slot: ColorSlot): string {
  if (slot === 'other') return 'var(--vl-cat-other)';
  const i = ((slot % CATEGORICAL_SIZE) + CATEGORICAL_SIZE) % CATEGORICAL_SIZE;
  return `var(--vl-cat-${i + 1})`;
}

/** Name of the CSS variable of a slot, for `getPropertyValue`. */
export function seriesColorVar(slot: ColorSlot): string {
  if (slot === 'other') return '--vl-cat-other';
  return `--vl-cat-${(((slot % CATEGORICAL_SIZE) + CATEGORICAL_SIZE) % CATEGORICAL_SIZE) + 1}`;
}

/** Comparison series (another event, previous period): dashed and from its own palette. */
export function compareColor(index: number): string {
  return `var(--vl-compare-${(((index % 4) + 4) % 4) + 1})`;
}

export const ZONE_TONE = { neutral: 'neutral', accent: 'accent', positive: 'positive', negative: 'negative', warning: 'warning' } as const;
export type ZoneTone = (typeof ZONE_TONE)[keyof typeof ZONE_TONE];

export interface Rgba {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
}

/** Parse `#rgb`, `#rrggbb`, `#rrggbbaa`, `rgb()`/`rgba()`. Other syntaxes need `resolveColor` (DOM). */
export function parseColor(input: string): Rgba | null {
  const s = input.trim();
  const hex = /^#([0-9a-f]{3,8})$/i.exec(s);
  if (hex) {
    let h = hex[1];
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('');
    if (h.length !== 6 && h.length !== 8) return null;
    const n = parseInt(h, 16);
    if (h.length === 6) return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 };
    return { r: (n >>> 24) & 255, g: (n >> 16) & 255, b: (n >> 8) & 255, a: (n & 255) / 255 };
  }
  const rgb = /^rgba?\(([^)]+)\)$/i.exec(s);
  if (rgb) {
    const parts = rgb[1]
      .split(/[\s,/]+/)
      .filter(Boolean)
      .map(Number);
    if (parts.length < 3 || parts.some((p) => Number.isNaN(p))) return null;
    return { r: parts[0], g: parts[1], b: parts[2], a: parts[3] ?? 1 };
  }
  return null;
}

let probe: CanvasRenderingContext2D | null | undefined;

/** Any CSS colour (oklch, named, hex) → RGBA through a one-pixel canvas. Falls back to grey on the server. */
const VAR_RE = /^var\(\s*(--[\w-]+)\s*(?:,\s*(.+))?\)$/;

/**
 * Any CSS colour → RGBA. `var(--vl-cat-1)` is read from `scope` (default: the root element), because a
 * canvas cannot parse custom properties itself.
 */
export function resolveColor(css: string, fallback: Rgba = { r: 136, g: 136, b: 136, a: 1 }, scope?: Element | null): Rgba {
  const v = VAR_RE.exec(css.trim());
  if (v) {
    const el = scope ?? (typeof document !== 'undefined' ? document.documentElement : null);
    const value = el && typeof getComputedStyle === 'function' ? getComputedStyle(el).getPropertyValue(v[1]).trim() : '';
    if (value) return resolveColor(value, fallback, scope);
    return v[2] ? resolveColor(v[2], fallback, scope) : fallback;
  }
  const parsed = parseColor(css);
  if (parsed) return parsed;
  if (probe === undefined) {
    const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
    if (canvas) {
      canvas.width = 1;
      canvas.height = 1;
    }
    try {
      probe = canvas?.getContext('2d', { willReadFrequently: true }) ?? null;
    } catch {
      probe = null;
    }
  }
  if (!probe || !css) return fallback;
  probe.clearRect(0, 0, 1, 1);
  probe.fillStyle = '#000';
  probe.fillStyle = css;
  probe.fillRect(0, 0, 1, 1);
  const d = probe.getImageData(0, 0, 1, 1).data;
  return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 };
}

export function rgba(c: Rgba, alpha = 1): string {
  return `rgba(${Math.round(c.r)},${Math.round(c.g)},${Math.round(c.b)},${Math.max(0, Math.min(1, c.a * alpha)).toFixed(3)})`;
}

export function toHex(c: Rgba): string {
  const h = (n: number) =>
    Math.round(Math.max(0, Math.min(255, n)))
      .toString(16)
      .padStart(2, '0');
  return `#${h(c.r)}${h(c.g)}${h(c.b)}`;
}

const srgbToLinear = (c: number) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const linearToSrgb = (v: number) => 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);

/** WCAG relative luminance. */
export function luminance(c: Rgba): number {
  return 0.2126 * srgbToLinear(c.r) + 0.7152 * srgbToLinear(c.g) + 0.0722 * srgbToLinear(c.b);
}

/** WCAG contrast ratio, 1–21. */
export function contrastRatio(a: Rgba, b: Rgba): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Black or white text, whichever reads better on `background`. */
export function readableOn(background: Rgba): Rgba {
  return contrastRatio(background, { r: 0, g: 0, b: 0, a: 1 }) >= contrastRatio(background, { r: 255, g: 255, b: 255, a: 1 })
    ? { r: 0, g: 0, b: 0, a: 1 }
    : { r: 255, g: 255, b: 255, a: 1 };
}

interface Oklab {
  L: number;
  a: number;
  b: number;
}

function toOklab(c: Rgba): Oklab {
  const r = srgbToLinear(c.r);
  const g = srgbToLinear(c.g);
  const b = srgbToLinear(c.b);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

function fromOklab({ L, a, b }: Oklab, alpha = 1): Rgba {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return {
    r: linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
    a: alpha,
  };
}

/** Perceptual interpolation between two colours (OKLab). */
export function mixColors(a: Rgba, b: Rgba, t: number): Rgba {
  const A = toOklab(a);
  const B = toOklab(b);
  return fromOklab({ L: A.L + (B.L - A.L) * t, a: A.a + (B.a - A.a) * t, b: A.b + (B.b - A.b) * t }, a.a + (b.a - a.a) * t);
}

/** Sampler `t ∈ [0, 1] → colour` through the given stops. */
export function colorRamp(stops: readonly Rgba[]): (t: number) => Rgba {
  if (stops.length === 0) return () => ({ r: 136, g: 136, b: 136, a: 1 });
  if (stops.length === 1) return () => stops[0];
  return (t) => {
    const x = Math.max(0, Math.min(1, t)) * (stops.length - 1);
    const i = Math.min(stops.length - 2, Math.floor(x));
    return mixColors(stops[i], stops[i + 1], x - i);
  };
}

/** Sequential ramp: from the surface colour to the accent (heatmaps, choropleths). */
export function sequentialRamp(from: Rgba, to: Rgba): (t: number) => Rgba {
  return colorRamp([from, to]);
}

/** Diverging ramp: negative → neutral → positive, `t = 0.5` is neutral. */
export function divergingRamp(negative: Rgba, neutral: Rgba, positive: Rgba): (t: number) => Rgba {
  return colorRamp([negative, neutral, positive]);
}

/** `n` evenly spaced colours of a ramp. */
export function sampleRamp(ramp: (t: number) => Rgba, n: number): Rgba[] {
  return Array.from({ length: n }, (_, i) => ramp(n === 1 ? 1 : i / (n - 1)));
}
