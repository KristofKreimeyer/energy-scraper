/**
 * penny-native-scraper.js
 *
 * Zweck: Liest Penny-Wochenangebote direkt aus Pennys eigenem REST-Feed
 *   https://www.penny.de/.rest/offers/by-category/<JAHR-KW>/<kategorie>
 * statt über den marktguru-Aggregator. Vorteil: strukturierte Preisfelder
 * statt Freitext – regulärer Preis, App-/Loyalty-Preis, UVP, Rabatt%,
 * Grundpreis (€/L) je Preis liegen als eigene Felder vor. Damit wird die
 * App-Preis-Trennung (siehe prepare-data.mjs) robust und wir gewinnen die
 * Ersparnis-Anzeige, die marktguru für Penny nicht liefert.
 *
 * Einzelsorten sind NICHT enthalten: Penny bewirbt Energy-Drinks wie alle
 * Quellen als Sortenbündel ("versch. Sorten") zu einem Preis.
 *
 * Nutzung:
 *   node penny-native-scraper.js            # aktuelle ISO-Woche
 *   node penny-native-scraper.js 2026-31    # bestimmte KW (JAHR-KW) erzwingen
 *
 * Kein Auth-Token nötig; direkter fetch reicht (kein Playwright).
 */

const fs = require("fs");
const path = require("path");

const OUT_DIR = path.join(__dirname, "captured");
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR);

// Energy-Drinks sind Getränke; sie erscheinen zuverlässig in den Top-Angeboten
// und in der Getränke-Kategorie. Andere Slugs liefern 404 – wir ignorieren sie.
const CATEGORIES = ["top-angebote", "getraenke"];

const BRAND_PATTERNS = [
  { brand: "Monster", pattern: /\bmonster\b/i },
  { brand: "Red Bull", pattern: /red\s*bull/i },
  { brand: "Rockstar", pattern: /rockstar/i },
  { brand: "Gönnergy", pattern: /g[öo]nnergy|g[öo]nrgy|montana\s*black/i },
];

// Wie bei marktguru: Marke UND "Energy" im Text nötig, um Fehltreffer
// (z. B. "Monster Trucks") auszuschließen.
function matchBrand(text) {
  const hit = BRAND_PATTERNS.find((b) => b.pattern.test(text));
  if (!hit) return null;
  if (!/energy/i.test(text)) return null;
  return hit;
}

const REQUEST_HEADERS = {
  accept: "application/json",
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  referer: "https://www.penny.de/angebote",
  "accept-language": "de-DE,de;q=0.9",
};

/** ISO-8601-Kalenderwoche (Penny nummeriert die Angebotswoche danach). */
function isoYearWeek(date) {
  const t = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const day = (t.getUTCDay() + 6) % 7; // Mo=0 … So=6
  t.setUTCDate(t.getUTCDate() - day + 3); // auf den Donnerstag der Woche
  const firstThursday = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  const week =
    1 +
    Math.round(
      ((t - firstThursday) / 86400000 -
        3 +
        ((firstThursday.getUTCDay() + 6) % 7)) /
        7,
    );
  return { year: t.getUTCFullYear(), week };
}

/** UTC-Offset der Zone Europe/Berlin (Sommer +2h, Winter +1h) in Minuten. */
function berlinOffsetMinutes(d) {
  const local = new Date(d.toLocaleString("en-US", { timeZone: "Europe/Berlin" }));
  const utc = new Date(d.toLocaleString("en-US", { timeZone: "UTC" }));
  return Math.round((local - utc) / 60000);
}

/** ISO-String für ein Berliner Datum um HH:mm Ortszeit. */
function berlinIso(year, monthIdx, day, hh, mm) {
  // Grober UTC-Ausgangspunkt zur Offset-Bestimmung, dann exakt umrechnen.
  const probe = new Date(Date.UTC(year, monthIdx, day, hh, mm));
  const off = berlinOffsetMinutes(probe);
  return new Date(Date.UTC(year, monthIdx, day, hh, mm) - off * 60000).toISOString();
}

/** Mo 00:00 bis Sa 23:59 (Ortszeit) der angegebenen ISO-Woche. */
function weekValidity(year, week) {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = (jan4.getUTCDay() + 6) % 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - jan4Day + (week - 1) * 7);
  const sat = new Date(monday);
  sat.setUTCDate(monday.getUTCDate() + 5);
  return {
    validFrom: berlinIso(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate(), 0, 0),
    validTo: berlinIso(sat.getUTCFullYear(), sat.getUTCMonth(), sat.getUTCDate(), 23, 59),
  };
}

/** "1,79" / "0.79*" / "(1 l = 3.96)" -> Zahl (erste Preiszahl) oder null. */
function num(s) {
  if (s == null) return null;
  const m = String(s).match(/(\d+(?:[.,]\d+)?)/);
  return m ? parseFloat(m[1].replace(",", ".")) : null;
}

/** Grundpreis (€/L) aus "… (1 l = 3.96)" ziehen. */
function perLiter(s) {
  const m = String(s || "").match(/1\s*l\s*=\s*(\d+(?:[.,]\d+)?)/i);
  return m ? parseFloat(m[1].replace(",", ".")) : null;
}

