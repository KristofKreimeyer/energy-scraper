// Service Worker: Web-Push (Bestpreis-Alarm) + Offline-App-Shell (PWA).

// --- Offline-Shell -----------------------------------------------------------
// Konservativ: Navigationsanfragen network-first (immer frische Deals, Cache
// nur als Offline-Fallback), statische Same-Origin-Assets cache-first (damit
// die App nach dem ersten Besuch offline startet). Hashed Vite-Assets sind
// unveränderlich – neue Builds haben neue URLs, alte Cache-Einträge verwaisen
// harmlos und werden beim Cache-Versionswechsel entfernt.
const CACHE = 'energyhunt-shell-v1'
const SHELL = ['/', '/favicon.svg', '/manifest.webmanifest']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(SHELL))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return // API/Fremdhosts unangetastet

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put('/', copy))
          return res
        })
        .catch(() => caches.match('/')),
    )
    return
  }

  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(req, copy))
          }
          return res
        }),
    ),
  )
})

// --- Web-Push (Bestpreis-Alarm) ---------------------------------------------
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: 'EnergyHunt', body: event.data ? event.data.text() : '' }
  }
  const title = data.title || '⚡ Bestpreis-Alarm'
  const options = {
    body: data.body || '',
    tag: data.tag || 'bestpreis',
    data: { url: data.url || '/' },
    // icon/badge könnten hier auf gehostete Assets zeigen.
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => 'focus' in c)
      if (existing) return existing.focus()
      return self.clients.openWindow(url)
    }),
  )
})
