import { COLUMN_TYPE, TOTAL, type CellValue, type ColumnDef, type TotalKind, type TotalValue } from './types';

/** Finite number from a number or numeric string; anything else is unknown. */
export function toNumber(value: CellValue): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Calendar day `YYYY-MM-DD` as local midnight, or null when it is not a real day. */
export function parseDay(value: string): { year: number; month: number; day: number } | null {
  const match = DAY_RE.exec(value.trim());
  if (match === null) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day);
  return date.getFullYear() === year && date.getMonth() === month && date.getDate() === day ? { year, month, day } : null;
}

/** Epoch milliseconds from a Date, a `YYYY-MM-DD` day or any parsable date string. */
export function toTime(value: CellValue): number | null {
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isFinite(time) ? time : null;
  }
  if (typeof value !== 'string') return null;
  const day = parseDay(value);
  if (day !== null) return new Date(day.year, day.month, day.day).getTime();
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** The value counts as missing for sorting: nulls and unparsable values go last. */
export function isMissing<Row>(column: ColumnDef<Row>, value: CellValue): boolean {
  if (value === null) return true;
  switch (column.type) {
    case COLUMN_TYPE.number:
    case COLUMN_TYPE.money:
    case COLUMN_TYPE.percent:
      return toNumber(value) === null;
    case COLUMN_TYPE.date:
    case COLUMN_TYPE.datetime:
      return toTime(value) === null;
    case COLUMN_TYPE.status:
    case COLUMN_TYPE.text:
      return false;
  }
}

function aggregate(kind: TotalKind, values: number[]): number | null {
  if (values.length === 0) return kind === TOTAL.sum ? 0 : null;
  switch (kind) {
    case TOTAL.sum:
      return values.reduce((sum, value) => sum + value, 0);
    case TOTAL.avg:
      return values.reduce((sum, value) => sum + value, 0) / values.length;
    case TOTAL.min:
      return values.reduce((min, value) => Math.min(min, value));
    case TOTAL.max:
      return values.reduce((max, value) => Math.max(max, value));
    case TOTAL.count:
      return values.length;
  }
}

/** Total of one column. A single unknown value makes the whole total unknown. */
export function columnTotal<Row>(column: ColumnDef<Row>, rows: readonly Row[]): TotalValue | undefined {
  const kind = column.total;
  if (kind === undefined) return undefined;
  if (kind === TOTAL.count) return { value: rows.length, unknown: false };
  const numbers: number[] = [];
  for (const row of rows) {
    const number = toNumber(column.value(row));
    if (number === null) return { value: null, unknown: true };
    numbers.push(number);
  }
  return { value: aggregate(kind, numbers), unknown: false };
}

export function computeTotals<Row>(rows: readonly Row[], columns: readonly ColumnDef<Row>[]): Record<string, TotalValue> {
  const totals: Record<string, TotalValue> = {};
  for (const column of columns) {
    const total = columnTotal(column, rows);
    if (total !== undefined) totals[column.id] = total;
  }
  return totals;
}
