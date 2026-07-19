import { useMemo, useState } from 'react'
import './App.css'
import type { SortKey } from './types'
import {
  offers as allOffers,
  generatedAt,
  formatEuro,
  sortOffers,
  bestPerLiterId,
  filterOffers,
  allMarkets,
  allBrands,
  countBy,
  savings,
  topDeal,
  groupOffers,
  inTimeframe,
  formatNumber,
  perLiterStats,
  type Timeframe,
} from './lib/offers'
import { OfferCard } from './components/OfferCard'

const TIMEFRAMES: { value: Timeframe; label: string }[] = [
  { value: 'current', label: 'Diese Woche' },
  { value: 'next', label: 'Nächste Woche' },
]

const SORT_LABELS: Record<SortKey, string> = {
  liter: 'Grundpreis €/L',
  price: 'Dosenpreis',
  brand: 'Marke A–Z',
  ending: 'Ablaufdatum',
  savings: 'Größte Ersparnis',
}

const SORT_OPTIONS: { value: SortKey; text: string }[] = [
  { value: 'liter', text: 'Grundpreis €/L (günstigste zuerst)' },
  { value: 'price', text: 'Dosenpreis (günstigste zuerst)' },
  { value: 'savings', text: 'Größte Ersparnis' },
  { value: 'brand', text: 'Marke A–Z' },
  { value: 'ending', text: 'Läuft bald ab' },
]

function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark' | null>(null)
  const isDark =
    theme === 'dark' ||
    (theme === null && window.matchMedia('(prefers-color-scheme: dark)').matches)

  function toggle() {
    const next = isDark ? 'light' : 'dark'
    document.documentElement.setAttribute('data-theme', next)
    setTheme(next)
  }
  return { isDark, toggle }
}

