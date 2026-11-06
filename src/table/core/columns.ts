import {
  ALIGN,
  CARD_ROLE,
  COLUMN_TYPE,
  FILTER_KIND,
  SORT_DIRECTION,
  type Align,
  type CardRole,
  type ColumnDef,
  type ColumnType,
  type FilterKind,
  type Pin,
  type SortDirection,
  type TableState,
} from './types';

interface TypeDefaults {
  align: Align;
  width: number;
  minWidth: number;
  firstSort: SortDirection;
  filter: FilterKind | null;
  searchable: boolean;
  /** Skeleton width in characters while loading. */
  skeletonCh: number;
}

/** Per-type defaults: numbers sit right and sort high-to-low first, text sorts A-Z first. */
export const TYPE_DEFAULTS = {
  [COLUMN_TYPE.text]: {
    align: ALIGN.start,
    width: 240,
    minWidth: 160,
    firstSort: SORT_DIRECTION.asc,
    filter: FILTER_KIND.text,
    searchable: true,
    skeletonCh: 14,
  },
  [COLUMN_TYPE.number]: {
    align: ALIGN.end,
    width: 112,
    minWidth: 72,
    firstSort: SORT_DIRECTION.desc,
    filter: FILTER_KIND.range,
    searchable: false,
    skeletonCh: 4,
  },
  [COLUMN_TYPE.money]: {
    align: ALIGN.end,
    width: 136,
    minWidth: 96,
    firstSort: SORT_DIRECTION.desc,
    filter: FILTER_KIND.range,
    searchable: false,
    skeletonCh: 7,
  },
  [COLUMN_TYPE.percent]: {
    align: ALIGN.end,
    width: 104,
    minWidth: 72,
    firstSort: SORT_DIRECTION.desc,
    filter: FILTER_KIND.range,
    searchable: false,
    skeletonCh: 4,
  },
  [COLUMN_TYPE.date]: {
    align: ALIGN.start,
    width: 120,
    minWidth: 96,
    firstSort: SORT_DIRECTION.desc,
    filter: FILTER_KIND.dateRange,
    searchable: false,
    skeletonCh: 6,
  },
  [COLUMN_TYPE.datetime]: {
    align: ALIGN.start,
    width: 160,
    minWidth: 128,
    firstSort: SORT_DIRECTION.desc,
    filter: FILTER_KIND.dateRange,
    searchable: false,
    skeletonCh: 10,
  },
  [COLUMN_TYPE.status]: {
    align: ALIGN.start,
    width: 152,
    minWidth: 112,
    firstSort: SORT_DIRECTION.asc,
    filter: FILTER_KIND.select,
    searchable: true,
    skeletonCh: 8,
  },
} as const satisfies Record<ColumnType, TypeDefaults>;

/** Upper bound for a resized column. */
export const MAX_COLUMN_WIDTH = 960;

/** Validates column ids once; returns the same array for inline use. */
export function defineColumns<Row>(columns: ColumnDef<Row>[]): ColumnDef<Row>[] {
  const seen = new Set<string>();
  for (const column of columns) {
    if (seen.has(column.id)) throw new Error(`DataTable: duplicate column id "${column.id}"`);
    seen.add(column.id);
  }
  return columns;
}

export function isNumericType(type: ColumnType): boolean {
  return type === COLUMN_TYPE.number || type === COLUMN_TYPE.money || type === COLUMN_TYPE.percent;
}

export function isDateType(type: ColumnType): boolean {
  return type === COLUMN_TYPE.date || type === COLUMN_TYPE.datetime;
}

export function alignOf<Row>(column: ColumnDef<Row>): Align {
  return TYPE_DEFAULTS[column.type].align;
}

export function filterKindOf<Row>(column: ColumnDef<Row>): FilterKind | null {
  if (column.filter === false) return null;
  if (column.filter !== undefined) return column.filter;
  if (column.type === COLUMN_TYPE.status) {
    return column.options !== undefined && column.options.length > 0 ? FILTER_KIND.select : null;
  }
  return TYPE_DEFAULTS[column.type].filter;
}

