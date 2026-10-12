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
  /** fetch with an AbortController timeout (no-op timeout where AbortController is missing, e.g. old Node) */
  function fetchT(f, url, ms) {
    var ac = typeof AbortController !== 'undefined' ? new AbortController() : null, t = ac ? setTimeout(function () { ac.abort(); }, ms) : null;
    return f(url, ac ? { method: 'GET', signal: ac.signal } : { method: 'GET' }).then(function (r) { if (t) clearTimeout(t); return r; }, function (e) { if (t) clearTimeout(t); throw (e && e.name === 'AbortError') ? new Error(url.split('/v2')[0] + ' timed out') : e; });
  }
  function Chain(fetchFn, apis) { this.f = fetchFn || (typeof fetch !== 'undefined' ? fetch.bind(self) : null); this.apis = apis || APIS; }
  Chain.prototype.getJson = function (path) {
    var self = this, i = 0, errs = [];
    function next() {
      if (i >= self.apis.length) return Promise.reject(new Error('all APIs failed: ' + errs.join('; ')));
      var base = self.apis[i++];
      return fetchT(self.f, base + path, READ_MS).then(function (r) { if (!r.ok) throw new Error(base + ' HTTP ' + r.status); return r.json(); })
        .catch(function (e) { errs.push(e.message); return next(); });
    }
    return next();
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
    var self = this, out = {}, missing = [];
    return Promise.all(blocks.map(function (b) { b = Number(b);
      var deep = tip != null && b <= tip - FINAL_DEPTH;
      return self.blockHash(b, deep ? cache : null).then(function (h) { if (h) { out[b] = h; if (deep && cache) cache[b] = h; } else missing.push(b); }); }))
      .then(function () { return { hashes: out, missing: missing }; });
  };
  Chain.FINAL_DEPTH = FINAL_DEPTH; Chain.fetchT = fetchT;
  Chain.prototype.blockHash = function (h, cache) {
    if (cache && cache[h]) return Promise.resolve(cache[h]);
    var self = this, i = 0;
    function next() {
      if (i >= BLOCK_APIS.length) return Promise.resolve(null);
      var b = BLOCK_APIS[i++], mp = b.indexOf('mempool:') === 0;
      return fetchT(self.f, (mp ? b.slice(8) : b) + h, READ_MS).then(function (r) { if (!r.ok) throw 0; return mp ? r.text() : r.json(); })
        .then(function (j) { var x = mp ? String(j).trim() : j.result && j.result.block_hash; if (!/^[0-9a-f]{64}$/.test(x || '')) throw 0; if (cache) cache[h] = x; return x; })
        .catch(next);
    }
    return next();
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
