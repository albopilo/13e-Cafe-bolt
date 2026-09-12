import { useState } from 'react';
import type { Product } from '@/lib/types';
import { formatRupiah } from '@/lib/format';
import { normalizeGoogleDriveUrl } from '@/lib/categories';
import { useLang } from '@/context/LanguageContext';
import { Plus, Coffee } from 'lucide-react';

interface ProductCardProps {
  product: Product;
  onAdd: (product: Product, variant: string) => void;
}

export function ProductCard({ product, onAdd }: ProductCardProps) {
  const { t } = useLang();
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');

  const photoUrl = product.photo_1 ? normalizeGoogleDriveUrl(product.photo_1) : null;
  const hasVariants = product.variant_names.length > 1;
  const variants = product.variant_names.filter(v =>
    search ? v.toLowerCase().includes(search.toLowerCase()) : true
  );

  const handleAdd = () => {
    if (hasVariants) {
      setShowModal(true);
    } else {
      onAdd(product, product.variant_names[0] || 'Regular');
    }
  };

  const handleVariantSelect = (variant: string) => {
    onAdd(product, variant);
    setShowModal(false);
    setSearch('');
  };

  return (
    <>
      <div className="card overflow-hidden group hover:shadow-md hover:-translate-y-0.5 flex flex-col">
        <div className="relative aspect-square bg-cream-200 overflow-hidden">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={product.name}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-espresso-300">
              <Coffee className="w-12 h-12" />
            </div>
          )}
        </div>
        <div className="p-3 flex flex-col gap-2 flex-1">
          <h3 className="font-display font-semibold text-sm text-espresso-600 leading-tight line-clamp-2">
            {product.name}
          </h3>
          <p className="text-xs text-espresso-300">
            {formatRupiah(product.pos_sell_price)}
          </p>
          <button
            onClick={handleAdd}
            className="mt-auto btn-sage text-xs py-2 flex items-center justify-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            {hasVariants ? t('selectVariation') : t('addToCart')}
          </button>
        </div>
      </div>

      {showModal && (
        <div
          className="fixed inset-0 bg-espresso-900/50 z-50 flex items-end sm:items-center justify-center animate-fade-in"
          onClick={() => { setShowModal(false); setSearch(''); }}
        >
          <div
            className="bg-cream-100 w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[80vh] flex flex-col animate-slide-up"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 border-b border-cream-200">
              <h3 className="font-display font-semibold text-espresso-600">
                {t('selectVariation')} — {product.variant_label}
              </h3>
              <p className="text-sm text-espresso-300 mt-1">{product.name}</p>
            </div>
            {product.variant_names.length > 12 && (
              <div className="px-4 pt-3">
                <input
                  type="text"
                  placeholder={t('searchVariants')}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="input-field text-sm py-2"
                  autoFocus
                />
              </div>
            )}
            <div className="overflow-y-auto p-3 flex-1">
              {variants.length === 0 ? (
                <p className="text-center text-espresso-300 py-8 text-sm">{t('noVariantsFound')}</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {variants.map(variant => (
                    <button
                      key={variant}
                      onClick={() => handleVariantSelect(variant)}
                      className="flex items-center justify-between px-4 py-3 rounded-xl bg-white hover:bg-sage-50 transition-colors text-left border border-cream-200"
                    >
                      <span className="text-sm font-medium text-espresso-600">{variant}</span>
                      <span className="text-sm text-espresso-400">{formatRupiah(product.pos_sell_price)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-cream-200">
              <button
                onClick={() => { setShowModal(false); setSearch(''); }}
                className="btn-secondary w-full text-sm py-2.5"
              >
                {t('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
