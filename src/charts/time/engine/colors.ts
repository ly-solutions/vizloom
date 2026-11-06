import { mixColors, resolveColor, rgba, type Rgba, type ZoneTone } from '../../../core';
import { readThemeColors, type ThemeColors } from '../../../core';

export { resolveColor, rgba, type Rgba };

export type ThemeName = 'light' | 'dark';

/** Theme colours for canvas drawing plus a few derived surfaces. */
export interface CanvasColors extends ThemeColors {
  /** Placeholder surface: skeleton bars, navigator track. */
  readonly input: Rgba;
}

export function readCanvasColors(element: Element): CanvasColors {
  const base = readThemeColors(element);
  return { ...base, input: mixColors(base.surface, base.text, 0.07) };
}

/** Effective theme at an element: the nearest `data-vl-theme`, else the OS colour scheme. */
export function resolveTheme(element: Element | null): ThemeName {
  const attr = element?.closest?.('[data-vl-theme]')?.getAttribute('data-vl-theme');
  if (attr === 'dark' || attr === 'light') return attr;
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches)
    return 'dark';
  return 'light';
}

/** Colour of a zone tone; neutral zones use the text colour at low alpha. */
export function toneRgba(tone: ZoneTone, colors: CanvasColors): Rgba {
  switch (tone) {
    case 'accent':
      return colors.accent;
    case 'positive':
      return colors.positive;
    case 'negative':
      return colors.negative;
    case 'warning':
      return colors.warning;
    default:
      return colors.text;
  }
}
