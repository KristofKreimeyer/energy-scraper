import {
  formatEuro,
  formatNumber,
  perLiterStats,
  savings,
  topDeal,
  validity,
  type GroupedOffer,
  type Timeframe,
} from "../lib/offers";
import { WRAP } from "../utils/helper";
import { Clock } from "lucide-react";

// Hero-Kopf + Top-Deal-Banner + Kennzahlen-Grid des gewählten Zeitraums.
// Reine Präsentations-Komponente: Zahlen kommen fertig berechnet aus App.

const EYEBROW =
  "font-mono text-[0.72rem] tracking-[0.14em] uppercase text-muted";

export interface HeroStats {
  cheapest: GroupedOffer;
  bestLiter: GroupedOffer | null;
  literStats: ReturnType<typeof perLiterStats>;
  literCount: number;
}

interface HeroProps {
  timeframe: Timeframe;
  deal: ReturnType<typeof topDeal>;
  dealSaving: ReturnType<typeof savings>;
  stats: HeroStats | null;
}

export default function Hero({
  timeframe,
  deal,
  dealSaving,
  stats,
}: HeroProps) {
  return (
    <section
      className={`${WRAP} hero-enter pt-[38px] pb-3`}
      aria-labelledby="page-title"
    >
      <p className={`${EYEBROW} mb-3`}>
        Energy-Drink-Angebote ·{" "}
        {timeframe === "current" ? "Diese Woche" : "Nächste Woche · Vorschau"}
      </p>
      <h1
        id="page-title"
        className="text-[clamp(2rem,4.2vw,3rem)] font-[700] leading-[1.04] tracking-[-0.03em] mb-3.5 text-balance"
      >
        {timeframe === "current" ? (
          <>
            Schnäppchenjagd auf{" "}
            <b className="text-accent-strong">Energy-Drinks</b>.
          </>
        ) : (
          <>
            Der Ausblick: <b className="text-accent-strong">Energy-Deals</b> der
            nächsten Woche.
          </>
        )}
      </h1>
      <p className="text-muted text-[1.05rem] leading-relaxed max-w-[62ch]">
        Jede Woche automatisch aus allen Prospekten, verglichen nach Preis pro
        Liter — das beste €/L steht oben.
      </p>

      {deal &&
        dealSaving &&
        (() => {
          const dealValid = validity(deal);
          // Wochentag des letzten Gültigkeitstags (wie im Entwurf „· bis Sonntag").
          // Nur bei laufenden Angeboten mit Enddatum – nicht bei „Ab …"-Vorschau.
          const endWeekday =
            !dealValid.upcoming && deal.validTo
              ? new Intl.DateTimeFormat("de-DE", { weekday: "long" }).format(
                  new Date(deal.validTo),
                )
              : null;
          return (
            <section
              className="glass-card mt-6 grid grid-cols-[1fr_auto] items-center gap-x-5 gap-y-4 rounded-card px-6 py-[22px] shadow-card max-[560px]:grid-cols-1 max-[560px]:gap-y-3"
              aria-labelledby="deal-title"
            >
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-mono text-[0.68rem] tracking-[0.18em] uppercase text-accent-strong font-semibold">
                  <span className="pulse-dot" aria-hidden="true" />
                  {timeframe === "current"
                    ? "Top-Deal der Woche"
                    : "Top-Deal · nächste Woche"}
                </p>
                <h2
                  id="deal-title"
                  className="mt-2 text-[1.3rem] tracking-[-0.02em] leading-[1.15] text-balance"
                >
                  {deal.brand} {deal.title}
                </h2>
                <p className="mt-[3px] font-mono text-muted text-[0.85rem]">
                  {deal.market} · {deal.unitLabel}
                </p>
                <div className="flex gap-x-4">
                  <p className="mt-2.5 inline-block rounded-[9px] border border-[color-mix(in_srgb,var(--good)_32%,transparent)] bg-good-tint px-[11px] py-[5px] text-[0.82rem] font-bold text-good">
                    <span className="visually-hidden">
                      {dealSaving.percent} Prozent günstiger, Sie sparen{" "}
                      {formatEuro(dealSaving.amount)} gegenüber vorher{" "}
                      {formatEuro(deal.oldPrice!)}
                    </span>
                    <span aria-hidden="true">
                      −{dealSaving.percent}&nbsp;% ·{" "}
                      {formatEuro(dealSaving.amount)} gespart · statt{" "}
                      {formatEuro(deal.oldPrice!)}
                    </span>
                  </p>
                  <p className="mt-2.5 inline-flex items-center gap-1.5 rounded-[9px] border border-[color-mix(in_srgb,var(--accent-strong)_32%,transparent)] px-[11px] py-[5px] text-[0.82rem] font-semibold text-accent-strong">
                    <Clock size={13} strokeWidth={2.2} aria-hidden className="flex-none" />
                    {dealValid.label}
                    {endWeekday ? ` · bis ${endWeekday}` : ""}
                  </p>
                </div>
              </div>
              <div className="text-right max-[560px]:text-left">
                <div className="font-mono text-[clamp(1.9rem,4vw,2.3rem)] font-bold tracking-[-0.03em] tabular-nums text-ink leading-none">
                  {formatEuro(deal.price)}
                </div>
                {deal.perLiter != null && (
                  <div className="mt-1.5 font-mono text-[0.84rem] font-semibold tabular-nums text-accent-strong">
                    {formatNumber(deal.perLiter)} €/L
                  </div>
                )}
              </div>
              {deal.url && (
                <a
                  href={deal.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group col-span-2 mt-1.5 inline-flex items-center gap-2 border-t border-border pt-[18px] text-[0.95rem] font-[700] text-accent-strong max-[560px]:col-span-1"
                >
                  Zum Angebot bei {deal.market}
                  <span
                    aria-hidden="true"
                    className="transition-transform duration-150 group-hover:translate-x-[3px]"
                  >
                    →
                  </span>
                </a>
              )}
            </section>
          );
        })()}

      {stats ? (
        <ul className="list-none mt-8 p-0 grid gap-4 grid-cols-4 max-[780px]:grid-cols-2 max-[430px]:grid-cols-1">
          <li className="glass-card border-[color-mix(in_srgb,var(--accent)_55%,var(--border))] rounded-card px-4 pt-4 pb-[15px] shadow-card flex flex-col gap-0.5">
            <span className={`${EYEBROW} !text-[0.68rem] !tracking-[0.1em]`}>
              Günstigste Dose
            </span>
            <span className="font-mono text-[1.85rem] font-bold tracking-[-0.02em] tabular-nums text-accent">
              {formatEuro(stats.cheapest.perUnit)}
            </span>
            <span className="text-[0.82rem] text-muted">
              {stats.cheapest.brand} · {stats.cheapest.market} ·{" "}
              {stats.cheapest.unitCount > 1
                ? "je Dose"
                : stats.cheapest.unitLabel}
            </span>
          </li>
          <li className="glass-card rounded-card px-4 pt-4 pb-[15px] shadow-card flex flex-col gap-0.5">
            <span className={`${EYEBROW} !text-[0.68rem] !tracking-[0.1em]`}>
              Bester Grundpreis
            </span>
            {stats.bestLiter ? (
              <>
                <span className="font-mono text-[1.85rem] font-bold tracking-[-0.02em] tabular-nums">
                  {formatEuro(stats.bestLiter.perLiter!)}
                  <span className="text-[0.9rem] text-muted">/L</span>
                </span>
                <span className="text-[0.82rem] text-muted">
                  {stats.bestLiter.brand} · {stats.bestLiter.market}
                </span>
              </>
            ) : (
              <>
                <span className="font-mono text-[1.85rem] font-bold tabular-nums">
                  —
                </span>
                <span className="text-[0.82rem] text-muted">
                  Kein Grundpreis verfügbar
                </span>
              </>
            )}
          </li>
          <li className="glass-card rounded-card px-4 pt-4 pb-[15px] shadow-card flex flex-col gap-0.5">
            <span className={`${EYEBROW} !text-[0.68rem] !tracking-[0.1em]`}>
              Preisspanne pro Liter
            </span>
            {stats.literStats ? (
              <>
                <span className="font-mono text-[1.4rem] font-bold tracking-[-0.02em] tabular-nums">
                  {formatNumber(stats.literStats.min)}–
                  {formatNumber(stats.literStats.max)}
                  <span className="text-[0.9rem] text-muted"> €/L</span>
                </span>
                <span className="text-[0.82rem] text-muted">
                  Vergleichen lohnt sich
                </span>
              </>
            ) : (
              <>
                <span className="font-mono text-[1.85rem] font-bold tabular-nums">
                  —
                </span>
                <span className="text-[0.82rem] text-muted">
                  Kein Grundpreis verfügbar
                </span>
              </>
            )}
          </li>
          <li className="glass-card rounded-card px-4 pt-4 pb-[15px] shadow-card flex flex-col gap-0.5">
            <span className={`${EYEBROW} !text-[0.68rem] !tracking-[0.1em]`}>
              Typischer Grundpreis
            </span>
            {stats.literStats ? (
              <>
                <span className="font-mono text-[1.85rem] font-bold tracking-[-0.02em] tabular-nums">
                  {formatNumber(stats.literStats.median)}
                  <span className="text-[0.9rem] text-muted"> €/L</span>
                </span>
                <span className="text-[0.82rem] text-muted">
                  Median über {stats.literCount} Angebote
                </span>
              </>
            ) : (
              <>
                <span className="font-mono text-[1.85rem] font-bold tabular-nums">
                  —
                </span>
                <span className="text-[0.82rem] text-muted">
                  Kein Grundpreis verfügbar
                </span>
              </>
            )}
          </li>
        </ul>
      ) : (
        <p className="mt-6 px-5 py-12 text-center text-muted border border-dashed border-border-strong rounded-card">
          Für nächste Woche liegen noch keine Angebote vor. Sobald neue
          Prospekte erscheinen, tauchen sie hier auf.
        </p>
      )}
    </section>
  );
}
