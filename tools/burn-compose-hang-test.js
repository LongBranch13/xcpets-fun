#!/usr/bin/env node
/* burn-compose-hang-test (2026-10-24): "Feed all hungry pets" sat on "building pet:fl:..., then approve it in XCP Wallet" forever.
 * Drives js/v2-wallet.js send() with a fake fetch + a fake XCP Wallet that REJECTS every sign request (nothing is ever signed).
 * Every stall before the wallet window must end in a clear error; a good compose of the real pet:fl memo must reach xcp_signTransaction.
 * Run against another file: node tools/burn-compose-hang-test.js path/to/v2-wallet.js */
'use strict';
const path = require('path'), BC = require(process.env.BC ? path.resolve(process.env.BC) : '../rjs/burn-core.js'), WL = require('../rjs/wallet.js'), TXF = require('./lib/txfake.js');
const make = require(path.resolve(process.argv[2] || path.join(__dirname, '../js/v2-wallet.js')));
const ME = 'bc1ps9av86ymmlzy9zj3a8pn6g94pz4j5e0kagv3td3wutaagfjvekjs26m3s4', TAG = 'pet:fl:N04.N05.N0T.N24.N32', AMT = 10350;
let pass = 0, fail = 0; const chk = (m, c, x) => { if (c) { pass++; console.log('ok   ' + m); } else { fail++; console.log('FAIL ' + m + (x ? ' — ' + x : '')); } };
const never = () => new Promise(() => {});
const good = q => ({ status: 200, json: () => Promise.resolve({ result: TXF.result('destroy', ME, { asset: 'XCPETS', quantity: +q.get('quantity'), tag: q.get('tag') }, { type: 110, bodyHex: TXF.destroyBody('XCPETS', +q.get('quantity'), q.get('tag')) }) }) });
function rig(o) { const calls = [], phases = [], mem = {};
  const storage = { getItem: k => mem[k] == null ? null : mem[k], setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
  const win = { xcpwallet: { on() {}, request(a) { calls.push(a.method);
    if (a.method === 'xcp_requestAccounts') return Promise.resolve({ accounts: [ME] }); if (a.method === 'xcp_getNetwork') return Promise.resolve('mainnet');
    if (a.method === 'xcp_signTransaction') { const e = new Error('User rejected (test wallet never signs)'); e.code = 4001; return Promise.reject(e); }
    return Promise.reject(new Error('test wallet: refused ' + a.method)); } }, addEventListener() {}, removeEventListener() {}, setTimeout, clearTimeout, sessionStorage: storage, location: { search: '' } };
  const fetch = (u, init) => { if (/fees\/recommended/.test(u)) return o.fee ? o.fee() : Promise.resolve({ status: 200, json: () => Promise.resolve({ hourFee: 3 }) });
    if (/compose\/destroy/.test(u)) { const q = new URL(u).searchParams; return Promise.resolve(o.compose(q, init)); } return Promise.resolve({ status: 404, json: () => Promise.resolve({}) }); };
  const CFG = { network: 'mainnet', asset: 'XCPETS', mempoolApi: 'https://mempool.space/api', compose: 'https://a.test/v2', composeList: ['https://a.test/v2', 'https://b.test/v2'], read: [] };
  global.window = win; const W = make(Object.assign({ Wallet: WL, BurnCore: BC, CFG, win, fetch, storage, backoffMs: 5, composeMs: 150, feeMs: 150, composeTotalMs: 2000 }, o.deps || {}));
  return { W, calls, phases, run: () => W.send({ tag: TAG, amount: AMT, label: 'Feed all' }, ME, (a, b, ph) => phases.push(ph || 'node' + a)) };
}
function settle(p, ms) { return Promise.race([p.then(v => ({ s: 'ok', v }), e => ({ s: 'err', e })), new Promise(r => setTimeout(() => r({ s: 'HUNG' }), ms))]); }
(async () => {
  chk('real pet:fl memo passes the safety check', BC.checkComposeResult(good(new URLSearchParams({ quantity: BC.toRaw(String(AMT)), tag: TAG })).json && TXF.result('destroy', ME, { asset: 'XCPETS', quantity: +BC.toRaw(String(AMT)), tag: TAG }, { type: 110, bodyHex: TXF.destroyBody('XCPETS', +BC.toRaw(String(AMT)), TAG) }), { address: ME, quantityRaw: BC.toRaw(String(AMT)), tag: TAG, satPerVbyte: 3 }).ok);
  let r = rig({ compose: good }), x = await settle(r.run(), 3000);
  chk('good compose reaches XCP Wallet (test wallet rejects, nothing signed)', x.s === 'err' && x.e.code === 4001 && r.calls.includes('xcp_signTransaction'), x.s + ' ' + (x.e && x.e.message));
  r = rig({ compose: () => Promise.resolve({ status: 200, json: never }) }); x = await settle(r.run(), 5000);
  chk('compose reply body that never finishes -> clear error, no wallet window', x.s === 'err' && !r.calls.includes('xcp_signTransaction'), x.s + ' ' + (x.e && x.e.message));
  r = rig({ compose: (q, init) => new Promise((_, j) => { if (init && init.signal) init.signal.addEventListener('abort', () => { const e = new Error('aborted'); e.name = 'AbortError'; j(e); }); }) }); x = await settle(r.run(), 5000);
  chk('compose request that never answers -> clear error', x.s === 'err' && /every Counterparty node failed|Could not build/.test(x.e.message), x.s + ' ' + (x.e && x.e.message));
  r = rig({ compose: () => Promise.reject(new TypeError('Failed to fetch')) }); x = await settle(r.run(), 5000);
  chk('429 without CORS on every node -> clear error', x.s === 'err' && /Could not build/.test(x.e.message), x.s + ' ' + (x.e && x.e.message));
  r = rig({ compose: () => Promise.resolve({ status: 429, json: () => Promise.resolve({}) }) }); x = await settle(r.run(), 5000);
  chk('HTTP 429 on every node -> clear error naming the rate limit', x.s === 'err' && /429/.test(x.e.message), x.s + ' ' + (x.e && x.e.message));
  r = rig({ compose: q => good(q), fee: never }); x = await settle(r.run(), 5000);
  chk('fee-rate server that never answers -> burn still builds (fallback rate)', x.s === 'err' && x.e.code === 4001, x.s + ' ' + (x.e && x.e.message));
  r = rig({ compose: q => { const g = good(q); return { status: 200, json: () => g.json().then(j => { j.result.params.tag = 'pet:fl:N04'; return j; }) }; } }); x = await settle(r.run(), 5000);
  chk('safety-check mismatch -> error says the safety check stopped it, no wallet window', x.s === 'err' && /Safety check stopped/.test(x.e.message) && !r.calls.includes('xcp_signTransaction'), x.s + ' ' + (x.e && x.e.message));
  r = rig({ compose: () => new Promise(res => setTimeout(() => res({ status: 200, json: never }), 1)), deps: { composeMs: 100000, composeTotalMs: 300 } }); x = await settle(r.run(), 5000);
  chk('overall build deadline -> clear "nothing was signed" error', x.s === 'err' && /Nothing was signed or sent/.test(x.e.message), x.s + ' ' + (x.e && x.e.message));
  console.log('\n' + pass + ' passed, ' + fail + ' FAILED'); process.exit(fail ? 1 : 0);
})();
