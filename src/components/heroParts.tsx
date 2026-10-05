import type { ReactNode } from "react";
import { formatEuro, formatNumber, validity, savings, topDeal, type Timeframe } from "../lib/offers";
import { Clock } from "lucide-react";

// Geteilte Hero-Bausteine: Top-Deal-Banner + Kennzahl-Kachel.

const LABEL = "font-mono text-[1rem] tracking-[0.04em] uppercase text-muted";

/** Eine Kennzahl-Kachel (Label + Wert + Untertitel). Wert/Untertitel als Nodes,
 *  da die Formatierung je Kachel unterschiedlich ist. */
export function StatCard({ label, value, sub, className = "" }: { label: string; value: ReactNode; sub: ReactNode; className?: string }) {
  return (
    <li className={`glass-card rounded-card px-4 pt-4 pb-4 shadow-card flex flex-col gap-0 ${className}`}>
      <span className={LABEL}>{label}</span>
      {value}
      {sub}
    </li>
  );
}

/** Hervorgehobener Top-Deal des Zeitraums (Marke, Preis, Ersparnis, Gültigkeit). */
export function TopDealBanner({
  deal,
  dealSaving,
  timeframe,
}: {
  deal: NonNullable<ReturnType<typeof topDeal>>;
  dealSaving: NonNullable<ReturnType<typeof savings>>;
  timeframe: Timeframe;
}) {
  const dealValid = validity(deal);
  // Wochentag des letzten Gültigkeitstags (wie im Entwurf „· bis Sonntag").
  // Nur bei laufenden Angeboten mit Enddatum – nicht bei „Ab …"-Vorschau.
  const endWeekday =
    !dealValid.upcoming && deal.validTo ? new Intl.DateTimeFormat("de-DE", { weekday: "long" }).format(new Date(deal.validTo)) : null;
  return (
    <section
      className="glass-card mt-6 grid grid-cols-[1fr_auto] items-center gap-x-6 gap-y-4 rounded-card px-6 py-6 shadow-card max-[35rem]:grid-cols-1 max-[35rem]:gap-y-4"
      aria-labelledby="deal-title"
    >
      <div className="min-w-0">
        <p className="flex items-center gap-2 font-mono text-[1rem] tracking-[0.04em] uppercase text-muted font-semibold">
          <span className="pulse-dot" aria-hidden="true" />
          {timeframe === "current" ? "Top-Deal der Woche" : "Top-Deal · nächste Woche"}
        </p>
        <h2 id="deal-title" className="mt-2 text-[2.25rem] leading-none text-balance">
          {deal.brand} {deal.title}
        </h2>
        <p className="mt-0 font-mono text-muted text-[1rem]">
          {deal.market} · {deal.unitLabel}
        </p>
        <div className="flex gap-x-4">
          <p className="mt-2 inline-block rounded-[0.5625rem] border border-[color-mix(in_srgb,var(--good)_32%,transparent)] bg-good-tint px-2 py-0 text-[1rem] font-bold text-good">
            <span className="visually-hidden">
              {dealSaving.percent} Prozent günstiger, Sie sparen {formatEuro(dealSaving.amount)} gegenüber vorher{" "}
              {formatEuro(deal.oldPrice!)}
            </span>
            <span aria-hidden="true">
              −{dealSaving.percent}&nbsp;% · {formatEuro(dealSaving.amount)} gespart · statt {formatEuro(deal.oldPrice!)}
            </span>
          </p>
          <p className="mt-2 inline-flex items-center gap-2 rounded-[0.5625rem] border border-[color-mix(in_srgb,var(--accent-strong)_32%,transparent)] px-2 py-0 text-[1rem] font-semibold text-accent-strong">
            <Clock size={13} strokeWidth={2.2} aria-hidden className="flex-none" />
            {dealValid.label}
            {endWeekday ? ` · bis ${endWeekday}` : ""}
          </p>
        </div>
      </div>
      <div className="text-right max-[35rem]:text-left">
        <div className="font-display text-[clamp(3rem,6vw,4.5rem)] tabular-nums text-ink leading-none">{formatEuro(deal.price)}</div>
        {deal.perLiter != null && (
          <div className="mt-2 font-mono text-[1rem] font-semibold tabular-nums text-accent-strong">{formatNumber(deal.perLiter)} €/L</div>
        )}
      </div>
      {deal.url && (
        <a
          href={deal.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group col-span-2 mt-2 inline-flex items-center gap-2 border-t border-border pt-4 text-[1rem] font-[700] text-accent-strong max-[35rem]:col-span-1"
        >
          Zum Angebot bei {deal.market}
          <span aria-hidden="true" className="transition-transform duration-150 group-hover:translate-x-[3px]">
            →
          </span>
        </a>
      )}
    </section>
  );
}
