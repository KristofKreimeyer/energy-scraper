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

export function registerAccount(app: Hono<{ Bindings: Env }>) {
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

  app.post('/api/auth/request', async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { email?: string }
    const email = String(body.email ?? '').trim().toLowerCase()
    const ok = { ok: true, message: 'Wenn die Adresse gültig ist, haben wir dir einen Anmeldelink geschickt.' }
    if (!EMAIL_RE.test(email)) return c.json(ok)

    const db = c.env.DB
    // Rate-Limit: max. 5 Anfragen je Adresse und Stunde.
    const since = new Date(Date.now() - 3_600_000).toISOString()
    const recent = await db.prepare('SELECT COUNT(*) AS n FROM login_tokens WHERE email=? AND created_at>?').bind(email, since).first<{ n: number }>()
    if ((recent?.n ?? 0) >= 5) return c.json(ok)

    const token = randomToken()
    const expires = new Date(Date.now() + 15 * 60_000).toISOString()
    await db.prepare('INSERT INTO login_tokens (token, email, created_at, expires_at, used) VALUES (?, ?, ?, ?, 0)').bind(token, email, now(), expires).run()
    const link = `${c.env.PUBLIC_SITE_URL}/#/auth?token=${token}`
    await sendEmail(c.env, { to: email, ...loginEmail(link) })
    return c.json(ok)
  })

  // Magic-Link einlösen -> User anlegen/finden, Session ausgeben.
  app.post('/api/auth/verify', async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { token?: string }
    const token = String(body.token ?? '').trim()
    if (!token) return c.json({ error: 'missing_token' }, 400)
    const db = c.env.DB

    const lt = await db.prepare('SELECT email, expires_at, used FROM login_tokens WHERE token=?').bind(token).first<{ email: string; expires_at: string; used: number }>()
    if (!lt || lt.used || lt.expires_at < now()) return c.json({ error: 'invalid_token', message: 'Der Anmeldelink ist ungültig oder abgelaufen.' }, 400)
    await db.prepare('UPDATE login_tokens SET used=1 WHERE token=?').bind(token).run()

    let user = await db.prepare('SELECT id FROM users WHERE email=?').bind(lt.email).first<{ id: string }>()
    if (!user) {
      const id = crypto.randomUUID()
      await db.prepare('INSERT INTO users (id, email, created_at) VALUES (?, ?, ?)').bind(id, lt.email, now()).run()
      user = { id }
    }

    const session = randomToken()
    const expires = new Date(Date.now() + 30 * 86_400_000).toISOString()
    await db.prepare('INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)').bind(session, user.id, now(), expires).run()
    return c.json({ token: session, email: lt.email })
  })

  // Aktueller Login-Status.
  app.get('/api/auth/me', async (c) => {
    const userId = await sessionUserId(c)
    if (!userId) return c.json({ error: 'unauthorized' }, 401)
    const u = await c.env.DB.prepare('SELECT email FROM users WHERE id=?').bind(userId).first<{ email: string }>()
    if (!u) return c.json({ error: 'unauthorized' }, 401)
    return c.json({ email: u.email })
  })

  // Abmelden (Session widerrufen).
  app.post('/api/auth/logout', async (c) => {
    const m = (c.req.header('authorization') || '').match(/^Bearer\s+(.+)$/i)
    if (m) await c.env.DB.prepare('DELETE FROM sessions WHERE token=?').bind(m[1]).run()
    return c.json({ ok: true })
  })

  // „Meine Beiträge": Zähler für das eingeloggte Konto.
  app.get('/api/me/contributions', async (c) => {
    const userId = await sessionUserId(c)
    if (!userId) return c.json({ error: 'unauthorized' }, 401)
    const db = c.env.DB
    const reports = await db.prepare("SELECT COUNT(*) AS n FROM price_reports WHERE user_id=?").bind(userId).first<{ n: number }>()
    const approved = await db.prepare("SELECT COUNT(*) AS n FROM price_reports WHERE user_id=? AND status='approved'").bind(userId).first<{ n: number }>()
    const votes = await db.prepare('SELECT COUNT(*) AS n FROM availability_votes WHERE user_id=?').bind(userId).first<{ n: number }>()
    return c.json({ reports: reports?.n ?? 0, reportsApproved: approved?.n ?? 0, votes: votes?.n ?? 0 })
  })

  // Referral-Link + Stand für das eingeloggte Konto. Zweiseitig: geworbene
  // Freunde und Referrer bekommen je 1 Monat Pro (Reward bei E-Mail-Bestätigung).
  app.get('/api/referral/link', async (c) => {
    const userId = await sessionUserId(c)
    if (!userId) return c.json({ error: 'unauthorized' }, 401)
    const db = c.env.DB
    const u = await db.prepare('SELECT email FROM users WHERE id=?').bind(userId).first<{ email: string }>()
    if (!u) return c.json({ error: 'unauthorized' }, 401)
    const code = await getOrCreateReferralCode(db, u.email)
    const rewarded = await db.prepare("SELECT COUNT(*) AS n FROM referrals WHERE code=? AND status='rewarded'").bind(code).first<{ n: number }>()
    const pending = await db.prepare("SELECT COUNT(*) AS n FROM referrals WHERE code=? AND status='pending'").bind(code).first<{ n: number }>()
    return c.json({
      code,
      url: `${c.env.PUBLIC_SITE_URL}/?ref=${code}`,
      rewarded: rewarded?.n ?? 0,
      pending: pending?.n ?? 0,
    })
  })
}
