import { useState } from "react";
import { WRAP } from "../lib/layout";
import { PushError } from "../lib/push";
import { pushSupported, isWeeklyOn, enableWeekly, disableWeekly } from "../lib/weeklyPush";

// „Neue Woche"-Erinnerung: eigener Push-Opt-in, meldet sich einmal wöchentlich,
// sobald frische Deals live sind. Blendet sich aus, wo Push nicht unterstützt
// wird (z. B. iOS-Safari im Browser-Tab).

export default function WeeklyReminder() {
  const [on, setOn] = useState(isWeeklyOn);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  if (!pushSupported()) return null;

  async function toggle() {
    setBusy(true);
    setMsg(null);
    try {
      if (on) {
        await disableWeekly();
        setOn(false);
        setMsg({ ok: true, text: "Erinnerung deaktiviert." });
      } else {
        await enableWeekly();
        setOn(true);
        setMsg({ ok: true, text: "Aktiv – wir melden uns, sobald neue Deals da sind." });
      }
    } catch (err) {
      setMsg({
        ok: false,
        text: err instanceof PushError ? err.message : "Das hat nicht geklappt.",
      });
    }
    setBusy(false);
  }

  return (
    <section className={`${WRAP} mt-16`} aria-labelledby="weekly-title">
      <div className="glass-card rounded-card p-6 shadow-card flex items-center gap-4 flex-wrap">
        <span aria-hidden="true" className="text-[1.4rem]">
          🔔
        </span>
        <div className="flex-1 min-w-[12.5rem]">
          <h2 id="weekly-title" className="text-[1.6rem] text-ink leading-tight">
            Neue Woche, neue Deals?
          </h2>
          <p className="mt-2 text-[1rem] text-muted">Eine Push pro Woche, sobald die frischen Angebote live sind – ohne Marke, ohne Konto.</p>
          {msg && (
            <p className={`mt-2 text-[1rem] ${msg.ok ? "text-good" : "text-warn-ink"}`} role="status">
              {msg.text}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={toggle}
          disabled={busy}
          aria-pressed={on}
          className={`flex-none h-10 px-4 rounded-lg text-[1rem] font-semibold cursor-pointer transition-colors duration-150 disabled:opacity-60 ${
            on ? "bg-surface text-ink border border-border-strong hover:bg-surface-2" : "bg-fill text-on-fill hover:opacity-90"
          }`}
        >
          {busy ? "…" : on ? "Erinnerung aus" : "Wöchentlich erinnern"}
        </button>
      </div>
    </section>
  );
}
