import { useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import type { Member } from '@/lib/types';
import { formatRupiah } from '@/lib/format';
import { X, Loader as Loader2, Upload, Scan, Receipt } from 'lucide-react';

export function ManualTransactionModal({ member, onClose, onSaved }: { member: Member; onClose: () => void; onSaved: () => void }) {
  const { addToast } = useToast();
  const { session } = useAuth();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (f: File) => {
    setFile(f);
    setScanning(true);
    try {
      const Tesseract = await import('tesseract.js');
      const worker = await Tesseract.createWorker('eng');
      const { data: { text } } = await worker.recognize(f);
      await worker.terminate();

      const lines = text.split('\n').map((l: string) => l.trim()).filter(Boolean);
      const totalKeywords = ['grand total', 'total bayar', 'amount due', 'total'];
      let extractedAmount = 0;

      for (const line of lines) {
        const lower = line.toLowerCase();
        if (totalKeywords.some(kw => lower.includes(kw))) {
          const match = line.match(/(\d{1,3}(?:[.,]\d{3})+)/);
          if (match) {
            const num = parseInt(match[1].replace(/[.,]/g, ''), 10);
            if (num >= 1000 && num <= 10000000) {
              extractedAmount = num;
              break;
            }
          }
        }
      }

      if (extractedAmount === 0) {
        let maxNum = 0;
        for (const line of lines) {
          const match = line.match(/(\d{1,3}(?:[.,]\d{3})+)/);
          if (match) {
            const num = parseInt(match[1].replace(/[.,]/g, ''), 10);
            if (num >= 1000 && num <= 10000000 && num > maxNum) {
              maxNum = num;
            }
          }
        }
        extractedAmount = maxNum;
      }

      if (extractedAmount > 0) {
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
    <div className="fixed inset-0 z-50 bg-espresso-900/50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-cream-100 rounded-2xl p-6 max-w-md w-full max-h-[85vh] overflow-y-auto animate-slide-up" onClick={e => e.stopPropagation()}>
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
          {/* Receipt upload with OCR */}
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
                    {scanning ? <Loader2 className="w-6 h-6 animate-spin text-sage-400" /> : <Scan className="w-6 h-6 text-espresso-300" />}
                    <p className="text-sm text-espresso-400">{scanning ? 'Scanning receipt...' : 'Tap to upload receipt for OCR'}</p>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }}
              />
            </label>
          </div>

          {/* Amount */}
          <div>
            <label className="text-sm font-medium text-espresso-500 mb-1 block">Amount (Rp)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-espresso-300">Rp</span>
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="input-field pl-8 text-sm py-2.5"
                placeholder="0"
              />
            </div>
            {amount && <p className="text-xs text-espresso-300 mt-0.5">{formatRupiah(parseInt(amount) || 0)}</p>}
          </div>

          {/* Note */}
          <div>
            <label className="text-sm font-medium text-espresso-500 mb-1 block">Note (optional)</label>
            <input
              type="text"
              value={note}
              onChange={e => setNote(e.target.value)}
              className="input-field text-sm py-2.5"
              placeholder="e.g. Honda service, Millennium stay"
            />
          </div>
        </div>

        <button onClick={handleSave} disabled={saving || scanning} className="btn-primary w-full mt-4 flex items-center justify-center gap-2">
          {saving && <Loader2 className="w-5 h-5 animate-spin" />}
          {saving ? 'Adding...' : 'Add Transaction'}
        </button>
      </div>
    </div>
  );
}
