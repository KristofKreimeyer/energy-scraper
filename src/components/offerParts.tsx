import {
  formatEuro,
  validity,
  priceInsight,
  type GroupedOffer,
  type PriceInsight,
} from "../lib/offers";
import { useFavorites, toggleFavorite } from "../lib/favorites";
import { Clock, Zap, TrendingUp, Heart } from "lucide-react";
import type { CommunityReport } from "../hooks/useCommunityReports";

// Geteilte Bausteine für Karten- und Listenansicht (OfferCardView /
// OfferListView). Reine Präsentation – jede View arrangiert nur ihr Layout.

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
export function Sparkline({
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

/** Kopfzeile „Marke · Markt". */
export function BrandLine({ offer }: { offer: GroupedOffer }) {
  return (
    <span className="font-mono text-[0.68rem] tracking-[0.14em] uppercase text-accent-strong font-bold">
      {offer.brand} · {offer.market}
    </span>
  );
}

/** Dezente „bestes €/L"-Auszeichnung – null, wenn nicht bester Grundpreis. */
export function BestTag({ isBest }: { isBest: boolean }) {
  if (!isBest) return null;
  return (
    <span className="self-start text-[0.64rem] tracking-[0.1em] uppercase text-good font-semibold">
      ◈ bestes €/L
    </span>
  );
}

/** Marke merken (Favorit). Liegt über dem ganzflächigen Karten-Link. */
export function FavButton({ offer }: { offer: GroupedOffer }) {
  const favorites = useFavorites();
  const isFav = favorites.includes(offer.brand);
  return (
    <button
      type="button"
      className={`relative z-10 ml-auto flex-none grid place-items-center w-7 h-7 rounded-full transition-colors duration-150 ${
        isFav
          ? "text-accent-strong hover:text-accent"
          : "text-muted hover:text-ink hover:bg-surface-2"
      }`}
      aria-pressed={isFav}
      aria-label={
        isFav ? `${offer.brand} aus Favoriten entfernen` : `${offer.brand} merken`
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
}

/** Preisniveau-Badge + Sparkline – null ohne ableitbare Historie. `className`
 *  wird an den Wurzel-Container gehängt (z. B. Abstand in der Kartenansicht). */
export function InsightBlock({
  offer,
  className = "",
}: {
  offer: GroupedOffer;
  className?: string;
}) {
  const insight = priceInsight(offer);
  if (!insight) return null;
  return (
    <div
      className={`flex flex-col gap-[5px] text-[0.76rem] ${className}`}
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
        <Sparkline trend={insight.trend} colorClass={INSIGHT_SPARK[insight.level]} />
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
}

/** Gültigkeits-Badge (Restlaufzeit / „Ab …" / laufend). */
export function ValidBadge({ offer }: { offer: GroupedOffer }) {
  const { label, ending, upcoming } = validity(offer);
  const variant = ending
    ? VALID_VARIANT.ending
    : upcoming
      ? VALID_VARIANT.upcoming
      : VALID_VARIANT.base;
  return (
    <span
      className={`inline-flex items-center gap-1.5 self-start text-[0.76rem] font-semibold rounded-[7px] px-[9px] py-1 border ${variant}`}
    >
      <Clock size={13} strokeWidth={2.2} aria-hidden />
      {label}
    </span>
  );
}

/** Freigegebene Community-Preismeldungen (neueste zuerst, max. 2) – null wenn keine. */
export function CommunityBlock({
  reports,
  className = "",
}: {
  reports?: CommunityReport[];
  className?: string;
}) {
  if (!reports || reports.length === 0) return null;
  return (
    <div
      className={`flex flex-col gap-1 text-[0.75rem] ${className}`}
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
}
