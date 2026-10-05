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

const { matchBrandHit, writeOffers, isoYearWeek, weekValidity } = require('./lib/common');

// Energy-Drinks sind Getränke; sie erscheinen zuverlässig in den Top-Angeboten
// und in der Getränke-Kategorie. Andere Slugs liefern 404 – wir ignorieren sie.
const CATEGORIES = ['top-angebote', 'getraenke'];

// Wie bei marktguru: Marke UND "Energy" im Text nötig, um Fehltreffer
// (z. B. "Monster Trucks") auszuschließen.
const matchBrand = (text) => matchBrandHit(text, { strict: true, requireEnergy: true });

const REQUEST_HEADERS = {
  accept: 'application/json',
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  referer: 'https://www.penny.de/angebote',
  'accept-language': 'de-DE,de;q=0.9',
};

/** "1,79" / "0.79*" / "(1 l = 3.96)" -> Zahl (erste Preiszahl) oder null. */
function num(s) {
  if (s == null) return null;
  const m = String(s).match(/(\d+(?:[.,]\d+)?)/);
  return m ? parseFloat(m[1].replace(',', '.')) : null;
}

/** Grundpreis (€/L) aus "… (1 l = 3.96)" ziehen. */
function perLiter(s) {
  const m = String(s || '').match(/1\s*l\s*=\s*(\d+(?:[.,]\d+)?)/i);
  return m ? parseFloat(m[1].replace(',', '.')) : null;
}

const money = (n) => (n != null ? `${n.toFixed(2).replace('.', ',')} €` : null);

/**
 * Preisfelder eines Tiles auf regulär/App/UVP normalisieren.
 * Penny kodiert den App-Preis auf zwei Arten:
 *  a) eigenes Feld benefitPrice (price = regulär),   z. B. Red Bull
 *  b) price selbst mit "*" (crossOutPrice = regulär), z. B. Rockstar
 */
function derivePrices(t) {
  const asterisk = (s) => /\*/.test(String(s || ''));
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

  const oldPrice = uvp != null && regularPrice != null && uvp > regularPrice ? uvp : null;
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
    [year, week] = arg.split('-').map(Number);
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
  const allOffers = [];
  for (const { cat, tile } of byId.values()) {
    const hit = matchBrand(tile.title || '');
    if (!hit) continue;

    const { regularPrice, appPrice, uvp } = derivePrices(tile);
    if (regularPrice == null) continue;

    const title = (tile.title || '').replace(hit.pattern, '').replace(/\s+/g, ' ').trim();

    allOffers.push({
      supermarket: 'Penny',
      brand: hit.brand,
      productBrand: hit.brand,
      title: title || 'Energy-Drink',
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
      // linkHref kommt mal relativ ("/angebote/..."), mal schon absolut
      // (z. B. Kampagnen-Kacheln wie "https://www.penny.de/aktionen/...") -
      // die Domain nur voranstellen, wenn sie nicht schon drin steckt
      // (sonst "https://www.penny.dehttps://www.penny.de/...").
      sourceUrl: tile.linkHref
        ? /^https?:\/\//i.test(tile.linkHref)
          ? tile.linkHref
          : `https://www.penny.de${tile.linkHref}`
        : 'https://www.penny.de/angebote',
      offerId: tile.uuid || `penny-${cat}-${title}`,
      scrapedAt,
    });
  }

  // Dasselbe Angebot steht in mehreren Kategorien (top-angebote UND getraenke)
  // mit jeweils eigener uuid – inhaltlich gleiche Einträge nur einmal behalten,
  // sonst würde die App sie als „2 Sorten" bündeln.
  const seen = new Set();
  const offers = allOffers.filter((o) => {
    const key = [o.title, o.priceNumber, o.appPriceNumber, o.validFrom, o.validTo].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log(`\n${offers.length} Energy-Drink-Angebot(e) bei Penny:`);
  offers.forEach((o) =>
    console.log(
      `  [${o.brand}] ${o.title} – ${o.price}` +
        (o.appPriceNumber != null ? ` (App ${money(o.appPriceNumber)})` : '') +
        (o.oldPrice ? ` statt ${o.oldPrice}` : ''),
    ),
  );

  writeOffers('penny-offers.json', offers);
})().catch((err) => {
  console.error('Fehler:', err.message);
  process.exit(1);
});
