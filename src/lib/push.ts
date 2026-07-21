// Web-Push-Anmeldung im Browser: Service Worker registrieren, Berechtigung
// erfragen, via PushManager abonnieren. Liefert das Subscription-JSON, das der
// Worker speichert und send-alarms.mjs zum Verschlüsseln/Versenden nutzt.

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || ''

/** base64url (VAPID-Public-Key) -> Uint8Array für applicationServerKey. */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const buffer = new ArrayBuffer(raw.length)
  const out = new Uint8Array(buffer)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

export class PushError extends Error {}

export async function subscribeToPush(): Promise<PushSubscriptionJSON> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new PushError('Dein Browser unterstützt keine Push-Nachrichten.')
  }
  if (!VAPID_PUBLIC_KEY) {
    throw new PushError('Push ist noch nicht eingerichtet.')
  }
  const reg = await navigator.serviceWorker.register('/sw.js')
  await navigator.serviceWorker.ready

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new PushError('Ohne Benachrichtigungs-Erlaubnis geht es leider nicht.')
  }

  const existing = await reg.pushManager.getSubscription()
  const sub =
    existing ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    }))
  return sub.toJSON()
}
