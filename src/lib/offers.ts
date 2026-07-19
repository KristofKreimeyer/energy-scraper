import type { Offer, OffersData, SortKey } from '../types'
import data from '../data/offers.json'

const dataset = data as OffersData

export const offers: Offer[] = dataset.offers
export const generatedAt: string = dataset.generatedAt

/** Ein Angebot, das stellvertretend für mehrere Geschmackssorten steht. */
export interface GroupedOffer extends Offer {
  variantCount: number
  variantTitles: string[]
}

/**
 * Fasst identisch bepreiste Sorten desselben Produkts (gleicher Markt, Marke,
 * Preis und Gebinde) zu einer repräsentativen Karte zusammen – z. B. die drei
 * Rockstar-Sorten bei Aldi Nord (alle 0,79 € / 1,58 €/L). Als Repräsentant
 * wird bevorzugt die „Original"-Sorte gewählt, sonst die erste.
 */
export function groupOffers(list: Offer[]): GroupedOffer[] {
  const groups = new Map<string, Offer[]>()
  for (const o of list) {
    const key = `${o.market}|${o.brand}|${o.price}|${o.unitLabel}`
    const arr = groups.get(key)
    if (arr) arr.push(o)
    else groups.set(key, [o])
  }
  return [...groups.values()].map((arr) => {
    const rep = arr.find((o) => /\boriginal\b/i.test(o.title)) ?? arr[0]
    return { ...rep, variantCount: arr.length, variantTitles: arr.map((o) => o.title) }
  })
}

/** Angebote fürs Raster: Sorten sind bereits zusammengefasst. */
export const groupedOffers: GroupedOffer[] = groupOffers(offers)

const euro = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
})

export function formatEuro(value: number): string {
  return euro.format(value)
}

const decimal = new Intl.NumberFormat('de-DE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** Reine Dezimalzahl (z. B. für Preisspannen „1,54–3,96 €/L" ohne dreifaches €). */
export function formatNumber(value: number): string {
  return decimal.format(value)
}

/** Kennzahlen über die Grundpreise (€/L) einer Angebotsliste. */
export function perLiterStats(list: Offer[]): { min: number; max: number; median: number } | null {
  const values = list.map((o) => o.perLiter).filter((v): v is number => v != null).sort((a, b) => a - b)
  if (values.length === 0) return null
  const mid = Math.floor(values.length / 2)
  const median = values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2
  return { min: values[0], max: values[values.length - 1], median }
}

/** Ganze Tage bis zum Ablauf (validTo), relativ zu `now`. Null ohne Enddatum. */
export function daysUntil(validTo: string | null, now: Date = new Date()): number | null {
  if (!validTo) return null
  const end = Date.parse(validTo)
  if (Number.isNaN(end)) return null
  return Math.ceil((end - now.getTime()) / 86_400_000)
}

/** Kalendertag (UTC) als ganze Zahl – für Zeitraum-Vergleiche auf Tagesebene. */
function utcDay(d: Date): number {
  return Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 86_400_000)
}

export type OfferPhase = 'current' | 'upcoming' | 'expired' | 'ongoing'

/** Zeitliche Phase eines Angebots relativ zu `now` (auf Tagesebene). */
export function offerPhase(offer: Offer, now: Date = new Date()): OfferPhase {
  const today = utcDay(now)
  if (offer.validFrom && utcDay(new Date(offer.validFrom)) > today) return 'upcoming'
  if (offer.validTo && utcDay(new Date(offer.validTo)) < today) return 'expired'
  if (!offer.validFrom && !offer.validTo) return 'ongoing'
  return 'current'
}

export type Timeframe = 'current' | 'next'

/**
 * Filtert Angebote nach Zeitraum. Abgelaufene fallen immer raus; laufende
 * Dauerangebote (ohne Datum) erscheinen in beiden Ansichten, da stets verfügbar.
 */
export function inTimeframe<T extends Offer>(list: T[], tf: Timeframe, now: Date = new Date()): T[] {
  return list.filter((o) => {
    const phase = offerPhase(o, now)
    if (phase === 'expired') return false
    if (phase === 'ongoing') return true
    return tf === 'current' ? phase === 'current' : phase === 'upcoming'
  })
}

const dayFmt = new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })

