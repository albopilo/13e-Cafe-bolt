import type { Order } from './types';

const GUEST_ORDERS_KEY = 'cafe13_guest_orders';
const GUEST_ORDER_TTL = 24 * 60 * 60 * 1000;

export interface GuestOrderCache {
  id: string;
  table_name: string;
  grand_total: number;
  payment_method: 'cash' | 'qris';
  payment_status: string;
  status: string;
  items: Array<{ product_id: string; name: string; variant: string; price: number; quantity: number; is_promo: boolean }>;
  created_at: string;
}

export function getGuestOrders(): GuestOrderCache[] {
  try {
    const raw = localStorage.getItem(GUEST_ORDERS_KEY);
    if (!raw) return [];
    const orders = JSON.parse(raw) as GuestOrderCache[];
    const cutoff = Date.now() - GUEST_ORDER_TTL;
    const fresh = orders.filter(o => new Date(o.created_at).getTime() > cutoff);
    if (fresh.length !== orders.length) {
      localStorage.setItem(GUEST_ORDERS_KEY, JSON.stringify(fresh));
    }
    return fresh.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  } catch {
    return [];
  }
}

export function addGuestOrder(order: GuestOrderCache): void {
  const orders = getGuestOrders();
  if (!orders.some(o => o.id === order.id)) {
    orders.unshift(order);
    localStorage.setItem(GUEST_ORDERS_KEY, JSON.stringify(orders));
  }
}

export function getGuestOrderById(id: string): GuestOrderCache | null {
  return getGuestOrders().find(o => o.id === id) ?? null;
}

export function removeGuestOrder(id: string): void {
  const orders = getGuestOrders().filter(o => o.id !== id);
  localStorage.setItem(GUEST_ORDERS_KEY, JSON.stringify(orders));
}

export function guestOrderToOrder(g: GuestOrderCache): Order {
  return {
    id: g.id,
    member_id: null,
    table_name: g.table_name,
    items: g.items,
    subtotal: 0,
    discount: 0,
    tax: 0,
    delivery_fee: 0,
    total: g.grand_total,
    grand_total: g.grand_total,
    status: g.status as Order['status'],
    payment_method: g.payment_method,
    payment_status: g.payment_status as Order['payment_status'],
    proof_url: null,
    voucher_id: null,
    date: g.created_at.split('T')[0],
    loyalty_recorded: false,
    loyalty_tx_id: null,
    phone: null,
    is_member: false,
    olsera_order_id: null,
    created_at: g.created_at,
  };
}
