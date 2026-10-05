// Wöchentlicher Bestpreis-Alarm-Versand.
//
// Läuft in der GitHub Action NACH prepare-data (also mit frischer
// price-history.json). Erkennt Produkte, die an diesem Lauf ein NEUES
// Preistief erreicht haben, holt die bestätigten E-Mail-Abos aus D1
// (Cloudflare D1 REST-API) und verschickt die Alarm-Mail über Brevo.
//
// Kein Alarm ohne echtes neues Tief: es feuert nur, wenn der €/L des
// jüngsten Tages STRENG unter allen früheren Tagen liegt – so re-alarmiert
// ein gleichbleibend niedriger Preis nicht Woche für Woche. `notified_at`
// verhindert zusätzlich Doppel-Mails am selben Tag.
//
// Ohne Cloudflare-/Brevo-Secrets läuft ein Trockenlauf (nur Log), damit die
// Erkennung auch ohne Cloud testbar ist. Die Logik steckt in scripts/lib/
// (alarm-logic.mjs, alarm-messages.mjs) und wird per `npm test` geprüft.

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { brandKey, productKey } from '../shared/core.mjs'
import { detectNewBestPrices, storeMatches, weckerDecision } from './lib/alarm-logic.mjs'
import { createMessages } from './lib/alarm-messages.mjs'

// Re-Exporte: Tests & Aufrufer importieren die Logik weiterhin von hier.
export { brandKey, productKey, detectNewBestPrices, storeMatches, weckerDecision }

const scriptDir = dirname(fileURLToPath(import.meta.url))
const dataDir = resolve(scriptDir, '../src/data')

// --- I/O & Versand (in der Action) -----------------------------------------

const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID
const DB_ID = process.env.CLOUDFLARE_D1_DATABASE_ID
const CF_TOKEN = process.env.CLOUDFLARE_API_TOKEN
const BREVO_API_KEY = process.env.BREVO_API_KEY
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:alarm@energyhunt.de'
const EMAIL_FROM = process.env.EMAIL_FROM || 'alarm@energyhunt.de'
const EMAIL_FROM_NAME = process.env.EMAIL_FROM_NAME || 'EnergyHunt'
const SITE_URL = process.env.PUBLIC_SITE_URL || 'https://energyhunt.de'
const API_BASE = process.env.API_BASE || '' // Worker-URL für Abmelde-Links

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
const msg = createMessages({ siteUrl: SITE_URL, apiBase: API_BASE })

async function sendTelegram(chatId, text) {
  if (!TELEGRAM_BOT_TOKEN) {
    console.log(`  [dry] Telegram an ${chatId}`)
    return
  }
  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: false }),
  })
  if (!res.ok) throw new Error(`Telegram ${res.status}: ${await res.text()}`)
}

// web-push nur laden, wenn wirklich Push versendet wird (hält das Script für
// E-Mail/Telegram auch ohne installierte Lib lauffähig).
let _webpush = null
async function getWebpush() {
  if (!_webpush) {
    const mod = await import('web-push')
    _webpush = mod.default ?? mod
    _webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
  }
  return _webpush
}

/** Sendet eine Push-Nachricht; Rückgabe 'expired' bei toter Subscription (404/410). */
async function pushSend(destination, payloadObj) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.log(`  [dry] Push: ${payloadObj.title}`)
    return 'ok'
  }
  const wp = await getWebpush()
  try {
    // urgency:'high' + TTL 3 Tage: hilft, den Doze-/Akkusparmodus (v. a. Android)
    // zu durchbrechen bzw. die Nachricht bis zum nächsten Online-Sein zu halten.
    await wp.sendNotification(JSON.parse(destination), JSON.stringify(payloadObj), { urgency: 'high', TTL: 259200 })
    return 'ok'
  } catch (err) {
    if (err.statusCode === 404 || err.statusCode === 410) return 'expired'
    throw err
  }
}

