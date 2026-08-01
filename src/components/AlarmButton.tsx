import { useState } from "react";
import { productKey, type GroupedOffer } from "../lib/offers";
import { subscribeToPush, PushError } from "../lib/push";
import { useAlarmMemo, rememberAlarm, clearAlarmMemo, isBrandBlocked } from "../lib/alarmState";
import { startCheckout, redeemProCode, type Plan } from "../lib/alarmApi";
import ProPlans from "./ProPlans";
import { Bell } from "lucide-react";

// Basis-URL der Alarm-API (Cloudflare Worker). Lokal: wrangler dev auf :8787.
// Produktion: via VITE_API_BASE auf die deployte Worker-URL setzen.
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8787";

type Channel = "email" | "telegram" | "push";
type Metric = "unit" | "liter";

type State =
  | { kind: "idle" }
  | { kind: "open"; channel: Channel }
  | { kind: "submitting"; channel: Channel }
  | { kind: "pending"; message: string }
  | { kind: "done"; message: string }
  | { kind: "error"; channel: Channel; message: string };

interface SubscribeResponse {
  status?: string;
  message?: string;
  telegramLink?: string;
  error?: string;
}

export function AlarmButton({ offer, embedded = false }: { offer: GroupedOffer; embedded?: boolean }) {
  // Eingebettet (in der Karten-Aktionsleiste) startet das Formular direkt –
  // der eigene „idle“-Trigger entfällt, das Öffnen steuert die Leiste.
  const [state, setState] = useState<State>(embedded ? { kind: "open", channel: "email" } : { kind: "idle" });
  const [email, setEmail] = useState("");
  // Preiswecker (Pro)
  const [weckerOn, setWeckerOn] = useState(false);
  const [targetPrice, setTargetPrice] = useState("");
  const [targetMetric, setTargetMetric] = useState<Metric>("unit");
  // Pro freischalten (Kauf primär) + Code einlösen (sekundär)
  const [showRedeem, setShowRedeem] = useState(false);
  const [redeemCode, setRedeemCode] = useState("");
  const [redeemMsg, setRedeemMsg] = useState<string | null>(null);

  // Free-Tarif = eine Marke. Merker dieses Geräts (siehe lib/alarmState).
  const memo = useAlarmMemo();
  const blocked = isBrandBlocked(memo, offer.brand);
  const sameBrandActive = !!memo && !blocked && !!memo.brand;

  const label = `${offer.brand} ${offer.title} (${offer.market})`;
  const channel: Channel =
    state.kind === "open" || state.kind === "submitting" || state.kind === "error" ? state.channel : "email";

  async function subscribe(ch: Channel) {
    setState({ kind: "submitting", channel: ch });
    try {
      let extra: Record<string, unknown> = {};
      if (ch === "email") extra = { email };
      if (ch === "push") {
        try {
          extra = { subscription: await subscribeToPush() };
        } catch (err) {
          setState({ kind: "error", channel: ch, message: err instanceof PushError ? err.message : "Push-Anmeldung fehlgeschlagen." });
          return;
        }
      }
      // Preiswecker (Pro) für alle Kanäle mitschicken.
      if (weckerOn && targetPrice) extra = { ...extra, targetPrice, targetMetric };
      const res = await fetch(`${API_BASE}/api/subscribe`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ channel: ch, ...extra, productKey: productKey(offer), productLabel: label }),
      });
      const data = (await res.json()) as SubscribeResponse;
      if (!res.ok) {
        if (data.error === "pro_required") setShowRedeem(true); // Freischalten anbieten
        setState({ kind: "error", channel: ch, message: data.message ?? "Das hat nicht geklappt. Bitte später erneut versuchen." });
        return;
      }
      rememberAlarm(offer.brand, label, ch);
      if (ch === "telegram" && data.telegramLink) {
        window.open(data.telegramLink, "_blank", "noopener");
        setState({ kind: "pending", message: data.message ?? "Öffne Telegram und tippe auf „Start“." });
      } else if (data.status === "confirmed") {
        setState({ kind: "done", message: data.message ?? "Alarm bereits aktiv." });
      } else {
        setState({ kind: "pending", message: data.message ?? "Bitte bestätige den Link in deiner E-Mail." });
      }
    } catch {
      setState({ kind: "error", channel: ch, message: "Keine Verbindung zum Alarm-Dienst." });
    }
  }

  async function checkout(plan: Plan) {
    if (!email) {
      setRedeemMsg("Bitte trage oben zuerst deine E-Mail ein.");
      return;
    }
    setRedeemMsg("Weiterleitung zu Stripe …");
    const err = await startCheckout(email, plan);
    if (err) setRedeemMsg(err);
  }

  async function redeem() {
    if (channel !== "push" && !email) {
      setRedeemMsg("Bitte trage oben zuerst deine E-Mail ein.");
      return;
    }
    setRedeemMsg("…");
    const r = await redeemProCode({ code: redeemCode, channel, email });
    setRedeemMsg((r.ok ? "✅ " : "") + r.message);
    if (r.ok) setShowRedeem(false);
  }

  // Abgeschlossene Zustände: nur noch eine Statuszeile.
  if (state.kind === "pending" || state.kind === "done") {
    return (
      <p
        className={`relative z-10 mt-3 flex items-start gap-1.5 text-[0.76rem] ${
          state.kind === "pending" ? "text-accent-strong" : "text-good"
        }`}
        role="status"
      >
        <span aria-hidden="true">{state.kind === "pending" ? "✉️" : "✅"}</span>
        {state.message}
      </p>
    );
  }

  if (state.kind === "idle") {
    return (
      <button
        type="button"
        // z-10 hebt den Button über das Stretched-Link-Overlay der Karte.
        className="relative z-10 mt-3 self-start inline-flex items-center gap-1.5 text-[0.78rem] font-semibold text-muted hover:text-accent-strong cursor-pointer"
        onClick={(e) => {
          e.stopPropagation();
          setState({ kind: "open", channel: "email" });
        }}
      >
        <Bell size={14} strokeWidth={2} aria-hidden />
        Bei Bestpreis benachrichtigen
      </button>
    );
  }

  const submitting = state.kind === "submitting";
  const seg = (active: boolean) =>
    `flex-1 h-8 text-[0.78rem] font-semibold rounded-md cursor-pointer border ${
      active ? "bg-fill text-on-fill border-fill" : "bg-surface text-muted border-border-strong hover:text-ink"
    }`;
  const unit = targetMetric === "liter" ? "€/L" : "€/Dose";
  const primaryLabel = channel === "telegram" ? "In Telegram öffnen" : channel === "push" ? "Push aktivieren" : "Preis-Alarm speichern";

  return (
    <form
      className="relative z-10 mt-3 flex flex-col gap-3"
      onClick={(e) => e.stopPropagation()}
      onSubmit={(e) => {
        e.preventDefault();
        subscribe(channel);
      }}
    >
      <span className="flex items-center gap-1.5 text-[0.8rem] font-semibold text-ink">
        <Bell size={14} strokeWidth={2} aria-hidden />
        Bestpreis-Alarm für {offer.brand}
      </span>

      {/* Free-Tarif: bereits eine ANDERE Marke aktiv -> gar nicht erst anbieten. */}
      {blocked ? (
        <div className="flex flex-col gap-2 rounded-lg border border-[color-mix(in_srgb,var(--warn-ink)_35%,transparent)] bg-warn-tint p-2.5" role="note">
          <span className="text-[0.78rem] font-semibold text-ink">Im kostenlosen Tarif ist eine Marke drin</span>
          <p className="text-[0.74rem] text-muted">
            Du beobachtest bereits <span className="font-semibold text-ink">{memo?.brand}</span>. Für {offer.brand} brauchst du Pro –
            weitere Kanäle (E-Mail, Telegram, Push) für {memo?.brand} bleiben natürlich kostenlos.
          </p>
          {/* Für Kauf/Code unten wird die E-Mail gebraucht – das reguläre Feld ist hier ausgeblendet. */}
          <label htmlFor={`alarm-pro-${offer.id}`} className="text-[0.66rem] font-semibold uppercase tracking-[0.08em] text-muted">
            E-Mail für Pro
          </label>
          <input
            id={`alarm-pro-${offer.id}`}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="du@example.com"
            className="w-full min-w-0 h-9 px-2.5 text-[0.82rem] bg-surface text-ink border border-border-strong rounded-lg outline-none"
          />
          <button
            type="button"
            className="self-start text-[0.68rem] text-muted underline underline-offset-2 hover:text-accent-strong cursor-pointer"
            onClick={clearAlarmMemo}
          >
            Stimmt nicht mehr? Hinweis zurücksetzen
          </button>
        </div>
      ) : (
        <>
      {sameBrandActive && (
        <p className="text-[0.72rem] text-good">✓ {memo?.brand} beobachtest du bereits – weitere Kanäle sind kostenlos.</p>
      )}

      {/* Kanal */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[0.66rem] font-semibold uppercase tracking-[0.08em] text-muted">Wie benachrichtigen?</span>
        <div className="flex gap-1.5" role="group" aria-label="Benachrichtigungskanal">
          {(["email", "telegram", "push"] as const).map((ch) => (
            <button
              key={ch}
              type="button"
              className={seg(channel === ch)}
              aria-pressed={channel === ch}
              disabled={submitting}
              onClick={() => setState({ kind: "open", channel: ch })}
            >
              {ch === "email" ? "E-Mail" : ch === "telegram" ? "Telegram" : "Push"}
            </button>
          ))}
        </div>
      </div>

      {/* Kanal-Eingabe */}
      {channel === "email" && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`alarm-${offer.id}`} className="text-[0.66rem] font-semibold uppercase tracking-[0.08em] text-muted">
            Deine E-Mail-Adresse
          </label>
          <input
            id={`alarm-${offer.id}`}
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="du@example.com"
            className="w-full min-w-0 h-9 px-2.5 text-[0.82rem] bg-surface text-ink border border-border-strong rounded-lg outline-none"
          />
        </div>
      )}
      {channel === "telegram" && (
        <p className="text-[0.74rem] text-muted">Nach dem Speichern öffnet sich Telegram – dort einmal „Start“ tippen.</p>
      )}
      {channel === "push" && (
        <p className="text-[0.74rem] text-muted">
          Nach dem Speichern fragt dein Browser nach der Erlaubnis für Push-Nachrichten. Die Zustellung kann sich je nach
          Akku-Einstellungen deines Geräts verzögern – zuverlässiger sind E-Mail oder Telegram.
        </p>
      )}

      {/* Preiswecker (Pro) */}
      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          className="self-start text-[0.74rem] font-semibold text-muted hover:text-accent-strong cursor-pointer"
          aria-expanded={weckerOn}
          onClick={() => setWeckerOn((v) => !v)}
        >
          {weckerOn ? "− Preiswecker" : "＋ Preiswecker (Pro)"}
        </button>
        {weckerOn && (
          <div className="flex flex-col gap-1.5 rounded-lg border border-border p-2">
            <label htmlFor={`target-${offer.id}`} className="text-[0.72rem] text-muted">
              Melde dich, sobald der Preis ≤ Zielwert ist:
            </label>
            <div className="flex gap-1.5">
              <div className="flex items-center gap-1 flex-1 min-w-0 h-8 px-2 bg-surface border border-border-strong rounded-md">
                <input
                  id={`target-${offer.id}`}
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={targetPrice}
                  onChange={(e) => setTargetPrice(e.target.value)}
                  placeholder="z. B. 0,89"
                  className="w-full min-w-0 bg-transparent text-ink text-[0.82rem] outline-none"
                />
                <span className="flex-none text-[0.72rem] text-muted">{unit}</span>
              </div>
              <div className="flex gap-1" role="group" aria-label="Zielgröße">
                <button type="button" className={seg(targetMetric === "unit") + " !flex-none px-2.5"} aria-pressed={targetMetric === "unit"} onClick={() => setTargetMetric("unit")}>
                  Dose
                </button>
                <button type="button" className={seg(targetMetric === "liter") + " !flex-none px-2.5"} aria-pressed={targetMetric === "liter"} onClick={() => setTargetMetric("liter")}>
                  €/L
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
        </>
      )}

      {state.kind === "error" && (
        <p className="text-[0.74rem] text-warn-ink" role="alert">
          {state.message}
        </p>
      )}

      {/* Pro freischalten – Kauf primär (E-Mail-Kanal), Code sekundär.
          Bei gesperrter Marke ist Pro der einzige Weg, also direkt zeigen. */}
      {(showRedeem || blocked) && (
        <ProPlans
          channel={channel}
          title="Pro – unbegrenzt Marken + Wunschpreis"
          onCheckout={checkout}
          code={redeemCode}
          onCodeChange={setRedeemCode}
          onRedeem={redeem}
        />
      )}
      {redeemMsg && (
        <p className="text-[0.74rem] text-muted" role="status">
          {redeemMsg}
        </p>
      )}

      {/* Primärer Button – ganz unten, volle Breite. Bei gesperrter Marke
          entfällt er: Speichern würde ohnehin am Free-Limit scheitern. */}
      {!blocked && (
        <button
          type="submit"
          disabled={submitting}
          className="w-full h-10 text-[0.85rem] font-semibold text-on-fill bg-fill border border-fill rounded-lg cursor-pointer hover:opacity-90 disabled:opacity-60"
        >
          {submitting ? "…" : primaryLabel}
        </button>
      )}

      <div className="flex items-center justify-between gap-2">
        <span className="text-[0.7rem] text-muted">Kostenlos · ein Produkt · jederzeit abbestellbar.</span>
        {!showRedeem && !blocked && (
          <button
            type="button"
            className="flex-none text-[0.7rem] font-semibold text-accent-strong hover:text-accent cursor-pointer"
            onClick={() => setShowRedeem(true)}
          >
            Pro werden
          </button>
        )}
      </div>
    </form>
  );
}
