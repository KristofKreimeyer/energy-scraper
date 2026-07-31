// Typdeklarationen für scripts/seo.mjs (nur die in vite.config.ts genutzten
// Funktionen). Der Angebots-Typ ist bewusst lose gehalten – das Modul liest
// die von prepare-data.mjs erzeugten Felder defensiv.

interface SeoOffer {
  brand: string
  title: string
  market: string
  price: number
  perLiter?: number | null
  unitLabel?: string | null
  imageUrl?: string | null
  url?: string | null
  validFrom?: string | null
  validTo?: string | null
}

export function buildTitle(offers: SeoOffer[], now?: Date): string
export function buildDescription(offers: SeoOffer[], now?: Date): string
export function buildJsonLd(offers: SeoOffer[]): string
export function buildNoscript(offers: SeoOffer[]): string
export function buildRobots(): string
export function buildSitemap(offers: SeoOffer[], now?: Date): string
export function byBrand(offers: SeoOffer[]): Map<string, SeoOffer[]>
export function brandSlug(brand: string): string
export function buildBrandPage(brand: string, brandOffers: SeoOffer[], now?: Date): string
