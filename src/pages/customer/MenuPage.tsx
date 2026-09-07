import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import type { Product, MarketingProgram } from '@/lib/types';
import { CATEGORY_ORDER, getOperationalStatus } from '@/lib/categories';
import { ProductCard } from '@/components/ProductCard';
import { CartDrawer } from '@/components/CartDrawer';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { ShoppingCart, Clock, Coffee, X, User, LogOut, LayoutDashboard, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function MenuPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [programs, setPrograms] = useState<MarketingProgram[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('');
  const [cartOpen, setCartOpen] = useState(false);
  const [hoursPopup, setHoursPopup] = useState(false);
  const [tableParam, setTableParam] = useState('Takeaway');
  const { addItem, count, setProducts: setCartProducts, setPromoPrograms, pendingVariantSelection, resolveVariantSelection, cancelVariantSelection } = useCart();
  const { member, isAdmin, isStaff, signOut } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const opStatus = useMemo(() => getOperationalStatus(), []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const table = params.get('table');
    if (table) {
      setTableParam(table.replace(/-/g, ' '));
      localStorage.setItem('cafe13_table', table.replace(/-/g, ' '));
    }
    setHoursPopup(true);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: prods, error: pErr } = await supabase
        .from('products')
        .select('*')
        .eq('pos_hidden', false)
        .order('name');
      if (pErr) {
        addToast('Failed to load menu', 'error');
        return;
      }
      setProducts(prods || []);
      setCartProducts(prods || []);

      const { data: promos } = await supabase
        .from('marketing_programs')
        .select('*')
        .eq('active', true);
      setPrograms(promos || []);
      setPromoPrograms(promos || []);
    })();
  }, []);

  const categories = useMemo(() => {
    const cats = new Set(products.map(p => p.category));
    return CATEGORY_ORDER.filter(c => cats.has(c));
  }, [products]);

  useEffect(() => {
    if (categories.length > 0 && !activeCategory) {
      setActiveCategory(categories[0]);
    }
  }, [categories, activeCategory]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => p.category === activeCategory);
  }, [products, activeCategory]);

  const handleAdd = (product: Product, variant: string) => {
    addItem(product, variant);
    addToast(`${product.name} (${variant}) added to cart`, 'success');
  };

  const handleCheckout = () => {
    setCartOpen(false);
    navigate('/checkout');
  };

  return (
    <div className="min-h-screen bg-cream-100">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-cream-100/95 backdrop-blur-sm border-b border-cream-200">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Coffee className="w-7 h-7 text-espresso-600" />
            <div>
              <h1 className="font-display font-bold text-espresso-600 text-lg leading-none">13e Café</h1>
              <p className="text-xs text-espresso-300 mt-0.5">{tableParam}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {member || isAdmin || isStaff ? (
              <div className="flex items-center gap-2">
                {isAdmin && (
                  <button
                    onClick={() => navigate('/admin')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-espresso-600 text-cream-100 text-sm font-medium hover:bg-espresso-700 transition-colors"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span className="hidden sm:inline">Admin Panel</span>
                  </button>
                )}
                {(isAdmin || isStaff) && (
                  <button
                    onClick={() => navigate('/staff')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cream-200 text-espresso-600 text-sm font-medium hover:bg-cream-300 transition-colors"
                  >
                    <LayoutDashboard className="w-4 h-4" />
                    <span className="hidden sm:inline">Staff</span>
                  </button>
                )}
                {member && (
                  <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-cream-200">
                    <User className="w-4 h-4 text-espresso-400" />
                    <span className="text-sm text-espresso-600">{member.name}</span>
                    <span className="badge bg-sage-100 text-sage-600">{member.tier}</span>
                  </div>
                )}
                <button onClick={signOut} className="p-2 rounded-xl hover:bg-cream-200 transition-colors">
                  <LogOut className="w-5 h-5 text-espresso-400" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => navigate('/login')}
                className="btn-secondary text-sm py-2 px-4"
              >
                Login
              </button>
            )}
            <button
              onClick={() => setCartOpen(true)}
              className="relative p-2.5 rounded-xl bg-espresso-600 text-cream-100 hover:bg-espresso-700 transition-colors"
            >
              <ShoppingCart className="w-5 h-5" />
              {count > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-amber-400 text-espresso-700 text-xs font-bold rounded-full flex items-center justify-center">
                  {count}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Category tabs */}
        {!opStatus.isOpen ? null : (
          <div className="max-w-5xl mx-auto px-4 pb-3">
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200 ${
                    activeCategory === cat
                      ? 'bg-espresso-600 text-cream-100 shadow-sm'
                      : 'bg-cream-200 text-espresso-400 hover:bg-cream-300'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        )}
      </header>

      {/* Closed message */}
      {!opStatus.isOpen && (
        <div className="max-w-5xl mx-auto px-4 py-16">
          <div className="card p-8 text-center">
            <Coffee className="w-16 h-16 text-espresso-300 mx-auto mb-4" />
            <h2 className="font-display font-bold text-xl text-espresso-600 mb-2">We're Closed</h2>
            <p className="text-espresso-400">{opStatus.message}</p>
          </div>
        </div>
      )}

      {/* Menu grid */}
      {opStatus.isOpen && (
        <main className="max-w-5xl mx-auto px-4 py-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {filteredProducts.map(product => (
              <ProductCard key={product.id} product={product} onAdd={handleAdd} />
            ))}
          </div>
          {filteredProducts.length === 0 && (
            <div className="text-center py-16 text-espresso-300">
              <p>No items in this category yet.</p>
            </div>
          )}
        </main>
      )}

      {/* Hours popup */}
      {hoursPopup && (
        <div className="fixed inset-0 z-50 bg-espresso-900/50 flex items-center justify-center p-4 animate-fade-in" onClick={() => setHoursPopup(false)}>
          <div className="bg-cream-100 rounded-2xl p-6 max-w-sm w-full animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                <Clock className="w-6 h-6 text-espresso-600" />
                <h2 className="font-display font-bold text-lg text-espresso-600">Opening Hours</h2>
              </div>
              <button onClick={() => setHoursPopup(false)} className="p-1 hover:bg-cream-200 rounded-lg">
                <X className="w-5 h-5 text-espresso-400" />
              </button>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-espresso-400">Sunday–Friday</span><span className="text-espresso-600 font-medium">08:30–19:30</span></div>
              <div className="flex justify-between"><span className="text-espresso-400">Saturday</span><span className="text-espresso-600 font-medium">08:30–21:30</span></div>
              <div className="flex justify-between"><span className="text-espresso-400">Monday</span><span className="text-rust-500 font-medium">Closed</span></div>
            </div>
            <div className={`mt-4 p-3 rounded-xl text-sm ${opStatus.isOpen ? 'bg-sage-50 text-sage-600' : 'bg-rust-50 text-rust-500'}`}>
              {opStatus.message}
            </div>
            <button onClick={() => setHoursPopup(false)} className="btn-primary w-full mt-4">
              {opStatus.isOpen ? 'Start Ordering' : 'Got it'}
            </button>
          </div>
        </div>
      )}

      {/* Pending promo variant selection */}
      {pendingVariantSelection && (
        <div className="fixed inset-0 z-50 bg-espresso-900/50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-cream-100 rounded-2xl p-6 max-w-sm w-full animate-slide-up">
            <div className="flex items-center gap-2 mb-4">
              <span className="badge bg-sage-100 text-sage-600">Free Gift!</span>
            </div>
            <h3 className="font-display font-semibold text-espresso-600 mb-1">
              Select your free {pendingVariantSelection.product.name}
            </h3>
            <p className="text-sm text-espresso-300 mb-4">This item is included for free with your order.</p>
            <div className="max-h-60 overflow-y-auto flex flex-col gap-1.5">
              {pendingVariantSelection.product.variant_names.map(variant => (
                <button
                  key={variant}
                  onClick={() => resolveVariantSelection(variant)}
                  className="flex items-center justify-between px-4 py-3 rounded-xl bg-white hover:bg-sage-50 transition-colors text-left border border-cream-200"
                >
                  <span className="text-sm font-medium text-espresso-600">{variant}</span>
                  <span className="text-sm text-sage-500 font-medium">Rp0</span>
                </button>
              ))}
            </div>
            <button onClick={cancelVariantSelection} className="btn-secondary w-full mt-4 text-sm py-2.5">
              Skip
            </button>
          </div>
        </div>
      )}

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} onCheckout={handleCheckout} />
    </div>
  );
}
