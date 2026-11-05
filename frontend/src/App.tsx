import React, { useState, useEffect, useCallback } from 'react';
import { 
  ShoppingCart, 
  Store as StoreIcon, 
  Sparkles, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Clock,
  Layers,
  Database,
  ShoppingBag,
  Package,
  Tag,
  Receipt,
  MessageSquare,
  LogOut,
  User as UserIcon,
  RefreshCw
} from 'lucide-react';
import { Session } from '@supabase/supabase-js';
import { ItemRequirement, Store, ProductOffer, OptimizationResult, AllocatedItem } from './types';
import { 
  fetchProducts, 
  ProductRecord, 
  getCurrentSession, 
  signOutUser, 
  supabase,
  getOrCreateActiveShoppingList,
  fetchShoppingListItems,
  addShoppingListItem,
  deleteShoppingListItem,
  toggleShoppingListItem,
  subscribeToShoppingList,
  recordInventoryEvent,
  ShoppingListRecord
} from './services/supabase';
import { LoginScreen } from './components/LoginScreen';
import { NaturalLanguageModal } from './components/NaturalLanguageModal';
import { InStoreModeTab } from './components/InStoreModeTab';
import { PantryTab } from './components/PantryTab';
import { OffersTab } from './components/OffersTab';
import { ReceiptsTab } from './components/ReceiptsTab';

// Default initial shopping list
const INITIAL_ITEMS: ItemRequirement[] = [
  { item_id: 'spaghetti', name: 'Spaghetti', min_quantity: 1000, base_unit: 'g', is_mandatory: true, preferred_brands: ['Barilla'] },
  { item_id: 'olio_evo', name: 'Olio Extra Vergine di Oliva', min_quantity: 1000, base_unit: 'ml', is_mandatory: true, preferred_brands: ['Monini'] },
  { item_id: 'latte', name: 'Latte Parzialmente Scremato UHT', min_quantity: 2000, base_unit: 'ml', is_mandatory: true, preferred_brands: ['Granarolo'] },
  { item_id: 'caffe', name: 'Caffè Macinato per Moka', min_quantity: 500, base_unit: 'g', is_mandatory: true, preferred_brands: ['Lavazza'] },
];

const INITIAL_STORES: Store[] = [
  { store_id: 's_esselunga', name: 'Esselunga - Via Washington', chain: 'Esselunga', visit_cost: 1.50 },
  { store_id: 's_coop', name: 'Coop - Piazza Lodi', chain: 'Coop', visit_cost: 1.00 },
  { store_id: 's_conad', name: 'Conad City', chain: 'Conad', visit_cost: 1.00 },
  { store_id: 's_lidl', name: 'Lidl', chain: 'Lidl', visit_cost: 1.20 },
];

