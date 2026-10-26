// Red primero (para recibir actualizaciones), caché si no hay señal. Los datos viven en localStorage, no aquí.
const CACHE = 'ganado-v1';
const ARCHIVOS = ['./', './index.html', './manifest.json', './icon.svg'];

self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS))); self.skipWaiting() });
self.addEventListener('activate', e => e.waitUntil(clients.claim()));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request)
    .then(r => { const copia = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copia)); return r })
    .catch(() => caches.match(e.request, {ignoreSearch: true})));
});
