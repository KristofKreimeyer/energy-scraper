-- Pro-Variante: Preiswecker (eigener Zielpreis) + Mehrfach-Tracking.

-- Zielpreis je Abo. Beide NULL => Free-Verhalten (Alarm nur bei neuem Allzeit-Tief).
ALTER TABLE subscriptions ADD COLUMN target_price REAL;
ALTER TABLE subscriptions ADD COLUMN target_metric TEXT; -- 'unit' (Dosenpreis) | 'liter' (€/L)

-- Wer ist Pro? Identität = (channel, destination); in dieser Iteration E-Mail.
CREATE TABLE IF NOT EXISTS entitlements (
  id          TEXT PRIMARY KEY,
  channel     TEXT NOT NULL,
  destination TEXT NOT NULL,
  tier        TEXT NOT NULL DEFAULT 'pro',
  source      TEXT,              -- z. B. 'redeem:CODE' oder später 'stripe:...'
  valid_until TEXT,              -- NULL = unbegrenzt
  created_at  TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ent_dest ON entitlements (channel, destination, tier);

-- Einlöse-Codes (später ersetzt/ergänzt durch Zahlungs-Webhook, der direkt ein
-- Entitlement anlegt).
CREATE TABLE IF NOT EXISTS redeem_codes (
  code       TEXT PRIMARY KEY,
  tier       TEXT NOT NULL DEFAULT 'pro',
  valid_days INTEGER,            -- NULL = unbegrenzt
  max_uses   INTEGER NOT NULL DEFAULT 1,
  uses       INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
