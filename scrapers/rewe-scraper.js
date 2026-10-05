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

const { matchBrand, writeOffers, openPage, acceptConsent, autoScroll, weekValidity } = require('./lib/common');

const TARGET_URL = process.argv[2] || 'https://www.rewe.de/angebote/nationale-angebote/alkoholfreie-getraenke/';

// Extrahiert den Literpreis aus einem String wie "(1 l = 3,96 €)"
function extractPricePerLiter(additionalTexts) {
  for (const t of additionalTexts) {
    const match = t.match(/1\s*l\s*=\s*([\d,]+)\s*€/i);
    if (match) return match[1].replace(',', '.');
  }
  return null;
}

(async () => {
  const { browser, page } = await openPage(TARGET_URL);
  await acceptConsent(page);

  // Gründlich scrollen, damit auch spät ladende Lazy-Content-Bereiche
  // (weitere Kategorien/Kartenreihen) sicher gerendert sind.
  await autoScroll(page, { steps: 20, delayMs: 350 });
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
  await autoScroll(page, { steps: 15, delayMs: 300, toTop: true });
  await page.waitForTimeout(1500);

  /** Liest alle Angebotskacheln der aktuell angezeigten Woche. */
  const scrapeTiles = () =>
    page.evaluate(() => {
      const tiles = Array.from(document.querySelectorAll('article.cor-offer-renderer-tile'));

      return tiles.map((tile) => {
        const titleLink = tile.querySelector('.cor-offer-information__title-link');
        const title = titleLink ? titleLink.getAttribute('data-offer-title') : null;
        // Rewe liefert je Kachel die Angebotswoche ("2026/41") und eine Artikelnummer
        // (data-offer-nan; früher data-offer-id).
        const week = titleLink ? titleLink.getAttribute('data-offer-week') : null;
        const nan = titleLink ? titleLink.getAttribute('data-offer-nan') || titleLink.getAttribute('data-offer-id') : null;

        const additionalEls = Array.from(tile.querySelectorAll('.cor-offer-information__additional'));
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
          week,
          nan,
          price,
          priceLabel,
          loyaltyBonus,
          additionalTexts,
          imageUrl,
        };
      });
    });

  const rawOffers = await scrapeTiles();

  // Der Tab "Nächste Woche" ist erst ab Wochenmitte freigeschaltet (vorher
  // disabled). Dann deren Kacheln zusätzlich einlesen, damit auch kommende
  // Angebote erscheinen. Fehler hier dürfen den Hauptlauf nicht kippen.
  try {
    const nextTab = page.locator('[data-testid="sos-week-tabs__tab"][data-week="next"]');
    if ((await nextTab.count()) > 0 && (await nextTab.first().isEnabled())) {
      await nextTab.first().click({ timeout: 3000 });
      await page.waitForTimeout(3000);
      await autoScroll(page, { steps: 15, delayMs: 300, toTop: true });
      const known = new Set(rawOffers.map((o) => `${o.week}|${o.nan}`));
      const next = (await scrapeTiles()).filter((o) => !known.has(`${o.week}|${o.nan}`));
      console.log(`Tab "Nächste Woche": ${next.length} weitere Kachel(n).`);
      rawOffers.push(...next);
    } else {
      console.log('Tab "Nächste Woche" noch nicht freigeschaltet.');
    }
  } catch (e) {
    console.warn(`Nächste Woche übersprungen: ${e.message.split('\n')[0]}`);
  }

  console.log(`\n${rawOffers.length} Angebot(e) auf der Seite gefunden (alle Kategorien).`);

  // Nach unseren vier Marken filtern und normalisieren
  const energyDrinkOffers = rawOffers
    .map((offer) => {
      const brand = offer.title ? matchBrand(offer.title) : null;
      if (!brand) return null;

      // Gültigkeit aus der Angebotswoche der Kachel ("2026/41" -> Mo–So dieser KW).
      const wm = /^(\d{4})\/(\d{1,2})$/.exec(offer.week || '');
      const validity = wm ? weekValidity(Number(wm[1]), Number(wm[2]), 6) : {};

      return {
        brand,
        supermarket: 'Rewe',
        title: offer.title,
        // Wochenscharfe ID: dasselbe Produkt in zwei Wochen = zwei Angebote.
        offerId: offer.nan ? `rewe-${offer.week || 'x'}-${offer.nan}` : null,
        ...validity,
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

  writeOffers('rewe-offers.json', energyDrinkOffers);

  if (energyDrinkOffers.length === 0 && rawOffers.length > 0) {
    console.log(
      '\nHinweis: Es wurden Angebote gefunden, aber keine unserer 4 Marken. ' +
        'Das kann heißen: aktuell einfach kein Energy-Drink-Deal diese Woche, ' +
        'oder die Getränke-Seite zeigt nur eine Teilkategorie. ' +
        'Erste 5 gefundene Titel zur Kontrolle:',
    );
    rawOffers.slice(0, 5).forEach((o) => console.log(`  - ${o.title}`));
  }

  await browser.close();
})();
