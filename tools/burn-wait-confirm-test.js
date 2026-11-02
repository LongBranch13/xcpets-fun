#!/usr/bin/env node
/* burn-wait-confirm-test (2026-10-26, PREVIEW): when the only usable coin is unconfirmed change, send() must stop with the wait note
 * (no inputs_set / allow_unconfirmed_inputs compose) unless allowUnconfirmedOnce() ('Try anyway'); a wallet error on a burn built on
 * unconfirmed change must turn into the same note; a plain user Cancel stays a cancel. */
'use strict';
const path = require('path'), BC = require('../rjs/burn-core.js'), WL = require('../rjs/wallet.js'), TXF = require('./lib/txfake.js');
const make = require(path.resolve(process.argv[2] || path.join(__dirname, '../js/v2-wallet.js')));
const ME = 'bc1ps9av86ymmlzy9zj3a8pn6g94pz4j5e0kagv3td3wutaagfjvekjs26m3s4', TAG = 'pet:hatch', AMT = 69;
let pass = 0, fail = 0; const chk = (m, c, x) => { if (c) { pass++; console.log('ok   ' + m); } else { fail++; console.log('FAIL ' + m + (x ? ' — ' + x : '')); } };
const good = q => ({ status: 200, json: () => Promise.resolve({ result: TXF.result('destroy', ME, { asset: 'XCPETS', quantity: +q.get('quantity'), tag: q.get('tag') }, { type: 110, bodyHex: TXF.destroyBody('XCPETS', +q.get('quantity'), q.get('tag')) }) }) });
const noCoin = () => ({ status: 200, json: () => Promise.resolve({ error: 'Insufficient BTC at address ' + ME + '. (Need approximately 0.00001 BTC)' }) });
function rig(sign) { const urls = [], calls = [], mem = {};
  const storage = { getItem: k => mem[k] == null ? null : mem[k], setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
  const win = { xcpwallet: { on() {}, request(a) { calls.push(a.method);
    if (a.method === 'xcp_requestAccounts') return Promise.resolve({ accounts: [ME] }); if (a.method === 'xcp_getNetwork') return Promise.resolve('mainnet');
    if (a.method === 'xcp_signTransaction') return sign(); return Promise.reject(new Error('test wallet: refused ' + a.method)); } }, addEventListener() {}, removeEventListener() {}, setTimeout, clearTimeout, sessionStorage: storage, location: { search: '' } };
  const fetch = u => { if (/fees\/recommended/.test(u)) return Promise.resolve({ status: 200, json: () => Promise.resolve({ hourFee: 3 }) });
    if (/compose\/destroy/.test(u)) { urls.push(u); const q = new URL(u).searchParams; return Promise.resolve(q.get('allow_unconfirmed_inputs') ? good(q) : noCoin()); } return Promise.resolve({ status: 404, json: () => Promise.resolve({}) }); };
  const CFG = { network: 'mainnet', asset: 'XCPETS', mempoolApi: 'https://mempool.space/api', compose: 'https://a.test/v2', composeList: ['https://a.test/v2', 'https://b.test/v2'], read: [] };
  global.window = win; const W = make({ Wallet: WL, BurnCore: BC, CFG, win, fetch, storage, backoffMs: 5, composeMs: 150, feeMs: 150, composeTotalMs: 3000 });
  return { W, urls, calls, run: () => W.send({ tag: TAG, amount: AMT, label: 'Crack One Open' }, ME).then(v => ({ s: 'ok', v }), e => ({ s: 'err', e })) };
}
const rej = (code, msg) => () => { const e = new Error(msg); e.code = code; return Promise.reject(e); };
(async () => {
  let r = rig(rej(4001, 'User rejected')), x = await r.run();
  chk('only unconfirmed coin -> wait note, nothing sent to XCP Wallet', x.s === 'err' && x.e.confirmNote && x.e.waitConfirm && !r.calls.includes('xcp_signTransaction'), x.s + ' ' + (x.e && x.e.message));
  chk('note text is exact', x.e && x.e.message === 'Your last burn is still confirming. Wait about one block (~10 min) and press Continue. Tip: keep a few separate small BTC coins to burn several times per block.');
  chk('no silent inputs_set / allow_unconfirmed_inputs compose', !r.urls.some(u => /allow_unconfirmed_inputs|inputs_set/.test(u)), r.urls.join(' | '));
  chk('errHtml renders the 8-bit note', /bwc-note/.test(r.W.errHtml(x.e)));
  chk('Continue re-checks (second press still waits while no confirmed coin)', (await r.run()).e.confirmNote === true);
  r.W.allowUnconfirmedOnce(); x = await r.run();
  chk('Try anyway -> composes with allow_unconfirmed_inputs and reaches XCP Wallet', r.urls.some(u => /allow_unconfirmed_inputs=true/.test(u)) && r.calls.includes('xcp_signTransaction'));
  chk('Try anyway + user Cancel stays a cancel (code 4001)', x.s === 'err' && x.e.code === 4001 && !x.e.confirmNote, x.e && x.e.message);
  chk('Try anyway is one-shot', (await r.run()).e.confirmNote === true);
  r = rig(rej(-32603, "Signing blocked: Couldn't verify asset status")); r.W.allowUnconfirmedOnce(); x = await r.run();
  chk('wallet error on unconfirmed-change burn -> same wait note', x.s === 'err' && x.e.confirmNote === true, x.e && x.e.message);
  console.log(pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
