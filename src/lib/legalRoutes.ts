/**
 * Zweck: Hash-Routing-Helfer für die rechtlichen Pflichtseiten – getrennt von
 *   der Komponente (Legal.tsx), damit React-Fast-Refresh sauber bleibt.
 */

import { useEffect, useState } from "react";

export const LEGAL_ROUTES = {
  "#/impressum": "Impressum",
  "#/datenschutz": "Datenschutzerklärung",
  "#/agb": "AGB",
  "#/widerruf": "Widerrufsbelehrung",
} as const;

export type LegalRoute = keyof typeof LEGAL_ROUTES;

export function isLegalRoute(hash: string): hash is LegalRoute {
  return hash in LEGAL_ROUTES;
}

/** Aktuelle location.hash-Route, reaktiv auf hashchange; scrollt bei Rechtsseiten nach oben. */
export function useHashRoute(): string {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const on = () => setHash(window.location.hash);
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  useEffect(() => {
    if (isLegalRoute(hash)) window.scrollTo({ top: 0 });
  }, [hash]);
  return hash;
}
