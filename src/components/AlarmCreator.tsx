import { useState } from "react";
import { offers as allOffers, allBrands, allMarkets } from "../lib/offers";
import { subscribeToPush, PushError } from "../lib/push";
import { useAlarmMemo, rememberAlarm, markPro, clearAlarmMemo, normBrand } from "../lib/alarmState";
import { Modal } from "./Modal";

// Globaler Preiswecker-Dialog: markenbasiert, von überall aufrufbar.
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8787";

type Channel = "email" | "telegram" | "push";
type Metric = "unit" | "liter";
type StoreMode = "all" | "only" | "except";

const BRANDS = allBrands(allOffers);
const MARKETS = allMarkets(allOffers);

// Pro-Pläne (Anzeige-Copy; echter Betrag via Stripe-Price-ID).
const PLANS = [
  { plan: "monthly", price: "0,99 €", period: "pro Monat" },
  { plan: "yearly", price: "9,99 €", period: "pro Jahr", badge: "spart 16 %", highlight: true },
  { plan: "lifetime", price: "24,99 €", period: "einmalig, für immer" },
] as const;

export function AlarmCreator({ onClose }: { onClose: () => void }) {
  const [channel, setChannel] = useState<Channel>("email");
  const [email, setEmail] = useState("");
  const [brands, setBrands] = useState<Set<string>>(new Set());
  const [storeMode, setStoreMode] = useState<StoreMode>("all");
  const [stores, setStores] = useState<Set<string>>(new Set());
  const [metric, setMetric] = useState<Metric>("unit");
  const [targets, setTargets] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  // Pro
  const [showPro, setShowPro] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);
  const [code, setCode] = useState("");

  // Free-Tarif = eine Marke. Läuft schon eine, sind alle anderen Chips gesperrt
  // (siehe lib/alarmState – Geräte-Merker, das harte Limit setzt der Worker).
  const memo = useAlarmMemo();
  const lockedBrand = memo && !memo.pro && memo.brand ? memo.brand : null;
  const isLocked = (b: string) => !!lockedBrand && normBrand(b) !== normBrand(lockedBrand);

  const toggleIn = (set: Set<string>, setSet: (s: Set<string>) => void, v: string) => {
    const n = new Set(set);
    if (n.has(v)) n.delete(v);
    else n.add(v);
    setSet(n);
  };
  const seg = (active: boolean) =>
    `h-8 px-3 text-[0.78rem] font-semibold rounded-md cursor-pointer border ${
      active ? "bg-accent text-white border-accent" : "bg-surface text-muted border-border-strong hover:text-ink"
    }`;
  const chip = (active: boolean) =>
    `h-8 px-3 text-[0.78rem] font-semibold rounded-full cursor-pointer border ${
      active ? "bg-accent text-white border-accent" : "bg-surface text-ink border-border-strong hover:border-accent"
    }`;

  async function save() {
    if (brands.size === 0) {
      setMsg({ ok: false, text: "Bitte wähle mindestens eine Marke." });
      return;
    }
    setSubmitting(true);
    setMsg(null);
    try {
      let extra: Record<string, unknown> = {};
      if (channel === "email") extra = { email };
      if (channel === "push") {
        try {
          extra = { subscription: await subscribeToPush() };
        } catch (err) {
          setMsg({ ok: false, text: err instanceof PushError ? err.message : "Push-Anmeldung fehlgeschlagen." });
          setSubmitting(false);
          return;
        }
      }
      const brandsPayload = [...brands].map((b) => ({ brand: b, ...(targets[b] ? { targetPrice: targets[b], targetMetric: metric } : {}) }));
      const res = await fetch(`${API_BASE}/api/subscribe`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ channel, ...extra, scope: "brand", storeMode, stores: [...stores], brands: brandsPayload }),
      });
      const data = (await res.json()) as { message?: string; error?: string; telegramLink?: string };
      if (!res.ok) {
        if (data.error === "pro_required") setShowPro(true);
        setMsg({ ok: false, text: data.message ?? "Das hat nicht geklappt." });
      } else {
        // Merken, damit die UI im Free-Tarif keine zweite Marke mehr anbietet.
        const first = [...brands][0];
        if (first) rememberAlarm(first, first, channel);
        if (channel === "telegram" && data.telegramLink) {
          window.open(data.telegramLink, "_blank", "noopener");
          setMsg({ ok: true, text: data.message ?? "Öffne Telegram und tippe auf „Start“." });
        } else {
          setMsg({ ok: true, text: data.message ?? "Gespeichert." });
        }
      }
    } catch {
      setMsg({ ok: false, text: "Keine Verbindung zum Alarm-Dienst." });
    }
    setSubmitting(false);
  }

  async function checkout(plan: "monthly" | "yearly" | "lifetime") {
    if (!email) {
      setMsg({ ok: false, text: "Bitte trage oben deine E-Mail ein." });
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/checkout`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, plan }) });
      const data = (await res.json()) as { url?: string; message?: string };
      if (res.ok && data.url) window.location.assign(data.url);
      else setMsg({ ok: false, text: data.message ?? "Kauf konnte nicht gestartet werden." });
    } catch {
      setMsg({ ok: false, text: "Keine Verbindung zum Alarm-Dienst." });
    }
  }

  async function redeem() {
    try {
      let payload: Record<string, unknown>;
      if (channel === "push") {
        try {
          payload = { code, channel: "push", subscription: await subscribeToPush() };
        } catch (err) {
          setMsg({ ok: false, text: err instanceof PushError ? err.message : "Push-Anmeldung fehlgeschlagen." });
          return;
        }
      } else {
        if (!email) {
          setMsg({ ok: false, text: "Bitte trage oben deine E-Mail ein." });
          return;
        }
        payload = { code, channel: "email", email };
      }
      const res = await fetch(`${API_BASE}/api/redeem`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const data = (await res.json()) as { message?: string };
      setMsg({ ok: res.ok, text: (res.ok ? "✅ " : "") + (data.message ?? (res.ok ? "Pro freigeschaltet." : "Code ungültig.")) });
      if (res.ok) {
        markPro(); // Sperre „nur eine Marke“ aufheben
        setShowPro(false);
      }
    } catch {
      setMsg({ ok: false, text: "Keine Verbindung zum Alarm-Dienst." });
    }
  }

  const unitLabel = metric === "liter" ? "€/L" : "€ / Dose";

  return (
    <Modal onClose={onClose} label="Preis-Alarm einrichten">
      <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[1.15rem] font-bold text-ink leading-tight">Preis-Alarm einrichten</h2>
            <p className="text-[0.8rem] text-muted mt-0.5">Wähle Marken – wir melden uns, sobald ein Deal auftaucht.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Schließen" className="flex-none text-muted hover:text-ink text-lg leading-none cursor-pointer">
            ✕
          </button>
        </div>

        {/* Kanal */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[0.66rem] font-semibold uppercase tracking-[0.08em] text-muted">Wie benachrichtigen?</span>
          <div className="flex gap-1.5" role="group" aria-label="Kanal">
            {(["email", "telegram", "push"] as const).map((ch) => (
              <button key={ch} type="button" className={seg(channel === ch) + " flex-1"} aria-pressed={channel === ch} onClick={() => setChannel(ch)}>
                {ch === "email" ? "E-Mail" : ch === "telegram" ? "Telegram" : "Push"}
              </button>
            ))}
          </div>
        </div>

        {channel === "email" && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="creator-email" className="text-[0.66rem] font-semibold uppercase tracking-[0.08em] text-muted">Deine E-Mail-Adresse</label>
            <input id="creator-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="du@example.com" className="w-full h-9 px-2.5 text-[0.85rem] bg-surface text-ink border border-border-strong rounded-lg outline-none" />
          </div>
        )}
        {channel === "push" && (
          <p className="text-[0.74rem] text-muted">
            Nach dem Speichern fragt dein Browser nach der Erlaubnis. Die Zustellung kann sich je nach Akku-Einstellungen
            deines Geräts verzögern – zuverlässiger sind E-Mail oder Telegram.
          </p>
        )}

        {/* Marken */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[0.66rem] font-semibold uppercase tracking-[0.08em] text-muted">Marken</span>
          <div className="flex flex-wrap gap-1.5">
            {BRANDS.map((b) => (
              <button
                key={b}
                type="button"
                className={chip(brands.has(b)) + (isLocked(b) ? " opacity-40 cursor-not-allowed" : "")}
                aria-pressed={brands.has(b)}
                disabled={isLocked(b)}
                title={isLocked(b) ? `Im kostenlosen Tarif ist eine Marke drin – du beobachtest bereits ${lockedBrand}.` : undefined}
                onClick={() => toggleIn(brands, setBrands, b)}
              >
                {b}
              </button>
            ))}
          </div>
          {lockedBrand && (
            <p className="text-[0.72rem] text-muted">
              Kostenlos ist <span className="font-semibold text-ink">eine</span> Marke drin – du beobachtest bereits{" "}
              <span className="font-semibold text-ink">{lockedBrand}</span>. Weitere Kanäle dafür sind frei; für weitere Marken gibt es Pro.{" "}
              <button type="button" className="underline underline-offset-2 hover:text-accent-strong cursor-pointer" onClick={clearAlarmMemo}>
                Stimmt nicht mehr?
              </button>
            </p>
          )}
        </div>

        {/* Stores */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[0.66rem] font-semibold uppercase tracking-[0.08em] text-muted">Welche Stores?</span>
          <div className="flex gap-1.5" role="group" aria-label="Store-Filter">
            {([["all", "Alle"], ["only", "Nur diese"], ["except", "Außer diese"]] as const).map(([m, t]) => (
              <button key={m} type="button" className={seg(storeMode === m) + " flex-1"} aria-pressed={storeMode === m} onClick={() => setStoreMode(m)}>
                {t}
              </button>
            ))}
          </div>
          {storeMode !== "all" && (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {MARKETS.map((m) => (
                <button key={m} type="button" className={chip(stores.has(m))} aria-pressed={stores.has(m)} onClick={() => toggleIn(stores, setStores, m)}>
                  {m}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Zielpreis je Marke (optional) */}
        {brands.size > 0 && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[0.66rem] font-semibold uppercase tracking-[0.08em] text-muted">Nur wenn unter (optional, Pro)</span>
              <div className="flex gap-1" role="group" aria-label="Zielgröße">
                <button type="button" className={seg(metric === "unit") + " !h-7 px-2"} aria-pressed={metric === "unit"} onClick={() => setMetric("unit")}>Dose</button>
                <button type="button" className={seg(metric === "liter") + " !h-7 px-2"} aria-pressed={metric === "liter"} onClick={() => setMetric("liter")}>€/L</button>
              </div>
            </div>
            {[...brands].map((b) => (
              <div key={b} className="flex items-center gap-2">
                <span className="flex-none w-24 text-[0.8rem] text-ink truncate">{b}</span>
                <div className="flex items-center gap-1 flex-1 h-8 px-2 bg-surface border border-border-strong rounded-md">
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={targets[b] ?? ""}
                    onChange={(e) => setTargets((t) => ({ ...t, [b]: e.target.value }))}
                    placeholder="z. B. 0,89"
                    className="w-full min-w-0 bg-transparent text-ink text-[0.82rem] outline-none"
                  />
                  <span className="flex-none text-[0.7rem] text-muted whitespace-nowrap">{unitLabel}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {msg && (
          <p className={`text-[0.78rem] ${msg.ok ? "text-good" : "text-warn-ink"}`} role="status">
            {msg.text}
          </p>
        )}

        {/* Pro freischalten (Kauf primär) */}
        {showPro && (
          <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-surface-2 p-2.5">
            <span className="text-[0.74rem] font-semibold text-ink">Pro – mehrere Marken + Wunschpreis</span>
            {channel === "email" ? (
              <>
                {PLANS.map((p) => (
                  <button
                    key={p.plan}
                    type="button"
                    onClick={() => checkout(p.plan)}
                    className={`flex items-center justify-between gap-2 w-full h-11 px-3 rounded-lg border bg-surface text-left cursor-pointer hover:border-accent ${"highlight" in p ? "border-accent" : "border-border-strong"}`}
                  >
                    <span className="text-[0.9rem] font-bold text-ink">
                      {p.price} <span className="text-[0.72rem] font-medium text-muted">{p.period}</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      {"badge" in p && p.badge && <span className="text-[0.62rem] font-bold uppercase tracking-wide text-accent-strong bg-accent-tint rounded px-1.5 py-0.5">{p.badge}</span>}
                      <span aria-hidden="true" className="text-muted">›</span>
                    </span>
                  </button>
                ))}
                <button type="button" className="self-start text-[0.7rem] text-muted underline underline-offset-2 hover:text-accent-strong cursor-pointer" onClick={() => setCodeOpen((v) => !v)}>
                  Schon Supporter? Code einlösen
                </button>
              </>
            ) : channel === "telegram" ? (
              <p className="text-[0.74rem] text-muted">Im Telegram-Bot freischalten: sende <span className="text-ink font-semibold">/redeem DEIN-CODE</span> an den Bot.</p>
            ) : null}
            {(codeOpen || channel === "push") && (
              <div className="flex gap-1.5">
                <input type="text" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Pro-Code" className="flex-1 min-w-0 h-9 px-2.5 text-[0.82rem] bg-surface text-ink border border-border-strong rounded-lg outline-none" />
                <button type="button" onClick={redeem} className="flex-none h-9 px-3 text-[0.82rem] font-semibold text-good border border-[color-mix(in_srgb,var(--good)_40%,transparent)] rounded-lg cursor-pointer hover:bg-good-tint">Einlösen</button>
              </div>
            )}
          </div>
        )}

        {/* Speichern – ganz unten */}
        <button type="button" onClick={save} disabled={submitting} className="w-full h-11 text-[0.9rem] font-semibold text-white bg-accent border border-accent rounded-lg cursor-pointer hover:bg-accent-strong disabled:opacity-60">
          {submitting ? "…" : "Preis-Alarm speichern"}
        </button>

        <div className="flex items-center justify-between gap-2">
          <span className="text-[0.68rem] text-muted">Kostenlos: 1 Marke · Pro: beliebig viele + Wunschpreis.</span>
          {!showPro && (
            <button type="button" className="flex-none text-[0.68rem] font-semibold text-accent-strong hover:text-accent cursor-pointer" onClick={() => setShowPro(true)}>
              Pro werden
            </button>
          )}
        </div>
    </Modal>
  );
}
