const CACHE_NAME = 'titan-tools-v2';
const CORE_FILES = [
  './',
  'index.html',
  'qr-code.html',
  'get-started.html',
  'terms.html',
  'privacy.html',
  'legal.css',
  'app.js',
  'qrcode.min.js',
  'site.webmanifest',
  'favicon.ico',
  'favicon-96x96.png',
  'apple-touch-icon.png',
  'web-app-manifest-192x192.png',
  'web-app-manifest-512x512.png',
  'Titan%20Logo-2.png',
  'TTT.png',
  'Featured-too.png',
  'THL.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(CORE_FILES.map((file) => new URL(file, self.registration.scope)))
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(async (names) => {
      await Promise.all(names.filter((name) => name.startsWith('titan-tools-') && name !== CACHE_NAME).map((name) => caches.delete(name)));
      await self.clients.claim();
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;

  const cacheUrl = new URL(request.url);
  cacheUrl.search = '';
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      const response = await fetch(request);
      if (response.ok) event.waitUntil(cache.put(cacheUrl.href, response.clone()));
      return response;
    } catch {
      return (await cache.match(cacheUrl.href)) ||
        (request.mode === 'navigate' && await cache.match(new URL('index.html', self.registration.scope))) ||
        Response.error();
    }
  })());
});
