#!/usr/bin/env node
/* feed-chain-test (2026-10-27): our own burns chain on their unconfirmed change (inputs_set + allow_unconfirmed_inputs) up to CHAIN_CAP (20),
 * so one-time skip burns + the one feed burn go out back to back; 429 / timeouts back off and retry; a wallet failure mid-chain stops cleanly
 * (later burns not built) and the retry resumes on the last SENT burn's change. Nothing is signed for real: the wallet is a fake. */
'use strict';
const path = require('path'), crypto = require('crypto'), BC = require('../rjs/burn-core.js'), WL = require('../rjs/wallet.js'), TXF = require('./lib/txfake.js');
const make = require(path.resolve(path.join(__dirname, '../js/v2-wallet.js')));
const ME = 'bc1ps9av86ymmlzy9zj3a8pn6g94pz4j5e0kagv3td3wutaagfjvekjs26m3s4';
let pass = 0, fail = 0; const chk = (m, c, x) => { if (c) { pass++; console.log('ok   ' + m); } else { fail++; console.log('FAIL ' + m + (x ? ' — ' + x : '')); } };
const H = n => crypto.createHash('sha256').update(String(n)).digest('hex');
function rig(o) { o = o || {}; const urls = [], calls = [], mem = {}, sent = []; let n429 = o.n429 || 0, nHang = o.nHang || 0, signFail = o.signFail || {};
  const storage = { getItem: k => mem[k] == null ? null : mem[k], setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
  if (o.pending != null) { const at = Date.now(), sp = []; for (let i = 0; i < o.pending; i++) sp.push({ u: H('in' + i) + ':0', at, tx: H('tx' + i) }); mem['xcpets-v2-spent-mainnet-' + ME] = JSON.stringify({ spent: sp, lastChange: { u: H('tx' + (o.pending - 1)) + ':1', at } }); }
  let k = 0; const win = { xcpwallet: { on() {}, request(a) { calls.push(a.method);
    if (a.method === 'xcp_requestAccounts') return Promise.resolve({ accounts: [ME] }); if (a.method === 'xcp_getNetwork') return Promise.resolve('mainnet');
    if (a.method === 'xcp_signTransaction') { const i = ++k; if (signFail[i]) { const e = new Error("Signing blocked: Couldn't verify asset status"); e.code = -32603; delete signFail[i]; k--; return Promise.reject(e); } return Promise.resolve({ hex: a.params[0].hex }); }
    if (a.method === 'xcp_broadcastTransaction') { const t = H('sent' + sent.length); sent.push(t); return Promise.resolve({ txid: t }); }
    return Promise.reject(new Error('refused ' + a.method)); } }, addEventListener() {}, removeEventListener() {}, setTimeout, clearTimeout, sessionStorage: storage, location: { search: '' } };
  const fetch = (u, opt) => { if (/fees\/recommended/.test(u)) return Promise.resolve({ status: 200, json: () => Promise.resolve({ hourFee: 3 }) });
    if (/compose\/destroy/.test(u)) { urls.push(u); const q = new URL(u).searchParams;
      if (n429 > 0) { n429--; return Promise.resolve({ status: 429, json: () => Promise.resolve({}) }); }
      if (nHang > 0) { nHang--; return new Promise((res, rej) => { if (opt && opt.signal) opt.signal.addEventListener('abort', () => { const e = new Error('aborted'); e.name = 'AbortError'; rej(e); }); }); }
      if (!q.get('allow_unconfirmed_inputs')) return Promise.resolve({ status: 200, json: () => Promise.resolve({ error: 'Insufficient BTC at address ' + ME }) });
      return Promise.resolve({ status: 200, json: () => Promise.resolve({ result: TXF.result('destroy', ME, { asset: 'XCPETS', quantity: +q.get('quantity'), tag: q.get('tag') }, { type: 110, bodyHex: TXF.destroyBody('XCPETS', +q.get('quantity'), q.get('tag')) }) }) }); }
    return Promise.resolve({ status: 404, json: () => Promise.resolve({}) }); };
  const CFG = { network: 'mainnet', asset: 'XCPETS', mempoolApi: 'https://mempool.space/api', compose: 'https://a.test/v2', composeList: ['https://a.test/v2', 'https://b.test/v2'], read: [] };
  global.window = win; const W = make({ Wallet: WL, BurnCore: BC, CFG, win, fetch, storage, backoffMs: 5, composeMs: 150, feeMs: 150, composeTotalMs: 6000 });
  const send = p => W.send(p, ME).then(v => ({ s: 'ok', v }), e => ({ s: 'err', e }));
  return { W, urls, calls, sent, send, run: async plans => { const out = []; for (const p of plans) { const r = await send(p); out.push(r); if (r.s !== 'ok') break; } return out; } };
}
const PLANS = [{ tag: 'pet:sk:KCH.SHQ.SIH', amount: 1 }, { tag: 'pet:sk:20901:7', amount: 1 }, { tag: 'pet:fa', amount: 1234.5 }];
const inSet = u => decodeURIComponent((new URL(u).searchParams.get('inputs_set')) || '');
(async () => {
  chk('CHAIN_CAP is 20 (below Bitcoin\'s 25 ancestor limit)', make({ Wallet: WL, BurnCore: BC, CFG: { network: 'mainnet', composeList: [] }, win: {}, fetch: () => Promise.reject(), storage: { getItem() { return null; }, setItem() {}, removeItem() {} } }).CHAIN_CAP === 20);
  let r = rig({ pending: 1 }), out = await r.run(PLANS);
  chk('2 skip burns + 1 feed burn go out back to back on unconfirmed change', out.length === 3 && out.every(x => x.s === 'ok') && r.sent.length === 3, out.map(x => x.s + (x.e ? ':' + x.e.message : '')).join(' | '));
  const sets = r.urls.filter(u => /inputs_set/.test(u)).map(inSet);
  chk('burn 1 chains on the earlier burn\'s change', sets[0] === H('tx0') + ':1', sets[0]);
  chk('order kept: skip, skip, then feed', r.urls.filter(u => /allow_unconfirmed_inputs/.test(u)).map(u => new URL(u).searchParams.get('tag')).filter((t, i, a) => a.indexOf(t) === i).join() === PLANS.map(p => p.tag).join());
  r = rig({ pending: 20 }); out = await r.run(PLANS);
  chk('20 pending burns -> stops at the cap, nothing signed', out[0].s === 'err' && out[0].e.chainCap && !r.calls.includes('xcp_signTransaction'), out[0].e && out[0].e.message);
  r = rig({ pending: 19 }); out = await r.run(PLANS);
  chk('19 pending -> 1 more chains, then the cap stops the rest', out.length === 2 && out[0].s === 'ok' && out[1].e && out[1].e.chainCap);
  r = rig({ pending: 1, n429: 2 }); out = await r.run(PLANS);
  chk('node 429 twice -> backs off and still sends all 3', out.length === 3 && out.every(x => x.s === 'ok'), out.map(x => x.s + (x.e ? ':' + x.e.message : '')).join(' | '));
  r = rig({ pending: 1, nHang: 1 }); out = await r.run(PLANS);
  chk('compose timeout -> retried, all 3 sent', out.length === 3 && out.every(x => x.s === 'ok'), out.map(x => x.s + (x.e ? ':' + x.e.message : '')).join(' | '));
  r = rig({ pending: 1, signFail: { 2: 1 } }); out = await r.run(PLANS);
  chk('wallet fails burn 2 -> stops cleanly, burn 3 never built', out.length === 2 && out[0].s === 'ok' && out[1].s === 'err' && r.sent.length === 1 && !r.urls.some(u => /tag=pet%3Afa/.test(u)), out.map(x => x.s).join());
  chk('the stop shows the wait note (Continue)', out[1].e && out[1].e.confirmNote === true);
  const before = r.urls.length, out2 = await r.run(PLANS.slice(1)), set2 = r.urls.slice(before).filter(u => /inputs_set/.test(u)).map(inSet)[0];
  chk('Continue resumes burn 2 + 3 (2 sent, 3 total)', out2.length === 2 && out2.every(x => x.s === 'ok') && r.sent.length === 3, out2.map(x => x.s + (x.e ? ':' + x.e.message : '')).join(' | '));
  chk('resume chains on the last SENT burn (never the failed one)', set2 && set2.split(':')[0] !== H('tx0') ? r.sent.includes(set2.split(':')[0]) : set2 === H('tx0') + ':1', set2);
  console.log(pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
