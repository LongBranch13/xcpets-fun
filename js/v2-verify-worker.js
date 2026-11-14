/* Background check. Decodes the published snapshot and applies the blocks it is
 * missing, all off the main thread. The world stays here. The page gets progress
 * and a sendBlock answer, not the world. js/v2-rules.js is loaded as text and
 * patched the same way the catch-up worker patches it. The file on disk is not changed. */
'use strict';
importScripts('v2-resume.js');
var world = null;
function shim() {
  var mem = {}, st = { getItem: function (k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; }, setItem: function (k, v) { mem[k] = String(v); }, removeItem: function (k) { delete mem[k]; } };
  self.window = self; self.localStorage = st; self.sessionStorage = st;
  self.document = { getElementById: function () { return null; }, querySelector: function () { return null; }, querySelectorAll: function () { return []; },
    createElement: function () { return { getContext: function () { return null; }, style: {} }; }, addEventListener: function () {}, body: null, documentElement: { style: {} }, readyState: 'complete' };
  if (!self.addEventListener) self.addEventListener = function () {};
}
function unmark(v) {
  if (!v || typeof v !== 'object') return v;
  if (Array.isArray(v)) { var a = new Array(v.length), i; for (i = 0; i < v.length; i++) if (i in v) a[i] = unmark(v[i]); return a; }
  var ks = Object.keys(v);
  if (ks.length === 1 && ks[0] === '__u' && v.__u === 1) return undefined;
  var o = {}; for (var j = 0; j < ks.length; j++) o[ks[j]] = unmark(v[ks[j]]); return o;
}
function loadFile(f, got, total) {
  return fetch(f.url).then(function (r) { if (!r.ok) throw new Error('part ' + r.status); return r.arrayBuffer(); }).then(function (buf) {
    got.n++;
    self.postMessage({ cmd: 'progress', phase: 'files', got: got.n, total: total });
    var val = unmark(JSON.parse(new TextDecoder().decode(buf)));
    return { role: f.role, i: f.i, val: val };
  });
}
function loadText(url) { return fetch(url, { cache: 'force-cache' }).then(function (r) { if (!r.ok) throw new Error('script ' + r.status); return r.text(); }); }
function filesOf(man, dir) {
  var cp = man.checkpoint;
  if (!cp || !cp.root) throw new Error('no checkpoint');
  var files = [{ url: dir + cp.root.url, sha256: cp.root.sha256, role: 'root' }];
  (cp.files || []).forEach(function (f) { files.push({ url: dir + f.url, sha256: f.sha256, role: 'part', i: f.i }); });
  files.push({ url: dir + cp.meta.url, sha256: cp.meta.sha256, role: 'meta' });
  return files;
}
function dirOf(url) { return String(url || '').replace(/[^/]+$/, ''); }
function start(m) {
  var base = String(m.base || '').replace(/\/$/, '');
  self.postMessage({ cmd: 'progress', phase: 'sync', got: 0, total: 1 });
  return Promise.all([
    fetch(base + '/xp/v1/world/latest.json').then(function (r) { if (!r.ok) throw new Error('latest'); return r.json(); }),
    fetch(base + '/xp/v1/sync').then(function (r) { if (!r.ok) throw new Error('sync'); return r.json(); })
  ]).then(function (pair) {
    var latest = pair[0], sync = pair[1];
    var manUrl = /^https?:/.test(latest.manifest) ? latest.manifest : base + latest.manifest;
    return fetch(manUrl).then(function (r) { if (!r.ok) throw new Error('manifest'); return r.json(); }).then(function (man) {
      var files = filesOf(man, dirOf(manUrl)), got = { n: 0 }, loaded = [];
      var chain = Promise.resolve();
      files.forEach(function (f) { chain = chain.then(function () { return loadFile(f, got, files.length).then(function (row) { loaded.push(row); }); }); });
      return chain.then(function () {
        self.postMessage({ cmd: 'progress', phase: 'rules', got: files.length, total: files.length });
        shim();
        var scripts = (m.scripts || []).slice(), rulesUrl = null, i;
        for (i = 0; i < scripts.length; i++) if (/\/js\/v2-rules\.js(\?|$)/.test(scripts[i])) rulesUrl = scripts[i];
        var rest = scripts.filter(function (u) { return u !== rulesUrl && !/\/js\/v2-replay-worker\.js(\?|$)/.test(u); });
        if (!rulesUrl) throw new Error('rules');
        if (rest.length) importScripts.apply(self, rest);
        return loadText(rulesUrl).then(function (src) {
          (0, eval)(XcpResume.patchRules(src));
          self.LiveEngine = { RealCore: self.RealCore, Chain: self.Chain && self.Chain.Chain, CFG: self.XCPETS_CONFIG };
          var root = null, parts = [], meta = null;
          loaded.forEach(function (g) { if (g.role === 'root') root = g.val; else if (g.role === 'meta') meta = g.val; else parts[g.i] = g.val; });
          loaded = null;
          if (!root || !meta) throw new Error('parts');
          self.postMessage({ cmd: 'progress', phase: 'replay', got: 0, total: 1 });
          var w = XcpResume.wsDecode(root, parts);
          root = null; parts = null;
          var rows = (sync.rows && sync.rows.list) || [];
          var tip = sync.tip || man.tip;
          var seen = {}, list = meta.seen || [], s;
          for (s = 0; s < list.length; s++) seen[list[s]] = 1;
          world = self.V2Rules.replay(rows, sync.hashes || {}, [], { tip: tip, live: self.LiveEngine.RealCore, dex: sync.dex && sync.dex.body || undefined,
            _resume: { w: w, seen: seen, dexPos: meta.dexPos || 0, grand: meta.grand ? 1 : 0, tip: meta.tip } });
          var alive = 0, i2, pets = world.pets || [];
          for (i2 = 0; i2 < pets.length; i2++) if (pets[i2] && !pets[i2].dead && !pets[i2].released) alive++;
          self.postMessage({ cmd: 'ready', ok: true, tip: world.tip, n: pets.length, alive: alive, burned: world.community && world.community.burned || 0 });
        });
      });
    });
  });
}
function check(m) {
  if (!world || !self.V2Rules || !self.V2Rules.sendBlock) { self.postMessage({ id: m.id, cmd: 'check', ok: false, error: 'not ready' }); return; }
  var plans = m.plans || [], pending = (m.pending || []).slice(), kept = [], skip = [], i, why;
  for (i = 0; i < plans.length; i++) {
    why = self.V2Rules.sendBlock(world, plans[i], m.tip || world.tip, { me: m.me || '', pending: pending });
    if (why) skip.push(why);
    else { kept.push(plans[i]); if (plans[i] && plans[i].tag) pending.push(plans[i].tag); }
  }
  self.postMessage({ id: m.id, cmd: 'check', ok: true, plans: kept, skip: skip });
}
self.onmessage = function (ev) {
  var m = ev.data || {};
  if (m.cmd === 'check') { check(m); return; }
  if (m.cmd !== 'start') return;
  start(m).catch(function (e) { self.postMessage({ cmd: 'ready', ok: false, error: String(e && e.message || e) }); });
};
