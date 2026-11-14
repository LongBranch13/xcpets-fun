#!/usr/bin/env node
/* casatookan-wallet (Nov 1 2026): Casa Tookan's in-app browser wallet (legacy window.webXCP) works like XCP Wallet for connect, message
 * signing and burns; XCP Wallet and Horizon are unchanged. The Casa stub below copies Casa Tookan's own injected shim: argument juggling
 * (basePath optional), getAccounts -> one address string, signTransaction takes a BASE64 PSBT (Casa does atob + Transaction.fromPSBT) and
 * answers the signed raw tx as BASE64; there is no broadcast in webXCP, so the site POSTs it to mempool /tx (stubbed here: nothing is ever
 * signed for real or sent; every outside request is answered by this test). Part 1 runs V2Wallet in node, part 2 in headless Chrome. */
'use strict';
const fs = require('fs'), path = require('path'), BC = require('../rjs/burn-core.js'), WL = require('../rjs/wallet.js'), TXF = require('./lib/txfake.js');
const make = require('../js/v2-wallet.js'), ROOT = path.resolve(__dirname, '..');
const PORT = process.env.XCPETS_TEST_PORT || 8099;
const ME = '1BoatSLRHtKNngkdXEeobR76b53LETtpyT', TAG = 'pet:hatch', AMT = 69, TXID = 'ab'.repeat(32);
let pass = 0, fail = 0; const chk = (m, c, x) => { if (c) { pass++; console.log('PASS ' + m); } else { fail++; console.log('FAIL ' + m + (x ? ' — ' + x : '')); } };
/* Casa-shaped webXCP stub (runs in node and, as a string, in Chrome). mode: ok | tamper | reject | psbt | hex */
function casaStub(S, addr) {
  const H = h => { let b = ''; for (let i = 0; i < h.length; i += 2) b += String.fromCharCode(parseInt(h.substr(i, 2), 16)); return btoa(b); };
  const X = s => { const b = atob(s); let h = ''; for (let i = 0; i < b.length; i++) h += b.charCodeAt(i).toString(16).padStart(2, '0'); return h; };
  const juggle = (a, b, c) => typeof b === 'function' ? [null, a, b] : [a, b, c];
  return {
    getAccounts(bp, cb) { if (typeof bp === 'function') { cb = bp; bp = null; } S.calls.push('getAccounts'); S.args.push(['getAccounts', bp]); setTimeout(() => cb(null, S.addr || addr), 5); },
    signMessage(a, b, c) { const [bp, data, cb] = juggle(a, b, c); S.calls.push('signMessage'); S.args.push(['signMessage', bp, data]); setTimeout(() => cb(null, 'H' + 'A'.repeat(87)), 5); },
    signTransaction(a, b, c) { const [bp, data, cb] = juggle(a, b, c); S.calls.push('signTransaction'); S.args.push(['signTransaction', bp, data]);
      if (S.mode === 'reject') return setTimeout(() => cb({ code: 4001, message: 'User rejected' }), 5);
      let h; try { h = X(data); } catch (e) { return cb({ code: -32603, message: 'Invalid base64 (not a PSBT)' }); }
      if (h.slice(0, 10) !== '70736274ff' || h.slice(10, 14) !== '0100') return cb({ code: -32603, message: 'Invalid PSBT magic' });
      if (S.mode === 'psbt') return cb(null, data);
      let o = 14, n = parseInt(h.substr(o, 2), 16); o += 2; if (n === 0xfd) { n = parseInt(h.substr(o + 2, 2) + h.substr(o, 2), 16); o += 4; }
      const tx = h.substr(o, n * 2); S.unsigned = tx; const t = S.parse(tx);
      /* "sign": a placeholder scriptSig on every input (NOT a signature; no key exists here) */
      let out = t.ver + t.ins.length.toString(16).padStart(2, '0') + t.ins.map(i => i.prev + '03515151' + i.seq).join('') + t.outs.length.toString(16).padStart(2, '0') + t.outs.join('') + t.lock;
      if (S.mode === 'tamper') out = out.replace(t.outs[t.outs.length - 1], 'ffffffff' + t.outs[t.outs.length - 1].slice(8));
      S.signed = out; setTimeout(() => cb(null, S.mode === 'hex' ? out : H(out)), 5); } };
}
function rig(o) { o = o || {}; const S = { calls: [], args: [], mode: o.mode || 'ok', parse: WL._parseTx }, posts = [], urls = [], mem = Object.assign({}, o.mem || {});
  const storage = { getItem: k => mem[k] == null ? null : mem[k], setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
  const xc = { on() {}, request(a) { S.calls.push(a.method); if (a.method === 'xcp_requestAccounts') return Promise.resolve({ accounts: ['bc1qtestaddressxxxxxxxxxxxxxxxxxxxxxxxxxx'] });
    if (a.method === 'xcp_getNetwork') return Promise.resolve('mainnet'); return Promise.reject(new Error('refused ' + a.method)); } };
  const win = { addEventListener() {}, removeEventListener() {}, dispatchEvent() {}, Event: function () {}, setTimeout, clearTimeout, sessionStorage: storage, location: { search: '', reload() { S.reloaded = true; } } };
  if (o.webXCP !== false) win.webXCP = casaStub(S, ME); if (o.web3xcp) win.web3xcp = { getAddress(cb) { S.calls.push('getAddress'); cb(null, ME); }, signMessage(m, cb) { cb(null, 'sig'); }, getPublicKey(cb) { cb(null, '02'); } };
  if (o.xcp) win.xcpwallet = xc;
  const fetch = (u, init) => { if (/fees\/recommended/.test(u)) return Promise.resolve({ status: 200, ok: true, json: () => Promise.resolve({ hourFee: 2 }) });
    if (/compose\/destroy/.test(u)) { urls.push(u); const q = new URL(u).searchParams; return Promise.resolve({ status: 200, json: () => Promise.resolve({ result: TXF.result('destroy', q.get('source') || ME, { asset: 'XCPETS', quantity: +q.get('quantity'), tag: q.get('tag') }, { type: 110, bodyHex: TXF.destroyBody('XCPETS', +q.get('quantity'), q.get('tag')) }) }) }); }
    if (/mempool\.space\/api\/tx$/.test(u) && init && init.method === 'POST') { posts.push(init.body); return Promise.resolve(o.bcast ? o.bcast() : { ok: true, status: 200, text: () => Promise.resolve(TXID) }); }
    return Promise.resolve({ status: 404, ok: false, json: () => Promise.resolve({}), text: () => Promise.resolve('') }); };
  const CFG = { network: 'mainnet', asset: 'XCPETS', mempoolApi: 'https://mempool.space/api', compose: 'https://a.test/v2', composeList: ['https://a.test/v2'], read: [] };
  global.window = win; const W = make({ Wallet: WL, BurnCore: BC, CFG, win, fetch, storage, backoffMs: 5, composeMs: 300, feeMs: 300, composeTotalMs: 3000 });
  return { W, S, win, posts, urls, mem, burn: () => W.send({ tag: TAG, amount: AMT, label: 'Crack One Open' }, ME).then(v => ({ s: 'ok', v }), e => ({ s: 'err', e })) };
}
async function node() {
  // detect: order xcpwallet > webXCP > Horizon; Horizon object unchanged
  const st = casaStub({ calls: [], args: [] }, ME);
  chk('detect: webXCP -> Casa Tookan', JSON.stringify(WL.detect({ webXCP: st })) === JSON.stringify({ kind: 'webxcp', label: 'Casa Tookan', p: st }));
  chk('detect: XCP Wallet wins over webXCP', WL.detect({ xcpwallet: 1, webXCP: st }).kind === 'xcpwallet');
  const hz = WL.detect({ HorizonWalletProvider: { x: 1 } }); chk('detect: Horizon unchanged', hz && hz.kind === 'horizon' && hz.label === 'Horizon Wallet');
  chk('detect: web3xcp alone -> webxcp', WL.detect({ web3xcp: { getAddress() {} } }).kind === 'webxcp');
  // connect + message
  let r = rig(), a = await r.W.connect();
  chk('connect returns the casa legacy address', a === ME, a);
  chk('getAccounts called once, callback-only form (basePath null)', r.S.calls.filter(c => c === 'getAccounts').length === 1 && r.S.args[0][1] === null, JSON.stringify(r.S.args));
  chk('label() = Casa Tookan, provider remembered as webxcp', r.W.label() === 'Casa Tookan' && r.mem['xcpets-v2-wallet-provider'] === 'webxcp');
  chk('no XCP Wallet request made', !r.S.calls.some(c => /^xcp_/.test(c)));
  const w = await r.W.getWallet(), sig = await w.signMessage('hello xcpets');
  chk('signMessage(message, cb): Casa sees data = message', r.S.args.some(x => x[0] === 'signMessage' && x[1] === null && x[2] === 'hello xcpets') && /^H/.test(sig), JSON.stringify(r.S.args));
  chk('legacy 1... fee estimate uses ~240 vB', r.W.feeEstimate(1, 2) === 480, r.W.feeEstimate(1, 2));
  // burn: PSBT in, base64 signed tx out, site broadcast, txid back
  let x = await r.burn();
  const sa = r.S.args.find(z => z[0] === 'signTransaction');
  chk('burn: Casa got a base64 PSBT (cHNidP8...)', sa && /^cHNidP8/.test(sa[2]), sa && String(sa[2]).slice(0, 12));
  chk('burn: compose is from the 1... address', r.urls.length && /\/addresses\/1BoatSLRHtKNngkdXEeobR76b53LETtpyT\/compose\/destroy|source=1BoatSLRHtKNngkdXEeobR76b53LETtpyT/.test(r.urls[0]), r.urls[0]);
  chk('burn: PSBT carries the composed unsigned tx', r.S.unsigned && WL._sameTx(r.S.unsigned, r.S.signed).length === 0);
  chk('burn: signed tx (decoded from base64) POSTed to mempool /tx', r.posts.length === 1 && r.posts[0] === r.S.signed, r.posts.length);
  chk('burn: returns the txid', x.s === 'ok' && JSON.stringify(x.v).indexOf(TXID) >= 0, x.s + ' ' + (x.e && x.e.message));
  r = rig({ mode: 'hex' }); x = await r.burn(); chk('burn: a hex answer works too', x.s === 'ok' && r.posts.length === 1, x.e && x.e.message);
  r = rig({ mode: 'tamper' }); x = await r.burn();
  chk('changed tx from wallet -> refused, nothing broadcast', x.s === 'err' && /different transaction/.test(x.e.message) && !r.posts.length, x.e && x.e.message);
  r = rig({ mode: 'reject' }); x = await r.burn();
  chk('user cancel in Casa -> code 4001, nothing broadcast', x.s === 'err' && x.e.code === 4001 && !r.posts.length, x.e && x.e.message);
  r = rig({ mode: 'psbt' }); x = await r.burn(); chk('unfinished PSBT back -> refused', x.s === 'err' && /unfinished PSBT/.test(x.e.message) && !r.posts.length, x.e && x.e.message);
  r = rig({ bcast: () => ({ ok: false, status: 400, text: () => Promise.resolve('sendrawtransaction RPC error: min relay fee not met') }) }); x = await r.burn();
  chk('broadcast refused -> clear error with the node reason', x.s === 'err' && /refused the signed transaction.*min relay fee/.test(x.e.message), x.e && x.e.message);
  r = rig({ webXCP: false, web3xcp: true }); a = await r.W.connect(); x = await r.burn();
  chk('web3xcp only: connect ok, burn refused (no signTransaction), nothing sent', a === ME && x.s === 'err' && /cannot sign transactions/.test(x.e.message) && !r.posts.length, x.e && x.e.message);
  // XCP Wallet unchanged when both are there
  r = rig({ xcp: true }); a = await r.W.connect();
  chk('XCP Wallet present -> XCP Wallet used, webXCP untouched', /^bc1q/.test(a) && r.S.calls.includes('xcp_requestAccounts') && !r.S.calls.includes('getAccounts') && r.W.label() === 'XCP Wallet');
  chk('XCP Wallet fee estimate unchanged (155 vB)', r.W.feeEstimate(1, 2) === 310 && r.W.BURN_VB === 155);
  // silent: never opens Casa's sheet for a site that never connected
  r = rig(); a = await r.W.silent(true); chk('silent, never connected: no getAccounts', a === null && !r.S.calls.length, JSON.stringify(r.S.calls));
  r = rig({ mem: { 'xcpets-v2-wallet-provider': 'webxcp' } }); a = await r.W.silent(true); await r.W.silent(true);
  chk('silent, remembered: re-attaches with one getAccounts', a === ME && r.S.calls.filter(c => c === 'getAccounts').length === 1, JSON.stringify(r.S.calls));
  r = rig(); r.win.casaTookan = { isCasaTookan: true }; r.win.unisat = { getAccounts: () => Promise.resolve([]), on() {} }; a = await r.W.silent(true);
  chk('silent in Casa: asks window.unisat.getAccounts (no prompt), [] -> not attached', a === null && !r.S.calls.length);
  r = rig(); r.win.casaTookan = { isCasaTookan: true }; r.win.unisat = { getAccounts: () => Promise.resolve([ME]), on() {} }; a = await r.W.silent(true);
  chk('silent in Casa: connected casa attaches with no webXCP prompt', a === ME && !r.S.calls.length && r.W.status() === 'on');
  // not found
  r = rig({ webXCP: false }); x = await r.W.connect().then(v => ({ s: 'ok' }), e => ({ s: 'err', e }));
  chk('no wallet -> new not-found copy', x.s === 'err' && x.e.message === 'No wallet found. Use the XCP Wallet Chrome extension, or open xcpets.fun in the Casa Tookan app.' && /Casa Tookan/.test(x.e.html), x.e && x.e.message);
  // casa-connect (Nov 1 2026): inside Casa Tookan with no provider yet -> waits for a late webXCP (up to 6 s), and a miss explains how to attach it
  r = rig({ webXCP: false }); r.win.casaTookan = { isCasaTookan: true }; chk('casa-connect: in Casa, no provider yet -> label Casa Tookan', r.W.label() === 'Casa Tookan' && r.W.inCasa() === true);
  setTimeout(() => { r.win.webXCP = casaStub(r.S, ME); }, 2600); let t0 = Date.now(); a = await r.W.connect();
  chk('casa-connect: webXCP attached 2.6 s late still connects', a === ME && Date.now() - t0 >= 2500, (Date.now() - t0) + ' ms');
  r = rig({ webXCP: false }); r.win.casaTookan = { isCasaTookan: true }; t0 = Date.now(); x = await r.W.connect().then(v => ({ s: 'ok' }), e => ({ s: 'err', e }));
  chk('casa-connect: in Casa, never attached -> Casa hint after ~6 s (not install XCP Wallet)', x.s === 'err' && x.e.casaMiss && /Browse \u203a Apps/.test(x.e.message) && Date.now() - t0 >= 5800, x.e && x.e.message);
  r = rig({ webXCP: false }); t0 = Date.now(); x = await r.W.connect().then(v => ({ s: 'ok' }), e => ({ s: 'err', e }));
  chk('casa-connect: outside Casa the wait stays 2 s', x.s === 'err' && !x.e.casaMiss && Date.now() - t0 < 3500, (Date.now() - t0) + ' ms');
}
async function chrome() {
  const { chromium } = require('playwright-core');
  const raw = TXF.result('destroy', ME, { asset: 'XCPETS', quantity: AMT, tag: TAG }, { type: 110, bodyHex: TXF.destroyBody('XCPETS', AMT, TAG) }).rawtransaction;
  const HARNESS = '<!doctype html><html><head><meta charset="utf-8"></head><body><script src="rjs/config.js"></script><script src="rjs/wallet.js"></script><script src="rjs/burn-core.js"></script><script src="js/v2-wallet.js"></script></body></html>';
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  try {
    const ctx = await b.newContext(), pg = await ctx.newPage(); const errs = [], posts = [];
    pg.on('pageerror', e => errs.push(e.message));
    await pg.route(/^https?:\/\/(?!localhost)/, r => { const q = r.request(); if (/mempool\.space\/api\/tx$/.test(q.url()) && q.method() === 'POST') { posts.push(q.postData()); return r.fulfill({ status: 200, body: TXID }); } return r.fulfill({ status: 404, body: '' }); });
    await pg.route(/^http:\/\/localhost:\d+\//, r => { const u = new URL(r.request().url()); if (u.pathname === '/zz-webxcp.html') return r.fulfill({ contentType: 'text/html', body: HARNESS });
      const f = path.join(ROOT, path.normalize(u.pathname)); if (!f.startsWith(ROOT) || !fs.existsSync(f)) return r.fulfill({ status: 404, body: '' }); return r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(f, 'utf8') }); });
    /* Casa injects a few ms after load (postMessage + eval), not at document start */
    await pg.addInitScript(([src, ME]) => { const S = window.__S = { calls: [], args: [], mode: 'ok' };
      (function arm() { if (!window.Wallet || !window.Wallet._parseTx) return setTimeout(arm, 50); S.parse = window.Wallet._parseTx; window.webXCP = (0, eval)('(' + src + ')')(S, ME); })(); }, [casaStub.toString(), ME]);
    const ev = (f, a) => pg.evaluate(f, a), U = 'http://localhost:' + PORT + '/zz-webxcp.html';
    await pg.goto(U);
    await pg.waitForFunction(() => window.V2Wallet && window.webXCP && V2Wallet.label() === 'Casa Tookan', null, { timeout: 20000 });
    chk('chrome: fresh page in Casa, never connected: no connect sheet', (await ev(() => __S.calls)).length === 0 && await ev(() => V2Wallet.status()) === 'none');
    chk('chrome: label before connect = Casa Tookan', await ev(() => V2Wallet.label()) === 'Casa Tookan');
    const a = await ev(() => V2Wallet.connect()); chk('chrome: connect -> casa address', a === ME, a);
    const t = await ev(() => { const p = document.getElementById('xwPill'); return p && p.className + '|' + p.title; });
    chk('chrome: pill says Casa Tookan connected', /^on\|Casa Tookan connected: 1Boat/.test(t || ''), t);
    const res = await ev(raw => V2Wallet.getWallet().then(w => w.signAndBroadcast({ rawtransaction: raw })).then(r => r, e => ({ err: e.message })), raw);
    chk('chrome: signAndBroadcast (atob/btoa path) -> txid', res && res.txid === TXID, JSON.stringify(res));
    chk('chrome: broadcast body is the signed tx hex', posts.length === 1 && posts[0] === await ev(() => __S.signed));
    await pg.reload(); await pg.waitForTimeout(1500);
    const c = await ev(() => __S.calls);
    chk('chrome: reload re-attaches silently (one getAccounts, Casa remembers the site)', await ev(() => V2Wallet.status()) === 'on' && c.filter(x => x === 'getAccounts').length === 1, JSON.stringify(c));
    chk('chrome: no page errors', !errs.length, errs.join(' | '));
    // XCP Wallet page untouched by the adapter: same harness, XCP Wallet only
    const pg2 = await (await b.newContext()).newPage(); const c2 = [];
    await pg2.route(/^https?:\/\/(?!localhost)/, r => r.fulfill({ status: 404, body: '' }));
    await pg2.route(/^http:\/\/localhost:\d+\//, r => { const u = new URL(r.request().url()); if (u.pathname === '/zz-webxcp.html') return r.fulfill({ contentType: 'text/html', body: HARNESS }); const f = path.join(ROOT, path.normalize(u.pathname)); return fs.existsSync(f) ? r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(f, 'utf8') }) : r.fulfill({ status: 404, body: '' }); });
    await pg2.exposeFunction('__note', m => c2.push(m));
    await pg2.addInitScript(() => { window.xcpwallet = { on() {}, request(a) { window.__note(a.method); if (a.method === 'xcp_requestAccounts') return Promise.resolve({ accounts: ['bc1qtestaddressxxxxxxxxxxxxxxxxxxxxxxxxxx'] }); if (a.method === 'xcp_getNetwork') return Promise.resolve('mainnet'); return Promise.resolve([]); } }; });
    await pg2.goto(U); await pg2.waitForTimeout(800); await pg2.evaluate(() => V2Wallet.connect());
    const t2 = await pg2.evaluate(() => [V2Wallet.label(), document.getElementById('xwPill').title]);
    chk('chrome: XCP Wallet copy unchanged', t2[0] === 'XCP Wallet' && /^XCP Wallet connected: bc1q/.test(t2[1]) && c2.includes('xcp_requestAccounts'), JSON.stringify(t2));
  } finally { await b.close(); }
}
(async () => {
  try { await node(); await chrome(); } catch (e) { fail++; console.log('FAIL crashed: ' + (e && e.stack || e)); }
  console.log(pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
