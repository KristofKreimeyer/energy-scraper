// Telegram-Bot-Transport. Ohne TELEGRAM_BOT_TOKEN Dev-Fallback (Log statt Versand),
// so lässt sich der /start-Bindungs-Flow lokal per simuliertem Webhook testen.

import type { Env } from './email'

export async function sendTelegram(env: Env, chatId: string, text: string): Promise<void> {
  if (!env.TELEGRAM_BOT_TOKEN) {
    console.log(`\n[telegram:dev] chat ${chatId}: ${text}\n`)
    return
  }
  const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: false }),
  })
  if (!res.ok) throw new Error(`Telegram-Versand fehlgeschlagen (${res.status}): ${await res.text()}`)
}
