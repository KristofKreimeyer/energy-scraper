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
// Erkennung auch ohne Cloud testbar ist. `node send-alarms.mjs --selftest`
// prüft die Erkennungslogik gegen synthetische Daten.

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const dataDir = resolve(scriptDir, '../src/data')

/** Derselbe preisunabhängige Schlüssel wie in prepare-data.mjs / offers.ts. */
function productKey(o) {
  return [o.market, o.brand, o.title, o.unitLabel]
    .map((s) => String(s ?? '').trim().toLowerCase())
    .join('|')
}

/**
 * Produkte, die am jüngsten Tag ein neues Allzeit-Tief (€/L) erreicht haben.
 * Rein & seiteneffektfrei – Kern der Alarm-Logik, per --selftest geprüft.
 */
export function detectNewBestPrices(history) {
  const products = history?.products ?? {}
  // „Lauf-Tag“ = jüngster Datenpunkt über alle Produkte.
  let runDay = ''
  for (const p of Object.values(products)) {
    for (const pt of p.points) if (pt.date > runDay) runDay = pt.date
  }
  if (!runDay) return []

  const events = []
  for (const [key, p] of Object.entries(products)) {
    // ein €/L-Wert je Tag
    const byDay = new Map()
    for (const pt of p.points) if (pt.perLiter != null) byDay.set(pt.date, pt.perLiter)
    const days = [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]))
    if (days.length < 2) continue

    const [lastDay, lastVal] = days[days.length - 1]
    if (lastDay !== runDay) continue // Produkt war in diesem Lauf nicht dabei
    const prevMin = Math.min(...days.slice(0, -1).map(([, v]) => v))
    if (lastVal < prevMin) {
      events.push({ productKey: key, label: `${p.brand} ${p.title} (${p.market})`, perLiter: lastVal, market: p.market, prevMin })
    }
  }
  return events
}

/**
 * Preiswecker-Entscheidung (Pro): 'fire', sobald der aktuelle Preis <= Ziel und
 * noch nicht benachrichtigt; 'reset', wenn der Preis wieder über dem Ziel liegt
 * (damit die nächste Unterschreitung erneut alarmiert); sonst 'none'.
 */
export function weckerDecision(price, target, notifiedAt) {
  if (price == null) return 'none'
  if (price <= target) return notifiedAt ? 'none' : 'fire'
  return notifiedAt ? 'reset' : 'none'
}

// --- ab hier: I/O & Versand (in der Action) --------------------------------

const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID
const DB_ID = process.env.CLOUDFLARE_D1_DATABASE_ID
const CF_TOKEN = process.env.CLOUDFLARE_API_TOKEN
const BREVO_API_KEY = process.env.BREVO_API_KEY
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:alarm@findmyenergy.de'
const EMAIL_FROM = process.env.EMAIL_FROM || 'alarm@findmyenergy.de'
const EMAIL_FROM_NAME = process.env.EMAIL_FROM_NAME || 'FindMyEnergy'
const SITE_URL = process.env.PUBLIC_SITE_URL || 'https://findmyenergy.de'
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

export function alarmEmail(event, offer, unsubToken) {
  const perLiter = event.perLiter.toFixed(2).replace('.', ',')
  const priceLine = offer ? `${offer.priceText ?? ''} · ` : ''
  const unsubLink = API_BASE ? `${API_BASE}/api/unsubscribe?token=${unsubToken}` : SITE_URL
  const url = offer?.url || SITE_URL
  const text =
    `Neues Preistief! ${event.label} ist gerade so günstig wie nie erfasst: ${perLiter} €/L.\n\n` +
    `Zum Angebot: ${url}\n\nAbmelden: ${unsubLink}`
  const html = `<!doctype html><html lang="de"><body style="margin:0;background:#edf0f3;font-family:system-ui,sans-serif;color:#10151b">
    <div style="max-width:520px;margin:0 auto;padding:32px 20px">
      <div style="font-weight:750;font-size:1.1rem;margin-bottom:20px">⚡ FindMy<span style="color:#b23c07">Energy</span></div>
      <div style="background:#fff;border:1px solid #dbe1e7;border-radius:14px;padding:24px">
        <div style="display:inline-block;background:#e24a08;color:#fff;font-weight:700;font-size:0.8rem;padding:4px 10px;border-radius:7px;margin-bottom:12px">⚡ Bestpreis</div>
        <h1 style="font-size:1.25rem;margin:0 0 8px">${event.label}</h1>
        <p style="margin:0 0 16px;color:#5b6772">${priceLine}<strong style="color:#10151b">${perLiter} €/L</strong> – so günstig wie nie erfasst.</p>
        <a href="${url}" style="display:inline-block;background:#e24a08;color:#fff;text-decoration:none;font-weight:650;padding:11px 20px;border-radius:10px">Zum Angebot</a>
      </div>
      <p style="color:#5b6772;font-size:0.78rem;margin-top:18px">Du bekommst diese Mail, weil du einen Bestpreis-Alarm aktiviert hast. <a href="${unsubLink}" style="color:#5b6772">Abmelden</a></p>
    </div></body></html>`
  return { subject: `⚡ Bestpreis: ${event.label} – ${perLiter} €/L`, html, text }
}

