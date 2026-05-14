export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return
  if (!import.meta.env.PROD) return

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.warn('Approf PWA: service worker registration failed.', error)
    })
  })
}