// Sample multi-store market offers (demonstrating real-world split basket advantage)
const INITIAL_OFFERS: ProductOffer[] = [
  // Spaghetti
  { offer_id: 'o_spagh_ess', store_id: 's_esselunga', item_id: 'spaghetti', variant_id: 'v_bar_500', variant_name: 'Spaghetti N. 5 Barilla 500g', brand: 'Barilla', package_price: 1.29, package_base_quantity: 500, is_promotion: false },
  { offer_id: 'o_spagh_coop', store_id: 's_coop', item_id: 'spaghetti', variant_id: 'v_bar_500', variant_name: 'Spaghetti N. 5 Barilla 500g', brand: 'Barilla', package_price: 1.35, package_base_quantity: 500, is_promotion: false },
  { offer_id: 'o_spagh_lidl', store_id: 's_lidl', item_id: 'spaghetti', variant_id: 'v_comb_500', variant_name: 'Spaghetti Combino 500g', brand: 'Combino', package_price: 0.79, package_base_quantity: 500, is_promotion: false },
  
  // Olio EVO (Promo at Coop: €6.50 vs €11.90)
  { offer_id: 'o_olio_ess', store_id: 's_esselunga', item_id: 'olio_evo', variant_id: 'v_monini_1l', variant_name: 'Olio EVO Classico Monini 1L', brand: 'Monini', package_price: 10.90, package_base_quantity: 1000, is_promotion: false },
  { offer_id: 'o_olio_coop', store_id: 's_coop', item_id: 'olio_evo', variant_id: 'v_monini_1l', variant_name: 'Olio EVO Classico Monini 1L', brand: 'Monini', package_price: 6.50, package_base_quantity: 1000, is_promotion: true, promo_description: 'Sconto 40% Soci' },
  { offer_id: 'o_olio_conad', store_id: 's_conad', item_id: 'olio_evo', variant_id: 'v_monini_1l', variant_name: 'Olio EVO Classico Monini 1L', brand: 'Monini', package_price: 11.50, package_base_quantity: 1000, is_promotion: false },
  { offer_id: 'o_olio_lidl', store_id: 's_lidl', item_id: 'olio_evo', variant_id: 'v_primadonna_1l', variant_name: 'Olio EVO Primadonna 1L', brand: 'Primadonna', package_price: 8.99, package_base_quantity: 1000, is_promotion: false },

  // Latte UHT
  { offer_id: 'o_latte_ess', store_id: 's_esselunga', item_id: 'latte', variant_id: 'v_granarolo_1l', variant_name: 'Latte UHT Granarolo 1L', brand: 'Granarolo', package_price: 1.59, package_base_quantity: 1000, is_promotion: false },
  { offer_id: 'o_latte_coop', store_id: 's_coop', item_id: 'latte', variant_id: 'v_coop_1l', variant_name: 'Latte UHT Coop 1L', brand: 'Coop', package_price: 1.25, package_base_quantity: 1000, is_promotion: false },
  { offer_id: 'o_latte_lidl', store_id: 's_lidl', item_id: 'latte', variant_id: 'v_milbona_1l', variant_name: 'Latte UHT Milbona 1L', brand: 'Milbona', package_price: 0.99, package_base_quantity: 1000, is_promotion: false },

  // Caffè
  { offer_id: 'o_caffe_ess', store_id: 's_esselunga', item_id: 'caffe', variant_id: 'v_lavazza_250', variant_name: 'Caffè Lavazza Qualità Rossa 250g', brand: 'Lavazza', package_price: 2.89, package_base_quantity: 250, is_promotion: true, promo_description: 'Prezzi Corti' },
  { offer_id: 'o_caffe_coop', store_id: 's_coop', item_id: 'caffe', variant_id: 'v_lavazza_250', variant_name: 'Caffè Lavazza Qualità Rossa 250g', brand: 'Lavazza', package_price: 3.89, package_base_quantity: 250, is_promotion: false },
  { offer_id: 'o_caffe_conad', store_id: 's_conad', item_id: 'caffe', variant_id: 'v_lavazza_250', variant_name: 'Caffè Lavazza Qualità Rossa 250g', brand: 'Lavazza', package_price: 3.79, package_base_quantity: 250, is_promotion: false },
  { offer_id: 'o_caffe_lidl', store_id: 's_lidl', item_id: 'caffe', variant_id: 'v_bellarom_250', variant_name: 'Caffè Bellarom Classico 250g', brand: 'Bellarom', package_price: 2.19, package_base_quantity: 250, is_promotion: false },
];

