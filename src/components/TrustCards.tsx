import { formatEuro } from "../lib/offers";
import { WRAP } from "../utils/helper";
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
    <section className={`${WRAP} mt-9`} aria-label="Von der Community">
      <div className="grid gap-4 grid-cols-2 max-[560px]:grid-cols-1">
        {showFund && fund && (
          <div className="glass-card rounded-card p-5 shadow-card">
            <div className="text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-accent-strong">
              🏷 Community-Fund
            </div>
            <p className="mt-2 font-semibold text-ink leading-snug">
              {fund.note ? `„${fund.note}"` : `${formatEuro(fund.price)} bei ${fund.market}`}
            </p>
            <p className="mt-1 text-[0.85rem] text-muted">
              {fund.brand} {fund.title} · {formatEuro(fund.price)} bei {fund.market}
              {fund.storeLocation ? ` · ${fund.storeLocation}` : ""} · geprüft&nbsp;✓
            </p>
          </div>
        )}
        {showConfirmed && (
          <div className="glass-card rounded-card p-5 shadow-card">
            <div className="text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-good">
              ✅ Von der Community bestätigt
            </div>
            <div className="mt-1 font-mono text-[1.9rem] font-bold text-good tabular-nums leading-tight">
              {confirmed.toLocaleString("de-DE")}×
            </div>
            <p className="text-[0.85rem] text-muted">
              Preise diese Woche von Leuten vor Ort bestätigt.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
