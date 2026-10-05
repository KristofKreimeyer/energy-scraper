import { Modal } from "./Modal";
import type { SortKey } from "../types";
import { SORT_OPTIONS } from "../lib/sortOptions";
import FilterChipGroup from "./FilterChipGroup";

// Filter-Overlay-Inhalt (Sortieren / Markt / Zucker / Marke) im barrierefreien
// Modal. Reine Präsentations-Komponente: aller State kommt per Props aus App.

const EYEBROW = "font-mono text-[1rem] tracking-[0.04em] uppercase text-muted";

interface FilterOverlayProps {
  sort: SortKey;
  onSortChange: (sort: SortKey) => void;
  market: string;
  onMarketChange: (market: string) => void;
  brand: string;
  onBrandChange: (brand: string) => void;
  markets: string[];
  marketTally: Map<string, number>;
  brands: string[];
  brandTally: Map<string, number>;
  sugar: "all" | "zero" | "sugar";
  onSugarChange: (sugar: "all" | "zero" | "sugar") => void;
  sugarTally: Map<string, number>;
  totalCount: number;
  visibleCount: number;
  filtersActive: boolean;
  onReset: () => void;
  onClose: () => void;
}

export default function FilterOverlay({
  sort,
  onSortChange,
  market,
  onMarketChange,
  brand,
  onBrandChange,
  markets,
  marketTally,
  brands,
  brandTally,
  sugar,
  onSugarChange,
  sugarTally,
  totalCount,
  visibleCount,
  filtersActive,
  onReset,
  onClose,
}: FilterOverlayProps) {
  return (
    <Modal onClose={onClose} label="Anzeige anpassen">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-[1.75rem] text-ink">Anzeige anpassen</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Schließen"
          className="text-muted hover:text-ink text-lg leading-none cursor-pointer"
        >
          ✕
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <span id="sort-label" className={`${EYEBROW} !text-[1rem] !tracking-[0.04em]`}>
          Sortieren
        </span>
        <select
          id="sort"
          className="select-chevron w-full h-11 pl-4 pr-8 text-[1rem] text-ink bg-surface border border-border-strong rounded-[0.625rem] cursor-pointer"
          aria-labelledby="sort-label"
          value={sort}
          onChange={(e) => onSortChange(e.target.value as SortKey)}
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.text}
            </option>
          ))}
        </select>
      </div>

      <FilterChipGroup
        label="Markt"
        value={market}
        onChange={onMarketChange}
        options={[
          { value: "all", text: "Alle", count: totalCount },
          ...markets.map((m) => ({
            value: m,
            text: m,
            count: marketTally.get(m) ?? 0,
          })),
        ]}
      />

      <FilterChipGroup
        label="Zucker"
        value={sugar}
        onChange={(v) => onSugarChange(v as "all" | "zero" | "sugar")}
        options={[
          { value: "all", text: "Alle", count: sugarTally.get("all") ?? 0 },
          { value: "zero", text: "Zuckerfrei", count: sugarTally.get("zero") ?? 0 },
          { value: "sugar", text: "Mit Zucker", count: sugarTally.get("sugar") ?? 0 },
        ]}
        footer={
          <p className="text-[1rem] text-muted">Sortenbündel („versch. Sorten“) enthalten beide Varianten und zählen zu beiden Optionen.</p>
        }
      />

      <FilterChipGroup
        label="Marke"
        value={brand}
        onChange={onBrandChange}
        options={[
          { value: "all", text: "Alle", count: totalCount },
          ...brands.map((b) => ({
            value: b,
            text: b,
            count: brandTally.get(b) ?? 0,
          })),
        ]}
      />

      <div className="flex items-center justify-between gap-2 pt-2">
        <button
          type="button"
          className="text-[1rem] text-accent-strong hover:text-accent underline underline-offset-2 cursor-pointer disabled:opacity-40 disabled:no-underline"
          disabled={!filtersActive}
          onClick={onReset}
        >
          Alle zurücksetzen
        </button>
        <button
          type="button"
          onClick={onClose}
          className="h-10 px-6 text-[1rem] font-semibold text-on-fill bg-fill border border-fill rounded-[0.75rem] cursor-pointer hover:opacity-90"
        >
          {visibleCount} {visibleCount === 1 ? "Angebot" : "Angebote"} zeigen
        </button>
      </div>
    </Modal>
  );
}
