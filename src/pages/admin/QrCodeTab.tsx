import { useState, useEffect, useCallback, useRef } from 'react';
import QRCode from 'qrcode';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/context/ToastContext';
import { useLang } from '@/context/LanguageContext';
import type { RoomTable } from '@/lib/types';
import { formatRupiah } from '@/lib/format';
import { Plus, Trash2, Download, Printer, QrCode, Loader2, X, Pencil, RefreshCw } from 'lucide-react';

const BASE_URL = 'https://13ecafe.netlify.app';

export function QrCodeTab() {
  const { addToast } = useToast();
  const { t } = useLang();
  const [rooms, setRooms] = useState<RoomTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRoom, setEditingRoom] = useState<RoomTable | null>(null);
  const [printMode, setPrintMode] = useState(false);

  const fetchRooms = useCallback(async () => {
    const { data, error } = await supabase
      .from('room_tables')
      .select('*')
      .order('sort_order', { ascending: true });
    if (error) {
      addToast(t('qrFailedToLoad'), 'error');
      return;
    }
    setRooms((data || []) as RoomTable[]);
    setLoading(false);
  }, [addToast, t]);

  useEffect(() => { fetchRooms(); }, [fetchRooms]);

  const handleDelete = async (room: RoomTable) => {
    if (!confirm(`${t('qrConfirmDelete')} "${room.name}"?`)) return;
    const { error } = await supabase.from('room_tables').delete().eq('id', room.id);
    if (error) {
      addToast(t('qrDeleteFailed'), 'error');
    } else {
      addToast(t('qrDeleted'), 'success');
      fetchRooms();
    }
  };

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-espresso-300" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => { setEditingRoom(null); setShowForm(true); }} className="btn-primary text-sm py-2.5 flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> {t('qrAddRoom')}
        </button>
        <button onClick={() => setPrintMode(true)} disabled={rooms.length === 0} className="btn-secondary text-sm py-2.5 flex items-center gap-1.5 disabled:opacity-50">
          <Printer className="w-4 h-4" /> {t('qrPrintAll')}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {rooms.map(room => (
          <RoomQrCard key={room.id} room={room} onDelete={() => handleDelete(room)} onEdit={() => { setEditingRoom(room); setShowForm(true); }} />
        ))}
      </div>

      {rooms.length === 0 && (
        <div className="text-center py-8 text-espresso-300">
          <QrCode className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>{t('qrNoRooms')}</p>
        </div>
      )}

      {showForm && (
        <RoomForm
          room={editingRoom}
          onClose={() => { setShowForm(false); setEditingRoom(null); }}
          onSaved={() => { fetchRooms(); setShowForm(false); setEditingRoom(null); }}
        />
      )}

      {printMode && (
        <PrintLayout rooms={rooms} onClose={() => setPrintMode(false)} />
      )}
    </div>
  );
}

function RoomQrCard({ room, onDelete, onEdit }: { room: RoomTable; onDelete: () => void; onEdit: () => void }) {
  const { t } = useLang();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [qrReady, setQrReady] = useState(false);
  const url = `${BASE_URL}/?table=${encodeURIComponent(room.name)}`;

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, url, {
      width: 220,
      margin: 2,
      color: { dark: '#3D2817', light: '#FFFDF8' },
    }, () => setQrReady(true));
  }, [url]);

  const handleDownload = () => {
    if (!canvasRef.current) return;
    const link = document.createElement('a');
    link.download = `qr-${room.name.replace(/\s+/g, '-')}.png`;
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
  };

  return (
    <div className="card p-4 flex flex-col items-center">
      <div className="flex items-center justify-between w-full mb-2">
        <div>
          <p className="font-display font-bold text-espresso-600">{room.display_name}</p>
          <p className="text-xs text-espresso-300 mt-0.5">
            {room.qris_only ? t('qrisOnly') : t('cash')} · {room.delivery_fee > 0 ? `+${formatRupiah(room.delivery_fee)}` : t('free')}
          </p>
        </div>
        <div className="flex gap-1.5">
          <button onClick={onEdit} className="p-1.5 rounded-lg bg-cream-200 hover:bg-cream-300 transition-colors">
            <Pencil className="w-3.5 h-3.5 text-espresso-500" />
          </button>
          <button onClick={onDelete} className="p-1.5 rounded-lg bg-rust-50 hover:bg-rust-100 transition-colors">
            <Trash2 className="w-3.5 h-3.5 text-rust-500" />
          </button>
        </div>
      </div>

      <div className="bg-white p-3 rounded-xl border border-cream-200 my-2">
        {!qrReady && <div className="w-[220px] h-[220px] flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-espresso-300" /></div>}
        <canvas ref={canvasRef} className={qrReady ? 'block' : 'hidden'} />
      </div>

      <p className="text-xs text-espresso-300 text-center mb-3 break-all">{url}</p>

      <button onClick={handleDownload} className="btn-secondary text-sm py-2 flex items-center gap-1.5 w-full justify-center">
        <Download className="w-4 h-4" /> {t('qrDownload')}
      </button>
    </div>
  );
}

