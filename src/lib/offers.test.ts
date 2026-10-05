import { describe, expect, it, vi } from 'vitest'
import type { Offer } from '../types'
import {
  facetCounts,
  filterOffers,
  groupOffers,
  inTimeframe,
  offerPhase,
  perLiterStats,
  productKey,
  savings,
  sortOffers,
  topDeal,
} from './offers'

function offer(over: Partial<Offer> = {}): Offer {
  return {
    id: 'x',
    brand: 'Monster',
    title: 'Monster Energy',
    description: null,
    supermarket: 'Lidl',
    market: 'Lidl',
    marketColor: '#000',
    price: 1,
    priceText: '1,00 €',
    oldPrice: null,
    perLiter: 2,
    sugar: 'both',
    requiresApp: false,
    appPrice: null,
    appPerLiter: null,
    unitLabel: '0,5-l-Dose',
    unitCount: 1,
    perUnit: 1,
    validFrom: null,
    validTo: null,
    imageUrl: null,
    url: null,
    scrapedAt: null,
    ...over,
  } as Offer
}

describe('productKey', () => {
  it('ist preisunabhängig, getrimmt und kleingeschrieben', () => {
    expect(productKey({ market: ' Lidl ', brand: 'Monster', title: 'A', unitLabel: '0,5-L' })).toBe('lidl|monster|a|0,5-l')
  })
})

describe('groupOffers', () => {
  it('bündelt gleich bepreiste Sorten und bevorzugt "Original"', () => {
    const list = [offer({ id: '1', title: 'Monster Ultra', sugar: 'zero' }), offer({ id: '2', title: 'Monster Original', sugar: 'sugar' })]
    const [g] = groupOffers(list)
    expect(groupOffers(list)).toHaveLength(1)
    expect(g.id).toBe('2')
    expect(g.variantCount).toBe(2)
    expect(g.sugar).toBe('both')
  })

  it('normalisiert Gebinde-Schreibweisen (250 ml == 0,25 l)', () => {
    const list = [offer({ id: '1', unitLabel: '250-ml-Dose' }), offer({ id: '2', unitLabel: '0,25-l-Dose' })]
    expect(groupOffers(list)).toHaveLength(1)
  })

  it('trennt unterschiedliche Preise', () => {
    expect(groupOffers([offer({ id: '1' }), offer({ id: '2', price: 2 })])).toHaveLength(2)
  })
})

describe('Zeitraum', () => {
  const now = new Date('2026-07-22T12:00:00Z')
  it('erkennt Phasen auf Tagesebene', () => {
    expect(offerPhase(offer({ validFrom: '2026-07-23T00:00:00Z' }), now)).toBe('upcoming')
    expect(offerPhase(offer({ validTo: '2026-07-21T00:00:00Z' }), now)).toBe('expired')
    expect(offerPhase(offer({ validTo: '2026-07-22T00:00:00Z' }), now)).toBe('current')
    expect(offerPhase(offer(), now)).toBe('ongoing')
  })

  it('inTimeframe: Dauerangebote in beiden, Abgelaufene nie', () => {
    const list = [
      offer({ id: 'cur', validFrom: '2026-07-20T00:00:00Z', validTo: '2026-07-26T00:00:00Z' }),
      offer({ id: 'next', validFrom: '2026-07-27T00:00:00Z' }),
      offer({ id: 'old', validTo: '2026-07-01T00:00:00Z' }),
      offer({ id: 'on' }),
    ]
    expect(inTimeframe(list, 'current', now).map((o) => o.id)).toEqual(['cur', 'on'])
    expect(inTimeframe(list, 'next', now).map((o) => o.id)).toEqual(['next', 'on'])
  })
})

describe('savings / topDeal', () => {
  it('berechnet Betrag und Prozent', () => {
    expect(savings(offer({ price: 0.75, oldPrice: 1 }))).toEqual({ amount: 0.25, percent: 25 })
    expect(savings(offer({ price: 1, oldPrice: 1 }))).toBeNull()
    expect(savings(offer())).toBeNull()
  })
  it('topDeal wählt die größte Ersparnis', () => {
    const a = offer({ id: 'a', price: 0.9, oldPrice: 1 })
    const b = offer({ id: 'b', price: 0.5, oldPrice: 1 })
    expect(topDeal([a, b])?.id).toBe('b')
    expect(topDeal([offer()])).toBeNull()
  })
})

