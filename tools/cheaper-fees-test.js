#!/usr/bin/env node
/* cheaper-fees-test (owner Oct 27 2026, "cheaper fees asap"): js/v2-wallet.js reads mempool.space /v1/fees/precise (decimals), falls back to
 * /v1/fees/recommended, then to 2 sat/vB; floor 0.1 sat/vB, no rounding up to 1; default = economy (or the precise hour rate if lower and sane).
 * A burn is composed with the decimal sat_per_vbyte and the chosen rate + composed fee reach the caller (or a toast) before the wallet window.
 * Fake fetch + a fake XCP Wallet that REJECTS every sign request: nothing is ever signed or sent. */
'use strict';
const path = require('path'), BC = require('../rjs/burn-core.js'), WL = require('../rjs/wallet.js'), TXF = require('./lib/txfake.js');
const make = require(path.resolve(process.argv[2] || path.join(__dirname, '../js/v2-wallet.js')));
const ME = 'bc1ps9av86ymmlzy9zj3a8pn6g94pz4j5e0kagv3td3wutaagfjvekjs26m3s4', TAG = 'pet:hatch', AMT = 69;
let pass = 0, fail = 0; const chk = (m, c, x) => { if (c) { pass++; console.log('ok   ' + m); } else { fail++; console.log('FAIL ' + m + (x ? ' — ' + x : '')); } };
const J = (o, st) => Promise.resolve({ status: st || 200, json: () => Promise.resolve(o) });
function rig(o) { const calls = [], urls = [], toasts = [], mem = {};
  const storage = { getItem: k => mem[k] == null ? null : mem[k], setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
  const toastBox = { appendChild(x) { toasts.push(x.textContent); } };
  const document = { getElementById: id => id === 'toasts' ? toastBox : null, createElement: () => ({ setAttribute() {}, textContent: '' }) };
  const win = { document, xcpwallet: { on() {}, request(a) { calls.push(a.method);
    if (a.method === 'xcp_requestAccounts') return Promise.resolve({ accounts: [ME] }); if (a.method === 'xcp_getNetwork') return Promise.resolve('mainnet');
    if (a.method === 'xcp_signTransaction') { const e = new Error('User rejected (test wallet never signs)'); e.code = 4001; return Promise.reject(e); }
    return Promise.reject(new Error('test wallet: refused ' + a.method)); } }, addEventListener() {}, removeEventListener() {}, setTimeout, clearTimeout, sessionStorage: storage, location: { search: '' } };
  const fetch = (u) => { urls.push(u);
    if (/fees\/precise/.test(u)) return o.precise ? o.precise() : J({ fastestFee: 1, halfHourFee: 0.5, hourFee: 0.123, economyFee: 0.123, minimumFee: 0.1 });
    if (/fees\/recommended/.test(u)) return o.rec ? o.rec() : J({ fastestFee: 2, halfHourFee: 1, hourFee: 1, economyFee: 1, minimumFee: 1 });
    if (/compose\/destroy/.test(u)) { const q = new URL(u).searchParams, r = TXF.result('destroy', ME, { asset: 'XCPETS', quantity: +q.get('quantity'), tag: q.get('tag') }, { type: 110, bodyHex: TXF.destroyBody('XCPETS', +q.get('quantity'), q.get('tag')) }, { fee: Math.ceil(154 * Number(q.get('sat_per_vbyte'))) });
      r.signed_tx_estimated_size = { vsize: 154, adjusted_vsize: 154 }; return J({ result: r }); }
    return J({}, 404); };
  const CFG = { network: 'mainnet', asset: 'XCPETS', mempoolApi: 'https://mempool.space/api', compose: 'https://a.test/v2', composeList: ['https://a.test/v2'], read: [] };
  global.window = win; const W = make({ Wallet: WL, BurnCore: BC, CFG, win, fetch, storage, backoffMs: 5, composeMs: 500, feeMs: 150, composeTotalMs: 3000 });
  return { W, calls, urls, toasts };
}
(async () => {
  let r = rig({}), P = r.W._pickFee;
  chk('quiet mempool: economy 0.123 -> 0.123 (not rounded up to 1)', P({ hourFee: 0.123, economyFee: 0.123, minimumFee: 0.1 }) === 0.123);
  chk('hour rate lower than economy and sane -> hour rate', P({ hourFee: 0.2, economyFee: 0.5, minimumFee: 0.1 }) === 0.2);
  chk('hour rate below minimumFee is not sane -> economy', P({ hourFee: 0.05, economyFee: 0.3, minimumFee: 0.1 }) === 0.3);
  chk('floor 0.1 sat/vB', P({ hourFee: 0.01, economyFee: 0.02, minimumFee: 0.01 }) === 0.1);
  chk('minimumFee above floor is respected', P({ hourFee: 0.2, economyFee: 0.2, minimumFee: 0.4 }) === 0.4);
  chk('busy mempool keeps decimals (economy 3.7)', P({ hourFee: 5.2, economyFee: 3.7, minimumFee: 1 }) === 3.7);
  chk('garbage -> NaN (falls back)', isNaN(P({ hourFee: 'x' })) && isNaN(P(null)));
  chk('cap 500', P({ hourFee: 9999, economyFee: 9999 }) === 500);
  let q = await r.W.feeQuote(); chk('feeQuote uses /fees/precise', q.src === 'precise' && q.rate === 0.123 && r.urls.some(u => /\/v1\/fees\/precise$/.test(u)) && !r.urls.some(u => /recommended/.test(u)), JSON.stringify(q));
  r = rig({ precise: () => J({}, 500) }); q = await r.W.feeQuote(); chk('precise 500 -> /recommended (1)', q.src === 'recommended' && q.rate === 1, JSON.stringify(q));
  r = rig({ precise: () => Promise.reject(new TypeError('Failed to fetch')), rec: () => Promise.reject(new TypeError('Failed to fetch')) }); q = await r.W.feeQuote(); chk('both fail -> 2 sat/vB fallback', q.src === 'fallback' && q.rate === 2, JSON.stringify(q));
  r = rig({ precise: () => new Promise(() => {}) }); q = await r.W.feeQuote(); chk('precise hangs -> /recommended after the deadline', q.src === 'recommended', JSON.stringify(q));
  r = rig({}); await r.W.feeQuote(); await r.W.feeQuote(); chk('rate cached (one precise call for back-to-back quotes)', r.urls.filter(u => /precise/.test(u)).length === 1);
  chk('estimate: 1 burn at 0.123 = 20 sats, 16 burns = 320 sats', r.W.feeEstimate(1, 0.123) === 20 && r.W.feeEstimate(16, 0.123) === 320, r.W.feeEstimate(1, 0.123) + ' ' + r.W.feeEstimate(16, 0.123));
  chk('estimate: 1 burn at old 1 sat/vB = 155 sats, 16 burns = 2,480', r.W.feeEstimate(1, 1) === 155 && r.W.feeEstimate(16, 1) === 2480);
  chk('BurnCore.composeUrl takes a decimal rate', /sat_per_vbyte=0\.123(&|$)/.test(BC.composeUrl('https://a.test/v2', ME, { quantityRaw: '6900000000', tag: TAG, satPerVbyte: 0.123 })));
  // a burn with a progress callback: decimal rate in the compose URL, fee info at 'sign' before the wallet window
  r = rig({}); let seen = [];
  let x = await r.W.send({ tag: TAG, amount: AMT, label: 'Hatch' }, ME, (a, b, ph, fi) => seen.push([ph, fi, r.calls.includes('xcp_signTransaction')])).then(v => ({ v }), e => ({ e }));
  const cu = r.urls.find(u => /compose\/destroy/.test(u)) || '';
  chk('burn compose sends sat_per_vbyte=0.123', /sat_per_vbyte=0\.123(&|$)/.test(cu), cu);
  const sg = seen.find(s => s[0] === 'sign');
  chk('fee shown at sign phase, before the wallet window', sg && sg[1] && sg[1].sats === 19 && sg[1].rate === 0.123 && sg[2] === false && /19 sats at 0\.123 sat\/vB/.test(sg[1].text), JSON.stringify(sg));
  chk("test wallet rejected (nothing signed)", x.e && x.e.code === 4001, x.e && x.e.message);
  // a burn without a progress callback (shop, quests, gifts): toast before the wallet window
  r = rig({}); x = await r.W.send({ tag: TAG, amount: AMT, label: 'Hatch' }, ME).then(v => ({ v }), e => ({ e }));
  chk('no callback -> fee toast', r.toasts.length === 1 && /network fee 19 sats at 0\.123 sat\/vB/.test(r.toasts[0]) && !/×/.test(r.toasts[0]), JSON.stringify(r.toasts));
  console.log('\n' + pass + ' passed, ' + fail + ' FAILED'); process.exit(fail ? 1 : 0);
})();
