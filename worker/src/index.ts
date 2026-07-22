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
import Stripe from 'stripe'
import { type Env, sendEmail, confirmEmail, statusPage } from './email'
import { sendTelegram } from './telegram'

const app = new Hono<{ Bindings: Env }>()

// CORS nur für die konfigurierte Origin (die statische Seite). Der Telegram-
// Webhook wird server-zu-server aufgerufen und ist davon unberührt.
app.use('/api/*', (c, next) => cors({ origin: c.env.ALLOWED_ORIGIN || '*', allowMethods: ['GET', 'POST', 'OPTIONS'] })(c, next))

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const now = () => new Date().toISOString()

/** Zielpreis + Metrik aus dem Body lesen. `invalid`, wenn ein Wert vorliegt, der nicht > 0 ist. */
function parseTarget(body: { targetPrice?: number | string | null; targetMetric?: string }): {
  price: number | null
  metric: string | null
  invalid: boolean
} {
  if (body.targetPrice == null || body.targetPrice === '') return { price: null, metric: null, invalid: false }
  const p = Number(body.targetPrice)
  if (!Number.isFinite(p) || p <= 0) return { price: null, metric: null, invalid: true }
  return { price: Math.round(p * 100) / 100, metric: body.targetMetric === 'liter' ? 'liter' : 'unit', invalid: false }
}

/** Hat dieses Ziel (channel, destination) ein gültiges Pro-Entitlement? */
async function isPro(db: D1Database, channel: string, destination: string): Promise<boolean> {
  const row = await db
    .prepare(
      "SELECT 1 AS x FROM entitlements WHERE channel=? AND destination=? AND tier='pro' AND (valid_until IS NULL OR valid_until > ?) LIMIT 1",
    )
    .bind(channel, destination, now())
    .first()
  return !!row
}

/**
 * Legt ein Entitlement an oder verlängert es (späteres Ende gewinnt; NULL =
 * unbegrenzt schlägt alles). Gemeinsame Stelle für Redeem-Codes UND Stripe,
 * je Kanal (E-Mail / Telegram-chat_id / Push-Subscription).
 */
