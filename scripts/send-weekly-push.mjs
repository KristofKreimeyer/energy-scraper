// Wöchentliche „Neue Deals sind da"-Push (Broadcast).
//
// Läuft in der refresh-data-Action NACH dem Daten-Commit und nur, wenn frische
// Wochendaten committet wurden (Gate im Workflow). Holt alle bestätigten
// weekly-Push-Abos aus D1 (scope='weekly') und schickt EINE Erinnerung mit dem
// aktuellen Bestpreis. Tote Subscriptions (404/410) werden abgemeldet.
//
// Ohne Cloudflare-/VAPID-Secrets läuft ein Trockenlauf (nur Log), damit der
// Datenlauf auch ohne Cloud nicht kippt.

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const dataDir = resolve(scriptDir, '../src/data')

const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID
const DB_ID = process.env.CLOUDFLARE_D1_DATABASE_ID
const CF_TOKEN = process.env.CLOUDFLARE_API_TOKEN
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:alarm@energyhunt.de'
const SITE_URL = process.env.PUBLIC_SITE_URL || 'https://energyhunt.pages.dev'

async function d1Query(sql, params = []) {
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/d1/database/${DB_ID}/query`, {
    method: 'POST',
    headers: { authorization: `Bearer ${CF_TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify({ sql, params }),
  })
  const json = await res.json()
  if (!json.success) throw new Error(`D1-Fehler: ${JSON.stringify(json.errors)}`)
  return json.result[0].results
}

let _webpush = null
async function getWebpush() {
  if (!_webpush) {
    const mod = await import('web-push')
    _webpush = mod.default ?? mod
    _webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
  }
  return _webpush
}

/** Sendet eine Push-Nachricht; 'expired' bei toter Subscription (404/410). */
async function pushSend(destination, payloadObj) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.log(`  [dry] Push: ${payloadObj.title} – ${payloadObj.body}`)
    return 'ok'
  }
  const wp = await getWebpush()
  try {
    await wp.sendNotification(JSON.parse(destination), JSON.stringify(payloadObj), { urgency: 'high', TTL: 259200 })
    return 'ok'
  } catch (err) {
    if (err.statusCode === 404 || err.statusCode === 410) return 'expired'
    throw err
  }
}

/** Günstigstes aktuell gültiges Angebot (€/L) für die Nachricht. */
function bestDeal() {
  let offers = []
  try {
    offers = JSON.parse(readFileSync(resolve(dataDir, 'offers.json'), 'utf8')).offers ?? []
  } catch {
    return null
  }
  const today = Math.floor(Date.now() / 86_400_000)
  const day = (s) => Math.floor(new Date(s).getTime() / 86_400_000)
  const live = offers.filter((o) => {
    if (o.perLiter == null) return false
    if (o.validTo && day(o.validTo) < today) return false
    return true
  })
  if (!live.length) return null
  return live.reduce((a, b) => (b.perLiter < a.perLiter ? b : a))
}

function weeklyPayload(deal) {
  const price = deal ? deal.perLiter.toFixed(2).replace('.', ',') : null
  return {
    title: '⚡ Neue Energy-Deals sind da!',
    body: deal
      ? `Bester Preis diese Woche: ${price} €/L – ${deal.brand} bei ${deal.market}.`
      : 'Die frischen Wochenangebote sind online.',
    url: '/',
    tag: 'weekly-deals',
  }
}

async function main() {
  if (!ACCOUNT || !DB_ID || !CF_TOKEN) {
    console.log('[weekly-push] Kein D1-Zugang (Secrets fehlen) – Trockenlauf, nichts versendet.')
    return
  }
  const deal = bestDeal()
  const payload = weeklyPayload(deal)

  const subs = await d1Query(
    "SELECT id, destination FROM subscriptions WHERE status='confirmed' AND scope='weekly' AND channel='push'",
  )
  console.log(`[weekly-push] ${subs.length} weekly-Abo(s) · Nachricht: ${payload.body}`)

  let sent = 0
  let expired = 0
  for (const sub of subs) {
    try {
      const result = await pushSend(sub.destination, payload)
      if (result === 'expired') {
        expired++
        await d1Query("UPDATE subscriptions SET status='unsubscribed' WHERE id=?", [sub.id])
      } else {
        sent++
      }
    } catch (err) {
      console.warn(`[weekly-push] Fehler bei Abo ${sub.id}: ${err.message}`)
    }
  }
  console.log(`[weekly-push] fertig: ${sent} gesendet, ${expired} abgelaufen entfernt.`)
}

main().catch((err) => {
  console.error(`[weekly-push] Abbruch: ${err.message}`)
  process.exitCode = 1
})
