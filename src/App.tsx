import { useMemo, useState } from 'react'
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
import { AlarmCreator } from './components/AlarmCreator'

const WRAP = 'mx-auto w-full max-w-[var(--maxw)] px-5'
const EYEBROW = 'font-mono text-[0.72rem] tracking-[0.14em] uppercase text-muted'

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
  const [showCreator, setShowCreator] = useState(false)
  const [view, setView] = useState<'grid' | 'list'>('grid')

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

  // Chip-Grundstil (Markt- & Marken-Filter) – Zustände via aria-pressed/disabled
  const chip =
    'group inline-flex items-center gap-[7px] min-h-[38px] px-3.5 bg-surface text-ink border border-border-strong ' +
    'rounded-full text-[0.85rem] font-semibold cursor-pointer enabled:aria-[pressed=false]:hover:bg-surface-2 ' +
    'aria-pressed:bg-accent aria-pressed:text-white aria-pressed:border-accent ' +
    'aria-pressed:hover:bg-accent-strong aria-pressed:hover:border-accent-strong ' +
    'disabled:opacity-40 disabled:cursor-not-allowed'
  const chipCount = 'font-mono text-[0.74rem] opacity-75 tabular-nums group-aria-pressed:opacity-90'

  return (
    <>
      <a
        className="absolute left-3 -top-[60px] z-50 bg-surface text-ink border-2 border-focus px-4 py-2.5 rounded-lg font-semibold transition-[top] duration-150 focus:top-3"
        href="#main"
      >
        Zum Inhalt springen
      </a>

      <header className="sticky top-0 z-20 bg-[color-mix(in_srgb,var(--surface)_88%,transparent)] backdrop-blur-[8px] backdrop-saturate-150 border-b border-border">
        <div className={`${WRAP} flex items-center gap-4 h-[62px]`}>
          <div className="flex items-center gap-2.5 font-[750] tracking-[-0.02em] text-[1.12rem]">
            <span
              className="w-[30px] h-[30px] flex-none grid place-items-center bg-accent text-white rounded-lg text-[1.1rem]"
              aria-hidden="true"
            >
              ⚡
            </span>
            <span>
              FindMy<em className="not-italic text-accent-strong">Energy</em>
            </span>
          </div>
          <button
            className="flex-none ml-auto h-10 px-3.5 bg-accent text-white border border-accent rounded-[10px] text-[0.85rem] font-semibold cursor-pointer inline-flex items-center gap-1.5 hover:bg-accent-strong"
            type="button"
            onClick={() => setShowCreator(true)}
          >
            <span aria-hidden="true">⏰</span>
            Preis-Alarm
          </button>
          <button
            className="flex-none h-10 min-w-[44px] px-3 bg-surface text-ink border border-border-strong rounded-[10px] text-[0.85rem] font-semibold cursor-pointer inline-flex items-center gap-[7px] hover:bg-surface-2"
            type="button"
            aria-pressed={isDark}
            onClick={toggle}
          >
            <span aria-hidden="true">{isDark ? '◑' : '◐'}</span>
            {isDark ? 'Hell' : 'Dunkel'}
          </button>
        </div>
      </header>

      <main id="main">
        <section className={`${WRAP} pt-[34px] pb-2`} aria-labelledby="page-title">
          <p className={`${EYEBROW} mb-2.5`}>
            Energy-Drink-Angebote · {timeframe === 'current' ? 'Diese Woche' : 'Nächste Woche · Vorschau'}
          </p>
          <h1
            id="page-title"
            className="text-[clamp(1.7rem,3.4vw,2.5rem)] leading-[1.08] tracking-[-0.025em] mb-2.5 text-balance max-w-[20ch]"
          >
            {timeframe === 'current'
              ? 'Alle Energy-Deals der Woche, nach Preis pro Liter sortiert.'
              : 'Ein Blick voraus: die Energy-Deals der nächsten Woche.'}
          </h1>
          <p className="text-muted text-[1.02rem] max-w-[56ch]">
            Automatisch gesammelt aus den Prospekten von Aldi, Kaufland, Lidl, Netto, Penny und Rewe.
            Vergleiche Dosenpreis <em>und</em> Grundpreis auf einen Blick.
          </p>

          {deal && dealSaving && (
            <section
              className="mt-6 flex items-center gap-5 px-[22px] py-[18px] bg-good-tint border border-[color-mix(in_srgb,var(--good)_40%,transparent)] rounded-card shadow-card max-[560px]:flex-wrap max-[560px]:gap-x-4 max-[560px]:gap-y-3"
              aria-labelledby="deal-title"
            >
              <p className="flex-none font-mono text-[clamp(2.1rem,5vw,3rem)] font-[750] tracking-[-0.03em] tabular-nums text-good leading-none">
                −{dealSaving.percent}&nbsp;%
              </p>
              <div className="flex-1 min-w-0">
                <p className={`${EYEBROW} !text-good mb-1.5`}>
                  {timeframe === 'current' ? 'Größter Preissturz' : 'Größter Preissturz · nächste Woche'}
                </p>
                <h2 id="deal-title" className="text-[1.3rem] tracking-[-0.02em] leading-[1.15] text-balance">
                  {deal.brand} {deal.title}
                </h2>
                <p className="mt-[3px] text-muted text-[0.9rem]">
                  {deal.market} · {deal.unitLabel}
                </p>
              </div>
              <div className="flex-none text-right flex flex-col gap-0.5 max-[560px]:text-left max-[560px]:w-full max-[560px]:flex-row max-[560px]:items-baseline max-[560px]:gap-2.5 max-[560px]:pt-3 max-[560px]:border-t max-[560px]:border-[color-mix(in_srgb,var(--good)_25%,transparent)]">
                <span className="font-mono text-[1.7rem] font-bold tracking-[-0.03em] tabular-nums text-ink">
                  {formatEuro(deal.price)}
                </span>
                <span className="font-mono text-[0.82rem] tabular-nums text-muted">
                  <span className="visually-hidden">
                    {dealSaving.percent} Prozent günstiger, Sie sparen {formatEuro(dealSaving.amount)} gegenüber vorher{' '}
                    {formatEuro(deal.oldPrice!)}
                  </span>
                  <span aria-hidden="true">
                    <s className="text-muted">{formatEuro(deal.oldPrice!)}</s> · {formatEuro(dealSaving.amount)} gespart
                  </span>
                </span>
              </div>
            </section>
          )}

          {stats ? (
            <ul className="list-none mt-[26px] p-0 grid gap-[14px] grid-cols-4 max-[780px]:grid-cols-2 max-[430px]:grid-cols-1">
              <li className="bg-surface border border-[color-mix(in_srgb,var(--accent)_55%,var(--border))] rounded-card px-4 pt-4 pb-[15px] shadow-card flex flex-col gap-0.5">
                <span className={`${EYEBROW} !text-[0.68rem] !tracking-[0.1em]`}>Günstigste Dose</span>
                <span className="font-mono text-[1.85rem] font-bold tracking-[-0.02em] tabular-nums text-accent">
                  {formatEuro(stats.cheapest.perUnit)}
                </span>
                <span className="text-[0.82rem] text-muted">
                  {stats.cheapest.brand} · {stats.cheapest.market} ·{' '}
                  {stats.cheapest.unitCount > 1 ? 'je Dose' : stats.cheapest.unitLabel}
                </span>
              </li>
              <li className="bg-surface border border-border rounded-card px-4 pt-4 pb-[15px] shadow-card flex flex-col gap-0.5">
                <span className={`${EYEBROW} !text-[0.68rem] !tracking-[0.1em]`}>Bester Grundpreis</span>
                {stats.bestLiter ? (
                  <>
                    <span className="font-mono text-[1.85rem] font-bold tracking-[-0.02em] tabular-nums">
                      {formatEuro(stats.bestLiter.perLiter!)}
                      <span className="text-[0.9rem] text-muted">/L</span>
                    </span>
                    <span className="text-[0.82rem] text-muted">
                      {stats.bestLiter.brand} · {stats.bestLiter.market}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="font-mono text-[1.85rem] font-bold tabular-nums">—</span>
                    <span className="text-[0.82rem] text-muted">Kein Grundpreis verfügbar</span>
                  </>
                )}
              </li>
              <li className="bg-surface border border-border rounded-card px-4 pt-4 pb-[15px] shadow-card flex flex-col gap-0.5">
                <span className={`${EYEBROW} !text-[0.68rem] !tracking-[0.1em]`}>Preisspanne pro Liter</span>
                {stats.literStats ? (
                  <>
                    <span className="font-mono text-[1.4rem] font-bold tracking-[-0.02em] tabular-nums">
                      {formatNumber(stats.literStats.min)}–{formatNumber(stats.literStats.max)}
                      <span className="text-[0.9rem] text-muted"> €/L</span>
                    </span>
                    <span className="text-[0.82rem] text-muted">Vergleichen lohnt sich</span>
                  </>
                ) : (
                  <>
                    <span className="font-mono text-[1.85rem] font-bold tabular-nums">—</span>
                    <span className="text-[0.82rem] text-muted">Kein Grundpreis verfügbar</span>
                  </>
                )}
              </li>
              <li className="bg-surface border border-border rounded-card px-4 pt-4 pb-[15px] shadow-card flex flex-col gap-0.5">
                <span className={`${EYEBROW} !text-[0.68rem] !tracking-[0.1em]`}>Typischer Grundpreis</span>
                {stats.literStats ? (
                  <>
                    <span className="font-mono text-[1.85rem] font-bold tracking-[-0.02em] tabular-nums">
                      {formatNumber(stats.literStats.median)}
                      <span className="text-[0.9rem] text-muted"> €/L</span>
                    </span>
                    <span className="text-[0.82rem] text-muted">Median über {stats.literCount} Angebote</span>
                  </>
                ) : (
                  <>
                    <span className="font-mono text-[1.85rem] font-bold tabular-nums">—</span>
                    <span className="text-[0.82rem] text-muted">Kein Grundpreis verfügbar</span>
                  </>
                )}
              </li>
            </ul>
          ) : (
            <p className="mt-6 px-5 py-12 text-center text-muted border border-dashed border-border-strong rounded-card">
              Für nächste Woche liegen noch keine Angebote vor. Sobald neue Prospekte erscheinen, tauchen sie hier auf.
            </p>
          )}
        </section>

        <div className="sticky top-[62px] z-[15] bg-[color-mix(in_srgb,var(--ground)_92%,transparent)] backdrop-blur-[6px] py-4 mt-[30px] border-b border-border">
          <div className={WRAP}>
            <div className="inline-flex gap-1 p-1 mb-3.5 bg-surface-2 border border-border rounded-xl" role="group" aria-label="Zeitraum wählen">
              {TIMEFRAMES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  className="group inline-flex items-center gap-2 min-h-10 px-4 bg-transparent text-muted border-0 rounded-[9px] text-[0.9rem] font-[650] cursor-pointer hover:text-ink aria-pressed:bg-surface aria-pressed:text-ink aria-pressed:shadow-card"
                  aria-pressed={timeframe === t.value}
                  onClick={() => setTimeframe(t.value)}
                >
                  {t.label}
                  <span className="font-mono text-[0.74rem] tabular-nums text-muted bg-ground rounded-full px-[7px] py-px group-aria-pressed:text-accent-strong group-aria-pressed:bg-accent-tint">
                    {timeframeCounts[t.value]}
                  </span>
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 flex-1 basis-[220px] min-w-[180px] bg-surface border border-border-strong rounded-[10px] px-3 h-11">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true" className="flex-none text-muted">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
                </svg>
                <input
                  id="q"
                  type="search"
                  className="border-0 bg-transparent text-ink w-full outline-none"
                  placeholder="Marke oder Produkt suchen …"
                  aria-label="Angebote durchsuchen"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <label htmlFor="sort" className="text-[0.82rem] text-muted font-semibold">
                  Sortieren
                </label>
                <select
                  id="sort"
                  className="select-chevron h-11 pl-3 pr-[34px] text-[0.9rem] text-ink bg-surface border border-border-strong rounded-[10px] cursor-pointer"
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
              <div className="flex items-center gap-1 ml-auto" role="group" aria-label="Ansicht wählen">
                <button
                  type="button"
                  aria-pressed={view === 'grid'}
                  aria-label="Kachelansicht"
                  onClick={() => setView('grid')}
                  className={`h-11 w-11 grid place-items-center rounded-[10px] border ${view === 'grid' ? 'bg-accent text-white border-accent' : 'bg-surface text-muted border-border-strong hover:text-ink'}`}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                    <rect x="3" y="3" width="7" height="7" rx="1.5" />
                    <rect x="14" y="3" width="7" height="7" rx="1.5" />
                    <rect x="3" y="14" width="7" height="7" rx="1.5" />
                    <rect x="14" y="14" width="7" height="7" rx="1.5" />
                  </svg>
                </button>
                <button
                  type="button"
                  aria-pressed={view === 'list'}
                  aria-label="Listenansicht"
                  onClick={() => setView('list')}
                  className={`h-11 w-11 grid place-items-center rounded-[10px] border ${view === 'list' ? 'bg-accent text-white border-accent' : 'bg-surface text-muted border-border-strong hover:text-ink'}`}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                    <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mt-3 items-center" role="group" aria-label="Nach Supermarkt filtern">
              <span className={`${EYEBROW} !text-[0.68rem] !tracking-[0.1em] mr-0.5`} aria-hidden="true">
                Markt
              </span>
              <button className={chip} type="button" aria-pressed={market === 'all'} onClick={() => setMarket('all')}>
                Alle <span className={chipCount}>{offers.length}</span>
              </button>
              {markets.map((m) => {
                const count = marketTally.get(m) ?? 0
                const selected = market === m
                return (
                  <button
                    key={m}
                    className={chip}
                    type="button"
                    aria-pressed={selected}
                    disabled={count === 0 && !selected}
                    onClick={() => setMarket(m)}
                  >
                    {m} <span className={chipCount}>{count}</span>
                  </button>
                )
              })}
            </div>

            <div className="flex flex-wrap gap-2 mt-3 items-center" role="group" aria-label="Nach Marke filtern">
              <span className={`${EYEBROW} !text-[0.68rem] !tracking-[0.1em] mr-0.5`} aria-hidden="true">
                Marke
              </span>
              <button className={chip} type="button" aria-pressed={brand === 'all'} onClick={() => setBrand('all')}>
                Alle <span className={chipCount}>{offers.length}</span>
              </button>
              {brands.map((b) => {
                const count = brandTally.get(b) ?? 0
                const selected = brand === b
                return (
                  <button
                    key={b}
                    className={chip}
                    type="button"
                    aria-pressed={selected}
                    disabled={count === 0 && !selected}
                    onClick={() => setBrand(b)}
                  >
                    {b} <span className={chipCount}>{count}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div className={WRAP}>
          <p className="mt-4 mb-1 text-[0.88rem] text-muted font-mono" role="status" aria-live="polite">
            <b className="text-ink">{visible.length}</b> {visible.length === 1 ? 'Angebot' : 'Angebote'} · sortiert nach{' '}
            {SORT_LABELS[sort]}
            {filtersActive && (
              <>
                {' · '}
                <button
                  type="button"
                  className="font-[inherit] text-accent-strong border-0 px-1 py-0.5 -mx-1 cursor-pointer underline underline-offset-2 hover:text-accent"
                  onClick={resetFilters}
                >
                  Filter zurücksetzen
                </button>
              </>
            )}
          </p>

          {visible.length > 0 ? (
            <ul
              className={`list-none mt-1.5 p-0 ${
                view === 'list' ? 'flex flex-col gap-2.5' : 'grid gap-4 grid-cols-[repeat(auto-fill,minmax(248px,1fr))]'
              }`}
              aria-label="Energy-Drink-Angebote"
            >
              {visible.map((offer) => (
                <OfferCard key={offer.id} offer={offer} isBest={offer.id === bestId} view={view} />
              ))}
            </ul>
          ) : (
            <p className="mt-1.5 px-5 py-12 text-center text-muted border border-dashed border-border-strong rounded-card">
              Keine Angebote gefunden. Filter oder Suche anpassen.
            </p>
          )}
        </div>
      </main>

      <footer className="border-t border-border mt-10 pt-[22px] pb-10 text-muted text-[0.84rem]">
        <div className={`${WRAP} flex flex-wrap gap-x-[18px] gap-y-2 items-center`}>
          <span>FindMyEnergy — Angebotsübersicht</span>
          <span className="font-mono text-[0.76rem]">Datenquelle: energy-scraper · captured/*.json · Stand {generatedLabel}</span>
        </div>
      </footer>

      {showCreator && <AlarmCreator onClose={() => setShowCreator(false)} />}
    </>
  )
}

export default App
