/* Catch-up from a snapshot that is a few blocks behind. The rule file on disk is not modified.
 * The builder and the catch-up worker eval a copy that can stop before the final tip pass and
 * resume from that point. A normal replay (no _resume / _beforeTail) is the same function. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.XcpResume = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  /* A build every 6 blocks finishes near the tip. 8 covers that gap plus a block that arrives while the build runs. */
  var STALE_MAX = 8;

  function patchRules(src) {
    var seenFrom = '    var seen = {};\n    if (preRows.length) importLive(w, eng.replay(preRows.map(function (r) { return r.raw; }), blockHashes, { tip: cut - 1 }), cut);';
    var seenTo = '    var seen = {};\n    if (opts._resume) {\n' +
      '      w = opts._resume.w; seen = opts._resume.seen || {};\n' +
      '      if (opts._resume.dexPos != null) { try { Object.defineProperty(w, \'_dexPos\', { value: opts._resume.dexPos, enumerable: false, writable: true, configurable: true }); } catch (xR) {} }\n' +
      '      if (opts._resume.grand) { try { Object.defineProperty(w, \'_grand\', { value: 1, enumerable: false, writable: true, configurable: true }); } catch (xG) { w._grand = 1; } }\n' +
      '      reindex(w); w.tip = tip;\n' +
      '    } else if (preRows.length) importLive(w, eng.replay(preRows.map(function (r) { return r.raw; }), blockHashes, { tip: cut - 1 }), cut);';
    var wipeFrom = '    w.wagmi = {}; w.wagmiFirst = {}; w.swaps = []; w.players = {}; w.playerList = []; w.giftLog = [];\n' +
      '    SALE_DEX = opts.dex || null; var saleIx = salesOn(tip) ? dexIndex(SALE_DEX) : null; if (salesOn(tip)) { w.listings = []; w.deeds = {}; }\n' +
      '    preRows.forEach(function (r) { playerSeen(w, (r.raw || r).source); });';
    var wipeTo = '    if (!opts._resume) { w.wagmi = {}; w.wagmiFirst = {}; w.swaps = []; w.players = {}; w.playerList = []; w.giftLog = []; }\n' +
      '    SALE_DEX = opts.dex || null; var saleIx = salesOn(tip) ? dexIndex(SALE_DEX) : null; if (!opts._resume && salesOn(tip)) { w.listings = []; w.deeds = {}; }\n' +
      '    if (!opts._resume) preRows.forEach(function (r) { playerSeen(w, (r.raw || r).source); });';
    var burnFrom = '    w.burnedBy = {}; w.questsOut = []; w.questFeed = []; preRows.forEach(function (r) { var x = r.raw || r, a = Number(r.amount != null ? r.amount : x.quantity / 1e8); if (a > 0) w.burnedBy[x.source] = (w.burnedBy[x.source] || 0) + a; });\n' +
      '    w.freeRolls = {}; w.overflowUsed = {}; w.mythicOwners = {}; w.founderSeen = {}; preRows.forEach(function (r) { w.founderSeen[r.raw ? r.raw.tx_hash : r.tx_hash] = 1; });\n' +
      '    ev.forEach(function (e) {';
    var burnTo = '    if (!opts._resume) { w.burnedBy = {}; w.questsOut = []; w.questFeed = []; preRows.forEach(function (r) { var x = r.raw || r, a = Number(r.amount != null ? r.amount : x.quantity / 1e8); if (a > 0) w.burnedBy[x.source] = (w.burnedBy[x.source] || 0) + a; });\n' +
      '    w.freeRolls = {}; w.overflowUsed = {}; w.mythicOwners = {}; w.founderSeen = {}; preRows.forEach(function (r) { w.founderSeen[r.raw ? r.raw.tx_hash : r.tx_hash] = 1; }); }\n' +
      '    if (opts._resume) ev = ev.filter(function (e) { return e.b > opts._resume.tip; });\n' +
      '    ev.forEach(function (e) {';
    var tailFrom = '    cemFlush(w, tip, true); if (saleIx) settleSales(w, tip, saleIx, true);';
    var tailTo = '    if (opts._beforeTail) opts._beforeTail(w, seen);\n    cemFlush(w, tip, true); if (saleIx) settleSales(w, tip, saleIx, true);';
    [[seenFrom, seenTo], [wipeFrom, wipeTo], [burnFrom, burnTo], [tailFrom, tailTo]].forEach(function (pair, i) {
      if (src.indexOf(pair[0]) < 0) throw new Error('resume patch missed piece ' + i);
      src = src.replace(pair[0], pair[1]);
    });
    return src;
  }

  /* Same restore js/v2-chain.js uses, synchronous for the catch-up worker. */
  function wsDecode(root, parts) {
    var T = [], i, j, M = '__wsr';
    for (i = 0; i < parts.length; i++) for (j = 0; j < parts[i].length; j++) T.push(parts[i][j]);
    function isP(o) { if (!o || typeof o !== 'object') return false; if (Array.isArray(o)) return true; var p = Object.getPrototypeOf(o); if (!p) return true; return Object.getPrototypeOf(p) === null; }
    function marker(val) { if (typeof val[M] !== 'number') return false; for (var p in val) if (p !== M) return false; return true; }
    function fix(o) { var st = [o], x, ks, n, a, val; while (st.length) { x = st.pop(); a = Array.isArray(x); ks = a ? null : Object.keys(x); n = a ? x.length : ks.length;
      for (var q = 0; q < n; q++) { var kk = a ? q : ks[q]; val = x[kk]; if (!isP(val)) continue; if (marker(val)) { var r = T[val[M]]; if (!r) throw new Error('ws ref'); x[kk] = r; } else st.push(val); } } }
    for (i = 0; i < T.length; i++) fix(T[i]);
    fix(root);
    return root;
  }

  function behindOf(pageTip, snapTip) { var n = pageTip - snapTip; return n > 0 ? n : 0; }
  function staleOk(behind) { return behind > 0 && behind <= STALE_MAX; }

  return { STALE_MAX: STALE_MAX, patchRules: patchRules, wsDecode: wsDecode, behindOf: behindOf, staleOk: staleOk };
});
