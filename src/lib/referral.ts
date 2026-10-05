import { apiFetch } from './api'
import { storage } from './storage'

// Referral („Freunde einladen"): der Eingeladene kommt über /?ref=CODE. Wir
// merken den Code lokal und hängen ihn an die nächste Alarm-Anmeldung – belohnt
// wird zweiseitig erst bei E-Mail-Bestätigung (serverseitig).

const REF_KEY = 'energyhunt:ref'

/** ?ref=CODE aus der URL übernehmen und die URL wieder säubern. Beim Start rufen. */
export function captureRef() {
  try {
    const url = new URL(window.location.href)
    const ref = url.searchParams.get('ref')
    if (!ref) return
    storage.set(REF_KEY, ref)
    url.searchParams.delete('ref')
    window.history.replaceState({}, '', url.pathname + url.search + url.hash)
  } catch {
    /* egal */
  }
}

export function getRef(): string | null {
  return storage.get(REF_KEY)
}

export interface ReferralInfo {
  code: string
  url: string
  rewarded: number
  pending: number
}

/** Referral-Link + Stand des eingeloggten Kontos (oder null, wenn nicht angemeldet). */
export async function fetchReferral(): Promise<ReferralInfo | null> {
  try {
    const res = await apiFetch('/api/referral/link', { auth: true })
    if (!res.ok) return null
    return (await res.json()) as ReferralInfo
  } catch {
    return null
  }
}