export function App() {
  // Authentication session state
  const [session, setSession] = useState<Session | null>(null);
  const [authChecking, setAuthChecking] = useState<boolean>(true);

  // Tab navigation
  const [activeTab, setActiveTab] = useState<'shopping' | 'instore' | 'pantry' | 'offers' | 'receipts'>('shopping');

  // Supabase Live Shopping List state
  const [activeList, setActiveList] = useState<ShoppingListRecord | null>(null);
  const [items, setItems] = useState<ItemRequirement[]>(INITIAL_ITEMS);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const [stores] = useState<Store[]>(INITIAL_STORES);
  const [maxStores, setMaxStores] = useState<number>(2);
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<OptimizationResult | null>(null);

  // Live Supabase catalog products
  const [catalogProducts, setCatalogProducts] = useState<ProductRecord[]>([]);
  const [dbConnected, setDbConnected] = useState<boolean>(false);

  // Natural language modal
  const [isNlModalOpen, setIsNlModalOpen] = useState(false);

  // New item form state
  const [newItemName, setNewItemName] = useState('');
  const [newItemQty, setNewItemQty] = useState('1000');
  const [newItemUnit, setNewItemUnit] = useState('g');

  // 1. Check Authentication on Mount
  useEffect(() => {
    async function initAuth() {
      try {
        const s = await getCurrentSession();
        setSession(s);
      } catch (e) {
        console.error('Error fetching session:', e);
      } finally {
        setAuthChecking(false);
      }
    }
    initAuth();

    // Listen for auth state changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setAuthChecking(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // 2. Load Catalog when user is authenticated
  useEffect(() => {
    async function loadCatalog() {
      if (!session) return;
      try {
        const prods = await fetchProducts();
        if (prods.length > 0) {
          setCatalogProducts(prods);
          setDbConnected(true);
        }
      } catch (err) {
        console.warn('Could not load Supabase catalog:', err);
      }
    }
    loadCatalog();
  }, [session]);

  // 3. Connect to Supabase Shopping List & Realtime Sync
  const loadShoppingList = useCallback(async (userId: string) => {
    setIsSyncing(true);
    try {
      const list = await getOrCreateActiveShoppingList(userId);
      if (!list) {
        setIsSyncing(false);
        return;
      }
      setActiveList(list);

      const dbItems = await fetchShoppingListItems(list.id);
      if (dbItems && dbItems.length > 0) {
        const mapped: ItemRequirement[] = dbItems.map((db) => ({
          item_id: db.id,
          db_id: db.id,
          name: db.item_name || 'Articolo',
          min_quantity: Number(db.quantity) || 1,
          base_unit: db.unit || 'g',
          is_mandatory: db.is_mandatory,
          preferred_brands: db.preferred_brands || [],
          is_checked: db.is_checked,
        }));
        setItems(mapped);
      } else {
        // If the user's DB list is completely empty, initialize it with default essentials
        for (const initItem of INITIAL_ITEMS) {
          await addShoppingListItem({
            list_id: list.id,
            item_name: initItem.name,
            quantity: initItem.min_quantity,
            unit: initItem.base_unit,
            preferred_brands: initItem.preferred_brands,
            is_mandatory: initItem.is_mandatory,
          });
        }
        const refreshed = await fetchShoppingListItems(list.id);
        const mapped: ItemRequirement[] = refreshed.map((db) => ({
          item_id: db.id,
          db_id: db.id,
          name: db.item_name || 'Articolo',
          min_quantity: Number(db.quantity) || 1,
          base_unit: db.unit || 'g',
          is_mandatory: db.is_mandatory,
          preferred_brands: db.preferred_brands || [],
          is_checked: db.is_checked,
        }));
        setItems(mapped);
      }
    } catch (err) {
      console.warn('Error syncing shopping list with Supabase:', err);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    if (session) {
      loadShoppingList(session.user.id);
    }
  }, [session, loadShoppingList]);

  // 4. Setup Supabase Realtime channel for instant multi-device synchronization
  useEffect(() => {
    if (!activeList) return;
    let unsubscribe: (() => void) | undefined;

    subscribeToShoppingList(activeList.id, async () => {
      setIsSyncing(true);
      const dbItems = await fetchShoppingListItems(activeList.id);
      const mapped: ItemRequirement[] = dbItems.map((db) => ({
        item_id: db.id,
        db_id: db.id,
        name: db.item_name || 'Articolo',
        min_quantity: Number(db.quantity) || 1,
        base_unit: db.unit || 'g',
        is_mandatory: db.is_mandatory,
        preferred_brands: db.preferred_brands || [],
        is_checked: db.is_checked,
      }));
      setItems(mapped);
      setIsSyncing(false);
    }).then((unsub) => {
      unsubscribe = unsub;
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [activeList]);

  const handleSignOut = async () => {
    await signOutUser();
    setSession(null);
    setActiveList(null);
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;
    const name = newItemName.trim();
    const qty = parseFloat(newItemQty) || 1;
    const unit = newItemUnit;

    if (activeList) {
      const created = await addShoppingListItem({
        list_id: activeList.id,
        item_name: name,
        quantity: qty,
        unit,
      });
      if (created) {
        setItems((prev) => [
          ...prev,
          {
            item_id: created.id,
            db_id: created.id,
            name: created.item_name || name,
            min_quantity: Number(created.quantity),
            base_unit: created.unit,
            is_mandatory: created.is_mandatory,
            preferred_brands: [],
            is_checked: false,
          },
        ]);
      }
    } else {
      const id = name.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now();
      setItems((prev) => [
        ...prev,
        {
          item_id: id,
          name,
          min_quantity: qty,
          base_unit: unit,
          is_mandatory: true,
          preferred_brands: [],
        },
      ]);
    }
    setNewItemName('');
  };

  const handleQuickAdd = async (product: ProductRecord) => {
    if (items.some((i) => i.name.toLowerCase() === product.name.toLowerCase())) return;
    const qty = product.base_unit === 'g' ? 1000 : product.base_unit === 'ml' ? 1000 : 6;

    if (activeList) {
      const created = await addShoppingListItem({
        list_id: activeList.id,
        item_name: product.name,
        product_id: product.id,
        quantity: qty,
        unit: product.base_unit,
      });
      if (created) {
        setItems((prev) => [
          ...prev,
          {
            item_id: created.id,
            db_id: created.id,
            name: product.name,
            min_quantity: qty,
            base_unit: product.base_unit,
            is_mandatory: true,
            preferred_brands: [],
            is_checked: false,
          },
        ]);
      }
    } else {
      setItems((prev) => [
        ...prev,
        {
          item_id: product.id,
          name: product.name,
          min_quantity: qty,
          base_unit: product.base_unit,
          is_mandatory: true,
          preferred_brands: [],
        },
      ]);
    }
  };

  const handleAddMultiple = async (newItems: ItemRequirement[]) => {
    if (activeList) {
      for (const item of newItems) {
        await addShoppingListItem({
          list_id: activeList.id,
          item_name: item.name,
          quantity: item.min_quantity,
          unit: item.base_unit,
          preferred_brands: item.preferred_brands,
          is_mandatory: item.is_mandatory,
        });
      }
      const refreshed = await fetchShoppingListItems(activeList.id);
      const mapped: ItemRequirement[] = refreshed.map((db) => ({
        item_id: db.id,
        db_id: db.id,
        name: db.item_name || 'Articolo',
        min_quantity: Number(db.quantity) || 1,
        base_unit: db.unit || 'g',
        is_mandatory: db.is_mandatory,
        preferred_brands: db.preferred_brands || [],
        is_checked: db.is_checked,
      }));
      setItems(mapped);
    } else {
      setItems((prev) => [...prev, ...newItems]);
    }
  };

  const handleRemoveItem = async (id: string) => {
    const target = items.find((i) => i.item_id === id);
    if (target?.db_id) {
      await deleteShoppingListItem(target.db_id);
    }
    setItems((prev) => prev.filter((item) => item.item_id !== id));
  };

  const handleToggleRawItem = async (itemId: string, isChecked: boolean) => {
    const target = items.find((i) => i.item_id === itemId);
    if (target?.db_id) {
      await toggleShoppingListItem(target.db_id, isChecked);
    }
    setItems((prev) =>
      prev.map((i) => (i.item_id === itemId ? { ...i, is_checked: isChecked } : i))
    );
  };

  const runOptimization = async () => {
    setLoading(true);
    try {
      const payload = {
        items,
        stores,
        offers: INITIAL_OFFERS,
        config: {
          max_stores: maxStores,
          enforce_single_sku_per_item: true,
        },
      };

      const response = await fetch('/api/v1/shopping/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data = await response.json();
        setResult(data);
      } else {
        simulateLocalOptimization();
      }
    } catch {
      simulateLocalOptimization();
    } finally {
      setLoading(false);
    }
  };

  // Pure client-side simulation fallback for GitHub Pages offline demo
  const simulateLocalOptimization = () => {
    setTimeout(() => {
      setResult({
        status: 'OPTIMAL',
        total_cost: 16.55,
        product_cost: 14.35,
        travel_cost: 2.20,
        estimated_savings_vs_single_store: 4.85,
        solver_time_ms: 18.4,
        unfulfilled_items: [],
        selected_stores: [
          {
            store_id: 's_coop',
            store_name: 'Coop - Piazza Lodi',
            store_chain: 'Coop',
            visit_cost: 1.00,
            subtotal_products: 6.50,
            items: [
              {
                item_id: 'olio_evo',
                item_name: 'Olio Extra Vergine di Oliva',
                variant_id: 'v_monini_1l',
                variant_name: 'Olio EVO Classico Monini 1L',
                brand: 'Monini',
                package_quantity: 1,
                unit_price: 6.50,
                total_price: 6.50,
                base_quantity_per_pack: 1000,
                total_base_quantity: 1000,
                is_promotion: true,
              },
            ],
          },
          {
            store_id: 's_lidl',
            store_name: 'Lidl',
            store_chain: 'Lidl',
            visit_cost: 1.20,
            subtotal_products: 7.85,
            items: [
              {
                item_id: 'spaghetti',
                item_name: 'Spaghetti',
                variant_id: 'v_comb_500',
                variant_name: 'Spaghetti Combino 500g',
                brand: 'Combino',
                package_quantity: 2,
                unit_price: 0.79,
                total_price: 1.58,
                base_quantity_per_pack: 500,
                total_base_quantity: 1000,
                is_promotion: false,
              },
              {
                item_id: 'latte',
                item_name: 'Latte Parzialmente Scremato UHT',
                variant_id: 'v_milbona_1l',
                variant_name: 'Latte UHT Milbona 1L',
                brand: 'Milbona',
                package_quantity: 2,
                unit_price: 0.99,
                total_price: 1.98,
                base_quantity_per_pack: 1000,
                total_base_quantity: 2000,
                is_promotion: false,
              },
              {
                item_id: 'caffe',
                item_name: 'Caffè Macinato per Moka',
                variant_id: 'v_bellarom_250',
                variant_name: 'Caffè Bellarom Classico 250g',
                brand: 'Bellarom',
                package_quantity: 2,
                unit_price: 2.19,
                total_price: 4.38,
                base_quantity_per_pack: 250,
                total_base_quantity: 500,
                is_promotion: false,
              },
            ],
          },
        ],
      });
    }, 300);
  };

  const handleCompleteShopping = async (purchasedItems: AllocatedItem[]) => {
    // 1. In Supabase: record purchase in inventory_events for each item so pantry is automatically restocked!
    if (session) {
      for (const p of purchasedItems) {
        const matchingProduct = catalogProducts.find(
          (cp) => cp.name.toLowerCase() === p.item_name.toLowerCase()
        );
        if (matchingProduct) {
          await recordInventoryEvent({
            user_id: session.user.id,
            product_id: matchingProduct.id,
            variant_id: p.variant_id.startsWith('v_') ? null : p.variant_id,
            event_type: 'purchase',
            quantity_delta: p.total_base_quantity,
            base_unit: matchingProduct.base_unit,
            notes: `Spesa completata: ${p.package_quantity}x ${p.variant_name}`,
          });
        }
      }
    }

    // 2. Remove purchased items from the active shopping list in Supabase
    const purchasedNames = purchasedItems.map((p) => p.item_name.toLowerCase());
    const toRemove = items.filter((i) => purchasedNames.includes(i.name.toLowerCase()));
    for (const item of toRemove) {
      if (item.db_id) {
        await deleteShoppingListItem(item.db_id);
      }
    }

    setItems((prev) => prev.filter((i) => !purchasedNames.includes(i.name.toLowerCase())));
    setActiveTab('pantry');
  };

  // If loading session on initial page load
  if (authChecking) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-md animate-pulse">
            <ShoppingCart className="h-6 w-6" />
          </div>
          <span className="text-xs font-bold text-slate-500">Verifica credenziali in corso...</span>
        </div>
      </div>
    );
  }

  // If user is not authenticated, show protected login screen
  if (!session) {
    return <LoginScreen onLoginSuccess={() => {}} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-24 sm:pb-16">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
              <ShoppingCart className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight text-slate-900">Smart Grocery Agent</h1>
              <p className="text-xs text-slate-500">Ottimizzatore Spesa & Scorte Famiglia</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            {dbConnected ? (
              <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                Supabase Realtime Attivo
              </span>
            ) : (
              <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 border border-slate-200">
                <Database className="h-3 w-3 text-slate-400" />
                Connessione DB...
              </span>
            )}

            {/* User Profile & Logout */}
            <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 pl-2.5 pr-1 py-1 text-xs">
              <UserIcon className="h-3.5 w-3.5 text-slate-500" />
              <span className="font-bold text-slate-700 max-w-[120px] sm:max-w-[160px] truncate">
                {session.user.email}
              </span>
              <button
                onClick={handleSignOut}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-800 transition"
                title="Disconnetti"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Desktop Tab Switcher */}
        <div className="hidden sm:flex mx-auto max-w-5xl px-4 sm:px-6 gap-2 border-t border-slate-100 py-1.5 overflow-x-auto text-xs font-bold">
          <button
            onClick={() => setActiveTab('shopping')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 transition ${
              activeTab === 'shopping' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <ShoppingCart className="h-3.5 w-3.5" />
            Spesa & Ottimizzatore
          </button>
          <button
            onClick={() => setActiveTab('instore')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 transition ${
              activeTab === 'instore' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <ShoppingBag className="h-3.5 w-3.5" />
            Modalità Supermercato
          </button>
          <button
            onClick={() => setActiveTab('pantry')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 transition ${
              activeTab === 'pantry' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Package className="h-3.5 w-3.5" />
            Dispensa & Previsioni
          </button>
          <button
            onClick={() => setActiveTab('offers')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 transition ${
              activeTab === 'offers' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Tag className="h-3.5 w-3.5" />
            Esplora Offerte
          </button>
          <button
            onClick={() => setActiveTab('receipts')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 transition ${
              activeTab === 'receipts' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Receipt className="h-3.5 w-3.5" />
            Carica Scontrino
          </button>
        </div>
      </header>

      {/* Main Tab Content Container */}
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        {/* TAB 1: Shopping List & Optimizer */}
        {activeTab === 'shopping' && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Left Column: Grocery List (7 cols) */}
            <div className="space-y-6 lg:col-span-7">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-slate-900">Lista della Spesa</h2>
                      {isSyncing && (
                        <RefreshCw className="h-3.5 w-3.5 text-emerald-600 animate-spin" />
                      )}
                    </div>
                    <p className="text-xs text-slate-500">{items.length} prodotti sincronizzati nel cloud</p>
                  </div>
                  <button
                    onClick={() => setIsNlModalOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100 border border-emerald-200/80 transition shadow-sm"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    Incolla Testo Libero
                  </button>
                </div>

                {/* Add item form */}
                <form onSubmit={handleAddItem} className="mb-3 flex flex-wrap gap-2">
                  <input
                    type="text"
                    placeholder="Aggiungi prodotto personalizzato..."
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    className="flex-1 min-w-[180px] rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  />
                  <input
                    type="number"
                    min="1"
                    value={newItemQty}
                    onChange={(e) => setNewItemQty(e.target.value)}
                    className="w-20 rounded-xl border border-slate-200 px-3 py-2 text-sm text-center focus:border-emerald-500 focus:outline-none"
                  />
                  <select
                    value={newItemUnit}
                    onChange={(e) => setNewItemUnit(e.target.value)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="g">g</option>
                    <option value="ml">ml</option>
                    <option value="unit">pz</option>
                  </select>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    <Plus className="h-4 w-4" />
                    Aggiungi
                  </button>
                </form>

                {/* Quick Pick from Supabase Catalog */}
                {catalogProducts.length > 0 && (
                  <div className="mb-4 pt-1">
                    <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      Aggiunta rapida da catalogo Supabase:
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {catalogProducts.map((p) => {
                        const isAdded = items.some((i) => i.name.toLowerCase() === p.name.toLowerCase());
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => handleQuickAdd(p)}
                            disabled={isAdded}
                            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs transition ${
                              isAdded
                                ? 'bg-slate-100 text-slate-400 cursor-default'
                                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/60 font-medium'
                            }`}
                          >
                            <Plus className="h-3 w-3" />
                            {p.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Items list */}
                <div className="divide-y divide-slate-100">
                  {items.map((item) => (
                    <div key={item.item_id} className="flex items-center justify-between py-2.5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600 text-xs font-medium">
                          {item.base_unit}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-slate-900">{item.name}</div>
                          <div className="text-xs text-slate-400">
                            Minimo: {item.min_quantity} {item.base_unit}
                            {item.preferred_brands.length > 0 && ` • Pref: ${item.preferred_brands.join(', ')}`}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveItem(item.item_id)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 transition"
                        title="Elimina"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Supermarket Candidates */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-base font-bold text-slate-900 mb-1">Supermercati Candidati</h2>
                <p className="text-xs text-slate-500 mb-4">Costo visita include tempo, carburante e comodità</p>
                
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {stores.map((s) => (
                    <div key={s.store_id} className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-center">
                      <div className="mx-auto mb-1.5 flex h-8 w-8 items-center justify-center rounded-lg bg-white shadow-sm border border-slate-200 text-slate-700">
                        <StoreIcon className="h-4 w-4" />
                      </div>
                      <div className="text-xs font-bold text-slate-800">{s.chain}</div>
                      <div className="text-[11px] text-slate-400">Visita: €{s.visit_cost.toFixed(2)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column: Optimization Engine (5 cols) */}
            <div className="space-y-6 lg:col-span-5">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Ottimizzazione Carrello</h2>
                  <p className="text-xs text-slate-500">Google OR-Tools CP-SAT Solver</p>
                </div>

                <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                  <div className="flex justify-between text-xs font-semibold text-slate-700 mb-2">
                    <span>N° Max Supermercati</span>
                    <span className="font-bold text-emerald-700">{maxStores} punti vendita</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="4"
                    value={maxStores}
                    onChange={(e) => setMaxStores(parseInt(e.target.value))}
                    className="w-full accent-emerald-600 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                    <span>1 solo negozio</span>
                    <span>Max 4 negozi</span>
                  </div>
                </div>

                <button
                  onClick={runOptimization}
                  disabled={loading || items.length === 0}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 transition disabled:opacity-50"
                >
                  <Sparkles className="h-4 w-4" />
                  {loading ? 'Calcolo Ottimo in corso...' : 'Calcola Spesa Più Economica'}
                </button>
              </div>

              {/* Optimization Results */}
              {result && (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      <span className="text-sm font-bold text-slate-900">Spesa Ottimizzata</span>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-100">
                      {result.status}
                    </span>
                  </div>

                  {/* Savings Highlight */}
                  {result.estimated_savings_vs_single_store && result.estimated_savings_vs_single_store > 0 && (
                    <div className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 p-3.5 text-white shadow-sm">
                      <div className="text-[11px] font-medium text-emerald-100 uppercase tracking-wider">Risparmio Stimato Famiglia</div>
                      <div className="text-xl font-black mt-0.5">
                        €{result.estimated_savings_vs_single_store.toFixed(2)} risparmiati!
                      </div>
                      <div className="text-[11px] text-emerald-100 mt-0.5">
                        Rispetto al comprare tutto in un unico supermercato più caro.
                      </div>
                    </div>
                  )}

                  {/* Summary Totals */}
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100">
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Costo Totale Prodotti</div>
                      <div className="text-base font-black text-slate-800 mt-0.5">€{result.product_cost.toFixed(2)}</div>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100">
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Costo Visite Negozi</div>
                      <div className="text-base font-black text-slate-800 mt-0.5">€{result.travel_cost.toFixed(2)}</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Tempo risolutore: {result.solver_time_ms} ms
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Layers className="h-3 w-3" />
                      {result.selected_stores.length} supermercati scelti
                    </span>
                  </div>

                  {/* Allocated Stores and items */}
                  <div className="space-y-3 pt-2">
                    <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Dove comprare ({result.selected_stores.length} supermercati scelti):
                    </div>

                    {result.selected_stores.map((alloc) => (
                      <div key={alloc.store_id} className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 space-y-2">
                        <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                          <div className="flex items-center gap-2">
                            <StoreIcon className="h-4 w-4 text-emerald-600" />
                            <span className="text-xs font-bold text-slate-900">{alloc.store_name}</span>
                          </div>
                          <span className="text-xs font-semibold text-slate-600">Subtotale: €{alloc.subtotal_products.toFixed(2)}</span>
                        </div>

                        <div className="space-y-1.5 pt-1">
                          {alloc.items.map((item) => (
                            <div key={item.variant_id} className="flex items-center justify-between text-xs">
                              <div>
                                <span className="font-semibold text-slate-800">{item.package_quantity}x </span>
                                <span className="text-slate-700">{item.variant_name}</span>
                                {item.is_promotion && (
                                  <span className="ml-1.5 inline-block rounded bg-red-100 px-1 text-[10px] font-bold text-red-600">
                                    OFFERTA
                                  </span>
                                )}
                              </div>
                              <span className="font-mono font-medium text-slate-900">€{item.total_price.toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: In-Store Mode */}
        {activeTab === 'instore' && (
          <InStoreModeTab
            selectedStores={result?.selected_stores || []}
            rawItems={items}
            onCompleteShopping={handleCompleteShopping}
            onGoToOptimizer={() => setActiveTab('shopping')}
            onToggleRawItem={handleToggleRawItem}
          />
        )}

        {/* TAB 3: Pantry & TSB Forecast */}
        {activeTab === 'pantry' && (
          <PantryTab
            userId={session.user.id}
            catalogProducts={catalogProducts}
            onAddToList={(item) => {
              if (activeList) {
                addShoppingListItem({
                  list_id: activeList.id,
                  item_name: item.name,
                  product_id: item.item_id,
                  quantity: item.min_quantity,
                  unit: item.base_unit,
                }).then((created) => {
                  if (created) {
                    setItems((prev) => [
                      ...prev,
                      {
                        item_id: created.id,
                        db_id: created.id,
                        name: item.name,
                        min_quantity: item.min_quantity,
                        base_unit: item.base_unit,
                        is_mandatory: true,
                        preferred_brands: [],
                        is_checked: false,
                      },
                    ]);
                  }
                });
              } else {
                setItems((prev) => [...prev, item]);
              }
              setActiveTab('shopping');
            }}
          />
        )}

        {/* TAB 4: Offers Explorer */}
        {activeTab === 'offers' && (
          <OffersTab
            offers={INITIAL_OFFERS}
            onAddOfferToList={(item) => {
              if (activeList) {
                addShoppingListItem({
                  list_id: activeList.id,
                  item_name: item.name,
                  quantity: item.min_quantity,
                  unit: item.base_unit,
                }).then((created) => {
                  if (created) {
                    setItems((prev) => [
                      ...prev,
                      {
                        item_id: created.id,
                        db_id: created.id,
                        name: item.name,
                        min_quantity: item.min_quantity,
                        base_unit: item.base_unit,
                        is_mandatory: true,
                        preferred_brands: [],
                        is_checked: false,
                      },
                    ]);
                  }
                });
              } else {
                setItems((prev) => [...prev, item]);
              }
            }}
          />
        )}

        {/* TAB 5: Receipts & OCR */}
        {activeTab === 'receipts' && <ReceiptsTab />}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur px-2 py-1.5 flex justify-around">
        <button
          onClick={() => setActiveTab('shopping')}
          className={`flex flex-col items-center p-1.5 rounded-lg text-[10px] font-bold transition ${
            activeTab === 'shopping' ? 'text-emerald-600' : 'text-slate-400'
          }`}
        >
          <ShoppingCart className="h-4 w-4 mb-0.5" />
          Spesa
        </button>
        <button
          onClick={() => setActiveTab('instore')}
          className={`flex flex-col items-center p-1.5 rounded-lg text-[10px] font-bold transition ${
            activeTab === 'instore' ? 'text-emerald-600' : 'text-slate-400'
          }`}
        >
          <ShoppingBag className="h-4 w-4 mb-0.5" />
          In-Store
        </button>
        <button
          onClick={() => setActiveTab('pantry')}
          className={`flex flex-col items-center p-1.5 rounded-lg text-[10px] font-bold transition ${
            activeTab === 'pantry' ? 'text-emerald-600' : 'text-slate-400'
          }`}
        >
          <Package className="h-4 w-4 mb-0.5" />
          Dispensa
        </button>
        <button
          onClick={() => setActiveTab('offers')}
          className={`flex flex-col items-center p-1.5 rounded-lg text-[10px] font-bold transition ${
            activeTab === 'offers' ? 'text-emerald-600' : 'text-slate-400'
          }`}
        >
          <Tag className="h-4 w-4 mb-0.5" />
          Offerte
        </button>
        <button
          onClick={() => setActiveTab('receipts')}
          className={`flex flex-col items-center p-1.5 rounded-lg text-[10px] font-bold transition ${
            activeTab === 'receipts' ? 'text-emerald-600' : 'text-slate-400'
          }`}
        >
          <Receipt className="h-4 w-4 mb-0.5" />
          Scontrino
        </button>
      </nav>

      {/* Natural Language Modal */}
      <NaturalLanguageModal
        isOpen={isNlModalOpen}
        onClose={() => setIsNlModalOpen(false)}
        onAddItems={handleAddMultiple}
      />
    </div>
  );
}

export default App;
