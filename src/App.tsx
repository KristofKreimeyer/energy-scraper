import { useMemo, useState } from "react";
import type { SortKey } from "./types";
import {
  offers as allOffers,
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
  perLiterStats,
  type Timeframe,
} from "./lib/offers";
import { AlarmCreator } from "./components/AlarmCreator";
import { LegalPage } from "./components/Legal";
import LegalHeader from "./components/LegalHeader";
import LegalFooter from "./components/LegalFooter";
import { PayBanner } from "./components/PayBanner";
import { useHashRoute, isLegalRoute } from "./lib/legalRoutes";
import Footer from "./components/Footer";
import Header from "./components/Header";
import ControlsBar from "./components/ControlsBar";
import FilterOverlay from "./components/FilterOverlay";
import Hero from "./components/Hero";
import OfferList from "./components/OfferList";
import SkipLink from "./components/SkipLink";

function App() {
  const route = useHashRoute();
  const [timeframe, setTimeframe] = useState<Timeframe>("current");
  const [market, setMarket] = useState("all");
  const [brand, setBrand] = useState("all");
  const [sort, setSort] = useState<SortKey>("liter");
  const [query, setQuery] = useState("");
  const [showCreator, setShowCreator] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  // Auf schmalen Viewports (Mobil) standardmäßig die Listenansicht – die wirkt
  // dort aufgeräumter als die Kacheln. Nur Startwert; der Umschalter bleibt aktiv.
  const [view, setView] = useState<"grid" | "list">(() =>
    typeof window !== "undefined" &&
    window.matchMedia("(max-width: 640px)").matches
      ? "list"
      : "grid",
  );

  // Angebote des gewählten Zeitraums – Sorten erst innerhalb des Zeitraums bündeln
  const offers = useMemo(
    () => groupOffers(inTimeframe(allOffers, timeframe)),
    [timeframe],
  );

  // Angebotszahl je Zeitraum (für die Umschalter-Badges)
  const timeframeCounts = useMemo(
    () => ({
      current: groupOffers(inTimeframe(allOffers, "current")).length,
      next: groupOffers(inTimeframe(allOffers, "next")).length,
    }),
    [],
  );

  const markets = useMemo(() => allMarkets(offers), [offers]);
  const brands = useMemo(() => allBrands(offers), [offers]);

  // Kennzahlen über den gewählten Zeitraum
  const stats = useMemo(() => {
    if (offers.length === 0) return null;
    const withLiter = offers.filter((o) => o.perLiter != null);
    // günstigste Dose = niedrigster Stückpreis (Karton-pro-Dose zählt fair mit)
    const cheapest = offers.reduce((a, b) => (b.perUnit < a.perUnit ? b : a));
    const bestLiter = withLiter.length
      ? withLiter.reduce((a, b) => (b.perLiter! < a.perLiter! ? b : a))
      : null;
    const literStats = perLiterStats(offers);
    return { cheapest, bestLiter, literStats, literCount: withLiter.length };
  }, [offers]);

  const deal = useMemo(() => topDeal(offers), [offers]);
  const dealSaving = deal ? savings(deal) : null;

  const visible = useMemo(
    () => sortOffers(filterOffers(offers, { market, brand, query }), sort),
    [offers, market, brand, sort, query],
  );

  // Kontextuelle Zähler: Markt-Chips zählen bei aktuellem Marken-/Suchfilter,
  // Marken-Chips bei aktuellem Markt-/Suchfilter (faceted search).
  const marketTally = useMemo(
    () =>
      countBy(
        filterOffers(offers, { market: "all", brand, query }),
        (o) => o.market,
      ),
    [offers, brand, query],
  );
  const brandTally = useMemo(
    () =>
      countBy(
        filterOffers(offers, { market, brand: "all", query }),
        (o) => o.brand,
      ),
    [offers, market, query],
  );

  const bestId = useMemo(() => bestPerLiterId(visible), [visible]);
  const filtersActive =
    market !== "all" || brand !== "all" || query.trim() !== "";

  function resetFilters() {
    setMarket("all");
    setBrand("all");
    setQuery("");
  }

  // Rechtliche Pflichtseiten als eigene Hash-Route (eigenständige Ansicht).
  if (isLegalRoute(route)) {
    return (
      <>
        <SkipLink />
        <LegalHeader />
        <LegalPage route={route} />
        <LegalFooter />
      </>
    );
  }

  return (
    <>
      <SkipLink />

      <PayBanner />

      <Header onOpenCreator={() => setShowCreator(true)} />

      <main id="main">
        <Hero
          timeframe={timeframe}
          deal={deal}
          dealSaving={dealSaving}
          stats={stats}
        />

        <ControlsBar
          timeframe={timeframe}
          onTimeframeChange={setTimeframe}
          timeframeCounts={timeframeCounts}
          market={market}
          brand={brand}
          query={query}
          onQueryChange={setQuery}
          onOpenFilters={() => setShowFilters(true)}
          view={view}
          onViewChange={setView}
        />

        <OfferList
          offers={visible}
          sort={sort}
          filtersActive={filtersActive}
          onReset={resetFilters}
          view={view}
          bestId={bestId}
        />
      </main>

      <Footer />

      {showCreator && <AlarmCreator onClose={() => setShowCreator(false)} />}

      {showFilters && (
        <FilterOverlay
          sort={sort}
          onSortChange={setSort}
          market={market}
          onMarketChange={setMarket}
          brand={brand}
          onBrandChange={setBrand}
          markets={markets}
          marketTally={marketTally}
          brands={brands}
          brandTally={brandTally}
          totalCount={offers.length}
          visibleCount={visible.length}
          filtersActive={filtersActive}
          onReset={resetFilters}
          onClose={() => setShowFilters(false)}
        />
      )}
    </>
  );
}

export default App;
