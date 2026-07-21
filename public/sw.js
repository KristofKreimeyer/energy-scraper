// Service Worker für Web-Push (Bestpreis-Alarm).
// Empfängt verschlüsselte Push-Nachrichten und zeigt eine Notification;
// ein Klick öffnet das zugehörige Angebot.

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: 'FindMyEnergy', body: event.data ? event.data.text() : '' }
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
