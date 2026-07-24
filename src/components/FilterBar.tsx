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
      <div className="flex items-center gap-2 flex-1 basis-[220px] min-w-[180px] bg-surface border border-border-strong rounded-[10px] px-3 h-11">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          aria-hidden="true"
          className="flex-none text-muted"
        >
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
          onChange={(e) => onQueryChange(e.target.value)}
        />
      </div>
      <button
        type="button"
        onClick={onOpenFilters}
        aria-haspopup="dialog"
        className="flex-none h-11 px-3.5 inline-flex items-center gap-1.5 text-[0.85rem] font-semibold rounded-[10px] border bg-surface text-ink border-border-strong hover:bg-surface-2"
      >
        <svg
          width="17"
          height="17"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M3 5h18l-7 8v6l-4-2v-4z" />
        </svg>
        Filtern
        {activeFilterCount > 0 && (
          <span className="ml-0.5 text-[0.7rem] font-mono font-bold text-white bg-accent rounded-full min-w-[18px] text-center px-1">
            {activeFilterCount}
          </span>
        )}
      </button>
      <div
        className="flex items-center gap-1 ml-auto"
        role="group"
        aria-label="Ansicht wählen"
      >
        <button
          type="button"
          aria-pressed={view === "grid"}
          aria-label="Kachelansicht"
          onClick={() => onViewChange("grid")}
          className={`h-11 w-11 grid place-items-center rounded-[10px] border ${view === "grid" ? "bg-accent text-white border-accent" : "bg-surface text-muted border-border-strong hover:text-ink"}`}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            aria-hidden="true"
          >
            <rect x="3" y="3" width="7" height="7" rx="1.5" />
            <rect x="14" y="3" width="7" height="7" rx="1.5" />
            <rect x="3" y="14" width="7" height="7" rx="1.5" />
            <rect x="14" y="14" width="7" height="7" rx="1.5" />
          </svg>
        </button>
        <button
          type="button"
          aria-pressed={view === "list"}
          aria-label="Listenansicht"
          onClick={() => onViewChange("list")}
          className={`h-11 w-11 grid place-items-center rounded-[10px] border ${view === "list" ? "bg-accent text-white border-accent" : "bg-surface text-muted border-border-strong hover:text-ink"}`}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
          </svg>
        </button>
      </div>
    </div>
  );
}
