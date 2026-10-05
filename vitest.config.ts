import { defineConfig } from 'vitest/config'

// Tests für die reine Logik (Frontend-lib, Daten-Skripte, Scraper-Helfer).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.{ts,mjs}', 'scrapers/**/*.test.js'],
  },
})
