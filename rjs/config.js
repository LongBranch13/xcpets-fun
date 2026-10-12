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
  var NETWORKS = {
    mainnet: { read: ['https://api.xcp.fun/node/v2', 'https://api.counterparty.io:4000/v2', 'https://api.unspendablelabs.com:4000/v2'], compose: 'https://api.counterparty.io:4000/v2',
      composeList: ['https://api.counterparty.io:4000/v2', 'https://api.unspendablelabs.com:4000/v2'], // both verified 2026-10-11: compose destroy 200 + ACAO *; api.xcp.fun/node is read-only
      launch: 'https://api.xcp.fun/v2', siteBase: 'https://xcpets.fun', funSite: 'https://xcp.fun', art: 'https://xcp.fun/art/', mempool: 'https://mempool.space', mempoolApi: 'https://mempool.space/api',
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
    c.select = select; c.NETWORKS = NETWORKS;
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
