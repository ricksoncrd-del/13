// Service Worker for offline support and caching
const CACHE_NAME = 'hmfc-v1';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './churches.json',
  './icon.png'
];

// Install event - cache assets
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Caching app shell');
        return cache.addAll(urlsToCache).catch((err) => {
          console.warn('Some assets failed to cache:', err);
          // Continue even if some assets fail
          return cache.addAll(urlsToCache.filter(url => url !== './icon.png'));
        });
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    return;
  }

  // Network first for JSON files to get fresh data
  if (request.url.includes('.json')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            // Update cache with fresh data
            const cache = caches.open(CACHE_NAME);
            cache.then((c) => c.put(request, response.clone()));
          }
          return response;
        })
        .catch(() => {
          // Fall back to cache if network fails
          return caches.match(request)
            .then((response) => response || new Response('Offline - no cached data', { status: 503 }));
        })
    );
  } else {
    // Cache first for other assets
    event.respondWith(
      caches.match(request)
        .then((response) => {
          if (response) {
            return response;
          }
          return fetch(request)
            .then((response) => {
              // Don't cache failed responses
              if (!response || response.status !== 200) {
                return response;
              }
              // Clone the response
              const responseToCache = response.clone();
              caches.open(CACHE_NAME)
                .then((cache) => {
                  cache.put(request, responseToCache);
                });
              return response;
            })
            .catch(() => {
              // Return offline page or cached asset
              return caches.match('./index.html')
                .then((response) => response || new Response('Offline', { status: 503 }));
            });
        })
    );
  }
});

// Background sync for any future features
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-data') {
    event.waitUntil(
      // Handle sync operations here
      Promise.resolve()
    );
  }
});
