// EnergyHunt – Bestpreis-Alarm-API (Cloudflare Worker + D1).
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

import { Hono, type Context } from 'hono'
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

/**
 * Marken-basierter Wecker: pro gewählter Marke eine Subscription (scope='brand',
 * product_key='brand:<norm>'), optional Store-Filter und Zielpreis je Marke.
 * Alle Marken einer Anlage teilen sich EINEN Bestätigungs-Token (eine Opt-in-Mail
 * bzw. ein Telegram-Deep-Link bindet alle). Free = 1 Marke ohne Zielpreis;
 * mehrere Marken oder Zielpreise erfordern Pro (Telegram: Prüfung beim Binden).
 */
async function handleBrandSubscribe(
  c: Context<{ Bindings: Env }>,
  body: {
    email?: string
    subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
    brands?: { brand?: string; targetPrice?: number | string | null; targetMetric?: string }[]
    storeMode?: string
    stores?: string[]
  },
  channel: string,
  db: D1Database,
): Promise<Response> {
  const storeMode = body.storeMode === 'only' || body.storeMode === 'except' ? body.storeMode : 'all'
  const storesJson = storeMode === 'all' ? null : JSON.stringify(Array.isArray(body.stores) ? body.stores.map(String) : [])

  const brands = (Array.isArray(body.brands) ? body.brands : [])
    .map((b) => {
      const display = String(b.brand ?? '').trim()
      return { display, norm: display.toLowerCase(), t: parseTarget(b) }
    })
    .filter((b) => b.display)
  if (brands.length === 0) return c.json({ error: 'missing_brands', message: 'Bitte wähle mindestens eine Marke.' }, 400)
  if (brands.some((b) => b.t.invalid)) return c.json({ error: 'invalid_target', message: 'Bitte gib gültige Zielpreise an.' }, 400)

  const wantsTarget = brands.some((b) => b.t.price != null)
  const multi = brands.length > 1
  const isTelegram = channel === 'telegram'
  const freeMax = Number(c.env.FREE_MAX_SUBSCRIPTIONS || '1')

  // Ziel-Identität + Pro (Telegram erst beim Binden bekannt).
  let destination = ''
  let pro = false
  if (channel === 'email') {
    destination = String(body.email ?? '').trim().toLowerCase()
    if (!EMAIL_RE.test(destination)) return c.json({ error: 'invalid_email', message: 'Bitte gib eine gültige E-Mail-Adresse an.' }, 400)
    pro = await isPro(db, 'email', destination)
  } else if (channel === 'push') {
    const sub = body.subscription
    if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) return c.json({ error: 'invalid_subscription', message: 'Push-Anmeldung unvollständig.' }, 400)
    destination = JSON.stringify(sub)
    pro = await isPro(db, 'push', destination)
  } else if (!isTelegram) {
    return c.json({ error: 'bad_channel' }, 400)
  }

  if (!isTelegram && (wantsTarget || multi) && !pro) {
    return c.json({ error: 'pro_required', message: 'Mehrere Marken oder Zielpreise sind eine Pro-Funktion. Schalte Pro frei.' }, 402)
  }
  if (!isTelegram && !pro) {
    const active = await db
      .prepare("SELECT COUNT(*) AS n FROM subscriptions WHERE channel=? AND destination=? AND status IN ('pending','confirmed')")
      .bind(channel, destination)
      .first<{ n: number }>()
    if ((active?.n ?? 0) + brands.length > freeMax) {
      return c.json({ error: 'free_limit', message: `Im kostenlosen Tarif kannst du ${freeMax === 1 ? 'eine Marke' : `${freeMax} Marken`} beobachten. Mit Pro sind es beliebig viele.` }, 409)
    }
  }

  const token = crypto.randomUUID()
  const status = channel === 'push' ? 'confirmed' : 'pending'
  const dbDest = isTelegram ? `pending:${token}` : destination
  for (const b of brands) {
    await db
      .prepare(
        "INSERT INTO subscriptions (id, channel, destination, scope, brand, product_key, product_label, store_mode, stores, status, token, created_at, confirmed_at, target_price, target_metric) " +
          "VALUES (?, ?, ?, 'brand', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) " +
          'ON CONFLICT(channel, destination, product_key) DO UPDATE SET store_mode=excluded.store_mode, stores=excluded.stores, target_price=excluded.target_price, target_metric=excluded.target_metric, notified_at=NULL',
      )
      .bind(crypto.randomUUID(), channel, dbDest, b.norm, `brand:${b.norm}`, b.display, storeMode, storesJson, status, token, now(), status === 'confirmed' ? now() : null, b.t.price, b.t.metric)
      .run()
  }

  if (channel === 'email') {
    const apiOrigin = new URL(c.req.url).origin
    const list = brands.map((b) => b.display).join(', ')
    await sendEmail(c.env, { to: destination, ...confirmEmail(list, `${apiOrigin}/api/confirm?token=${token}`) })
    return c.json({ status: 'pending', message: 'Fast geschafft! Bitte bestätige den Link in deiner E-Mail.' })
  }
  if (channel === 'push') {
    return c.json({ status: 'confirmed', message: 'Marken-Wecker aktiv! Wir melden uns beim nächsten Tief.' })
  }
  const botUser = c.env.TELEGRAM_BOT_USERNAME
  if (!botUser) return c.json({ error: 'telegram_unconfigured', message: 'Telegram ist noch nicht eingerichtet.' }, 503)
  return c.json({ channel: 'telegram', telegramLink: `https://t.me/${botUser}?start=${token}`, message: 'Öffne Telegram und tippe auf „Start“, um die Wecker zu aktivieren.' })
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
    // Marken-Wecker (scope='brand')
    scope?: string
    brands?: { brand?: string; targetPrice?: number | string | null; targetMetric?: string }[]
    storeMode?: string
    stores?: string[]
  }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'bad_json' }, 400)
  }

  const channel = (body.channel ?? 'email').trim()
  const db = c.env.DB

  // Marken-basierter Wecker (nicht produktgebunden) – eigener Pfad.
  if ((body.scope ?? 'product') === 'brand') return handleBrandSubscribe(c, body, channel, db)

  const productKey = (body.productKey ?? '').trim()
  const productLabel = (body.productLabel ?? '').trim()
  if (!productKey || !productLabel) return c.json({ error: 'missing_product' }, 400)

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

