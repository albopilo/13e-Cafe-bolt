import { useCart } from '@/context/CartContext';
import { useLang } from '@/context/LanguageContext';
import { formatRupiah } from '@/lib/format';
import { Plus, Minus, X, Gift, ShoppingCart } from 'lucide-react';

export function CartDrawer({ open, onClose, onCheckout }: { open: boolean; onClose: () => void; onCheckout: () => void }) {
  const { items, changeQty, removeItem, count } = useCart();
  const { t } = useLang();
  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end animate-fade-in" onClick={onClose}>
      <div className="absolute inset-0 bg-espresso-900/50" />
      <div
        className="relative bg-cream-100 w-full max-w-sm h-full flex flex-col shadow-2xl animate-slide-in-right"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b border-cream-200 flex items-center justify-between">
          <h2 className="font-display font-semibold text-espresso-600 flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" />
            {t('yourCart')} ({count})
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-cream-200 rounded-lg transition-colors">
            <X className="w-5 h-5 text-espresso-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-espresso-300 gap-2">
              <ShoppingCart className="w-12 h-12" />
              <p className="text-sm">{t('cartEmpty')}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {items.map((item, index) => (
                <div
                  key={`${item.product_id}-${item.variant}-${index}`}
                  className={`bg-white rounded-xl p-3 border border-cream-200 ${item.is_promo ? 'border-sage-300 bg-sage-50' : ''}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-espresso-600 truncate">
                        {item.name}
                      </p>
                      <p className="text-xs text-espresso-300 mt-0.5">{item.variant}</p>
                      {item.is_promo && (
                        <p className="text-xs text-sage-500 mt-1 flex items-center gap-1">
                          <Gift className="w-3 h-3" /> {t('freePromoItem')}
                        </p>
                      )}
                    </div>
                    {!item.is_promo && (
                      <button
                        onClick={() => removeItem(index)}
                        className="p-1 hover:bg-rust-50 rounded transition-colors"
                      >
                        <X className="w-4 h-4 text-espresso-300" />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => changeQty(index, -1)}
                        className="w-7 h-7 rounded-lg bg-cream-200 hover:bg-cream-300 flex items-center justify-center transition-colors"
                      >
                        <Minus className="w-3.5 h-3.5 text-espresso-500" />
                      </button>
                      <span className="text-sm font-medium w-6 text-center">{item.quantity}</span>
                      <button
                        onClick={() => changeQty(index, 1)}
                        className="w-7 h-7 rounded-lg bg-cream-200 hover:bg-cream-300 flex items-center justify-center transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5 text-espresso-500" />
                      </button>
                    </div>
                    <span className={`text-sm font-medium ${item.is_promo ? 'text-sage-500' : 'text-espresso-600'}`}>
                      {item.is_promo ? 'Rp0' : formatRupiah(item.price * item.quantity)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="p-4 border-t border-cream-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-espresso-400">{t('subtotal')}</span>
              <span className="font-semibold text-espresso-600">{formatRupiah(subtotal)}</span>
            </div>
            <button
              onClick={onCheckout}
              className="btn-primary w-full"
            >
              {t('checkout')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
