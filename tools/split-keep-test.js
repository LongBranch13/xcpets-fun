#!/usr/bin/env node
/* The saved-shard store in js/v2-split.js (keepPut / keepFlush), run in Node with a pretend IndexedDB.
 * Guards the crash the layout robot caught on play.html on Nov 25 2026: "Cannot read properties of undefined (reading 'sig')".
 * A flush waits on the database for each shard; a shard that arrived meanwhile re-armed the timer, so a second flush started
 * with the same shard name in its list, found keepQ[nm] already taken by the first, and threw.
 *   node tools/split-keep-test.js */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const SRC = fs.readFileSync(path.join(__dirname, '../js/v2-split.js'), 'utf8');
let fails = 0, n = 0; const ok = (c, m) => { n++; console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };

/* the smallest pretend IndexedDB the store needs: get / put, each answering on a later tick */
function fakeIDB() {
  const data = new Map();
  const soon = (o, k, v) => setTimeout(() => { o[k] = v; if (o['on' + k.slice(2)]) {} if (typeof o.onsuccess === 'function' && k === 'result') o.onsuccess(); }, 1);
  const store = {
    get(key) { const r = {}; setTimeout(() => { r.result = data.get(key); if (r.onsuccess) r.onsuccess(); }, 1); return r; },
    put(val, key) { data.set(key, val); return {}; },
  };
  const tx = { objectStore: () => store };
  setTimeout(() => {}, 0);
  return { open() { const r = { result: { createObjectStore() {}, transaction() { const t = Object.assign({}, tx); setTimeout(() => { if (t.oncomplete) t.oncomplete(); }, 2); return t; } } }; setTimeout(() => { if (r.onsuccess) r.onsuccess(); }, 1); return r; }, data, soon };
}

const idb = fakeIDB();
const errors = [];
const ctx = {
  window: {}, document: { addEventListener() {}, createElement: () => ({ style: {}, classList: { add() {}, remove() {}, contains: () => false }, appendChild() {}, setAttribute() {} }), querySelector: () => null, querySelectorAll: () => [], getElementById: () => null, body: { appendChild() {} }, documentElement: { classList: { add() {}, remove() {}, contains: () => false } }, hidden: false },
  location: { search: '', hash: '', href: 'http://localhost/play.html', origin: 'http://localhost', pathname: '/play.html' },
  localStorage: { _d: { 'xcpets-v2-me': 'bc1qme' }, getItem(k) { return this._d[k] == null ? null : this._d[k]; }, setItem(k, v) { this._d[k] = String(v); }, removeItem(k) { delete this._d[k]; } },
  indexedDB: idb, URLSearchParams, URL, fetch: () => Promise.reject(new Error('no network in this test')), setTimeout, clearTimeout, setInterval: () => 0, clearInterval() {}, console,
  performance: { now: () => Date.now() }, navigator: { userAgent: 'node' }, matchMedia: () => ({ matches: false, addEventListener() {} }), Promise, Date, Math, JSON, Object, Array, String, Number, Error, crypto: { subtle: {} },
};
ctx.window = ctx; ctx.self = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
try { vm.runInContext(SRC, ctx, { filename: 'v2-split.js' }); } catch (e) { console.log('FAIL could not load js/v2-split.js: ' + e.message); process.exit(1); }
const S = ctx.V2Split;
ok(!!(S && S._keep), 'js/v2-split.js exposes its saved-shard store for this test');
const K = S._keep;

/* keepStart(rsig) is what the page calls before any shard is saved */
ok(typeof S._keep.start === 'function', 'the store takes a rules signature (keepStart)');
S._keep.start('test-rsig');
const pack = { v: 1, pets: { 7: { id: 7, care: 1 }, 8: { id: 8, care: 2 } } };

(async () => {
  K.put('00003', 'sig-a', pack, [7]);
  ok(Object.keys(K.q()).length === 1 || !Object.keys(K.q()).length, 'a downloaded shard is queued to be saved');
  /* the race: flush, then a second flush while the first is still waiting on the database */
  K.flush();
  K.put('00003', 'sig-a', pack, [8]);
  K.flush();
  K.flush();
  await new Promise(r => setTimeout(r, 400));
  ok(!errors.length, 'two flushes at once do not throw (" reading \'sig\' " on play.html)');
  ok(!K.busy(), 'the store is idle again when the queue is empty');
  const saved = [...idb.data.values()];
  if (process.env.DBG) console.log('DBG', saved.length, JSON.stringify(saved).slice(0, 300), 'queue', JSON.stringify(K.q()).slice(0, 200));
  ok(saved.length >= 1 && saved[0].pets && Object.keys(saved[0].pets).length >= 1, 'the shard was still saved (' + (saved[0] && Object.keys(saved[0].pets).length) + ' pets)');
  console.log(`split-keep: ${n - fails} passed, ${fails} failed`); process.exit(fails ? 1 : 0);
})().catch(e => { console.log('FAIL ' + e.message); process.exit(1); });

process.on('uncaughtException', e => { errors.push(e); });
