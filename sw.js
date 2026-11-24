const CACHE = 'tarot-journal-v8';
const ASSETS = ['./', './index.html', './styles.css', './app.js', './enhancements.js', './manifest.webmanifest', './icon.svg'];
const NETWORK_FIRST = ['./', './index.html', './app.js', './enhancements.js', './styles.css'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('tarot-journal-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) return;
  const path = new URL(event.request.url).pathname;
  const networkFirst = NETWORK_FIRST.some(asset => path.endsWith(asset.replace('./','')) || path === new URL(asset, self.location.href).pathname);
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (networkFirst) {
      try { const response = await fetch(event.request); if (response.ok) cache.put(event.request, response.clone()); return response; }
      catch (e) { return (await cache.match(event.request)) || (await cache.match('./index.html')); }
    }
    const cached = await cache.match(event.request);
    if (cached) return cached;
    try { const response = await fetch(event.request); if (response.ok) cache.put(event.request, response.clone()); return response; }
    catch (e) { return cache.match('./index.html'); }
  })());
});
