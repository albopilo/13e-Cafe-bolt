import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/context/AuthContext';
import type { Settings } from '@/lib/types';
import { DEFAULT_SETTINGS } from '@/lib/loyalty';
import { formatRupiah } from '@/lib/format';
import { Loader2, Save, RefreshCw, Download, Upload } from 'lucide-react';

export function SettingsTab() {
  const { addToast } = useToast();
  const { session } = useAuth();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);

  const fetchSettings = useCallback(async () => {
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle();
    if (error) {
      addToast('Failed to load settings', 'error');
      return;
    }
    if (data) setSettings(data as Settings);
    setLoading(false);
  }, [addToast]);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('settings')
      .update({
        classic_to_bronze_monthly: settings.classic_to_bronze_monthly,
        bronze_to_silver_monthly: settings.bronze_to_silver_monthly,
        bronze_to_silver_yearly: settings.bronze_to_silver_yearly,
        silver_to_gold_monthly: settings.silver_to_gold_monthly,
        silver_to_gold_yearly: settings.silver_to_gold_yearly,
        silver_stay_yearly: settings.silver_stay_yearly,
        gold_stay_yearly: settings.gold_stay_yearly,
        silver_cashback_rate: settings.silver_cashback_rate,
        gold_cashback_rate: settings.gold_cashback_rate,
        birthday_gold_cashback_rate: settings.birthday_gold_cashback_rate,
        silver_daily_cashback_cap: settings.silver_daily_cashback_cap,
        gold_daily_cashback_cap: settings.gold_daily_cashback_cap,
        bronze_discount_rate: settings.bronze_discount_rate,
        silver_discount_rate: settings.silver_discount_rate,
        gold_discount_rate: settings.gold_discount_rate,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1);
    setSaving(false);
    if (error) {
      addToast('Failed to save settings', 'error');
    } else {
      addToast('Settings saved', 'success');
    }
  };

  const handleRecalculate = async () => {
    if (!confirm('Recalculate all member tiers? This may upgrade or downgrade members based on current spending.')) return;
    setRecalculating(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bulk-recalculate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Recalculation failed');
      }
      const data = await response.json();
      addToast(`Recalculated: ${data.upgraded} upgraded, ${data.downgraded} downgraded, ${data.unchanged} unchanged`, 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Recalculation failed', 'error');
    } finally {
      setRecalculating(false);
    }
  };

  const handleBackup = async () => {
    setBackupLoading(true);
    try {
      const { data, error } = await supabase.from('members').select('*');
      if (error) throw error;
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `13e-cafe-members-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      addToast(`Backed up ${data?.length || 0} members`, 'success');
    } catch {
      addToast('Backup failed', 'error');
    } finally {
      setBackupLoading(false);
    }
  };

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!confirm('Restore members from JSON? This will update existing members but will NOT delete any.')) return;
    setRestoreLoading(true);
    try {
      const text = await file.text();
      const members = JSON.parse(text);
      if (!Array.isArray(members)) throw new Error('Invalid backup file');
      let restored = 0;
      for (const m of members) {
        const { error } = await supabase.from('members').upsert({
          user_id: m.user_id,
          phone: m.phone,
          email: m.email,
          name: m.name,
          name_lower: m.name_lower,
          birthdate: m.birthdate,
          birth_month: m.birth_month,
          birth_day: m.birth_day,
          ktp: m.ktp,
          tier: m.tier,
          discount_rate: m.discount_rate,
          tax_rate: m.tax_rate,
          redeemable_points: m.redeemable_points,
          spending_since_upgrade: m.spending_since_upgrade,
          monthly_since_upgrade: m.monthly_since_upgrade,
          yearly_since_upgrade: m.yearly_since_upgrade,
          upgrade_date: m.upgrade_date,
        });
        if (!error) restored++;
      }
      addToast(`Restored ${restored} members`, 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Restore failed', 'error');
    } finally {
      setRestoreLoading(false);
      e.target.value = '';
    }
  };

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-espresso-300" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Tier Thresholds */}
      <div className="card p-4">
        <h3 className="font-display font-semibold text-espresso-600 mb-3">Tier Upgrade Thresholds</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <NumberField label="Classic → Bronze (monthly spend)" value={settings.classic_to_bronze_monthly} onChange={v => setSettings({ ...settings, classic_to_bronze_monthly: v })} />
          <div />
          <NumberField label="Bronze → Silver (monthly)" value={settings.bronze_to_silver_monthly} onChange={v => setSettings({ ...settings, bronze_to_silver_monthly: v })} />
          <NumberField label="Bronze → Silver (yearly)" value={settings.bronze_to_silver_yearly} onChange={v => setSettings({ ...settings, bronze_to_silver_yearly: v })} />
          <NumberField label="Silver → Gold (monthly)" value={settings.silver_to_gold_monthly} onChange={v => setSettings({ ...settings, silver_to_gold_monthly: v })} />
          <NumberField label="Silver → Gold (yearly)" value={settings.silver_to_gold_yearly} onChange={v => setSettings({ ...settings, silver_to_gold_yearly: v })} />
          <NumberField label="Silver maintain (yearly min)" value={settings.silver_stay_yearly} onChange={v => setSettings({ ...settings, silver_stay_yearly: v })} />
          <NumberField label="Gold maintain (yearly min)" value={settings.gold_stay_yearly} onChange={v => setSettings({ ...settings, gold_stay_yearly: v })} />
        </div>
      </div>

      {/* Cashback & Discount Rates */}
      <div className="card p-4">
        <h3 className="font-display font-semibold text-espresso-600 mb-3">Cashback & Discount Rates</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <PercentField label="Bronze discount rate" value={settings.bronze_discount_rate} onChange={v => setSettings({ ...settings, bronze_discount_rate: v })} />
          <PercentField label="Silver discount rate" value={settings.silver_discount_rate} onChange={v => setSettings({ ...settings, silver_discount_rate: v })} />
          <PercentField label="Gold discount rate" value={settings.gold_discount_rate} onChange={v => setSettings({ ...settings, gold_discount_rate: v })} />
          <PercentField label="Silver cashback rate" value={settings.silver_cashback_rate} onChange={v => setSettings({ ...settings, silver_cashback_rate: v })} />
          <PercentField label="Gold cashback rate" value={settings.gold_cashback_rate} onChange={v => setSettings({ ...settings, gold_cashback_rate: v })} />
          <PercentField label="Gold birthday cashback" value={settings.birthday_gold_cashback_rate} onChange={v => setSettings({ ...settings, birthday_gold_cashback_rate: v })} />
          <NumberField label="Silver daily cashback cap" value={settings.silver_daily_cashback_cap} onChange={v => setSettings({ ...settings, silver_daily_cashback_cap: v })} />
          <NumberField label="Gold daily cashback cap" value={settings.gold_daily_cashback_cap} onChange={v => setSettings({ ...settings, gold_daily_cashback_cap: v })} />
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <button onClick={handleSave} disabled={saving} className="btn-primary text-sm py-2.5 flex items-center gap-1.5">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Settings
        </button>
        <button onClick={handleRecalculate} disabled={recalculating} className="btn-sage text-sm py-2.5 flex items-center gap-1.5">
          {recalculating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Bulk Recalculate Tiers
        </button>
        <button onClick={handleBackup} disabled={backupLoading} className="btn-secondary text-sm py-2.5 flex items-center gap-1.5">
          {backupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          Backup Members
        </button>
        <label className="btn-secondary text-sm py-2.5 flex items-center gap-1.5 cursor-pointer">
          {restoreLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          Restore Members
          <input type="file" accept="application/json" className="hidden" onChange={handleRestore} />
        </label>
      </div>
    </div>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="text-sm font-medium text-espresso-500 mb-1 block">{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-espresso-300">Rp</span>
        <input
          type="number"
          value={value}
          onChange={e => onChange(parseInt(e.target.value) || 0)}
          className="input-field pl-8 text-sm py-2.5"
        />
      </div>
      <p className="text-xs text-espresso-300 mt-0.5">{formatRupiah(value)}</p>
    </div>
  );
}

function PercentField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="text-sm font-medium text-espresso-500 mb-1 block">{label}</label>
      <div className="relative">
        <input
          type="number"
          step="0.01"
          value={value}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          className="input-field pr-8 text-sm py-2.5"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-espresso-300">%</span>
      </div>
      <p className="text-xs text-espresso-300 mt-0.5">{(value * 100).toFixed(1)}%</p>
    </div>
  );
}
