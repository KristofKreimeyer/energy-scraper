/**
 * lib/common.js
 *
 * Zweck: Gemeinsame Bausteine der Scraper (vorher in jedem Script kopiert):
 *   Markenerkennung, Ausgabe nach captured/, ISO-Kalenderwoche sowie die
 *   Playwright-Helfer (Browser-Kontext, Cookie-Consent, Scrollen).
 *
 * Nutzung: const { matchBrand, writeOffers } = require('./lib/common');
 */

const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'captured');

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

/**
 * Die vier beobachteten Marken. `strictPattern` (Wortgrenze) verhindert
 * Fehltreffer wie "Monstera"; es ist nur für Quellen gedacht, die auch
 * Nicht-Getränke führen (marktguru, kaufda, Penny).
 */
const BRAND_PATTERNS = [
  { brand: 'Monster', pattern: /monster/i, strictPattern: /\bmonster\b/i },
  { brand: 'Red Bull', pattern: /red\s*bull/i },
  { brand: 'Rockstar', pattern: /rockstar/i },
  { brand: 'Gönnergy', pattern: /g[öo]nnergy|g[öo]nrgy|montana\s*black/i },
];

/**
 * Erkennt die Marke im Text; gibt `{ brand, pattern }` oder null zurück.
 *
 * @param {string} text
 * @param {{ strict?: boolean, requireEnergy?: boolean }} [opts]
 *   strict        – Wortgrenze bei "Monster" (gegen "Monstera")
 *   requireEnergy – zusätzlich das Wort "Energy" im Text verlangen
 *                   (gegen "Monster Trucks" & Co.)
 */
function matchBrandHit(text, { strict = false, requireEnergy = false } = {}) {
  for (const b of BRAND_PATTERNS) {
    const pattern = strict && b.strictPattern ? b.strictPattern : b.pattern;
    if (!pattern.test(text)) continue;
    if (requireEnergy && !/energy/i.test(text)) return null;
    return { brand: b.brand, pattern };
  }
  return null;
}

/** Wie matchBrandHit, liefert aber nur den Markennamen (oder null). */
function matchBrand(text, opts) {
  const hit = matchBrandHit(text, opts);
  return hit ? hit.brand : null;
}

/** Schreibt die Angebote nach captured/<fileName> (Verzeichnis wird bei Bedarf angelegt). */
function writeOffers(fileName, offers) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, fileName), JSON.stringify(offers, null, 2));
  console.log(`\nGespeichert: captured/${fileName}`);
}

/** ISO-8601-Kalenderwoche eines Datums: `{ year, week }` (Jahr = ISO-Wochenjahr). */
function isoYearWeek(date) {
  const t = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = (t.getUTCDay() + 6) % 7; // Mo=0 … So=6
  t.setUTCDate(t.getUTCDate() - day + 3); // auf den Donnerstag der Woche
  const firstThursday = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((t - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return { year: t.getUTCFullYear(), week };
}

/** UTC-Offset der Zone Europe/Berlin (Sommer +2h, Winter +1h) in Minuten. */
function berlinOffsetMinutes(d) {
  const local = new Date(d.toLocaleString('en-US', { timeZone: 'Europe/Berlin' }));
  const utc = new Date(d.toLocaleString('en-US', { timeZone: 'UTC' }));
  return Math.round((local - utc) / 60000);
}

/** ISO-String für ein Berliner Datum um HH:mm Ortszeit. */
function berlinIso(year, monthIdx, day, hh, mm) {
  // Grober UTC-Ausgangspunkt zur Offset-Bestimmung, dann exakt umrechnen.
  const probe = new Date(Date.UTC(year, monthIdx, day, hh, mm));
  const off = berlinOffsetMinutes(probe);
  return new Date(Date.UTC(year, monthIdx, day, hh, mm) - off * 60000).toISOString();
}

/**
 * Gültigkeit einer ISO-Woche in Ortszeit (Europe/Berlin) als ISO-Strings:
 * Montag 00:00 bis 23:59 am Tag `lastDayOffset` nach Montag
 * (5 = Samstag, Standard bei Penny/Prospekten; 6 = Sonntag, z. B. Rewe).
 */
function weekValidity(year, week, lastDayOffset = 5) {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = (jan4.getUTCDay() + 6) % 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - jan4Day + (week - 1) * 7);
  const last = new Date(monday);
  last.setUTCDate(monday.getUTCDate() + lastDayOffset);
  return {
    validFrom: berlinIso(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate(), 0, 0),
    validTo: berlinIso(last.getUTCFullYear(), last.getUTCMonth(), last.getUTCDate(), 23, 59),
  };
}

// --- Playwright-Helfer (nur für Browser-Scraper; Import erst bei Bedarf) ----

/** Startet Chromium und öffnet `url` in einem de-DE-Kontext. Liefert { browser, page }. */
async function openPage(url) {
  const { chromium } = require('playwright');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: USER_AGENT, locale: 'de-DE' });
  const page = await context.newPage();

  console.log(`Lade: ${url}`);
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {
    console.warn('Timeout - fahre trotzdem fort.');
  });
  return { browser, page };
}

/** Klickt den ersten gefundenen Cookie-Consent-Button weg (still, falls keiner da ist). */
async function acceptConsent(page) {
  const selectors = ['button:has-text("Alle akzeptieren")', 'button:has-text("Akzeptieren")', 'button:has-text("Zustimmen")'];
  for (const sel of selectors) {
    try {
      const btn = await page.$(sel);
      if (btn) {
        await btn.click({ timeout: 2000 });
        await page.waitForTimeout(2000);
        break;
      }
    } catch (e) {}
  }
}

/**
 * Scrollt schrittweise nach unten, damit Lazy-Loading-Inhalte rendern.
 * @param {{ steps?: number, delayMs?: number, toTop?: boolean }} [opts]
 */
async function autoScroll(page, { steps = 20, delayMs = 300, toTop = false } = {}) {
  await page.evaluate(
    async ({ steps, delayMs, toTop }) => {
      for (let i = 0; i < steps; i++) {
        window.scrollBy(0, 700);
        await new Promise((r) => setTimeout(r, delayMs));
      }
      if (toTop) window.scrollTo(0, 0);
    },
    { steps, delayMs, toTop },
  );
}

module.exports = {
  OUT_DIR,
  USER_AGENT,
  BRAND_PATTERNS,
  matchBrand,
  matchBrandHit,
  writeOffers,
  isoYearWeek,
  weekValidity,
  openPage,
  acceptConsent,
  autoScroll,
};