// --- Community-Preismeldungen ----------------------------------------------

/** SHA-256-Hex einer Zeichenkette (für IP-Hash: privatschonender als Klartext). */
async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

const REPORT_RATE_MAX = 5 // Meldungen pro IP und Stunde
const clip = (s: unknown, max: number) => String(s ?? '').trim().slice(0, max)

// Nutzer meldet einen (günstigeren) Preis für ein bestehendes Angebot.
// Landet als 'pending' – wird NIE automatisch veröffentlicht.
app.post('/api/report-price', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    productKey?: string
    brand?: string
    title?: string
    market?: string
    price?: number | string
    storeLocation?: string
    note?: string
  }
  const productKey = clip(body.productKey, 200)
  const brand = clip(body.brand, 80)
  const title = clip(body.title, 160)
  const market = clip(body.market, 80)
  if (!productKey || !brand || !title || !market) {
    return c.json({ error: 'missing_fields', message: 'Angebotsdaten unvollständig.' }, 400)
  }
  const price = Number(body.price)
  if (!Number.isFinite(price) || price <= 0 || price > 999) {
    return c.json({ error: 'invalid_price', message: 'Bitte gib einen gültigen Preis an.' }, 400)
  }

  const db = c.env.DB
  const ipHash = await sha256Hex('energyhunt-report:' + (c.req.header('cf-connecting-ip') ?? 'unknown'))
  const since = new Date(Date.now() - 3_600_000).toISOString()
  const recent = await db
    .prepare('SELECT COUNT(*) AS n FROM price_reports WHERE ip_hash=? AND created_at>?')
    .bind(ipHash, since)
    .first<{ n: number }>()
  if ((recent?.n ?? 0) >= REPORT_RATE_MAX) {
    return c.json({ error: 'rate_limited', message: 'Danke! Du hast gerade viele Meldungen geschickt – bitte später erneut.' }, 429)
  }

  await db
    .prepare(
      'INSERT INTO price_reports (id, created_at, status, product_key, brand, title, market, reported_price, store_location, note, ip_hash) ' +
        "VALUES (?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(crypto.randomUUID(), now(), productKey, brand, title, market, Math.round(price * 100) / 100, clip(body.storeLocation, 80) || null, clip(body.note, 200) || null, ipHash)
    .run()
  return c.json({ ok: true, message: 'Danke für deine Meldung! Wir prüfen sie und zeigen sie dann an.' })
})

