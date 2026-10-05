/**
 * Zweck: Anonyme, geräte-lokale Identität für Community-Votes.
 *   - voterId: stabile Zufalls-ID pro Browser (eine Stimme je Produkt & Gerät).
 *   - eigene Stimmen merken, um den Vote-Zustand in der UI anzuzeigen.
 * Kein Login; der Server bremst Missbrauch zusätzlich per IP-Hash-Rate-Limit.
 */

import { storage } from './storage'

const VOTER_KEY = 'energyhunt:voter-id'
const MYVOTES_KEY = 'energyhunt:my-votes:v1'

export type VoteChoice = 'up' | 'down'

export function getVoterId(): string {
  let id = storage.get(VOTER_KEY)
  if (!id) {
    id = crypto.randomUUID()
    storage.set(VOTER_KEY, id)
  }
  // Ohne Storage (privater Modus) liefert jeder Aufruf eine neue flüchtige ID;
  // die Stimme zählt serverseitig trotzdem (IP-Hash-Rate-Limit).
  return id
}

function readMyVotes(): Record<string, VoteChoice> {
  return storage.getJSON<Record<string, VoteChoice>>(MYVOTES_KEY, {})
}

export function getMyVote(productKey: string): VoteChoice | null {
  return readMyVotes()[productKey] ?? null
}

export function setMyVote(productKey: string, choice: VoteChoice) {
  const all = readMyVotes()
  all[productKey] = choice
  storage.setJSON(MYVOTES_KEY, all)
}
