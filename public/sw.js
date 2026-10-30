// Primero la copia guardada (abre al instante aunque la señal sea mala), y por detrás se baja la versión nueva.
// La actualización se ve la próxima vez que se abra la app. Los datos del ganado viven en localStorage, no aquí.
const CACHE = 'ganado-v4';

// Guarda la página y los archivos que Vite generó con nombre variable (assets/index-XXXX.js|css) leyéndolos del index.
// La página nueva se guarda al final: así nunca queda una página que apunte a archivos que todavía no se bajaron.
async function actualizar() {
  const c = await caches.open(CACHE);
  const resp = await fetch('./', {cache: 'no-store'});
  if (!resp.ok) return;
  const html = await resp.clone().text();
  const assets = [...new Set([...html.matchAll(/(?:src|href)="\.?\/?([^"]+\.(?:js|css|json|svg|png))"/g)].map(m => './' + m[1]))];
  const faltan = [];
  for (const a of assets) if (!await c.match(a, {ignoreVary: true})) faltan.push(a);
  await c.addAll(faltan);
  await c.put('./', resp);
  // Borra los archivos de versiones viejas para no llenar el teléfono.
  const vigentes = assets.map(a => new URL(a, self.registration.scope).href);
  for (const req of await c.keys()) if (req.url.includes('/assets/') && !vigentes.includes(req.url)) await c.delete(req);
}

self.addEventListener('install', e => e.waitUntil(actualizar().then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
  await clients.claim();
})()));

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (new URL(req.url).pathname.endsWith('/manual-usuario.html')) return; // página aparte: no es la app
  if (req.mode === 'navigate') {
    // Abrir la app: la copia guardada al instante; la versión nueva se busca por detrás (si no hay señal, no pasa nada).
    e.waitUntil(actualizar().catch(() => {}));
    e.respondWith(caches.match('./').then(r => r || fetch(req)));
    return;
  }
  // ignoreVary: los scripts de módulo llevan cabecera Origin y no coincidirían con lo guardado en la instalación
  e.respondWith(caches.match(req, {ignoreSearch: true, ignoreVary: true}).then(r => r || fetch(req).then(resp => {
    if (resp.ok) { const copia = resp.clone(); caches.open(CACHE).then(c => c.put(req, copia)) }
    return resp;
  })));
});
