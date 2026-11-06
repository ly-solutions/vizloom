import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { BlockState } from '../../core/contracts/state';
import { defineColumns } from '../core/columns';
import { DataTable, type DataTableProps } from './data-table';
import { SparklineCell, safeHref } from './cells';
import { useDataTable, type UseDataTableOptions } from './use-data-table';

interface Ticket {
  id: string;
  name: string;
  price: number;
  sold: number;
  status: string;
}

const ROWS: Ticket[] = [
  { id: 'a', name: 'Standard', price: 40, sold: 52, status: 'selling' },
  { id: 'b', name: 'VIP', price: 120, sold: 9, status: 'paused' },
  { id: 'c', name: 'Fast pass', price: 60, sold: 31, status: 'selling' },
  { id: 'd', name: 'Kids', price: 15, sold: 14, status: 'soldout' },
];

const COLUMNS = defineColumns<Ticket>([
  { id: 'name', title: 'Name', type: 'text', value: (row) => row.name },
  { id: 'price', title: 'Price', type: 'money', value: (row) => row.price },
  { id: 'sold', title: 'Sold', type: 'number', value: (row) => row.sold, total: 'sum' },
  {
    id: 'status',
    title: 'Status',
    type: 'status',
    value: (row) => row.status,
    options: [
      { value: 'selling', label: 'On sale', tone: 'positive' },
      { value: 'paused', label: 'Paused', tone: 'warning' },
      { value: 'soldout', label: 'Sold out', tone: 'neutral' },
    ],
  },
]);

type HarnessProps = Partial<Omit<UseDataTableOptions<Ticket>, 'rows'>> & {
  rows?: readonly Ticket[];
  view?: Partial<Omit<DataTableProps<Ticket>, 'table'>>;
};

function Harness({ rows = ROWS, view, ...options }: HarnessProps) {
  const table = useDataTable<Ticket>({ columns: COLUMNS, rows, rowKey: (row) => row.id, storage: null, ...options });
  return <DataTable table={table} label="Tickets" {...view} />;
}

function bodyNames(): string[] {
  const grid = screen.getByRole('grid', { name: 'Tickets' });
  return Array.from(grid.querySelectorAll('tbody tr.vl-table__row')).map((row) => row.querySelector('td[data-first]')?.textContent ?? '');
}

