import {
  AvatarCell,
  BarCell,
  DeltaCell,
  DotCell,
  PillCell,
  ProgressCell,
  SparklineCell,
  StatusCell,
  defineColumns,
  type ColumnDef,
} from '..';
import {
  CHANNEL_COLORS,
  CHANNELS,
  ORDER_STATUS_OPTIONS,
  TICKET_STATUS_OPTIONS,
  type Order,
  type PromoCode,
  type TicketType,
} from './table-data';

export const ORDER_COLUMNS: ColumnDef<Order>[] = defineColumns<Order>([
  {
    id: 'number',
    title: 'Order',
    type: 'text',
    value: (row) => row.number,
    width: 120,
    minWidth: 100,
    pin: 'start',
    card: 'title',
    hideable: false,
  },
  {
    id: 'buyer',
    title: 'Buyer',
    type: 'text',
    value: (row) => row.buyer,
    width: 240,
    render: (row) => <AvatarCell name={row.buyer} secondary={row.email} />,
    card: 'meta',
  },
  { id: 'ticket', title: 'Ticket', type: 'text', value: (row) => row.ticket, width: 200, filter: 'select', card: 'meta' },
  { id: 'quantity', title: 'Qty', type: 'number', value: (row) => row.quantity, width: 90, total: 'sum', card: 'hidden' },
  {
    id: 'amount',
    title: 'Amount',
    type: 'money',
    value: (row) => row.amount,
    total: 'sum',
    card: 'value',
    description: 'What the buyer paid, after the promo code discount.',
  },
  { id: 'fee', title: 'Service fee', type: 'money', value: (row) => row.fee, fractionDigits: 2, total: 'sum', hidden: true },
  { id: 'status', title: 'Status', type: 'status', value: (row) => row.status, options: [...ORDER_STATUS_OPTIONS], card: 'badge' },
  {
    id: 'channel',
    title: 'Channel',
    type: 'text',
    value: (row) => row.channel,
    filter: 'select',
    width: 170,
    render: (row) => <DotCell color={CHANNEL_COLORS[row.channel]}>{row.channel}</DotCell>,
    options: CHANNELS.map((channel) => ({ value: channel, label: channel })),
  },
  {
    id: 'promo',
    title: 'Promo code',
    type: 'text',
    value: (row) => row.promo,
    width: 150,
    unknownReason: 'No promo code used',
    hidden: true,
  },
  { id: 'createdAt', title: 'Created', type: 'datetime', value: (row) => row.createdAt, card: 'meta' },
]);

export const TICKET_COLUMNS: ColumnDef<TicketType>[] = defineColumns<TicketType>([
  { id: 'name', title: 'Ticket type', type: 'text', value: (row) => row.name, pin: 'start', card: 'title', hideable: false },
  { id: 'price', title: 'Price', type: 'money', value: (row) => row.price, width: 120 },
  {
    id: 'sold',
    title: 'Sold',
    type: 'number',
    value: (row) => row.sold,
    total: 'sum',
    width: 200,
    render: (row) => <ProgressCell value={row.sold} max={row.capacity} aria-label={`${row.sold} of ${row.capacity} sold`} />,
    card: 'meta',
  },
  {
    id: 'revenue',
    title: 'Revenue',
    type: 'money',
    value: (row) => row.revenue,
    total: 'sum',
    bar: true,
    highlight: 'max',
    width: 190,
    render: (row, context) => (
      <BarCell share={context.share} best={context.best}>
        {context.formatted}
      </BarCell>
    ),
    card: 'value',
  },
  {
    id: 'delta',
    title: 'vs last week',
    type: 'percent',
    value: (row) => row.delta,
    width: 140,
    render: (row) => <DeltaCell value={row.delta} unknownLabel="Not on sale last week" />,
    unknownReason: 'Not on sale last week',
    card: 'hidden',
  },
  {
    id: 'trend',
    title: '14 days',
    type: 'text',
    value: (row) => (row.trend.length === 0 ? null : (row.trend.filter(Number.isFinite).at(-1) ?? null)),
    sortable: false,
    filter: false,
    searchable: false,
    width: 120,
    render: (row) =>
      row.trend.length === 0 ? (
        <PillCell>Not started</PillCell>
      ) : (
        <SparklineCell values={row.trend} aria-label={`Daily sales of ${row.name} over 14 days`} />
      ),
    card: 'hidden',
  },
  { id: 'status', title: 'Status', type: 'status', value: (row) => row.status, options: [...TICKET_STATUS_OPTIONS], card: 'badge' },
]);

export const PROMO_COLUMNS: ColumnDef<PromoCode>[] = defineColumns<PromoCode>([
  {
    id: 'code',
    title: 'Code',
    type: 'text',
    value: (row) => row.code,
    pin: 'start',
    card: 'title',
    render: (row) => <PillCell tone="accent">{row.code}</PillCell>,
  },
  { id: 'discount', title: 'Discount', type: 'percent', value: (row) => row.discount, width: 120 },
  {
    id: 'uses',
    title: 'Used',
    type: 'number',
    value: (row) => row.uses,
    total: 'sum',
    width: 190,
    render: (row) => (row.limit === null ? <span data-measure="">{row.uses}</span> : <ProgressCell value={row.uses} max={row.limit} />),
  },
  { id: 'revenue', title: 'Revenue', type: 'money', value: (row) => row.revenue, total: 'sum', card: 'value' },
  { id: 'conversion', title: 'Conversion', type: 'percent', value: (row) => row.conversion, fractionDigits: 1, bar: true, total: 'avg' },
  {
    id: 'active',
    title: 'State',
    type: 'status',
    value: (row) => (row.active ? 'active' : 'off'),
    options: [
      { value: 'active', label: 'Active', tone: 'positive' },
      { value: 'off', label: 'Turned off', tone: 'neutral' },
    ],
    render: (row) => <StatusCell tone={row.active ? 'positive' : 'neutral'}>{row.active ? 'Active' : 'Turned off'}</StatusCell>,
    card: 'badge',
  },
  { id: 'expiresAt', title: 'Expires', type: 'date', value: (row) => row.expiresAt, unknownReason: 'Never expires', card: 'meta' },
]);
