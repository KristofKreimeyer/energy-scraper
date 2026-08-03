// Zweck: Prüft nach dem Scrape die frisch normalisierte src/data/offers.json.
//   Liefert der Lauf zu wenige Angebote (Default: < 1 = komplett leer), gilt er
//   als kaputt → E-Mail-Alarm an den Betreiber (Brevo) UND Exit-Code 1. Der
//   nicht-null Exit lässt den refresh-data-Step fehlschlagen: der Daten-Commit
//   und die folgenden Schritte werden übersprungen (keine leeren Daten live),
//   und GitHub schickt zusätzlich die „Workflow fehlgeschlagen"-Mail.
// Nutzung: node scripts/notify-scrape-health.mjs
//   Env: MIN_OFFERS (Default 1), BREVO_API_KEY, EMAIL_FROM, EMAIL_FROM_NAME,
//        ALERT_EMAIL (Default = EMAIL_FROM). Ohne Brevo läuft ein Trockenlauf
//        (nur Log), der Exit-Code bleibt aber 1 → GitHub-Mail greift trotzdem.

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const offersPath = resolve(scriptDir, '../src/data/offers.json')

const MIN = Number(process.env.MIN_OFFERS || '1')
const BREVO_API_KEY = process.env.BREVO_API_KEY
const EMAIL_FROM = process.env.EMAIL_FROM || 'alarm@energyhunt.de'
const EMAIL_FROM_NAME = process.env.EMAIL_FROM_NAME || 'EnergyHunt'
const ALERT_EMAIL = process.env.ALERT_EMAIL || EMAIL_FROM

let offers = []
try {
  offers = JSON.parse(readFileSync(offersPath, 'utf8')).offers ?? []
} catch (err) {
  console.error(`[health] offers.json unlesbar (${err.message}) – als 0 Angebote gewertet.`)
}

const total = offers.length
const byMarket = {}
for (const o of offers) byMarket[o.market] = (byMarket[o.market] ?? 0) + 1
const breakdown =
  Object.entries(byMarket)
    .sort((a, b) => b[1] - a[1])
    .map(([m, n]) => `${m}: ${n}`)
    .join(', ') || '—'

const runUrl =
  process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
    ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
    : null

if (total >= MIN) {
  console.log(`[health] OK: ${total} Angebote (${breakdown})`)
  process.exit(0)
}

console.error(`[health] KRITISCH: nur ${total} Angebote (Minimum ${MIN}). Aufschlüsselung: ${breakdown}`)

if (BREVO_API_KEY) {
  const text =
    `Scraper-Warnung: Der letzte Datenlauf ergab nur ${total} Energy-Drink-Angebote (Minimum ${MIN}).\n\n` +
    `Aufschlüsselung je Markt: ${breakdown}\n` +
    (runUrl ? `\nGitHub-Run: ${runUrl}\n` : '') +
    `\nDie neuen Daten wurden NICHT committet/deployt – die Live-Seite behält die letzten guten Daten. ` +
    `Bitte die Scraper prüfen (evtl. hat ein Händler sein Seiten-/API-Format geändert).`
  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: { email: EMAIL_FROM, name: EMAIL_FROM_NAME },
        to: [{ email: ALERT_EMAIL }],
        subject: `⚠️ EnergyHunt: Scraper lieferte nur ${total} Angebote`,
        textContent: text,
      }),
    })
    console.log(res.ok ? `[health] Alarm-Mail an ${ALERT_EMAIL} gesendet.` : `[health] Alarm-Mail fehlgeschlagen: ${res.status}`)
  } catch (err) {
    console.error(`[health] Alarm-Mail-Fehler: ${err.message}`)
  }
} else {
  console.log('[health] Kein BREVO_API_KEY – Alarm nur als Log (Trockenlauf); Exit-Code trotzdem 1.')
}

process.exitCode = 1
