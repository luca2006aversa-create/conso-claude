'use strict';
const CACHE = 'hub-mwdz0hhy';
const BASE = ["./","index.html","conso.html","manifest.json","hub/config.js","conso.js","conso.css","style.css","icone-conso.svg","icone-hub.svg","icone-hub-192.png","vendor/asru-clair.svg","vendor/asru-sombre.svg","vendor/countries-110m.json","vendor/d3.min.js","vendor/land-110m.json","vendor/topojson-client.min.js","vendor/polices/inter-tight-latin-ext.woff2","vendor/polices/inter-tight-latin.woff2","vendor/polices/inter-tight-vietnamese.woff2","hub/app.js","hub/calculs.js","hub/conso-relais.js","hub/globe.js","hub/graphes.js","hub/hub.css","hub/incruste.css","hub/vues/agenda.js","hub/vues/argent.js","hub/vues/atelier.js","hub/vues/atlas.js","hub/vues/clients.js","hub/vues/cockpit.js","hub/vues/conso.js","hub/vues/extractions.js","hub/vues/serveurs.js","hub/vues/taches.js"];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(BASE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((x) => x.startsWith('hub-') && x !== CACHE).map((x) => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then((r) => { const c = r.clone(); caches.open(CACHE).then((x) => x.put(e.request, c)); return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true })));
});
