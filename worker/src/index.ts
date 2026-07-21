// FindMyEnergy – Bestpreis-Alarm-API (Cloudflare Worker + D1).
//
// Endpunkte:
//   POST /api/subscribe   { email, productKey, productLabel }            -> E-Mail Double-Opt-In
//                         { channel:'telegram', productKey, productLabel } -> Telegram Deep-Link
//   GET  /api/confirm?token=...            -> E-Mail-Abo aktivieren
//   GET  /api/unsubscribe?token=...        -> E-Mail-Abo abmelden
//   POST /api/telegram/webhook             -> Telegram-Updates (/start <token>, /stop)
//   GET  /api/health
//
// Free-Tarif: pro Ziel (E-Mail-Adresse bzw. Telegram-chat_id) genau EIN Produkt.
// Der Preiswecker mit eigenem Zielpreis kommt in der Pro-Variante obendrauf.

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { type Env, sendEmail, confirmEmail, statusPage } from './email'
import { sendTelegram } from './telegram'

const app = new Hono<{ Bindings: Env }>()

// CORS nur für die konfigurierte Origin (die statische Seite). Der Telegram-
// Webhook wird server-zu-server aufgerufen und ist davon unberührt.
app.use('/api/*', (c, next) => cors({ origin: c.env.ALLOWED_ORIGIN || '*', allowMethods: ['GET', 'POST', 'OPTIONS'] })(c, next))

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const now = () => new Date().toISOString()

app.get('/api/health', (c) => c.json({ ok: true }))

