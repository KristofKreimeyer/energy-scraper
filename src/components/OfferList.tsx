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
  reports: ReportsByProduct;
  votes: VotesByProduct;
}

export default function OfferList({
  offers,
  sort,
  filtersActive,
  onReset,
  view,
  bestId,
  reports,
  votes,
}: OfferListProps) {
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
              : "grid gap-4 grid-cols-[repeat(auto-fill,minmax(248px,1fr))]"
          }`}
          aria-label="Energy-Drink-Angebote"
        >
          {offers.map((offer) => (
            <OfferCard
              key={offer.id}
              offer={offer}
              isBest={offer.id === bestId}
              view={view}
              reports={reports[productKey(offer)]}
              votes={votes[productKey(offer)]}
            />
          ))}
        </ul>
      ) : (
        <p className="mt-1.5 px-5 py-12 text-center text-muted border border-dashed border-border-strong rounded-card">
          Keine Angebote gefunden. Filter oder Suche anpassen.
        </p>
      )}
    </div>
  );
}
