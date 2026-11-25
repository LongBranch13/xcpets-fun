#!/usr/bin/env node
/* Display-only balance read. The published view must not paint 0 before a read lands, a failed
 * read is tried again, an array of balance rows is summed, and a session copy must not turn a
 * missing balance into a known 0. Replay inputs and the rules file are untouched.
 *   node tools/view-balance-test.js */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..');
const ADDR = 'bc1qtke38j72qv4d8eljn7pccaykypw8luytfwdn7q';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const rulesMd5 = crypto.createHash('md5').update(fs.readFileSync(path.join(ROOT, 'js/v2-rules.js'))).digest('hex');
ok(rulesMd5 === require('./lib/rules-pin').pin('js/v2-rules.js'), 'rules MD5 unchanged');

const chainSrc = fs.readFileSync(path.join(ROOT, 'rjs/chain.js'), 'utf8');
const v2chain = fs.readFileSync(path.join(ROOT, 'js/v2-chain.js'), 'utf8');
const v2ui = fs.readFileSync(path.join(ROOT, 'js/v2.js'), 'utf8');
ok(/function bootFromView[\s\S]{0,700}readViewBalance\(/.test(v2chain), 'published view still starts a balance read');
ok(!/c\.balance \|\| 0/.test(v2chain), 'a missing session balance is not restored as 0');
ok(/once\(2\)/.test(v2chain) && /BAL_BACKOFF/.test(v2chain), 'a failed view balance read is tried twice more');
ok(/S\.view && !S\.viewVerify[\s\S]{0,240}readViewBalance\(/.test(v2chain), 'refresh on the view path reads the balance again');
ok(/S\.balanceAt \? fmt\(S\.balance\) : '\\u2013'/.test(v2ui) || /S\.balanceAt \? fmt\(S\.balance\) : '\u2013'/.test(v2ui), 'render keeps the dash until a balance read lands');
ok(/S\.balanceAt && s\.total > S\.balance/.test(v2ui), 'Continue blocks only after a balance read has landed');

function memStore() {
  const m = {};
  return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: k => { delete m[k]; } };
}
function loadChain(fetchFn) {
  const ls = memStore(), ss = memStore();
  const CFG = { read: ['https://node.test/v2'], asset: 'XCPETS', mempoolApi: 'https://mempool.test/api', network: 'mainnet', coreFallback: null };
  const sandbox = {
    XCPETS_CONFIG: CFG, sessionStorage: ss, localStorage: ls, fetch: fetchFn,
    setTimeout, clearTimeout, Date, Promise, JSON, Math, Object, Array, String, Number, isFinite,
    AbortController: global.AbortController
  };
  sandbox.self = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(chainSrc, sandbox, { filename: 'rjs/chain.js' });
  return sandbox.Chain.Chain;
}
function jsonRes(body) {
  return Promise.resolve({ ok: true, status: 200, headers: { get: () => null }, json: () => Promise.resolve(body), text: () => Promise.resolve(JSON.stringify(body)) });
}
(async () => {
  const seen = [];
  const Chain = loadChain(url => { seen.push(String(url)); const q = answers[seen.length - 1]; return jsonRes(q); });
  const answers = [
    { result: { quantity: '42' } },
    { result: [{ quantity: '100' }, { quantity: '250' }] },
    { result: [{ quantity: 0 }, { quantity: '500000000' }] },
    { result: [] },
    { result: null }
  ];
  const c = new Chain(null, ['https://node.test/v2']);
  ok(await c.balance(ADDR, 'XCPETS') === '42', 'one balance object is that quantity');
  ok(await c.balance(ADDR, 'XCPETS') === '350', 'an array of rows is summed, not only the first');
  ok(await c.balance(ADDR, 'XCPETS') === '500000000', 'a leading zero row does not hide the rest');
  ok(await c.balance(ADDR, 'XCPETS') === '0', 'an empty balance list is zero');
  ok(await c.balance(ADDR, 'XCPETS') === '0', 'a null balance result is zero');
  ok(seen.every(u => u.indexOf(ADDR) > 0 && u.indexOf('/balances/XCPETS') > 0), 'balance reads the address asset endpoint');

  /* Published view: two failures, then the real quantity. The dash stays until that read lands. */
  const view = bootView({
    me: ADDR,
    balance() {
      view.n++;
      if (view.n < 3) return Promise.reject(new Error('busy'));
      return Promise.resolve('250000000');
    }
  });
  view.M.boot(() => { view.booted++; });
  await sleep(50);
  ok(view.booted === 1, 'the view paints without waiting for the balance');
  ok(view.bal.textContent === '\u2013', 'the balance stays a dash while the read is failing');
  ok(!view.M.state().balanceAt, 'a failed read is not a landed balance');
  await sleep(1600);
  ok(view.n === 3, 'the read is tried twice more after a failure (got ' + view.n + ')');
  ok(view.M.state().balance === 2.5 && view.M.state().balanceAt, 'the third read lands as 2.5 XCPETS');
  ok(view.bal.textContent === '2.5', 'the painted balance is 2.5, not 0');
  const n0 = view.n;
  await view.M.refresh(() => {});
  ok(view.n === n0, 'refresh inside 30s does not read the balance again');
  view.shift = 31000;
  await view.M.refresh(() => {});
  await sleep(20);
  ok(view.n === n0 + 1, 'refresh after 30s reads the balance once more (got ' + view.n + ')');

  /* No address at load. Connecting the wallet is what makes the balance readable. */
  const late = bootView({
    me: '',
    balance() { late.n++; return Promise.resolve('100000000'); }
  });
  late.M.boot(() => {});
  await sleep(20);
  ok(late.n === 0 && late.bal.textContent === '\u2013', 'no address yet: no balance read and no zero');
  late.dispatch({ type: 'xcpets:connected', detail: { address: ADDR } });
  await sleep(30);
  ok(late.n === 1 && late.M.state().balance === 1 && late.bal.textContent === '1', 'a wallet connect after load reads the balance');

  /* Session copy with balance 0 and no landed-read time is not a known zero. The read still runs. */
  const sess = bootSession({ balance: 0 });
  sess.M.boot(() => {});
  ok(!sess.M.state().balanceAt, 'a stored 0 without a landed read is still unknown');
  await sleep(30);
  ok(sess.n === 1 && sess.M.state().balance === 8 && sess.M.state().balanceAt, 'the session path still reads the balance');
  const saved = JSON.parse(sess.ss.getItem('xcpets-v2-prod-rows'));
  ok(saved.balance === 8 && saved.balanceAt, 'the session copy keeps the landed balance');

  const known = bootSession({ balance: 3, balanceAt: 111 });
  known.M.boot(() => {});
  ok(known.M.state().balance === 3 && known.M.state().balanceAt === 111, 'a session balance that already landed is restored');
  await sleep(30);
  ok(known.n === 1 && known.M.state().balance === 4, 'a restored balance is still read again');

  console.log('view-balance-test: ' + pass + ' pass, ' + fail + ' fail');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL error', e && e.stack); process.exit(1); });

function bootView(o) {
  const box = { n: 0, booted: 0, shift: 0, bal: { id: 'bal', textContent: '\u2013', style: {}, remove() {} } };
  const listeners = {};
  const RealDate = Date;
  function Clock() {}
  Clock.now = () => RealDate.now() + box.shift;
  Clock.parse = RealDate.parse;
  Clock.UTC = RealDate.UTC;
  const ls = memStore(), ss = memStore();
  if (o.me) ls.setItem('xcpets-v2-me', o.me);
  const nodes = [box.bal, { id: 'v2boot', textContent: '', style: {}, className: '', remove() {}, querySelector: () => null, isConnected: false }];
  class Chain { balance(addr, asset) { box.addr = addr; box.asset = asset; return o.balance(); } }
  const win = {
    V2Rules: { replay: () => ({ pets: [], tip: 1, _view: 1 }) },
    LiveEngine: { CFG: { asset: 'XCPETS', isMainnet: true }, Chain, RealCore: {} },
    V2Split: { prepare(cb) { cb({ tip: 9, pets: [], _view: 1 }); }, install() {}, recheck: () => Promise.resolve(true) },
    addEventListener(type, fn) { (listeners[type] || (listeners[type] = [])).push(fn); },
    dispatchEvent(e) { (listeners[e.type] || []).forEach(fn => { try { fn(e); } catch (err) {} }); },
    XCPETS_BLOCK_HASHES: {}
  };
  box.dispatch = e => win.dispatchEvent(e);
  const doc = {
    readyState: 'complete', currentScript: { src: 'https://x/js/v2-chain.js?v=abcdef1234' }, scripts: [],
    getElementById: id => nodes.find(n => n.id === id) || null, querySelector: () => null, createElement: () => ({ id: '', style: {}, textContent: '', setAttribute() {}, appendChild() {}, remove() {} }),
    body: { insertBefore(n) { nodes.push(n); }, appendChild(n) { nodes.push(n); } }, addEventListener() {}, hidden: true
  };
  const ctx = {
    window: win, document: doc, localStorage: ls, sessionStorage: ss, location: { search: '', href: 'https://x/play.html', reload() {} },
    Event: function (t) { this.type = t; }, URL, URLSearchParams, setTimeout, clearTimeout, setInterval: () => 0, clearInterval() {},
    console, Promise, JSON, Math, Date: Clock, Object, Array, String, Number, isFinite
  };
  win.window = win; Object.assign(ctx, win); vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/v2-chain.js'), 'utf8'), ctx, { filename: 'v2-chain.js' });
  box.M = ctx.window.V2Mock || ctx.V2Mock;
  return box;
}
function bootSession(extra) {
  const box = { n: 0 };
  const rows = [{ block_index: 100, tx_hash: 'a' }];
  const ls = memStore(), ss = memStore();
  ls.setItem('xcpets-v2-me', ADDR);
  ls.setItem('xcpets-v2-prod-hashes', JSON.stringify({ 100: 'h100' }));
  ss.setItem('xcpets-v2-prod-rows', JSON.stringify(Object.assign({ at: Date.now(), rows, tip: 100, mempool: [], me: ADDR }, extra)));
  class Chain { balance() { box.n++; return Promise.resolve(extra.balanceAt ? '400000000' : '800000000'); } }
  const win = {
    V2Rules: { replay: () => ({ pets: [], tip: 100 }) },
    LiveEngine: { CFG: { asset: 'XCPETS' }, Chain, RealCore: {} },
    addEventListener() {}, dispatchEvent() {}, XCPETS_BLOCK_HASHES: {}
  };
  const doc = {
    readyState: 'complete', currentScript: { src: 'https://x/js/v2-chain.js?v=abcdef1234' }, scripts: [],
    getElementById: () => ({ id: 'v2boot', textContent: '', style: {}, className: '', remove() {}, querySelector: () => null, isConnected: false }),
    querySelector: () => null, createElement: () => ({ style: {}, setAttribute() {}, appendChild() {}, remove() {} }),
    body: { insertBefore() {}, appendChild() {} }, addEventListener() {}, hidden: true
  };
  const ctx = {
    window: win, document: doc, localStorage: ls, sessionStorage: ss, location: { search: '', href: 'https://x/play.html', reload() {} },
    Event: function (t) { this.type = t; }, URL, URLSearchParams, setTimeout, clearTimeout, setInterval, clearInterval,
    console, Promise, JSON, Math, Date, Object, Array, String, Number, isFinite
  };
  win.window = win; Object.assign(ctx, win); vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/v2-chain.js'), 'utf8'), ctx, { filename: 'v2-chain.js' });
  box.M = ctx.window.V2Mock || ctx.V2Mock; box.ss = ss;
  return box;
}
