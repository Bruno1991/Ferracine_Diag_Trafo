const CACHE_NAME = 'ferracine-diag-trafo-v5';

function scopedUrl(path) {
  return new URL(path, self.registration.scope).toString();
}

async function precacheApplication() {
  const cache = await caches.open(CACHE_NAME);
  const indexResponse = await fetch(scopedUrl('./'), { cache: 'reload' });
  if (!indexResponse.ok) throw new Error('Não foi possível armazenar o aplicativo offline.');
  const html = await indexResponse.clone().text();
  await cache.put(scopedUrl('./'), indexResponse);

  const referencedAssets = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)]
    .map((match) => new URL(match[1], scopedUrl('./')).toString())
    .filter((url) => new URL(url).origin === self.location.origin);

  await cache.addAll([
    ...new Set(referencedAssets),
    scopedUrl('database/ferracine-trafo.sqlite?schema=3'),
    scopedUrl('vendor/sql-wasm.wasm'),
    scopedUrl('icon.png')
  ]);
}

self.addEventListener('install', (event) => {
  event.waitUntil(precacheApplication().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(request, fallbackUrl) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request, { cache: 'no-cache' });
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await caches.match(request) || (fallbackUrl ? await caches.match(fallbackUrl) : null);
    if (cached) return cached;
    throw error;
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(networkFirst(event.request, scopedUrl('./')));
    return;
  }
  if (url.pathname.endsWith('/database/ferracine-trafo.sqlite')) {
    event.respondWith(networkFirst(event.request));
    return;
  }
  const immutableAsset = /\/assets\/[^/]+-[A-Za-z0-9_-]+\.(?:js|css)$/.test(url.pathname);
  event.respondWith(immutableAsset ? cacheFirst(event.request) : networkFirst(event.request));
});
