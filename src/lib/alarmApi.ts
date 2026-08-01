import { subscribeToPush, PushError } from "./push";
import { markPro } from "./alarmState";

// Geteilte Alarm-/Pro-API für AlarmButton und AlarmCreator: Stripe-Checkout und
// Pro-Code-Einlösung. Der eigentliche subscribe-Call bleibt je Komponente
// (Produkt- vs. Marken-Payload unterscheiden sich).

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8787";

export type Channel = "email" | "telegram" | "push";

// Pro-Pläne (Anzeige-Preise = Marketing-Copy; echter Betrag kommt aus der
// jeweiligen Stripe-Price-ID). „yearly" ist hervorgehoben.
export const PLANS = [
  { plan: "monthly", price: "1,99 €", period: "pro Monat" },
  { plan: "yearly", price: "9,99 €", period: "pro Jahr", badge: "spart 58 %", highlight: true },
  { plan: "lifetime", price: "24,99 €", period: "einmalig, für immer" },
] as const;

export type Plan = (typeof PLANS)[number]["plan"];

/** Startet den Stripe-Checkout und leitet bei Erfolg direkt weiter. Gibt sonst
 *  eine Fehlermeldung zurück (null = Weiterleitung läuft). */
export async function startCheckout(email: string, plan: Plan): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/api/checkout`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, plan }),
    });
    const data = (await res.json()) as { url?: string; message?: string };
    if (res.ok && data.url) {
      window.location.assign(data.url);
      return null;
    }
    return data.message ?? "Kauf konnte nicht gestartet werden.";
  } catch {
    return "Keine Verbindung zum Alarm-Dienst.";
  }
}

/** Löst einen Pro-Code ein. Für den Push-Kanal wird intern die Subscription
 *  geholt; bei Erfolg wird markPro() gesetzt. Gibt {ok, message} zurück. */
export async function redeemProCode(opts: {
  code: string;
  channel: Channel;
  email?: string;
}): Promise<{ ok: boolean; message: string }> {
  let payload: Record<string, unknown>;
  if (opts.channel === "push") {
    try {
      payload = { code: opts.code, channel: "push", subscription: await subscribeToPush() };
    } catch (err) {
      return {
        ok: false,
        message: err instanceof PushError ? err.message : "Push-Anmeldung fehlgeschlagen.",
      };
    }
  } else {
    payload = { code: opts.code, channel: "email", email: opts.email };
  }
  try {
    const res = await fetch(`${API_BASE}/api/redeem`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await res.json()) as { message?: string };
    if (res.ok) {
      markPro(); // Sperre „nur eine Marke" aufheben
      return { ok: true, message: data.message ?? "Pro freigeschaltet." };
    }
    return { ok: false, message: data.message ?? "Code ungültig." };
  } catch {
    return { ok: false, message: "Keine Verbindung zum Alarm-Dienst." };
  }
}
