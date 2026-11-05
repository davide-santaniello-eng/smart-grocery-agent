-- Migration: Public Stores & Store Offers RLS
-- Allows public/authenticated reading of global supermarket stores, offers, and flyer promotions

-- 1. Stores: allow viewing global stores (user_id IS NULL) and personal stores
DROP POLICY IF EXISTS "Users can manage their stores" ON stores;
DROP POLICY IF EXISTS "Users can view global and personal stores" ON stores;
CREATE POLICY "Users can view global and personal stores"
ON stores FOR SELECT
TO anon, authenticated
USING (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY "Users can manage their own stores"
ON stores FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 2. Store Offers: allow viewing offers for accessible stores
DROP POLICY IF EXISTS "Users can manage offers for their stores" ON store_offers;
DROP POLICY IF EXISTS "Users can view store offers" ON store_offers;
CREATE POLICY "Users can view store offers"
ON store_offers FOR SELECT
TO anon, authenticated
USING (
    EXISTS (
        SELECT 1 FROM stores s
        WHERE s.id = store_offers.store_id
          AND (s.user_id IS NULL OR s.user_id = auth.uid())
    )
);

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

-- 3. Update v_latest_offers view with security_invoker = true
CREATE OR REPLACE VIEW v_latest_offers 
WITH (security_invoker = true) AS
SELECT DISTINCT ON (so.store_id, so.variant_id)
    so.id AS offer_id,
    so.store_id,
    s.name AS store_name,
    s.chain AS store_chain,
    so.variant_id,
    pv.name AS variant_name,
    pv.brand,
    p.id AS product_id,
    p.name AS product_name,
    so.price,
    so.standard_price,
    so.price_per_base_unit,
    p.base_unit,
    pv.package_size,
    pv.package_unit,
    pv.base_quantity,
    so.is_promotion,
    so.promo_description,
    so.valid_from,
    so.valid_to,
    so.observed_at
FROM store_offers so
JOIN stores s ON s.id = so.store_id
JOIN product_variants pv ON pv.id = so.variant_id
JOIN products p ON p.id = pv.product_id
ORDER BY so.store_id, so.variant_id, so.observed_at DESC;
