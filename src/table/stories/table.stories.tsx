import type { Meta, StoryObj } from '@storybook/react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import {
  AvatarCell,
  BarCell,
  DataTable,
  DataTableToolbar,
  DeltaCell,
  DotCell,
  LinkCell,
  PillCell,
  ProgressCell,
  SparklineCell,
  StatusCell,
  TwoLineCell,
  UnknownCell,
  defineColumns,
  downloadText,
  filterRows,
  sortRows,
  toCsv,
  toExportData,
  useDataTable,
  type DataTableProps,
  type DataTableInstance,
  type TableState,
  type UseDataTableOptions,
} from '..';
import { ORDER_COLUMNS, PROMO_COLUMNS, TICKET_COLUMNS } from './columns';
import { PROMO_CODES, TICKET_TYPES, makeOrders, seeded, tickTicketTypes, type Order, type TicketType } from './table-data';
import './stories.css';

const meta: Meta = {
  title: 'Table/DataTable',
  parameters: { layout: 'padded' },
};
export default meta;
type Story = StoryObj;

const ORDERS_200 = makeOrders(200);
const orderKey = (row: Order) => row.id;
const ticketKey = (row: TicketType) => row.id;

function Block({ title, note, toolbar, children }: { title: string; note?: string; toolbar?: ReactNode; children: ReactNode }) {
  return (
    <section className="sbt-block">
      <div className="sbt-head">
        <h3 className="sbt-title">{title}</h3>
        {toolbar}
      </div>
      {note === undefined ? null : <p className="sbt-note">{note}</p>}
      {children}
    </section>
  );
}

function exportCsv<Row>(table: DataTableInstance<Row>, name: string) {
  downloadText(toCsv(toExportData(table.model.matched, table.visible)), `${name}.csv`);
}

/** Orders table with a full toolbar: the shape most stories start from. */
function OrdersDemo({
  rows = ORDERS_200,
  options,
  view,
  title = 'Orders',
  note,
}: {
  rows?: readonly Order[];
  options?: Partial<Omit<UseDataTableOptions<Order>, 'rows'>>;
  view?: Partial<Omit<DataTableProps<Order>, 'table'>>;
  title?: string;
  note?: string;
}) {
  const table = useDataTable<Order>({
    columns: ORDER_COLUMNS,
    rows,
    rowKey: orderKey,
    storage: null,
    pagination: 'pages',
    pageSize: 25,
    ...options,
  });
  return (
    <Block
      title={title}
      note={note}
      toolbar={
        <DataTableToolbar table={table} search filters settings exportFormats={['csv']} onExport={() => exportCsv(table, 'orders')} />
      }
    >
      <DataTable table={table} label={title} {...view} />
    </Block>
  );
}

function BasicView() {
  const table = useDataTable<TicketType>({ columns: TICKET_COLUMNS, rows: TICKET_TYPES, rowKey: ticketKey, storage: null });
  return (
    <Block
      title="Ticket types"
      note="Click a header to sort, Shift+click adds a second key. Hover a header for its menu."
      toolbar={<DataTableToolbar table={table} search settings />}
    >
      <DataTable table={table} label="Ticket types" />
    </Block>
  );
}

export const Basic: Story = {
  name: 'Basic: sort, totals, toolbar',
  render: () => <BasicView />,
};

export const MultiSort: Story = {
  name: 'Sorting: multi-sort',
  render: () => (
    <OrdersDemo
      note="Sorted by status, then by amount. Shift+click a header to add, flip or remove a key; the badge shows the key order."
      options={{
        defaultSort: [
          { columnId: 'status', direction: 'asc' },
          { columnId: 'amount', direction: 'desc' },
        ],
      }}
    />
  ),
};

function PinnedAndScrollView() {
  const columns = useMemo(
    () =>
      ORDER_COLUMNS.map((column) => {
        if (column.id === 'status') return { ...column, pin: 'end' as const };
        if (column.id === 'fee' || column.id === 'promo') return { ...column, hidden: false };
        return column;
      }),
    [],
  );
  const table = useDataTable<Order>({ columns, rows: ORDERS_200, rowKey: orderKey, storage: null, selectable: true });
  return (
    <Block
      title="Orders"
      note="Order number and selection pinned to the start, status to the end. The table scrolls inside 420 px; shadows show there is more. Past the edges the page scrolls on."
      toolbar={<DataTableToolbar table={table} settings />}
    >
      <DataTable table={table} label="Orders" maxHeight={420} />
    </Block>
  );
}

