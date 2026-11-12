#!/usr/bin/env node
/* fee-picker: Economy stays the old default (precise economy, or the hour rate when that is lower and still sane).
 * Normal = halfHourFee, Fast = fastestFee, Custom = a saved sat/vB. Floor 0.1 (and minimumFee), cap 500.
 * The choice is remembered in localStorage. One batch pins that rate for every burn and order in the run.
 * Fake fetch + a wallet that rejects every sign: nothing is signed or sent. */
'use strict';
const path = require('path'), BC = require('../rjs/burn-core.js'), WL = require('../rjs/wallet.js'), TXF = require('./lib/txfake.js');
const make = require(path.join(__dirname, '../js/v2-wallet.js'));
const ME = 'bc1ps9av86ymmlzy9zj3a8pn6g94pz4j5e0kagv3td3wutaagfjvekjs26m3s4', TAG = 'pet:hatch', AMT = 69;
let pass = 0, fail = 0; const chk = (m, c, x) => { if (c) { pass++; console.log('ok   ' + m); } else { fail++; console.log('FAIL ' + m + (x ? ' — ' + x : '')); } };
const J = (o, st) => Promise.resolve({ status: st || 200, json: () => Promise.resolve(o) });
const QUIET = { fastestFee: 5, halfHourFee: 2, hourFee: 0.123, economyFee: 0.123, minimumFee: 0.1 };
function rig(o) { o = o || {}; const urls = [], mem = o.mem || {}; let fees = o.fees || Object.assign({}, QUIET);
  const storage = { getItem: k => mem[k] == null ? null : mem[k], setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
  const win = { document: { getElementById() { return null; }, createElement: () => ({ setAttribute() {}, textContent: '' }) }, xcpwallet: { on() {}, request(a) {
    if (a.method === 'xcp_requestAccounts') return Promise.resolve({ accounts: [ME] }); if (a.method === 'xcp_getNetwork') return Promise.resolve('mainnet');
    if (a.method === 'xcp_signTransaction') { const e = new Error('User rejected (test wallet never signs)'); e.code = 4001; return Promise.reject(e); }
    return Promise.reject(new Error('test wallet: refused ' + a.method)); } }, addEventListener() {}, removeEventListener() {}, dispatchEvent() {}, CustomEvent: function CustomEvent() {}, setTimeout, clearTimeout, sessionStorage: storage, location: { search: '', pathname: '/play.html' } };
  const fetch = (u) => { urls.push(String(u));
    if (/fees\/precise/.test(u)) return o.precise ? o.precise() : J(fees);
    if (/fees\/recommended/.test(u)) return o.rec ? o.rec() : J({ fastestFee: 2, halfHourFee: 1, hourFee: 1, economyFee: 1, minimumFee: 1 });
    if (/compose\/destroy/.test(u)) { const q = new URL(u).searchParams; const r = TXF.result('destroy', ME, { asset: 'XCPETS', quantity: +q.get('quantity'), tag: q.get('tag') }, { type: 110, bodyHex: TXF.destroyBody('XCPETS', +q.get('quantity'), q.get('tag')) }, { fee: Math.ceil(154 * Number(q.get('sat_per_vbyte'))) });
      r.signed_tx_estimated_size = { vsize: 154, adjusted_vsize: 154 }; return J({ result: r }); }
    if (/compose\/order/.test(u)) return J({ result: { rawtransaction: 'aa', params: {} } });
    return J({}, 404); };
  const CFG = { network: 'mainnet', asset: 'XCPETS', mempoolApi: 'https://mempool.space/api', compose: 'https://a.test/v2', composeList: ['https://a.test/v2'], read: [] };
  global.window = win; const W = make({ Wallet: WL, BurnCore: BC, CFG, win, fetch, storage, backoffMs: 5, composeMs: 500, feeMs: 150, composeTotalMs: 3000 });
  return { W, urls, mem, fees, setFees: function (f) { fees = f; } };
}
function sat(u) { const m = /sat_per_vbyte=([0-9.]+)/.exec(u || ''); return m ? m[1] : ''; }
(async () => {
  let r = rig(), P = r.W._pickTier, C = r.W._parseCustom;
  chk('economy tier is the old pickFee (hour lower and sane wins)', P({ hourFee: 0.2, economyFee: 0.5, minimumFee: 0.1, halfHourFee: 1, fastestFee: 3 }, 'economy') === 0.2 && r.W._pickFee({ hourFee: 0.2, economyFee: 0.5, minimumFee: 0.1 }) === 0.2);
  chk('normal is halfHourFee', P(QUIET, 'normal') === 2);
  chk('fast is fastestFee', P(QUIET, 'fast') === 5);
  chk('normal missing halfHour uses hour, then the economy default', P({ hourFee: 0.4, economyFee: 0.4, minimumFee: 0.1 }, 'normal') === 0.4 && P({ economyFee: 0.3, minimumFee: 0.1 }, 'normal') === 0.3);
  chk('fast missing fastest uses halfHour', P({ halfHourFee: 1.5, economyFee: 0.2, minimumFee: 0.1 }, 'fast') === 1.5);
  chk('floor 0.1 and minimumFee on normal and fast', P({ halfHourFee: 0.05, fastestFee: 0.02, economyFee: 0.02, minimumFee: 0.4 }, 'normal') === 0.4 && P({ fastestFee: 0.02, economyFee: 0.2, minimumFee: 0.1 }, 'fast') === 0.1);
  chk('cap 500 on fast', P({ fastestFee: 9000, halfHourFee: 3, economyFee: 1, minimumFee: 0.1 }, 'fast') === 500);
  chk('custom below minimumFee is lifted to it; above 500 is not a rate', P({ minimumFee: 0.4, economyFee: 0.4 }, 'custom', 0.2) === 0.4 && isNaN(P({ minimumFee: 0.1, economyFee: 0.1 }, 'custom', 900)));
  chk('custom rejects blank, words, zero, and values outside the floor', !C('').ok && !C('abc').ok && !C('0').ok && !C('-1').ok && !C('1e2').ok && !C(0.05, 0.1).ok && C(0.05, 0.1).error.indexOf('0.1') >= 0);
  chk('custom accepts 0.1, 500, a comma decimal, and trims', C('0.1').ok && C('0.1').rate === 0.1 && C(500).rate === 500 && C('1,5').rate === 1.5 && C('  2.25 ').rate === 2.25);
  chk('custom above 500 says the maximum', !C(500.1).ok && /500/.test(C('900').error));

  chk('no saved choice is economy and has no custom number', r.W.feeChoice().mode === 'economy' && r.W.feeChoice().custom == null);
  let q = await r.W.feeQuote();
  chk('default quote is still precise economy 0.123', q.src === 'precise' && q.tier === 'economy' && q.rate === 0.123 && q.rates.normal === 2 && q.rates.fast === 5, JSON.stringify(q));
  chk('one precise fetch', r.urls.filter(u => /precise/.test(u)).length === 1);

  let bad = r.W.setFeeChoice('custom', 'nope');
  chk('bad custom is rejected and the saved choice stays economy', !bad.ok && r.W.feeChoice().mode === 'economy' && /number/.test(bad.error));
  bad = r.W.setFeeChoice('custom', 0.05);
  chk('custom under the live minimum is rejected', !bad.ok && /Minimum is 0.1/.test(bad.error) && r.W.feeChoice().mode === 'economy', bad.error);
  bad = r.W.setFeeChoice('turbo');
  chk('unknown mode is rejected', !bad.ok && r.W.feeChoice().mode === 'economy');

  chk('normal choice sticks', r.W.setFeeChoice('normal').ok && r.W.feeChoice().mode === 'normal' && r.W.feeChoice().custom == null);
  chk('a tier choice does not store a zero custom', r.mem['xcpets-v2-fee'] === '{"m":"normal"}', r.mem['xcpets-v2-fee']);
  const old = rig({ mem: { 'xcpets-v2-fee': '{"m":"fast","c":0}' } });
  chk('an old zero custom is ignored and fast still applies', old.W.feeChoice().mode === 'fast' && old.W.feeChoice().custom == null);
  q = await r.W.feeQuote(); chk('quote follows normal without a new fetch', q.tier === 'normal' && q.rate === 2 && r.urls.filter(u => /precise/.test(u)).length === 1, JSON.stringify(q));
  chk('fast choice', r.W.setFeeChoice('fast').ok);
  q = await r.W.feeQuote(); chk('quote follows fast', q.tier === 'fast' && q.rate === 5, JSON.stringify(q));
  chk('custom 1.25 sticks', r.W.setFeeChoice('custom', '1.25').ok && r.W.feeChoice().custom === 1.25);
  q = await r.W.feeQuote(); chk('quote uses the custom rate', q.tier === 'custom' && q.rate === 1.25, JSON.stringify(q));

  const mem = r.mem;
  const r2 = rig({ mem: mem });
  chk('choice survives in localStorage', r2.W.feeChoice().mode === 'custom' && r2.W.feeChoice().custom === 1.25);
  q = await r2.W.feeQuote(); chk('a new page load still uses the saved custom rate', q.rate === 1.25 && q.tier === 'custom', JSON.stringify(q));

  r = rig(); r.W.setFeeChoice('fast');
  await r.W.feeBatchBegin();
  r.fees.fastestFee = 40; r.fees.halfHourFee = 12; r.fees.hourFee = 9; r.fees.economyFee = 9; r.W._feeReset();
  q = await r.W.feeRate(); chk('a batch keeps the rate it started with', q === 5, q);
  let x = await r.W.send({ tag: TAG, amount: AMT, label: 'Hatch' }, ME).then(v => v, e => e);
  chk('first burn in the batch composes at 5 sat/vB', sat(r.urls.find(u => /compose\/destroy/.test(u))) === '5' && x && x.code === 4001, sat(r.urls.find(u => /compose\/destroy/.test(u))));
  r.urls.length = 0;
  await r.W.send({ tag: 'pet:feed:1', amount: 69, label: 'Feed' }, ME).then(v => v, () => null);
  chk('second burn in the batch still composes at 5', sat(r.urls.find(u => /compose\/destroy/.test(u))) === '5', r.urls.filter(u => /compose/.test(u)).join(' '));
  r.W.setFeeChoice('economy');
  q = await r.W.feeRate(); chk('picking again re-pins the new choice for the rest of the batch', q === 9, q);
  r.W.feeBatchEnd(); r.W._feeReset();
  q = await r.W.feeQuote(); chk('after the batch, a fresh quote sees the new mempool rate', q.tier === 'economy' && q.rate === 9, JSON.stringify(q));

  r = rig(); r.W.setFeeChoice('normal');
  const plan = { kind: 'order', give_asset: 'XCPETS', give_quantity: 100000000, get_asset: 'A111111111111111111', get_quantity: 1, expiration: 1, label: 'Buy' };
  const fee = await r.W.feeRate();
  chk('order url uses the chosen normal rate', /sat_per_vbyte=2(&|$)/.test(r.W._dexUrl('https://a.test/v2', ME, plan, fee)), r.W._dexUrl('https://a.test/v2', ME, plan, fee));
  await r.W.sendDex(plan, ME).then(v => v, () => null);
  chk('sendDex composes the order at that rate', r.urls.some(u => /compose\/order/.test(u) && /sat_per_vbyte=2(&|$)/.test(u)), r.urls.filter(u => /compose\/order/.test(u))[0]);

  r = rig({ precise: () => Promise.reject(new TypeError('Failed to fetch')), rec: () => Promise.reject(new TypeError('Failed to fetch')) });
  r.W.setFeeChoice('custom', 3);
  q = await r.W.feeQuote(); chk('custom still applies when both fee servers fail', q.tier === 'custom' && q.rate === 3 && q.src === 'custom', JSON.stringify(q));
  r.W.setFeeChoice('economy');
  r.W._feeReset();
  q = await r.W.feeQuote(); chk('economy still falls back to 2 sat/vB when both servers fail', q.src === 'fallback' && q.rate === 2, JSON.stringify(q));

  r = rig({ fees: { fastestFee: 8, halfHourFee: 0.05, hourFee: 0.2, economyFee: 0.5, minimumFee: 0.1 } });
  chk('economy quote still prefers the lower sane hour rate', (await r.W.feeQuote()).rate === 0.2);
  r.W.setFeeChoice('normal');
  q = await r.W.feeQuote(); chk('normal below the floor is lifted to 0.1 and says so', q.rate === 0.1 && /minimum/i.test(q.note || ''), JSON.stringify(q));

  console.log('\n' + pass + ' passed, ' + fail + ' FAILED'); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL ' + (e && e.stack || e)); process.exit(1); });
