-- Leichte Identität: passwortloser Login per E-Mail-Magic-Link.
--   users        – ein Konto je E-Mail
--   sessions     – opake, widerrufbare Session-Tokens (Bearer), mit Ablauf
--   login_tokens – Einmal-Links aus der Magic-Mail (kurzlebig, single-use)
-- Beiträge (Meldungen/Votes) bekommen eine optionale user_id: anonym bleibt
-- möglich, eingeloggt hängt der Beitrag am Konto (Basis für „meine Beiträge").
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id);

CREATE TABLE IF NOT EXISTS login_tokens (
  token TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_login_email ON login_tokens (email, created_at);

ALTER TABLE price_reports ADD COLUMN user_id TEXT;
ALTER TABLE availability_votes ADD COLUMN user_id TEXT;
