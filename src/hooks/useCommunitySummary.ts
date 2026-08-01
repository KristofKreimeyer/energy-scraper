import { useApiData } from "./useApiData";

// Community-Zusammenfassung für die Vertrauens-Karten der Startseite.
// confirmed = Anzahl „noch verfügbar"-Bestätigungen im Fenster; fund = jüngster
// freigegebener Community-Fund (oder null). Beides optional – die UI blendet
// aus, was leer ist.

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

const selectSummary = (j: unknown) => j as CommunitySummary;

export function useCommunitySummary(): CommunitySummary {
  return useApiData<CommunitySummary>(
    "/api/community/summary",
    { confirmed: 0, fund: null },
    selectSummary,
  );
}
