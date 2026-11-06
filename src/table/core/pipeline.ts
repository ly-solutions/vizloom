import { filterKindOf, isNumericType, isSearchable } from './columns';
import { formatCell, normalizeSearch, type TableFormatOptions } from './format';
import {
  COLUMN_TYPE,
  FILTER_KIND,
  PAGINATION,
  SORT_DIRECTION,
  type CellValue,
  type ColumnDef,
  type DataMode,
  type DateRangeFilter,
  type Extent,
  type FilterKind,
  type FilterValue,
  type Grouping,
  type Pagination,
  type RangeFilter,
  type SortKey,
  type TableItem,
  type TableModel,
  type TableState,
} from './types';
import { computeTotals, isMissing, parseDay, toNumber, toTime } from './values';

// ---------- filters ----------

const EMPTY_FILTERS = {
  [FILTER_KIND.range]: { kind: FILTER_KIND.range, min: null, max: null },
  [FILTER_KIND.select]: { kind: FILTER_KIND.select, values: [] },
  [FILTER_KIND.text]: { kind: FILTER_KIND.text, query: '' },
  [FILTER_KIND.dateRange]: { kind: FILTER_KIND.dateRange, from: null, to: null },
} as const satisfies Record<FilterKind, FilterValue>;

export function emptyFilter(kind: FilterKind): FilterValue {
  const empty = EMPTY_FILTERS[kind];
  return empty.kind === FILTER_KIND.select ? { kind: FILTER_KIND.select, values: [] } : { ...empty };
}

/** The filter narrows rows: an empty range or selection is no filter at all. */
export function isFilterActive(filter: FilterValue): boolean {
  switch (filter.kind) {
    case FILTER_KIND.range:
      return filter.min !== null || filter.max !== null;
    case FILTER_KIND.select:
      return filter.values.length > 0;
    case FILTER_KIND.text:
      return filter.query.trim() !== '';
    case FILTER_KIND.dateRange:
      return filter.from !== null || filter.to !== null;
  }
}

function dayBound(day: string, end: boolean): number {
  const parsed = parseDay(day);
  if (parsed === null) {
    throw new Error(`DataTable: date filter bound must be a real day in YYYY-MM-DD format, got "${day}"`);
  }
  return end
    ? new Date(parsed.year, parsed.month, parsed.day, 23, 59, 59, 999).getTime()
    : new Date(parsed.year, parsed.month, parsed.day).getTime();
}

function matchRange(value: CellValue, filter: RangeFilter): boolean {
  const number = toNumber(value);
  if (number === null) return false;
  if (filter.min !== null && number < filter.min) return false;
  return filter.max === null || number <= filter.max;
}

function matchDates(value: CellValue, filter: DateRangeFilter): boolean {
  const time = toTime(value);
  if (time === null) return false;
  if (filter.from !== null && time < dayBound(filter.from, false)) return false;
  return filter.to === null || time <= dayBound(filter.to, true);
}

export function matchFilter<Row>(column: ColumnDef<Row>, value: CellValue, filter: FilterValue, format: TableFormatOptions): boolean {
  if (!isFilterActive(filter)) return true;
  if (value === null) return false;
  switch (filter.kind) {
    case FILTER_KIND.range:
      return matchRange(value, filter);
    case FILTER_KIND.select:
      return filter.values.includes(String(value));
    case FILTER_KIND.text: {
      const query = normalizeSearch(filter.query.trim());
      return normalizeSearch(formatCell(column, value, format)).includes(query) || normalizeSearch(String(value)).includes(query);
    }
    case FILTER_KIND.dateRange:
      return matchDates(value, filter);
  }
}

export function filterRows<Row>(
  rows: readonly Row[],
  columns: readonly ColumnDef<Row>[],
  filters: Record<string, FilterValue>,
  search: string,
  format: TableFormatOptions,
): Row[] {
  const byId = new Map(columns.map((column) => [column.id, column]));
  const active = Object.entries(filters).flatMap(([id, filter]) => {
    const column = byId.get(id);
    return column !== undefined && isFilterActive(filter) ? [{ column, filter }] : [];
  });
  const query = normalizeSearch(search.trim());
  const searchable = query === '' ? [] : columns.filter((column) => isSearchable(column));
  if (active.length === 0 && query === '') return rows.slice();
  return rows.filter((row) => {
    for (const { column, filter } of active) {
      if (!matchFilter(column, column.value(row), filter, format)) return false;
    }
    if (query === '') return true;
    return searchable.some((column) => {
      const value = column.value(row);
      return value !== null && normalizeSearch(formatCell(column, value, format)).includes(query);
    });
  });
}

