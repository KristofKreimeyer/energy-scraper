import { useEffect, useState } from "react";

// Lädt die aggregierten Verfügbarkeits-Votes (einmal beim Mount), gruppiert nach
// productKey, für die Anzeige auf der OfferCard.

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8787";

export interface VoteTally {
  up: number;
  down: number;
}

export type VotesByProduct = Record<string, VoteTally>;

export function useCommunityVotes(): VotesByProduct {
  const [votes, setVotes] = useState<VotesByProduct>({});
  useEffect(() => {
    let alive = true;
    fetch(`${API_BASE}/api/votes`)
      .then((r) => (r.ok ? r.json() : { votes: {} }))
      .then((data: { votes?: VotesByProduct }) => {
        if (alive && data.votes) setVotes(data.votes);
      })
      .catch(() => {
        /* Optionales Signal – Fehler still schlucken. */
      });
    return () => {
      alive = false;
    };
  }, []);
  return votes;
}
