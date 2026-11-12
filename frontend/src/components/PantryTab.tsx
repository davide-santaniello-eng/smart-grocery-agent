import { useState, useEffect, useCallback } from 'react';
import { 
  Package, 
  AlertTriangle, 
  Plus, 
  Minus, 
  ShoppingCart, 
  RefreshCw,
  Star,
  Search,
  X,
  Info
} from 'lucide-react';
import { ItemRequirement } from '../types';
import { 
  fetchCurrentInventory, 
  recordInventoryEvent, 
  subscribeToInventory,
  ProductRecord 
} from '../services/supabase';

export interface PantryItem {
  id: string; // product_id
  name: string;
  category: string;
  currentStock: number;
  baseUnit: string;
  reorderThreshold: number;
  dailyAvgConsumption: number;
  daysRemaining: number;
  isEssential: boolean;
  preferredBrands: string[];
}

// Common grocery brands in Italian supermarkets for instant autocompletion
export const COMMON_RETAIL_BRANDS = [
  'Parmareggio', 'Gran Biraghi', 'Giovanni Ferrari', 'Galbani', 'Santa Lucia', 'Vallelata',
  'Barilla', 'De Cecco', 'Garofalo', 'Voiello', 'Rummo', 'La Molisana', 'Divella', 'Combino',
  'Monini', 'Carapelli', 'Filippo Berio', 'Bertolli', 'Sasso', 'Primadonna', 'Costa d\'Oro',
  'Granarolo', 'Parmalat', 'Zymil', 'Mukki', 'Centrale del Latte', 'Milbona',
  'Lavazza', 'Illy', 'Segafredo', 'Kimbo', 'Caffè Vergnano', 'Bellarom', 'Splendid',
  'Mutti', 'Cirio', 'Petti', 'Pomi', 'Star', 'De Rica',
  'Rio Mare', 'Nostromo', 'Mareblu', 'AsdoMar', 'Callipo', 'Nixe',
  'Mulino Bianco', 'Pavesi', 'Grisbì', 'Gentilini', 'Plasmon', 'Kinder', 'Nutella',
  'Conad', 'Coop', 'Carrefour', 'Il Gigante', 'Famila', 'MD', 'iN\'s', 'Selex', 'U! Confronta e Risparmia'
];

// Fallback initial items if user has no DB events yet
const DEFAULT_PANTRY_SEEDS: PantryItem[] = [
  { id: 'b1000000-0000-0000-0000-000000000001', name: 'Spaghetti di Semola', category: 'Pasta e Riso', currentStock: 1500, baseUnit: 'g', reorderThreshold: 1000, dailyAvgConsumption: 125, daysRemaining: 12, isEssential: true, preferredBrands: ['Barilla', 'De Cecco'] },
  { id: 'b1000000-0000-0000-0000-000000000007', name: 'Formaggio Grattugiato Fresco', category: 'Latticini e Formaggi', currentStock: 0, baseUnit: 'g', reorderThreshold: 200, dailyAvgConsumption: 20, daysRemaining: 0, isEssential: true, preferredBrands: ['Parmareggio', 'Gran Biraghi', 'Giovanni Ferrari'] },
  { id: 'b1000000-0000-0000-0000-000000000003', name: 'Latte Parzialmente Scremato UHT', category: 'Latticini', currentStock: 800, baseUnit: 'ml', reorderThreshold: 1500, dailyAvgConsumption: 250, daysRemaining: 3, isEssential: true, preferredBrands: ['Granarolo', 'Parmalat'] },
  { id: 'b1000000-0000-0000-0000-000000000002', name: 'Olio Extra Vergine di Oliva', category: 'Dispensa', currentStock: 350, baseUnit: 'ml', reorderThreshold: 500, dailyAvgConsumption: 30, daysRemaining: 11, isEssential: true, preferredBrands: ['Monini', 'Carapelli'] },
  { id: 'b1000000-0000-0000-0000-000000000004', name: 'Caffè Macinato per Moka', category: 'Colazione', currentStock: 120, baseUnit: 'g', reorderThreshold: 250, dailyAvgConsumption: 25, daysRemaining: 4, isEssential: true, preferredBrands: ['Lavazza', 'Illy'] },
  { id: 'b1000000-0000-0000-0000-000000000005', name: 'Uova Fresche Medie', category: 'Latticini e Uova', currentStock: 0, baseUnit: 'pz', reorderThreshold: 4, dailyAvgConsumption: 1, daysRemaining: 0, isEssential: true, preferredBrands: ['Le Naturelle', 'Ovito'] },
  { id: 'b1000000-0000-0000-0000-000000000008', name: 'Passata di Pomodoro', category: 'Dispensa', currentStock: 2100, baseUnit: 'g', reorderThreshold: 700, dailyAvgConsumption: 70, daysRemaining: 30, isEssential: false, preferredBrands: ['Mutti', 'Cirio'] },
  { id: 'b1000000-0000-0000-0000-000000000006', name: 'Parmigiano Reggiano DOP', category: 'Latticini', currentStock: 400, baseUnit: 'g', reorderThreshold: 200, dailyAvgConsumption: 20, daysRemaining: 20, isEssential: true, preferredBrands: ['Parmareggio'] },
];