export function isSearchable<Row>(column: ColumnDef<Row>): boolean {
  return column.searchable ?? TYPE_DEFAULTS[column.type].searchable;
}

export function firstSortOf<Row>(column: ColumnDef<Row>): SortDirection {
  return TYPE_DEFAULTS[column.type].firstSort;
}

export function isSortable<Row>(column: ColumnDef<Row>): boolean {
  return column.sortable ?? true;
}

export function isHideable<Row>(column: ColumnDef<Row>): boolean {
  return column.hideable ?? true;
}

export function minWidthOf<Row>(column: ColumnDef<Row>): number {
  return column.minWidth ?? TYPE_DEFAULTS[column.type].minWidth;
}

export function skeletonChOf<Row>(column: ColumnDef<Row>): number {
  return TYPE_DEFAULTS[column.type].skeletonCh;
}

export function widthOf<Row>(column: ColumnDef<Row>, state: Pick<TableState, 'widths'>): number {
  const min = minWidthOf(column);
  const custom = Object.hasOwn(state.widths, column.id) ? state.widths[column.id] : undefined;
  if (custom !== undefined) return Math.max(custom, min);
  return Math.max(column.width ?? TYPE_DEFAULTS[column.type].width, min);
}

export function clampWidth(width: number, minWidth: number): number {
  return Math.min(MAX_COLUMN_WIDTH, Math.max(minWidth, Math.round(width)));
}

/** The column that takes the remaining width: explicit `grow`, else the first text column. */
export function growColumnId<Row>(columns: readonly ColumnDef<Row>[]): string | null {
  const explicit = columns.find((column) => column.grow === true);
  if (explicit !== undefined) return explicit.id;
  const text = columns.find((column) => column.type === COLUMN_TYPE.text);
  return text === undefined ? null : text.id;
}

export function pinOf<Row>(column: ColumnDef<Row>, state: Pick<TableState, 'pins'>): Pin | null {
  return Object.hasOwn(state.pins, column.id) ? (state.pins[column.id] ?? null) : (column.pin ?? null);
}

/** Columns in the user's order; columns unknown to the saved order go last in declared order. */
export function orderedColumns<Row>(columns: readonly ColumnDef<Row>[], state: Pick<TableState, 'order'>): ColumnDef<Row>[] {
  const byId = new Map(columns.map((column) => [column.id, column]));
  const used = new Set<string>();
  const result: ColumnDef<Row>[] = [];
  for (const id of state.order) {
    const column = byId.get(id);
    if (column !== undefined && !used.has(id)) {
      used.add(id);
      result.push(column);
    }
  }
  for (const column of columns) if (!used.has(column.id)) result.push(column);
  return result;
}

/** Visible columns, start-pinned first and end-pinned last. */
export function visibleColumns<Row>(
  columns: readonly ColumnDef<Row>[],
  state: Pick<TableState, 'order' | 'hidden' | 'pins'>,
): ColumnDef<Row>[] {
  const hidden = new Set(state.hidden);
  const shown = orderedColumns(columns, state).filter((column) => !hidden.has(column.id) || !isHideable(column));
  const start = shown.filter((column) => pinOf(column, state) === 'start');
  const middle = shown.filter((column) => pinOf(column, state) === null);
  const end = shown.filter((column) => pinOf(column, state) === 'end');
  return [...start, ...middle, ...end];
}

/** Role of the cell in the phone card layout. */
export function cardRoleOf<Row>(column: ColumnDef<Row>, index: number): CardRole {
  if (column.card !== undefined) return column.card;
  if (index === 0) return CARD_ROLE.title;
  return column.type === COLUMN_TYPE.status ? CARD_ROLE.badge : CARD_ROLE.meta;
}