const money = (n) => (n != null ? `${n.toFixed(2).replace(".", ",")} €` : null);

/**
 * Preisfelder eines Tiles auf regulär/App/UVP normalisieren.
 * Penny kodiert den App-Preis auf zwei Arten:
 *  a) eigenes Feld benefitPrice (price = regulär),   z. B. Red Bull
 *  b) price selbst mit "*" (crossOutPrice = regulär), z. B. Rockstar
 */
function derivePrices(t) {
  const asterisk = (s) => /\*/.test(String(s || ""));
  let regularPrice = null;
  let appPrice = null;
  let uvp = null;

  if (t.benefitPrice != null) {
    appPrice = num(t.benefitPrice);
    regularPrice = num(t.price);
    uvp = num(t.listPrice); // UVP oberhalb des regulären Preises
  } else if (asterisk(t.price)) {
    appPrice = num(t.price);
    regularPrice = num(t.crossOutPrice) ?? num(t.listPrice);
    uvp = null; // crossOutPrice IST der reguläre Preis, kein UVP darüber
  } else {
    regularPrice = num(t.price);
    uvp = num(t.crossOutPrice) ?? num(t.listPrice);
  }

  const oldPrice =
    uvp != null && regularPrice != null && uvp > regularPrice ? uvp : null;
  return { regularPrice, appPrice, uvp: oldPrice };
}

async function fetchCategory(yearWeek, cat) {
  const url = `https://www.penny.de/.rest/offers/by-category/${yearWeek}/${cat}`;
  const res = await fetch(url, { headers: REQUEST_HEADERS });
  if (!res.ok) return []; // 404 = Kategorie diese Woche nicht vorhanden
  const data = await res.json();
  return Array.isArray(data.offerTiles) ? data.offerTiles : [];
}

(async () => {
  const arg = process.argv[2];
  let year, week;
  if (arg && /^\d{4}-\d{1,2}$/.test(arg)) {
    [year, week] = arg.split("-").map(Number);
  } else {
    ({ year, week } = isoYearWeek(new Date()));
  }
  const yearWeek = `${year}-${week}`;
  console.log(`Penny nativer Feed, Kalenderwoche ${yearWeek}\n`);

  const { validFrom, validTo } = weekValidity(year, week);

  // Tiles aus allen Kategorien einsammeln, per uuid deduplizieren.
  const byId = new Map();
  for (const cat of CATEGORIES) {
    const tiles = await fetchCategory(yearWeek, cat);
    console.log(`  ${cat}: ${tiles.length} Angebot(e)`);
    for (const t of tiles) {
      const id = t.uuid || `${cat}:${t.title}`;
      if (!byId.has(id)) byId.set(id, { cat, tile: t });
    }
    await new Promise((r) => setTimeout(r, 150));
  }

  const scrapedAt = new Date().toISOString();
  const offers = [];
  for (const { cat, tile } of byId.values()) {
    const hit = matchBrand(tile.title || "");
    if (!hit) continue;

    const { regularPrice, appPrice, uvp } = derivePrices(tile);
    if (regularPrice == null) continue;

    const title = (tile.title || "")
      .replace(hit.pattern, "")
      .replace(/\s+/g, " ")
      .trim();

    offers.push({
      supermarket: "Penny",
      brand: hit.brand,
      productBrand: hit.brand,
      title: title || "Energy-Drink",
      description: tile.quantity || null,
      salesUnit: tile.quantity || null,
      price: money(regularPrice),
      priceNumber: regularPrice,
      oldPrice: uvp != null ? money(uvp) : null,
      pricePerLiter: perLiter(tile.basePrice),
      // Strukturierte App-/Loyalty-Preisfelder (prepare-data bevorzugt diese
      // vor der Freitext-Erkennung):
      appPriceNumber: appPrice,
      appPerLiter: perLiter(tile.benefitGroundPrice),
      validFrom,
      validTo,
      imageUrl: tile.imageRendition ? tile.imageRendition.tileSm || null : null,
      sourceUrl: tile.linkHref
        ? `https://www.penny.de${tile.linkHref}`
        : "https://www.penny.de/angebote",
      offerId: tile.uuid || `penny-${cat}-${title}`,
      scrapedAt,
    });
  }

  console.log(`\n${offers.length} Energy-Drink-Angebot(e) bei Penny:`);
  offers.forEach((o) =>
    console.log(
      `  [${o.brand}] ${o.title} – ${o.price}` +
        (o.appPriceNumber != null ? ` (App ${money(o.appPriceNumber)})` : "") +
        (o.oldPrice ? ` statt ${o.oldPrice}` : ""),
    ),
  );

  const outPath = path.join(OUT_DIR, "penny-offers.json");
  fs.writeFileSync(outPath, JSON.stringify(offers, null, 2));
  console.log(`\nGespeichert: captured/penny-offers.json`);
})().catch((err) => {
  console.error("Fehler:", err.message);
  process.exit(1);
});
