// Normalisiert die heterogenen Scraper-Outputs aus ../scrapers/captured/*offers*.json
// in ein einheitliches Offer-Schema und schreibt src/data/offers.json.
//
// Die Quellen liefern den Grundpreis (€/L) in fünf verschiedenen Formen –
// hier wird er auf ein Feld `perLiter` (number | null) vereinheitlicht.
//
// Aufruf: node scripts/prepare-data.mjs   (läuft automatisch via predev/prebuild)

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { normalize, isEnergyDrink } from './lib/normalize.mjs'
import { appendToHistory, emptyHistory } from './lib/history.mjs'
import { buildRobots, buildSitemap, byBrand, brandSlug, buildBrandPage } from './seo.mjs'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const capturedDir = resolve(scriptDir, '../scrapers/captured')
const outDir = resolve(scriptDir, '../src/data')
const outFile = join(outDir, 'offers.json')
const historyFile = join(outDir, 'price-history.json')
const publicDir = resolve(scriptDir, '../public')

// --- Läuft ---
if (!existsSync(capturedDir)) {
  console.warn(`[prepare-data] captured/ nicht gefunden (${capturedDir}) – schreibe leere Liste.`)
  mkdirSync(outDir, { recursive: true })
  writeFileSync(outFile, JSON.stringify({ generatedAt: new Date().toISOString(), offers: [] }, null, 2))
  process.exit(0)
}

const files = readdirSync(capturedDir).filter((f) => /offers.*\.json$/i.test(f))
const raw = []
for (const f of files) {
  try {
    const parsed = JSON.parse(readFileSync(join(capturedDir, f), 'utf8'))
    if (Array.isArray(parsed)) raw.push(...parsed)
  } catch (err) {
    console.warn(`[prepare-data] ${f} übersprungen: ${err.message}`)
  }
}

let rejected = 0
const offers = raw
  .map(normalize)
  .filter((o) => {
    if (!o.title || o.price == null) return false
    if (!isEnergyDrink(o)) {
      console.warn(`[prepare-data] Fehltreffer verworfen: ${o.market} · ${o.brand} · "${o.title}"`)
      rejected++
      return false
    }
    return true
  })
  // Duplikate (gleiche id) zusammenführen – jüngster scrapedAt gewinnt
  .reduce((acc, o) => {
    const prev = acc.get(o.id)
    if (!prev || (o.scrapedAt || '') > (prev.scrapedAt || '')) acc.set(o.id, o)
    return acc
  }, new Map())

const list = [...offers.values()]
mkdirSync(outDir, { recursive: true })
writeFileSync(outFile, JSON.stringify({ generatedAt: new Date().toISOString(), count: list.length, offers: list }, null, 2))
console.log(
  `[prepare-data] ${list.length} Angebote aus ${files.length} Dateien` +
    (rejected ? ` (${rejected} Fehltreffer verworfen)` : '') +
    ` -> src/data/offers.json`,
)

// --- Preishistorie fortschreiben (append-only, ein Punkt je Produkt & Tag) ---
// Jeder Lauf ergänzt die Historie um den heute erfassten Grundpreis/Stückpreis,
// damit die App später "Bestpreis"/"günstiger als üblich" ableiten kann. Der
// Datenpunkt wird am *Scan-Tag* (scrapedAt) verbucht, nicht am Ausführungstag –
// so erzeugt ein erneuter Lauf über alte captured-Daten keine falschen Punkte.
let history = emptyHistory()
if (existsSync(historyFile)) {
  try {
    const parsed = JSON.parse(readFileSync(historyFile, 'utf8'))
    if (parsed && typeof parsed === 'object' && parsed.products) history = parsed
  } catch (err) {
    console.warn(`[prepare-data] price-history.json unlesbar, starte neu: ${err.message}`)
  }
}

const newPoints = appendToHistory(history, list)
writeFileSync(historyFile, JSON.stringify(history, null, 2))
console.log(
  `[prepare-data] Historie: ${Object.keys(history.products).length} Produkte` +
    (newPoints ? `, +${newPoints} neue Tagespunkte` : ', keine neuen Tagespunkte') +
    ` -> src/data/price-history.json`,
)

// --- SEO-Artefakte erzeugen (robots.txt, sitemap.xml, Marken-Landingpages) --
// Statisch nach public/ – Vite kopiert das unverändert nach dist/. So sind die
// Marken-Deals auch ohne JS crawlbar (Long-Tail), und Bots finden die Sitemap.
mkdirSync(publicDir, { recursive: true })
writeFileSync(join(publicDir, 'robots.txt'), buildRobots())
writeFileSync(join(publicDir, 'sitemap.xml'), buildSitemap(list))

const markenDir = join(publicDir, 'marken')
mkdirSync(markenDir, { recursive: true })
const brandMap = byBrand(list)
for (const [brand, brandOffers] of brandMap) {
  writeFileSync(join(markenDir, `${brandSlug(brand)}.html`), buildBrandPage(brand, brandOffers))
}
console.log(`[prepare-data] SEO: robots.txt, sitemap.xml, ${brandMap.size} Marken-Seiten -> public/`)
