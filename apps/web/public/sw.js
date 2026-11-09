/*
 * Offline shell. After one visit online, the app and the check-in screen load without a
 * connection; scans are queued in IndexedDB by the page itself.
 *
 * Rules: never cache API calls (data must be fresh and may be private); hashed build
 * assets are cache-first; page navigations are network-first with the cached shell as the
 * offline fallback.
 */
const VERSION = 'v1';
const SHELL = `ep-shell-${VERSION}`;
const ASSETS = `ep-assets-${VERSION}`;

function shouldCache(url, origin) {
  const parsed = new URL(url, origin);
  return parsed.origin === origin && !parsed.pathname.startsWith('/api/') && !parsed.pathname.startsWith('/static/');
}

function isHashedAsset(url, origin) {
  const parsed = new URL(url, origin);
  return parsed.origin === origin && parsed.pathname.startsWith('/assets/');
}

self.__sw = { shouldCache, isHashedAsset };

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((cache) => cache.add('/')).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => ![SHELL, ASSETS].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || !shouldCache(request.url, self.location.origin)) {
    return;
  }

  if (isHashedAsset(request.url, self.location.origin)) {
    event.respondWith(
      caches.open(ASSETS).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      }),
    );
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) caches.open(SHELL).then((cache) => cache.put('/', response.clone()));
          return response;
        })
        .catch(() => caches.match('/').then((cached) => cached ?? Response.error())),
    );
  }
});