// Freigegebene Meldungen je Produkt – für den Community-Hinweis auf der Karte.
app.get('/api/reports/approved', async (c) => {
  const rows = (
    await c.env.DB
      .prepare("SELECT product_key, reported_price, market, store_location, note, created_at FROM price_reports WHERE status='approved' ORDER BY created_at DESC")
      .all<{ product_key: string; reported_price: number; market: string; store_location: string | null; note: string | null; created_at: string }>()
  ).results
  const byProduct: Record<string, { price: number; market: string; storeLocation: string | null; note: string | null; createdAt: string }[]> = {}
  for (const r of rows) {
    ;(byProduct[r.product_key] ??= []).push({ price: r.reported_price, market: r.market, storeLocation: r.store_location, note: r.note, createdAt: r.created_at })
  }
  return c.json({ reports: byProduct }, 200, { 'cache-control': 'public, max-age=120' })
})

// --- „Noch verfügbar?"-Votes -----------------------------------------------

const VOTE_RATE_MAX = 40 // Stimmen pro IP und Stunde
const VOTE_WINDOW_DAYS = 10 // nur Stimmen der letzten Tage zählen (Wochenangebote)

app.post('/api/vote', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { productKey?: string; vote?: string; voterId?: string }
  const productKey = clip(body.productKey, 200)
  const voterId = clip(body.voterId, 64)
  const vote = body.vote === 'up' ? 1 : body.vote === 'down' ? -1 : 0
  if (!productKey || !voterId || vote === 0) {
    return c.json({ error: 'invalid_vote', message: 'Ungültige Stimme.' }, 400)
  }

  const db = c.env.DB
  const ipHash = await sha256Hex('energyhunt-vote:' + (c.req.header('cf-connecting-ip') ?? 'unknown'))
  const since = new Date(Date.now() - 3_600_000).toISOString()
  const recent = await db.prepare('SELECT COUNT(*) AS n FROM availability_votes WHERE ip_hash=? AND created_at>?').bind(ipHash, since).first<{ n: number }>()
  if ((recent?.n ?? 0) >= VOTE_RATE_MAX) return c.json({ error: 'rate_limited', message: 'Zu viele Stimmen – bitte später.' }, 429)

  // Eine Stimme je (Produkt, Browser); Meinungsänderung aktualisiert sie.
  await db
    .prepare(
      'INSERT INTO availability_votes (id, created_at, product_key, vote, voter_id, ip_hash) VALUES (?, ?, ?, ?, ?, ?) ' +
        'ON CONFLICT(product_key, voter_id) DO UPDATE SET vote=excluded.vote, created_at=excluded.created_at, ip_hash=excluded.ip_hash',
    )
    .bind(crypto.randomUUID(), now(), productKey, vote, voterId, ipHash)
    .run()
  return c.json({ ok: true })
})

// Aggregierte Verfügbarkeits-Signale je Produkt (nur jüngste Stimmen).
app.get('/api/votes', async (c) => {
  const since = new Date(Date.now() - VOTE_WINDOW_DAYS * 86_400_000).toISOString()
  const rows = (
    await c.env.DB
      .prepare(
        'SELECT product_key, ' +
          'SUM(CASE WHEN vote=1 THEN 1 ELSE 0 END) AS up, ' +
          'SUM(CASE WHEN vote=-1 THEN 1 ELSE 0 END) AS down ' +
          'FROM availability_votes WHERE created_at>? GROUP BY product_key',
      )
      .bind(since)
      .all<{ product_key: string; up: number; down: number }>()
  ).results
  const votes: Record<string, { up: number; down: number }> = {}
  for (const r of rows) votes[r.product_key] = { up: r.up, down: r.down }
  return c.json({ votes }, 200, { 'cache-control': 'public, max-age=60' })
})

// --- Moderation (tokengeschützt) -------------------------------------------
const esc = (s: string) => s.replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[m]!)

