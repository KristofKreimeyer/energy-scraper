// Marken-Wecker anlegen (E-Mail / Push / Telegram) inkl. Free-/Pro-Gating.

import { type Context } from 'hono'
import { type Env, sendEmail, confirmEmail } from './email'
import { EMAIL_RE, now, parseTarget } from './helpers'
import { isPro } from './entitlements'
import { recordPendingReferral } from './referrals'
import { brandKey } from '../../shared/core.mjs'

type SubscribeBody = {
  email?: string
  subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
  brands?: { brand?: string; targetPrice?: number | string | null; targetMetric?: string }[]
  storeMode?: string
  stores?: string[]
  ref?: string
}

type Ctx = Context<{ Bindings: Env }>

/** Store-Filter aus dem Body: Modus + JSON-Liste (null bei 'all'). */
function parseStoreFilter(body: SubscribeBody): { storeMode: string; storesJson: string | null } {
  const storeMode = body.storeMode === 'only' || body.storeMode === 'except' ? body.storeMode : 'all'
  const storesJson = storeMode === 'all' ? null : JSON.stringify(Array.isArray(body.stores) ? body.stores.map(String) : [])
  return { storeMode, storesJson }
}

/**
 * Ziel-Identität und Pro-Status je Kanal. Telegram ist erst beim Binden
 * bekannt (destination leer, pro=false). Gibt bei ungültigen Eingaben direkt
 * die Fehler-Response zurück.
 */
async function resolveDestination(
  c: Ctx,
  body: SubscribeBody,
  channel: string,
  db: D1Database,
): Promise<{ destination: string; pro: boolean } | Response> {
  if (channel === 'email') {
    const destination = String(body.email ?? '')
      .trim()
      .toLowerCase()
    if (!EMAIL_RE.test(destination)) return c.json({ error: 'invalid_email', message: 'Bitte gib eine gültige E-Mail-Adresse an.' }, 400)
    return { destination, pro: await isPro(db, 'email', destination) }
  }
  if (channel === 'push') {
    const sub = body.subscription
    if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth)
      return c.json({ error: 'invalid_subscription', message: 'Push-Anmeldung unvollständig.' }, 400)
    const destination = JSON.stringify(sub)
    return { destination, pro: await isPro(db, 'push', destination) }
  }
  if (channel === 'telegram') return { destination: '', pro: false }
  return c.json({ error: 'bad_channel' }, 400)
}

type BrandEntry = { display: string; norm: string; t: ReturnType<typeof parseTarget> }

/** Legt je Marke eine Subscription an (Upsert); alle teilen sich `token`. */
async function insertBrandSubscriptions(
  db: D1Database,
  p: { brands: BrandEntry[]; channel: string; dbDest: string; storeMode: string; storesJson: string | null; status: string; token: string },
): Promise<void> {
  for (const b of p.brands) {
    await db
      .prepare(
        'INSERT INTO subscriptions (id, channel, destination, scope, brand, product_key, product_label, store_mode, stores, status, token, created_at, confirmed_at, target_price, target_metric) ' +
          "VALUES (?, ?, ?, 'brand', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) " +
          'ON CONFLICT(channel, destination, product_key) DO UPDATE SET store_mode=excluded.store_mode, stores=excluded.stores, target_price=excluded.target_price, target_metric=excluded.target_metric, notified_at=NULL',
      )
      .bind(
        crypto.randomUUID(),
        p.channel,
        p.dbDest,
        b.norm,
        `brand:${b.norm}`,
        b.display,
        p.storeMode,
        p.storesJson,
        p.status,
        p.token,
        now(),
        p.status === 'confirmed' ? now() : null,
        b.t.price,
        b.t.metric,
      )
      .run()
  }
}

/**
 * Marken-basierter Wecker: pro gewählter Marke eine Subscription (scope='brand',
 * product_key='brand:<norm>'), optional Store-Filter und Zielpreis je Marke.
 * Alle Marken einer Anlage teilen sich EINEN Bestätigungs-Token (eine Opt-in-Mail
 * bzw. ein Telegram-Deep-Link bindet alle). Free = 1 Marke ohne Zielpreis;
 * mehrere Marken oder Zielpreise erfordern Pro (Telegram: Prüfung beim Binden).
 */
export async function handleBrandSubscribe(c: Ctx, body: SubscribeBody, channel: string, db: D1Database): Promise<Response> {
  const { storeMode, storesJson } = parseStoreFilter(body)

  const brands: BrandEntry[] = (Array.isArray(body.brands) ? body.brands : [])
    .map((b) => {
      const display = String(b.brand ?? '').trim()
      return { display, norm: brandKey(display), t: parseTarget(b) }
    })
    .filter((b) => b.display)
  if (brands.length === 0) return c.json({ error: 'missing_brands', message: 'Bitte wähle mindestens eine Marke.' }, 400)
  if (brands.some((b) => b.t.invalid)) return c.json({ error: 'invalid_target', message: 'Bitte gib gültige Zielpreise an.' }, 400)

  const isTelegram = channel === 'telegram'
  const resolved = await resolveDestination(c, body, channel, db)
  if (resolved instanceof Response) return resolved
  const { destination, pro } = resolved

  // Pro-Gating (Telegram erst beim Binden).
  if (!isTelegram) {
    const wantsTarget = brands.some((b) => b.t.price != null)
    if ((wantsTarget || brands.length > 1) && !pro) {
      return c.json({ error: 'pro_required', message: 'Mehrere Marken oder Zielpreise sind eine Pro-Funktion. Schalte Pro frei.' }, 402)
    }
    if (!pro) {
      const freeMax = Number(c.env.FREE_MAX_SUBSCRIPTIONS || '1')
      const active = await db
        .prepare("SELECT COUNT(*) AS n FROM subscriptions WHERE channel=? AND destination=? AND status IN ('pending','confirmed')")
        .bind(channel, destination)
        .first<{ n: number }>()
      if ((active?.n ?? 0) + brands.length > freeMax) {
        return c.json(
          {
            error: 'free_limit',
            message: `Im kostenlosen Tarif kannst du ${freeMax === 1 ? 'eine Marke' : `${freeMax} Marken`} beobachten. Mit Pro sind es beliebig viele.`,
          },
          409,
        )
      }
    }
  }

  const token = crypto.randomUUID()
  const status = channel === 'push' ? 'confirmed' : 'pending'
  const dbDest = isTelegram ? `pending:${token}` : destination
  await insertBrandSubscriptions(db, { brands, channel, dbDest, storeMode, storesJson, status, token })

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
  return c.json({
    channel: 'telegram',
    telegramLink: `https://t.me/${botUser}?start=${token}`,
    message: 'Öffne Telegram und tippe auf „Start“, um die Wecker zu aktivieren.',
  })
}
