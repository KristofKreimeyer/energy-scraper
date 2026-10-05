// Zweck: Preishistorie (src/data/price-history.json) fortschreiben –
//   append-only, ein Datenpunkt je Produkt & UTC-Tag. Der Punkt wird am
//   *Scan-Tag* (scrapedAt) verbucht, nicht am Ausführungstag, damit ein
//   erneuter Lauf über alte captured-Daten keine falschen Punkte erzeugt.
//   Reine Funktionen (kein I/O) – testbar in tests/history.test.mjs.

import { productKey } from '../../shared/core.mjs'

/** Leere Historie. */
export const emptyHistory = () => ({ updatedAt: null, products: {} })

/** UTC-Kalendertag (YYYY-MM-DD) eines ISO-Zeitstempels; Fallback: heute. */
export function dayStr(iso) {
  const d = iso ? new Date(iso) : new Date()
  return (Number.isNaN(d.getTime()) ? new Date() : d).toISOString().slice(0, 10)
}

/**
 * Ergänzt `history` (mutiert) um die Datenpunkte der Angebotsliste.
 * Produkte ohne vergleichbaren Preis (weder €/L noch Stückpreis) werden übersprungen.
 * @returns {number} Anzahl neu angelegter Tagespunkte
 */
export function appendToHistory(history, offers) {
  let newPoints = 0
  for (const o of offers) {
    if (o.perLiter == null && o.perUnit == null) continue
    const entry = (history.products[productKey(o)] ??= {
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
  return newPoints
}
