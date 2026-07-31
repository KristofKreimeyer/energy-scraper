// Zweck: Zentrale SEO-Bausteine aus den fertig normalisierten Angeboten
//   (src/data/offers.json). Liefert reine Funktionen, die an ZWEI Stellen
//   genutzt werden:
//     1) scripts/prepare-data.mjs  -> schreibt public/robots.txt, public/sitemap.xml
//        und die statischen Marken-Landingpages (public/marken/*.html).
//     2) vite.config.ts (transformIndexHtml) -> injiziert dynamischen <title>,
//        Meta-Description, JSON-LD und einen crawlbaren <noscript>-Block in die
//        ausgelieferte index.html (löst das „leere #root"-Problem für Crawler).
//
// Bewusst framework-frei (kein SSG): statische HTML-Seiten + angereicherter
// index-Head reichen für Rich Results und Long-Tail-Indexierung.
//
// Aufruf: importiert, nicht direkt via CLI.

export const SITE_ORIGIN = 'https://energyhunt.pages.dev'
export const SITE_NAME = 'EnergyHunt'

// --- kleine Helfer ---------------------------------------------------------

/** "Red Bull" -> "red-bull" (URL-tauglich, deutsche Umlaute aufgelöst). */
export function slugify(str) {
  return String(str)
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Marken-Slug für die Landingpage: "Red Bull" -> "red-bull-energy-angebote". */
export function brandSlug(brand) {
  return `${slugify(brand)}-energy-angebote`
}

/** ISO-Kalenderwoche (KW) zu einem Datum – für den dynamischen Titel. */
export function isoWeek(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d - yearStart) / 86_400_000 + 1) / 7)
}

/** "0,79 €" – deutsche Preisformatierung. */
export function euro(value) {
  return value.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// --- Angebots-Aufbereitung -------------------------------------------------

/** Nur aktuell/laufend gültige Angebote (abgelaufene raus) – Tagesebene, UTC. */
function isLive(offer, now = new Date()) {
  const today = Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / 86_400_000)
  const day = (s) => Math.floor(new Date(s).getTime() / 86_400_000)
  if (offer.validTo && day(offer.validTo) < today) return false
  if (offer.validFrom && day(offer.validFrom) > today + 14) return false
  return true
}

/** Günstigste Angebote zuerst (nach €/L, dann Stückpreis). */
export function sortByValue(offers) {
  return [...offers].sort((a, b) => {
    const al = a.perLiter ?? Infinity
    const bl = b.perLiter ?? Infinity
    if (al !== bl) return al - bl
    return (a.price ?? Infinity) - (b.price ?? Infinity)
  })
}

/** Angebote nach Marke gruppieren (nur Marken mit Live-Angeboten). */
export function byBrand(offers) {
  const live = offers.filter((o) => isLive(o))
  const map = new Map()
  for (const o of live) {
    if (!map.has(o.brand)) map.set(o.brand, [])
    map.get(o.brand).push(o)
  }
  for (const [k, v] of map) map.set(k, sortByValue(v))
  return map
}

// --- robots.txt / sitemap.xml ----------------------------------------------

export function buildRobots() {
  return [
    'User-agent: *',
    'Allow: /',
    '',
    `Sitemap: ${SITE_ORIGIN}/sitemap.xml`,
    '',
  ].join('\n')
}

