/** Einheitliches Angebots-Schema – erzeugt von scripts/prepare-data.mjs. */
export interface Offer {
  id: string
  brand: string
  title: string
  description: string | null
  /** Vollständiger Name laut Scraper, z. B. "Netto Marken-Discount". */
  supermarket: string
  /** Kurzlabel für Badge/Filter, z. B. "Netto". */
  market: string
  /** Markenfarbe des Markts (Platzhalter-Dose). */
  marketColor: string
  /** Dosen-/Packungspreis in Euro. */
  price: number
  priceText: string | null
  /** Vorheriger Preis, falls angegeben (Ersparnis). */
  oldPrice: number | null
  /** Grundpreis in € pro Liter, oder null wenn nicht ableitbar. */
  perLiter: number | null
  /** Größenangabe, z. B. "0,5-L-Dose" oder "24 x 0,25-l-Dose". */
  unitLabel: string
  /** Anzahl Einzeldosen im Gebinde (1 bei Einzeldose, 24 beim Karton). */
  unitCount: number
  /** Stückpreis je Dose = price / unitCount. */
  perUnit: number
  validFrom: string | null
  validTo: string | null
  imageUrl: string | null
  url: string | null
  scrapedAt: string | null
}

export interface OffersData {
  generatedAt: string
  count: number
  offers: Offer[]
}

export type SortKey = 'liter' | 'price' | 'brand' | 'ending' | 'savings'
