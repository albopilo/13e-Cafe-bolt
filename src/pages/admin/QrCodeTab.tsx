import { useState, useEffect, useCallback, useRef } from 'react';
import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/context/ToastContext';
import { useLang } from '@/context/LanguageContext';
import type { RoomTable } from '@/lib/types';
import { Plus, Trash2, Download, Printer, QrCode, Loader2, X, Pencil, FileText } from 'lucide-react';

const BASE_URL = 'https://13ecafe.netlify.app';

const COLORS = {
  espresso: '#3D2817',
  espressoDark: '#2A1810',
  cream: '#FFFDF8',
  creamLight: '#F5EFE6',
  gold: '#C8A96A',
  goldLight: '#D4B97D',
  white: '#FFFFFF',
};

async function generatePosterCanvas(
  room: RoomTable,
  texts: {
    cafeName: string;
    scanToOrder: string;
    roomLabel: string;
    instruction1: string;
    instruction2: string;
    instruction3: string;
    qrisOnly: string;
  },
  scale = 2,
): Promise<HTMLCanvasElement> {
  const W = 600 * scale;
  const H = 850 * scale;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);

  const w = 600;
  const h = 850;

  // Background
  ctx.fillStyle = COLORS.cream;
  ctx.fillRect(0, 0, w, h);

  // Top decorative band
  const gradTop = ctx.createLinearGradient(0, 0, w, 0);
  gradTop.addColorStop(0, COLORS.espresso);
  gradTop.addColorStop(0.5, COLORS.espressoDark);
  gradTop.addColorStop(1, COLORS.espresso);
  ctx.fillStyle = gradTop;
  ctx.fillRect(0, 0, w, 140);

  // Gold accent line under top band
  ctx.fillStyle = COLORS.gold;
  ctx.fillRect(0, 140, w, 4);

  // Cafe name
  ctx.fillStyle = COLORS.white;
  ctx.font = 'bold 42px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText(texts.cafeName, w / 2, 75);

  // Cafe subtitle line
  ctx.fillStyle = COLORS.goldLight;
  ctx.font = 'italic 16px Georgia, serif';
  ctx.fillText('Coffee & Comfort', w / 2, 105);

  // "Scan to Order" headline
  ctx.fillStyle = COLORS.espresso;
  ctx.font = 'bold 32px Georgia, serif';
  ctx.fillText(texts.scanToOrder, w / 2, 210);

  // Room label badge
  const badgeW = 220;
  const badgeH = 44;
  const badgeX = (w - badgeW) / 2;
  const badgeY = 235;
  ctx.fillStyle = COLORS.espresso;
  ctx.beginPath();
  const r = 10;
  ctx.moveTo(badgeX + r, badgeY);
  ctx.lineTo(badgeX + badgeW - r, badgeY);
  ctx.quadraticCurveTo(badgeX + badgeW, badgeY, badgeX + badgeW, badgeY + r);
  ctx.lineTo(badgeX + badgeW, badgeY + badgeH - r);
  ctx.quadraticCurveTo(badgeX + badgeW, badgeY + badgeH, badgeX + badgeW - r, badgeY + badgeH);
  ctx.lineTo(badgeX + r, badgeY + badgeH);
  ctx.quadraticCurveTo(badgeX, badgeY + badgeH, badgeX, badgeY + badgeH - r);
  ctx.lineTo(badgeX, badgeY + r);
  ctx.quadraticCurveTo(badgeX, badgeY, badgeX + r, badgeY);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = COLORS.goldLight;
  ctx.font = 'bold 20px Georgia, serif';
  ctx.fillText(`${texts.roomLabel}: ${room.display_name}`, w / 2, badgeY + 29);

  // QR code
  const qrSize = 300;
  const qrX = (w - qrSize) / 2;
  const qrY = 310;

  // QR code white background with border
  ctx.fillStyle = COLORS.white;
  ctx.fillRect(qrX - 16, qrY - 16, qrSize + 32, qrSize + 32);
  ctx.strokeStyle = COLORS.gold;
  ctx.lineWidth = 3;
  ctx.strokeRect(qrX - 16, qrY - 16, qrSize + 32, qrSize + 32);

  // Generate QR onto its own canvas, then draw onto poster
  const qrCanvas = document.createElement('canvas');
  await QRCode.toCanvas(qrCanvas, `${BASE_URL}/?table=${encodeURIComponent(room.name)}`, {
    width: qrSize,
    margin: 1,
    color: { dark: COLORS.espresso, light: COLORS.white },
  });
  ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);

  // Instructions section
  const instY = 660;
  ctx.fillStyle = COLORS.espresso;
  ctx.font = 'bold 18px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText(texts.instruction1, w / 2, instY);

  ctx.fillStyle = '#6B5544';
  ctx.font = '15px -apple-system, sans-serif';
  ctx.fillText(texts.instruction2, w / 2, instY + 28);
  ctx.fillText(texts.instruction3, w / 2, instY + 50);

  // Payment info badges
  const pillY = instY + 80;
  const pills: { text: string; bg: string; fg: string }[] = [];

  if (room.qris_only) {
    pills.push({ text: texts.qrisOnly, bg: '#E8D5B8', fg: COLORS.espresso });
  }

  let pillX = (w - pills.reduce((sum, p) => sum + ctxTextWidth(ctx, p.text, 'bold 13px -apple-system, sans-serif') + 28, 0)) / 2;
  ctx.font = 'bold 13px -apple-system, sans-serif';
  for (const pill of pills) {
    const pw = ctxTextWidth(ctx, pill.text, 'bold 13px -apple-system, sans-serif') + 28;
    const ph = 30;
    ctx.fillStyle = pill.bg;
    drawRoundedRect(ctx, pillX, pillY, pw, ph, 15);
    ctx.fill();
    ctx.fillStyle = pill.fg;
    ctx.fillText(pill.text, pillX + pw / 2, pillY + 20);
    pillX += pw + 10;
  }

  // Bottom band
  const gradBot = ctx.createLinearGradient(0, 0, w, 0);
  gradBot.addColorStop(0, COLORS.espresso);
  gradBot.addColorStop(0.5, COLORS.espressoDark);
  gradBot.addColorStop(1, COLORS.espresso);
  ctx.fillStyle = gradBot;
  ctx.fillRect(0, h - 60, w, 60);

  ctx.fillStyle = COLORS.goldLight;
  ctx.font = '13px Georgia, serif';
  ctx.fillText(`${BASE_URL}`, w / 2, h - 35);

  return canvas;
}

