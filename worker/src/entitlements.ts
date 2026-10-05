// Entitlements (Pro-Tarif) und Redeem-Codes – gemeinsame Stelle für Stripe,
// Codes, Web & Telegram-Bot.

import { now } from './helpers'
import { DAY_MS } from '../../shared/core.mjs'

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
export async function grantEntitlement(
  db: D1Database,
  channel: string,
  destination: string,
  tier: string,
  source: string,
  validUntil: string | null,
): Promise<void> {
  const existing = await db
    .prepare('SELECT id, valid_until FROM entitlements WHERE channel=? AND destination=? AND tier=?')
    .bind(channel, destination, tier)
    .first<{ id: string; valid_until: string | null }>()
  if (existing) {
    const keep =
      existing.valid_until === null || validUntil === null ? null : existing.valid_until > validUntil ? existing.valid_until : validUntil
    await db.prepare('UPDATE entitlements SET valid_until=?, source=? WHERE id=?').bind(keep, source, existing.id).run()
  } else {
    await db
      .prepare('INSERT INTO entitlements (id, channel, destination, tier, source, valid_until, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(crypto.randomUUID(), channel, destination, tier, source, validUntil, now())
      .run()
  }
}

/** Entzieht ein Entitlement (läuft ab jetzt aus). */
export async function revokeEntitlement(db: D1Database, channel: string, destination: string, tier: string): Promise<void> {
  await db
    .prepare('UPDATE entitlements SET valid_until=? WHERE channel=? AND destination=? AND tier=?')
    .bind(now(), channel, destination, tier)
    .run()
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
  const validUntil = rc.valid_days ? new Date(Date.now() + rc.valid_days * DAY_MS).toISOString() : null
  await grantEntitlement(db, channel, destination, rc.tier, `redeem:${code}`, validUntil)
  await db.prepare('UPDATE redeem_codes SET uses=uses+1 WHERE code=?').bind(code).run()
  return { ok: true, tier: rc.tier, validUntil }
}
