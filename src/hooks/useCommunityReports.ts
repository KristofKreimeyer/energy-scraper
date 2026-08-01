import { useApiData } from "./useApiData";

// Lädt die freigegebenen Community-Preismeldungen (einmal beim Mount) und gibt
// sie gruppiert nach productKey zurück, damit die OfferCard sie anzeigen kann.

export interface CommunityReport {
  price: number;
  market: string;
  storeLocation: string | null;
  note: string | null;
  createdAt: string;
}

export type ReportsByProduct = Record<string, CommunityReport[]>;

const selectReports = (j: unknown) => (j as { reports?: ReportsByProduct }).reports;

export function useCommunityReports(): ReportsByProduct {
  return useApiData<ReportsByProduct>("/api/reports/approved", {}, selectReports);
}
