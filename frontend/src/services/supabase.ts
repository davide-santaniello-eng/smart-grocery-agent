import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://shiakflrglavejigokig.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_qEztE42l6elMhPbon6oVuA_1FxH2qh4';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
