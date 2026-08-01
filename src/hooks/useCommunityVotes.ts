import { useApiData } from "./useApiData";

// Lädt die aggregierten Verfügbarkeits-Votes (einmal beim Mount), gruppiert nach
// productKey, für die Anzeige auf der OfferCard.

export interface VoteTally {
  up: number;
  down: number;
}

export type VotesByProduct = Record<string, VoteTally>;

const selectVotes = (j: unknown) => (j as { votes?: VotesByProduct }).votes;

export function useCommunityVotes(): VotesByProduct {
  return useApiData<VotesByProduct>("/api/votes", {}, selectVotes);
}
