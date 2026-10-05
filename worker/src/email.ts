// E-Mail-Versand + Templates. Transport über Brevo (EU/Paris, DSGVO-freundlich).
// Ohne BREVO_API_KEY läuft ein Dev-Fallback, der die Mail in die Konsole loggt –
// so lässt sich der komplette Double-Opt-In-Flow lokal ohne Account testen.

import { ctaButton, emailShell } from '../../shared/email-shell.mjs'

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
  // Stripe (Pro-Zahlung)
  STRIPE_SECRET_KEY?: string
  STRIPE_WEBHOOK_SECRET?: string
  STRIPE_PRICE_MONTHLY?: string
  STRIPE_PRICE_YEARLY?: string
  STRIPE_PRICE_LIFETIME?: string
  // Community-Preismeldungen (Moderation)
  MODERATION_TOKEN?: string
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

/** Standard-Mail: Überschrift + Inhalt in der gemeinsamen Hülle. */
const shell = (heading: string, body: string) =>
  emailShell({ card: `<h1 style="font-size:1.25rem;margin:0 0 12px">${heading}</h1>\n      ${body}` })

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
     ${ctaButton(confirmLink, 'Alarm bestätigen')}
     <p style="margin:18px 0 0;color:#9aa6b1;font-size:0.8rem">Nicht angemeldet? Dann ignoriere diese Mail – ohne Klick passiert nichts.</p>`,
  )
  return { subject: 'Bitte bestätige deinen Bestpreis-Alarm', html, text }
}

/** Magic-Link-Login: passwortloser Anmeldelink (kurzlebig, einmalig). */
export function loginEmail(loginLink: string): Omit<OutgoingEmail, 'to'> {
  const text =
    `Dein Anmeldelink für EnergyHunt:\n${loginLink}\n\n` +
    `Der Link ist 15 Minuten gültig und nur einmal verwendbar.\n` +
    `Wenn du das nicht warst, ignoriere diese Mail einfach.`
  const html = shell(
    'Bei EnergyHunt anmelden',
    `<p style="margin:0 0 20px;color:#5b6772">Klicke zum Anmelden auf den Button. Der Link ist <strong style="color:#10151b">15 Minuten</strong> gültig und nur einmal verwendbar.</p>
     ${ctaButton(loginLink, 'Jetzt anmelden')}
     <p style="margin:18px 0 0;color:#9aa6b1;font-size:0.8rem">Nicht angefordert? Dann ignoriere diese Mail – ohne Klick passiert nichts.</p>`,
  )
  return { subject: 'Dein Anmeldelink für EnergyHunt', html, text }
}

/** Minimal-Seite, die der Worker nach Klick auf Bestätigen/Abmelden zurückgibt. */
export function statusPage(env: Env, heading: string, message: string): Response {
  const html = shell(
    heading,
    `<p style="margin:0 0 20px;color:#5b6772">${message}</p>
     ${ctaButton(env.PUBLIC_SITE_URL, 'Zu EnergyHunt')}`,
  )
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } })
}
