// Notificações push (avisos de vencimento). Carregado pelo service worker gerado pelo vite-plugin-pwa.
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Finanças da Casa', {
      body: data.body || '',
      icon: 'pwa-192x192.png',
      badge: 'pwa-64x64.png',
      tag: data.tag,
      data: { url: data.url || './' },
    }),
  )
})

// Tocar na notificação abre (ou traz para frente) o app
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL((event.notification.data && event.notification.data.url) || './', self.registration.scope).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.startsWith(self.registration.scope) && 'focus' in client) return client.focus()
      }
      return self.clients.openWindow(url)
    }),
  )
})