interface Props {
  userId?: string;
  catalogProducts?: ProductRecord[];
  onAddToList: (item: ItemRequirement) => void;
}

export function PantryTab({ userId, catalogProducts = [], onAddToList }: Props) {
  const [pantry, setPantry] = useState<PantryItem[]>(DEFAULT_PANTRY_SEEDS);
  const [activeView, setActiveView] = useState<'stock' | 'familyBasket'>('stock');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'ok'>('all');
  const [loading, setLoading] = useState<boolean>(false);

  // Search & Brand management state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItemForBrands, setSelectedItemForBrands] = useState<PantryItem | null>(null);
  const [newBrandInput, setNewBrandInput] = useState('');
  const [showNewItemModal, setShowNewItemModal] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('Dispensa');
  const [newItemUnit, setNewItemUnit] = useState('g');
  const [newItemThreshold, setNewItemThreshold] = useState('500');
  const [newItemBrands, setNewItemBrands] = useState<string[]>([]);

  // Load live stock from Supabase v_current_inventory
  const loadPantry = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const inv = await fetchCurrentInventory(userId);
      if (inv && inv.length > 0) {
        const liveItems: PantryItem[] = inv.map((row) => {
          const matchDefault = DEFAULT_PANTRY_SEEDS.find((d) => d.id === row.product_id || d.name.toLowerCase() === row.product_name.toLowerCase());
          const daily = Math.max(1, Math.round(row.reorder_threshold / 10));
          const days = daily > 0 ? Math.floor(row.current_stock / daily) : 99;
          return {
            id: row.product_id,
            name: row.product_name,
            category: row.category_name || 'Altro',
            currentStock: Number(row.current_stock),
            baseUnit: row.base_unit,
            reorderThreshold: Number(row.reorder_threshold),
            dailyAvgConsumption: daily,
            daysRemaining: days,
            isEssential: matchDefault ? matchDefault.isEssential : true,
            preferredBrands: matchDefault ? matchDefault.preferredBrands : [],
          };
        });

        // Merge with seed favorites not yet in DB inventory
        const trackedIds = new Set(liveItems.map((i) => i.id));
        const missingSeeds = DEFAULT_PANTRY_SEEDS.filter((s) => !trackedIds.has(s.id));

        setPantry([...liveItems, ...missingSeeds]);
      }
    } catch (err) {
      console.warn('Could not load live inventory, using local cache:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadPantry();
    if (userId) {
      let cleanupFn: (() => void) | undefined;
      subscribeToInventory(userId, () => {
        loadPantry();
      }).then((unsub) => {
        cleanupFn = unsub;
      });
      return () => {
        if (cleanupFn) cleanupFn();
      };
    }
  }, [loadPantry, userId]);

  // Adjust stock
  const handleAdjustStock = async (id: string, delta: number) => {
    setPantry((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const newStock = Math.max(0, item.currentStock + delta);
          const days = item.dailyAvgConsumption > 0 ? Math.floor(newStock / item.dailyAvgConsumption) : 99;
          return { ...item, currentStock: newStock, daysRemaining: days };
        }
        return item;
      })
    );

    if (userId) {
      const target = pantry.find((p) => p.id === id);
      if (target) {
        await recordInventoryEvent({
          user_id: userId,
          product_id: target.id,
          event_type: delta > 0 ? 'adjustment' : 'consumption',
          quantity_delta: delta,
          base_unit: target.baseUnit,
          notes: delta > 0 ? 'Aggiunta rapida scorta' : 'Consumo manuale',
        });
      }
    }
  };

  // Toggle favorite / essential for family basket
  const handleToggleEssential = (id: string) => {
    setPantry((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, isEssential: !item.isEssential } : item
      )
    );
  };

  // Add brand to an item
  const handleAddBrandToItem = (item: PantryItem, brandName: string) => {
    const trimmed = brandName.trim();
    if (!trimmed || item.preferredBrands.includes(trimmed)) return;
    const updatedBrands = [...item.preferredBrands, trimmed];
    setPantry((prev) =>
      prev.map((p) => (p.id === item.id ? { ...p, preferredBrands: updatedBrands } : p))
    );
    if (selectedItemForBrands?.id === item.id) {
      setSelectedItemForBrands({ ...selectedItemForBrands, preferredBrands: updatedBrands });
    }
    setNewBrandInput('');
  };

  // Remove brand from an item
  const handleRemoveBrandFromItem = (item: PantryItem, brandToRemove: string) => {
    const updatedBrands = item.preferredBrands.filter((b) => b !== brandToRemove);
    setPantry((prev) =>
      prev.map((p) => (p.id === item.id ? { ...p, preferredBrands: updatedBrands } : p))
    );
    if (selectedItemForBrands?.id === item.id) {
      setSelectedItemForBrands({ ...selectedItemForBrands, preferredBrands: updatedBrands });
    }
  };

  // Add custom item to family basket
  const handleCreateFamilyItem = () => {
    if (!newItemName.trim()) return;
    const thresholdNum = parseFloat(newItemThreshold) || 500;
    const newItem: PantryItem = {
      id: 'custom_' + Date.now(),
      name: newItemName.trim(),
      category: newItemCategory,
      currentStock: 0,
      baseUnit: newItemUnit,
      reorderThreshold: thresholdNum,
      dailyAvgConsumption: Math.max(1, Math.round(thresholdNum / 10)),
      daysRemaining: 0,
      isEssential: true,
      preferredBrands: newItemBrands,
    };

    setPantry((prev) => [newItem, ...prev]);
    setShowNewItemModal(false);
    setNewItemName('');
    setNewItemBrands([]);
    setNewBrandInput('');
  };

  // Add all depleted family essentials to shopping list with 1-click
  const handleAddAllLowEssentialsToShopping = () => {
    const depletedEssentials = pantry.filter(
      (item) => item.isEssential && item.currentStock <= item.reorderThreshold
    );

    depletedEssentials.forEach((item) => {
      onAddToList({
        item_id: item.id,
        name: item.name,
        min_quantity: item.reorderThreshold || (item.baseUnit === 'unit' ? 2 : 1000),
        base_unit: item.baseUnit,
        is_mandatory: true,
        preferred_brands: item.preferredBrands || [],
      });
    });

    alert(`Aggiunti ${depletedEssentials.length} articoli essenziali alla lista della spesa con le tue marche preferite!`);
  };

  // Quick single add to shopping list
  const handleQuickAdd = (item: PantryItem) => {
    onAddToList({
      item_id: item.id,
      name: item.name,
      min_quantity: item.reorderThreshold || (item.baseUnit === 'g' ? 1000 : item.baseUnit === 'ml' ? 1000 : 2),
      base_unit: item.baseUnit,
      is_mandatory: true,
      preferred_brands: item.preferredBrands || [],
    });
  };

  // Filtered views
  const familyBasketItems = pantry.filter((item) => {
    if (!item.isEssential) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.name.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      item.preferredBrands.some((b) => b.toLowerCase().includes(q))
    );
  });

  const filteredStockItems = pantry.filter((item) => {
    const isLow = item.currentStock <= item.reorderThreshold;
    if (stockFilter === 'low') return isLow;
    if (stockFilter === 'ok') return !isLow;
    return true;
  });

  const lowCount = pantry.filter((i) => i.currentStock <= i.reorderThreshold).length;
  const essentialCount = pantry.filter((i) => i.isEssential).length;

  return (
    <div className="space-y-5 max-w-4xl mx-auto pb-10">
      {/* Top Pantry Summary Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Paniere Famiglia</div>
            <div className="text-2xl font-black text-slate-900 mt-0.5">{essentialCount} preferiti ⭐</div>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
            <Star className="h-5 w-5 fill-amber-500" />
          </div>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-amber-800">Sotto Scorta</div>
            <div className="text-2xl font-black text-amber-900 mt-0.5">{lowCount} articoli</div>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-200 text-amber-800">
            <AlertTriangle className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">Sincronizzazione</div>
            <div className="text-xs font-bold text-emerald-900 mt-1 flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Supabase Live
            </div>
          </div>
          <button 
            onClick={() => loadPantry()} 
            disabled={loading}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-200 text-emerald-800 hover:bg-emerald-300 transition"
            title="Ricarica scorte"
          >
            <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Switcher: [ Scorte Attuali ] | [ ⭐ Paniere Famiglia & Marche ] */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex bg-slate-100 p-1 rounded-2xl w-fit">
          <button
            onClick={() => setActiveView('stock')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition ${
              activeView === 'stock'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Package className="h-3.5 w-3.5" />
            Scorte in Dispensa ({pantry.length})
          </button>
          <button
            onClick={() => setActiveView('familyBasket')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition ${
              activeView === 'familyBasket'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Star className="h-3.5 w-3.5 fill-current" />
            Paniere & Marche Famiglia ({essentialCount})
          </button>
        </div>

        {/* 1-Click Action Button */}
        <button
          onClick={handleAddAllLowEssentialsToShopping}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition"
        >
          <ShoppingCart className="h-3.5 w-3.5" />
          Aggiungi Mancanti Famiglia alla Spesa
        </button>
      </div>

      {/* VIEW 1: SCORTE IN DISPENSA */}
      {activeView === 'stock' && (
        <div className="space-y-4">
          <div className="flex gap-1.5">
            <button
              onClick={() => setStockFilter('all')}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                stockFilter === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              Tutti ({pantry.length})
            </button>
            <button
              onClick={() => setStockFilter('low')}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                stockFilter === 'low'
                  ? 'bg-amber-600 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              Sotto Scorta ({lowCount})
            </button>
            <button
              onClick={() => setStockFilter('ok')}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                stockFilter === 'ok'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              Scorte Sufficienti ({pantry.length - lowCount})
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {filteredStockItems.map((item) => {
              const isDepleted = item.currentStock === 0;
              const isLow = item.currentStock <= item.reorderThreshold;
              const maxStockRef = item.reorderThreshold * 2 || 100;
              const pct = Math.min(100, Math.round((item.currentStock / maxStockRef) * 100));

              return (
                <div
                  key={item.id}
                  className={`rounded-2xl border bg-white p-4 shadow-sm transition space-y-3 ${
                    isDepleted
                      ? 'border-red-200 bg-red-50/20'
                      : isLow
                      ? 'border-amber-200 bg-amber-50/20'
                      : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          {item.category}
                        </span>
                        {item.isEssential && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-600">
                            <Star className="h-3 w-3 fill-amber-500" />
                            Famiglia
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-bold text-slate-900 leading-tight mt-0.5">{item.name}</h3>
                      {item.preferredBrands.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {item.preferredBrands.map((b) => (
                            <span key={b} className="rounded bg-slate-100 px-1.5 py-0.2 text-[9px] font-semibold text-slate-600">
                              {b}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => handleToggleEssential(item.id)}
                      title={item.isEssential ? 'Rimuovi dal paniere essenziale famiglia' : 'Aggiungi al paniere famiglia'}
                      className="text-slate-300 hover:text-amber-500 transition p-1"
                    >
                      <Star className={`h-4 w-4 ${item.isEssential ? 'fill-amber-500 text-amber-500' : ''}`} />
                    </button>
                  </div>

                  {/* Progress bar */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-semibold text-slate-800">
                        {item.currentStock} {item.baseUnit} <span className="text-slate-400 font-normal">disponibili</span>
                      </span>
                      <span className="text-slate-500 text-[11px]">
                        Soglia: {item.reorderThreshold} {item.baseUnit}
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          isDepleted ? 'bg-red-500' : isLow ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  {/* Forecast insight */}
                  <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
                    <div>
                      Consumo: <span className="font-semibold text-slate-700">{item.dailyAvgConsumption} {item.baseUnit}/giorno</span>
                    </div>
                    <div>
                      Autonomia: <span className={`font-bold ${isLow ? 'text-amber-700' : 'text-slate-700'}`}>~{item.daysRemaining} giorni</span>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleAdjustStock(item.id, -(item.baseUnit === 'unit' ? 1 : 250))}
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 transition"
                        title="Consuma un'unità/porzione"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleAdjustStock(item.id, item.baseUnit === 'unit' ? 1 : 250)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 transition"
                        title="Aggiungi scorta"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <button
                      onClick={() => handleQuickAdd(item)}
                      className="inline-flex items-center gap-1 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-slate-800"
                    >
                      <ShoppingCart className="h-3.5 w-3.5" />
                      Metti in Lista
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW 2: ⭐ PANIERE & MARCHE FAMIGLIA */}
      {activeView === 'familyBasket' && (
        <div className="space-y-4">
          {/* Search bar & Add Button */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cerca o aggiungi al paniere (es. formaggio grattugiato, pasta, caffè)..."
                className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:outline-none shadow-sm"
              />
            </div>
            <button
              onClick={() => {
                if (searchQuery.trim()) {
                  setNewItemName(searchQuery.trim());
                }
                setShowNewItemModal(true);
              }}
              className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-amber-500 px-4 py-2.5 text-xs font-bold text-white hover:bg-amber-600 transition shadow-sm shrink-0"
            >
              <Plus className="h-4 w-4" />
              Nuovo Articolo di Famiglia
            </button>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 text-xs text-amber-900 flex items-start gap-2.5">
            <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong>Come funziona il Paniere Famiglia:</strong> Gli articoli qui sotto sono i tuoi prodotti abituali. Puoi indicare le <strong>marche preferite e accettate</strong> (es. <em>Parmareggio, Gran Biraghi, Ferrari</em>). Quando calcoli la spesa nei 18 negozi, l'algoritmo combinatorio valuterà solo queste marche!
            </div>
          </div>

          {/* Family Basket Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {familyBasketItems.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:border-amber-300 transition space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {item.category}
                    </span>
                    <h3 className="text-sm font-bold text-slate-900 leading-tight mt-0.5">{item.name}</h3>
                  </div>

                  <button
                    onClick={() => handleToggleEssential(item.id)}
                    title="Rimuovi dal paniere famiglia"
                    className="text-amber-500 hover:text-slate-300 transition p-1"
                  >
                    <Star className="h-4 w-4 fill-amber-500" />
                  </button>
                </div>

                {/* Preferred Brands Chips */}
                <div className="space-y-1.5">
                  <div className="text-[11px] font-bold text-slate-700">
                    Marche Preferite / Accettate:
                  </div>
                  <div className="flex flex-wrap gap-1.5 items-center">
                    {item.preferredBrands.length === 0 ? (
                      <span className="text-[11px] text-slate-400 italic">Qualsiasi marca (nessun vincolo)</span>
                    ) : (
                      item.preferredBrands.map((brand) => (
                        <span
                          key={brand}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-800 border border-emerald-200"
                        >
                          {brand}
                          <button
                            onClick={() => handleRemoveBrandFromItem(item, brand)}
                            className="text-emerald-500 hover:text-red-600 transition"
                            title={`Rimuovi ${brand}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))
                    )}

                    <button
                      onClick={() => setSelectedItemForBrands(item)}
                      className="inline-flex items-center gap-1 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-2 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-100 transition"
                    >
                      <Plus className="h-3 w-3" />
                      Aggiungi Marca
                    </button>
                  </div>
                </div>

                {/* Reorder Safety Stock & Actions */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-slate-400">Scorta Minima:</span>{' '}
                    <span className="font-bold text-slate-800">{item.reorderThreshold} {item.baseUnit}</span>
                  </div>

                  <button
                    onClick={() => handleQuickAdd(item)}
                    className="inline-flex items-center gap-1 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800 transition"
                  >
                    <ShoppingCart className="h-3.5 w-3.5" />
                    Aggiungi alla Spesa
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL 1: ADD BRAND TO ITEM MODAL */}
      {selectedItemForBrands && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Aggiungi Marca Preferita</h3>
                <p className="text-xs text-slate-500">Per: {selectedItemForBrands.name}</p>
              </div>
              <button
                onClick={() => setSelectedItemForBrands(null)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Input with live brand suggestions */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700">Nome Marca</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newBrandInput}
                  onChange={(e) => setNewBrandInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleAddBrandToItem(selectedItemForBrands, newBrandInput);
                    }
                  }}
                  placeholder="Digita marca (es. Parmareggio, Gran Biraghi)..."
                  className="flex-1 rounded-xl border border-slate-200 p-2.5 text-xs font-semibold text-slate-800 focus:border-amber-500 focus:outline-none"
                  autoFocus
                />
                <button
                  onClick={() => handleAddBrandToItem(selectedItemForBrands, newBrandInput)}
                  disabled={!newBrandInput.trim()}
                  className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-white hover:bg-amber-600 transition disabled:opacity-40"
                >
                  Aggiungi
                </button>
              </div>

              {/* Quick suggestions chips */}
              <div className="pt-2">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Marche Comuni Suggerite:
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                  {COMMON_RETAIL_BRANDS.filter((b) =>
                    !newBrandInput || b.toLowerCase().includes(newBrandInput.toLowerCase())
                  ).slice(0, 12).map((brand) => (
                    <button
                      key={brand}
                      onClick={() => handleAddBrandToItem(selectedItemForBrands, brand)}
                      className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-emerald-100 hover:text-emerald-800 transition"
                    >
                      + {brand}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedItemForBrands(null)}
                className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 transition"
              >
                Fatto
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: CREATE NEW FAMILY BASKET ITEM */}
      {showNewItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Nuovo Articolo di Famiglia</h3>
                <p className="text-xs text-slate-500">Aggiungi un prodotto al tuo paniere ricorrente</p>
              </div>
              <button
                onClick={() => setShowNewItemModal(false)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700">Nome Prodotto</label>
                <input
                  type="text"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder="Es. Formaggio Grattugiato Fresco, Biscotti..."
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 font-semibold text-slate-800 focus:border-amber-500 focus:outline-none"
                />
                {catalogProducts.length > 0 && !newItemName && (
                  <div className="mt-1.5 flex flex-wrap gap-1 max-h-16 overflow-y-auto">
                    {catalogProducts.slice(0, 6).map((cp) => (
                      <button
                        key={cp.id}
                        type="button"
                        onClick={() => {
                          setNewItemName(cp.name);
                          setNewItemUnit(cp.base_unit);
                        }}
                        className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600 hover:bg-slate-200"
                      >
                        {cp.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700">Categoria</label>
                  <select
                    value={newItemCategory}
                    onChange={(e) => setNewItemCategory(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 font-semibold text-slate-800 focus:border-amber-500 focus:outline-none bg-white"
                  >
                    <option value="Dispensa">Dispensa</option>
                    <option value="Pasta e Riso">Pasta e Riso</option>
                    <option value="Latticini e Formaggi">Latticini e Formaggi</option>
                    <option value="Colazione">Colazione</option>
                    <option value="Bevande">Bevande</option>
                    <option value="Igiene e Casa">Igiene e Casa</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700">Scorta Minima</label>
                  <div className="flex mt-1">
                    <input
                      type="number"
                      value={newItemThreshold}
                      onChange={(e) => setNewItemThreshold(e.target.value)}
                      className="w-20 rounded-l-xl border border-r-0 border-slate-200 p-2.5 font-semibold text-slate-800 focus:border-amber-500 focus:outline-none"
                    />
                    <select
                      value={newItemUnit}
                      onChange={(e) => setNewItemUnit(e.target.value)}
                      className="flex-1 rounded-r-xl border border-slate-200 p-2.5 font-semibold text-slate-800 focus:border-amber-500 focus:outline-none bg-slate-50"
                    >
                      <option value="g">grammi (g)</option>
                      <option value="ml">millilitri (ml)</option>
                      <option value="unit">pezzi / conf (pz)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Brands selection inside creation modal */}
              <div className="space-y-1.5 pt-2">
                <label className="font-bold text-slate-700">Marche Preferite Accettate</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newBrandInput}
                    onChange={(e) => setNewBrandInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newBrandInput.trim()) {
                        setNewItemBrands([...newItemBrands, newBrandInput.trim()]);
                        setNewBrandInput('');
                      }
                    }}
                    placeholder="Digita marca (es. Parmareggio)..."
                    className="flex-1 rounded-xl border border-slate-200 p-2 font-semibold text-slate-800 focus:border-amber-500 focus:outline-none"
                  />
                  <button
                    onClick={() => {
                      if (newBrandInput.trim()) {
                        setNewItemBrands([...newItemBrands, newBrandInput.trim()]);
                        setNewBrandInput('');
                      }
                    }}
                    className="rounded-xl bg-amber-500 px-3 py-2 text-xs font-bold text-white"
                  >
                    +
                  </button>
                </div>

                {/* Selected brands chips */}
                {newItemBrands.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {newItemBrands.map((b) => (
                      <span key={b} className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
                        {b}
                        <button
                          onClick={() => setNewItemBrands(newItemBrands.filter((item) => item !== b))}
                          className="hover:text-red-600"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
              <button
                onClick={() => setShowNewItemModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
              >
                Annulla
              </button>
              <button
                onClick={handleCreateFamilyItem}
                disabled={!newItemName.trim()}
                className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-white hover:bg-amber-600 transition disabled:opacity-40"
              >
                Salva nel Paniere
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