app.post('/api/subscribe', async (c) => {
  let body: {
    email?: string
    channel?: string
    productKey?: string
    productLabel?: string
    subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
  }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'bad_json' }, 400)
  }

  const channel = (body.channel ?? 'email').trim()
  const productKey = (body.productKey ?? '').trim()
  const productLabel = (body.productLabel ?? '').trim()
  if (!productKey || !productLabel) return c.json({ error: 'missing_product' }, 400)

  const db = c.env.DB

  // --- Telegram: pending-Abo + Deep-Link (chat_id folgt über den Webhook) ---
  if (channel === 'telegram') {
    const botUser = c.env.TELEGRAM_BOT_USERNAME
    if (!botUser) return c.json({ error: 'telegram_unconfigured', message: 'Telegram ist noch nicht eingerichtet.' }, 503)
    const id = crypto.randomUUID()
    const token = crypto.randomUUID()
    await db
      .prepare(
        "INSERT INTO subscriptions (id, channel, destination, product_key, product_label, status, token, created_at) VALUES (?, 'telegram', ?, ?, ?, 'pending', ?, ?)",
      )
      .bind(id, `pending:${token}`, productKey, productLabel, token, now())
      .run()
    return c.json({
      channel: 'telegram',
      telegramLink: `https://t.me/${botUser}?start=${token}`,
      message: 'Öffne Telegram und tippe auf „Start“, um den Alarm zu aktivieren.',
    })
  }

  // --- Web-Push: Subscription speichern (sofort aktiv – Browser-Erlaubnis = Opt-In) ---
  if (channel === 'push') {
    const sub = body.subscription
    if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
      return c.json({ error: 'invalid_subscription', message: 'Push-Anmeldung unvollständig.' }, 400)
    }
    const dest = JSON.stringify(sub)
    const freeMax = Number(c.env.FREE_MAX_SUBSCRIPTIONS || '1')

    const existing = await db
      .prepare("SELECT id FROM subscriptions WHERE channel='push' AND destination=? AND product_key=?")
      .bind(dest, productKey)
      .first<{ id: string }>()
    if (existing) return c.json({ status: 'confirmed', message: 'Für dieses Produkt ist dein Push-Alarm bereits aktiv.' })

    const active = await db
      .prepare("SELECT COUNT(*) AS n FROM subscriptions WHERE channel='push' AND destination=? AND status='confirmed'")
      .bind(dest)
      .first<{ n: number }>()
    if ((active?.n ?? 0) >= freeMax) {
      return c.json(
        { error: 'free_limit', message: `Im kostenlosen Tarif kannst du ${freeMax === 1 ? 'ein Produkt' : `${freeMax} Produkte`} beobachten. Mehr gibt es bald mit Pro.` },
        409,
      )
    }

    const id = crypto.randomUUID()
    const token = crypto.randomUUID()
    await db
      .prepare(
        "INSERT INTO subscriptions (id, channel, destination, product_key, product_label, status, token, created_at, confirmed_at) VALUES (?, 'push', ?, ?, ?, 'confirmed', ?, ?, ?)",
      )
      .bind(id, dest, productKey, productLabel, token, now(), now())
      .run()
    return c.json({ status: 'confirmed', message: 'Push-Alarm aktiv! Wir melden uns beim nächsten Preistief.' })
  }

  // --- E-Mail: Double-Opt-In ------------------------------------------------
  const email = (body.email ?? '').trim().toLowerCase()
  if (!EMAIL_RE.test(email)) return c.json({ error: 'invalid_email', message: 'Bitte gib eine gültige E-Mail-Adresse an.' }, 400)

  const freeMax = Number(c.env.FREE_MAX_SUBSCRIPTIONS || '1')
  const apiOrigin = new URL(c.req.url).origin
  const confirmLink = (token: string) => `${apiOrigin}/api/confirm?token=${token}`

  const existing = await db
    .prepare("SELECT id, status, token FROM subscriptions WHERE channel='email' AND destination=? AND product_key=?")
    .bind(email, productKey)
    .first<{ id: string; status: string; token: string }>()

  if (existing) {
    if (existing.status === 'confirmed') {
      return c.json({ status: 'confirmed', message: 'Für dieses Produkt ist dein Alarm bereits aktiv.' })
    }
    await db.prepare("UPDATE subscriptions SET status='pending', created_at=? WHERE id=?").bind(now(), existing.id).run()
    await sendEmail(c.env, { to: email, ...confirmEmail(productLabel, confirmLink(existing.token)) })
    return c.json({ status: 'pending', resent: true, message: 'Wir haben dir die Bestätigungsmail erneut geschickt.' })
  }

  const active = await db
    .prepare("SELECT COUNT(*) AS n FROM subscriptions WHERE channel='email' AND destination=? AND status IN ('pending','confirmed')")
    .bind(email)
    .first<{ n: number }>()
  if ((active?.n ?? 0) >= freeMax) {
    return c.json(
      { error: 'free_limit', message: `Im kostenlosen Tarif kannst du ${freeMax === 1 ? 'ein Produkt' : `${freeMax} Produkte`} beobachten. Mehr gibt es bald mit Pro.` },
      409,
    )
  }

  const id = crypto.randomUUID()
  const token = crypto.randomUUID()
  await db
    .prepare(
      "INSERT INTO subscriptions (id, channel, destination, product_key, product_label, status, token, created_at) VALUES (?, 'email', ?, ?, ?, 'pending', ?, ?)",
    )
    .bind(id, email, productKey, productLabel, token, now())
    .run()
  await sendEmail(c.env, { to: email, ...confirmEmail(productLabel, confirmLink(token)) })
  return c.json({ status: 'pending', message: 'Fast geschafft! Bitte bestätige den Link in deiner E-Mail.' })
})

app.get('/api/confirm', async (c) => {
  const token = c.req.query('token') ?? ''
  if (!token) return statusPage(c.env, 'Ungültiger Link', 'Dieser Bestätigungslink ist unvollständig.')
  const res = await c.env.DB
    .prepare("UPDATE subscriptions SET status='confirmed', confirmed_at=? WHERE token=? AND status='pending'")
    .bind(now(), token)
    .run()
  if (res.meta.changes > 0) {
    return statusPage(c.env, 'Alarm aktiv ✅', 'Dein Bestpreis-Alarm ist bestätigt. Wir melden uns, sobald dein Produkt ein neues Preistief erreicht.')
  }
  const sub = await c.env.DB.prepare('SELECT status FROM subscriptions WHERE token=?').bind(token).first<{ status: string }>()
  if (sub?.status === 'confirmed') return statusPage(c.env, 'Bereits bestätigt', 'Dieser Alarm war schon aktiv – alles gut.')
  return statusPage(c.env, 'Link ungültig', 'Dieser Bestätigungslink ist ungültig oder abgelaufen.')
})

