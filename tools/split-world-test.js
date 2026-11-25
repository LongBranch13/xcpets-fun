#!/usr/bin/env node
/* Split view equals a full replay. Two tips, several owners and pets.
 * The rules file is not modified. A missing fixture snapshot is cut from tools/fixtures. */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto');
const { replayWorld, workerFns, rulesSig, loadBytes } = require('./sync-server/snapshot');
const split = require('./sync-server/split');
const { worldFile } = require('./sync-server/server');
const fixtures = require('./lib/fixtures');
let fail = 0, pass = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (c) pass++; else fail++; };
const rulesMd5 = crypto.createHash('md5').update(fs.readFileSync(path.join(__dirname, '..', 'js/v2-rules.js'))).digest('hex');
ok(rulesMd5 === require('./lib/rules-pin').pin('js/v2-rules.js'), 'rules MD5 unchanged (Meat Grinder opens at 977220)');
ok(/function bootFromView[\s\S]{0,700}readViewBalance\(/.test(fs.readFileSync(path.join(__dirname, '..', 'js/v2-chain.js'), 'utf8')), 'the published view reads the wallet balance');
ok(/var ENABLED = true, START = 977136/.test(fs.readFileSync(path.join(__dirname, '..', 'js/doom-week.js'), 'utf8')), 'doom week 2 window is set (display only)');

function toy(tip) {
  return {
    tip: tip,
    pets: [
      { id: 1, owner: 'alice', name: 'A', species: 'pepe', tier: tip === 10 ? 0 : 1, stage: 3, care: tip, dead: false, wins: 1, losses: 0, released: false },
      { id: 2, owner: 'bob', name: 'B', species: 'doge', tier: 1, stage: 2, care: 4, dead: true, wins: 0, losses: 2, released: false },
      { id: 2001, owner: 'alice', name: 'C', species: 'pepe', tier: 2, stage: 4, care: 9, dead: false, wins: 3, losses: 1, released: false }
    ],
    items: { g1: { gid: 'g1', item: 'hat', label: 'Hat', slot: 'head', tier: 1, owner: 'alice', on: 1 } },
    community: { burned: 10 + tip, petName: 'Wizard', current: 'wizard', leaderboard: [{ address: 'alice', amount: 3 }, { address: 'bob', amount: 1 }] },
    wizardMythic: { block: tip - 1 },
    log: [{ n: 1 }, { n: 2 }]
  };
}
function fields(p) { return [p.id, p.owner, p.name, p.species, p.tier, p.stage, p.care || 0, p.dead ? 1 : 0, p.wins || 0, p.losses || 0]; }
function check(world, label) {
  const built = split.fromWorld(world);
  ok(built.summary.n === world.pets.length && built.summary.tip === world.tip, label + ' summary count ' + built.summary.n);
  ok(built.summary.burned === world.community.burned, label + ' community burned');
  ok(built.summary.cold.wizard && built.summary.cold.wizard.block === world.wizardMythic.block, label + ' cold storage block');
  const owners = ['alice', 'bob'];
  owners.forEach(addr => {
    const shard = split.ownerShard(addr);
    const got = (built.owners.get(shard)[addr] || []).map(fields).sort((a, b) => a[0] - b[0]);
    const want = world.pets.filter(p => p.owner === addr).map(fields).sort((a, b) => a[0] - b[0]);
    ok(JSON.stringify(got) === JSON.stringify(want), label + ' owner ' + addr + ' pets match');
    const worn = (built.owners.get(shard)[addr] || []).filter(p => p.id === 1)[0];
    if (addr === 'alice') ok(worn && worn.worn.length === 1 && worn.worn[0].label === 'Hat', label + ' alice worn hat');
  });
  const detail = built.pets.get(split.petShard(2001))['2001'];
  const live = world.pets.filter(p => p.id === 2001)[0];
  ok(detail && JSON.stringify(fields(detail)) === JSON.stringify(fields(live)), label + ' pet shard 2001');
  return built;
}
check(toy(10), 'tip 10');
{ const tb = split.burnTotals({ burnedBy: { alice: 3.5, bob: 0 } }, 2000, null);
  ok(JSON.stringify(tb) === JSON.stringify({ alice: [3.5, 0] }), 'burnTotals falls back to the replay\'s burnedBy');
  const rows = [{ tx_hash: 'a', source: 'alice', quantity: 150000000, block_index: 100, status: 'valid' }, { tx_hash: 'a', source: 'alice', quantity: 150000000, block_index: 100, status: 'valid' },
    { tx_hash: 'b', source: 'bob', quantity: 1, block_index: 1999, status: 'valid' }, { tx_hash: 'c', source: 'bob', quantity: 9e8, block_index: 1999, status: 'invalid: x' }, { tx_hash: 'd', source: 'carol', amount: 2, block_index: 2001 }];
  ok(JSON.stringify(split.burnTotals({}, 2000, rows)) === JSON.stringify({ alice: [1.5, 0], bob: [1e-8, 1e-8] }), 'burnTotals: valid rows up to the tip, duplicates once, this week = the last 1,008 blocks');
  ok(JSON.stringify(split.weekWins({ fights: [{ status: 'done', acceptBlock: 1500, winner: 7 }, { status: 'done', acceptBlock: 900, winner: 7 }, { status: 'open', winner: 8 }] }, 2000)) === '{"7":1}', 'weekWins counts this week\'s finished fights by winning pet');
  const v2p = fs.readFileSync(path.join(__dirname, '..', 'js/v2-pages.js'), 'utf8'), v2s = fs.readFileSync(path.join(__dirname, '..', 'js/v2-split.js'), 'utf8');
  ok(/_burnBy: summary\.burnBy/.test(v2s) && /_winsWk: summary\.winsWk/.test(v2s), 'the fast view world carries the burn and weekly-win totals');
  ok(/pubB = w\._view && w\._burnBy/.test(v2p) && /tallyGap\.burn/.test(v2p), 'Rankings reads them on a fast load and says so when they are missing'); }
check(toy(20), 'tip 20');
ok(/fights: \[\]/.test(fs.readFileSync(path.join(__dirname, '..', 'js/v2-split.js'), 'utf8')), 'a view world has a fights list');
ok(/\(w\.fights \|\| \[\]\)/.test(fs.readFileSync(path.join(__dirname, '..', 'js/v2.js'), 'utf8')), 'fight notices tolerate a view with no fights');
(function () { var w = { pets: [{ id: 1, owner: 'carol' }] }; (w.fights || []).forEach(function () { throw new Error('called'); }); })();
ok(true, 'a view with no fights does not throw');
async function many() {
  const pets = [];
  for (let i = 1; i <= 30; i++) pets.push({ id: i, owner: 'carol', name: 'P' + i, species: 'pepe', tier: 0, stage: 1, care: i, dead: i % 2 === 0, wins: 0, losses: 0, released: false });
  const world = { tip: 30, pets: pets, items: {}, community: { burned: 1, leaderboard: [] }, log: [] };
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'split-many-'));
  await split.write(out, world, { tip: 30, rsig: 'rtest' });
  const key = split.ownerKey('carol');
  const first = JSON.parse(fs.readFileSync(path.join(out, 'own', key + '.json'), 'utf8'));
  ok(first.alive === 15 && first.dead === 15 && first.pets.length === 15 && first.pets.every(p => !p.dead), 'the main owner page is the 15 living pets only');
  const deadFile = JSON.parse(fs.readFileSync(path.join(out, 'own', key + '.d.json'), 'utf8'));
  ok(deadFile.graves === 1 && deadFile.pets.length === 15 && deadFile.pets.every(p => p.dead), 'the 15 dead pets are a separate file');
  ok(!fs.existsSync(path.join(out, 'own', key + '.1.json')), 'no second main page once the dead pets are split out');
}

