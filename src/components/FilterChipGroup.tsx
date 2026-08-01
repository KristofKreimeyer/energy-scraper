import type { ReactNode } from "react";

// Eine beschriftete Filter-Chip-Gruppe (Markt / Zucker / Marke im FilterOverlay).
// Jeder Chip zeigt Text + Zähler; deaktiviert, wenn 0 Treffer und nicht gewählt.

const LABEL =
  "font-mono text-[0.68rem] tracking-[0.1em] uppercase text-muted";

const chip =
  "group inline-flex items-center gap-[7px] min-h-[38px] px-3.5 bg-surface text-ink border border-border-strong " +
  "rounded-full text-[0.85rem] font-semibold cursor-pointer transition-colors duration-150 enabled:aria-[pressed=false]:hover:bg-surface-2 " +
  "aria-pressed:bg-fill aria-pressed:text-on-fill aria-pressed:border-fill " +
  "aria-pressed:hover:opacity-90 " +
  "disabled:opacity-40 disabled:cursor-not-allowed";

const chipCount =
  "font-mono text-[0.62rem] opacity-75 tabular-nums group-aria-pressed:opacity-90";

export interface ChipOption {
  value: string;
  text: string;
  count: number;
}

export default function FilterChipGroup({
  label,
  value,
  onChange,
  options,
  footer,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: ChipOption[];
  footer?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className={LABEL}>{label}</span>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const selected = value === opt.value;
          return (
            <button
              key={opt.value}
              className={chip}
              type="button"
              aria-pressed={selected}
              disabled={opt.count === 0 && !selected}
              onClick={() => onChange(opt.value)}
            >
              {opt.text} <span className={chipCount}>{opt.count}</span>
            </button>
          );
        })}
      </div>
      {footer}
    </div>
  );
}
