import { describe, expect, it } from 'vitest'
import { DAY_MS, brandKey, median, productKey, utcDay } from '../shared/core.mjs'

describe('shared/core', () => {
  it('productKey ist preisunabhängig und normalisiert', () => {
    expect(productKey({ market: ' Lidl', brand: 'Red Bull', title: 'X', unitLabel: null })).toBe('lidl|red bull|x|')
  })
  it('brandKey', () => expect(brandKey('  Gönnergy ')).toBe('gönnergy'))
  it('utcDay ignoriert die Uhrzeit', () => {
    expect(utcDay(new Date('2026-07-22T23:59:59Z'))).toBe(utcDay(new Date('2026-07-22T00:00:00Z')))
    expect(utcDay(new Date('2026-07-23T00:00:00Z')) - utcDay(new Date('2026-07-22T12:00:00Z'))).toBe(1)
    expect(DAY_MS).toBe(86400000)
  })
  it('median', () => {
    expect(median([])).toBeNull()
    expect(median([3, 1, 2])).toBe(2)
    expect(median([4, 1, 2, 3])).toBe(2.5)
  })
})
