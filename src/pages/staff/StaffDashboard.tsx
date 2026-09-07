import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import type { Order } from '@/lib/types';
import { formatRupiah, formatTimeElapsed } from '@/lib/format';
import { StatusBadge, PaymentStatusBadge } from '@/components/StatusBadge';
import { useSearchParams } from 'react-router-dom';
import { Calendar, Volume2, VolumeX, Phone, MessageCircle, Clock, Loader2, Coffee } from 'lucide-react';

const LOCATIONS = ['All', 'Mille 1', 'Mille 2', 'Mille 3', 'Main Kitchen'];
const FILTER_TABS = ['All', 'Incoming', 'Served', 'Cancelled'] as const;

export function StaffDashboard() {
  const { session, signOut } = useAuth();
  const { addToast } = useToast();
  const [params] = useSearchParams();

  const [orders, setOrders] = useState<Map<string, Order>>(new Map());
  const [location, setLocation] = useState('All');
  const [filterTab, setFilterTab] = useState<typeof FILTER_TABS[number]>('All');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [dismissedOrders, setDismissedOrders] = useState<Set<string>>(new Set());
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const chimeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const focusOrderId = params.get('orderId');
  const prevOrderIds = useRef<Set<string>>(new Set());

  // Audio chime
  useEffect(() => {
    audioRef.current = new Audio('data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=');
    audioRef.current.volume = 0.5;
  }, []);

  const playChime = useCallback(() => {
    if (audioRef.current && audioEnabled) {
      audioRef.current.play().catch(() => {});
    }
  }, [audioEnabled]);

  // Fetch orders
  const fetchOrders = useCallback(async () => {
    const query = supabase
      .from('orders')
      .select('*')
      .eq('date', selectedDate)
      .order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) {
      addToast('Failed to load orders', 'error');
      return;
    }
    const newMap = new Map<string, Order>();
    (data || []).forEach(o => newMap.set(o.id, o as unknown as Order));

    // Detect new orders for chime
    const newIds = new Set(newMap.keys());
    const hasNew = Array.from(newIds).some(id => !prevOrderIds.current.has(id));
    if (hasNew && prevOrderIds.current.size > 0) {
      playChime();
    }
    prevOrderIds.current = newIds;

    setOrders(newMap);
    setLoading(false);
  }, [selectedDate, addToast, playChime]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('orders-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        setOrders(prev => {
          const newMap = new Map(prev);
          if (payload.eventType === 'DELETE') {
            newMap.delete((payload.old as Order).id);
          } else {
            const newOrder = payload.new as unknown as Order;
            if (newOrder.date === selectedDate) {
              // Check if this is a new order
              if (!prev.has(newOrder.id) && prev.size > 0) {
                playChime();
              }
              newMap.set(newOrder.id, newOrder);
            } else {
              newMap.delete(newOrder.id);
            }
          }
          return newMap;
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedDate, playChime]);

  // Repeating chime for pending orders
  useEffect(() => {
    if (chimeIntervalRef.current) {
      clearInterval(chimeIntervalRef.current);
      chimeIntervalRef.current = null;
    }

    if (!audioEnabled) return;

    const hasPendingOrders = Array.from(orders.values()).some(o =>
      o.status === 'pending' && !dismissedOrders.has(o.id)
    );

    if (hasPendingOrders) {
      chimeIntervalRef.current = setInterval(() => {
        playChime();
      }, 5000);
    }

    return () => {
      if (chimeIntervalRef.current) {
        clearInterval(chimeIntervalRef.current);
      }
    };
  }, [orders, audioEnabled, dismissedOrders, playChime]);

  // Stop chime for focused order
  useEffect(() => {
    if (focusOrderId) {
      setDismissedOrders(prev => new Set(prev).add(focusOrderId));
    }
  }, [focusOrderId]);

  const updateStatus = async (orderId: string, newStatus: string) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mark-order-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          order_id: orderId,
          new_status: newStatus,
          changed_by: session?.user?.id || null,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to update status');
      }

      addToast(`Order marked as ${newStatus}`, 'success');
      if (newStatus === 'served' || newStatus === 'cancelled') {
        setDismissedOrders(prev => new Set(prev).add(orderId));
      }
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to update status', 'error');
    }
  };

  // Filter orders
  const filteredOrders = Array.from(orders.values()).filter(o => {
    if (location !== 'All' && !o.table_name.startsWith(location)) return false;
    if (filterTab === 'Incoming') return o.status === 'pending' || o.status === 'preparing';
    if (filterTab === 'Served') return o.status === 'served';
    if (filterTab === 'Cancelled') return o.status === 'cancelled';
    return true;
  });

  return (
    <div className="min-h-screen bg-cream-50">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-espresso-600 text-cream-100 border-b border-espresso-700">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Coffee className="w-6 h-6" />
            <h1 className="font-display font-bold text-lg">Staff Dashboard</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAudioEnabled(!audioEnabled)}
              className="p-2 rounded-lg hover:bg-espresso-700 transition-colors"
              title={audioEnabled ? 'Mute alerts' : 'Enable alerts'}
            >
              {audioEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </button>
            <button onClick={signOut} className="text-sm px-3 py-1.5 rounded-lg bg-espresso-700 hover:bg-espresso-800 transition-colors">
              Logout
            </button>
          </div>
        </div>

        {/* Controls */}
        <div className="max-w-7xl mx-auto px-4 pb-3 flex flex-wrap items-center gap-3">
          {/* Location filter */}
          <div className="flex gap-1.5 flex-wrap">
            {LOCATIONS.map(loc => (
              <button
                key={loc}
                onClick={() => setLocation(loc)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  location === loc
                    ? 'bg-cream-100 text-espresso-600'
                    : 'bg-espresso-700 text-cream-200 hover:bg-espresso-800'
                }`}
              >
                {loc}
              </button>
            ))}
          </div>

          {/* Date picker */}
          <div className="flex items-center gap-1.5 bg-espresso-700 rounded-lg px-3 py-1.5">
            <Calendar className="w-4 h-4 text-cream-200" />
            <input
              type="date"
              value={selectedDate}
              onChange={e => { setSelectedDate(e.target.value); setLoading(true); }}
              className="bg-transparent text-cream-100 text-sm border-none focus:outline-none [color-scheme:dark]"
            />
          </div>

          {/* Filter tabs */}
          <div className="flex gap-1.5">
            {FILTER_TABS.map(tab => (
              <button
                key={tab}
                onClick={() => setFilterTab(tab)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  filterTab === tab
                    ? 'bg-amber-400 text-espresso-700'
                    : 'bg-espresso-700 text-cream-200 hover:bg-espresso-800'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Orders grid */}
      <main className="max-w-7xl mx-auto px-4 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-espresso-300" />
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-16 text-espresso-300">
            <Coffee className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No orders for this filter.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filteredOrders.map(order => (
              <OrderCard
                key={order.id}
                order={order}
                onStatusChange={updateStatus}
                isNew={!dismissedOrders.has(order.id) && order.status === 'pending'}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function OrderCard({ order, onStatusChange, isNew }: { order: Order; onStatusChange: (id: string, status: string) => void; isNew: boolean }) {
  const [elapsed, setElapsed] = useState(formatTimeElapsed(order.created_at));

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(formatTimeElapsed(order.created_at));
    }, 1000);
    return () => clearInterval(interval);
  }, [order.created_at]);

  const waLink = order.phone ? `https://wa.me/62${order.phone.replace(/^0/, '')}` : null;
  const telLink = order.phone ? `tel:${order.phone}` : null;

  return (
    <div className={`card p-4 ${isNew ? 'animate-pulse-highlight ring-2 ring-amber-300' : ''}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="font-display font-bold text-espresso-600">{order.table_name}</p>
          <p className="text-xs text-espresso-300 flex items-center gap-1 mt-0.5">
            <Clock className="w-3 h-3" /> {elapsed} ago
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <StatusBadge status={order.status} />
          <PaymentStatusBadge status={order.payment_status} />
        </div>
      </div>

      {/* Items */}
      <div className="space-y-1 mb-3 py-2 border-y border-cream-200">
        {(order.items as unknown as Array<{ quantity: number; name: string; variant: string; is_promo: boolean }>).map((item, i) => (
          <div key={i} className="flex justify-between text-sm">
            <span className="text-espresso-500">
              {item.quantity}× {item.name}
              {item.variant && <span className="text-espresso-300"> ({item.variant})</span>}
              {item.is_promo && <span className="text-sage-500 ml-1">[FREE]</span>}
            </span>
          </div>
        ))}
      </div>

      {/* Total + payment */}
      <div className="flex justify-between items-center mb-3">
        <span className="text-sm text-espresso-400">
          {order.payment_method === 'qris' ? 'QRIS' : 'Cash'}
        </span>
        <span className="font-bold text-espresso-600">{formatRupiah(order.grand_total)}</span>
      </div>

      {/* Contact */}
      {order.phone && (
        <div className="flex gap-2 mb-3">
          {telLink && (
            <a href={telLink} className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg bg-cream-200 text-espresso-500 text-sm hover:bg-cream-300 transition-colors">
              <Phone className="w-3.5 h-3.5" /> Call
            </a>
          )}
          {waLink && (
            <a href={waLink} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg bg-sage-100 text-sage-600 text-sm hover:bg-sage-200 transition-colors">
              <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
            </a>
          )}
        </div>
      )}

      {/* Proof link */}
      {order.proof_url && (
        <a href={order.proof_url} target="_blank" rel="noopener noreferrer" className="block text-center text-sm text-sage-500 hover:underline mb-3">
          View payment proof
        </a>
      )}

      {/* Status actions */}
      {order.status === 'pending' && (
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onStatusChange(order.id, 'preparing')}
            className="btn-secondary text-sm py-2"
          >
            Start Preparing
          </button>
          <button
            onClick={() => onStatusChange(order.id, 'cancelled')}
            className="btn-danger text-sm py-2"
          >
            Cancel
          </button>
        </div>
      )}
      {order.status === 'preparing' && (
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onStatusChange(order.id, 'served')}
            className="btn-sage text-sm py-2"
          >
            Mark Served
          </button>
          <button
            onClick={() => onStatusChange(order.id, 'cancelled')}
            className="btn-danger text-sm py-2"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
