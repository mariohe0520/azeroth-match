/**
 * sw.js -- Service Worker for Azeroth Match PWA
 * Network-first strategy to prevent stale cache issues
 */

const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './css/animations.css',
  './js/app.js',
  './js/board.js',
  './js/campaign.js',
  './js/garden.js',
  './js/gems.js',
  './js/audio.js',
  './js/potion.js',
  './js/daily.js',
  './js/storage.js',
  './js/story.js',
  './manifest.json'
];
const CACHE_PREFIX = 'azeroth-match';
const CACHE_VERSION = ASSETS.join('|').split('').reduce((hash, ch) => ((hash * 31) + ch.charCodeAt(0)) >>> 0, 0).toString(16);
const CACHE_NAME = `${CACHE_PREFIX}-${CACHE_VERSION}`;

// Install: pre-cache all static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS);
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

// Activate: clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
          .map(key => caches.delete(key))
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Fetch: network-first, falling back to cache
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request).then(networkResponse => {
      if (networkResponse && networkResponse.status === 200) {
        const responseClone = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseClone);
        });
      }
      return networkResponse;
    }).catch(() => {
      return caches.match(event.request).then(cachedResponse => {
        if (cachedResponse) return cachedResponse;
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
        return new Response('Offline', { status: 503 });
      });
    })
  );
});
