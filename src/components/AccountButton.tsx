import { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { authHeader } from "../auth/session";
import { Modal } from "./Modal";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8787";

interface Contributions {
  reports: number;
  reportsApproved: number;
  votes: number;
}

const UserIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c0-3.5 3.6-6 8-6s8 2.5 8 6" strokeLinecap="round" />
  </svg>
);

export function AccountButton() {
  const { user, ready, requestLogin, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [contrib, setContrib] = useState<Contributions | null>(null);

  async function onOpen() {
    setOpen(true);
    setMsg(null);
    if (user) {
      // „Meine Beiträge" laden.
      try {
        const res = await fetch(`${API_BASE}/api/me/contributions`, { headers: authHeader() });
        if (res.ok) setContrib((await res.json()) as Contributions);
      } catch {
        /* egal – Zähler bleibt leer */
      }
    }
  }

  async function submit() {
    setBusy(true);
    setMsg(null);
    const r = await requestLogin(email.trim());
    setMsg(r.message);
    setBusy(false);
  }

  if (!ready) return null; // bis der /me-Check durch ist, nichts zeigen

  return (
    <>
      <button
        type="button"
        onClick={onOpen}
        aria-label={user ? "Konto" : "Anmelden"}
        className="flex-none h-10 px-3 bg-surface text-ink border border-border-strong rounded-[10px] text-[0.85rem] font-semibold cursor-pointer inline-flex items-center gap-[7px] hover:bg-surface-2 max-w-[160px]"
      >
        <UserIcon />
        <span className="truncate">{user ? user.email : "Anmelden"}</span>
      </button>

      {open && (
        <Modal onClose={() => setOpen(false)} label={user ? "Konto" : "Anmelden"}>
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-[1.15rem] font-bold text-ink">{user ? "Dein Konto" : "Anmelden"}</h2>
            <button type="button" onClick={() => setOpen(false)} aria-label="Schließen" className="flex-none text-muted hover:text-ink text-lg leading-none cursor-pointer">
              ✕
            </button>
          </div>

          {user ? (
            <>
              <p className="text-[0.85rem] text-muted">
                Angemeldet als <span className="font-semibold text-ink">{user.email}</span>
              </p>
              <div className="flex flex-col gap-1.5">
                <span className="text-[0.66rem] font-semibold uppercase tracking-[0.08em] text-muted">Meine Beiträge</span>
                <div className="flex gap-2">
                  <div className="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-center">
                    <div className="font-mono text-[1.4rem] font-bold text-ink tabular-nums">{contrib?.reports ?? "–"}</div>
                    <div className="text-[0.7rem] text-muted">Meldungen{contrib && contrib.reportsApproved > 0 ? ` (${contrib.reportsApproved} ✓)` : ""}</div>
                  </div>
                  <div className="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-center">
                    <div className="font-mono text-[1.4rem] font-bold text-ink tabular-nums">{contrib?.votes ?? "–"}</div>
                    <div className="text-[0.7rem] text-muted">Votes</div>
                  </div>
                </div>
                <p className="text-[0.72rem] text-muted">Ab jetzt zählen deine Meldungen und Votes zu deinem Konto – die Basis für kommende Ränge.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  logout();
                  setOpen(false);
                }}
                className="w-full h-10 text-[0.85rem] font-semibold text-ink bg-surface border border-border-strong rounded-lg cursor-pointer hover:bg-surface-2"
              >
                Abmelden
              </button>
            </>
          ) : (
            <form
              className="flex flex-col gap-2.5"
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
            >
              <p className="text-[0.85rem] text-muted">Passwortlos: Wir schicken dir einen Anmeldelink per E-Mail.</p>
              <label htmlFor="login-email" className="text-[0.66rem] font-semibold uppercase tracking-[0.08em] text-muted">
                Deine E-Mail-Adresse
              </label>
              <input
                id="login-email"
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="du@example.com"
                className="w-full h-10 px-3 text-[0.9rem] bg-surface text-ink border border-border-strong rounded-lg outline-none"
              />
              <button
                type="submit"
                disabled={busy}
                className="w-full h-10 text-[0.85rem] font-semibold text-white bg-accent border border-accent rounded-lg cursor-pointer hover:bg-accent-strong disabled:opacity-60"
              >
                {busy ? "…" : "Anmeldelink schicken"}
              </button>
              {msg && (
                <p className="text-[0.8rem] text-good" role="status">
                  {msg}
                </p>
              )}
              <p className="text-[0.7rem] text-muted">Kein Passwort · jederzeit abmeldbar · nur für Community-Funktionen.</p>
            </form>
          )}
        </Modal>
      )}
    </>
  );
}
