/// <reference lib="webworker" />
// Service worker de l'application.
// - précache de l'app (générée par vite-plugin-pwa)
// - navigation hors ligne (renvoie index.html)
// - notifications push (étape 9) et clic sur une notification
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { clientsClaim } from 'workbox-core'

declare const self: ServiceWorkerGlobalScope

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()
clientsClaim()

// Toutes les navigations servent l'app (SPA), même hors ligne.
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html')))

// Mise à jour : l'app demande d'activer la nouvelle version.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

// --- Notifications push --------------------------------------------------------
self.addEventListener('push', (event) => {
  let data: { title?: string; body?: string; url?: string; tag?: string } = {}
  try {
    data = event.data?.json() ?? {}
  } catch {
    data = { body: event.data?.text() }
  }
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Fiches de révision', {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-96.png',
      tag: data.tag,
      data: { url: data.url ?? '/' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL((event.notification.data?.url as string) ?? '/', self.location.origin).href
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of all) {
        if ('focus' in client) {
          await client.focus()
          if ('navigate' in client) await (client as WindowClient).navigate(url)
          return
        }
      }
      await self.clients.openWindow(url)
    })(),
  )
})
