import type { Locale } from '../../core';
import { DAY, type Granularity } from '../../core';
import { formatSpan, pluralize } from '../../core';
import type { TimeCanvasLabels } from './engine/time-engine';

/** Every word the time charts render. Built from the locale; override any of them with `labels`. */
export interface TimeChartLabels extends TimeCanvasLabels {
  /** Tooltip when a bucket has no data. */
  readonly emptyBucket: string;
  /** Hint under the tooltip when a click opens a series summary. */
  readonly clickForMore: string;
  readonly more: (count: number) => string;
  /** Suffix of the change against the previous bucket, by granularity. */
  readonly previous: Readonly<Record<Granularity, string>>;
  /** Effect row label when the marker touched every series. */
  readonly allSeries: string;
  readonly perDay: string;
  readonly effectWaiting: string;
  readonly effectNoBase: string;
  readonly effectJustNow: string;
  readonly effectNote: (window: string, after: string) => string;
  readonly effectBefore: (window: string) => string;
  /** Window length in words: "1 day", "3 days". */
  readonly effectWindow: (ms: number) => string;
  readonly effectAfter: (window: string, partial: boolean) => string;
  /** Screen-reader hint for the keyboard. */
  readonly keyboard: string;
  readonly zoomIn: string;
  readonly zoomOut: string;
  readonly resetZoom: string;
  readonly close: string;
  readonly staleError: string;
  readonly retry: string;
  /** Accessible name of the navigator slider. */
  readonly navigator: string;
  /** Caption of the event moment in the navigator. */
  readonly event: string;
  readonly dataTable: string;
}

const RU: Omit<TimeChartLabels, 'effectWindow' | 'effectNote' | 'effectBefore' | 'effectAfter' | 'more'> = {
  now: 'сейчас',
  gap: 'нет данных',
  peak: 'пик',
  total: 'Всего',
  current: 'идёт сейчас',
  emptyBucket: 'Нет данных за этот отрезок',
  clickForMore: 'Клик — подробнее',
  previous: { hour: 'к пред. часу', day: 'к пред. дню', week: 'к пред. неделе' },
  allSeries: 'Все серии',
  perDay: 'в день',
  effectWaiting: 'ждём',
  effectNoBase: 'нет базы',
  effectJustNow: 'Изменение только что — эффект появится позже',
  keyboard: 'Стрелки — по отрезкам, плюс и минус — масштаб, ноль — весь период, Enter — подробнее, Escape — закрыть.',
  zoomIn: 'Приблизить',
  zoomOut: 'Отдалить',
  resetZoom: 'Весь период',
  close: 'Закрыть',
  staleError: 'Не удалось обновить — показаны прошлые данные',
  retry: 'Повторить',
  navigator: 'Окно графика на всём периоде',
  event: 'событие',
  dataTable: 'Данные графика',
};

const EN: typeof RU = {
  now: 'now',
  gap: 'no data',
  peak: 'peak',
  total: 'Total',
  current: 'in progress',
  emptyBucket: 'No data for this period',
  clickForMore: 'Click for details',
  previous: { hour: 'vs prev. hour', day: 'vs prev. day', week: 'vs prev. week' },
  allSeries: 'All series',
  perDay: 'per day',
  effectWaiting: 'waiting',
  effectNoBase: 'no baseline',
  effectJustNow: 'Just changed — the effect will show later',
  keyboard: 'Arrows move between buckets, plus and minus zoom, zero shows everything, Enter opens details, Escape closes.',
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  resetZoom: 'Whole period',
  close: 'Close',
  staleError: 'Could not refresh — showing earlier data',
  retry: 'Retry',
  navigator: 'Chart window over the whole period',
  event: 'event',
  dataTable: 'Chart data',
};

export function timeChartLabels(locale: Locale): TimeChartLabels {
  const ru = locale.code.toLowerCase().startsWith('ru');
  const base = ru ? RU : EN;
  const days = (n: number) => (ru ? `${n} ${pluralize(n, ['день', 'дня', 'дней'], locale)}` : `${n} ${n === 1 ? 'day' : 'days'}`);
  const effectWindow = (ms: number) => {
    if (ms < DAY) return formatSpan(ms, locale);
    const n = Math.round(ms / DAY);
    if (n === 1) return ru ? 'сутки' : '1 day';
    return days(n);
  };
  return {
    ...base,
    more: (count) => (ru ? `и ещё ${count}` : `and ${count} more`),
    effectWindow,
    effectNote: (window, after) =>
      ru ? `Среднее в день: ${window} до изменения против ${after} после` : `Daily average: ${window} before vs ${after} after`,
    effectBefore: (window) => (ru ? `${window} до` : `${window} before`),
    effectAfter: (window, partial) => {
      if (partial) return ru ? `после · пока ${window}` : `after · ${window} so far`;
      return ru ? `${window} после` : `${window} after`;
    },
  };
}
