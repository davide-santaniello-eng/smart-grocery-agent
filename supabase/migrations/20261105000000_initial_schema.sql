-- =============================================================================
-- SMART GROCERY AGENT - INITIAL DATABASE SCHEMA
-- Migration: 20261105000000_initial_schema.sql
-- Database: PostgreSQL (Supabase)
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- 1. UTILITY FUNCTIONS & ENUMS
-- =============================================================================

-- Function to automatically maintain updated_at timestamps
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Standard unit conversion helper to normalize quantities to base units:
-- Base units: 'g' for mass, 'ml' for volume, 'unit' for piece count.
CREATE OR REPLACE FUNCTION to_base_quantity(amount NUMERIC, unit TEXT)
RETURNS NUMERIC AS $$
BEGIN
    CASE LOWER(TRIM(unit))
        -- Mass -> grams (g)
        WHEN 'g' THEN RETURN amount;
        WHEN 'kg' THEN RETURN amount * 1000.0;
        WHEN 'mg' THEN RETURN amount / 1000.0;
        
        -- Volume -> milliliters (ml)
        WHEN 'ml' THEN RETURN amount;
        WHEN 'cl' THEN RETURN amount * 10.0;
        WHEN 'dl' THEN RETURN amount * 100.0;
        WHEN 'l', 'lt', 'litro', 'litri' THEN RETURN amount * 1000.0;

        -- Pieces / Units -> unit
        WHEN 'unit', 'pz', 'pezzo', 'pezzi', 'pack', 'conf', 'confezione' THEN RETURN amount;

        ELSE
            -- Default fallback: return amount as is
            RETURN amount;
    END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Determine the base unit corresponding to an input unit
CREATE OR REPLACE FUNCTION get_base_unit(unit TEXT)
RETURNS TEXT AS $$
BEGIN
    CASE LOWER(TRIM(unit))
        WHEN 'g', 'kg', 'mg' THEN RETURN 'g';
        WHEN 'ml', 'cl', 'dl', 'l', 'lt', 'litro', 'litri' THEN RETURN 'ml';
        ELSE RETURN 'unit';
    END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =============================================================================
-- 2. USER PROFILES & SETTINGS
-- =============================================================================

CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    full_name TEXT,
    default_currency TEXT NOT NULL DEFAULT 'EUR',
    max_stores_per_trip INT NOT NULL DEFAULT 2 CHECK (max_stores_per_trip >= 1),
    default_visit_cost NUMERIC(6, 2) NOT NULL DEFAULT 2.00 CHECK (default_visit_cost >= 0),
    travel_cost_per_km NUMERIC(5, 2) NOT NULL DEFAULT 0.35 CHECK (travel_cost_per_km >= 0),
    home_address TEXT,
    home_latitude NUMERIC(9, 6),
    home_longitude NUMERIC(9, 6),
    preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON profiles
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================================
-- 3. PRODUCT CATALOG & STORES
-- =============================================================================

-- Categories hierarchy (e.g., Dispensa -> Pasta, Latticini -> Latte)
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    icon TEXT,
    display_order INT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Canonical Products (independent of brand and packaging)
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- NULL = System default, NOT NULL = User custom
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    base_unit TEXT NOT NULL CHECK (base_unit IN ('g', 'ml', 'unit')),
    default_shelf_life_days INT CHECK (default_shelf_life_days > 0),
    min_stock_level NUMERIC(10, 2) DEFAULT 0 CHECK (min_stock_level >= 0),
    reorder_threshold NUMERIC(10, 2) DEFAULT 0 CHECK (reorder_threshold >= 0),
    is_essential BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_products_updated_at
BEFORE UPDATE ON products
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Product Variants (concrete purchasable items: Brand + Package size)
CREATE TABLE IF NOT EXISTS product_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    brand TEXT,
    name TEXT NOT NULL, -- e.g. "Spaghetti N. 5 500g"
    package_size NUMERIC(10, 2) NOT NULL CHECK (package_size > 0),
    package_unit TEXT NOT NULL, -- e.g. 'g', 'kg', 'ml', 'l', 'pz'
    base_quantity NUMERIC(10, 2) NOT NULL CHECK (base_quantity > 0), -- Normalized amount in base_unit (e.g. 500 for 500g, 1000 for 1kg)
    barcode TEXT, -- EAN-13, UPC
    is_favorite BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_product_variants_updated_at
