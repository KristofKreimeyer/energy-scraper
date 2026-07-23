/**
 * Zweck: Rückmeldung nach dem Stripe-Checkout. Stripe leitet auf
 *   /?pro=success bzw. /?pro=cancel zurück (siehe Worker /api/checkout).
 *   Bei Erfolg wird zusätzlich der lokale Merker auf Pro gesetzt, damit die
 *   „nur eine Marke"-Sperre sofort fällt.
 * Nutzung: <PayBanner /> ganz oben in der App rendern.
 */

import { useEffect, useState } from "react";
import { markPro } from "../lib/alarmState";

type Kind = "success" | "cancel" | null;

export function PayBanner() {
  // Query einmalig beim Mount auswerten (lazy init statt setState im Effect).
  const [kind, setKind] = useState<Kind>(() => {
    const pro = new URLSearchParams(window.location.search).get("pro");
    return pro === "success" || pro === "cancel" ? pro : null;
  });

  useEffect(() => {
    if (!kind) return;
    if (kind === "success") markPro();
    // Query wieder entfernen, damit ein Reload den Banner nicht erneut zeigt.
    const url = new URL(window.location.href);
    url.searchParams.delete("pro");
    window.history.replaceState({}, "", url.pathname + url.hash);
    // Nur beim Mount – kind ändert sich hier nicht mehr durch die Query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!kind) return null;
  const success = kind === "success";

  return (
    <div
      role="status"
      className={`${success ? "bg-good-tint text-good" : "bg-warn-tint text-warn-ink"} border-b border-border`}
    >
      <div className="mx-auto w-full max-w-[var(--maxw)] px-5 py-2.5 flex items-center gap-2 text-[0.86rem] font-semibold">
        <span aria-hidden="true">{success ? "✅" : "ℹ️"}</span>
        <span>
          {success
            ? "Pro ist freigeschaltet – danke für deine Unterstützung! Du kannst jetzt beliebig viele Marken und Preiswecker anlegen."
            : "Kauf abgebrochen – es wurde nichts berechnet."}
        </span>
        <button
          type="button"
          onClick={() => setKind(null)}
          aria-label="Schließen"
          className="ml-auto flex-none text-lg leading-none opacity-70 hover:opacity-100 cursor-pointer"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
