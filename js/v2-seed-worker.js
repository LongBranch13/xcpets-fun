/* Downloads one pre-built world and writes it in the v:2 IndexedDB layout js/v2-replay-worker.js already uses.
 * Four files at a time. A bad SHA-256 writes nothing. Also hashes a world already in IndexedDB for the desktop recheck. */
'use strict';
function unmarkValue(v) {
  if (!v || typeof v !== 'object') return v;
  if (Array.isArray(v)) { var a = new Array(v.length), i; for (i = 0; i < v.length; i++) if (i in v) a[i] = unmarkValue(v[i]); return a; }
  var ks = Object.keys(v);
  if (ks.length === 1 && ks[0] === '__u' && v.__u === 1) return undefined;
  var o = {}; for (var j = 0; j < ks.length; j++) o[ks[j]] = unmarkValue(v[ks[j]]); return o;
}
function markValue(v) {
  if (v === undefined) return { __u: 1 };
  if (!v || typeof v !== 'object') return v;
  if (Array.isArray(v)) { var a = new Array(v.length), i; for (i = 0; i < v.length; i++) a[i] = (i in v) ? markValue(v[i]) : markValue(undefined); return a; }
  var o = {}, ks = Object.keys(v), j; for (j = 0; j < ks.length; j++) o[ks[j]] = markValue(v[ks[j]]); return o;
}
function hexOf(buf) { return Array.prototype.map.call(new Uint8Array(buf), function (x) { return (x < 16 ? '0' : '') + x.toString(16); }).join(''); }
function sha256Buf(buf) { return crypto.subtle.digest('SHA-256', buf).then(hexOf); }
function sha256Text(s) { return sha256Buf(new TextEncoder().encode(s)); }
function idbOpen() { return new Promise(function (res, rej) { var r = indexedDB.open('xcpets-world', 1);
  r.onupgradeneeded = function () { r.result.createObjectStore('w'); }; r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); }; r.onblocked = function () { rej(new Error('blocked')); }; }); }
function putWorld(key, root, parts, n, cp) { return idbOpen().then(function (db) { return new Promise(function (res, rej) {
  try { var tx = db.transaction('w', 'readwrite'), os = tx.objectStore('w'); os.clear();
    for (var i = 0; i < parts.length; i++) os.put(parts[i], 'world:' + i);
    os.put({ key: key, at: Date.now(), v: 2, parts: parts.length, n: n, root: root }, 'world');
    if (cp && cp.meta && cp.root) { os.put(cp.meta, 'cpm'); os.put(cp.seen || [], 'cps'); os.put(cp.root, 'cpr');
      for (var j = 0; j < cp.parts.length; j++) os.put(cp.parts[j], 'cp:' + j); }
    tx.oncomplete = function () { db.close(); res(true); }; tx.onerror = tx.onabort = function () { try { db.close(); } catch (e) {} rej(tx.error || new Error('idb')); };
  } catch (e) { try { db.close(); } catch (x) {} rej(e); } }); }); }
function getKey(db, key) { return new Promise(function (res, rej) { var q = db.transaction('w', 'readonly').objectStore('w').get(key); q.onsuccess = function () { res(q.result); }; q.onerror = function () { rej(q.error); }; }); }
function digestIdb() { return idbOpen().then(function (db) { return getKey(db, 'world').then(function (v) {
  if (!v || v.v !== 2) throw new Error('no world'); var parts = [], i = 0;
  function next() { if (i >= v.parts) return Promise.resolve(v); return getKey(db, 'world:' + i).then(function (p) { if (!p) throw new Error('gap'); parts.push(p); i++; return next(); }); }
  return next().then(function () { db.close(); var seq = [v.root].concat(parts);
    return seq.reduce(function (p, item) { return p.then(function (acc) { return sha256Text(JSON.stringify(markValue(item))).then(function (h) { acc.push(h); return acc; }); }); }, Promise.resolve([])).then(function (hs) { return sha256Text(hs.join('\n')); }); });
}); }); }
function seed(m) {
  var files = (m.files || []).slice(), pending = files.slice(), running = 0, got = [], failed = null, MAX = 4, settled = false;
  function fail(e) { if (!failed) failed = String(e && e.message || e); pump(); }
  function finish() { if (settled) return; if (failed) { settled = true; self.postMessage({ id: m.id, ok: false, error: failed }); return; }
    if (pending.length || running) return; settled = true;
    var root = null, parts = [], cpRoot = null, cpParts = [], cpMeta = null;
    got.forEach(function (g) {
      if (g.role === 'root') root = g.val;
      else if (g.role === 'part') parts[g.i] = g.val;
      else if (g.role === 'cproot') cpRoot = g.val;
      else if (g.role === 'cppart') cpParts[g.i] = g.val;
      else if (g.role === 'cpmeta') cpMeta = g.val;
    });
    if (!root || parts.length !== m.parts) { self.postMessage({ id: m.id, ok: false, error: 'parts' }); return; }
    for (var i = 0; i < parts.length; i++) if (!parts[i]) { self.postMessage({ id: m.id, ok: false, error: 'gap' }); return; }
    var cp = null;
    if (m.checkpoint) {
      if (!cpRoot || !cpMeta || cpParts.length !== m.checkpoint.parts) { self.postMessage({ id: m.id, ok: false, error: 'checkpoint' }); return; }
      for (var c = 0; c < cpParts.length; c++) if (!cpParts[c]) { self.postMessage({ id: m.id, ok: false, error: 'checkpoint gap' }); return; }
      var meta = m.checkpoint.meta || {};
      meta.dexPos = cpMeta.dexPos || 0; meta.grand = cpMeta.grand ? 1 : 0; meta.parts = cpParts.length; meta.n = m.checkpoint.n;
      if (cpMeta.tip) meta.tip = cpMeta.tip;
      cp = { meta: meta, seen: cpMeta.seen || [], root: cpRoot, parts: cpParts };
    }
    putWorld(m.idbKey, root, parts, m.n, cp).then(function () { self.postMessage({ id: m.id, ok: true, key: m.idbKey }); }, function (e) { self.postMessage({ id: m.id, ok: false, error: String(e && e.message || e) }); });
  }
  function one(f) {
    function check(buf) { return sha256Buf(buf).then(function (h) { if (h !== f.sha256) throw new Error('bad hash'); var val = unmarkValue(JSON.parse(new TextDecoder().decode(buf))); got.push({ role: f.role, i: f.i, val: val }); }); }
    function net() { return fetch(f.url, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error('part ' + r.status); return r.arrayBuffer(); }).then(check); }
    if (f.buf) return check(f.buf).catch(function () { return net(); });
    return net();
  }
  function pump() { if (failed && !running) return finish();
    while (!failed && running < MAX && pending.length) { var f = pending.shift(); running++; one(f).then(function () { running--; if (!pending.length && !running) finish(); else pump(); }, function (e) { running--; fail(e); }); }
    if (!pending.length && !running) finish(); }
  if (!files.length) { self.postMessage({ id: m.id, ok: false, error: 'no files' }); return; }
  pump();
}
self.onmessage = function (ev) {
  var m = ev.data || {};
  if (m.cmd === 'digest') { digestIdb().then(function (d) { self.postMessage({ id: m.id, ok: true, digest: d }); }, function (e) { self.postMessage({ id: m.id, ok: false, error: String(e && e.message || e) }); }); return; }
  if (m.cmd === 'seed') { try { seed(m); } catch (e) { self.postMessage({ id: m.id, ok: false, error: String(e && e.message || e) }); } }
};
