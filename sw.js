const CACHE_NAME = 'logiconnect-pwa-v1';
const APP_SHELL = './index%20(70).html';
const PRECACHE_URLS = [
  APP_SHELL,
  './manifest.webmanifest',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(PRECACHE_URLS);
    self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const requestUrl = new URL(event.request.url);
  const sameOrigin = requestUrl.origin === self.location.origin;

  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const networkResponse = await fetch(event.request);
        const cache = await caches.open(CACHE_NAME);
        cache.put(APP_SHELL, networkResponse.clone()).catch(() => {});
        return networkResponse;
      } catch {
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match(APP_SHELL)) || cache.match('./');
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(event.request);
    const networkPromise = fetch(event.request).then(response => {
      if (response && (response.ok || response.type === 'opaque')) {
        cache.put(event.request, response.clone()).catch(() => {});
      }
      return response;
    }).catch(() => null);

    if (cached) {
      networkPromise.catch(() => {});
      return cached;
    }

    const networkResponse = await networkPromise;
    if (networkResponse) return networkResponse;

    if (sameOrigin) {
      const fallback = await cache.match(APP_SHELL) || cache.match('./');
      if (fallback) return fallback;
    }

    throw new Error('Offline and no cached response available.');
  })());
});
