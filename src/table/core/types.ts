import type { ReactNode } from 'react';

/** Value kinds a column can hold. Each kind brings defaults: alignment, width, first sort, filter. */
export const COLUMN_TYPE = {
  text: 'text',
  number: 'number',
  money: 'money',
  percent: 'percent',
  date: 'date',
  datetime: 'datetime',
  status: 'status',
} as const;
export type ColumnType = (typeof COLUMN_TYPE)[keyof typeof COLUMN_TYPE];

export const PIN = { start: 'start', end: 'end' } as const;
export type Pin = (typeof PIN)[keyof typeof PIN];

export const ALIGN = { start: 'start', end: 'end' } as const;
export type Align = (typeof ALIGN)[keyof typeof ALIGN];

export const SORT_DIRECTION = { asc: 'asc', desc: 'desc' } as const;
export type SortDirection = (typeof SORT_DIRECTION)[keyof typeof SORT_DIRECTION];

export const TOTAL = { sum: 'sum', avg: 'avg', min: 'min', max: 'max', count: 'count' } as const;
export type TotalKind = (typeof TOTAL)[keyof typeof TOTAL];

export const FILTER_KIND = { range: 'range', select: 'select', text: 'text', dateRange: 'dateRange' } as const;
export type FilterKind = (typeof FILTER_KIND)[keyof typeof FILTER_KIND];

export const DENSITY = { regular: 'regular', compact: 'compact' } as const;
export type Density = (typeof DENSITY)[keyof typeof DENSITY];

export const HIGHLIGHT = { max: 'max', min: 'min' } as const;
export type Highlight = (typeof HIGHLIGHT)[keyof typeof HIGHLIGHT];

export const PAGINATION = { none: 'none', pages: 'pages', more: 'more', infinite: 'infinite' } as const;
export type Pagination = (typeof PAGINATION)[keyof typeof PAGINATION];

export const CARD_ROLE = { title: 'title', value: 'value', meta: 'meta', badge: 'badge', hidden: 'hidden' } as const;
export type CardRole = (typeof CARD_ROLE)[keyof typeof CARD_ROLE];

export const DATA_MODE = { client: 'client', server: 'server' } as const;
export type DataMode = (typeof DATA_MODE)[keyof typeof DATA_MODE];

/** Raw cell value. `null` means "unknown" and renders as a dash with an optional reason. */
export type CellValue = string | number | Date | boolean | null;

export type StatusTone = 'neutral' | 'positive' | 'negative' | 'warning' | 'info' | 'accent';

export interface StatusOption {
  value: string;
  label: string;
  tone?: StatusTone;
}

/** What a custom renderer receives besides the row. */
export interface CellContext {
  value: CellValue;
  formatted: string;
  /** Share of the column maximum, 0..1, for columns with `bar` or `highlight`. */
  share: number | null;
  /** The value is the column's best (max or min, per `highlight`). */
  best: boolean;
}

export interface ColumnDef<Row> {
  id: string;
  title: string;
  type: ColumnType;
  value: (row: Row) => CellValue;
  format?: (value: Exclude<CellValue, null>) => string;
  render?: (row: Row, context: CellContext) => ReactNode;
  width?: number;
  minWidth?: number;
  /** Takes the remaining width. Default: the first text column. */
  grow?: boolean;
  pin?: Pin;
  hidden?: boolean;
  /** `false` keeps the column visible in settings. */
  hideable?: boolean;
  sortable?: boolean;
  /** Filter kind; `false` disables filtering. Default depends on type. */
  filter?: FilterKind | false;
  searchable?: boolean;
  options?: readonly StatusOption[];
  total?: TotalKind;
  /** Show a mini bar with the share of the column maximum. */
  bar?: boolean;
  highlight?: Highlight;
  fractionDigits?: number;
  /** ISO currency code for `money`; table default otherwise. */
  currency?: string;
  /** Explanation shown by the "?" button in the header. */
  description?: string;
  /** Why the value may be unknown; shown in the dash tooltip. */
  unknownReason?: string;
  card?: CardRole;
  cardLabel?: string;
}

export interface SortKey {
  columnId: string;
  direction: SortDirection;
}

export interface RangeFilter {
  kind: typeof FILTER_KIND.range;
  min: number | null;
  max: number | null;
}
export interface SelectFilter {
  kind: typeof FILTER_KIND.select;
  values: string[];
}
export interface TextFilter {
  kind: typeof FILTER_KIND.text;
  query: string;
}
/** Bounds are calendar days `YYYY-MM-DD`, inclusive. */
export interface DateRangeFilter {
  kind: typeof FILTER_KIND.dateRange;
  from: string | null;
  to: string | null;
}
export type FilterValue = RangeFilter | SelectFilter | TextFilter | DateRangeFilter;

export interface Grouping<Row> {
  id: string;
  label: string;
  key: (row: Row) => string;
  title?: (key: string, rows: readonly Row[]) => string;
}

export interface ViewToggle {
  id: string;
  label: string;
  description?: string;
  defaultValue?: boolean;
}

export interface TableState {
  sort: SortKey[];
  filters: Record<string, FilterValue>;
  search: string;
  order: string[];
  hidden: string[];
  pins: Record<string, Pin | null>;
  widths: Record<string, number>;
  density: Density;
  groupBy: string | null;
  collapsed: string[];
  selected: string[];
  expanded: string[];
  page: number;
  pageSize: number;
  view: Record<string, boolean>;
}

/** The part of the state that is a user preference and survives reloads. */
export const PERSISTED_KEYS = ['sort', 'order', 'hidden', 'pins', 'widths', 'density', 'groupBy', 'pageSize', 'view'] as const;
export type PersistedKey = (typeof PERSISTED_KEYS)[number];
export type TableSettings = Pick<TableState, PersistedKey>;

export interface TotalValue {
  value: number | null;
  /** Some rows have no value: a total would lie, so it is not shown. */
  unknown: boolean;
}

export interface Extent {
  min: number;
  max: number;
}

export interface RowItem<Row> {
  kind: 'row';
  key: string;
  row: Row;
  depth: 0 | 1;
  groupKey: string | null;
}

export interface GroupItem {
  kind: 'group';
  key: string;
  groupKey: string;
  title: string;
  count: number;
  totals: Record<string, TotalValue>;
  expanded: boolean;
}

export type TableItem<Row> = RowItem<Row> | GroupItem;

export interface TableModel<Row> {
  /** What the body renders now (page or window applied). */
  items: TableItem<Row>[];
  /** Rows after filters and search, sorted. */
  matched: Row[];
  totalCount: number;
  matchedCount: number;
  itemCount: number;
  pageCount: number;
  totals: Record<string, TotalValue>;
  extents: Record<string, Extent>;
}
