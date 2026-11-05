import { createClient, Session, User } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://shiakflrglavejigokig.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_qEztE42l6elMhPbon6oVuA_1FxH2qh4';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export interface CategoryRecord {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  display_order: number;
}

export interface ProductRecord {
  id: string;
  name: string;
  base_unit: string;
  category_id?: string;
  min_stock_level: number;
  reorder_threshold: number;
  is_essential: boolean;
}

export interface ProductVariantRecord {
  id: string;
  product_id: string;
  brand?: string;
  name: string;
  package_size: number;
  package_unit: string;
  base_quantity: number;
  barcode?: string;
}

export interface ShoppingListRecord {
  id: string;
  user_id: string;
  name: string;
  status: 'draft' | 'active' | 'completed' | 'archived';
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface ShoppingListItemRecord {
  id: string;
  list_id: string;
  product_id?: string | null;
  item_name?: string | null;
  preferred_variant_id?: string | null;
  quantity: number;
  unit: string;
  base_quantity?: number | null;
  is_mandatory: boolean;
  preferred_brands: string[];
  notes?: string | null;
  is_checked: boolean;
  created_at: string;
  updated_at: string;
}

export interface InventoryEventRecord {
  id?: string;
  user_id?: string;
  product_id: string;
  variant_id?: string | null;
  purchase_item_id?: string | null;
  event_type: 'purchase' | 'consumption' | 'waste' | 'adjustment' | 'expiration';
  quantity_delta: number;
  base_unit: string;
  notes?: string | null;
  event_date?: string;
}

export interface CurrentInventoryViewItem {
  user_id?: string;
  product_id: string;
  product_name: string;
  category_name?: string;
  base_unit: string;
  min_stock_level: number;
  reorder_threshold: number;
  current_stock: number;
  is_below_reorder_threshold: boolean;
  last_activity_date?: string;
}

// -----------------------------------------------------------------------------
// Authentication Helpers
// -----------------------------------------------------------------------------
export async function signInWithEmail(email: string, password: string): Promise<{ user: User | null; session: Session | null; error: Error | null }> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { user: data.user, session: data.session, error };
}

export async function signUpWithEmail(email: string, password: string): Promise<{ user: User | null; session: Session | null; error: Error | null }> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });
  return { user: data.user, session: data.session, error };
}

export async function signOutUser(): Promise<{ error: Error | null }> {
  const { error } = await supabase.auth.signOut();
  return { error };
}

export async function getCurrentSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

// -----------------------------------------------------------------------------
// Catalog Data Fetching
// -----------------------------------------------------------------------------
export async function fetchCategories(): Promise<CategoryRecord[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('display_order', { ascending: true });

  if (error) {
    console.error('Error fetching categories from Supabase:', error);
    return [];
  }
  return data || [];
}

export async function fetchProducts(): Promise<ProductRecord[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching products from Supabase:', error);
    return [];
  }
  return data || [];
}

export async function fetchProductVariants(): Promise<ProductVariantRecord[]> {
  const { data, error } = await supabase
    .from('product_variants')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching variants from Supabase:', error);
    return [];
  }
  return data || [];
}

// -----------------------------------------------------------------------------
// Realtime Shopping List Management
// -----------------------------------------------------------------------------
export async function getOrCreateActiveShoppingList(userId: string): Promise<ShoppingListRecord | null> {
  try {
    const { data, error } = await supabase
      .from('shopping_lists')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.warn('Error fetching active shopping list:', error);
      return null;
    }

    if (data && data.length > 0) {
      return data[0] as ShoppingListRecord;
    }

    // Create a new active shopping list for this user/family
    const { data: created, error: createError } = await supabase
      .from('shopping_lists')
      .insert({
        user_id: userId,
        name: 'Lista Spesa Famiglia',
        status: 'active',
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating default shopping list:', createError);
      return null;
    }
    return created as ShoppingListRecord;
  } catch (err) {
    console.error('Unexpected error in getOrCreateActiveShoppingList:', err);
    return null;
  }
}

