-- Marken-basierte Wecker: nicht an ein Produkt gebunden, sondern an eine Marke
-- (optional gefiltert nach Stores, optional mit Zielpreis).
ALTER TABLE subscriptions ADD COLUMN scope TEXT NOT NULL DEFAULT 'product'; -- 'product' | 'brand'
ALTER TABLE subscriptions ADD COLUMN brand TEXT;       -- normalisierte Marke (nur brand-scope)
ALTER TABLE subscriptions ADD COLUMN store_mode TEXT;  -- 'all' | 'only' | 'except'
ALTER TABLE subscriptions ADD COLUMN stores TEXT;      -- JSON-Array von Markt-Labels

-- Für den Marken-Match im Alarm-Lauf.
CREATE INDEX IF NOT EXISTS idx_sub_brand_status ON subscriptions (brand, status) WHERE scope = 'brand';
