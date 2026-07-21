// E-Mail-Versand + Templates. Transport über Brevo (EU/Paris, DSGVO-freundlich).
// Ohne BREVO_API_KEY läuft ein Dev-Fallback, der die Mail in die Konsole loggt –
// so lässt sich der komplette Double-Opt-In-Flow lokal ohne Account testen.

export interface Env {
  DB: D1Database
  BREVO_API_KEY?: string
  PUBLIC_SITE_URL: string
  ALLOWED_ORIGIN: string
  EMAIL_FROM: string
  EMAIL_FROM_NAME: string
  FREE_MAX_SUBSCRIPTIONS: string
  // Telegram-Kanal
  TELEGRAM_BOT_TOKEN?: string
  TELEGRAM_BOT_USERNAME?: string
  TELEGRAM_WEBHOOK_SECRET?: string
}

export interface OutgoingEmail {
  to: string
  subject: string
  html: string
  text: string
}

export async function sendEmail(env: Env, mail: OutgoingEmail): Promise<void> {
  if (!env.BREVO_API_KEY) {
    // Dev-Modus: nichts versenden, nur sichtbar machen.
    console.log(`\n[email:dev] An: ${mail.to}\n[email:dev] Betreff: ${mail.subject}\n${mail.text}\n`)
    return
  }
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': env.BREVO_API_KEY,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { email: env.EMAIL_FROM, name: env.EMAIL_FROM_NAME },
      to: [{ email: mail.to }],
      subject: mail.subject,
      htmlContent: mail.html,
      textContent: mail.text,
    }),
  })
  if (!res.ok) {
    throw new Error(`Brevo-Versand fehlgeschlagen (${res.status}): ${await res.text()}`)
  }
}

const shell = (heading: string, body: string) => `<!doctype html>
<html lang="de"><body style="margin:0;background:#edf0f3;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#10151b">
  <div style="max-width:520px;margin:0 auto;padding:32px 20px">
    <div style="font-weight:750;font-size:1.1rem;margin-bottom:20px">⚡ FindMy<span style="color:#b23c07">Energy</span></div>
    <div style="background:#fff;border:1px solid #dbe1e7;border-radius:14px;padding:24px">
      <h1 style="font-size:1.25rem;margin:0 0 12px">${heading}</h1>
      ${body}
    </div>
    <p style="color:#5b6772;font-size:0.78rem;margin-top:18px">FindMyEnergy · Bestpreis-Alarm für Energy-Drinks</p>
  </div>
</body></html>`

/** Double-Opt-In-Bestätigungsmail (DE-Pflicht vor dem ersten Alarm). */
export function confirmEmail(productLabel: string, confirmLink: string): Omit<OutgoingEmail, 'to'> {
  const text =
    `Fast geschafft! Bestätige deinen Bestpreis-Alarm für „${productLabel}“.\n\n` +
    `Klicke dazu auf diesen Link:\n${confirmLink}\n\n` +
    `Wenn du dich nicht angemeldet hast, ignoriere diese Mail einfach – ohne Klick passiert nichts.`
  const html = shell(
    'Bestätige deinen Bestpreis-Alarm',
    `<p style="margin:0 0 16px;color:#5b6772">Du erhältst künftig eine Nachricht, sobald <strong style="color:#10151b">${productLabel}</strong> ein neues Preistief erreicht.</p>
     <p style="margin:0 0 20px;color:#5b6772">Zum Aktivieren bitte einmal bestätigen:</p>
     <a href="${confirmLink}" style="display:inline-block;background:#e24a08;color:#fff;text-decoration:none;font-weight:650;padding:11px 20px;border-radius:10px">Alarm bestätigen</a>
     <p style="margin:18px 0 0;color:#9aa6b1;font-size:0.8rem">Nicht angemeldet? Dann ignoriere diese Mail – ohne Klick passiert nichts.</p>`,
  )
  return { subject: 'Bitte bestätige deinen Bestpreis-Alarm', html, text }
}

/** Minimal-Seite, die der Worker nach Klick auf Bestätigen/Abmelden zurückgibt. */
export function statusPage(env: Env, heading: string, message: string): Response {
  const html = shell(
    heading,
    `<p style="margin:0 0 20px;color:#5b6772">${message}</p>
     <a href="${env.PUBLIC_SITE_URL}" style="display:inline-block;background:#e24a08;color:#fff;text-decoration:none;font-weight:650;padding:11px 20px;border-radius:10px">Zu FindMyEnergy</a>`,
  )
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } })
}
