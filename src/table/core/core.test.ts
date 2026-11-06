import { defineColumns, visibleColumns, widthOf, cardRoleOf, filterKindOf } from './columns';
import { formatCell, formatTotal } from './format';
import { buildModel, filterRows, isFilterActive, sortRows, countValues, shareOf } from './pipeline';
import { parseSettings, serializeSettings } from './persist';
import { createInitialState, nextSort, pickSettings, tableReducer } from './state';
import { toCsv, toExportData } from './export';
import { diffRows, indexRows } from './live';
import type { TableState } from './types';

interface Ticket {
  id: string;
  name: string;
  price: number;
  sold: number | null;
  status: string;
  soldAt: string;
}

const ROWS: Ticket[] = [
  { id: 'a', name: 'Standard', price: 1000, sold: 52, status: 'selling', soldAt: '2026-10-01' },
  { id: 'b', name: 'VIP', price: 5000, sold: 9, status: 'paused', soldAt: '2026-10-05' },
  { id: 'c', name: 'Fast pass', price: 1500, sold: null, status: 'soldout', soldAt: '2026-10-03' },
  { id: 'd', name: 'Kids', price: 500, sold: 14, status: 'selling', soldAt: '2026-09-28' },
];

const COLUMNS = defineColumns<Ticket>([
  { id: 'name', title: 'Name', type: 'text', value: (row) => row.name },
  { id: 'price', title: 'Price', type: 'money', value: (row) => row.price, total: 'sum' },
  { id: 'sold', title: 'Sold', type: 'number', value: (row) => row.sold, total: 'sum', bar: true },
  {
    id: 'status',
    title: 'Status',
    type: 'status',
    value: (row) => row.status,
    options: [
      { value: 'selling', label: 'On sale' },
      { value: 'paused', label: 'Paused' },
      { value: 'soldout', label: 'Sold out' },
    ],
  },
  { id: 'soldAt', title: 'Sold at', type: 'date', value: (row) => row.soldAt, hidden: true },
]);

const FORMAT = { locale: 'en-US', currency: 'USD', now: new Date(2026, 10, 1) };
const rowKey = (row: Ticket) => row.id;

function model(state: TableState) {
  return buildModel({ rows: ROWS, columns: COLUMNS, rowKey, state, pagination: 'none', mode: 'client', format: FORMAT });
}

describe('columns', () => {
  it('rejects duplicate ids', () => {
    expect(() => defineColumns([COLUMNS[0]!, COLUMNS[0]!])).toThrow(/duplicate column id "name"/);
  });

  it('orders pinned columns to the edges and drops hidden ones', () => {
    const state = { ...createInitialState(COLUMNS), pins: { status: 'start' as const, name: 'end' as const } };
    expect(visibleColumns(COLUMNS, state).map((column) => column.id)).toEqual(['status', 'price', 'sold', 'name']);
  });

  it('keeps non-hideable columns visible', () => {
    const columns = defineColumns<Ticket>([{ ...COLUMNS[0]!, hideable: false }]);
    expect(visibleColumns(columns, { order: ['name'], hidden: ['name'], pins: {} })).toHaveLength(1);
  });

  it('never goes below the minimum width', () => {
    expect(widthOf(COLUMNS[1]!, { widths: { price: 10 } })).toBe(96);
    expect(widthOf(COLUMNS[1]!, { widths: {} })).toBe(136);
  });

  it('derives card roles and filter kinds from types', () => {
    expect(cardRoleOf(COLUMNS[0]!, 0)).toBe('title');
    expect(cardRoleOf(COLUMNS[3]!, 3)).toBe('badge');
    expect(filterKindOf(COLUMNS[1]!)).toBe('range');
    expect(filterKindOf({ ...COLUMNS[3]!, options: [] })).toBeNull();
    expect(filterKindOf({ ...COLUMNS[0]!, filter: false })).toBeNull();
  });
});

