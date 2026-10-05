import { formatEuro, formatNumber, perLiterStats, savings, topDeal, type GroupedOffer, type Timeframe } from "../lib/offers";
import { WRAP } from "../lib/layout";
import { Can, StatCard, TopDealBanner } from "./heroParts";

// Hero-Kopf + Top-Deal-Banner + Kennzahlen-Grid des gewählten Zeitraums.
// Reine Präsentations-Komponente: Zahlen kommen fertig berechnet aus App.

const STAT_VALUE = "font-mono text-[1.85rem] font-bold tracking-[-0.02em] tabular-nums";
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
    <section className="relative" aria-labelledby="page-title">
      {/* Bühne: bleibt beim Scrollen stehen, das Kennzahlen-Panel schiebt sich darüber */}
      <div className="sticky top-[62px] min-h-[min(78vh,640px)] overflow-hidden flex items-center">
        <div className="hero-sun" aria-hidden="true" />
        <div className={`${WRAP} hero-enter relative pb-24`}>
          <p className="font-mono text-[clamp(0.75rem,1.6vw,1.1rem)] tracking-[0.2em] uppercase text-good mb-4">
            Energy-Drink-Angebote · {timeframe === "current" ? "Diese Woche" : "Nächste Woche · Vorschau"}
          </p>
          <h1 id="page-title" className="hero-title text-[clamp(1.5rem,7vw,6.25rem)] leading-[1.05] tracking-[-0.01em] text-balance">
            {timeframe === "current" ? (
              <>Schnäppchenjagd auf Energy&#8209;Drinks.</>
            ) : (
              <>Der Ausblick: Energy&#8209;Deals der nächsten Woche.</>
            )}
          </h1>
        </div>
      </div>

      {/* Panel: überlappt die Bühne; die Dose ragt über die Oberkante */}
      <div className="relative z-[5] -mt-[16vh] bg-neon-cyan text-[#0b0626] border-t-[10px] border-neon-yellow pt-16 pb-14">
        <Can className="absolute right-[5%] -top-[130px] w-[clamp(72px,11vw,140px)] rotate-[8deg] z-[6]" />
        <div className={WRAP}>
          <p className="text-[1.15rem] leading-snug font-bold max-w-[40ch]">
            Jede Woche automatisch aus allen Prospekten, verglichen nach Preis pro Liter — das beste €/L steht oben.
          </p>
          {deal && dealSaving && <TopDealBanner deal={deal} dealSaving={dealSaving} timeframe={timeframe} />}

          {stats ? (
            <ul className="list-none mt-8 p-0 grid gap-4 grid-cols-4 max-[780px]:grid-cols-2 max-[430px]:grid-cols-1">
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
                      {formatNumber(stats.literStats.min)}–{formatNumber(stats.literStats.max)}
                      <span className="text-[0.9rem] text-muted"> €/L</span>
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
                      <span className="text-[0.9rem] text-muted"> €/L</span>
                    </span>
                  ) : (
                    noLiter
                  )
                }
                sub={stats.literStats ? <span className={STAT_SUB}>Median über {stats.literCount} Angebote</span> : null}
              />
            </ul>
          ) : (
            <p className="mt-6 px-5 py-12 text-center text-muted border border-dashed border-border-strong rounded-card">
              Für nächste Woche liegen noch keine Angebote vor. Sobald neue Prospekte erscheinen, tauchen sie hier auf.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
