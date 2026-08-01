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

export function registerAlarms(app: Hono<{ Bindings: Env }>) {
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
      ref?: string
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

  app.get('/api/confirm', async (c) => {
    const token = c.req.query('token') ?? ''
    if (!token) return statusPage(c.env, 'Ungültiger Link', 'Dieser Bestätigungslink ist unvollständig.')
    const res = await c.env.DB
      .prepare("UPDATE subscriptions SET status='confirmed', confirmed_at=? WHERE token=? AND status='pending'")
      .bind(now(), token)
      .run()
    if (res.meta.changes > 0) {
      // Wurde dieser Nutzer geworben? Dann zweiseitige Belohnung auslösen.
      const row = await c.env.DB
        .prepare("SELECT destination FROM subscriptions WHERE token=? AND channel='email'")
        .bind(token)
        .first<{ destination: string }>()
      const rewarded = row ? await rewardReferralOnConfirm(c.env.DB, row.destination) : false
      if (rewarded) {
        return statusPage(
          c.env,
          'Alarm aktiv – und 1 Monat Pro geschenkt 🎉',
          'Dein Bestpreis-Alarm ist bestätigt. Weil dich jemand eingeladen hat, haben wir dir (und deinem Einlader) je einen Monat Pro gutgeschrieben.',
        )
      }
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
}