describe('Sortieren / Filtern / Statistik', () => {
  const list = [
    offer({ id: 'a', perLiter: 3, price: 2, brand: 'Rockstar' }),
    offer({ id: 'b', perLiter: 1, price: 3, brand: 'Monster' }),
    offer({ id: 'c', perLiter: null, price: 1, brand: 'Red Bull' }),
  ]
  it('sortiert nach Grundpreis mit null zuletzt', () => {
    expect(sortOffers(list, 'liter').map((o) => o.id)).toEqual(['b', 'a', 'c'])
  })
  it('sortiert nach Preis und Marke', () => {
    expect(sortOffers(list, 'price').map((o) => o.id)).toEqual(['c', 'a', 'b'])
    expect(sortOffers(list, 'brand').map((o) => o.id)).toEqual(['b', 'c', 'a'])
  })
  it('filtert; "both" matcht jeden Zucker-Filter', () => {
    const l = [offer({ id: '1', sugar: 'zero' }), offer({ id: '2', sugar: 'both' }), offer({ id: '3', sugar: 'sugar' })]
    const f = { market: 'all', brand: 'all', sugar: 'zero' as const, query: '' }
    expect(filterOffers(l, f).map((o) => o.id)).toEqual(['1', '2'])
    expect(filterOffers(l, { ...f, sugar: 'all', query: 'ENERGY' })).toHaveLength(3)
  })
  it('perLiterStats: min/max/median', () => {
    expect(perLiterStats(list)).toEqual({ min: 1, max: 3, median: 2 })
    expect(perLiterStats([offer({ perLiter: null })])).toBeNull()
  })
})

describe('facetCounts', () => {
  const list = [
    offer({ id: '1', market: 'Lidl', brand: 'Monster', sugar: 'zero' }),
    offer({ id: '2', market: 'Rewe', brand: 'Monster', sugar: 'both' }),
    offer({ id: '3', market: 'Rewe', brand: 'Rockstar', sugar: 'sugar' }),
  ]
  const f = { market: 'all', brand: 'all', sugar: 'all' as const, query: '' }
  it('zählt Markt-Facette unter den anderen Filtern (eigener Filter ignoriert)', () => {
    const m = facetCounts(list, { ...f, market: 'Lidl', brand: 'Monster' }, 'market')
    expect(Object.fromEntries(m)).toEqual({ Lidl: 1, Rewe: 1 })
  })
  it('Zucker-Facette: "both" zählt in beide Optionen', () => {
    expect(Object.fromEntries(facetCounts(list, f, 'sugar'))).toEqual({ all: 3, zero: 2, sugar: 2 })
  })
})

describe('priceInsight', () => {
  async function insightWith(points: { date: string; perLiter: number | null }[], perLiter: number) {
    vi.resetModules()
    vi.doMock('../data/price-history.json', () => ({
      default: {
        updatedAt: null,
        products: {
          'lidl|monster|monster energy|0,5-l-dose': {
            market: 'Lidl',
            brand: 'Monster',
            title: 'Monster Energy',
            unitLabel: '0,5-l-Dose',
            points,
          },
        },
      },
    }))
    const mod = await import('./offers')
    return mod.priceInsight(offer({ perLiter }))
  }

  it('Bestpreis, günstiger, normal, über üblich', async () => {
    const pts = [
      { date: '2026-07-01', perLiter: 2 },
      { date: '2026-07-08', perLiter: 3 },
      { date: '2026-07-15', perLiter: 2.5 },
    ]
    expect((await insightWith(pts, 2))?.level).toBe('best')
    expect((await insightWith(pts, 2.4))?.level).toBe('good')
    expect((await insightWith(pts, 2.55))?.level).toBe('normal')
    expect((await insightWith(pts, 3))?.level).toBe('high')
  })
  it('null bei < 2 Tagen oder konstantem Preis', async () => {
    expect(await insightWith([{ date: '2026-07-01', perLiter: 2 }], 2)).toBeNull()
    expect(
      await insightWith(
        [
          { date: '2026-07-01', perLiter: 2 },
          { date: '2026-07-08', perLiter: 2 },
        ],
        2,
      ),
    ).toBeNull()
  })
})

describe('groupOffers: Mehrfachgebinde', () => {
  it('6x0,25-L-Dose verschmilzt nicht mit der Einzeldose, gleicht aber 1500 ml', () => {
    const single = offer({ id: 'a', unitLabel: '0,25-l-Dose' })
    const pack = offer({ id: 'b', unitLabel: '6x0,25-L-Dose' })
    const pack2 = offer({ id: 'c', unitLabel: '1,5-l-Flasche' })
    expect(groupOffers([single, pack])).toHaveLength(2)
    expect(groupOffers([pack, pack2])).toHaveLength(1)
  })
})
