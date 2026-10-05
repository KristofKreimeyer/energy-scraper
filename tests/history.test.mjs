import { describe, expect, it } from 'vitest'
import { appendToHistory, dayStr, emptyHistory } from '../scripts/lib/history.mjs'

const offer = (over = {}) => ({
  market: 'Lidl',
  brand: 'Monster',
  title: 'Energy',
  unitLabel: '0,5-l-Dose',
  price: 1,
  perUnit: 1,
  perLiter: 2,
  scrapedAt: '2026-07-20T05:00:00.000Z',
  ...over,
})

describe('appendToHistory', () => {
  it('legt Produkt und Tagespunkt an', () => {
    const h = emptyHistory()
    expect(appendToHistory(h, [offer()])).toBe(1)
    expect(h.products['lidl|monster|energy|0,5-l-dose'].points).toEqual([{ date: '2026-07-20', price: 1, perUnit: 1, perLiter: 2 }])
  })
  it('überschreibt den Punkt desselben Tages statt zu duplizieren', () => {
    const h = emptyHistory()
    appendToHistory(h, [offer()])
    expect(appendToHistory(h, [offer({ price: 0.9, perLiter: 1.8 })])).toBe(0)
    const pts = Object.values(h.products)[0].points
    expect(pts).toHaveLength(1)
    expect(pts[0].perLiter).toBe(1.8)
  })
  it('sortiert Punkte chronologisch und trackt über Preisänderungen (preisunabhängiger Key)', () => {
    const h = emptyHistory()
    appendToHistory(h, [offer({ scrapedAt: '2026-07-27T05:00:00Z', price: 0.8 })])
    appendToHistory(h, [offer()])
    expect(Object.keys(h.products)).toHaveLength(1)
    expect(Object.values(h.products)[0].points.map((p) => p.date)).toEqual(['2026-07-20', '2026-07-27'])
  })
  it('überspringt Angebote ohne Vergleichspreis', () => {
    const h = emptyHistory()
    expect(appendToHistory(h, [offer({ perLiter: null, perUnit: null })])).toBe(0)
    expect(h.products).toEqual({})
  })
  it('dayStr: UTC-Tag, Fallback heute bei ungültigem Wert', () => {
    expect(dayStr('2026-07-20T23:30:00-05:00')).toBe('2026-07-21')
    expect(dayStr('kaputt')).toBe(new Date().toISOString().slice(0, 10))
  })
})
