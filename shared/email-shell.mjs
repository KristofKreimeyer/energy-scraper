// Zweck: Gemeinsame HTML-Hülle und Bausteine aller EnergyHunt-Mails. Vorher war
//   das Markup doppelt gepflegt (worker/src/email.ts und scripts/send-alarms.mjs).
// Genutzt von: worker/src/email.ts, scripts/lib/alarm-messages.mjs.
// Typen: shared/email-shell.d.mts

const FONT = "system-ui,-apple-system,'Segoe UI',Roboto,sans-serif"

/** Standard-Fußzeile (Absender-Zeile) für Mails ohne eigenen Footer. */
export const DEFAULT_FOOTER = 'EnergyHunt · Bestpreis-Alarm für Energy-Drinks'

/** Orangener Call-to-Action-Button. */
export function ctaButton(href, label) {
  return `<a href="${href}" style="display:inline-block;background:#e24a08;color:#fff;text-decoration:none;font-weight:650;padding:11px 20px;border-radius:10px">${label}</a>`
}

/** Farbiges Label oberhalb der Überschrift ("⚡ Bestpreis", "🔔 Preiswecker"). */
export function badge(label, color) {
  return `<div style="display:inline-block;background:${color};color:#fff;font-weight:700;font-size:0.8rem;padding:4px 10px;border-radius:7px;margin-bottom:12px">${label}</div>`
}

/**
 * Komplettes HTML-Dokument: Logo, weiße Karte mit `card`, darunter `footer`.
 * @param {{ card: string, footer?: string }} parts
 *   footer – Text/HTML der Fußzeile; Standard: DEFAULT_FOOTER, '' = ganz ohne.
 */
export function emailShell({ card, footer = DEFAULT_FOOTER }) {
  const foot = footer ? `\n    <p style="color:#5b6772;font-size:0.78rem;margin-top:18px">${footer}</p>` : ''
  return `<!doctype html>
<html lang="de"><body style="margin:0;background:#edf0f3;font-family:${FONT};color:#10151b">
  <div style="max-width:520px;margin:0 auto;padding:32px 20px">
    <div style="font-weight:750;font-size:1.1rem;margin-bottom:20px">⚡ Energy<span style="color:#b23c07">Hunt</span></div>
    <div style="background:#fff;border:1px solid #dbe1e7;border-radius:14px;padding:24px">
      ${card}
    </div>${foot}
  </div>
</body></html>`
}
