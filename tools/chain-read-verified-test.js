#!/usr/bin/env node
/* chain-read-fix-1102 (Nov 2 2026): nav-cache-1102 (build 2deb6e7f13, 12:27 AM CT) wrote `...fullAt0 = r[0].fullAt; blocks = {};` in load(),
 * so `blocks` was an undeclared assignment in a 'use strict' file: every chain read threw "blocks is not defined", S.verified never became
 * true, and V2Wallet.send / sendDex (which wait for V2Mock.whenFresh) refused every burn and both Tokenize steps with "Could not reach the
 * Counterparty servers". This runs js/v2-chain.js's real load() in a vm with a fake chain (no network, nothing signed) and checks that a
 * full read and an incremental read both verify, and that whenFresh answers ok.   node tools/chain-read-verified-test.js [path/to/v2-chain.js] */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..'), FILE = process.argv[2] || path.join(ROOT, 'js/v2-chain.js'), src = fs.readFileSync(FILE, 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
function store() { const m = {}; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: k => { delete m[k]; } }; }
function harness() {
  const nodes = [], warns = [], reads = [];
  const el = () => { const e = { id: '', style: {}, textContent: '', className: '', children: [], classList: { add() {}, remove() {} }, setAttribute() {}, appendChild(c) { this.children.push(c); return c; }, querySelector: () => null, addEventListener() {}, remove() { const i = nodes.indexOf(e); if (i >= 0) nodes.splice(i, 1); }, set onclick(f) {} }; return e; };
  const rows = []; for (let i = 0; i < 30; i++) rows.push({ tx_index: 1000 - i, tx_hash: 't' + i, block_index: 200 - i, source: 'bc1qx', asset: 'XCPETS', quantity: 1e8, tag: '', status: 'valid' });
  class Chain { getJson(p) { reads.push(p); if (/mempool/.test(p)) return Promise.resolve({ result: [] }); return Promise.resolve({ result: rows.slice(), next_cursor: null, result_count: rows.length }); }
    tip() { return Promise.resolve(205); } balance() { return Promise.resolve(5e8); }
    blockHashes(list) { const h = {}; list.forEach(b => { h[b] = 'h' + b; }); return Promise.resolve({ hashes: h, missing: [] }); } }
  const win = { V2Rules: { replay: () => ({ pets: [], tip: 205 }), salesGate: () => null }, LiveEngine: { CFG: { isMainnet: true, asset: 'XCPETS' }, Chain, RealCore: {} }, XCPETS_BLOCK_HASHES: {}, addEventListener() {}, dispatchEvent() {} };
  const doc = { readyState: 'complete', currentScript: { src: 'https://x/js/v2-chain.js' }, scripts: [], getElementById: id => nodes.find(n => n.id === id) || null, querySelector: () => null, querySelectorAll: () => [], createElement: () => el(), activeElement: null,
    body: { insertBefore(n) { nodes.push(n); }, appendChild(n) { nodes.push(n); }, firstChild: null }, addEventListener() {} };
  const cons = Object.assign({}, console, { warn: (...a) => warns.push(a.join(' ')), log() {} });
  const ctx = { window: win, document: doc, localStorage: store(), sessionStorage: store(), location: { search: '', href: 'https://x/index.html', reload() {} }, Event: function (t) { this.type = t; }, URL, URLSearchParams, setTimeout, clearTimeout, setInterval: () => 0, clearInterval() {}, console: cons, Promise, fetch: () => Promise.reject(new Error('no network in this test')), navigator: {} };
  win.window = win; Object.assign(ctx, win); vm.createContext(ctx); vm.runInContext(src, ctx, { filename: 'v2-chain.js' });
  return { M: ctx.window.V2Mock || ctx.V2Mock, warns, reads };
}
(async () => {
  process.on('unhandledRejection', e => { console.log('FAIL unhandled', e && e.message); process.exit(1); });
  const { M, warns } = harness(); let booted = false, bootErr = null;
  try { M.boot(() => { booted = true; }); } catch (e) { bootErr = e; }
  await sleep(300);
  const S = M.state();
  ok(!bootErr, 'boot did not throw (' + (bootErr && bootErr.message) + ')');
  ok(!warns.some(w => /is not defined/.test(w)), 'no ReferenceError in the chain read (' + warns.filter(w => /not defined/.test(w)).join(' | ') + ')');
  ok(S.verified === true, 'a full chain read verifies (S.verified true; was false forever: "blocks is not defined")');
  ok(S.tip === 205 && S.rows.length === 30, 'read committed rows + tip (' + S.tip + ', ' + (S.rows || []).length + ')');
  ok(booted, 'page booted on the verified read');
  /* the burn / Tokenize safety check (V2Wallet.send and sendDex wait for this) answers ok */
  const r = await Promise.race([M.whenFresh(), sleep(3000).then(() => ({ timeout: true }))]);
  ok(r && r.ok === true, 'whenFresh ok after a good read (got ' + JSON.stringify(r) + ')');
  /* a second read (refresh / background re-read) also verifies */
  let e2 = null; await Promise.resolve(M.refresh && M.refresh()).catch(e => { e2 = e; }); await sleep(100);
  ok(!e2 && M.state().verified === true, 're-read verifies too (' + (e2 && e2.message) + ')');
  ok(!/fullAt0 = r\[0\]\.fullAt; blocks = \{\}/.test(src), 'source: blocks is declared with var, not assigned undeclared');
  console.log('chain-read-verified-test: ' + pass + ' pass, ' + fail + ' fail'); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL error', e && e.stack); process.exit(1); });
