import { useMemo, useState } from 'react'
import type { SortKey } from '../types'
import { useFavorites } from '../lib/favorites'
import {
  offers as allOffers,
  sortOffers,
  bestPerLiterId,
  filterOffers,
  allMarkets,
  allBrands,
  savings,
  topDeal,
  groupOffers,
  inTimeframe,
  facetCounts,
  type FilterState,
  perLiterStats,
  type Timeframe,
} from '../lib/offers'

// Kapselt den gesamten Zustand des Angebots-Browsers (Zeitraum, Filter, Sortierung,
// Ansicht) samt aller abgeleiteten Kennzahlen. App bleibt reine Komposition.
export function useOfferBrowser() {
  const [timeframe, setTimeframe] = useState<Timeframe>('current')
  const [market, setMarket] = useState('all')
  const [brand, setBrand] = useState('all')
  const [sugar, setSugar] = useState<'all' | 'zero' | 'sugar'>('all')
  const [sort, setSort] = useState<SortKey>('liter')
  const [query, setQuery] = useState('')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const favorites = useFavorites()
  // Ohne Favoriten greift der Filter nicht (abgeleitet statt State-Reset im
  // Effect) – so bleibt keine leere Liste ohne sichtbaren Grund stehen.
  const effectiveFavoritesOnly = favoritesOnly && favorites.length > 0
  // Auf schmalen Viewports (Mobil) standardmäßig die Listenansicht – die wirkt
  // dort aufgeräumter als die Kacheln. Nur Startwert; der Umschalter bleibt aktiv.
  const [view, setView] = useState<'grid' | 'list'>(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches ? 'list' : 'grid',
  )

  // Angebote je Zeitraum – Sorten erst innerhalb des Zeitraums bündeln. Beide
  // Zeiträume werden einmal berechnet (Basis für Liste UND Umschalter-Badges).
  const byTimeframe = useMemo(
    () => ({
      current: groupOffers(inTimeframe(allOffers, 'current')),
      next: groupOffers(inTimeframe(allOffers, 'next')),
    }),
    [],
  )
  const offers = byTimeframe[timeframe]
  const timeframeCounts = {
    current: byTimeframe.current.length,
    next: byTimeframe.next.length,
  }

  const markets = useMemo(() => allMarkets(offers), [offers])
  const brands = useMemo(() => allBrands(offers), [offers])

  // Kennzahlen über den gewählten Zeitraum
  const stats = useMemo(() => {
    if (offers.length === 0) return null
    const withLiter = offers.filter((o) => o.perLiter != null)
    // günstigste Dose = niedrigster Stückpreis (Karton-pro-Dose zählt fair mit)
    const cheapest = offers.reduce((a, b) => (b.perUnit < a.perUnit ? b : a))
    const bestLiter = withLiter.length ? withLiter.reduce((a, b) => (b.perLiter! < a.perLiter! ? b : a)) : null
    const literStats = perLiterStats(offers)
    return { cheapest, bestLiter, literStats, literCount: withLiter.length }
  }, [offers])

  const deal = useMemo(() => topDeal(offers), [offers])
  const dealSaving = deal ? savings(deal) : null

  const filter = useMemo<FilterState>(() => ({ market, brand, sugar, query }), [market, brand, sugar, query])

  const visible = useMemo(() => {
    const base = sortOffers(filterOffers(offers, filter), sort)
    return effectiveFavoritesOnly ? base.filter((o) => favorites.includes(o.brand)) : base
  }, [offers, filter, sort, effectiveFavoritesOnly, favorites])

  // Kontextuelle Zähler je Facette (siehe facetCounts).
  const marketTally = useMemo(() => facetCounts(offers, filter, 'market'), [offers, filter])
  const brandTally = useMemo(() => facetCounts(offers, filter, 'brand'), [offers, filter])
  const sugarTally = useMemo(() => facetCounts(offers, filter, 'sugar'), [offers, filter])

  const bestId = useMemo(() => bestPerLiterId(visible), [visible])
  const filtersActive = market !== 'all' || brand !== 'all' || sugar !== 'all' || query.trim() !== '' || effectiveFavoritesOnly

  function resetFilters() {
    setMarket('all')
    setBrand('all')
    setSugar('all')
    setQuery('')
    setFavoritesOnly(false)
  }

  return {
    // Zustand + Setter
    timeframe,
    setTimeframe,
    market,
    setMarket,
    brand,
    setBrand,
    sugar,
    setSugar,
    sort,
    setSort,
    query,
    setQuery,
    favoritesOnly: effectiveFavoritesOnly,
    setFavoritesOnly,
    favoriteCount: favorites.length,
    view,
    setView,
    // abgeleitete Werte
    offers,
    timeframeCounts,
    markets,
    brands,
    stats,
    deal,
    dealSaving,
    visible,
    marketTally,
    brandTally,
    sugarTally,
    bestId,
    filtersActive,
    resetFilters,
  }
}
