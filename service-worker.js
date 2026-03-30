/* service-worker.js — Culvert Survey PWA
   Network-first strategy: always fetches fresh files when online,
   falls back to the version-stamped cache for offline use.
   Bump CACHE_NAME to force re-installation and old-cache eviction.
*/

const CACHE_NAME = 'culvert-survey-v3';

const APP_SHELL = [
  './index.html',
  './style.css',
  './app.js',
  './manifest.json'
];

// ── Install: pre-cache the app shell ─────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// ── Activate: remove ALL stale caches, then claim clients ─────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())   // claim only after old caches are gone
  );
});

// ── Fetch: network-first, cache fallback ──────────────────────────────────────
// Always attempts the network. On success the response is stored in the
// version-stamped cache so the app remains usable offline.  On any network
// failure the cached copy is returned.
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Only cache valid, same-origin responses
        if (response && response.status === 200 && response.type !== 'opaque') {
          const toCache = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, toCache));
        }
        return response;
      })
      .catch(() =>
        // Network failed — serve from cache (offline mode)
        caches.open(CACHE_NAME).then(cache => cache.match(event.request))
      )
  );
});
