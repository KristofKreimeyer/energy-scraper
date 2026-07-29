import { useEffect, useState } from "react";

// Community-Zusammenfassung für die Vertrauens-Karten der Startseite.
// confirmed = Anzahl „noch verfügbar"-Bestätigungen im Fenster; fund = jüngster
// freigegebener Community-Fund (oder null). Beides optional – die UI blendet
// aus, was leer ist.

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8787";

export interface CommunityFund {
  brand: string;
  title: string;
  market: string;
  price: number;
  storeLocation: string | null;
  note: string | null;
}

export interface CommunitySummary {
  confirmed: number;
  fund: CommunityFund | null;
}

export function useCommunitySummary(): CommunitySummary {
  const [summary, setSummary] = useState<CommunitySummary>({ confirmed: 0, fund: null });
  useEffect(() => {
    let alive = true;
    fetch(`${API_BASE}/api/community/summary`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: CommunitySummary | null) => {
        if (alive && data) setSummary(data);
      })
      .catch(() => {
        /* optionales Beiwerk – Fehler still schlucken */
      });
    return () => {
      alive = false;
    };
  }, []);
  return summary;
}
