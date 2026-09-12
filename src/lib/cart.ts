import type { CartItem, MarketingProgram, Product } from './types';

const CART_KEY = 'cafe13_cart';
const CART_TIMESTAMP_KEY = 'cafe13_cart_ts';
const GUEST_CART_TTL = 60 * 60 * 1000;
const TABLE_KEY = 'cafe13_table';

export function getTableName(): string {
  return localStorage.getItem(TABLE_KEY) || 'Takeaway';
}

export function setTableName(name: string): void {
  localStorage.setItem(TABLE_KEY, name);
}

export function loadCart(isMember: boolean): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return [];
    const ts = localStorage.getItem(CART_TIMESTAMP_KEY);
    if (!isMember && ts) {
      const age = Date.now() - parseInt(ts, 10);
      if (age > GUEST_CART_TTL) {
        clearCart();
        return [];
      }
    }
    return JSON.parse(raw) as CartItem[];
  } catch {
    return [];
  }
}

export function saveCart(items: CartItem[], isMember: boolean): void {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
  if (!isMember) {
    localStorage.setItem(CART_TIMESTAMP_KEY, Date.now().toString());
  }
}

export function clearCart(): void {
  localStorage.removeItem(CART_KEY);
  localStorage.removeItem(CART_TIMESTAMP_KEY);
}

export function addToCart(
  items: CartItem[],
  product: Product,
  variant: string,
  quantity: number = 1,
): CartItem[] {
  const existing = items.find(
    i => i.product_id === product.id && i.variant === variant && !i.is_promo,
  );
  if (existing) {
    return items.map(i =>
      i === existing ? { ...i, quantity: i.quantity + quantity } : i,
    );
  }
  return [
    ...items,
    {
      product_id: product.id,
      name: product.name,
      variant,
      price: product.pos_sell_price,
      quantity,
      is_promo: false,
      promo_link_id: null,
    },
  ];
}

export function updateQuantity(
  items: CartItem[],
  index: number,
  delta: number,
): CartItem[] {
  const item = items[index];
  if (!item) return items;
  const newQty = item.quantity + delta;
  if (newQty <= 0) {
    if (item.is_promo && item.promo_link_id) {
      return items.filter(
        i => i.promo_link_id !== item.promo_link_id || !i.is_promo,
      );
    }
    return items.filter((_, i) => i !== index);
  }
  return items.map((i, idx) => (idx === index ? { ...i, quantity: newQty } : i));
}

export function removeFromCart(items: CartItem[], index: number): CartItem[] {
  const item = items[index];
  if (!item) return items;
  if (!item.is_promo && item.promo_link_id) {
    return items.filter(i => i.promo_link_id !== item.promo_link_id);
  }
  return items.filter((_, i) => i !== index);
}

export function detectPromo(
  items: CartItem[],
  programs: MarketingProgram[],
  products: Product[],
): { items: CartItem[]; needsVariantSelection: { program: MarketingProgram; product: Product } | null } {
  let updated = [...items];
  let needsVariantSelection: { program: MarketingProgram; product: Product } | null = null;

  for (const program of programs) {
    if (!program.active) continue;
    const hasBuyItem = items.some(
      i => program.buy_product_ids.includes(i.product_id) && !i.is_promo,
    );
    const hasFreeItem = items.some(
      i => i.is_promo && i.promo_link_id === program.id,
    );
    if (hasBuyItem && !hasFreeItem) {
      const freeProduct = products.find(p => p.id === program.free_product_id);
      if (!freeProduct) continue;

      if (program.free_variant) {
        updated.push({
          product_id: freeProduct.id,
          name: freeProduct.name,
          variant: program.free_variant,
          price: 0,
          quantity: program.free_qty,
          is_promo: true,
          promo_link_id: program.id,
        });
      } else if (freeProduct.variant_names.length <= 1) {
        const variant = freeProduct.variant_names[0] || 'Regular';
        updated.push({
          product_id: freeProduct.id,
          name: freeProduct.name,
          variant,
          price: 0,
          quantity: program.free_qty,
          is_promo: true,
          promo_link_id: program.id,
        });
      } else {
        needsVariantSelection = { program, product: freeProduct };
      }
    }
  }

  return { items: updated, needsVariantSelection };
}

export function addPromoItem(
  items: CartItem[],
  program: MarketingProgram,
  product: Product,
  variant: string,
): CartItem[] {
  return [
    ...items,
    {
      product_id: product.id,
      name: product.name,
      variant,
      price: 0,
      quantity: program.free_qty,
      is_promo: true,
      promo_link_id: program.id,
    },
  ];
}

export function getCartSubtotal(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + i.price * i.quantity, 0);
}

export function getCartCount(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + i.quantity, 0);
}
