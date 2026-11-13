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
      '    SALE_DEX = opts.dex || null; var saleIx = salesOn(tip) ? dexIndex(SALE_DEX) : null; if (!opts._resume && salesOn(tip)) { w.listings = []; w.deeds = {}; } else if (opts._resume && salesOn(tip)) { if (!w.listings) w.listings = []; if (!w.deeds) w.deeds = {}; }\n' +
      '    if (!opts._resume) preRows.forEach(function (r) { playerSeen(w, (r.raw || r).source); });';
    var burnFrom = '    w.burnedBy = {}; w.questsOut = []; w.questFeed = []; preRows.forEach(function (r) { var x = r.raw || r, a = Number(r.amount != null ? r.amount : x.quantity / 1e8); if (a > 0) w.burnedBy[x.source] = (w.burnedBy[x.source] || 0) + a; });\n' +
      '    w.freeRolls = {}; w.overflowUsed = {}; w.mythicOwners = {}; w.founderSeen = {}; preRows.forEach(function (r) { w.founderSeen[r.raw ? r.raw.tx_hash : r.tx_hash] = 1; });\n' +
      '    ev.forEach(function (e) {';
    var burnTo = '    if (!opts._resume) { w.burnedBy = {}; w.questsOut = []; w.questFeed = []; preRows.forEach(function (r) { var x = r.raw || r, a = Number(r.amount != null ? r.amount : x.quantity / 1e8); if (a > 0) w.burnedBy[x.source] = (w.burnedBy[x.source] || 0) + a; });\n' +
      '    w.freeRolls = {}; w.overflowUsed = {}; w.mythicOwners = {}; w.founderSeen = {}; preRows.forEach(function (r) { w.founderSeen[r.raw ? r.raw.tx_hash : r.tx_hash] = 1; }); }\n' +
      '    if (opts._resume) { var __opFrom = opts._resume.opsFrom || 0; ev = ev.filter(function (e) { if (e.op) return e.i >= __opFrom; return e.b > opts._resume.tip; }); }\n' +
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

  function fnv(s) { var h = 0x811c9dc5, i; for (i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16); }
  function rowId(r) {
    r = r || {};
    return (r.block_index | 0) + '|' + (r.tx_index == null ? '' : r.tx_index) + '|' + (r.tx_hash || '') + '|' + (r.quantity == null ? '' : r.quantity) + '|' + (r.source || '') + '|' + (r.tag || '') + '|' + (r.status || '') + '|' + (r.asset || '');
  }
  /* Chain order, so a burn in a newer block is a suffix. A reorg that edits or inserts an older burn changes the prefix. */
  function rowIds(rows) {
    var a = [], i;
    for (i = 0; i < (rows ? rows.length : 0); i++) a.push(rowId(rows[i]));
    a.sort(function (x, y) {
      var xb = +x.split('|')[0], yb = +y.split('|')[0];
      if (xb !== yb) return xb - yb;
      var xt = x.split('|')[1], yt = y.split('|')[1];
      var xn = xt === '' ? 0 : +xt, yn = yt === '' ? 0 : +yt;
      if (xn !== yn) return xn - yn;
      return x < y ? -1 : x > y ? 1 : 0;
    });
    return a;
  }
  function hashIds(ids) { return fnv(ids.join('\n')); }
  function hashPrefix(hashes, tip) {
    var ks = Object.keys(hashes || {}).map(Number).filter(function (b) { return b <= tip; }).sort(function (a, b) { return a - b; }), s = '', i;
    for (i = 0; i < ks.length; i++) s += ks[i] + ':' + hashes[ks[i]] + ';';
    return fnv(s);
  }
  function blockOf(x) { if (!x || typeof x !== 'object') return null; var b = x.block_index != null ? x.block_index : x.block; return b == null || b === '' ? null : Number(b); }
  function dexPrefixHash(dex, tip) {
    if (!dex) return 'none';
    var keys = ['issuances', 'orders', 'matches', 'credits', 'destructions'], parts = [], ki;
    for (ki = 0; ki < keys.length; ki++) {
      var arr = dex[keys[ki]] || [], keep = [], i;
      for (i = 0; i < arr.length; i++) { var b = blockOf(arr[i]); if (b == null || b <= tip) keep.push(JSON.stringify(arr[i])); }
      keep.sort();
      parts.push(keys[ki] + ':' + keep.join(','));
    }
    return fnv(parts.join('\n'));
  }
  function opsHash(ops) { var s = '', i; for (i = 0; i < (ops ? ops.length : 0); i++) s += JSON.stringify(ops[i]) + '\n'; return fnv(s); }
  function checkpointMeta(spec) {
    spec = spec || {};
    var ids = rowIds(spec.rows || []), ops = spec.ops || [];
    return { v: 1, rsig: spec.rsig || '', tip: spec.tip, rowCount: ids.length, rowIdsHash: hashIds(ids),
      dexHash: dexPrefixHash(spec.dex, spec.tip), hashHash: hashPrefix(spec.hashes, spec.tip),
      opsCount: ops.length, opsHash: opsHash(ops), dexPos: spec.dexPos || 0, grand: spec.grand ? 1 : 0, parts: spec.parts || 0, n: spec.n || 0 };
  }
  /* prev is checkpoint meta. next is the page's current inputs. ok means a resume matches a full replay;
   * anything else (rules change, missing cache, reorg, removed burn) must replay from the start. */
  function canResume(prev, next) {
    if (!prev || prev.v !== 1 || !next) return { ok: false, reason: 'missing' };
    if (!prev.rsig || prev.rsig !== next.rsig) return { ok: false, reason: 'rules' };
    /* Burns at or before CUTOFF_BLOCK are imported by the live engine, not the v2 event loop.
     * A checkpoint from before that import is finished cannot be continued. 971500 is V2Rules.CUTOFF_BLOCK. */
    var cutoff = next.cutoff != null ? next.cutoff : 971500;
    if (!(prev.tip >= cutoff)) return { ok: false, reason: 'cutoff' };
    if (!(next.tip >= prev.tip)) return { ok: false, reason: 'tip' };
    var ids = rowIds(next.rows || []);
    if (ids.length < (prev.rowCount || 0)) return { ok: false, reason: 'removed' };
    if (hashIds(ids.slice(0, prev.rowCount || 0)) !== prev.rowIdsHash) return { ok: false, reason: 'reordered' };
    if (hashPrefix(next.hashes, prev.tip) !== prev.hashHash) return { ok: false, reason: 'reorg-hash' };
    if (dexPrefixHash(next.dex, prev.tip) !== prev.dexHash) return { ok: false, reason: 'dex' };
    var ops = next.ops || [], n = prev.opsCount || 0;
    if (n > ops.length) return { ok: false, reason: 'ops' };
    if (opsHash(ops.slice(0, n)) !== (prev.opsHash || opsHash([]))) return { ok: false, reason: 'ops' };
    return { ok: true, opsFrom: n, tailOnly: ids.length === (prev.rowCount || 0) };
  }

  return { STALE_MAX: STALE_MAX, patchRules: patchRules, wsDecode: wsDecode, behindOf: behindOf, staleOk: staleOk,
    fnv: fnv, rowIds: rowIds, hashIds: hashIds, hashPrefix: hashPrefix, dexPrefixHash: dexPrefixHash, opsHash: opsHash,
    checkpointMeta: checkpointMeta, canResume: canResume };
});
