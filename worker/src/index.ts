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

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { type Env } from './email'
import { registerAlarms } from './routes/alarms'
import { registerCommunity } from './routes/community'
import { registerAccount } from './routes/account'
import { registerPro } from './routes/pro'

const app = new Hono<{ Bindings: Env }>()

// CORS nur für die konfigurierte Origin (die statische Seite). Der Telegram-
// Webhook wird server-zu-server aufgerufen und ist davon unberührt.
app.use('/api/*', (c, next) => cors({ origin: c.env.ALLOWED_ORIGIN || '*', allowMethods: ['GET', 'POST', 'OPTIONS'] })(c, next))

registerAlarms(app)
registerCommunity(app)
registerAccount(app)
registerPro(app)

export default app
