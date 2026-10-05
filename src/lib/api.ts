import { authHeader } from '../auth/session'

// Basis-URL der Worker-API. Lokal: wrangler dev auf :8787; in Produktion via
// VITE_API_BASE (Build-Zeit) auf die deployte Worker-URL gesetzt.
export const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8787'

interface ApiOptions {
  method?: 'GET' | 'POST'
  /** Wird als JSON gesendet (setzt content-type). */
  body?: unknown
  /** Bearer-Token der Session mitsenden (falls eingeloggt). */
  auth?: boolean
}

/**
 * fetch gegen die Worker-API: hängt API_BASE vor, serialisiert `body` als JSON
 * und fügt auf Wunsch den Session-Header an. Wirft wie fetch nur bei
 * Netzwerkfehlern – HTTP-Fehler prüfen Aufrufer über `res.ok`.
 */
export function apiFetch(path: string, { method, body, auth }: ApiOptions = {}): Promise<Response> {
  const headers: Record<string, string> = {}
  if (body !== undefined) headers['content-type'] = 'application/json'
  if (auth) Object.assign(headers, authHeader())
  return fetch(`${API_BASE}${path}`, {
    method: method ?? (body !== undefined ? 'POST' : 'GET'),
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}
