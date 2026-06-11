// Mantém o app online-first: remove service workers legados para evitar cache inconsistente.
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return

  void disableServiceWorkers()
  window.addEventListener('load', () => {
    void disableServiceWorkers()
  })
  window.addEventListener('focus', () => {
    void disableServiceWorkers()
  })
}

async function disableServiceWorkers() {
  try {
    const registrations = await navigator.serviceWorker.getRegistrations()
    await Promise.all(registrations.map((registration) => registration.unregister()))
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.filter((key) => key.startsWith('approf-pwa-')).map((key) => caches.delete(key)))
    }
  } catch (error) {
    console.warn('Approf PWA: service worker cleanup failed.', error)
  }
}
