import React, { useState } from 'react';
import { 
  Camera, 
  Upload, 
  CheckCircle2, 
  Receipt as ReceiptIcon, 
  AlertTriangle, 
  Trash2, 
  Plus, 
  Loader2, 
  Sparkles,
  FileText
} from 'lucide-react';
import { createWorker } from 'tesseract.js';
import { ProductRecord, recordReceiptPurchase } from '../services/supabase';
import { 
  preprocessReceiptImage, 
  parseReceiptText, 
  ParsedReceipt, 
  ParsedReceiptItem 
} from '../utils/receiptParser';

interface Props {
  userId?: string;
  catalogProducts?: ProductRecord[];
  onReceiptProcessed?: () => void;
}

const SAMPLE_ESSELUNGA_TEXT = `
ESSELUNGA S.P.A.
VIA WASHINGTON 64 - MILANO
P.IVA 01275720152
DATA 06/11/2026 ORA 12:45

2 X 1,29
SPAGHETTI BARILLA N5        2,58
PREZZI CORTI               -0,30
LATTE PARZ. UHT GRANAROLO   1,59
CAFFE LAVAZZA ROSSA 250G    2,89
PASSATA MUTTI 700G          1,29
OLIO EVO MONINI 1L         10,90
SCONTO FIDATY              -4,40

TOTALE EURO                14,55
PAGAMENTO CARTA            14,55
`;

