/* Reads the saved world out of IndexedDB and hands it to the page in small pieces.
 * IndexedDB delivers each record on the thread that asked for it. A 17 MB root on the main thread was one long task
 * (measured over 700 ms at 4x CPU). The clone happens here. The page only receives a few hundred objects per message. */
'use strict';
var WS_BIG = 32, WS_PART = 800, WS_MARK = '__wsr', SLICE = 20;
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
function wsDecode(root, partList, n) {
  var T = [], i, j, M = WS_MARK;
  for (i = 0; i < partList.length; i++) for (j = 0; j < partList[i].length; j++) T.push(partList[i][j]);
  if (T.length !== n) throw new Error('gap');
  function isP(o) { if (!o || typeof o !== 'object') return false; if (Array.isArray(o)) return true; var p = Object.getPrototypeOf(o); return p === Object.prototype || p === null; }
  function marker(val) { if (typeof val[M] !== 'number') return false; for (var p in val) if (p !== M) return false; return true; }
  function fix(o) { var st = [o], x, ks, nn, a, val; while (st.length) { x = st.pop(); a = Array.isArray(x); ks = a ? null : Object.keys(x); nn = a ? x.length : ks.length;
    for (var q = 0; q < nn; q++) { var kk = a ? q : ks[q]; val = x[kk]; if (!isP(val)) continue; if (marker(val)) { var r = T[val[M]]; if (!r) throw new Error('ws ref'); x[kk] = r; } else st.push(val); } } }
  for (i = 0; i < T.length; i++) fix(T[i]);
  fix(root);
  return root;
}
function idbOpen() { return new Promise(function (res, rej) { var r = indexedDB.open('xcpets-world', 1); r.onupgradeneeded = function () { try { r.result.createObjectStore('w'); } catch (e) {} }; r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); }; r.onblocked = function () { rej(new Error('blocked')); }; }); }
function idbGet(db, key) { return new Promise(function (res, rej) { var q = db.transaction('w', 'readonly').objectStore('w').get(key); q.onsuccess = function () { res(q.result); }; q.onerror = function () { rej(q.error); }; }); }
function sendSlices(msg, val) {
  if (Array.isArray(val)) {
    if (!val.length) { self.postMessage(Object.assign({ items: [] }, msg)); return; }
    for (var k = 0; k < val.length; k += SLICE) self.postMessage(Object.assign({ items: val.slice(k, k + SLICE) }, msg));
    return;
  }
  self.postMessage(Object.assign({ items: [val], once: 1 }, msg));
}
function sendEncoded(enc, meta) {
  self.postMessage({ type: 'meta', key: meta.key, at: meta.at, parts: enc.parts.length, n: enc.n });
  var keys = Object.keys(enc.root), i;
  for (i = 0; i < keys.length; i++) sendSlices({ type: 'root', k: keys[i] }, enc.root[keys[i]]);
  for (i = 0; i < enc.parts.length; i++) sendSlices({ type: 'part', i: i }, enc.parts[i]);
  self.postMessage({ type: 'end' });
}
function readWorld() {
  return idbOpen().then(function (db) {
    return new Promise(function (res, rej) {
      var tx = db.transaction('w', 'readonly'), os = tx.objectStore('w');
      var head = os.get('world');
      head.onerror = function () { rej(head.error); };
      head.onsuccess = function () {
        var v = head.result;
        if (!v) { db.close(); res(null); return; }
        if (v.world && !v.root) { db.close(); res({ key: v.key, at: v.at, world: v.world }); return; }
        if (!(v.v === 2 && v.root && v.parts > 0)) { db.close(); res(null); return; }
        var parts = new Array(v.parts), left = v.parts, settled = false, i;
        function finish(val) { if (settled) return; settled = true; try { db.close(); } catch (e) {} res(val); }
        for (i = 0; i < v.parts; i++) {
          (function (i) {
            var g = os.get('world:' + i);
            g.onerror = function () { if (!settled) { settled = true; rej(g.error); } };
            g.onsuccess = function () { if (settled) return; if (!g.result) { finish(null); return; } parts[i] = g.result; if (--left === 0) finish({ key: v.key, at: v.at, root: v.root, parts: parts, n: v.n }); };
          })(i);
        }
      };
      tx.onerror = function () { rej(tx.error); };
    });
  });
}
self.onmessage = function (ev) {
  var m = ev.data || {};
  if (m.cmd !== 'decode') return;
  readWorld().then(function (got) {
    if (!got) { self.postMessage({ type: 'fail' }); return; }
    if (got.world) { self.postMessage({ type: 'legacy', key: got.key, at: got.at, world: got.world }); return; }
    /* The records are already in the saved encoding. Hand them over as they are.
       Re-encoding into tiny slices made the main thread walk the world a second time. */
    self.postMessage({ type: 'meta', key: got.key, at: got.at, parts: got.parts.length, n: got.n });
    self.postMessage({ type: 'root-all', root: got.root });
    for (var i = 0; i < got.parts.length; i++) self.postMessage({ type: 'part-all', i: i, items: got.parts[i] });
    self.postMessage({ type: 'end' });
  }, function (e) { self.postMessage({ type: 'fail', error: String(e && e.message || e) }); });
};
