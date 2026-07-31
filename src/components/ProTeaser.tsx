import { WRAP } from "../utils/helper";

// Macht den Pro-Wert sichtbar, BEVOR jemand auf eine Alarm-Glocke klickt –
// vorher war Pro nur im Alarm-Dialog auffindbar. Nennt den konkreten Nutzen
// (Preiswecker über alle Marken statt nur einer) und den stärksten Anker
// („spart 58 %" beim Jahresplan). CTA führt in den bestehenden Alarm-/Pro-Flow.

const BENEFITS = [
  { icon: "🔔", text: "Preiswecker über alle Marken statt nur einer" },
  { icon: "♾️", text: "Unbegrenzt viele Alarme gleichzeitig" },
  { icon: "⚡", text: "Sofort-Benachrichtigung per Push, E-Mail oder Telegram" },
];

export default function ProTeaser({ onOpenCreator }: { onOpenCreator: () => void }) {
  return (
    <section className={`${WRAP} mt-9`} aria-labelledby="pro-teaser-title">
      <div className="glass-card rounded-card p-6 shadow-card flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex-1">
          <div className="text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-accent-strong">
            EnergyHunt Pro
          </div>
          <h2
            id="pro-teaser-title"
            className="mt-1 text-[1.15rem] font-bold text-ink leading-snug"
          >
            Nie wieder ein Angebot verpassen.
          </h2>
          <ul className="mt-3 flex flex-col gap-1.5 text-[0.9rem] text-muted">
            {BENEFITS.map((b) => (
              <li key={b.text} className="flex items-center gap-2">
                <span aria-hidden="true">{b.icon}</span>
                <span>{b.text}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex-none flex flex-col items-start md:items-end gap-2">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-[1.9rem] font-bold text-ink tabular-nums">
              9,99&nbsp;€
            </span>
            <span className="text-[0.85rem] text-muted">/ Jahr</span>
            <span className="rounded-md bg-good-tint text-good text-[0.72rem] font-bold px-2 py-0.5">
              spart 58&nbsp;%
            </span>
          </div>
          <button
            type="button"
            onClick={onOpenCreator}
            className="h-10 px-5 rounded-lg bg-fill text-on-fill text-[0.9rem] font-semibold hover:opacity-90 cursor-pointer"
          >
            Preiswecker einrichten →
          </button>
          <span className="text-[0.72rem] text-muted">
            Kostenlos starten · 1 Marke gratis · jederzeit kündbar
          </span>
        </div>
      </div>
    </section>
  );
}