async function sendEmail(to, mail) {
  if (!BREVO_API_KEY) {
    console.log(`  [dry] Mail an ${to}: ${mail.subject}`)
    return
  }
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      sender: { email: EMAIL_FROM, name: EMAIL_FROM_NAME },
      to: [{ email: to }],
      subject: mail.subject,
      htmlContent: mail.html,
      textContent: mail.text,
    }),
  })
  if (!res.ok) throw new Error(`Brevo ${res.status}: ${await res.text()}`)
}

/**
 * Versendet über den Kanal des Abos und verbucht das Ergebnis: tote
 * Push-Subscription -> abmelden (false), sonst notified_at setzen (true).
 * `send` liefert 'expired' bei toter Push-Subscription, sonst beliebig.
 */
async function deliver(sub, send) {
  if ((await send()) === 'expired') {
    await d1Query("UPDATE subscriptions SET status='unsubscribed' WHERE id=?", [sub.id])
    return false
  }
  await d1Query('UPDATE subscriptions SET notified_at=? WHERE id=?', [new Date().toISOString(), sub.id])
  return true
}

const resetNotified = (sub) => d1Query('UPDATE subscriptions SET notified_at=NULL WHERE id=?', [sub.id])

/** Wert des Angebots nach Wecker-Metrik ('liter' = €/L, sonst Stückpreis). */
const metricValue = (o, metric) => (metric === 'liter' ? o.perLiter : o.perUnit)

/** Bestpreis-Alarme: je neuem Preistief alle bestätigten Abos des Produkts. */
async function runBestPriceAlarms(events, offerByKey, today) {
  let sent = 0
  for (const event of events) {
    const subs = await d1Query(
      "SELECT id, channel, destination, token FROM subscriptions WHERE status='confirmed' AND product_key=? AND (notified_at IS NULL OR notified_at < ?)",
      [event.productKey, today],
    )
    const offer = offerByKey.get(event.productKey)
    for (const sub of subs) {
      const ok = await deliver(sub, async () => {
        if (sub.channel === 'push') return pushSend(sub.destination, msg.bestPricePush(event, offer))
        if (sub.channel === 'telegram') return sendTelegram(sub.destination, msg.telegramMessage(event, offer))
        return sendEmail(sub.destination, msg.alarmEmail(event, offer, sub.token))
      })
      if (ok) sent++
    }
  }
  return sent
}

/** Preiswecker (Pro): aktueller Preis vs. Zielwert je PRODUKT-Abo. */
async function runProductWeckers(offerByKey) {
  const targetSubs = await d1Query(
    "SELECT id, channel, destination, token, product_key, product_label, target_price, target_metric, notified_at FROM subscriptions WHERE status='confirmed' AND scope='product' AND target_price IS NOT NULL",
  )
  let sent = 0
  for (const sub of targetSubs) {
    const offer = offerByKey.get(sub.product_key)
    const price = offer ? metricValue(offer, sub.target_metric) : null
    const decision = weckerDecision(price, sub.target_price, sub.notified_at)
    if (decision === 'reset') {
      await resetNotified(sub)
    } else if (decision === 'fire') {
      const ok = await deliver(sub, async () => {
        if (sub.channel === 'push') return pushSend(sub.destination, msg.weckerPush(sub, offer, price))
        const mail = msg.weckerEmail(sub, offer, price)
        if (sub.channel === 'telegram') return sendTelegram(sub.destination, mail.text)
        return sendEmail(sub.destination, mail)
      })
      if (ok) sent++
    }
  }
  return sent
}

