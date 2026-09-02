/**
 * run-all.js
 *
 * Zweck: Orchestriert alle produktiven Energy-Drink-Scraper in einem Lauf.
 * Jeder Scraper läuft als eigener Node-Prozess – ein toter Händler bricht den
 * Gesamtlauf nicht ab. Danach wird die Normalisierung angestoßen
 * (../scripts/prepare-data.mjs), sodass offers.json UND price-history.json in
 * einem Rutsch fortgeschrieben werden.
 *
 * Liegt in energy-scraper/scrapers/ neben den Scrapern und captured/.
 *
 * Nutzung:
 *   node run-all.js
 *   ALDI_SUED_SLUG="kw30-26-op-mp" node run-all.js   (Aldi-Süd-Prospekt-Slug erzwingen)
 *
 * Aldi Süd läuft immer mit – der Scraper leitet den Publikations-Slug selbst
 * aus der aktuellen ISO-Kalenderwoche ab (empirisch verifiziert). ALDI_SUED_SLUG
 * ist nur noch ein Notausstieg, falls Aldi Süd das URL-Schema mal ändert oder
 * der Cron-Lauf zufällig genau in der Rollover-Lücke zwischen zwei
 * Prospekt-Wochen läuft.
 *
 * Exit-Code: 1, wenn KEIN Scraper durchlief oder die Normalisierung scheiterte;
 * sonst 0 (Teilausfälle einzelner Händler sind tolerierbar).
 */

const { spawnSync } = require('node:child_process')
const path = require('node:path')

const ROOT = __dirname
const node = process.execPath
const SCRAPER_TIMEOUT_MS = 5 * 60 * 1000

// Nur produktive Quellen mit verlässlich strukturierten Preisen. Die reinen
// Explorations-Tools (sniff-network, find-*, inspect-*) sowie kaufland-flyer
// (nur Seitentreffer, kein Stückpreis) bleiben bewusst außen vor.
const jobs = [
  { name: 'Aldi Nord', script: 'aldi-nord-scraper.js', args: [] },
  // Ohne Argument leitet der Scraper den Slug selbst aus der ISO-Woche ab;
  // ALDI_SUED_SLUG (falls gesetzt) erzwingt einen bestimmten Slug.
  {
    name: 'Aldi Süd (Prospekt)',
    script: 'aldi-sued-prospekt-scraper.js',
    args: process.env.ALDI_SUED_SLUG ? [process.env.ALDI_SUED_SLUG] : [],
  },
  { name: 'Kaufland (marktguru)', script: 'marktguru-api-scraper.js', args: ['kaufland'] },
  { name: 'Lidl (marktguru)', script: 'marktguru-api-scraper.js', args: ['lidl'] },
  { name: 'Penny (nativer Feed)', script: 'penny-native-scraper.js', args: [] },
  { name: 'Netto (kaufda)', script: 'netto-kaufda-scraper.js', args: [] },
  { name: 'Rewe', script: 'rewe-scraper.js', args: [] },
]

const results = []
for (const job of jobs) {
  console.log(`\n=== ${job.name} :: node ${job.script} ${job.args.join(' ')} ===`)
  const r = spawnSync(node, [path.join(ROOT, job.script), ...job.args], {
    cwd: ROOT,
    stdio: 'inherit',
    timeout: SCRAPER_TIMEOUT_MS,
  })
  const ok = r.status === 0 && !r.error
  if (!ok) {
    const reason = r.error ? r.error.message : `Exit-Code ${r.status}`
    console.warn(`[run-all] ${job.name} fehlgeschlagen (${reason}) – weiter mit der nächsten Quelle.`)
  }
  results.push({ name: job.name, ok })
}

// Normalisierung + Historie fortschreiben (liest ../captured relativ zu sich selbst).
console.log('\n=== Normalisierung (prepare-data.mjs) ===')
const prep = spawnSync(node, [path.join(ROOT, '..', 'scripts', 'prepare-data.mjs')], {
  cwd: ROOT,
  stdio: 'inherit',
})
const prepOk = prep.status === 0 && !prep.error

// Zusammenfassung
const okCount = results.filter((r) => r.ok).length
console.log('\n=== Lauf-Protokoll ===')
for (const r of results) console.log(`  ${r.ok ? '✓' : '✗'} ${r.name}`)
console.log(`  ${prepOk ? '✓' : '✗'} Normalisierung`)
console.log(`\n${okCount}/${results.length} Scraper erfolgreich · Normalisierung ${prepOk ? 'ok' : 'FEHLGESCHLAGEN'}.`)

if (okCount === 0 || !prepOk) process.exit(1)