function RoomForm({ room, onClose, onSaved }: { room: RoomTable | null; onClose: () => void; onSaved: () => void }) {
  const { addToast } = useToast();
  const { t } = useLang();
  const [name, setName] = useState(room?.name || '');
  const [displayName, setDisplayName] = useState(room?.display_name || '');
  const [deliveryFee, setDeliveryFee] = useState(String(room?.delivery_fee ?? 0));
  const [qrisOnly, setQrisOnly] = useState(room?.qris_only ?? false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      addToast(t('qrNameRequired'), 'error');
      return;
    }
    setSaving(true);
    const data = {
      name: name.trim(),
      display_name: displayName.trim() || name.trim(),
      delivery_fee: parseInt(deliveryFee) || 0,
      qris_only: qrisOnly,
      sort_order: room?.sort_order ?? 99,
      updated_at: new Date().toISOString(),
    };

    let error;
    if (room) {
      ({ error } = await supabase.from('room_tables').update(data).eq('id', room.id));
    } else {
      ({ error } = await supabase.from('room_tables').insert(data));
    }

    setSaving(false);
    if (error) {
      addToast(error.message.includes('duplicate') ? t('qrNameExists') : t('qrSaveFailed'), 'error');
    } else {
      addToast(t('qrSaved'), 'success');
      onSaved();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-espresso-900/50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-cream-100 rounded-2xl p-6 max-w-md w-full animate-slide-up" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-bold text-espresso-600">{room ? t('qrEditRoom') : t('qrAddRoom')}</h3>
          <button onClick={onClose} className="p-1 hover:bg-cream-200 rounded-lg"><X className="w-5 h-5 text-espresso-400" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-espresso-500 mb-1 block">{t('qrRoomName')}</label>
            <input value={name} onChange={e => setName(e.target.value)} className="input-field text-sm py-2.5" placeholder="Mille 1" disabled={!!room} />
            <p className="text-xs text-espresso-300 mt-1">{t('qrRoomNameHint')}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-espresso-500 mb-1 block">{t('qrDisplayName')}</label>
            <input value={displayName} onChange={e => setDisplayName(e.target.value)} className="input-field text-sm py-2.5" placeholder={t('qrDisplayNamePlaceholder')} />
          </div>
          <div>
            <label className="text-sm font-medium text-espresso-500 mb-1 block">{t('qrDeliveryFee')}</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-espresso-300">Rp</span>
              <input type="number" value={deliveryFee} onChange={e => setDeliveryFee(e.target.value)} className="input-field pl-8 text-sm py-2.5" />
            </div>
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={qrisOnly} onChange={e => setQrisOnly(e.target.checked)} className="w-4 h-4 accent-espresso-600" />
            <span className="text-sm text-espresso-500">{t('qrQrisOnly')}</span>
          </label>
        </div>
        <button onClick={handleSave} disabled={saving} className="btn-primary w-full mt-4 flex items-center justify-center gap-2">
          {saving && <Loader2 className="w-5 h-5 animate-spin" />}
          {saving ? t('qrSaving') : t('qrSave')}
        </button>
      </div>
    </div>
  );
}

function PrintLayout({ rooms, onClose }: { rooms: RoomTable[]; onClose: () => void }) {
  const { t } = useLang();
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);

  useEffect(() => {
    rooms.forEach((room, i) => {
      const canvas = canvasRefs.current[i];
      if (!canvas) return;
      const url = `${BASE_URL}/?table=${encodeURIComponent(room.name)}`;
      QRCode.toCanvas(canvas, url, {
        width: 180,
        margin: 2,
        color: { dark: '#3D2817', light: '#FFFFFF' },
      });
    });
  }, [rooms]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-espresso-900/50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-cream-100 rounded-2xl p-6 max-w-2xl w-full max-h-[85vh] overflow-y-auto animate-slide-up" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4 no-print">
          <h3 className="font-display font-bold text-espresso-600">{t('qrPrintPreview')}</h3>
          <div className="flex gap-2">
            <button onClick={handlePrint} className="btn-primary text-sm py-2.5 flex items-center gap-1.5">
              <Printer className="w-4 h-4" /> {t('qrPrint')}
            </button>
            <button onClick={onClose} className="btn-secondary text-sm py-2.5 flex items-center gap-1.5">
              <X className="w-4 h-4" /> {t('cancel')}
            </button>
          </div>
        </div>

        <div className="print-area">
          <div className="text-center mb-6 qr-print-header">
            <h1 className="font-display font-bold text-2xl text-espresso-700">13e Cafe</h1>
            <p className="text-sm text-espresso-400">{t('qrPrintSubtitle')}</p>
          </div>
          <div className="grid grid-cols-2 gap-4 qr-print-grid">
            {rooms.map((room, i) => (
              <div key={room.id} className="flex flex-col items-center border border-espresso-200 rounded-xl p-3 qr-print-card">
                <canvas ref={el => { canvasRefs.current[i] = el; }} />
                <p className="font-display font-bold text-espresso-600 mt-2">{room.display_name}</p>
                <p className="text-xs text-espresso-400">{t('scanToPay')}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
