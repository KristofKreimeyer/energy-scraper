/**
 * Zweck: Merkt sich auf DIESEM Gerät, welche Marke der/die Nutzer:in bereits per
 * Preis-Alarm beobachtet – damit die UI im Free-Tarif gar nicht erst in die
 * Sackgasse führt („andere Marke wählen → Server lehnt mit 409 ab“).
 *
 * Bewusst nur localStorage: EnergyHunt hat keinen Login, also kennt der Server
 * keine geräteübergreifende Identität (E-Mail, Telegram-chat_id und Push-Gerät
 * sind getrennte Ziele). Der Merker ist deshalb ein UX-Wegweiser, KEINE
 * Absicherung – das Free-Limit erzwingt weiterhin der Worker.
 *
 * Nutzung:
 *   const memo = useAlarmMemo()                  // reaktiv (React-Hook)
 *   rememberAlarm("Monster", "Monster … (Penny)", "email")
 *   markPro()      // nach Kauf/Code: Sperre aufheben
 *   clearAlarmMemo()
 */

import { useEffect, useState } from "react";

const KEY = "energyhunt:alarm:v1";
const EVENT = "energyhunt:alarm-changed";

export type AlarmChannel = "email" | "telegram" | "push";

export interface AlarmMemo {
  /** Marke in Original-Schreibweise (Anzeige). */
  brand: string;
  /** Was zuletzt angelegt wurde – Produkt- oder Markenname, für die Meldung. */
  label: string;
  /** Über welche Kanäle bereits angelegt wurde. */
  channels: AlarmChannel[];
  /** Pro freigeschaltet? Dann greift die 1-Marken-Sperre nicht mehr. */
  pro: boolean;
}

/** Marken vergleichbar machen (Groß-/Kleinschreibung, Randleerzeichen). */
export const normBrand = (b: string) => b.trim().toLowerCase();

function read(): AlarmMemo | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<AlarmMemo>;
    if (!v || typeof v.brand !== "string" || !v.brand) return null;
    return {
      brand: v.brand,
      label: typeof v.label === "string" ? v.label : v.brand,
      channels: Array.isArray(v.channels) ? (v.channels as AlarmChannel[]) : [],
      pro: v.pro === true,
    };
  } catch {
    return null; // z. B. privater Modus ohne Storage – dann eben keine Sperre
  }
}

function write(memo: AlarmMemo | null) {
  try {
    if (memo) localStorage.setItem(KEY, JSON.stringify(memo));
    else localStorage.removeItem(KEY);
  } catch {
    /* Storage nicht verfügbar – Merker entfällt, Server bremst weiterhin. */
  }
  window.dispatchEvent(new Event(EVENT));
}

/** Nach erfolgreicher Anmeldung merken. Gleiche Marke → Kanal ergänzen. */
export function rememberAlarm(brand: string, label: string, channel: AlarmChannel) {
  const prev = read();
  const same = prev && normBrand(prev.brand) === normBrand(brand);
  write({
    brand,
    label,
    channels: same ? [...new Set([...prev.channels, channel])] : [channel],
    pro: prev?.pro ?? false,
  });
}

/** Pro freigeschaltet (Kauf oder Code) – hebt die 1-Marken-Sperre auf. */
export function markPro() {
  const prev = read();
  write(prev ? { ...prev, pro: true } : { brand: "", label: "", channels: [], pro: true });
}

export function clearAlarmMemo() {
  write(null);
}

/**
 * Ist diese Marke im Free-Tarif gesperrt, weil bereits eine ANDERE beobachtet
 * wird? Gleiche Marke bleibt erlaubt (anderer Kanal ist ausdrücklich gewünscht).
 */
export function isBrandBlocked(memo: AlarmMemo | null, brand: string): boolean {
  if (!memo || memo.pro || !memo.brand) return false;
  return normBrand(memo.brand) !== normBrand(brand);
}

/** Reaktiver Zugriff – aktualisiert sich auch über Tabs hinweg. */
export function useAlarmMemo(): AlarmMemo | null {
  const [memo, setMemo] = useState<AlarmMemo | null>(() => read());
  useEffect(() => {
    const sync = () => setMemo(read());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return memo;
}