export async function fetchShoppingListItems(listId: string): Promise<ShoppingListItemRecord[]> {
  try {
    const { data, error } = await supabase
      .from('shopping_list_items')
      .select('*')
      .eq('list_id', listId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching shopping list items:', error);
      return [];
    }
    return (data || []) as ShoppingListItemRecord[];
  } catch (err) {
    console.error('Unexpected error in fetchShoppingListItems:', err);
    return [];
  }
}

export async function addShoppingListItem(item: {
  list_id: string;
  item_name: string;
  product_id?: string | null;
  quantity: number;
  unit: string;
  base_quantity?: number | null;
  preferred_brands?: string[];
  is_mandatory?: boolean;
}): Promise<ShoppingListItemRecord | null> {
  try {
    const { data, error } = await supabase
      .from('shopping_list_items')
      .insert({
        list_id: item.list_id,
        item_name: item.item_name,
        product_id: item.product_id || null,
        quantity: item.quantity,
        unit: item.unit,
        base_quantity: item.base_quantity || item.quantity,
        preferred_brands: item.preferred_brands || [],
        is_mandatory: item.is_mandatory ?? true,
        is_checked: false,
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding item to Supabase shopping list:', error);
      return null;
    }
    return data as ShoppingListItemRecord;
  } catch (err) {
    console.error('Unexpected error in addShoppingListItem:', err);
    return null;
  }
}

export async function deleteShoppingListItem(itemId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('shopping_list_items')
      .delete()
      .eq('id', itemId);

    if (error) {
      console.error('Error deleting shopping list item:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Unexpected error in deleteShoppingListItem:', err);
    return false;
  }
}

export async function toggleShoppingListItem(itemId: string, isChecked: boolean): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('shopping_list_items')
      .update({ is_checked: isChecked, updated_at: new Date().toISOString() })
      .eq('id', itemId);

    if (error) {
      console.error('Error toggling shopping list item:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Unexpected error in toggleShoppingListItem:', err);
    return false;
  }
}

export async function subscribeToShoppingList(
  listId: string,
  onChange: () => void
): Promise<() => void> {
  const channel = supabase
    .channel(`realtime_shopping_list_${listId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'shopping_list_items',
        filter: `list_id=eq.${listId}`,
      },
      () => {
        onChange();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// -----------------------------------------------------------------------------
// Realtime Household Inventory Tracking
// -----------------------------------------------------------------------------
export async function fetchCurrentInventory(userId: string): Promise<CurrentInventoryViewItem[]> {
  try {
    const { data, error } = await supabase
      .from('v_current_inventory')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      console.warn('Could not query v_current_inventory:', error);
      return [];
    }
    return (data || []) as CurrentInventoryViewItem[];
  } catch (err) {
    console.error('Unexpected error in fetchCurrentInventory:', err);
    return [];
  }
}

export async function recordInventoryEvent(event: InventoryEventRecord): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('inventory_events')
      .insert(event);

    if (error) {
      console.error('Error recording inventory event:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Unexpected error in recordInventoryEvent:', err);
    return false;
  }
}

export async function subscribeToInventory(
  userId: string,
  onChange: () => void
): Promise<() => void> {
  const channel = supabase
    .channel(`realtime_inventory_${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'inventory_events',
        filter: `user_id=eq.${userId}`,
      },
      () => {
        onChange();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export interface SupabaseOfferRecord {
  offer_id: string;
  store_id: string;
  store_name: string;
  store_chain: string;
  variant_id: string;
  variant_name: string;
  brand?: string;
  variant_brand?: string;
  product_id: string;
  product_name: string;
  price: number;
  standard_price?: number;
  price_per_base_unit: number;
  base_unit: string;
  package_size?: number;
  package_unit?: string;
  base_quantity: number;
  is_promotion: boolean;
  promo_description?: string;
  observed_at: string;
}

export async function fetchLatestOffers(): Promise<SupabaseOfferRecord[]> {
  try {
    const { data, error } = await supabase
      .from('v_latest_offers')
      .select('*')
      .order('price', { ascending: true });

    if (error) {
      console.warn('Could not query v_latest_offers:', error);
      return [];
    }
    return (data || []) as SupabaseOfferRecord[];
  } catch (err) {
    console.error('Unexpected error in fetchLatestOffers:', err);
    return [];
  }
}
