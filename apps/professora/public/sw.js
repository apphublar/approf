const SW_VERSION = 'approf-pwa-v7'
const SHELL_CACHE = `${SW_VERSION}:shell`
const STATIC_CACHE = `${SW_VERSION}:static`
const THUMB_CACHE = `${SW_VERSION}:thumb`
const MEDIA_CACHE = `${SW_VERSION}:media`
const REPORT_CACHE = `${SW_VERSION}:reports`
const APP_SHELL = ['/', '/index.html', '/offline.html', '/manifest.webmanifest', '/icons/icon.svg']

const MAX_THUMB_ENTRIES = 120
const MAX_MEDIA_ENTRIES = 80
const MAX_REPORT_ENTRIES = 80

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(APP_SHELL)),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter((key) => !key.startsWith(SW_VERSION)).map((key) => caches.delete(key)))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  const isSameOrigin = url.origin === self.location.origin
  const isApi = isSameOrigin && url.pathname.startsWith('/api/')
  const isSupabaseStorage = url.hostname.endsWith('.supabase.co') && url.pathname.includes('/storage/v1/object')
  const isReportApi = isSameOrigin && url.pathname.startsWith('/api/reports')
  const isImage = request.destination === 'image'
  const isStaticAsset = isSameOrigin && ['script', 'style', 'font'].includes(request.destination)
  const isThumbnail = isImage && /\b(thumbnail|thumb|small)\b/i.test(url.pathname + url.search)

  if (isApi || isSupabaseStorage) {
    return
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigate(request))
    return
  }

  if (isThumbnail) {
    event.respondWith(cacheFirst(request, THUMB_CACHE, MAX_THUMB_ENTRIES))
    return
  }

  if (isImage) {
    event.respondWith(staleWhileRevalidate(request, MEDIA_CACHE, MAX_MEDIA_ENTRIES))
    return
  }

  if (isReportApi) {
    event.respondWith(staleWhileRevalidate(request, REPORT_CACHE, MAX_REPORT_ENTRIES))
    return
  }

  if (isStaticAsset) {
    event.respondWith(cacheFirst(request, STATIC_CACHE, 120))
    return
  }
})

async function networkFirstNavigate(request) {
  try {
    const response = await fetch(request)
    const cache = await caches.open(SHELL_CACHE)
    cache.put('/index.html', response.clone())
    return response
  } catch {
    const cached = await caches.match('/index.html')
    return cached || caches.match('/offline.html')
  }
}

async function cacheFirst(request, cacheName, maxEntries) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  if (cached) return cached

  const response = await fetch(request)
  if (response.ok) {
    await cache.put(request, response.clone())
    await trimCache(cache, maxEntries)
  }
  return response
}

async function staleWhileRevalidate(request, cacheName, maxEntries) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  const networkPromise = fetch(request)
    .then(async (response) => {
      if (response.ok) {
        await cache.put(request, response.clone())
        await trimCache(cache, maxEntries)
      }
      return response
    })
    .catch(() => null)

  if (cached) {
    return cached
  }

  const networkResponse = await networkPromise
  if (networkResponse) return networkResponse
  return caches.match('/offline.html')
}

async function trimCache(cache, maxEntries) {
  const keys = await cache.keys()
  if (keys.length <= maxEntries) return
  const extra = keys.length - maxEntries
  for (let index = 0; index < extra; index += 1) {
    await cache.delete(keys[index])
  }
}
