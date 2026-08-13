/* FinControl 360° — PWA Service Worker
 * FC-PWA-AUTOUPDATE-01
 * Escopo: somente assets da PWA/launcher em /app/
 * PROIBIDO: cachear script.google.com, APIs, tokens ou dados financeiros.
 */
'use strict';

var FC_PWA_CACHE = 'fincontrol360-pwa-v7';
var FC_PWA_CACHE_PREFIX = 'fincontrol360-pwa-';

var PRECACHE = [
  './',
  './index.html',
  './launch.html',
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

  // Nunca interceptar Apps Script / conteúdo autenticado
  if (isGoogleAppsScript(request.url)) return;
  if (url.origin !== self.location.origin) return;
  // Somente escopo GitHub Pages /fincontrol360/app/
  if (url.pathname.indexOf('/fincontrol360/app') === -1) return;

  // Service worker script: network only
  if (/\/sw\.js$/i.test(url.pathname)) {
    event.respondWith(fetch(request));
    return;
  }

  if (isHtmlOrManifest(request, url)) {
    // Network-first para HTML/manifest — evita HTML eterno
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

  // Assets estáticos da PWA: cache-first, sem dados financeiros
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
