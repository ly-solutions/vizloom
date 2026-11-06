import { CATEGORICAL_SIZE, resolveColor, type Rgba } from '../model/palette';

/** Resolved theme colours for canvas drawing, read from the CSS variables of an element. */
export interface ThemeColors {
  readonly bg: Rgba;
  readonly surface: Rgba;
  readonly surfaceRaised: Rgba;
  readonly text: Rgba;
  readonly textSecondary: Rgba;
  readonly textMuted: Rgba;
  readonly border: Rgba;
  readonly grid: Rgba;
  readonly axis: Rgba;
  readonly accent: Rgba;
  readonly positive: Rgba;
  readonly negative: Rgba;
  readonly warning: Rgba;
  readonly crosshair: Rgba;
  readonly categorical: readonly Rgba[];
  readonly other: Rgba;
  readonly compare: readonly Rgba[];
  readonly sequential: readonly [Rgba, Rgba];
  readonly diverging: readonly [Rgba, Rgba, Rgba];
  /** Font family for canvas labels. */
  readonly font: string;
}

const FALLBACK = {
  bg: '#ffffff',
  surface: '#ffffff',
  surfaceRaised: '#ffffff',
  text: '#16161d',
  textSecondary: '#5b5b66',
  textMuted: '#8a8a94',
  border: '#e4e4ea',
  grid: '#ececf1',
  axis: '#c9c9d2',
  accent: '#6a4cf0',
  positive: '#118a4e',
  negative: '#d0324e',
  warning: '#b86e00',
  crosshair: '#8a8a94',
} as const;

export function readThemeColors(element: Element | null): ThemeColors {
  const cs = element && typeof getComputedStyle === 'function' ? getComputedStyle(element) : null;
  const read = (name: string, fallback: string) => resolveColor(cs?.getPropertyValue(name).trim() || fallback);
  const categorical = Array.from({ length: CATEGORICAL_SIZE }, (_, i) =>
    read(`--vl-cat-${i + 1}`, ['#6a4cf0', '#d08300', '#0a9688', '#d6335a', '#1f78d1', '#2a9d4b', '#a24bd1', '#6b7280'][i]),
  );
  return {
    bg: read('--vl-bg', FALLBACK.bg),
    surface: read('--vl-surface', FALLBACK.surface),
    surfaceRaised: read('--vl-surface-raised', FALLBACK.surfaceRaised),
    text: read('--vl-text', FALLBACK.text),
    textSecondary: read('--vl-text-secondary', FALLBACK.textSecondary),
    textMuted: read('--vl-text-muted', FALLBACK.textMuted),
    border: read('--vl-border', FALLBACK.border),
    grid: read('--vl-grid', FALLBACK.grid),
    axis: read('--vl-axis', FALLBACK.axis),
    accent: read('--vl-accent', FALLBACK.accent),
    positive: read('--vl-positive', FALLBACK.positive),
    negative: read('--vl-negative', FALLBACK.negative),
    warning: read('--vl-warning', FALLBACK.warning),
    crosshair: read('--vl-crosshair', FALLBACK.crosshair),
    categorical,
    other: read('--vl-cat-other', '#9a9aa4'),
    compare: [1, 2, 3, 4].map((i) => read(`--vl-compare-${i}`, '#8a8a94')),
    sequential: [read('--vl-seq-from', '#f1eefe'), read('--vl-seq-to', '#4b2bd6')],
    diverging: [read('--vl-div-neg', '#d0324e'), read('--vl-div-mid', '#f2f2f5'), read('--vl-div-pos', '#118a4e')],
    font: cs?.getPropertyValue('--vl-font-family').trim() || 'system-ui, sans-serif',
  };
}