/** Preiswecker-Mail: aktueller Preis hat den Zielwert erreicht. */
export function weckerEmail(sub, offer, price) {
  const unit = sub.target_metric === 'liter' ? '/L' : ''
  const cur = price.toFixed(2).replace('.', ',')
  const target = sub.target_price.toFixed(2).replace('.', ',')
  const url = offer?.url || SITE_URL
  const text =
    `Dein Preiswecker: ${sub.product_label} liegt jetzt bei ${cur} €${unit} ` +
    `(dein Ziel: ${target} €${unit}).\n\nZum Angebot: ${url}`
  const html = `<!doctype html><html lang="de"><body style="margin:0;background:#edf0f3;font-family:system-ui,sans-serif;color:#10151b">
    <div style="max-width:520px;margin:0 auto;padding:32px 20px">
      <div style="font-weight:750;font-size:1.1rem;margin-bottom:20px">⚡ FindMy<span style="color:#b23c07">Energy</span></div>
      <div style="background:#fff;border:1px solid #dbe1e7;border-radius:14px;padding:24px">
        <div style="display:inline-block;background:#0a7a42;color:#fff;font-weight:700;font-size:0.8rem;padding:4px 10px;border-radius:7px;margin-bottom:12px">🔔 Preiswecker</div>
        <h1 style="font-size:1.25rem;margin:0 0 8px">${sub.product_label}</h1>
        <p style="margin:0 0 16px;color:#5b6772">Jetzt <strong style="color:#10151b">${cur} €${unit}</strong> – dein Zielpreis von ${target} €${unit} ist erreicht.</p>
        <a href="${url}" style="display:inline-block;background:#e24a08;color:#fff;text-decoration:none;font-weight:650;padding:11px 20px;border-radius:10px">Zum Angebot</a>
      </div>
    </div></body></html>`
  return { subject: `🔔 Preiswecker erreicht: ${sub.product_label} – ${cur} €${unit}`, html, text }
}

