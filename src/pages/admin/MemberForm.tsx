import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/context/ToastContext';
import type { Member, LoyaltyTier } from '@/lib/types';
import { TIER_CONFIGS, TIER_ORDER } from '@/lib/loyalty';
import { normalizePhone } from '@/lib/categories';
import { formatRupiah } from '@/lib/format';
import { X, Loader2, User, Mail, Phone, Calendar, Crown } from 'lucide-react';

export function MemberForm({ member, onClose, onSaved }: { member: Member | null; onClose: () => void; onSaved: () => void }) {
  const { addToast } = useToast();
  const [name, setName] = useState(member?.name || '');
  const [email, setEmail] = useState(member?.email || '');
  const [phone, setPhone] = useState(member?.phone || '');
  const [birthdate, setBirthdate] = useState(member?.birthdate || '');
  const [tier, setTier] = useState<LoyaltyTier>(member?.tier || 'Classic');
  const [points, setPoints] = useState(String(member?.redeemable_points || 0));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim() || !phone.trim()) {
      addToast('Name and phone are required', 'error');
      return;
    }
    setSaving(true);
    try {
      const updateData = {
        name: name.trim(),
        name_lower: name.trim().toLowerCase(),
        email: email.trim(),
        phone: normalizePhone(phone.trim()),
        birthdate: birthdate || null,
        tier,
        discount_rate: TIER_CONFIGS[tier].discountRate,
        redeemable_points: parseInt(points) || 0,
      };

      if (member) {
        const { error } = await supabase.from('members').update(updateData).eq('user_id', member.user_id);
        if (error) throw new Error(error.message);
        addToast('Member updated', 'success');
      } else {
        addToast('New members must register through the signup page. You can edit existing members here.', 'error');
        setSaving(false);
        return;
      }
      onSaved();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to save member', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-espresso-900/50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-cream-100 rounded-2xl p-6 max-w-md w-full max-h-[85vh] overflow-y-auto animate-slide-up" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-bold text-espresso-600 flex items-center gap-2">
            <Crown className="w-5 h-5 text-amber-400" />
            {member ? 'Edit Member' : 'Add Member'}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-cream-200 rounded-lg">
            <X className="w-5 h-5 text-espresso-400" />
          </button>
        </div>

        {!member && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
            <p className="text-sm text-amber-600">
              New members register themselves through the signup page. Use this form to edit existing member details.
            </p>
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-espresso-500 mb-1 block">Full Name</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-espresso-300" />
              <input value={name} onChange={e => setName(e.target.value)} className="input-field pl-10 text-sm py-2.5" placeholder="Member name" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-espresso-500 mb-1 block">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-espresso-300" />
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="input-field pl-10 text-sm py-2.5" placeholder="email@example.com" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-espresso-500 mb-1 block">Phone</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-espresso-300" />
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="input-field pl-10 text-sm py-2.5" placeholder="08xx..." />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-espresso-500 mb-1 block">Birthdate</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-espresso-300" />
              <input type="date" value={birthdate} onChange={e => setBirthdate(e.target.value)} className="input-field pl-10 text-sm py-2.5" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-espresso-500 mb-1 block">Loyalty Tier</label>
            <select value={tier} onChange={e => setTier(e.target.value as LoyaltyTier)} className="input-field text-sm py-2.5">
              {TIER_ORDER.map(t => (
                <option key={t} value={t}>
                  {t} ({(TIER_CONFIGS[t].discountRate * 100).toFixed(0)}% discount)
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-espresso-500 mb-1 block">Redeemable Points (Rp)</label>
            <input type="number" value={points} onChange={e => setPoints(e.target.value)} min="0" className="input-field text-sm py-2.5" />
            <p className="text-xs text-espresso-300 mt-1">Current: {formatRupiah(parseInt(points) || 0)}</p>
          </div>
        </div>

        <button onClick={handleSave} disabled={saving} className="btn-primary w-full mt-4 flex items-center justify-center gap-2">
          {saving && <Loader2 className="w-5 h-5 animate-spin" />}
          {saving ? 'Saving...' : 'Save Member'}
        </button>
      </div>
    </div>
  );
}
