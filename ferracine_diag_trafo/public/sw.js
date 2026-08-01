const CACHE_NAME = 'ferracine-diag-trafo-v4';

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

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.match(event.request).then(async (cached) => {
      if (cached) return cached;
      try {
        const response = await fetch(event.request);
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(event.request, response.clone());
        }
        return response;
      } catch (error) {
        if (event.request.mode === 'navigate') {
          const fallback = await caches.match(scopedUrl('./'));
          if (fallback) return fallback;
        }
        throw error;
      }
    })
  );
});
