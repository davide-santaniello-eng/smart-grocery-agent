import { useState } from 'react';
import { Package, AlertTriangle, CheckCircle, Plus, Minus, ShoppingCart, RefreshCw } from 'lucide-react';
import { ItemRequirement } from '../types';

export interface PantryItem {
  id: string;
  name: string;
  category: string;
  currentStock: number;
  baseUnit: string;
  reorderThreshold: number;
  dailyAvgConsumption: number;
  daysRemaining: number;
  isEssential: boolean;
}

const INITIAL_PANTRY: PantryItem[] = [
  { id: 'p1', name: 'Spaghetti di Semola', category: 'Pasta e Riso', currentStock: 1500, baseUnit: 'g', reorderThreshold: 1000, dailyAvgConsumption: 125, daysRemaining: 12, isEssential: true },
  { id: 'p2', name: 'Latte Parzialmente Scremato UHT', category: 'Latticini', currentStock: 800, baseUnit: 'ml', reorderThreshold: 1500, dailyAvgConsumption: 250, daysRemaining: 3, isEssential: true },
  { id: 'p3', name: 'Olio Extra Vergine di Oliva', category: 'Dispensa', currentStock: 350, baseUnit: 'ml', reorderThreshold: 500, dailyAvgConsumption: 30, daysRemaining: 11, isEssential: true },
  { id: 'p4', name: 'Caffè Macinato per Moka', category: 'Colazione', currentStock: 120, baseUnit: 'g', reorderThreshold: 250, dailyAvgConsumption: 25, daysRemaining: 4, isEssential: true },
  { id: 'p5', name: 'Uova Fresche Medie', category: 'Latticini e Uova', currentStock: 0, baseUnit: 'pz', reorderThreshold: 4, dailyAvgConsumption: 1, daysRemaining: 0, isEssential: true },
  { id: 'p6', name: 'Passata di Pomodoro', category: 'Dispensa', currentStock: 2100, baseUnit: 'g', reorderThreshold: 700, dailyAvgConsumption: 70, daysRemaining: 30, isEssential: false },
  { id: 'p7', name: 'Parmigiano Reggiano DOP', category: 'Latticini', currentStock: 400, baseUnit: 'g', reorderThreshold: 200, dailyAvgConsumption: 20, daysRemaining: 20, isEssential: true },
];

interface Props {
  onAddToList: (item: ItemRequirement) => void;
}

export function PantryTab({ onAddToList }: Props) {
  const [pantry, setPantry] = useState<PantryItem[]>(INITIAL_PANTRY);
  const [filter, setFilter] = useState<'all' | 'low' | 'ok'>('all');

  const handleAdjustStock = (id: string, delta: number) => {
    setPantry(
      pantry.map((item) => {
        if (item.id === id) {
          const newStock = Math.max(0, item.currentStock + delta);
          const newDays = item.dailyAvgConsumption > 0 ? Math.floor(newStock / item.dailyAvgConsumption) : 99;
          return {
            ...item,
            currentStock: newStock,
            daysRemaining: newDays,
          };
        }
        return item;
      })
    );
  };

  const handleQuickAdd = (item: PantryItem) => {
    onAddToList({
      item_id: item.id,
      name: item.name,
      min_quantity: item.reorderThreshold || (item.baseUnit === 'g' ? 1000 : item.baseUnit === 'ml' ? 1000 : 6),
      base_unit: item.baseUnit,
      is_mandatory: true,
      preferred_brands: [],
    });
  };

  const filteredItems = pantry.filter((item) => {
    const isLow = item.currentStock <= item.reorderThreshold;
    if (filter === 'low') return isLow;
    if (filter === 'ok') return !isLow;
    return true;
  });

  const lowCount = pantry.filter((i) => i.currentStock <= i.reorderThreshold).length;

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      {/* Top Pantry Summary Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Prodotti in Dispensa</div>
            <div className="text-2xl font-black text-slate-900 mt-0.5">{pantry.length}</div>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
            <Package className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-amber-800">Da Riordinare</div>
            <div className="text-2xl font-black text-amber-900 mt-0.5">{lowCount} articoli</div>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-200 text-amber-800">
            <AlertTriangle className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">Algoritmo TSB</div>
            <div className="text-sm font-bold text-emerald-900 mt-1">Stima Consumi Attiva</div>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-200 text-emerald-800">
            <RefreshCw className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div className="flex gap-1.5">
          <button
            onClick={() => setFilter('all')}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
              filter === 'all'
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            Tutti ({pantry.length})
          </button>
          <button
            onClick={() => setFilter('low')}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
              filter === 'low'
                ? 'bg-amber-600 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            Sotto Scorta ({lowCount})
          </button>
          <button
            onClick={() => setFilter('ok')}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
              filter === 'ok'
                ? 'bg-emerald-600 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            Scorte Sufficienti ({pantry.length - lowCount})
          </button>
        </div>
      </div>

      {/* Pantry Items Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {filteredItems.map((item) => {
          const isDepleted = item.currentStock === 0;
          const isLow = item.currentStock <= item.reorderThreshold;

          // Calculate percentage level
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
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {item.category}
                  </span>
                  <h3 className="text-sm font-bold text-slate-900 leading-tight mt-0.5">{item.name}</h3>
                </div>
                {isDepleted ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
                    ESAURITO
                  </span>
                ) : isLow ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                    <AlertTriangle className="h-3 w-3" />
                    SOTTO SCORTA
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                    <CheckCircle className="h-3 w-3" />
                    SUFFICIENTE
                  </span>
                )}
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
  );
}
