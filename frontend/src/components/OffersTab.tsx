import { useState, useEffect, useCallback } from 'react';
import { Search, Tag, Plus, Check, RefreshCw, Sparkles, Building2 } from 'lucide-react';
import { ItemRequirement, ProductOffer } from '../types';
import { fetchLatestOffers, SupabaseOfferRecord } from '../services/supabase';

interface Props {
  offers: ProductOffer[];
  onAddOfferToList: (item: ItemRequirement) => void;
}

export function OffersTab({ offers: fallbackOffers, onAddOfferToList }: Props) {
  const [offers, setOffers] = useState<ProductOffer[]>(fallbackOffers);
  const [search, setSearch] = useState('');
  const [selectedChain, setSelectedChain] = useState<string>('all');
  const [addedIds, setAddedIds] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [isLiveFromDb, setIsLiveFromDb] = useState<boolean>(false);

  const loadOffers = useCallback(async () => {
    setLoading(true);
    try {
      const liveData: SupabaseOfferRecord[] = await fetchLatestOffers();
      if (liveData && liveData.length > 0) {
        const mapped: ProductOffer[] = liveData.map((o) => ({
          offer_id: o.offer_id,
          store_id: 's_' + o.store_chain.toLowerCase(),
          item_id: o.product_id,
          variant_id: o.variant_id,
          variant_name: o.variant_name,
          brand: o.brand || o.variant_brand,
          package_price: Number(o.price),
          package_base_quantity: Number(o.base_quantity),
          is_promotion: o.is_promotion,
          promo_description: o.promo_description,
        }));
        setOffers(mapped);
        setIsLiveFromDb(true);
      } else {
        setOffers(fallbackOffers);
      }
    } catch (err) {
      console.warn('Could not load live offers from Supabase:', err);
      setOffers(fallbackOffers);
    } finally {
      setLoading(false);
    }
  }, [fallbackOffers]);

  useEffect(() => {
    loadOffers();
  }, [loadOffers]);

  const filteredOffers = offers.filter((o) => {
    const matchesSearch =
      o.variant_name.toLowerCase().includes(search.toLowerCase()) ||
      (o.brand && o.brand.toLowerCase().includes(search.toLowerCase()));
    if (!matchesSearch) return false;

    if (selectedChain !== 'all') {
      if (!o.store_id.toLowerCase().includes(selectedChain.toLowerCase())) return false;
    }
    return true;
  });

  const handleAdd = (o: ProductOffer) => {
    onAddOfferToList({
      item_id: o.item_id,
      name: o.variant_name,
      min_quantity: o.package_base_quantity,
      base_unit: o.package_base_quantity >= 100 ? 'g' : 'unit',
      is_mandatory: true,
      preferred_brands: o.brand ? [o.brand] : [],
    });
    setAddedIds((prev) => ({ ...prev, [o.offer_id]: true }));
    setTimeout(() => {
      setAddedIds((prev) => ({ ...prev, [o.offer_id]: false }));
    }, 2000);
  };

  const promoCount = offers.filter((o) => o.is_promotion).length;

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      {/* Banner Summary */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900">Volantini & Prezzi Supermercati</h2>
            {isLiveFromDb && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                <Sparkles className="h-3 w-3" />
                Live DB
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {offers.length} prezzi tracciati ({promoCount} offerte volantino attive) tra Esselunga, Coop, Conad, Lidl e Carrefour.
          </p>
        </div>
        <button
          onClick={() => loadOffers()}
          disabled={loading}
          className="self-start sm:self-auto inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition shadow-sm"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Aggiorna Prezzi
        </button>
      </div>

      {/* Search and filters */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Cerca prodotti in volantino (es. Barilla, Olio Monini, Lavazza, Granarolo)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-200 pl-10 pr-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
          />
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs">
          <button
            onClick={() => setSelectedChain('all')}
            className={`rounded-xl px-3 py-1.5 font-bold transition whitespace-nowrap ${
              selectedChain === 'all'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            Tutti i Supermercati ({offers.length})
          </button>
          <button
            onClick={() => setSelectedChain('esselunga')}
            className={`rounded-xl px-3 py-1.5 font-bold transition whitespace-nowrap ${
              selectedChain === 'esselunga'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            Esselunga
          </button>
          <button
            onClick={() => setSelectedChain('coop')}
            className={`rounded-xl px-3 py-1.5 font-bold transition whitespace-nowrap ${
              selectedChain === 'coop'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            Coop
          </button>
          <button
            onClick={() => setSelectedChain('conad')}
            className={`rounded-xl px-3 py-1.5 font-bold transition whitespace-nowrap ${
              selectedChain === 'conad'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            Conad
          </button>
          <button
            onClick={() => setSelectedChain('lidl')}
            className={`rounded-xl px-3 py-1.5 font-bold transition whitespace-nowrap ${
              selectedChain === 'lidl'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            Lidl
          </button>
          <button
            onClick={() => setSelectedChain('carrefour')}
            className={`rounded-xl px-3 py-1.5 font-bold transition whitespace-nowrap ${
              selectedChain === 'carrefour'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            Carrefour
          </button>
        </div>
      </div>

      {/* Offers Results Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {filteredOffers.map((o) => {
          const storeName = o.store_id.replace('s_', '').toUpperCase();
          const unitPriceKgOrL =
            o.package_base_quantity > 0
              ? (o.package_price / (o.package_base_quantity / 1000.0)).toFixed(2)
              : null;
          const isAdded = !!addedIds[o.offer_id];

          return (
            <div
              key={o.offer_id}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:border-emerald-300 transition flex flex-col justify-between space-y-3"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700 tracking-wider">
                    <Building2 className="h-3 w-3 text-slate-500" />
                    {storeName}
                  </span>
                  {o.is_promotion && (
                    <span className="inline-flex items-center gap-1 rounded bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
                      <Tag className="h-3 w-3" />
                      {o.promo_description || 'OFFERTA VOLANTINO'}
                    </span>
                  )}
                </div>

                <h3 className="text-sm font-bold text-slate-900 leading-snug">{o.variant_name}</h3>
                {o.brand && <div className="text-xs text-slate-400">Marca: {o.brand}</div>}
              </div>

              <div className="flex items-end justify-between pt-2 border-t border-slate-100">
                <div>
                  <div className="text-lg font-black text-slate-900 leading-tight">€{o.package_price.toFixed(2)}</div>
                  {unitPriceKgOrL && (
                    <div className="text-[11px] text-slate-400">€{unitPriceKgOrL}/kg o L</div>
                  )}
                </div>

                <button
                  onClick={() => handleAdd(o)}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition shadow-sm ${
                    isAdded
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-900 text-white hover:bg-slate-800'
                  }`}
                >
                  {isAdded ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      In Lista!
                    </>
                  ) : (
                    <>
                      <Plus className="h-3.5 w-3.5" />
                      Metti in Spesa
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
