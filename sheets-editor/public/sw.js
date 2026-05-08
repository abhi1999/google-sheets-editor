const CACHE_NAME = 'sheets-editor-pwa-v1';
const STATIC_ASSETS = [
  '/',
  '/favicon.png',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable_icon.png',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName))
      )
    ).then(() => self.clients.claim())
  );
});

const isNavigationRequest = (request) => {
  return request.mode === 'navigate' ||
    (request.headers.get('Accept') || '').includes('text/html');
};

const cacheFirst = async (request) => {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) return cachedResponse;

  try {
    const response = await fetch(request);
    if (response && response.status === 200 && response.type === 'basic') {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return caches.match(request);
  }
};

const networkFirst = async (request) => {
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    return cachedResponse || caches.match('/');
  }
};

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;
  if (requestUrl.pathname.startsWith('/api/')) return;

  if (isNavigationRequest(event.request)) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  if (
    requestUrl.pathname.startsWith('/_next/') ||
    requestUrl.pathname.startsWith('/fonts/') ||
    requestUrl.pathname.endsWith('.png') ||
    requestUrl.pathname.endsWith('.jpg') ||
    requestUrl.pathname.endsWith('.jpeg') ||
    requestUrl.pathname.endsWith('.svg') ||
    requestUrl.pathname.endsWith('.css') ||
    requestUrl.pathname.endsWith('.js')
  ) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  event.respondWith(cacheFirst(event.request));
});
