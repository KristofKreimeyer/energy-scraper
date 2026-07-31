import { useMemo, useState } from "react";
import type { SortKey } from "../types";
import { useFavorites } from "../lib/favorites";
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
  const [sugar, setSugar] = useState<"all" | "zero" | "sugar">("all");
  const [sort, setSort] = useState<SortKey>("liter");
  const [query, setQuery] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const favorites = useFavorites();
  // Ohne Favoriten greift der Filter nicht (abgeleitet statt State-Reset im
  // Effect) – so bleibt keine leere Liste ohne sichtbaren Grund stehen.
  const effectiveFavoritesOnly = favoritesOnly && favorites.length > 0;
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

  const visible = useMemo(() => {
    const base = sortOffers(
      filterOffers(offers, { market, brand, sugar, query }),
      sort,
    );
    return effectiveFavoritesOnly
      ? base.filter((o) => favorites.includes(o.brand))
      : base;
  }, [offers, market, brand, sugar, sort, query, effectiveFavoritesOnly, favorites]);

  // Kontextuelle Zähler: jede Facette zählt unter den JEWEILS anderen aktiven
  // Filtern (faceted search) – so zeigen die Chips, was ein Klick noch bringt.
  const marketTally = useMemo(
    () =>
      countBy(
        filterOffers(offers, { market: "all", brand, sugar, query }),
        (o) => o.market,
      ),
    [offers, brand, sugar, query],
  );
  const brandTally = useMemo(
    () =>
      countBy(
        filterOffers(offers, { market, brand: "all", sugar, query }),
        (o) => o.brand,
      ),
    [offers, market, sugar, query],
  );
  // Zucker-Facette: wie viele Angebote je Option, unter Markt/Marke/Suche.
  // 'both'-Angebote zählen in beide Optionen (sie matchen beide Filter).
  const sugarTally = useMemo(() => {
    const base = filterOffers(offers, { market, brand, sugar: "all", query });
    const m = new Map<string, number>([["all", base.length]]);
    m.set("zero", base.filter((o) => o.sugar === "zero" || o.sugar === "both").length);
    m.set("sugar", base.filter((o) => o.sugar === "sugar" || o.sugar === "both").length);
    return m;
  }, [offers, market, brand, query]);

  const bestId = useMemo(() => bestPerLiterId(visible), [visible]);
  const filtersActive =
    market !== "all" ||
    brand !== "all" ||
    sugar !== "all" ||
    query.trim() !== "" ||
    effectiveFavoritesOnly;

  function resetFilters() {
    setMarket("all");
    setBrand("all");
    setSugar("all");
    setQuery("");
    setFavoritesOnly(false);
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
  };
}
