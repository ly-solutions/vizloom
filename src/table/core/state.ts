import { isFilterActive } from './pipeline';
import {
  DENSITY,
  PERSISTED_KEYS,
  SORT_DIRECTION,
  type ColumnDef,
  type Density,
  type FilterValue,
  type Pin,
  type SortDirection,
  type SortKey,
  type TableSettings,
  type TableState,
  type ViewToggle,
} from './types';

export const DEFAULT_PAGE_SIZE = 50;

export interface InitialStateOptions {
  sort?: SortKey[];
  groupBy?: string | null;
  density?: Density;
  pageSize?: number;
  viewToggles?: readonly ViewToggle[];
}

export function createInitialState<Row>(columns: readonly ColumnDef<Row>[], options: InitialStateOptions = {}): TableState {
  const view: Record<string, boolean> = {};
  for (const toggle of options.viewToggles ?? []) view[toggle.id] = toggle.defaultValue ?? false;
  return {
    sort: options.sort ?? [],
    filters: {},
    search: '',
    order: columns.map((column) => column.id),
    hidden: columns.filter((column) => column.hidden === true).map((column) => column.id),
    pins: {},
    widths: {},
    density: options.density ?? DENSITY.regular,
    groupBy: options.groupBy ?? null,
    collapsed: [],
    selected: [],
    expanded: [],
    page: 0,
    pageSize: options.pageSize ?? DEFAULT_PAGE_SIZE,
    view,
  };
}

export type TableAction =
  /** Header click. `additive` (Shift+click) adds or cycles one key of a multi-sort. */
  | { type: 'toggleSort'; columnId: string; firstDirection: SortDirection; additive?: boolean }
  | { type: 'setSort'; sort: SortKey[] }
  | { type: 'setFilter'; columnId: string; filter: FilterValue | null }
  | { type: 'clearFilters' }
  | { type: 'setSearch'; search: string }
  | { type: 'setHidden'; columnId: string; hidden: boolean }
  | { type: 'setOrder'; order: string[] }
  | { type: 'moveColumn'; columnId: string; toIndex: number }
  | { type: 'setPin'; columnId: string; pin: Pin | null }
  | { type: 'setWidth'; columnId: string; width: number }
  | { type: 'setDensity'; density: Density }
  | { type: 'setGroupBy'; groupBy: string | null }
  | { type: 'toggleGroup'; groupKey: string }
  | { type: 'setCollapsed'; collapsed: string[] }
  | { type: 'toggleRow'; key: string }
  | { type: 'setSelected'; selected: string[] }
  | { type: 'toggleExpanded'; key: string }
  | { type: 'setExpanded'; expanded: string[] }
  | { type: 'setPage'; page: number }
  | { type: 'setPageSize'; pageSize: number }
  | { type: 'setView'; id: string; value: boolean }
  | { type: 'applySettings'; settings: Partial<TableSettings> }
  | { type: 'resetSettings'; initial: TableState }
  | { type: 'replace'; state: TableState };

export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, index) => deepEqual(item, b[index]));
  }
  if (typeof a === 'object' && typeof b === 'object' && a !== null && b !== null && !Array.isArray(a) && !Array.isArray(b)) {
    const left = a as Record<string, unknown>;
    const right = b as Record<string, unknown>;
    const keys = Object.keys(left);
    return keys.length === Object.keys(right).length && keys.every((key) => Object.hasOwn(right, key) && deepEqual(left[key], right[key]));
  }
  return false;
}

function changes(state: TableState, patch: Partial<TableState>): boolean {
  return Object.entries(patch).some(([key, value]) => !deepEqual(state[key as keyof TableState], value));
}

/** Patch that keeps the page. Returns the same object when nothing changes, so React skips the render. */
function merge(state: TableState, patch: Partial<TableState>): TableState {
  return changes(state, patch) ? { ...state, ...patch } : state;
}

/** Patch that changes which rows match: back to the first page. */
function mergeToFirstPage(state: TableState, patch: Partial<TableState>): TableState {
  return changes(state, patch) ? { ...state, ...patch, page: 0 } : state;
}

function toggleItem(list: readonly string[], item: string): string[] {
  return list.includes(item) ? list.filter((value) => value !== item) : [...list, item];
}

function opposite(direction: SortDirection): SortDirection {
  return direction === SORT_DIRECTION.asc ? SORT_DIRECTION.desc : SORT_DIRECTION.asc;
}

/** First direction → opposite → no sort. Additive keeps the other keys. */
export function nextSort(sort: readonly SortKey[], columnId: string, first: SortDirection, additive: boolean): SortKey[] {
  const current = sort.find((key) => key.columnId === columnId);
  if (!additive) {
    if (current === undefined) return [{ columnId, direction: first }];
    return current.direction === first ? [{ columnId, direction: opposite(first) }] : [];
  }
  if (current === undefined) return [...sort, { columnId, direction: first }];
  if (current.direction === first) {
    return sort.map((key) => (key.columnId === columnId ? { columnId, direction: opposite(first) } : key));
  }
  return sort.filter((key) => key.columnId !== columnId);
}

