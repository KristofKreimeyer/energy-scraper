import { describe, expect, it } from 'vitest'
import { brandKey, detectNewBestPrices, storeMatches, weckerDecision } from '../scripts/send-alarms.mjs'

const pt = (date, perLiter) => ({ date, price: 1, perUnit: 1, perLiter })
const prod = (points) => ({ market: 'Lidl', brand: 'Monster', title: 'X', unitLabel: '0,5 l', points })

describe('detectNewBestPrices', () => {
  it('feuert bei streng neuem Tief am Lauf-Tag', () => {
    const h = { products: { a: prod([pt('2026-07-01', 2), pt('2026-07-08', 1.5)]) } }
    const [e] = detectNewBestPrices(h)
    expect(e).toMatchObject({ productKey: 'a', perLiter: 1.5, prevMin: 2 })
  })
  it('feuert nicht bei gleichem Preis, zu kurzer Historie oder fehlendem Lauf-Tag', () => {
    expect(detectNewBestPrices({ products: { a: prod([pt('2026-07-01', 2), pt('2026-07-08', 2)]) } })).toEqual([])
    expect(detectNewBestPrices({ products: { a: prod([pt('2026-07-08', 1)]) } })).toEqual([])
    const h = {
      products: {
        a: prod([pt('2026-07-01', 2), pt('2026-07-08', 1)]),
        b: prod([pt('2026-07-01', 2), pt('2026-07-02', 1)]),
      },
    }
    expect(detectNewBestPrices(h).map((e) => e.productKey)).toEqual(['a'])
  })
  it('leere Historie', () => {
    expect(detectNewBestPrices({})).toEqual([])
  })
})

describe('weckerDecision', () => {
  it('fire / reset / none', () => {
    expect(weckerDecision(1, 1.5, null)).toBe('fire')
    expect(weckerDecision(1, 1.5, 'x')).toBe('none')
    expect(weckerDecision(2, 1.5, 'x')).toBe('reset')
    expect(weckerDecision(2, 1.5, null)).toBe('none')
    expect(weckerDecision(null, 1.5, null)).toBe('none')
  })
})

describe('Marken-/Store-Helfer', () => {
  it('brandKey normalisiert', () => expect(brandKey(' Red Bull ')).toBe('red bull'))
  it('storeMatches', () => {
    expect(storeMatches('Lidl', 'only', ['Lidl'])).toBe(true)
    expect(storeMatches('Lidl', 'except', ['Lidl'])).toBe(false)
    expect(storeMatches('Lidl', 'all', [])).toBe(true)
  })
})
