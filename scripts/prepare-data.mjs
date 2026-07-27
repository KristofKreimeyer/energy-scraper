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

const scriptDir = dirname(fileURLToPath(import.meta.url))
const capturedDir = resolve(scriptDir, '../scrapers/captured')
const outDir = resolve(scriptDir, '../src/data')
const outFile = join(outDir, 'offers.json')
const historyFile = join(outDir, 'price-history.json')

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

/**
 * Zuckergehalt aus Produkttext klassifizieren: 'zero' | 'sugar' | 'both'.
 *
 * Prospekte spezifizieren den Zuckergehalt selten pro Angebot – die meisten
 * bewerben "Versch. Sorten" (die gesamte Range zu einem Preis). Solche Bündel
 * und unklare Fälle bekommen 'both': Sie enthalten die Zero-Variante ebenso wie
 * die gezuckerte und sollen daher in BEIDEN Filtern ("zuckerfrei"/"mit Zucker")
 * erscheinen. Nur explizit ausgezeichnete Einzelprodukte werden 'zero'/'sugar'.
 */
function classifySugar(o) {
  const t = `${o.title || ''} ${o.description || ''} ${o.salesUnit || ''}`.toLowerCase()
  const zero = /zuckerfrei|zero|sugar\s?-?free|ohne zucker|no sugar/.test(t)
  const sugar = /\bclassic\b|\boriginal\b|mit zucker/.test(t)
  if (zero && !sugar) return 'zero'
  if (sugar && !zero) return 'sugar'
  return 'both'
}

/**
 * App-/Loyalty-gebundene Preise erkennen und regulären vs. App-Preis trennen.
 *
 * Warum nötig: Bei marktguru steht die Bedingung nur im Freitext, und das
 * API-Feld `offer.price` ist UNEINHEITLICH – mal ist es der App-Preis
 * ("MIT PENNY APP … ohne Penny App 1.49"  -> 0.79 = App-Preis), mal der
 * reguläre ("MIT PENNY APP 0.88 €"  -> 0.99 = regulär, 0.88 = App). Blind
 * `offer.price` zu ranken machte z. B. Rockstar fälschlich zum Bestpreis.
 * Verlässlich ist nur der Text; REWE liefert zusätzlich `loyaltyBonus`.
 *
 * Regel: Eine Zahl DIREKT hinter "mit … app" ist der App-Preis, eine Zahl
 * direkt hinter "ohne … app" der reguläre – so werden Pfand-/Volumenzahlen
 * ("0.25 Pfand", "0,5 l") nicht versehentlich als Preis gelesen.
 *
 * @returns {{ requiresApp: boolean, appPrice: number|null, regularPrice: number|null }}
 *   Preise soweit ableitbar, sonst null.
 */
function detectAppPricing(o, apiPrice) {
  const text = `${o.description || ''} ${o.details || ''}`
  const hasAppText = /\bmit\s+[\w-]*\s*app\b|app[- ]?preis|nur\s+mit\s+app/i.test(text)
  if (!hasAppText && !o.loyaltyBonus) {
    return { requiresApp: false, appPrice: null, regularPrice: null }
  }

  // Zahl unmittelbar hinter der Bedingung (max. ein €/Leerzeichen dazwischen).
  const ohne = text.match(/ohne\s+[\w-]*\s*app\s*€?\s*(\d+(?:[.,]\d+)?)/i)
  const mit = text.match(/mit\s+[\w-]*\s*app\s*€?\s*(\d+(?:[.,]\d+)?)/i)

  let regularPrice = ohne ? round2(parseFloat(ohne[1].replace(',', '.'))) : null
  let appPrice = mit ? round2(parseFloat(mit[1].replace(',', '.'))) : null

  if (regularPrice != null && appPrice == null) {
    // "ohne App X" bekannt -> das API-Feld ist der App-Preis.
    appPrice = apiPrice
  } else if (appPrice != null && regularPrice == null) {
    // "mit App X" bekannt -> das API-Feld ist der reguläre Preis.
    regularPrice = apiPrice
  }
  return { requiresApp: true, appPrice, regularPrice }
}

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

/**
 * Preisunabhängiger Produktschlüssel für die Historie (Markt|Marke|Titel|Gebinde).
 * Bewusst OHNE Preis – so lässt sich derselbe Artikel über die Wochen hinweg
 * verfolgen, auch wenn sich sein Preis ändert. Muss identisch in
 * src/lib/offers.ts (productKey) berechnet werden.
 */
function productKey(o) {
  return [o.market, o.brand, o.title, o.unitLabel]
    .map((s) => String(s ?? '').trim().toLowerCase())
    .join('|')
}

