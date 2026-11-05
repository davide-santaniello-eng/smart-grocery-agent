-- =============================================================================
-- SMART GROCERY AGENT - SEED DATA
-- Database: PostgreSQL (Supabase)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Standard Categories
-- -----------------------------------------------------------------------------
INSERT INTO categories (id, name, slug, icon, display_order) VALUES
('c1000000-0000-0000-0000-000000000001', 'Dispensa', 'dispensa', 'package', 1),
('c1000000-0000-0000-0000-000000000002', 'Pasta, Riso e Farine', 'pasta-riso-farine', 'wheat', 2),
('c1000000-0000-0000-0000-000000000003', 'Latte, Latticini e Uova', 'latticini-uova', 'milk', 3),
('c1000000-0000-0000-0000-000000000004', 'Frutta e Verdura', 'frutta-verdura', 'apple', 4),
('c1000000-0000-0000-0000-000000000005', 'Carne e Pesce', 'carne-pesce', 'beef', 5),
('c1000000-0000-0000-0000-000000000006', 'Colazione e Dolci', 'colazione-dolci', 'cookie', 6),
('c1000000-0000-0000-0000-000000000007', 'Acqua e Bevande', 'bevande', 'coffee', 7),
('c1000000-0000-0000-0000-000000000008', 'Cura della Casa', 'cura-casa', 'home', 8),
('c1000000-0000-0000-0000-000000000009', 'Igiene Personale', 'igiene-personale', 'sparkles', 9)
ON CONFLICT (slug) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 2. System Canonical Products (Global catalog, user_id IS NULL)
-- -----------------------------------------------------------------------------
INSERT INTO products (id, user_id, category_id, name, description, base_unit, default_shelf_life_days, min_stock_level, reorder_threshold, is_essential) VALUES
-- Pasta e Riso (base_unit = g)
('p1000000-0000-0000-0000-000000000001', NULL, 'c1000000-0000-0000-0000-000000000002', 'Spaghetti', 'Spaghetti di semola di grano duro classici', 'g', 720, 500, 1000, true),
('p1000000-0000-0000-0000-000000000002', NULL, 'c1000000-0000-0000-0000-000000000002', 'Penne Rigate', 'Penne rigate di semola di grano duro', 'g', 720, 500, 1000, true),
('p1000000-0000-0000-0000-000000000003', NULL, 'c1000000-0000-0000-0000-000000000002', 'Riso Carnaroli', 'Riso superfino per risotti', 'g', 720, 500, 1000, false),

-- Dispensa (base_unit = g or ml)
('p1000000-0000-0000-0000-000000000004', NULL, 'c1000000-0000-0000-0000-000000000001', 'Passata di Pomodoro', 'Passata densa di pomodori 100% italiani', 'g', 720, 700, 1400, true),
('p1000000-0000-0000-0000-000000000005', NULL, 'c1000000-0000-0000-0000-000000000001', 'Olio Extra Vergine di Oliva', 'Olio EVO 100% italiano estratto a freddo', 'ml', 365, 500, 1000, true),

-- Latte, Latticini e Uova
('p1000000-0000-0000-0000-000000000006', NULL, 'c1000000-0000-0000-0000-000000000003', 'Latte Parzialmente Scremato UHT', 'Latte UHT a lunga conservazione', 'ml', 90, 1000, 2000, true),
('p1000000-0000-0000-0000-000000000007', NULL, 'c1000000-0000-0000-0000-000000000003', 'Uova Fresche Medie', 'Uova fresche da allevamento a terra', 'unit', 28, 4, 6, true),
('p1000000-0000-0000-0000-000000000008', NULL, 'c1000000-0000-0000-0000-000000000003', 'Parmigiano Reggiano DOP', 'Stagionatura minima 24 mesi grattugiato o a pezzi', 'g', 60, 200, 300, true),

