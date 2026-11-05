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
// Data Fetching
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
