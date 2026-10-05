// Zweck: Nachrichten-Builder der Alarme (E-Mail, Telegram, Push). Reine Funktionen;
//   die umgebungsabhängigen URLs kommen über die Factory (kein process.env hier),
//   dadurch testbar in tests/alarm-messages.test.mjs.

import { badge, ctaButton, emailShell } from '../../shared/email-shell.mjs'

/** Deutsche Zahl mit 2 Nachkommastellen: 1.5 -> "1,50". */
const de2 = (n) => n.toFixed(2).replace('.', ',')

/**
 * @param {{ siteUrl: string, apiBase?: string }} cfg  siteUrl = Fallback-Link,
 *   apiBase = Worker-URL für Abmelde-Links (leer -> Link auf die Site).
 */
export function createMessages({ siteUrl, apiBase = '' }) {
  function alarmEmail(event, offer, unsubToken) {
    const perLiter = de2(event.perLiter)
    const priceLine = offer ? `${offer.priceText ?? ''} · ` : ''
    const unsubLink = apiBase ? `${apiBase}/api/unsubscribe?token=${unsubToken}` : siteUrl
    const url = offer?.url || siteUrl
    const text =
      `Neues Preistief! ${event.label} ist gerade so günstig wie nie erfasst: ${perLiter} €/L.\n\n` +
      `Zum Angebot: ${url}\n\nAbmelden: ${unsubLink}`
    const html = emailShell({
      card: `${badge('⚡ Bestpreis', '#e24a08')}
        <h1 style="font-size:1.25rem;margin:0 0 8px">${event.label}</h1>
        <p style="margin:0 0 16px;color:#5b6772">${priceLine}<strong style="color:#10151b">${perLiter} €/L</strong> – so günstig wie nie erfasst.</p>
        ${ctaButton(url, 'Zum Angebot')}`,
      footer: `Du bekommst diese Mail, weil du einen Bestpreis-Alarm aktiviert hast. <a href="${unsubLink}" style="color:#5b6772">Abmelden</a>`,
    })
    return { subject: `⚡ Bestpreis: ${event.label} – ${perLiter} €/L`, html, text }
  }

  /** Preiswecker-Mail: aktueller Preis hat den Zielwert erreicht. */
  function weckerEmail(sub, offer, price) {
    const unit = sub.target_metric === 'liter' ? '/L' : ''
    const cur = de2(price)
    const target = de2(sub.target_price)
    const url = offer?.url || siteUrl
    const text =
      `Dein Preiswecker: ${sub.product_label} liegt jetzt bei ${cur} €${unit} ` + `(dein Ziel: ${target} €${unit}).\n\nZum Angebot: ${url}`
    const html = emailShell({
      card: `${badge('🔔 Preiswecker', '#0a7a42')}
        <h1 style="font-size:1.25rem;margin:0 0 8px">${sub.product_label}</h1>
        <p style="margin:0 0 16px;color:#5b6772">Jetzt <strong style="color:#10151b">${cur} €${unit}</strong> – dein Zielpreis von ${target} €${unit} ist erreicht.</p>
        ${ctaButton(url, 'Zum Angebot')}`,
      footer: '',
    })
    return { subject: `🔔 Preiswecker erreicht: ${sub.product_label} – ${cur} €${unit}`, html, text }
  }

  /** Telegram-Alarmtext (HTML). */
  function telegramMessage(event, offer) {
    const perLiter = de2(event.perLiter)
    const url = offer?.url || siteUrl
    const price = offer?.priceText ? `${offer.priceText} · ` : ''
    return (
      `⚡ <b>Bestpreis!</b>\n${event.label}\n` +
      `${price}<b>${perLiter} €/L</b> – so günstig wie nie erfasst.\n${url}\n\n` +
      `<i>/stop zum Abmelden</i>`
    )
  }

  function bestPricePush(event, offer) {
    const perLiter = de2(event.perLiter)
    return {
      title: `⚡ Bestpreis: ${event.label}`,
      body: `${perLiter} €/L – so günstig wie nie erfasst.`,
      url: offer?.url || siteUrl,
      tag: event.productKey,
    }
  }

  function weckerPush(sub, offer, price) {
    const unit = sub.target_metric === 'liter' ? '€/L' : '€'
    const cur = de2(price)
    return {
      title: `🔔 Preiswecker: ${sub.product_label}`,
      body: `Jetzt ${cur} ${unit} – dein Ziel ist erreicht.`,
      url: offer?.url || siteUrl,
      tag: sub.product_key,
    }
  }

  /** Marken-Wecker als E-Mail (Titel/Text aus dem Push-Payload). */
  function brandEmail(offer, payload) {
    const url = offer?.url || siteUrl
    const html = emailShell({
      card: `<h1 style="font-size:1.2rem;margin:0 0 8px">${payload.title}</h1>
        <p style="margin:0 0 16px;color:#5b6772">${payload.body}</p>
        ${ctaButton(url, 'Zum Angebot')}`,
      footer: '',
    })
    return { subject: payload.title, html, text: `${payload.title}\n${payload.body}\n${url}` }
  }

  /** Marken-Wecker als Telegram-Text (HTML). */
  function brandTelegram(offer, payload) {
    const url = offer?.url || siteUrl
    return `⚡ <b>${payload.title}</b>\n${payload.body}\n${url}\n\n<i>/stop zum Abmelden</i>`
  }

  return { alarmEmail, weckerEmail, telegramMessage, bestPricePush, weckerPush, brandEmail, brandTelegram }
}
