import {
  formatEuro,
  validity,
  savings,
  priceInsight,
  type GroupedOffer,
  type PriceInsight,
} from "../lib/offers";
import { CardActions } from "./CardActions";
import { useFavorites, toggleFavorite } from "../lib/favorites";
import { ArrowRight, Clock, Zap, TrendingUp, Heart } from "lucide-react";
import type { CommunityReport } from "../hooks/useCommunityReports";
import type { VoteTally } from "../hooks/useCommunityVotes";

/** Textbausteine je Preisniveau (relativ zur eigenen Historie des Produkts). */
const INSIGHT_COPY: Record<
  PriceInsight["level"],
  { label: string; icon: "bolt" | "trend" }
> = {
  best: { label: "Bestpreis", icon: "bolt" },
  good: { label: "Günstiger als üblich", icon: "trend" },
  normal: { label: "Üblicher Preis", icon: "trend" },
  high: { label: "Über üblichem Preis", icon: "trend" },
};

/** Badge-Farben je Preisniveau. */
const INSIGHT_BADGE: Record<PriceInsight["level"], string> = {
  best: "text-on-fill bg-fill border-fill",
  good: "text-good bg-good-tint border-[color-mix(in_srgb,var(--good)_30%,transparent)]",
  normal: "text-muted bg-surface-2 border-border",
  high: "text-warn-ink bg-warn-tint border-[color-mix(in_srgb,var(--warn-ink)_30%,transparent)]",
};

/** Sparkline-Farbe (currentColor) je Preisniveau. */
const INSIGHT_SPARK: Record<PriceInsight["level"], string> = {
  best: "text-accent",
  good: "text-good",
  normal: "text-muted",
  high: "text-warn-ink",
};

const VALID_VARIANT = {
  base: "bg-surface-2 text-muted border-border",
  ending:
    "bg-warn-tint text-warn-ink border-[color-mix(in_srgb,var(--warn-ink)_30%,transparent)]",
  upcoming:
    "bg-accent-tint text-accent-strong border-[color-mix(in_srgb,var(--accent-strong)_30%,transparent)]",
};

/** Winzige €/L-Verlaufslinie; der jüngste (aktuelle) Punkt ist hervorgehoben. */
function Sparkline({
  trend,
  colorClass,
}: {
  trend: PriceInsight["trend"];
  colorClass: string;
}) {
  const w = 60;
  const h = 20;
  const pad = 3;
  const values = trend.map((t) => t.perLiter);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const x = (i: number) =>
    trend.length === 1 ? w / 2 : pad + (i * (w - 2 * pad)) / (trend.length - 1);
  const y = (v: number) => pad + (1 - (v - min) / span) * (h - 2 * pad);
  const line = trend.map((t, i) => `${x(i)},${y(t.perLiter)}`).join(" ");
  const last = trend[trend.length - 1];
  return (
    <svg
      className={`flex-none ml-auto overflow-visible ${colorClass}`}
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      aria-hidden="true"
    >
      <polyline
        points={line}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={x(trend.length - 1)}
        cy={y(last.perLiter)}
        r="2.4"
        fill="currentColor"
      />
    </svg>
  );
}

interface Props {
  offer: GroupedOffer;
  isBest: boolean;
  reports?: CommunityReport[];
  votes?: VoteTally;
}

