import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';

import { useLocale } from '../../core/theme/provider';

import { firstSortOf, growColumnId, isHideable, orderedColumns, pinOf, visibleColumns, widthOf } from '../core/columns';
import type { TableFormatOptions } from '../core/format';
import { buildModel, isFilterActive } from '../core/pipeline';
import { browserStorage, readSettings, serializeSettings, writeSettings, type SettingsStorage } from '../core/persist';
import { createInitialState, pickSettings, tableReducer, type TableAction } from '../core/state';
import {
  DATA_MODE,
  PAGINATION,
  type ColumnDef,
  type DataMode,
  type Density,
  type FilterValue,
  type Grouping,
  type Pagination,
  type Pin,
  type SortKey,
  type TableModel,
  type TableState,
  type ViewToggle,
} from '../core/types';

export interface UseDataTableOptions<Row> {
  columns: ColumnDef<Row>[];
  rows: readonly Row[];
  rowKey: (row: Row) => string;
  /** `server`: rows arrive filtered, sorted and paged; the table only reports state changes. */
  mode?: DataMode;
  /** Server mode: how many rows exist in total. */
  rowCount?: number;
  groupings?: readonly Grouping<Row>[];
  viewToggles?: readonly ViewToggle[];
  pagination?: Pagination;
  pageSize?: number;
  defaultGroupBy?: string | null;
  defaultSort?: SortKey[];
  defaultDensity?: Density;
  selectable?: boolean;
  /** Rows can open an inline detail area. */
  expandable?: boolean | ((row: Row) => boolean);
  /** Saves column settings, sort, density and the like under this key. */
  storageKey?: string;
  storage?: SettingsStorage | null;
  /** Controlled state; pair with `onStateChange`. */
  state?: TableState;
  onStateChange?: (state: TableState) => void;
  /** BCP 47 tag for number and date formatting. Default: the `VizProvider` locale. */
  locale?: string;
  /** ISO 4217 code for money columns without their own `currency`. Default: USD. */
  currency?: string;
}

export interface ActiveFilter<Row> {
  column: ColumnDef<Row>;
  filter: FilterValue;
}

export interface DataTableInstance<Row> {
  columns: ColumnDef<Row>[];
  /** All columns in the user's order, hidden ones included. */
  ordered: ColumnDef<Row>[];
  visible: ColumnDef<Row>[];
  state: TableState;
  model: TableModel<Row>;
  rows: readonly Row[];
  rowKey: (row: Row) => string;
  mode: DataMode;
  pagination: Pagination;
  selectable: boolean;
  isExpandable: (row: Row) => boolean;
  groupings: readonly Grouping<Row>[];
  viewToggles: readonly ViewToggle[];
  growId: string | null;
  activeFilters: ActiveFilter<Row>[];
  selectedRows: Row[];
  /** Settings differ from the initial ones: the settings button shows it. */
  customized: boolean;
  format: TableFormatOptions;
  dispatch: (action: TableAction) => void;
  pinOf: (column: ColumnDef<Row>) => Pin | null;
  widthOf: (column: ColumnDef<Row>) => number;
  toggleSort: (columnId: string, additive?: boolean) => void;
  setSort: (sort: SortKey[]) => void;
  setFilter: (columnId: string, filter: FilterValue | null) => void;
  clearFilters: () => void;
  setSearch: (search: string) => void;
  setHidden: (columnId: string, hidden: boolean) => void;
  setOrder: (order: string[]) => void;
  moveColumn: (columnId: string, toIndex: number) => void;
  setPin: (columnId: string, pin: Pin | null) => void;
  setWidth: (columnId: string, width: number) => void;
  setDensity: (density: Density) => void;
  setGroupBy: (groupBy: string | null) => void;
  toggleGroup: (groupKey: string) => void;
  setAllGroupsCollapsed: (collapsed: boolean) => void;
  toggleRow: (key: string) => void;
  selectAll: (selected: boolean) => void;
  setSelected: (keys: string[]) => void;
  toggleExpanded: (key: string) => void;
  setExpanded: (keys: string[]) => void;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  setView: (id: string, value: boolean) => void;
  resetSettings: () => void;
}