/** Telegram-Alarmtext (HTML). */
export function telegramMessage(event, offer) {
  const perLiter = event.perLiter.toFixed(2).replace('.', ',')
  const url = offer?.url || SITE_URL
  const price = offer?.priceText ? `${offer.priceText} · ` : ''
  return (
    `⚡ <b>Bestpreis!</b>\n${event.label}\n` +
    `${price}<b>${perLiter} €/L</b> – so günstig wie nie erfasst.\n${url}\n\n` +
    `<i>/stop zum Abmelden</i>`
  )
}

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
async function sendPush(destination, event, offer) {
  const perLiter = event.perLiter.toFixed(2).replace('.', ',')
  const payload = JSON.stringify({
    title: `⚡ Bestpreis: ${event.label}`,
    body: `${perLiter} €/L – so günstig wie nie erfasst.`,
    url: offer?.url || SITE_URL,
    tag: event.productKey,
  })
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.log(`  [dry] Push: ${event.label}`)
    return 'ok'
  }
  const wp = await getWebpush()
  try {
    await wp.sendNotification(JSON.parse(destination), payload)
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
  let sent = 0
  for (const event of events) {
    const subs = await d1Query(
      "SELECT id, channel, destination, token FROM subscriptions WHERE status='confirmed' AND product_key=? AND (notified_at IS NULL OR notified_at < ?)",
      [event.productKey, today],
    )
    const offer = offerByKey.get(event.productKey)
    for (const sub of subs) {
      if (sub.channel === 'push') {
        const result = await sendPush(sub.destination, event, offer)
        if (result === 'expired') {
          // Tote Subscription abmelden, nicht als versendet zählen.
          await d1Query("UPDATE subscriptions SET status='unsubscribed' WHERE id=?", [sub.id])
          continue
        }
      } else if (sub.channel === 'telegram') {
        await sendTelegram(sub.destination, telegramMessage(event, offer))
      } else {
        await sendEmail(sub.destination, alarmEmail(event, offer, sub.token))
      }
      await d1Query('UPDATE subscriptions SET notified_at=? WHERE id=?', [new Date().toISOString(), sub.id])
      sent++
    }
  }

  // --- Preiswecker (Pro): aktueller Preis vs. Zielwert je Abo ---------------
  const targetSubs = await d1Query(
    "SELECT id, channel, destination, token, product_key, product_label, target_price, target_metric, notified_at FROM subscriptions WHERE status='confirmed' AND target_price IS NOT NULL",
  )
  let weckerSent = 0
  for (const sub of targetSubs) {
    const offer = offerByKey.get(sub.product_key)
    const price = offer ? (sub.target_metric === 'liter' ? offer.perLiter : offer.perUnit) : null
    const decision = weckerDecision(price, sub.target_price, sub.notified_at)
    if (decision === 'fire') {
      if (sub.channel === 'telegram') await sendTelegram(sub.destination, weckerEmail(sub, offer, price).text.replace(/\n/g, '\n'))
      else await sendEmail(sub.destination, weckerEmail(sub, offer, price))
      await d1Query('UPDATE subscriptions SET notified_at=? WHERE id=?', [new Date().toISOString(), sub.id])
      weckerSent++
    } else if (decision === 'reset') {
      await d1Query('UPDATE subscriptions SET notified_at=NULL WHERE id=?', [sub.id])
    }
  }
  console.log(`[send-alarms] ${sent} Bestpreis-Alarm(e), ${weckerSent} Preiswecker versendet.`)
}

// --- Selbsttest der Erkennungslogik (ohne Cloud) ---------------------------
function selftest() {
  const mk = (points) => ({ brand: 'X', title: 'Y', market: 'M', unitLabel: 'U', points })
  const history = {
    products: {
      // neues Tief am jüngsten Tag -> Event
      'a': mk([{ date: '2026-07-01', perLiter: 1.8 }, { date: '2026-07-08', perLiter: 1.5 }]),
      // gleichbleibend niedrig -> KEIN Event
      'b': mk([{ date: '2026-07-01', perLiter: 1.5 }, { date: '2026-07-08', perLiter: 1.5 }]),
      // Tief lag in der Vergangenheit, heute teurer -> KEIN Event
      'c': mk([{ date: '2026-07-01', perLiter: 1.4 }, { date: '2026-07-08', perLiter: 1.6 }]),
      // nur ein Tag -> KEIN Event
      'd': mk([{ date: '2026-07-08', perLiter: 1.2 }]),
      // jüngster Tag != runDay (Produkt war im Lauf nicht dabei) -> KEIN Event
      'e': mk([{ date: '2026-06-01', perLiter: 1.9 }, { date: '2026-06-08', perLiter: 1.1 }]),
    },
  }
  const events = detectNewBestPrices(history)
  const keys = events.map((e) => e.productKey).sort()
  const detectOk = keys.length === 1 && keys[0] === 'a'

  // Preiswecker: fire (unter Ziel, ungemeldet), none (unter Ziel, gemeldet),
  // reset (wieder über Ziel, war gemeldet), none (über Ziel, ungemeldet).
  const weckerOk =
    weckerDecision(0.7, 0.79, null) === 'fire' &&
    weckerDecision(0.7, 0.79, '2026-07-01') === 'none' &&
    weckerDecision(0.9, 0.79, '2026-07-01') === 'reset' &&
    weckerDecision(0.9, 0.79, null) === 'none' &&
    weckerDecision(null, 0.79, null) === 'none'

  const ok = detectOk && weckerOk
  console.log(
    ok
      ? '✓ selftest bestanden (Erkennung "a" + Preiswecker-Logik)'
      : `✗ selftest FEHLGESCHLAGEN: detect=${detectOk} keys=${JSON.stringify(keys)} wecker=${weckerOk}`,
  )
  process.exit(ok ? 0 : 1)
}

// Nur beim direkten Aufruf ausführen – Import (z. B. für Tests) bleibt seiteneffektfrei.
const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  if (process.argv.includes('--selftest')) selftest()
  else main().catch((err) => { console.error('[send-alarms]', err); process.exit(1) })
}
