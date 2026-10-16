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
  var BLOCK_APIS = CFG.read.slice().map(function (b) { return b + '/blocks/'; }).concat(['mempool:' + CFG.mempoolApi + '/block-height/']);
  var ASSET = CFG.asset;
  var READ_MS = 8000, FINAL_DEPTH = 6;
  /* Failover (2026-10-16, Jake approved): per-request timeouts PRIMARY_MS (first server) / BACKUP_MS (others); on HTTP 429/5xx, timeout or network
   * error go straight to the next server; after a full pass wait a short backoff (Retry-After honoured up to 2 s, else 400 ms) and try every server
   * once more; give up when the per-request DEADLINE_MS would be exceeded. A server that just timed out or failed is tried LAST for SICK_MS.
   * Only the order/timing of GETs changes: the same JSON is returned on success, so data and replays are identical. */
  var PRIMARY_MS = 6000, BACKUP_MS = 5000, DEADLINE_MS = 20000, BACKOFF_MS = 400, MAX_RETRY_AFTER_MS = 2000, SICK_MS = 30000, PASSES = 2, BLOCK_CONC = 6;
  var sick = {};
  function now() { return Date.now(); }
  function ordered(list) { var t = now(); return list.filter(function (b) { return !(sick[b] > t); }).concat(list.filter(function (b) { return sick[b] > t; })); }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function retryAfterMs(r) { var h = r && r.headers && r.headers.get ? r.headers.get('Retry-After') : null, n = h != null ? Number(h) : NaN; return isFinite(n) && n >= 0 ? Math.min(MAX_RETRY_AFTER_MS, n * 1000) : null; }
  /** failover(f, bases, path, parse, opts) -> Promise of parse(response) from the first server that answers OK (see Failover note above). */
  function failover(f, bases, path, parse, opts) {
    opts = opts || {}; var start = now(), deadline = start + (opts.deadline || DEADLINE_MS), errs = [], passes = opts.passes || PASSES, backoff = BACKOFF_MS;
    function pass(n) {
      var list = ordered(bases), i = 0;
      function next() {
        if (i >= list.length) { if (n + 1 >= passes) return Promise.reject(new Error('all APIs failed: ' + errs.join('; ')));
          var bo = Math.min(backoff, Math.max(0, deadline - now() - 500)); return wait(bo).then(function () { return pass(n + 1); }); }
        var base = list[i], first = i === 0 && n === 0, left = deadline - now(); i++;
        if (left < 500) return Promise.reject(new Error('all APIs failed (deadline): ' + errs.join('; ')));
        var url = typeof base === 'function' ? base(path) : base + path;
        return fetchT(f, url, Math.min(left, first ? (opts.primaryMs || PRIMARY_MS) : (opts.backupMs || BACKUP_MS))).then(function (r) {
          if (!r.ok) { var ra = retryAfterMs(r); if (ra != null) backoff = Math.max(backoff, ra); if (r.status === 429 || r.status >= 500) sick[base] = now() + SICK_MS; throw new Error(String(base).split('/v2')[0] + ' HTTP ' + r.status); }
          return parse(r, base); }).then(function (v) { delete sick[base]; return v; }, function (e) { errs.push(e && e.message || String(e)); if (/timed out|fetch|network/i.test(e && e.message || '')) sick[base] = now() + SICK_MS; return next(); });
      }
      return next();
    }
    return pass(0);
  }
  /** fetch with an AbortController timeout (no-op timeout where AbortController is missing, e.g. old Node) */
  function fetchT(f, url, ms) {
    var ac = typeof AbortController !== 'undefined' ? new AbortController() : null, t = ac ? setTimeout(function () { ac.abort(); }, ms) : null;
    return f(url, ac ? { method: 'GET', signal: ac.signal } : { method: 'GET' }).then(function (r) { if (t) clearTimeout(t); return r; }, function (e) { if (t) clearTimeout(t); throw (e && e.name === 'AbortError') ? new Error(url.split('/v2')[0] + ' timed out') : e; });
  }
  function Chain(fetchFn, apis) { this.f = fetchFn || (typeof fetch !== 'undefined' ? fetch.bind(self) : null); this.apis = apis || APIS; }
  Chain.prototype.getJson = function (path) {
    return failover(this.f, this.apis, path, function (r) { return r.json(); });
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
  Chain.prototype.blockHashes = function (blocks, cache, tip) {
    var self = this, out = {}, missing = [], q = blocks.slice(), k = 0;
    function one(b) { b = Number(b); var deep = tip != null && b <= tip - FINAL_DEPTH;
      return self.blockHash(b, deep ? cache : null).then(function (h) { if (h) { out[b] = h; if (deep && cache) cache[b] = h; } else missing.push(b); }); }
    function worker() { if (k >= q.length) return Promise.resolve(); return one(q[k++]).then(worker); } /* at most BLOCK_CONC lookups in flight (no 429 storm) */
    var ws = []; for (var j = 0; j < Math.min(BLOCK_CONC, q.length); j++) ws.push(worker());
    return Promise.all(ws).then(function () { return { hashes: out, missing: missing }; });
  };
  Chain.FINAL_DEPTH = FINAL_DEPTH; Chain.fetchT = fetchT; Chain.failover = failover; Chain._resetSick = function () { sick = {}; };
  Chain.TIMEOUTS = { PRIMARY_MS: PRIMARY_MS, BACKUP_MS: BACKUP_MS, DEADLINE_MS: DEADLINE_MS, BACKOFF_MS: BACKOFF_MS, MAX_RETRY_AFTER_MS: MAX_RETRY_AFTER_MS, SICK_MS: SICK_MS, PASSES: PASSES, BLOCK_CONC: BLOCK_CONC };
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
