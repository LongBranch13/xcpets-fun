#!/usr/bin/env node
/* cold-load-fix tests (Nov 2 2026, owner 'stuck on reading the chain', UI/cache only):
 *   (1) idbRaw: a saved world whose read takes longer than 2.5 s after the database opened is still used (old code threw it away -> full rebuild),
 *       a database that never opens still gives up at IDB_WAIT_MS, a read past IDB_READ_MS gives up;
 *   (2) the boot line shows the rebuild with a running clock instead of the static 'Reading XCPETS burns from the chain…'.   node tools/cold-load-test.js */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'v2-chain.js'), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const cut = (a, b) => { const i = src.indexOf(a), j = src.indexOf(b, i); if (i < 0 || j < 0) throw new Error('missing ' + a); return src.slice(i, j); };
const block = cut('  var IDB_NAME =', '\n  function idb()') + cut('  var IDB_READ_MS', '\n  var idbPre');
function sim(openAt, readAt) { // fake clock: timers + idb open/get callbacks
  let now = 0; const q = []; const at = (ms, f) => { const o = { t: now + ms, f }; q.push(o); return o; };
  const ctx = vm.createContext({ setTimeout: (f, ms) => at(ms, f), clearTimeout: o => { if (o) o.f = () => {}; }, Promise });
  ctx.idb = () => new Promise((res, rej) => { if (openAt == null) return; at(openAt, () => res({ close() {}, transaction: () => ({ objectStore: () => ({ get: () => { const r = {}; at(readAt, () => { r.result = { key: 'k', world: { pets: [1] } }; r.onsuccess(); }); return r; } }) }) })); });
  vm.runInContext(block.replace('function idb()', 'function idb_unused()') + '\nthis.raw = idbRaw; this.W = IDB_WAIT_MS; this.R = IDB_READ_MS;', ctx);
  let out = 'pending'; ctx.raw().then(v => { out = v; });
  return (async () => { for (let k = 0; k < 200; k++) { await new Promise(r => setImmediate(r)); q.sort((a, b) => a.t - b.t); const n = q.shift(); if (!n) break; now = n.t; n.f(); } await new Promise(r => setImmediate(r)); return { out, W: ctx.W, R: ctx.R }; })();
}
(async () => {
  let r = await sim(300, 4000); ok(r.out && r.out.world, 'saved world read in 4.3 s total (open 0.3 s) is used');
  r = await sim(300, 9000); ok(r.out && r.out.world, 'saved world read in 9.3 s is used (still far under a 20-30 s rebuild)');
  r = await sim(null, 0); ok(r.out === null, 'database that never opens gives up (null)');
  r = await sim(300, 20000); ok(r.out === null, 'read past IDB_READ_MS gives up (null)');
  ok(r.W === 2500 && r.R >= 10000, 'open guard 2.5 s, read guard >= 10 s');
  ok(/function bootProgress\(st, p\)/.test(src) && /return bootProgress\(st, p\)/.test(src) && /Building every pet from/.test(src), 'cold boot line shows the rebuild with a clock');
  console.log('cold-load: ' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
