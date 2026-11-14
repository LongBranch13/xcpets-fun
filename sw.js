/* XCPETS static cache (speed phase 1).
 * Cache keys are the full request URL, so an existing ?v= tag is a new key when a file changes.
 * HTML and js/v2-rules.js are network-first: a deploy's new page is used while online, and the
 * rules file is never served from cache when the network answered. Offline only, the last good
 * copy of that exact URL is the fallback. Snapshot files live under /xp/v1/world/<rules-sig>/<tip>/,
 * which changes when the rules signature or the tip changes. latest.json is the only moving pointer
 * and is never cached. The service worker script itself is never intercepted, so an update can land. */
'use strict';
var VERSION = 'p1-859c-1';
var CACHE = 'xcpets-' + VERSION;

self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (ev) {
  ev.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function sameOrigin(url) { return url.origin === self.location.origin; }
function isNav(req) {
  return req.mode === 'navigate' || ((req.headers.get('accept') || '').indexOf('text/html') >= 0 && req.destination !== 'script');
}
function isRules(url) { return /\/js\/v2-rules\.js$/.test(url.pathname); }
function versionedStatic(url) {
  if (!sameOrigin(url) || !/[?&]v=/.test(url.search)) return false;
  if (isRules(url) || /\/sw\.js$/.test(url.pathname)) return false;
  return /\.(js|css|png|gif|webp|jpg|jpeg|svg|woff2?|ico|json)$/i.test(url.pathname);
}
function isCheckpoint(url) {
  if (url.hostname !== 'node.xcpets.fun') return false;
  if (url.pathname.indexOf('/xp/v1/world/') !== 0) return false;
  if (/\/latest\.json$/.test(url.pathname)) return false;
  return /\/cp-(root|meta)\.json$/.test(url.pathname);
}

function store(req, res) {
  if (!res || !res.ok || res.type === 'opaque') return res;
  var copy = res.clone();
  caches.open(CACHE).then(function (c) { c.put(req, copy); }).catch(function () {});
  return res;
}
function networkFirst(req) {
  return fetch(req).then(function (res) { return store(req, res); }).catch(function () { return caches.match(req); });
}
function cacheFirst(req) {
  return caches.open(CACHE).then(function (c) {
    return c.match(req).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (res) {
        if (res && res.ok && res.type !== 'opaque') c.put(req, res.clone());
        return res;
      });
    });
  });
}

self.addEventListener('fetch', function (ev) {
  var req = ev.request;
  if (req.method !== 'GET') return;
  var url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return;
  if (/\/sw\.js$/.test(url.pathname)) return;
  if (isNav(req) || isRules(url)) { ev.respondWith(networkFirst(req)); return; }
  if (versionedStatic(url) || isCheckpoint(url)) { ev.respondWith(cacheFirst(req)); return; }
});
