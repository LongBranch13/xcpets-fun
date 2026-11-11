/* Applies the blocks a snapshot is missing, then stores that world under the current key.
 * The rule file on disk is not changed. This worker evals a copy that can resume. */
'use strict';
importScripts('v2-resume.js');
function shim() {
  var mem = {}, st = { getItem: function (k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; }, setItem: function (k, v) { mem[k] = String(v); }, removeItem: function (k) { delete mem[k]; } };
  self.window = self; self.localStorage = st; self.sessionStorage = st;
  self.document = { getElementById: function () { return null; }, querySelector: function () { return null; }, querySelectorAll: function () { return []; },
    createElement: function () { return { getContext: function () { return null; }, style: {} }; }, addEventListener: function () {}, body: null, documentElement: { style: {} }, readyState: 'complete' };
  if (!self.addEventListener) self.addEventListener = function () {};
}
function hexOf(buf) { return Array.prototype.map.call(new Uint8Array(buf), function (x) { return (x < 16 ? '0' : '') + x.toString(16); }).join(''); }
function sha256Buf(buf) { return crypto.subtle.digest('SHA-256', buf).then(hexOf); }
function idbOpen() { return new Promise(function (res, rej) { var r = indexedDB.open('xcpets-world', 1);
  r.onupgradeneeded = function () { try { r.result.createObjectStore('w'); } catch (e) {} }; r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); }; r.onblocked = function () { rej(new Error('blocked')); }; }); }
function putWorld(key, root, parts, n) { return idbOpen().then(function (db) { return new Promise(function (res, rej) {
  try { var tx = db.transaction('w', 'readwrite'), os = tx.objectStore('w'); os.clear();
    for (var i = 0; i < parts.length; i++) os.put(parts[i], 'world:' + i);
    os.put({ key: key, at: Date.now(), v: 2, parts: parts.length, n: n, root: root }, 'world');
    tx.oncomplete = function () { db.close(); res(true); }; tx.onerror = tx.onabort = function () { try { db.close(); } catch (e) {} rej(tx.error || new Error('idb')); };
  } catch (e) { try { db.close(); } catch (x) {} rej(e); } }); }); }
function loadText(url) { return fetch(url, { cache: 'force-cache' }).then(function (r) { if (!r.ok) throw new Error('script ' + r.status); return r.text(); }); }
function loadFile(f) { return fetch(f.url, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error('part ' + r.status); return r.arrayBuffer(); }).then(function (buf) {
  return sha256Buf(buf).then(function (h) { if (h !== f.sha256) throw new Error('bad hash'); return JSON.parse(new TextDecoder().decode(buf)); }); }); }
function unmark(v) {
  if (!v || typeof v !== 'object') return v;
  if (Array.isArray(v)) { var a = new Array(v.length), i; for (i = 0; i < v.length; i++) if (i in v) a[i] = unmark(v[i]); return a; }
  var ks = Object.keys(v);
  if (ks.length === 1 && ks[0] === '__u' && v.__u === 1) return undefined;
  var o = {}; for (var j = 0; j < ks.length; j++) o[ks[j]] = unmark(v[ks[j]]); return o;
}
function catchup(m) {
  shim();
  var scripts = (m.scripts || []).slice(), rulesUrl = null, workerUrl = null, i;
  for (i = 0; i < scripts.length; i++) {
    if (/\/js\/v2-rules\.js(\?|$)/.test(scripts[i])) rulesUrl = scripts[i];
    else if (/\/js\/v2-replay-worker\.js(\?|$)/.test(scripts[i])) workerUrl = scripts[i];
  }
  var rest = scripts.filter(function (u) { return u !== rulesUrl && u !== workerUrl; });
  if (!rulesUrl) return Promise.reject(new Error('rules'));
  if (rest.length) importScripts.apply(self, rest);
  return loadText(rulesUrl).then(function (src) {
    (0, eval)(XcpResume.patchRules(src));
    self.LiveEngine = { RealCore: self.RealCore, Chain: self.Chain && self.Chain.Chain, CFG: self.XCPETS_CONFIG };
    return workerUrl ? loadText(workerUrl) : Promise.reject(new Error('encode'));
  }).then(function (workerSrc) {
    var keep = self.onmessage; (0, eval)(workerSrc); self.onmessage = keep;
    var files = (m.files || []).slice(), pending = files.slice(), running = 0, got = [], failed = null;
    return new Promise(function (res, rej) {
      function fail(e) { if (!failed) failed = e; pump(); }
      function finish() {
        if (failed) return rej(failed);
        var root = null, parts = [], meta = null;
        got.forEach(function (g) { if (g.role === 'root') root = g.val; else if (g.role === 'meta') meta = g.val; else parts[g.i] = g.val; });
        if (!root || !meta || parts.length !== m.parts) return rej(new Error('parts'));
        for (var n = 0; n < parts.length; n++) if (!parts[n]) return rej(new Error('gap'));
        var w = XcpResume.wsDecode(root, parts), seen = {}, list = meta.seen || [], s;
        for (s = 0; s < list.length; s++) seen[list[s]] = 1;
        var world = self.V2Rules.replay(m.rows, m.hashes, [], { tip: m.tip, live: self.LiveEngine.RealCore, dex: m.dex || undefined,
          _resume: { w: w, seen: seen, dexPos: meta.dexPos, grand: meta.grand, tip: meta.tip } });
        var enc = wsEncode(world);
        putWorld(m.idbKey, enc.root, enc.parts, enc.n).then(function () { res(true); }, rej);
      }
      function one(f) { return loadFile(f).then(function (val) { got.push({ role: f.role, i: f.i, val: unmark(val) }); }); }
      function pump() {
        if (failed && !running) return finish();
        while (!failed && running < 4 && pending.length) { var f = pending.shift(); running++; one(f).then(function () { running--; if (!pending.length && !running) finish(); else pump(); }, function (e) { running--; fail(e); }); }
        if (!pending.length && !running) finish();
      }
      if (!files.length) return rej(new Error('no files'));
      pump();
    });
  });
}
self.onmessage = function (ev) {
  var m = ev.data || {};
  if (m.cmd !== 'catchup') return;
  catchup(m).then(function () { self.postMessage({ id: m.id, ok: true, key: m.idbKey }); }, function (e) { self.postMessage({ id: m.id, ok: false, error: String(e && e.message || e) }); });
};
