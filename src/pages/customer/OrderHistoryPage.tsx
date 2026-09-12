import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useLang } from '@/context/LanguageContext';
import type { Order } from '@/lib/types';
import { formatRupiah } from '@/lib/format';
import { StatusBadge, PaymentStatusBadge } from '@/components/StatusBadge';
import { ArrowLeft, Receipt, Clock, Coffee } from 'lucide-react';

export function OrderHistoryPage() {
  const navigate = useNavigate();
  const { member, loading: authLoading } = useAuth();
  const { addToast } = useToast();
  const { t } = useLang();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!member) {
      navigate('/login?redirect=/orders');
      return;
    }
    (async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('member_id', member.user_id)
        .order('created_at', { ascending: false });

      if (error) {
        addToast('Failed to load your orders', 'error');
        setLoading(false);
        return;
      }
      setOrders((data || []) as unknown as Order[]);
      setLoading(false);
    })();
  }, [member, authLoading, navigate, addToast]);

  const activeOrders = orders.filter(o => o.status === 'pending' || o.status === 'preparing');
  const pastOrders = orders.filter(o => o.status === 'served' || o.status === 'cancelled');

  return (
    <div className="min-h-screen bg-cream-100">
      <header className="sticky top-0 z-40 bg-cream-100/95 backdrop-blur-sm border-b border-cream-200">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate('/')} className="p-2 hover:bg-cream-200 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-espresso-600" />
          </button>
          <h1 className="font-display font-bold text-espresso-600 text-lg">{t('myOrders')}</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Coffee className="w-8 h-8 animate-spin text-espresso-300" />
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16 text-espresso-300">
            <Receipt className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>{t('noOrdersYet')}</p>
          </div>
        ) : (
          <>
            {activeOrders.length > 0 && (
              <section>
                <h2 className="font-display font-semibold text-espresso-600 mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4" /> {t('activeOrders')}
                </h2>
                <div className="space-y-3">
                  {activeOrders.map(order => (
                    <OrderHistoryCard key={order.id} order={order} />
                  ))}
                </div>
              </section>
            )}

            {pastOrders.length > 0 && (
              <section>
                <h2 className="font-display font-semibold text-espresso-600 mb-3">{t('pastOrders')}</h2>
                <div className="space-y-3">
                  {pastOrders.map(order => (
                    <OrderHistoryCard key={order.id} order={order} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function OrderHistoryCard({ order }: { order: Order }) {
  const { t } = useLang();
  const time = new Date(order.created_at).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="font-display font-bold text-espresso-600">{order.table_name}</p>
          <p className="text-xs text-espresso-300 mt-0.5">{time}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <StatusBadge status={order.status} />
          <PaymentStatusBadge status={order.payment_status} />
        </div>
      </div>

      <div className="space-y-1 py-2 border-y border-cream-200">
        {(order.items as unknown as Array<{ quantity: number; name: string; variant: string; is_promo: boolean }>).map((item, i) => (
          <div key={i} className="flex justify-between text-sm">
            <span className="text-espresso-500">
              {item.quantity}× {item.name}
              {item.variant && <span className="text-espresso-300"> ({item.variant})</span>}
              {item.is_promo && <span className="text-sage-500 ml-1">[{t('free')}]</span>}
            </span>
          </div>
        ))}
      </div>

      <div className="flex justify-between items-center mt-2">
        <span className="text-sm text-espresso-400">
          {order.payment_method === 'qris' ? t('qris') : t('cash')}
        </span>
        <span className="font-bold text-espresso-600">{formatRupiah(order.grand_total)}</span>
      </div>
    </div>
  );
}
