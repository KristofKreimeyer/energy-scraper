import {
  formatEuro,
  formatNumber,
  perLiterStats,
  savings,
  topDeal,
  type GroupedOffer,
  type Timeframe,
} from "../lib/offers";
import { WRAP } from "../utils/helper";

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

export default function Hero({ timeframe, deal, dealSaving, stats }: HeroProps) {
  return (
    <section className={`${WRAP} pt-[34px] pb-2`} aria-labelledby="page-title">
      <p className={`${EYEBROW} mb-2.5`}>
        Energy-Drink-Angebote ·{" "}
        {timeframe === "current" ? "Diese Woche" : "Nächste Woche · Vorschau"}
      </p>
      <h1
        id="page-title"
        className="text-[clamp(1.7rem,3.4vw,2.5rem)] leading-[1.08] tracking-[-0.025em] mb-2.5 text-balance max-w-[20ch]"
      >
        {timeframe === "current"
          ? "Alle Energy-Deals der Woche, nach Preis pro Liter sortiert."
          : "Ein Blick voraus: die Energy-Deals der nächsten Woche."}
      </h1>
      <p className="text-muted text-[1.02rem] max-w-[56ch]">
        Automatisch gesammelt aus den Prospekten von Aldi, Kaufland, Lidl,
        Netto, Penny und Rewe. Vergleiche Dosenpreis <em>und</em> Grundpreis auf
        einen Blick.
      </p>

      {deal && dealSaving && (
        <section
          className="mt-6 flex items-center gap-5 px-[22px] py-[18px] bg-good-tint border border-[color-mix(in_srgb,var(--good)_40%,transparent)] rounded-card shadow-card max-[560px]:flex-wrap max-[560px]:gap-x-4 max-[560px]:gap-y-3"
          aria-labelledby="deal-title"
        >
          <p className="flex-none font-mono text-[clamp(2.1rem,5vw,3rem)] font-[750] tracking-[-0.03em] tabular-nums text-good leading-none">
            −{dealSaving.percent}&nbsp;%
          </p>
          <div className="flex-1 min-w-0">
            <p className={`${EYEBROW} !text-good mb-1.5`}>
              {timeframe === "current"
                ? "Größter Preissturz"
                : "Größter Preissturz · nächste Woche"}
            </p>
            <h2
              id="deal-title"
              className="text-[1.3rem] tracking-[-0.02em] leading-[1.15] text-balance"
            >
              {deal.brand} {deal.title}
            </h2>
            <p className="mt-[3px] text-muted text-[0.9rem]">
              {deal.market} · {deal.unitLabel}
            </p>
          </div>
          <div className="flex-none text-right flex flex-col gap-0.5 max-[560px]:text-left max-[560px]:w-full max-[560px]:flex-row max-[560px]:items-baseline max-[560px]:gap-2.5 max-[560px]:pt-3 max-[560px]:border-t max-[560px]:border-[color-mix(in_srgb,var(--good)_25%,transparent)]">
            <span className="font-mono text-[1.7rem] font-bold tracking-[-0.03em] tabular-nums text-ink">
              {formatEuro(deal.price)}
            </span>
            <span className="font-mono text-[0.82rem] tabular-nums text-muted">
              <span className="visually-hidden">
                {dealSaving.percent} Prozent günstiger, Sie sparen{" "}
                {formatEuro(dealSaving.amount)} gegenüber vorher{" "}
                {formatEuro(deal.oldPrice!)}
              </span>
              <span aria-hidden="true">
                <s className="text-muted">{formatEuro(deal.oldPrice!)}</s> ·{" "}
                {formatEuro(dealSaving.amount)} gespart
              </span>
            </span>
          </div>
        </section>
      )}

      {stats ? (
        <ul className="list-none mt-[26px] p-0 grid gap-[14px] grid-cols-4 max-[780px]:grid-cols-2 max-[430px]:grid-cols-1">
          <li className="bg-surface border border-[color-mix(in_srgb,var(--accent)_55%,var(--border))] rounded-card px-4 pt-4 pb-[15px] shadow-card flex flex-col gap-0.5">
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
          <li className="bg-surface border border-border rounded-card px-4 pt-4 pb-[15px] shadow-card flex flex-col gap-0.5">
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
          <li className="bg-surface border border-border rounded-card px-4 pt-4 pb-[15px] shadow-card flex flex-col gap-0.5">
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
          <li className="bg-surface border border-border rounded-card px-4 pt-4 pb-[15px] shadow-card flex flex-col gap-0.5">
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
