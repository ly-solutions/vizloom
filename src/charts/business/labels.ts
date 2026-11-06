import type { Locale } from '../../core';

const isRu = (locale: Locale) => locale.code.toLowerCase().startsWith('ru');

/** Words of the pace chart. Built from the locale; override any with `labels`. */
export interface PaceLabels {
  readonly fact: string;
  readonly forecast: string;
  readonly typical: string;
  readonly corridor: string;
  readonly capacity: (value: string) => string;
  readonly start: string;
  readonly now: string;
  readonly event: string;
  readonly sellout: (day: string) => string;
  readonly ofTypical: string;
  readonly ofPlan: string;
  readonly faster: string;
  readonly slower: string;
  readonly usual: string;
  readonly aheadPlan: string;
  readonly behindPlan: string;
  readonly onPlan: string;
  readonly expectedTypical: (expected: string, sold: string) => string;
  readonly expectedPlan: (expected: string, sold: string) => string;
  readonly noBasis: string;
  readonly fewHistory: string;
  readonly soldToDate: string;
  readonly perDay: string;
  readonly typicalToDate: string;
  readonly forecastToDate: string;
  readonly corridorRange: (low: string, high: string) => string;
  readonly dayOf: (n: number, total: number) => string;
  /** Sell-out projection under the headline. */
  readonly soldOut: string;
  readonly onTrack: (date: string, days: string) => string;
  readonly offTrack: (share: string) => string;
  readonly stalled: string;
  readonly date: string;
  readonly close: string;
  readonly prevDay: string;
  readonly nextDay: string;
}

const PACE_EN: PaceLabels = {
  fact: 'Actual',
  forecast: 'Forecast',
  typical: 'Usual',
  corridor: 'Usual range',
  capacity: (value) => `capacity ${value}`,
  start: 'start',
  now: 'now',
  event: 'event',
  sellout: (day) => `sells out ~${day}`,
  ofTypical: 'of the usual pace',
  ofPlan: 'of the even plan',
  faster: 'faster than usual',
  slower: 'slower than usual',
  usual: 'as usual',
  aheadPlan: 'ahead of plan',
  behindPlan: 'behind plan',
  onPlan: 'on plan',
  expectedTypical: (expected, sold) => `Usually ${expected} sold by this day — we have ${sold}`,
  expectedPlan: (expected, sold) => `An even plan expects ${expected} by this day — we have ${sold}`,
  noBasis: 'Nothing to compare with: no capacity and no past events',
  fewHistory: 'fewer than two past events — no range',
  soldToDate: 'Sold by this day',
  perDay: 'That day',
  typicalToDate: 'Usually by this day',
  forecastToDate: 'Forecast by this day',
  corridorRange: (low, high) => `usually ${low} to ${high}`,
  dayOf: (n, total) => `day ${n} of ${total}`,
  soldOut: 'Sold out',
  onTrack: (date, days) => `At this pace it sells out ~${date}, ${days} days before the event`,
  offTrack: (share) => `At this pace ~${share} sells by the event`,
  stalled: 'No sales in recent days — no sell-out in sight',
  date: 'Date',
  close: 'Close',
  prevDay: 'Previous day',
  nextDay: 'Next day',
};

const PACE_RU: PaceLabels = {
  fact: 'Факт',
  forecast: 'Прогноз',
  typical: 'Обычно',
  corridor: 'Обычный коридор',
  capacity: (value) => `вместимость ${value}`,
  start: 'старт',
  now: 'сейчас',
  event: 'мероприятие',
  sellout: (day) => `распродадим ~${day}`,
  ofTypical: 'от обычного темпа',
  ofPlan: 'от равномерного плана',
  faster: 'быстрее обычного',
  slower: 'медленнее обычного',
  usual: 'как обычно',
  aheadPlan: 'опережаем план',
  behindPlan: 'отстаём от плана',
  onPlan: 'идём по плану',
  expectedTypical: (expected, sold) => `Обычно к этому дню продано ${expected} — у нас ${sold}`,
  expectedPlan: (expected, sold) => `По равномерному плану к этому дню ${expected} — у нас ${sold}`,
  noBasis: 'Сравнить не с чем: нет вместимости и прошлых мероприятий',
  fewHistory: 'прошлых мероприятий меньше двух — коридора нет',
  soldToDate: 'Продано к этому дню',
  perDay: 'За день',
  typicalToDate: 'Обычно к этому дню',
  forecastToDate: 'Прогноз к этому дню',
  corridorRange: (low, high) => `обычно от ${low} до ${high}`,
  dayOf: (n, total) => `день ${n} из ${total}`,
  soldOut: 'Зал распродан',
  onTrack: (date, days) => `В этом темпе зал распродадим ~${date} — за ${days} дн. до мероприятия`,
  offTrack: (share) => `В этом темпе к мероприятию продадим ~${share} зала`,
  stalled: 'Продаж за последние дни нет — распродажа не просматривается',
  date: 'Дата',
  close: 'Закрыть',
  prevDay: 'Предыдущий день',
  nextDay: 'Следующий день',
};

export const paceLabels = (locale: Locale): PaceLabels => (isRu(locale) ? PACE_RU : PACE_EN);

/** Words of the refunds chart. */
export interface RefundsLabels {
  readonly turnover: string;
  readonly net: string;
  readonly refunded: string;
  readonly left: string;
  readonly ofSold: (sold: string) => string;
  readonly refundedShare: (value: string, share: string) => string;
  readonly noRefunds: string;
  readonly dayTurnover: string;
  readonly dayRefunds: string;
  readonly dayNet: string;
  readonly ofDay: (share: string) => string;
  readonly netToDate: (value: string) => string;
  readonly date: string;
  readonly zoomIn: string;
  readonly zoomOut: string;
  readonly resetZoom: string;
  readonly close: string;
  readonly prevDay: string;
  readonly nextDay: string;
}

