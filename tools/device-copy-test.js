#!/usr/bin/env node
/* Device copy of my pets (Nov 24 2026). node tools/device-copy-test.js
 *  1. tools/sync-server/split.js puts every living id of a multi-page wallet on page 0 ('ord', delta-coded), and the page's
 *     pageFromOrder() rebuilds each later id page exactly as the server wrote it (so 1,000+ requests become none).
 *  2. summary.shardSig is a digest of what the page reads from each pet shard; a changed pet changes only its shard's digest,
 *     so a saved copy of an unchanged shard is provably the same data.
 *  3. View files get .br/.gz copies (the running server sends those to browsers that accept them).
 *  4. The page only trusts the saved copy when the digest matches and every asked id is in it, and falls back to the download.
 * The browser check against a real world (same pets byte for byte as main, first visit / return / newer world) is in the PR. */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), vm = require('vm'), crypto = require('crypto');
const split = require('./sync-server/split');
let pass = 0, fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (c) pass++; else fail++; };
function world(tip, bump) {
  const pets = [];
  const ids = []; for (let i = 1; i <= 40; i++) ids.push(i); for (let i = 1990; i <= 2050; i++) ids.push(i); for (let i = 4100; i <= 4120; i++) ids.push(i);
  ids.forEach(id => pets.push({ id, owner: id % 7 === 0 ? 'bob' : 'carol', name: 'P' + id, species: 'pepe', tier: 0, stage: 1, care: id === bump ? 99 : id % 5, dead: id % 11 === 0, wins: 0, losses: 0, released: false }));
  return { tip, pets, items: {}, community: { burned: 1, leaderboard: [] }, log: [] };
}
(async () => {
  const a = fs.mkdtempSync(path.join(os.tmpdir(), 'devcopy-a-')), b = fs.mkdtempSync(path.join(os.tmpdir(), 'devcopy-b-'));
  await split.write(a, world(30, 0), { tip: 30, rsig: 'rtest' });
  await split.write(b, world(36, 2010), { tip: 36, rsig: 'rtest' });
  /* the page's own code, loaded the way a browser does */
  const ctx = { window: {}, document: { scripts: [], getElementById() { return null; }, addEventListener() {}, querySelector() { return null; } }, location: { search: '', href: 'https://xcpets.fun/play.html' },
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} }, sessionStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    setTimeout() { return 0; }, clearTimeout() {}, setInterval() { return 0; }, URLSearchParams, console, Promise };
  ctx.window = Object.assign(ctx, ctx.window); ctx.window.window = ctx; ctx.addEventListener = function () {};
  vm.createContext(ctx); vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js/v2-split.js'), 'utf8'), ctx, { filename: 'v2-split.js' });
  const O = ctx.V2Split._order;
  const key = split.ownerKey('carol'), dir = path.join(a, 'own');
  const p0 = JSON.parse(fs.readFileSync(path.join(dir, key + '.json'), 'utf8'));
  ok(p0.pages > 1 && Array.isArray(p0.ord) && p0.ord.length === p0.alive, 'page 0 of a ' + p0.pages + '-page wallet lists all ' + p0.alive + ' living ids');
  const pg = { ord: O.idOrder(p0) };
  let same = 0, n = 0;
  for (let k = 1; k < p0.pages; k++) {
    const real = JSON.parse(fs.readFileSync(path.join(dir, key + '.' + k + '.json'), 'utf8')), made = O.pageFromOrder(pg, k);
    const canon = o => JSON.stringify(Object.keys(o).sort().map(x => [x, o[x]]));
    n++; if (made && canon(real) === canon(JSON.parse(JSON.stringify(made)))) same++;
  }
  ok(n > 0 && same === n, 'every later page rebuilt on the device equals the server file (' + same + ' of ' + n + ')');
  ok(O.pageFromOrder(pg, 0) === null && O.pageFromOrder(pg, p0.pages) === null, 'page 0 and pages past the end are never made up');
  ok(O.idOrder({ pages: 3, alive: 5, ord: [1, 2] }) === null && O.idOrder({ pages: 3, alive: 2 }) === null, 'an ord that does not match the living count, or none (older worlds), is not used');
  const bob = JSON.parse(fs.readFileSync(path.join(dir, split.ownerKey('bob') + '.json'), 'utf8'));
  ok(bob.pages === 1 && bob.ord === undefined, 'a one-page wallet carries no ord');
  const sa = JSON.parse(fs.readFileSync(path.join(a, 'summary.json'), 'utf8')), sb = JSON.parse(fs.readFileSync(path.join(b, 'summary.json'), 'utf8'));
  let sigOk = 0, shards = Object.keys(sa.shardSig || {});
  shards.forEach(nm => { const j = JSON.parse(fs.readFileSync(path.join(a, 'p', nm + '.json'), 'utf8')); if (crypto.createHash('sha256').update(JSON.stringify({ hashes: j.hashes, pets: j.pets })).digest('hex').slice(0, 20) === sa.shardSig[nm]) sigOk++; });
  ok(shards.length === 3 && sigOk === 3, 'summary.shardSig is the digest of each shard\'s pets and hashes (' + sigOk + ' of ' + shards.length + ')');
  const changed = shards.filter(nm => sa.shardSig[nm] !== sb.shardSig[nm]);
  ok(changed.length === 1 && changed[0] === '00001', 'one changed pet (#2010) at a newer tip changes only its own shard digest (' + changed.join(',') + ')');
  const zlib = require('zlib'), big = path.join(dir, key + '.json');
  ok(fs.existsSync(big + '.br') && zlib.brotliDecompressSync(fs.readFileSync(big + '.br')).toString() === fs.readFileSync(big, 'utf8') && zlib.gunzipSync(fs.readFileSync(big + '.gz')).toString() === fs.readFileSync(big, 'utf8'),
    'view files have .br and .gz copies with the same bytes (server.js sends them compressed)');
  const { worldFile } = require('./sync-server/server');
  ok(/\.br'\)\) \{ cors\(res\)/.test(fs.readFileSync(path.join(__dirname, 'sync-server/server.js'), 'utf8')) && /view[\\/]own/.test(worldFile('/d', ['r' + 'ab'.repeat(16), '9', 'view', 'own', 'ab'.repeat(32) + '.3.json']) || ''), 'the running server already sends a .br copy of an allowed view file');
  const src = fs.readFileSync(path.join(__dirname, '..', 'js/v2-split.js'), 'utf8');
  ok(/if \(!v\) return net\(\);\s*for \(i = 0; i < ids\.length; i\+\+\) if \(!v\.pets\[String\(ids\[i\]\)\]\) return net\(\);/.test(src), 'a saved shard missing any asked id is downloaded instead');
  ok(/g\.onsuccess = function \(\) \{ var v = g\.result; res\(v && v\.sig === sig && v\.pets \? v : null\); \}/.test(src), 'a saved shard is used only under the same digest');
  ok(/function keepKey\(nm\) \{ return me\(\) \+ '\|' \+ keepRsig \+ '\|' \+ nm; \}/.test(src), 'saved copies are per wallet and per rules signature');
  ok(/q\('keep'\) !== '0'/.test(src), '?keep=0 turns the device copy off');
  console.log(pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
