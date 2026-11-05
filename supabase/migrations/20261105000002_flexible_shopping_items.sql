-- Migration: Flexible Shopping List Items & Realtime Publication
-- Enables free-text item names in shopping lists without requiring a predefined catalog product
-- Enables Supabase Realtime for instant synchronization across family devices

-- 1. Relax foreign key and base_quantity requirements for free-form shopping list entries
ALTER TABLE shopping_list_items ALTER COLUMN product_id DROP NOT NULL;
ALTER TABLE shopping_list_items ALTER COLUMN base_quantity DROP NOT NULL;
ALTER TABLE shopping_list_items ADD COLUMN IF NOT EXISTS item_name TEXT;

-- 2. Update view to ensure security_invoker is enabled so RLS works cleanly
CREATE OR REPLACE VIEW v_current_inventory 
WITH (security_invoker = true) AS
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

-- 3. Add tables to Supabase Realtime publication
DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE shopping_lists;
    EXCEPTION WHEN duplicate_object THEN
        NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE shopping_list_items;
    EXCEPTION WHEN duplicate_object THEN
        NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE inventory_events;
    EXCEPTION WHEN duplicate_object THEN
        NULL;
    END;
END $$;
