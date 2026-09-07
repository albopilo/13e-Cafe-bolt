import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import type { Product, Member, Voucher, MarketingProgram } from '@/lib/types';
import { CATEGORY_ORDER, normalizeGoogleDriveUrl } from '@/lib/categories';
import { formatRupiah } from '@/lib/format';
import { Package, Tag, Users, Gift, Plus, Pencil, Trash2, X, Loader2, RefreshCw, Search, Upload, Coffee } from 'lucide-react';

type Tab = 'products' | 'promos' | 'vouchers' | 'members';

export function AdminPanel() {
  const [tab, setTab] = useState<Tab>('products');
  const { signOut } = useAuth();

  return (
    <div className="min-h-screen bg-cream-50">
      <header className="sticky top-0 z-40 bg-espresso-600 text-cream-100 border-b border-espresso-700">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Coffee className="w-6 h-6" />
            <h1 className="font-display font-bold text-lg">Admin Panel</h1>
          </div>
          <button onClick={signOut} className="text-sm px-3 py-1.5 rounded-lg bg-espresso-700 hover:bg-espresso-800 transition-colors">
            Logout
          </button>
        </div>
        <div className="max-w-6xl mx-auto px-4 pb-3 flex gap-1.5">
          {([
            { id: 'products', label: 'Products', icon: Package },
            { id: 'promos', label: 'Promos', icon: Gift },
            { id: 'vouchers', label: 'Vouchers', icon: Tag },
            { id: 'members', label: 'Members', icon: Users },
          ] as const).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                tab === t.id ? 'bg-cream-100 text-espresso-600' : 'bg-espresso-700 text-cream-200 hover:bg-espresso-800'
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-4">
        {tab === 'products' && <ProductsTab />}
        {tab === 'promos' && <PromosTab />}
        {tab === 'vouchers' && <VouchersTab />}
        {tab === 'members' && <MembersTab />}
      </main>
    </div>
  );
}

function ProductsTab() {
  const { addToast } = useToast();
  const { session } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Product | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [showBulk, setShowBulk] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const fetchProducts = useCallback(async () => {
    const { data, error } = await supabase.from('products').select('*').order('name');
    if (error) {
      addToast('Failed to load products', 'error');
      return;
    }
    setProducts(data || []);
    setLoading(false);
  }, [addToast]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.category.toLowerCase().includes(search.toLowerCase())
  );

  const handleSync = async () => {
    setSyncing(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-olsera-products`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Sync failed');
      }
      const data = await response.json();
      addToast(`Synced ${data.synced} products from Olsera`, 'success');
      fetchProducts();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Sync failed — Olsera API may not be configured', 'error');
    } finally {
      setSyncing(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this product?')) return;
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) {
      addToast('Failed to delete', 'error');
    } else {
      addToast('Product deleted', 'success');
      fetchProducts();
    }
  };

  const handleBulkAdd = async () => {
    const lines = bulkText.trim().split('\n').filter(l => l.trim());
    if (lines.length === 0) return;
    const rows = lines.map(line => {
      const [variant, priceStr] = line.split('|').map(s => s.trim());
      return {
        name: variant,
        category: 'Uncategorized',
        variant_label: 'Variant',
        variant_names: [variant],
        pos_sell_price: parseInt(priceStr) || 0,
        pos_hidden: false,
      };
    });
    const { error } = await supabase.from('products').insert(rows);
    if (error) {
      addToast('Bulk add failed', 'error');
    } else {
      addToast(`Added ${rows.length} products`, 'success');
      setBulkText('');
      setShowBulk(false);
      fetchProducts();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-espresso-300" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search products..."
            className="input-field pl-10 text-sm py-2.5"
          />
        </div>
        <button onClick={() => { setEditing(null); setShowForm(true); }} className="btn-primary text-sm py-2.5 flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> Add Product
        </button>
        <button onClick={() => setShowBulk(!showBulk)} className="btn-secondary text-sm py-2.5 flex items-center gap-1.5">
          <Upload className="w-4 h-4" /> Bulk Add
        </button>
        <button onClick={handleSync} disabled={syncing} className="btn-sage text-sm py-2.5 flex items-center gap-1.5">
          {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Sync Olsera
        </button>
      </div>

      {showBulk && (
        <div className="card p-4 space-y-3">
          <h3 className="font-display font-semibold text-espresso-600">Bulk Add Products</h3>
          <p className="text-sm text-espresso-300">Paste one product per line: <code className="bg-cream-200 px-1 rounded">Variant | Price</code></p>
          <textarea
            value={bulkText}
            onChange={e => setBulkText(e.target.value)}
            rows={6}
            placeholder={'Cappuccino | 25000\nLatte | 28000\nAmericano | 22000'}
            className="input-field font-mono text-sm"
          />
          <div className="flex gap-2">
            <button onClick={handleBulkAdd} className="btn-primary text-sm py-2.5">Add Products</button>
            <button onClick={() => setShowBulk(false)} className="btn-secondary text-sm py-2.5">Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-espresso-300" /></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(p => (
            <div key={p.id} className="card p-3 flex gap-3">
              <div className="w-16 h-16 rounded-lg bg-cream-200 overflow-hidden flex-shrink-0">
                {p.photo_1 && (
                  <img src={normalizeGoogleDriveUrl(p.photo_1)} alt={p.name} className="w-full h-full object-cover" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-espresso-600 truncate">{p.name}</p>
                <p className="text-xs text-espresso-300">{p.category}</p>
                <p className="text-sm font-medium text-espresso-500 mt-1">{formatRupiah(p.pos_sell_price)}</p>
                <div className="flex gap-1.5 mt-2">
                  <button onClick={() => { setEditing(p); setShowForm(true); }} className="p-1.5 rounded-lg bg-cream-200 hover:bg-cream-300 transition-colors">
                    <Pencil className="w-3.5 h-3.5 text-espresso-500" />
                  </button>
                  <button onClick={() => handleDelete(p.id)} className="p-1.5 rounded-lg bg-rust-50 hover:bg-rust-100 transition-colors">
                    <Trash2 className="w-3.5 h-3.5 text-rust-500" />
                  </button>
                </div>
              </div>
              {p.pos_hidden && <span className="badge bg-cream-200 text-espresso-400">Hidden</span>}
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <ProductForm
          product={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={() => { fetchProducts(); setShowForm(false); setEditing(null); }}
        />
      )}
    </div>
  );
}

function ProductForm({ product, onClose, onSaved }: { product: Product | null; onClose: () => void; onSaved: () => void }) {
  const { addToast } = useToast();
  const [name, setName] = useState(product?.name || '');
  const [category, setCategory] = useState(product?.category || 'Coffee');
  const [variantLabel, setVariantLabel] = useState(product?.variant_label || 'Variant');
  const [variantNames, setVariantNames] = useState((product?.variant_names || []).join('\n'));
  const [price, setPrice] = useState(String(product?.pos_sell_price || 0));
  const [hidden, setHidden] = useState(product?.pos_hidden || false);
  const [photo1, setPhoto1] = useState(product?.photo_1 || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const data = {
      name,
      category,
      variant_label: variantLabel,
      variant_names: variantNames.split('\n').map(v => v.trim()).filter(Boolean),
      pos_sell_price: parseInt(price) || 0,
      pos_hidden: hidden,
      photo_1: photo1 ? normalizeGoogleDriveUrl(photo1) : null,
      updated_at: new Date().toISOString(),
    };

    let error;
    if (product) {
      ({ error } = await supabase.from('products').update(data).eq('id', product.id));
    } else {
      ({ error } = await supabase.from('products').insert(data));
    }

    setSaving(false);
    if (error) {
      addToast('Failed to save product', 'error');
    } else {
      addToast('Product saved', 'success');
      onSaved();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-espresso-900/50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-cream-100 rounded-2xl p-6 max-w-md w-full max-h-[85vh] overflow-y-auto animate-slide-up" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-bold text-espresso-600">{product ? 'Edit Product' : 'New Product'}</h3>
          <button onClick={onClose} className="p-1 hover:bg-cream-200 rounded-lg"><X className="w-5 h-5 text-espresso-400" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-espresso-500 mb-1 block">Name</label>
            <input value={name} onChange={e => setName(e.target.value)} className="input-field text-sm py-2.5" />
          </div>
          <div>
            <label className="text-sm font-medium text-espresso-500 mb-1 block">Category</label>
            <select value={category} onChange={e => setCategory(e.target.value)} className="input-field text-sm py-2.5">
              {CATEGORY_ORDER.map(c => <option key={c} value={c}>{c}</option>)}
              <option value="Uncategorized">Uncategorized</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-espresso-500 mb-1 block">Variant Label</label>
            <input value={variantLabel} onChange={e => setVariantLabel(e.target.value)} className="input-field text-sm py-2.5" placeholder="e.g. Size, Level" />
          </div>
          <div>
            <label className="text-sm font-medium text-espresso-500 mb-1 block">Variants (one per line)</label>
            <textarea value={variantNames} onChange={e => setVariantNames(e.target.value)} rows={4} className="input-field text-sm" placeholder="Small&#10;Medium&#10;Large" />
          </div>
          <div>
            <label className="text-sm font-medium text-espresso-500 mb-1 block">Price (Rp)</label>
            <input type="number" value={price} onChange={e => setPrice(e.target.value)} className="input-field text-sm py-2.5" />
          </div>
          <div>
            <label className="text-sm font-medium text-espresso-500 mb-1 block">Photo URL (Google Drive supported)</label>
            <input value={photo1} onChange={e => setPhoto1(e.target.value)} className="input-field text-sm py-2.5" placeholder="https://drive.google.com/file/d/..." />
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={hidden} onChange={e => setHidden(e.target.checked)} className="w-4 h-4 accent-espresso-600" />
            <span className="text-sm text-espresso-500">Hide from menu</span>
          </label>
        </div>
        <button onClick={handleSave} disabled={saving} className="btn-primary w-full mt-4 flex items-center justify-center gap-2">
          {saving && <Loader2 className="w-5 h-5 animate-spin" />}
          {saving ? 'Saving...' : 'Save Product'}
        </button>
      </div>
    </div>
  );
}

function PromosTab() {
  const { addToast } = useToast();
  const [programs, setPrograms] = useState<MarketingProgram[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const fetch = useCallback(async () => {
    const [progRes, prodRes] = await Promise.all([
      supabase.from('marketing_programs').select('*'),
      supabase.from('products').select('*').order('name'),
    ]);
    setPrograms(progRes.data || []);
    setProducts(prodRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const toggleActive = async (p: MarketingProgram) => {
    await supabase.from('marketing_programs').update({ active: !p.active }).eq('id', p.id);
    fetch();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this promo?')) return;
    await supabase.from('marketing_programs').delete().eq('id', id);
    addToast('Promo deleted', 'success');
    fetch();
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-espresso-300" /></div>;

  return (
    <div className="space-y-4">
      <button onClick={() => setShowForm(true)} className="btn-primary text-sm py-2.5 flex items-center gap-1.5">
        <Plus className="w-4 h-4" /> New Promo
      </button>

      {programs.length === 0 ? (
        <div className="text-center py-8 text-espresso-300"><p>No promos yet.</p></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {programs.map(p => {
            const buyProducts = products.filter(pr => p.buy_product_ids.includes(pr.id));
            const freeProduct = products.find(pr => pr.id === p.free_product_id);
            return (
              <div key={p.id} className="card p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-medium text-espresso-600">Buy X Get Y</p>
                    <span className={`badge ${p.active ? 'bg-sage-100 text-sage-600' : 'bg-cream-200 text-espresso-400'}`}>
                      {p.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={() => toggleActive(p)} className="p-1.5 rounded-lg bg-cream-200 hover:bg-cream-300">
                      <RefreshCw className="w-3.5 h-3.5 text-espresso-500" />
                    </button>
                    <button onClick={() => handleDelete(p.id)} className="p-1.5 rounded-lg bg-rust-50 hover:bg-rust-100">
                      <Trash2 className="w-3.5 h-3.5 text-rust-500" />
                    </button>
                  </div>
                </div>
                <p className="text-sm text-espresso-500">
                  Buy: {buyProducts.map(bp => bp.name).join(', ') || 'None'}
                </p>
                <p className="text-sm text-espresso-500">
                  Get: {p.free_qty}× {freeProduct?.name || 'Unknown'} {p.free_variant ? `(${p.free_variant})` : ''}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {showForm && <PromoForm products={products} onClose={() => setShowForm(false)} onSaved={() => { fetch(); setShowForm(false); }} />}
    </div>
  );
}

function PromoForm({ products, onClose, onSaved }: { products: Product[]; onClose: () => void; onSaved: () => void }) {
  const { addToast } = useToast();
  const [buyIds, setBuyIds] = useState<string[]>([]);
  const [freeId, setFreeId] = useState('');
  const [freeQty, setFreeQty] = useState('1');
  const [freeVariant, setFreeVariant] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (buyIds.length === 0 || !freeId) {
      addToast('Select buy products and a free product', 'error');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('marketing_programs').insert({
      type: 'buy_x_get_y',
      active: true,
      buy_product_ids: buyIds,
      free_product_id: freeId,
      free_qty: parseInt(freeQty) || 1,
      free_variant: freeVariant || null,
    });
    setSaving(false);
    if (error) {
      addToast('Failed to create promo', 'error');
    } else {
      addToast('Promo created', 'success');
      onSaved();
    }
  };

  const freeProduct = products.find(p => p.id === freeId);

  return (
    <div className="fixed inset-0 z-50 bg-espresso-900/50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-cream-100 rounded-2xl p-6 max-w-md w-full max-h-[85vh] overflow-y-auto animate-slide-up" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-bold text-espresso-600">New Buy-X-Get-Y Promo</h3>
          <button onClick={onClose} className="p-1 hover:bg-cream-200 rounded-lg"><X className="w-5 h-5 text-espresso-400" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-espresso-500 mb-1 block">Buy Products (select one or more)</label>
            <div className="max-h-40 overflow-y-auto border border-cream-200 rounded-xl p-2 space-y-1">
              {products.map(p => (
                <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-cream-200 rounded-lg px-2 py-1">
                  <input
                    type="checkbox"
                    checked={buyIds.includes(p.id)}
                    onChange={e => {
                      if (e.target.checked) setBuyIds([...buyIds, p.id]);
                      else setBuyIds(buyIds.filter(id => id !== p.id));
                    }}
                    className="w-4 h-4 accent-espresso-600"
                  />
                  {p.name}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-espresso-500 mb-1 block">Free Product</label>
            <select value={freeId} onChange={e => setFreeId(e.target.value)} className="input-field text-sm py-2.5">
              <option value="">Select...</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-espresso-500 mb-1 block">Free Quantity</label>
            <input type="number" value={freeQty} onChange={e => setFreeQty(e.target.value)} min="1" className="input-field text-sm py-2.5" />
          </div>
          {freeProduct && freeProduct.variant_names.length > 1 && (
            <div>
              <label className="text-sm font-medium text-espresso-500 mb-1 block">Free Variant (optional)</label>
              <select value={freeVariant} onChange={e => setFreeVariant(e.target.value)} className="input-field text-sm py-2.5">
                <option value="">Any variant</option>
                {freeProduct.variant_names.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          )}
        </div>
        <button onClick={handleSave} disabled={saving} className="btn-primary w-full mt-4 flex items-center justify-center gap-2">
          {saving && <Loader2 className="w-5 h-5 animate-spin" />}
          {saving ? 'Creating...' : 'Create Promo'}
        </button>
      </div>
    </div>
  );
}

function VouchersTab() {
  const { addToast } = useToast();
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const fetch = useCallback(async () => {
    const { data } = await supabase.from('vouchers').select('*').order('code', { ascending: true });
    setVouchers(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const toggleActive = async (v: Voucher) => {
    await supabase.from('vouchers').update({ active: !v.active }).eq('id', v.id);
    fetch();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this voucher?')) return;
    await supabase.from('vouchers').delete().eq('id', id);
    addToast('Voucher deleted', 'success');
    fetch();
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-espresso-300" /></div>;

  return (
    <div className="space-y-4">
      <button onClick={() => setShowForm(true)} className="btn-primary text-sm py-2.5 flex items-center gap-1.5">
        <Plus className="w-4 h-4" /> New Voucher
      </button>

      {vouchers.length === 0 ? (
        <div className="text-center py-8 text-espresso-300"><p>No vouchers yet.</p></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {vouchers.map(v => (
            <div key={v.id} className="card p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-mono font-bold text-espresso-600">{v.code}</p>
                  <span className={`badge ${v.active ? 'bg-sage-100 text-sage-600' : 'bg-cream-200 text-espresso-400'}`}>
                    {v.active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="flex gap-1.5">
                  <button onClick={() => toggleActive(v)} className="p-1.5 rounded-lg bg-cream-200 hover:bg-cream-300">
                    <RefreshCw className="w-3.5 h-3.5 text-espresso-500" />
                  </button>
                  <button onClick={() => handleDelete(v.id)} className="p-1.5 rounded-lg bg-rust-50 hover:bg-rust-100">
                    <Trash2 className="w-3.5 h-3.5 text-rust-500" />
                  </button>
                </div>
              </div>
              <p className="text-sm text-espresso-500">
                {v.type === 'percent' ? `${v.value}% off` : `${formatRupiah(Number(v.value))} off`}
              </p>
              <p className="text-xs text-espresso-300 mt-1">
                {v.limit_per_day > 0 ? `${v.limit_per_day} per day` : 'Unlimited'}
              </p>
            </div>
          ))}
        </div>
      )}

      {showForm && <VoucherForm onClose={() => setShowForm(false)} onSaved={() => { fetch(); setShowForm(false); }} />}
    </div>
  );
}

function VoucherForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { addToast } = useToast();
  const [code, setCode] = useState('');
  const [type, setType] = useState<'percent' | 'fixed'>('percent');
  const [value, setValue] = useState('');
  const [limitPerDay, setLimitPerDay] = useState('0');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!code.trim() || !value) {
      addToast('Fill in all fields', 'error');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('vouchers').insert({
      code: code.trim().toUpperCase(),
      type,
      value: parseFloat(value),
      limit_per_day: parseInt(limitPerDay) || 0,
      active: true,
    });
    setSaving(false);
    if (error) {
      addToast(error.message.includes('duplicate') ? 'Voucher code already exists' : 'Failed to create voucher', 'error');
    } else {
      addToast('Voucher created', 'success');
      onSaved();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-espresso-900/50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-cream-100 rounded-2xl p-6 max-w-md w-full animate-slide-up" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-bold text-espresso-600">New Voucher</h3>
          <button onClick={onClose} className="p-1 hover:bg-cream-200 rounded-lg"><X className="w-5 h-5 text-espresso-400" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-espresso-500 mb-1 block">Code</label>
            <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} className="input-field text-sm py-2.5 font-mono" placeholder="SAVE10" />
          </div>
          <div>
            <label className="text-sm font-medium text-espresso-500 mb-1 block">Type</label>
            <select value={type} onChange={e => setType(e.target.value as 'percent' | 'fixed')} className="input-field text-sm py-2.5">
              <option value="percent">Percentage</option>
              <option value="fixed">Fixed Amount</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-espresso-500 mb-1 block">
              {type === 'percent' ? 'Percentage (%)' : 'Amount (Rp)'}
            </label>
            <input type="number" value={value} onChange={e => setValue(e.target.value)} className="input-field text-sm py-2.5" />
          </div>
          <div>
            <label className="text-sm font-medium text-espresso-500 mb-1 block">Daily Limit (0 = unlimited)</label>
            <input type="number" value={limitPerDay} onChange={e => setLimitPerDay(e.target.value)} min="0" className="input-field text-sm py-2.5" />
          </div>
        </div>
        <button onClick={handleSave} disabled={saving} className="btn-primary w-full mt-4 flex items-center justify-center gap-2">
          {saving && <Loader2 className="w-5 h-5 animate-spin" />}
          {saving ? 'Creating...' : 'Create Voucher'}
        </button>
      </div>
    </div>
  );
}

function MembersTab() {
  const { addToast } = useToast();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetch = useCallback(async () => {
    const { data, error } = await supabase.from('members').select('*').order('created_at', { ascending: false });
    if (error) {
      addToast('Failed to load members', 'error');
      return;
    }
    setMembers(data || []);
    setLoading(false);
  }, [addToast]);

  useEffect(() => { fetch(); }, [fetch]);

  const filtered = members.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.phone.includes(search)
  );

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-espresso-300" /></div>;

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-espresso-300" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or phone..."
          className="input-field pl-10 text-sm py-2.5"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-8 text-espresso-300"><p>No members found.</p></div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-cream-200 text-espresso-500">
              <tr>
                <th className="text-left p-3 font-medium">Name</th>
                <th className="text-left p-3 font-medium hidden sm:table-cell">Phone</th>
                <th className="text-left p-3 font-medium">Tier</th>
                <th className="text-right p-3 font-medium">Points</th>
                <th className="text-right p-3 font-medium hidden sm:table-cell">Spending</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(m => (
                <tr key={m.user_id} className="border-t border-cream-200 hover:bg-cream-50">
                  <td className="p-3 text-espresso-600 font-medium">{m.name}</td>
                  <td className="p-3 text-espresso-400 hidden sm:table-cell">{m.phone}</td>
                  <td className="p-3">
                    <span className={`badge ${
                      m.tier === 'Gold' ? 'bg-amber-100 text-amber-600' :
                      m.tier === 'Silver' ? 'bg-cream-200 text-espresso-500' :
                      m.tier === 'Bronze' ? 'bg-amber-50 text-amber-500' :
                      'bg-cream-100 text-espresso-400'
                    }`}>{m.tier}</span>
                  </td>
                  <td className="p-3 text-right text-espresso-600 font-medium">{formatRupiah(m.redeemable_points)}</td>
                  <td className="p-3 text-right text-espresso-400 hidden sm:table-cell">{formatRupiah(m.spending_since_upgrade)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