const sig = 'r' + 'ab'.repeat(16);
const dir = path.join(os.tmpdir(), 'split-worldfile-' + process.pid);
ok(worldFile(dir, [sig, '9', 'view', 'summary.json']) === path.join(dir, 'world', sig, '9', 'view', 'summary.json'), 'summary path is allowed');
ok(worldFile(dir, [sig, '9', 'view', 'o', 'ab.json']) === path.join(dir, 'world', sig, '9', 'view', 'o', 'ab.json'), 'owner shard path is allowed');
ok(worldFile(dir, [sig, '9', 'view', 'own', 'ab'.repeat(32) + '.d.json']) === path.join(dir, 'world', sig, '9', 'view', 'own', 'ab'.repeat(32) + '.d.json'), 'dead-pet page path is allowed');
ok(worldFile(dir, [sig, '9', 'view', 'p', '00001.json']) === path.join(dir, 'world', sig, '9', 'view', 'p', '00001.json'), 'pet shard path is allowed');
ok(worldFile(dir, [sig, '9', 'cp-root.json', 'extra']) == null && worldFile(dir, [sig, '9', 'view', 'o', '../ab.json']) == null, 'view path escapes are rejected');

fixtures.ensure(['snap-971786.json', 'snap-972901.json']);
const ROOT = path.join(__dirname, '..');
function loadSnap(name) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'snapshots', name), 'utf8'));
}
function replay(snap) {
  const ctx = workerFns();
  const world = replayWorld(ctx, snap.rows, snap.hashes, snap.tip, null);
  return world;
}
async function prove(name) {
  const snap = loadSnap(name);
  const t0 = Date.now();
  const world = replay(snap);
  const ms = Date.now() - t0;
  const built = split.fromWorld(world);
  const owners = {};
  (world.pets || []).forEach(p => { owners[p.owner] = (owners[p.owner] || 0) + 1; });
  const addrs = Object.keys(owners).sort((a, b) => owners[b] - owners[a]).slice(0, 5);
  let pets = 0, bad = 0;
  addrs.forEach(addr => {
    const shard = built.owners.get(split.ownerShard(addr));
    const got = {};
    ((shard && shard[addr]) || []).forEach(p => { got[p.id] = fields(p).join('|'); pets++; });
    world.pets.filter(p => p.owner === addr).forEach(p => { if (got[p.id] !== fields(p).join('|')) bad++; });
  });
  ok(built.summary.n === world.pets.length, name + ' summary n ' + built.summary.n + ' in ' + ms + 'ms');
  ok(!bad && pets > 0, name + ' ' + addrs.length + ' owners, ' + pets + ' pets match (' + bad + ' differ)');
  const sample = world.pets[Math.floor(world.pets.length / 2)];
  const det = built.pets.get(split.petShard(sample.id))[String(sample.id)];
  ok(det && fields(det).join('|') === fields(sample).join('|'), name + ' mid pet ' + sample.id + ' shard matches');
  if (world.community) ok(built.summary.burned === world.community.burned, name + ' burned ' + built.summary.burned);
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'split-'));
  const petN = world.pets.length, petTip = world.tip;
  const hadSeasons = 'seasons' in world;
  if (!hadSeasons) world.seasons = { 1: { n: 1, id: 'kekmas', sold: 3, pts: { bc1qtest: 15 }, legends: [], settled: false } };
  const meta = await split.write(out, world, { tip: world.tip, rsig: rulesSig(loadBytes()), rows: snap.rows });
  const wantSeasons = JSON.stringify(world.seasons);
  if (!hadSeasons) delete world.seasons;
  const summary = JSON.parse(fs.readFileSync(path.join(out, 'summary.json'), 'utf8'));
  ok(summary.n === petN && summary.tip === petTip, name + ' written summary ' + summary.n + ' files ' + meta.files + ' bytes ' + meta.bytes);
  ok(summary.rsig && summary.rsig[0] === 'r', name + ' summary carries the rules signature');
  ok(JSON.stringify(summary.seasons) === wantSeasons, name + ' summary carries the season records (eggs sold, points)');
  const first = JSON.parse(fs.readFileSync(path.join(out, 'own', meta.top[0].key + '.json'), 'utf8'));
  ok(first.pets.length <= split.PAGE && first.alive + first.dead === meta.top[0].n && first.pets.every(p => !p.dead && !p.released), name + ' first page is living pets only (' + first.pets.length + ' of ' + first.alive + ' alive, ' + first.dead + ' dead aside)');
  /* lead file (Rankings / Proof Parade quick paint): same answers as the full rank.json */
  const rank = JSON.parse(fs.readFileSync(path.join(out, 'rank.json'), 'utf8')), leadPath = path.join(out, 'p', split.LEAD_SHARD + '.json');
  const lead = fs.existsSync(leadPath) && JSON.parse(fs.readFileSync(leadPath, 'utf8'));
  const live = rank.pets.filter(r => !r.dead && !r.rel), pw = r => r.sg.reduce((a, v) => a + v, 0);
  const pMax = live.reduce((b, r) => !b || pw(r) > pw(b) || (pw(r) === pw(b) && r.id < b.id) ? r : b, null);
  const byO = {}; live.forEach(r => { byO[r.o] = (byO[r.o] || 0) + 1; }); const topO = Object.keys(byO).sort((a, b) => byO[b] - byO[a])[0];
  const deeds = rank.pets.filter(r => r.dd).length, have = lead ? new Set(lead.pets.map(r => r.id)) : new Set();
  ok(lead && lead.tops.power[0] === pMax.id && lead.counts.power === live.filter(r => pw(r) > 0).length, name + ' lead: strongest pet ' + pMax.id + ' first on the power board');
  ok(lead && lead.players.pets[0][1] === byO[topO] && lead.counts['players:pets'] === Object.keys(byO).length, name + ' lead: most pets ' + byO[topO] + ', ' + Object.keys(byO).length + ' wallets');
  ok(lead && lead.tops.power.concat(lead.tops.old, lead.tops.wins, lead.tops.wagmi).every(id => have.has(id)) && lead.pets.filter(r => r.dd).length === deeds, name + ' lead: carries every listed pet and all ' + deeds + ' tokenized pets');
  /* Rankings boards that are not about pets (Nov 24 2026, Top burners was empty on every fast load): the summary must carry XCPETS burned
   * per wallet and this week's wins, counted exactly as the page counts them from a full replay (js/v2-pages.js tally()). */
  const WEEK = 1008, pageAll = {}, pageWk = {}, pageWins = {};
  snap.rows.forEach(r => { if (r.status != null && String(r.status).toLowerCase() !== 'valid') return; const a = r.amount != null ? Number(r.amount) || 0 : (Number(r.quantity) || 0) / 1e8;
    pageAll[r.source] = (pageAll[r.source] || 0) + a; if (r.block_index > world.tip - WEEK) pageWk[r.source] = (pageWk[r.source] || 0) + a; });
  (world.fights || []).forEach(f => { if (f.status === 'done' && f.acceptBlock > world.tip - WEEK) pageWins[f.winner] = (pageWins[f.winner] || 0) + 1; });
  const BB = summary.burnBy || {}, r8 = v => Math.round(v * 1e8) / 1e8, burners = Object.keys(pageAll).filter(a => pageAll[a] > 0);
  const offB = burners.filter(a => !BB[a] || BB[a][0] !== r8(pageAll[a]) || BB[a][1] !== r8(pageWk[a] || 0));
  ok(burners.length > 0 && Object.keys(BB).length === burners.length && !offB.length, name + ' summary burnBy: ' + burners.length + ' burners, all time and this week match the page tally (' + offB.length + ' differ)');
  const sumB = Object.keys(BB).reduce((a, k) => a + BB[k][0], 0);
  ok(Math.abs(sumB - (world.community.burned || 0)) < 1e-4, name + ' burnBy adds up to every XCPETS burned (' + Math.round(sumB) + ' vs ' + Math.round(world.community.burned || 0) + ')');
  ok(JSON.stringify(summary.winsWk || null) === JSON.stringify(pageWins), name + ' summary winsWk: ' + Object.keys(pageWins).length + ' pets with wins this week, same as the page');
  const topB = burners.sort((a, b) => pageAll[b] - pageAll[a])[0], topI = rank.owners.indexOf(topB);
  ok(topI < 0 || (lead && lead.best[topI]), name + ' lead: the top burner\'s best pet is in the lead file');
  const lb = fs.statSync(leadPath).size, rb = fs.statSync(path.join(out, 'rank.json')).size;
  ok(lb < rb / 4 || lb < 400e3, name + ' lead file ' + Math.round(lb / 1024) + ' KB vs rank.json ' + Math.round(rb / 1024) + ' KB');
  return { ms: ms, n: petN, files: meta.files, bytes: meta.bytes, rss: process.memoryUsage().rss };
}
(async () => {
await many();
const a = await prove('snap-971786.json');
const b = await prove('snap-972901.json');
console.log('builder-like write tip ' + a.n + ' pets files ' + a.files + ' bytes ' + a.bytes + ' rssMB ' + Math.round(a.rss / 1e6));
console.log('builder-like write tip ' + b.n + ' pets files ' + b.files + ' bytes ' + b.bytes + ' rssMB ' + Math.round(b.rss / 1e6));
console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
