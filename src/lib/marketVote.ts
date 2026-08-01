import { getVoterId } from "../utils/community";
import { API_BASE } from "./api";

// Community-Roadmap-Voting: „Welchen Markt als Nächstes scrapen?". Anonym,
// eine Stimme je Browser (Voter-ID). Der lokale Merker spiegelt nur die eigene
// Wahl fürs UI – gezählt wird serverseitig.

const MY_KEY = "energyhunt:my-market-vote";

// Muss mit der Worker-Whitelist (MARKET_CANDIDATES) übereinstimmen.
export const MARKET_CANDIDATES = [
  "Edeka",
  "Norma",
  "Trinkgut",
  "Getränke Hoffmann",
  "Marktkauf",
  "Müller",
];

export function getMyMarketVote(): string | null {
  try {
    return localStorage.getItem(MY_KEY);
  } catch {
    return null;
  }
}

export async function voteMarket(market: string): Promise<void> {
  try {
    localStorage.setItem(MY_KEY, market);
  } catch {
    /* Storage nicht verfügbar – Stimme zählt serverseitig trotzdem. */
  }
  await fetch(`${API_BASE}/api/market-vote`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ market, voterId: getVoterId() }),
  }).catch(() => undefined);
}
