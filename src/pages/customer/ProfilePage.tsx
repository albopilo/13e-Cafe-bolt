import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import type { LoyaltyTransaction, RoomUpgrade } from '@/lib/types';
import { formatRupiah } from '@/lib/format';
import { getTierPerks } from '@/lib/loyalty';
import { ArrowLeft, Coffee, Crown, Wallet, TrendingUp, Gift, Receipt, Home, ChevronLeft, ChevronRight } from 'lucide-react';

const TX_PER_PAGE = 5;

export function ProfilePage() {
  const { member, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<LoyaltyTransaction[]>([]);
  const [txCount, setTxCount] = useState(0);
  const [txPage, setTxPage] = useState(0);
  const [roomUpgrades, setRoomUpgrades] = useState<RoomUpgrade[]>([]);
  const [stats, setStats] = useState<{ monthly: number; yearly: number; allTime: number; cashbackTotal: number } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async (page: number) => {
    if (!member) return;

    const [txsRes, countRes, upgradesRes, allTxRes] = await Promise.all([
      supabase
        .from('loyalty_transactions')
        .select('*')
        .eq('member_id', member.user_id)
        .order('created_at', { ascending: false })
        .range(page * TX_PER_PAGE, (page + 1) * TX_PER_PAGE - 1),
      supabase
        .from('loyalty_transactions')
        .select('*', { count: 'exact', head: true })
        .eq('member_id', member.user_id),
      supabase
        .from('room_upgrades')
        .select('*')
        .eq('member_id', member.user_id)
        .order('claimed_at', { ascending: false }),
      supabase
        .from('loyalty_transactions')
        .select('amount, cashback, created_at')
        .eq('member_id', member.user_id)
        .order('created_at', { ascending: false }),
    ]);

    setTransactions((txsRes.data || []) as LoyaltyTransaction[]);
    setTxCount(countRes.count || 0);
    setRoomUpgrades((upgradesRes.data || []) as RoomUpgrade[]);

    const allTxs = (allTxRes.data || []) as Array<{ amount: number; cashback: number; created_at: string }>;
    const now = new Date();
    const thisYear = now.getFullYear();
    const thisMonth = now.getMonth();
    let monthly = 0, yearly = 0, allTime = 0, cashbackTotal = 0;
    allTxs.forEach(tx => {
      const d = new Date(tx.created_at);
      if (tx.amount > 0) {
        allTime += tx.amount;
        if (d.getFullYear() === thisYear) {
          yearly += tx.amount;
          if (d.getMonth() === thisMonth) monthly += tx.amount;
        }
      }
      cashbackTotal += tx.cashback;
    });
    setStats({ monthly, yearly, allTime, cashbackTotal });
    setLoading(false);
  }, [member]);

  useEffect(() => {
    if (authLoading) return;
    if (!member) {
      navigate('/login?redirect=/profile');
      return;
    }
    fetch(0);
  }, [member, authLoading, navigate, fetch]);

  useEffect(() => { if (member && txPage >= 0) fetch(txPage); }, [txPage, fetch, member]);

  if (authLoading || (!member && loading)) {
    return (
      <div className="min-h-screen bg-cream-100 flex items-center justify-center">
        <Coffee className="w-8 h-8 animate-spin text-espresso-300" />
      </div>
    );
  }

  if (!member) return null;

  const perks = getTierPerks(member.tier);
  const tierColors: Record<string, string> = {
    Gold: 'bg-amber-100 text-amber-600',
    Silver: 'bg-cream-200 text-espresso-500',
    Bronze: 'bg-amber-50 text-amber-500',
    Classic: 'bg-cream-100 text-espresso-400',
  };
  const totalPages = Math.ceil(txCount / TX_PER_PAGE);

  return (
    <div className="min-h-screen bg-cream-100">
      <header className="sticky top-0 z-40 bg-cream-100/95 backdrop-blur-sm border-b border-cream-200">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate('/')} className="p-2 hover:bg-cream-200 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-espresso-600" />
          </button>
          <h1 className="font-display font-bold text-espresso-600 text-lg">My Profile</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {/* Member card */}
        <div className="card p-5">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-full bg-espresso-600 text-cream-100 flex items-center justify-center font-bold text-lg">
              {member.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="font-display font-bold text-xl text-espresso-600">{member.name}</h2>
              <span className={`badge ${tierColors[member.tier]} mt-1`}>{member.tier} Member</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><span className="text-espresso-400">Phone:</span> <span className="text-espresso-600 font-medium">{member.phone || '-'}</span></div>
            <div><span className="text-espresso-400">Email:</span> <span className="text-espresso-600 font-medium truncate">{member.email || '-'}</span></div>
            <div><span className="text-espresso-400">Birthdate:</span> <span className="text-espresso-600 font-medium">{member.birthdate ? new Date(member.birthdate).toLocaleDateString('en-GB') : '-'}</span></div>
            <div><span className="text-espresso-400">Points:</span> <span className="text-espresso-600 font-medium">{formatRupiah(member.redeemable_points)}</span></div>
          </div>
        </div>

        {/* Spending summary */}
        {stats && (
          <div className="card p-4">
            <h3 className="font-display font-semibold text-espresso-600 mb-3">Spending Summary</h3>
            <div className="grid grid-cols-2 gap-3">
              <StatBox icon={Wallet} label="This Month" value={formatRupiah(stats.monthly)} />
              <StatBox icon={TrendingUp} label="This Year" value={formatRupiah(stats.yearly)} />
              <StatBox icon={Crown} label="All Time" value={formatRupiah(stats.allTime)} />
              <StatBox icon={Gift} label="Cashback Earned" value={formatRupiah(stats.cashbackTotal)} />
            </div>
          </div>
        )}

        {/* Perks */}
        <div className="card p-4">
          <h3 className="font-display font-semibold text-espresso-600 mb-3 flex items-center gap-2">
            <Crown className="w-4 h-4 text-amber-400" /> {member.tier} Tier Perks
          </h3>
          <div className="grid grid-cols-2 gap-2 text-sm text-espresso-500">
            <div className="flex items-center gap-1.5"><Coffee className="w-4 h-4 text-espresso-300" /> {perks.cafeDiscount}% off café</div>
            {perks.hondaDiscount > 0 && <div className="flex items-center gap-1.5"><TrendingUp className="w-4 h-4 text-espresso-300" /> {perks.hondaDiscount}% off Honda</div>}
            {perks.millenniumDiscount > 0 && <div className="flex items-center gap-1.5"><Home className="w-4 h-4 text-espresso-300" /> {perks.millenniumDiscount}% off Millennium</div>}
            {perks.cashbackRate > 0 && <div className="flex items-center gap-1.5"><Gift className="w-4 h-4 text-espresso-300" /> {perks.cashbackRate}% cashback</div>}
          </div>
          {perks.birthdayPerks.length > 0 && (
            <div className="mt-3 pt-3 border-t border-cream-200">
              <p className="text-sm font-medium text-espresso-400 mb-1.5">Birthday Perks:</p>
              <ul className="text-sm text-espresso-500 space-y-1">
                {perks.birthdayPerks.map((p, i) => <li key={i} className="flex items-start gap-1.5"><Gift className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" /> {p}</li>)}
              </ul>
            </div>
          )}
        </div>

        {/* Room upgrade history */}
        {member.tier === 'Gold' && roomUpgrades.length > 0 && (
          <div className="card p-4">
            <h3 className="font-display font-semibold text-espresso-600 mb-2 flex items-center gap-2">
              <Home className="w-4 h-4 text-amber-400" /> Room Upgrade History
            </h3>
            <div className="space-y-1.5">
              {roomUpgrades.map(ru => (
                <div key={ru.id} className="flex justify-between items-center py-2 px-3 rounded-lg bg-cream-50 border border-cream-200 text-sm">
                  <span className="text-espresso-500">{new Date(ru.claimed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  <span className="text-espresso-400 text-xs">{ru.location || 'Millennium'}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Transaction history */}
        <div className="card p-4">
          <h3 className="font-display font-semibold text-espresso-600 mb-3 flex items-center gap-2">
            <Receipt className="w-4 h-4 text-sage-400" /> Transaction History ({txCount})
          </h3>
          {transactions.length === 0 ? (
            <p className="text-sm text-espresso-300 text-center py-4">No transactions yet.</p>
          ) : (
            <>
              <div className="space-y-1.5">
                {transactions.map(tx => (
                  <div key={tx.id} className="flex justify-between items-center py-2 px-3 rounded-lg bg-cream-50 border border-cream-200 text-sm">
                    <div className="flex-1 min-w-0">
                      <p className="text-espresso-600 font-medium">{formatRupiah(tx.amount)}</p>
                      <p className="text-xs text-espresso-300">
                        {new Date(tx.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {' · '}{tx.source.replace(/_/g, ' ')}
                        {tx.note && <span className="text-espresso-400"> · {tx.note}</span>}
                      </p>
                    </div>
                    {tx.cashback !== 0 && <span className="text-sage-500 text-xs font-medium">{tx.cashback > 0 ? '+' : ''}{formatRupiah(tx.cashback)}</span>}
                  </div>
                ))}
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-3">
                  <button onClick={() => setTxPage(Math.max(0, txPage - 1))} disabled={txPage === 0} className="p-1.5 rounded-lg bg-cream-200 hover:bg-cream-300 disabled:opacity-30 transition-colors">
                    <ChevronLeft className="w-4 h-4 text-espresso-500" />
                  </button>
                  <span className="text-sm text-espresso-400">Page {txPage + 1} of {totalPages}</span>
                  <button onClick={() => setTxPage(Math.min(totalPages - 1, txPage + 1))} disabled={txPage >= totalPages - 1} className="p-1.5 rounded-lg bg-cream-200 hover:bg-cream-300 disabled:opacity-30 transition-colors">
                    <ChevronRight className="w-4 h-4 text-espresso-500" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function StatBox({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="bg-cream-50 rounded-xl p-3 border border-cream-200">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="w-3.5 h-3.5 text-espresso-300" />
        <span className="text-xs text-espresso-400">{label}</span>
      </div>
      <p className="text-sm font-bold text-espresso-600">{value}</p>
    </div>
  );
}
