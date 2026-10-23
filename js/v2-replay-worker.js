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
function idbPut(key, w) { return new Promise(function (res) { try { var r = indexedDB.open('xcpets-world', 1); r.onupgradeneeded = function () { r.result.createObjectStore('w'); };
  r.onsuccess = function () { var db = r.result; try { var tx = db.transaction('w', 'readwrite'); tx.objectStore('w').put({ key: key, at: Date.now(), world: w }, 'world'); tx.oncomplete = tx.onerror = tx.onabort = function () { db.close(); res(); }; } catch (e) { db.close(); res(); } };
  r.onerror = r.onblocked = function () { res(); }; } catch (e) { res(); } }); }
self.onmessage = function (ev) {
  var m = ev.data || {};
  try {
    if (!loaded) { shim(); importScripts.apply(self, m.scripts); self.LiveEngine = { RealCore: self.RealCore, Chain: self.Chain && self.Chain.Chain, CFG: self.XCPETS_CONFIG }; loaded = true; }
    var t0 = Date.now(), w = self.V2Rules.replay(m.rows, m.hashes, m.ops, { tip: m.tip, live: self.LiveEngine.RealCore, dex: m.dex }), ms = Date.now() - t0;
    self.postMessage({ id: m.id, ok: true, world: w, ms: ms });
    if (m.idbKey && typeof indexedDB !== 'undefined') idbPut(m.idbKey, w);
  } catch (e) { self.postMessage({ id: m.id, ok: false, error: String(e && e.message || e) }); }
};
