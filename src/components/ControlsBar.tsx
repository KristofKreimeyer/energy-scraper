import FilterBar from "./FilterBar";
import type { Timeframe } from "../lib/offers";
import { WRAP } from "../utils/helper";

// Sticky Steuerleiste: Zeitraum-Umschalter (diese/nächste Woche) + FilterBar
// (Suche, Filtern-Button, Kachel/Liste). Reine Präsentation; State aus App.

const TIMEFRAMES: { value: Timeframe; label: string }[] = [
  { value: "current", label: "Diese Woche" },
  { value: "next", label: "Nächste Woche" },
];

interface ControlsBarProps {
  timeframe: Timeframe;
  onTimeframeChange: (timeframe: Timeframe) => void;
  timeframeCounts: Record<Timeframe, number>;
  market: string;
  brand: string;
  query: string;
  onQueryChange: (value: string) => void;
  onOpenFilters: () => void;
  view: "grid" | "list";
  onViewChange: (view: "grid" | "list") => void;
}

export default function ControlsBar({
  timeframe,
  onTimeframeChange,
  timeframeCounts,
  market,
  brand,
  query,
  onQueryChange,
  onOpenFilters,
  view,
  onViewChange,
}: ControlsBarProps) {
  return (
    <div className="md:sticky md:top-[62px] z-[15] bg-[color-mix(in_srgb,var(--ground)_92%,transparent)] backdrop-blur-[6px] py-4 mt-[30px] border-b border-border">
      <div className={`${WRAP} flex flex-wrap items-center gap-3`}>
        <div
          className="inline-flex flex-none gap-1 p-1 bg-surface-2 border border-border rounded-[14px]"
          role="group"
          aria-label="Zeitraum wählen"
        >
          {TIMEFRAMES.map((t) => (
            <button
              key={t.value}
              type="button"
              className="group inline-flex items-center gap-2 min-h-10 px-4 bg-transparent text-muted border-0 rounded-[11px] text-[0.9rem] font-[650] cursor-pointer transition-colors duration-150 hover:text-ink aria-pressed:bg-fill aria-pressed:text-on-fill"
              aria-pressed={timeframe === t.value}
              onClick={() => onTimeframeChange(t.value)}
            >
              {t.label}
              <span className="font-mono text-[0.74rem] tabular-nums text-muted bg-ground rounded-full px-[7px] py-px group-aria-pressed:text-on-fill group-aria-pressed:bg-[color-mix(in_srgb,var(--on-fill)_16%,transparent)]">
                {timeframeCounts[t.value]}
              </span>
            </button>
          ))}
        </div>

        <div className="flex-1 min-w-[260px]">
          <FilterBar
            market={market}
            brand={brand}
            query={query}
            onQueryChange={onQueryChange}
            onOpenFilters={onOpenFilters}
            view={view}
            onViewChange={onViewChange}
          />
        </div>
      </div>
    </div>
  );
}
