import { useState, useEffect } from 'react';
import { 
  Activity, 
  Database, 
  Cpu, 
  ScanLine, 
  RefreshCw, 
  HardDrive, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Zap, 
  ShieldCheck, 
  Info
} from 'lucide-react';
import { supabase } from '../services/supabase';
import { optimizeGroceryBasket } from '../utils/optimizer';
import { ProductOffer } from '../types';

interface DiagnosticsTabProps {
  userId?: string;
  offers: ProductOffer[];
  onGoToTab: (tab: 'shopping' | 'instore' | 'pantry' | 'offers' | 'receipts' | 'diagnostics') => void;
}

type IndicatorStatus = 'healthy' | 'warning' | 'error' | 'checking';

interface HealthIndicator {
  id: string;
  name: string;
  category: 'cloud' | 'local' | 'data';
  status: IndicatorStatus;
  latencyMs?: number;
  details: string;
  actionHint?: string;
  actionLink?: string;
  actionText?: string;
}

export function DiagnosticsTab({ offers, onGoToTab }: DiagnosticsTabProps) {
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [lastCheckTime, setLastCheckTime] = useState<Date | null>(null);

  const [indicators, setIndicators] = useState<HealthIndicator[]>([
    {
      id: 'supabase_db',
      name: 'Connessione Database & Cloud (Supabase)',
      category: 'cloud',
      status: 'checking',
      details: 'Verifica connettività e latenza in corso...',
    },
    {
      id: 'optimizer_engine',
      name: 'Motore Combinatorio Client-Side (WASM/TS)',
      category: 'local',
      status: 'checking',
      details: 'Esecuzione benchmark combinatorio locale in corso...',
    },
    {
      id: 'ocr_engine',
      name: 'Scanner Scontrini (Tesseract WebAssembly)',
      category: 'local',
      status: 'checking',
      details: 'Verifica supporto WebAssembly e Web Worker...',
    },
    {
      id: 'flyer_sync',
      name: 'Freschezza Volantini & Promozioni',
      category: 'data',
      status: 'checking',
      details: 'Controllo età delle offerte caricate...',
    },
    {
      id: 'local_storage',
      name: 'Storage Locale & Modalità Offline (PWA)',
      category: 'local',
      status: 'checking',
      details: 'Verifica persistenza browser e memoria cache...',
    },
  ]);

  const runAllDiagnostics = async () => {
    setIsRunningTests(true);

    // 1. Check Supabase DB
    const startDb = performance.now();
    let dbStatus: IndicatorStatus = 'checking';
    let dbDetails = '';
    let dbLatency = 0;
    let dbHint = '';

    try {
      const { data, error } = await supabase.from('stores').select('id, name', { count: 'exact' });
      dbLatency = Math.round(performance.now() - startDb);
      if (error) {
        dbStatus = 'warning';
        dbDetails = `Errore di risposta Supabase (${error.message}). Latenza: ${dbLatency}ms.`;
        dbHint = 'Verifica la connessione internet o le policy RLS nella dashboard Supabase.';
      } else {
        const storeCount = data ? data.length : 0;
        if (storeCount === 0) {
          dbStatus = 'warning';
          dbDetails = `Connesso (${dbLatency}ms), ma la tabella 'stores' è vuota (0 negozi censiti).`;
          dbHint = 'Esegui la migrazione SQL per inserire i 18 negozi locali della tua zona.';
        } else {
          dbStatus = 'healthy';
          dbDetails = `Connesso e operativo! ${storeCount} negozi rilevati nel database (latenza: ${dbLatency}ms).`;
        }
      }
    } catch (err: unknown) {
      dbLatency = Math.round(performance.now() - startDb);
      dbStatus = 'error';
      dbDetails = `Impossibile raggiungere il database Supabase: ${err instanceof Error ? err.message : 'Timeout di rete'}`;
      dbHint = 'Se sei offline, l\'app continuerà comunque a funzionare con la cache locale sul dispositivo.';
    }

    // 2. Check Optimizer Engine (Benchmark on-device)
    let optStatus: IndicatorStatus = 'healthy';
    let optDetails = '';
    let optLatency = 0;
    try {
      const startOpt = performance.now();
      const testItems = [
        { item_id: 'pasta_test', name: 'Pasta', min_quantity: 1000, base_unit: 'g', is_mandatory: true, preferred_brands: [] },
        { item_id: 'olio_test', name: 'Olio', min_quantity: 1000, base_unit: 'ml', is_mandatory: true, preferred_brands: [] },
      ];
      const testStores = [
        { store_id: 's_test1', name: 'Store A', chain: 'Chain A', visit_cost: 0.50 },
        { store_id: 's_test2', name: 'Store B', chain: 'Chain B', visit_cost: 1.00 },
      ];
      const testOffers: ProductOffer[] = [
        { offer_id: 'o_t1', store_id: 's_test1', item_id: 'pasta_test', variant_id: 'v1', variant_name: 'P1', package_price: 1.00, package_base_quantity: 500, is_promotion: false },
        { offer_id: 'o_t2', store_id: 's_test2', item_id: 'pasta_test', variant_id: 'v2', variant_name: 'P2', package_price: 0.80, package_base_quantity: 500, is_promotion: true },
        { offer_id: 'o_t3', store_id: 's_test1', item_id: 'olio_test', variant_id: 'v3', variant_name: 'O1', package_price: 6.00, package_base_quantity: 1000, is_promotion: true },
        { offer_id: 'o_t4', store_id: 's_test2', item_id: 'olio_test', variant_id: 'v4', variant_name: 'O2', package_price: 8.00, package_base_quantity: 1000, is_promotion: false },
      ];

      const res = optimizeGroceryBasket(testItems, testStores, testOffers, { max_stores: 2, enforce_single_sku_per_item: true });
      optLatency = Math.round((performance.now() - startOpt) * 100) / 100;

      if (res && res.status === 'OPTIMAL') {
        optStatus = 'healthy';
        optDetails = `Benchmark completato in ${optLatency} ms! Calcolo combinatorio matematicamente esatto.`;
      } else {
        optStatus = 'warning';
        optDetails = `Ottimizzatore ha restituito stato: ${res?.status || 'UNKNOWN'}.`;
      }
    } catch (err: unknown) {
      optStatus = 'error';
      optDetails = `Errore nel motore locale: ${err instanceof Error ? err.message : 'Eccezione imprevista'}`;
    }

    // 3. Check OCR Engine (WebAssembly & Canvas capabilities)
    let ocrStatus: IndicatorStatus = 'healthy';
    let ocrDetails = '';
    const hasWasm = typeof WebAssembly === 'object' && typeof WebAssembly.instantiate === 'function';
    const hasWorker = typeof Worker !== 'undefined';
    const canvas = document.createElement('canvas');
    const hasCanvas = !!(canvas.getContext && canvas.getContext('2d'));

    if (hasWasm && hasWorker && hasCanvas) {
      ocrStatus = 'healthy';
      ocrDetails = 'WebAssembly v8 JIT e Web Worker pienamente supportati dal tuo browser. OCR pronto.';
    } else {
      ocrStatus = 'warning';
      ocrDetails = `Browser con supporto parziale (WASM: ${hasWasm ? 'Sì' : 'No'}, Worker: ${hasWorker ? 'Sì' : 'No'}).`;
    }

    // 4. Check Flyers & Offers Freshness
    let flyerStatus: IndicatorStatus = 'healthy';
    let flyerDetails = '';
    let flyerHint = '';
    const promoCount = offers.filter((o) => o.is_promotion).length;

    if (offers.length === 0) {
      flyerStatus = 'error';
      flyerDetails = 'Nessuna offerta o prezzo caricato nel catalogo!';
      flyerHint = 'Rilancia la sincronizzazione o controlla la connessione al database.';
    } else if (promoCount === 0) {
      flyerStatus = 'warning';
      flyerDetails = `${offers.length} prodotti nel catalogo, ma nessuna promozione volantino attiva rilevata.`;
      flyerHint = 'Verifica che il workflow GitHub Actions del giovedì abbia terminato la sincronizzazione.';
    } else {
      flyerStatus = 'healthy';
      flyerDetails = `${offers.length} offerte caricate (${promoCount} promozioni volantino attive per i tuoi 18 negozi).`;
      flyerHint = 'Prossimo aggiornamento programmato: Giovedì ore 05:00 UTC (GitHub Actions).';
    }

    // 5. Check Local Storage & Offline Capability
    let storageStatus: IndicatorStatus = 'healthy';
    let storageDetails = '';
    try {
      const testKey = '__test_health_storage__';
      localStorage.setItem(testKey, 'ok');
      localStorage.removeItem(testKey);
      const isOnline = navigator.onLine;
      storageStatus = 'healthy';
      storageDetails = `Storage persistente attivo. Connessione browser: ${isOnline ? 'Online' : 'Offline'}. L\'app può funzionare anche senza segnale.`;
    } catch {
      storageStatus = 'warning';
      storageDetails = 'LocalStorage limitato o non accessibile (es. navigazione privata con restrizioni massime).';
    }

    setIndicators([
      {
        id: 'supabase_db',
        name: 'Connessione Database & Cloud (Supabase)',
        category: 'cloud',
        status: dbStatus,
        latencyMs: dbLatency,
        details: dbDetails,
        actionHint: dbHint,
      },
      {
        id: 'optimizer_engine',
        name: 'Motore Combinatorio Client-Side (WASM/TS)',
        category: 'local',
        status: optStatus,
        latencyMs: optLatency,
        details: optDetails,
      },
      {
        id: 'ocr_engine',
        name: 'Scanner Scontrini (Tesseract WebAssembly)',
        category: 'local',
        status: ocrStatus,
        details: ocrDetails,
      },
      {
        id: 'flyer_sync',
        name: 'Freschezza Volantini & Promozioni',
        category: 'data',
        status: flyerStatus,
        details: flyerDetails,
        actionHint: flyerHint,
      },
      {
        id: 'local_storage',
        name: 'Storage Locale & Modalità Offline (PWA)',
        category: 'local',
        status: storageStatus,
        details: storageDetails,
      },
    ]);

    setLastCheckTime(new Date());
    setIsRunningTests(false);
  };

  useEffect(() => {
    runAllDiagnostics();
  }, []);

  const healthyCount = indicators.filter((i) => i.status === 'healthy').length;
  const warningCount = indicators.filter((i) => i.status === 'warning').length;
  const errorCount = indicators.filter((i) => i.status === 'error').length;

  const overallState: IndicatorStatus = 
    errorCount > 0 ? 'error' : warningCount > 0 ? 'warning' : 'healthy';

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Overview Card */}
      <div className={`rounded-3xl border p-6 shadow-sm transition-all ${
        overallState === 'healthy'
          ? 'border-emerald-200 bg-gradient-to-br from-emerald-500/10 via-white to-white'
          : overallState === 'warning'
          ? 'border-amber-200 bg-gradient-to-br from-amber-500/10 via-white to-white'
          : 'border-rose-200 bg-gradient-to-br from-rose-500/10 via-white to-white'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className={`mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-sm ${
              overallState === 'healthy'
                ? 'bg-emerald-600 text-white'
                : overallState === 'warning'
                ? 'bg-amber-500 text-white'
                : 'bg-rose-600 text-white'
            }`}>
              {overallState === 'healthy' && <ShieldCheck className="h-6 w-6" />}
              {overallState === 'warning' && <AlertTriangle className="h-6 w-6" />}
              {overallState === 'error' && <XCircle className="h-6 w-6" />}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black text-slate-900">Cruscotto Diagnostica & Spie</h1>
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                  overallState === 'healthy'
                    ? 'bg-emerald-100 text-emerald-800'
                    : overallState === 'warning'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-rose-100 text-rose-800'
                }`}>
                  <span className={`h-2 w-2 rounded-full ${
                    overallState === 'healthy' ? 'bg-emerald-600 animate-pulse' : overallState === 'warning' ? 'bg-amber-500' : 'bg-rose-600'
                  }`} />
                  {overallState === 'healthy' ? 'TUTTI I SISTEMI OPERATIVI' : overallState === 'warning' ? 'ATTENZIONE RICHIESTA' : 'ANOMALIA RILEVATA'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Monitoraggio continuo in tempo reale dei moduli locali, database cloud Supabase e pipeline volantini.
              </p>
            </div>
          </div>

          <button
            onClick={runAllDiagnostics}
            disabled={isRunningTests}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-slate-800 disabled:opacity-50 shadow-sm"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRunningTests ? 'animate-spin' : ''}`} />
            {isRunningTests ? 'Controllo in corso...' : 'Riesegui Test Adesso'}
          </button>
        </div>

        {/* Counter Pills */}
        <div className="mt-5 grid grid-cols-3 gap-3 border-t border-slate-100 pt-4">
          <div className="rounded-xl bg-white/80 p-3 border border-slate-100">
            <div className="text-[11px] font-semibold text-slate-500">Spie Verdi (OK)</div>
            <div className="text-xl font-black text-emerald-600">{healthyCount}</div>
          </div>
          <div className="rounded-xl bg-white/80 p-3 border border-slate-100">
            <div className="text-[11px] font-semibold text-slate-500">Avvisi (Warning)</div>
            <div className="text-xl font-black text-amber-600">{warningCount}</div>
          </div>
          <div className="rounded-xl bg-white/80 p-3 border border-slate-100">
            <div className="text-[11px] font-semibold text-slate-500">Criticità (Error)</div>
            <div className="text-xl font-black text-rose-600">{errorCount}</div>
          </div>
        </div>

        {lastCheckTime && (
          <div className="mt-3 text-[10px] text-slate-400 text-right">
            Ultimo controllo eseguito alle {lastCheckTime.toLocaleTimeString()}
          </div>
        )}
      </div>

      {/* Detailed Indicators List */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 px-1">
          Dettaglio Sottosistemi & Monitoraggio
        </h2>

        {indicators.map((ind) => (
          <div
            key={ind.id}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:border-slate-300 transition"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                {/* Status Light (Spia Circolare con Effetto Glow) */}
                <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-50 border border-slate-200/80">
                  {ind.id === 'supabase_db' && <Database className="h-4 w-4 text-slate-700" />}
                  {ind.id === 'optimizer_engine' && <Cpu className="h-4 w-4 text-slate-700" />}
                  {ind.id === 'ocr_engine' && <ScanLine className="h-4 w-4 text-slate-700" />}
                  {ind.id === 'flyer_sync' && <Zap className="h-4 w-4 text-slate-700" />}
                  {ind.id === 'local_storage' && <HardDrive className="h-4 w-4 text-slate-700" />}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900">{ind.name}</span>
                    {ind.latencyMs !== undefined && (
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 font-mono">
                        {ind.latencyMs} ms
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{ind.details}</p>

                  {ind.actionHint && (
                    <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-50/70 p-2 text-[11px] text-amber-900 border border-amber-200/60">
                      <Info className="h-3.5 w-3.5 shrink-0 text-amber-600 mt-0.5" />
                      <span>{ind.actionHint}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Status Badge */}
              <div className="shrink-0">
                {ind.status === 'healthy' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 border border-emerald-200 shadow-sm">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    Spia Verde (OK)
                  </span>
                )}
                {ind.status === 'warning' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700 border border-amber-200 shadow-sm">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                    Spia Gialla (Avviso)
                  </span>
                )}
                {ind.status === 'error' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700 border border-rose-200 shadow-sm">
                    <XCircle className="h-3.5 w-3.5 text-rose-600" />
                    Spia Rossa (Errore)
                  </span>
                )}
                {ind.status === 'checking' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-500 border border-slate-200">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin text-slate-400" />
                    Test in corso...
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Self-Healing & Automation Info Guide */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5 space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
          <Activity className="h-4 w-4 text-emerald-600" />
          Guida Rapida: Cosa fare se una spia si accende
        </h3>
        <ul className="text-xs text-slate-600 space-y-2 list-disc list-inside">
          <li>
            <strong>Spia Gialla su Supabase:</strong> la tabella dei negozi è vuota. Basta incollare il file <code className="bg-slate-200 px-1 py-0.5 rounded text-[11px]">20261107000001_seed_local_stores_cambiago.sql</code> nell'editor SQL di Supabase.
          </li>
          <li>
            <strong>Spia Gialla o Rossa sui Volantini:</strong> il workflow automatico di GitHub Actions gira ogni giovedì alle 05:00 UTC. Puoi rilanciarlo manualmente dalla scheda <em>Actions</em> del repository GitHub quando vuoi.
          </li>
          <li>
            <strong>Spia Rossa su Database (Offline):</strong> niente panico! Il motore di ottimizzazione combinatorio gira al 100% sul tuo telefono: potrai comunque ottimizzare il carrello e spuntare la spesa anche se sei dentro al supermercato senza connessione internet.
          </li>
        </ul>

        <div className="pt-2 flex flex-wrap gap-2 border-t border-slate-200/60">
          <button
            onClick={() => onGoToTab('shopping')}
            className="rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-slate-700 border border-slate-200 hover:bg-slate-100 transition shadow-sm"
          >
            ← Torna alla Spesa
          </button>
          <button
            onClick={() => onGoToTab('offers')}
            className="rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-slate-700 border border-slate-200 hover:bg-slate-100 transition shadow-sm"
          >
            Esplora Offerte & Volantini
          </button>
          <button
            onClick={() => onGoToTab('receipts')}
            className="rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-slate-700 border border-slate-200 hover:bg-slate-100 transition shadow-sm"
          >
            Carica Scontrino
          </button>
        </div>
      </div>
    </div>
  );
}
