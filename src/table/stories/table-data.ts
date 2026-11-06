/**
 * Fictional demo data for the table stories: orders, ticket types and promo codes of a made-up
 * music festival. Seeded, so every story renders the same rows. No real people or companies:
 * names are combined from short lists, emails use example.com.
 */

export function seeded(seed = 11): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 1_000_000) / 1_000_000;
  };
}

const FIRST = [
  'Ava',
  'Liam',
  'Mia',
  'Noah',
  'Zoe',
  'Ezra',
  'Iris',
  'Owen',
  'Nora',
  'Felix',
  'Ruby',
  'Milo',
  'Lena',
  'Hugo',
  'Ada',
  'Theo',
] as const;
const LAST = [
  'Hart',
  'Quinn',
  'Vale',
  'Brooks',
  'Marsh',
  'Lowe',
  'Reyes',
  'Frost',
  'Kerr',
  'Blake',
  'Shaw',
  'Penn',
  'Moss',
  'Rowe',
] as const;

export const ORDER_STATUS = { paid: 'paid', pending: 'pending', refunded: 'refunded', failed: 'failed' } as const;
export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];

export const ORDER_STATUS_OPTIONS = [
  { value: ORDER_STATUS.paid, label: 'Paid', tone: 'positive' },
  { value: ORDER_STATUS.pending, label: 'Pending', tone: 'warning' },
  { value: ORDER_STATUS.refunded, label: 'Refunded', tone: 'neutral' },
  { value: ORDER_STATUS.failed, label: 'Failed', tone: 'negative' },
] as const;

export const CHANNELS = ['Website', 'Mobile app', 'Box office', 'Partner'] as const;
export type Channel = (typeof CHANNELS)[number];

export const CHANNEL_COLORS: Record<Channel, string> = {
  Website: 'var(--vl-cat-1)',
  'Mobile app': 'var(--vl-cat-2)',
  'Box office': 'var(--vl-cat-3)',
  Partner: 'var(--vl-cat-4)',
};

export interface TicketType {
  id: string;
  name: string;
  price: number;
  sold: number;
  capacity: number;
  revenue: number;
  delta: number | null;
  status: 'selling' | 'paused' | 'soldout' | 'scheduled';
  trend: number[];
}

export const TICKET_TYPES: TicketType[] = [
  {
    id: 't1',
    name: 'General admission',
    price: 59,
    sold: 1840,
    capacity: 2400,
    revenue: 108560,
    delta: 12,
    status: 'selling',
    trend: [40, 52, 48, 61, 70, 66, 82, 90, 88, 97, 110, 104, 121, 130],
  },
  {
    id: 't2',
    name: 'Early bird',
    price: 39,
    sold: 600,
    capacity: 600,
    revenue: 23400,
    delta: null,
    status: 'soldout',
    trend: [90, 84, 77, 70, 51, 40, 22, 10, 0, 0, 0, 0, 0, 0],
  },
  {
    id: 't3',
    name: 'VIP lounge',
    price: 189,
    sold: 212,
    capacity: 300,
    revenue: 40068,
    delta: 31,
    status: 'selling',
    trend: [4, 6, 5, 9, 8, 12, 14, 13, 18, 17, 22, 25, 24, 30],
  },
  {
    id: 't4',
    name: 'Weekend pass',
    price: 129,
    sold: 734,
    capacity: 1200,
    revenue: 94686,
    delta: -4,
    status: 'selling',
    trend: [60, 58, 61, 57, 55, 59, 54, 52, 53, 50, 51, 49, 50, 48],
  },
  {
    id: 't5',
    name: 'Student',
    price: 29,
    sold: 318,
    capacity: 500,
    revenue: 9222,
    delta: 7,
    status: 'paused',
    trend: [10, 14, 12, 18, 20, Number.NaN, Number.NaN, 22, 25, 23, 26, 28, 27, 30],
  },
  {
    id: 't6',
    name: 'Family (4)',
    price: 179,
    sold: 96,
    capacity: 250,
    revenue: 17184,
    delta: 2,
    status: 'selling',
    trend: [5, 6, 6, 7, 7, 8, 7, 8, 9, 8, 9, 10, 9, 10],
  },
  { id: 't7', name: 'Late night', price: 45, sold: 0, capacity: 400, revenue: 0, delta: null, status: 'scheduled', trend: [] },
];

export const TICKET_STATUS_OPTIONS = [
  { value: 'selling', label: 'On sale', tone: 'positive' },
  { value: 'paused', label: 'Paused', tone: 'warning' },
  { value: 'soldout', label: 'Sold out', tone: 'neutral' },
  { value: 'scheduled', label: 'Scheduled', tone: 'info' },
] as const;