export function buildSitemap(offers, now = new Date()) {
  const lastmod = now.toISOString().slice(0, 10)
  const urls = [{ loc: `${SITE_ORIGIN}/`, priority: '1.0', changefreq: 'daily' }]
  for (const brand of byBrand(offers).keys()) {
    urls.push({
      loc: `${SITE_ORIGIN}/marken/${brandSlug(brand)}.html`,
      priority: '0.8',
      changefreq: 'weekly',
    })
  }
  const body = urls
    .map(
      (u) =>
        `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n` +
        `    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`,
    )
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`
}

// --- Dynamischer Head (title/description/JSON-LD/noscript) ------------------

/** Günstigstes Live-Angebot der Woche (für Titel & Deal-Snippet). */
export function cheapestLive(offers) {
  const live = sortByValue(offers.filter((o) => isLive(o)))
  return live[0] ?? null
}

export function buildTitle(offers, now = new Date()) {
  const best = cheapestLive(offers)
  const kw = isoWeek(now)
  if (best) {
    return `Energy-Drink-Angebote KW ${kw} — ab ${euro(best.price)} · ${SITE_NAME}`
  }
  return `${SITE_NAME} — Energy-Drink-Angebote im Vergleich`
}

export function buildDescription(offers, now = new Date()) {
  const best = cheapestLive(offers)
  const kw = isoWeek(now)
  const base =
    'Alle Energy-Drink-Deals der Woche, verglichen nach Preis pro Liter – automatisch aus den Prospekten von Aldi, Kaufland, Lidl, Netto, Penny und Rewe.'
  if (best) {
    return `KW ${kw}: bester Preis ${euro(best.price)} (${best.brand} bei ${best.market}). ${base}`
  }
  return base
}

/** JSON-LD: WebSite + Organisation + ItemList der günstigsten Angebote. */
export function buildJsonLd(offers) {
  const top = sortByValue(offers.filter((o) => isLive(o))).slice(0, 12)
  const graph = [
    {
      '@type': 'Organization',
      '@id': `${SITE_ORIGIN}/#org`,
      name: SITE_NAME,
      url: `${SITE_ORIGIN}/`,
      logo: `${SITE_ORIGIN}/og.png`,
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE_ORIGIN}/#website`,
      name: SITE_NAME,
      url: `${SITE_ORIGIN}/`,
      inLanguage: 'de-DE',
      publisher: { '@id': `${SITE_ORIGIN}/#org` },
    },
  ]
  if (top.length) {
    graph.push({
      '@type': 'ItemList',
      name: 'Energy-Drink-Angebote der Woche',
      numberOfItems: top.length,
      itemListElement: top.map((o, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        item: {
          '@type': 'Product',
          name: `${o.brand} ${o.title}`.trim(),
          brand: { '@type': 'Brand', name: o.brand },
          ...(o.imageUrl ? { image: o.imageUrl } : {}),
          offers: {
            '@type': 'Offer',
            price: o.price,
            priceCurrency: 'EUR',
            availability: 'https://schema.org/InStock',
            seller: { '@type': 'Organization', name: o.market },
            ...(o.validTo ? { priceValidUntil: String(o.validTo).slice(0, 10) } : {}),
            url: o.url || `${SITE_ORIGIN}/`,
          },
        },
      })),
    })
  }
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph })
}

/** Crawlbarer Fallback: die aktuellen Deals als echte HTML-Liste. Wird von
 *  Suchmaschinen/Preview-Bots gelesen, die kein JS ausführen. */
export function buildNoscript(offers) {
  const top = sortByValue(offers.filter((o) => isLive(o))).slice(0, 12)
  if (!top.length) return ''
  const items = top
    .map(
      (o) =>
        `<li>${escapeHtml(o.brand)} ${escapeHtml(o.title)} – ` +
        `<strong>${escapeHtml(euro(o.price))}</strong> bei ${escapeHtml(o.market)}` +
        (o.perLiter != null ? ` (${escapeHtml(euro(o.perLiter))}/L)` : '') +
        `</li>`,
    )
    .join('')
  return (
    `<noscript><section><h1>Energy-Drink-Angebote der Woche im Preisvergleich</h1>` +
    `<p>Verglichen nach Preis pro Liter aus den aktuellen Wochenprospekten.</p>` +
    `<ul>${items}</ul></section></noscript>`
  )
}

// --- Marken-Landingpages (statisches HTML) ---------------------------------

