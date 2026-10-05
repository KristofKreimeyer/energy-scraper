// Zweck: Reine Normalisierung der heterogenen Scraper-Rohdaten zum einheitlichen
//   Offer-Schema (Preise, Grundpreis €/L, App-Preis, Zucker, Gebinde, Gültigkeit).
//   Keine I/O – dadurch testbar (tests/normalize.test.mjs). Genutzt von
//   scripts/prepare-data.mjs.

import { parseLiters } from '../../shared/core.mjs'

// Re-Export für bestehende Aufrufer/Tests.
export { parseLiters }

/** Kurzlabel + Markenfarbe je Supermarkt (für Badge & Platzhalter-Dose). */
export const MARKET_META = {
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
export function parsePrice(str) {
  if (typeof str !== 'number' && !str) return null
  if (typeof str === 'number') return str
  const m = String(str)
    .replace(/\s/g, '')
    .match(/(\d+(?:[.,]\d+)?)/)
  return m ? parseFloat(m[1].replace(',', '.')) : null
}

/** Grundpreis (€/L) aus allen bekannten Quellfeldern ableiten. */
export function derivePerLiter(o, priceNumber) {
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

export const round2 = (n) => Math.round(n * 100) / 100

/**
 * Zuckergehalt aus Produkttext klassifizieren: 'zero' | 'sugar' | 'both'.
 *
 * Prospekte spezifizieren den Zuckergehalt selten pro Angebot – die meisten
 * bewerben "Versch. Sorten" (die gesamte Range zu einem Preis). Solche Bündel
 * und unklare Fälle bekommen 'both': Sie enthalten die Zero-Variante ebenso wie
 * die gezuckerte und sollen daher in BEIDEN Filtern ("zuckerfrei"/"mit Zucker")
 * erscheinen. Nur explizit ausgezeichnete Einzelprodukte werden 'zero'/'sugar'.
 */
export function classifySugar(o) {
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
export function detectAppPricing(o, apiPrice) {
  // Strukturierte Felder (z. B. penny-native-scraper) haben Vorrang vor der
  // Freitext-Heuristik: hier ist der App-Preis bereits ein sauberes Feld.
  if (o.appPriceNumber != null) {
    return {
      requiresApp: true,
      appPrice: round2(o.appPriceNumber),
      regularPrice: apiPrice,
    }
  }
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
export function parseDate(value, fallbackYear) {
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

export function slug(...parts) {
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
 * Bevorzugt eine größenhaltige Angabe ("0,5-L-Dose"); erst danach ein
 * größenloses salesUnit ("je Dose") oder ein Beschreibungsfragment.
 */
function resolveUnitLabel(o) {
  return (
    sizeFromText(o.salesUnit) ||
    sizeFromText(o.description) ||
    sizeFromText(o.details) ||
    sizeFromText(o.title) ||
    o.salesUnit ||
    (o.description || o.details
      ? String(o.description || o.details)
          .split(/[,;]/)[0]
          .trim()
      : '') ||
    '—'
  )
}

/**
 * Kanonischer Preis, Grundpreis und App-Preis eines Rohangebots.
 *
 * App-/Loyalty-Preis erkennen. Für Ranking & Historie zählt der REGULÄRE
 * Preis (den jeder zahlen kann); der App-Preis wird separat als Badge
 * ausgewiesen. Nur wenn ein regulärer Preis bekannt ist, ersetzen wir den
 * (u. U. app-gebundenen) API-Preis – sonst bleibt es beim API-Preis, dann
 * aber via requiresApp markiert.
 */
function resolvePricing(o, priceNumber) {
  const { requiresApp, appPrice, regularPrice } = detectAppPricing(o, priceNumber)
  const overrode = requiresApp && regularPrice != null && regularPrice !== priceNumber
  const canonicalPrice = overrode ? regularPrice : priceNumber

  // Grundpreis (€/L) für einen beliebigen Preis aus dem Volumen ableiten –
  // nötig, weil die API-`referencePrice` am (evtl. App-)API-Preis hängt und
  // nach dem Umschwenken auf den regulären Preis nicht mehr passt.
  const liters = parseLiters(o.salesUnit) ?? parseLiters(o.description) ?? parseLiters(o.title)
  const perLiterFor = (p) => (p != null && liters && liters > 0 ? round2(p / liters) : null)
  const perLiter = overrode ? (perLiterFor(canonicalPrice) ?? derivePerLiter(o, canonicalPrice)) : derivePerLiter(o, canonicalPrice)

  // Quell-gelieferter App-Grundpreis (penny-native) hat Vorrang, sonst aus dem
  // Volumen ableiten.
  const appPerLiter =
    requiresApp && appPrice != null
      ? (o.appPerLiter ?? perLiterFor(appPrice) ?? (appPrice === priceNumber ? derivePerLiter(o, priceNumber) : null))
      : null

  // App-Preis nur ausweisen, wenn er vom regulären abweicht.
  const showApp = requiresApp && appPrice != null && appPrice !== canonicalPrice
  return {
    price: canonicalPrice,
    perLiter,
    requiresApp,
    appPrice: showApp ? appPrice : null,
    appPerLiter: showApp ? appPerLiter : null,
  }
}

/** Rohangebot (beliebige Quelle) -> einheitliches Offer. */
export function normalize(o) {
  const supermarket = o.supermarket || 'Unbekannt'
  const meta = MARKET_META[supermarket] || { label: supermarket, color: '#5B6772' }
  const priceNumber = o.priceNumber ?? parsePrice(o.price)
  const scrapedYear = o.scrapedAt ? new Date(o.scrapedAt).getUTCFullYear() : undefined

  const pricing = resolvePricing(o, priceNumber)
  const unitCount = parseUnitCount(o)
  const perUnit = pricing.price != null ? round2(pricing.price / unitCount) : null

  return {
    id: String(o.offerId || o.webshopIdentifier || slug(meta.label, o.brand, o.title, String(pricing.price))),
    brand: o.brand || o.productBrand || 'Unbekannt',
    title: (o.title || '').trim(),
    description: (o.description || o.details || '').trim() || null,
    supermarket,
    market: meta.label,
    marketColor: meta.color,
    price: pricing.price,
    priceText: pricing.price != null ? `${pricing.price.toFixed(2).replace('.', ',')} €` : o.price || null,
    oldPrice: parsePrice(o.oldPrice),
    perLiter: pricing.perLiter,
    sugar: classifySugar(o),
    requiresApp: pricing.requiresApp,
    appPrice: pricing.appPrice,
    appPerLiter: pricing.appPerLiter,
    unitLabel: resolveUnitLabel(o),
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
export function isEnergyDrink(o) {
  const text = [o.brand, o.title, o.description].filter(Boolean).join(' ')
  if (/energy/i.test(text)) return true
  if (o.perLiter != null) return true
  return false
}

/** Anzahl Einzeldosen im Gebinde ("24 x 0,25 l" -> 24, sonst 1). */
export function parseUnitCount(o) {
  const text = [o.salesUnit, o.description, o.title, o.unit].filter(Boolean).join(' ')
  const m = text.match(/(\d+)\s*[x×]\s*\d/) // "24 x 0,25", "10x0,5"
  if (m) return Math.max(1, parseInt(m[1], 10))
  if (typeof o.quantity === 'number' && o.quantity > 1) return o.quantity
  return 1
}

/** Kompakte Größenangabe aus Freitext ("... je 0,5-l-Dose ..." -> "0,5-l-Dose"). */
export function sizeFromText(str) {
  if (!str) return null
  const m = String(str).match(/(\d+\s*[x×]\s*)?\d+(?:[.,]\d+)?\s*-?\s*(?:ml|liter|l)\b[-\s]?(?:dose|flasche|karton|tray|paket)?/i)
  return m ? m[0].replace(/\s+/g, ' ').trim() : null
}
