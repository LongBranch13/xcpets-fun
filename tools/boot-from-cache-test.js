#!/usr/bin/env node
/* boot-from-cache (owner approved 'Both', 2026-10-31 2:28 PM CT): js/v2-chain.js shows the last saved world from IndexedDB at once even when
 * its key is for an older tip / build / burns, rebuilds the fresh world in the worker, then repaints (onFresh hooks, or one guarded reload).
 * While the saved world shows, updating() is true and whenFresh() waits for the fresh world and reports same:false when it differs, so burns
 * and actions are re-judged on fresh state. Loads js/v2-chain.js in a vm with a fake worker / IndexedDB / V2Rules (as page-unresponsive-test).
 *   node tools/boot-from-cache-test.js [path/to/v2-chain.js] */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..'), FILE = process.argv[2] || path.join(ROOT, 'js/v2-chain.js'), src = fs.readFileSync(FILE, 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
function store() { const m = {}; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: k => { delete m[k]; } }; }
function el() { const e = { id: '', style: {}, textContent: '', children: [], setAttribute() {}, appendChild(c) { this.children.push(c); return c; }, querySelector: () => null, addEventListener() {}, remove() { const i = nodes.indexOf(e); if (i >= 0) nodes.splice(i, 1); }, set onclick(f) {} }; return e; }
let nodes = [];
function harness(o) {
  nodes = [];
  const rows = [{ block_index: 100, tx_hash: 'a' }, { block_index: 101, tx_hash: 'b' }], hashes = { 100: 'h100', 101: 'h101' };
  const ls = store(), ss = store(); ls.setItem('xcpets-v2-prod-hashes', JSON.stringify(hashes));
  ss.setItem('xcpets-v2-prod-rows', JSON.stringify({ at: Date.now(), rows, tip: 105, mempool: [], me: '', balance: 0 }));
  const st = { main: 0, posts: 0, reloads: 0, stored: null };
  const RS = ['rjs/config.js', 'rjs/pet-core.js', 'rjs/game-core.js', 'rjs/bonus-gear.js', 'rjs/real-core.js', 'rjs/chain.js', 'js/pet-core.js', 'js/bonus-gear.js', 'js/v2-gear.js', 'js/v2-fit.js', 'js/v2-rules.js'];
  class FakeWorker { postMessage(m) { st.posts++; setTimeout(() => { if (!this.onmessage) return; this.onmessage({ data: { id: m.id, ok: true, world: { fromWorker: true, tip: 105, pets: [{ id: 1 }, { id: 2 }] }, ms: o.wkMs } });
      setTimeout(() => { st.stored = m.idbKey; this.onmessage && this.onmessage({ data: { stored: true, key: m.idbKey } }); }, 20); }, o.wkMs); } terminate() {} }
  const saved = o.saved === undefined ? { key: 'oldbuild|oldsig|[]', world: { saved: true, tip: 99, pets: [{ id: 1 }] } } : o.saved;
  const idb = { open() { const r = {}; setTimeout(() => { r.result = { close() {}, transaction() { return { objectStore() { return { get() { const q = {}; setTimeout(() => { q.result = saved; q.onsuccess && q.onsuccess(); }, 20); return q; } }; } }; } }; r.onsuccess && r.onsuccess(); }, 1); return r; } };
  const win = { V2Rules: { replay: (r) => { if (r.length) st.main++; return { main: true, pets: [] }; } }, LiveEngine: { CFG: { isMainnet: true }, RealCore: {} }, XCPETS_BLOCK_HASHES: {}, addEventListener() {}, dispatchEvent() { st.ev = (st.ev || 0) + 1; } };
  const doc = { readyState: 'complete', currentScript: { src: 'https://x/js/v2-chain.js?v=abcdef1234' }, scripts: RS.map(f => ({ src: 'https://x/' + f + '?v=abcdef1234' })),
    getElementById: id => nodes.find(n => n.id === id) || null, querySelector: () => null, createElement: () => el(), activeElement: null,
    body: { insertBefore(n) { nodes.push(n); }, appendChild(n) { nodes.push(n); }, firstChild: null } };
  const ctx = { window: win, document: doc, localStorage: ls, sessionStorage: ss, indexedDB: idb, Worker: FakeWorker, location: { search: '', href: 'https://x/index.html', reload() { st.reloads++; } }, Event: function (t) { this.type = t; }, URL, URLSearchParams, setTimeout, clearTimeout, setInterval: () => 0, console, Promise, JSON, Math, Date, Object, Array, String, Number };
  win.window = win; Object.assign(ctx, win); vm.createContext(ctx); vm.runInContext(src, ctx);
  return { M: ctx.window.V2Mock || ctx.V2Mock, st, ss };
}
(async () => {
  /* 1. saved world for an older key: boot at once from it, worker builds the fresh one, onFresh hook repaints, no reload */
  { const { M, st } = harness({ wkMs: 600 }); let booted = 0, painted = 0; M.boot(() => { booted = Date.now(); M.onFresh(() => { painted++; }); }); const t0 = Date.now();
    await sleep(200); const w0 = M.world();
    ok(booted && booted - t0 < 200, 'boot did not wait for the worker (' + (booted - t0) + ' ms)'); ok(w0 && w0.saved, 'the saved (older) world shows at once');
    ok(M.updating(), 'updating() while the saved world shows'); ok(M.state().provisional, 'S.provisional set'); ok(!!nodes.find(n => n.id === 'v2upd'), "small 'updating' strip shown");
    ok(M.peek() === null, 'peek() (burn checks) never returns the saved world');
    await sleep(900); const w1 = M.world();
    ok(w1 && w1.fromWorker, 'fresh worker world replaces it'); ok(!M.updating() && !M.state().provisional, 'updating() false after the fresh world');
    ok(painted === 1, 'onFresh repaint ran once (got ' + painted + ')'); ok(st.reloads === 0, 'no reload when the page has a repaint hook'); ok(!nodes.find(n => n.id === 'v2upd'), 'strip removed'); ok(st.main === 0, 'no main-thread replay'); }
  /* 2. whenFresh() pressed while the saved world shows: waits for the fresh world, reports same:false (action re-judged) */
  { const { M } = harness({ wkMs: 500 }); M.boot(() => {}); await sleep(100);
    const t = Date.now(); const r = await M.whenFresh();
    ok(Date.now() - t >= 300, 'whenFresh waited for the fresh world'); ok(r.ok && r.same === false, 'whenFresh: ok, same:false (world changed since the press)'); ok(M.world().fromWorker, 'world is fresh after whenFresh');
    const r2 = await M.whenFresh(); ok(r2.ok && r2.same === true, 'whenFresh on fresh state: same:true, no wait'); }
  /* 3. no repaint hook (v2-pages pages): one reload after the fresh world is stored; a 2nd within 2 min shows the Refresh bar instead */
  { const { M, st, ss } = harness({ wkMs: 300 }); M.boot(() => {}); await sleep(900);
    ok(st.reloads === 1, 'page without a hook reloads once (got ' + st.reloads + ')'); ok(st.stored, 'reload waited for the stored message');
    ok(Number(ss.getItem('xcpets-v2-swr-reload')) > 0, 'reload guard stamped'); }
  { const { M, st, ss } = harness({ wkMs: 300 }); ss.setItem('xcpets-v2-swr-reload', String(Date.now())); M.boot(() => {}); await sleep(900);
    ok(st.reloads === 0, 'guard: no 2nd reload within 2 min'); ok(!!nodes.find(n => n.id === 'v2stale'), 'guard: Refresh bar shown instead'); }
  /* 4. exact saved key still works as before (no provisional, no repaint); no saved world: waits for the worker as before */
  { const { M } = harness({ wkMs: 300, saved: null }); let booted = 0; const t0 = Date.now(); M.boot(() => { booted = Date.now(); }); await sleep(100);
    ok(!booted, 'no saved world: boot waits for the worker'); await sleep(500); ok(booted && M.world().fromWorker && !M.updating(), 'no saved world: boots on the fresh world'); }
  /* 5. source checks */
  ok(/if \(v\.old\) \{ if \(!prov \|\| \(lastW && lastW\.pets && lastW\.pets\.length\)/.test(src), 'only boot takes a provisional world, never over a shown one');
  ok(/function current\(\) \{ return !!cache && cacheSig === inSig\(\)/.test(src), 'fresh = cache built from the current inputs');
  console.log('boot-from-cache-test: ' + pass + ' pass, ' + fail + ' fail'); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL error', e && e.stack); process.exit(1); });
