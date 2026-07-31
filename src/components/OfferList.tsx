import { OfferCard } from "./OfferCard";
import { productKey, type GroupedOffer } from "../lib/offers";
import type { SortKey } from "../types";
import { WRAP } from "../utils/helper";
import type { ReportsByProduct } from "../hooks/useCommunityReports";
import type { VotesByProduct } from "../hooks/useCommunityVotes";

// Ergebnis-Zeile + Angebots-Liste/-Grid. Reine Präsentations-Komponente;
// gefilterte/sortierte Angebote kommen fertig aus App.

const SORT_LABELS: Record<SortKey, string> = {
  liter: "Grundpreis €/L",
  price: "Dosenpreis",
  brand: "Marke A–Z",
  ending: "Ablaufdatum",
  savings: "Größte Ersparnis",
};

interface OfferListProps {
  offers: GroupedOffer[];
  sort: SortKey;
  filtersActive: boolean;
  onReset: () => void;
  view: "grid" | "list";
  bestId: string | null;
  communityReports: ReportsByProduct;
  communityVotes: VotesByProduct;
}

export default function OfferList({
  offers,
  sort,
  filtersActive,
  onReset,
  view,
  bestId,
  communityReports,
  communityVotes,
}: OfferListProps) {
  // Hat irgendein Angebot die „X Sorten"-Zeile, reservieren alle anderen Karten
  // deren Höhe (siehe OfferCard). So fluchten die Preisblöcke reihenweise –
  // spaltenunabhängig, also auch im Drei-Spalter (xl).
  const anyVariant = offers.some((o) => o.variantCount > 1);

  return (
    <div className={WRAP}>
      <p
        className="mt-4 mb-1 text-[0.88rem] text-muted font-mono"
        role="status"
        aria-live="polite"
      >
        <b className="text-ink">{offers.length}</b>{" "}
        {offers.length === 1 ? "Angebot" : "Angebote"} · sortiert nach{" "}
        {SORT_LABELS[sort]}
        {filtersActive && (
          <>
            {" · "}
            <button
              type="button"
              className="font-[inherit] text-accent-strong border-0 px-1 py-0.5 -mx-1 cursor-pointer underline underline-offset-2 hover:text-accent"
              onClick={onReset}
            >
              Filter zurücksetzen
            </button>
          </>
        )}
      </p>

      {offers.length > 0 ? (
        <ul
          className={`list-none mt-1.5 p-0 ${
            view === "list"
              ? "flex flex-col gap-2.5"
              : "grid gap-5 grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
          }`}
          aria-label="Energy-Drink-Angebote"
        >
          {offers.map((offer) => (
            <OfferCard
              key={offer.id}
              offer={offer}
              isBest={offer.id === bestId}
              view={view}
              rowHasVariant={anyVariant}
              reports={communityReports[productKey(offer)]}
              votes={communityVotes[productKey(offer)]}
            />
          ))}
        </ul>
      ) : (
        <div className="mt-1.5 px-5 py-12 flex flex-col items-center gap-3 text-center text-muted border border-dashed border-border-strong rounded-card">
          <p>Keine Angebote gefunden. Filter oder Suche anpassen.</p>
          {filtersActive && (
            <button
              type="button"
              onClick={onReset}
              className="h-9 px-4 inline-flex items-center gap-1.5 text-[0.85rem] font-semibold text-on-fill bg-fill border border-fill rounded-[10px] cursor-pointer hover:opacity-90"
            >
              Filter zurücksetzen
            </button>
          )}
        </div>
      )}
    </div>
  );
}
