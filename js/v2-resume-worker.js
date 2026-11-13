/* XCPETS replay worker (smooth-perf, owner approved 2026-10-19). Runs V2Rules.replay OFF the main thread so a page never freezes while every pet is
 * rebuilt (it used to be one 3 s / 12 s long task on desktop / phone). It loads the very same rule scripts the page loaded (same URLs, same ?v= build)
 * with the same small browser shim tools/replay-check.js uses, replays the same inputs and posts the world back (a structured clone: same data).
 * It then stores that world in the cross-visit IndexedDB cache (js/v2-chain.js), so the main thread never pays for serialising it. READ-ONLY: no
 * network, no wallet, no burns. Any failure answers {ok:false} and the page replays on the main thread exactly as before.
 * A resume job (m.resume) continues from the checkpoint stored last time: historical burns are not replayed. The rules file is fetched and patched
 * in memory (js/v2-resume.js). The file on disk is not modified. No resume, or a resume that cannot be applied, is a full replay of the same function. */
'use strict';
var loaded = false, rulesReady = null;
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
function idbOpen() { return new Promise(function (res, rej) { var r = indexedDB.open('xcpets-world', 1); r.onupgradeneeded = function () { try { r.result.createObjectStore('w'); } catch (e) {} }; r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); }; r.onblocked = function () { rej(new Error('blocked')); }; }); }
function idbGet(db, key) { return new Promise(function (res, rej) { var q = db.transaction('w', 'readonly').objectStore('w').get(key); q.onsuccess = function () { res(q.result); }; q.onerror = function () { rej(q.error); }; }); }
function idbPut(key, w, cp) { return new Promise(function (res) { try { var e = wsEncode(w), r = indexedDB.open('xcpets-world', 1); r.onupgradeneeded = function () { r.result.createObjectStore('w'); };
  r.onsuccess = function () { var db = r.result; try { var tx = db.transaction('w', 'readwrite'), os = tx.objectStore('w'); os.clear();
      for (var i = 0; i < e.parts.length; i++) os.put(e.parts[i], 'world:' + i);
      os.put({ key: key, at: Date.now(), v: 2, parts: e.parts.length, n: e.n, root: e.root }, 'world'); e = null;
      if (cp && cp.enc && cp.meta) { os.put(cp.meta, 'cpm'); os.put(cp.seen || [], 'cps'); os.put(cp.enc.root, 'cpr');
        for (var j = 0; j < cp.enc.parts.length; j++) os.put(cp.enc.parts[j], 'cp:' + j); cp.enc = null; }
      tx.oncomplete = function () { db.close(); res(true); }; tx.onerror = tx.onabort = function () { try { console.warn('[v2] saved world not stored: ' + (tx.error && tx.error.message)); } catch (x) {} db.close(); res(false); }; } catch (x) { db.close(); res(false); } };
  r.onerror = r.onblocked = function () { res(false); }; } catch (x) { res(false); } }); }
