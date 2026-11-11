#!/usr/bin/env node
/* chores-fresh-1110: the Daily Chores safety check was blaming the Counterparty servers when this browser was still
 * rebuilding pets. Same burns + sale data must proceed without that wait. Changed data must wait, with an updating
 * message, not an 8s "servers did not answer". A real read failure still signs nothing. Cancel still stops a burn
 * that has not reached the wallet. Compose stays on the public Core nodes.
 *   node tools/fresh-check-test.js */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const BC = require(path.join(ROOT, 'rjs/burn-core.js'));
const WL = require(path.join(ROOT, 'rjs/wallet.js'));
const TXF = require('./lib/txfake.js');
const make = require(path.join(ROOT, 'js/v2-wallet.js'));
const ME = 'bc1ps9av86ymmlzy9zj3a8pn6g94pz4j5e0kagv3td3wutaagfjvekjs26m3s4';
const TAG = 'pet:fl:N04.N05.N0T.N24.N32', AMT = 10350;
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.log('FAIL', m); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

function good(q) {
  return { status: 200, json: () => Promise.resolve({ result: TXF.result('destroy', ME, { asset: 'XCPETS', quantity: +q.get('quantity'), tag: q.get('tag') }, { type: 110, bodyHex: TXF.destroyBody('XCPETS', +q.get('quantity'), q.get('tag')) }) }) };
}
function rig(o) {
  const calls = [], phases = [], urls = [], mem = {};
  const storage = { getItem: k => mem[k] == null ? null : mem[k], setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
  const state = o.state || { prod: true, verified: false, stale: true, provisional: false, balance: 1e12 };
  if (state.prod == null) state.prod = true; if (state.balance == null) state.balance = 1e12;
  let updating = o.updating != null ? o.updating : true;
  const mock = {
    prod: true,
    state: () => state,
    updating: () => updating,
    whenFresh: o.whenFresh || (() => new Promise(() => {}))
  };
  const win = {
    V2Mock: mock,
    xcpwallet: { on() {}, request(a) { calls.push(a.method);
      if (a.method === 'xcp_requestAccounts') return Promise.resolve({ accounts: [ME] });
      if (a.method === 'xcp_getNetwork') return Promise.resolve('mainnet');
      if (a.method === 'xcp_signTransaction') { const e = new Error('User rejected (test wallet never signs)'); e.code = 4001; return Promise.reject(e); }
      return Promise.reject(new Error('test wallet: refused ' + a.method)); } },
    addEventListener() {}, removeEventListener() {}, setTimeout, clearTimeout, sessionStorage: storage, location: { search: '', pathname: '/play.html' }, document: null
  };
  global.window = win;
  const fetch = o.fetch || ((u) => { urls.push(String(u));
    if (/fees\/precise/.test(u)) return Promise.resolve({ status: 404, json: () => Promise.resolve({}) });
    if (/fees\/recommended/.test(u)) return Promise.resolve({ status: 200, json: () => Promise.resolve({ hourFee: 1 }) });
    if (/compose\/destroy/.test(u)) return Promise.resolve(good(new URL(u).searchParams));
    return Promise.resolve({ status: 404, json: () => Promise.resolve({}) }); });
  const CFG = Object.assign({ network: 'mainnet', asset: 'XCPETS', mempoolApi: 'https://mempool.space/api', compose: 'https://api.counterparty.io:4000/v2', composeList: ['https://api.counterparty.io:4000/v2', 'https://api.unspendablelabs.com:4000/v2'], read: ['https://node.xcpets.fun/v2'] }, o.cfg || {});
  const W = make(Object.assign({ Wallet: WL, BurnCore: BC, CFG, win, fetch, storage, backoffMs: 1, composeMs: 4000, feeMs: 400, composeTotalMs: 8000, freshMs: o.freshMs != null ? o.freshMs : 700 }, o.deps || {}));
  const run = (recheck) => W.send({ tag: TAG, amount: AMT, label: 'Daily chores' }, ME, (a, b, ph) => phases.push(ph || ('node' + a)), recheck);
  return { W, calls, phases, urls, state, mock, run, setUpdating: v => { updating = v; } };
}
function settle(p, ms) { return Promise.race([p.then(v => ({ s: 'ok', v }), e => ({ s: 'err', e })), new Promise(r => setTimeout(() => r({ s: 'HUNG' }), ms))]); }
const serverBlame = e => /did not answer|Could not reach the Counterparty servers/.test((e && e.message) || '');

function store() { const m = {}; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: k => { delete m[k]; }, length: 0, key: () => null }; }
function chainHarness(o) {
  const nodes = [];
  const el = () => { const e = { id: '', style: {}, textContent: '', className: '', children: [], classList: { add() {}, remove() {} }, setAttribute() {}, appendChild(c) { this.children.push(c); return c; }, querySelector: () => null, addEventListener() {}, remove() { const i = nodes.indexOf(e); if (i >= 0) nodes.splice(i, 1); } }; return e; };
  const rows = [];
  for (let i = 0; i < 4; i++) rows.push({ block_index: 100 + i, tx_hash: 't' + i, source: 'bc1qx', asset: 'XCPETS', quantity: 1e8, tag: 'pet:hatch', status: 'valid' });
  const hashes = {}; rows.forEach(r => { hashes[r.block_index] = 'h' + r.block_index; });
  const ls = store(), ss = store();
  ls.setItem('xcpets-v2-prod-hashes', JSON.stringify(hashes));
  ss.setItem('xcpets-v2-prod-rows', JSON.stringify({ at: Date.now(), rows, tip: 104, mempool: [], me: '', balance: 0 }));
  let tipNow = 104, posts = 0;
  const firstMs = o.firstMs != null ? o.firstMs : 40, nextMs = o.nextMs != null ? o.nextMs : 900;
  class Chain {
    getJson(p) { if (/mempool/.test(p)) return Promise.resolve({ result: [] }); return Promise.resolve({ result: rows.slice(), next_cursor: null, result_count: rows.length }); }
    tip() { return Promise.resolve(tipNow); }
    balance() { return Promise.resolve(0); }
    blockHashes(list) { const h = {}; list.forEach(b => { h[b] = hashes[b] || ('h' + b); }); return Promise.resolve({ hashes: h, missing: [] }); }
  }
  class FakeWorker { postMessage(m) { posts++; const delay = posts === 1 ? firstMs : nextMs; const n = posts;
    setTimeout(() => { if (!this.onmessage) return; this.onmessage({ data: { id: m.id, ok: true, world: { fromWorker: true, tip: tipNow, pets: [{ id: n }], pending: false }, ms: delay } }); }, delay); }
  terminate() {} }
  const saved = o.saved === undefined ? null : o.saved;
  const idb = { open() { const r = {}; setTimeout(() => { r.result = { close() {}, transaction() { return { objectStore() { return { get() { const q = {}; setTimeout(() => { q.result = saved; q.onsuccess && q.onsuccess(); }, 5); return q; } }; } }; } }; r.onsuccess && r.onsuccess(); }, 1); return r; } };
  const RS = ['rjs/config.js', 'rjs/pet-core.js', 'rjs/game-core.js', 'rjs/bonus-gear.js', 'rjs/real-core.js', 'rjs/chain.js', 'js/pet-core.js', 'js/bonus-gear.js', 'js/v2-gear.js', 'js/v2-fit.js', 'js/v2-rules.js'];
  const win = { V2Rules: { replay: () => ({ main: true, pets: [], pending: false }) }, LiveEngine: { CFG: { isMainnet: true, asset: 'XCPETS' }, Chain, RealCore: {} }, XCPETS_BLOCK_HASHES: {}, addEventListener() {}, dispatchEvent() {} };
  const doc = { readyState: 'complete', hidden: true, currentScript: { src: 'https://x/js/v2-chain.js?v=abcdef1234' }, scripts: RS.map(f => ({ src: 'https://x/' + f + '?v=abcdef1234' })),
    getElementById: id => nodes.find(n => n.id === id) || null, querySelector: () => null, querySelectorAll: () => [], createElement: () => el(), activeElement: null,
    body: { insertBefore(n) { n.id = n.id || ''; nodes.push(n); }, appendChild(n) { nodes.push(n); }, firstChild: null }, addEventListener() {} };
  const ctx = { window: win, document: doc, localStorage: ls, sessionStorage: ss, indexedDB: saved ? idb : undefined, Worker: FakeWorker, location: { search: '', href: 'https://x/play.html', reload() {} }, Event: function (t) { this.type = t; }, URL, URLSearchParams, setTimeout, clearTimeout, setInterval, clearInterval, console, Promise, JSON, Math, Date, Object, Array, String, Number, fetch: () => Promise.reject(new Error('no')) };
  win.window = win; Object.assign(ctx, win); vm.createContext(ctx); vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/v2-chain.js'), 'utf8'), ctx, { filename: 'v2-chain.js' });
  return { M: ctx.V2Mock || ctx.window.V2Mock, setTip: t => { tipNow = t; }, posts: () => posts };
}