// Listenansicht: kompakte horizontale Zeile je Angebot.
export function OfferListView({ offer, isBest, reports, votes }: Props) {
  const { label: validLabel, ending, upcoming } = validity(offer);
  const saved = savings(offer);
  const insight = priceInsight(offer);
  const favorites = useFavorites();
  const isFav = favorites.includes(offer.brand);
  const isMulti = offer.unitCount > 1;
  const alt = `${offer.brand} ${offer.title}, Angebot bei ${offer.supermarket}`;

  const validVariant = ending
    ? VALID_VARIANT.ending
    : upcoming
      ? VALID_VARIANT.upcoming
      : VALID_VARIANT.base;

  // Kombinierte Kopfzeile „Marke · Markt" (Mockup-Stil: Akzent, klein, gesperrt).
  const brandLine = (
    <span className="font-mono text-[0.68rem] tracking-[0.14em] uppercase text-accent-strong font-bold">
      {offer.brand} · {offer.market}
    </span>
  );

  // Dezente Bestes-€/L-Auszeichnung (ersetzt die frühere Bild-Ecken-Plakette).
  const bestTag = isBest && (
    <span className="self-start text-[0.64rem] tracking-[0.1em] uppercase text-good font-semibold">
      ◈ bestes €/L
    </span>
  );

  // Marke merken (Favorit). Liegt über dem ganzflächigen Karten-Link.
  const favButton = (
    <button
      type="button"
      className={`relative z-10 ml-auto flex-none grid place-items-center w-7 h-7 rounded-full transition-colors duration-150 ${
        isFav
          ? "text-accent-strong hover:text-accent"
          : "text-muted hover:text-ink hover:bg-surface-2"
      }`}
      aria-pressed={isFav}
      aria-label={
        isFav
          ? `${offer.brand} aus Favoriten entfernen`
          : `${offer.brand} merken`
      }
      title={isFav ? "Marke gemerkt" : "Marke merken"}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        toggleFavorite(offer.brand);
      }}
    >
      <Heart
        size={16}
        strokeWidth={2}
        fill={isFav ? "currentColor" : "none"}
        aria-hidden
      />
    </button>
  );

  // Geteilte Bausteine für Kachel- und Listenansicht.
  const insightBlock = insight && (
    <div
      className="flex flex-col gap-[5px] text-[0.76rem]"
      aria-label={`Preisniveau: ${INSIGHT_COPY[insight.level].label}. Typischer Grundpreis ${formatEuro(insight.median)} pro Liter über ${insight.dayCount} erfasste Tage.`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`flex-none inline-flex items-center gap-[5px] font-bold rounded-[7px] px-2 py-[3px] border ${INSIGHT_BADGE[insight.level]}`}
        >
          {INSIGHT_COPY[insight.level].icon === "bolt" ? (
            <Zap size={12} fill="currentColor" stroke="none" aria-hidden />
          ) : (
            <TrendingUp size={12} strokeWidth={2.4} aria-hidden />
          )}
          {INSIGHT_COPY[insight.level].label}
        </span>
        <Sparkline
          trend={insight.trend}
          colorClass={INSIGHT_SPARK[insight.level]}
        />
      </div>
      <span
        className="text-muted font-mono tabular-nums whitespace-nowrap overflow-hidden text-ellipsis"
        aria-hidden="true"
      >
        {insight.level === "best"
          ? "günstigster erfasster Preis"
          : `⌀ ${formatEuro(insight.median)}/L · ${insight.dayCount} Tage`}
      </span>
    </div>
  );

  const validBadge = (
    <span
      className={`inline-flex items-center gap-1.5 self-start text-[0.76rem] font-semibold rounded-[7px] px-[9px] py-1 border ${validVariant}`}
    >
      <Clock size={13} strokeWidth={2.2} aria-hidden />
      {validLabel}
    </span>
  );

  // Freigegebene Community-Meldungen (günstiger gesehen). Neueste zuerst, max. 2.
  const communityBlock = reports && reports.length > 0 && (
    <div
      className="flex flex-col gap-1 text-[0.75rem]"
      aria-label="Von der Community gemeldete Preise"
    >
      {reports.slice(0, 2).map((r, i) => (
        <span key={i} className="inline-flex items-center gap-1.5 text-muted">
          <span aria-hidden="true">💬</span>
          <span>
            Community:{" "}
            <b className="font-mono tabular-nums text-good">
              {formatEuro(r.price)}
            </b>{" "}
            bei {r.market}
            {r.storeLocation ? ` · ${r.storeLocation}` : ""}
          </span>
        </span>
      ))}
    </div>
  );

  return (
    <li>
        <article
          className={`offer-card glass-card group relative flex flex-col gap-2 rounded-card p-3 shadow-card transition-[border-color] duration-150 hover:border-border-strong focus-within:border-focus ${
            isBest
              ? "border-[color-mix(in_srgb,var(--good)_45%,var(--border))]"
              : ""
          }`}
          aria-label={alt}
        >
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {brandLine}
                {bestTag}
                {favButton}
              </div>
              <h3 className="text-[0.95rem] leading-tight truncate mt-0.5">
                {offer.title}
              </h3>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {validBadge}
                {saved && (
                  <span className="font-mono font-bold tabular-nums text-good text-[0.72rem] bg-good-tint border border-[color-mix(in_srgb,var(--good)_30%,transparent)] rounded px-1.5 py-px">
                    −{saved.percent}&nbsp;%
                  </span>
                )}
              </div>
            </div>

            <div className="flex-none text-right">
              <div className="font-mono text-[1.1rem] font-bold tracking-[-0.02em] tabular-nums text-ink whitespace-nowrap">
                {formatEuro(offer.perUnit)}
                <span className="text-[0.62rem] font-medium text-muted">
                  {" "}
                  {isMulti ? "/ Dose" : ""}
                </span>
              </div>
              <div
                className={`font-mono text-[0.82rem] font-bold tabular-nums whitespace-nowrap ${isBest ? "text-good" : "text-accent-strong"}`}
              >
                {offer.perLiter != null
                  ? `${formatEuro(offer.perLiter)}/L`
                  : "—"}
              </div>
            </div>

            {offer.url && (
              <a
                data-cta=""
                className="flex-none inline-flex items-center gap-1 text-accent-strong text-[0.82rem] font-[650] no-underline after:content-[''] after:absolute after:inset-0 after:rounded-card group-hover:text-accent focus-visible:outline-none"
                href={offer.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Angebot ansehen: ${alt} (öffnet in neuem Tab)`}
              >
                <span className="hidden sm:inline">Sichern</span>
                <ArrowRight
                  size={15}
                  strokeWidth={2.4}
                  aria-hidden
                  className="transition-transform duration-150 group-hover:translate-x-[3px]"
                />
              </a>
            )}
          </div>

          <div className="flex flex-col gap-2.5 border-t border-border pt-2.5">
            {insightBlock}
            {communityBlock}
            <CardActions offer={offer} votes={votes} />
          </div>
        </article>
      </li>
  );
}