BEFORE UPDATE ON product_variants
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Stores (Supermarket physical locations)
CREATE TABLE IF NOT EXISTS stores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- e.g. "Esselunga - Via Washington"
    chain TEXT NOT NULL, -- e.g. "Esselunga", "Coop", "Conad", "Lidl"
    address TEXT,
    latitude NUMERIC(9, 6),
    longitude NUMERIC(9, 6),
    distance_km NUMERIC(5, 2), -- Distance from user's home
    visit_cost_override NUMERIC(6, 2) CHECK (visit_cost_override >= 0), -- If null, use profile default
    is_active BOOLEAN NOT NULL DEFAULT true,
    opening_hours JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_stores_updated_at
BEFORE UPDATE ON stores
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- External Products mapping (for ingested offers from APIs, scraping, flyers)
CREATE TABLE IF NOT EXISTS external_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL, -- e.g. 'promo_api', 'doveconviene', 'bring', 'manual'
    external_id TEXT NOT NULL,
    external_name TEXT NOT NULL,
    variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
    match_confidence NUMERIC(3, 2) CHECK (match_confidence BETWEEN 0.00 AND 1.00),
    raw_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_external_provider_id UNIQUE (provider, external_id)
);

CREATE TRIGGER trg_external_products_updated_at
BEFORE UPDATE ON external_products
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================================
-- 4. OFFERS & PRICE HISTORY
-- =============================================================================

CREATE TABLE IF NOT EXISTS store_offers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
    price NUMERIC(10, 2) NOT NULL CHECK (price >= 0), -- Package price in EUR
    standard_price NUMERIC(10, 2) CHECK (standard_price >= price), -- Regular price before discount
    price_per_base_unit NUMERIC(10, 4) NOT NULL CHECK (price_per_base_unit >= 0), -- e.g. Price per gram or ml
    is_promotion BOOLEAN NOT NULL DEFAULT false,
    promo_description TEXT, -- e.g. "-30% con carta fedeltà", "1+1 gratis"
    valid_from TIMESTAMPTZ,
    valid_to TIMESTAMPTZ,
    source TEXT NOT NULL DEFAULT 'manual', -- 'manual', 'flyer', 'receipt', 'api'
    confidence NUMERIC(3, 2) NOT NULL DEFAULT 1.00 CHECK (confidence BETWEEN 0.00 AND 1.00),
    observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast retrieval of latest offers for a store & variant
CREATE INDEX IF NOT EXISTS idx_store_offers_lookup 
ON store_offers (store_id, variant_id, observed_at DESC);

CREATE INDEX IF NOT EXISTS idx_store_offers_variant 
ON store_offers (variant_id, observed_at DESC);

-- =============================================================================
-- 5. SHOPPING LISTS & ITEMS
-- =============================================================================

CREATE TABLE IF NOT EXISTS shopping_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT 'Lista della Spesa',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'completed', 'archived')),
    budget_limit NUMERIC(10, 2) CHECK (budget_limit > 0),
    max_stores INT CHECK (max_stores >= 1),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_shopping_lists_updated_at
BEFORE UPDATE ON shopping_lists
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS shopping_list_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    list_id UUID NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    preferred_variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
    quantity NUMERIC(10, 2) NOT NULL CHECK (quantity > 0), -- Requested quantity
    unit TEXT NOT NULL, -- 'g', 'kg', 'l', 'pz', etc.
    base_quantity NUMERIC(10, 2) NOT NULL CHECK (base_quantity > 0), -- Converted amount in product's base_unit
    is_mandatory BOOLEAN NOT NULL DEFAULT true,
    max_acceptable_quantity NUMERIC(10, 2) CHECK (max_acceptable_quantity >= quantity),
    preferred_brands TEXT[] NOT NULL DEFAULT '{}',
    notes TEXT,
    is_checked BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_shopping_list_items_updated_at
BEFORE UPDATE ON shopping_list_items
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================================
-- 6. SHOPPING OPTIMIZATION PLANS
-- =============================================================================

