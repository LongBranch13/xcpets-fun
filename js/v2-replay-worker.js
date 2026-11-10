/* XCPETS replay worker (smooth-perf, owner approved 2026-10-19). Runs V2Rules.replay OFF the main thread so a page never freezes while every pet is
 * rebuilt (it used to be one 3 s / 12 s long task on desktop / phone). It loads the very same rule scripts the page loaded (same URLs, same ?v= build)
 * with the same small browser shim tools/replay-check.js uses, replays the same inputs and posts the world back (a structured clone: same data).
 * It then stores that world in the cross-visit IndexedDB cache (js/v2-chain.js), so the main thread never pays for serialising it. READ-ONLY: no
 * network, no wallet, no burns. Any failure answers {ok:false} and the page replays on the main thread exactly as before. */
'use strict';
var loaded = false;
function shim() {
  var mem = {}, st = { getItem: function (k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; }, setItem: function (k, v) { mem[k] = String(v); }, removeItem: function (k) { delete mem[k]; } };
  self.window = self; self.localStorage = st; self.sessionStorage = st;
  self.document = { getElementById: function () { return null; }, querySelector: function () { return null; }, querySelectorAll: function () { return []; },
    createElement: function () { return { getContext: function () { return null; }, style: {} }; }, addEventListener: function () {}, body: null, documentElement: { style: {} }, readyState: 'complete' };
  if (!self.addEventListener) self.addEventListener = function () {};
}
/* idb-split-1107 (owner 'rareroom is taking a while to load', Nov 7 2026): the saved world grew past Chrome's per-record IndexedDB limit
 * (142,039,798 > 133,169,152 bytes serialized at block 974,939), so put() aborted every time and EVERY page visit rebuilt every pet (~25 s
 * desktop). The world is now stored as v:2 parts: big collections' entries (and any object reached twice) go into a shared table split over
 * many records; each reference to a table entry is written as {__wsr:i} and js/v2-chain.js puts the very same object back, so shared
 * references (pets[] / byId / ...) stay one object, exactly as one structured clone. Same world, same key; only how it is stored changes. */
var WS_BIG = 256, WS_PART = 4000, WS_MARK = '__wsr';
function wsPlain(o) { if (!o || typeof o !== 'object') return false; if (Array.isArray(o)) return true; var p = Object.getPrototypeOf(o); return p === Object.prototype || p === null; }
function wsEncode(w) { var seen = new Map(), tab = new Map(), list = [], st = [w], o, ks, i, v, big;
  seen.set(w, 1);
  while (st.length) { o = st.pop(); ks = Array.isArray(o) ? null : Object.keys(o); var n = ks ? ks.length : o.length; big = n > WS_BIG;
    for (i = 0; i < n; i++) { v = ks ? o[ks[i]] : o[i]; if (!wsPlain(v)) continue;
      if (seen.has(v)) { if (!tab.has(v) && v !== w) { tab.set(v, list.length); list.push(v); } continue; }
      seen.set(v, 1); if (big) { tab.set(v, list.length); list.push(v); } st.push(v); } }
  seen = null;
  function enc(x, self) { if (!wsPlain(x)) return x; if (x === w && self !== w) throw new Error('world refers to itself'); if (x !== self && tab.has(x)) { var m = {}; m[WS_MARK] = tab.get(x); return m; }
    if (Array.isArray(x)) { var a = new Array(x.length); for (var j = 0; j < x.length; j++) if (j in x) a[j] = enc(x[j], null); return a; }
    var c = {}, k = Object.keys(x); for (var j2 = 0; j2 < k.length; j2++) c[k[j2]] = enc(x[k[j2]], null); return c; }
  var root = enc(w, w), parts = [], cur = [];
  for (i = 0; i < list.length; i++) { cur.push(enc(list[i], list[i])); if (cur.length >= WS_PART) { parts.push(cur); cur = []; } }
  if (cur.length) parts.push(cur);
  return { root: root, parts: parts, n: list.length }; }
function idbPut(key, w) { return new Promise(function (res) { try { var e = wsEncode(w), r = indexedDB.open('xcpets-world', 1); r.onupgradeneeded = function () { r.result.createObjectStore('w'); };
  r.onsuccess = function () { var db = r.result; try { var tx = db.transaction('w', 'readwrite'), os = tx.objectStore('w'); os.clear();
      for (var i = 0; i < e.parts.length; i++) os.put(e.parts[i], 'world:' + i);
      os.put({ key: key, at: Date.now(), v: 2, parts: e.parts.length, n: e.n, root: e.root }, 'world'); e = null;
      tx.oncomplete = function () { db.close(); res(true); }; tx.onerror = tx.onabort = function () { try { console.warn('[v2] saved world not stored: ' + (tx.error && tx.error.message)); } catch (x) {} db.close(); res(false); }; } catch (x) { db.close(); res(false); } };
  r.onerror = r.onblocked = function () { res(false); }; } catch (x) { res(false); } }); }
self.onmessage = function (ev) {
  var m = ev.data || {};
  try {
    if (!loaded) { shim(); importScripts.apply(self, m.scripts); self.LiveEngine = { RealCore: self.RealCore, Chain: self.Chain && self.Chain.Chain, CFG: self.XCPETS_CONFIG }; loaded = true; }
    var t0 = Date.now(), w = self.V2Rules.replay(m.rows, m.hashes, m.ops, { tip: m.tip, live: self.LiveEngine.RealCore, dex: m.dex }), ms = Date.now() - t0;
    /* rare-room-unequip: posting the whole world clones ~147k pets onto the main thread in one task
     * (measured 133 s, Chrome "page unresponsive"). Store it here and let the page read one part at a time.
     * If that store fails, post the world as before so the page still comes up. */
    function sendWorld() { self.postMessage({ id: m.id, ok: true, world: w, ms: ms }); }
    if (m.idbKey && typeof indexedDB !== 'undefined') idbPut(m.idbKey, w).then(function (ok) {
      if (ok) self.postMessage({ id: m.id, ok: true, idb: true, stored: true, key: m.idbKey, ms: ms });
      else sendWorld();
    }); else sendWorld();
  } catch (e) { self.postMessage({ id: m.id, ok: false, error: String(e && e.message || e) }); }
};
