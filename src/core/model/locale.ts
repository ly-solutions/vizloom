/**
 * Locales: number/date wording and every UI string the components render. Two are built in
 * (`en`, `ru`); `defineLocale` derives a new one from either, overriding only what differs.
 */

export interface LocaleStrings {
  readonly legend: string;
  readonly noData: string;
  readonly noDataReason: string;
  readonly error: string;
  readonly errorReason: string;
  readonly retry: string;
  readonly noAccess: string;
  readonly noAccessReason: string;
  readonly partial: string;
  readonly partialReason: string;
  readonly loading: string;
  readonly total: string;
  readonly other: string;
  readonly more: (n: number) => string;
  readonly showLess: string;
  readonly zoomIn: string;
  readonly zoomOut: string;
  readonly resetZoom: string;
  readonly now: string;
  readonly forecast: string;
  readonly usual: string;
  readonly capacity: string;
  readonly before: string;
  readonly after: string;
  readonly vs: string;
  readonly help: string;
  readonly actions: string;
  readonly pin: string;
  readonly unpin: string;
  readonly close: string;
  readonly dataTable: string;
  readonly increase: string;
  readonly decrease: string;
  readonly noChange: string;
  readonly daysBefore: (n: number) => string;
  readonly search: string;
  readonly columns: string;
  readonly filters: string;
  readonly clear: string;
  readonly selected: (n: number) => string;
  readonly expand: string;
  readonly collapse: string;
  readonly sortAscending: string;
  readonly sortDescending: string;
  readonly page: (page: number, pages: number) => string;
  readonly rows: (n: number) => string;
  readonly live: string;
  readonly updated: string;
}

export interface Locale {
  /** BCP 47 tag used for Intl: `en-US`, `ru-RU`. */
  readonly code: string;
  readonly monthsShort: readonly string[];
  readonly monthsLong: readonly string[];
  readonly weekdaysShort: readonly string[];
  readonly weekdaysLong: readonly string[];
  /** Suffixes of compact numbers: thousand, million, billion. */
  readonly compact: readonly [thousand: string, million: string, billion: string];
  /** Separator between a compact number and its suffix (`1.2K` vs `1,2 тыс`). */
  readonly compactJoin: string;
  /** Duration units for `formatSpan`: day, hour, minute. */
  readonly span: readonly [day: string, hour: string, minute: string];
  /** Day-month order in short dates: `Oct 7` vs `7 окт`. */
  readonly dayFirst: boolean;
  readonly hour12: boolean;
  readonly strings: LocaleStrings;
}

const enStrings: LocaleStrings = {
  legend: 'Legend',
  noData: 'No data yet',
  noDataReason: 'Nothing happened in this period.',
  error: 'Could not load data',
  errorReason: 'The data source did not respond.',
  retry: 'Retry',
  noAccess: 'No access',
  noAccessReason: 'Ask the owner for access to this data.',
  partial: 'Partial data',
  partialReason: 'Some of the data is still being collected.',
  loading: 'Loading',
  total: 'Total',
  other: 'Other',
  more: (n) => `${n} more`,
  showLess: 'Show less',
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  resetZoom: 'Reset zoom',
  now: 'Now',
  forecast: 'Forecast',
  usual: 'Usual',
  capacity: 'Capacity',
  before: 'Before',
  after: 'After',
  vs: 'vs',
  help: 'About this chart',
  actions: 'Actions',
  pin: 'Pin tooltip',
  unpin: 'Unpin tooltip',
  close: 'Close',
  dataTable: 'Data table',
  increase: 'increase',
  decrease: 'decrease',
  noChange: 'no change',
  daysBefore: (n) => (n === 0 ? 'Event day' : `${n} ${n === 1 ? 'day' : 'days'} before`),
  search: 'Search',
  columns: 'Columns',
  filters: 'Filters',
  clear: 'Clear',
  selected: (n) => `${n} selected`,
  expand: 'Expand',
  collapse: 'Collapse',
  sortAscending: 'Sort ascending',
  sortDescending: 'Sort descending',
  page: (p, n) => `Page ${p} of ${n}`,
  rows: (n) => `${n} ${n === 1 ? 'row' : 'rows'}`,
  live: 'Live',
  updated: 'Updated',
};

