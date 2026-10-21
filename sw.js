const CACHE_NAME = 'reportes-instrumentos-v24';
const APP_SHELL = ['./', './index.html', './manifest.json', './logo.jpg'];

self.addEventListener('install', event => {
  // Guarda cada archivo por separado: si falta uno (como logo.jpg), no falla todo.
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.allSettled(APP_SHELL.map(url => cache.add(url)))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Firebase y Google: siempre red (datos en vivo, nunca caché).
  if (/firebase|googleapis|gstatic/.test(url.hostname)) return;

  // Páginas: red primero, y si no hay conexión, la copia guardada.
  // Así una versión nueva de index.html se ve de inmediato.
  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copia = res.clone();
          caches.open(CACHE_NAME).then(c => c.put('./index.html', copia));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Resto (logo, manifest, librerías CDN): caché primero, red si no está.
  event.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(res => {
      const esPropio = url.origin === self.location.origin;
      const esCDN = /cdn|cloudflare|jsdelivr|unpkg|tailwindcss/.test(url.hostname);
      if (res.ok && (esPropio || esCDN)) {
        const copia = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(req, copia));
      }
      return res;
    }))
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