async function grantEntitlement(db: D1Database, channel: string, destination: string, tier: string, source: string, validUntil: string | null): Promise<void> {
  const existing = await db
    .prepare('SELECT id, valid_until FROM entitlements WHERE channel=? AND destination=? AND tier=?')
    .bind(channel, destination, tier)
    .first<{ id: string; valid_until: string | null }>()
  if (existing) {
    const keep = existing.valid_until === null || validUntil === null ? null : existing.valid_until > validUntil ? existing.valid_until : validUntil
    await db.prepare('UPDATE entitlements SET valid_until=?, source=? WHERE id=?').bind(keep, source, existing.id).run()
  } else {
    await db
      .prepare('INSERT INTO entitlements (id, channel, destination, tier, source, valid_until, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(crypto.randomUUID(), channel, destination, tier, source, validUntil, now())
      .run()
  }
}

/** Entzieht ein Entitlement (läuft ab jetzt aus). */
async function revokeEntitlement(db: D1Database, channel: string, destination: string, tier: string): Promise<void> {
  await db.prepare('UPDATE entitlements SET valid_until=? WHERE channel=? AND destination=? AND tier=?').bind(now(), channel, destination, tier).run()
}

/** Löst einen Redeem-Code ein und schreibt das Entitlement (gemeinsam für Web & Bot). */
async function consumeRedeemCode(
  db: D1Database,
  code: string,
  channel: string,
  destination: string,
): Promise<{ ok: true; tier: string; validUntil: string | null } | { ok: false; error: string }> {
  const rc = await db
    .prepare('SELECT tier, valid_days, max_uses, uses FROM redeem_codes WHERE code=?')
    .bind(code)
    .first<{ tier: string; valid_days: number | null; max_uses: number; uses: number }>()
  if (!rc) return { ok: false, error: 'invalid_code' }
  if (rc.uses >= rc.max_uses) return { ok: false, error: 'code_used' }
  const validUntil = rc.valid_days ? new Date(Date.now() + rc.valid_days * 86_400_000).toISOString() : null
  await grantEntitlement(db, channel, destination, rc.tier, `redeem:${code}`, validUntil)
  await db.prepare('UPDATE redeem_codes SET uses=uses+1 WHERE code=?').bind(code).run()
  return { ok: true, tier: rc.tier, validUntil }
}

app.get('/api/health', (c) => c.json({ ok: true }))

app.post('/api/subscribe', async (c) => {
  let body: {
    email?: string
    channel?: string
    productKey?: string
    productLabel?: string
    subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
    targetPrice?: number | string | null
    targetMetric?: string // 'unit' | 'liter'
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
    const tgTarget = parseTarget(body)
    if (tgTarget.invalid) return c.json({ error: 'invalid_target', message: 'Bitte gib einen gültigen Zielpreis an.' }, 400)
    // Pro wird erst beim Binden (/start, chat_id bekannt) geprüft; ein Zielpreis
    // ohne Pro wird dort verworfen.
    const id = crypto.randomUUID()
    const token = crypto.randomUUID()
    await db
      .prepare(
        "INSERT INTO subscriptions (id, channel, destination, product_key, product_label, status, token, created_at, target_price, target_metric) VALUES (?, 'telegram', ?, ?, ?, 'pending', ?, ?, ?, ?)",
      )
      .bind(id, `pending:${token}`, productKey, productLabel, token, now(), tgTarget.price, tgTarget.metric)
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
    const pushPro = await isPro(db, 'push', dest)

    const t = parseTarget(body)
    if (t.invalid) return c.json({ error: 'invalid_target', message: 'Bitte gib einen gültigen Zielpreis an.' }, 400)
    if (t.price != null && !pushPro) return c.json({ error: 'pro_required', message: 'Der Preiswecker ist eine Pro-Funktion. Löse einen Pro-Code ein.' }, 402)

    const existing = await db
      .prepare("SELECT id FROM subscriptions WHERE channel='push' AND destination=? AND product_key=?")
      .bind(dest, productKey)
      .first<{ id: string }>()
    if (existing) {
      await db.prepare('UPDATE subscriptions SET target_price=?, target_metric=?, notified_at=NULL WHERE id=?').bind(t.price, t.metric, existing.id).run()
      return c.json({ status: 'confirmed', message: t.price != null ? 'Preiswecker aktualisiert.' : 'Für dieses Produkt ist dein Push-Alarm bereits aktiv.' })
    }

    if (!pushPro) {
      const active = await db
        .prepare("SELECT COUNT(*) AS n FROM subscriptions WHERE channel='push' AND destination=? AND status='confirmed'")
        .bind(dest)
        .first<{ n: number }>()
      if ((active?.n ?? 0) >= freeMax) {
        return c.json(
          { error: 'free_limit', message: `Im kostenlosen Tarif kannst du ${freeMax === 1 ? 'ein Produkt' : `${freeMax} Produkte`} beobachten. Mit Pro sind es beliebig viele.` },
          409,
        )
      }
    }

    const id = crypto.randomUUID()
    const token = crypto.randomUUID()
    await db
      .prepare(
        "INSERT INTO subscriptions (id, channel, destination, product_key, product_label, status, token, created_at, confirmed_at, target_price, target_metric) VALUES (?, 'push', ?, ?, ?, 'confirmed', ?, ?, ?, ?, ?)",
      )
      .bind(id, dest, productKey, productLabel, token, now(), now(), t.price, t.metric)
      .run()
    return c.json({ status: 'confirmed', message: 'Push-Alarm aktiv! Wir melden uns beim nächsten Preistief.' })
  }

  // --- E-Mail: Double-Opt-In ------------------------------------------------
  const email = (body.email ?? '').trim().toLowerCase()
  if (!EMAIL_RE.test(email)) return c.json({ error: 'invalid_email', message: 'Bitte gib eine gültige E-Mail-Adresse an.' }, 400)

  const pro = await isPro(db, 'email', email)

  // Preiswecker (Pro): Zielpreis + Metrik. Ohne Ziel => Free-Verhalten (neues Tief).
  const t = parseTarget(body)
  if (t.invalid) return c.json({ error: 'invalid_target', message: 'Bitte gib einen gültigen Zielpreis an.' }, 400)
  if (t.price != null && !pro) return c.json({ error: 'pro_required', message: 'Der Preiswecker ist eine Pro-Funktion. Löse einen Pro-Code ein.' }, 402)
  const targetPrice = t.price
  const targetMetric = t.metric

  const freeMax = Number(c.env.FREE_MAX_SUBSCRIPTIONS || '1')
  const apiOrigin = new URL(c.req.url).origin
  const confirmLink = (token: string) => `${apiOrigin}/api/confirm?token=${token}`

  const existing = await db
    .prepare("SELECT id, status, token FROM subscriptions WHERE channel='email' AND destination=? AND product_key=?")
    .bind(email, productKey)
    .first<{ id: string; status: string; token: string }>()

  if (existing) {
    // Zielpreis eines bestehenden Abos aktualisieren (auch löschen via null).
    await db
      .prepare('UPDATE subscriptions SET target_price=?, target_metric=?, notified_at=NULL WHERE id=?')
      .bind(targetPrice, targetMetric, existing.id)
      .run()
    if (existing.status === 'confirmed') {
      return c.json({ status: 'confirmed', message: targetPrice != null ? 'Preiswecker aktualisiert.' : 'Für dieses Produkt ist dein Alarm bereits aktiv.' })
    }
    await db.prepare("UPDATE subscriptions SET status='pending', created_at=? WHERE id=?").bind(now(), existing.id).run()
    await sendEmail(c.env, { to: email, ...confirmEmail(productLabel, confirmLink(existing.token)) })
    return c.json({ status: 'pending', resent: true, message: 'Wir haben dir die Bestätigungsmail erneut geschickt.' })
  }

  // Free-Limit nur für Nicht-Pro (Pro darf beliebig viele Produkte).
  if (!pro) {
    const active = await db
      .prepare("SELECT COUNT(*) AS n FROM subscriptions WHERE channel='email' AND destination=? AND status IN ('pending','confirmed')")
      .bind(email)
      .first<{ n: number }>()
    if ((active?.n ?? 0) >= freeMax) {
      return c.json(
        { error: 'free_limit', message: `Im kostenlosen Tarif kannst du ${freeMax === 1 ? 'ein Produkt' : `${freeMax} Produkte`} beobachten. Mit Pro sind es beliebig viele.` },
        409,
      )
    }
  }

  const id = crypto.randomUUID()
  const token = crypto.randomUUID()
  await db
    .prepare(
      "INSERT INTO subscriptions (id, channel, destination, product_key, product_label, status, token, created_at, target_price, target_metric) VALUES (?, 'email', ?, ?, ?, 'pending', ?, ?, ?, ?)",
    )
    .bind(id, email, productKey, productLabel, token, now(), targetPrice, targetMetric)
    .run()
  await sendEmail(c.env, { to: email, ...confirmEmail(productLabel, confirmLink(token)) })
  return c.json({ status: 'pending', message: 'Fast geschafft! Bitte bestätige den Link in deiner E-Mail.' })
})

// --- Pro-Status abfragen (für die UI; E-Mail & Push) ----------------------
app.get('/api/entitlement', async (c) => {
  const email = (c.req.query('email') ?? '').trim().toLowerCase()
  if (!EMAIL_RE.test(email)) return c.json({ pro: false })
  return c.json({ pro: await isPro(c.env.DB, 'email', email) })
})

// --- Pro-Code einlösen (Web: E-Mail oder Push; Telegram via Bot) -----------
app.post('/api/redeem', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    code?: string
    channel?: string
    email?: string
    subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
  }
  const code = (body.code ?? '').trim()
  const channel = (body.channel ?? 'email').trim()
  if (!code) return c.json({ error: 'missing_code', message: 'Bitte gib einen Code ein.' }, 400)

  let destination: string
  if (channel === 'push') {
    const sub = body.subscription
    if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) return c.json({ error: 'invalid_subscription', message: 'Push-Anmeldung unvollständig.' }, 400)
    destination = JSON.stringify(sub)
  } else if (channel === 'email') {
    const email = (body.email ?? '').trim().toLowerCase()
    if (!EMAIL_RE.test(email)) return c.json({ error: 'invalid_email', message: 'Bitte gib eine gültige E-Mail-Adresse an.' }, 400)
    destination = email
  } else {
    return c.json({ error: 'unsupported_channel', message: 'Für Telegram löse den Code im Bot ein: /redeem <code>.' }, 400)
  }

  const result = await consumeRedeemCode(c.env.DB, code, channel, destination)
  if (!result.ok) {
    const msg = result.error === 'code_used' ? 'Dieser Code wurde bereits aufgebraucht.' : 'Dieser Code ist ungültig.'
    return c.json({ error: result.error, message: msg }, result.error === 'code_used' ? 409 : 404)
  }
  return c.json({ tier: result.tier, validUntil: result.validUntil, message: 'Pro freigeschaltet – du kannst jetzt Preiswecker setzen.' })
})