export const en: Locale = {
  code: 'en-US',
  monthsShort: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  monthsLong: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  weekdaysShort: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  weekdaysLong: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  compact: ['K', 'M', 'B'],
  compactJoin: '',
  span: ['d', 'h', 'min'],
  dayFirst: false,
  hour12: false,
  strings: enStrings,
};

/** Russian plural: 1 билет, 2 билета, 5 билетов, 11 билетов. */
export function pluralRu(n: number, forms: readonly [one: string, few: string, many: string]): string {
  const a = Math.abs(Math.round(n)) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return forms[2];
  if (b > 1 && b < 5) return forms[1];
  if (b === 1) return forms[0];
  return forms[2];
}

const ruStrings: LocaleStrings = {
  legend: 'Легенда',
  noData: 'Пока нет данных',
  noDataReason: 'За этот период ничего не происходило.',
  error: 'Не удалось загрузить данные',
  errorReason: 'Источник данных не ответил.',
  retry: 'Повторить',
  noAccess: 'Нет доступа',
  noAccessReason: 'Попросите владельца открыть доступ к этим данным.',
  partial: 'Данные неполные',
  partialReason: 'Часть данных ещё собирается.',
  loading: 'Загрузка',
  total: 'Итого',
  other: 'Остальные',
  more: (n) => `Ещё ${n}`,
  showLess: 'Свернуть',
  zoomIn: 'Приблизить',
  zoomOut: 'Отдалить',
  resetZoom: 'Весь период',
  now: 'Сейчас',
  forecast: 'Прогноз',
  usual: 'Обычно',
  capacity: 'Вместимость',
  before: 'До',
  after: 'После',
  vs: 'против',
  help: 'О графике',
  actions: 'Действия',
  pin: 'Закрепить подсказку',
  unpin: 'Открепить подсказку',
  close: 'Закрыть',
  dataTable: 'Таблица данных',
  increase: 'рост',
  decrease: 'снижение',
  noChange: 'без изменений',
  daysBefore: (n) => (n === 0 ? 'День события' : `За ${n} ${pluralRu(n, ['день', 'дня', 'дней'])}`),
  search: 'Поиск',
  columns: 'Столбцы',
  filters: 'Фильтры',
  clear: 'Сбросить',
  selected: (n) => `Выбрано: ${n}`,
  expand: 'Раскрыть',
  collapse: 'Свернуть',
  sortAscending: 'По возрастанию',
  sortDescending: 'По убыванию',
  page: (p, n) => `Страница ${p} из ${n}`,
  rows: (n) => `${n} ${pluralRu(n, ['строка', 'строки', 'строк'])}`,
  live: 'В реальном времени',
  updated: 'Обновлено',
};

export const ru: Locale = {
  code: 'ru-RU',
  monthsShort: ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'],
  monthsLong: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'],
  weekdaysShort: ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'],
  weekdaysLong: ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'],
  compact: ['тыс', 'млн', 'млрд'],
  compactJoin: ' ',
  span: ['д', 'ч', 'мин'],
  dayFirst: true,
  hour12: false,
  strings: ruStrings,
};

export const LOCALES = { en, ru } as const;

export type LocaleOverrides = Partial<Omit<Locale, 'strings'>> & { readonly strings?: Partial<LocaleStrings> };

/** A new locale on top of a built-in one: `defineLocale(en, { code: 'en-GB', dayFirst: true })`. */
export function defineLocale(base: Locale, overrides: LocaleOverrides): Locale {
  return { ...base, ...overrides, strings: { ...base.strings, ...overrides.strings } };
}

/** `'ru'`, `'ru-RU'`, `'en-GB'` → the closest built-in locale. */
export function resolveLocale(input: Locale | string | undefined): Locale {
  if (!input) return en;
  if (typeof input !== 'string') return input;
  return input.toLowerCase().startsWith('ru') ? ru : en;
}