app.get('/api/unsubscribe', async (c) => {
  const token = c.req.query('token') ?? ''
  if (!token) return statusPage(c.env, 'Ungültiger Link', 'Dieser Abmeldelink ist unvollständig.')
  await c.env.DB.prepare("UPDATE subscriptions SET status='unsubscribed' WHERE token=?").bind(token).run()
  return statusPage(c.env, 'Abgemeldet', 'Du erhältst für dieses Produkt keine Bestpreis-Alarme mehr.')
})

// --- Telegram-Webhook: /start <token> bindet chat_id, /stop meldet ab ------
app.post('/api/telegram/webhook', async (c) => {
  const secret = c.env.TELEGRAM_WEBHOOK_SECRET
  if (secret && c.req.header('x-telegram-bot-api-secret-token') !== secret) return c.json({ ok: false }, 401)

  const update = (await c.req.json().catch(() => null)) as {
    message?: { text?: string; chat?: { id?: number | string } }
    edited_message?: { text?: string; chat?: { id?: number | string } }
  } | null
  const msg = update?.message ?? update?.edited_message
  const chatId = String(msg?.chat?.id ?? '')
  const text = (msg?.text ?? '').trim()
  if (!chatId) return c.json({ ok: true })

  const db = c.env.DB
  const freeMax = Number(c.env.FREE_MAX_SUBSCRIPTIONS || '1')

  if (text.startsWith('/start')) {
    const token = text.split(/\s+/)[1] ?? ''
    if (!token) {
      await sendTelegram(c.env, chatId, 'Willkommen bei FindMyEnergy ⚡ Aktiviere deinen Bestpreis-Alarm über den Button auf der Website.')
      return c.json({ ok: true })
    }
    const sub = await db
      .prepare("SELECT id, product_key, product_label FROM subscriptions WHERE channel='telegram' AND token=? AND destination LIKE 'pending:%'")
      .bind(token)
      .first<{ id: string; product_key: string; product_label: string }>()
    if (!sub) {
      await sendTelegram(c.env, chatId, 'Dieser Aktivierungslink ist ungültig oder wurde bereits verwendet.')
      return c.json({ ok: true })
    }

    // Free-Limit pro Chat.
    const active = await db
      .prepare("SELECT COUNT(*) AS n FROM subscriptions WHERE channel='telegram' AND destination=? AND status='confirmed'")
      .bind(chatId)
      .first<{ n: number }>()
    if ((active?.n ?? 0) >= freeMax) {
      await db.prepare('DELETE FROM subscriptions WHERE id=?').bind(sub.id).run()
      await sendTelegram(c.env, chatId, `Im kostenlosen Tarif kannst du ${freeMax === 1 ? 'ein Produkt' : `${freeMax} Produkte`} beobachten. Mehr gibt es bald mit Pro.`)
      return c.json({ ok: true })
    }

    // Schon dasselbe Produkt aktiv? Dann pending verwerfen.
    const dup = await db
      .prepare("SELECT id FROM subscriptions WHERE channel='telegram' AND destination=? AND product_key=? AND status='confirmed'")
      .bind(chatId, sub.product_key)
      .first<{ id: string }>()
    if (dup) {
      await db.prepare('DELETE FROM subscriptions WHERE id=?').bind(sub.id).run()
      await sendTelegram(c.env, chatId, `„${sub.product_label}“ ist bereits aktiv.`)
      return c.json({ ok: true })
    }

    await db.prepare("UPDATE subscriptions SET destination=?, status='confirmed', confirmed_at=? WHERE id=?").bind(chatId, now(), sub.id).run()
    await sendTelegram(c.env, chatId, `✅ Bestpreis-Alarm aktiv für „${sub.product_label}“. Ich melde mich, sobald es ein neues Preistief gibt. Mit /stop meldest du dich wieder ab.`)
    return c.json({ ok: true })
  }

  if (text.startsWith('/stop')) {
    await db.prepare("UPDATE subscriptions SET status='unsubscribed' WHERE channel='telegram' AND destination=? AND status='confirmed'").bind(chatId).run()
    await sendTelegram(c.env, chatId, 'Du bist abgemeldet – keine Bestpreis-Alarme mehr.')
    return c.json({ ok: true })
  }

  await sendTelegram(c.env, chatId, 'Aktiviere deinen Bestpreis-Alarm über den Button auf der FindMyEnergy-Website.')
  return c.json({ ok: true })
})

export default app
