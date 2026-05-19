/* sw.js — Crossing Assessor service worker
   Cache-first strategy. Bump CACHE_NAME to force refresh on deploy.
*/

const CACHE_NAME = 'crossing-assessor-v33';

// Core app shell — must all succeed or install fails, so keep this lean.
// Large optional assets (jspdf) are cached on first use by the fetch handler.
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './data.js',
  './app.js',
  './manifest.json',
  './lib/pdf-logo.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './assets/LOGO black bg.jpg',
  './assets/LOGO w TEXT black bg.jpg'
];

// Pre-cache all app assets on install
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Remove stale caches on activate, then claim all clients
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// Cache-first: serve from cache, fall back to network and cache the response
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.open(CACHE_NAME).then(cache =>
      cache.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response && response.status === 200 && response.type !== 'opaque') {
            cache.put(event.request, response.clone());
          }
          return response;
        });
      })
    )
  );
});
