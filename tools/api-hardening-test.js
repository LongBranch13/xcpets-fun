#!/usr/bin/env node
/* api-hardening (2026-10-27): 6-block reorg rollback (browser hash cache, feed, burn tracker), Core 400/409/503 handling with the node's own
 * words, cursor paging that never loops or silently cuts a list short, and pet tokens attached to a UTXO. No network: every fetch is faked. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('ok   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const src = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
/* pull named top-level helper functions out of a browser IIFE (they are pure) */
function fns(file, names) { const s = src(file), out = [];
  for (const n of names) { const i = s.indexOf('function ' + n + '('); if (i < 0) throw new Error(n + ' not in ' + file); let d = 0, j = s.indexOf('{', i);
    for (; j < s.length; j++) { if (s[j] === '{') d++; else if (s[j] === '}' && --d === 0) break; } out.push(s.slice(i, j + 1)); }
  return vm.runInNewContext('(function(){' + out.join('\n') + ';return {' + names.join(',') + '};})()', { Number, Object, Error, String, JSON }); }
const mem = () => { const st = {}; return { getItem: k => (k in st ? st[k] : null), setItem: (k, v) => { st[k] = String(v); }, removeItem: k => { delete st[k]; } }; };
function rjs() { const w = { console, setTimeout, clearTimeout, AbortController, localStorage: mem(), sessionStorage: mem(), Promise, JSON, Date, Math, URLSearchParams, URL, location: { search: '', hostname: 'xcpets.fun', href: 'https://xcpets.fun/' }, navigator: { userAgent: 'node' } };
  w.self = w; w.window = w; const c = vm.createContext(w); ['rjs/config.js', 'rjs/chain.js', 'rjs/wallet.js'].forEach(f => vm.runInContext(src(f), c, { filename: f })); return c; }
