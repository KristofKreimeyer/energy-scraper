import { Hono, type Context } from 'hono'
import Stripe from 'stripe'
import { type Env, sendEmail, confirmEmail, loginEmail, statusPage } from '../email'
import { sendTelegram } from '../telegram'
import {
  EMAIL_RE, now, parseTarget, isPro, grantEntitlement, grantReferralMonth,
  getOrCreateReferralCode, recordPendingReferral, rewardReferralOnConfirm,
  revokeEntitlement, consumeRedeemCode, handleBrandSubscribe, sha256Hex,
  REPORT_RATE_MAX, clip, VOTE_RATE_MAX, VOTE_WINDOW_DAYS, randomToken, sessionUserId,
} from '../helpers'

export function registerCommunity(app: Hono<{ Bindings: Env }>) {
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

    const userId = await sessionUserId(c)
    await db
      .prepare(
        'INSERT INTO price_reports (id, created_at, status, product_key, brand, title, market, reported_price, store_location, note, ip_hash, user_id) ' +
          "VALUES (?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(crypto.randomUUID(), now(), productKey, brand, title, market, Math.round(price * 100) / 100, clip(body.storeLocation, 80) || null, clip(body.note, 200) || null, ipHash, userId)
      .run()
    return c.json({ ok: true, message: 'Danke für deine Meldung! Wir prüfen sie und zeigen sie dann an.' })
  })

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
    const userId = await sessionUserId(c)
    await db
      .prepare(
        'INSERT INTO availability_votes (id, created_at, product_key, vote, voter_id, ip_hash, user_id) VALUES (?, ?, ?, ?, ?, ?, ?) ' +
          'ON CONFLICT(product_key, voter_id) DO UPDATE SET vote=excluded.vote, created_at=excluded.created_at, ip_hash=excluded.ip_hash, user_id=excluded.user_id',
      )
      .bind(crypto.randomUUID(), now(), productKey, vote, voterId, ipHash, userId)
      .run()
    return c.json({ ok: true })
  })

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

  app.get('/api/community/summary', async (c) => {
    const db = c.env.DB
    const since = new Date(Date.now() - VOTE_WINDOW_DAYS * 86_400_000).toISOString()
    const conf = await db.prepare("SELECT COUNT(*) AS n FROM availability_votes WHERE vote=1 AND created_at>?").bind(since).first<{ n: number }>()
    const fund = await db
      .prepare("SELECT brand, title, market, reported_price, store_location, note FROM price_reports WHERE status='approved' ORDER BY created_at DESC LIMIT 1")
      .first<{ brand: string; title: string; market: string; reported_price: number; store_location: string | null; note: string | null }>()
    return c.json(
      {
        confirmed: conf?.n ?? 0,
        fund: fund ? { brand: fund.brand, title: fund.title, market: fund.market, price: fund.reported_price, storeLocation: fund.store_location, note: fund.note } : null,
      },
      200,
      { 'cache-control': 'public, max-age=120' },
    )
  })

  app.post('/api/weekly/subscribe', async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as {
      subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
    }
    const sub = body.subscription
    if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
      return c.json({ error: 'invalid_subscription', message: 'Push-Anmeldung unvollständig.' }, 400)
    }
    const db = c.env.DB
    const existing = await db
      .prepare("SELECT id FROM subscriptions WHERE channel='push' AND scope='weekly' AND json_extract(destination,'$.endpoint')=?")
      .bind(sub.endpoint)
      .first<{ id: string }>()
    if (!existing) {
      await db
        .prepare(
          "INSERT INTO subscriptions (id, channel, destination, product_key, product_label, status, token, created_at, confirmed_at, scope) " +
            "VALUES (?, 'push', ?, '__weekly__', 'Wöchentliche Deal-Erinnerung', 'confirmed', ?, ?, ?, 'weekly')",
        )
        .bind(crypto.randomUUID(), JSON.stringify(sub), randomToken(), now(), now())
        .run()
    }
    return c.json({ status: 'ok', message: 'Du bekommst ab jetzt die wöchentliche Deal-Erinnerung.' })
  })

  app.post('/api/weekly/unsubscribe', async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { subscription?: { endpoint?: string } }
    const endpoint = body.subscription?.endpoint
    if (!endpoint) return c.json({ error: 'invalid_subscription' }, 400)
    await c.env.DB
      .prepare("DELETE FROM subscriptions WHERE channel='push' AND scope='weekly' AND json_extract(destination,'$.endpoint')=?")
      .bind(endpoint)
      .run()
    return c.json({ status: 'ok' })
  })

  const MARKET_CANDIDATES = ['Edeka', 'Norma', 'Trinkgut', 'Getränke Hoffmann', 'Marktkauf', 'Müller']

  app.post('/api/market-vote', async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { market?: string; voterId?: string }
    const market = clip(body.market, 60)
    const voterId = clip(body.voterId, 64)
    if (!market || !voterId || !MARKET_CANDIDATES.includes(market)) {
      return c.json({ error: 'invalid_vote', message: 'Ungültige Stimme.' }, 400)
    }
    const db = c.env.DB
    const ipHash = await sha256Hex('energyhunt-market-vote:' + (c.req.header('cf-connecting-ip') ?? 'unknown'))
    const since = new Date(Date.now() - 3_600_000).toISOString()
    const recent = await db.prepare('SELECT COUNT(*) AS n FROM market_votes WHERE ip_hash=? AND created_at>?').bind(ipHash, since).first<{ n: number }>()
    if ((recent?.n ?? 0) >= VOTE_RATE_MAX) return c.json({ error: 'rate_limited', message: 'Zu viele Stimmen – bitte später.' }, 429)

    await db
      .prepare(
        'INSERT INTO market_votes (id, created_at, market, voter_id, ip_hash) VALUES (?, ?, ?, ?, ?) ' +
          'ON CONFLICT(voter_id) DO UPDATE SET market=excluded.market, created_at=excluded.created_at, ip_hash=excluded.ip_hash',
      )
      .bind(crypto.randomUUID(), now(), market, voterId, ipHash)
      .run()
    return c.json({ ok: true })
  })

  app.get('/api/market-votes', async (c) => {
    const rows = (
      await c.env.DB.prepare('SELECT market, COUNT(*) AS n FROM market_votes GROUP BY market').all<{ market: string; n: number }>()
    ).results
    const votes: Record<string, number> = {}
    for (const r of rows) votes[r.market] = r.n
    return c.json({ candidates: MARKET_CANDIDATES, votes }, 200, { 'cache-control': 'public, max-age=60' })
  })

  function maskHandle(email: string): string {
    const local = email.split('@')[0] ?? 'hunter'
    const head = local.slice(0, 2)
    return `${head}${'*'.repeat(Math.max(3, Math.min(6, local.length - head.length)))}`
  }

  app.get('/api/leaderboard', async (c) => {
    const rows = (
      await c.env.DB
        .prepare(
          `SELECT u.email AS email,
             (SELECT COUNT(*) FROM price_reports r WHERE r.user_id=u.id AND r.status='approved') AS approved,
             (SELECT COUNT(*) FROM availability_votes v WHERE v.user_id=u.id) AS votes
           FROM users u`,
        )
        .all<{ email: string; approved: number; votes: number }>()
    ).results
    const board = rows
      .map((r) => ({
        handle: maskHandle(r.email),
        approved: r.approved,
        votes: r.votes,
        score: r.approved * 3 + r.votes,
      }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map((r, i) => ({ rank: i + 1, ...r }))
    return c.json({ board }, 200, { 'cache-control': 'public, max-age=300' })
  })
}