-- Colazione e Bevande
('p1000000-0000-0000-0000-000000000009', NULL, 'c1000000-0000-0000-0000-000000000006', 'Caffè Macinato per Moka', 'Miscela di caffè tostato e macinato', 'g', 365, 250, 500, true),
('p1000000-0000-0000-0000-000000000010', NULL, 'c1000000-0000-0000-0000-000000000007', 'Acqua Naturale', 'Acqua minerale naturale oligominerale', 'ml', 365, 3000, 6000, true)
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 3. Product Variants (Concrete purchasable configurations)
-- -----------------------------------------------------------------------------
INSERT INTO product_variants (id, product_id, brand, name, package_size, package_unit, base_quantity, barcode, is_favorite) VALUES
-- Spaghetti
('v1000000-0000-0000-0000-000000000001', 'p1000000-0000-0000-0000-000000000001', 'Barilla', 'Spaghetti N. 5 Barilla 500g', 500, 'g', 500, '8076809513753', true),
('v1000000-0000-0000-0000-000000000002', 'p1000000-0000-0000-0000-000000000001', 'De Cecco', 'Spaghetti N. 12 De Cecco 500g', 500, 'g', 500, '8001250120128', false),
('v1000000-0000-0000-0000-000000000003', 'p1000000-0000-0000-0000-000000000001', 'Smart / Brand Retailer', 'Spaghetti Formato Convenienza 1kg', 1, 'kg', 1000, '8000000000001', false),

-- Penne Rigate
('v1000000-0000-0000-0000-000000000004', 'p1000000-0000-0000-0000-000000000002', 'Barilla', 'Penne Rigate N. 73 Barilla 500g', 500, 'g', 500, '8076809513739', true),
('v1000000-0000-0000-0000-000000000005', 'p1000000-0000-0000-0000-000000000002', 'Garofalo', 'Penne Ziti Rigate Garofalo 500g', 500, 'g', 500, '8000130000108', false),

-- Passata
('v1000000-0000-0000-0000-000000000006', 'p1000000-0000-0000-0000-000000000004', 'Mutti', 'Passata di Pomodoro Mutti 700g', 700, 'g', 700, '8005110170108', true),
('v1000000-0000-0000-0000-000000000007', 'p1000000-0000-0000-0000-000000000004', 'Cirio', 'Passata Verace Cirio 700g', 700, 'g', 700, '8000500001002', false),

-- Olio EVO
('v1000000-0000-0000-0000-000000000008', 'p1000000-0000-0000-0000-000000000005', 'Monini', 'Olio Extra Vergine Classico Monini 1L', 1, 'l', 1000, '8005510000012', true),
('v1000000-0000-0000-0000-000000000009', 'p1000000-0000-0000-0000-000000000005', 'Carapelli', 'Olio Extra Vergine Il Frantolio Carapelli 1L', 1, 'l', 1000, '8002410012015', false),

-- Latte UHT
('v1000000-0000-0000-0000-000000000010', 'p1000000-0000-0000-0000-000000000006', 'Granarolo', 'Latte UHT Parzialmente Scremato Granarolo 1L', 1, 'l', 1000, '8002660000021', true),
('v1000000-0000-0000-0000-000000000011', 'p1000000-0000-0000-0000-000000000006', 'Parmalat', 'Latte Bontà e Linea Parmalat UHT 1L', 1, 'l', 1000, '8002580000030', false),

-- Uova Medie
('v1000000-0000-0000-0000-000000000012', 'p1000000-0000-0000-0000-000000000007', 'Le Naturelle', 'Uova Fresche da Allevamento a Terra conf. da 6', 6, 'pz', 6, '8001000000010', true),
('v1000000-0000-0000-0000-000000000013', 'p1000000-0000-0000-0000-000000000007', 'Ovito', 'Uova Fresche Medie Ovito conf. da 10', 10, 'pz', 10, '8001000000020', false),

-- Caffè
('v1000000-0000-0000-0000-000000000014', 'p1000000-0000-0000-0000-000000000009', 'Lavazza', 'Caffè Macinato Qualità Rossa Lavazza 250g', 250, 'g', 250, '8000070001001', true),
('v1000000-0000-0000-0000-000000000015', 'p1000000-0000-0000-0000-000000000009', 'Illy', 'Caffè Macinato Classico Illy 250g', 250, 'g', 250, '8001100000014', false)
ON CONFLICT (id) DO NOTHING;
