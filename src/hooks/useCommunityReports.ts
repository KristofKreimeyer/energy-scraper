import { useEffect, useState } from "react";

// Lädt die freigegebenen Community-Preismeldungen (einmal beim Mount) und gibt
// sie gruppiert nach productKey zurück, damit die OfferCard sie anzeigen kann.

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8787";

export interface CommunityReport {
  price: number;
  market: string;
  storeLocation: string | null;
  note: string | null;
  createdAt: string;
}

export type ReportsByProduct = Record<string, CommunityReport[]>;

export function useCommunityReports(): ReportsByProduct {
  const [reports, setReports] = useState<ReportsByProduct>({});
  useEffect(() => {
    let alive = true;
    fetch(`${API_BASE}/api/reports/approved`)
      .then((r) => (r.ok ? r.json() : { reports: {} }))
      .then((data: { reports?: ReportsByProduct }) => {
        if (alive && data.reports) setReports(data.reports);
      })
      .catch(() => {
        /* Community-Hinweise sind optionales Beiwerk – Fehler still schlucken. */
      });
    return () => {
      alive = false;
    };
  }, []);
  return reports;
}
