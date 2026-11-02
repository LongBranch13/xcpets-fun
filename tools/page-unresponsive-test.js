#!/usr/bin/env node
/* page-unresponsive-fix (2026-10-27): js/v2-chain.js must never run the full replay on the main thread while the replay worker can do it.
 * Profiled on the owner's laptop, a UI poller (v2-badges peek -> world) hit the gap between the data load and the worker start (the
 * cross-visit IndexedDB read) and replayed for 27 s on the main thread: Chrome's "Page unresponsive". This loads js/v2-chain.js in a vm with a
 * fake worker / IndexedDB / V2Rules, polls world() every 10 ms like the pages do, and counts main-thread replays of real rows.
 *   node tools/page-unresponsive-test.js [path/to/v2-chain.js] */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..'), FILE = process.argv[2] || path.join(ROOT, 'js/v2-chain.js'), src = fs.readFileSync(FILE, 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
function store() { const m = {}; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: k => { delete m[k]; } }; }
function harness(o) {
  const rows = [{ block_index: 100, tx_hash: 'a' }, { block_index: 101, tx_hash: 'b' }], hashes = { 100: 'h100', 101: 'h101' };
  const ls = store(), ss = store(); ls.setItem('xcpets-v2-prod-hashes', JSON.stringify(hashes));
  ss.setItem('xcpets-v2-prod-rows', JSON.stringify({ at: Date.now(), rows, tip: 105, mempool: [], me: '', balance: 0 }));
  const st = { main: 0, posts: 0, terms: 0 };
  const RS = ['rjs/config.js', 'rjs/pet-core.js', 'rjs/game-core.js', 'rjs/bonus-gear.js', 'rjs/real-core.js', 'rjs/chain.js', 'js/pet-core.js', 'js/bonus-gear.js', 'js/v2-gear.js', 'js/v2-fit.js', 'js/v2-rules.js'];
  class FakeWorker { constructor() { this.dead = false; } postMessage(m) { st.posts++; setTimeout(() => { if (this.dead || !this.onmessage) return; this.onmessage({ data: { id: m.id, ok: true, world: { fromWorker: true, n: m.rows.length, ops: JSON.stringify(m.ops) }, ms: o.wkMs } }); }, o.wkMs); } terminate() { st.terms++; this.dead = true; } }
  const idb = { open() { const r = {}; setTimeout(() => { r.result = { close() {}, transaction() { return { objectStore() { return { get() { const q = {}; setTimeout(() => { q.result = undefined; q.onsuccess && q.onsuccess(); }, o.idbMs); return q; } }; } }; } }; r.onsuccess && r.onsuccess(); }, 1); return r; } };
  const win = { V2Rules: { replay: (r) => { if (r.length) st.main++; return { main: true, n: r.length }; } }, LiveEngine: { CFG: { isMainnet: true }, RealCore: {} }, XCPETS_BLOCK_HASHES: {} };
  const doc = { currentScript: { src: 'https://x/js/v2-chain.js?v=abcdef1234' }, scripts: RS.map(f => ({ src: 'https://x/' + f + '?v=abcdef1234' })), getElementById: () => null, querySelector: () => null, body: { insertBefore() {}, firstChild: null } };
  const ctx = { window: win, document: doc, localStorage: ls, sessionStorage: ss, indexedDB: idb, Worker: FakeWorker, location: { search: '', href: 'https://x/play.html' }, URL, URLSearchParams, setTimeout, clearTimeout, setInterval: () => 0, console, Promise, JSON, Math, Date, Object, Array, String, Number };
  win.window = win; Object.assign(ctx, win); vm.createContext(ctx); vm.runInContext(src, ctx);
  return { M: ctx.window.V2Mock || ctx.V2Mock, st };
}
(async () => {
  /* 1. boot from the 60 s session copy: IndexedDB read (300 ms) then the worker (400 ms); pollers every 10 ms */
  { const { M, st } = harness({ idbMs: 300, wkMs: 400 }); let booted = false; M.boot(() => { booted = true; });
    const iv = setInterval(() => { M.world(); M.peek(); }, 10); await sleep(1200); clearInterval(iv);
    const w = M.world(); ok(booted, 'boot finished'); ok(st.main === 0, 'boot: no main-thread replay while the IDB read / worker run (got ' + st.main + ')'); ok(w && w.fromWorker, 'boot: the world came from the worker'); }
  /* 2. local ops change while the worker runs: its answer no longer fits -> the next replay also runs in the worker, never on the main thread */
  { const { M, st } = harness({ idbMs: 50, wkMs: 400 }); M.boot(() => {}); await sleep(150);
    const S = M.state(); S.ops = [{ k: 'equip', id: 1 }]; M.save();
    const iv = setInterval(() => { M.world(); M.peek(); }, 10); await sleep(1500); clearInterval(iv);
    const w = M.world(); ok(st.main === 0, 'ops changed mid-run: no main-thread replay (got ' + st.main + ')'); ok(w && w.fromWorker && w.ops === JSON.stringify(S.ops), 'ops changed mid-run: world from a 2nd worker run with the new ops'); }
  /* 3. source checks: one job at a time, a longer worker limit, replay inputs unchanged */
  ok(/WORKER_MS = 120000/.test(src), 'worker limit 120 s (laptop worker replays measured 22-39 s)');
  ok(!/wkOff = true; wkKill\(\); fin\(\); \}, WORKER_MS/.test(src) && /setTimeout\(slow, WORKER_MS\)/.test(src), 'a slow worker is waited for, never a main-thread fallback');
  ok(!/wkBusy = 0; try \{ world\(\)/.test(src), 'burn check no longer forces a main-thread rebuild');
  ok(/if \(pend\) \{ if \(pend\.sig === sig0 && pend\.oj === oj0\) return pend\.p;/.test(src), 'same inputs join the running worker job');
  ok(/wk\.postMessage\(\{ id: id, scripts: urls, rows: S\.rows, hashes: S\.hashes, ops: ops, tip: S\.tip, dex: S\.dex \|\| undefined, idbKey: key \}\)/.test(src), 'worker gets the same replay inputs');
  ok(/cache = V\.replay\(S\.rows, S\.hashes, S\.ops, \{ tip: S\.tip, live: E\.RealCore, dex: S\.dex \|\| undefined \}\)/.test(src), 'main-thread fallback replay unchanged');
  console.log('page-unresponsive-test: ' + pass + ' pass, ' + fail + ' fail'); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL error', e && e.stack); process.exit(1); });
