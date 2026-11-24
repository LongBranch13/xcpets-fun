#!/usr/bin/env node
/* Spam City shelves (Nov 24 2026, Jake: 'spam city games takes a long time reading the chain'). node tools/spam-city-shelves-test.js
 * Runs js/v2-sales.js against a stub page and checks how the shop gets its order book:
 *  1. the server's live book within 2.5 s is used as before (no browser replay);
 *  2. live not ready -> the book published with the world paints at once, with a 'Shelves from block N' line;
 *  3. a wallet step on published shelves reads the newest book first (live answer, else the browser replay), then opens;
 *  4. a live answer that lands late replaces the published shelves;
 *  5. with neither, the browser replay runs (the old path). */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'js/v2-sales.js'), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('ok  ', m); } else { fail++; console.log('FAIL', m); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

function el(id) { return { id, innerHTML: '', textContent: '', style: {}, isConnected: true, querySelector() { return null; }, querySelectorAll() { return []; }, appendChild() {}, setAttribute() {}, removeAttribute() {}, scrollIntoView() {} }; }
function page(opts) {
  const els = {}, get = id => els[id] || (els[id] = el(id));
  const fetched = [];
  const pet = { id: 7, species: 'pepe', name: 'Listed Pepe', tier: 1, stage: 2, owner: 'bcSeller', stats: {}, gear: [], deed: 'A100' };
  const pack = (tip, extra) => Object.assign({ ok: true, tip, listings: [{ n: 1, petId: 7, seller: 'bcSeller', give: 'A100', asset: 'XCPETS', price: 5e9, expire: tip + 100, order: 'ab' }], pets: [pet], deeds: { A100: { petId: 7, holder: 'bcSeller' } }, orders: [{ tx_hash: 'ab', status: 'open' }] }, extra || {});
  const V = new Proxy({ salesGate: 1, salesOn: () => true, openListings: w => (w.listings || []).slice(), buyGuard: () => null, saleState: () => 'open', petFilter: (w, xs) => xs, saleAmountText: () => '50 XCPETS',
    petPower: () => 10, oldMoney: () => false, deedOf: () => null, speciesLabel: s => s, buyPlan: S => ({ label: 'Buy #' + S.petId, petId: S.petId }), spamCityGate: () => 1 }, { get: (t, k) => k in t ? t[k] : (() => []) });
  const view = { _view: true, tip: 1000, pets: [], byId: {}, deeds: {}, items: {}, itemList: [], players: {}, playerAddr: {} };
  const sent = [];
  const win = {
    V2Rules: V, location: { search: '', hash: '', href: 'https://xcpets.fun/shop.html' }, history: { replaceState() {} },
    sessionStorage: { getItem: () => null, setItem() {} }, localStorage: { getItem: () => null, setItem() {} },
    setTimeout, clearTimeout, setInterval: () => 0, Promise, CustomEvent: function (n) { this.type = n; },
    fetch: (u) => { fetched.push(String(u)); return Promise.reject(new Error('offline')); },
    V2PetFilter: { load: () => ({}), html: () => '', bind() {}, species: () => [], badge: () => '' },
    V2Mock: { ME: 'bcBuyer', world: () => view, state: () => ({ tip: 1000 }), boot: f => f() },
    V2Wallet: { sendDex: plan => { sent.push(plan); return Promise.resolve({ txid: 'tx' }); } },
    V2Split: { serverShop: () => { win.liveAsks++; return opts.live(win.liveAsks, pack); }, publishedShop: () => opts.pub(pack) },
    liveAsks: 0, events: [], addEventListener() {}
  };
  win.window = win; win.self = win;
  win.document = { getElementById: get, querySelectorAll: () => [], addEventListener() {}, dispatchEvent: e => { win.events.push(e.type); }, hidden: false, scripts: [], createElement: () => el('x') };
  get('shop'); get('shModal'); get('toasts');
  vm.createContext(win); vm.runInContext(SRC, win, { filename: 'js/v2-sales.js' });
  return { win, get, fetched, sent };
}
(async () => {
  /* 1. live in time */
  let P = page({ live: (n, pack) => Promise.resolve(pack(1006)), pub: pack => Promise.resolve(pack(1000, { published: true })) });
  P.win.V2Sales.start(); await sleep(50);
  ok(P.win.__xcpShopSrc === 'server' && /Listed Pepe/.test(P.get('shop').innerHTML) && !/Shelves from block/.test(P.get('shop').innerHTML), 'live book in time: used as before, no shelves note');
  ok(!P.fetched.some(u => /api\/boot\.json/.test(u)), 'live book in time: no browser replay');

  /* 2 + 3. live not ready, published shelves; Buy reads the newest book first */
  P = page({ live: (n, pack) => Promise.resolve(n >= 2 ? pack(1006) : null), pub: pack => Promise.resolve(pack(1000, { published: true })) });
  const t0 = Date.now(); P.win.V2Sales.start(); await sleep(50);
  ok(P.win.__xcpShopSrc === 'published' && /Listed Pepe/.test(P.get('shop').innerHTML) && Date.now() - t0 < 1000, 'live not ready: the published shelves paint at once');
  ok(/Shelves from block 1,000/.test(P.get('shop').innerHTML), 'published shelves say which block they are from');
  P.win.V2Sales._buy(1);
  ok(/One moment/.test(P.get('shModal').innerHTML) && P.sent.length === 0, 'Buy on published shelves waits for the newest blocks (no wallet window yet)');
  await sleep(50);
  ok(P.win.__xcpShopSrc === 'server' && /Buy #7\?/.test(P.get('shModal').innerHTML) && !/Shelves from block/.test(P.get('shop').innerHTML), 'then the newest book is used and the Buy window opens');
  ok(P.win.events.includes('v2sales:fresh'), 'the scene is told the book changed');

  /* Buy on published shelves when the server is still not ready: the browser replay is the check (fails here = nothing sent) */
  P = page({ live: () => Promise.resolve(null), pub: pack => Promise.resolve(pack(1000, { published: true })) });
  P.win.V2Sales.start(); await sleep(2700);
  ok(P.win.__xcpShopSrc === 'published', 'server still not ready: shelves stay the published copy');
  P.win.V2Sales._buy(1); await sleep(100);
  ok(P.fetched.some(u => /api\/boot\.json/.test(u)) && /Not yet/.test(P.get('shModal').innerHTML) && P.sent.length === 0, 'Buy then runs the full read on this device first; if it fails nothing is sent');

  /* 4. late live answer replaces the shelves */
  P = page({ live: (n, pack) => n === 1 ? sleep(3200).then(() => pack(1006)) : Promise.resolve(null), pub: pack => Promise.resolve(pack(1000, { published: true })) });
  P.win.V2Sales.start(); await sleep(2700);
  ok(P.win.__xcpShopSrc === 'published', 'slow live answer: the published shelves show after 2.5 s');
  await sleep(800);
  ok(P.win.__xcpShopSrc === 'server' && !/Shelves from block/.test(P.get('shop').innerHTML), 'the late live answer replaces them');

  /* 5. neither: the browser replay (old path) */
  P = page({ live: () => Promise.resolve(null), pub: () => Promise.resolve(null) });
  P.win.V2Sales.start(); await sleep(100);
  ok(P.fetched.some(u => /api\/boot\.json/.test(u)) && /Could not read the order book/.test(P.get('shop').innerHTML), 'no live and no published book: the browser replay runs, as before');

  console.log(`spam-city-shelves-test: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
