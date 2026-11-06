import { createInitialState } from './state';
import { DENSITY, PIN, SORT_DIRECTION, type ColumnDef, type Pin, type SortKey, type TableSettings } from './types';

/** Bump when the stored shape changes: old values are then ignored, not misread. */
export const SETTINGS_VERSION = 1;

/** Minimal storage contract: `localStorage`, `sessionStorage` or anything alike. */
export interface SettingsStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function signature<Row>(columns: readonly ColumnDef<Row>[]): string {
  return columns
    .map((column) => column.id)
    .sort()
    .join(',');
}

export function serializeSettings<Row>(columns: readonly ColumnDef<Row>[], settings: TableSettings): string {
  return JSON.stringify({ v: SETTINGS_VERSION, sig: signature(columns), settings });
}

function knownIds(value: unknown, ids: ReadonlySet<string>): string[] | null {
  if (!Array.isArray(value)) return null;
  const result = new Set<string>();
  for (const item of value) if (typeof item === 'string' && ids.has(item)) result.add(item);
  return [...result];
}

function isPin(value: unknown): value is Pin {
  return value === PIN.start || value === PIN.end;
}

/**
 * Settings saved earlier, checked field by field: a stale or hand-edited value drops only that
 * field. Columns added since the save are appended to the order; columns hidden by default
 * that the saved order did not know stay hidden.
 */
export function parseSettings<Row>(columns: readonly ColumnDef<Row>[], raw: string | null): Partial<TableSettings> | null {
  if (raw === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(parsed) || parsed['v'] !== SETTINGS_VERSION || !isRecord(parsed['settings'])) return null;
  const saved = parsed['settings'];
  const ids = new Set(columns.map((column) => column.id));
  const result: Partial<TableSettings> = {};

  const order = knownIds(saved['order'], ids);
  if (order !== null) {
    const known = new Set(order);
    result.order = [...order, ...columns.map((column) => column.id).filter((id) => !known.has(id))];
  }
  const hidden = knownIds(saved['hidden'], ids);
  if (hidden !== null) {
    const savedOrder = new Set(order ?? []);
    const newHidden = order === null ? [] : createInitialState(columns).hidden.filter((id) => !savedOrder.has(id));
    result.hidden = [...new Set([...hidden, ...newHidden])];
  }
  if (isRecord(saved['pins'])) {
    const pins: Record<string, Pin | null> = {};
    for (const [id, pin] of Object.entries(saved['pins'])) if (ids.has(id) && (pin === null || isPin(pin))) pins[id] = pin;
    result.pins = pins;
  }
  if (isRecord(saved['widths'])) {
    const widths: Record<string, number> = {};
    for (const [id, width] of Object.entries(saved['widths'])) {
      if (ids.has(id) && typeof width === 'number' && Number.isFinite(width) && width > 0) widths[id] = width;
    }
    result.widths = widths;
  }
  if (Array.isArray(saved['sort'])) {
    const sort: SortKey[] = [];
    for (const key of saved['sort']) {
      if (!isRecord(key)) continue;
      const columnId = key['columnId'];
      const direction = key['direction'];
      if (typeof columnId !== 'string' || !ids.has(columnId)) continue;
      if (direction !== SORT_DIRECTION.asc && direction !== SORT_DIRECTION.desc) continue;
      if (!sort.some((item) => item.columnId === columnId)) sort.push({ columnId, direction });
    }
    result.sort = sort;
  }
  const density = saved['density'];
  if (density === DENSITY.regular || density === DENSITY.compact) result.density = density;
  const groupBy = saved['groupBy'];
  if (typeof groupBy === 'string' || groupBy === null) result.groupBy = groupBy;
  const pageSize = saved['pageSize'];
  if (typeof pageSize === 'number' && Number.isInteger(pageSize) && pageSize > 0) result.pageSize = pageSize;
  if (isRecord(saved['view'])) {
    const view: Record<string, boolean> = {};
    for (const [id, value] of Object.entries(saved['view'])) if (typeof value === 'boolean') view[id] = value;
    result.view = view;
  }
  return result;
}

/** `window.localStorage` when it exists and is allowed; null on the server or in a locked-down browser. */
export function browserStorage(): SettingsStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function readSettings<Row>(
  storage: SettingsStorage | null,
  key: string | undefined,
  columns: readonly ColumnDef<Row>[],
): Partial<TableSettings> | null {
  if (storage === null || key === undefined) return null;
  try {
    return parseSettings(columns, storage.getItem(key));
  } catch {
    return null;
  }
}

export function writeSettings(storage: SettingsStorage | null, key: string | undefined, value: string): void {
  if (storage === null || key === undefined) return;
  try {
    storage.setItem(key, value);
  } catch {
    // Quota or privacy mode: settings simply do not persist.
  }
}
