import { getVoterId } from './voter'
import { storage } from './storage'
import { apiFetch } from './api'

// Community-Roadmap-Voting: „Welchen Markt als Nächstes scrapen?". Anonym,
// eine Stimme je Browser (Voter-ID). Der lokale Merker spiegelt nur die eigene
// Wahl fürs UI – gezählt wird serverseitig.

const MY_KEY = 'energyhunt:my-market-vote'

// Muss mit der Worker-Whitelist (MARKET_CANDIDATES) übereinstimmen.
export const MARKET_CANDIDATES = ['Edeka', 'Norma', 'Trinkgut', 'Getränke Hoffmann', 'Marktkauf', 'Müller']

export function getMyMarketVote(): string | null {
  return storage.get(MY_KEY)
}

export async function voteMarket(market: string): Promise<void> {
  storage.set(MY_KEY, market) // Stimme zählt serverseitig auch ohne Merker
  await apiFetch('/api/market-vote', { method: 'POST', body: { market, voterId: getVoterId() } }).catch(() => undefined)
}
