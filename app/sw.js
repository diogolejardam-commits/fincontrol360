/* FinControl 360° — PWA Service Worker
 * FC-PWA-AUTOUPDATE-01 + FC-NOTIFICACOES-PUSH-01
 * AutoUpdate + Web Push no MESMO SW / scope /app/
 * PROIBIDO: cachear script.google.com, tokens ou dados financeiros.
 */
'use strict';

var FC_PWA_CACHE = 'fincontrol360-pwa-v9r2';
var FC_PWA_CACHE_PREFIX = 'fincontrol360-pwa-';
var FC_WEBAPP_OFICIAL =
  'https://script.google.com/macros/s/AKfycbwNkB9moeaKqy5155S9tBEB-3YjjgQKsG4qBv1v_AsJ/dev';

var PRECACHE = [
  './',
  './index.html',
  './launch.html',
  './push-ativar.html',
  './manifest.webmanifest',
  './apple-touch-icon.png',
  './fincontrol-icon-192-v3.png',
  './fincontrol-icon-512-v3.png',
  './pwa-register.js'
];

function isGoogleAppsScript(url) {
  try {
    var u = new URL(url);
    return /(^|\.)script\.google\.com$/i.test(u.hostname) ||
      /(^|\.)googleusercontent\.com$/i.test(u.hostname);
  } catch (e) {
    return false;
  }
}

function isHtmlOrManifest(request, url) {
  if (request.mode === 'navigate') return true;
  var p = url.pathname || '';
  if (/\/app\/?$/i.test(p)) return true;
  if (/\.html?$/i.test(p)) return true;
  if (/\.webmanifest$/i.test(p) || /manifest\.json$/i.test(p)) return true;
  return false;
}

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(FC_PWA_CACHE).then(function (cache) {
      return cache.addAll(PRECACHE);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.map(function (key) {
          if (key.indexOf(FC_PWA_CACHE_PREFIX) === 0 && key !== FC_PWA_CACHE) {
            return caches.delete(key);
          }
          return Promise.resolve(false);
        })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (request.method !== 'GET') return;

  var url;
  try { url = new URL(request.url); } catch (e) { return; }

  if (isGoogleAppsScript(request.url)) return;
  if (url.origin !== self.location.origin) return;
  if (url.pathname.indexOf('/fincontrol360/app') === -1) return;

  if (/\/sw\.js$/i.test(url.pathname)) {
    event.respondWith(fetch(request));
    return;
  }

  if (isHtmlOrManifest(request, url)) {
    event.respondWith(
      fetch(request).then(function (response) {
        if (response && response.ok) {
          var copy = response.clone();
          caches.open(FC_PWA_CACHE).then(function (cache) {
            cache.put(request, copy);
          });
        }
        return response;
      }).catch(function () {
        return caches.match(request).then(function (cached) {
          return cached || caches.match('./index.html');
        });
      })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(function (cached) {
      if (cached) return cached;
      return fetch(request).then(function (response) {
        if (response && response.ok && (url.pathname.match(/\.(png|jpg|jpeg|svg|ico|js|css|webp)$/i))) {
          var copy = response.clone();
          caches.open(FC_PWA_CACHE).then(function (cache) {
            cache.put(request, copy);
          });
        }
        return response;
      });
    })
  );
});

self.addEventListener('message', function (event) {
  if (!event.data) return;
  if (event.data.type === 'FC_PWA_SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('push', function (event) {
  var title = 'FinControl 360°';
  var options = {
    body: 'Você tem alertas de vencimento.',
    icon: './fincontrol-icon-192-v3.png',
    badge: './fincontrol-icon-192-v3.png',
    data: { url: FC_WEBAPP_OFICIAL },
    tag: 'fc-push-vencimento',
    renotify: true
  };
  try {
    if (event.data) {
      var raw = event.data.text();
      try {
        var parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          if (parsed.title) title = String(parsed.title).substring(0, 80);
          if (parsed.body) options.body = String(parsed.body).substring(0, 180);
          if (parsed.url && /^https:\/\/script\.google\.com\//i.test(parsed.url)) {
            options.data.url = parsed.url;
          }
        }
      } catch (e1) {
        if (raw) options.body = String(raw).substring(0, 180);
      }
    }
  } catch (e2) {}
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var target = FC_WEBAPP_OFICIAL;
  try {
    if (event.notification && event.notification.data && event.notification.data.url) {
      target = event.notification.data.url;
    }
  } catch (e) {}
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        var c = list[i];
        if (c.url && c.url.indexOf('script.google.com') !== -1 && 'focus' in c) {
          return c.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(target);
      return undefined;
    })
  );
});
