import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  buildTitle,
  buildDescription,
  buildJsonLd,
  buildNoscript,
} from './scripts/seo.mjs'

const here = dirname(fileURLToPath(import.meta.url))

/**
 * Reichert index.html beim Dev-Serve und Build mit dynamischem <title>,
 * Meta-Description, JSON-LD (Organization/WebSite/ItemList) und einem
 * crawlbaren <noscript>-Deal-Block an – gespeist aus src/data/offers.json
 * (von prepare-data.mjs erzeugt). So sehen Crawler/Preview-Bots echte
 * Inhalte statt eines leeren #root.
 */
function seoHtmlPlugin(): Plugin {
  return {
    name: 'energyhunt-seo-html',
    transformIndexHtml(html) {
      let parsed: { offers: unknown[] }
      try {
        parsed = JSON.parse(readFileSync(join(here, 'src/data/offers.json'), 'utf8'))
      } catch {
        return html // ohne Daten bleibt der statische Head bestehen
      }
      const list = parsed.offers as Parameters<typeof buildTitle>[0]
      const title = buildTitle(list)
      const description = buildDescription(list)
      const jsonLd = buildJsonLd(list)
      const noscript = buildNoscript(list)

      return html
        .replace(/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`)
        .replace(
          /<meta\s+name="description"\s+content=\s*"[\s\S]*?"\s*\/>/,
          `<meta name="description" content="${description.replace(/"/g, '&quot;')}" />`,
        )
        .replace(
          '</head>',
          `  <script type="application/ld+json">${jsonLd}</script>\n  </head>`,
        )
        .replace('<div id="root"></div>', `<div id="root"></div>\n    ${noscript}`)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), seoHtmlPlugin()],
})
