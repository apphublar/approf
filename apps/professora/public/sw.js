const CACHE_VERSION = 'approf-pwa-v1'
const APP_SHELL = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.webmanifest',
  '/icons/icon.svg',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL)),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))),
      ),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const request = event.request

  if (request.method !== 'GET') return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(CACHE_VERSION).then((cache) => cache.put('/index.html', copy))
          return response
        })
        .catch(() => caches.match('/index.html').then((cached) => cached || caches.match('/offline.html'))),
    )
    return
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached

      return fetch(request)
        .then((response) => {
          const shouldCache =
            response.ok &&
            (request.destination === 'script' ||
              request.destination === 'style' ||
              request.destination === 'image' ||
              request.destination === 'font')

          if (shouldCache) {
            const copy = response.clone()
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy))
          }

          return response
        })
        .catch(() => caches.match('/offline.html'))
    }),
  )
})