(async () => {
  const cfg = fs.readFileSync(path.join(ROOT, 'rjs/config.js'), 'utf8');
  ok(/read: \[READ_CACHE, COUNTERPARTY_CORE, CORE_BACKUP\]/.test(cfg), 'mainnet reads still try the cache first');
  ok(/composeList: \[COUNTERPARTY_CORE, CORE_BACKUP\]/.test(cfg), 'compose list is still the two public Core nodes');
  ok(!/composeList:[^\n]*READ_CACHE/.test(cfg), 'compose list does not include the read cache');

  /* (a) same verified data, pet world still rebuilding: proceed, no server error, wallet is reached */
  { const t0 = Date.now(), r = rig({ state: { verified: true, stale: true }, updating: true, whenFresh: () => sleep(40).then(() => ({ ok: true, same: true })) });
    const x = await settle(r.run({ snap: () => '{}', still: () => null }), 4000);
    ok(x.s === 'err' && x.e && x.e.code === 4001, 'same-data burn reaches the wallet (test wallet rejects, nothing broadcast) ' + (x.e && x.e.message));
    ok(r.calls.includes('xcp_signTransaction'), 'same-data burn asked the wallet to sign');
    ok(!serverBlame(x.e), 'same-data burn is not a server timeout');
    ok(Date.now() - t0 < 500, 'same-data burn did not wait out the 8s cap (' + (Date.now() - t0) + ' ms)');
    ok(!r.urls.some(u => /node\.xcpets\.fun/.test(u)), 'compose did not use the read cache: ' + r.urls.filter(u => /compose/.test(u)).join(' '));
    ok(r.urls.some(u => /api\.counterparty\.io:4000/.test(u)), 'compose used the public Core node'); }

  /* (a2) the read is already verified and the rebuild runs past the old 8s cap: still not a server error */
  { const t0 = Date.now(), r = rig({ freshMs: 500, state: { verified: true, stale: false }, updating: true, whenFresh: () => sleep(900).then(() => ({ ok: true, same: true })) });
    const x = await settle(r.run({ snap: () => '{}', still: () => null }), 4000);
    ok(x.s === 'err' && x.e && x.e.code === 4001, 'slow same-data rebuild still reaches the wallet');
    ok(Date.now() - t0 >= 800, 'it waited for the fresh check (' + (Date.now() - t0) + ' ms)');
    ok(r.phases.indexOf('world') >= 0, 'progress says the pets are updating on this device, phases ' + r.phases.join(','));
    ok(!serverBlame(x.e), 'a local rebuild past the old cap is not a server timeout'); }

  /* (b) burns changed: wait for the update, accurate message, then recheck can let it proceed */
  { const t0 = Date.now(); const state = { prod: true, verified: false, stale: true, provisional: false, balance: 1e12 };
    const box = {};
    const r = rig({ freshMs: 400, state, updating: true, whenFresh: () => sleep(150).then(() => { state.verified = true; return sleep(700); }).then(() => { box.setUpdating(false); return { ok: true, same: false }; }) });
    box.setUpdating = r.setUpdating;
    const x = await settle(r.run({ snap: () => '{}', still: () => null }), 4000);
    ok(x.s === 'err' && x.e && x.e.code === 4001, 'changed data that still matches this burn reaches the wallet after the update');
    ok(Date.now() - t0 >= 800, 'changed data waited for the update (' + (Date.now() - t0) + ' ms), not the 400ms server cap');
    ok(r.phases.indexOf('world') >= 0, 'changed-data wait says pets are updating, phases ' + r.phases.join(','));
    ok(!serverBlame(x.e), 'changed-data wait is not a server timeout');
    ok(state.verified === true, 'the read had verified before the wait finished'); }

  /* (b2) changed data that fails the recheck stops with the change, and signs nothing */
  { const r = rig({ freshMs: 300, state: { verified: true, stale: true }, updating: true, whenFresh: () => sleep(500).then(() => ({ ok: true, same: false })) });
    const x = await settle(r.run({ snap: () => '{}', still: () => 'a pet in this burn changed (owner, stage or meal)' }), 4000);
    ok(x.s === 'err' && /a pet in this burn changed/.test(x.e.message), 'changed pet stops the burn: ' + (x.e && x.e.message));
    ok(!serverBlame(x.e), 'that stop does not blame the servers');
    ok(!r.calls.includes('xcp_signTransaction'), 'changed pet signs nothing'); }

  /* (c) the servers never answer: server error, nothing signed */
  { const t0 = Date.now(), r = rig({ freshMs: 450, state: { verified: false, stale: true }, updating: false, whenFresh: () => new Promise(() => {}) });
    const x = await settle(r.run(), 3000);
    ok(x.s === 'err' && /did not answer in time/.test(x.e.message), 'silent servers: ' + (x.e && x.e.message));
    ok(x.e.retry === true, 'the button can retry');
    ok(!r.calls.includes('xcp_signTransaction'), 'silent servers sign nothing');
    ok(Date.now() - t0 >= 400 && Date.now() - t0 < 2000, 'the server cap still ends the wait (' + (Date.now() - t0) + ' ms)'); }
  { const r = rig({ state: { verified: false, stale: true }, updating: false, whenFresh: () => Promise.resolve({ ok: false, same: false }) });
    const x = await settle(r.run(), 2000);
    ok(x.s === 'err' && /Could not reach the Counterparty servers/.test(x.e.message), 'failed read: ' + (x.e && x.e.message));
    ok(!r.calls.includes('xcp_signTransaction'), 'failed read signs nothing'); }

  /* verified gate stays closed when the read never verified, even if nothing looks busy */
  { const r = rig({ state: { verified: false, stale: false }, updating: false });
    const x = await settle(r.run(), 2000);
    ok(x.s === 'err' && /verify every block|out of date/.test(x.e.message) && !r.calls.includes('xcp_signTransaction'), 'unverified burn still signs nothing: ' + (x.e && x.e.message)); }

  /* a provisional older world is not "same data": still refuse while it is showing */
  { const r = rig({ state: { verified: true, stale: false, provisional: true }, updating: true, whenFresh: () => Promise.resolve({ ok: true, same: true }) });
    const x = await settle(r.run({ snap: () => '{}', still: () => null }), 2000);
    ok(x.s === 'err' && /Still updating pets/.test(x.e.message) && !r.calls.includes('xcp_signTransaction'), 'provisional world does not sign: ' + (x.e && x.e.message)); }

  /* (e) cancel before the wallet, including during a local rebuild that has already verified */
  { const r = rig({ freshMs: 2000, state: { verified: false, stale: true }, updating: false, whenFresh: () => new Promise(() => {}) });
    const p = r.run(); setTimeout(() => r.W.cancel(), 80);
    const x = await settle(p, 2000);
    ok(x.s === 'err' && x.e && x.e.cancelled && !r.calls.includes('xcp_signTransaction'), 'cancel during the server read signs nothing: ' + (x.e && x.e.message)); }
  { const r = rig({ freshMs: 400, state: { verified: true, stale: false }, updating: true, whenFresh: () => new Promise(() => {}) });
    const p = r.run(); setTimeout(() => r.W.cancel(), 200);
    const x = await settle(p, 2000);
    ok(x.s === 'err' && x.e && x.e.cancelled, 'cancel during the pet rebuild: ' + (x.e && x.e.message));
    ok(!serverBlame(x.e), 'cancel during the rebuild is not a server timeout');
    ok(!r.calls.includes('xcp_signTransaction'), 'cancel during the rebuild signs nothing'); }

  /* shop / DEX uses the same fresh gate: same data proceeds, a silent read is a server error, a local rebuild is not */
  const dexPlan = { kind: 'order', give_asset: 'XCPETS', give_quantity: 100000000, get_asset: 'XCP', get_quantity: 1, expiration: 100, label: 'list' };
  { const r = rig({ state: { verified: true, stale: true }, updating: true, whenFresh: () => sleep(30).then(() => ({ ok: true, same: true })) });
    const x = await settle(r.W.sendDex(dexPlan, ME), 4000);
    ok(x.s === 'err' && !/Still updating pets/.test(x.e.message) && !/did not answer/.test(x.e.message), 'dex same-data is not refused as a rebuild or a server timeout: ' + (x.e && x.e.message));
    ok(r.calls.includes('xcp_requestAccounts') && !r.calls.includes('xcp_signTransaction'), 'dex same-data reaches the wallet and signs nothing on a bad compose');
    ok(!r.urls.some(u => /node\.xcpets\.fun/.test(u)), 'dex compose did not call the read cache'); }
  { const t0 = Date.now(), r = rig({ freshMs: 400, state: { verified: false, stale: true }, updating: false, whenFresh: () => new Promise(() => {}) });
    const x = await settle(r.W.sendDex(dexPlan, ME), 3000);
    ok(x.s === 'err' && /did not answer/.test(x.e.message) && !r.calls.includes('xcp_requestAccounts'), 'dex silent read signs nothing: ' + (x.e && x.e.message));
    ok(Date.now() - t0 >= 350 && Date.now() - t0 < 2000, 'dex silent read stops at the server cap (' + (Date.now() - t0) + ' ms)'); }
  { const t0 = Date.now(), r = rig({ freshMs: 300, state: { verified: true, stale: false }, updating: true, whenFresh: () => sleep(700).then(() => ({ ok: true, same: true })) });
    const x = await settle(r.W.sendDex(dexPlan, ME), 4000);
    ok(Date.now() - t0 >= 600 && x.s === 'err' && !/did not answer/.test(x.e.message), 'dex waits for a local rebuild without blaming the servers (' + (Date.now() - t0) + ' ms): ' + (x.e && x.e.message)); }

  /* a hung public node fails over to the other one; the read cache is never composed; Cancel aborts the request */
  { const seen = []; const t0 = Date.now();
    const r = rig({ state: { verified: true, stale: false }, updating: false, deps: { composeMs: 200, composeTotalMs: 5000, backoffMs: 1 },
      cfg: { composeList: ['https://node.xcpets.fun/v2', 'https://api.counterparty.io:4000/v2', 'https://api.unspendablelabs.com:4000/v2'] },
      fetch: (u, init) => { seen.push(String(u));
        if (/fees/.test(u)) return Promise.resolve({ status: 200, json: () => Promise.resolve({ hourFee: 1 }) });
        if (/counterparty\.io/.test(u)) return new Promise((_, j) => { const fail = () => { const e = new Error('aborted'); e.name = 'AbortError'; j(e); }; if (init && init.signal) init.signal.addEventListener('abort', fail); });
        if (/unspendablelabs/.test(u)) return Promise.resolve(good(new URL(u).searchParams));
        return Promise.resolve({ status: 404, json: () => Promise.resolve({}) }); } });
    const x = await settle(r.run(), 4000);
    ok(x.s === 'err' && x.e && x.e.code === 4001, 'failover reaches the wallet from the second Core node: ' + (x.e && x.e.message));
    ok(!seen.some(u => /node\.xcpets\.fun/.test(u)), 'compose never opened the read cache');
    ok(seen.some(u => /counterparty\.io/.test(u)) && seen.some(u => /unspendablelabs/.test(u)), 'the hung node was abandoned for the other public node');
    ok(Date.now() - t0 < 1500, 'failover did not sit on the hung node (' + (Date.now() - t0) + ' ms)'); }
  { const t0 = Date.now();
    const r = rig({ state: { verified: true, stale: false }, updating: false, deps: { composeMs: 5000, composeTotalMs: 20000 },
      fetch: (u, init) => { if (/fees/.test(u)) return Promise.resolve({ status: 200, json: () => Promise.resolve({ hourFee: 1 }) });
        return new Promise((_, j) => { const fail = () => { const e = new Error('aborted'); e.name = 'AbortError'; j(e); }; if (init && init.signal) init.signal.addEventListener('abort', fail); }); } });
    const p = r.run(); setTimeout(() => r.W.cancel(), 60);
    const x = await settle(p, 3000);
    ok(x.s === 'err' && x.e && x.e.cancelled && !r.calls.includes('xcp_signTransaction'), 'cancel during compose signs nothing: ' + (x.e && x.e.message));
    ok(Date.now() - t0 < 800, 'cancel does not wait out the node timeout (' + (Date.now() - t0) + ' ms)'); }

  /* chain: same burns do not wait for the worker; a provisional world still does */
  { const { M, setTip } = chainHarness({});
    await new Promise(res => M.boot(res));
    M.world();
    ok(!M.updating() && M.world() && M.world().fromWorker, 'first world is the worker world');
    M.state().stale = true; M.state().verified = false; setTip(110);
    const t0 = Date.now(); const r = await M.whenFresh();
    const ms = Date.now() - t0;
    ok(r && r.ok === true && r.same === true, 'same burns + sale data: whenFresh same (' + JSON.stringify(r) + ')');
    ok(ms < 500, 'same data did not wait for the pet rebuild (' + ms + ' ms)');
    ok(M.updating(), 'the worker was still rebuilding when the burn was allowed to proceed');
    await sleep(1000);
    ok(!M.updating(), 'the rebuild still finishes after the burn is allowed through'); }
  { const { M } = chainHarness({ firstMs: 700, saved: { key: 'oldbuild|oldsig|[]', world: { saved: true, tip: 90, pets: [{ id: 9 }] } } });
    M.boot(() => {});
    await sleep(80);
    ok(M.updating() && M.state().provisional, 'an older saved world is provisional');
    const t0 = Date.now(); const r = await M.whenFresh();
    ok(Date.now() - t0 >= 250, 'provisional world still waits for the fresh one (' + (Date.now() - t0) + ' ms)');
    ok(r && r.ok === true && r.same === false, 'provisional world is not treated as the same copy (' + JSON.stringify(r) + ')'); }

  console.log('fresh-check-test: ' + pass + ' pass, ' + fail + ' fail');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL error', e && e.stack); process.exit(1); });
