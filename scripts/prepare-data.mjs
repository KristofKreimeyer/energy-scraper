// Normalisiert die heterogenen Scraper-Outputs aus ../captured/*offers*.json
// in ein einheitliches Offer-Schema und schreibt src/data/offers.json.
//
// Die Quellen liefern den Grundpreis (€/L) in fünf verschiedenen Formen –
// hier wird er auf ein Feld `perLiter` (number | null) vereinheitlicht.
//
// Aufruf: node scripts/prepare-data.mjs   (läuft automatisch via predev/prebuild)

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const capturedDir = resolve(scriptDir, '../../captured')
const outDir = resolve(scriptDir, '../src/data')
const outFile = join(outDir, 'offers.json')

/** Kurzlabel + Markenfarbe je Supermarkt (für Badge & Platzhalter-Dose). */
const MARKET_META = {
  'Aldi Nord': { label: 'Aldi Nord', color: '#0B3A8C' },
  'Aldi Süd': { label: 'Aldi Süd', color: '#0B3A8C' },
  Kaufland: { label: 'Kaufland', color: '#C4122E' },
  Lidl: { label: 'Lidl', color: '#0050AA' },
  'Netto Marken-Discount': { label: 'Netto', color: '#F7C600' },
  Netto: { label: 'Netto', color: '#F7C600' },
  Penny: { label: 'Penny', color: '#C4122E' },
  Rewe: { label: 'Rewe', color: '#CC0000' },
  Norma: { label: 'Norma', color: '#E2001A' },
}

/** "0,79 €" -> 0.79 */
function parsePrice(str) {
  if (typeof str !== 'number' && !str) return null
  if (typeof str === 'number') return str
  const m = String(str).replace(/\s/g, '').match(/(\d+(?:[.,]\d+)?)/)
  return m ? parseFloat(m[1].replace(',', '.')) : null
}

/** Volumen in Litern aus Freitext ("0,5-L-Dose", "250-ml", "10 x 0,5 l"). */
function parseLiters(str) {
  if (!str) return null
  const s = String(str).toLowerCase()
  const multi = s.match(/(\d+)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*-?\s*(ml|liter|l)(?![a-z])/)
  if (multi) {
    const count = parseInt(multi[1], 10)
    let vol = parseFloat(multi[2].replace(',', '.'))
    if (multi[3] === 'ml') vol /= 1000
    return count * vol
  }
  const single = s.match(/(\d+(?:[.,]\d+)?)\s*-?\s*(ml|liter|l)(?![a-z])/)
  if (single) {
    let vol = parseFloat(single[1].replace(',', '.'))
    if (single[2] === 'ml') vol /= 1000
    return vol
  }
  return null
}

/** Grundpreis (€/L) aus allen bekannten Quellfeldern ableiten. */
function derivePerLiter(o, priceNumber) {
  // 1) marktguru: referencePrice + unit "Liter"
  if (typeof o.referencePrice === 'number' && /liter/i.test(o.unit || '')) {
    return round2(o.referencePrice)
  }
  // 2) rewe: pricePerLiter "3.96"
  if (o.pricePerLiter != null) {
    const v = parseFloat(String(o.pricePerLiter).replace(',', '.'))
    if (!Number.isNaN(v)) return round2(v)
  }
  // 3) netto: pricePerBaseUnit "(1.54 / l)"
  if (o.pricePerBaseUnit) {
    const m = String(o.pricePerBaseUnit).match(/(\d+(?:[.,]\d+)?)\s*\/\s*l/i)
    if (m) return round2(parseFloat(m[1].replace(',', '.')))
  }
  // 4) rewe/aldi: aus "(1 l = 3,96 €)" im Beschreibungstext
  const anyText = `${o.details || ''} ${o.description || ''}`
  const inline = anyText.match(/1\s*l\s*=\s*(\d+(?:[.,]\d+)?)/i)
  if (inline) return round2(parseFloat(inline[1].replace(',', '.')))
  // 5) selbst berechnen: Preis / Volumen
  if (priceNumber != null) {
    const liters = parseLiters(o.salesUnit) ?? parseLiters(o.description) ?? parseLiters(o.title)
    if (liters && liters > 0) return round2(priceNumber / liters)
  }
  return null
}

const round2 = (n) => Math.round(n * 100) / 100