app.get('/api/admin/reports', async (c) => {
  const token = c.req.query('token') ?? ''
  if (!c.env.MODERATION_TOKEN || token !== c.env.MODERATION_TOKEN) return c.text('Forbidden', 403)
  const rows = (
    await c.env.DB
      .prepare("SELECT id, created_at, product_key, brand, title, market, reported_price, store_location, note FROM price_reports WHERE status='pending' ORDER BY created_at ASC")
      .all<{ id: string; created_at: string; product_key: string; brand: string; title: string; market: string; reported_price: number; store_location: string | null; note: string | null }>()
  ).results
  const t = encodeURIComponent(token)
  const items = rows
    .map((r) => {
      const price = r.reported_price.toFixed(2).replace('.', ',')
      const extra = [r.store_location, r.note].filter(Boolean).map((x) => esc(x!)).join(' · ')
      return `<li style="border:1px solid #ddd;border-radius:10px;padding:12px;margin:0 0 10px;list-style:none">
        <b>${esc(r.brand)} ${esc(r.title)}</b> – <b style="color:#e24a08">${price} €</b> bei ${esc(r.market)}<br>
        <small style="color:#5b6772">${esc(r.product_key)}${extra ? ' · ' + extra : ''} · ${esc(r.created_at)}</small><br>
        <a href="/api/admin/reports/action?id=${r.id}&action=approve&token=${t}" style="color:#0a7d34;font-weight:650;margin-right:14px">✔ Freigeben</a>
        <a href="/api/admin/reports/action?id=${r.id}&action=reject&token=${t}" style="color:#b00020;font-weight:650">✕ Ablehnen</a>
      </li>`
    })
    .join('')
  const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Moderation – Preismeldungen</title>
    <div style="font-family:system-ui,sans-serif;max-width:760px;margin:24px auto;padding:0 16px">
    <h1 style="font-size:1.3rem">Preismeldungen · ${rows.length} offen</h1>
    <ul style="padding:0">${items || '<p style="color:#5b6772">Nichts zu moderieren. 🎉</p>'}</ul></div>`
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } })
})

app.get('/api/admin/reports/action', async (c) => {
  const token = c.req.query('token') ?? ''
  if (!c.env.MODERATION_TOKEN || token !== c.env.MODERATION_TOKEN) return c.text('Forbidden', 403)
  const id = c.req.query('id') ?? ''
  const action = c.req.query('action') ?? ''
  if (action !== 'approve' && action !== 'reject') return c.text('Bad action', 400)
  const status = action === 'approve' ? 'approved' : 'rejected'
  await c.env.DB.prepare("UPDATE price_reports SET status=?, moderated_at=? WHERE id=? AND status='pending'").bind(status, now(), id).run()
  // Zurück zur Liste.
  return Response.redirect(new URL(`/api/admin/reports?token=${encodeURIComponent(token)}`, c.req.url).toString(), 302)
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
  // current_period_end lag bis API 2025-02 auf der Subscription, ab 2025-03
  // (basil/dahlia) auf den Items. Beide Formen abfangen, mit sicherem Fallback.
  const untilFromSub = (sub: Stripe.Subscription): string => {
    const s = sub as Stripe.Subscription & {
      current_period_end?: number
      items?: { data?: { current_period_end?: number }[] }
    }
    const ts = s.current_period_end ?? s.items?.data?.[0]?.current_period_end
    return new Date((ts ? ts * 1000 : Date.now() + 32 * 86_400_000)).toISOString()
  }

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
      // inv.subscription (bis 2025-02) bzw. inv.parent.subscription_details.subscription (ab basil/dahlia).
      const inv = event.data.object as Stripe.Invoice & {
        subscription?: string | { id: string } | null
        parent?: { subscription_details?: { subscription?: string | { id: string } | null } | null } | null
      }
      const rawSub = inv.subscription ?? inv.parent?.subscription_details?.subscription ?? null
      const subId = rawSub ? (typeof rawSub === 'string' ? rawSub : rawSub.id) : null
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

/** Labels der aktiven (confirmed) Telegram-Abos einer chat_id – für klare Bot-Antworten. */
async function activeTelegramLabels(db: D1Database, chatId: string): Promise<string[]> {
  const rows = (
    await db
      .prepare("SELECT product_label FROM subscriptions WHERE channel='telegram' AND destination=? AND status='confirmed'")
      .bind(chatId)
      .all<{ product_label: string }>()
  ).results
  return rows.map((r) => r.product_label)
}

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
      // Telegram übergibt den ?start=-Parameter nur beim ERSTEN Öffnen des Bots.
      // Wer den Bot schon kennt, landet hier – dann lieber den Status zeigen.
      const active = await activeTelegramLabels(db, chatId)
      await sendTelegram(
        c.env,
        chatId,
        active.length
          ? `⚡ Dein Alarm läuft für: ${active.join(', ')}.\nMit /stop meldest du dich ab.`
          : 'Willkommen bei EnergyHunt ⚡ Aktiviere deinen Bestpreis-Alarm über den Button auf der Website.',
      )
      return c.json({ ok: true })
    }
    // Ein Token kann mehrere pending-Abos umfassen (Marken-Batch).
    const subs = (
      await db
        .prepare("SELECT id, product_key, product_label, target_price FROM subscriptions WHERE channel='telegram' AND token=? AND destination LIKE 'pending:%'")
        .bind(token)
        .all<{ id: string; product_key: string; product_label: string; target_price: number | null }>()
    ).results
    const active = await activeTelegramLabels(db, chatId)
    if (subs.length === 0) {
      // Kein wartendes Abo zu diesem Token. Häufigster Grund ist NICHT ein
      // kaputter Link, sondern: der Bot war schon gestartet (Telegram reicht den
      // neuen Token dann oft nicht durch) oder der Link wurde schon eingelöst.
      await sendTelegram(
        c.env,
        chatId,
        active.length
          ? `Dein Alarm läuft bereits für: ${active.join(', ')}.\n` +
              `Im kostenlosen Tarif ist ${freeMax === 1 ? 'eine Marke' : `${freeMax} Marken`} drin – für weitere Marken und Zielpreise gibt es Pro (/redeem <code>).\n` +
              'Mit /stop meldest du dich ab.'
          : 'Dieser Aktivierungslink ist abgelaufen oder wurde schon eingelöst. Starte den Alarm bitte noch einmal auf der EnergyHunt-Website.',
      )
      return c.json({ ok: true })
    }

    const pro = await isPro(db, 'telegram', chatId)
    let capacity = pro ? Number.POSITIVE_INFINITY : Math.max(0, freeMax - active.length)
    const strippedTarget = subs.some((s) => s.target_price != null) && !pro

    const bound: string[] = []
    const already: string[] = [] // war schon aktiv
    const blocked: string[] = [] // am Free-Limit abgewiesen
    for (const s of subs) {
      const dup = await db
        .prepare("SELECT id FROM subscriptions WHERE channel='telegram' AND destination=? AND product_key=? AND status='confirmed'")
        .bind(chatId, s.product_key)
        .first<{ id: string }>()
      if (dup || capacity <= 0) {
        ;(dup ? already : blocked).push(s.product_label)
        await db.prepare('DELETE FROM subscriptions WHERE id=?').bind(s.id).run()
        continue
      }
      await db
        .prepare(
          pro
            ? "UPDATE subscriptions SET destination=?, status='confirmed', confirmed_at=? WHERE id=?"
            : "UPDATE subscriptions SET destination=?, status='confirmed', confirmed_at=?, target_price=NULL, target_metric=NULL WHERE id=?",
        )
        .bind(chatId, now(), s.id)
        .run()
      bound.push(s.product_label)
      capacity -= 1
    }

    // Jeden Ausgang getrennt benennen – „bereits aktiv“ und „Free-Limit erreicht“
    // sind zwei sehr verschiedene Dinge.
    const lines: string[] = []
    if (bound.length) lines.push(`✅ Alarm aktiv für: ${bound.join(', ')}.`)
    if (already.length) lines.push(`ℹ️ Schon aktiv (nichts geändert): ${already.join(', ')}.`)
    if (blocked.length) {
      lines.push(
        `🔒 Nicht aktiviert: ${blocked.join(', ')} – im kostenlosen Tarif ist ${freeMax === 1 ? 'eine Marke' : `${freeMax} Marken`} drin` +
          (active.length ? ` und du beobachtest bereits ${active.join(', ')}.` : '.'),
      )
    }
    if (strippedTarget) lines.push('🔒 Dein Wunschpreis wurde nicht übernommen – Zielpreise sind eine Pro-Funktion.')
    if (!pro && (blocked.length || strippedTarget)) lines.push('Pro schaltest du im Bot frei: /redeem <code>')
    lines.push('Mit /stop meldest du dich wieder ab.')
    await sendTelegram(c.env, chatId, lines.join('\n'))
    return c.json({ ok: true })
  }

  if (text.startsWith('/stop')) {
    await db.prepare("UPDATE subscriptions SET status='unsubscribed' WHERE channel='telegram' AND destination=? AND status='confirmed'").bind(chatId).run()
    await sendTelegram(c.env, chatId, 'Du bist abgemeldet – keine Bestpreis-Alarme mehr.')
    return c.json({ ok: true })
  }

  await sendTelegram(c.env, chatId, 'Aktiviere deinen Bestpreis-Alarm über den Button auf der EnergyHunt-Website.')
  return c.json({ ok: true })
})

export default app
