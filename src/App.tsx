import { useState } from "react";
import { AlarmCreator } from "./components/AlarmCreator";
import { LegalPage } from "./components/Legal";
import LegalHeader from "./components/LegalHeader";
import LegalFooter from "./components/LegalFooter";
import { PayBanner } from "./components/PayBanner";
import InstallPrompt from "./components/InstallPrompt";
import { useHashRoute, isLegalRoute } from "./lib/legalRoutes";
import Footer from "./components/Footer";
import Header from "./components/Header";
import ControlsBar from "./components/ControlsBar";
import FilterOverlay from "./components/FilterOverlay";
import Hero from "./components/Hero";
import OfferList from "./components/OfferList";
import Ticker from "./components/Ticker";
import TrustCards from "./components/TrustCards";
import Leaderboard from "./components/Leaderboard";
import MarketVote from "./components/MarketVote";
import ProTeaser from "./components/ProTeaser";
import WeeklyReminder from "./components/WeeklyReminder";
import SkipLink from "./components/SkipLink";
import { useOfferBrowser } from "./hooks/useOfferBrowser";
import { useCommunityReports } from "./hooks/useCommunityReports";
import { useCommunityVotes } from "./hooks/useCommunityVotes";
import AuthCallback from "./auth/AuthCallback";

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
    sugar,
    setSugar,
    sort,
    setSort,
    query,
    setQuery,
    favoritesOnly,
    setFavoritesOnly,
    favoriteCount,
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
    sugarTally,
    bestId,
    filtersActive,
    resetFilters,
  } = useOfferBrowser();
  const communityReports = useCommunityReports();
  const communityVotes = useCommunityVotes();

  // Magic-Link-Ziel: Token gegen Session tauschen, dann zurück zur Startseite.
  if (route.startsWith("#/auth")) {
    return (
      <>
        <SkipLink />
        <LegalHeader />
        <AuthCallback />
      </>
    );
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

      <InstallPrompt />

      <Header onOpenCreator={() => setShowCreator(true)} />

      <Ticker offers={offers} />

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
          favoritesOnly={favoritesOnly}
          onFavoritesOnlyChange={setFavoritesOnly}
          favoriteCount={favoriteCount}
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

        <TrustCards />

        <Leaderboard />

        <MarketVote />

        <WeeklyReminder />

        <ProTeaser onOpenCreator={() => setShowCreator(true)} />
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
          sugar={sugar}
          onSugarChange={setSugar}
          sugarTally={sugarTally}
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
