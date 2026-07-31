import { formatEuro, savings, type GroupedOffer } from "../lib/offers";
import { CardActions } from "./CardActions";
import {
  BrandLine,
  BestTag,
  FavButton,
  InsightBlock,
  ValidBadge,
  CommunityBlock,
} from "./offerParts";
import { ArrowRight } from "lucide-react";
import type { CommunityReport } from "../hooks/useCommunityReports";
import type { VoteTally } from "../hooks/useCommunityVotes";

interface Props {
  offer: GroupedOffer;
  isBest: boolean;
  reports?: CommunityReport[];
  votes?: VoteTally;
}

// Listenansicht: kompakte horizontale Zeile je Angebot.
export function OfferListView({ offer, isBest, reports, votes }: Props) {
  const saved = savings(offer);
  const isMulti = offer.unitCount > 1;
  const alt = `${offer.brand} ${offer.title}, Angebot bei ${offer.supermarket}`;

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
              <BrandLine offer={offer} />
              <BestTag isBest={isBest} />
              <FavButton offer={offer} />
            </div>
            <h3 className="text-[0.95rem] leading-tight truncate mt-0.5">
              {offer.title}
            </h3>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <ValidBadge offer={offer} />
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
              {offer.perLiter != null ? `${formatEuro(offer.perLiter)}/L` : "—"}
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
          <InsightBlock offer={offer} />
          <CommunityBlock reports={reports} />
          <CardActions offer={offer} votes={votes} />
        </div>
      </article>
    </li>
  );
}
