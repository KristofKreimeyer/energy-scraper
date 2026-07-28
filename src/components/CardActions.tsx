import { useState } from "react";
import { formatEuro, type GroupedOffer } from "../lib/offers";
import { AvailabilityVote } from "./AvailabilityVote";
import { AlarmButton } from "./AlarmButton";
import { ReportPriceButton } from "./ReportPriceButton";
import { ShareButton } from "./ShareButton";
import type { VoteTally } from "../hooks/useCommunityVotes";

// Aufgeräumte Aktionszone der OfferCard: der 🔥/👎-Vote plus eine kompakte
// Icon-Leiste (Alarm · Günstiger? · Teilen). Alarm/Melden klappen ihr Formular
// darunter auf – nur eines gleichzeitig, gesteuert von hier.

const BellIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M13.7 21a2 2 0 01-3.4 0" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const TagIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M20.6 13.4l-7.2 7.2a2 2 0 01-2.8 0l-7.2-7.2a2 2 0 01-.6-1.4V4a1 1 0 011-1h8a2 2 0 011.4.6l7.4 7.4a2 2 0 010 2.8z" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="7.5" cy="7.5" r="1.5" fill="currentColor" stroke="none" />
  </svg>
);
const ShareIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" strokeLinecap="round" />
  </svg>
);

// Sanftes Auf-/Zuklappen ohne Animations-Lib: grid-template-rows 0fr↔1fr
// animiert die Höhe, der Inhalt bleibt für die Schließ-Animation gemountet.
function Collapse({ open, children }: { open: boolean; children: React.ReactNode }) {
  return (
    <div
      className="grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none"
      style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
    >
      <div
        className={`overflow-hidden min-h-0 transition-opacity duration-300 motion-reduce:transition-none ${
          open ? "opacity-100" : "opacity-0"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

export function CardActions({ offer, votes }: { offer: GroupedOffer; votes?: VoteTally }) {
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

  const shareUrl = typeof window !== "undefined" ? window.location.origin + "/" : "https://energyhunt.pages.dev/";
  const perLiter = offer.perLiter != null ? ` (${formatEuro(offer.perLiter)}/L)` : "";
  const shareText = `${offer.brand} ${offer.title} bei ${offer.market} für ${formatEuro(offer.perUnit)}${perLiter} – gefunden auf EnergyHunt`;

  const chip = (active: boolean) =>
    `inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md border text-[0.76rem] font-semibold cursor-pointer transition-colors duration-150 ${
      active ? "bg-accent text-white border-accent" : "bg-surface text-muted border-border-strong hover:text-ink"
    }`;

  return (
    <div className="relative z-10" onClick={(e) => e.stopPropagation()}>
      <div className="flex flex-col gap-2.5">
        <AvailabilityVote offer={offer} tally={votes} />

        <div className="flex items-center gap-1.5 flex-wrap">
          <button type="button" className={chip(panel === "alarm")} aria-expanded={panel === "alarm"} onClick={() => toggle("alarm")}>
            <BellIcon />
            Alarm
          </button>
          <button type="button" className={chip(panel === "report")} aria-expanded={panel === "report"} onClick={() => toggle("report")}>
            <TagIcon />
            Günstiger?
          </button>
          <ShareButton text={shareText} url={shareUrl} ariaLabel={`${offer.brand} ${offer.title} teilen`} className={chip(false)}>
            <ShareIcon />
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
          <ReportPriceButton offer={offer} embedded onClose={() => setPanel(null)} />
        </Collapse>
      )}
    </div>
  );
}
