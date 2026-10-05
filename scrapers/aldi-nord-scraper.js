/**
 * aldi-nord-scraper.js
 *
 * Zweck: Extrahiert alle Angebote von der Aldi-Nord-Angebotsseite,
 * filtert nach unseren vier Energy-Drink-Marken und normalisiert sie
 * in dasselbe Schema wie rewe-scraper.js.
 *
 * Nutzung:
 *   node aldi-nord-scraper.js "https://www.aldi-nord.de/angebote.html"
 */

const { matchBrand, writeOffers, openPage, acceptConsent, autoScroll } = require('./lib/common');

const TARGET_URL = process.argv[2] || 'https://www.aldi-nord.de/angebote.html';
const BASE_URL = 'https://www.aldi-nord.de';

(async () => {
  const { browser, page } = await openPage(TARGET_URL);
  await acceptConsent(page);

  // Gründlich scrollen, damit auch spät ladende Produktkarten
  // (Lazy-Loading) sicher gerendert sind.
  await autoScroll(page, { steps: 25, delayMs: 300, toTop: true });
  await page.waitForTimeout(2000);

  const rawOffers = await page.evaluate(() => {
    const tiles = Array.from(document.querySelectorAll('div.product-tile'));

    return tiles.map((tile) => {
      const nameEl = tile.querySelector('[data-testid$="product-name"]');
      const title = nameEl ? nameEl.textContent.trim() : null;

      const brandEl = tile.querySelector('[data-testid$="brand-name"]');
      const brandLabel = brandEl ? brandEl.textContent.trim() : null;

      // Preis-Element hat ein <sup>**</sup> Anhängsel (Fußnote) als
      // Kind-Element - wir wollen nur den reinen Zahlentext davor.
      const priceEl = tile.querySelector('[data-testid$="tag-current-price-amount"]');
      let priceRaw = null;
      if (priceEl) {
        const textNode = Array.from(priceEl.childNodes).find((n) => n.nodeType === Node.TEXT_NODE);
        priceRaw = textNode ? textNode.textContent.trim() : priceEl.textContent.trim();
      }

      const salesUnitEl = tile.querySelector('[data-testid$="tag-sales-unit"]');
      const salesUnit = salesUnitEl ? salesUnitEl.textContent.trim() : null;

      const imgEl = tile.querySelector('img[data-testid$="-image"]');
      const imageUrl = imgEl ? imgEl.getAttribute('src') : null;

      const linkEl = tile.querySelector('a.product-tile__action');
      const link = linkEl ? linkEl.getAttribute('href') : null;

      return { title, brandLabel, priceRaw, salesUnit, imageUrl, link };
    });
  });

  console.log(`\n${rawOffers.length} Angebot(e) auf der Seite gefunden (alle Kategorien).`);

  const energyDrinkOffers = rawOffers
    .map((offer) => {
      // Marke kann im separaten Brand-Label ODER im Produktnamen stehen -
      // beide Felder zusammen prüfen, um nichts zu verpassen.
      const searchText = `${offer.brandLabel || ''} ${offer.title || ''}`;
      const brand = matchBrand(searchText);
      if (!brand) return null;

      // Preis normalisieren: "0.55" -> Zahl 0.55, UND ein deutsches
      // Anzeigeformat "0,55 €" für Lesbarkeit/Konsistenz mit Rewe.
      const priceNumber = offer.priceRaw ? parseFloat(offer.priceRaw.replace(',', '.')) : null;
      const priceDisplay = priceNumber !== null ? `${priceNumber.toFixed(2).replace('.', ',')} €` : null;

      return {
        brand,
        supermarket: 'Aldi Nord',
        title: offer.title,
        price: priceDisplay,
        priceNumber,
        salesUnit: offer.salesUnit,
        imageUrl: offer.imageUrl,
        // Aldi Nord liefert den Link mal relativ, mal absolut - BASE_URL nur
        // voranstellen, wenn er nicht schon selbst eine volle URL ist
        // (sonst "https://www.aldi-nord.dehttps://www.aldi-nord.de/...").
        productUrl: offer.link ? (/^https?:\/\//i.test(offer.link) ? offer.link : BASE_URL + offer.link) : null,
        sourceUrl: TARGET_URL,
        scrapedAt: new Date().toISOString(),
      };
    })
    .filter(Boolean);

  console.log(`Davon ${energyDrinkOffers.length} Energy-Drink-Angebot(e) (Monster/Red Bull/Rockstar/Gönnergy).\n`);

  energyDrinkOffers.forEach((o) => {
    console.log(`  [${o.brand}] ${o.title} – ${o.price} (${o.salesUnit || 'keine Mengenangabe'})`);
  });

  writeOffers('aldi-nord-offers.json', energyDrinkOffers);

  if (energyDrinkOffers.length === 0 && rawOffers.length > 0) {
    console.log('\nHinweis: Angebote gefunden, aber keine unserer 4 Marken. ' + 'Erste 5 gefundene Titel zur Kontrolle:');
    rawOffers.slice(0, 5).forEach((o) => console.log(`  - ${o.title} (Marke: ${o.brandLabel || '–'})`));
  }

  await browser.close();
})();
