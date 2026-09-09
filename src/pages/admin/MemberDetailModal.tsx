import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/context/ToastContext';
import type { Member, LoyaltyTransaction } from '@/lib/types';
import { formatRupiah } from '@/lib/format';
import { X, Phone, Mail, Calendar, Crown, Wallet, TrendingUp, Gift } from 'lucide-react';

interface Stats {
  monthly: number;
  yearly: number;
  lastYear: number;
  allTime: number;
  cashbackTotal: number;
}

export function MemberDetailModal({ member, onClose }: { member: Member; onClose: () => void }) {
  const { addToast } = useToast();
  const [stats, setStats] = useState<Stats | null>(null);
  const [transactions, setTransactions] = useState<LoyaltyTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  const fetch = useCallback(async () => {
    const { data: txs, error } = await supabase
      .from('loyalty_transactions')
      .select('*')
      .eq('member_id', member.user_id)
      .order('created_at', { ascending: false });

    if (error) {
      addToast('Failed to load member details', 'error');
      setLoading(false);
      return;
    }

    const allTxs = (txs || []) as LoyaltyTransaction[];
    const now = new Date();
    const thisYear = now.getFullYear();
    const lastYear = thisYear - 1;
    const thisMonth = now.getMonth();

    let monthly = 0, yearly = 0, lastYearTotal = 0, allTime = 0, cashbackTotal = 0;
    allTxs.forEach(tx => {
      const d = new Date(tx.created_at);
      if (tx.amount > 0) {
        allTime += tx.amount;
        if (d.getFullYear() === thisYear) {
          yearly += tx.amount;
          if (d.getMonth() === thisMonth) monthly += tx.amount;
        }
        if (d.getFullYear() === lastYear) lastYearTotal += tx.amount;
      }
      cashbackTotal += tx.cashback;
    });

    setStats({ monthly, yearly, lastYear: lastYearTotal, allTime, cashbackTotal });
    setTransactions(allTxs.slice(0, 10));
    setLoading(false);
  }, [member.user_id, addToast]);

  useEffect(() => { fetch(); }, [fetch]);

  const tierColors: Record<string, string> = {
    Gold: 'bg-amber-100 text-amber-600',
    Silver: 'bg-cream-200 text-espresso-500',
    Bronze: 'bg-amber-50 text-amber-500',
    Classic: 'bg-cream-100 text-espresso-400',
  };

  return (
    <div className="fixed inset-0 z-50 bg-espresso-900/50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-cream-100 rounded-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto animate-slide-up" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-cream-100 z-10 flex items-center justify-between p-4 border-b border-cream-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-espresso-600 text-cream-100 flex items-center justify-center font-bold text-sm">
              {member.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="font-display font-bold text-espresso-600">{member.name}</h3>
              <span className={`badge ${tierColors[member.tier]}`}>{member.tier}</span>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-cream-200 rounded-lg">
            <X className="w-5 h-5 text-espresso-400" />
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-espresso-300">Loading...</div>
        ) : (
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <InfoRow icon={Phone} label="Phone" value={member.phone || '-'} />
              <InfoRow icon={Mail} label="Email" value={member.email || '-'} />
              <InfoRow icon={Calendar} label="Birthdate" value={member.birthdate ? new Date(member.birthdate).toLocaleDateString('en-GB') : '-'} />
              <InfoRow icon={Gift} label="Redeemable" value={formatRupiah(member.redeemable_points)} />
            </div>

            {stats && (
              <div className="grid grid-cols-2 gap-3">
                <StatBox icon={Wallet} label="This Month" value={formatRupiah(stats.monthly)} />
                <StatBox icon={TrendingUp} label="This Year" value={formatRupiah(stats.yearly)} />
                <StatBox icon={Wallet} label="Last Year" value={formatRupiah(stats.lastYear)} />
                <StatBox icon={Crown} label="All Time" value={formatRupiah(stats.allTime)} />
                <StatBox icon={Gift} label="Cashback Total" value={formatRupiah(stats.cashbackTotal)} />
                <StatBox icon={TrendingUp} label="Since Upgrade" value={formatRupiah(member.spending_since_upgrade)} />
              </div>
            )}

            <div>
              <h4 className="font-display font-semibold text-espresso-600 mb-2 text-sm">Recent Transactions</h4>
              {transactions.length === 0 ? (
                <p className="text-sm text-espresso-300 text-center py-4">No transactions yet.</p>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {transactions.map(tx => (
                    <div key={tx.id} className="flex justify-between items-center py-2 px-3 rounded-lg bg-white border border-cream-200 text-sm">
                      <div>
                        <p className="text-espresso-600 font-medium">{formatRupiah(tx.amount)}</p>
                        <p className="text-xs text-espresso-300">
                          {new Date(tx.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          {' · '}{tx.source.replace(/_/g, ' ')}
                        </p>
                      </div>
                      <span className="text-sage-500 text-xs font-medium">+{formatRupiah(tx.cashback)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="w-3.5 h-3.5 text-espresso-300 flex-shrink-0" />
      <span className="text-espresso-400 text-xs">{label}:</span>
      <span className="text-espresso-600 font-medium text-xs truncate">{value}</span>
    </div>
  );
}

function StatBox({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl p-3 border border-cream-200">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="w-3.5 h-3.5 text-espresso-300" />
        <span className="text-xs text-espresso-400">{label}</span>
      </div>
      <p className="text-sm font-bold text-espresso-600">{value}</p>
    </div>
  );
}
