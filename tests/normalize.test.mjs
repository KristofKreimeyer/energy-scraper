import { describe, expect, it } from 'vitest'
import {
  classifySugar,
  derivePerLiter,
  detectAppPricing,
  isEnergyDrink,
  normalize,
  parseDate,
  parseLiters,
  parsePrice,
  parseUnitCount,
  sizeFromText,
} from '../scripts/lib/normalize.mjs'

describe('Parser', () => {
  it('parsePrice', () => {
    expect(parsePrice('0,79 €')).toBe(0.79)
    expect(parsePrice(1.5)).toBe(1.5)
    expect(parsePrice('')).toBeNull()
    expect(parsePrice('gratis')).toBeNull()
  })
  it('parseLiters', () => {
    expect(parseLiters('0,5-L-Dose')).toBe(0.5)
    expect(parseLiters('250-ml')).toBe(0.25)
    expect(parseLiters('10 x 0,5 l')).toBe(5)
    expect(parseLiters('24 × 250 ml')).toBe(6)
    expect(parseLiters('Lime')).toBeNull() // "l" nur als eigenes Wort/Einheit
  })
  it('sizeFromText / parseUnitCount', () => {
    expect(sizeFromText('je 0,5-l-Dose, versch.')).toBe('0,5-l-Dose')
    expect(parseUnitCount({ salesUnit: '24 x 0,25 l' })).toBe(24)
    expect(parseUnitCount({ quantity: 6 })).toBe(6)
    expect(parseUnitCount({ title: 'Dose' })).toBe(1)
  })
  it('parseDate: deutsches Kurzformat mit Fallback-Jahr, ISO, Müll', () => {
    expect(parseDate('20.7.', 2026)).toBe('2026-07-20T00:00:00.000Z')
    expect(parseDate('20.07.2026')).toBe('2026-07-20T00:00:00.000Z')
    expect(parseDate('2026-07-20T10:00:00Z')).toBe('2026-07-20T10:00:00.000Z')
    expect(parseDate('???')).toBeNull()
    expect(parseDate(null)).toBeNull()
  })
})

describe('derivePerLiter – alle Quellformen', () => {
  it('marktguru referencePrice + Liter', () => {
    expect(derivePerLiter({ referencePrice: 1.5, unit: 'Liter' }, 0.75)).toBe(1.5)
  })
  it('rewe pricePerLiter', () => expect(derivePerLiter({ pricePerLiter: '3.96' }, 1)).toBe(3.96))
  it('netto pricePerBaseUnit', () => expect(derivePerLiter({ pricePerBaseUnit: '(1.54 / l)' }, 1)).toBe(1.54))
  it('Beschreibungstext "(1 l = 3,96 €)"', () => expect(derivePerLiter({ details: '(1 l = 3,96 €)' }, 1)).toBe(3.96))
  it('berechnet Preis / Volumen als letzter Ausweg', () => expect(derivePerLiter({ salesUnit: '0,5-L-Dose' }, 0.99)).toBe(1.98))
  it('null ohne Grundlage', () => expect(derivePerLiter({ title: 'X' }, 1)).toBeNull())
})

describe('classifySugar', () => {
  it('zero / sugar / both', () => {
    expect(classifySugar({ title: 'Monster Zero Ultra' })).toBe('zero')
    expect(classifySugar({ title: 'Red Bull Classic' })).toBe('sugar')
    expect(classifySugar({ title: 'versch. Sorten' })).toBe('both')
    expect(classifySugar({ title: 'Zero und Original' })).toBe('both')
  })
})

describe('detectAppPricing', () => {
  it('strukturierter App-Preis (Penny nativ) hat Vorrang', () => {
    expect(detectAppPricing({ appPriceNumber: 0.85 }, 0.99)).toEqual({
      requiresApp: true,
      appPrice: 0.85,
      regularPrice: 0.99,
    })
  })
  it('"mit App X": API-Feld ist der reguläre Preis', () => {
    const r = detectAppPricing({ description: 'MIT PENNY APP 0.88 €' }, 0.99)
    expect(r).toEqual({ requiresApp: true, appPrice: 0.88, regularPrice: 0.99 })
  })
  it('"ohne App X": API-Feld ist der App-Preis', () => {
    const r = detectAppPricing({ description: 'MIT PENNY APP … ohne Penny App 1.49' }, 0.79)
    expect(r).toMatchObject({ requiresApp: true, appPrice: 0.79, regularPrice: 1.49 })
  })
  it('Pfand-/Volumenzahlen werden nicht als Preis gelesen', () => {
    const r = detectAppPricing({ description: 'mit App, 0.25 Pfand' }, 0.99)
    expect(r.appPrice).toBeNull()
  })
  it('keine App-Bindung', () => {
    expect(detectAppPricing({ description: 'normal' }, 1)).toEqual({
      requiresApp: false,
      appPrice: null,
      regularPrice: null,
    })
  })
})

describe('isEnergyDrink', () => {
  it('verwirft Monstera ohne Energy/Volumen', () => {
    expect(isEnergyDrink({ brand: 'Monster', title: 'Thai-Monstera', description: null, perLiter: null })).toBe(false)
    expect(isEnergyDrink({ brand: 'Monster', title: 'Energy', perLiter: null })).toBe(true)
    expect(isEnergyDrink({ brand: 'Monster', title: 'Ultra', perLiter: 2 })).toBe(true)
  })
})

describe('normalize', () => {
  it('Rewe-Rohdaten', () => {
    const o = normalize({
      brand: 'Red Bull',
      supermarket: 'Rewe',
      title: 'Red Bull Energy Drink',
      offerId: 'r1',
      price: '0,99 €',
      pricePerLiter: '3.96',
      details: 'je 0,25-l-Dose',
      scrapedAt: '2026-07-22T05:00:00.000Z',
    })
    expect(o).toMatchObject({
      id: 'r1',
      market: 'Rewe',
      price: 0.99,
      priceText: '0,99 €',
      perLiter: 3.96,
      unitLabel: '0,25-l-Dose',
      unitCount: 1,
      perUnit: 0.99,
      requiresApp: false,
      appPrice: null,
    })
  })

  it('wechselt bei App-Text auf den regulären Preis und rechnet €/L neu', () => {
    const o = normalize({
      brand: 'Monster',
      supermarket: 'Penny',
      title: 'Energy Drink',
      price: 0.79,
      salesUnit: '0,5-l-Dose',
      description: 'MIT PENNY APP … ohne Penny App 1.49',
      referencePrice: 1.58,
      unit: 'Liter',
    })
    expect(o).toMatchObject({ price: 1.49, perLiter: 2.98, requiresApp: true, appPrice: 0.79, appPerLiter: 1.58 })
  })

  it('Mehrfachgebinde: Stückpreis', () => {
    const o = normalize({ supermarket: 'Lidl', brand: 'Monster', title: 'Energy', price: 12, salesUnit: '24 x 0,25 l' })
    expect(o.unitCount).toBe(24)
    expect(o.perUnit).toBe(0.5)
    expect(o.perLiter).toBe(2)
  })

  it('unbekannter Markt bekommt Fallback-Farbe, id aus Slug', () => {
    const o = normalize({ supermarket: 'Edeka', brand: 'Rockstar', title: 'Ä Energy', price: 1 })
    expect(o.marketColor).toBe('#5B6772')
    expect(o.id).toBe('edeka-rockstar-a-energy-1')
  })
})
