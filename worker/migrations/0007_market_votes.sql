-- Community-Roadmap-Voting: „Welchen Markt sollen wir als Nächstes scrapen?"
-- Eine Stimme je Browser über die ganze Umfrage (Wechsel = Update, keine neue
-- Zeile). IP-Hash nur gegen Massenabstimmen.
CREATE TABLE IF NOT EXISTS market_votes (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  market TEXT NOT NULL,     -- Kandidaten-Markt (Label)
  voter_id TEXT NOT NULL,   -- client-generierte ID (localStorage)
  ip_hash TEXT
);

-- Eine Stimme je Browser; Meinungsänderung aktualisiert die Zeile.
CREATE UNIQUE INDEX IF NOT EXISTS idx_market_votes_voter ON market_votes (voter_id);
-- Aggregation je Markt.
CREATE INDEX IF NOT EXISTS idx_market_votes_market ON market_votes (market, created_at);
-- Rate-Limit pro IP.
CREATE INDEX IF NOT EXISTS idx_market_votes_ip ON market_votes (ip_hash, created_at);
