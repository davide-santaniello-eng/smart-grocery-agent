-- Migration: Allow public (anon + authenticated) read access to global catalog
-- File: supabase/migrations/20261105000001_public_catalog_rls.sql

-- 1. Categories
DROP POLICY IF EXISTS "Categories are readable by authenticated users" ON categories;
CREATE POLICY "Categories are readable by everyone"
ON categories FOR SELECT
TO anon, authenticated
USING (true);

-- 2. Products (Global items where user_id IS NULL are public, personal items require auth.uid())
DROP POLICY IF EXISTS "Users can view global and personal products" ON products;
CREATE POLICY "Users can view global and personal products"
ON products FOR SELECT
TO anon, authenticated
USING (user_id IS NULL OR user_id = auth.uid());

-- 3. Product Variants (viewable if parent product is viewable)
DROP POLICY IF EXISTS "Users can view product variants" ON product_variants;
CREATE POLICY "Users can view product variants"
ON product_variants FOR SELECT
TO anon, authenticated
USING (
    EXISTS (
        SELECT 1 FROM products p
        WHERE p.id = product_variants.product_id
          AND (p.user_id IS NULL OR p.user_id = auth.uid())
    )
);
