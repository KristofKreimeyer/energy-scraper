// Session-Token (Bearer) im localStorage. Bewusst schlicht: kein Cookie, damit
// kein CSRF-Vektor. Auch von Nicht-Context-Code nutzbar (Vote/Meldung hängen
// den Bearer an, wenn eingeloggt).

import { storage } from '../lib/storage'

const KEY = 'energyhunt:session'

export function getSessionToken(): string | null {
  return storage.get(KEY)
}

export function setSessionToken(token: string) {
  storage.set(KEY, token)
}

export function clearSessionToken() {
  storage.remove(KEY)
}

/** Authorization-Header, falls eingeloggt – für optionale Beitrags-Zuordnung. */
export function authHeader(): Record<string, string> {
  const t = getSessionToken()
  return t ? { authorization: `Bearer ${t}` } : {}
}
