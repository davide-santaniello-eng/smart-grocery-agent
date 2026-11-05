export interface ItemRequirement {
  item_id: string;
  name: string;
  min_quantity: number;
  base_unit: string;
  max_quantity?: number | null;
  is_mandatory: boolean;
  preferred_brands: string[];
  db_id?: string;
  is_checked?: boolean;
}

export interface Store {
  store_id: string;
  name: string;
  chain: string;
  visit_cost: number;
}

export interface ProductOffer {
  offer_id: string;
  store_id: string;
  item_id: string;
  variant_id: string;
  variant_name: string;
  brand?: string;
  package_price: number;
  package_base_quantity: number;
  is_promotion: boolean;
  promo_description?: string;
}

export interface AllocatedItem {
  item_id: string;
  item_name: string;
  variant_id: string;
  variant_name: string;
  brand?: string;
  package_quantity: number;
  unit_price: number;
  total_price: number;
  base_quantity_per_pack: number;
  total_base_quantity: number;
  is_promotion: boolean;
}

export interface StoreAllocation {
  store_id: string;
  store_name: string;
  store_chain: string;
  visit_cost: number;
  items: AllocatedItem[];
  subtotal_products: number;
}

export interface OptimizationResult {
  status: 'OPTIMAL' | 'FEASIBLE' | 'INFEASIBLE' | 'UNKNOWN';
  total_cost: number;
  product_cost: number;
  travel_cost: number;
  estimated_savings_vs_single_store?: number | null;
  selected_stores: StoreAllocation[];
  unfulfilled_items: string[];
  solver_time_ms: number;
}
