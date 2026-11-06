/**
 * vizloom/table — data tables.
 *
 * Two layers: a headless core (`useDataTable` + pure functions: filter, sort, group, page,
 * totals, persistence, export) that any markup can use, and the ready `DataTable` with its
 * toolbar, panels and cells. Styles: `vizloom/table.css` (or `vizloom/styles.css`).
 */

// Headless core: types
export {
  ALIGN,
  CARD_ROLE,
  COLUMN_TYPE,
  DATA_MODE,
  DENSITY,
  FILTER_KIND,
  HIGHLIGHT,
  PAGINATION,
  PERSISTED_KEYS,
  PIN,
  SORT_DIRECTION,
  TOTAL,
} from './core/types';
export type {
  Align,
  CardRole,
  CellContext,
  CellValue,
  ColumnDef,
  ColumnType,
  DataMode,
  DateRangeFilter,
  Density,
  Extent,
  FilterKind,
  FilterValue,
  GroupItem,
  Grouping,
  Highlight,
  Pagination,
  Pin,
  RangeFilter,
  RowItem,
  SelectFilter,
  SortDirection,
  SortKey,
  StatusOption,
  StatusTone,
  TableItem,
  TableModel,
  TableSettings,
  TableState,
  TextFilter,
  TotalKind,
  TotalValue,
  ViewToggle,
} from './core/types';

// Headless core: functions
export {
  TYPE_DEFAULTS,
  MAX_COLUMN_WIDTH,
  alignOf,
  defineColumns,
  filterKindOf,
  growColumnId,
  isHideable,
  isSearchable,
  isSortable,
  minWidthOf,
  orderedColumns,
  pinOf,
  visibleColumns,
  widthOf,
} from './core/columns';
export { MISSING_VALUE, formatCell, formatCount, formatTotal, type TableFormatOptions } from './core/format';
export {
  buildModel,
  computeExtents,
  countValues,
  emptyFilter,
  filterRows,
  isBest,
  isFilterActive,
  matchFilter,
  shareOf,
  sortRows,
  type ModelInput,
} from './core/pipeline';
export {
  DEFAULT_PAGE_SIZE,
  createInitialState,
  nextSort,
  pickSettings,
  tableReducer,
  type InitialStateOptions,
  type TableAction,
} from './core/state';
export { SETTINGS_VERSION, browserStorage, parseSettings, serializeSettings, type SettingsStorage } from './core/persist';
export { downloadText, toCsv, toExportData, type CsvOptions, type ExportCell, type ExportData } from './core/export';
export { CHANGE_DIRECTION, diffRows, indexRows, type CellChange, type ChangeDirection } from './core/live';
export { TABLE_STRINGS_EN, TABLE_STRINGS_RU, tableStringsFor, type TableStrings } from './core/strings';
export { columnTotal, computeTotals } from './core/values';

// React: headless hook and DOM helpers
export { useDataTable, type ActiveFilter, type DataTableInstance, type UseDataTableOptions } from './react/use-data-table';
export {
  cssVars,
  measureColumn,
  useColumnResize,
  useElementWidth,
  useInfiniteLoad,
  useScrollEdges,
  useVirtualRows,
  type ScrollOverflow,
  type VirtualWindow,
} from './react/dom-hooks';

// React: components
export { DataTable, NARROW_LAYOUT, type DataTableProps, type NarrowLayout, type TableStateMessage } from './react/data-table';
export {
  ColumnFilterPanel,
  DataTableToolbar,
  EXPORT_FORMAT,
  FilterChips,
  FiltersPanel,
  SettingsPanel,
  describeFilter,
  type DataTableToolbarProps,
  type ExportFormat,
} from './react/panels';
export { Checkbox, Menu, Popover, type MenuEntry, type MenuItem } from './react/overlay';
export {
  AvatarCell,
  BarCell,
  DeltaCell,
  DotCell,
  LinkCell,
  PillCell,
  ProgressCell,
  SparklineCell,
  type SparklineCellProps,
  StatusCell,
  TwoLineCell,
  UnknownCell,
  safeHref,
} from './react/cells';