export const PinnedAndScroll: Story = {
  name: 'Pinned columns, max height, scroll shadows',
  render: () => <PinnedAndScrollView />,
};

export const Grouping: Story = {
  name: 'Grouping with group totals',
  render: () => (
    <OrdersDemo
      note="Grouped by ticket type with totals per group. Change grouping in Customize; groups collapse and the group checkbox selects its rows."
      options={{
        selectable: true,
        groupings: [
          { id: 'ticket', label: 'Ticket type', key: (row) => row.ticket },
          { id: 'channel', label: 'Channel', key: (row) => row.channel },
          { id: 'status', label: 'Status', key: (row) => row.status, title: (key) => key.charAt(0).toUpperCase() + key.slice(1) },
        ],
        defaultGroupBy: 'ticket',
        pagination: 'none',
      }}
      view={{ maxHeight: 560 }}
    />
  ),
};

export const ExpandableRows: Story = {
  name: 'Expandable rows',
  render: () => (
    <OrdersDemo
      options={{ expandable: (row) => row.status !== 'failed', pageSize: 10 }}
      note="Failed orders have nothing to show and get no toggle."
      view={{
        renderExpanded: (row) => (
          <dl className="sbt-detail">
            <div>
              <dt>Email</dt>
              <dd>{row.email}</dd>
            </div>
            <div>
              <dt>Tickets</dt>
              <dd>
                {row.quantity} × {row.ticket}
              </dd>
            </div>
            <div>
              <dt>Checked in</dt>
              <dd>
                {row.checkedIn} of {row.quantity}
              </dd>
            </div>
            <div>
              <dt>Promo code</dt>
              <dd>{row.promo ?? '—'}</dd>
            </div>
          </dl>
        ),
      }}
    />
  ),
};

export const Selection: Story = {
  name: 'Row selection and bulk actions',
  render: () => (
    <OrdersDemo
      options={{ selectable: true }}
      note="Select rows with the checkboxes or Space on a focused row. The bar below offers actions for the selection."
      view={{
        bulkActions: (rows) => (
          <>
            <button type="button" className="vl-table-button vl-table-button--secondary vl-table-button--xs">
              Resend tickets ({rows.length})
            </button>
            <button type="button" className="vl-table-button vl-table-button--xs">
              Refund
            </button>
          </>
        ),
        rowMenu: (row) => [
          { id: 'open', label: `Open ${row.number}`, onSelect: () => undefined },
          { id: 'resend', label: 'Resend tickets', onSelect: () => undefined },
          'separator',
          { id: 'refund', label: 'Refund', destructive: true, disabled: row.status !== 'paid', onSelect: () => undefined },
        ],
      }}
    />
  ),
};

export const ColumnSettings: Story = {
  name: 'Column settings: visibility, order, width, pins, density',
  render: () => (
    <OrdersDemo
      note="Customize: show or hide columns, drag (or use arrow keys on the handle) to reorder, pin to an edge, switch density. Drag a header edge to resize, double-click it to fit. Settings persist under a storage key."
      options={{ storageKey: 'vizloom-story-orders', storage: undefined }}
    />
  ),
};

export const FiltersAndSearch: Story = {
  name: 'Filters (text, range, select, dates) and search',
  render: () => (
    <OrdersDemo
      note="Filters: amount is a range, ticket and channel are lists with counts, created is a date range, buyer is text. Active filters show as chips above the table."
      options={{
        defaultSort: [{ columnId: 'createdAt', direction: 'desc' }],
      }}
    />
  ),
};

export const Pagination: Story = {
  name: 'Pagination: pages, show more, infinite',
  render: () => (
    <div className="sbt-stack">
      <OrdersDemo title="Pages" options={{ pagination: 'pages', pageSize: 10 }} />
      <OrdersDemo title="Show more" options={{ pagination: 'more', pageSize: 10 }} />
      <OrdersDemo title="Infinite scroll" options={{ pagination: 'infinite', pageSize: 30 }} view={{ maxHeight: 400 }} />
    </div>
  ),
};

