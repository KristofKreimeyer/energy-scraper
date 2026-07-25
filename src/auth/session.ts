// Session-Token (Bearer) im localStorage. Bewusst schlicht: kein Cookie, damit
// kein CSRF-Vektor. Auch von Nicht-Context-Code nutzbar (Vote/Meldung hängen
// den Bearer an, wenn eingeloggt).

const KEY = "energyhunt:session";

export function getSessionToken(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setSessionToken(token: string) {
  try {
    localStorage.setItem(KEY, token);
  } catch {
    /* Storage nicht verfügbar */
  }
}

export function clearSessionToken() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* Storage nicht verfügbar */
  }
}

/** Authorization-Header, falls eingeloggt – für optionale Beitrags-Zuordnung. */
export function authHeader(): Record<string, string> {
  const t = getSessionToken();
  return t ? { authorization: `Bearer ${t}` } : {};
}
