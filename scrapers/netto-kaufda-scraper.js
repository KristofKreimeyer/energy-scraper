/**
 * netto-kaufda-scraper.js
 *
 * Zweck: Extrahiert Netto-Marken-Discount-Angebote über kaufda.de
 * (Bonial), das dank vorgefilterter "/Sortiment/Energydrink"-URL und
 * eingebettetem __NEXT_DATA__-JSON strukturierte Daten ganz ohne
 * Playwright liefert. Kein Bot-Schutz beobachtet (im Gegensatz zu
 * netto-online.de direkt, das Akamai-geschützt ist).
 *
 * Funktioniert vermutlich auch für andere Händler über dieselbe
 * URL-Struktur: https://www.kaufda.de/{Haendler}/Sortiment/Energydrink
 *
 * Nutzung:
 *   node netto-kaufda-scraper.js
 *   node netto-kaufda-scraper.js "Netto-Supermarkt"   (die andere Netto-Kette)
 */

const fs = require("fs");
const path = require("path");

const RETAILER_PATH_SEGMENT = process.argv[2] || "Netto-Marken-Discount";
const URL = `https://www.kaufda.de/${RETAILER_PATH_SEGMENT}/Sortiment/Energydrink`;

const OUT_DIR = path.join(__dirname, "captured");
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR);

const BRAND_PATTERNS = [
  { brand: "Monster", pattern: /\bmonster\b/i },
  { brand: "Red Bull", pattern: /red\s*bull/i },
  { brand: "Rockstar", pattern: /rockstar/i },
  { brand: "Gönnergy", pattern: /g[öo]nnergy|g[öo]nrgy|montana\s*black/i },
];

function matchBrand(text) {
  const hit = BRAND_PATTERNS.find((b) => b.pattern.test(text));
  if (!hit) return null;
  if (!/energy/i.test(text)) return null;
  return hit.brand;
}

const NEXT_DATA_MARKER = '__NEXT_DATA__" type="application/json">';

(async () => {
  console.log(`Rufe ab: ${URL}\n`);

  const res = await fetch(URL, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
  });
  if (!res.ok) {
    console.error(`Fehler: HTTP ${res.status}`);
    process.exit(1);
  }
  const html = await res.text();

  const start = html.indexOf(NEXT_DATA_MARKER);
  if (start === -1) {
    console.error(
      "__NEXT_DATA__ nicht gefunden - Seitenstruktur hat sich evtl. geändert.",
    );
    process.exit(1);
  }
  const jsonStart = start + NEXT_DATA_MARKER.length;
  const jsonEnd = html.indexOf("</script>", jsonStart);
  const nextData = JSON.parse(html.slice(jsonStart, jsonEnd));

  const offers = nextData.props.pageProps.pageInformation.offers;
  const items = offers && offers.main ? offers.main.items : [];

  console.log(
    `${items.length} Angebot(e) gefunden (Seite ist bereits auf "Energydrink" vorgefiltert).`,
  );

  const energyDrinkOffers = items
    .map((item) => {
      const searchText = `${item.brand || ""} ${item.title || ""}`;
      const brand = matchBrand(searchText);
      if (!brand) return null;

      const prices = item.prices || {};

      return {
        brand,
        supermarket: "Netto Marken-Discount",
        title: item.title,
        description: item.description || null,
        productBrand: item.brand,
        price: prices.mainPriceFormatted || null,
        priceNumber: prices.mainPrice != null ? prices.mainPrice : null,
        oldPrice: prices.secondaryPriceFormatted || null,
        pricePerBaseUnit: prices.priceByBaseUnit || null,
        validFrom: item.validFrom || null,
        validTo: item.validUntil || null,
        imageUrl: item.offerImages ? item.offerImages.url.normal : null,
        sourcePage: item.parentContent ? item.parentContent.page.number : null,
        sourceUrl: URL,
        scrapedAt: new Date().toISOString(),
      };
    })
    .filter(Boolean);

  console.log(
    `Davon ${energyDrinkOffers.length} Energy-Drink-Angebot(e) (Monster/Red Bull/Rockstar/Gönnergy).\n`,
  );

  energyDrinkOffers.forEach((o) => {
    console.log(
      `  [${o.brand}] ${o.title} – ${o.price} (gültig bis ${o.validTo})`,
    );
  });

  const outPath = path.join(OUT_DIR, "netto-offers.json");
  fs.writeFileSync(outPath, JSON.stringify(energyDrinkOffers, null, 2));
  console.log(`\nGespeichert: captured/netto-offers.json`);

  if (energyDrinkOffers.length === 0 && items.length > 0) {
    console.log(
      "\nHinweis: Angebote gefunden, aber keine unserer 4 Marken. Alle Titel/Marken zur Kontrolle:",
    );
    items.forEach((it) =>
      console.log(`  - ${it.title} (Marke: ${it.brand || "–"})`),
    );
  }
})();
