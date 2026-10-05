// Zweck: Gemeinsame, framework-freie Kernfunktionen, die an mehreren Stellen
//   IDENTISCH sein müssen (Daten-Pipeline, Alarm-Versand, Frontend, Worker).
//   Früher war z. B. productKey dreifach kopiert ("muss identisch sein"-Kommentar).
//
// Genutzt von: scripts/prepare-data.mjs, scripts/send-alarms.mjs, scripts/seo.mjs,
//   scripts/send-weekly-push.mjs, src/lib/offers.ts, worker/src/*.
// Typen: shared/core.d.mts

export const DAY_MS = 86_400_000

/**
 * Preisunabhängiger Produktschlüssel (Markt|Marke|Titel|Gebinde, getrimmt &
 * kleingeschrieben). Bewusst OHNE Preis – so lässt sich derselbe Artikel über
 * die Wochen verfolgen. Schlüssel der Preishistorie und der Community-Votes.
 */
export function productKey(o) {
  return [o.market, o.brand, o.title, o.unitLabel]
    .map((s) =>
      String(s ?? '')
        .trim()
        .toLowerCase(),
    )
    .join('|')
}

/** Normalisierte Marke für Wecker-Abos (Speicherung im Worker == Match im Versand). */
export function brandKey(brand) {
  return String(brand ?? '')
    .trim()
    .toLowerCase()
}

/** Kalendertag (UTC) als ganze Zahl seit 1970 – für Vergleiche auf Tagesebene. */
export function utcDay(d) {
  return Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / DAY_MS)
}

/** Median einer Zahlenliste (unsortiert erlaubt); null bei leerer Liste. */
export function median(values) {
  if (values.length === 0) return null
  const v = [...values].sort((a, b) => a - b)
  const mid = Math.floor(v.length / 2)
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2
}

/**
 * Gesamtvolumen in Litern aus Freitext ("0,5-L-Dose", "250-ml", "10 x 0,5 l"
 * -> 5). Mehrfachgebinde zählen mit; null, wenn kein Volumen erkennbar ist.
 */
export function parseLiters(str) {
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