/** Marken-Wecker: gegen ALLE Angebote der Marke (Store-gefiltert). */
async function runBrandWeckers(offers, events, today) {
  const brandSubs = await d1Query(
    "SELECT id, channel, destination, token, brand, product_label, store_mode, stores, target_price, target_metric, notified_at FROM subscriptions WHERE status='confirmed' AND scope='brand'",
  )
  const newLowKeys = new Set(events.map((e) => e.productKey))
  let sent = 0
  for (const sub of brandSubs) {
    const stores = sub.stores ? JSON.parse(sub.stores) : []
    const matching = offers.filter((o) => brandKey(o.brand) === sub.brand && storeMatches(o.market, sub.store_mode, stores))
    if (matching.length === 0) continue

    let offer = null
    let payload = null
    if (sub.target_price != null) {
      // Pro-Wecker: günstigstes passendes Angebot nach Metrik
      const priced = matching
        .map((o) => ({ o, p: metricValue(o, sub.target_metric) }))
        .filter((x) => x.p != null)
        .sort((a, b) => a.p - b.p)
      if (priced.length === 0) continue
      const best = priced[0]
      const decision = weckerDecision(best.p, sub.target_price, sub.notified_at)
      if (decision === 'reset') await resetNotified(sub)
      if (decision !== 'fire') continue
      offer = best.o
      payload = msg.weckerPush(sub, best.o, best.p)
    } else {
      // Free: hat ein passendes Produkt heute ein neues Tief erreicht?
      const dropped = matching.find((o) => newLowKeys.has(productKey(o)))
      if (!dropped || (sub.notified_at && sub.notified_at >= today)) continue
      offer = dropped
      payload = msg.bestPricePush(
        { label: `${sub.product_label} bei ${dropped.market}`, perLiter: dropped.perLiter, productKey: sub.brand },
        dropped,
      )
    }
    if (await deliver(sub, () => dispatchBrand(sub, offer, payload))) sent++
  }
  return sent
}

async function main() {
  const history = JSON.parse(readFileSync(resolve(dataDir, 'price-history.json'), 'utf8'))
  const offersData = JSON.parse(readFileSync(resolve(dataDir, 'offers.json'), 'utf8'))
  const offerByKey = new Map()
  for (const o of offersData.offers) if (!offerByKey.has(productKey(o))) offerByKey.set(productKey(o), o)

  const events = detectNewBestPrices(history)
  console.log(
    events.length
      ? `[send-alarms] ${events.length} neue(s) Preistief(er): ${events.map((e) => e.label).join(', ')}`
      : '[send-alarms] Keine neuen Preistiefs.',
  )

  // Ohne D1-Zugang können weder Bestpreis-Alarme noch Preiswecker abgefragt werden.
  if (!ACCOUNT || !DB_ID || !CF_TOKEN) {
    console.log('[send-alarms] Cloudflare-Secrets fehlen – Trockenlauf, kein Versand.')
    return
  }

  const today = new Date().toISOString().slice(0, 10)
  const sent = await runBestPriceAlarms(events, offerByKey, today)
  const weckerSent = await runProductWeckers(offerByKey)
  const brandSent = await runBrandWeckers(offersData.offers, events, today)

  console.log(`[send-alarms] ${sent} Bestpreis-Alarm(e), ${weckerSent} Preiswecker, ${brandSent} Marken-Wecker versendet.`)
}

/**
 * Versendet einen Marken-Wecker über den Kanal des Abos. `push` erwartet ein
 * fertiges Payload-Objekt (title/body/url/tag); E-Mail/Telegram bauen daraus
 * eine passende Nachricht. Rückgabe 'expired' bei toter Push-Subscription.
 */
async function dispatchBrand(sub, offer, pushPayload) {
  if (sub.channel === 'push') return pushSend(sub.destination, pushPayload)
  if (sub.channel === 'telegram') return sendTelegram(sub.destination, msg.brandTelegram(offer, pushPayload))
  return sendEmail(sub.destination, msg.brandEmail(offer, pushPayload))
}

// Nur beim direkten Aufruf ausführen – Import (z. B. für Tests) bleibt seiteneffektfrei.
const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  main().catch((err) => {
    console.error('[send-alarms]', err)
    process.exit(1)
  })
}
