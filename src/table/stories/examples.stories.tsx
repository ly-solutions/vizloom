import type { Meta, StoryObj } from '@storybook/react';
import { useMemo, useState } from 'react';

import { DataTable, DataTableToolbar, downloadText, toCsv, toExportData, useDataTable } from '..';
import { ORDER_COLUMNS, PROMO_COLUMNS, TICKET_COLUMNS } from './columns';
import { PROMO_CODES, TICKET_TYPES, makeOrders, type Order, type PromoCode, type TicketType } from './table-data';
import './stories.css';

const meta: Meta = {
  title: 'Examples/Tables',
  parameters: { layout: 'padded' },
};
export default meta;
type Story = StoryObj;

function OrdersPage() {
  const rows = useMemo(() => makeOrders(1_200, 21), []);
  const table = useDataTable<Order>({
    columns: ORDER_COLUMNS,
    rows,
    rowKey: (row) => row.id,
    selectable: true,
    pagination: 'pages',
    pageSize: 25,
    defaultSort: [{ columnId: 'createdAt', direction: 'desc' }],
    groupings: [
      { id: 'ticket', label: 'Ticket type', key: (row) => row.ticket },
      { id: 'channel', label: 'Channel', key: (row) => row.channel },
    ],
    viewToggles: [],
    storageKey: 'vizloom-example-orders',
  });
  return (
    <section className="sbt-block">
      <div className="sbt-head">
        <h2 className="sbt-title">Orders</h2>
        <DataTableToolbar
          table={table}
          search
          searchPlaceholder="Order, buyer or email"
          filters
          settings
          exportFormats={['csv']}
          onExport={() => downloadText(toCsv(toExportData(table.model.matched, table.visible)), 'orders.csv')}
        />
      </div>
      <DataTable
        table={table}
        label="Orders"
        mobileLayout="cards"
        rowHref={(row) => `#/orders/${row.id}`}
        onRowNavigate={(_href, event) => event.preventDefault()}
        bulkActions={(selected) => (
          <button type="button" className="vl-table-button vl-table-button--secondary vl-table-button--xs">
            Resend {selected.length} tickets
          </button>
        )}
        rowMenu={(row) => [
          { id: 'resend', label: 'Resend tickets', onSelect: () => undefined },
          { id: 'refund', label: 'Refund', destructive: true, disabled: row.status !== 'paid', onSelect: () => undefined },
        ]}
      />
    </section>
  );
}

export const Orders: Story = { render: () => <OrdersPage /> };

function PromoPage() {
  const table = useDataTable<PromoCode>({
    columns: PROMO_COLUMNS,
    rows: PROMO_CODES,
    rowKey: (row) => row.id,
    storage: null,
    defaultSort: [{ columnId: 'revenue', direction: 'desc' }],
  });
  return (
    <section className="sbt-block">
      <div className="sbt-head">
        <h2 className="sbt-title">Promo codes</h2>
        <DataTableToolbar table={table} search settings />
      </div>
      <DataTable table={table} label="Promo codes" mobileLayout="cards" totalsLabel="All codes" />
    </section>
  );
}

export const PromoCodes: Story = { name: 'Promo codes', render: () => <PromoPage /> };

function TicketsPage() {
  const table = useDataTable<TicketType>({
    columns: TICKET_COLUMNS,
    rows: TICKET_TYPES,
    rowKey: (row) => row.id,
    storage: null,
    expandable: (row) => row.sold > 0,
  });
  return (
    <section className="sbt-block">
      <div className="sbt-head">
        <h2 className="sbt-title">Ticket types</h2>
        <DataTableToolbar table={table} settings />
      </div>
      <DataTable
        table={table}
        label="Ticket types"
        renderExpanded={(row) => (
          <dl className="sbt-detail">
            <div>
              <dt>Capacity left</dt>
              <dd>{row.capacity - row.sold}</dd>
            </div>
            <div>
              <dt>Average per day</dt>
              <dd>{Math.round(row.sold / 14)}</dd>
            </div>
          </dl>
        )}
      />
    </section>
  );
}

export const TicketTypes: Story = { name: 'Ticket types', render: () => <TicketsPage /> };

function LongListPage() {
  const rows = useMemo(() => makeOrders(20_000, 33), []);
  const [active, setActive] = useState<string | null>(null);
  const table = useDataTable<Order>({ columns: ORDER_COLUMNS, rows, rowKey: (row) => row.id, storage: null, pagination: 'none' });
  return (
    <section className="sbt-block">
      <div className="sbt-head">
        <h2 className="sbt-title">All orders of the season</h2>
        <DataTableToolbar table={table} search filters settings />
      </div>
      <p className="sbt-note">20 000 rows in a 600 px window, virtualized. Click a row to mark it active.</p>
      <DataTable table={table} label="All orders" maxHeight={600} onRowClick={(row) => setActive(row.id)} activeRowKey={active} />
    </section>
  );
}

export const LongList: Story = { name: 'Long list', render: () => <LongListPage /> };

export const OrdersPhone: Story = {
  name: 'Orders on a phone',
  parameters: { viewport: { defaultViewport: 'phone' } },
  globals: { viewport: { value: 'phone', isRotated: false } },
  render: () => <OrdersPage />,
};
