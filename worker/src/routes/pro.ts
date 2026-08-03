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

export function registerPro(app: Hono<{ Bindings: Env }>) {
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

  // --- Stripe: Kunden-/Billing-Portal (Abo verwalten & kündigen, § 312k BGB) --
  // Auth-geschützt: öffnet das Portal NUR für die E-Mail des eingeloggten Kontos
  // (kein Öffnen fremder Abos). Der Stripe-Customer wird per E-Mail nachgeschlagen
  // (Checkout legt ihn via customer_email an).
  app.post('/api/portal', async (c) => {
    const userId = await sessionUserId(c)
    if (!userId) return c.json({ error: 'unauthorized' }, 401)
    if (!c.env.STRIPE_SECRET_KEY) {
      return c.json({ error: 'stripe_unconfigured', message: 'Die Zahlung ist noch nicht eingerichtet.' }, 503)
    }
    const u = await c.env.DB.prepare('SELECT email FROM users WHERE id=?').bind(userId).first<{ email: string }>()
    if (!u) return c.json({ error: 'unauthorized' }, 401)

    const stripe = stripeClient(c.env)
    const customers = await stripe.customers.list({ email: u.email, limit: 1 })
    const customer = customers.data[0]
    if (!customer) {
      return c.json({ error: 'no_customer', message: 'Zu diesem Konto ist kein Stripe-Abo hinterlegt.' }, 404)
    }
    const session = await stripe.billingPortal.sessions.create({
      customer: customer.id,
      return_url: `${c.env.PUBLIC_SITE_URL}/`,
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
}