describe('format', () => {
  it('formats by type', () => {
    expect(formatCell(COLUMNS[1]!, 1500, FORMAT)).toBe('$1,500');
    expect(formatCell(COLUMNS[3]!, 'paused', FORMAT)).toBe('Paused');
    expect(formatCell(COLUMNS[2]!, null, FORMAT)).toBe('—');
    expect(formatCell({ ...COLUMNS[2]!, type: 'percent' }, 12.5, FORMAT)).toBe('12.5%');
    expect(formatCell(COLUMNS[4]!, '2026-10-05', FORMAT)).toBe('Oct 5');
    expect(formatCell(COLUMNS[4]!, '2025-10-05', FORMAT)).toMatch(/2025/);
  });

  it('formats russian money with a grouping space', () => {
    expect(formatCell(COLUMNS[1]!, 1500, { locale: 'ru-RU', currency: 'RUB' }).replace(/\s/g, ' ')).toBe('1 500 ₽');
  });

  it('shows a dash for an unknown total', () => {
    expect(formatTotal(COLUMNS[2]!, { value: null, unknown: true }, FORMAT)).toBe('—');
  });
});

describe('sorting', () => {
  it('sorts numbers and keeps missing values last in both directions', () => {
    const asc = sortRows(ROWS, COLUMNS, [{ columnId: 'sold', direction: 'asc' }], 'en');
    const desc = sortRows(ROWS, COLUMNS, [{ columnId: 'sold', direction: 'desc' }], 'en');
    expect(asc.map(rowKey)).toEqual(['b', 'd', 'a', 'c']);
    expect(desc.map(rowKey)).toEqual(['a', 'd', 'b', 'c']);
  });

  it('sorts statuses by declared option order', () => {
    expect(sortRows(ROWS, COLUMNS, [{ columnId: 'status', direction: 'asc' }], 'en').map(rowKey)).toEqual(['a', 'd', 'b', 'c']);
  });

  it('applies several keys and stays stable', () => {
    const sorted = sortRows(
      ROWS,
      COLUMNS,
      [
        { columnId: 'status', direction: 'asc' },
        { columnId: 'price', direction: 'asc' },
      ],
      'en',
    );
    expect(sorted.map(rowKey)).toEqual(['d', 'a', 'b', 'c']);
  });

  it('cycles first → opposite → none, and additive keeps other keys', () => {
    expect(nextSort([], 'price', 'desc', false)).toEqual([{ columnId: 'price', direction: 'desc' }]);
    expect(nextSort([{ columnId: 'price', direction: 'desc' }], 'price', 'desc', false)).toEqual([{ columnId: 'price', direction: 'asc' }]);
    expect(nextSort([{ columnId: 'price', direction: 'asc' }], 'price', 'desc', false)).toEqual([]);
    const multi = nextSort([{ columnId: 'price', direction: 'desc' }], 'name', 'asc', true);
    expect(multi).toEqual([
      { columnId: 'price', direction: 'desc' },
      { columnId: 'name', direction: 'asc' },
    ]);
    expect(nextSort(multi, 'name', 'asc', true)[1]).toEqual({ columnId: 'name', direction: 'desc' });
    expect(nextSort(nextSort(multi, 'name', 'asc', true), 'name', 'asc', true)).toHaveLength(1);
  });
});

describe('filters and search', () => {
  it('filters by range, select, text and dates', () => {
    expect(filterRows(ROWS, COLUMNS, { price: { kind: 'range', min: 1000, max: 1500 } }, '', FORMAT).map(rowKey)).toEqual(['a', 'c']);
    expect(filterRows(ROWS, COLUMNS, { status: { kind: 'select', values: ['selling'] } }, '', FORMAT).map(rowKey)).toEqual(['a', 'd']);
    expect(filterRows(ROWS, COLUMNS, { name: { kind: 'text', query: 'pass' } }, '', FORMAT).map(rowKey)).toEqual(['c']);
    expect(
      filterRows(ROWS, COLUMNS, { soldAt: { kind: 'dateRange', from: '2026-10-01', to: '2026-10-03' } }, '', FORMAT).map(rowKey),
    ).toEqual(['a', 'c']);
  });

  it('excludes unknown values from an active filter', () => {
    expect(filterRows(ROWS, COLUMNS, { sold: { kind: 'range', min: 0, max: null } }, '', FORMAT).map(rowKey)).toEqual(['a', 'b', 'd']);
  });

  it('treats empty filters as inactive', () => {
    expect(isFilterActive({ kind: 'range', min: null, max: null })).toBe(false);
    expect(isFilterActive({ kind: 'text', query: '  ' })).toBe(false);
  });

  it('searches formatted values of searchable columns', () => {
    expect(filterRows(ROWS, COLUMNS, {}, 'sold out', FORMAT).map(rowKey)).toEqual(['c']);
    expect(filterRows(ROWS, COLUMNS, {}, 'vip', FORMAT).map(rowKey)).toEqual(['b']);
  });

  it('rejects an impossible day', () => {
    expect(() => filterRows(ROWS, COLUMNS, { soldAt: { kind: 'dateRange', from: '2026-02-30', to: null } }, '', FORMAT)).toThrow(
      /real day/,
    );
  });

  it('counts option values', () => {
    expect(countValues(ROWS, COLUMNS[3]!).get('selling')).toBe(2);
  });
});

