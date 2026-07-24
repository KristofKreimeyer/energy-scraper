import { Modal } from "./Modal";
import type { SortKey } from "../types";

// Filter-Overlay-Inhalt (Sortieren / Markt / Marke) im barrierefreien Modal.
// Reine Präsentations-Komponente: aller State kommt per Props aus App.

const EYEBROW =
  "font-mono text-[0.72rem] tracking-[0.14em] uppercase text-muted";

const SORT_OPTIONS: { value: SortKey; text: string }[] = [
  { value: "liter", text: "Grundpreis €/L (günstigste zuerst)" },
  { value: "price", text: "Dosenpreis (günstigste zuerst)" },
  { value: "savings", text: "Größte Ersparnis" },
  { value: "brand", text: "Marke A–Z" },
  { value: "ending", text: "Läuft bald ab" },
];

// Chip-Grundstil (Markt- & Marken-Filter) – Zustände via aria-pressed/disabled
const chip =
  "group inline-flex items-center gap-[7px] min-h-[38px] px-3.5 bg-surface text-ink border border-border-strong " +
  "rounded-full text-[0.85rem] font-semibold cursor-pointer enabled:aria-[pressed=false]:hover:bg-surface-2 " +
  "aria-pressed:bg-accent aria-pressed:text-white aria-pressed:border-accent " +
  "aria-pressed:hover:bg-accent-strong aria-pressed:hover:border-accent-strong " +
  "disabled:opacity-40 disabled:cursor-not-allowed";
const chipCount =
  "font-mono text-[0.74rem] opacity-75 tabular-nums group-aria-pressed:opacity-90";

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
  totalCount,
  visibleCount,
  filtersActive,
  onReset,
  onClose,
}: FilterOverlayProps) {
  return (
    <Modal onClose={onClose} label="Anzeige anpassen">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[1.15rem] font-bold text-ink">Anzeige anpassen</h2>
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
        <span
          id="sort-label"
          className={`${EYEBROW} !text-[0.68rem] !tracking-[0.1em]`}
        >
          Sortieren
        </span>
        <select
          id="sort"
          className="select-chevron w-full h-11 pl-3 pr-[34px] text-[0.9rem] text-ink bg-surface border border-border-strong rounded-[10px] cursor-pointer"
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

      <div className="flex flex-col gap-2">
        <span className={`${EYEBROW} !text-[0.68rem] !tracking-[0.1em]`}>
          Markt
        </span>
        <div className="flex flex-wrap gap-2">
          <button
            className={chip}
            type="button"
            aria-pressed={market === "all"}
            onClick={() => onMarketChange("all")}
          >
            Alle <span className={chipCount}>{totalCount}</span>
          </button>
          {markets.map((m) => {
            const count = marketTally.get(m) ?? 0;
            const selected = market === m;
            return (
              <button
                key={m}
                className={chip}
                type="button"
                aria-pressed={selected}
                disabled={count === 0 && !selected}
                onClick={() => onMarketChange(m)}
              >
                {m} <span className={chipCount}>{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className={`${EYEBROW} !text-[0.68rem] !tracking-[0.1em]`}>
          Marke
        </span>
        <div className="flex flex-wrap gap-2">
          <button
            className={chip}
            type="button"
            aria-pressed={brand === "all"}
            onClick={() => onBrandChange("all")}
          >
            Alle <span className={chipCount}>{totalCount}</span>
          </button>
          {brands.map((b) => {
            const count = brandTally.get(b) ?? 0;
            const selected = brand === b;
            return (
              <button
                key={b}
                className={chip}
                type="button"
                aria-pressed={selected}
                disabled={count === 0 && !selected}
                onClick={() => onBrandChange(b)}
              >
                {b} <span className={chipCount}>{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 pt-1">
        <button
          type="button"
          className="text-[0.8rem] text-accent-strong hover:text-accent underline underline-offset-2 cursor-pointer disabled:opacity-40 disabled:no-underline"
          disabled={!filtersActive}
          onClick={onReset}
        >
          Alle zurücksetzen
        </button>
        <button
          type="button"
          onClick={onClose}
          className="h-10 px-5 text-[0.85rem] font-semibold text-white bg-accent border border-accent rounded-lg cursor-pointer hover:bg-accent-strong"
        >
          {visibleCount} {visibleCount === 1 ? "Angebot" : "Angebote"} zeigen
        </button>
      </div>
    </Modal>
  );
}
