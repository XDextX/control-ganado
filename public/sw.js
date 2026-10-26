// Red primero (para recibir actualizaciones), caché si no hay señal. Los datos viven en localStorage, no aquí.
const CACHE = 'ganado-v3';

// Guarda la página y los archivos que Vite generó con nombre variable (assets/index-XXXX.js|css) leyéndolos del index.
self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    const html = await (await fetch('./', {cache: 'no-store'})).text();
    const assets = [...html.matchAll(/(?:src|href)="\.?\/?([^"]+\.(?:js|css|json|svg))"/g)].map(m => './' + m[1]);
    await c.addAll(['./', ...new Set(assets)]);
    self.skipWaiting();
  })());
});
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
  await clients.claim();
})()));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request)
    .then(r => { const copia = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copia)); return r })
    // ignoreVary: los scripts de módulo llevan cabecera Origin y no coincidirían con lo guardado en la instalación
    .catch(() => caches.match(e.request, {ignoreSearch: true, ignoreVary: true})
      .then(r => r || (e.request.mode === 'navigate' ? caches.match('./') : Response.error()))));
});
