import { COLUMN_TYPE, TOTAL, type CellValue, type ColumnDef, type TotalValue } from './types';
import { toNumber, toTime } from './values';

/** Locale and currency every cell is formatted with. */
export interface TableFormatOptions {
  locale: string;
  currency: string;
  /** "Today" for date formatting: the year is omitted for dates in the same year. */
  now?: Date;
}

export const MISSING_VALUE = '—';

const numberFormats = new Map<string, Intl.NumberFormat>();

function numberFormat(locale: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let format = numberFormats.get(key);
  if (format === undefined) {
    format = new Intl.NumberFormat(locale, options);
    numberFormats.set(key, format);
  }
  return format;
}

const dateFormats = new Map<string, Intl.DateTimeFormat>();

function dateFormat(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let format = dateFormats.get(key);
  if (format === undefined) {
    format = new Intl.DateTimeFormat(locale, options);
    dateFormats.set(key, format);
  }
  return format;
}

function defaultFractionDigits<Row>(column: ColumnDef<Row>): number {
  return column.type === COLUMN_TYPE.percent ? 1 : 0;
}

/** Number with the column's unit: `1 200 ₽`, `12,5 %`, `1,200`. Percent values are 0..100. */
export function formatNumber<Row>(column: ColumnDef<Row>, value: number, options: TableFormatOptions): string {
  const digits = column.fractionDigits ?? defaultFractionDigits(column);
  if (column.type === COLUMN_TYPE.money) {
    return numberFormat(options.locale, {
      style: 'currency',
      currency: column.currency ?? options.currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: digits,
    }).format(value);
  }
  if (column.type === COLUMN_TYPE.percent) {
    return numberFormat(options.locale, {
      style: 'percent',
      minimumFractionDigits: 0,
      maximumFractionDigits: digits,
    }).format(value / 100);
  }
  return numberFormat(options.locale, { minimumFractionDigits: 0, maximumFractionDigits: digits }).format(value);
}

/** `5 Oct`, `5 Oct 2025` for another year; datetime adds `, 19:00`. */
export function formatDate(time: number, withTime: boolean, options: TableFormatOptions): string {
  const date = new Date(time);
  const now = options.now ?? new Date();
  const sameYear = date.getFullYear() === now.getFullYear();
  const day = dateFormat(options.locale, {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
    .format(date)
    .replace(/\.$/, '')
    .replace(' г.', '');
  if (!withTime) return day;
  const clock = dateFormat(options.locale, { hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
  return `${day}, ${clock}`;
}

/** Display text of a value. Unknown values are a dash. */
export function formatCell<Row>(column: ColumnDef<Row>, value: CellValue, options: TableFormatOptions): string {
  if (value === null) return MISSING_VALUE;
  if (column.format !== undefined) return column.format(value);
  switch (column.type) {
    case COLUMN_TYPE.text:
      return String(value);
    case COLUMN_TYPE.number:
    case COLUMN_TYPE.money:
    case COLUMN_TYPE.percent: {
      const number = toNumber(value);
      return number === null ? String(value) : formatNumber(column, number, options);
    }
    case COLUMN_TYPE.date:
    case COLUMN_TYPE.datetime: {
      const time = toTime(value);
      return time === null ? String(value) : formatDate(time, column.type === COLUMN_TYPE.datetime, options);
    }
    case COLUMN_TYPE.status: {
      const key = String(value);
      return column.options?.find((option) => option.value === key)?.label ?? key;
    }
  }
}

export function formatTotal<Row>(column: ColumnDef<Row>, total: TotalValue, options: TableFormatOptions): string {
  if (total.unknown || total.value === null) return MISSING_VALUE;
  if (column.total === TOTAL.count) return numberFormat(options.locale, { maximumFractionDigits: 0 }).format(total.value);
  return formatCell(column, total.value, options);
}

/** Plain integer with grouping, for counters like "1–25 of 5,000". */
export function formatCount(value: number, locale: string): string {
  return numberFormat(locale, { maximumFractionDigits: 0 }).format(value);
}

/** Lowercase, with non-breaking and narrow spaces turned into plain ones: search must match formatted numbers. */
export function normalizeSearch(text: string): string {
  return text.replace(/[\u00a0\u202f\u2009]/g, ' ').toLowerCase();
}
