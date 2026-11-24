#!/usr/bin/env node
/* Server burn check (Nov 23 2026). node tools/server-check-test.js
 *  1. tools/sync-server/checker.js, run by the sync service's manager (index.js ckTick / ckAsk), loads a real checkpoint built by
 *     snapshot.js, replays the newer burns, and gives the SAME answer as a full replay in a fresh engine for every later burn
 *     (each row's tag, checked as its own sender), i.e. the answer a device's own check gives.
 *  2. POST /xp/v1/check: shape, limits, no caching; other POSTs stay 405.
 *  3. The page uses a server answer only when it is fresh, and falls back to its own check otherwise; the wallet lets the view gate through.
 * Uses api/boot.json rows up to block 971,800 (a small world, a few seconds). */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), os = require('os'), http = require('http');
const ROOT = path.resolve(__dirname, '..');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('ok  ', m); } else { fail++; console.log('FAIL', m); } };
const S = require('./sync-server/snapshot');
const tagText = h => /^[0-9a-f]+$/i.test(h || '') && (h.length % 2 === 0) ? Buffer.from(h, 'hex').toString('utf8') : String(h || '');
(async () => {
  const boot = JSON.parse(fs.readFileSync(path.join(ROOT, 'api/boot.json'), 'utf8'));
  const hc = { window: {} }; hc.window.window = hc.window; vm.createContext(hc); vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/block-hashes.js'), 'utf8'), hc);
  const hashes = Object.assign({}, hc.window.XCPETS_BLOCK_HASHES || {}, boot.hashes);
  const A = 971600, B = 971800, LATER = 972000;
  const rowsA = boot.rows.filter(r => r.block_index <= A), rowsB = boot.rows.filter(r => r.block_index <= B);
  const later = boot.rows.filter(r => r.block_index > B && r.block_index <= LATER).slice(0, 150);
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'xcp-check-'));
  const built = await S.buildSnapshot({ rows: rowsA, hashes, tip: A, dex: boot.dex, outDir: path.join(data, 'world', 'pending'), compress: false });
  const rsig = built.rsig, wdir = path.join(data, 'world', rsig, String(A));
  fs.mkdirSync(path.dirname(wdir), { recursive: true }); fs.renameSync(path.join(data, 'world', 'pending'), wdir);
  require('./sync-server/index').writeLatest(data, { v: 1, rsig, tip: A, manifest: '/xp/v1/world/' + rsig + '/' + A + '/manifest.json' });

  /* the reference: a full replay to B in a fresh engine, with the same inputs the service hands the checker */
  const ref = S.workerFns(); S.replayWorld(ref, [], {}, A, null);
  const V = ref.V2Rules, gates = { fire: V.ACTIVATE_FIRESALE_BLOCK != null ? V.ACTIVATE_FIRESALE_BLOCK : null, quest: V.questGate ? V.questGate() : null, raid: V.raidGate ? V.raidGate() : null };
  const state = { ready: true, lag: 0, tip: B, rows: rowsB, hashes, dex: boot.dex, gates };
  const view = require('./sync-server/answer').pageInputs(state);
  const full = S.workerFns(), fw = S.replayWorld(full, view.rows.slice(), view.hashes, B, view.dex);
  const Art = require('../js/v2-art');
  function refAnswer(plan, me) { /* what js/v2-verify-worker.js check() does, on the full replay */
    const t = full.V2Rules.parseTag(plan.tag); if (t) Art.tagPetIds(t).forEach(id => { const p = fw.byId[id]; if (p) Art.resolvePetOwner(p, {}); });
    return full.V2Rules.sendBlock(fw, plan, fw.tip, { me, pending: [] }) || null;
  }

  /* the service's manager forks checker.js and loads the checkpoint */
  const I = require('./sync-server/index');
  I.ckTick(state, data, ROOT);
  const t0 = Date.now(); while (I._CK.state !== 'ready' && Date.now() - t0 < 120000 && !/failed|crashed|low-memory/.test(I._CK.state)) await new Promise(r => setTimeout(r, 200));
  ok(I._CK.state === 'ready' && I._CK.tip === B, 'checker loaded the checkpoint at ' + A + ' and replayed to ' + B + ' (' + I._CK.state + ' ' + I._CK.tip + ', ' + (Date.now() - t0) + ' ms, ' + I._CK.rssMB + ' MB) ' + (I._CK.why || ''));
  const info = I.ckInfo(); ok(info.state === 'ready' && typeof info.rssMB === 'number' && !/\//.test(JSON.stringify(info)), 'health info is numbers and short words, no paths');
  let same = 0, diff = 0, refused = 0;
  for (const r of later) {
    const plan = { tag: tagText(r.tag) }, me = r.source;
    const a = await I.ckAsk(state, { plans: [plan], me, pending: [] });
    const want = refAnswer(plan, me);
    const got = a && a.ok ? (a.skip[0] || null) : 'NO ANSWER';
    if (got === want) same++; else { diff++; if (diff <= 5) console.log('  differs:', plan.tag.slice(0, 50), '| server:', got, '| device:', want); }
    if (want) refused++;
  }
  ok(diff === 0 && same === later.length, 'server and device give the same answer on ' + same + ' of ' + later.length + ' later burns (' + refused + ' refused by both)');
  const two = await I.ckAsk(state, { plans: [{ tag: 'pet:feed' }, { tag: 'not a tag' }], me: later[0].source, pending: [] });
  ok(two.ok && two.tip === B && Array.isArray(two.plans) && Array.isArray(two.skip), 'a batch answer carries the tip, kept plans and reasons');
  ok((await I.ckAsk(Object.assign({}, state, { tip: B + 1 }), { plans: [{ tag: 'pet:feed' }], me: '', pending: [] })).ok === false, 'a checker behind the follower does not answer');
  ok(two.rsig === rsig, 'a check answer names the rules signature it was made with');
  /* Spam City's pack: the same fields js/v2-orderbook-worker.js posts after a full replay */
  const sh = await I.ckShop(state);
  const fwl = fw.listings || [], wids = {}; fwl.forEach(S => { if (S && S.petId != null) wids[S.petId] = 1; });
  ok(sh.ok && sh.tip === B && sh.rsig === rsig && JSON.stringify(sh.listings) === JSON.stringify(JSON.parse(JSON.stringify(fwl))) && sh.pets.length === Object.keys(wids).filter(id => fw.byId[id]).length &&
    sh.pets.every(p => fw.byId[p.id] && fw.byId[p.id].owner === p.owner) && JSON.stringify(sh.orders) === JSON.stringify((view.dex && view.dex.orders) || []),
    'the shop pack matches a full replay (' + sh.listings.length + ' listings, ' + sh.pets.length + ' pets, ' + sh.orders.length + ' orders)');
  ok((await I.ckShop(state)) === sh, 'the shop pack is built once per checker world');
  /* Spam City shelves (Nov 24 2026): every published world carries the same pack (view/p/99901.json), so the page has it while the
   * checker is paused for a build or reloading after a block */
  const SPL = require('./sync-server/split');
  const pubB = SPL.shopPack(fw, full.V2Rules, (view.dex && view.dex.orders) || [], B, rsig), shNo = Object.assign({}, sh); delete shNo.id; delete shNo.cmd;
  ok(JSON.stringify(Object.assign({}, pubB, { v: undefined })) === JSON.stringify(Object.assign({}, shNo, { v: undefined })), 'the published shop pack is the same as the checker\'s for the same world');
  const pf = path.join(wdir, 'view', 'p', SPL.SHOP_SHARD + '.json'), pj = fs.existsSync(pf) ? JSON.parse(fs.readFileSync(pf, 'utf8')) : null;
  const mf = JSON.parse(fs.readFileSync(path.join(wdir, 'manifest.json'), 'utf8'));
  ok(pj && pj.ok === true && pj.tip === A && pj.rsig === rsig && Array.isArray(pj.listings) && Array.isArray(pj.pets) && JSON.stringify(pj.orders) === JSON.stringify((boot.dex && boot.dex.orders) || []) && mf.view && mf.view.shop === 'view/p/99901.json',
    'a world build writes the shop pack beside its view (' + (pj ? pj.listings.length + ' listings at ' + pj.tip : 'missing') + ')');
  ok((await I.ckShop(Object.assign({}, state, { tip: B + 1 }))).ok === false, 'a checker behind the follower sends no shop pack');
  I.ckStop('off'); ok(I._CK.proc === null, 'stopping the checker (before a world build) ends its process');

  /* POST /xp/v1/check */
  const { createServer } = require('./sync-server/server');
  let seen = null;
  const srv = createServer({ getState: () => ({ tip: B, check: () => ({ state: 'ready' }) }), dataDir: data, check: b => { seen = b; return { ok: true, tip: B, rsig: 'rX', plans: b.plans.slice(0, 1), skip: ['x'] }; },
    shop: () => ({ ok: true, tip: B, rsig: 'rX', listings: [{ n: 1, petId: 7 }], pets: [{ id: 7 }], deeds: {}, orders: [], n: 9, open: 1 }) });
  await new Promise(r => srv.server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + srv.server.address().port;
  const post = (p, body, type) => fetch(base + p, { method: 'POST', headers: { 'Content-Type': type || 'text/plain' }, body });
  let r = await post('/xp/v1/check', JSON.stringify({ plans: [{ tag: 'pet:feed:1', amount: 5, junk: { a: 1 } }], me: 'bc1qabc', pending: ['pet:feed:2'] }));
  let j = await r.json();
  ok(r.status === 200 && j.ok && j.tip === B && j.plans.length === 1 && j.skip[0] === 'x' && r.headers.get('cache-control') === 'no-store' && j.rsig === 'rX', 'POST /xp/v1/check answers with its rsig, never cached');
  r = await fetch(base + '/xp/v1/shop'); j = await r.json();
  ok(r.status === 200 && j.ok && j.tip === B && j.rsig === 'rX' && j.listings[0].petId === 7 && j.pets[0].id === 7 && /max-age=20/.test(r.headers.get('cache-control') || ''), 'GET /xp/v1/shop sends the order book, cached 20 s');
  ok(seen && seen.plans[0].tag === 'pet:feed:1' && seen.plans[0].amount === 5 && !('junk' in seen.plans[0]) && seen.me === 'bc1qabc' && seen.pending[0] === 'pet:feed:2', 'only plain plan values reach the checker');
  ok((await post('/xp/v1/check', '{"plans":[]}')).status === 400 && (await post('/xp/v1/check', 'nope')).status === 400 && (await post('/xp/v1/check', JSON.stringify({ plans: Array(101).fill({ tag: 'pet:feed' }) }))).status === 400, 'empty, broken or over-100 requests are 400');
  ok((await post('/xp/v1/check', 'x'.repeat(70000))).status === 413, 'a body over 64 KB is refused');
  ok((await post('/xp/v1/sync', '{}')).status === 405 && (await post('/xp/v1/graves', '{}')).status === 405, 'other POSTs stay 405');
  const h = await (await fetch(base + '/xp/v1/health')).json(); ok(h.check && h.check.state === 'ready', 'health shows the check service');
  srv.server.close();

  /* page and wallet */
  const sp = fs.readFileSync(path.join(ROOT, 'js/v2-split.js'), 'utf8'), wl = fs.readFileSync(path.join(ROOT, 'js/v2-wallet.js'), 'utf8');
  ok(/function checkPlans\(plans\) \{\s*return serverCheck\(plans\)\.then\(function \(out\) \{ return out \|\| deviceCheck\(plans\); \}\);/.test(sp), 'checkPlans asks the server, then falls back to the device check');
  ok(/!\(j\.tip >= need\)/.test(sp) && /SERVER_MS = 3000/.test(sp), 'a server answer is used only within 3 s and at least as new as every tip the page knows');
  ok(/j\.rsig !== rsig/.test(sp) && /function serverShop\(\)/.test(sp) && (sp.match(/j\.rsig !== rsig/g) || []).length === 3 && /function publishedShop\(\)/.test(sp), 'the page uses server answers and the shop packs only when they come from its own rule files');
  const sa = fs.readFileSync(path.join(ROOT, 'js/v2-sales.js'), 'utf8');
  ok(/SP\.serverShop\(\)/.test(sa) && /SP\.publishedShop\(\)/.test(sa) && /function deviceBook\(\) \{[^\n]*bookInputs\(\)\.then\(replayBook\)/.test(sa), 'Spam City takes the server order book or the published one, and replays in the browser only without both');
  ok(/if \(ready \|\| off\(\)/.test(sp), 'a finished device check is used directly');
  ok(/serverReady \|\| !last/.test(sp), 'the device check does not warm up while the server check is ready');
  ok(/var viewGate = !!\(VS && VS\.view && !VS\.stale && window\.V2Split && V2Split\.checkPlans\);/.test(wl) && /!VS\.verified && !viewGate/.test(wl), 'the wallet lets the published view through to checkPlans');
  fs.rmSync(data, { recursive: true, force: true });
  console.log(`server-check-test: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
