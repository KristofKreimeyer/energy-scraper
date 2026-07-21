/**
 * rewe-scraper.js
 *
 * Zweck: Extrahiert alle Angebote von der Rewe-Getränke-Angebotsseite,
 * filtert nach unseren vier Energy-Drink-Marken und normalisiert sie
 * in ein einheitliches Schema.
 *
 * Nutzung:
 *   node rewe-scraper.js "https://www.rewe.de/angebote/nationale-angebote/alkoholfreie-getraenke/"
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const TARGET_URL =
  process.argv[2] ||
  'https://www.rewe.de/angebote/nationale-angebote/alkoholfreie-getraenke/';

const OUT_DIR = path.join(__dirname, 'captured');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR);

// Erkennungsmuster für unsere vier Marken. Bewusst mehrere
// Schreibweisen pro Marke, da Rewe z.B. "Monster Energy" und
// "Monster Energy Drink" gemischt nutzen könnte.
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

// Extrahiert den Literpreis aus einem String wie "(1 l = 3,96 €)"
function extractPricePerLiter(additionalTexts) {
  for (const t of additionalTexts) {
    const match = t.match(/1\s*l\s*=\s*([\d,]+)\s*€/i);
    if (match) return match[1].replace(',', '.');
  }
  return null;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    locale: 'de-DE',
  });
  const page = await context.newPage();

  console.log(`Lade: ${TARGET_URL}`);
  await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {
    console.warn('Timeout - fahre trotzdem fort.');
  });

  const consentSelectors = [
    'button:has-text("Alle akzeptieren")',
    'button:has-text("Akzeptieren")',
    'button:has-text("Zustimmen")',
  ];
  for (const sel of consentSelectors) {
    try {
      const btn = await page.$(sel);
      if (btn) {
        await btn.click({ timeout: 2000 });
        await page.waitForTimeout(2000);
        break;
      }
    } catch (e) {}
  }

  // Gründlich scrollen, damit auch spät ladende Lazy-Content-Bereiche
  // (weitere Kategorien/Kartenreihen) sicher gerendert sind.
  await page.evaluate(async () => {
    for (let i = 0; i < 20; i++) {
      window.scrollBy(0, 700);
      await new Promise((r) => setTimeout(r, 350));
    }
  });
  await page.waitForTimeout(2000);

  // Manche Kategorie-Seiten zeigen erst eine begrenzte Auswahl und
  // laden den Rest erst nach Klick auf "Mehr anzeigen"/"Alle Angebote".
  // Wiederholt versuchen, bis kein Button mehr gefunden wird (max 10x
  // als Sicherheitsgrenze gegen Endlosschleifen).
  const loadMoreSelectors = [
    'button:has-text("Mehr anzeigen")',
    'button:has-text("Alle anzeigen")',
    'button:has-text("Weitere Angebote")',
    'button:has-text("Mehr laden")',
    'button:has-text("Alle Angebote")',
    '[data-testid*="load-more" i]',
    '[data-testid*="show-more" i]',
  ];
  let loadMoreClicks = 0;
  for (let attempt = 0; attempt < 10; attempt++) {
    let clicked = false;
    for (const sel of loadMoreSelectors) {
      try {
        const btn = await page.$(sel);
        if (btn) {
          const visible = await btn.isVisible();
          if (visible) {
            await btn.click({ timeout: 2000 });
            loadMoreClicks++;
            clicked = true;
            console.log(`"Mehr laden"-Button geklickt (${loadMoreClicks}x) via "${sel}".`);
            await page.waitForTimeout(2000);
            break;
          }
        }
      } catch (e) {}
    }
    if (!clicked) break;
  }
  if (loadMoreClicks === 0) {
    console.log('Kein "Mehr laden"-Button gefunden - Seite zeigt vermutlich schon alles.');
  }

  // Nach dem Nachladen nochmal scrollen, falls neue Karten
  // erst per Lazy-Load sichtbar werden.
  await page.evaluate(async () => {
    for (let i = 0; i < 15; i++) {
      window.scrollBy(0, 700);
      await new Promise((r) => setTimeout(r, 300));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(1500);

  const rawOffers = await page.evaluate(() => {
    const tiles = Array.from(document.querySelectorAll('article.cor-offer-renderer-tile'));

    return tiles.map((tile) => {
      const titleLink = tile.querySelector('.cor-offer-information__title-link');
      const title = titleLink ? titleLink.getAttribute('data-offer-title') : null;
      const offerId = titleLink ? titleLink.getAttribute('data-offer-id') : null;

      const additionalEls = Array.from(
        tile.querySelectorAll('.cor-offer-information__additional')
      );
      const additionalTexts = additionalEls.map((el) => el.textContent.trim());

      const priceEl = tile.querySelector('.cor-offer-price__tag-price');
      const price = priceEl ? priceEl.textContent.trim() : null;

      const priceLabelEl = tile.querySelector('.cor-offer-price__tag-label');
      const priceLabel = priceLabelEl ? priceLabelEl.textContent.trim() : null;

      const loyaltyEl = tile.querySelector('.cor-loyalty-badge');
      const loyaltyBonus = loyaltyEl ? loyaltyEl.textContent.trim() : null;

      const imgEl = tile.querySelector('img[data-testid="offer-image"]');
      const imageUrl = imgEl ? imgEl.getAttribute('src') : null;

      return {
        title,
        offerId,
        price,
        priceLabel,
        loyaltyBonus,
        additionalTexts,
        imageUrl,
      };
    });
  });

  console.log(`\n${rawOffers.length} Angebot(e) auf der Seite gefunden (alle Kategorien).`);

  // Nach unseren vier Marken filtern und normalisieren
  const energyDrinkOffers = rawOffers
    .map((offer) => {
      const brand = offer.title ? matchBrand(offer.title) : null;
      if (!brand) return null;

      return {
        brand,
        supermarket: 'Rewe',
        title: offer.title,
        offerId: offer.offerId,
        price: offer.price,
        priceLabel: offer.priceLabel,
        pricePerLiter: extractPricePerLiter(offer.additionalTexts),
        details: offer.additionalTexts.join(' '),
        loyaltyBonus: offer.loyaltyBonus,
        imageUrl: offer.imageUrl,
        sourceUrl: TARGET_URL,
        scrapedAt: new Date().toISOString(),
      };
    })
    .filter(Boolean);

  console.log(`Davon ${energyDrinkOffers.length} Energy-Drink-Angebot(e) (Monster/Red Bull/Rockstar/Gönnergy).\n`);

  energyDrinkOffers.forEach((o) => {
    console.log(`  [${o.brand}] ${o.title} – ${o.price} (${o.priceLabel || 'kein Label'})`);
  });

  const outPath = path.join(OUT_DIR, 'rewe-offers.json');
  fs.writeFileSync(outPath, JSON.stringify(energyDrinkOffers, null, 2));
  console.log(`\nGespeichert: captured/rewe-offers.json`);

  if (energyDrinkOffers.length === 0 && rawOffers.length > 0) {
    console.log(
      '\nHinweis: Es wurden Angebote gefunden, aber keine unserer 4 Marken. ' +
        'Das kann heißen: aktuell einfach kein Energy-Drink-Deal diese Woche, ' +
        'oder die Getränke-Seite zeigt nur eine Teilkategorie. ' +
        'Erste 5 gefundene Titel zur Kontrolle:'
    );
    rawOffers.slice(0, 5).forEach((o) => console.log(`  - ${o.title}`));
  }

  await browser.close();
})();