/** How many rows carry each value: the counters next to select-filter options. */
export function countValues<Row>(rows: readonly Row[], column: ColumnDef<Row>): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const value = column.value(row);
    if (value !== null) {
      const key = String(value);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return counts;
}

/** Filterable columns of the table, in display order. */
export function filterableColumns<Row>(columns: readonly ColumnDef<Row>[]): ColumnDef<Row>[] {
  return columns.filter((column) => filterKindOf(column) !== null);
}

// ---------- sorting ----------

const collators = new Map<string, Intl.Collator>();

function collator(locale: string): Intl.Collator {
  let value = collators.get(locale);
  if (value === undefined) {
    value = new Intl.Collator(locale, { numeric: true, sensitivity: 'base' });
    collators.set(locale, value);
  }
  return value;
}

function compareNumbers(a: number | null, b: number | null): number {
  if (a === null) return b === null ? 0 : 1;
  if (b === null) return -1;
  return a - b;
}

function compareValues<Row>(column: ColumnDef<Row>, a: CellValue, b: CellValue, locale: string): number {
  switch (column.type) {
    case COLUMN_TYPE.number:
    case COLUMN_TYPE.money:
    case COLUMN_TYPE.percent:
      return compareNumbers(toNumber(a), toNumber(b));
    case COLUMN_TYPE.date:
    case COLUMN_TYPE.datetime:
      return compareNumbers(toTime(a), toTime(b));
    case COLUMN_TYPE.status: {
      // Statuses sort in the declared order of options, unknown ones alphabetically after.
      const options = column.options ?? [];
      const ia = options.findIndex((option) => option.value === String(a));
      const ib = options.findIndex((option) => option.value === String(b));
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return collator(locale).compare(String(a), String(b));
    }
    case COLUMN_TYPE.text:
      return collator(locale).compare(String(a), String(b));
  }
}

/** Stable multi-key sort. Missing values always go last whatever the direction. */
export function sortRows<Row>(rows: readonly Row[], columns: readonly ColumnDef<Row>[], sort: readonly SortKey[], locale: string): Row[] {
  const byId = new Map(columns.map((column) => [column.id, column]));
  const keys = sort.flatMap((key) => {
    const column = byId.get(key.columnId);
    return column === undefined ? [] : [{ column, descending: key.direction === SORT_DIRECTION.desc }];
  });
  if (keys.length === 0) return rows.slice();
  const decorated = rows.map((row, index) => ({
    row,
    index,
    values: keys.map((key) => key.column.value(row)),
  }));
  decorated.sort((left, right) => {
    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i]!;
      const a = left.values[i] ?? null;
      const b = right.values[i] ?? null;
      const missingA = isMissing(key.column, a);
      const missingB = isMissing(key.column, b);
      if (missingA || missingB) {
        if (missingA && missingB) continue;
        return missingA ? 1 : -1;
      }
      const result = compareValues(key.column, a, b, locale);
      if (result !== 0) return key.descending ? -result : result;
    }
    return left.index - right.index;
  });
  return decorated.map((entry) => entry.row);
}

// ---------- extents ----------

/** Min and max of numeric columns that draw bars or highlight the best value. */
export function computeExtents<Row>(rows: readonly Row[], columns: readonly ColumnDef<Row>[]): Record<string, Extent> {
  const extents: Record<string, Extent> = {};
  for (const column of columns) {
    if (!isNumericType(column.type) || (column.bar !== true && column.highlight === undefined)) continue;
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (const row of rows) {
      const number = toNumber(column.value(row));
      if (number !== null) {
        min = Math.min(min, number);
        max = Math.max(max, number);
      }
    }
    if (Number.isFinite(min) && Number.isFinite(max)) extents[column.id] = { min, max };
  }
  return extents;
}

/** Share of the column maximum, 0..1; null for negatives or an empty extent. */
export function shareOf(value: CellValue, extent: Extent | undefined): number | null {
  const number = toNumber(value);
  if (number === null || extent === undefined || extent.max <= 0 || number < 0) return null;
  return Math.min(1, number / extent.max);
}

