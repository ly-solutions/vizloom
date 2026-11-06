import { en, pluralRu, type Locale } from './locale';
import { DAY, type Granularity, HOUR, MINUTE, type TimeZone, UTC_ZONE, wallTime } from './time';

/**
 * Unit of a value. Unit words are product copy (the library does not know it counts "tickets"),
 * so count forms come in as a prop: `{ kind: 'count', forms: ['ticket', 'tickets'] }`.
 */
export type ValueUnit =
  | { readonly kind: 'number'; readonly fractionDigits?: number }
  | { readonly kind: 'count'; readonly forms?: readonly string[] }
  | { readonly kind: 'currency'; readonly currency: string }
  | { readonly kind: 'percent'; readonly fractionDigits?: number }
  | { readonly kind: 'duration' };

export const UNIT_NUMBER = { kind: 'number' } as const satisfies ValueUnit;
export const UNIT_COUNT = { kind: 'count' } as const satisfies ValueUnit;
export const UNIT_PERCENT = { kind: 'percent' } as const satisfies ValueUnit;
export const UNIT_DURATION = { kind: 'duration' } as const satisfies ValueUnit;
export const currencyUnit = (currency: string): ValueUnit => ({ kind: 'currency', currency });

const numberFormats = new Map<string, Intl.NumberFormat>();
function nf(locale: Locale, digits: number, extra: Intl.NumberFormatOptions = {}): Intl.NumberFormat {
  const key = `${locale.code}|${digits}|${JSON.stringify(extra)}`;
  let f = numberFormats.get(key);
  if (!f) {
    f = new Intl.NumberFormat(locale.code, { maximumFractionDigits: digits, minimumFractionDigits: 0, ...extra });
    numberFormats.set(key, f);
  }
  return f;
}

const symbols = new Map<string, string>();
export function currencySymbol(code: string, locale: Locale = en): string {
  const key = `${locale.code}|${code}`;
  let s = symbols.get(key);
  if (s === undefined) {
    const parts = new Intl.NumberFormat(locale.code, { style: 'currency', currency: code, currencyDisplay: 'narrowSymbol' }).formatToParts(
      0,
    );
    s = parts.find((p) => p.type === 'currency')?.value ?? code;
    symbols.set(key, s);
  }
  return s;
}

/** Count word: English singular/plural, Russian three forms. */
export function pluralize(n: number, forms: readonly string[], locale: Locale = en): string {
  if (forms.length >= 3 && locale.code.startsWith('ru')) return pluralRu(n, [forms[0], forms[1], forms[2]]);
  return Math.abs(n) === 1 ? forms[0] : (forms[1] ?? forms[0]);
}

export function formatNumber(v: number, locale: Locale = en, fractionDigits = 0): string {
  if (!Number.isFinite(v)) return '—';
  return nf(locale, fractionDigits).format(v);
}

/** Short form for axes and legends: 820, 1.2K, 48K, 1.5M (ru: 1,2 тыс, 48 тыс, 1,5 млн). */
export function formatCompact(v: number, locale: Locale = en): string {
  if (!Number.isFinite(v)) return '—';
  const a = Math.abs(v);
  const [k, m, b] = locale.compact;
  const j = locale.compactJoin;
  if (a >= 1e9 || Math.round(a / 1e6) >= 1e3) return `${nf(locale, 1).format(v / 1e9)}${j}${b}`;
  // 999 999 rounds to "1 000 K": such a number is written in millions.
  if (a >= 1e6 || Math.round(a / 1e3) >= 1e3) return `${nf(locale, 1).format(v / 1e6)}${j}${m}`;
  if (a >= 1e4) return `${nf(locale, 0).format(v / 1e3)}${j}${k}`;
  if (a >= 1e3) return `${nf(locale, 1).format(v / 1e3)}${j}${k}`;
  return nf(locale, a < 10 ? 1 : 0).format(v);
}

export interface FormatValueOptions {
  /** Full form ("124 tickets", "$248,000") instead of short ("124", "$248K"). */
  readonly long?: boolean;
  readonly locale?: Locale;
}

/** Currency with the symbol on the side the locale puts it. */
export function formatCurrency(v: number, currency: string, locale: Locale = en, long = true): string {
  if (!Number.isFinite(v)) return '—';
  const symbol = currencySymbol(currency, locale);
  const body = long ? nf(locale, 0).format(Math.abs(v)) : formatCompact(Math.abs(v), locale);
  const sign = v < 0 ? '−' : '';
  return locale.dayFirst ? `${sign}${body} ${symbol}` : `${sign}${symbol}${body}`;
}

export function formatPercent(v: number, locale: Locale = en, fractionDigits = 1): string {
  if (!Number.isFinite(v)) return '—';
  return `${nf(locale, fractionDigits).format(v)}${locale.dayFirst ? ' ' : ''}%`;
}