export interface Order {
  id: string;
  number: string;
  buyer: string;
  email: string;
  ticket: string;
  quantity: number;
  amount: number;
  fee: number;
  status: OrderStatus;
  channel: Channel;
  createdAt: string;
  promo: string | null;
  checkedIn: number;
}

/** "Now" of the demo, so relative dates read the same in every run: 2026-10-20 18:00 UTC. */
export const DEMO_NOW = Date.UTC(2026, 9, 20, 18, 0);

const STATUS_WEIGHTS: readonly [OrderStatus, number][] = [
  [ORDER_STATUS.paid, 0.82],
  [ORDER_STATUS.pending, 0.08],
  [ORDER_STATUS.refunded, 0.07],
  [ORDER_STATUS.failed, 0.03],
];

function pickStatus(value: number): OrderStatus {
  let acc = 0;
  for (const [status, weight] of STATUS_WEIGHTS) {
    acc += weight;
    if (value < acc) return status;
  }
  return ORDER_STATUS.paid;
}

const PROMOS = ['SUMMER15', 'FRIENDS10', 'CREW', 'LASTCALL'] as const;

/** `count` orders, newest first. 50 000 rows build in well under a second. */
export function makeOrders(count: number, seed = 11): Order[] {
  const random = seeded(seed);
  const orders: Order[] = new Array<Order>(count);
  let time = DEMO_NOW;
  for (let index = 0; index < count; index += 1) {
    time -= Math.floor(random() * 40 * 60_000) + 30_000;
    const first = FIRST[Math.floor(random() * FIRST.length)] ?? 'Ava';
    const last = LAST[Math.floor(random() * LAST.length)] ?? 'Hart';
    const ticket = TICKET_TYPES[Math.floor(random() * (TICKET_TYPES.length - 1))] ?? TICKET_TYPES[0]!;
    const quantity = 1 + Math.floor(random() * random() * 6);
    const status = pickStatus(random());
    const amount = ticket.price * quantity;
    const promo = random() < 0.14 ? (PROMOS[Math.floor(random() * PROMOS.length)] ?? null) : null;
    orders[index] = {
      id: `o${index + 1}`,
      number: `#${(482_000 - index).toString()}`,
      buyer: `${first} ${last}`,
      email: `${first}.${last}${index % 97}@example.com`.toLowerCase(),
      ticket: ticket.name,
      quantity,
      amount: promo === null ? amount : Math.round(amount * 0.88),
      fee: Math.round(amount * 0.06 * 100) / 100,
      status,
      channel: CHANNELS[Math.floor(random() * random() * CHANNELS.length)] ?? 'Website',
      createdAt: new Date(time).toISOString(),
      promo,
      checkedIn: status === ORDER_STATUS.paid ? Math.floor(random() * (quantity + 1)) : 0,
    };
  }
  return orders;
}

export interface PromoCode {
  id: string;
  code: string;
  discount: number;
  uses: number;
  limit: number | null;
  revenue: number;
  conversion: number;
  active: boolean;
  expiresAt: string | null;
}

export const PROMO_CODES: PromoCode[] = [
  {
    id: 'p1',
    code: 'SUMMER15',
    discount: 15,
    uses: 412,
    limit: 500,
    revenue: 21890,
    conversion: 38.2,
    active: true,
    expiresAt: '2026-10-31',
  },
  { id: 'p2', code: 'FRIENDS10', discount: 10, uses: 268, limit: null, revenue: 15022, conversion: 22.7, active: true, expiresAt: null },
  { id: 'p3', code: 'CREW', discount: 100, uses: 64, limit: 80, revenue: 0, conversion: 91.4, active: true, expiresAt: '2026-10-24' },
  {
    id: 'p4',
    code: 'LASTCALL',
    discount: 20,
    uses: 97,
    limit: 100,
    revenue: 6034,
    conversion: 12.9,
    active: false,
    expiresAt: '2026-10-12',
  },
  { id: 'p5', code: 'NEIGHBOURS', discount: 25, uses: 0, limit: 200, revenue: 0, conversion: 0, active: true, expiresAt: '2026-11-15' },
];

/** Moves a few numbers of the ticket types, as a live feed would. */
export function tickTicketTypes(rows: readonly TicketType[], random: () => number): TicketType[] {
  return rows.map((row) => {
    if (row.status !== 'selling' || random() > 0.35) return row;
    const add = 1 + Math.floor(random() * 4);
    const sold = Math.min(row.capacity, row.sold + add);
    return { ...row, sold, revenue: sold * row.price, trend: [...row.trend.slice(1), (row.trend.at(-1) ?? 0) + add] };
  });
}
