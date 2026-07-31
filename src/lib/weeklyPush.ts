import { subscribeToPush, PushError } from "./push";

// Wöchentliche Deal-Erinnerung (Broadcast-Push), eigener Opt-in getrennt von
// Marken-Alarmen. Der lokale Merker spiegelt nur die letzte Aktion dieses
// Geräts – die Wahrheit steht in D1 (scope='weekly').

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8787";
const KEY = "energyhunt:weekly-push";

export function pushSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    typeof window !== "undefined" &&
    "PushManager" in window
  );
}

export function isWeeklyOn(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export async function enableWeekly(): Promise<void> {
  const sub = await subscribeToPush(); // SW registrieren + Erlaubnis + Abo
  const res = await fetch(`${API_BASE}/api/weekly/subscribe`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ subscription: sub }),
  });
  if (!res.ok) throw new PushError("Die Erinnerung konnte nicht aktiviert werden.");
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    /* egal */
  }
}

export async function disableWeekly(): Promise<void> {
  let endpoint: string | undefined;
  try {
    const reg = await navigator.serviceWorker.ready;
    const s = await reg.pushManager.getSubscription();
    endpoint = s?.endpoint;
  } catch {
    /* kein Abo auffindbar – Merker trotzdem löschen */
  }
  if (endpoint) {
    await fetch(`${API_BASE}/api/weekly/unsubscribe`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ subscription: { endpoint } }),
    }).catch(() => undefined);
  }
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* egal */
  }
}
