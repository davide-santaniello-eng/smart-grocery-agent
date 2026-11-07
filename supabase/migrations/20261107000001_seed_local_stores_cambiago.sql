-- Migration: Seed 18 Local Supermarkets for Cambiago & surrounding area
-- Real stores with distance scores, realistic travel costs and localized flyer offers

INSERT INTO stores (id, user_id, name, chain, address, distance_km, visit_cost_override, is_active) VALUES
-- Score 1: Vicinissimi (Cambiago)
('e2000000-0000-0000-0000-000000000001', NULL, 'Il Gigante Supermercati', 'Il Gigante', 'Via per Cavenago, Cambiago', 0.8, 0.50, true),
('e2000000-0000-0000-0000-000000000002', NULL, 'MD S.p.A.', 'MD', 'Via delle Industrie, Cambiago', 1.0, 0.50, true),

-- Score 2: A pochi minuti (Gorgonzola, Caponago, Cavenago, Pessano, Agrate)
('e2000000-0000-0000-0000-000000000003', NULL, 'Famila Superstore', 'Famila', 'Via Trieste, Gorgonzola', 4.5, 1.20, true),
('e2000000-0000-0000-0000-000000000004', NULL, 'CONAD', 'Conad', 'Piazza Italia, Gorgonzola', 4.2, 1.20, true),
('e2000000-0000-0000-0000-000000000005', NULL, 'Carrefour Market', 'Carrefour', 'Via Matteotti, Gorgonzola', 4.8, 1.20, true),
('e2000000-0000-0000-0000-000000000006', NULL, 'Crai', 'Crai', 'Via Roma, Gorgonzola', 4.0, 1.20, true),
('e2000000-0000-0000-0000-000000000007', NULL, 'Carrefour Express', 'Carrefour', 'Via Roma, Caponago', 3.5, 1.20, true),
('e2000000-0000-0000-0000-000000000008', NULL, 'CRAI', 'Crai', 'Via 24 Maggio, Cavenago di Brianza', 2.8, 1.20, true),
('e2000000-0000-0000-0000-000000000009', NULL, 'iN''s Mercato', 'iN''s', 'Via Tobagi, Pessano con Bornago', 5.0, 1.20, true),
('e2000000-0000-0000-0000-000000000010', NULL, 'Unes', 'Unes', 'Via Porta, Pessano con Bornago', 5.2, 1.20, true),
('e2000000-0000-0000-0000-000000000011', NULL, 'CONAD', 'Conad', 'Via Matteotti, Agrate Brianza', 6.0, 1.20, true),
('e2000000-0000-0000-0000-000000000012', NULL, 'Unes', 'Unes', 'Via Ghiringhelli, Agrate Brianza', 6.2, 1.20, true),

-- Score 3: Più distanti (Carugate, Bussero, Cassina de'' Pecchi, Melzo)
('e2000000-0000-0000-0000-000000000013', NULL, 'Carrefour Iper (Carosello)', 'Carrefour', 'C.C. Carosello, Carugate', 9.5, 2.00, true),
('e2000000-0000-0000-0000-000000000014', NULL, 'Coop', 'Coop', 'Via Europa, Bussero', 7.5, 1.80, true),
('e2000000-0000-0000-0000-000000000015', NULL, 'OKSIGMA', 'Sigma', 'Via San Rocco, Bussero', 7.2, 1.80, true),
('e2000000-0000-0000-0000-000000000016', NULL, 'Unes', 'Unes', 'Via Roma, Cassina de'' Pecchi', 7.8, 1.80, true),
('e2000000-0000-0000-0000-000000000017', NULL, 'Supermercato Sigma Brambilla', 'Sigma', 'Via Brambilla, Melzo', 8.5, 2.00, true),
('e2000000-0000-0000-0000-000000000018', NULL, 'MD S.p.A.', 'MD', 'Via Gavazzi, Melzo', 8.9, 2.00, true)
ON CONFLICT (id) DO UPDATE SET 
    name = EXCLUDED.name,
    chain = EXCLUDED.chain,
    address = EXCLUDED.address,
    distance_km = EXCLUDED.distance_km,
    visit_cost_override = EXCLUDED.visit_cost_override,
    is_active = EXCLUDED.is_active;

-- Populate Store Offers for key local chains:
-- Variants:
-- d1000000-...-0001: Barilla Spaghetti 500g
-- d1000000-...-0002: De Cecco Spaghetti 500g
-- d1000000-...-0003: Spaghetti Convenienza 1kg
-- d1000000-...-0006: Mutti Passata 700g
-- d1000000-...-0008: Monini Olio EVO 1L
-- d1000000-...-0010: Granarolo Latte UHT 1L
-- d1000000-...-0012: Uova Le Naturelle 6pz
-- d1000000-...-0014: Lavazza Qualità Rossa 250g