const H = n => (n.toString(16) + 'a'.repeat(64)).slice(0, 64), H2 = n => (n.toString(16) + 'b'.repeat(64)).slice(0, 64);
(async () => {
  // 1) browser hash cache: only final (6+ deep) hashes saved; shallow ones dropped before each read; reorg detection
  { const C = fns('js/v2-chain.js', ['finalHashes', 'shallowDrop', 'reorgAt']), tip = 1000, h = {}; for (let b = 990; b <= tip; b++) h[b] = H(b);
    const f = C.finalHashes(h, tip); ok(Object.keys(f).length === 5 && f[994] && !f[995], 'finalHashes keeps blocks <= tip-6 only (990..994)');
    const hc = Object.assign({}, h), d = C.shallowDrop(hc, tip); ok(d.length === 6 && !hc[995] && !hc[1000] && hc[994], 'shallowDrop removes the 6 newest cached hashes (995..1000)');
    const hc2 = Object.assign({}, h), d2 = C.shallowDrop(hc2, 997); ok(hc2[991] && !hc2[992] && !hc2[1000] && d2.length === 9, 'shallowDrop also drops hashes above a tip that went back');
    const nh = Object.assign({}, h, { 998: H2(998), 999: H2(999) }); ok(C.reorgAt(h, nh) === 998, 'reorgAt finds the lowest changed block (998)');
    ok(C.reorgAt(h, Object.assign({}, h)) === null, 'reorgAt: same chain -> null (replay inputs unchanged)');
    const s = src('js/v2-chain.js'); ok(/localStorage\.setItem\(HKEY, JSON\.stringify\(keep\)\)/.test(s), 'applyStale saves only the final hashes from api/boot.json');
    ok(/shallowDrop\(hc, tip/.test(s) && /S\.reorg = /.test(s) && /sessionStorage\.removeItem\(SKEY\)/.test(s), 'load(): shallow hashes re-read; a reorg drops the session copy'); }
  // 2) feed: reorg vs the last boot.json drops the sale base
  { const F = require('./api-feed.js'), prev = { tip: 1000, hashes: {} }; for (let b = 990; b <= 1000; b++) prev.hashes[b] = H(b);
    ok(F.feedReorg(prev, Object.assign({}, prev.hashes), 1001) === null, 'feedReorg: same hashes, tip moved on -> no reorg');
    const r = F.feedReorg(prev, Object.assign({}, prev.hashes, { 999: H2(999), 1000: H2(1000) }), 1001); ok(r && r.at === 999 && r.depth === 2, 'feedReorg: blocks 999-1000 replaced -> reorg at 999, depth 2');
    const r2 = F.feedReorg(prev, Object.assign({}, prev.hashes), 998); ok(r2 && r2.back && r2.at === 999, 'feedReorg: tip went back -> rollback from 999');
    ok(F.feedReorg(prev, Object.assign({}, prev.hashes, { 990: H2(990) }), 1001) === null, 'feedReorg: a change deeper than 6 blocks is not the feed\'s call (final hashes are trusted)');
    ok(/prev && !ro \?/.test(src('tools/api-feed.js')), 'feed: a reorg forces a full sale re-read (no stale sale base)'); }
  const c = rjs(), Ch = c.Chain.Chain;
  // 3) Core error bodies: 400 stops at once with the node's words; 503/409 wait and retry
  { ok(/insufficient funds/.test(Ch.errNote(400, '{"error":"insufficient funds for XCPETS"}')), 'errNote reads the node\'s {"error"} text (400)');
    ok(/catching up/.test(Ch.errNote(503, '<html>busy</html>')), 'errNote 503: says node busy / catching up, ignores an HTML body');
    ok(/pending transaction conflicts/.test(Ch.errNote(409, '{"error":"tx already in mempool"}')), 'errNote 409: pending transaction conflict');
    const resp = (st, body) => ({ ok: st >= 200 && st < 300, status: st, headers: { get: () => null }, text: () => Promise.resolve(body), json: () => Promise.resolve(JSON.parse(body)) });
    let n = 0; const f400 = () => { n++; return Promise.resolve(resp(400, '{"error":"invalid asset name"}')); };
    Ch._resetSick(); const e = await Ch.failover(f400, ['http://a/v2', 'http://b/v2'], '/x', r => r.json(), {}).then(() => null, x => x);
    ok(e && e.status === 400 && /invalid asset name/.test(e.message), 'failover: all-400 -> one clear "rejected" error with the node reason');
    ok(n === 2, 'failover: all-400 is not asked again in a second pass (' + n + ' requests)');
    let m = 0; const f503 = () => { m++; return Promise.resolve(m === 1 ? resp(503, '{"error":"Counterparty not ready"}') : resp(200, '{"result":7}')); };
    Ch._resetSick(); const t0 = Date.now(), v = await Ch.failover(f503, ['http://a/v2'], '/x', r => r.json(), {}).then(x => x, x => x);
    ok(v && v.result === 7 && Date.now() - t0 >= 900, 'failover: 503 waits >= 1 s, then the retry succeeds (' + (Date.now() - t0) + ' ms)'); }
  // 4) cursor paging: a repeated cursor stops with an error, never loops; same answers on a normal list
  { const pages = { '': { result: [1, 2], next_cursor: 'c1' }, c1: { result: [3], next_cursor: 'c2' }, c2: { result: [4], next_cursor: null } };
    const fk = loop => url => { const cu = (url.match(/cursor=([^&]+)/) || [])[1] || ''; const j = loop && cu === 'c2' ? { result: [4], next_cursor: 'c1' } : pages[cu]; return Promise.resolve({ ok: true, status: 200, headers: { get: () => null }, json: () => Promise.resolve(j), text: () => Promise.resolve(JSON.stringify(j)) }); };
    const good = await new Ch(fk(false), ['http://a/v2']).destructions('XCPETS'); ok(good.length === 4, 'destructions: cursor paging returns the full list (4 rows)');
    const bad = await new Ch(fk(true), ['http://a/v2']).destructions('XCPETS').then(() => null, x => x); ok(bad && /repeated a page cursor/.test(bad.message), 'destructions: a repeated cursor fails instead of looping');
    const S = fns('js/v2-sales.js', ['nextCur']), seen = {}; ok(S.nextCur({ next_cursor: 'a' }, seen, 1, 5, 'x') === 'a', 'nextCur passes a new cursor on');
    let th = null; try { S.nextCur({ next_cursor: 'a' }, seen, 2, 5, 'x'); } catch (x) { th = x; } ok(th && /partial list not used/.test(th.message), 'nextCur: repeated cursor -> error, partial list not used');
    th = null; try { S.nextCur({ next_cursor: 'z' }, {}, 5, 5, 'x'); } catch (x) { th = x; } ok(th && /more than 5 pages/.test(th.message), 'nextCur: over the page cap -> error (was: list silently cut short)'); }
  // 5) burn tracker: a burn confirmed < 6 deep that a reorg dropped goes back to pending
  { const T = new c.Wallet.Tracker(mem(), 'k'); T.add({ txid: 'aa', status: 'confirmed', block: 998 }); T.add({ txid: 'bb', status: 'confirmed', block: 900 });
    let asked = []; await T.poll(id => { asked.push(id); return { confirmed: false, seen: false }; }, 1000);
    const L = T.list(), a = L.find(x => x.txid === 'aa'), b = L.find(x => x.txid === 'bb');
    ok(a.status === 'sent' && a.reorged === 998 && !a.block, 'tracker: burn in block 998 (2 deep) gone after a reorg -> back to pending');
    ok(b.status === 'confirmed' && asked.indexOf('bb') < 0, 'tracker: a burn 100 deep is final, not asked again');
    const T2 = new c.Wallet.Tracker(mem(), 'k2'); T2.add({ txid: 'cc', status: 'confirmed', block: 999 }); await T2.poll(() => ({ confirmed: true, block: 999, seen: true }), 1000);
    ok(T2.list()[0].status === 'confirmed', 'tracker: still confirmed -> unchanged');
    const T3 = new c.Wallet.Tracker(mem(), 'k3'); T3.add({ txid: 'dd', status: 'confirmed', block: 999 }); let q = 0; await T3.poll(() => { q++; return null; });
    ok(q === 0 && T3.list()[0].status === 'confirmed', 'tracker: old callers (no tip) keep the old behaviour'); }
  // 6) UTXO-attached pet tokens: holder = utxo_address; a send/sell of one stops before the wallet with a clear message
  { const W = fns('js/v2-wallet.js', ['petTokens']);
    ok(W.petTokens({ kind: 'send', asset: 'A12345678901234567' }).length === 1 && W.petTokens({ kind: 'send', asset: 'XCPETS' }).length === 0, 'petTokens: only numeric pet tokens are checked (not XCPETS)');
    ok(W.petTokens({ kind: 'mpma', assets: ['A12345678901234567', 'A12345678901234568'] }).length === 2 && W.petTokens({ give_asset: 'A12345678901234567' }).length === 1, 'petTokens: MPMA and sell orders too');
    const ws = src('js/v2-wallet.js'); ok(/function sendDex\(plan, viewed\) \{ return utxoCheck\(plan\)/.test(ws), 'sendDex looks for an attached token before the wallet window');
    ok(/h\.address \|\| h\.utxo_address/.test(src('js/v2-sales.js')) && /h\.address \|\| h\.utxo_address/.test(src('js/v2-gift.js')), 'token holder falls back to utxo_address (was null for an attached token)'); }
  console.log(pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL crashed: ' + (e && e.stack || e)); process.exit(1); });
