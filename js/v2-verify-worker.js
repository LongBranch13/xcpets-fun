/* Background check. Decodes the published snapshot and applies the blocks it is
 * missing, all off the main thread. The world stays here. The page gets progress
 * and a sendBlock answer, not the world. js/v2-rules.js is loaded as text and
 * patched the same way the catch-up worker patches it. The file on disk is not changed. */
'use strict';
importScripts('v2-resume.js', 'v2-art.js?v=fa5e112502');
var world = null, ownerTable = null, VBYTES = 0;
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
function hexOf(buf) { return Array.prototype.map.call(new Uint8Array(buf), function (x) { return (x < 16 ? '0' : '') + x.toString(16); }).join(''); }
function sha256Buf(buf) { return crypto.subtle.digest('SHA-256', buf).then(hexOf); }
/* Same check as js/v2-catchup-worker.js loadFile and the seed worker: the manifest sha256 must match the bytes.
 * A mismatch throws 'bad hash' before the bytes are parsed. start() then posts ready ok:false, and the page keeps
 * the published world instead of the tampered part (the catch-up caller falls back to today's load the same way). */
function loadFile(f, got, total) {
  return fetch(f.url).then(function (r) { if (!r.ok) throw new Error('part ' + r.status); return r.arrayBuffer(); }).then(function (buf) {
    VBYTES += buf.byteLength;
    return sha256Buf(buf).then(function (h) {
      if (h !== f.sha256) throw new Error('bad hash');
      got.n++;
      self.postMessage({ cmd: 'progress', phase: 'files', got: got.n, total: total });
      var val = unmark(JSON.parse(new TextDecoder().decode(buf)));
      return { role: f.role, i: f.i, val: val };
    });
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
  /* Timings (ms) for each step, sent with 'ready' so a probe can see where the check spends its time. Display/measure only. */
  var T = { t0: Date.now() }, mark = function (k) { T[k] = Date.now() - T.t0; }, bytes = 0;
  self.postMessage({ cmd: 'progress', phase: 'sync', got: 0, total: 1 });
  return Promise.all([
    m.manifest && /^https?:/.test(m.manifest) ? Promise.resolve({ manifest: m.manifest }) : fetch(base + '/xp/v1/world/latest.json').then(function (r) { if (!r.ok) throw new Error('latest'); return r.json(); }),
    fetch(base + '/xp/v1/sync').then(function (r) { if (!r.ok) throw new Error('sync'); return r.json(); })
  ]).then(function (pair) {
    var latest = pair[0], sync = pair[1]; mark('sync'); T.rows = (sync.rows && sync.rows.list || []).length;
    var manUrl = /^https?:/.test(latest.manifest) ? latest.manifest : base + latest.manifest;
    return fetch(manUrl).then(function (r) { if (!r.ok) throw new Error('manifest'); return r.json(); }).then(function (man) {
      mark('manifest');
      var files = filesOf(man, dirOf(manUrl)), got = { n: 0 }, loaded = [];
      /* Nov 23 2026: four parts at a time instead of one after another (each part is still hash-checked before it is used). */
      var queue = files.slice(), lanes = [], L;
      function lane() { var f = queue.shift(); if (!f) return Promise.resolve(); return loadFile(f, got, files.length).then(function (row) { loaded.push(row); return lane(); }); }
      for (L = 0; L < 4; L++) lanes.push(lane());
      return Promise.all(lanes).then(function () {
        mark('files'); T.nFiles = files.length; T.bytes = VBYTES;
        self.postMessage({ cmd: 'progress', phase: 'rules', got: files.length, total: files.length });
        shim();
        var scripts = (m.scripts || []).slice(), rulesUrl = null, i;
        for (i = 0; i < scripts.length; i++) if (/\/js\/v2-rules\.js(\?|$)/.test(scripts[i])) rulesUrl = scripts[i];
        var rest = scripts.filter(function (u) { return u !== rulesUrl && !/\/js\/v2-replay-worker\.js(\?|$)/.test(u); });
        if (!rulesUrl) throw new Error('rules');
        if (rest.length) importScripts.apply(self, rest);
        return loadText(rulesUrl).then(function (src) {
          (0, eval)(XcpResume.patchRules(src)); mark('rules');
          self.LiveEngine = { RealCore: self.RealCore, Chain: self.Chain && self.Chain.Chain, CFG: self.XCPETS_CONFIG };
          var root = null, parts = [], meta = null;
          loaded.forEach(function (g) { if (g.role === 'root') root = g.val; else if (g.role === 'meta') meta = g.val; else parts[g.i] = g.val; });
          loaded = null;
          if (!root || !meta) throw new Error('parts');
          self.postMessage({ cmd: 'progress', phase: 'replay', got: 0, total: 1 });
          var w = XcpResume.wsDecode(root, parts); mark('decode');
          ownerTable = w._owners || null;
          if (self.XcpArt && (w._owners || w._hashes)) XcpArt.restore(w, self.PetCore, { ftLook: self.V2Rules && V2Rules.ftLookOfTier ? function (t) { return V2Rules.ftLookOfTier(t); } : null });
          root = null; parts = null; mark('restore');
          var rows = (sync.rows && sync.rows.list) || [];
          var tip = sync.tip || man.tip;
          /* Nov 25 2026 (Jake: 3 Shock Boxes, no reveal): the page already has the look (art) of every pet in the published world, so art is
           * left out of 'mine' to keep it small. A pet hatched (or brought into this wallet) after the published block has no art on the page:
           * it showed as a blank card and the hatch reveal crashed on it. Remember who owned what in the published world; those new pets keep art. */
          var pubOwner = {}, pw = w.pets || [], pj; for (pj = 0; pj < pw.length; pj++) if (pw[pj]) pubOwner[pw[pj].id] = pw[pj].owner;
          var seen = {}, list = meta.seen || [], s;
          for (s = 0; s < list.length; s++) seen[list[s]] = 1;
          world = self.V2Rules.replay(rows, sync.hashes || {}, [], { tip: tip, live: self.LiveEngine.RealCore, dex: sync.dex && sync.dex.body || undefined,
            _resume: { w: w, seen: seen, dexPos: meta.dexPos || 0, grand: meta.grand ? 1 : 0, tip: meta.tip } });
          mark('replay'); T.from = meta.tip; T.to = world.tip;
          var alive = 0, i2, pets = world.pets || [], meAddr = m.me || '', mine = [], fights = [], wornBy = {}, ids = {}, ownerDeeds = {}, mythicOwners = {};
          for (i2 = 0; i2 < pets.length; i2++) if (pets[i2] && !pets[i2].dead && !pets[i2].released) alive++;
          if (meAddr && world.mythicOwners && world.mythicOwners[meAddr] != null) mythicOwners[meAddr] = world.mythicOwners[meAddr];
          if (meAddr) {
            var items = world.items || {}, ik = Object.keys(items), gi, g;
            for (gi = 0; gi < ik.length; gi++) { g = items[ik[gi]]; if (g && g.on != null) (wornBy[g.on] = wornBy[g.on] || []).push(g); }
            for (i2 = 0; i2 < pets.length; i2++) {
              var p = pets[i2];
              if (!p || p.owner !== meAddr) continue;
              var c = {}, pk = Object.keys(p), pi;
              var needArt = pubOwner[p.id] !== meAddr;
              for (pi = 0; pi < pk.length; pi++) if (pk[pi] !== 'art' || needArt) c[pk[pi]] = p[pk[pi]];
              c.worn = wornBy[p.id] || [];
              if (p.deed && world.deeds && world.deeds[p.deed]) ownerDeeds[p.deed] = world.deeds[p.deed];
              if (!p.dead && !p.released) mine.push(c);
              ids[p.id] = c;
            }
            var fs = world.fights || [], fi, f;
            for (fi = 0; fi < fs.length; fi++) { f = fs[fi]; if (ids[f.a] || ids[f.b] || f.challenger === meAddr) fights.push(f); }
          }
          /* open Gooby's breed requests at the checked tip (Nov 23 2026): the slim world only has the published ones, so a request made
           * after the published block showed nowhere until the next world build. Small (inside the 144-block window). */
          var reqs = [], rq = world.breedReqs || [], ri; for (ri = 0; ri < rq.length; ri++) { var r0 = rq[ri]; if (r0 && !r0.used && world.tip - (r0.block | 0) <= 192) reqs.push({ a: r0.a, b: r0.b, block: r0.block, tx: r0.tx || null, owner: r0.owner || null }); }
          self._reqs = reqs;
          self._mine = mine; self._owned = ids; self._fights = fights; self._deeds = ownerDeeds; self._mythic = mythicOwners; self._tip = world.tip; self._n = pets.length; self._alive = alive;
          mark('mine');
          self.postMessage({ cmd: 'ready', ok: true, t: T, tip: world.tip, n: pets.length, alive: alive, burned: world.community && world.community.burned || 0, mineN: mine.length });
        });
      });
    });
  });
}
function petSig(p) {
  var z = p && p.zombie;
  return [(p && p.care | 0), (p && p.owner) || '', p && p.dead ? 1 : 0, p && p.released ? 1 : 0, p && p.stage | 0, (p && p.deed) || '', (z && !z.end) ? (z.fedAt | 0) : 0, p && p.feral ? 1 : 0].join(':');
}
function syncMine(m) {
  var sigs = m.sigs || {}, only = !!m.onlyChanged, mine = self._mine || [], owned = self._owned || {}, out = [], i, p, s, id;
  for (i = 0; i < mine.length; i++) {
    p = mine[i]; s = petSig(p);
    if (only) { if (sigs[p.id] == null || sigs[p.id] === s) continue; }
    else if (sigs[p.id] === s) continue;
    out.push(p);
  }
  var ks = Object.keys(owned);
  for (i = 0; i < ks.length; i++) {
    id = ks[i]; p = owned[id];
    if (!p || (!p.dead && !p.released)) continue;
    if (sigs[id] == null || sigs[id] === petSig(p)) continue;
    out.push(p);
  }
  var STEP = 400, from = 0;
  function send() {
    var last = from + STEP >= out.length || !out.length;
    self.postMessage({ cmd: 'mine', mode: 'diff', pets: out.slice(from, from + STEP), from: from, total: out.length || 1, last: last, fights: last ? (self._fights || []) : null, deeds: last ? (self._deeds || {}) : null, mythicOwners: last ? (self._mythic || {}) : null, breedReqs: last ? (self._reqs || null) : null, tip: self._tip, n: self._n, alive: self._alive });
    if (!last) { from += STEP; setTimeout(send, 0); }
  }
  send();
}
function planIds(plan) {
  var t = self.V2Rules && V2Rules.parseTag ? V2Rules.parseTag(plan && plan.tag) : null;
  if (!t) return [];
  if (self.XcpArt && XcpArt.tagPetIds) return XcpArt.tagPetIds(t);
  var ids = [], i;
  ['zombie', 'petId', 'a', 'b', 'mine', 'theirs', 'grave', 'target'].forEach(function (k) {
    var v = t[k];
    if (typeof v === 'number') ids.push(v);
    else if (v && v.length) for (i = 0; i < v.length; i++) if (typeof v[i] === 'number') ids.push(v[i]);
  });
  if (t.ids) for (i = 0; i < t.ids.length; i++) if (typeof t.ids[i] === 'number') ids.push(t.ids[i]);
  return ids;
}
/* A checkpoint pet keeps its owner as {__s:N} until restore. The view shard uses o, a different index list.
 * Fill whichever form is still on the pet from the table that wrote it, then the owner check can see the address. */
function resolveChecked(plan) {
  if (!world || !world.byId || !self.XcpArt || !XcpArt.resolvePetOwner) return;
  var ids = planIds(plan), i, p, sib, list = world.pets || [];
  for (i = 0; i < ids.length; i++) {
    p = world.byId[ids[i]];
    if (!p) continue;
    if (!(typeof p.owner === 'string' && p.owner)) {
      for (var j = 0; j < list.length; j++) { sib = list[j]; if (sib && sib.id === p.id && sib !== p && typeof sib.owner === 'string' && sib.owner) { p.owner = sib.owner; break; } }
    }
    XcpArt.resolvePetOwner(p, { checkpoint: ownerTable });
  }
}
function check(m) {
  /* raid-wallet-slow: an error inside the rules check answers the page instead of leaving the burn waiting forever */
  try { check0(m); } catch (e) { self.postMessage({ id: m.id, cmd: 'check', ok: false, error: String(e && e.message || e), skip: ['The check hit an error (' + String(e && e.message || e).slice(0, 120) + '). Nothing was burned.'] }); }
}
function check0(m) {
  if (!world || !self.V2Rules || !self.V2Rules.sendBlock) { self.postMessage({ id: m.id, cmd: 'check', ok: false, error: 'not ready' }); return; }
  var plans = m.plans || [], pending = (m.pending || []).slice(), kept = [], skip = [], i, why;
  for (i = 0; i < plans.length; i++) {
    resolveChecked(plans[i]);
    why = self.V2Rules.sendBlock(world, plans[i], m.tip || world.tip, { me: m.me || '', pending: pending });
    if (why) skip.push(why);
    else { kept.push(plans[i]); if (plans[i] && plans[i].tag) pending.push(plans[i].tag); }
  }
  self.postMessage({ id: m.id, cmd: 'check', ok: true, plans: kept, skip: skip });
}
self.onmessage = function (ev) {
  var m = ev.data || {};
  if (m.cmd === 'check') { check(m); return; }
  if (m.cmd === 'sync') { syncMine(m); return; }
  if (m.cmd !== 'start') return;
  start(m).catch(function (e) { self.postMessage({ cmd: 'ready', ok: false, error: String(e && e.message || e) }); });
};
