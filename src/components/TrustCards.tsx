import { formatEuro } from "../lib/offers";
import { WRAP } from "../lib/layout";
import { useCommunitySummary } from "../hooks/useCommunitySummary";

// „Vorne nur Vertrauen": Community-Fund + Bestätigungs-Zähler. Zeigt sich nur,
// wenn echte Daten da sind – sonst nichts (kein toter „von 0"-Zustand).
const CONFIRM_THRESHOLD = 3;

export default function TrustCards() {
  const { confirmed, fund } = useCommunitySummary();
  const showConfirmed = confirmed >= CONFIRM_THRESHOLD;
  const showFund = !!fund;
  if (!showConfirmed && !showFund) return null;

  return (
    <section className={`${WRAP} mt-8`} aria-label="Von der Community">
      <div className="grid gap-4 grid-cols-2 max-[35rem]:grid-cols-1">
        {showFund && fund && (
          <div className="glass-card rounded-card p-6 shadow-card">
            <div className="text-[1rem] font-semibold uppercase tracking-[0.04em] text-muted">🏷 Community-Fund der Woche</div>
            <p className="mt-2 font-semibold text-ink leading-snug">
              {fund.note ? `„${fund.note}"` : `${formatEuro(fund.price)} bei ${fund.market}`}
            </p>
            <p className="mt-2 text-[1rem] text-muted">
              {fund.brand} {fund.title} · {formatEuro(fund.price)} bei {fund.market}
              {fund.storeLocation ? ` · ${fund.storeLocation}` : ""} · geprüft&nbsp;✓
            </p>
          </div>
        )}
        {showConfirmed && (
          <div className="glass-card rounded-card p-6 shadow-card">
            <div className="text-[1rem] font-semibold uppercase tracking-[0.04em] text-good">✅ Von der Community bestätigt</div>
            <div className="mt-2 font-mono text-[1.9rem] font-bold text-good tabular-nums leading-tight">
              {confirmed.toLocaleString("de-DE")}×
            </div>
            <p className="text-[1rem] text-muted">
              Preise diese Woche von Leuten vor Ort bestätigt.{" "}
              <button
                type="button"
                onClick={() => document.getElementById("account-trigger")?.click()}
                className="font-semibold text-accent-strong underline underline-offset-2 hover:text-accent"
              >
                Deine Beiträge &amp; dein Sparfuchs-Level gibt es im Konto&nbsp;→
              </button>
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
