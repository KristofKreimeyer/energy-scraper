/**
 * marktguru-api-scraper.js
 *
 * Zweck: Nutzt die echte marktguru-JSON-API (gefunden über den
 * Network-Tab) statt HTML-Parsing. Sauberes limit/offset-Pagination-
 * Schema, exakte validFrom/validTo-Zeitstempel, direkte brand/price-
 * Felder - kein Rätselraten mehr nötig.
 *
 * Funktioniert für JEDEN Händler-Slug (kaufland, lidl, ...) über
 * denselben Code.
 *
 * Nutzung:
 *   node marktguru-api-scraper.js kaufland
 *   node marktguru-api-scraper.js lidl
 *   node marktguru-api-scraper.js kaufland 44135   (mit eigener PLZ)
 */

const fs = require("fs");
const path = require("path");

const RETAILER_SLUG = process.argv[2];
const ZIP_CODE = process.argv[3] || "99084"; // Default aus dem beobachteten Request

if (!RETAILER_SLUG) {
  console.error("Bitte Händler-Slug angeben, z.B.:");
  console.error("  node marktguru-api-scraper.js kaufland");
  console.error("  node marktguru-api-scraper.js lidl");
  process.exit(1);
}

const OUT_DIR = path.join(__dirname, "captured");
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR);

const BRAND_PATTERNS = [
  { brand: "Monster", pattern: /\bmonster\b/i },
  { brand: "Red Bull", pattern: /red\s*bull/i },
  { brand: "Rockstar", pattern: /rockstar/i },
  { brand: "Gönnergy", pattern: /g[öo]nnergy|g[öo]nrgy|montana\s*black/i },
];

// Erfordert Marke UND das Wort "Energy" im Text - reine Marken-
// Treffer wie "Monster Trucks" (Spielzeug) oder "Monstera" (Pflanze)
// werden so ausgeschlossen, ohne für jede Marke eine Ausschlussliste
// pflegen zu muessen. Alle echten Energy-Drink-Angebote enthalten
// "Energy" im Produktnamen ("Energy Drink", "Energydrink").
function matchBrand(text) {
  const hit = BRAND_PATTERNS.find((b) => b.pattern.test(text));
  if (!hit) return null;
  if (!/energy/i.test(text)) return null;
  return hit.brand;
}

const LIMIT = 14; // wie im beobachteten Request, könnte theoretisch höher gesetzt werden

const REQUEST_HEADERS = {
  accept: "application/json",
  "content-type": "application/json",
  origin: "https://www.marktguru.de",
  referer: "https://www.marktguru.de/",
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36",
  // Clientseitig im JS-Bundle eingebettete Keys - kein echtes Secret
  // (jeder Website-Besucher bekommt sie automatisch mitgeliefert),
  // aber die API blockt Requests ohne diese Header mit 401.
  "x-apikey": "8Kk+pmbf7TgJ9nVj2cXeA7P5zBGv8iuutVVMRfOfvNE=",
  "x-clientkey": "0CDIcG1Sd25JSNp4Ia2KZVThzL3+z56naAAGLTu74tc=",
};

function buildUrl(offset) {
  return (
    `https://api.marktguru.de/api/v1/publishers/retailer/${RETAILER_SLUG}/offers` +
    `?as=mobile&limit=${LIMIT}&offset=${offset}&zipCode=${ZIP_CODE}`
  );
}

(async () => {
  console.log(`Händler: ${RETAILER_SLUG}, PLZ: ${ZIP_CODE}\n`);

  let offset = 0;
  let totalResults = null;
  const allResults = [];

  while (totalResults === null || offset < totalResults) {
    const url = buildUrl(offset);
    const res = await fetch(url, { headers: REQUEST_HEADERS });

    if (!res.ok) {
      console.error(`HTTP ${res.status} bei offset=${offset} - stoppe.`);
      break;
    }

    const data = await res.json();
    totalResults = data.totalResults;
    allResults.push(...data.results);

    console.log(
      `  offset=${offset}: ${data.results.length} Ergebnis(se) (von insgesamt ${totalResults})`,
    );

    if (data.results.length === 0) break; // Sicherheitsnetz gegen Endlosschleife
    offset += LIMIT;

    await new Promise((r) => setTimeout(r, 200)); // kleine Pause zwischen Requests
  }

  console.log(
    `\n${allResults.length} Angebot(e) insgesamt abgerufen (alle Kategorien).`,
  );

  const energyDrinkOffers = allResults
    .map((offer) => {
      const productName = offer.product ? offer.product.name : "";
      const brandName = offer.brand ? offer.brand.name : "";
      const searchText = `${brandName} ${productName}`;
      const brand = matchBrand(searchText);
      if (!brand) return null;

      return {
        brand,
        supermarket:
          RETAILER_SLUG.charAt(0).toUpperCase() + RETAILER_SLUG.slice(1),
        title: productName,
        productBrand: brandName,
        description: offer.description || null,
        price:
          offer.price != null
            ? `${offer.price.toFixed(2).replace(".", ",")} €`
            : null,
        priceNumber: offer.price,
        referencePrice: offer.referencePrice || null,
        unit: offer.unit ? offer.unit.name : null,
        quantity: offer.quantity || null,
        validFrom: offer.validFrom || null,
        validTo: offer.validTo || null,
        imageUrl: `https://cdn.marktguru.de/api/v1/offers/${offer.id}/images/default/0/medium.webp`,
        offerId: offer.id,
        sourceUrl: `https://www.marktguru.de/offers/${offer.id}`,
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

  const outPath = path.join(OUT_DIR, `marktguru-${RETAILER_SLUG}-offers.json`);
  fs.writeFileSync(outPath, JSON.stringify(energyDrinkOffers, null, 2));
  console.log(`\nGespeichert: captured/marktguru-${RETAILER_SLUG}-offers.json`);

  if (energyDrinkOffers.length === 0 && allResults.length > 0) {
    console.log(
      "\nHinweis: Keine unserer 4 Marken gefunden. Möglicherweise gerade kein " +
        "Energy-Drink-Angebot bei diesem Händler diese Woche.",
    );
  }
})();