// --- Stripe: Checkout starten ---------------------------------------------
function stripeClient(env: Env): Stripe {
  return new Stripe(env.STRIPE_SECRET_KEY!, { httpClient: Stripe.createFetchHttpClient() })
}

app.post('/api/checkout', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { email?: string; plan?: string }
  const email = (body.email ?? '').trim().toLowerCase()
  const plan = body.plan ?? ''
  if (!EMAIL_RE.test(email)) return c.json({ error: 'invalid_email', message: 'Bitte gib eine gültige E-Mail-Adresse an.' }, 400)

  const priceByPlan: Record<string, string | undefined> = {
    monthly: c.env.STRIPE_PRICE_MONTHLY,
    yearly: c.env.STRIPE_PRICE_YEARLY,
    lifetime: c.env.STRIPE_PRICE_LIFETIME,
  }
  const price = priceByPlan[plan]
  if (!c.env.STRIPE_SECRET_KEY || !price) {
    return c.json({ error: 'stripe_unconfigured', message: 'Die Zahlung ist noch nicht eingerichtet.' }, 503)
  }

  const mode = plan === 'lifetime' ? 'payment' : 'subscription'
  const site = c.env.PUBLIC_SITE_URL
  const meta = { email, tier: 'pro', plan }
  const session = await stripeClient(c.env).checkout.sessions.create({
    mode,
    line_items: [{ price, quantity: 1 }],
    customer_email: email,
    client_reference_id: email,
    metadata: meta,
    // Abo-Events tragen die Metadaten mit, damit der Webhook die E-Mail kennt.
    ...(mode === 'subscription' ? { subscription_data: { metadata: meta } } : {}),
    success_url: `${site}/?pro=success`,
    cancel_url: `${site}/?pro=cancel`,
  })
  return c.json({ url: session.url })
})

