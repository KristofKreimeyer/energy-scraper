// Login-/Session-Helfer der Worker-API.

import { type Context } from 'hono'
import { type Env } from './email'
import { now } from './helpers'

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
  const row = await c.env.DB.prepare('SELECT user_id, expires_at FROM sessions WHERE token=?')
    .bind(m[1])
    .first<{ user_id: string; expires_at: string }>()
  if (!row || row.expires_at < now()) return null
  return row.user_id
}