export function isBest<Row>(column: ColumnDef<Row>, value: CellValue, extent: Extent | undefined): boolean {
  const number = toNumber(value);
  if (column.highlight === undefined || extent === undefined || number === null) return false;
  return column.highlight === 'max' ? number === extent.max : number === extent.min;
}

// ---------- grouping & pages ----------

function groupItems<Row>(
  rows: readonly Row[],
  grouping: Grouping<Row>,
  columns: readonly ColumnDef<Row>[],
  rowKey: (row: Row) => string,
  collapsed: readonly string[],
): TableItem<Row>[] {
  const groups = new Map<string, Row[]>();
  for (const row of rows) {
    const key = grouping.key(row);
    const list = groups.get(key);
    if (list === undefined) groups.set(key, [row]);
    else list.push(row);
  }
  const items: TableItem<Row>[] = [];
  for (const [groupKey, groupRows] of groups) {
    const expanded = !collapsed.includes(groupKey);
    items.push({
      kind: 'group',
      key: `group:${groupKey}`,
      groupKey,
      title: grouping.title?.(groupKey, groupRows) ?? groupKey,
      count: groupRows.length,
      totals: computeTotals(groupRows, columns),
      expanded,
    });
    if (expanded) {
      for (const row of groupRows) items.push({ kind: 'row', key: rowKey(row), row, depth: 1, groupKey });
    }
  }
  return items;
}

function flatItems<Row>(rows: readonly Row[], rowKey: (row: Row) => string): TableItem<Row>[] {
  return rows.map((row) => ({ kind: 'row', key: rowKey(row), row, depth: 0, groupKey: null }));
}

export function pageCountOf(count: number, pageSize: number, pagination: Pagination): number {
  return pagination === PAGINATION.none ? 1 : Math.max(1, Math.ceil(count / pageSize));
}

function sliceItems<T>(items: readonly T[], page: number, pageSize: number, pagination: Pagination, pageCount: number): T[] {
  switch (pagination) {
    case PAGINATION.none:
      return items.slice();
    case PAGINATION.pages: {
      const index = Math.min(Math.max(page, 0), pageCount - 1);
      return items.slice(index * pageSize, (index + 1) * pageSize);
    }
    case PAGINATION.more:
    case PAGINATION.infinite:
      return items.slice(0, (Math.max(page, 0) + 1) * pageSize);
  }
}

export interface ModelInput<Row> {
  rows: readonly Row[];
  columns: readonly ColumnDef<Row>[];
  rowKey: (row: Row) => string;
  state: TableState;
  groupings?: readonly Grouping<Row>[];
  pagination: Pagination;
  mode: DataMode;
  /** Server mode: all rows on the server. */
  rowCount?: number;
  format: TableFormatOptions;
}

/** Everything the table renders, derived from rows and state. Pure. */
export function buildModel<Row>(input: ModelInput<Row>): TableModel<Row> {
  const { rows, columns, rowKey, state, groupings, pagination, mode, rowCount, format } = input;
  if (pagination !== PAGINATION.none && (!Number.isInteger(state.pageSize) || state.pageSize < 1)) {
    throw new RangeError(`DataTable: pageSize must be a positive integer, got ${state.pageSize}`);
  }
  if (mode === 'server') {
    // The server already filtered, sorted and paged: rows are shown as they came.
    const total = rowCount ?? rows.length;
    return {
      items: flatItems(rows, rowKey),
      matched: rows.slice(),
      totalCount: total,
      matchedCount: total,
      itemCount: rows.length,
      pageCount: pageCountOf(total, state.pageSize, pagination),
      totals: computeTotals(rows, columns),
      extents: computeExtents(rows, columns),
    };
  }
  const matched = sortRows(filterRows(rows, columns, state.filters, state.search, format), columns, state.sort, format.locale);
  const grouping = state.groupBy === null ? undefined : groupings?.find((g) => g.id === state.groupBy);
  const all = grouping === undefined ? flatItems(matched, rowKey) : groupItems(matched, grouping, columns, rowKey, state.collapsed);
  const pageCount = pageCountOf(all.length, state.pageSize, pagination);
  return {
    items: sliceItems(all, state.page, state.pageSize, pagination, pageCount),
    matched,
    totalCount: rows.length,
    matchedCount: matched.length,
    itemCount: all.length,
    pageCount,
    totals: computeTotals(matched, columns),
    extents: computeExtents(matched, columns),
  };
}