function Virtualized50kView() {
  const rows = useMemo(() => makeOrders(50_000, 5), []);
  return (
    <OrdersDemo
      rows={rows}
      title="50 000 orders"
      note="Only the visible rows are in the DOM. Sorting, filtering, search and totals run over all 50 000."
      options={{ pagination: 'none', selectable: true }}
      view={{ maxHeight: 560 }}
    />
  );
}

export const Virtualized50k: Story = {
  name: 'Big data: 50 000 rows, virtualized',
  render: () => <Virtualized50kView />,
};

export const Density: Story = {
  name: 'Density: regular and compact',
  render: () => (
    <div className="sbt-stack">
      <OrdersDemo title="Regular" options={{ pageSize: 10 }} />
      <OrdersDemo title="Compact" options={{ pageSize: 10, defaultDensity: 'compact' }} />
    </div>
  ),
};

function PinnedRowsView() {
  const table = useDataTable<TicketType>({ columns: TICKET_COLUMNS, rows: TICKET_TYPES.slice(1), rowKey: ticketKey, storage: null });
  return (
    <Block title="Ticket types" note="The best seller stays on top whatever the sort.">
      <DataTable table={table} label="Ticket types" pinnedRows={{ top: TICKET_TYPES.slice(0, 1) }} />
    </Block>
  );
}

export const PinnedRows: Story = {
  name: 'Pinned rows',
  render: () => <PinnedRowsView />,
};

function StatesDemo({ title, rows, view }: { title: string; rows: readonly Order[]; view: Partial<Omit<DataTableProps<Order>, 'table'>> }) {
  const table = useDataTable<Order>({ columns: ORDER_COLUMNS, rows, rowKey: orderKey, storage: null });
  return (
    <Block title={title}>
      <DataTable table={table} label={title} {...view} />
    </Block>
  );
}

export const States: Story = {
  name: 'States: loading, empty, error, no access, partial',
  render: () => (
    <div className="sbt-stack">
      <StatesDemo title="Loading" rows={[]} view={{ loading: true }} />
      <StatesDemo
        title="Empty"
        rows={[]}
        view={{ empty: { title: 'No orders yet', description: 'Orders appear here as soon as tickets go on sale.' } }}
      />
      <StatesDemo title="Load error" rows={[]} view={{ error: { onRetry: () => undefined } }} />
      <StatesDemo
        title="Refresh failed, old rows kept"
        rows={ORDERS_200.slice(0, 4)}
        view={{ refreshError: { onRetry: () => undefined } }}
      />
      <StatesDemo
        title="No access"
        rows={ORDERS_200.slice(0, 4)}
        view={{ noAccess: { description: 'Ask the event owner for the Finance role.' } }}
      />
      <StatesDemo
        title="Partial data (core BlockState)"
        rows={ORDERS_200.slice(0, 4)}
        view={{ state: { status: 'partial', reason: 'Box office sales sync once an hour.' } }}
      />
      <StatesDemo title="Loading via core BlockState" rows={[]} view={{ state: { status: 'loading' } }} />
    </div>
  ),
};

interface CellRow {
  id: string;
  kind: string;
  cell: ReactNode;
}

