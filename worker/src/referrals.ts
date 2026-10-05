// Empfehlungsprogramm: Codes, vorgemerkte Werbungen und die zweiseitige Belohnung.

import { EMAIL_RE, now } from './helpers'
import { grantEntitlement } from './entitlements'
import { DAY_MS } from '../../shared/core.mjs'

/** Schreibt dem Referrer/Freund einen Monat Pro gut – STAPELT (+30 Tage auf ein
 *  bestehendes, noch laufendes Ende). Unbegrenztes Pro bleibt unbegrenzt. */
export async function grantReferralMonth(db: D1Database, email: string, source: string): Promise<void> {
  const row = await db
    .prepare("SELECT valid_until FROM entitlements WHERE channel='email' AND destination=? AND tier='pro'")
    .bind(email)
    .first<{ valid_until: string | null }>()
  if (row && row.valid_until === null) return // schon unbegrenzt Pro
  const base = row?.valid_until && row.valid_until > now() ? row.valid_until : now()
  const until = new Date(Date.parse(base) + 30 * DAY_MS).toISOString()
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
  const invitee = String(inviteeEmail ?? '')
    .trim()
    .toLowerCase()
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
  const invitee = String(inviteeEmail ?? '')
    .trim()
    .toLowerCase()
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