CREATE TABLE IF NOT EXISTS shopping_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    shopping_list_id UUID REFERENCES shopping_lists(id) ON DELETE SET NULL,
    status TEXT NOT NULL CHECK (status IN ('optimal', 'feasible', 'infeasible', 'unknown')),
    total_product_cost NUMERIC(10, 2) NOT NULL CHECK (total_product_cost >= 0),
    total_travel_cost NUMERIC(10, 2) NOT NULL CHECK (total_travel_cost >= 0),
    total_cost NUMERIC(10, 2) NOT NULL CHECK (total_cost >= 0),
    estimated_savings NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    selected_store_ids UUID[] NOT NULL DEFAULT '{}',
    solver_details JSONB NOT NULL DEFAULT '{}'::jsonb, -- Execution time, iterations, penalty weights
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shopping_plan_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES shopping_plans(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
    variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
    offer_id UUID REFERENCES store_offers(id) ON DELETE SET NULL,
    package_quantity INT NOT NULL CHECK (package_quantity > 0),
    total_base_quantity NUMERIC(10, 2) NOT NULL CHECK (total_base_quantity > 0),
    unit_price NUMERIC(10, 2) NOT NULL CHECK (unit_price >= 0),
    total_price NUMERIC(10, 2) NOT NULL CHECK (total_price >= 0),
    is_purchased BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- 7. PURCHASES & INVENTORY EVENTS
-- =============================================================================

CREATE TABLE IF NOT EXISTS purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
    plan_id UUID REFERENCES shopping_plans(id) ON DELETE SET NULL,
    purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
    total_amount NUMERIC(10, 2) NOT NULL CHECK (total_amount >= 0),
    receipt_image_url TEXT,
    source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'plan_checkout', 'ocr')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_id UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
    custom_product_name TEXT, -- Used if variant not in catalog
    package_quantity INT NOT NULL DEFAULT 1 CHECK (package_quantity > 0),
    total_base_quantity NUMERIC(10, 2) NOT NULL CHECK (total_base_quantity > 0),
    unit_price NUMERIC(10, 2) NOT NULL CHECK (unit_price >= 0),
    total_price NUMERIC(10, 2) NOT NULL CHECK (total_price >= 0),
    expiration_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Event-driven household inventory tracking
CREATE TABLE IF NOT EXISTS inventory_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
    purchase_item_id UUID REFERENCES purchase_items(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('purchase', 'consumption', 'waste', 'adjustment', 'expiration')),
    quantity_delta NUMERIC(10, 2) NOT NULL, -- Positive for additions, negative for reductions
    base_unit TEXT NOT NULL CHECK (base_unit IN ('g', 'ml', 'unit')),
    event_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_events_user_prod 
ON inventory_events (user_id, product_id, event_date DESC);

-- Automatic inventory event insertion when a purchase item with linked variant is inserted
CREATE OR REPLACE FUNCTION trg_purchase_item_to_inventory()
RETURNS TRIGGER AS $$
DECLARE
    v_product_id UUID;
    v_base_unit TEXT;
    v_user_id UUID;
BEGIN
    IF NEW.variant_id IS NOT NULL THEN
        SELECT p.id, p.base_unit, pr.user_id 
        INTO v_product_id, v_base_unit, v_user_id
        FROM product_variants pv
        JOIN products p ON p.id = pv.product_id
        JOIN purchases pr ON pr.id = NEW.purchase_id
        WHERE pv.id = NEW.variant_id;

        IF v_product_id IS NOT NULL THEN
            INSERT INTO inventory_events (
                user_id,
                product_id,
                variant_id,
                purchase_item_id,
                event_type,
                quantity_delta,
                base_unit,
                event_date,
                notes
            ) VALUES (
                v_user_id,
                v_product_id,
                NEW.variant_id,
                NEW.id,
                'purchase',
                NEW.total_base_quantity,
                v_base_unit,
                NOW(),
                'Acquisto registrato'
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_after_purchase_item_insert
AFTER INSERT ON purchase_items
FOR EACH ROW EXECUTE FUNCTION trg_purchase_item_to_inventory();

-- =============================================================================
-- 8. CONSUMPTION INTELLIGENCE & FORECASTING
-- =============================================================================

CREATE TABLE IF NOT EXISTS consumption_estimates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    daily_avg_consumption NUMERIC(10, 4) NOT NULL DEFAULT 0 CHECK (daily_avg_consumption >= 0),
    consumption_std_dev NUMERIC(10, 4) DEFAULT 0 CHECK (consumption_std_dev >= 0),
    predicted_depletion_date TIMESTAMPTZ,
    suggested_reorder_date TIMESTAMPTZ,
    suggested_reorder_quantity NUMERIC(10, 2) CHECK (suggested_reorder_quantity >= 0),
    confidence_score NUMERIC(3, 2) CHECK (confidence_score BETWEEN 0.00 AND 1.00),
    model_metadata JSONB DEFAULT '{}'::jsonb,
    last_calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_product_estimate UNIQUE (user_id, product_id)
);

CREATE TRIGGER trg_consumption_estimates_updated_at
BEFORE UPDATE ON consumption_estimates
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================================
-- 9. REAL-TIME VIEWS
-- =============================================================================

-- Real-time stock view aggregating inventory events
CREATE OR REPLACE VIEW v_current_inventory AS
SELECT 
    ie.user_id,
    ie.product_id,
    p.name AS product_name,
    c.name AS category_name,
    p.base_unit,
    p.min_stock_level,
    p.reorder_threshold,
    COALESCE(SUM(ie.quantity_delta), 0) AS current_stock,
    CASE 
        WHEN COALESCE(SUM(ie.quantity_delta), 0) <= p.reorder_threshold THEN true 
        ELSE false 
    END AS is_below_reorder_threshold,
    MAX(ie.event_date) AS last_activity_date
