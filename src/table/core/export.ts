import { COLUMN_TYPE, type ColumnDef } from './types';
import { toNumber, toTime } from './values';

/** Typed cell for export: numbers stay numbers and dates stay dates, so a spreadsheet can sum them. */
export type ExportCell = string | number | Date | null;

export interface ExportData {
  header: string[];
  rows: ExportCell[][];
}

function exportCell<Row>(column: ColumnDef<Row>, row: Row): ExportCell {
  const value = column.value(row);
  if (value === null) return null;
  switch (column.type) {
    case COLUMN_TYPE.number:
    case COLUMN_TYPE.money:
    case COLUMN_TYPE.percent:
      return toNumber(value);
    case COLUMN_TYPE.date:
    case COLUMN_TYPE.datetime: {
      const time = toTime(value);
      return time === null ? null : new Date(time);
    }
    case COLUMN_TYPE.status: {
      const key = String(value);
      return column.options?.find((option) => option.value === key)?.label ?? key;
    }
    case COLUMN_TYPE.text:
      return String(value);
  }
}

/** Header and typed cells of the given rows and columns: feed it to CSV or any XLSX writer. */
export function toExportData<Row>(rows: readonly Row[], columns: readonly ColumnDef<Row>[]): ExportData {
  return {
    header: columns.map((column) => column.title),
    rows: rows.map((row) => columns.map((column) => exportCell(column, row))),
  };
}

export interface CsvOptions {
  /** `;` opens correctly in Excel with a comma decimal locale; `,` for everything else. */
  delimiter?: string;
  /** Decimal separator for numbers. */
  decimal?: string;
  /** Byte order mark so Excel reads UTF-8. */
  bom?: boolean;
}

/** Text that a spreadsheet would run as a formula: `=`, `+`, `-`, `@`, also full-width, tab, newline. */
const FORMULA_RE = /^[\s\u00a0\u3000]*[=+\-@＝＋－＠]|^[\t\r\n]/;

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function csvDate(date: Date): string {
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return date.getHours() !== 0 || date.getMinutes() !== 0 ? `${day} ${pad(date.getHours())}:${pad(date.getMinutes())}` : day;
}

function csvText(text: string, delimiter: string): string {
  const safe = FORMULA_RE.test(text) ? `'${text}` : text;
  const needsQuotes = safe.includes(delimiter) || /["\r\n]/.test(safe);
  return needsQuotes ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(data: ExportData, options: CsvOptions = {}): string {
  const delimiter = options.delimiter ?? ',';
  const decimal = options.decimal ?? '.';
  const cell = (value: ExportCell): string => {
    if (value === null) return '';
    if (typeof value === 'number') return decimal === '.' ? String(value) : String(value).replace('.', decimal);
    if (value instanceof Date) return csvDate(value);
    return csvText(value, delimiter);
  };
  const lines = [data.header.map((title) => csvText(title, delimiter)), ...data.rows.map((row) => row.map(cell))];
  return `${options.bom === false ? '' : '﻿'}${lines.map((line) => line.join(delimiter)).join('\r\n')}`;
}

/** Saves text as a file in the browser. No-op on the server. */
export function downloadText(text: string, fileName: string, mime = 'text/csv;charset=utf-8'): void {
  if (typeof document === 'undefined') return;
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.rel = 'noopener';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
