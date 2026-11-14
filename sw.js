/* Static and snapshot cache. The cache key is the full URL, so a new ?v= is a new file,
 * and a world file under /xp/v1/world/<rules-sig>/<tip>/ changes address when the tip changes.
 * HTML navigations and js/v2-rules.js stay network-first. latest.json, /xp/v1/sync, /xp/v1/health
 * and the chain API are never stored. This script is not intercepted, so an update can land.
 * Old cache names are deleted on activate. World files from tips older than the two newest
 * are dropped, and the cache is capped so a phone does not keep every past tip. */
'use strict';
var VERSION = 'sw60-1';
var CACHE = 'xcpets-' + VERSION;
var MAX_ENTRIES = 220;
var KEEP_TIPS = 2;

self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (ev) {
  ev.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('message', function (ev) {
  var data = ev.data || {};
  if (data.cmd !== 'drop') return;
  ev.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.registration.unregister(); }));
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
function worldTip(url) {
  var m = /\/xp\/v1\/world\/r[0-9a-f]{32}\/(\d+)\//.exec(url.pathname);
  return m ? +m[1] : 0;
}
/* Immutable files for one published tip. latest.json is the moving pointer and is not here. */
function isWorldFile(url) {
  if (url.pathname.indexOf('/xp/v1/world/') !== 0) return false;
  if (/\/latest\.json$/.test(url.pathname)) return false;
  if (!/^r[0-9a-f]{32}\/\d+\//.test(url.pathname.slice('/xp/v1/world/'.length))) return false;
  if (/\/(?:cp-root|cp-meta|cp-part-\d+|root|part-\d+|manifest)\.json$/.test(url.pathname)) return true;
  if (/\/view\/summary\.json$/.test(url.pathname)) return true;
  if (/\/view\/own\/[0-9a-f]{64}(?:\.\d+)?\.json$/.test(url.pathname)) return true;
  if (/\/view\/p\/\d{5}\.json$/.test(url.pathname)) return true;
  return false;
}

function trim(cache) {
  return cache.keys().then(function (reqs) {
    var tips = {};
    reqs.forEach(function (req) { var t = worldTip(new URL(req.url)); if (t) tips[t] = 1; });
    var ranked = Object.keys(tips).map(Number).sort(function (a, b) { return b - a; });
    var drop = {};
    ranked.slice(KEEP_TIPS).forEach(function (t) { drop[t] = 1; });
    var gone = reqs.filter(function (req) { var t = worldTip(new URL(req.url)); return t && drop[t]; });
    return Promise.all(gone.map(function (req) { return cache.delete(req); })).then(function () { return cache.keys(); });
  }).then(function (left) {
    if (left.length <= MAX_ENTRIES) return;
    return Promise.all(left.slice(0, left.length - MAX_ENTRIES).map(function (req) { return cache.delete(req); }));
  });
}
function put(cache, req, res) {
  if (!res || !res.ok || res.type === 'opaque') return res;
  var copy = res.clone();
  cache.put(req, copy).then(function () { return trim(cache); }).catch(function () {});
  return res;
}
function networkFirst(req) {
  return caches.open(CACHE).then(function (cache) {
    return fetch(req).then(function (res) { return put(cache, req, res); }).catch(function () { return cache.match(req); });
  });
}
function cacheFirst(req) {
  return caches.open(CACHE).then(function (cache) {
    return cache.match(req).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (res) { return put(cache, req, res); });
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
  if (versionedStatic(url) || isWorldFile(url)) { ev.respondWith(cacheFirst(req)); return; }
});

self.__sw = { isWorldFile: isWorldFile, versionedStatic: versionedStatic, isRules: isRules, isNav: isNav, worldTip: worldTip, trim: trim, MAX_ENTRIES: MAX_ENTRIES, KEEP_TIPS: KEEP_TIPS, VERSION: VERSION };