function withoutKey<T>(record: Record<string, T>, key: string): Record<string, T> {
  return Object.fromEntries(Object.entries(record).filter(([name]) => name !== key));
}

function applySettings(state: TableState, settings: Partial<TableSettings>): TableState {
  const patch = Object.fromEntries(
    PERSISTED_KEYS.flatMap((key) => (settings[key] === undefined ? [] : [[key, settings[key]]])),
  ) as Partial<TableSettings>;
  if (!changes(state, patch)) return state;
  const regroup = patch.groupBy !== undefined && patch.groupBy !== state.groupBy;
  return { ...state, ...patch, collapsed: regroup ? [] : state.collapsed, page: 0 };
}

export function tableReducer(state: TableState, action: TableAction): TableState {
  switch (action.type) {
    case 'toggleSort':
      return mergeToFirstPage(state, {
        sort: nextSort(state.sort, action.columnId, action.firstDirection, action.additive ?? false),
      });
    case 'setSort':
      return mergeToFirstPage(state, { sort: action.sort });
    case 'setFilter': {
      const exists = Object.hasOwn(state.filters, action.columnId);
      if (action.filter === null || !isFilterActive(action.filter)) {
        return exists ? { ...state, filters: withoutKey(state.filters, action.columnId), page: 0 } : state;
      }
      if (exists && deepEqual(state.filters[action.columnId], action.filter)) return state;
      return { ...state, filters: { ...state.filters, [action.columnId]: action.filter }, page: 0 };
    }
    case 'clearFilters':
      return Object.keys(state.filters).length === 0 && state.search === '' ? state : { ...state, filters: {}, search: '', page: 0 };
    case 'setSearch':
      return mergeToFirstPage(state, { search: action.search });
    case 'setHidden':
      if (state.hidden.includes(action.columnId) === action.hidden) return state;
      return {
        ...state,
        hidden: action.hidden ? [...state.hidden, action.columnId] : state.hidden.filter((id) => id !== action.columnId),
      };
    case 'setOrder':
      return merge(state, { order: action.order });
    case 'moveColumn': {
      const from = state.order.indexOf(action.columnId);
      if (from === -1 || Number.isNaN(action.toIndex)) return state;
      const to = Math.min(Math.max(Math.trunc(action.toIndex), 0), state.order.length - 1);
      if (to === from) return state;
      const order = state.order.filter((id) => id !== action.columnId);
      order.splice(to, 0, action.columnId);
      return { ...state, order };
    }
    case 'setPin':
      if (Object.hasOwn(state.pins, action.columnId) && state.pins[action.columnId] === action.pin) return state;
      return { ...state, pins: { ...state.pins, [action.columnId]: action.pin } };
    case 'setWidth': {
      const width = Math.round(action.width);
      if (!Number.isFinite(width) || width <= 0) return state;
      if (state.widths[action.columnId] === width) return state;
      return { ...state, widths: { ...state.widths, [action.columnId]: width } };
    }
    case 'setDensity':
      return merge(state, { density: action.density });
    case 'setGroupBy':
      return state.groupBy === action.groupBy ? state : { ...state, groupBy: action.groupBy, collapsed: [], page: 0 };
    case 'toggleGroup':
      return { ...state, collapsed: toggleItem(state.collapsed, action.groupKey) };
    case 'setCollapsed':
      return merge(state, { collapsed: action.collapsed });
    case 'toggleRow':
      return { ...state, selected: toggleItem(state.selected, action.key) };
    case 'setSelected':
      return merge(state, { selected: action.selected });
    case 'toggleExpanded':
      return { ...state, expanded: toggleItem(state.expanded, action.key) };
    case 'setExpanded':
      return merge(state, { expanded: action.expanded });
    case 'setPage':
      return !Number.isInteger(action.page) || action.page < 0 ? state : merge(state, { page: action.page });
    case 'setPageSize':
      return !Number.isInteger(action.pageSize) || action.pageSize < 1 ? state : mergeToFirstPage(state, { pageSize: action.pageSize });
    case 'setView':
      if (state.view[action.id] === action.value) return state;
      return { ...state, view: { ...state.view, [action.id]: action.value }, page: 0 };
    case 'applySettings':
      return applySettings(state, action.settings);
    case 'resetSettings':
      return applySettings(state, pickSettings(action.initial));
    case 'replace':
      return action.state;
  }
}

export function pickSettings(state: TableState): TableSettings {
  return {
    sort: state.sort,
    order: state.order,
    hidden: state.hidden,
    pins: state.pins,
    widths: state.widths,
    density: state.density,
    groupBy: state.groupBy,
    pageSize: state.pageSize,
    view: state.view,
  };
}
