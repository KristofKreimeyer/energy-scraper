// Kleine, geteilte Helfer & Konstanten der Worker-API. Größere Themen liegen in
// entitlements.ts, referrals.ts, auth.ts und subscribe.ts.

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const now = () => new Date().toISOString()

/** Zielpreis + Metrik aus dem Body lesen. `invalid`, wenn ein Wert vorliegt, der nicht > 0 ist. */
export function parseTarget(body: { targetPrice?: number | string | null; targetMetric?: string }): {
  price: number | null
  metric: string | null
  invalid: boolean
} {
  if (body.targetPrice == null || body.targetPrice === '') return { price: null, metric: null, invalid: false }
  const p = Number(body.targetPrice)
  if (!Number.isFinite(p) || p <= 0) return { price: null, metric: null, invalid: true }
  return { price: Math.round(p * 100) / 100, metric: body.targetMetric === 'liter' ? 'liter' : 'unit', invalid: false }
}

/** SHA-256-Hex einer Zeichenkette (für IP-Hash: privatschonender als Klartext). */
export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export const REPORT_RATE_MAX = 5 // Meldungen pro IP und Stunde

export const clip = (s: unknown, max: number) =>
  String(s ?? '')
    .trim()
    .slice(0, max)

export const VOTE_RATE_MAX = 40 // Stimmen pro IP und Stunde

export const VOTE_WINDOW_DAYS = 10 // nur Stimmen der letzten Tage zählen (Wochenangebote)
