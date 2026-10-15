const CACHE = 'acces-install-v1';
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.add('/offline.html')));
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([
    caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('acces-install-') && key !== CACHE).map(key => caches.delete(key)))),
    self.clients.claim()
  ]));
});
// No almacenar datos comerciales, autenticación ni respuestas de Firebase.
self.addEventListener('fetch', event => {
  if (event.request.mode !== 'navigate' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(event.request).catch(async () =>
    (await caches.match('/offline.html')) || new Response('Conéctate a Internet para abrir ACCES OFF-ROAD.', {headers: {'Content-Type': 'text/plain; charset=utf-8'}})
  ));
});
