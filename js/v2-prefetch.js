/* Starts the world-snapshot read during HTML parse, and registers the static cache.
 * A return visit that already has the saved world in IndexedDB does not download the checkpoint again.
 * A first visit starts latest.json, then the manifest, then cp-root and cp-meta, so those bytes overlap
 * the script download. js/v2-boot-sync.js consumes window.__xcpSnap and window.__xcpFile.
 * Practice pages, save-data, and ?sync=off do nothing. latest.json is not stored by the service worker. */
(function () {
  'use strict';
  try {
    if (document.prerendering) return;
    if (/practice/i.test(location.pathname || '')) return;
    if (navigator.serviceWorker && location.protocol !== 'file:') {
      navigator.serviceWorker.register('/sw.js?v=p1-859c-1', { scope: '/' }).catch(function () {});
    }
    if (/[?&]sync=(?:0|off)(?:&|$)/.test(location.search)) return;
    try { if (navigator.connection && (navigator.connection.saveData || /^(2g|slow-2g)$/.test(navigator.connection.effectiveType || ''))) return; } catch (e0) {}
    var base = '';
    try {
      var q = new URLSearchParams(location.search).get('sync');
      if (q) base = String(q).replace(/\/+$/, '');
    } catch (e1) {}
    if (!base) { try { var saved = localStorage.getItem('xcpets-sync'); if (saved) base = String(saved).replace(/\/+$/, ''); } catch (e2) {} }
    if (!base) {
      var h = String(location.hostname || '').toLowerCase();
      if (h === 'xcpets.fun' || h === 'www.xcpets.fun' || h === 'localhost' || h === '127.0.0.1') base = 'https://node.xcpets.fun';
    }
    if (!base) return;
    function prime(man) {
      var dir = String(man._url || '').replace(/[^/]+$/, ''), cp = man.checkpoint, files = [];
      if (cp && cp.root && cp.root.url) files.push(dir + cp.root.url);
      if (cp && cp.meta && cp.meta.url) files.push(dir + cp.meta.url);
      window.__xcpFile = window.__xcpFile || {};
      files.forEach(function (url) {
        if (window.__xcpFile[url]) return;
        window.__xcpFile[url] = fetch(url).then(function (r) { if (!r.ok) throw new Error('part'); return r.arrayBuffer(); }).catch(function () { return null; });
      });
    }
    function start() {
      window.__xcpSnap = fetch(base + '/xp/v1/world/latest.json', { cache: 'no-cache' }).then(function (r) {
        if (!r.ok) throw new Error('latest'); return r.json();
      }).then(function (latest) {
        var path = latest && (latest.manifest || latest.url); if (!path) throw new Error('latest');
        var abs = /^https?:/.test(path) ? path : base + (path.charAt(0) === '/' ? '' : '/') + path;
        return fetch(abs, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error('manifest'); return r.json(); }).then(function (man) {
          man._url = abs; prime(man); return man;
        });
      }).catch(function () { return null; });
    }
    if (!window.indexedDB || typeof indexedDB.databases !== 'function') return;
    indexedDB.databases().then(function (list) {
      var i, hit = false;
      for (i = 0; i < (list || []).length; i++) if (list[i] && list[i].name === 'xcpets-world') hit = true;
      if (!hit) start();
    }, function () {});
  } catch (e) {}
})();
