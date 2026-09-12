import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import type { Member, LoyaltyTransaction, RoomUpgrade } from '@/lib/types';
import { formatRupiah } from '@/lib/format';
import { scanReceipt } from '@/lib/receiptOcr';
import { getTierPerks } from '@/lib/loyalty';
import { X, Phone, Mail, Calendar, Crown, Wallet, TrendingUp, Gift, Receipt, ChevronLeft, ChevronRight, Chrome as Home, Trash2 } from 'lucide-react';

interface Stats {
  monthly: number;
  yearly: number;
  lastYear: number;
  allTime: number;
  cashbackTotal: number;
}

const TX_PER_PAGE = 5;

export function MemberDetailModal({ member, isAdmin, onClose, onDeleted }: { member: Member; isAdmin: boolean; onClose: () => void; onDeleted?: () => void }) {
  const { addToast } = useToast();
  const { session } = useAuth();
  const [deletingMember, setDeletingMember] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [transactions, setTransactions] = useState<LoyaltyTransaction[]>([]);
  const [txCount, setTxCount] = useState(0);
  const [txPage, setTxPage] = useState(0);
  const [roomUpgrades, setRoomUpgrades] = useState<RoomUpgrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [showManualTx, setShowManualTx] = useState(false);
  const [redeeming, setRedeeming] = useState(false);
  const [claimingRoom, setClaimingRoom] = useState(false);

  const loadData = useCallback(async (page: number) => {
    const [txsRes, countRes, upgradesRes] = await Promise.all([
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
    ]);

    const allTxs = (txsRes.data || []) as LoyaltyTransaction[];
    setTransactions(allTxs);
    setTxCount(countRes.count || 0);
    setRoomUpgrades((upgradesRes.data || []) as RoomUpgrade[]);

    // Compute stats from all transactions
    const { data: allTxData } = await supabase
      .from('loyalty_transactions')
      .select('amount, cashback, created_at')
      .eq('member_id', member.user_id)
      .order('created_at', { ascending: false });

    const allTxsForStats = (allTxData || []) as Array<{ amount: number; cashback: number; created_at: string }>;
    const now = new Date();
    const thisYear = now.getFullYear();
    const lastYear = thisYear - 1;
    const thisMonth = now.getMonth();

    let monthly = 0, yearly = 0, lastYearTotal = 0, allTime = 0, cashbackTotal = 0;
    allTxsForStats.forEach(tx => {
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
    setLoading(false);
  }, [member.user_id]);

  useEffect(() => { loadData(0); }, [loadData]);

  useEffect(() => { if (txPage >= 0) loadData(txPage); }, [txPage, loadData]);

  const handleRedeemPoints = async () => {
    if (member.redeemable_points <= 0) {
      addToast('No points to redeem', 'error');
      return;
    }
    if (!confirm(`Redeem ${formatRupiah(member.redeemable_points)} points for ${member.name}?`)) return;
    setRedeeming(true);
    try {
      const { error } = await supabase
        .from('loyalty_transactions')
        .insert({
          member_id: member.user_id,
          order_id: null,
          amount: 0,
          cashback: 0,
          points_earned: -member.redeemable_points,
          source: 'points_redeemed',
          table_name: 'Redemption',
          manual: true,
          note: 'Points redeemed by admin',
        });
      if (error) throw new Error(error.message);

      await supabase
        .from('members')
        .update({ redeemable_points: 0 })
        .eq('user_id', member.user_id);

      addToast(`Redeemed ${formatRupiah(member.redeemable_points)} points`, 'success');
      loadData(txPage);
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to redeem points', 'error');
    } finally {
      setRedeeming(false);
    }
  };

  const handleClaimRoomUpgrade = async () => {
    const sixMonthsAgo = new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000);
    if (member.last_room_upgrade && new Date(member.last_room_upgrade) > sixMonthsAgo) {
      addToast('Room upgrade is on 6-month cooldown', 'error');
      return;
    }
    setClaimingRoom(true);
    try {
      const { error: insertError } = await supabase
        .from('room_upgrades')
        .insert({ member_id: member.user_id, location: 'Millennium' });
      if (insertError) throw new Error(insertError.message);

      await supabase
        .from('members')
        .update({ last_room_upgrade: new Date().toISOString() })
        .eq('user_id', member.user_id);

      addToast('Room upgrade claimed', 'success');
      loadData(txPage);
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to claim room upgrade', 'error');
    } finally {
      setClaimingRoom(false);
    }
  };

  const handleDeleteTransaction = async (txId: string, tx: LoyaltyTransaction) => {
    if (!confirm('Delete this transaction? This will reverse its effect on spending and points.')) return;
    try {
      if (tx.amount > 0 || tx.points_earned > 0) {
        await supabase.from('loyalty_transactions').insert({
          member_id: member.user_id,
          order_id: tx.order_id,
          amount: -tx.amount,
          cashback: -tx.cashback,
          points_earned: -tx.points_earned,
          source: 'transaction_deleted',
          table_name: tx.table_name,
          manual: true,
          note: `Reversal of deleted transaction`,
        });

        const { data: m } = await supabase
          .from('members')
          .select('redeemable_points, spending_since_upgrade, monthly_since_upgrade, yearly_since_upgrade')
          .eq('user_id', member.user_id)
          .maybeSingle();

        if (m) {
          await supabase.from('members').update({
            redeemable_points: Math.max(0, m.redeemable_points - tx.points_earned),
            spending_since_upgrade: Math.max(0, m.spending_since_upgrade - tx.amount),
            monthly_since_upgrade: Math.max(0, m.monthly_since_upgrade - tx.amount),
            yearly_since_upgrade: Math.max(0, m.yearly_since_upgrade - tx.amount),
          }).eq('user_id', member.user_id);
        }
      }

      await supabase.from('loyalty_transactions').delete().eq('id', txId);
      addToast('Transaction deleted', 'success');
      loadData(txPage);
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to delete transaction', 'error');
    }
  };

  const handleDeleteMember = async () => {
    if (!confirm(`Permanently delete member "${member.name}"? This will remove their account, all transactions, and room upgrade history. This cannot be undone.`)) return;
    setDeletingMember(true);
    try {
      const response = await window.fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-staff`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ action: 'delete_member', user_id: member.user_id }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to delete member');
      }
      addToast('Member deleted', 'success');
      onDeleted?.();
      onClose();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to delete member', 'error');
    } finally {
      setDeletingMember(false);
    }
  };

  const tierColors: Record<string, string> = {
    Gold: 'bg-amber-100 text-amber-600',
    Silver: 'bg-cream-200 text-espresso-500',
    Bronze: 'bg-amber-50 text-amber-500',
    Classic: 'bg-cream-100 text-espresso-400',
  };

  const perks = getTierPerks(member.tier);
  const sixMonthsAgo = new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000);
  const canClaimRoom = member.tier === 'Gold' && (!member.last_room_upgrade || new Date(member.last_room_upgrade) <= sixMonthsAgo);
  const totalPages = Math.ceil(txCount / TX_PER_PAGE);

  return (
    <div className="fixed inset-0 z-50 bg-espresso-900/50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-cream-100 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto animate-slide-up" onClick={e => e.stopPropagation()}>
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
            {/* Info */}
            <div className="grid grid-cols-2 gap-2 text-sm">
              <InfoRow icon={Phone} label="Phone" value={member.phone || '-'} />
              <InfoRow icon={Mail} label="Email" value={member.email || '-'} />
              <InfoRow icon={Calendar} label="Birthdate" value={member.birthdate ? new Date(member.birthdate).toLocaleDateString('en-GB') : '-'} />
              <InfoRow icon={Gift} label="Redeemable" value={formatRupiah(member.redeemable_points)} />
            </div>

            {/* Stats */}
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

            {/* Perks */}
            <div className="bg-white rounded-xl p-3 border border-cream-200">
              <h4 className="font-display font-semibold text-espresso-600 mb-2 text-sm flex items-center gap-2">
                <Crown className="w-4 h-4 text-amber-400" /> {member.tier} Tier Perks
              </h4>
              <div className="grid grid-cols-2 gap-1 text-xs text-espresso-500">
                <span>Café: {perks.cafeDiscount}% off</span>
                <span>Honda: {perks.hondaDiscount}% off</span>
                {perks.millenniumDiscount > 0 && <span>Millennium: {perks.millenniumDiscount}% off</span>}
                {perks.cashbackRate > 0 && <span>Cashback: {perks.cashbackRate}%</span>}
              </div>
              {perks.birthdayPerks.length > 0 && (
                <div className="mt-2 pt-2 border-t border-cream-200">
                  <p className="text-xs font-medium text-espresso-400 mb-1">Birthday Perks:</p>
                  <ul className="text-xs text-espresso-500 space-y-0.5">
                    {perks.birthdayPerks.map((p, i) => <li key={i}>• {p}</li>)}
                  </ul>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setShowManualTx(true)}
                className="btn-primary text-xs py-2 flex items-center gap-1.5"
              >
                <Receipt className="w-3.5 h-3.5" /> Add Transaction
              </button>
              {isAdmin && (
                <button
                  onClick={handleRedeemPoints}
                  disabled={redeeming || member.redeemable_points <= 0}
                  className="btn-sage text-xs py-2 flex items-center gap-1.5"
                >
                  <Gift className="w-3.5 h-3.5" /> Redeem Points
                </button>
              )}
              {isAdmin && member.tier === 'Gold' && (
                <button
                  onClick={handleClaimRoomUpgrade}
                  disabled={claimingRoom || !canClaimRoom}
                  className="btn-secondary text-xs py-2 flex items-center gap-1.5"
                >
                  <Home className="w-3.5 h-3.5" /> Claim Room Upgrade
                </button>
              )}
              {isAdmin && (
                <button
                  onClick={handleDeleteMember}
                  disabled={deletingMember}
                  className="text-xs py-2 px-3 rounded-lg bg-rust-50 text-rust-500 hover:bg-rust-100 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete Member
                </button>
              )}
            </div>

            {/* Room upgrade history */}
            {roomUpgrades.length > 0 && (
              <div>
                <h4 className="font-display font-semibold text-espresso-600 mb-2 text-sm">Room Upgrade History</h4>
                <div className="space-y-1">
                  {roomUpgrades.map(ru => (
                    <div key={ru.id} className="flex justify-between items-center py-1.5 px-3 rounded-lg bg-white border border-cream-200 text-sm">
                      <span className="text-espresso-500">{new Date(ru.claimed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      <span className="text-espresso-400 text-xs">{ru.location || 'Millennium'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Transaction history */}
            <div>
              <h4 className="font-display font-semibold text-espresso-600 mb-2 text-sm">Recent Transactions ({txCount})</h4>
              {transactions.length === 0 ? (
                <p className="text-sm text-espresso-300 text-center py-4">No transactions yet.</p>
              ) : (
                <>
                  <div className="space-y-1.5">
                    {transactions.map(tx => (
                      <div key={tx.id} className="flex justify-between items-center py-2 px-3 rounded-lg bg-white border border-cream-200 text-sm group">
                        <div className="flex-1 min-w-0">
                          <p className="text-espresso-600 font-medium">{formatRupiah(tx.amount)}</p>
                          <p className="text-xs text-espresso-300">
                            {new Date(tx.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                            {' · '}{tx.source.replace(/_/g, ' ')}
                            {tx.note && <span className="text-espresso-400"> · {tx.note}</span>}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {tx.cashback !== 0 && <span className="text-sage-500 text-xs font-medium">{tx.cashback > 0 ? '+' : ''}{formatRupiah(tx.cashback)}</span>}
                          {tx.receipt_url && (
                            <a href={tx.receipt_url} target="_blank" rel="noopener noreferrer" className="text-sage-500 text-xs hover:underline">view</a>
                          )}
                          {isAdmin && (
                            <button
                              onClick={() => handleDeleteTransaction(tx.id, tx)}
                              className="text-rust-400 text-xs hover:text-rust-500 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              delete
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-3">
                      <button
                        onClick={() => setTxPage(Math.max(0, txPage - 1))}
                        disabled={txPage === 0}
                        className="p-1.5 rounded-lg bg-cream-200 hover:bg-cream-300 disabled:opacity-30 transition-colors"
                      >
                        <ChevronLeft className="w-4 h-4 text-espresso-500" />
                      </button>
                      <span className="text-sm text-espresso-400">Page {txPage + 1} of {totalPages}</span>
                      <button
                        onClick={() => setTxPage(Math.min(totalPages - 1, txPage + 1))}
                        disabled={txPage >= totalPages - 1}
                        className="p-1.5 rounded-lg bg-cream-200 hover:bg-cream-300 disabled:opacity-30 transition-colors"
                      >
                        <ChevronRight className="w-4 h-4 text-espresso-500" />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {showManualTx && (
        <ManualTransactionModalWrapper member={member} onClose={() => setShowManualTx(false)} onSaved={() => { setShowManualTx(false); loadData(txPage); }} />
      )}
    </div>
  );
}

function ManualTransactionModalWrapper({ member, onClose, onSaved }: { member: Member; onClose: () => void; onSaved: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] bg-espresso-900/50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-cream-100 rounded-2xl p-6 max-w-md w-full max-h-[85vh] overflow-y-auto animate-slide-up" onClick={e => e.stopPropagation()}>
        <ManualTransactionModalInner member={member} onClose={onClose} onSaved={onSaved} />
      </div>
    </div>
  );
}

function ManualTransactionModalInner({ member, onClose, onSaved }: { member: Member; onClose: () => void; onSaved: () => void }) {
  const { addToast } = useToast();
  const { session } = useAuth();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleFileSelect = async (f: File) => {
    setFile(f);
    setScanning(true);
    try {
      const { amount: extractedAmount } = await scanReceipt(f);

      if (extractedAmount !== null) {
        setAmount(String(extractedAmount));
        addToast(`Scanned: ${formatRupiah(extractedAmount)}`, 'success');
      } else {
        addToast('Could not detect amount. Please enter manually.', 'info');
      }
    } catch {
      addToast('OCR scan failed. Please enter amount manually.', 'error');
    } finally {
      setScanning(false);
    }
  };

  const handleSave = async () => {
    const amt = parseInt(amount) || 0;
    if (amt <= 0) {
      addToast('Enter a valid amount', 'error');
      return;
    }
    setSaving(true);
    try {
      let uploadedUrl: string | null = null;
      if (file) {
        const ext = file.name.split('.').pop() || 'jpg';
        const fileName = `receipts/${member.user_id}-${Date.now()}.${ext}`;
        const fileBytes = new Uint8Array(await file.arrayBuffer());
        const { error: uploadError } = await supabase.storage
          .from('receipts')
          .upload(fileName, fileBytes, { contentType: file.type || 'image/jpeg', upsert: false });
        if (uploadError) throw new Error(uploadError.message);
        const { data: urlData } = supabase.storage.from('receipts').getPublicUrl(fileName);
        uploadedUrl = urlData.publicUrl;
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manual-transaction`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          member_id: member.user_id,
          amount: amt,
          note: note || null,
          receipt_url: uploadedUrl,
          table_name: 'Manual',
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to add transaction');
      }

      const data = await response.json();
      addToast(`Transaction added. Cashback: ${formatRupiah(data.cashback || 0)}`, 'success');
      onSaved();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to add transaction', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display font-bold text-espresso-600 flex items-center gap-2">
          <Receipt className="w-5 h-5" /> Manual Transaction
        </h3>
        <button onClick={onClose} className="p-1 hover:bg-cream-200 rounded-lg">
          <X className="w-5 h-5 text-espresso-400" />
        </button>
      </div>
      <p className="text-sm text-espresso-400 mb-4">For: <span className="font-medium text-espresso-600">{member.name}</span></p>
      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium text-espresso-500 mb-1 block">Receipt Image (optional — auto-scans amount)</label>
          <label className="block">
            <div className="border-2 border-dashed border-cream-300 rounded-xl p-4 text-center cursor-pointer hover:border-sage-400 transition-colors">
              {file ? (
                <div>
                  <img src={URL.createObjectURL(file)} alt="Receipt" className="max-h-32 mx-auto rounded-lg mb-2" />
                  <p className="text-sm text-espresso-500">{file.name}</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1">
                  {scanning ? <div className="w-6 h-6 border-2 border-sage-400 border-t-transparent rounded-full animate-spin" /> : <Receipt className="w-6 h-6 text-espresso-300" />}
                  <p className="text-sm text-espresso-400">{scanning ? 'Scanning receipt...' : 'Tap to upload receipt for OCR'}</p>
                </div>
              )}
            </div>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }}
            />
          </label>
        </div>
        <div>
          <label className="text-sm font-medium text-espresso-500 mb-1 block">Amount (Rp)</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-espresso-300">Rp</span>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="input-field pl-8 text-sm py-2.5" placeholder="0" />
          </div>
          {amount && <p className="text-xs text-espresso-300 mt-0.5">{formatRupiah(parseInt(amount) || 0)}</p>}
        </div>
        <div>
          <label className="text-sm font-medium text-espresso-500 mb-1 block">Note (optional)</label>
          <input type="text" value={note} onChange={e => setNote(e.target.value)} className="input-field text-sm py-2.5" placeholder="e.g. Honda service, Millennium stay" />
        </div>
      </div>
      <button onClick={handleSave} disabled={saving || scanning} className="btn-primary w-full mt-4 flex items-center justify-center gap-2">
        {saving && <div className="w-5 h-5 border-2 border-cream-100 border-t-transparent rounded-full animate-spin" />}
        {saving ? 'Adding...' : 'Add Transaction'}
      </button>
    </>
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