/** Duration in ms: "1 d 20 h", "45 min". */
export function formatSpan(ms: number, locale: Locale = en): string {
  const [d, h, m] = locale.span;
  if (ms < HOUR) return `${Math.max(0, Math.round(ms / MINUTE))} ${m}`;
  const hours = Math.round(ms / HOUR);
  const days = Math.floor(hours / 24);
  const rest = hours % 24;
  return [days ? `${days} ${d}` : '', rest ? `${rest} ${h}` : ''].filter(Boolean).join(' ') || `0 ${h}`;
}

export function formatValue(v: number, unit: ValueUnit, options: FormatValueOptions = {}): string {
  const locale = options.locale ?? en;
  if (!Number.isFinite(v)) return '—';
  switch (unit.kind) {
    case 'percent':
      return formatPercent(v, locale, unit.fractionDigits ?? 1);
    case 'currency':
      return formatCurrency(v, unit.currency, locale, options.long ?? false);
    case 'duration':
      return formatSpan(v, locale);
    case 'number':
      return options.long ? formatNumber(v, locale, unit.fractionDigits ?? 0) : formatCompact(v, locale);
    case 'count':
      if (!options.long) return formatCompact(v, locale);
      return unit.forms ? `${formatNumber(v, locale)} ${pluralize(v, unit.forms, locale)}` : formatNumber(v, locale);
  }
}