function CellsView() {
  const rows: CellRow[] = [
    { id: 'n', kind: 'Number / money / percent', cell: <span className="vl-table__text">$128,400 · 2,874 · 38.2%</span> },
    { id: 'delta', kind: 'Delta badge', cell: <DeltaCell value={12} /> },
    { id: 'delta-inv', kind: 'Delta, lower is better', cell: <DeltaCell value={8} invert /> },
    { id: 'spark', kind: 'Sparkline', cell: <SparklineCell values={TICKET_TYPES[0]!.trend} aria-label="Rising over 14 days" /> },
    { id: 'spark-gap', kind: 'Sparkline with a gap', cell: <SparklineCell values={TICKET_TYPES[4]!.trend} tone="neutral" /> },
    { id: 'bar', kind: 'Mini bar', cell: <BarCell share={0.72}>$94,686</BarCell> },
    { id: 'progress', kind: 'Progress', cell: <ProgressCell value={212} max={300} /> },
    { id: 'progress-full', kind: 'Progress, full', cell: <ProgressCell value={600} max={600} label="Sold out" /> },
    { id: 'status', kind: 'Status', cell: <StatusCell tone="positive">On sale</StatusCell> },
    { id: 'status-w', kind: 'Status, warning', cell: <StatusCell tone="warning">Paused</StatusCell> },
    { id: 'avatar', kind: 'Avatar with second line', cell: <AvatarCell name="Nora Vale" secondary="nora.vale@example.com" /> },
    { id: 'icon', kind: 'Icon', cell: <AvatarCell name="Main stage" icon="♪" secondary="Capacity 2,400" /> },
    { id: 'two', kind: 'Two lines', cell: <TwoLineCell primary="Weekend pass" secondary="Fri–Sun, all stages" /> },
    { id: 'dot', kind: 'Dot', cell: <DotCell color="var(--vl-cat-2)">Mobile app</DotCell> },
    { id: 'pill', kind: 'Pill', cell: <PillCell tone="accent">SUMMER15</PillCell> },
    { id: 'link', kind: 'Link', cell: <LinkCell href="https://example.com/orders/482000">#482000</LinkCell> },
    { id: 'unsafe', kind: 'Unsafe link → text', cell: <LinkCell href="javascript:void(0)">#482001</LinkCell> },
    { id: 'unknown', kind: 'Unknown with a reason', cell: <UnknownCell reason="Not on sale last week" /> },
  ];
  const columns = defineColumns<CellRow>([
    { id: 'kind', title: 'Cell', type: 'text', value: (row) => row.kind, sortable: false, filter: false },
    {
      id: 'cell',
      title: 'Example',
      type: 'text',
      value: () => null,
      render: (row) => row.cell,
      sortable: false,
      filter: false,
      width: 320,
    },
  ]);
  const table = useDataTable<CellRow>({ columns, rows, rowKey: (row) => row.id, storage: null });
  return (
    <div className="sbt-stack">
      <Block title="All cell types">
        <DataTable table={table} label="Cell types" />
      </Block>
      <Block title="In context">
        <PromoTable />
      </Block>
    </div>
  );
}

export const Cells: Story = {
  name: 'Cells gallery',
  render: () => <CellsView />,
};

function PromoTable() {
  const table = useDataTable({ columns: PROMO_COLUMNS, rows: PROMO_CODES, rowKey: (row) => row.id, storage: null });
  return <DataTable table={table} label="Promo codes" />;
}

function LiveView() {
  const [rows, setRows] = useState<TicketType[]>(TICKET_TYPES);
  const random = useRef(seeded(3));
  useEffect(() => {
    const timer = setInterval(() => setRows((current) => tickTicketTypes(current, random.current)), 1800);
    return () => clearInterval(timer);
  }, []);
  const table = useDataTable<TicketType>({ columns: TICKET_COLUMNS, rows, rowKey: ticketKey, storage: null });
  return (
    <Block
      title="Ticket types — live"
      note="Changed cells flash green or red with the change for 1.6 s; at most 14 at once. With reduced motion, a quiet tint instead."
    >
      <DataTable table={table} label="Ticket types, live" pulseChanges />
    </Block>
  );
}

export const Live: Story = {
  name: 'Live updates with pulse',
  render: () => <LiveView />,
};

/** Server mode: the table only reports state; this fake backend filters, sorts and pages with a delay. */
function ServerModeView() {
  const all = useMemo(() => makeOrders(4_000, 9), []);
  const [state, setState] = useState<TableState | undefined>(undefined);
  const [page, setPage] = useState<{ rows: Order[]; total: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const table = useDataTable<Order>({
    columns: ORDER_COLUMNS,
    rows: page?.rows ?? [],
    rowCount: page?.total ?? 0,
    rowKey: orderKey,
    storage: null,
    mode: 'server',
    pagination: 'pages',
    pageSize: 25,
    onStateChange: setState,
  });
  const query = state ?? table.state;
  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => {
      const matched = sortRows(
        filterRows(all, ORDER_COLUMNS, query.filters, query.search, table.format),
        ORDER_COLUMNS,
        query.sort,
        table.format.locale,
      );
      const start = query.page * query.pageSize;
      setPage({ rows: matched.slice(start, start + query.pageSize), total: matched.length });
      setLoading(false);
    }, 450);
    return () => clearTimeout(timer);
  }, [all, query.filters, query.search, query.sort, query.page, query.pageSize, table.format]);
  return (
    <Block
      title="Orders from a server"
      note="Filters, search, sort and page go to the (fake) backend; rows come back already prepared."
      toolbar={<DataTableToolbar table={table} search filters settings />}
    >
      <DataTable table={table} label="Orders from a server" loading={loading} />
    </Block>
  );
}

