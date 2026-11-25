#!/usr/bin/env node
/* Light view: deeds, Mythic discount, full counts, zombies, pending lines, and the
 * check worker. js/v2-rules.js is not modified. Nothing is signed or sent. */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const split = require('./sync-server/split');
const { load: loadRulesVm } = require('./lib/load-rules');
const { worldFile } = require('./sync-server/server');
let pass = 0, fail = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (c) pass++; else fail++; };
function rd(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function md5(rel) { return crypto.createHash('md5').update(fs.readFileSync(path.join(ROOT, rel))).digest('hex'); }

const RSIG = require('./lib/rules-pin').PIN; /* rules-pin: every rule file's MD5 lives in tools/fixtures/rules-pin.json */
Object.keys(RSIG).forEach(rel => ok(md5(rel) === RSIG[rel], rel + ' bytes unchanged'));
const ui = rd('js/v2-split.js');
const num = re => Number((re.exec(ui) || [])[1]); /* the floors this fix needs; later raises (AUTO_CAP 60,000, DRAIN_MAX 256 on Nov 23) still pass */
ok(num(/var AUTO_CAP = (\d+)/) >= 12000 && num(/var SCREEN_PAGES = (\d+)/) === 7 && num(/DRAIN_MAX = (\d+)/) >= 64, "wallets up to 12,000 load through in growing batches; bigger ones still page 7 at a time");
ok(/function drain\(/.test(ui) && /underCap\(/.test(ui), 'background drain is only for wallets under the cap');
ok(!/for \(i = 1; i < pg\.pages; i\+\+\) left\.push\(i\)/.test(ui), 'owner pages are still not all queued at once');
ok(/deeds: deeds, mythicOwners: mythicOwners/.test(ui), 'assemble keeps deeds and mythicOwners');
ok(/mode === 'diff'/.test(ui) && /viewHold\.deeds = m\.deeds/.test(ui), 'takeMine keeps deeds through a verify diff');
ok(/view\/zombies\.json/.test(ui) && /function loadZombies/.test(ui), 'cemetery can load the risen-zombie file');
ok(/summary\.v !== 3/.test(ui), 'a v3 summary (rank.json publish) is still accepted');

const worker = rd('js/v2-verify-worker.js');
ok(/V2Rules\.sendBlock\(world/.test(worker), 'burn safety check still calls sendBlock on the full world');
ok(/pk\[pi\] !== 'art'/.test(worker) && /onlyChanged/.test(worker) && /cmd === 'sync'/.test(worker), 'the worker sends changed pets, without art, only when asked');
ok(!/setTimeout\(function \(\) \{ sendChunk\(0\)/.test(worker), 'verify no longer pushes every pet as soon as the world is ready');
const wallet = rd('js/v2-wallet.js');
ok(/function composeNodes\(\)/.test(wallet), 'composeNodes is still the compose path');
ok(/GONE_MS = 24 \* 3600 \* 1000/.test(wallet) && /OLD_MS = 3 \* 24 \* 3600 \* 1000/.test(wallet) && /function dismissPending/.test(wallet), 'pending lines expire and can be dismissed');
ok(/data-drop=/.test(rd('js/v2.js')), 'the pending list has a Dismiss button');
ok(/loadZombies/.test(rd('js/v2-cemetery-scene.js')), 'the cemetery page asks for every risen zombie');

function memStore() {
  const mem = {};
  return { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; }, mem: mem };
}
const WL = require('../rjs/wallet.js');
const makeWallet = require('../js/v2-wallet.js');
function walletOf(store, fetchFn) {
  return makeWallet({
    Wallet: WL, BurnCore: { toRaw: x => x, composeUrl: () => '', checkDexTx: () => [] },
    CFG: { network: 'mainnet', mempoolApi: 'https://mempool.space/api', asset: 'XCPETS', composeList: ['https://example.invalid'] },
    win: { document: null, addEventListener: () => {}, location: { search: '' } },
    fetch: fetchFn || (() => Promise.reject(new Error('no network'))),
    storage: store
  });
}
(function pending() {
  const now = Date.now(), store = memStore();
  const old = { txid: 'aa'.repeat(32), tag: 'pet:feed:1', at: now - 4 * 864e5, status: 'sent', label: 'old' };
  const gone = { txid: 'bb'.repeat(32), tag: 'pet:feed:2', at: now - 3600e3, status: 'sent', goneAt: now - 25 * 3600e3, label: 'gone' };
  const keep = { txid: 'cc'.repeat(32), tag: 'pet:feed:3', at: now - 3600e3, status: 'sent', label: 'keep' };
  store.setItem('xcpets-v2-pending-mainnet', JSON.stringify([old, gone, keep]));
  const W = walletOf(store);
  ok(W.sweepPending(now) === true, 'sweep drops expired pending lines');
  const left = W.tracker.list();
  ok(left.length === 1 && left[0].txid === keep.txid, 'a fresh pending line stays');
  W.dismissPending(keep.txid);
  ok(W.tracker.list().length === 0, 'Dismiss removes that line and nothing else');
})();

function pet(id, owner, species, extra) {
  return Object.assign({ id: id, owner: owner, name: 'P' + id, species: species, tier: 1, stage: 3, care: 1000 + id, dead: false, released: false, wins: 0, losses: 0, stats: { vigor: 10, spark: 10, grit: 10, zoom: 10, luck: 10 } }, extra || {});
}
const ALICE = 'bc1qaliceexample000000000000000000000000';
const BOB = 'bc1qbobexample00000000000000000000000000';
const TIP = 976700;
const pets = [];
for (let i = 1; i <= 30; i++) {
  const species = i === 1 ? 'djpepe' : i === 2 ? 'homer' : i === 3 ? 'kek' : i === 4 ? 'hyb:pepe:doge' : 'pepe';
  const extra = {};
  if (i <= 3) { extra.deed = 'A17310000000000000' + i; extra.care = 25000; }
  if (i === 5) extra.zombie = { fedAt: TIP - 500, by: ALICE, meals: 2, end: null };
  pets.push(pet(i, ALICE, species, extra));
}
pets.push(pet(90, BOB, 'doge', { dead: true, zombie: null }));
pets.push(pet(91, BOB, 'pepe', { zombie: { fedAt: TIP - 100, by: BOB, meals: 1 } }));
const deeds = {};
deeds[pets[0].deed] = { petId: 1, holder: ALICE, block: TIP - 10, tx: 'd1', issuer: ALICE };
deeds[pets[1].deed] = { petId: 2, holder: BOB, block: TIP - 9, tx: 'd2', issuer: ALICE };
deeds[pets[2].deed] = { petId: 3, holder: ALICE, block: TIP - 8, tx: 'd3', issuer: ALICE, destroyed: TIP - 1 };
const world = {
  tip: TIP, pets: pets, items: {}, deeds: deeds, mythicOwners: {}, cem: { huntedBy: { [ALICE]: 2, [BOB]: 1 } },
  community: { burned: 3, leaderboard: [] }, log: []
};
world.mythicOwners[ALICE] = 970000;
const sample = pets.map(p => Object.assign({}, p));

function loadRules() { return loadRulesVm().V2Rules; }
function loadSplit() {
  const ctx = {
    console: console, setTimeout: setTimeout, clearTimeout: clearTimeout, crypto: crypto,
    URL: URL, URLSearchParams: URLSearchParams, TextEncoder: TextEncoder, TextDecoder: TextDecoder,
    fetch: () => Promise.reject(new Error('offline')),
    document: { scripts: [], getElementById: () => null, body: { insertBefore: () => {} } },
    location: { search: '', href: 'https://xcpets.fun/play.html' },
    localStorage: memStore(), sessionStorage: memStore()
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/v2-split.js'), 'utf8'), ctx, { filename: 'js/v2-split.js' });
  return ctx.V2Split;
}

(async () => {
  const V = loadRules();
  const S = loadSplit();
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'light-fix-'));
  const meta = await split.write(out, world, { tip: TIP, rsig: 'r' + 'ab'.repeat(16) });
  const key = split.ownerKey(ALICE);
  const page = JSON.parse(fs.readFileSync(path.join(out, 'own', key + '.json'), 'utf8'));
  ok(page.page === 0 && page.deeds && page.deeds[sample[0].deed] && page.deeds[sample[0].deed].holder === ALICE, 'owner page 0 carries that owner\'s deeds');
  ok(page.deeds[sample[1].deed].holder === BOB, 'a token held elsewhere stays on the deed');
  ok(page.mythicAt === 970000, 'owner page 0 carries the Mythic-discount block');
  ok(page.roster && page.roster.alive === 30 && page.roster.hybrid === 1 && page.roster.zombies === 1, 'roster counts living pets, hybrids and zombies');
  ok(page.roster.species.djpepe === 1 && page.roster.species.homer === 1 && page.roster.species.kek === 1, 'roster keeps species that are not on the first screen');
  ok(page.roster.tokenized === 2 && page.roster.away === 1, 'roster tokenized count matches deedOf (held, including a destroyed token still in the map)');
  ok(Array.isArray(page.rise) && page.rise.some(p => p.id === 5), 'page 0 also lists this owner\'s risen zombies');
  const zfile = JSON.parse(fs.readFileSync(path.join(out, 'zombies.json'), 'utf8'));
  const zids = zfile.pets.map(p => p.id).sort((a, b) => a - b);
  ok(zfile.n === 2 && zids.join(',') === '5,91', 'zombies.json is every risen zombie, not just this wallet');
  ok(zfile.huntedBy[ALICE] === 2, 'zombies.json keeps the hunter counts');
  const sig = 'r' + 'ab'.repeat(16);
  ok(worldFile(out, [sig, String(TIP), 'view', 'zombies.json']) === path.join(out, 'world', sig, String(TIP), 'view', 'zombies.json'), 'the zombie file is a publishable view path');

  const mythic = {}; mythic[ALICE] = page.mythicAt;
  const view = S.assemble({ tip: TIP, n: pets.length, alive: 31, dead: 1, burned: 3, burns: 0, community: {}, cold: {}, wagmi: {} }, {
    owners: { [ALICE]: page.pets.concat(page.rise || []) },
    deeds: page.deeds, mythicOwners: mythic, roster: page.roster, rise: page.rise
  });
  const fullAlive = sample.filter(p => p.owner === ALICE && !p.dead);
  let tokSame = 0, thSame = 0, bad = 0;
  fullAlive.forEach(p => {
    const a = V.deedOf(world, p), b = V.deedOf(view, p);
    if (JSON.stringify(a) === JSON.stringify(b)) tokSame++; else bad++;
    const ta = V.petThresholds(world, p, TIP), tb = V.petThresholds(view, p, TIP);
    if (JSON.stringify(ta) === JSON.stringify(tb)) thSame++; else bad++;
  });
  ok(bad === 0 && tokSame === fullAlive.length && thSame === fullAlive.length, 'deedOf and petThresholds match the full world for every sampled pet (' + fullAlive.length + ')');
  const mythicPet = fullAlive.filter(p => p.species === 'kek')[0];
  const lightTh = V.petThresholds(view, mythicPet, TIP), bareTh = V.petThresholds({ tip: TIP, pets: [mythicPet] }, mythicPet, TIP);
  ok(lightTh[5] === 21000 && bareTh[5] > lightTh[5], 'with the discount the Mythic line is 21,000; without mythicOwners it stays ' + bareTh[5]);
  ok(page.pets.length === split.PAGE && meta.files > 0, 'later living pets stay on the next pages (' + page.pets.length + ' on page 0)');

  /* Freeze: posting every pet (art included) versus the changed living pets. */
  const art = { pixels: 'x'.repeat(600) };
  const many = [];
  for (let i = 0; i < 4713; i++) many.push({ id: i + 1, owner: ALICE, name: 'N' + i, species: 'pepe', care: i, dead: i >= 2453, art: art, zombie: null, stats: { vigor: 1, spark: 1, grit: 1, zoom: 1, luck: 1 } });
  const t0 = process.hrtime.bigint();
  const allBytes = Buffer.byteLength(JSON.stringify(many));
  const allMs = Number(process.hrtime.bigint() - t0) / 1e6;
  const living = many.filter(p => !p.dead);
  const changed = living.slice(0, 40).map(p => { const c = Object.assign({}, p); delete c.art; c.care += 1; return c; });
  const t1 = process.hrtime.bigint();
  const chBytes = Buffer.byteLength(JSON.stringify(changed));
  const chMs = Number(process.hrtime.bigint() - t1) / 1e6;
  ok(chBytes * 20 < allBytes, 'a changed-pet payload is far smaller than every pet (' + chBytes + ' vs ' + allBytes + ' bytes)');
  console.log('freeze-measure allPets=' + many.length + ' bytes=' + allBytes + ' ms=' + allMs.toFixed(1) + ' changed=' + changed.length + ' bytes=' + chBytes + ' ms=' + chMs.toFixed(1));

  console.log(pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
