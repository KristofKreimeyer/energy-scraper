import { useMemo, useState } from "react";
import type { SortKey } from "../types";
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
} from "../lib/offers";

// Kapselt den gesamten Zustand des Angebots-Browsers (Zeitraum, Filter, Sortierung,
// Ansicht) samt aller abgeleiteten Kennzahlen. App bleibt reine Komposition.
export function useOfferBrowser() {
  const [timeframe, setTimeframe] = useState<Timeframe>("current");
  const [market, setMarket] = useState("all");
  const [brand, setBrand] = useState("all");
  const [sort, setSort] = useState<SortKey>("liter");
  const [query, setQuery] = useState("");
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

  return {
    // Zustand + Setter
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
    bestId,
    filtersActive,
    resetFilters,
  };
}
