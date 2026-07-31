import { useEffect, useState } from "react";
import { WRAP } from "../utils/helper";
import { useAuth } from "../auth/AuthContext";
import { fetchReferral, type ReferralInfo } from "../lib/referral";
import { ShareButton } from "./ShareButton";

// „Freunde einladen": zweiseitiger Referral. Beide bekommen 1 Monat Pro, sobald
// der Eingeladene seinen ersten E-Mail-Alarm bestätigt. Braucht ein Konto (der
// Link hängt an der E-Mail) – ohne Login zeigt die Karte einen Login-Anstoß.

const ShareIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" strokeLinecap="round" />
  </svg>
);

export default function ReferralCard() {
  const { user, ready } = useAuth();
  const [info, setInfo] = useState<ReferralInfo | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    fetchReferral().then((r) => {
      if (alive) setInfo(r);
    });
    return () => {
      alive = false;
    };
  }, [user]);

  if (!ready) return null;

  const wrap = (children: React.ReactNode) => (
    <section className={`${WRAP} mt-9`} aria-labelledby="referral-title">
      <div className="rounded-card p-6 border border-[color-mix(in_srgb,var(--accent-strong)_35%,transparent)] bg-accent-tint">
        {children}
      </div>
    </section>
  );

  // Nicht angemeldet → Login-Anstoß (der Link braucht die Konto-E-Mail).
  if (!user) {
    return wrap(
      <div className="flex items-center gap-4 flex-wrap">
        <span aria-hidden="true" className="text-[1.4rem]">🎁</span>
        <div className="flex-1 min-w-[200px]">
          <h2 id="referral-title" className="font-bold text-ink leading-snug">
            Freunde einladen, Pro gratis
          </h2>
          <p className="text-[0.85rem] text-muted">
            Lade Freunde ein – sobald sie ihren ersten Alarm bestätigen,
            bekommt ihr <b className="text-ink">beide 1 Monat Pro</b>.
          </p>
        </div>
        <button
          type="button"
          onClick={() => document.getElementById("account-trigger")?.click()}
          className="flex-none h-10 px-4 rounded-lg bg-fill text-on-fill text-[0.85rem] font-semibold cursor-pointer hover:opacity-90"
        >
          Anmelden &amp; einladen
        </button>
      </div>,
    );
  }

  const url = info?.url ?? "";
  const shareText =
    "Ich spare bei Energy-Drinks mit EnergyHunt – über meinen Link bekommst du 1 Monat Pro gratis:";

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* Clipboard nicht verfügbar */
    }
  }

  return wrap(
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 flex-wrap">
        <span aria-hidden="true" className="text-[1.4rem]">🎁</span>
        <div className="flex-1 min-w-[200px]">
          <h2 id="referral-title" className="font-bold text-ink leading-snug">
            Freunde einladen, Pro gratis
          </h2>
          <p className="text-[0.85rem] text-muted">
            Ihr bekommt <b className="text-ink">beide 1 Monat Pro</b>, sobald ein
            eingeladener Freund seinen ersten Alarm bestätigt.
          </p>
        </div>
        {info && (
          <span className="flex-none text-[0.8rem] font-semibold text-accent-strong">
            {info.rewarded} geworben
            {info.pending > 0 ? ` · ${info.pending} offen` : ""}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <input
          type="text"
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          aria-label="Dein Einladungslink"
          className="flex-1 min-w-[200px] h-10 px-3 text-[0.82rem] font-mono bg-surface text-ink border border-border-strong rounded-lg outline-none"
        />
        <button
          type="button"
          onClick={copy}
          disabled={!url}
          className="flex-none h-10 px-4 rounded-lg bg-surface text-ink border border-border-strong text-[0.82rem] font-semibold cursor-pointer hover:bg-surface-2 disabled:opacity-60"
        >
          {copied ? "Kopiert ✓" : "Link kopieren"}
        </button>
        {url && (
          <ShareButton
            text={shareText}
            url={url}
            ariaLabel="Einladungslink teilen"
            className="flex-none h-10 px-4 inline-flex items-center gap-1.5 rounded-lg bg-fill text-on-fill text-[0.82rem] font-semibold cursor-pointer hover:opacity-90"
          >
            <ShareIcon />
            Teilen
          </ShareButton>
        )}
      </div>
    </div>,
  );
}
