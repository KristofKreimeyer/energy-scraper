-- Community-Preismeldungen: Nutzer melden anonym einen (günstigeren) Preis, den
-- der Scraper nicht kennt. Meldungen sind an ein bestehendes Angebot gebunden
-- (product_key) und werden NIE automatisch veröffentlicht – erst nach Freigabe
-- (status='approved') erscheinen sie als Community-Hinweis auf der Karte.
CREATE TABLE IF NOT EXISTS price_reports (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'approved' | 'rejected'
  product_key TEXT NOT NULL,              -- market|brand|title|unitLabel (wie überall)
  brand TEXT NOT NULL,
  title TEXT NOT NULL,
  market TEXT NOT NULL,
  reported_price REAL NOT NULL,
  store_location TEXT,                    -- optional: PLZ/Ort/Filiale
  note TEXT,                              -- optional: kurzer Hinweis
  ip_hash TEXT,                           -- gehashte IP, nur für Rate-Limit/Missbrauch
  moderated_at TEXT
);

-- Moderations-Queue (pending) und Kartenanzeige (approved je Produkt).
CREATE INDEX IF NOT EXISTS idx_reports_status ON price_reports (status, created_at);
CREATE INDEX IF NOT EXISTS idx_reports_product ON price_reports (product_key, status);
-- Rate-Limit-Abfrage pro IP im Zeitfenster.
CREATE INDEX IF NOT EXISTS idx_reports_ip ON price_reports (ip_hash, created_at);