const REFUNDS_EN: RefundsLabels = {
  turnover: 'Turnover',
  net: 'Kept',
  refunded: 'Refunds',
  left: 'kept',
  ofSold: (sold) => `of ${sold} sold`,
  refundedShare: (value, share) => `refunded ${value} — ${share}`,
  noRefunds: 'no refunds — all revenue kept',
  dayTurnover: 'Turnover that day',
  dayRefunds: 'Refunded',
  dayNet: 'Kept',
  ofDay: (share) => `${share} of the day`,
  netToDate: (value) => `since start — ${value}`,
  date: 'Date',
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  resetZoom: 'Whole period',
  close: 'Close',
  prevDay: 'Previous day',
  nextDay: 'Next day',
};

const REFUNDS_RU: RefundsLabels = {
  turnover: 'Оборот',
  net: 'Осталось',
  refunded: 'Возвраты',
  left: 'осталось',
  ofSold: (sold) => `из ${sold} проданных`,
  refundedShare: (value, share) => `вернули ${value} — ${share}`,
  noRefunds: 'возвратов не было — вся выручка осталась',
  dayTurnover: 'Оборот за день',
  dayRefunds: 'Вернули',
  dayNet: 'Осталось',
  ofDay: (share) => `${share} оборота дня`,
  netToDate: (value) => `с начала — ${value}`,
  date: 'Дата',
  zoomIn: 'Приблизить',
  zoomOut: 'Отдалить',
  resetZoom: 'Весь период',
  close: 'Закрыть',
  prevDay: 'Предыдущий день',
  nextDay: 'Следующий день',
};

export const refundsLabels = (locale: Locale): RefundsLabels => (isRu(locale) ? REFUNDS_RU : REFUNDS_EN);

/** Words of the flow (throughput) chart. */
export interface FlowLabels {
  readonly perMinute: (value: string) => string;
  readonly avgPerMinute: (value: string) => string;
  readonly peakAt: (value: string, time: string) => string;
  readonly current: string;
  readonly peak: string;
  readonly average: string;
  readonly total: string;
  readonly idle: string;
  readonly seriesHint: string;
  readonly selectHint: string;
  readonly cards: string;
  readonly beforeStart: string;
}

const FLOW_EN: FlowLabels = {
  perMinute: (value) => `${value} / min`,
  avgPerMinute: (value) => `${value} / min on average`,
  peakAt: (value, time) => `peak ${value} at ${time}`,
  current: 'Now',
  peak: 'Peak',
  average: 'Average',
  total: 'Passed',
  idle: 'idle',
  seriesHint: 'Click a card to focus its line; click again to show all.',
  selectHint: 'Drag across the chart to zoom into a stretch; ctrl + wheel or pinch to zoom.',
  cards: 'Series',
  beforeStart: 'Before the start',
};

const FLOW_RU: FlowLabels = {
  perMinute: (value) => `${value} в минуту`,
  avgPerMinute: (value) => `${value} в минуту в среднем`,
  peakAt: (value, time) => `пик ${value} в ${time}`,
  current: 'Сейчас',
  peak: 'Пик',
  average: 'В среднем',
  total: 'Прошли',
  idle: 'стоит',
  seriesHint: 'Нажмите на карточку — линия в фокусе; ещё раз — все линии.',
  selectHint: 'Протяните по графику — приблизить отрезок; Ctrl + колесо или щипок — масштаб.',
  cards: 'Серии',
  beforeStart: 'До начала',
};

export const flowLabels = (locale: Locale): FlowLabels => (isRu(locale) ? FLOW_RU : FLOW_EN);

/** Words of the sell-out rows. */
export interface SelloutLabels {
  readonly sold: string;
  readonly soldOf: (sold: string, target: string) => string;
  readonly speed: string;
  readonly perDay: (value: string) => string;
  readonly speedHint: (days: number) => string;
  readonly toSellout: string;
  readonly daysApprox: (days: string) => string;
  readonly selloutBy: (date: string) => string;
  /** The sell-out at this speed comes after the event. */
  readonly selloutLate: (date: string) => string;
  readonly remaining: string;
  readonly remainingHint: (share: string) => string;
  readonly never: string;
}

const SELLOUT_EN: SelloutLabels = {
  sold: 'Sold',
  soldOf: (sold, target) => `${sold} of ${target}`,
  speed: 'Speed',
  perDay: (value) => `~${value} a day`,
  speedHint: (days) => `over the last ${days} days`,
  toSellout: 'To sell-out',
  daysApprox: (days) => `~${days} days`,
  selloutBy: (date) => `by ${date}`,
  selloutLate: (date) => `at this speed — by ${date}`,
  remaining: 'Left',
  remainingHint: (share) => `${share} of capacity`,
  never: 'after the event',
};

const SELLOUT_RU: SelloutLabels = {
  sold: 'Продано',
  soldOf: (sold, target) => `${sold} из ${target}`,
  speed: 'Скорость',
  perDay: (value) => `~${value} в день`,
  speedHint: (days) => `за последние ${days} дн.`,
  toSellout: 'До распродажи',
  daysApprox: (days) => `~${days} дн.`,
  selloutBy: (date) => `к ${date}`,
  selloutLate: (date) => `по этой скорости — к ${date}`,
  remaining: 'Остаток',
  remainingHint: (share) => `${share} зала`,
  never: 'позже мероприятия',
};

export const selloutLabels = (locale: Locale): SelloutLabels => (isRu(locale) ? SELLOUT_RU : SELLOUT_EN);
