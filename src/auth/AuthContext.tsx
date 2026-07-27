import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getSessionToken, setSessionToken, clearSessionToken } from "./session";

// Leichte Identität: passwortloser Login per E-Mail-Magic-Link. Der Context hält
// den aktuellen Nutzer und stellt Login/Logout bereit. Session-Token liegt im
// localStorage (siehe session.ts).

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8787";

interface User {
  email: string;
}

interface AuthValue {
  user: User | null;
  ready: boolean; // initialer /me-Check abgeschlossen
  requestLogin: (email: string) => Promise<{ ok: boolean; message: string }>;
  verifyToken: (token: string) => Promise<boolean>;
  logout: () => void;
}

const Ctx = createContext<AuthValue | null>(null);

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthValue {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth muss innerhalb von <AuthProvider> genutzt werden");
  return c;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  // Ohne Token ist der Status sofort geklärt (nicht eingeloggt).
  const [ready, setReady] = useState(() => !getSessionToken());

  useEffect(() => {
    const token = getSessionToken();
    if (!token) return;
    fetch(`${API_BASE}/api/auth/me`, { headers: { authorization: `Bearer ${token}` } })
      .then(async (res) => {
        if (res.ok) {
          const d = (await res.json()) as { email: string };
          setUser({ email: d.email });
        } else {
          clearSessionToken();
        }
      })
      .catch(() => {
        /* offline – Token behalten, nächster Start versucht es erneut */
      })
      .finally(() => setReady(true));
  }, []);

  async function requestLogin(email: string) {
    try {
      const res = await fetch(`${API_BASE}/api/auth/request`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const d = (await res.json()) as { message?: string };
      return { ok: res.ok, message: d.message ?? "Prüfe deine Mail." };
    } catch {
      return { ok: false, message: "Keine Verbindung zum Dienst." };
    }
  }

  async function verifyToken(token: string) {
    try {
      const res = await fetch(`${API_BASE}/api/auth/verify`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) return false;
      const d = (await res.json()) as { token: string; email: string };
      setSessionToken(d.token);
      setUser({ email: d.email });
      return true;
    } catch {
      return false;
    }
  }

  function logout() {
    const token = getSessionToken();
    if (token) {
      fetch(`${API_BASE}/api/auth/logout`, { method: "POST", headers: { authorization: `Bearer ${token}` } }).catch(() => {});
    }
    clearSessionToken();
    setUser(null);
  }

  return <Ctx.Provider value={{ user, ready, requestLogin, verifyToken, logout }}>{children}</Ctx.Provider>;
}
