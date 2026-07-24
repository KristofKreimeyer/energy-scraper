-- „Noch verfügbar?"-Votes: Nutzer bestätigen (oder verneinen) anonym, ob ein
-- Angebot vor Ort noch zu haben ist. Aggregiertes Signal, keine Moderation.
-- Eine Stimme je (Produkt, Browser); IP-Hash nur gegen Massenabstimmen.
CREATE TABLE IF NOT EXISTS availability_votes (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  product_key TEXT NOT NULL,
  vote INTEGER NOT NULL,   -- 1 = noch verfügbar, -1 = vergriffen
  voter_id TEXT NOT NULL,  -- client-generierte ID (localStorage)
  ip_hash TEXT
);

-- Eine Stimme je Browser & Produkt (Meinungsänderung = Update statt neue Zeile).
CREATE UNIQUE INDEX IF NOT EXISTS idx_votes_voter ON availability_votes (product_key, voter_id);
-- Aggregation je Produkt im Zeitfenster.
CREATE INDEX IF NOT EXISTS idx_votes_product ON availability_votes (product_key, created_at);
-- Rate-Limit pro IP.
CREATE INDEX IF NOT EXISTS idx_votes_ip ON availability_votes (ip_hash, created_at);
