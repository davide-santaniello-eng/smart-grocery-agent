import { useState } from 'react';
import { Camera, Upload, CheckCircle2, Receipt as ReceiptIcon } from 'lucide-react';

interface ReceiptLine {
  id: string;
  name: string;
  quantity: number;
  price: number;
}

const SAMPLE_EXTRACTED_LINES: ReceiptLine[] = [
  { id: '1', name: 'PASTA BARILLA SPAGH. 500G', quantity: 2, price: 2.58 },
  { id: '2', name: 'LATTE UHT MILBONA 1L', quantity: 2, price: 1.98 },
  { id: '3', name: 'CAFFE BELLAROM CLASS. 250G', quantity: 2, price: 4.38 },
  { id: '4', name: 'PASSATA MUTTI 700G', quantity: 1, price: 1.29 },
];

export function ReceiptsTab() {
  const [storeName, setStoreName] = useState('Lidl');
  const [receiptDate, setReceiptDate] = useState('2026-11-05');
  const [lines] = useState<ReceiptLine[]>(SAMPLE_EXTRACTED_LINES);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const total = lines.reduce((sum, item) => sum + item.price, 0);

  const handleSaveReceipt = () => {
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
    }, 3500);
  };

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      {/* Upload receipt card */}
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center shadow-sm">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
          <Camera className="h-7 w-7" />
        </div>
        <h3 className="text-base font-bold text-slate-900">Scansiona o Carica Scontrino</h3>
        <p className="mt-1 text-xs text-slate-500 mb-4 max-w-md mx-auto">
          Scatta una foto allo scontrino cartaceo del supermercato: il Vision AI estrarrà i singoli prodotti, prezzi e sconti caricandoli direttamente in dispensa.
        </p>
        <div className="flex justify-center gap-3">
          <label className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-700 cursor-pointer shadow-sm">
            <Camera className="h-4 w-4" />
            Fotocamera
            <input type="file" accept="image/*" capture="environment" className="hidden" />
          </label>
          <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 cursor-pointer">
            <Upload className="h-4 w-4" />
            Carica Immagine
            <input type="file" accept="image/*" className="hidden" />
          </label>
        </div>
      </div>

      {/* Extracted Receipt Preview */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 text-slate-900 font-bold">
            <ReceiptIcon className="h-5 w-5 text-emerald-600" />
            <span>Anteprima Scontrino Digitalizzato</span>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="h-3 w-3" />
            Verifica Contabile OK
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <label className="text-slate-400 font-medium">Supermercato</label>
            <input
              type="text"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-xs font-semibold text-slate-900"
            />
          </div>
          <div>
            <label className="text-slate-400 font-medium">Data Spesa</label>
            <input
              type="date"
              value={receiptDate}
              onChange={(e) => setReceiptDate(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-xs font-semibold text-slate-900"
            />
          </div>
        </div>

        {/* Lines */}
        <div className="divide-y divide-slate-100">
          {lines.map((item) => (
            <div key={item.id} className="flex items-center justify-between py-2.5 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-800">{item.quantity}x</span>
                <span className="font-medium text-slate-700">{item.name}</span>
              </div>
              <span className="font-mono font-bold text-slate-900">€{item.price.toFixed(2)}</span>
            </div>
          ))}
        </div>

        {/* Total and confirm */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-200">
          <div>
            <div className="text-[11px] uppercase font-bold text-slate-400">Totale Scontrino</div>
            <div className="text-xl font-black text-slate-900">€{total.toFixed(2)}</div>
          </div>

          <button
            onClick={handleSaveReceipt}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-700 shadow-sm"
          >
            <CheckCircle2 className="h-4 w-4" />
            Salva Scontrino & Carica Stock
          </button>
        </div>

        {savedSuccess && (
          <div className="rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800 border border-emerald-200 font-semibold animate-in fade-in">
            ✅ Scontrino registrato con successo! I prodotti sono stati aggiunti alla tua dispensa e i prezzi sono stati memorizzati nello storico.
          </div>
        )}
      </div>
    </div>
  );
}