describe('model', () => {
  it('computes totals, unknown when a value is missing', () => {
    const result = model(createInitialState(COLUMNS));
    expect(result.totals['price']).toEqual({ value: 8000, unknown: false });
    expect(result.totals['sold']).toEqual({ value: null, unknown: true });
  });

  it('groups rows with group totals and collapsing', () => {
    const groupings = [{ id: 'status', label: 'Status', key: (row: Ticket) => row.status }];
    const state = { ...createInitialState(COLUMNS), groupBy: 'status', collapsed: ['paused'] };
    const result = buildModel({
      rows: ROWS,
      columns: COLUMNS,
      rowKey,
      state,
      groupings,
      pagination: 'none',
      mode: 'client',
      format: FORMAT,
    });
    expect(result.items.map((item) => item.key)).toEqual(['group:selling', 'a', 'd', 'group:paused', 'group:soldout', 'c']);
    const first = result.items[0];
    expect(first?.kind === 'group' && first.totals['price']?.value).toBe(1500);
  });

  it('pages, shows more and validates page size', () => {
    const base = createInitialState(COLUMNS, { pageSize: 3 });
    const pages = buildModel({
      rows: ROWS,
      columns: COLUMNS,
      rowKey,
      state: { ...base, page: 1 },
      pagination: 'pages',
      mode: 'client',
      format: FORMAT,
    });
    expect(pages.items).toHaveLength(1);
    expect(pages.pageCount).toBe(2);
    const more = buildModel({
      rows: ROWS,
      columns: COLUMNS,
      rowKey,
      state: { ...base, page: 1 },
      pagination: 'more',
      mode: 'client',
      format: FORMAT,
    });
    expect(more.items).toHaveLength(4);
    expect(() =>
      buildModel({
        rows: ROWS,
        columns: COLUMNS,
        rowKey,
        state: { ...base, pageSize: 0 },
        pagination: 'pages',
        mode: 'client',
        format: FORMAT,
      }),
    ).toThrow(RangeError);
  });

  it('passes server rows through untouched', () => {
    const state = { ...createInitialState(COLUMNS), search: 'zzz' };
    const result = buildModel({
      rows: ROWS,
      columns: COLUMNS,
      rowKey,
      state,
      pagination: 'pages',
      mode: 'server',
      rowCount: 400,
      format: FORMAT,
    });
    expect(result.items).toHaveLength(4);
    expect(result.totalCount).toBe(400);
    expect(result.pageCount).toBe(8);
  });

  it('computes bar shares against the maximum', () => {
    const result = model(createInitialState(COLUMNS));
    expect(shareOf(26, result.extents['sold'])).toBe(0.5);
    expect(shareOf(-1, result.extents['sold'])).toBeNull();
  });
});

