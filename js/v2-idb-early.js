/* Read the saved world from IndexedDB while the rule scripts are still downloading.
 * Display only. A missing database is left untouched. js/v2-chain.js consumes
 * window.__xcpIdbEarly. This file is not part of the rules hash.
 * speed phase 1: pollers of 1s or slower share one clock (XcpTick). Animation timers stay their own. */
(function () {
  if (typeof window !== 'undefined' && window.setInterval && !window.XcpTick) {
    var nativeSI = window.setInterval, nativeCI = window.clearInterval, subs = {}, seq = 0x40000000, BASE = 250;
    function fire(s) { try { s.fn.apply(window, s.args); } catch (err) { setTimeout(function () { throw err; }, 0); } }
    nativeSI(function () {
      var now = Date.now(), id;
      for (id in subs) { var s = subs[id]; if (!s || s.dead) continue; if (now - s.last >= s.ms) { s.last = now; fire(s); } }
    }, BASE);
    window.setInterval = function (fn, ms) {
      ms = +ms || 0;
      if (typeof fn !== 'function' || ms < 1000) return nativeSI.apply(window, arguments);
      var id = ++seq, args = [], i;
      for (i = 2; i < arguments.length; i++) args.push(arguments[i]);
      subs[id] = { fn: fn, ms: ms, last: Date.now(), args: args, dead: false };
      return id;
    };
    window.clearInterval = function (id) { if (subs[id]) { subs[id].dead = true; delete subs[id]; return; } return nativeCI(id); };
    window.XcpTick = { every: function (ms, fn) { return window.setInterval(fn, ms); } };
  }
})();
(function () {
  if (typeof indexedDB === 'undefined' || typeof indexedDB.databases !== 'function') return;
  try { if (document.prerendering) return; } catch (e) {}
  try { if (navigator.connection && navigator.connection.saveData) return; } catch (e2) {}
  function stamp(name, ms, n) { try { var a = window.__xcpPhase || (window.__xcpPhase = []); a.push({ name: name, t: Math.round(performance.now()), ms: Math.round(ms), n: n == null ? null : n }); } catch (e) {} }
  window.__xcpIdbEarly = new Promise(function (res) {
    var settled = false;
    function fin(v) { if (settled) return; settled = true; res(v); }
    indexedDB.databases().then(function (list) {
      var i, hit = false;
      for (i = 0; i < list.length; i++) if (list[i] && list[i].name === 'xcpets-world') hit = true;
      if (!hit) return fin(null);
      var tOpen = Date.now(), r = indexedDB.open('xcpets-world');
      r.onerror = function () { fin(null); };
      r.onsuccess = function () {
        stamp('idb-open', Date.now() - tOpen);
        var db = r.result, tx, os, meta;
        try { tx = db.transaction('w', 'readonly'); os = tx.objectStore('w'); } catch (e) { try { db.close(); } catch (e2) {} fin(null); return; }
        meta = os.get('world');
        meta.onerror = function () { try { db.close(); } catch (e) {} fin(null); };
        meta.onsuccess = function () {
          var v = meta.result;
          if (!(v && v.v === 2 && v.root && v.parts > 0)) { try { db.close(); } catch (e) {} fin(v && v.world ? { key: v.key, at: v.at, world: v.world } : null); return; }
          var parts = new Array(v.parts), left = v.parts, failed = false, tRead = Date.now();
          function done() { if (failed) return; try { db.close(); } catch (e) {} stamp('idb-read', Date.now() - tRead, v.parts); fin({ v: v, parts: parts }); }
          for (var pi = 0; pi < v.parts; pi++) (function (pi) {
            var q = os.get('world:' + pi);
            q.onsuccess = function () { if (failed) return; if (!q.result) { failed = true; try { db.close(); } catch (e) {} fin(null); return; } parts[pi] = q.result; if (--left === 0) done(); };
            q.onerror = function () { if (failed) return; failed = true; try { db.close(); } catch (e) {} fin(null); };
          })(pi);
        };
      };
    }, function () { fin(null); });
  });
})();