export function ReceiptsTab({ userId, catalogProducts = [], onReceiptProcessed }: Props) {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [ocrProgress, setOcrProgress] = useState<number>(0);
  const [progressStatus, setProgressStatus] = useState<string>('');
  const [receipt, setReceipt] = useState<ParsedReceipt | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  // File selection handler
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsProcessing(true);
      setSavedSuccess(false);
      setProgressStatus('Ottimizzazione contrasto scontrino...');
      setOcrProgress(10);

      // 1. Canvas preprocessing
      const processedImageUrl = await preprocessReceiptImage(file);
      setImagePreview(processedImageUrl);

      // 2. Tesseract client-side OCR
      setProgressStatus('Inizializzazione motore OCR Tesseract (Wasm)...');
      setOcrProgress(25);

      const worker = await createWorker('ita');
      setProgressStatus('Riconoscimento caratteri sulla ricevuta...');

      // Recognize text with progress tracking
      const ret = await worker.recognize(processedImageUrl);
      setOcrProgress(85);
      setProgressStatus('Analisi semantica righe, sconti e totali...');

      await worker.terminate();

      // 3. Deterministic state-machine parser
      const parsed = parseReceiptText(ret.data.text, catalogProducts);
      setReceipt(parsed);
      setOcrProgress(100);
    } catch (err) {
      console.error('OCR processing error:', err);
      alert('Si è verificato un errore durante la lettura dello scontrino. Prova con una foto più nitida o usa il testo di esempio.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Test sample button
  const handleLoadSample = () => {
    setIsProcessing(true);
    setProgressStatus('Analisi scontrino di esempio...');
    setOcrProgress(50);
    setTimeout(() => {
      const parsed = parseReceiptText(SAMPLE_ESSELUNGA_TEXT, catalogProducts);
      setReceipt(parsed);
      setImagePreview(null);
      setIsProcessing(false);
      setOcrProgress(100);
    }, 400);
  };

  // Edit fields
  const handleUpdateStore = (name: string) => {
    if (!receipt) return;
    setReceipt({ ...receipt, storeName: name });
  };

  const handleUpdateDate = (date: string) => {
    if (!receipt) return;
    setReceipt({ ...receipt, date });
  };

  const handleUpdateItemPrice = (id: string, price: number) => {
    if (!receipt) return;
    const updated = receipt.items.map((i) => (i.id === id ? { ...i, price } : i));
    const newSum = updated.reduce((s, i) => s + i.price, 0);
    setReceipt({
      ...receipt,
      items: updated,
      calculatedSum: Math.round(newSum * 100) / 100,
    });
  };

  const handleRemoveItem = (id: string) => {
    if (!receipt) return;
    const updated = receipt.items.filter((i) => i.id !== id);
    const newSum = updated.reduce((s, i) => s + i.price, 0);
    setReceipt({
      ...receipt,
      items: updated,
      calculatedSum: Math.round(newSum * 100) / 100,
    });
  };

  const handleAddItem = () => {
    if (!receipt) return;
    const newItem: ParsedReceiptItem = {
      id: 'manual_' + Date.now(),
      rawName: 'Nuovo Prodotto',
      name: 'Nuovo Prodotto',
      quantity: 1,
      price: 1.0,
      baseUnit: 'unit',
      baseQuantity: 1,
    };
    const updated = [...receipt.items, newItem];
    const newSum = updated.reduce((s, i) => s + i.price, 0);
    setReceipt({
      ...receipt,
      items: updated,
      calculatedSum: Math.round(newSum * 100) / 100,
    });
  };

  // Save to Supabase and restock pantry
  const handleSaveToPantry = async () => {
    if (!receipt || !userId) return;
    setIsSaving(true);
    try {
      const success = await recordReceiptPurchase(userId, {
        storeName: receipt.storeName,
        date: receipt.date,
        total: receipt.total,
        items: receipt.items.map((i) => ({
          name: i.name,
          quantity: i.quantity,
          price: i.price,
          matchedProductId: i.matchedProductId,
          baseUnit: i.baseUnit,
          baseQuantity: i.baseQuantity,
        })),
      });

      if (success) {
        setSavedSuccess(true);
        if (onReceiptProcessed) {
          onReceiptProcessed();
        }
      }
    } catch (err) {
      console.error('Error saving receipt:', err);
    } finally {
      setIsSaving(false);
    }
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
          Scatta una foto allo scontrino cartaceo del supermercato: il parser locale OCR riconosce automaticamente prodotti, prezzi e sconti caricandoli direttamente in dispensa.
        </p>

        <div className="flex flex-wrap justify-center gap-3">
          <label className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-700 cursor-pointer shadow-sm">
            <Camera className="h-4 w-4" />
            Fotocamera
            <input 
              type="file" 
              accept="image/*" 
              capture="environment" 
              onChange={handleFileSelect} 
              className="hidden" 
              disabled={isProcessing}
            />
          </label>

          <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 cursor-pointer shadow-sm">
            <Upload className="h-4 w-4" />
            Carica Immagine
            <input 
              type="file" 
              accept="image/*" 
              onChange={handleFileSelect} 
              className="hidden" 
              disabled={isProcessing}
            />
          </label>

          <button
            type="button"
            onClick={handleLoadSample}
            disabled={isProcessing}
            className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-emerald-300 bg-emerald-50/60 px-3.5 py-2 text-xs font-bold text-emerald-800 transition hover:bg-emerald-100"
          >
            <FileText className="h-4 w-4" />
            Prova Scontrino Esempio
          </button>
        </div>

        {/* Uploaded Receipt Preview Thumbnail */}
        {imagePreview && (
          <div className="mt-4 flex items-center justify-center gap-3 rounded-xl bg-slate-50 p-2.5 border border-slate-200">
            <img 
              src={imagePreview} 
              alt="Anteprima Scontrino" 
              className="h-16 w-16 object-cover rounded-lg border border-slate-300 shadow-sm" 
            />
            <div className="text-left text-xs">
              <span className="font-bold text-slate-800">Foto scontrino caricata</span>
              <p className="text-[11px] text-slate-500">Contrasto e binarizzazione ottica applicati con successo.</p>
            </div>
          </div>
        )}

        {/* Processing Indicator */}
        {isProcessing && (
          <div className="mt-6 space-y-2 rounded-xl bg-slate-50 p-4 border border-slate-100 text-left">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
                {progressStatus}
              </span>
              <span className="font-mono text-emerald-700">{ocrProgress}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
              <div
                className="h-full bg-emerald-600 rounded-full transition-all duration-300"
                style={{ width: `${ocrProgress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Extracted Receipt Preview */}
      {receipt && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2 text-slate-900 font-bold">
              <ReceiptIcon className="h-5 w-5 text-emerald-600" />
              <span>Scontrino Digitalizzato ({receipt.items.length} articoli)</span>
            </div>
            {receipt.isValid ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="h-3 w-3" />
                Totale Verificato
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-700 border border-amber-200">
                <AlertTriangle className="h-3 w-3" />
                Revisiona Totale
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="text-slate-400 font-medium">Supermercato</label>
              <input
                type="text"
                value={receipt.storeName}
                onChange={(e) => handleUpdateStore(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-xs font-semibold text-slate-900 focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-slate-400 font-medium">Data Spesa</label>
              <input
                type="date"
                value={receipt.date}
                onChange={(e) => handleUpdateDate(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-xs font-semibold text-slate-900 focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Lines Table */}
          <div className="divide-y divide-slate-100">
            {receipt.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between py-2 text-xs gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="font-bold text-emerald-700 shrink-0">{item.quantity}x</span>
                  <div className="truncate">
                    <span className="font-semibold text-slate-800">{item.name}</span>
                    {item.matchedProductId && (
                      <span className="ml-1.5 inline-flex items-center gap-0.5 rounded bg-emerald-50 px-1.5 py-0.2 text-[9px] font-bold text-emerald-700 border border-emerald-200">
                        <Sparkles className="h-2.5 w-2.5" />
                        Catalogo
                      </span>
                    )}
                    {item.discount && (
                      <span className="ml-1.5 text-[10px] text-red-600 font-bold">
                        (Sconto -€{item.discount.toFixed(2)})
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex items-center font-mono font-bold text-slate-900">
                    €
                    <input
                      type="number"
                      step="0.01"
                      value={item.price}
                      onChange={(e) => handleUpdateItemPrice(item.id, parseFloat(e.target.value) || 0)}
                      className="w-16 rounded-lg border border-slate-200 px-1.5 py-0.5 text-right text-xs focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <button
                    onClick={() => handleRemoveItem(item.id)}
                    className="rounded p-1 text-slate-300 hover:text-red-500 transition"
                    title="Rimuovi riga"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-1">
            <button
              onClick={handleAddItem}
              className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-800 transition"
            >
              <Plus className="h-3.5 w-3.5" />
              Aggiungi articolo manualmente
            </button>
          </div>

          {/* Totals & Submit */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-200">
            <div>
              <div className="text-[11px] uppercase font-bold text-slate-400">Totale Calcolato</div>
              <div className="text-xl font-black text-slate-900">€{receipt.calculatedSum.toFixed(2)}</div>
              {receipt.total > 0 && Math.abs(receipt.calculatedSum - receipt.total) > 0.01 && (
                <div className="text-[10px] text-slate-400">Scontrino: €{receipt.total.toFixed(2)}</div>
              )}
            </div>

            <button
              onClick={handleSaveToPantry}
              disabled={isSaving || receipt.items.length === 0}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-700 shadow-sm disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" />
              {isSaving ? 'Salvataggio...' : 'Conferma & Carica in Dispensa'}
            </button>
          </div>

          {savedSuccess && (
            <div className="rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800 border border-emerald-200 font-semibold animate-in fade-in">
              ✅ Scontrino registrato con successo! I prodotti e le quantità acquistate sono stati caricati nella tua dispensa su Supabase.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