/** UTC-Kalendertag (YYYY-MM-DD) eines ISO-Zeitstempels; Fallback: heute. */
function dayStr(iso) {
  const d = iso ? new Date(iso) : new Date()
  return (Number.isNaN(d.getTime()) ? new Date() : d).toISOString().slice(0, 10)
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

  // App-/Loyalty-Preis erkennen. Für Ranking & Historie zählt der REGULÄRE
  // Preis (den jeder zahlen kann); der App-Preis wird separat als Badge
  // ausgewiesen. Nur wenn ein regulärer Preis bekannt ist, ersetzen wir den
  // (u. U. app-gebundenen) API-Preis – sonst bleibt es beim API-Preis, dann
  // aber via requiresApp markiert.
  const { requiresApp, appPrice, regularPrice } = detectAppPricing(o, priceNumber)
  const overrode = requiresApp && regularPrice != null && regularPrice !== priceNumber
  const canonicalPrice = overrode ? regularPrice : priceNumber

  // Grundpreis (€/L) für einen beliebigen Preis aus dem Volumen ableiten –
  // nötig, weil die API-`referencePrice` am (evtl. App-)API-Preis hängt und
  // nach dem Umschwenken auf den regulären Preis nicht mehr passt.
  const liters = parseLiters(o.salesUnit) ?? parseLiters(o.description) ?? parseLiters(o.title)
  const perLiterFor = (p) => (p != null && liters && liters > 0 ? round2(p / liters) : null)
  const perLiter = overrode ? (perLiterFor(canonicalPrice) ?? derivePerLiter(o, canonicalPrice))
                            : derivePerLiter(o, canonicalPrice)
  const appPerLiter = requiresApp && appPrice != null
    ? (perLiterFor(appPrice) ?? (appPrice === priceNumber ? derivePerLiter(o, priceNumber) : null))
    : null

  const unitCount = parseUnitCount(o)
  const perUnit = canonicalPrice != null ? round2(canonicalPrice / unitCount) : null

  return {
    id: String(o.offerId || o.webshopIdentifier || slug(meta.label, o.brand, o.title, String(canonicalPrice))),
    brand: o.brand || o.productBrand || 'Unbekannt',
    title: (o.title || '').trim(),
    description: (o.description || o.details || '').trim() || null,
    supermarket,
    market: meta.label,
    marketColor: meta.color,
    price: canonicalPrice,
    priceText: canonicalPrice != null ? `${canonicalPrice.toFixed(2).replace('.', ',')} €` : (o.price || null),
    oldPrice: parsePrice(o.oldPrice),
    perLiter,
    sugar: classifySugar(o),
    requiresApp,
    appPrice: requiresApp && appPrice != null && appPrice !== canonicalPrice ? appPrice : null,
    appPerLiter: requiresApp && appPrice != null && appPrice !== canonicalPrice ? appPerLiter : null,
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

// --- Preishistorie fortschreiben (append-only, ein Punkt je Produkt & Tag) ---
// Jeder Lauf ergänzt die Historie um den heute erfassten Grundpreis/Stückpreis,
// damit die App später "Bestpreis"/"günstiger als üblich" ableiten kann. Der
// Datenpunkt wird am *Scan-Tag* (scrapedAt) verbucht, nicht am Ausführungstag –
// so erzeugt ein erneuter Lauf über alte captured-Daten keine falschen Punkte.
let history = { updatedAt: null, products: {} }
if (existsSync(historyFile)) {
  try {
    const parsed = JSON.parse(readFileSync(historyFile, 'utf8'))
    if (parsed && typeof parsed === 'object' && parsed.products) history = parsed
  } catch (err) {
    console.warn(`[prepare-data] price-history.json unlesbar, starte neu: ${err.message}`)
  }
}

let newPoints = 0
for (const o of list) {
  if (o.perLiter == null && o.perUnit == null) continue // nichts Vergleichbares
  const key = productKey(o)
  const entry = (history.products[key] ??= {
    market: o.market,
    brand: o.brand,
    title: o.title,
    unitLabel: o.unitLabel,
    points: [],
  })
  const date = dayStr(o.scrapedAt)
  const point = { date, price: o.price, perUnit: o.perUnit, perLiter: o.perLiter }
  const existing = entry.points.find((p) => p.date === date)
  if (existing) {
    Object.assign(existing, point) // jüngster Scan des Tages gewinnt
  } else {
    entry.points.push(point)
    newPoints++
  }
  entry.points.sort((a, b) => a.date.localeCompare(b.date))
}

history.updatedAt = new Date().toISOString()
writeFileSync(historyFile, JSON.stringify(history, null, 2))
console.log(
  `[prepare-data] Historie: ${Object.keys(history.products).length} Produkte` +
    (newPoints ? `, +${newPoints} neue Tagespunkte` : ', keine neuen Tagespunkte') +
    ` -> src/data/price-history.json`,
)
