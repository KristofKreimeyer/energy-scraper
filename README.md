# ⚡ EnergyHunt

**Energy-Drink-Angebote der Woche – automatisch aus den Prospekten, verglichen nach Preis pro Liter.**

EnergyHunt sammelt wöchentlich die Energy-Drink-Aktionen von Aldi Nord & Süd, Kaufland, Lidl, Netto, Penny und Rewe, normalisiert sie auf ein einheitliches Schema, schreibt eine Preishistorie fort und rendert einen schnellen, barrierefreien Vergleich – als installierbare PWA.

Live: **https://energyhunt.pages.dev**

---

## Features

### Vergleich & Daten
- **€/L-Vergleich** als Kern: das beste Grundpreis-Angebot steht oben, Live-Ticker der günstigsten €/L.
- **Preishistorie & Insight** je Produkt: Bestpreis-/„günstiger als üblich"-Signal mit Sparkline (aus append-only Historie).
- **Filter & Sortierung**: Markt, Marke, Zucker, Suche, Zeitraum (diese/nächste Woche); faceted counts.
- **SEO**: dynamischer Title/Description, JSON-LD (`ItemList`/`Offer`), `robots.txt` + `sitemap.xml`, crawlbare Marken-Landingpages (`/marken/<marke>-energy-angebote`).

### Community
- **„Noch verfügbar?"-Votes** – anonyme Vor-Ort-Bestätigung je Angebot (eine Stimme je Gerät).
- **Preismeldungen** – „günstiger gesehen?" mit Moderation, danach als Community-Hinweis sichtbar.
- **Leaderboard** – „Top-Hunter der Woche" (maskierte Handles, datenschutzfreundlich).
- **Markt-Voting** – „Welchen Markt als Nächstes scrapen?" steuert die Roadmap.

### Retention & Growth
- **Favoriten** – Marken merken, „Meine Marken"-Filter, direkt im Preis-Alarm nutzbar.
- **Preis-Alarm** – Bestpreis-Wecker per E-Mail, Telegram oder Web-Push.
- **Pro** – Preiswecker (eigener Zielpreis) + mehrere Marken; via Stripe oder Redeem-Code.
- **Referral** – Freunde einladen, **beide 1 Monat Pro** (Reward bei E-Mail-Bestätigung des Eingeladenen).
- **PWA** – installierbar (Homescreen-Icons für Android & iOS), Offline-App-Shell, optionale **„neue Woche"-Push**.

---

## Architektur

```
scrapers/<source>-scraper.js      Playwright / JSON-API / Cheerio je Retailer
  → scrapers/captured/*offers*.json (heterogene Rohform)
  → scripts/prepare-data.mjs        Normalisierung (€/L, Volumen, Dedup, Historie, SEO-Artefakte)
  → src/data/offers.json + price-history.json   (generiert, committet)
  → src/lib/offers.ts               Gruppierung/Filter/Sortierung + priceInsight
  → React-App (Vite + TS + Tailwind)
```

- **Frontend**: Vite + React 19 + TypeScript + Tailwind v4. Liest die generierten JSON-Daten zur Build-/Dev-Zeit.
- **`scrapers/`**: eigenständiges Sub-Paket (eigene `package.json`, Playwright) mit `run-all.js`-Orchestrator.
- **Cloudflare Worker** (`worker/`, Hono + D1): Alarme, Pro/Entitlements, Community-Votes, Preismeldungen, Leaderboard, Markt-Voting, Referral, weekly-Push-Opt-in.
- **Versand** (`scripts/`): `send-alarms.mjs` (Bestpreis-Alarme), `send-weekly-push.mjs` (Wochen-Broadcast) – laufen in der Refresh-Pipeline.

Code-Kommentare, Logs und UI-Copy sind durchgängig **deutsch** (Zielgruppe).

---

## Entwicklung

### Frontend-App
```bash
npm install
npm run dev       # prepare-data + Vite Dev-Server
npm run build     # prepare-data + tsc -b + vite build
npm run lint
```
`prepare-data.mjs` läuft automatisch via `predev`/`prebuild` und erzeugt `src/data/*.json` sowie die SEO-Artefakte in `public/`.

### Scraper & Datenaktualisierung (`scrapers/`)
```bash
cd scrapers
npm install
npx playwright install chromium     # einmalig (Aldi Nord & Rewe nutzen Playwright)
node run-all.js                     # alle Scraper + Normalisierung
```

### Cloudflare Worker (`worker/`)
```bash
cd worker
npm install
npm run deploy                      # nach Secrets/D1-Setup (siehe wrangler.toml / DEPLOY.md)
```

### Assets (einmalig)
```bash
node scripts/generate-og.mjs        # Open-Graph-Bild (public/og.png)
node scripts/generate-icons.mjs     # PWA-App-Icons (192/512/maskable/apple-touch)
```

---

## Deployment (CI, Node 24)

- **`deploy-site.yml`** – baut die App und deployt zu Cloudflare Pages (bei `main`-Push auf `src/**`).
- **`deploy-worker.yml`** – wendet D1-Migrationen an und deployt den Worker (bei `worker/**`).
- **`refresh-data.yml`** – wöchentlicher Cron: Scraper → Daten committen → Bestpreis-Alarme → Wochen-Push (nur bei frischen Daten).

---

## Projektstruktur

```
energy-scraper/            # Git-Repo (dieser Ordner)
├── src/                   # React-App (Komponenten, lib, hooks, auth)
├── scripts/               # prepare-data, send-alarms, send-weekly-push, generate-*
├── scrapers/              # Produktive Scraper (eigenes Sub-Paket)
├── worker/                # Cloudflare Worker (Hono + D1) + migrations/
├── public/                # statische Assets, manifest, sw.js, Icons, SEO-Artefakte
└── .github/workflows/     # deploy-site, deploy-worker, refresh-data
```
