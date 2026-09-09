import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Member, LoyaltyTransaction } from '@/lib/types';
import { formatRupiah } from '@/lib/format';
import { Users, TrendingUp, Crown, Activity, Loader2 } from 'lucide-react';

interface DashboardData {
  totalMembers: number;
  tierCounts: Record<string, number>;
  topMembers: Member[];
  recentTransactions: (LoyaltyTransaction & { member_name?: string })[];
  todayOrderCount: number;
  todayRevenue: number;
}

export function DashboardTab() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    const [membersRes, txRes, ordersRes] = await Promise.all([
      supabase.from('members').select('*').order('spending_since_upgrade', { ascending: false }),
      supabase.from('loyalty_transactions')
        .select('*, members!inner(name)')
        .order('created_at', { ascending: false })
        .limit(10),
      supabase.from('orders')
        .eq('date', new Date().toISOString().split('T')[0])
        .neq('status', 'cancelled'),
    ]);

    const members = (membersRes.data || []) as Member[];
    const transactions = (txRes.data || []) as unknown as Array<LoyaltyTransaction & { members: { name: string } }>;
    const todayOrders = (ordersRes.data || []) as Array<{ grand_total: number; status: string }>;

    const tierCounts: Record<string, number> = {};
    members.forEach(m => {
      tierCounts[m.tier] = (tierCounts[m.tier] || 0) + 1;
    });

    const todayRevenue = todayOrders.reduce((sum, o) => sum + o.grand_total, 0);

    setData({
      totalMembers: members.length,
      tierCounts,
      topMembers: members.slice(0, 5),
      recentTransactions: transactions.map(t => ({
        ...t,
        member_name: t.members?.name ?? 'Unknown',
      })),
      todayOrderCount: todayOrders.length,
      todayRevenue,
    });
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  if (loading || !data) {
    return <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-espresso-300" /></div>;
  }

  const tierColors: Record<string, string> = {
    Gold: 'bg-amber-100 text-amber-600',
    Silver: 'bg-cream-200 text-espresso-500',
    Bronze: 'bg-amber-50 text-amber-500',
    Classic: 'bg-cream-100 text-espresso-400',
  };
  const tierBarColors: Record<string, string> = {
    Gold: 'bg-amber-400',
    Silver: 'bg-cream-400',
    Bronze: 'bg-amber-300',
    Classic: 'bg-cream-300',
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Users} label="Total Members" value={String(data.totalMembers)} />
        <StatCard icon={Activity} label="Orders Today" value={String(data.todayOrderCount)} />
        <StatCard icon={TrendingUp} label="Revenue Today" value={formatRupiah(data.todayRevenue)} />
        <StatCard icon={Crown} label="Gold Members" value={String(data.tierCounts['Gold'] || 0)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-4">
          <h3 className="font-display font-semibold text-espresso-600 mb-3">Members by Tier</h3>
          <div className="space-y-3">
            {(['Gold', 'Silver', 'Bronze', 'Classic'] as const).map(tier => {
              const count = data.tierCounts[tier] || 0;
              const pct = data.totalMembers > 0 ? (count / data.totalMembers) * 100 : 0;
              return (
                <div key={tier}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-espresso-500 font-medium">{tier}</span>
                    <span className="text-espresso-400">{count} ({pct.toFixed(0)}%)</span>
                  </div>
                  <div className="h-2.5 bg-cream-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${tierBarColors[tier]}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card p-4">
          <h3 className="font-display font-semibold text-espresso-600 mb-3 flex items-center gap-2">
            <Crown className="w-4 h-4 text-amber-400" /> Top Members by Spend
          </h3>
          <div className="space-y-2">
            {data.topMembers.length === 0 ? (
              <p className="text-sm text-espresso-300 text-center py-4">No members yet.</p>
            ) : data.topMembers.map((m, i) => (
              <div key={m.user_id} className="flex items-center gap-3">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  i === 0 ? 'bg-amber-100 text-amber-600' :
                  i === 1 ? 'bg-cream-200 text-espresso-500' :
                  i === 2 ? 'bg-amber-50 text-amber-500' :
                  'bg-cream-100 text-espresso-400'
                }`}>{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-espresso-600 truncate">{m.name}</p>
                  <p className="text-xs text-espresso-300">{m.phone}</p>
                </div>
                <span className={`badge ${tierColors[m.tier]} flex-shrink-0`}>{m.tier}</span>
                <span className="text-sm font-medium text-espresso-500 flex-shrink-0">{formatRupiah(m.spending_since_upgrade)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card p-4">
        <h3 className="font-display font-semibold text-espresso-600 mb-3 flex items-center gap-2">
          <Activity className="w-4 h-4 text-sage-400" /> Recent Activity
        </h3>
        {data.recentTransactions.length === 0 ? (
          <p className="text-sm text-espresso-300 text-center py-4">No recent transactions.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-espresso-400 text-xs">
                <tr>
                  <th className="text-left pb-2 font-medium">Date</th>
                  <th className="text-left pb-2 font-medium">Member</th>
                  <th className="text-right pb-2 font-medium">Amount</th>
                  <th className="text-right pb-2 font-medium hidden sm:table-cell">Cashback</th>
                  <th className="text-left pb-2 font-medium hidden sm:table-cell">Source</th>
                </tr>
              </thead>
              <tbody>
                {data.recentTransactions.map(tx => (
                  <tr key={tx.id} className="border-t border-cream-200">
                    <td className="py-2 text-espresso-400 text-xs">
                      {new Date(tx.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </td>
                    <td className="py-2 text-espresso-600 font-medium">{tx.member_name}</td>
                    <td className="py-2 text-right text-espresso-600">{formatRupiah(tx.amount)}</td>
                    <td className="py-2 text-right text-sage-500 hidden sm:table-cell">{formatRupiah(tx.cashback)}</td>
                    <td className="py-2 text-espresso-400 hidden sm:table-cell text-xs">{tx.source.replace(/_/g, ' ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-espresso-400" />
        <span className="text-xs text-espresso-400 font-medium">{label}</span>
      </div>
      <p className="text-xl font-bold text-espresso-600">{value}</p>
    </div>
  );
}
