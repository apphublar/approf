const SW_VERSION = 'approf-pwa-disabled-v1'

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter((key) => key.startsWith('approf-pwa-')).map((key) => caches.delete(key)))
    await self.clients.claim()
    await self.registration.unregister()
  })())
})
