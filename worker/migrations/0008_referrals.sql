-- Referral („Freunde einladen"): zweiseitig, Reward bei E-Mail-Bestätigung des
-- Eingeladenen. Ein Code je Referrer-E-Mail; eine Belohnung je eingeladener
-- E-Mail (verhindert Mehrfach-Claims).

CREATE TABLE IF NOT EXISTS referral_codes (
  code       TEXT PRIMARY KEY,
  email      TEXT NOT NULL,      -- Referrer-E-Mail
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_refcode_email ON referral_codes (email);

CREATE TABLE IF NOT EXISTS referrals (
  id             TEXT PRIMARY KEY,
  code           TEXT NOT NULL,
  referrer_email TEXT NOT NULL,
  invitee_email  TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending', -- pending | rewarded
  created_at     TEXT NOT NULL,
  rewarded_at    TEXT
);
-- Eine Belohnung je eingeladener Adresse (erste Zuordnung gewinnt).
CREATE UNIQUE INDEX IF NOT EXISTS idx_ref_invitee ON referrals (invitee_email);
CREATE INDEX IF NOT EXISTS idx_ref_code ON referrals (code);
