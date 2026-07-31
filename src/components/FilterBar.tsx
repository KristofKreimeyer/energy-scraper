import { Search, X, Filter } from "lucide-react";
import ViewToggle from "./ViewToggle";

type View = "grid" | "list";

interface FilterBarProps {
  market: string;
  brand: string;
  query: string;
  onQueryChange: (value: string) => void;
  onOpenFilters: () => void;
  view: View;
  onViewChange: (view: View) => void;
}

export default function FilterBar({
  market,
  brand,
  query,
  onQueryChange,
  onOpenFilters,
  view,
  onViewChange,
}: FilterBarProps) {
  const activeFilterCount =
    (market !== "all" ? 1 : 0) + (brand !== "all" ? 1 : 0);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2 flex-1 basis-[220px] min-w-[180px] bg-surface border border-border-strong rounded-[14px] px-3 h-11">
        <Search size={18} strokeWidth={2.2} aria-hidden className="flex-none text-muted" />
        <input
          id="q"
          type="search"
          className="border-0 bg-transparent text-ink w-full outline-none [&::-webkit-search-cancel-button]:appearance-none"
          placeholder="Marke oder Produkt suchen …"
          aria-label="Angebote durchsuchen"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
        />
        {query && (
          <button
            type="button"
            onClick={() => onQueryChange("")}
            aria-label="Suche löschen"
            className="flex-none grid place-items-center w-6 h-6 -mr-1 rounded-full text-muted hover:text-ink hover:bg-surface-2 transition-colors duration-150"
          >
            <X size={15} strokeWidth={2.4} aria-hidden />
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={onOpenFilters}
        aria-haspopup="dialog"
        className="flex-none h-11 px-3.5 inline-flex items-center gap-1.5 text-[0.85rem] font-semibold rounded-[14px] border bg-surface text-ink border-border-strong hover:bg-surface-2"
      >
        <Filter size={17} strokeWidth={2.2} aria-hidden />
        Filtern & Sortieren
        {activeFilterCount > 0 && (
          <span className="ml-0.5 text-[0.7rem] font-mono font-bold text-on-fill bg-fill rounded-full min-w-[18px] text-center px-1">
            {activeFilterCount}
          </span>
        )}
      </button>
      {/* Ansicht-Umschalter: ab md hier rechts; auf Mobile in der ersten Reihe
          der ControlsBar (siehe ControlsBar). */}
      <ViewToggle
        view={view}
        onViewChange={onViewChange}
        className="ml-auto hidden md:flex"
      />
    </div>
  );
}
