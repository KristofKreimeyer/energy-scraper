/**
 * Zweck: Rendert das 15-Sekunden-Promo-Video (tools/promo/scene.html) Bild für
 *        Bild mit Playwright und kodiert es per ffmpeg zu MP4 + WebM + Poster.
 * Nutzung: node scripts/render-promo.mjs [vorschau]
 *          "vorschau" rendert nur 1 Bild/s als PNG nach /tmp (zum Prüfen der Szene).
 * Ausgabe: public/media/energyhunt-promo.{mp4,webm}, energyhunt-promo-poster.jpg
 */
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

const require = createRequire(import.meta.url)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const { chromium } = require(path.join(root, 'scrapers/node_modules/playwright'))
const ffmpeg = require('ffmpeg-static')

const FPS = 30
const DURATION = 15
const out = path.join(root, 'public/media')
const preview = process.argv[2] === 'vorschau'
mkdirSync(out, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
await page.goto(pathToFileURL(path.join(root, 'tools/promo/scene.html')).href)
await page.evaluate(() => window.ready)
// Dosenfoto (webp) als Data-URL laden, damit das Canvas nicht „tainted" wird
const dose = 'data:image/webp;base64,' + readFileSync(path.join(root, 'public/media/dose.webp')).toString('base64')
await page.evaluate(async (src) => {
  const img = new Image()
  img.src = src
  await img.decode()
  window.canImg = img
}, dose)
const frame = async (t, type = 'jpeg') => {
  const data = await page.evaluate((t) => {
    window.drawFrame(t)
    return document.getElementById('c').toDataURL('image/jpeg', 0.93)
  }, t)
  return Buffer.from(data.split(',')[1], 'base64')
}

if (preview) {
  for (let s = 0; s <= DURATION; s += 1)
    writeFileSync(`/tmp/promo-${String(s).padStart(2, '0')}.jpg`, await frame(Math.min(s, DURATION - 0.01)))
  await browser.close()
  console.log('Vorschau: /tmp/promo-XX.jpg')
  process.exit(0)
}

writeFileSync(path.join(out, 'energyhunt-promo-poster.jpg'), await frame(5.6))

const encode = (args) =>
  new Promise((resolve, reject) => {
    const p = spawn(ffmpeg, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-', ...args], {
      stdio: ['pipe', 'inherit', 'inherit'],
    })
    p.on('close', (c) => (c === 0 ? resolve() : reject(new Error('ffmpeg ' + c))))
    encode.stdin = p.stdin
  })

const mp4 = encode([
  '-c:v',
  'libx264',
  '-preset',
  'slow',
  '-crf',
  '24',
  '-pix_fmt',
  'yuv420p',
  '-movflags',
  '+faststart',
  '-an',
  path.join(out, 'energyhunt-promo.mp4'),
])
const mp4In = encode.stdin
const webm = encode([
  '-c:v',
  'libvpx-vp9',
  '-b:v',
  '0',
  '-crf',
  '36',
  '-row-mt',
  '1',
  '-pix_fmt',
  'yuv420p',
  '-an',
  path.join(out, 'energyhunt-promo.webm'),
])
const webmIn = encode.stdin

const total = FPS * DURATION
for (let i = 0; i < total; i++) {
  const buf = await frame(i / FPS)
  for (const s of [mp4In, webmIn]) if (!s.write(buf)) await new Promise((r) => s.once('drain', r))
  if (i % 45 === 0) console.log(`Bild ${i}/${total}`)
}
mp4In.end()
webmIn.end()
await Promise.all([mp4, webm])
await browser.close()
console.log('Fertig:', out)
