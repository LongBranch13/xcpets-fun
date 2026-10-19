/*!
 * XCPETS chain.js — READ-ONLY chain access with API fallback. GET requests only; never posts, signs or broadcasts.
 * CORS (checked 2026-10-11 with Origin: https://xcpets.fun): api.xcp.fun/node/v2 answers Access-Control-Allow-Origin: * ;
 * api.counterparty.io:4000 answered OPTIONS 204 with ACAO * but was slow/timeouts in testing.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../../js/config.js')); else root.Chain = factory(root.XCPETS_CONFIG);
})(typeof self !== 'undefined' ? self : this, function (CFG) {
  'use strict';
  // From config.js: mainnet = xcp.fun then counterparty.io; testnet4/signet = the official Counterparty node for that network.
  var APIS = CFG.read.slice();
  /* block-hash order (2026-10-16): first read API, then mempool.space (fast, CORS-friendly), then the remaining Counterparty APIs (api.counterparty.io:4000 often times out, which browsers report as a CORS error) */
  /* 2026-10-19 (family-tree-fix): blockstream.info added as a second plain-text backup on mainnet (CORS *, same answer format as mempool.space). */
  /* smooth-perf (2026-10-19): mempool.space first, then the primary read API. Block hashes are the same 64-hex values from every source; this only keeps
   * hash lookups off api.xcp.fun, which rate-limits us (429). */
  var BLOCK_APIS = ['mempool:' + CFG.mempoolApi + '/block-height/'].concat(CFG.read.slice(0, 1).map(function (b) { return b + '/blocks/'; }))
    .concat(CFG.network === 'mainnet' ? ['mempool:https://blockstream.info/api/block-height/'] : []).concat(CFG.read.slice(1).map(function (b) { return b + '/blocks/'; }));
  var ASSET = CFG.asset;
  var READ_MS = 8000, FINAL_DEPTH = 6;
  /* Failover (2026-10-16, Jake approved): per-request timeouts PRIMARY_MS (first server) / BACKUP_MS (others); on HTTP 429/5xx, timeout or network
   * error go straight to the next server; after a full pass wait a short backoff (Retry-After honoured up to 2 s, else 400 ms) and try every server
   * once more; give up when the per-request DEADLINE_MS would be exceeded. A server that just timed out or failed is tried LAST for SICK_MS.
   * Only the order/timing of GETs changes: the same JSON is returned on success, so data and replays are identical. */
  /* smooth-perf (owner approved 2026-10-19): fail fast. A load once took 41 s when api.xcp.fun answered 429 and the two :4000 backups each ran into a
   * 5 s timeout one after the other. Now the first healthy server is tried alone (PRIMARY_MS 5 s); if it fails (429/5xx/timeout/network), ALL the
   * other servers are asked AT THE SAME TIME (BACKUP_MS 3 s each) and the first good answer wins (the others are aborted). After a failed pass, wait
   * the short backoff (Retry-After honoured up to 2 s) and do one more pass, inside DEADLINE_MS (12 s). Servers that failed are remembered as sick
   * for SICK_MS in sessionStorage too, so the next page in this tab starts with a healthy one. Only the order/timing of GETs changes: the JSON returned
   * on success is the same, so data and replays are identical. (Not done, owner decision: falling back to the last known chain height when the tip
   * read fails; tip is a replay input.) */
  var PRIMARY_MS = 5000, BACKUP_MS = 3000, DEADLINE_MS = 12000, BACKOFF_MS = 400, MAX_RETRY_AFTER_MS = 2000, SICK_MS = 30000, PASSES = 2, BLOCK_CONC = 6;
  var SICK_KEY = 'xcpets-api-sick', sick = (function () { try { var o = JSON.parse(sessionStorage.getItem(SICK_KEY)) || {}, t = Date.now(), r = {}; Object.keys(o).forEach(function (k) { if (o[k] > t) r[k] = o[k]; }); return r; } catch (e) { return {}; } })();
  function saveSick() { try { sessionStorage.setItem(SICK_KEY, JSON.stringify(sick)); } catch (e) {} }
  function setSick(b) { sick[String(b)] = now() + SICK_MS; saveSick(); }
  function clearSick(b) { if (sick[String(b)]) { delete sick[String(b)]; saveSick(); } }
  function now() { return Date.now(); }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function retryAfterMs(r) { var h = r && r.headers && r.headers.get ? r.headers.get('Retry-After') : null, n = h != null ? Number(h) : NaN; return isFinite(n) && n >= 0 ? Math.min(MAX_RETRY_AFTER_MS, n * 1000) : null; }
  /** failover(f, bases, path, parse, opts) -> Promise of parse(response) from the first server that answers OK (see the notes above). */
  function failover(f, bases, path, parse, opts) {
    opts = opts || {}; var start = now(), deadline = start + (opts.deadline || DEADLINE_MS), errs = [], passes = opts.passes || PASSES, backoff = BACKOFF_MS;
    function attempt(base, ms, ac) {
      var url = typeof base === 'function' ? base(path) : base + path;
      return fetchT(f, url, ms, ac).then(function (r) {
        if (!r.ok) { var ra = retryAfterMs(r); if (ra != null) backoff = Math.max(backoff, ra); if (r.status === 429 || r.status >= 500) setSick(base); throw new Error(String(base).split('/v2')[0] + ' HTTP ' + r.status); }
        return parse(r, base); }).then(function (v) { clearSick(base); return v; }, function (e) { var m = e && e.message || String(e); if (!(ac && ac.signal && ac.signal.aborted && ac.won)) { errs.push(m); if (/timed out|fetch|network/i.test(m)) setSick(base); } throw e; });
    }
    function race(list, ms) { /* every server in `list` at once; first good answer wins, the rest are aborted */
      return new Promise(function (res, rej) { var left = list.length, done = false, acs = [];
        list.forEach(function (base) { var ac = typeof AbortController !== 'undefined' ? new AbortController() : null; acs.push(ac);
          attempt(base, ms, ac).then(function (v) { if (done) return; done = true; acs.forEach(function (a) { if (a && a !== ac) { a.won = true; try { a.abort(); } catch (e) {} } }); res(v); },
            function () { if (--left === 0 && !done) { done = true; rej(new Error('pass failed')); } }); }); }); }
    function pass(n) {
      var t = now(), healthy = bases.filter(function (b) { return !(sick[String(b)] > t); }), list = healthy.length ? healthy : bases.slice(), left = deadline - t;
      if (left < 500) return Promise.reject(new Error('all APIs failed (deadline): ' + errs.join('; ')));
      /* the primary (first configured server) is tried alone while it is healthy; otherwise every healthy server is asked at once */
      var step = list[0] === bases[0] ? attempt(list[0], Math.min(left, n === 0 ? (opts.primaryMs || PRIMARY_MS) : (opts.backupMs || BACKUP_MS))).catch(function () {
          var rest = list.slice(1), l2 = deadline - now(); if (!rest.length || l2 < 500) throw new Error('pass failed'); return race(rest, Math.min(l2, opts.backupMs || BACKUP_MS)); })
        : race(list, Math.min(left, opts.backupMs || BACKUP_MS));
      return step.catch(function () { if (n + 1 >= passes) throw new Error('all APIs failed: ' + errs.join('; '));
        var bo = Math.min(backoff, Math.max(0, deadline - now() - 500)); return wait(bo).then(function () { return pass(n + 1); }); });
    }
    return pass(0);
  }
  /** fetch with an AbortController timeout (no-op timeout where AbortController is missing, e.g. old Node); `ac` = optional caller controller */
  function fetchT(f, url, ms, ac) {
    ac = ac || (typeof AbortController !== 'undefined' ? new AbortController() : null); var t = ac ? setTimeout(function () { ac.abort(); }, ms) : null;
    return f(url, ac ? { method: 'GET', signal: ac.signal } : { method: 'GET' }).then(function (r) { if (t) clearTimeout(t); return r; }, function (e) { if (t) clearTimeout(t); throw (e && e.name === 'AbortError') ? new Error(url.split('/v2')[0] + (ac && ac.won ? ' cancelled' : ' timed out')) : e; });
  }
  function Chain(fetchFn, apis) { this.f = fetchFn || (typeof fetch !== 'undefined' ? fetch.bind(self) : null); this.apis = apis || APIS; }
  /* smooth-perf (2026-10-19): chain pages start their first three reads (burns, tip, mempool) from a tiny inline <head> script (window.__xcpPre,
   * url -> fetch promise) while the page's scripts are still downloading. getJson takes such an early answer once, if it is OK and arrives within
   * PRIMARY_MS; anything else (429, error, slow) falls through to the normal failover. Same URL, same JSON. */
  function takePre(url) { try { var P = typeof window !== 'undefined' && window.__xcpPre, p = P && P[url]; if (p) delete P[url]; return p || null; } catch (e) { return null; } }
  Chain.prototype.getJson = function (path) {
    var self = this, base = this.apis[0], pre = typeof base === 'string' ? takePre(base + path) : null, go = function () { return failover(self.f, self.apis, path, function (r) { return r.json(); }); };
    if (!pre) return go();
    return Promise.race([pre, wait(PRIMARY_MS).then(function () { return null; })]).then(function (r) {
      if (r && r.ok) return r.json().then(function (j) { clearSick(base); return j; }, go);
      if (r && (r.status === 429 || r.status >= 500)) setSick(base);
      return go(); }, go);
  };
  /** All XCPETS destructions, following next_cursor. */
  Chain.prototype.destructions = function (asset) {
    var self = this, rows = [];
    function page(cursor) {
      return self.getJson('/assets/' + (asset || ASSET) + '/destructions?limit=1000' + (cursor != null ? '&cursor=' + cursor : '')).then(function (j) {
        rows = rows.concat(j.result || []);
        return j.next_cursor != null && (j.result || []).length ? page(j.next_cursor) : rows;
      });
    }
    return page(null);
  };
  Chain.prototype.balance = function (addr, asset) {
    return this.getJson('/addresses/' + addr + '/balances/' + (asset || ASSET)).then(function (j) {
      var r = j.result; if (Array.isArray(r)) r = r[0]; return r ? String(r.quantity) : '0';
    });
  };
  Chain.prototype.tip = function () { return this.getJson('/').then(function (j) { return (j.result && (j.result.counterparty_height || j.result.last_block && j.result.last_block.block_index)) || null; }); };
  /** block_index -> block_hash; cache is a plain object (hashes are final once deep enough; see plan §reorgs). */
  /** blockHashes(blockList, cache, tip) -> {hashes, missing}. Only hashes at least FINAL_DEPTH below tip are written to the (persisted) cache. */
  /* 2026-10-19 (family-tree-fix): a block whose hash lookup failed is no longer given up after one round. Missing blocks are retried in up to
   * HASH_RETRY_ROUNDS more rounds, waiting HASH_RETRY_WAIT_MS[i] before each (backoff), every round again across ALL block sources (primary node,
   * mempool.space, blockstream.info, the backup Counterparty nodes). Whatever is still missing is returned in `missing`; the caller
   * (js/v2-chain.js) must not replay without it. onRetry(round, missingList) is an optional progress callback. Hashes themselves are unchanged. */
  var HASH_RETRY_ROUNDS = 3, HASH_RETRY_WAIT_MS = [1000, 2500, 5000];
  Chain.prototype.blockHashes = function (blocks, cache, tip, onRetry) {
    var self = this, out = {};
    function round(list) { var missing = [], q = list.slice(), k = 0;
      function one(b) { b = Number(b); var deep = tip != null && b <= tip - FINAL_DEPTH;
        /* smooth-perf: a hash already in the cache is used even when the tip read failed (tip null). The cache only ever holds final hashes
         * (written at FINAL_DEPTH or more, or shipped in js/block-hashes.js), so the value is the one a fresh lookup would give. */
        if (cache && cache[b]) { out[b] = cache[b]; return Promise.resolve(); }
        return self.blockHash(b, deep ? cache : null).then(function (h) { if (h) { out[b] = h; if (deep && cache) cache[b] = h; } else missing.push(b); }); }
      function worker() { if (k >= q.length) return Promise.resolve(); return one(q[k++]).then(worker); } /* at most BLOCK_CONC lookups in flight (no 429 storm) */
      var ws = []; for (var j = 0; j < Math.min(BLOCK_CONC, q.length); j++) ws.push(worker());
      return Promise.all(ws).then(function () { return missing.sort(function (a, b) { return a - b; }); }); }
    function again(missing, n) {
      if (!missing.length || n >= HASH_RETRY_ROUNDS) return Promise.resolve({ hashes: out, missing: missing });
      if (onRetry) try { onRetry(n + 1, missing); } catch (e) {}
      return wait(HASH_RETRY_WAIT_MS[n] || 5000).then(function () { return round(missing); }).then(function (m) { return again(m, n + 1); });
    }
    return round(blocks).then(function (m) { return again(m, 0); });
  };
  Chain.FINAL_DEPTH = FINAL_DEPTH; Chain.fetchT = fetchT; Chain.failover = failover; Chain._resetSick = function () { sick = {}; };
  Chain.TIMEOUTS = { HASH_RETRY_ROUNDS: HASH_RETRY_ROUNDS, HASH_RETRY_WAIT_MS: HASH_RETRY_WAIT_MS, PRIMARY_MS: PRIMARY_MS, BACKUP_MS: BACKUP_MS, DEADLINE_MS: DEADLINE_MS, BACKOFF_MS: BACKOFF_MS, MAX_RETRY_AFTER_MS: MAX_RETRY_AFTER_MS, SICK_MS: SICK_MS, PASSES: PASSES, BLOCK_CONC: BLOCK_CONC };
  Chain.prototype.blockHash = function (h, cache) {
    if (cache && cache[h]) return Promise.resolve(cache[h]);
    var bases = BLOCK_APIS.map(function (b) { var mp = b.indexOf('mempool:') === 0, u = mp ? b.slice(8) : b, fn = function (p) { return u + p; }; fn.mp = mp; fn.toString = function () { return u; }; return fn; });
    return failover(this.f, bases, String(h), function (r, base) { return (base.mp ? r.text() : r.json()).then(function (j) {
        var x = base.mp ? String(j).trim() : j && j.result && j.result.block_hash; if (!/^[0-9a-f]{64}$/.test(x || '')) throw new Error('bad block hash'); if (cache) cache[h] = x; return x; }); }, { deadline: 12000 })
      .catch(function () { return null; });
  };
  /** txStatus(txid) -> {confirmed, block, seen}: confirmed = the Counterparty node has parsed it in a block (so replay includes it). */
  Chain.prototype.txStatus = function (txid) {
    var self = this;
    return this.getJson('/transactions/' + txid).then(function (j) {
      var r = j && j.result; if (r && r.block_index > 0 && r.confirmed !== false) return { confirmed: true, block: r.block_index, seen: true };
      throw 0;
    }).catch(function () {
      return self.f(CFG.mempoolApi + '/tx/' + txid + '/status', { method: 'GET' }).then(function (r) { return r.ok ? r.json() : null; })
        .then(function (s) { return s ? { confirmed: false, seen: true, btcConfirmed: !!s.confirmed } : null; }).catch(function () { return null; });
    });
  };
  return { Chain: Chain, APIS: APIS, BLOCK_APIS: BLOCK_APIS, ASSET: ASSET, network: CFG.network };
});