function ctxTextWidth(ctx: CanvasRenderingContext2D, text: string, font: string): number {
  ctx.font = font;
  return ctx.measureText(text).width;
}

function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export function QrCodeTab() {
  const { addToast } = useToast();
  const { t } = useLang();
  const [rooms, setRooms] = useState<RoomTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRoom, setEditingRoom] = useState<RoomTable | null>(null);
  const [printMode, setPrintMode] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  const handleDownloadPdf = async () => {
    if (rooms.length === 0) return;
    setPdfLoading(true);
    try {
      const posterTexts = {
        cafeName: '13e Cafe',
        scanToOrder: t('qrPosterScanToOrder'),
        roomLabel: t('qrPosterRoom'),
        instruction1: t('qrPosterInstruction1'),
        instruction2: t('qrPosterInstruction2'),
        instruction3: t('qrPosterInstruction3'),
        qrisOnly: t('qrisOnly'),
      };

      const posters: HTMLCanvasElement[] = [];
      for (const room of rooms) {
        posters.push(await generatePosterCanvas(room, posterTexts, 2));
      }

      // F4 paper in mm: 210 x 330
      const F4_W = 210;
      const F4_H = 330;
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [F4_W, F4_H] });

      const margin = 10;
      const availW = F4_W - margin * 2;
      const availH = F4_H - margin * 2;

      for (let i = 0; i < posters.length; i++) {
        const poster = posters[i];
        const imgData = poster.toDataURL('image/png');

        // Fit poster within available area, preserving aspect ratio
        const posterRatio = poster.width / poster.height;
        let drawW = availW;
        let drawH = drawW / posterRatio;
        if (drawH > availH) {
          drawH = availH;
          drawW = drawH * posterRatio;
        }
        const x = (F4_W - drawW) / 2;
        const y = (F4_H - drawH) / 2;

        if (i > 0) pdf.addPage([F4_W, F4_H], 'portrait');
        pdf.addImage(imgData, 'PNG', x, y, drawW, drawH);
      }

      pdf.save('qr-codes-all-rooms.pdf');
      addToast(t('qrSaved'), 'success');
    } catch {
      addToast(t('qrSaveFailed'), 'error');
    } finally {
      setPdfLoading(false);
    }
  };

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
        <button onClick={handleDownloadPdf} disabled={rooms.length === 0 || pdfLoading} className="btn-secondary text-sm py-2.5 flex items-center gap-1.5 disabled:opacity-50">
          {pdfLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
          {pdfLoading ? t('qrGeneratingPdf') : t('qrDownloadPdf')}
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
  const [downloading, setDownloading] = useState(false);
  const url = `${BASE_URL}/?table=${encodeURIComponent(room.name)}`;

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, url, {
      width: 200,
      margin: 2,
      color: { dark: COLORS.espresso, light: COLORS.cream },
    }, () => setQrReady(true));
  }, [url]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const poster = await generatePosterCanvas(room, {
        cafeName: '13e Cafe',
        scanToOrder: t('qrPosterScanToOrder'),
        roomLabel: t('qrPosterRoom'),
        instruction1: t('qrPosterInstruction1'),
        instruction2: t('qrPosterInstruction2'),
        instruction3: t('qrPosterInstruction3'),
        qrisOnly: t('qrisOnly'),
      });
      const link = document.createElement('a');
      link.download = `qr-${room.name.replace(/\s+/g, '-')}.png`;
      link.href = poster.toDataURL('image/png');
      link.click();
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="card p-4 flex flex-col items-center">
      <div className="flex items-center justify-between w-full mb-2">
        <div>
          <p className="font-display font-bold text-espresso-600">{room.display_name}</p>
          <p className="text-xs text-espresso-300 mt-0.5">
            {room.qris_only ? t('qrisOnly') : t('cash')}
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
        {!qrReady && <div className="w-[200px] h-[200px] flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-espresso-300" /></div>}
        <canvas ref={canvasRef} className={qrReady ? 'block' : 'hidden'} />
      </div>

      <p className="text-xs text-espresso-300 text-center mb-3 break-all">{url}</p>

      <button onClick={handleDownload} disabled={downloading} className="btn-secondary text-sm py-2 flex items-center gap-1.5 w-full justify-center disabled:opacity-50">
        {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
        {downloading ? t('qrSaving') : t('qrDownload')}
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
  const posterRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const [postersReady, setPostersReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (let i = 0; i < rooms.length; i++) {
        const canvas = posterRefs.current[i];
        if (!canvas) continue;
        const poster = await generatePosterCanvas(rooms[i], {
          cafeName: '13e Cafe',
          scanToOrder: t('qrPosterScanToOrder'),
          roomLabel: t('qrPosterRoom'),
          instruction1: t('qrPosterInstruction1'),
          instruction2: t('qrPosterInstruction2'),
          instruction3: t('qrPosterInstruction3'),
          qrisOnly: t('qrisOnly'),
        }, 1.5);
        if (cancelled) return;
        const ctx = canvas.getContext('2d')!;
        canvas.width = poster.width;
        canvas.height = poster.height;
        ctx.drawImage(poster, 0, 0);
      }
      if (!cancelled) setPostersReady(true);
    })();
    return () => { cancelled = true; };
  }, [rooms, t]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-espresso-900/50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-cream-100 rounded-2xl p-6 max-w-3xl w-full max-h-[85vh] overflow-y-auto animate-slide-up" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4 no-print">
          <h3 className="font-display font-bold text-espresso-600">{t('qrPrintPreview')}</h3>
          <div className="flex gap-2">
            <button onClick={handlePrint} disabled={!postersReady} className="btn-primary text-sm py-2.5 flex items-center gap-1.5 disabled:opacity-50">
              <Printer className="w-4 h-4" /> {t('qrPrint')}
            </button>
            <button onClick={onClose} className="btn-secondary text-sm py-2.5 flex items-center gap-1.5">
              <X className="w-4 h-4" /> {t('cancel')}
            </button>
          </div>
        </div>

        {!postersReady && (
          <div className="flex justify-center py-12 no-print">
            <Loader2 className="w-8 h-8 animate-spin text-espresso-300" />
          </div>
        )}

        <div className="print-area">
          <div className="grid grid-cols-2 gap-4 qr-print-grid">
            {rooms.map((room, i) => (
              <div key={room.id} className="flex flex-col items-center qr-print-card">
                <canvas
                  ref={el => { posterRefs.current[i] = el; }}
                  className={postersReady ? 'block w-full' : 'hidden'}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
