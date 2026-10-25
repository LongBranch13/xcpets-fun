#!/usr/bin/env node
/* spam-city-tokenized-fix (Oct 25 2026): a pet tokenized from the pet page (or another browser) must be recognized by Spam City.
 * Repro = the real #36032 case: token A3693372141652311185 minted by its owner at block 973087 (desc t/36032.json), tie burn
 * pet:deed:36032:s26f5mi0zkwh at 973103, game data at 973099, empty localStorage. Before the fix the shop only read localStorage
 * ('xcpets-deed-pending') and offered "Window 1" (mint a second token). Mock API only; nothing is signed or sent.
 *   node tools/spam-city-tokenized-test.js */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const { load } = require('./lib/load-rules');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const V = load().V2Rules, ROOT = path.resolve(__dirname, '..');
const ME = 'bc1pfvkpmllr7mtn5uazqxumwp39h2ny3c8l6fmrgvjv2cqn5wlpt7hssf3gqd', ID = 36032, A = 'A3693372141652311185', OTHER = 'A15074732467967914927';
const hex = s => Buffer.from(s).toString('hex');
function sandbox(api) { const store = {}, calls = [];
  const localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  const fetch = url => { calls.push(url); const k = Object.keys(api).find(x => url.indexOf(x) >= 0); const j = k ? api[k] : null;
    return Promise.resolve({ ok: !!j, status: j ? 200 : 404, json: () => Promise.resolve(j || {}) }); };
  const el = () => ({ style: {}, classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {}, appendChild() {}, querySelectorAll: () => [], setAttribute() {} });
  const document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: el, addEventListener() {}, body: el(), dispatchEvent() {} };
  const win = { V2Rules: V, localStorage, fetch, document, location: { search: '', hash: '', href: 'https://xcpets.fun/shop.html' }, addEventListener() {}, setTimeout, clearTimeout, setInterval: () => 0, console, crypto: require('crypto').webcrypto, CustomEvent: function () {}, Uint8Array, Promise, JSON, Date, Math };
  win.window = win; win.self = win; const ctx = vm.createContext(win);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/v2-sales.js'), 'utf8'), ctx, { filename: 'v2-sales.js' });
  return { T: win.V2Sales.tok, store, calls }; }
const iss = (asset, id, b, src) => ({ result: [{ tx_hash: 'iss' + asset, block_index: b, source: src || ME, issuer: src || ME, asset, quantity: 1, divisible: false, locked: true, description: V.deedDesc(id), status: 'valid' }] });
const tag = V.deedPlan(ID, A).tag;
const api = {
  ['/addresses/' + ME + '/balances']: { result: [{ asset: OTHER, quantity: 1 }, { asset: A, quantity: 1 }, { asset: 'XCPETS', quantity: 4e14 }] },
  ['/assets/' + A + '/issuances']: iss(A, ID, 973087), ['/assets/' + OTHER + '/issuances']: iss(OTHER, 10609, 973101),
  '/assets/XCPETS/destructions': { result: [{ source: ME, tag: hex(tag), tx_hash: '15cd33324c60', block_index: 973103, status: 'valid', quantity: 1 }, { source: ME, tag: hex('pet:feed:35395'), tx_hash: 'd3b2', block_index: 973103, status: 'valid' }] } };
ok(tag === 'pet:deed:36032:s26f5mi0zkwh', 'tie tag matches the one on chain (' + tag + ')');
(async () => {
  { const { T } = sandbox(api); ok(typeof T.chainPend === 'function', 'V2Sales.tok.chainPend exported');
    ok(T.pend(ID) === null, 'empty localStorage = old code would show Window 1');
    const pd = await T.chainPend(ID, ME, { deeds: {} });
    ok(pd && pd.asset === A, 'token made on the pet page found from the chain: ' + (pd && pd.asset));
    ok(pd && pd.at === 973087 && pd.fromChain, 'mint block 973087 recorded');
    ok(pd && pd.tieTx === '15cd33324c60' && pd.tieBlock === 973103, 'tie burn at 973103 found (no second tie offered)');
    ok(T.pend(ID) && T.pend(ID).asset === A, 'saved to the shared pending store (pet page + shop)'); }
  { const a2 = Object.assign({}, api, { '/assets/XCPETS/destructions': { result: [] } }), { T } = sandbox(a2); const pd = await T.chainPend(ID, ME, { deeds: {} });
    ok(pd && pd.asset === A && !pd.tieTx, 'token made but not tied yet = step 2 (tie), not window 1'); }
  { const { T } = sandbox(api); const pd = await T.chainPend(ID, ME, { deeds: { [A]: { petId: 999 } } });
    ok(pd === null, 'a token already bound to a pet is not reused'); }
  { const a3 = Object.assign({}, api, { ['/assets/' + A + '/issuances']: iss(A, ID, 973087, 'bc1qsomeoneelse') }), { T } = sandbox(a3);
    ok((await T.chainPend(ID, ME, { deeds: {} })) === null, 'a token issued by another address is ignored'); }
  { const { T } = sandbox(api); ok((await T.chainPend(20149, ME, { deeds: {} })) === null, 'no token for another pet = none (window 1 is right)'); }
  { const { T } = sandbox(api); T.pend(ID, { petId: ID, asset: A, at: 973087, tieTx: 'abc' }); const pd = await T.chainPend(ID, ME, {}); ok(pd.tieTx === 'abc', 'local record kept as is'); }
  const src = fs.readFileSync(path.join(ROOT, 'js/v2-sales.js'), 'utf8');
  ok(!/walletBurn\(V\.deedPlan\(p\.id, pd\.asset\), function \(\) \{ pend\(p\.id, null\)/.test(src), 'Token Press no longer forgets the token right after the tie burn');
  ok(/viaChain\(p, function \(\) \{ press\(p\)/.test(src) && /viaChain\(p, function \(\) \{ sellPrice\(p/.test(src), 'Press + Sell screens check the chain first');
  console.log('spam-city-tokenized: ' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