/** Relative change in percent, `(current − previous) / |previous| × 100`; NaN when undefined. */
export function percentChange(current: number, previous: number): number {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return Number.NaN;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export type DeltaDirection = 'up' | 'down' | 'flat';

export function deltaDirection(pct: number, flatThreshold = 0.5): DeltaDirection {
  if (!Number.isFinite(pct) || Math.abs(pct) < flatThreshold) return 'flat';
  return pct > 0 ? 'up' : 'down';
}

/** Signed percent with an arrow: "↑ +24%", "↓ −42%". Sign and arrow, not only colour. */
export function formatDelta(pct: number, locale: Locale = en, options: { arrow?: boolean; fractionDigits?: number } = {}): string {
  if (!Number.isFinite(pct)) return '—';
  const { arrow = true, fractionDigits = 0 } = options;
  const dir = deltaDirection(pct, 0);
  const abs = nf(locale, fractionDigits).format(Math.abs(pct));
  const sign = Number(abs.replace(/[^0-9]/g, '')) === 0 ? '' : pct > 0 ? '+' : '−';
  const arrowChar = dir === 'up' ? '↑ ' : dir === 'down' ? '↓ ' : '';
  return `${arrow ? arrowChar : ''}${sign}${abs}${locale.dayFirst ? ' ' : ''}%`;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** "Oct 7" / "7 окт". */
export function formatDay(t: number, locale: Locale = en, zone: TimeZone = UTC_ZONE): string {
  const w = wallTime(t, zone);
  return locale.dayFirst ? `${w.day} ${locale.monthsShort[w.month]}` : `${locale.monthsShort[w.month]} ${w.day}`;
}

/** "Oct 7, 2026" / "7 окт 2026". */
export function formatDate(t: number, locale: Locale = en, zone: TimeZone = UTC_ZONE): string {
  const w = wallTime(t, zone);
  return locale.dayFirst ? `${w.day} ${locale.monthsShort[w.month]} ${w.year}` : `${locale.monthsShort[w.month]} ${w.day}, ${w.year}`;
}

/** "14:00" (or "2 PM" with hour12). */
export function formatTime(t: number, locale: Locale = en, zone: TimeZone = UTC_ZONE): string {
  const w = wallTime(t, zone);
  if (locale.hour12) {
    const h = w.hours % 12 || 12;
    return `${h}${w.minutes ? `:${pad2(w.minutes)}` : ''} ${w.hours < 12 ? 'AM' : 'PM'}`;
  }
  return `${pad2(w.hours)}:${pad2(w.minutes)}`;
}

export function formatMonth(t: number, locale: Locale = en, zone: TimeZone = UTC_ZONE): string {
  const w = wallTime(t, zone);
  return locale.monthsShort[w.month];
}

/** Bucket caption for tooltips: "Oct 7, Tue · 14:00–15:00", "Oct 7, Tuesday", "Sep 30 – Oct 6". */
export function formatBucket(
  start: number,
  granularity: Granularity,
  step: number,
  locale: Locale = en,
  zone: TimeZone = UTC_ZONE,
): string {
  const w = wallTime(start, zone);
  if (granularity === 'hour')
    return `${formatDay(start, locale, zone)}, ${locale.weekdaysShort[w.weekday]} · ${formatTime(start, locale, zone)}–${formatTime(start + step, locale, zone)}`;
  if (granularity === 'day') return `${formatDay(start, locale, zone)}, ${locale.weekdaysLong[w.weekday]}`;
  return `${formatDay(start, locale, zone)} – ${formatDay(start + step - DAY, locale, zone)}`;
}

/** "Oct 7 14:00 → Oct 9 10:00 · 1 d 20 h": caption of a selected period. */
export function formatRange(a: number, b: number, locale: Locale = en, zone: TimeZone = UTC_ZONE): string {
  const midnight = (t: number) => {
    const w = wallTime(t, zone);
    return w.hours === 0 && w.minutes === 0;
  };
  const from = midnight(a) ? formatDay(a, locale, zone) : `${formatDay(a, locale, zone)} ${formatTime(a, locale, zone)}`;
  const sameDay = formatDay(a, locale, zone) === formatDay(b - 1, locale, zone);
  let to = `${formatDay(b, locale, zone)} ${formatTime(b, locale, zone)}`;
  if (midnight(b)) to = formatDay(b - DAY, locale, zone);
  else if (sameDay) to = formatTime(b, locale, zone);
  return `${from} → ${to} · ${formatSpan(b - a, locale)}`;
}

const relativeFormats = new Map<string, Intl.RelativeTimeFormat>();

/** "3 minutes ago", "in 2 days" / "3 минуты назад". `now` is injectable for tests and SSR. */
export function formatRelative(t: number, now: number, locale: Locale = en): string {
  let f = relativeFormats.get(locale.code);
  if (!f) {
    f = new Intl.RelativeTimeFormat(locale.code, { numeric: 'auto' });
    relativeFormats.set(locale.code, f);
  }
  const diff = t - now;
  const abs = Math.abs(diff);
  if (abs < MINUTE) return f.format(Math.round(diff / 1000), 'second');
  if (abs < HOUR) return f.format(Math.round(diff / MINUTE), 'minute');
  if (abs < DAY) return f.format(Math.round(diff / HOUR), 'hour');
  if (abs < 30 * DAY) return f.format(Math.round(diff / DAY), 'day');
  if (abs < 365 * DAY) return f.format(Math.round(diff / (30.4 * DAY)), 'month');
  return f.format(Math.round(diff / (365 * DAY)), 'year');
}

/** Axis label for a time tick of a given level: time inside a day, day otherwise, month on month starts. */
export function formatTick(
  t: number,
  levelMs: number | 'month' | 'quarter' | 'year',
  locale: Locale = en,
  zone: TimeZone = UTC_ZONE,
): string {
  if (levelMs === 'year') return String(wallTime(t, zone).year);
  if (levelMs === 'month' || levelMs === 'quarter') {
    const w = wallTime(t, zone);
    return w.month === 0 ? `${locale.monthsShort[0]} ${w.year}` : locale.monthsShort[w.month];
  }
  if (levelMs < DAY) {
    const w = wallTime(t, zone);
    return w.hours === 0 && w.minutes === 0 ? formatDay(t, locale, zone) : formatTime(t, locale, zone);
  }
  return formatDay(t, locale, zone);
}

/** Formatter bound to a locale and zone: what components receive from `VizProvider`. */
export interface Formatter {
  readonly locale: Locale;
  readonly zone: TimeZone;
  number(v: number, fractionDigits?: number): string;
  compact(v: number): string;
  value(v: number, unit: ValueUnit, long?: boolean): string;
  currency(v: number, currency: string, long?: boolean): string;
  percent(v: number, fractionDigits?: number): string;
  delta(pct: number, options?: { arrow?: boolean; fractionDigits?: number }): string;
  day(t: number): string;
  date(t: number): string;
  time(t: number): string;
  bucket(start: number, granularity: Granularity, step: number): string;
  range(a: number, b: number): string;
  span(ms: number): string;
  relative(t: number, now: number): string;
  tick(t: number, level: number | 'month' | 'quarter' | 'year'): string;
}

export function createFormatter(locale: Locale = en, zone: TimeZone = UTC_ZONE): Formatter {
  return {
    locale,
    zone,
    number: (v, d = 0) => formatNumber(v, locale, d),
    compact: (v) => formatCompact(v, locale),
    value: (v, unit, long = false) => formatValue(v, unit, { locale, long }),
    currency: (v, c, long = true) => formatCurrency(v, c, locale, long),
    percent: (v, d = 1) => formatPercent(v, locale, d),
    delta: (pct, o) => formatDelta(pct, locale, o),
    day: (t) => formatDay(t, locale, zone),
    date: (t) => formatDate(t, locale, zone),
    time: (t) => formatTime(t, locale, zone),
    bucket: (s, g, step) => formatBucket(s, g, step, locale, zone),
    range: (a, b) => formatRange(a, b, locale, zone),
    span: (ms) => formatSpan(ms, locale),
    relative: (t, now) => formatRelative(t, now, locale),
    tick: (t, level) => formatTick(t, level, locale, zone),
  };
}
