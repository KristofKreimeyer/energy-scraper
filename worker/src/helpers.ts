// Geteilte Helfer & Konstanten der Worker-API (aus index.ts extrahiert).
// Reine Verschiebung – Logik unverändert.

import { type Context } from 'hono'
import { type Env, sendEmail, confirmEmail } from './email'

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const now = () => new Date().toISOString()

/** Zielpreis + Metrik aus dem Body lesen. `invalid`, wenn ein Wert vorliegt, der nicht > 0 ist. */
export function parseTarget(body: { targetPrice?: number | string | null; targetMetric?: string }): {
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
export async function isPro(db: D1Database, channel: string, destination: string): Promise<boolean> {
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
export async function grantEntitlement(db: D1Database, channel: string, destination: string, tier: string, source: string, validUntil: string | null): Promise<void> {
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

/** Schreibt dem Referrer/Freund einen Monat Pro gut – STAPELT (+30 Tage auf ein
 *  bestehendes, noch laufendes Ende). Unbegrenztes Pro bleibt unbegrenzt. */
export async function grantReferralMonth(db: D1Database, email: string, source: string): Promise<void> {
  const row = await db
    .prepare("SELECT valid_until FROM entitlements WHERE channel='email' AND destination=? AND tier='pro'")
    .bind(email)
    .first<{ valid_until: string | null }>()
  if (row && row.valid_until === null) return // schon unbegrenzt Pro
  const base = row?.valid_until && row.valid_until > now() ? row.valid_until : now()
  const until = new Date(Date.parse(base) + 30 * 86_400_000).toISOString()
  await grantEntitlement(db, 'email', email, 'pro', source, until)
}

/** Get-or-create: ein stabiler Referral-Code je Referrer-E-Mail. */
export async function getOrCreateReferralCode(db: D1Database, email: string): Promise<string> {
  const existing = await db.prepare('SELECT code FROM referral_codes WHERE email=?').bind(email).first<{ code: string }>()
  if (existing) return existing.code
  const code = crypto.randomUUID().replace(/-/g, '').slice(0, 8)
  await db
    .prepare('INSERT INTO referral_codes (code, email, created_at) VALUES (?, ?, ?) ON CONFLICT(email) DO NOTHING')
    .bind(code, email, now())
    .run()
  const row = await db.prepare('SELECT code FROM referral_codes WHERE email=?').bind(email).first<{ code: string }>()
  return row?.code ?? code
}

/** Merkt eine ausstehende Werbung vor (Reward folgt erst bei E-Mail-Bestätigung
 *  des Eingeladenen). Selbst-Werbung und Doppel-Claims werden hier gefiltert. */
export async function recordPendingReferral(db: D1Database, code: string, inviteeEmail: string): Promise<void> {
  const c = String(code ?? '').trim()
  const invitee = String(inviteeEmail ?? '').trim().toLowerCase()
  if (!c || !EMAIL_RE.test(invitee)) return
  const ref = await db.prepare('SELECT email FROM referral_codes WHERE code=?').bind(c).first<{ email: string }>()
  if (!ref) return
  if (ref.email === invitee) return // keine Selbst-Werbung
  await db
    .prepare(
      "INSERT INTO referrals (id, code, referrer_email, invitee_email, status, created_at) VALUES (?, ?, ?, ?, 'pending', ?) " +
        'ON CONFLICT(invitee_email) DO NOTHING',
    )
    .bind(crypto.randomUUID(), c, ref.email, invitee, now())
    .run()
}

/** Löst die zweiseitige Belohnung aus, sobald der Eingeladene bestätigt. Gibt
 *  true zurück, wenn gerade jetzt eine Werbung eingelöst wurde. */
export async function rewardReferralOnConfirm(db: D1Database, inviteeEmail: string): Promise<boolean> {
  const invitee = String(inviteeEmail ?? '').trim().toLowerCase()
  if (!EMAIL_RE.test(invitee)) return false
  const ref = await db
    .prepare("SELECT id, referrer_email FROM referrals WHERE invitee_email=? AND status='pending'")
    .bind(invitee)
    .first<{ id: string; referrer_email: string }>()
  if (!ref) return false
  await grantReferralMonth(db, ref.referrer_email, 'referral:invitee-confirmed')
  await grantReferralMonth(db, invitee, 'referral:welcome')
  await db.prepare("UPDATE referrals SET status='rewarded', rewarded_at=? WHERE id=?").bind(now(), ref.id).run()
  return true
}

/** Entzieht ein Entitlement (läuft ab jetzt aus). */
export async function revokeEntitlement(db: D1Database, channel: string, destination: string, tier: string): Promise<void> {
  await db.prepare('UPDATE entitlements SET valid_until=? WHERE channel=? AND destination=? AND tier=?').bind(now(), channel, destination, tier).run()
}

/** Löst einen Redeem-Code ein und schreibt das Entitlement (gemeinsam für Web & Bot). */
export async function consumeRedeemCode(
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
export async function handleBrandSubscribe(
  c: Context<{ Bindings: Env }>,
  body: {
    email?: string
    subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
    brands?: { brand?: string; targetPrice?: number | string | null; targetMetric?: string }[]
    storeMode?: string
    stores?: string[]
    ref?: string
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
    // Werbung vormerken – belohnt wird zweiseitig erst bei Bestätigung (Confirm).
    if (body.ref) await recordPendingReferral(db, body.ref, destination)
    return c.json({ status: 'pending', message: 'Fast geschafft! Bitte bestätige den Link in deiner E-Mail.' })
  }
  if (channel === 'push') {
    return c.json({ status: 'confirmed', message: 'Marken-Wecker aktiv! Wir melden uns beim nächsten Tief.' })
  }
  const botUser = c.env.TELEGRAM_BOT_USERNAME
  if (!botUser) return c.json({ error: 'telegram_unconfigured', message: 'Telegram ist noch nicht eingerichtet.' }, 503)
  return c.json({ channel: 'telegram', telegramLink: `https://t.me/${botUser}?start=${token}`, message: 'Öffne Telegram und tippe auf „Start“, um die Wecker zu aktivieren.' })
}

/** SHA-256-Hex einer Zeichenkette (für IP-Hash: privatschonender als Klartext). */
export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export const REPORT_RATE_MAX = 5 // Meldungen pro IP und Stunde

export const clip = (s: unknown, max: number) => String(s ?? '').trim().slice(0, max)

export const VOTE_RATE_MAX = 40 // Stimmen pro IP und Stunde

export const VOTE_WINDOW_DAYS = 10 // nur Stimmen der letzten Tage zählen (Wochenangebote)

/** 32 Byte Zufall als Hex – für Login- und Session-Tokens. */
export function randomToken(): string {
  const b = new Uint8Array(32)
  crypto.getRandomValues(b)
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
}


/** user_id der gültigen Session aus dem Bearer-Token, sonst null. */
export async function sessionUserId(c: Context<{ Bindings: Env }>): Promise<string | null> {
  const m = (c.req.header('authorization') || '').match(/^Bearer\s+(.+)$/i)
  if (!m) return null
  const row = await c.env.DB.prepare('SELECT user_id, expires_at FROM sessions WHERE token=?').bind(m[1]).first<{ user_id: string; expires_at: string }>()
  if (!row || row.expires_at < now()) return null
  return row.user_id
}