/** Gültigkeitsdaten normalisieren -> ISO-Strings oder null. */
function parseDate(value, fallbackYear) {
  if (!value) return null
  // deutsches "20.7." oder "20.07.2026"
  const de = String(value).match(/^(\d{1,2})\.(\d{1,2})\.?(\d{4})?$/)
  if (de) {
    const [, d, m, y] = de
    const year = y || fallbackYear || new Date().getFullYear()
    return new Date(Date.UTC(+year, +m - 1, +d)).toISOString()
  }
  const t = Date.parse(value)
  return Number.isNaN(t) ? null : new Date(t).toISOString()
}

function slug(...parts) {
  return parts
    .join('-')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

function normalize(o) {
  const supermarket = o.supermarket || 'Unbekannt'
  const meta = MARKET_META[supermarket] || { label: supermarket, color: '#5B6772' }
  const priceNumber = o.priceNumber ?? parsePrice(o.price)
  const scrapedYear = o.scrapedAt ? new Date(o.scrapedAt).getUTCFullYear() : undefined

  // Bevorzugt eine größenhaltige Angabe ("0,5-L-Dose"); erst danach ein
  // größenloses salesUnit ("je Dose") oder ein Beschreibungsfragment.
  const unitLabel =
    sizeFromText(o.salesUnit) ||
    sizeFromText(o.description) ||
    sizeFromText(o.details) ||
    sizeFromText(o.title) ||
    o.salesUnit ||
    ((o.description || o.details) ? String(o.description || o.details).split(/[,;]/)[0].trim() : '') ||
    '—'

  const unitCount = parseUnitCount(o)
  const perUnit = priceNumber != null ? round2(priceNumber / unitCount) : null

  return {
    id: String(o.offerId || o.webshopIdentifier || slug(meta.label, o.brand, o.title, String(priceNumber))),
    brand: o.brand || o.productBrand || 'Unbekannt',
    title: (o.title || '').trim(),
    description: (o.description || o.details || '').trim() || null,
    supermarket,
    market: meta.label,
    marketColor: meta.color,
    price: priceNumber,
    priceText: o.price || (priceNumber != null ? `${priceNumber.toFixed(2).replace('.', ',')} €` : null),
    oldPrice: parsePrice(o.oldPrice),
    perLiter: derivePerLiter(o, priceNumber),
    unitLabel,
    unitCount,
    perUnit,
    validFrom: parseDate(o.validFrom, scrapedYear),
    validTo: parseDate(o.validTo, scrapedYear),
    imageUrl: o.imageUrl || null,
    url: o.productUrl || o.sourceUrl || null,
    scrapedAt: o.scrapedAt || null,
  }
}

// Defensiver Guard: spiegelt die Garantie des gefixten marktguru-Scrapers.
// Fehltreffer wie "Thai-Monstera" (Zimmerpflanze – der Substring "Monster"
// matcht die Marke) enthalten weder das Wort "Energy" noch ein plausibles
// Getränke-Volumen und werden hier verworfen. Schützt die App auch vor
// veralteten captured-Daten von *vor* dem Scraper-Fix, ohne das rohe Archiv
// anzufassen.
function isEnergyDrink(o) {
  const text = [o.brand, o.title, o.description].filter(Boolean).join(' ')
  if (/energy/i.test(text)) return true
  if (o.perLiter != null) return true
  return false
}

/** Anzahl Einzeldosen im Gebinde ("24 x 0,25 l" -> 24, sonst 1). */
function parseUnitCount(o) {
  const text = [o.salesUnit, o.description, o.title, o.unit].filter(Boolean).join(' ')
  const m = text.match(/(\d+)\s*[x×]\s*\d/) // "24 x 0,25", "10x0,5"
  if (m) return Math.max(1, parseInt(m[1], 10))
  if (typeof o.quantity === 'number' && o.quantity > 1) return o.quantity
  return 1
}

/** Kompakte Größenangabe aus Freitext ("... je 0,5-l-Dose ..." -> "0,5-l-Dose"). */
function sizeFromText(str) {
  if (!str) return null
  const m = String(str).match(/(\d+\s*[x×]\s*)?\d+(?:[.,]\d+)?\s*-?\s*(?:ml|liter|l)\b[-\s]?(?:dose|flasche|karton|tray|paket)?/i)
  return m ? m[0].replace(/\s+/g, ' ').trim() : null
}

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
writeFileSync(
  outFile,
  JSON.stringify({ generatedAt: new Date().toISOString(), count: list.length, offers: list }, null, 2),
)
console.log(
  `[prepare-data] ${list.length} Angebote aus ${files.length} Dateien` +
    (rejected ? ` (${rejected} Fehltreffer verworfen)` : '') +
    ` -> src/data/offers.json`,
)
