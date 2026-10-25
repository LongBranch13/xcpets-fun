/*!
 * XCPETS config.js — single network switch. Load BEFORE every other script.
 * Browser: ?network=testnet4|signet|mainnet (persisted in localStorage; ?network=mainnet resets), ?asset=NAME (testnets only).
 * Node: env XCPETS_NETWORK, XCPETS_ASSET (testnets). Exposes XCPETS_CONFIG (window) / module.exports.
 */
(function (root, factory) {
  var env = (typeof process !== 'undefined' && process.env) || {};
  if (typeof module === 'object' && module.exports) module.exports = factory(null, env);
  else root.XCPETS_CONFIG = factory(root, env);
})(typeof self !== 'undefined' ? self : this, function (win, env) {
  'use strict';
  var B58 = '[a-km-zA-HJ-NP-Z1-9]';
  // LAUNCH SWITCH: false = pre-launch owner gate on every real-game page; true = gate removed, robots/noindex opened.
  var LAUNCHED = true;
  var COUNTERPARTY_CORE = 'https://api.counterparty.io:4000/v2', CORE_BACKUP = 'https://api.unspendablelabs.com:4000/v2';
  var XCPFUN_API = 'https://api.xcp.fun/v2', XCPFUN_NODE_FALLBACK = 'https://api.xcp.fun/node/v2';
  var NETWORKS = {
    /* direct-counterparty-api (2026-10-25). Two kinds of outside API, kept apart on purpose:
     *  COUNTERPARTY_CORE: the documented Counterparty Core v2 API (https://apidocs.counterparty.io/). Every read of chain data (destructions,
     *    blocks, assets, balances, credits, orders, matches, mempool) and every compose goes here, directly, never through a proxy.
     *    CORE_BACKUP is a second public Core node with the same API.
     *  XCPFUN_API: xcp.fun's own features that are NOT Counterparty Core (the launch/sale record and the XCPETS candles). The only xcp.fun dependency.
     *  XCPFUN_NODE_FALLBACK: api.xcp.fun/node/v2 is an unpublished proxy of Core (same JSON). Used ONLY when both :4000 nodes fail with a
     *    timeout / network error (port 4000 is blocked on some networks), never because a node answered 429. Remove when Core is on 443. */
    mainnet: { read: [COUNTERPARTY_CORE, CORE_BACKUP], compose: COUNTERPARTY_CORE, coreFallback: null, /* core-no-proxy (2026-10-25, XCP Wallet dev): api.xcp.fun/node is just api.counterparty.io behind a rate-limit helper, never a Core fallback. Core is not on 443 (checked: 443 times out on both nodes), so the fallback is CORE_BACKUP, then a Retry message. */
      composeList: [COUNTERPARTY_CORE, CORE_BACKUP], // both verified 2026-10-11: compose destroy 200 + ACAO *; api.xcp.fun/node is read-only
      launch: XCPFUN_API, xcpfunApi: XCPFUN_API, siteBase: 'https://xcpets.fun', funSite: 'https://xcp.fun', art: 'https://xcp.fun/art/', mempool: 'https://mempool.space', mempoolApi: 'https://mempool.space/api',
      asset: 'XCPETS', burnAddr: '1CounterpartyXXXXXXXXXXXXXXXUWLpVr', hrp: 'bc', b58: '[13]', label: 'Bitcoin mainnet' },
    testnet4: { read: ['https://testnet4.counterparty.io:44000/v2'], compose: 'https://testnet4.counterparty.io:44000/v2',
      launch: null, funSite: null, art: null, mempool: 'https://mempool.space/testnet4', mempoolApi: 'https://mempool.space/testnet4/api',
      asset: 'XCPETS', burnAddr: 'mvCounterpartyXXXXXXXXXXXXXXW24Hef', hrp: 'tb', b58: '[mn2]', label: 'Bitcoin testnet4' },
    signet: { read: ['https://signet.counterparty.io:34000/v2'], compose: 'https://signet.counterparty.io:34000/v2',
      launch: null, funSite: null, art: null, mempool: 'https://mempool.space/signet', mempoolApi: 'https://mempool.space/signet/api',
      asset: 'XCPETS', burnAddr: 'mvCounterpartyXXXXXXXXXXXXXXW24Hef', hrp: 'tb', b58: '[mn2]', label: 'Bitcoin signet' }
  };
  var KEY = 'XCPETS_NETWORK';
  function pick(o) {
    o = o || {}; var net = o.network, asset = o.asset;
    if (!NETWORKS[net]) net = 'mainnet';
    var c = {}, base = NETWORKS[net], k;
    for (k in base) c[k] = Array.isArray(base[k]) ? base[k].slice() : base[k];
    c.network = net; c.isMainnet = net === 'mainnet'; c.launched = LAUNCHED;
    if (!c.isMainnet && asset && /^[A-Z][A-Z0-9.]{3,}$|^A[0-9]{17,20}$/.test(String(asset).toUpperCase())) c.asset = String(asset).toUpperCase();
    c.isAddress = function (a) {
      a = String(a || '').trim();
      return new RegExp('^' + c.b58 + B58 + '{25,34}$').test(a) || new RegExp('^' + c.hrp + '1q[02-9ac-hj-np-z]{38}([02-9ac-hj-np-z]{20})?$').test(a) ||
        new RegExp('^' + c.hrp + '1p[02-9ac-hj-np-z]{58}$').test(a);
    };
    c.taproot = function (a) { return String(a || '').indexOf(c.hrp + '1p') === 0; };
    c.coreFetch = function (path, ms) { return coreFetch(c, path, ms); }; c.select = select; c.NETWORKS = NETWORKS; c.COUNTERPARTY_CORE = COUNTERPARTY_CORE; c.CORE_BACKUP = CORE_BACKUP; c.XCPFUN_API = XCPFUN_API; c.XCPFUN_NODE_FALLBACK = XCPFUN_NODE_FALLBACK;
    return c;
  }
  /** Browser: read ?network / ?asset, persist. Returns the config. */
  function fromLocation(search, storage) {
    var q = new URLSearchParams(search || ''), net = q.get('network'), asset = q.get('asset');
    try {
      if (net === 'mainnet') { storage && storage.removeItem(KEY); storage && storage.removeItem(KEY + '_ASSET'); }
      else if (net && NETWORKS[net]) { storage && storage.setItem(KEY, net); if (asset) storage && storage.setItem(KEY + '_ASSET', asset); }
      if (!net) net = storage && storage.getItem(KEY);
      if (!asset) asset = storage && storage.getItem(KEY + '_ASSET');
    } catch (e) { /* storage blocked */ }
    return pick({ network: net, asset: asset });
  }
  /** coreFetch(cfg, path, ms) -> Promise<Response> for a Counterparty Core v2 GET (path starts with '/'). Direct Core nodes in order
   *  (cfg.read minus cfg.coreFallback); a node that answers at all (any HTTP status, 429 included) is final. Only when every direct node
   *  failed with a timeout / network error is the XCPFUN_NODE_FALLBACK proxy asked. Per-node timeout ms (default 3500). Read-only GETs. */
  function coreFetch(cfg, path, ms) { var core = cfg.read.filter(function (b) { return b !== cfg.coreFallback; }), fb = cfg.coreFallback;
    function one(base) { var ac = typeof AbortController !== 'undefined' ? new AbortController() : null, t = ac ? setTimeout(function () { ac.abort(); }, ms || 3500) : null;
      return fetch(base + path, ac ? { method: 'GET', signal: ac.signal } : { method: 'GET' }).then(function (r) { if (t) clearTimeout(t); return r; }, function (e) { if (t) clearTimeout(t); throw e; }); }
    var KEY = 'xcpets-api-netsick', ss = null; try { ss = typeof sessionStorage !== 'undefined' ? sessionStorage : null; } catch (e) { }
    function sick() { try { return (ss && JSON.parse(ss.getItem(KEY))) || {}; } catch (e) { return {}; } }
    function mark(b) { if (!ss) return; try { var o = sick(); o[b] = Date.now() + 10 * 60e3; ss.setItem(KEY, JSON.stringify(o)); } catch (e) { } }
    var t0 = Date.now(), s0 = sick(); core = core.filter(function (b) { return !(s0[b] > t0); }); /* remembered network failure: skip for 10 min (shared with chain.js) */
    function on(i) { if (i >= core.length) return fb ? one(fb) : Promise.reject(new Error('every Counterparty node failed')); return one(core[i]).catch(function () { mark(core[i]); return on(i + 1); }); }
    return on(0); }
  function select(network, asset) { return pick({ network: network, asset: asset }); }
  /** Adds a fixed TESTNET badge on non-mainnet networks. */
  function badge(cfg, doc) {
    if (cfg.isMainnet || !doc || !doc.body) return;
    var b = doc.createElement('div'); b.id = 'netBadge';
    b.textContent = cfg.network.toUpperCase() + ' · test coins only · asset ' + cfg.asset + ' · ';
    var a = doc.createElement('a'); a.href = '?network=mainnet'; a.textContent = 'switch to mainnet'; a.style.color = '#fff'; b.appendChild(a);
    b.setAttribute('style', 'position:sticky;top:0;z-index:9999;background:#c0392b;color:#fff;font:700 14px system-ui,sans-serif;text-align:center;padding:6px');
    doc.body.insertBefore(b, doc.body.firstChild);
  }
  var cfg = win ? fromLocation(win.location && win.location.search, win.localStorage) : pick({ network: env.XCPETS_NETWORK, asset: env.XCPETS_ASSET });
  cfg.fromLocation = fromLocation; cfg.badge = badge;
  if (win && win.document) {
    if (win.document.readyState === 'loading') win.document.addEventListener('DOMContentLoaded', function () { badge(cfg, win.document); });
    else badge(cfg, win.document);
  }
  return cfg;
});
