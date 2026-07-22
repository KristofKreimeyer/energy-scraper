# Go-Live-Runbook

Deployment von EnergyHunt: **Cloudflare Pages** (statische Vite-App) +
**Cloudflare Worker** (Alarm-API) + **D1** (Datenbank). CI/CD über GitHub
Actions in `.github/workflows/`:

- `deploy-site.yml` – baut die App und deployt zu Pages (jeder main-Push).
- `deploy-worker.yml` – D1-Migrationen + Worker-Deploy (bei `worker/**`-Änderungen).
- `refresh-data.yml` – wöchentlich: Scraper, Normalisierung, committet Daten
  (löst dann automatisch `deploy-site` aus) und versendet die Alarme.

> Reihenfolge-Tipp gegen das URL-Henne-Ei: **erst den Worker** deployen (liefert
> die API-URL für `VITE_API_BASE`), **dann die Seite** (liefert die Origin für
> `ALLOWED_ORIGIN`/`PUBLIC_SITE_URL`), danach den Worker einmal neu deployen.
> Alternativ vorab feste Custom-Domains festlegen.

---

## 1. Cloudflare-Grundgerüst

```bash
cd energy-scraper/worker
npm install

# D1 anlegen -> die ausgegebene database_id in wrangler.toml eintragen:
npx wrangler d1 create energyHunt

# Pages-Projekt anlegen (einmalig):
npx wrangler pages project create energyhunt --production-branch=main
```

**API-Token** (Cloudflare-Dashboard → My Profile → API Tokens → Create): Rechte
**Account · Workers Scripts: Edit**, **Account · Cloudflare Pages: Edit**,
**Account · D1: Edit**. Account-ID steht in der Dashboard-URL bzw. rechts in der
Übersicht.

## 2. Worker konfigurieren (`worker/wrangler.toml` + Secrets)

`[vars]` in `wrangler.toml` (nicht geheim) für Produktion setzen:

| Var | Wert |
|---|---|
| `PUBLIC_SITE_URL` | URL der Pages-Seite, z. B. `https://energyhunt.pages.dev` |
| `ALLOWED_ORIGIN` | dieselbe Origin (CORS) |
| `EMAIL_FROM` / `EMAIL_FROM_NAME` | verifizierter Absender / Anzeigename |
| `TELEGRAM_BOT_USERNAME` | Bot-Name ohne `@` |
| `STRIPE_PRICE_MONTHLY/YEARLY/LIFETIME` | `price_…`-IDs aus Stripe |
| `database_id` | aus Schritt 1 |

Secrets (verschlüsselt, nicht in git):

```bash
npx wrangler secret put BREVO_API_KEY
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET   # selbst gewählt
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put STRIPE_WEBHOOK_SECRET
```

## 3. Dienste einrichten

- **E-Mail (Brevo, EU):** Konto, Absenderdomain/-adresse verifizieren, API-Key
  erzeugen → `BREVO_API_KEY`.
- **Telegram:** Bot bei **@BotFather** anlegen → Token + Username. Webhook
  registrieren (nach Worker-Deploy):
  ```bash
  curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=<WORKER_URL>/api/telegram/webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>"
  ```
- **Web-Push (VAPID):**
  ```bash
  npx web-push generate-vapid-keys
  ```
  → Public-Key als `VITE_VAPID_PUBLIC_KEY` (Build) **und** `VAPID_PUBLIC_KEY`
  (Action); Private-Key als `VAPID_PRIVATE_KEY` (Action).
- **Stripe:** 3 Preise anlegen – monatlich + jährlich (recurring), Lifetime
  (one-time) → `price_…`-IDs. Webhook-Endpoint `<WORKER_URL>/api/stripe/webhook`
  mit Events `checkout.session.completed`, `invoice.paid`,
  `customer.subscription.deleted` → Signing-Secret als `STRIPE_WEBHOOK_SECRET`.
  Lokal testbar: `stripe listen --forward-to localhost:8787/api/stripe/webhook`.

## 4. GitHub Actions – Secrets & Variablen

Repo → Settings → Secrets and variables → Actions.

**Secrets** (alle Workflows):

| Secret | genutzt von |
|---|---|
| `CLOUDFLARE_API_TOKEN` | deploy-site, deploy-worker, refresh-data (D1) |
| `CLOUDFLARE_ACCOUNT_ID` | deploy-site, deploy-worker |
| `CLOUDFLARE_D1_DATABASE_ID` | refresh-data (Alarm-Abfrage) |
| `BREVO_API_KEY` | refresh-data (Versand) |
| `TELEGRAM_BOT_TOKEN` | refresh-data (Versand) |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | refresh-data (Push-Versand) |

**Variablen:**

| Variable | Wert |
|---|---|
| `VITE_API_BASE` | Worker-URL (Build der Seite) |
| `VITE_VAPID_PUBLIC_KEY` | VAPID-Public-Key (Build der Seite) |
| `EMAIL_FROM` / `EMAIL_FROM_NAME` | Absender (Versand) |
| `PUBLIC_SITE_URL` | Seiten-URL (Alarm-Links) |
| `API_BASE` | Worker-URL (Abmelde-Links) |
| `VAPID_SUBJECT` | `mailto:alarm@deine-domain.de` |

> `BREVO_API_KEY` und `TELEGRAM_BOT_TOKEN` liegen bewusst **doppelt** vor: der
> Worker braucht sie live (Anmeldung), die Action wöchentlich (Versand).

## 5. Rechtliches (DE-Pflicht, vor dem Einsammeln von Daten/Zahlungen)

- **Impressum** und **Datenschutzerklärung** (E-Mail-/Push-Verarbeitung,
  Cloudflare/Brevo/Stripe als Auftragsverarbeiter, Double-Opt-In).
- Für die Zahlung: **AGB** + **Widerrufsbelehrung** für digitale Güter.

## 6. Deploy auslösen

Push auf `main` startet `deploy-site` (und bei `worker/**` auch
`deploy-worker`). Beide auch manuell über den Actions-Tab (workflow_dispatch).
Nach dem ersten Doppel-Deploy die URL-abhängigen Werte final setzen (siehe
Reihenfolge-Tipp oben) und den Worker einmal neu deployen.

## 7. Smoke-Test nach Go-Live

- Seite lädt, Theme-Toggle, Kachel/Liste, Filter-Overlay (Tab-Falle, Escape).
- Preis-Alarm E-Mail: Anmeldung → Double-Opt-In-Mail → Bestätigen.
- Telegram: `/start`-Deep-Link bindet, `/stop` meldet ab.
- Push: Berechtigung + Testzustellung (nur über HTTPS).
- Stripe: Checkout im Testmodus → Webhook schreibt Entitlement → Preiswecker
  wird buchbar.
