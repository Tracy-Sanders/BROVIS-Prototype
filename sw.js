/**
 * BROVIS Service Worker — offline shell cache.
 *
 * Strategy: Cache-first for static assets (shell), network-only for all
 * API calls. This keeps the app shell loading instantly when offline while
 * never serving stale SITREP data from cache.
 *
 * Cache is versioned — update CACHE_VERSION when deploying a new build to
 * force clients to pick up new static assets.
 */

const CACHE_VERSION = 'brovis-v7';

const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/src/brovis.css',
  '/src/orchestrator.js',
  '/src/lib/config.js',
  '/src/lib/storage.js',
  '/src/lib/http.js',
  '/src/lib/claude.js',
  '/src/lib/router.js',
  '/src/widgets/index.js',
  '/src/widgets/weather.js',
  '/src/widgets/news.js',
  '/src/widgets/markets.js',
  '/src/widgets/bible.js',
  '/src/widgets/calendar.js',
  '/src/widgets/morning-brief.js',
  '/src/display/sitrep.js',
  '/src/display/llm-query.js',
  '/src/display/llm-healthcheck.js',
  '/src/display/config.js',
  '/icons/brovis.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/manifest.json',
];

// ── Install: cache shell assets ───────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: remove old caches ───────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k !== CACHE_VERSION)
          .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch: shell from cache, API from network ─────────────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Always go to network for API endpoints and auth flows.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Cache-first for everything else (shell assets).
  event.respondWith(
    caches.match(event.request)
      .then(cached => {
        if (cached) return cached;
        // Not in cache — fetch and cache for next time.
        return fetch(event.request).then(response => {
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          const toCache = response.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(event.request, toCache));
          return response;
        });
      })
  );
});
