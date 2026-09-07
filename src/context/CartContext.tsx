import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { CartItem, MarketingProgram, Product } from '@/lib/types';
import { loadCart, saveCart, addToCart, updateQuantity, removeFromCart, detectPromo, addPromoItem, getCartCount } from '@/lib/cart';
import { useAuth } from './AuthContext';

interface CartContextValue {
  items: CartItem[];
  count: number;
  isMember: boolean;
  promoPrograms: MarketingProgram[];
  products: Product[];
  setProducts: (p: Product[]) => void;
  setPromoPrograms: (p: MarketingProgram[]) => void;
  addItem: (product: Product, variant: string, quantity?: number) => void;
  changeQty: (index: number, delta: number) => void;
  removeItem: (index: number) => void;
  clear: () => void;
  pendingVariantSelection: { program: MarketingProgram; product: Product } | null;
  resolveVariantSelection: (variant: string) => void;
  cancelVariantSelection: () => void;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const { member } = useAuth();
  const isMember = !!member;

  const [items, setItems] = useState<CartItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [promoPrograms, setPromoPrograms] = useState<MarketingProgram[]>([]);
  const [pendingVariantSelection, setPendingVariantSelection] = useState<{ program: MarketingProgram; product: Product } | null>(null);

  useEffect(() => {
    setItems(loadCart(isMember));
  }, [isMember]);

  useEffect(() => {
    saveCart(items, isMember);
  }, [items, isMember]);

  const checkPromos = (newItems: CartItem[]) => {
    const { items: updated, needsVariantSelection } = detectPromo(newItems, promoPrograms, products);
    setItems(updated);
    if (needsVariantSelection) {
      setPendingVariantSelection(needsVariantSelection);
    }
  };

  const addItem = (product: Product, variant: string, quantity: number = 1) => {
    const newItems = addToCart(items, product, variant, quantity);
    checkPromos(newItems);
  };

  const changeQty = (index: number, delta: number) => {
    setItems(updateQuantity(items, index, delta));
  };

  const removeItem = (index: number) => {
    setItems(removeFromCart(items, index));
  };

  const clear = () => {
    setItems([]);
  };

  const resolveVariantSelection = (variant: string) => {
    if (!pendingVariantSelection) return;
    const { program, product } = pendingVariantSelection;
    setItems(prev => addPromoItem(prev, program, product, variant));
    setPendingVariantSelection(null);
  };

  const cancelVariantSelection = () => {
    setPendingVariantSelection(null);
  };

  return (
    <CartContext.Provider value={{
      items,
      count: getCartCount(items),
      isMember,
      products,
      setProducts,
      setPromoPrograms,
      promoPrograms,
      addItem,
      changeQty,
      removeItem,
      clear,
      pendingVariantSelection,
      resolveVariantSelection,
      cancelVariantSelection,
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
