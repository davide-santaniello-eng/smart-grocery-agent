import { useState } from 'react';
import { StoreAllocation, AllocatedItem } from '../types';
import { Check, ShoppingBag, Store as StoreIcon, CheckCircle2, ArrowRight } from 'lucide-react';

interface Props {
  selectedStores: StoreAllocation[];
  onCompleteShopping: (purchasedItems: AllocatedItem[]) => void;
  onGoToOptimizer: () => void;
}

export function InStoreModeTab({ selectedStores, onCompleteShopping, onGoToOptimizer }: Props) {
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [activeStoreIndex, setActiveStoreIndex] = useState<number>(0);

  if (!selectedStores || selectedStores.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center max-w-lg mx-auto my-8 shadow-sm">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
          <ShoppingBag className="h-7 w-7" />
        </div>
        <h3 className="text-base font-bold text-slate-900">Nessun piano spesa attivo</h3>
        <p className="mt-1 text-xs text-slate-500 mb-5">
          Prima di andare al supermercato, compila la lista ed esegui il calcolo con l'ottimizzatore OR-Tools per sapere dove conviene comprare ciascun articolo.
        </p>
        <button
          onClick={onGoToOptimizer}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-700 shadow-sm"
        >
          Vai alla Lista Spesa
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    );
  }

  const currentStore = selectedStores[activeStoreIndex] || selectedStores[0];
  const items = currentStore.items || [];

  const toggleCheck = (variantId: string) => {
    setCheckedItems((prev) => ({
      ...prev,
      [variantId]: !prev[variantId],
    }));
  };

  const totalInCart = items
    .filter((i) => checkedItems[i.variant_id])
    .reduce((sum, i) => sum + i.total_price, 0);

  const allItemsChecked = items.length > 0 && items.every((i) => checkedItems[i.variant_id]);

  const handleFinish = () => {
    const purchased = items.filter((i) => checkedItems[i.variant_id]);
    onCompleteShopping(purchased);
  };

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      {/* Store Switcher Tabs */}
      {selectedStores.length > 1 && (
        <div className="flex gap-2 border-b border-slate-200 pb-2">
          {selectedStores.map((s, idx) => (
            <button
              key={s.store_id}
              onClick={() => setActiveStoreIndex(idx)}
              className={`flex-1 rounded-xl py-2 px-3 text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                activeStoreIndex === idx
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <StoreIcon className="h-3.5 w-3.5" />
              <span className="truncate">{s.store_chain}</span>
            </button>
          ))}
        </div>
      )}

      {/* Current Store Header Card */}
      <div className="rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-white p-4 shadow-sm flex items-center justify-between">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Stai facendo la spesa da:</div>
          <h2 className="text-base font-black text-slate-900">{currentStore.store_name}</h2>
          <div className="text-xs text-slate-500 mt-0.5">
            Nel carrello: <span className="font-bold text-emerald-800">€{totalInCart.toFixed(2)}</span> / stimato €{currentStore.subtotal_products.toFixed(2)}
          </div>
        </div>
        <div className="text-right">
          <span className="inline-block rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-slate-800 border border-emerald-100 shadow-sm">
            {items.filter((i) => checkedItems[i.variant_id]).length} di {items.length} spuntati
          </span>
        </div>
      </div>

      {/* In-Store Interactive Checklist */}
      <div className="space-y-2.5">
        {items.map((item) => {
          const isChecked = !!checkedItems[item.variant_id];
          return (
            <div
              key={item.variant_id}
              onClick={() => toggleCheck(item.variant_id)}
              className={`flex items-center justify-between p-4 rounded-2xl border transition cursor-pointer select-none ${
                isChecked
                  ? 'border-emerald-200 bg-emerald-50/40 text-slate-400'
                  : 'border-slate-200 bg-white hover:border-emerald-300 shadow-sm'
              }`}
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border transition ${
                    isChecked
                      ? 'border-emerald-500 bg-emerald-500 text-white'
                      : 'border-slate-300 bg-slate-50 text-transparent'
                  }`}
                >
                  <Check className="h-5 w-5 stroke-[3]" />
                </div>
                <div className="truncate">
                  <div className={`text-sm font-bold truncate ${isChecked ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                    <span className="text-emerald-700 font-black">{item.package_quantity}x </span>
                    {item.variant_name}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {item.total_base_quantity} {item.base_quantity_per_pack ? 'g/ml' : ''} • Prezzo unitario: €{item.unit_price.toFixed(2)}
                    {item.is_promotion && (
                      <span className="ml-2 font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded text-[10px]">
                        OFFERTA
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-right shrink-0 pl-3">
                <div className={`text-sm font-mono font-bold ${isChecked ? 'text-slate-400' : 'text-slate-900'}`}>
                  €{item.total_price.toFixed(2)}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Complete Shopping Button */}
      <div className="pt-2">
        <button
          onClick={handleFinish}
          disabled={!allItemsChecked}
          className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3.5 text-sm font-bold text-white shadow-md shadow-emerald-600/20 transition hover:bg-emerald-700 disabled:opacity-50"
        >
          <CheckCircle2 className="h-5 w-5" />
          Concludi Spesa e Carica in Dispensa
        </button>
      </div>
    </div>
  );
}