function App() {
  const { isDark, toggle } = useTheme()
  const [timeframe, setTimeframe] = useState<Timeframe>('current')
  const [market, setMarket] = useState('all')
  const [brand, setBrand] = useState('all')
  const [sort, setSort] = useState<SortKey>('liter')
  const [query, setQuery] = useState('')

  // Angebote des gewählten Zeitraums – Sorten erst innerhalb des Zeitraums bündeln
  const offers = useMemo(() => groupOffers(inTimeframe(allOffers, timeframe)), [timeframe])

  // Angebotszahl je Zeitraum (für die Umschalter-Badges)
  const timeframeCounts = useMemo(
    () => ({
      current: groupOffers(inTimeframe(allOffers, 'current')).length,
      next: groupOffers(inTimeframe(allOffers, 'next')).length,
    }),
    [],
  )

  const markets = useMemo(() => allMarkets(offers), [offers])
  const brands = useMemo(() => allBrands(offers), [offers])

  // Kennzahlen über den gewählten Zeitraum
  const stats = useMemo(() => {
    if (offers.length === 0) return null
    const withLiter = offers.filter((o) => o.perLiter != null)
    // günstigste Dose = niedrigster Stückpreis (Karton-pro-Dose zählt fair mit)
    const cheapest = offers.reduce((a, b) => (b.perUnit < a.perUnit ? b : a))
    const bestLiter = withLiter.length
      ? withLiter.reduce((a, b) => (b.perLiter! < a.perLiter! ? b : a))
      : null
    const literStats = perLiterStats(offers)
    return { cheapest, bestLiter, literStats, literCount: withLiter.length }
  }, [offers])

  const deal = useMemo(() => topDeal(offers), [offers])
  const dealSaving = deal ? savings(deal) : null

  const visible = useMemo(
    () => sortOffers(filterOffers(offers, { market, brand, query }), sort),
    [offers, market, brand, sort, query],
  )

  // Kontextuelle Zähler: Markt-Chips zählen bei aktuellem Marken-/Suchfilter,
  // Marken-Chips bei aktuellem Markt-/Suchfilter (faceted search).
  const marketTally = useMemo(
    () => countBy(filterOffers(offers, { market: 'all', brand, query }), (o) => o.market),
    [offers, brand, query],
  )
  const brandTally = useMemo(
    () => countBy(filterOffers(offers, { market, brand: 'all', query }), (o) => o.brand),
    [offers, market, query],
  )

  const bestId = useMemo(() => bestPerLiterId(visible), [visible])
  const filtersActive = market !== 'all' || brand !== 'all' || query.trim() !== ''

  function resetFilters() {
    setMarket('all')
    setBrand('all')
    setQuery('')
  }

  const generatedLabel = new Date(generatedAt).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

  return (
    <>
      <a className="skip" href="#main">
        Zum Inhalt springen
      </a>

      <header className="site-header">
        <div className="wrap">
          <div className="brand">
            <span className="bolt" aria-hidden="true">
              ⚡
            </span>
            <span>
              FindMy<em>Energy</em>
            </span>
          </div>
          <button className="theme-btn" type="button" aria-pressed={isDark} onClick={toggle}>
            <span aria-hidden="true">{isDark ? '◑' : '◐'}</span>
            {isDark ? 'Hell' : 'Dunkel'}
          </button>
        </div>
      </header>

      <main id="main">
        <section className="hero wrap" aria-labelledby="page-title">
          <p className="eyebrow">
            Energy-Drink-Angebote · {timeframe === 'current' ? 'Diese Woche' : 'Nächste Woche · Vorschau'}
          </p>
          <h1 id="page-title">
            {timeframe === 'current'
              ? 'Alle Energy-Deals der Woche, nach Preis pro Liter sortiert.'
              : 'Ein Blick voraus: die Energy-Deals der nächsten Woche.'}
          </h1>
          <p className="lede">
            Automatisch gesammelt aus den Prospekten von Aldi, Kaufland, Lidl, Netto, Penny und Rewe.
            Vergleiche Dosenpreis <em>und</em> Grundpreis auf einen Blick.
          </p>

          {deal && dealSaving && (
            <section className="spotlight" aria-labelledby="deal-title">
              <p className="deal-pct" aria-hidden="true">
                −{dealSaving.percent}&nbsp;%
              </p>
              <div className="deal-info">
                <p className="eyebrow deal-eyebrow">
                  {timeframe === 'current' ? 'Größter Preissturz' : 'Größter Preissturz · nächste Woche'}
                </p>
                <h2 id="deal-title" className="deal-title">
                  {deal.brand} {deal.title}
                </h2>
                <p className="deal-meta">
                  {deal.market} · {deal.unitLabel}
                </p>
              </div>
              <div className="deal-price">
                <span className="deal-now">{formatEuro(deal.price)}</span>
                <span className="deal-was">
                  <span className="visually-hidden">
                    {dealSaving.percent} Prozent günstiger, Sie sparen {formatEuro(dealSaving.amount)} gegenüber vorher{' '}
                    {formatEuro(deal.oldPrice!)}
                  </span>
                  <span aria-hidden="true">
                    <s>{formatEuro(deal.oldPrice!)}</s> · {formatEuro(dealSaving.amount)} gespart
                  </span>
                </span>
              </div>
            </section>
          )}

          {stats ? (
            <ul className="kpis">
              <li className="kpi lead">
                <span className="k-label">Günstigste Dose</span>
                <span className="k-val">{formatEuro(stats.cheapest.perUnit)}</span>
                <span className="k-sub">
                  {stats.cheapest.brand} · {stats.cheapest.market} ·{' '}
                  {stats.cheapest.unitCount > 1 ? 'je Dose' : stats.cheapest.unitLabel}
                </span>
              </li>
              <li className="kpi">
                <span className="k-label">Bester Grundpreis</span>
                {stats.bestLiter ? (
                  <>
                    <span className="k-val">
                      {formatEuro(stats.bestLiter.perLiter!)}
                      <span className="u">/L</span>
                    </span>
                    <span className="k-sub">
                      {stats.bestLiter.brand} · {stats.bestLiter.market}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="k-val">—</span>
                    <span className="k-sub">Kein Grundpreis verfügbar</span>
                  </>
                )}
              </li>
              <li className="kpi">
                <span className="k-label">Preisspanne pro Liter</span>
                {stats.literStats ? (
                  <>
                    <span className="k-val k-val--range">
                      {formatNumber(stats.literStats.min)}–{formatNumber(stats.literStats.max)}
                      <span className="u"> €/L</span>
                    </span>
                    <span className="k-sub">Vergleichen lohnt sich</span>
                  </>
                ) : (
                  <>
                    <span className="k-val">—</span>
                    <span className="k-sub">Kein Grundpreis verfügbar</span>
                  </>
                )}
              </li>
              <li className="kpi">
                <span className="k-label">Typischer Grundpreis</span>
                {stats.literStats ? (
                  <>
                    <span className="k-val">
                      {formatNumber(stats.literStats.median)}
                      <span className="u"> €/L</span>
                    </span>
                    <span className="k-sub">Median über {stats.literCount} Angebote</span>
                  </>
                ) : (
                  <>
                    <span className="k-val">—</span>
                    <span className="k-sub">Kein Grundpreis verfügbar</span>
                  </>
                )}
              </li>
            </ul>
          ) : (
            <p className="empty" style={{ marginTop: 24 }}>
              Für nächste Woche liegen noch keine Angebote vor. Sobald neue Prospekte erscheinen, tauchen sie hier auf.
            </p>
          )}
        </section>

        <div className="controls">
          <div className="wrap">
            <div className="segmented" role="group" aria-label="Zeitraum wählen">
              {TIMEFRAMES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  className="seg"
                  aria-pressed={timeframe === t.value}
                  onClick={() => setTimeframe(t.value)}
                >
                  {t.label}
                  <span className="count">{timeframeCounts[t.value]}</span>
                </button>
              ))}
            </div>
            <div className="controls-row">
              <div className="search">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
                </svg>
                <input
                  id="q"
                  type="search"
                  placeholder="Marke oder Produkt suchen …"
                  aria-label="Angebote durchsuchen"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <div className="sort-group">
                <label htmlFor="sort">Sortieren</label>
                <select
                  id="sort"
                  aria-label="Angebote sortieren nach"
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortKey)}
                >
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.text}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="filters" role="group" aria-label="Nach Supermarkt filtern">
              <span className="filters-label" aria-hidden="true">
                Markt
              </span>
              <button
                className="chip"
                type="button"
                aria-pressed={market === 'all'}
                onClick={() => setMarket('all')}
              >
                Alle <span className="count">{offers.length}</span>
              </button>
              {markets.map((m) => {
                const count = marketTally.get(m) ?? 0
                const selected = market === m
                return (
                  <button
                    key={m}
                    className="chip"
                    type="button"
                    aria-pressed={selected}
                    disabled={count === 0 && !selected}
                    onClick={() => setMarket(m)}
                  >
                    {m} <span className="count">{count}</span>
                  </button>
                )
              })}
            </div>

            <div className="filters" role="group" aria-label="Nach Marke filtern">
              <span className="filters-label" aria-hidden="true">
                Marke
              </span>
              <button
                className="chip"
                type="button"
                aria-pressed={brand === 'all'}
                onClick={() => setBrand('all')}
              >
                Alle <span className="count">{offers.length}</span>
              </button>
              {brands.map((b) => {
                const count = brandTally.get(b) ?? 0
                const selected = brand === b
                return (
                  <button
                    key={b}
                    className="chip"
                    type="button"
                    aria-pressed={selected}
                    disabled={count === 0 && !selected}
                    onClick={() => setBrand(b)}
                  >
                    {b} <span className="count">{count}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div className="wrap">
          <p className="status-line" role="status" aria-live="polite">
            <b>{visible.length}</b> {visible.length === 1 ? 'Angebot' : 'Angebote'} · sortiert nach{' '}
            {SORT_LABELS[sort]}
            {filtersActive && (
              <>
                {' · '}
                <button type="button" className="reset-link" onClick={resetFilters}>
                  Filter zurücksetzen
                </button>
              </>
            )}
          </p>

          {visible.length > 0 ? (
            <ul className="grid" aria-label="Energy-Drink-Angebote">
              {visible.map((offer) => (
                <OfferCard key={offer.id} offer={offer} isBest={offer.id === bestId} />
              ))}
            </ul>
          ) : (
            <p className="empty">Keine Angebote gefunden. Filter oder Suche anpassen.</p>
          )}
        </div>
      </main>

      <footer className="site-footer">
        <div className="wrap">
          <span>FindMyEnergy — Angebotsübersicht</span>
          <span className="prov">Datenquelle: energy-scraper · captured/*.json · Stand {generatedLabel}</span>
        </div>
      </footer>
    </>
  )
}

export default App
