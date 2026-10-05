import { subscribeToPush, PushError } from './push'
import { apiFetch } from './api'
import { storage } from './storage'

// Wöchentliche Deal-Erinnerung (Broadcast-Push), eigener Opt-in getrennt von
// Marken-Alarmen. Der lokale Merker spiegelt nur die letzte Aktion dieses
// Geräts – die Wahrheit steht in D1 (scope='weekly').

const KEY = 'energyhunt:weekly-push'

export function pushSupported(): boolean {
  return typeof navigator !== 'undefined' && 'serviceWorker' in navigator && typeof window !== 'undefined' && 'PushManager' in window
}

export function isWeeklyOn(): boolean {
  return storage.get(KEY) === '1'
}

export async function enableWeekly(): Promise<void> {
  const sub = await subscribeToPush() // SW registrieren + Erlaubnis + Abo
  const res = await apiFetch('/api/weekly/subscribe', { method: 'POST', body: { subscription: sub } })
  if (!res.ok) throw new PushError('Die Erinnerung konnte nicht aktiviert werden.')
  storage.set(KEY, '1')
}

export async function disableWeekly(): Promise<void> {
  let endpoint: string | undefined
  try {
    const reg = await navigator.serviceWorker.ready
    const s = await reg.pushManager.getSubscription()
    endpoint = s?.endpoint
  } catch {
    /* kein Abo auffindbar – Merker trotzdem löschen */
  }
  if (endpoint) {
    await apiFetch('/api/weekly/unsubscribe', { method: 'POST', body: { subscription: { endpoint } } }).catch(() => undefined)
  }
  storage.remove(KEY)
}
