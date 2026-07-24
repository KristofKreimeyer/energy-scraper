import { useState } from "react";
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
import { useOfferBrowser } from "./hooks/useOfferBrowser";
import { useCommunityReports } from "./hooks/useCommunityReports";
import { useCommunityVotes } from "./hooks/useCommunityVotes";

function App() {
  const route = useHashRoute();
  const [showCreator, setShowCreator] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const {
    timeframe,
    setTimeframe,
    market,
    setMarket,
    brand,
    setBrand,
    sort,
    setSort,
    query,
    setQuery,
    view,
    setView,
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
    bestId,
    filtersActive,
    resetFilters,
  } = useOfferBrowser();
  const communityReports = useCommunityReports();
  const communityVotes = useCommunityVotes();

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
          communityReports={communityReports}
          communityVotes={communityVotes}
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
