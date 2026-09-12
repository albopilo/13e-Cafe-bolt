import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/context/AuthContext';
import { formatRupiah } from '@/lib/format';
import { ArrowLeft, Upload, Loader2, CheckCircle2, QrCode } from 'lucide-react';

export function QrisPaymentPage() {
  const [params] = useSearchParams();
  const orderId = params.get('order_id');
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { session } = useAuth();

  const [order, setOrder] = useState<{ grand_total: number; table_name: string; proof_url: string | null } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (!orderId) {
      navigate('/');
      return;
    }
    (async () => {
      const { data } = await supabase
        .from('orders')
        .select('grand_total, table_name, proof_url')
        .eq('id', orderId)
        .maybeSingle();
      if (data) {
        setOrder(data);
        if (data.proof_url) setUploaded(true);
      }
    })();
  }, [orderId, navigate]);

  const handleUpload = async () => {
    if (!file || !orderId) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('order_id', orderId);

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-payment-proof`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Upload failed');
      }

      setUploaded(true);
      addToast('Payment proof uploaded! Staff will verify shortly.', 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Upload failed', 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream-100">
      <header className="sticky top-0 z-40 bg-cream-100/95 backdrop-blur-sm border-b border-cream-200">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate('/')} className="p-2 hover:bg-cream-200 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-espresso-600" />
          </button>
          <h1 className="font-display font-bold text-espresso-600 text-lg">QRIS Payment</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {order && (
          <div className="card p-6 text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <QrCode className="w-6 h-6 text-espresso-600" />
              <h2 className="font-display font-semibold text-espresso-600">Scan to Pay</h2>
            </div>

            <div className="bg-white p-6 rounded-2xl border-2 border-cream-200 inline-block mb-4">
              <img
                src="/images/image.png"
                alt="QRIS Scan to Pay"
                className="w-48 h-48 object-contain rounded-xl"
              />
            </div>

            <p className="text-2xl font-bold text-espresso-600 mb-1">{formatRupiah(order.grand_total)}</p>
            <p className="text-sm text-espresso-300 mb-4">Table: {order.table_name}</p>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
              <p className="text-sm text-amber-600">
                Scan the QR code with your banking app, then upload your payment confirmation below.
              </p>
            </div>
          </div>
        )}

        <div className="card p-6">
          <h3 className="font-display font-semibold text-espresso-600 mb-3">Upload Payment Proof</h3>
          {uploaded ? (
            <div className="text-center py-8">
              <CheckCircle2 className="w-12 h-12 text-sage-400 mx-auto mb-3" />
              <p className="text-sage-600 font-medium">Proof uploaded!</p>
              <p className="text-sm text-espresso-300 mt-1">Staff will verify your payment shortly.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <label className="block">
                <div className="border-2 border-dashed border-cream-300 rounded-xl p-8 text-center cursor-pointer hover:border-sage-400 transition-colors">
                  {file ? (
                    <div>
                      <img
                        src={URL.createObjectURL(file)}
                        alt="Payment proof"
                        className="max-h-40 mx-auto rounded-lg mb-2"
                      />
                      <p className="text-sm text-espresso-500">{file.name}</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="w-8 h-8 text-espresso-300" />
                      <p className="text-sm text-espresso-400">Tap to select a photo of your payment</p>
                    </div>
                  )}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => setFile(e.target.files?.[0] ?? null)}
                />
              </label>
              <button
                onClick={handleUpload}
                disabled={!file || uploading}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                {uploading ? 'Uploading...' : 'Upload Proof'}
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
