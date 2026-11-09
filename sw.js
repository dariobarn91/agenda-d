/* Agenda docente - service worker: uso offline e notifiche locali */
const VERSION = 'ad-v2';
const CORE = ['/', '/index.html', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png'];
const EXTERNAL_OK = ['cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com', 'tessdata.projectnaptha.com'];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(VERSION)
      .then(function (c) { return c.addAll(CORE); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

function storable(res) {
  return res && (res.ok || res.type === 'opaque');
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return;

  /* pagina: prima la rete (così gli aggiornamenti arrivano), se manca la rete la copia salvata */
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(function (res) {
          if (storable(res)) { var copy = res.clone(); caches.open(VERSION).then(function (c) { c.put('/index.html', copy); }); }
          return res;
        })
        .catch(function () { return caches.match('/index.html').then(function (r) { return r || caches.match('/'); }); })
    );
    return;
  }

  var sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin && EXTERNAL_OK.indexOf(url.hostname) === -1) return;

  /* il resto: subito dalla copia salvata, e intanto la aggiorno */
  e.respondWith(
    caches.open(VERSION).then(function (cache) {
      return cache.match(req).then(function (hit) {
        var net = fetch(req)
          .then(function (res) { if (storable(res)) cache.put(req, res.clone()); return res; })
          .catch(function () { return hit; });
        return hit || net;
      });
    })
  );
});

/* notifiche locali richieste dall'app */
self.addEventListener('message', function (e) {
  var d = e.data || {};
  if (d.type === 'agenda-notify') {
    self.registration.showNotification(d.title || 'Agenda docente', {
      body: d.body || '', tag: d.tag, icon: '/icon-192.png', badge: '/icon-192.png', lang: 'it'
    });
  }
});

self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) { if ('focus' in list[i]) return list[i].focus(); }
      return self.clients.openWindow('/');
    })
  );
});
