import { useState } from "react";
import { offers as allOffers, allBrands, allMarkets } from "../lib/offers";
import { subscribeToPush, PushError } from "../lib/push";
import { useAlarmMemo, rememberAlarm, clearAlarmMemo, normBrand } from "../lib/alarmState";
import { useFavorites } from "../lib/favorites";
import { getRef } from "../lib/referral";
import { startCheckout, redeemProCode, type Plan } from "../lib/alarmApi";
import ProPlans from "./ProPlans";
import { Modal } from "./Modal";
import { API_BASE } from "../lib/api";

// Globaler Preiswecker-Dialog: markenbasiert, von überall aufrufbar.

type Channel = "email" | "telegram" | "push";
type Metric = "unit" | "liter";
type StoreMode = "all" | "only" | "except";

const BRANDS = allBrands(allOffers);
const MARKETS = allMarkets(allOffers);

export function AlarmCreator({ onClose }: { onClose: () => void }) {
  // Free-Tarif = eine Marke. Läuft schon eine, sind alle anderen Chips gesperrt
  // (siehe lib/alarmState – Geräte-Merker, das harte Limit setzt der Worker).
  const memo = useAlarmMemo();
  const lockedBrand = memo && !memo.pro && memo.brand ? memo.brand : null;
  const isLocked = (b: string) => !!lockedBrand && normBrand(b) !== normBrand(lockedBrand);
  // Gemerkte Marken (Favoriten), die es aktuell gibt und die nicht durch die
  // Free-Sperre blockiert sind – damit im Alarm direkt nutzbar.
  const favorites = useFavorites();
  const favBrands = favorites.filter((b) => BRANDS.includes(b) && !isLocked(b));

  const [channel, setChannel] = useState<Channel>("email");
  const [email, setEmail] = useState("");
  // Gemerkte Marken sind beim Öffnen vorausgewählt (Brücke Favoriten → Alarm).
  const [brands, setBrands] = useState<Set<string>>(() => new Set(favBrands));
  const [storeMode, setStoreMode] = useState<StoreMode>("all");
  const [stores, setStores] = useState<Set<string>>(new Set());
  const [metric, setMetric] = useState<Metric>("unit");
  const [targets, setTargets] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  // Pro
  const [showPro, setShowPro] = useState(false);
  const [code, setCode] = useState("");

  const toggleIn = (set: Set<string>, setSet: (s: Set<string>) => void, v: string) => {
    const n = new Set(set);
    if (n.has(v)) n.delete(v);
    else n.add(v);
    setSet(n);
  };
  const seg = (active: boolean) =>
    `h-8 px-3 text-[0.78rem] font-semibold rounded-md cursor-pointer border ${
      active ? "bg-fill text-on-fill border-fill" : "bg-surface text-muted border-border-strong hover:text-ink"
    }`;
  const chip = (active: boolean) =>
    `h-8 px-3 text-[0.78rem] font-semibold rounded-full cursor-pointer border ${
      active ? "bg-fill text-on-fill border-fill" : "bg-surface text-ink border-border-strong hover:border-accent"
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
        body: JSON.stringify({ channel, ...extra, scope: "brand", storeMode, stores: [...stores], brands: brandsPayload, ref: getRef() ?? undefined }),
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

  async function checkout(plan: Plan) {
    if (!email) {
      setMsg({ ok: false, text: "Bitte trage oben deine E-Mail ein." });
      return;
    }
    const err = await startCheckout(email, plan);
    if (err) setMsg({ ok: false, text: err });
  }

  async function redeem() {
    if (channel !== "push" && !email) {
      setMsg({ ok: false, text: "Bitte trage oben deine E-Mail ein." });
      return;
    }
    const r = await redeemProCode({ code, channel, email });
    setMsg({ ok: r.ok, text: (r.ok ? "✅ " : "") + r.message });
    if (r.ok) setShowPro(false);
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
                {favorites.includes(b) && <span aria-hidden="true">♥ </span>}
                {b}
              </button>
            ))}
          </div>
          {favBrands.some((b) => !brands.has(b)) && (
            <button
              type="button"
              className="self-start text-[0.72rem] font-semibold text-accent-strong hover:text-accent underline underline-offset-2 cursor-pointer"
              onClick={() => setBrands((prev) => new Set([...prev, ...favBrands]))}
            >
              ♥ Meine Marken übernehmen ({favBrands.length})
            </button>
          )}
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
          <ProPlans
            channel={channel}
            onCheckout={checkout}
            code={code}
            onCodeChange={setCode}
            onRedeem={redeem}
          />
        )}

        {/* Speichern – ganz unten */}
        <button type="button" onClick={save} disabled={submitting} className="w-full h-11 text-[0.9rem] font-semibold text-on-fill bg-fill border border-fill rounded-lg cursor-pointer hover:opacity-90 disabled:opacity-60">
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
