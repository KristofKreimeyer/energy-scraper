import { useState } from "react";
import { formatEuro, type GroupedOffer } from "../lib/offers";
import { AvailabilityVote } from "./AvailabilityVote";
import { AlarmButton } from "./AlarmButton";
import { ReportPriceButton } from "./ReportPriceButton";
import { ShareButton } from "./ShareButton";
import { Bell, Tag, Share2 } from "lucide-react";
import type { VoteTally } from "../hooks/useCommunityVotes";

// Aktionszone der OfferCard – bewusst leises Gewicht (Karten-Dichte), aber
// alles immer sichtbar (kein Mystery-Toggle): der 🔥/👎-Vote inkl. „bestätigt"-
// Beweis, darunter eine Leiste randloser Ghost-Chips (Alarm · Günstiger
// gesehen? · Teilen) mit Klartext-Labels. Alarm/Melden klappen ihr Formular
// darunter auf – nur eines gleichzeitig, gesteuert von hier. Kein Hover-Gate,
// damit alles auf Touch-Geräten erreichbar bleibt.


// Sanftes Auf-/Zuklappen ohne Animations-Lib: grid-template-rows 0fr↔1fr
// animiert die Höhe, der Inhalt bleibt für die Schließ-Animation gemountet.
function Collapse({
  open,
  children,
}: {
  open: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className="grid transition-[grid-template-rows] duration-500 ease-out motion-reduce:transition-none"
      style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
    >
      <div
        className={`overflow-hidden min-h-0 transition-opacity duration-500 motion-reduce:transition-none ${
          open ? "opacity-100" : "opacity-0"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

export function CardActions({
  offer,
  votes,
}: {
  offer: GroupedOffer;
  votes?: VoteTally;
}) {
  const [panel, setPanel] = useState<null | "alarm" | "report">(null);
  // Einmal geöffnete Panels bleiben gemountet, damit auch das Schließen animiert.
  const [mounted, setMounted] = useState({ alarm: false, report: false });
  const toggle = (p: "alarm" | "report") => {
    if (panel === p) {
      setPanel(null); // schließen (bleibt gemountet -> animiert)
    } else if (mounted[p]) {
      setPanel(p); // schon gemountet (geschlossen) -> öffnet animiert
    } else {
      // Erstes Öffnen: geschlossen mounten, im nächsten Frame öffnen,
      // damit der 0fr->1fr-Übergang tatsächlich läuft.
      setMounted((m) => ({ ...m, [p]: true }));
      requestAnimationFrame(() => setPanel(p));
    }
  };

  const shareUrl =
    typeof window !== "undefined"
      ? window.location.origin + "/"
      : "https://energyhunt.pages.dev/";
  const perLiter =
    offer.perLiter != null ? ` (${formatEuro(offer.perLiter)}/L)` : "";
  const shareText = `${offer.brand} ${offer.title} bei ${offer.market} für ${formatEuro(offer.perUnit)}${perLiter} – gefunden auf EnergyHunt`;

  // Leise Ghost-Chips: randlos, gedämpft, klare Klartext-Labels. Aktiv oder
  // per Hover bekommen sie die Akzentfarbe. Bewusst leichter als der CTA –
  // das senkt das Gewicht (Dichte), ohne die Entdeckbarkeit zu opfern.
  const chip = (active: boolean) =>
    `inline-flex items-center gap-1 h-7 px-1.5 rounded-md text-[0.74rem] font-medium cursor-pointer transition-colors duration-150 ${
      active ? "text-accent-strong" : "text-muted hover:text-ink"
    }`;

  return (
    <div className="relative z-10" onClick={(e) => e.stopPropagation()}>
      <div className="flex flex-col gap-2">
        {/* Vote inkl. „bestätigt"-Beweis – bleibt immer sichtbar. */}
        <AvailabilityVote offer={offer} tally={votes} />

        {/* Immer sichtbare, leise Aktions-Leiste. */}
        <div className="flex items-center gap-0.5 flex-wrap -ml-0.5">
          <button
            type="button"
            className={chip(panel === "alarm")}
            aria-expanded={panel === "alarm"}
            onClick={() => toggle("alarm")}
          >
            <Bell size={13} strokeWidth={2} aria-hidden />
            Alarm
          </button>
          <button
            type="button"
            className={chip(panel === "report")}
            aria-expanded={panel === "report"}
            onClick={() => toggle("report")}
          >
            <Tag size={13} strokeWidth={2} aria-hidden />
            Günstiger gesehen?
          </button>
          <ShareButton
            text={shareText}
            url={shareUrl}
            ariaLabel={`${offer.brand} ${offer.title} teilen`}
            className={chip(false)}
          >
            <Share2 size={13} strokeWidth={2.2} aria-hidden />
            Teilen
          </ShareButton>
        </div>
      </div>

      {mounted.alarm && (
        <Collapse open={panel === "alarm"}>
          <AlarmButton offer={offer} embedded />
        </Collapse>
      )}
      {mounted.report && (
        <Collapse open={panel === "report"}>
          <ReportPriceButton
            offer={offer}
            embedded
            onClose={() => setPanel(null)}
          />
        </Collapse>
      )}
    </div>
  );
}
