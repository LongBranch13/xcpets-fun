/* XCPETS v2: LIVE environment for real inscriptions (2026-10-15). Network + APIs from rjs/config.js (XCPETS_CONFIG), chain replay from V2Mock (v2-chain.js),
 * wallet = XCP Wallet only (via V2Wallet.getWallet when present: same connect + network check as burns). No keys here. */
(function () {
  'use strict';
  var CFG = window.XCPETS_CONFIG, V = window.V2Rules, M = window.V2Mock, LE = window.LiveEngine; if (!CFG || !V || !M) return;
  try { if (sessionStorage.getItem('xcpets-inscribe') !== 'test') return; } catch (e) { return; } // TEST LINK only (?inscribe=test)
  var ACTIVATE_INSCRIBE_BLOCK = 971602; // first block scanned for XCPETS inscriptions (tip 971599 + 3 when real inscribing shipped)
  function waitXcp(ms) { return new Promise(function (res) { var t0 = Date.now(); (function p() { if (window.xcpwallet || Date.now() - t0 > ms) return res(window.xcpwallet || null); setTimeout(p, 150); })();
    try { window.dispatchEvent(new Event('xcp-wallet#discover')); } catch (e) {} }); }
  window.V2InscribeEnv = {
    network: CFG.network, mempoolApi: CFG.mempoolApi, explorer: CFG.mempool, ordinals: CFG.network === 'mainnet' ? 'https://ordinals.com' : null,
    cpRead: (CFG.read || []).slice(), fromBlock: CFG.network === 'mainnet' ? ACTIVATE_INSCRIBE_BLOCK : 0, label: CFG.network === 'mainnet' ? '' : CFG.network.toUpperCase(),
    fetch: function (u, o) { return window.fetch(u, o); },
    provider: function () { var W = window.V2Wallet; return (W && W.getWallet ? W.getWallet().then(function (w) { return w.w.p; }) : waitXcp(2000)).then(function (p) { if (!p) throw new Error('XCP Wallet not found. Install XCP Wallet, unlock it, then try again.'); return p; }); },
    addrOf: function (owner) { return owner; },
    tip: function () { return M.state().tip; },
    replayAt: function (b, ops) { var S = M.state(); return V.replay(S.rows.filter(function (r) { return r.block_index <= b; }), S.hashes, ops, { tip: b, live: LE && LE.RealCore }); }
  };
})();
