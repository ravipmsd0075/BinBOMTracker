// Service worker for the PMSD Picking List PWA.
// Caches the app shell (HTML/CDN scripts/icons) so the app opens and works
// even with zero network. Firebase/Firestore traffic is left untouched —
// the Firestore SDK manages its own real-time connection and offline cache.

const CACHE_NAME = 'pmsd-picking-list-v1';
const PRECACHE_URLS = ['manifest.json', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS).catch(() => {}))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // Never intercept Firebase/Firestore/Google traffic — let the SDK handle
  // its own real-time connection and offline write queue directly.
  if (url.includes('googleapis.com') || url.includes('gstatic.com/firebasejs') || url.includes('firebaseapp.com')) {
    return;
  }

  if (event.request.mode === 'navigate') {
    // App shell HTML: try the network first (so updates are picked up when online),
    // fall back to the last cached copy when offline.
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Everything else (CDN libraries, icons, manifest): serve from cache instantly
  // if we have it, and refresh the cache in the background when online.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
