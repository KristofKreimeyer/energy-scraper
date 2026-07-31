import { LayoutGrid, List } from "lucide-react";

type View = "grid" | "list";

// Umschalter Kachel-/Listenansicht. `className` steuert Platzierung/Sichtbarkeit
// (z. B. nur mobil bzw. nur ab md) – der State kommt von außen.
export default function ViewToggle({
  view,
  onViewChange,
  className = "",
}: {
  view: View;
  onViewChange: (view: View) => void;
  className?: string;
}) {
  const btn = (active: boolean) =>
    `h-9 w-9 grid place-items-center rounded-[11px] transition-colors duration-150 ${
      active ? "bg-fill text-on-fill" : "bg-transparent text-muted hover:text-ink"
    }`;
  return (
    <div
      className={`flex items-center gap-1 p-1 bg-surface-2 border border-border rounded-[14px] ${className}`}
      role="group"
      aria-label="Ansicht wählen"
    >
      <button
        type="button"
        aria-pressed={view === "grid"}
        aria-label="Kachelansicht"
        onClick={() => onViewChange("grid")}
        className={btn(view === "grid")}
      >
        <LayoutGrid size={18} strokeWidth={2.2} aria-hidden />
      </button>
      <button
        type="button"
        aria-pressed={view === "list"}
        aria-label="Listenansicht"
        onClick={() => onViewChange("list")}
        className={btn(view === "list")}
      >
        <List size={18} strokeWidth={2.2} aria-hidden />
      </button>
    </div>
  );
}
