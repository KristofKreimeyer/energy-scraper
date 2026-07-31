import { useEffect, useState } from "react";
import { WRAP } from "../utils/helper";

// Dezenter „App installieren"-Streifen. Erscheint nur, wenn der Browser das
// Installieren anbietet (Chrome/Edge/Android feuern `beforeinstallprompt`) und
// der Nutzer ihn nicht schon weggetippt hat. iOS/Safari kennt das Event nicht –
// dort bleibt der Streifen aus (Installation dort über „Zum Home-Bildschirm").

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "energyhunt:pwa-dismissed";

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  // Nur auf touch-primären Geräten (Handy/Tablet) zeigen – am Desktop bleibt
  // der Streifen aus (der Browser bietet dort ohnehin sein eigenes Install-Symbol).
  const [isTouch] = useState(() => {
    try {
      return window.matchMedia("(pointer: coarse)").matches;
    } catch {
      return false;
    }
  });
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault(); // eigenen Zeitpunkt/Look wählen
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setDeferred(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!isTouch || !deferred || dismissed) return null;

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice.catch(() => undefined);
    setDeferred(null);
  }

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* egal */
    }
    setDismissed(true);
  }

  return (
    <div className="border-b border-border bg-accent-tint">
      <div className={`${WRAP} flex items-center gap-3 py-2`}>
        <span aria-hidden="true" className="text-[1.05rem]">
          ⚡
        </span>
        <p className="flex-1 text-[0.84rem] text-ink font-medium leading-snug">
          EnergyHunt als App installieren – die Wochendeals mit einem Tipp vom
          Homescreen.
        </p>
        <button
          type="button"
          onClick={install}
          className="flex-none h-9 px-3.5 rounded-lg bg-fill text-on-fill text-[0.82rem] font-semibold cursor-pointer hover:opacity-90"
        >
          Installieren
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Hinweis ausblenden"
          className="flex-none w-8 h-8 grid place-items-center rounded-full text-muted hover:text-ink hover:bg-surface-2 text-lg leading-none cursor-pointer"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