/** Eigenständige, crawlbare Landingpage je Marke (Long-Tail-SEO). */
export function buildBrandPage(brand, brandOffers, now = new Date()) {
  const offers = sortByValue(brandOffers)
  const best = offers[0]
  const kw = isoWeek(now)
  const slug = brandSlug(brand)
  const title = `${brand} Angebote KW ${kw} — ab ${euro(best.price)} im Preisvergleich | ${SITE_NAME}`
  const desc =
    `${brand} Energy-Drink-Angebote der Woche im Vergleich nach Preis pro Liter. ` +
    `Bester Preis: ${euro(best.price)} bei ${best.market}. Aldi, Kaufland, Lidl, Netto, Penny & Rewe.`
  const canonical = `${SITE_ORIGIN}/marken/${slug}.html`

  const rows = offers
    .map(
      (o) =>
        `<tr><td>${escapeHtml(o.title)}</td><td>${escapeHtml(o.market)}</td>` +
        `<td>${escapeHtml(o.unitLabel || '')}</td>` +
        `<td><strong>${escapeHtml(euro(o.price))}</strong></td>` +
        `<td>${o.perLiter != null ? escapeHtml(euro(o.perLiter)) + '/L' : '—'}</td></tr>`,
    )
    .join('\n')

  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${brand} Energy-Drink-Angebote`,
    numberOfItems: offers.length,
    itemListElement: offers.map((o, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Product',
        name: `${o.brand} ${o.title}`.trim(),
        brand: { '@type': 'Brand', name: o.brand },
        ...(o.imageUrl ? { image: o.imageUrl } : {}),
        offers: {
          '@type': 'Offer',
          price: o.price,
          priceCurrency: 'EUR',
          availability: 'https://schema.org/InStock',
          seller: { '@type': 'Organization', name: o.market },
          ...(o.validTo ? { priceValidUntil: String(o.validTo).slice(0, 10) } : {}),
        },
      },
    })),
  })

  return `<!doctype html>
<html lang="de">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(desc)}" />
<link rel="canonical" href="${canonical}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="${SITE_NAME}" />
<meta property="og:locale" content="de_DE" />
<meta property="og:url" content="${canonical}" />
<meta property="og:title" content="${escapeHtml(title)}" />
<meta property="og:description" content="${escapeHtml(desc)}" />
<meta property="og:image" content="${SITE_ORIGIN}/og.png" />
<meta name="twitter:card" content="summary_large_image" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<script type="application/ld+json">${jsonLd}</script>
<style>
  :root{color-scheme:light dark}
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:820px;margin:0 auto;padding:2rem 1.25rem;line-height:1.5}
  h1{font-size:1.6rem;line-height:1.2}
  table{border-collapse:collapse;width:100%;margin:1.5rem 0;font-size:.95rem}
  th,td{text-align:left;padding:.55rem .5rem;border-bottom:1px solid #8883}
  th{font-size:.78rem;text-transform:uppercase;letter-spacing:.05em;opacity:.7}
  .cta{display:inline-block;margin-top:1rem;padding:.7rem 1.1rem;background:#111;color:#fff;border-radius:10px;text-decoration:none;font-weight:600}
  @media(prefers-color-scheme:dark){.cta{background:#fff;color:#111}}
  .muted{opacity:.65;font-size:.85rem}
  nav a{color:inherit}
</style>
</head>
<body>
<nav class="muted"><a href="/">${SITE_NAME}</a> › ${escapeHtml(brand)} Angebote</nav>
<h1>${escapeHtml(brand)} Energy-Drink-Angebote (KW ${kw})</h1>
<p>${escapeHtml(brand)} im Preisvergleich der aktuellen Wochenprospekte – sortiert nach Preis pro Liter.
Bester Preis diese Woche: <strong>${escapeHtml(euro(best.price))}</strong> bei ${escapeHtml(best.market)}.</p>
<table>
<thead><tr><th>Produkt</th><th>Markt</th><th>Gebinde</th><th>Preis</th><th>Grundpreis</th></tr></thead>
<tbody>
${rows}
</tbody>
</table>
<a class="cta" href="/">Alle Energy-Deals live vergleichen &amp; Preiswecker setzen →</a>
<p class="muted" style="margin-top:2rem">Unabhängig, nicht von ${escapeHtml(brand)} autorisiert. Datenquelle: Wochenprospekte.</p>
</body>
</html>
`
}
