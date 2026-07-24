/**
 * Zweck: Rendert das Open-Graph-Vorschaubild (public/og.png, 1200×630) aus einer
 *   HTML-Vorlage – einmaliger Asset-Build, nicht Teil des regulären Builds.
 * Nutzung: node scripts/generate-og.mjs   (nutzt Chromium aus scrapers/)
 */

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
// Playwright liegt im Sub-Paket scrapers/.
const require = createRequire(join(root, "scrapers", "package.json"));
const { chromium } = require("playwright");

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  * { margin:0; box-sizing:border-box; }
  body { width:1200px; height:630px; font-family: -apple-system, "Segoe UI", Roboto, sans-serif;
    background: radial-gradient(1200px 630px at 78% 18%, #24303f 0%, #12141a 62%);
    color:#f4f6f8; padding:76px 84px; display:flex; flex-direction:column; }
  .brand { display:flex; align-items:center; gap:20px; }
  .logo { width:74px; height:74px; border-radius:18px; background:#e24a08; display:flex;
    align-items:center; justify-content:center; font-size:44px; }
  .word { font-size:52px; font-weight:800; letter-spacing:-1.5px; }
  .word em { font-style:normal; color:#ff7a3c; }
  h1 { margin-top:auto; font-size:74px; line-height:1.04; font-weight:800; letter-spacing:-2.5px; max-width:16ch; }
  h1 b { color:#ff7a3c; }
  p { margin-top:28px; font-size:31px; color:#aeb8c4; font-weight:500; }
  .row { display:flex; gap:14px; margin-top:38px; }
  .pill { font-size:24px; font-weight:700; color:#cfd6de; background:rgba(255,255,255,.07);
    border:1px solid rgba(255,255,255,.12); border-radius:999px; padding:10px 20px; }
</style></head><body>
  <div class="brand">
    <div class="logo">⚡</div>
    <div class="word">Energy<em>Hunt</em></div>
  </div>
  <h1>Energy-Drink-Deals der Woche, <b>nach €/Liter</b> sortiert.</h1>
  <p>Automatisch aus den Prospekten – auf einen Blick vergleichen.</p>
  <div class="row">
    <span class="pill">Aldi</span><span class="pill">Kaufland</span><span class="pill">Lidl</span>
    <span class="pill">Netto</span><span class="pill">Penny</span><span class="pill">Rewe</span>
  </div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: "networkidle" });
const out = join(root, "public", "og.png");
await page.screenshot({ path: out, type: "png" });
await browser.close();
console.log("[og] geschrieben:", out);
