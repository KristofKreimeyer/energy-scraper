import { formatEuro, formatNumber, perLiterStats, savings, topDeal, type GroupedOffer, type Timeframe } from "../lib/offers";
import { WRAP } from "../lib/layout";
import { StatCard, TopDealBanner } from "./heroParts";
import CinematicStage from "./CinematicStage";

// Kino-Hero + Top-Deal-Banner + Kennzahlen-Grid des gewählten Zeitraums.
// Reine Präsentations-Komponente: Zahlen kommen fertig berechnet aus App.

const STAT_VALUE = "font-display text-[3rem] leading-none tabular-nums";
const STAT_SUB = "text-[1rem] text-muted";

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
    <span className="font-display text-[3rem] leading-none">—</span>
    <span className={STAT_SUB}>Kein Grundpreis verfügbar</span>
  </>
);

export default function Hero({ timeframe, deal, dealSaving, stats }: HeroProps) {
  return (
    <section className="relative">
      <CinematicStage timeframe={timeframe} />

      {/* Panel: Kennzahlen unter dem Kino-Hero */}
      <div className="relative z-[5] bg-blue text-black border-t-[0.25rem] border-black pt-16 pb-14">
        <div className={WRAP}>
          {deal && dealSaving && <TopDealBanner deal={deal} dealSaving={dealSaving} timeframe={timeframe} />}

          {stats ? (
            <ul className="list-none mt-8 p-0 grid gap-4 grid-cols-4 max-[48.75rem]:grid-cols-2 max-[26.875rem]:grid-cols-1">
              <StatCard
                className="border-[color-mix(in_srgb,var(--accent)_55%,var(--border))]"
                label="Günstigste Dose"
                value={<span className={`${STAT_VALUE} text-accent`}>{formatEuro(stats.cheapest.perUnit)}</span>}
                sub={
                  <span className={STAT_SUB}>
                    {stats.cheapest.brand} · {stats.cheapest.market} · {stats.cheapest.unitCount > 1 ? "je Dose" : stats.cheapest.unitLabel}
                  </span>
                }
              />
              <StatCard
                label="Bester Grundpreis"
                value={
                  stats.bestLiter ? (
                    <span className={STAT_VALUE}>
                      {formatEuro(stats.bestLiter.perLiter!)}
                      <span className="text-[1rem] text-muted">/L</span>
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
                    <span className="font-display text-[2.4rem] leading-none tabular-nums">
                      {formatNumber(stats.literStats.min)}–{formatNumber(stats.literStats.max)}
                      <span className="text-[1rem] text-muted"> €/L</span>
                    </span>
                  ) : (
                    noLiter
                  )
                }
                sub={stats.literStats ? <span className={STAT_SUB}>Vergleichen lohnt sich</span> : null}
              />
              <StatCard
                label="Typischer Grundpreis"
                value={
                  stats.literStats ? (
                    <span className={STAT_VALUE}>
                      {formatNumber(stats.literStats.median)}
                      <span className="text-[1rem] text-muted"> €/L</span>
                    </span>
                  ) : (
                    noLiter
                  )
                }
                sub={stats.literStats ? <span className={STAT_SUB}>Median über {stats.literCount} Angebote</span> : null}
              />
            </ul>
          ) : (
            <p className="mt-6 px-6 py-12 text-muted border border-dashed border-border-strong rounded-card">
              Für nächste Woche liegen noch keine Angebote vor. Sobald neue Prospekte erscheinen, tauchen sie hier auf.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
