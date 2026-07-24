/**
 * Zweck: Anonyme, geräte-lokale Identität für Community-Votes.
 *   - voterId: stabile Zufalls-ID pro Browser (eine Stimme je Produkt & Gerät).
 *   - eigene Stimmen merken, um den Vote-Zustand in der UI anzuzeigen.
 * Kein Login; der Server bremst Missbrauch zusätzlich per IP-Hash-Rate-Limit.
 */

const VOTER_KEY = "energyhunt:voter-id";
const MYVOTES_KEY = "energyhunt:my-votes:v1";

export type VoteChoice = "up" | "down";

export function getVoterId(): string {
  try {
    let id = localStorage.getItem(VOTER_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(VOTER_KEY, id);
    }
    return id;
  } catch {
    // Kein Storage (privater Modus) – flüchtige ID; Stimme zählt trotzdem serverseitig.
    return "anon-" + Math.random().toString(36).slice(2);
  }
}

function readMyVotes(): Record<string, VoteChoice> {
  try {
    return JSON.parse(localStorage.getItem(MYVOTES_KEY) || "{}");
  } catch {
    return {};
  }
}

export function getMyVote(productKey: string): VoteChoice | null {
  return readMyVotes()[productKey] ?? null;
}

export function setMyVote(productKey: string, choice: VoteChoice) {
  try {
    const all = readMyVotes();
    all[productKey] = choice;
    localStorage.setItem(MYVOTES_KEY, JSON.stringify(all));
  } catch {
    /* Storage nicht verfügbar – Anzeige-Zustand entfällt, Stimme bleibt gültig. */
  }
}
