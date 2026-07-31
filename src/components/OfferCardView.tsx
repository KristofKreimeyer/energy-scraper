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
  /** Reihen-Nachbar (md+) hat eine Sorten-Zeile → Höhe reservieren, falls diese Karte keine hat. */
  rowHasVariant?: boolean;
  reports?: CommunityReport[];
  votes?: VoteTally;
}

// Kachelansicht eines Angebots.
export function OfferCardView({
  offer,
  isBest,
  rowHasVariant = false,
  reports,
  votes,
}: Props) {
  const saved = savings(offer);
  const extraVariants = offer.variantCount - 1;
  const isMulti = offer.unitCount > 1;
  const alt = `${offer.brand} ${offer.title}, Angebot bei ${offer.supermarket}`;

  return (
    <li className="flex">
      <article
        className={`offer-card glass-card group relative flex flex-col h-full w-full rounded-card overflow-hidden shadow-card p-[18px] transition-[transform,border-color] duration-150 hover:-translate-y-[3px] hover:border-border-strong focus-within:border-focus ${
          isBest
            ? "border-[color-mix(in_srgb,var(--good)_45%,var(--border))]"
            : ""
        }`}
        aria-label={alt}
      >
        <div className="flex flex-col gap-1 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <BrandLine offer={offer} />
            <BestTag isBest={isBest} />
            <FavButton offer={offer} />
          </div>
          <h3 className="text-base leading-[1.25] tracking-[-0.01em]">
            {offer.title}
          </h3>
          {extraVariants > 0 && (
            <span
              className="self-start mt-[5px] text-[0.76rem] text-muted cursor-default"
              title={offer.variantTitles.join(", ")}
              aria-label={`${offer.variantCount} Sorten zum gleichen Preis: ${offer.variantTitles.join(", ")}`}
            >
              {offer.variantCount} Sorten · gleicher Preis
            </span>
          )}
          {extraVariants <= 0 && rowHasVariant && (
            // Platzhalter reserviert die Höhe der „X Sorten"-Zeile, wenn
            // irgendein Angebot der Liste eine hat – so fluchten die Preisblöcke
            // reihenweise (2- und 3-Spalter). Erst ab md, mobil (1 Spalte) unnötig.
            <span
              className="hidden md:block self-start mt-[5px] text-[0.76rem]"
              aria-hidden="true"
            >
              {" "}
            </span>
          )}

          {/* Preis-Hierarchie: €/L ist der Vergleichs-Held (groß + Akzent),
              der Stückpreis („was du zahlst") steht bewusst sekundär daneben. */}
          <div className="flex items-baseline gap-3.5 pt-3">
            <span className="flex flex-col gap-px flex-none min-w-0">
              <span className="font-mono text-[1.1rem] font-semibold tracking-[-0.02em] tabular-nums text-muted whitespace-nowrap">
                {formatEuro(offer.perUnit)}
              </span>
              <span className="font-mono text-[0.66rem] tracking-[0.06em] uppercase text-muted whitespace-nowrap overflow-hidden text-ellipsis max-w-full">
                {isMulti ? "je Dose" : offer.unitLabel}
              </span>
            </span>
            <span className="flex flex-col gap-px flex-1 min-w-0 items-end text-right">
              {offer.perLiter != null ? (
                <>
                  <span
                    className={`font-mono text-[1.7rem] font-bold tracking-[-0.02em] tabular-nums whitespace-nowrap ${
                      isBest ? "text-good" : "text-accent-strong"
                    }`}
                  >
                    {formatEuro(offer.perLiter)}
                    <span className="text-[1rem] text-muted font-bold">/L</span>
                  </span>
                  <span className="font-mono text-[0.66rem] tracking-[0.06em] uppercase text-muted whitespace-nowrap overflow-hidden text-ellipsis max-w-full">
                    Grundpreis · Vergleichswert
                  </span>
                </>
              ) : (
                <>
                  <span
                    className="font-mono text-[1.7rem] font-bold tabular-nums text-ink"
                    aria-label="unbekannt"
                  >
                    —
                  </span>
                  <span className="font-mono text-[0.66rem] tracking-[0.06em] uppercase text-muted">
                    Grundpreis
                  </span>
                </>
              )}
            </span>
          </div>
          {isMulti && (
            <p className="mt-2 font-mono text-[0.74rem] tabular-nums text-muted">
              {offer.unitLabel} · {formatEuro(offer.price)} gesamt
            </p>
          )}

          {offer.requiresApp && offer.appPrice != null && (
            <p className="flex items-center gap-2 mt-2.5 text-[0.8rem]">
              <span className="flex-none font-semibold text-accent-strong bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] border border-[color-mix(in_srgb,var(--accent)_30%,transparent)] rounded-[7px] px-2 py-[3px]">
                <span aria-hidden="true">📱</span> mit App
              </span>
              <span className="text-muted font-mono tabular-nums">
                <span aria-hidden="true">
                  {formatEuro(offer.appPrice)}
                  {offer.appPerLiter != null
                    ? ` · ${formatEuro(offer.appPerLiter)}/L`
                    : ""}
                </span>
                <span className="visually-hidden">
                  Mit Kundenkarte oder App {formatEuro(offer.appPrice)}
                  {offer.appPerLiter != null
                    ? `, ${formatEuro(offer.appPerLiter)} pro Liter`
                    : ""}
                  . Der angezeigte Preis gilt ohne App.
                </span>
              </span>
            </p>
          )}

          {saved && (
            <p className="flex items-center gap-2 mt-2.5 text-[0.8rem]">
              <span className="flex-none font-mono font-bold tabular-nums text-good bg-good-tint border border-[color-mix(in_srgb,var(--good)_30%,transparent)] rounded-[7px] px-2 py-[3px]">
                <span aria-hidden="true">−{saved.percent}&nbsp;%</span>
                <span className="visually-hidden">
                  {saved.percent} Prozent gespart
                </span>
              </span>
              <span className="text-muted font-mono tabular-nums">
                <span className="visually-hidden">
                  Sie sparen {formatEuro(saved.amount)} gegenüber vorher{" "}
                  {formatEuro(offer.oldPrice!)}
                </span>
                <span aria-hidden="true">
                  {formatEuro(saved.amount)} gespart ·{" "}
                  <s className="text-muted">{formatEuro(offer.oldPrice!)}</s>
                </span>
              </span>
            </p>
          )}

          <InsightBlock offer={offer} className="mt-2.5" />
          <CommunityBlock reports={reports} className="mt-2.5" />

          {/* Dehnt sich: fehlende App-/Rabatt-Zeilen erzeugen den Leerraum HIER,
              damit Gültigkeits-Badge, Aktionen und CTA kartenübergreifend bündig
              am unteren Rand sitzen. */}
          <div className="flex-1" aria-hidden="true" />

          <div className="mt-3">
            <ValidBadge offer={offer} />
          </div>

          <div className="mt-3">
            <CardActions offer={offer} votes={votes} />
          </div>

          {offer.url && (
            <a
              data-cta=""
              className="mt-3 pt-3 border-t border-border text-accent-strong text-[0.84rem] font-[650] no-underline inline-flex items-center gap-1.5 after:content-[''] after:absolute after:inset-0 after:rounded-card group-hover:text-accent focus-visible:outline-none"
              href={offer.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Angebot ansehen: ${alt} (öffnet in neuem Tab)`}
            >
              Deal sichern bei {offer.market}
              <ArrowRight
                size={15}
                strokeWidth={2.4}
                aria-hidden
                className="transition-transform duration-150 group-hover:translate-x-[3px]"
              />
            </a>
          )}
        </div>
      </article>
    </li>
  );
}