INSERT INTO store_offers (store_id, variant_id, price, standard_price, price_per_base_unit, is_promotion, promo_description, source) VALUES
-- Il Gigante Cambiago
('e2000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 0.99, 1.29, 0.0010, true, 'Sconto 23% Blukart', 'flyer'),
('e2000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000006', 0.99, 1.49, 0.0014, true, 'Sottocosto Il Gigante', 'flyer'),
('e2000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000008', 7.90, 10.90, 0.0079, true, 'Promo Volantino', 'flyer'),
('e2000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000010', 1.45, 1.59, 0.0015, false, NULL, 'flyer'),
('e2000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000014', 2.99, 3.69, 0.0030, true, 'Offerta Speciale', 'flyer'),

-- MD Cambiago (Discount)
('e2000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000003', 0.75, 0.75, 0.00075, false, 'Prezzo Basso MD', 'flyer'),
('e2000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000006', 0.89, 0.89, 0.0013, false, NULL, 'flyer'),
('e2000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000008', 6.99, 8.49, 0.0070, true, 'Volantino MD Risparmio', 'flyer'),
('e2000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000010', 0.95, 0.95, 0.00095, false, NULL, 'flyer'),
('e2000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000014', 2.29, 2.29, 0.0023, false, NULL, 'flyer'),

-- Famila Gorgonzola
('e2000000-0000-0000-0000-000000000003', 'd1000000-0000-0000-0000-000000000001', 0.89, 1.25, 0.0009, true, 'Maxi Sconto Famila', 'flyer'),
('e2000000-0000-0000-0000-000000000003', 'd1000000-0000-0000-0000-000000000008', 6.89, 11.20, 0.0069, true, 'Sottocosto Famila', 'flyer'),
('e2000000-0000-0000-0000-000000000003', 'd1000000-0000-0000-0000-000000000010', 1.39, 1.59, 0.0014, true, 'Offerta Volantino', 'flyer'),

-- CONAD Gorgonzola
('e2000000-0000-0000-0000-000000000004', 'd1000000-0000-0000-0000-000000000001', 1.25, 1.39, 0.0013, true, 'Bassi e Fissi Conad', 'flyer'),
('e2000000-0000-0000-0000-000000000004', 'd1000000-0000-0000-0000-000000000008', 10.50, 11.50, 0.0105, false, NULL, 'flyer'),
('e2000000-0000-0000-0000-000000000004', 'd1000000-0000-0000-0000-000000000014', 3.49, 3.79, 0.0035, false, NULL, 'flyer'),

-- Carrefour Iper Carosello Carugate
('e2000000-0000-0000-0000-000000000013', 'd1000000-0000-0000-0000-000000000001', 0.85, 1.35, 0.00085, true, 'Sottocosto Carosello', 'flyer'),
('e2000000-0000-0000-0000-000000000013', 'd1000000-0000-0000-0000-000000000006', 0.95, 1.39, 0.00135, true, 'Promo SpesAmica', 'flyer'),
('e2000000-0000-0000-0000-000000000013', 'd1000000-0000-0000-0000-000000000008', 6.49, 10.90, 0.0065, true, 'Promo Carrefour Iper', 'flyer'),
('e2000000-0000-0000-0000-000000000013', 'd1000000-0000-0000-0000-000000000014', 2.89, 3.79, 0.0029, true, 'Offerta Iper', 'flyer'),

-- Coop Bussero
('e2000000-0000-0000-0000-000000000014', 'd1000000-0000-0000-0000-000000000001', 1.35, 1.35, 0.0014, false, NULL, 'flyer'),
('e2000000-0000-0000-0000-000000000014', 'd1000000-0000-0000-0000-000000000008', 6.50, 11.90, 0.0065, true, 'Sconto 40% Soci Coop', 'flyer'),
('e2000000-0000-0000-0000-000000000014', 'd1000000-0000-0000-0000-000000000010', 1.25, 1.55, 0.00125, true, 'Sconto Soci', 'flyer'),

-- iN's Mercato Pessano (Discount)
('e2000000-0000-0000-0000-000000000009', 'd1000000-0000-0000-0000-000000000003', 0.79, 0.79, 0.00079, false, NULL, 'flyer'),
('e2000000-0000-0000-0000-000000000009', 'd1000000-0000-0000-0000-000000000008', 6.90, 8.50, 0.0069, true, 'Prezzo iN''s', 'flyer'),
('e2000000-0000-0000-0000-000000000009', 'd1000000-0000-0000-0000-000000000010', 0.99, 0.99, 0.00099, false, NULL, 'flyer'),

-- Unes Pessano & Agrate
('e2000000-0000-0000-0000-000000000010', 'd1000000-0000-0000-0000-000000000001', 1.29, 1.29, 0.0013, false, NULL, 'flyer'),
('e2000000-0000-0000-0000-000000000010', 'd1000000-0000-0000-0000-000000000006', 1.15, 1.45, 0.0016, true, 'U! Confronta e Risparmia', 'flyer'),
('e2000000-0000-0000-0000-000000000012', 'd1000000-0000-0000-0000-000000000008', 9.80, 11.20, 0.0098, false, NULL, 'flyer');