export const ServerMode: Story = {
  name: 'Server mode',
  render: () => <ServerModeView />,
};

function RowNavigationView() {
  const [active, setActive] = useState<string | null>('o3');
  return (
    <OrdersDemo
      options={{ pageSize: 10 }}
      note="The first cell is a real link (middle click, open in new tab work); the click on the row is intercepted here to mark the active row."
      view={{
        rowHref: (row) => `#/orders/${row.id}`,
        onRowNavigate: (href, event) => {
          event.preventDefault();
          setActive(href.split('/').at(-1) ?? null);
        },
        activeRowKey: active,
      }}
    />
  );
}

export const RowNavigation: Story = {
  name: 'Row links and active row',
  render: () => <RowNavigationView />,
};

export const PhoneCards: Story = {
  name: 'Phone 390: cards',
  parameters: { viewport: { defaultViewport: 'phone' } },
  globals: { viewport: { value: 'phone', isRotated: false } },
  render: () => (
    <OrdersDemo
      options={{ pageSize: 10, selectable: true }}
      note="Below 640 px each row becomes a card: title, value, meta line and status. Sorting moves to a menu above."
      view={{ mobileLayout: 'cards', rowDetails: true }}
    />
  ),
};

function PhoneScrollView() {
  const table = useDataTable<TicketType>({ columns: TICKET_COLUMNS, rows: TICKET_TYPES, rowKey: ticketKey, storage: null });
  return (
    <Block
      title="Ticket types"
      note="Only the first column stays pinned and takes at most 45% of the width; the rest scrolls sideways. Tap a row for details."
    >
      <DataTable table={table} label="Ticket types" mobileLayout="scroll" rowDetails />
    </Block>
  );
}

export const PhoneScroll: Story = {
  name: 'Phone 390: scroll with the first column pinned',
  parameters: { viewport: { defaultViewport: 'phone' } },
  globals: { viewport: { value: 'phone', isRotated: false } },
  render: () => <PhoneScrollView />,
};

export const DarkTheme: Story = {
  name: 'Dark theme',
  globals: { theme: 'dark' },
  render: () => <OrdersDemo options={{ selectable: true, pageSize: 10 }} view={{ maxHeight: 420 }} />,
};

function RussianView() {
  const table = useDataTable<TicketType>({
    columns: TICKET_COLUMNS,
    rows: TICKET_TYPES,
    rowKey: ticketKey,
    storage: null,
    currency: 'RUB',
  });
  return (
    <Block title="Типы билетов" toolbar={<DataTableToolbar table={table} search settings />}>
      <DataTable table={table} label="Типы билетов" />
    </Block>
  );
}

export const Russian: Story = {
  name: 'Russian locale',
  globals: { locale: 'ru' },
  render: () => <RussianView />,
};

function HeadlessView() {
  const table = useDataTable<TicketType>({ columns: TICKET_COLUMNS, rows: TICKET_TYPES, rowKey: ticketKey, storage: null });
  return (
    <Block title="useDataTable without DataTable" note="The hook gives the prepared rows, totals and actions; the markup is yours.">
      <div className="sbt-card">
        <table className="sbt-plain">
          <thead>
            <tr>
              {table.visible.slice(0, 4).map((column) => {
                const sort = table.state.sort.find((key) => key.columnId === column.id);
                return (
                  <th
                    key={column.id}
                    data-align={column.type === 'text' ? undefined : 'end'}
                    aria-sort={sort === undefined ? 'none' : sort.direction === 'asc' ? 'ascending' : 'descending'}
                  >
                    <button type="button" onClick={() => table.toggleSort(column.id)}>
                      {column.title}
                      {sort === undefined ? '' : sort.direction === 'asc' ? ' ↑' : ' ↓'}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {table.model.items.map((item) =>
              item.kind === 'row' ? (
                <tr key={item.key}>
                  {table.visible.slice(0, 4).map((column) => (
                    <td key={column.id} data-align={column.type === 'text' ? undefined : 'end'}>
                      {String(column.value(item.row) ?? '—')}
                    </td>
                  ))}
                </tr>
              ) : null,
            )}
          </tbody>
        </table>
      </div>
    </Block>
  );
}

export const Headless: Story = {
  name: 'Headless: your own markup',
  render: () => <HeadlessView />,
};
