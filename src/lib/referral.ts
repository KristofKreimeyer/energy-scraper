import { authHeader } from "../auth/session";

// Referral („Freunde einladen"): der Eingeladene kommt über /?ref=CODE. Wir
// merken den Code lokal und hängen ihn an die nächste Alarm-Anmeldung – belohnt
// wird zweiseitig erst bei E-Mail-Bestätigung (serverseitig).

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8787";
const REF_KEY = "energyhunt:ref";

/** ?ref=CODE aus der URL übernehmen und die URL wieder säubern. Beim Start rufen. */
export function captureRef() {
  try {
    const url = new URL(window.location.href);
    const ref = url.searchParams.get("ref");
    if (!ref) return;
    localStorage.setItem(REF_KEY, ref);
    url.searchParams.delete("ref");
    window.history.replaceState({}, "", url.pathname + url.search + url.hash);
  } catch {
    /* egal */
  }
}

export function getRef(): string | null {
  try {
    return localStorage.getItem(REF_KEY);
  } catch {
    return null;
  }
}

export interface ReferralInfo {
  code: string;
  url: string;
  rewarded: number;
  pending: number;
}

/** Referral-Link + Stand des eingeloggten Kontos (oder null, wenn nicht angemeldet). */
export async function fetchReferral(): Promise<ReferralInfo | null> {
  try {
    const res = await fetch(`${API_BASE}/api/referral/link`, { headers: authHeader() });
    if (!res.ok) return null;
    return (await res.json()) as ReferralInfo;
  } catch {
    return null;
  }
}