describe('reducer', () => {
  const initial = createInitialState(COLUMNS);

  it('returns the same state when nothing changes', () => {
    expect(tableReducer(initial, { type: 'setSearch', search: '' })).toBe(initial);
    expect(tableReducer(initial, { type: 'setFilter', columnId: 'price', filter: { kind: 'range', min: null, max: null } })).toBe(initial);
    expect(tableReducer(initial, { type: 'setPage', page: -1 })).toBe(initial);
  });

  it('goes back to the first page when matching rows change', () => {
    const paged = { ...initial, page: 3 };
    expect(tableReducer(paged, { type: 'setSearch', search: 'x' }).page).toBe(0);
    expect(tableReducer(paged, { type: 'setDensity', density: 'compact' }).page).toBe(3);
  });

  it('moves columns and clamps the index', () => {
    const moved = tableReducer(initial, { type: 'moveColumn', columnId: 'name', toIndex: 99 });
    expect(moved.order.at(-1)).toBe('name');
  });

  it('toggles selection, expansion and groups', () => {
    let state = tableReducer(initial, { type: 'toggleRow', key: 'a' });
    state = tableReducer(state, { type: 'toggleExpanded', key: 'b' });
    state = tableReducer(state, { type: 'toggleGroup', groupKey: 'g' });
    expect([state.selected, state.expanded, state.collapsed]).toEqual([['a'], ['b'], ['g']]);
    expect(tableReducer(state, { type: 'toggleRow', key: 'a' }).selected).toEqual([]);
  });

  it('ignores invalid widths', () => {
    expect(tableReducer(initial, { type: 'setWidth', columnId: 'name', width: Number.NaN })).toBe(initial);
    expect(tableReducer(initial, { type: 'setWidth', columnId: 'name', width: 200.4 }).widths['name']).toBe(200);
  });

  it('resets settings but keeps filters', () => {
    let state = tableReducer(initial, { type: 'setDensity', density: 'compact' });
    state = tableReducer(state, { type: 'setSearch', search: 'vip' });
    state = tableReducer(state, { type: 'resetSettings', initial });
    expect(state.density).toBe('regular');
    expect(state.search).toBe('vip');
  });
});

describe('persistence', () => {
  it('round-trips settings', () => {
    const state = {
      ...createInitialState(COLUMNS),
      density: 'compact' as const,
      widths: { name: 300 },
      sort: [{ columnId: 'price', direction: 'asc' as const }],
    };
    const restored = parseSettings(COLUMNS, serializeSettings(COLUMNS, pickSettings(state)));
    expect(restored).toMatchObject({ density: 'compact', widths: { name: 300 }, sort: [{ columnId: 'price', direction: 'asc' }] });
  });

  it('drops garbage field by field', () => {
    const raw = JSON.stringify({
      v: 1,
      settings: { density: 'huge', widths: { name: -5, price: 120, ghost: 50 }, order: ['ghost', 'price'], pins: { name: 'middle' } },
    });
    const restored = parseSettings(COLUMNS, raw);
    expect(restored?.density).toBeUndefined();
    expect(restored?.widths).toEqual({ price: 120 });
    expect(restored?.order?.[0]).toBe('price');
    expect(restored?.order).toHaveLength(5);
    expect(restored?.pins).toEqual({});
  });

  it('ignores other versions and broken JSON', () => {
    expect(parseSettings(COLUMNS, '{')).toBeNull();
    expect(parseSettings(COLUMNS, JSON.stringify({ v: 99, settings: {} }))).toBeNull();
  });
});

describe('export', () => {
  it('writes CSV with a BOM and neutralizes formulas', () => {
    const data = toExportData([{ ...ROWS[0]!, name: '=HYPERLINK("x")' }], COLUMNS);
    const csv = toCsv(data, { delimiter: ';', decimal: ',' });
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv).toContain('On sale');
    expect(csv).toContain('2026-10-01');
  });

  it('keeps numbers numeric', () => {
    expect(toExportData([ROWS[1]!], COLUMNS).rows[0]?.[1]).toBe(5000);
  });
});

describe('live diff', () => {
  it('reports changed cells with direction and delta', () => {
    const before = indexRows(ROWS, rowKey);
    const next = ROWS.map((row) => (row.id === 'a' ? { ...row, sold: 55, status: 'paused' } : row));
    const changes = diffRows(before, next, COLUMNS, rowKey);
    expect(changes).toEqual([
      { rowKey: 'a', columnId: 'sold', direction: 'up', delta: 3 },
      { rowKey: 'a', columnId: 'status', direction: 'changed', delta: null },
    ]);
  });
});
