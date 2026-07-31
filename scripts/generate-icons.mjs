/**
 * Zweck: Rendert die PWA-App-Icons (public/icon-192.png, icon-512.png,
 *   maskable-512.png, apple-touch-icon.png) aus einer HTML-Vorlage – passend
 *   zur In-App-Identität (oranges ⚡-Kachel-Logo wie Header/OG, theme_color).
 *   Einmaliger Asset-Build, nicht Teil des regulären Builds.
 * Nutzung: node scripts/generate-icons.mjs   (nutzt Chromium aus scrapers/)
 */

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const require = createRequire(join(root, "scrapers", "package.json"));
const { chromium } = require("playwright");

// boltRatio = Bolt-Größe relativ zur Kante. Für maskable kleiner (Safe-Zone),
// damit der System-Mask-Zuschnitt den Bolt nicht anschneidet.
const ICONS = [
  { name: "icon-192.png", size: 192, boltRatio: 0.6 },
  { name: "icon-512.png", size: 512, boltRatio: 0.6 },
  { name: "maskable-512.png", size: 512, boltRatio: 0.46 },
  { name: "apple-touch-icon.png", size: 180, boltRatio: 0.58 },
];

// Weißer Blitz (gleicher Pfad wie das BoltIcon der App) auf Akzent-Orange –
// als Inline-SVG: scharf in jeder Größe, keine Emoji-Font nötig.
const iconHtml = (size, boltRatio) => {
  const s = Math.round(size * boltRatio);
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  * { margin:0; box-sizing:border-box; }
  body { width:${size}px; height:${size}px; background:#e24a08;
    display:flex; align-items:center; justify-content:center; }
</style></head><body>
  <svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="#ffffff" aria-hidden="true">
    <path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z"/>
  </svg>
</body></html>`;
};

const browser = await chromium.launch();
try {
  for (const { name, size, boltRatio } of ICONS) {
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    await page.setContent(iconHtml(size, boltRatio), { waitUntil: "networkidle" });
    const out = join(root, "public", name);
    await page.screenshot({ path: out, type: "png" });
    await page.close();
    console.log(`[icons] ${name} (${size}×${size})`);
  }
} finally {
  await browser.close();
}