const NONE: readonly never[] = [];

/**
 * Headless table: state, derived rows and actions. Render it with `DataTable` or with your own
 * markup. Rows and columns should be stable references (memoize them) — the model is recomputed
 * only when they or the state change.
 */
export function useDataTable<Row>(options: UseDataTableOptions<Row>): DataTableInstance<Row> {
  const {
    columns,
    rows,
    rowKey,
    mode = DATA_MODE.client,
    rowCount,
    groupings = NONE,
    viewToggles = NONE,
    pagination = PAGINATION.none,
    pageSize,
    defaultGroupBy = null,
    defaultSort,
    defaultDensity,
    selectable = false,
    expandable = false,
    storageKey,
    storage: storageOption,
    state: controlled,
    onStateChange,
    locale: localeOption,
    currency = 'USD',
  } = options;
  const providerLocale = useLocale();
  const locale = localeOption ?? providerLocale.code;

  const rowKeyRef = useRef(rowKey);
  rowKeyRef.current = rowKey;
  const stableRowKey = useCallback((row: Row) => rowKeyRef.current(row), []);

  const storage = useMemo(() => (storageOption === undefined ? browserStorage() : storageOption), [storageOption]);

  // Initial state depends on columns only: other defaults are read once, like useState.
  const initial = useMemo(
    () =>
      createInitialState(columns, {
        groupBy: defaultGroupBy,
        viewToggles,
        pageSize,
        density: defaultDensity,
        sort: defaultSort,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [columns],
  );

  const [own, dispatchOwn] = useReducer(tableReducer, initial, (base) => {
    const saved = readSettings(storage, storageKey, columns);
    return saved === null ? base : tableReducer(base, { type: 'applySettings', settings: saved });
  });

  const state = controlled ?? own;
  const stateRef = useRef(state);
  stateRef.current = state;
  const onChangeRef = useRef(onStateChange);
  onChangeRef.current = onStateChange;
  const isControlled = useRef(controlled !== undefined);
  isControlled.current = controlled !== undefined;

  const dispatch = useCallback((action: TableAction) => {
    const next = tableReducer(stateRef.current, action);
    if (next === stateRef.current) return;
    stateRef.current = next;
    if (!isControlled.current) dispatchOwn({ type: 'replace', state: next });
    onChangeRef.current?.(next);
  }, []);

  const serialized = useMemo(() => serializeSettings(columns, pickSettings(state)), [columns, state]);
  useEffect(() => writeSettings(storage, storageKey, serialized), [storage, storageKey, serialized]);
  const customized = useMemo(() => serializeSettings(columns, pickSettings(initial)) !== serialized, [columns, initial, serialized]);

  const format = useMemo<TableFormatOptions>(() => ({ locale, currency }), [locale, currency]);

  const model = useMemo(
    () => buildModel({ rows, columns, rowKey: stableRowKey, state, groupings, pagination, mode, rowCount, format }),
    [rows, columns, stableRowKey, state, groupings, pagination, mode, rowCount, format],
  );
  const ordered = useMemo(() => orderedColumns(columns, state), [columns, state]);
  const visible = useMemo(() => visibleColumns(columns, state), [columns, state]);
  const growId = useMemo(() => growColumnId(columns), [columns]);

  const activeFilters = useMemo(() => {
    const result: ActiveFilter<Row>[] = [];
    for (const column of ordered) {
      const filter = state.filters[column.id];
      if (filter !== undefined && isFilterActive(filter)) result.push({ column, filter });
    }
    return result;
  }, [ordered, state.filters]);

  const selectedRows = useMemo(() => {
    if (state.selected.length === 0) return [];
    const keys = new Set(state.selected);
    return rows.filter((row) => keys.has(stableRowKey(row)));
  }, [rows, stableRowKey, state.selected]);

  const matchedRef = useRef(model.matched);
  matchedRef.current = model.matched;
  const groupKeys = useMemo(() => {
    const grouping = groupings.find((item) => item.id === state.groupBy);
    return grouping === undefined ? [] : [...new Set(model.matched.map((row) => grouping.key(row)))];
  }, [groupings, state.groupBy, model.matched]);
  const groupKeysRef = useRef(groupKeys);
  groupKeysRef.current = groupKeys;

  const expandableRef = useRef(expandable);
  expandableRef.current = expandable;
  const isExpandable = useCallback((row: Row) => {
    const value = expandableRef.current;
    return typeof value === 'function' ? value(row) : value;
  }, []);

  return useMemo<DataTableInstance<Row>>(
    () => ({
      columns,
      ordered,
      visible,
      state,
      model,
      rows,
      rowKey: stableRowKey,
      mode,
      pagination,
      selectable,
      isExpandable,
      groupings,
      viewToggles,
      growId,
      activeFilters,
      selectedRows,
      customized,
      format,
      dispatch,
      pinOf: (column) => pinOf(column, state),
      widthOf: (column) => widthOf(column, state),
      toggleSort: (columnId, additive = false) => {
        const column = columns.find((item) => item.id === columnId);
        if (column !== undefined) {
          dispatch({ type: 'toggleSort', columnId, firstDirection: firstSortOf(column), additive });
        }
      },
      setSort: (sort) => dispatch({ type: 'setSort', sort }),
      setFilter: (columnId, filter) => dispatch({ type: 'setFilter', columnId, filter }),
      clearFilters: () => dispatch({ type: 'clearFilters' }),
      setSearch: (search) => dispatch({ type: 'setSearch', search }),
      setHidden: (columnId, hidden) => {
        const column = columns.find((item) => item.id === columnId);
        if (column !== undefined && hidden && !isHideable(column)) return;
        dispatch({ type: 'setHidden', columnId, hidden });
      },
      setOrder: (order) => dispatch({ type: 'setOrder', order }),
      moveColumn: (columnId, toIndex) => dispatch({ type: 'moveColumn', columnId, toIndex }),
      setPin: (columnId, pin) => dispatch({ type: 'setPin', columnId, pin }),
      setWidth: (columnId, width) => dispatch({ type: 'setWidth', columnId, width }),
      setDensity: (density) => dispatch({ type: 'setDensity', density }),
      setGroupBy: (groupBy) => dispatch({ type: 'setGroupBy', groupBy }),
      toggleGroup: (groupKey) => dispatch({ type: 'toggleGroup', groupKey }),
      setAllGroupsCollapsed: (collapsed) => dispatch({ type: 'setCollapsed', collapsed: collapsed ? groupKeysRef.current : [] }),
      toggleRow: (key) => dispatch({ type: 'toggleRow', key }),
      selectAll: (selected) => dispatch({ type: 'setSelected', selected: selected ? matchedRef.current.map(stableRowKey) : [] }),
      setSelected: (keys) => dispatch({ type: 'setSelected', selected: keys }),
      toggleExpanded: (key) => dispatch({ type: 'toggleExpanded', key }),
      setExpanded: (keys) => dispatch({ type: 'setExpanded', expanded: keys }),
      setPage: (page) => dispatch({ type: 'setPage', page }),
      setPageSize: (size) => dispatch({ type: 'setPageSize', pageSize: size }),
      setView: (id, value) => dispatch({ type: 'setView', id, value }),
      resetSettings: () => dispatch({ type: 'resetSettings', initial }),
    }),
    [
      columns,
      ordered,
      visible,
      state,
      model,
      rows,
      stableRowKey,
      mode,
      pagination,
      selectable,
      isExpandable,
      groupings,
      viewToggles,
      growId,
      activeFilters,
      selectedRows,
      customized,
      format,
      dispatch,
      initial,
    ],
  );
}
