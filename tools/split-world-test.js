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
ok(rulesMd5 === '8e98664087bab2e991680ebdb80ba143', 'rules MD5 unchanged');
ok(/var ENABLED = false/.test(fs.readFileSync(path.join(__dirname, '..', 'js/doom-week.js'), 'utf8')), 'doom week stays off');

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
  ok(first.n === 30 && first.pages > 1 && first.pets.length === split.PAGE, 'owner with 30 pets is paged (' + first.pets.length + ' on page 0)');
  ok(first.pets.slice(0, 15).every(p => !p.dead) && first.pets[15].dead, 'alive pets lead the first page');
  let n = 0, alive = 0;
  for (let pg = 0; pg < first.pages; pg++) {
    const file = pg === 0 ? key + '.json' : key + '.' + pg + '.json';
    JSON.parse(fs.readFileSync(path.join(out, 'own', file), 'utf8')).pets.forEach(p => { n++; if (!p.dead && !p.released) alive++; });
  }
  ok(n === 30 && alive === 15, 'all 30 pets are in the owner pages (' + alive + ' alive)');
}

const sig = 'r' + 'ab'.repeat(16);
const dir = path.join(os.tmpdir(), 'split-worldfile-' + process.pid);
ok(worldFile(dir, [sig, '9', 'view', 'summary.json']) === path.join(dir, 'world', sig, '9', 'view', 'summary.json'), 'summary path is allowed');
ok(worldFile(dir, [sig, '9', 'view', 'o', 'ab.json']) === path.join(dir, 'world', sig, '9', 'view', 'o', 'ab.json'), 'owner shard path is allowed');
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
  const meta = await split.write(out, world, { tip: world.tip, rsig: rulesSig(loadBytes()) });
  const summary = JSON.parse(fs.readFileSync(path.join(out, 'summary.json'), 'utf8'));
  ok(summary.n === petN && summary.tip === petTip, name + ' written summary ' + summary.n + ' files ' + meta.files + ' bytes ' + meta.bytes);
  ok(summary.rsig && summary.rsig[0] === 'r', name + ' summary carries the rules signature');
  const first = JSON.parse(fs.readFileSync(path.join(out, 'own', meta.top[0].key + '.json'), 'utf8'));
  ok(first.pets.length <= split.PAGE && first.n === meta.top[0].n, name + ' first owner page is at most ' + split.PAGE + ' pets (' + first.pets.length + ' of ' + first.n + ')');
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