// --- Stripe: Webhook (schreibt/entzieht das Entitlement) -------------------
app.post('/api/stripe/webhook', async (c) => {
  const sig = c.req.header('stripe-signature')
  if (!c.env.STRIPE_SECRET_KEY || !c.env.STRIPE_WEBHOOK_SECRET || !sig) return c.json({ error: 'unconfigured' }, 400)
  const stripe = stripeClient(c.env)
  const raw = await c.req.text()

  let event: Stripe.Event
  try {
    // In Workers async + WebCrypto (SubtleCryptoProvider), nicht das sync constructEvent.
    event = await stripe.webhooks.constructEventAsync(raw, sig, c.env.STRIPE_WEBHOOK_SECRET, undefined, Stripe.createSubtleCryptoProvider())
  } catch {
    return c.json({ error: 'bad_signature' }, 400)
  }

  const db = c.env.DB
  const untilFromSub = (sub: Stripe.Subscription) => new Date(sub.current_period_end * 1000).toISOString()

  switch (event.type) {
    case 'checkout.session.completed': {
      const s = event.data.object
      const email = (s.metadata?.email || s.customer_details?.email || '').toLowerCase()
      if (!email) break
      if (s.mode === 'payment') {
        await grantEntitlement(db, 'email', email, 'pro', `stripe:${s.id}`, null) // Lifetime
      } else if (s.mode === 'subscription' && s.subscription) {
        const sub = await stripe.subscriptions.retrieve(String(s.subscription))
        await grantEntitlement(db, 'email', email, 'pro', `stripe:${sub.id}`, untilFromSub(sub))
      }
      break
    }
    case 'invoice.paid': {
      const inv = event.data.object
      const subId = inv.subscription ? String(inv.subscription) : null
      if (!subId) break
      const sub = await stripe.subscriptions.retrieve(subId)
      const email = (sub.metadata?.email || inv.customer_email || '').toLowerCase()
      if (email) await grantEntitlement(db, 'email', email, 'pro', `stripe:${subId}`, untilFromSub(sub))
      break
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object
      const email = (sub.metadata?.email || '').toLowerCase()
      if (email) await revokeEntitlement(db, 'email', email, 'pro')
      break
    }
  }
  return c.json({ received: true })
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

  // Pro per Code im Bot freischalten (Entitlement an die chat_id).
  if (text.startsWith('/redeem')) {
    const code = text.split(/\s+/)[1] ?? ''
    if (!code) {
      await sendTelegram(c.env, chatId, 'Bitte gib deinen Code an: /redeem DEIN-CODE')
      return c.json({ ok: true })
    }
    const r = await consumeRedeemCode(db, code, 'telegram', chatId)
    await sendTelegram(
      c.env,
      chatId,
      r.ok
        ? '✅ Pro freigeschaltet – du kannst jetzt mehrere Produkte beobachten und Preiswecker nutzen.'
        : r.error === 'code_used'
          ? 'Dieser Code wurde bereits aufgebraucht.'
          : 'Dieser Code ist ungültig.',
    )
    return c.json({ ok: true })
  }

  if (text.startsWith('/start')) {
    const token = text.split(/\s+/)[1] ?? ''
    if (!token) {
      await sendTelegram(c.env, chatId, 'Willkommen bei FindMyEnergy ⚡ Aktiviere deinen Bestpreis-Alarm über den Button auf der Website.')
      return c.json({ ok: true })
    }
    const sub = await db
      .prepare("SELECT id, product_key, product_label, target_price FROM subscriptions WHERE channel='telegram' AND token=? AND destination LIKE 'pending:%'")
      .bind(token)
      .first<{ id: string; product_key: string; product_label: string; target_price: number | null }>()
    if (!sub) {
      await sendTelegram(c.env, chatId, 'Dieser Aktivierungslink ist ungültig oder wurde bereits verwendet.')
      return c.json({ ok: true })
    }

    const pro = await isPro(db, 'telegram', chatId)

    // Free-Limit pro Chat (Pro umgeht es).
    if (!pro) {
      const active = await db
        .prepare("SELECT COUNT(*) AS n FROM subscriptions WHERE channel='telegram' AND destination=? AND status='confirmed'")
        .bind(chatId)
        .first<{ n: number }>()
      if ((active?.n ?? 0) >= freeMax) {
        await db.prepare('DELETE FROM subscriptions WHERE id=?').bind(sub.id).run()
        await sendTelegram(c.env, chatId, `Im kostenlosen Tarif kannst du ${freeMax === 1 ? 'ein Produkt' : `${freeMax} Produkte`} beobachten. Mit /redeem <code> schaltest du Pro frei.`)
        return c.json({ ok: true })
      }
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

    // Preiswecker nur für Pro; sonst verwerfen und normaler Bestpreis-Alarm.
    let extra = ''
    if (sub.target_price != null && !pro) {
      await db.prepare('UPDATE subscriptions SET target_price=NULL, target_metric=NULL WHERE id=?').bind(sub.id).run()
      extra = ' Der Preiswecker ist Pro – mit /redeem <code> schaltest du ihn frei; bis dahin bekommst du den normalen Bestpreis-Alarm.'
    } else if (sub.target_price != null && pro) {
      extra = ' Dein Preiswecker ist aktiv.'
    }

    await db.prepare("UPDATE subscriptions SET destination=?, status='confirmed', confirmed_at=? WHERE id=?").bind(chatId, now(), sub.id).run()
    await sendTelegram(c.env, chatId, `✅ Bestpreis-Alarm aktiv für „${sub.product_label}“.${extra} Mit /stop meldest du dich wieder ab.`)
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