FROM inventory_events ie
JOIN products p ON p.id = ie.product_id
LEFT JOIN categories c ON c.id = p.category_id
GROUP BY ie.user_id, ie.product_id, p.name, c.name, p.base_unit, p.min_stock_level, p.reorder_threshold;

-- Latest available offer per store & variant
CREATE OR REPLACE VIEW v_latest_offers AS
SELECT DISTINCT ON (so.store_id, so.variant_id)
    so.id AS offer_id,
    so.store_id,
    s.name AS store_name,
    s.chain AS store_chain,
    so.variant_id,
    pv.name AS variant_name,
    pv.brand AS variant_brand,
    p.id AS product_id,
    p.name AS product_name,
    p.base_unit,
    pv.base_quantity,
    so.price,
    so.standard_price,
    so.price_per_base_unit,
    so.is_promotion,
    so.promo_description,
    so.valid_from,
    so.valid_to,
    so.source,
    so.confidence,
    so.observed_at
FROM store_offers so
JOIN stores s ON s.id = so.store_id
JOIN product_variants pv ON pv.id = so.variant_id
JOIN products p ON p.id = pv.product_id
WHERE s.is_active = true
  AND (so.valid_to IS NULL OR so.valid_to >= NOW())
ORDER BY so.store_id, so.variant_id, so.observed_at DESC;

-- =============================================================================
-- 10. ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_plan_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE consumption_estimates ENABLE ROW LEVEL SECURITY;

-- 1. Profiles: users can only manage their own profile
CREATE POLICY "Users can manage their own profile"
ON profiles FOR ALL
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 2. Categories: everyone authenticated can read categories
CREATE POLICY "Categories are readable by authenticated users"
ON categories FOR SELECT
TO authenticated
USING (true);

-- 3. Products: Users can view global products (user_id IS NULL) or their own, and insert/update their own
CREATE POLICY "Users can view global and personal products"
ON products FOR SELECT
TO authenticated
USING (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY "Users can manage their own products"
ON products FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 4. Product Variants: Viewable if product is viewable, manageable if product is owned
CREATE POLICY "Users can view product variants"
ON product_variants FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM products p
        WHERE p.id = product_variants.product_id
          AND (p.user_id IS NULL OR p.user_id = auth.uid())
    )
);

CREATE POLICY "Users can manage their own product variants"
ON product_variants FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM products p
        WHERE p.id = product_variants.product_id
          AND p.user_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM products p
        WHERE p.id = product_variants.product_id
          AND p.user_id = auth.uid()
    )
);

-- 5. Stores: User-owned
CREATE POLICY "Users can manage their stores"
ON stores FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 6. External Products: Viewable by authenticated, insert/update by authenticated
CREATE POLICY "External products are readable by authenticated users"
ON external_products FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "External products can be inserted or updated by authenticated users"
ON external_products FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 7. Store Offers: Accessible if user owns the associated store
CREATE POLICY "Users can manage offers for their stores"
ON store_offers FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM stores s
        WHERE s.id = store_offers.store_id
          AND s.user_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM stores s
        WHERE s.id = store_offers.store_id
          AND s.user_id = auth.uid()
    )
);

-- 8. Shopping Lists & Items
CREATE POLICY "Users can manage their shopping lists"
ON shopping_lists FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can manage their shopping list items"
ON shopping_list_items FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM shopping_lists sl
        WHERE sl.id = shopping_list_items.list_id
          AND sl.user_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM shopping_lists sl
        WHERE sl.id = shopping_list_items.list_id
          AND sl.user_id = auth.uid()
    )
);

-- 9. Shopping Plans & Items
CREATE POLICY "Users can manage their shopping plans"
ON shopping_plans FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can manage their shopping plan items"
ON shopping_plan_items FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM shopping_plans sp
        WHERE sp.id = shopping_plan_items.plan_id
          AND sp.user_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM shopping_plans sp
        WHERE sp.id = shopping_plan_items.plan_id
          AND sp.user_id = auth.uid()
    )
);

-- 10. Purchases & Items
CREATE POLICY "Users can manage their purchases"
ON purchases FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can manage their purchase items"
ON purchase_items FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM purchases p
        WHERE p.id = purchase_items.purchase_id
          AND p.user_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM purchases p
        WHERE p.id = purchase_items.purchase_id
          AND p.user_id = auth.uid()
    )
);

-- 11. Inventory Events
CREATE POLICY "Users can manage their inventory events"
ON inventory_events FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 12. Consumption Estimates
CREATE POLICY "Users can manage their consumption estimates"
ON consumption_estimates FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
