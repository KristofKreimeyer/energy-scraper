// Registriert den Service Worker beim App-Start (für Offline-Shell + PWA-Install).
// Idempotent – push.ts registriert denselben /sw.js beim Push-Abo erneut.
export function registerServiceWorker() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* SW optional – App funktioniert auch ohne. */
    });
  });
}
