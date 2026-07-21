/**
 * aldi-sued-prospekt-scraper.js
 *
 * Zweck: Liest die Publitas-Hotspot-JSON-Dateien einer Aldi-Süd-
 * Prospekt-Publikation seitenweise aus (KEIN Playwright nötig, da
 * hotspots_data.json ein direkt abrufbares, statisches JSON ist -
 * kein JS-Rendering im Spiel). Iteriert automatisch durch alle
 * Doppelseiten, bis keine weiteren mehr existieren.
 *
 * Nutzung:
 *   node aldi-sued-prospekt-scraper.js "kw29-26-op-mp"
 *
 * Das Argument ist der Publikations-Slug aus der URL, z.B. bei
 * https://prospekt.aldi-sued.de/kw29-26-op-mp/page/10-11
 * ist der Slug "kw29-26-op-mp".
 */

const fs = require('fs');
const path = require('path');

const PUBLICATION_SLUG = process.argv[2];
if (!PUBLICATION_SLUG) {
  console.error('Bitte Publikations-Slug angeben, z.B.:');
  console.error('  node aldi-sued-prospekt-scraper.js "kw29-26-op-mp"');
  process.exit(1);
}

const BASE_URL = `https://prospekt.aldi-sued.de/${PUBLICATION_SLUG}/page`;
const OUT_DIR = path.join(__dirname, 'captured');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR);

const BRAND_PATTERNS = [
  { brand: 'Monster', pattern: /monster/i },
  { brand: 'Red Bull', pattern: /red\s*bull/i },
  { brand: 'Rockstar', pattern: /rockstar/i },
  { brand: 'Gönnergy', pattern: /g[öo]nnergy|g[öo]nrgy|montana\s*black/i },
];

function matchBrand(text) {
  const hit = BRAND_PATTERNS.find((b) => b.pattern.test(text));
  return hit ? hit.brand : null;
}

// Node 18+ hat global fetch(). Falls du eine ältere Node-Version
// nutzt, gib Bescheid - dann brauchen wir node-fetch als Dependency.
async function fetchPage(pageRange) {
  const url = `${BASE_URL}/${pageRange}/hotspots_data.json`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return { url, data };
  } catch (e) {
    return null;
  }
}

(async () => {
  console.log(`Publikation: ${PUBLICATION_SLUG}`);
  console.log('Durchsuche Doppelseiten...\n');

  const allHotspots = [];
  let consecutiveMisses = 0;
  let pageStart = 1;
  const MAX_MISSES = 4; // nach 4 aufeinanderfolgenden Fehlschlägen abbrechen
  const MAX_PAGES = 120; // Sicherheitsgrenze gegen Endlosschleifen

  while (consecutiveMisses < MAX_MISSES && pageStart <= MAX_PAGES) {
    const pageRange = `${pageStart}-${pageStart + 1}`;
    const result = await fetchPage(pageRange);

    if (result) {
      console.log(`  [OK] Seite ${pageRange}: ${result.data.length} Hotspot(s)`);
      allHotspots.push(
        ...result.data.map((h) => ({ ...h, _sourcePage: pageRange }))
      );
      consecutiveMisses = 0;
    } else {
      console.log(`  [---] Seite ${pageRange}: nicht gefunden`);
      consecutiveMisses++;
    }

    pageStart += 2;
  }

  console.log(`\nInsgesamt ${allHotspots.length} Hotspot(s) über alle Seiten gefunden.`);

  // Produkte aus den Hotspots extrahieren (ein Hotspot kann mehrere
  // Produkt-Varianten enthalten, meist aber genau eines)
  const allProducts = [];
  allHotspots.forEach((hotspot) => {
    (hotspot.products || []).forEach((product) => {
      allProducts.push({ ...product, _sourcePage: hotspot._sourcePage });
    });
  });

  console.log(`Insgesamt ${allProducts.length} Produkt(e) über alle Seiten gefunden.\n`);

  const energyDrinkOffers = allProducts
    .map((product) => {
      const searchText = `${product.brand || ''} ${product.title || ''}`;
      const brand = matchBrand(searchText);
      if (!brand) return null;

      return {
        brand,
        supermarket: 'Aldi Süd',
        title: product.title,
        description: product.description,
        price: product.price ? `${product.price.replace('.', ',')} €` : null,
        priceNumber: product.price ? parseFloat(product.price) : null,
        productBrand: product.brand,
        productType: product.productType || null,
        salesUnit: product.customLabel8 || null,
        validFrom: product.customLabel1 || null,
        webshopIdentifier: product.webshopIdentifier || null,
        imageUrl: product.photoSharingUrl || null,
        sourcePage: product._sourcePage,
        sourceUrl: `${BASE_URL}/${product._sourcePage}`,
        scrapedAt: new Date().toISOString(),
      };
    })
    .filter(Boolean);

  console.log(
    `Davon ${energyDrinkOffers.length} Energy-Drink-Angebot(e) (Monster/Red Bull/Rockstar/Gönnergy).\n`
  );

  energyDrinkOffers.forEach((o) => {
    console.log(
      `  [${o.brand}] ${o.title} – ${o.price || 'kein Preis'} (Seite ${o.sourcePage})`
    );
  });

  const outPath = path.join(OUT_DIR, 'aldi-sued-offers.json');
  fs.writeFileSync(outPath, JSON.stringify(energyDrinkOffers, null, 2));
  console.log(`\nGespeichert: captured/aldi-sued-offers.json`);

  if (energyDrinkOffers.length === 0 && allProducts.length > 0) {
    console.log(
      '\nHinweis: Keine unserer 4 Marken gefunden. Erste 10 gefundene Marken/Titel zur Kontrolle:'
    );
    allProducts.slice(0, 10).forEach((p) =>
      console.log(`  - ${p.title} (Marke: ${p.brand || '–'})`)
    );
  }
})();
