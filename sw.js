const LOGICONNECT_CACHE = 'logiconnect-pwa-v2';
const APP_SHELL = [
  './',
  './index.html',
  './offline.html',
  './manifest.webmanifest',
  './icons/logiconnect-icon-192.png',
  './icons/logiconnect-icon-512.png',
  './icons/logiconnect-maskable-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(LOGICONNECT_CACHE).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== LOGICONNECT_CACHE).map(key => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(LOGICONNECT_CACHE).then(cache => cache.put('./index.html', copy));
          return response;
        })
        .catch(() => caches.match('./index.html').then(page => page || caches.match('./offline.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request).then(response => {
      const copy = response.clone();
      caches.open(LOGICONNECT_CACHE).then(cache => cache.put(request, copy));
      return response;
    }).catch(() => cached))
  );
});
