import { createContext, type ReactNode, useContext, useMemo } from 'react';

import { createFormatter, type Formatter } from '../model/format';
import { en, type Locale, resolveLocale } from '../model/locale';
import { type TimeZone, UTC_ZONE } from '../model/time';

export interface VizConfig {
  readonly locale: Locale;
  readonly zone: TimeZone;
  readonly format: Formatter;
  /** Global animation switch on top of `prefers-reduced-motion`. */
  readonly animate: boolean;
}

const defaultConfig: VizConfig = { locale: en, zone: UTC_ZONE, format: createFormatter(en, UTC_ZONE), animate: true };

const VizContext = createContext<VizConfig>(defaultConfig);

export interface VizProviderProps {
  /** `'en' | 'ru'`, a BCP 47 tag, or a full `Locale` from `defineLocale`. Default: English. */
  readonly locale?: Locale | string;
  /** Time zone of axes and buckets. Default: UTC. Use `intlZone('Europe/Berlin')` or `fixedOffsetZone(3)`. */
  readonly zone?: TimeZone;
  readonly animate?: boolean;
  readonly children: ReactNode;
}

/**
 * Locale, time zone and motion for every component below. Optional: without it components use
 * English, UTC and animations. Colours are not here — they are CSS variables (see theming docs).
 */
export function VizProvider({ locale, zone = UTC_ZONE, animate = true, children }: VizProviderProps) {
  const resolved = resolveLocale(locale);
  const value = useMemo<VizConfig>(
    () => ({ locale: resolved, zone, format: createFormatter(resolved, zone), animate }),
    [resolved, zone, animate],
  );
  return <VizContext.Provider value={value}>{children}</VizContext.Provider>;
}

export function useVizConfig(): VizConfig {
  return useContext(VizContext);
}

/** Formatter bound to the provider's locale and zone. */
export function useFormat(): Formatter {
  return useContext(VizContext).format;
}

export function useLocale(): Locale {
  return useContext(VizContext).locale;
}