/** Menschliche Gültigkeitsangabe + Statusflags. */
export function validity(offer: Offer, now: Date = new Date()): {
  label: string
  ending: boolean
  upcoming: boolean
} {
  const phase = offerPhase(offer, now)
  if (phase === 'upcoming' && offer.validFrom) {
    return { label: `Ab ${dayFmt.format(new Date(offer.validFrom))}`, ending: false, upcoming: true }
  }
  const days = daysUntil(offer.validTo, now)
  if (days === null) return { label: 'Laufendes Angebot', ending: false, upcoming: false }
  if (days < 0) return { label: 'Abgelaufen', ending: false, upcoming: false }
  if (days === 0) return { label: 'Endet heute', ending: true, upcoming: false }
  if (days === 1) return { label: 'Läuft morgen ab', ending: true, upcoming: false }
  return { label: `Noch ${days} Tage gültig`, ending: false, upcoming: false }
}

/** Ersparnis gegenüber dem Altpreis – Betrag (€) und Prozent, oder null. */
export function savings(offer: Offer): { amount: number; percent: number } | null {
  const old = offer.oldPrice
  if (old == null || old <= offer.price) return null
  const amount = Math.round((old - offer.price) * 100) / 100
  const percent = Math.round((amount / old) * 100)
  if (percent < 1) return null
  return { amount, percent }
}

/** Angebot mit der größten prozentualen Ersparnis („Top-Deal"), oder null. */
export function topDeal(list: Offer[]): Offer | null {
  let best: Offer | null = null
  let bestPct = 0
  for (const o of list) {
    const s = savings(o)
    if (s && s.percent > bestPct) {
      best = o
      bestPct = s.percent
    }
  }
  return best
}

/** id des Angebots mit dem günstigsten Grundpreis (bester €/L). */
export function bestPerLiterId(list: Offer[]): string | null {
  let best: Offer | null = null
  for (const o of list) {
    if (o.perLiter == null) continue
    if (!best || o.perLiter < best.perLiter!) best = o
  }
  return best?.id ?? null
}

export function sortOffers<T extends Offer>(list: T[], key: SortKey): T[] {
  const copy = [...list]
  copy.sort((a, b) => {
    switch (key) {
      case 'price':
        return a.price - b.price
      case 'brand':
        return a.brand.localeCompare(b.brand, 'de')
      case 'ending': {
        const da = daysUntil(a.validTo) ?? Number.POSITIVE_INFINITY
        const db = daysUntil(b.validTo) ?? Number.POSITIVE_INFINITY
        return da - db
      }
      case 'savings': {
        const sa = savings(a)?.percent ?? -1
        const sb = savings(b)?.percent ?? -1
        return sb - sa
      }
      case 'liter':
      default:
        return (a.perLiter ?? Infinity) - (b.perLiter ?? Infinity)
    }
  })
  return copy
}

export interface FilterState {
  market: string
  brand: string
  query: string
}

/** Wendet Markt-, Marken- und Suchfilter (UND-verknüpft) an. */
export function filterOffers<T extends Offer>(list: T[], f: FilterState): T[] {
  const q = f.query.trim().toLowerCase()
  return list.filter(
    (o) =>
      (f.market === 'all' || o.market === f.market) &&
      (f.brand === 'all' || o.brand === f.brand) &&
      (q === '' || `${o.brand} ${o.title}`.toLowerCase().includes(q)),
  )
}

/** Alle vorkommenden Märkte (alphabetisch), unabhängig von Filtern. */
export function allMarkets(list: Offer[]): string[] {
  return [...new Set(list.map((o) => o.market))].sort((a, b) => a.localeCompare(b, 'de'))
}

/** Alle vorkommenden Marken, häufigste zuerst. */
export function allBrands(list: Offer[]): string[] {
  const counts = countBy(list, (o) => o.brand)
  return [...counts.keys()].sort((a, b) => (counts.get(b)! - counts.get(a)!) || a.localeCompare(b, 'de'))
}

/** Häufigkeiten je Schlüssel – für kontextuelle Chip-Zähler. */
export function countBy(list: Offer[], key: (o: Offer) => string): Map<string, number> {
  const map = new Map<string, number>()
  for (const o of list) map.set(key(o), (map.get(key(o)) ?? 0) + 1)
  return map
}
