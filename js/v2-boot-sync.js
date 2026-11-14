/* One-shot chain read and pre-built world. Loaded before js/v2-chain.js on chain pages.
 * On xcpets.fun and www.xcpets.fun the sync base is https://node.xcpets.fun. That default lives here, not in
 * rjs/config.js, so the hashed rule files stay the bytes already live. ?sync=<base> and localStorage xcpets-sync
 * override it. ?sync=0 and ?sync=off turn it off. Other origins stay off unless one of those overrides is set.
 * Any failure uses today's load() unchanged. Practice pages do not load this file.
 * verify-pet.html may sync the public read, then always replays locally. */
(function () {
  'use strict';
  var FAIL_KEY = 'xcpets-sync-fail', FLAG_KEY = 'xcpets-sync', SLOW_KEY = 'xcpets-worker-ms';
  var RECHECK_KEY = 'xcpets-snap-recheck', OFF_PREFIX = 'xcpets-snap-off-';
  var DELTA_MS = 2500, FULL_MS = 5000, SKIP_MS = 10 * 60 * 1000, SEED_MS = 300000, DEPTH = 6;
  /* same list js/v2-chain.js gives the replay worker, so a quiet recheck loads the same bytes */
  var RULE_SCRIPTS = ['rjs/config.js', 'rjs/pet-core.js', 'rjs/game-core.js', 'rjs/bonus-gear.js', 'rjs/real-core.js', 'rjs/chain.js', 'js/pet-core.js', 'js/bonus-gear.js', 'js/v2-gear.js', 'js/v2-fit.js', 'js/v2-rules.js'];
  var usedExact = false, pollT = null;

  function q(k) { try { return new URLSearchParams(location.search).get(k); } catch (e) { return null; } }
  function hostDefault() {
    try { var h = String(location.hostname || '').toLowerCase(); if (h === 'xcpets.fun' || h === 'www.xcpets.fun') return 'https://node.xcpets.fun'; } catch (e) {}
    return '';
  }
  function base() {
    var s = q('sync');
    if (s === '0' || s === 'off') return '';
    if (s) return String(s).replace(/\/+$/, '');
    try { var f = localStorage.getItem(FLAG_KEY); if (f) return String(f).replace(/\/+$/, ''); } catch (e) {}
    try { var c = window.XCPETS_CONFIG && window.XCPETS_CONFIG.sync; if (typeof c === 'string' && c) return c.replace(/\/+$/, ''); } catch (e2) {}
    return hostDefault();
  }
  function readFail() { try { return JSON.parse(sessionStorage.getItem(FAIL_KEY)) || {}; } catch (e) { return {}; } }
  function skipped() { var o = readFail(); return !!(o.until && Date.now() < o.until); }
  function enabled() { return !!base() && !skipped(); }
  function localOnly() { try { return /\/verify-pet\.html$/.test(location.pathname || ''); } catch (e) { return false; } }
  function saveData() {
    try { var c = navigator.connection || navigator.mozConnection || navigator.webkitConnection; if (!c) return false;
      if (c.saveData) return true; var t = String(c.effectiveType || ''); return t === '2g' || t === 'slow-2g'; } catch (e) { return false; }
  }
  function desktop() { try { return (navigator.hardwareConcurrency || 0) >= 4 && !saveData(); } catch (e) { return false; } }
  /* Captured while this file is being evaluated. document.currentScript is null once the
   * load-time script has finished, which is when seedExact and catchUp actually run. */
  var PAGE_BUILD = (function () { try { var m = /[?&]v=([0-9a-f]{6,})/.exec((document.currentScript && document.currentScript.src) || ''); return m ? m[1] : ''; } catch (e) { return ''; } })();
  function buildId() { return PAGE_BUILD; }
  /* inSig is tip|rows|rowHash|hashCount|hashHash and, once sale data exists, |dex<hash>.
   * The published snapshot hashed the chain pieces and left the dex suffix off. A suffix
   * that is present on both sides and differs is a different sale book, so it is refused. */
  function sigParts(s) {
    var m = /^(\d+)\|(\d+)\|([0-9a-f]+)\|(\d+)\|([0-9a-f]+)(?:\|dex([0-9a-f]+))?$/.exec(String(s || ''));
    if (!m) return null;
    return { tip: m[1], n: m[2], row: m[3], hc: m[4], hh: m[5], dex: m[6] || '' };
  }
  function sameInputs(manSig, pageSig) {
    var a = sigParts(manSig), b = sigParts(pageSig);
    if (!a || !b) return false;
    if (a.tip !== b.tip || a.n !== b.n || a.row !== b.row || a.hc !== b.hc || a.hh !== b.hh) return false;
    if (a.dex && a.dex !== b.dex) return false;
    return true;
  }
  function logSeed(e) { try { console.warn('[xcpets] snapshot seed failed:', e && (e.message || e)); } catch (x) {} }
  function noteFail() { try { var o = readFail(); o.n = (o.n || 0) + 1; if (o.n >= 2) o.until = Date.now() + SKIP_MS; sessionStorage.setItem(FAIL_KEY, JSON.stringify(o)); } catch (e) {} }
  function noteOk() { try { sessionStorage.removeItem(FAIL_KEY); } catch (e) {} }
  function offFor(rsig) { try { return localStorage.getItem(OFF_PREFIX + rsig) === '1'; } catch (e) { return false; } }
  function slowDevice() { try { return (Number(localStorage.getItem(SLOW_KEY)) || 0) >= 15000 && !saveData(); } catch (e) { return false; } }

  function markValue(v) {
    if (v === undefined) return { __u: 1 };
    if (!v || typeof v !== 'object') return v;
    if (Array.isArray(v)) { var a = new Array(v.length), i; for (i = 0; i < v.length; i++) a[i] = (i in v) ? markValue(v[i]) : markValue(undefined); return a; }
    var o = {}, ks = Object.keys(v), j; for (j = 0; j < ks.length; j++) o[ks[j]] = markValue(v[ks[j]]); return o;
  }
  function unmarkValue(v) {
    if (!v || typeof v !== 'object') return v;
    if (Array.isArray(v)) { var a = new Array(v.length), i; for (i = 0; i < v.length; i++) if (i in v) a[i] = unmarkValue(v[i]); return a; }
    var ks = Object.keys(v);
    if (ks.length === 1 && ks[0] === '__u' && v.__u === 1) return undefined;
    var o = {}; for (var j = 0; j < ks.length; j++) o[ks[j]] = unmarkValue(v[ks[j]]); return o;
  }
  function sameValue(a, b) {
    if (a === b) return true;
    if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return false;
    var aa = Array.isArray(a), bb = Array.isArray(b); if (aa !== bb) return false;
    if (aa) { if (a.length !== b.length) return false; for (var i = 0; i < a.length; i++) { if ((i in a) !== (i in b)) return false; if ((i in a) && !sameValue(a[i], b[i])) return false; } return true; }
    var ka = Object.keys(a), kb = Object.keys(b); if (ka.length !== kb.length) return false;
    for (var j = 0; j < ka.length; j++) if (ka[j] !== kb[j] || !sameValue(a[ka[j]], b[ka[j]])) return false; return true;
  }
  function keySort(a, b) { var na = +a, nb = +b; if (String(na) === String(a) && String(nb) === String(b) && isFinite(na) && isFinite(nb)) return na - nb; return a < b ? -1 : a > b ? 1 : 0; }
  function canon(v) {
    if (Array.isArray(v)) return v.map(canon);
    if (v && typeof v === 'object') { var o = {}, ks = Object.keys(v).sort(keySort), i; for (i = 0; i < ks.length; i++) { if (v[ks[i]] === undefined) continue; o[ks[i]] = canon(v[ks[i]]); } return o; }
    return v;
  }
  function checkText(rows, hashes, dex) {
    var h = {}, ks = Object.keys(hashes || {}).sort(function (a, b) { return a - b; }), i;
    for (i = 0; i < ks.length; i++) h[ks[i]] = hashes[ks[i]];
    return JSON.stringify(canon({ rows: rows || [], hashes: h, dex: dex || null }));
  }
  function sha256Text(s) {
    var buf = new TextEncoder().encode(s);
    return crypto.subtle.digest('SHA-256', buf).then(function (d) {
      return Array.prototype.map.call(new Uint8Array(d), function (x) { return (x < 16 ? '0' : '') + x.toString(16); }).join('');
    });
  }
  function digestOf(root, parts) {
    var seq = [root].concat(parts || []);
    return seq.reduce(function (p, v) { return p.then(function (acc) { return sha256Text(JSON.stringify(markValue(v))).then(function (h) { acc.push(h); return acc; }); }); }, Promise.resolve([])).then(function (hs) { return sha256Text(hs.join('\n')); });
  }
  function ordered(rows) { for (var k = 1; k < rows.length; k++) if (!(rows[k].block_index <= rows[k - 1].block_index)) return false; return true; }
  function neededBlocks(rows, tip, gates) {
    var s = {}; (rows || []).forEach(function (r) { if (r && r.block_index != null) s[r.block_index] = 1; });
    var gs = [gates && gates.fire, gates && gates.quest, gates && gates.raid];
    for (var i = 0; i < gs.length; i++) { var g = gs[i]; if (g != null && tip >= g) for (var b = g; b <= tip; b++) s[b] = 1; }
    return Object.keys(s).map(Number).sort(function (a, b) { return a - b; });
  }
  function mempoolOf(events, asset) {
    asset = asset || 'XCPETS';
    return (events || []).map(function (e) { var x = e.params || {}, t = x.tag;
      if (typeof t === 'string' && /^([0-9a-f]{2})+$/i.test(t)) { try { t = decodeURIComponent(t.replace(/(..)/g, '%$1')); } catch (er) {} }
      return x.asset === asset && String(x.status || 'valid') === 'valid' ? { tx_hash: x.tx_hash || e.tx_hash, source: x.source, tag: t, amount: Number(x.quantity) / 1e8, at: e.timestamp ? e.timestamp * 1000 : null } : null;
    }).filter(Boolean);
  }
  function mergeDex(prev, dexAns, normalize) {
    if (!dexAns) return prev || null;
    var mode = dexAns.mode || 'full', body, rep, A, sl, ks = ['issuances', 'orders', 'matches', 'credits', 'destructions'];
    function blank() { return { issuances: [], orders: [], matches: [], credits: [], destructions: [] }; }
    function fill(into, sl2) { ks.forEach(function (k) { into[k] = into[k].concat(sl2[k] || []); }); }
    if (mode === 'full' || mode === 'reorg' || !prev) {
      body = dexAns.body ? { issuances: dexAns.body.issuances || [], orders: dexAns.body.orders || [], matches: dexAns.body.matches || [], credits: dexAns.body.credits || [], destructions: dexAns.body.destructions || [] } : blank();
      if (!dexAns.body) { rep = dexAns.replace || {}; Object.keys(rep).forEach(function (asset) { fill(body, rep[asset] || {}); }); }
      return normalize ? normalize(body) : body;
    }
    body = { issuances: (prev.issuances || []).slice(), orders: (prev.orders || []).slice(), matches: (prev.matches || []).slice(), credits: (prev.credits || []).slice(), destructions: (prev.destructions || []).slice() };
    rep = dexAns.replace || {};
    Object.keys(rep).forEach(function (asset) {
      A = asset; sl = rep[A] || {};
      body.issuances = body.issuances.filter(function (x) { return x.asset !== A; });
      body.credits = body.credits.filter(function (x) { return x.asset !== A; });
      body.destructions = body.destructions.filter(function (x) { return x.asset !== A; });
      body.orders = body.orders.filter(function (o) { return o.give_asset !== A && o.get_asset !== A; });
      body.matches = body.matches.filter(function (m) { return m.forward_asset !== A && m.backward_asset !== A; });
      fill(body, sl);
    });
    return normalize ? normalize(body) : body;
  }
  function hashSet(seed, prev, add, needed, full) {
    var all = {}, miss = [], out = {}, i, b;
    function put(src) { if (!src) return; Object.keys(src).forEach(function (k) { all[k] = src[k]; }); }
    put(seed); if (!full) put(prev); put(add);
    for (i = 0; i < needed.length; i++) { b = needed[i]; if (!all[b]) miss.push(b); else out[b] = all[b]; }
    return { hashes: out, missing: miss };
  }
  /* Pure merge of one sync answer onto the page's current rows, hashes and dex. ok:false means use today's load(). */
  function mergeSync(prev, answer, ctx) {
    prev = prev || {}; ctx = ctx || {};
    if (!answer || answer.v !== 1 || answer.network !== 'mainnet' || answer.asset !== 'XCPETS') return { ok: false, reason: 'shape' };
    if (!(answer.tip > 0) || !answer.rows || !Array.isArray(answer.rows.list)) return { ok: false, reason: 'rows' };
    var mode = answer.mode || 'full', list = answer.rows.list, from = Number(answer.rows.from), rows, full = mode === 'full' || mode === 'reorg';
    if (!ordered(list)) return { ok: false, reason: 'order' };
    if (full || !(answer.since > 0)) {
      if (answer.rows.count != null && list.length !== Number(answer.rows.count)) return { ok: false, reason: 'count' };
      rows = list.slice();
    } else {
      var base = prev.rows || [];
      if (!base.length || !ordered(base)) return { ok: false, reason: 'base' };
      var i, k; for (k = 0; k < list.length; k++) if (list[k].block_index < from) return { ok: false, reason: 'from' };
      i = 0; while (i < base.length && base[i].block_index >= from) i++;
      rows = list.concat(base.slice(i));
      if (!ordered(rows)) return { ok: false, reason: 'order' };
      if (answer.rows.count != null && rows.length !== Number(answer.rows.count)) return { ok: false, reason: 'count' };
    }
    var gates = ctx.gates || {}, needed = neededBlocks(rows, answer.tip, gates);
    var hs = hashSet(ctx.seed || {}, prev.hashes, answer.hashes || {}, needed, full);
    if (hs.missing.length) return { ok: false, reason: 'hashes', missing: hs.missing };
    var dex = null;
    if (answer.dex) dex = mergeDex(full ? null : prev.dex, answer.dex, ctx.normalize);
    else if (!full) dex = prev.dex || null;
    return { ok: true, mode: mode, rows: rows, hashes: hs.hashes, tip: answer.tip, dex: dex, mempool: answer.mempool || [], needed: needed };
  }

  function gatesOf() { var V = window.V2Rules || {}; return { fire: V.ACTIVATE_FIRESALE_BLOCK != null ? V.ACTIVATE_FIRESALE_BLOCK : null, quest: V.questGate ? V.questGate() : null, raid: V.raidGate ? V.raidGate() : null }; }
  function normalize(d) { try { if (window.V2Sales && V2Sales.normalizeDex) return V2Sales.normalizeDex(d); } catch (e) {} return d; }
  function lagOk(answer, api) {
    var lag = Number(answer && answer.lag); if (!(lag >= 2)) return Promise.resolve(true);
    var read = api && api.chainTip ? api.chainTip() : Promise.resolve(0);
    return Promise.resolve(read).then(function (tip) { return !(tip > answer.tip); }, function () { return true; });
  }
  function applyState(api, merged, answer) {
    var S = api.state(), prevH = S.hashes, prevTip = S.tip;
    var hc = api.hashCache(); api.shallowDrop(hc, merged.tip);
    var ro = api.reorgAt(prevH, merged.hashes);
    if (merged.mode === 'reorg' || ro != null || (prevTip && merged.tip < prevTip)) {
      S.reorg = { at: ro, from: prevTip, to: merged.tip, when: Date.now() };
      try { console.warn('[xcpets] chain reorg / tip went back: block ' + (ro != null ? ro : merged.tip) + '; recent copies dropped'); } catch (e) {}
      api.dropShallow();
    }
    var fin = api.finalHashes(merged.hashes, merged.tip);
    Object.keys(fin).forEach(function (k) { hc[k] = fin[k]; });
    api.saveHashCache(hc);
    S.rows = merged.rows; S.hashes = merged.hashes; S.tip = merged.tip; S.dex = merged.dex || undefined; S.mempool = merged.mempool || [];
    S.feedTip = Math.max(S.feedTip || 0, merged.tip);
    if (answer.coreHeight) S.chainTip = Math.max(S.chainTip || 0, answer.coreHeight);
    S.lastRead = 'sync';
  }
  function shOf(api) { var S = api.state(), h = S.hashes && S.hashes[S.tip]; return h ? String(h).slice(0, 16) : ''; }
  function tryLoad(fallback, api) {
    if (!enabled() || !api) return null;
    if (api.step) api.step('Checking the latest chain data…');
    var bal = api.balanceRead ? api.balanceRead() : null;
    function fail() { noteFail(); return fallback(); }
    /* The published feed's burn rows are not byte-identical to a fresh Core read (tx_index can differ), so a delta
     * off that copy fails the check. One full sync is asked before today's multi-call path. */
    function ask(since) {
      var full = !since, ac = typeof AbortController !== 'undefined' ? new AbortController() : null, timer = null;
      var sh = !full ? shOf(api) : '';
      var url = base() + '/xp/v1/sync?since=' + (since || 0) + (sh ? '&sh=' + sh : '') + '&dt=' + (since || 0);
      if (ac) timer = setTimeout(function () { try { ac.abort(); } catch (e) {} }, full ? FULL_MS : DELTA_MS);
      return fetch(url, ac ? { cache: 'no-cache', signal: ac.signal } : { cache: 'no-cache' }).then(function (r) { if (timer) clearTimeout(timer); if (!r.ok) throw new Error('sync ' + r.status); return r.json(); }).then(function (answer) {
        return lagOk(answer, api).then(function (ok) { if (!ok) throw new Error('lag');
          var merged = mergeSync(api.state(), answer, { seed: api.seed(), gates: gatesOf(), normalize: normalize });
          if (!merged.ok) { var err = new Error(merged.reason || 'merge'); err.missingBlocks = merged.missing; err.retryFull = !full; throw err; }
          return sha256Text(checkText(merged.rows, merged.hashes, merged.dex)).then(function (hex) {
            if (!answer.check || hex !== answer.check) { var err = new Error('check'); err.retryFull = !full; throw err; }
            applyState(api, merged, answer); noteOk();
            return Promise.resolve(bal).then(function () { return api.finish(Date.now()); }, function () { return api.finish(Date.now()); });
          });
        });
      }, function (e) { if (timer) clearTimeout(timer); throw e; });
    }
    var since = api.state().tip || 0;
    return ask(since).then(undefined, function (e) { if (e && e.retryFull && since) return ask(0).then(undefined, fail); return fail(); });
  }

  function ruleUrls() { var all = Array.prototype.map.call(document.scripts || [], function (x) { return x.src || ''; }), out = [], i, j, f, hit;
    for (i = 0; i < RULE_SCRIPTS.length; i++) { f = RULE_SCRIPTS[i]; hit = null; for (j = 0; j < all.length; j++) { var u = all[j].split('?')[0]; if (u.slice(-f.length - 1) === '/' + f) { hit = all[j]; break; } } if (!hit) return null; out.push(hit); }
    var b = buildId(); if (!b) return null; out.push(new URL('js/v2-replay-worker.js?v=' + b, location.href).href); return out; }
  function dirOf(manifestUrl) { return String(manifestUrl || '').replace(/[^/]+$/, ''); }
  function seedFiles(man, dir) { var files = [{ url: dir + man.root.url, sha256: man.root.sha256, role: 'root' }];
    (man.files || []).forEach(function (f) { files.push({ url: dir + f.url, sha256: f.sha256, role: 'part', i: f.i }); }); return files; }
  function runWorker(files, key, n, parts, checkpoint) {
    return withBufs(files).then(function (ready) {
      return new Promise(function (res, rej) {
        var w, t, xfer = []; try { w = new Worker(new URL('js/v2-seed-worker.js?v=' + (buildId() || '0'), location.href).href); } catch (e) { return rej(e); }
        ready.forEach(function (f) { if (f.buf) xfer.push(f.buf); });
        t = setTimeout(function () { try { w.terminate(); } catch (e) {} rej(new Error('seed timeout')); }, SEED_MS);
        w.onmessage = function (ev) { clearTimeout(t); try { w.terminate(); } catch (e) {} var m = ev.data || {}; if (m.ok) res(m); else rej(new Error(m.error || 'seed')); };
        w.onerror = function () { clearTimeout(t); try { w.terminate(); } catch (e) {} rej(new Error('seed worker')); };
        w.postMessage({ cmd: 'seed', id: 1, files: ready, idbKey: key, parts: parts, n: n, checkpoint: checkpoint || null }, xfer);
      });
    });
  }
  function staleMax() { return (window.XcpResume && XcpResume.STALE_MAX) || 8; }
  function acceptManifest(man, api, rsig) {
    if (!man || man.v !== 1 || man.format !== 'ws2-json') return null;
    if (man.rsig !== rsig || man.ops !== '[]') return null;
    var S = api.state(), ops = JSON.stringify((S && S.ops) || []);
    if (ops !== '[]') return null;
    var behind = (S.tip || 0) - (man.tip || 0);
    var exact = behind === 0 && sameInputs(man.inSig, api.inSig());
    var catchup = !exact && behind > 0 && behind <= staleMax() && !!man.checkpoint;
    if (!exact && !catchup) return { exact: false, catchup: false, provisional: true };
    return { exact: exact, catchup: catchup, provisional: false, behind: behind };
  }
  function fetchManifest(api) {
    var pre = window.__xcpSnap;
    if (pre) {
      window.__xcpSnap = null;
      return Promise.resolve(pre).then(function (man) { if (man && man.v === 1 && man._url) return man; return fetchManifestNet(); }, fetchManifestNet);
    }
    return fetchManifestNet();
  }
  function fetchManifestNet() {
    return fetch(base() + '/xp/v1/world/latest.json', { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error('latest'); return r.json(); }).then(function (latest) {
      var path = latest && (latest.manifest || latest.url); if (!path) throw new Error('latest');
      var abs = /^https?:/.test(path) ? path : base() + path;
      return fetch(abs, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error('manifest'); return r.json(); }).then(function (man) { man._url = abs; return man; });
    });
  }
  function takeBuf(url) {
    var bag = window.__xcpFile, p = bag && bag[url];
    if (!p) return Promise.resolve(null);
    delete bag[url];
    return Promise.resolve(p).then(function (b) { return b && b.byteLength ? b : null; }, function () { return null; });
  }
  function withBufs(files) {
    return Promise.all(files.map(function (f) { return takeBuf(f.url).then(function (buf) { if (buf) f.buf = buf; return f; }); }));
  }
  function noteSeeded(api, later) {
    usedExact = true; window.V2BootSync.justSeeded = true; window.V2BootSync._seedPending = true;
    if (desktop()) { if (later) window.V2BootSync._recheck = function () { scheduleRecheck(api); }; else scheduleRecheck(api); }
  }
  function checkpointSpec(man, api) {
    if (!man.checkpoint || !man.checkpoint.root || !window.XcpResume || !XcpResume.checkpointMeta) return null;
    var S = api.state();
    return { parts: man.checkpoint.parts, n: man.checkpoint.n, meta: XcpResume.checkpointMeta({
      rows: S.rows, hashes: S.hashes, dex: S.dex || null, ops: S.ops || [], tip: S.tip, rsig: api.rsig ? api.rsig() : '',
      parts: man.checkpoint.parts, n: man.checkpoint.n }) };
  }
  function writeSnapshot(man, api, how, later) {
    var dir = dirOf(man._url), key = how.exact ? api.idbKey() : man.key, files = seedFiles(man, dir), spec = null;
    if (how.exact) { spec = checkpointSpec(man, api); if (spec) files = files.concat(catchFiles(man, dir).map(function (f) {
      return { url: f.url, sha256: f.sha256, role: f.role === 'root' ? 'cproot' : f.role === 'meta' ? 'cpmeta' : 'cppart', i: f.i }; })); }
    return runWorker(files, key, man.n, man.parts, spec).then(function () { if (how.exact) noteSeeded(api, later); return how; });
  }
  function catchFiles(man, dir) {
    var cp = man.checkpoint, files = [{ url: dir + cp.root.url, sha256: cp.root.sha256, role: 'root' }];
    (cp.files || []).forEach(function (f) { files.push({ url: dir + f.url, sha256: f.sha256, role: 'part', i: f.i }); });
    files.push({ url: dir + cp.meta.url, sha256: cp.meta.sha256, role: 'meta' });
    return files;
  }
  function runCatch(msg) {
    return withBufs(msg.files || []).then(function (files) {
      msg.files = files;
      return new Promise(function (res, rej) {
        var w, t, xfer = []; try { w = new Worker(new URL('js/v2-catchup-worker.js?v=' + (buildId() || '0'), location.href).href); } catch (e) { return rej(e); }
        files.forEach(function (f) { if (f.buf) xfer.push(f.buf); });
        t = setTimeout(function () { try { w.terminate(); } catch (e2) {} rej(new Error('catchup timeout')); }, SEED_MS);
        w.onmessage = function (ev) { clearTimeout(t); try { w.terminate(); } catch (e3) {} var m = ev.data || {}; if (m.ok) res(m); else rej(new Error(m.error || 'catchup')); };
        w.onerror = function () { clearTimeout(t); try { w.terminate(); } catch (e4) {} rej(new Error('catchup worker')); };
        w.postMessage(msg, xfer);
      });
    });
  }
  function catchUp(man, api) {
    var urls = ruleUrls(); if (!urls) return Promise.reject(new Error('rules'));
    var S = api.state();
    return runCatch({ cmd: 'catchup', id: 1, files: catchFiles(man, dirOf(man._url)), parts: man.checkpoint.parts, n: man.checkpoint.n,
      scripts: urls, rows: S.rows, hashes: S.hashes, dex: S.dex || null, ops: S.ops || [], tip: S.tip, baseTip: man.tip,
      rsig: api.rsig ? api.rsig() : '', idbKey: api.idbKey() });
  }
  function keyRsig(key) { var m = /^(r[0-9a-f]{32})\|/.exec(key || ''); return m ? m[1] : null; }
  function peekAndSeed(api) {
    function rowsReady(left) { var S = api.state(); if (S && S.rows && S.rows.length && S.tip) return Promise.resolve(); if (left <= 0) return Promise.resolve(); return new Promise(function (r) { setTimeout(r, 100); }).then(function () { return rowsReady(left - 1); }); }
    return Promise.resolve(api.peekWorld()).then(function (saved) {
      return Promise.resolve(api.rulesSig()).then(function (rsig) {
        if (!rsig || offFor(rsig)) return false;
        var exactKey = api.idbKey(), savedR = saved && keyRsig(saved.key);
        var empty = !saved || !saved.key, wrong = !!(savedR && savedR !== rsig);
        if (saved && saved.key === exactKey) return false;
        /* a return visit with this ruleset keeps its saved world on screen. A slow device also fetches a snapshot for the new tip without blocking that paint. */
        if (!empty && !wrong) {
          if (slowDevice()) rowsReady(200).then(function () { return fetchManifest(api).then(function (man) { var how = acceptManifest(man, api, rsig); if (how && how.exact && JSON.stringify(api.state().ops || []) === '[]') return writeSnapshot(man, api, how).then(function () { if (api.reread) return api.reread(); }); }); }, function () {});
          return false;
        }
        return rowsReady(200).then(function () { return fetchManifest(api).then(function (man) {
          var how = acceptManifest(man, api, rsig); if (!how || how.provisional) return false;
          if (!how.exact && !how.catchup && !empty && !wrong) return false;
          if (how.catchup) return catchUp(man, api).then(function () { noteSeeded(api, false); return true; });
          return writeSnapshot(man, api, how).then(function () { if (!how.exact) pollManifest(api, rsig); return true; });
        }); });
      });
    }, function (e) { logSeed(e); return false; });
  }
  function pollManifest(api, rsig) {
    if (pollT) return; var n = 0;
    pollT = setInterval(function () { n++; if (n > 12) { clearInterval(pollT); pollT = null; return; }
      if (api.storedKey && api.storedKey() === api.idbKey()) { clearInterval(pollT); pollT = null; return; }
      fetchManifest(api).then(function (man) { var how = acceptManifest(man, api, rsig); if (!how || !how.exact) return;
        if (api.stopReplay) api.stopReplay();
        return writeSnapshot(man, api, how).then(function () { clearInterval(pollT); pollT = null; if (api.reread) return api.reread(); });
      }, function () {});
    }, 10000);
  }
  /* First visit: read the chain, then store the matching snapshot, before the local rebuild starts. */
  function seedExact(api) {
    if (!api || !api.state().verified || localOnly() || saveData()) return Promise.resolve(false);
    if (JSON.stringify((api.state().ops) || []) !== '[]') return Promise.resolve(false);
    return Promise.resolve(api.rulesSig()).then(function (rsig) {
      if (!rsig || offFor(rsig)) return false;
      return Promise.resolve(api.peekWorld()).then(function (saved) {
        if (saved && saved.key === api.idbKey()) return false;
        return fetchManifest(api).then(function (man) {
          var how = acceptManifest(man, api, rsig);
          if (!how || how.provisional || (!how.exact && !how.catchup)) {
            try { console.warn('[xcpets] snapshot not used', JSON.stringify({ behind: (api.state().tip || 0) - (man.tip || 0), man: man.inSig, page: api.inSig(), manRsig: man.rsig, pageRsig: rsig, ops: man.ops, cp: !!man.checkpoint })); } catch (eL) {}
            return false;
          }
          var job = how.catchup ? catchUp(man, api).then(function () { noteSeeded(api, true); return true; }) : writeSnapshot(man, api, how, true).then(function () { return true; });
          return job;
        });
      });
    }).then(function (v) { return !!v; }, function (e) { logSeed(e); return false; });
  }
  function bootFirst(api, next) {
    if (!enabled() || !api || localOnly() || saveData()) return next();
    var p = tryLoad(function () { return Promise.resolve(); }, api);
    return Promise.resolve(p).then(function () { return seedExact(api); }, function () { return false; }).then(function () { return next(); }, function () { return next(); });
  }
  function arm(api) {
    if (!enabled() || !api || localOnly() || saveData()) return;
    var B = window.V2BootSync; B.ready = new Promise(function (res) {
      var t = setTimeout(function () { res(false); }, SEED_MS);
      peekAndSeed(api).then(function (v) { clearTimeout(t); res(!!v); }, function () { clearTimeout(t); res(false); });
    });
  }
  function scheduleRecheck(api) {
    function run() { if (!usedExact || localOnly()) return; var rsig = api.rsig && api.rsig(); if (!rsig || offFor(rsig)) return;
      try { if (localStorage.getItem(RECHECK_KEY) === rsig) return; } catch (e) {}
      recheck(api, rsig); }
    if (window.requestIdleCallback) requestIdleCallback(function () { run(); }, { timeout: 120000 }); else setTimeout(run, 20000);
  }
  function recheck(api, rsig) {
    var urls = ruleUrls(); if (!urls || typeof Worker === 'undefined') return;
    fetchManifest(api).then(function (man) {
      if (!man || man.rsig !== rsig || man.tip !== api.state().tip || !sameInputs(man.inSig, api.inSig())) return;
      recheckReplay(api, rsig, urls);
    }, function () {});
  }
  function recheckReplay(api, rsig, urls) {
    var S = api.state(), id = 1, w;
    try { w = new Worker(new URL('js/v2-resume-worker.js?v=' + (buildId() || '0'), location.href).href); } catch (e) { return; }
    var scripts = urls.slice(0, -1);
    w.onmessage = function (ev) { var m = ev.data || {}; if (!m.ok || !m.idb) { try { w.terminate(); } catch (e) {} return; }
      try { w.terminate(); } catch (e2) {}
      var sw; try { sw = new Worker(new URL('js/v2-seed-worker.js?v=' + (buildId() || '0'), location.href).href); } catch (e3) { return; }
      sw.onmessage = function (ev2) { var d = ev2.data || {}; try { sw.terminate(); } catch (e) {} if (!d.ok || !d.digest) return;
        fetchManifest(api).then(function (man) { if (!man || man.rsig !== rsig || man.tip !== api.state().tip || !sameInputs(man.inSig, api.inSig())) return; if (man.digest === d.digest) { try { localStorage.setItem(RECHECK_KEY, rsig); } catch (e) {} return; }
          try { localStorage.setItem(OFF_PREFIX + rsig, '1'); localStorage.setItem(RECHECK_KEY, rsig); console.warn('[xcpets] snapshot world did not match a local rebuild for ' + rsig + '; using this device\'s world and not the snapshot again'); } catch (e2) {}
          if (api.reread) api.reread();
        }, function () {}); };
      sw.postMessage({ cmd: 'digest', id: 2 });
    };
    w.onerror = function () { try { w.terminate(); } catch (e) {} };
    try { w.postMessage({ id: id, scripts: scripts, rows: S.rows, hashes: S.hashes, ops: [], tip: S.tip, dex: S.dex || undefined, idbKey: api.idbKey(), rsig: rsig }); } catch (e) { try { w.terminate(); } catch (e2) {} }
  }

  window.V2BootSync = { enabled: enabled, base: base, localOnly: localOnly, saveData: saveData, tryLoad: tryLoad, bootFirst: bootFirst, arm: arm, mergeSync: mergeSync, mergeDex: mergeDex, checkText: checkText, markValue: markValue, unmarkValue: unmarkValue, sameValue: sameValue, digestOf: digestOf, sha256Text: sha256Text, mempoolOf: mempoolOf, neededBlocks: neededBlocks, hashSet: hashSet, RULE_SCRIPTS: RULE_SCRIPTS, sameInputs: sameInputs, buildId: buildId, ruleUrls: ruleUrls, ready: null };
})();
