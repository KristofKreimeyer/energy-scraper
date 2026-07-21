-- Bestpreis-Alarm: Abonnements (Kanal E-Mail zuerst; channel/destination sind
-- bewusst generisch, damit Telegram & Push später dieselbe Tabelle nutzen).
CREATE TABLE IF NOT EXISTS subscriptions (
  id            TEXT PRIMARY KEY,           -- uuid
  channel       TEXT NOT NULL DEFAULT 'email', -- email | telegram | push
  destination   TEXT NOT NULL,              -- E-Mail-Adresse (bzw. chat_id / push-endpoint)
  product_key   TEXT NOT NULL,              -- market|brand|title|unitLabel (identisch zu prepare-data.mjs/offers.ts)
  product_label TEXT NOT NULL,              -- menschenlesbar, für die Benachrichtigung
  status        TEXT NOT NULL DEFAULT 'pending', -- pending | confirmed | unsubscribed
  token         TEXT NOT NULL,              -- Bestätigungs-/Abmelde-Token
  created_at    TEXT NOT NULL,
  confirmed_at  TEXT,
  notified_at   TEXT                        -- letzter Alarm-Versand (gegen Doppel-Mails)
);

-- Ein Kanal+Ziel darf ein Produkt nur einmal abonnieren.
CREATE UNIQUE INDEX IF NOT EXISTS idx_sub_dest_product
  ON subscriptions (channel, destination, product_key);

-- Schneller Zugriff im wöchentlichen Alarm-Lauf: „wer will Produkt X (bestätigt)?“
CREATE INDEX IF NOT EXISTS idx_sub_product_status
  ON subscriptions (product_key, status);

-- Token-Lookup für Bestätigen/Abmelden.
CREATE INDEX IF NOT EXISTS idx_sub_token ON subscriptions (token);
