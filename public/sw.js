const CACHE_NAME = 'aura-v3';
const ASSETS = [
  '/',
  '/index.html'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      // Delete ALL old caches to ensure fresh start
      return Promise.all(
        keys.map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Only cache http/https requests
  if (!event.request.url.startsWith('http')) {
    return;
  }

  // Don't cache the HLS stream or TS chunks
  if (event.request.url.includes('.m3u8') || event.request.url.includes('.ts')) {
    return;
  }

  // Bypass Service Worker for Cloudflare Assets (Audio/Manifest)
  if (event.request.url.includes('r2.dev') || event.request.url.includes('workers.dev')) {
    return; // browser handles it directly
  }

  // Network First strategy: try network, then fallback to cache
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Only cache valid responses
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});
