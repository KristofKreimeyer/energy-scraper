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
import { StatCard, TopDealBanner } from "./heroParts";

// Hero-Kopf + Top-Deal-Banner + Kennzahlen-Grid des gewählten Zeitraums.
// Reine Präsentations-Komponente: Zahlen kommen fertig berechnet aus App.

const EYEBROW =
  "font-mono text-[0.72rem] tracking-[0.14em] uppercase text-muted";

const STAT_VALUE =
  "font-mono text-[1.85rem] font-bold tracking-[-0.02em] tabular-nums";
const STAT_SUB = "text-[0.82rem] text-muted";

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

const noLiter = (
  <>
    <span className="font-mono text-[1.85rem] font-bold tabular-nums">—</span>
    <span className={STAT_SUB}>Kein Grundpreis verfügbar</span>
  </>
);

export default function Hero({ timeframe, deal, dealSaving, stats }: HeroProps) {
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

      {deal && dealSaving && (
        <TopDealBanner deal={deal} dealSaving={dealSaving} timeframe={timeframe} />
      )}

      {stats ? (
        <ul className="list-none mt-8 p-0 grid gap-4 grid-cols-4 max-[780px]:grid-cols-2 max-[430px]:grid-cols-1">
          <StatCard
            className="border-[color-mix(in_srgb,var(--accent)_55%,var(--border))]"
            label="Günstigste Dose"
            value={
              <span className={`${STAT_VALUE} text-accent`}>
                {formatEuro(stats.cheapest.perUnit)}
              </span>
            }
            sub={
              <span className={STAT_SUB}>
                {stats.cheapest.brand} · {stats.cheapest.market} ·{" "}
                {stats.cheapest.unitCount > 1
                  ? "je Dose"
                  : stats.cheapest.unitLabel}
              </span>
            }
          />
          <StatCard
            label="Bester Grundpreis"
            value={
              stats.bestLiter ? (
                <span className={STAT_VALUE}>
                  {formatEuro(stats.bestLiter.perLiter!)}
                  <span className="text-[0.9rem] text-muted">/L</span>
                </span>
              ) : (
                noLiter
              )
            }
            sub={
              stats.bestLiter ? (
                <span className={STAT_SUB}>
                  {stats.bestLiter.brand} · {stats.bestLiter.market}
                </span>
              ) : null
            }
          />
          <StatCard
            label="Preisspanne pro Liter"
            value={
              stats.literStats ? (
                <span className="font-mono text-[1.4rem] font-bold tracking-[-0.02em] tabular-nums">
                  {formatNumber(stats.literStats.min)}–
                  {formatNumber(stats.literStats.max)}
                  <span className="text-[0.9rem] text-muted"> €/L</span>
                </span>
              ) : (
                noLiter
              )
            }
            sub={
              stats.literStats ? (
                <span className={STAT_SUB}>Vergleichen lohnt sich</span>
              ) : null
            }
          />
          <StatCard
            label="Typischer Grundpreis"
            value={
              stats.literStats ? (
                <span className={STAT_VALUE}>
                  {formatNumber(stats.literStats.median)}
                  <span className="text-[0.9rem] text-muted"> €/L</span>
                </span>
              ) : (
                noLiter
              )
            }
            sub={
              stats.literStats ? (
                <span className={STAT_SUB}>
                  Median über {stats.literCount} Angebote
                </span>
              ) : null
            }
          />
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