function loadText(url) { return fetch(url, { cache: 'force-cache' }).then(function (r) { if (!r.ok) throw new Error('rules ' + r.status); return r.text(); }); }
function loadCheckpoint() {
  return idbOpen().then(function (db) {
    return idbGet(db, 'cpm').then(function (meta) {
      if (!meta || meta.v !== 1 || !(meta.parts >= 0)) { db.close(); return null; }
      return idbGet(db, 'cps').then(function (seen) {
        return idbGet(db, 'cpr').then(function (root) {
          if (!root) { db.close(); return null; }
          var parts = [], i = 0;
          function next() { if (i >= meta.parts) { db.close(); return { meta: meta, seen: seen || [], root: root, parts: parts }; }
            return idbGet(db, 'cp:' + i).then(function (p) { if (!p) { db.close(); return null; } parts.push(p); i++; return next(); }); }
          return next();
        });
      });
    });
  });
}
function ensureRules(m) {
  if (rulesReady) return rulesReady;
  rulesReady = new Promise(function (res, rej) {
    try {
      if (!loaded) { shim(); var q = ''; try { q = new URL(self.location.href).search || ''; } catch (e) {} importScripts('v2-resume.js' + q); }
      var scripts = m.scripts || [], rulesUrl = null, rest = [], i;
      for (i = 0; i < scripts.length; i++) { if (/\/js\/v2-rules\.js(\?|$)/.test(scripts[i])) rulesUrl = scripts[i]; else rest.push(scripts[i]); }
      if (!rulesUrl) { rej(new Error('rules')); return; }
      if (!loaded && rest.length) importScripts.apply(self, rest);
      loadText(rulesUrl).then(function (src) {
        (0, eval)(self.XcpResume.patchRules(src));
        self.LiveEngine = { RealCore: self.RealCore, Chain: self.Chain && self.Chain.Chain, CFG: self.XCPETS_CONFIG };
        loaded = true; res();
      }, rej);
    } catch (e) { rej(e); }
  });
  return rulesReady;
}
function capture(holder) {
  return function (w, seen) {
    try {
      var keys = [], k; for (k in seen) if (Object.prototype.hasOwnProperty.call(seen, k)) keys.push(k);
      holder.enc = wsEncode(w); holder.seen = keys; holder.dexPos = w._dexPos || 0; holder.grand = w._grand ? 1 : 0;
    } catch (e) { holder.enc = null; }
  };
}
function replayWith(m, resume) {
  var holder = {};
  var opts = { tip: m.tip, live: self.LiveEngine.RealCore, dex: m.dex, _beforeTail: capture(holder) };
  if (resume) opts._resume = resume;
  var w = self.V2Rules.replay(m.rows, m.hashes, m.ops || [], opts);
  return { world: w, holder: holder };
}
function finishStore(m, pack, resumed) {
  var cp = null;
  if (pack.holder.enc && m.rsig && self.XcpResume && self.XcpResume.checkpointMeta) {
    var meta = self.XcpResume.checkpointMeta({ rows: m.rows, hashes: m.hashes, dex: m.dex || null, ops: m.ops || [], tip: m.tip, rsig: m.rsig,
      dexPos: pack.holder.dexPos, grand: pack.holder.grand, parts: pack.holder.enc.parts.length, n: pack.holder.enc.n });
    cp = { enc: pack.holder.enc, meta: meta, seen: pack.holder.seen || [] };
  }
  function sendWorld() { self.postMessage({ id: m.id, ok: true, world: pack.world, ms: pack.ms, resumed: resumed, tailOnly: !!pack.tailOnly, rows: m.rows ? m.rows.length : 0 }); }
  if (m.idbKey && typeof indexedDB !== 'undefined') return idbPut(m.idbKey, pack.world, cp).then(function (ok) {
    if (ok) self.postMessage({ id: m.id, ok: true, idb: true, stored: true, key: m.idbKey, ms: pack.ms, resumed: resumed, tailOnly: !!pack.tailOnly, rows: m.rows ? m.rows.length : 0 });
    else sendWorld();
  });
  sendWorld();
  return Promise.resolve();
}
function run(m) {
  return ensureRules(m).then(function () {
    var t0 = Date.now();
    function full() { var pack = replayWith(m, null); pack.ms = Date.now() - t0; return finishStore(m, pack, false); }
    if (!m.resume || !self.XcpResume || !self.XcpResume.canResume) return full();
    return loadCheckpoint().then(function (cp) {
      if (!cp) return full();
      var gate = self.XcpResume.canResume(cp.meta, { rsig: m.rsig || '', tip: m.tip, rows: m.rows || [], dex: m.dex || null, hashes: m.hashes || {}, ops: m.ops || [], cutoff: self.V2Rules.CUTOFF_BLOCK });
      if (!gate.ok) return full();
      var base = self.XcpResume.wsDecode(cp.root, cp.parts), seen = {}, i;
      for (i = 0; i < cp.seen.length; i++) seen[cp.seen[i]] = 1;
      var pack = replayWith(m, { w: base, seen: seen, dexPos: cp.meta.dexPos, grand: cp.meta.grand, tip: cp.meta.tip, opsFrom: gate.opsFrom || 0 });
      pack.ms = Date.now() - t0; pack.tailOnly = !!gate.tailOnly; return finishStore(m, pack, true);
    }, full);
  });
}
self.onmessage = function (ev) {
  var m = ev.data || {};
  run(m).then(function () {}, function (e) { self.postMessage({ id: m.id, ok: false, error: String(e && e.message || e) }); });
};
