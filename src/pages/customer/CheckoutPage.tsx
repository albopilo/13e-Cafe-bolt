import { useState, useEffect } from 'react';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { supabase } from '@/lib/supabase';
import { formatRupiah, roundToNearest100 } from '@/lib/format';
import { isQrisOnly, getDeliveryFee } from '@/lib/categories';
import { getTableName } from '@/lib/cart';
import { TIER_CONFIGS } from '@/lib/loyalty';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CreditCard, Banknote, Tag, Loader2 } from 'lucide-react';

export function CheckoutPage() {
  const { items, clear } = useCart();
  const { member, session } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'qris'>('cash');
  const [voucherCode, setVoucherCode] = useState('');
  const [voucherDiscount, setVoucherDiscount] = useState(0);
  const [phone, setPhone] = useState(member?.phone || '');
  const [submitting, setSubmitting] = useState(false);
  const [voucherApplied, setVoucherApplied] = useState(false);

  const tableName = getTableName();
  const qrisOnly = isQrisOnly(tableName);

  useEffect(() => {
    if (qrisOnly) setPaymentMethod('qris');
  }, [qrisOnly]);

  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const memberDiscount = member ? Math.round(subtotal * (TIER_CONFIGS[member.tier]?.discountRate || 0)) : 0;
  const afterDiscount = subtotal - memberDiscount;
  const afterVoucher = afterDiscount - voucherDiscount;
  const tax = Math.round(afterVoucher * 0.10);
  const deliveryFee = getDeliveryFee(tableName);
  const total = afterVoucher + tax + deliveryFee;
  const grandTotal = roundToNearest100(total);

  const handleApplyVoucher = async () => {
    if (!voucherCode.trim()) return;
    const { data: voucher } = await supabase
      .from('vouchers')
      .select('id, type, value, limit_per_day, active')
      .eq('code', voucherCode.trim())
      .eq('active', true)
      .maybeSingle();

    if (!voucher) {
      addToast('Invalid or inactive voucher', 'error');
      return;
    }

    let discount = 0;
    if (voucher.type === 'percent') {
      discount = Math.round((afterDiscount * voucher.value) / 100);
    } else {
      discount = Math.min(voucher.value, afterDiscount);
    }
    setVoucherDiscount(discount);
    setVoucherApplied(true);
    addToast(`Voucher applied: -${formatRupiah(discount)}`, 'success');
  };

  const handleSubmitOrder = async () => {
    if (items.length === 0) {
      addToast('Cart is empty', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          items: items.map(i => ({
            product_id: i.product_id,
            variant: i.variant,
            quantity: i.quantity,
            is_promo: i.is_promo,
            promo_link_id: i.promo_link_id,
          })),
          member_id: member?.user_id || null,
          table_name: tableName,
          payment_method: paymentMethod,
          phone: phone || null,
          voucher_code: voucherApplied ? voucherCode.trim() : null,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to create order');
      }

      const data = await response.json();
      addToast('Order placed successfully!', 'success');
      clear();

      if (paymentMethod === 'qris') {
        navigate(`/qris-payment?order_id=${data.order_id}`);
      } else {
        navigate('/login');
      }
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to create order', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (items.length === 0 && !submitting) {
    return (
      <div className="min-h-screen bg-cream-100 flex items-center justify-center p-4">
        <div className="card p-8 text-center max-w-sm">
          <p className="text-espresso-400 mb-4">Your cart is empty.</p>
          <button onClick={() => navigate('/')} className="btn-primary">
            Back to Menu
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream-100">
      <header className="sticky top-0 z-40 bg-cream-100/95 backdrop-blur-sm border-b border-cream-200">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate('/')} className="p-2 hover:bg-cream-200 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-espresso-600" />
          </button>
          <h1 className="font-display font-bold text-espresso-600 text-lg">Checkout</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {/* Order summary */}
        <div className="card p-4">
          <h2 className="font-display font-semibold text-espresso-600 mb-3">Order Summary</h2>
          <div className="space-y-2">
            {items.map((item, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-espresso-500">
                  {item.quantity}× {item.name} <span className="text-espresso-300">({item.variant})</span>
                  {item.is_promo && <span className="text-sage-500 ml-1">[FREE]</span>}
                </span>
                <span className={item.is_promo ? 'text-sage-500' : 'text-espresso-600'}>
                  {item.is_promo ? 'Rp0' : formatRupiah(item.price * item.quantity)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Totals */}
        <div className="card p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-espresso-400">Subtotal</span>
            <span className="text-espresso-600">{formatRupiah(subtotal)}</span>
          </div>
          {memberDiscount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-sage-500">Member Discount ({member?.tier})</span>
              <span className="text-sage-500">-{formatRupiah(memberDiscount)}</span>
            </div>
          )}
          {voucherDiscount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-sage-500">Voucher</span>
              <span className="text-sage-500">-{formatRupiah(voucherDiscount)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-espresso-400">Tax (10%)</span>
            <span className="text-espresso-600">{formatRupiah(tax)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-espresso-400">Delivery Fee</span>
            <span className="text-espresso-600">{formatRupiah(deliveryFee)}</span>
          </div>
          <div className="border-t border-cream-200 pt-2 flex justify-between">
            <span className="font-semibold text-espresso-600">Grand Total</span>
            <span className="font-bold text-espresso-600 text-lg">{formatRupiah(grandTotal)}</span>
          </div>
          <p className="text-xs text-espresso-300">Final totals are computed server-side on order submission.</p>
        </div>

        {/* Voucher */}
        <div className="card p-4">
          <h3 className="font-display font-semibold text-espresso-600 mb-2 flex items-center gap-2">
            <Tag className="w-4 h-4" /> Voucher Code
          </h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={voucherCode}
              onChange={e => setVoucherCode(e.target.value)}
              placeholder="Enter voucher code"
              className="input-field text-sm py-2.5"
              disabled={voucherApplied}
            />
            {voucherApplied ? (
              <button
                onClick={() => { setVoucherApplied(false); setVoucherCode(''); setVoucherDiscount(0); }}
                className="btn-secondary text-sm py-2.5 px-4"
              >
                Remove
              </button>
            ) : (
              <button onClick={handleApplyVoucher} className="btn-secondary text-sm py-2.5 px-4">
                Apply
              </button>
            )}
          </div>
        </div>

        {/* Phone (for guests) */}
        {!member && (
          <div className="card p-4">
            <h3 className="font-display font-semibold text-espresso-600 mb-2">Phone Number</h3>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="08xx..."
              className="input-field text-sm py-2.5"
            />
            <p className="text-xs text-espresso-300 mt-1">So staff can contact you about your order.</p>
          </div>
        )}

        {/* Payment method */}
        <div className="card p-4">
          <h3 className="font-display font-semibold text-espresso-600 mb-3">Payment Method</h3>
          <div className="grid grid-cols-2 gap-3">
            {!qrisOnly && (
              <button
                onClick={() => setPaymentMethod('cash')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  paymentMethod === 'cash'
                    ? 'border-espresso-600 bg-espresso-50'
                    : 'border-cream-200 bg-white hover:border-cream-300'
                }`}
              >
                <Banknote className={`w-6 h-6 mx-auto mb-1 ${paymentMethod === 'cash' ? 'text-espresso-600' : 'text-espresso-300'}`} />
                <span className={`text-sm font-medium ${paymentMethod === 'cash' ? 'text-espresso-600' : 'text-espresso-300'}`}>Cash</span>
              </button>
            )}
            <button
              onClick={() => setPaymentMethod('qris')}
              className={`p-4 rounded-xl border-2 transition-all ${
                paymentMethod === 'qris'
                  ? 'border-espresso-600 bg-espresso-50'
                  : 'border-cream-200 bg-white hover:border-cream-300'
              } ${qrisOnly ? 'col-span-2' : ''}`}
            >
              <CreditCard className={`w-6 h-6 mx-auto mb-1 ${paymentMethod === 'qris' ? 'text-espresso-600' : 'text-espresso-300'}`} />
              <span className={`text-sm font-medium ${paymentMethod === 'qris' ? 'text-espresso-600' : 'text-espresso-300'}`}>QRIS</span>
            </button>
          </div>
          {qrisOnly && (
            <p className="text-xs text-amber-500 mt-2">This table only accepts QRIS payment.</p>
          )}
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmitOrder}
          disabled={submitting}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
          {submitting ? 'Placing Order...' : `Place Order — ${formatRupiah(grandTotal)}`}
        </button>
      </main>
    </div>
  );
}