describe('DataTable', () => {
  it('renders an ARIA grid with header, rows and totals', () => {
    render(<Harness />);
    const grid = screen.getByRole('grid', { name: 'Tickets' });
    expect(grid).toHaveAttribute('aria-colcount', '4');
    expect(grid).toHaveAttribute('aria-rowcount', '6');
    expect(within(grid).getAllByRole('columnheader')).toHaveLength(4);
    expect(bodyNames()).toEqual(['Standard', 'VIP', 'Fast pass', 'Kids']);
    const totals = grid.querySelector('tfoot')!;
    expect(totals).toHaveTextContent('Total');
    expect(totals).toHaveTextContent('106');
  });

  it('formats money and statuses', () => {
    render(<Harness />);
    const grid = screen.getByRole('grid');
    expect(grid).toHaveTextContent('$120');
    expect(within(grid).getAllByText('On sale')).toHaveLength(2);
  });

  it('sorts on header click and cycles direction', () => {
    render(<Harness />);
    const sort = screen.getByRole('button', { name: 'Name, sort' });
    fireEvent.click(sort);
    expect(bodyNames()).toEqual(['Fast pass', 'Kids', 'Standard', 'VIP']);
    expect(screen.getByRole('columnheader', { name: /Name/ })).toHaveAttribute('aria-sort', 'ascending');
    fireEvent.click(screen.getByRole('button', { name: 'Name, sorted ascending' }));
    expect(bodyNames()).toEqual(['VIP', 'Standard', 'Kids', 'Fast pass']);
    fireEvent.click(screen.getByRole('button', { name: 'Name, sorted descending' }));
    expect(bodyNames()).toEqual(['Standard', 'VIP', 'Fast pass', 'Kids']);
  });

  it('adds sort keys with Shift and shows their order', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Status, sort' }));
    fireEvent.click(screen.getByRole('button', { name: 'Price, sort' }), { shiftKey: true });
    // Status by option order, then price inside a status (money sorts high to low first).
    expect(bodyNames()).toEqual(['Fast pass', 'Standard', 'VIP', 'Kids']);
    expect(screen.getByRole('grid').querySelectorAll('.vl-table__sort-order')).toHaveLength(2);
  });

  it('selects rows, all rows and shows the selection bar', () => {
    render(<Harness selectable view={{ bulkActions: (rows) => <button type="button">Refund {rows.length}</button> }} />);
    const grid = screen.getByRole('grid');
    expect(grid).toHaveAttribute('aria-multiselectable', 'true');
    fireEvent.click(within(grid).getAllByRole('checkbox', { name: 'Select row' })[1]!);
    const row = grid.querySelectorAll('tbody tr.vl-table__row')[1]!;
    expect(row).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: 'Refund 1' })).toBeInTheDocument();
    const all = within(grid).getByRole('checkbox', { name: 'Select all rows' }) as HTMLInputElement;
    expect(all.indeterminate).toBe(true);
    fireEvent.click(all);
    expect(screen.getByRole('button', { name: 'Refund 4' })).toBeInTheDocument();
  });

  it('expands a row inline', () => {
    render(<Harness expandable view={{ renderExpanded: (row) => <p>Details of {row.name}</p> }} />);
    const toggle = screen.getAllByRole('button', { name: 'Show details' })[0]!;
    fireEvent.click(toggle);
    expect(screen.getByText('Details of Standard')).toBeInTheDocument();
    expect(screen.getByRole('grid').querySelector('tbody tr.vl-table__row')).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Hide details' }));
    expect(screen.queryByText('Details of Standard')).not.toBeInTheDocument();
  });

  it('groups rows with group totals and collapses a group', () => {
    render(<Harness groupings={[{ id: 'status', label: 'Status', key: (row) => row.status }]} defaultGroupBy="status" />);
    const grid = screen.getByRole('grid');
    const groups = grid.querySelectorAll('tbody tr.vl-table__group');
    expect(groups).toHaveLength(3);
    expect(groups[0]).toHaveTextContent('83');
    const toggle = within(groups[0] as HTMLElement).getByRole('button');
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(toggle);
    expect(bodyNames()).not.toContain('Standard');
  });

  it('pages rows', () => {
    render(<Harness pagination="pages" pageSize={2} />);
    expect(bodyNames()).toEqual(['Standard', 'VIP']);
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(bodyNames()).toEqual(['Fast pass', 'Kids']);
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
  });

  it('shows empty, no-matches, loading, error and no-access states', () => {
    const { rerender } = render(<Harness rows={[]} />);
    expect(screen.getByText('Nothing here yet')).toBeInTheDocument();

    rerender(<Harness rows={[]} view={{ loading: true }} />);
    expect(screen.getByRole('grid')).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByText('Nothing here yet')).not.toBeInTheDocument();

    const retry = vi.fn();
    rerender(<Harness rows={[]} view={{ error: { onRetry: retry } }} />);
    expect(screen.getByText('Could not load data')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(retry).toHaveBeenCalledOnce();

    rerender(<Harness view={{ noAccess: true }} />);
    expect(screen.getByText('No access')).toBeInTheDocument();
    expect(bodyNames()).toEqual([]);
  });

  it('maps a core BlockState', () => {
    const state: BlockState = { status: 'no-access' } as BlockState;
    render(<Harness view={{ state }} />);
    expect(screen.getByText('No access')).toBeInTheDocument();
  });

  it('reports no matches and resets filters', () => {
    function Filtered() {
      const table = useDataTable<Ticket>({ columns: COLUMNS, rows: ROWS, rowKey: (row) => row.id, storage: null });
      return (
        <>
          <button type="button" onClick={() => table.setSearch('zzz')}>
            search
          </button>
          <DataTable table={table} label="Tickets" />
        </>
      );
    }
    render(<Filtered />);
    fireEvent.click(screen.getByRole('button', { name: 'search' }));
    expect(screen.getByText('Nothing found')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reset filters' }));
    expect(bodyNames()).toHaveLength(4);
  });

  it('moves focus through the grid with the keyboard', () => {
    render(<Harness selectable />);
    const grid = screen.getByRole('grid');
    const corner = grid.querySelector<HTMLElement>('[data-cell][data-r="-1"][data-c="0"]')!;
    expect(corner).toHaveAttribute('tabindex', '0');
    corner.focus();
    fireEvent.keyDown(corner, { key: 'ArrowDown' });
    expect(document.activeElement).toHaveAttribute('data-r', '0');
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' });
    expect(document.activeElement).toHaveAttribute('data-c', '1');
    fireEvent.keyDown(document.activeElement!, { key: 'End', ctrlKey: true });
    expect(document.activeElement).toHaveAttribute('data-r', '3');
    expect(document.activeElement).toHaveAttribute('data-c', '4');
    fireEvent.keyDown(document.activeElement!, { key: ' ' });
    expect(grid.querySelectorAll('tbody tr.vl-table__row')[3]).toHaveAttribute('aria-selected', 'true');
    // Only one tab stop in the grid.
    expect(grid.querySelectorAll('[data-cell][tabindex="0"]')).toHaveLength(1);
  });

  it('activates a clickable row with Enter', () => {
    const onRowClick = vi.fn();
    render(<Harness view={{ onRowClick }} />);
    const cell = screen.getByRole('grid').querySelector<HTMLElement>('[data-cell][data-r="1"][data-c="0"]')!;
    fireEvent.keyDown(cell, { key: 'Enter' });
    expect(onRowClick).toHaveBeenCalledWith(ROWS[1]);
  });

  it('pulses changed cells in live mode', () => {
    vi.useFakeTimers();
    try {
      const { rerender } = render(<Harness view={{ pulseChanges: true }} />);
      const next = ROWS.map((row) => (row.id === 'b' ? { ...row, sold: 12 } : row));
      rerender(<Harness rows={next} view={{ pulseChanges: true }} />);
      const pulse = screen.getByRole('grid').querySelector('.vl-table__pulse')!;
      expect(pulse).toHaveAttribute('data-direction', 'up');
      expect(pulse).toHaveTextContent('+3');
      act(() => {
        vi.advanceTimersByTime(2000);
      });
      expect(screen.getByRole('grid').querySelector('.vl-table__pulse')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('uses real links for row navigation', () => {
    render(<Harness view={{ rowHref: (row) => `/tickets/${row.id}` }} />);
    const link = screen.getByRole('link', { name: 'VIP' });
    expect(link).toHaveAttribute('href', '/tickets/b');
  });
});

describe('cells', () => {
  it('rejects unsafe link protocols', () => {
    expect(safeHref('javascript:alert(1)')).toBeNull();
    expect(safeHref('https://example.com')).toBe('https://example.com');
    expect(safeHref('/relative')).toBe('/relative');
    expect(safeHref('mailto:a@example.com')).toBe('mailto:a@example.com');
  });

  it('renders the charts sparkline with its label', () => {
    render(<SparklineCell values={[1, 2, Number.NaN, 4]} aria-label="Sales, rising" />);
    expect(screen.getByRole('img', { name: 'Sales, rising' })).toBeInTheDocument();
  });
});

describe('column settings', () => {
  it('reorders columns by dragging a handle and commits on release', async () => {
    const { SettingsPanel } = await import('./panels');
    const { tableStringsFor } = await import('../core/strings');
    function SettingsHarness() {
      const table = useDataTable<Ticket>({ columns: COLUMNS, rows: ROWS, rowKey: (row) => row.id, storage: null });
      return (
        <>
          <SettingsPanel table={table} strings={tableStringsFor('en')} />
          <DataTable table={table} label="Tickets" />
        </>
      );
    }
    const { container } = render(<SettingsHarness />);
    const rows = Array.from(container.querySelectorAll<HTMLElement>('.vl-table-settings__column'));
    rows.forEach((row, index) => {
      row.getBoundingClientRect = () => ({
        top: index * 36,
        bottom: index * 36 + 36,
        height: 36,
        left: 0,
        right: 200,
        width: 200,
        x: 0,
        y: index * 36,
        toJSON: () => ({}),
      });
    });
    const handle = rows[0].querySelector('.vl-table-settings__handle')!;
    const pointer = (type: string, clientY: number) => new MouseEvent(type, { bubbles: true, cancelable: true, clientY, button: 0 });
    act(() => {
      handle.dispatchEvent(pointer('pointerdown', 18));
    });
    act(() => {
      window.dispatchEvent(pointer('pointermove', 18 + 80));
    });
    // Mid-drag the DOM order is untouched: the row only moves with a transform.
    expect(container.querySelector('.vl-table-settings__column[data-dragging]')).toHaveStyle({ transform: 'translateY(80px)' });
    const headers = () =>
      within(screen.getByRole('grid', { name: 'Tickets' }))
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent);
    expect(headers()[0]).toContain('Name');
    act(() => {
      window.dispatchEvent(pointer('pointerup', 18 + 80));
    });
    expect(headers().map((text) => text?.replace(/[^A-Za-z]/g, ''))).toEqual(['Price', 'Sold', 'Name', 'Status']);
    expect(container.querySelector('.vl-table-settings__column[data-dragging]')).toBeNull();
  });
});
