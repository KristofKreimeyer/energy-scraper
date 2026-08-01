/**
 * Zweck: Rechtliche Pflichtseiten (Impressum, Datenschutz, AGB,
 *   Widerrufsbelehrung inkl. Muster-Widerrufsformular) als leichte Hash-Routen
 *   – ohne zusätzliche Router-Dependency. Der eigentliche Text liegt je Seite
 *   in ./legal/*; hier nur Routing-Map + Seitenrahmen.
 * Nutzung: useHashRoute() liefert die aktuelle Route; <LegalPage> rendert den
 *   passenden Text. Verlinkt wird über href="#/impressum" usw.
 *
 * WICHTIG: Ausgefüllt für den Betreiber (Einzelunternehmen, Kleinunternehmer
 * § 19 UStG), aber NICHT anwaltlich geprüft. Vor dem endgültigen Live-Gang
 * (echte Zahlungen) sollte ein Gegencheck erfolgen; die „Einzelunternehmen"-/
 * Gewerbeamt-Angaben setzen eine erfolgte Gewerbeanmeldung voraus.
 */

import type { ReactElement } from "react";
import { LEGAL_ROUTES, type LegalRoute } from "../lib/legalRoutes";
import { Impressum } from "./legal/Impressum";
import { Datenschutz } from "./legal/Datenschutz";
import { AGB } from "./legal/Agb";
import { Widerruf } from "./legal/Widerruf";

const WRAP = "mx-auto w-full max-w-[760px] px-5";

const CONTENT: Record<LegalRoute, () => ReactElement> = {
  "#/impressum": Impressum,
  "#/datenschutz": Datenschutz,
  "#/agb": AGB,
  "#/widerruf": Widerruf,
};

export function LegalPage({ route }: { route: LegalRoute }) {
  const Body = CONTENT[route];
  return (
    <main id="main" className="py-8">
      <div className={WRAP}>
        <a
          href="#"
          className="inline-flex items-center gap-1.5 text-[0.85rem] font-semibold text-accent-strong hover:text-accent mb-4"
        >
          <span aria-hidden="true">←</span> Zurück zur Übersicht
        </a>
        <h1 className="text-[1.7rem] font-bold text-ink tracking-[-0.02em] mb-1">
          {LEGAL_ROUTES[route]}
        </h1>
        <Body />
      </div>
    </main>
  );
}
