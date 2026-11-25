#!/usr/bin/env node
/* Slim published world. Rules file is not part of the change.
 * Art rebuilt from the seed must match the stored art. Owner strings round-trip. */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), zlib = require('zlib'), crypto = require('crypto');
const PetCore = require('../rjs/pet-core');
const Art = require('../js/v2-art');
const { workerFns, encodeWorld } = require('./sync-server/snapshot');
const { wsDecode } = require('../js/v2-resume');
const split = require('./sync-server/split');
let pass = 0, fail = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (c) pass++; else fail++; };
ok(crypto.createHash('md5').update(fs.readFileSync(path.join(__dirname, '..', 'js/v2-rules.js'))).digest('hex') === require('./lib/rules-pin').pin('js/v2-rules.js'), 'rules bytes unchanged');

function rulesCtx() {
  const vm = require('vm');
  const files = ['rjs/config.js', 'rjs/pet-core.js', 'rjs/game-core.js', 'rjs/bonus-gear.js', 'rjs/real-core.js', 'rjs/chain.js', 'js/pet-core.js', 'js/bonus-gear.js', 'js/v2-gear.js', 'js/v2-fit.js', 'js/v2-rules.js'];
  const store = {};
  const ls = { getItem: k => store[k] || null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  const win = { console: { log() {}, warn() {}, error() {}, info() {} }, localStorage: ls, sessionStorage: ls, location: { search: '', hostname: 'xcpets.fun', href: 'https://xcpets.fun/' }, navigator: { userAgent: 'node' }, setTimeout: () => 0, clearTimeout() {}, URLSearchParams, URL, TextEncoder, TextDecoder };
  win.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ style: {} }), addEventListener() {}, body: null, documentElement: { style: {} } };
  win.addEventListener = () => {}; win.window = win; win.self = win;
  const ctx = vm.createContext(win);
  vm.runInContext('window.LiveEngine={RealCore:window.RealCore,Chain:window.Chain&&window.Chain.Chain,CFG:window.XCPETS_CONFIG};', ctx);
  files.forEach(f => vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), ctx, { filename: f }));
  return ctx;
}
const V = rulesCtx().V2Rules;
const opt = { ftLook: t => V.ftLookOfTier(t) };

function roundArt(p, label) {
  const before = JSON.parse(JSON.stringify(p.art));
  const note = Art.artNote(p, PetCore, opt);
  ok(!!note && !note.keep, label + ' art note drops the stored object');
  const back = Art.buildArt({ hatchTx: p.hatchTx, hatchBlock: p.hatchBlock, species: p.species, tier: p.tier, stats: p.stats, shards: p.shards, name: p.name, hybrid: p.hybrid, electric: p.electric, rareHatch: p.rareHatch, _ac: note && note.ac, _h: 0, _bh: note && note.bh, as: note && note.as, sid: note && note.sid, ax: note && note.ax }, [note.bh], PetCore, opt);
  ok(JSON.stringify(back) === JSON.stringify(before) || Art.diffArt(before, back) == null, label + ' rebuilt art matches');
  return note;
}

const bh = '11'.repeat(32), tx = 'ab'.repeat(32);
const hatch = V.hatchArt(bh, tx, 975000);
const hp = { id: 1, owner: '1JwWsArppwALMEdXWPmpDBcP1jwWsAPYkD', art: hatch, species: hatch.species, tier: hatch.tierIndex, stats: Object.assign({}, hatch.baseStats), name: hatch.defaultName, hatchBlock: 975000, hatchTx: tx, stage: 1 };
roundArt(hp, 'hatch');
const el = V.electricArt(bh, tx + ':3', 975200);
const ep = { id: 2, art: el, species: el.species, tier: el.tierIndex, stats: Object.assign({}, el.baseStats), name: el.defaultName, hatchBlock: 975200, hatchTx: tx + ':3', electric: 1, stage: 0 };
roundArt(ep, 'electric');
const kidArt = PetCore.generate({ blockHash: bh, petId: tx + ':child', blockHeight: 975300 });
const plan = V.hybridPlan(V.sha('cast:hyb:pepe:doge'), 'hyb:pepe:doge');
kidArt.species = plan.shape; kidArt.hybrid = plan; kidArt.shades = false; if (kidArt.eyes === 'beady') kidArt.eyes = 'classic';
const kp = { id: 3, art: kidArt, species: 'hyb:pepe:doge', tier: kidArt.tierIndex, stats: Object.assign({}, kidArt.baseStats), name: 'Hyb', hatchBlock: 975300, hatchTx: tx, hybrid: plan, stage: 2, dead: true };
const kn = roundArt(kp, 'hybrid grave');
ok(kn && kn.as === ':child', 'a bred pet stores only the :child suffix');

(function encoded() {
  const addr = '1JwWsArppwALMEdXWPmpDBcP1jwWsAPYkD';
  const addr2 = 'bc1qtke38j72qv4d8eljn7pccaykypw8luytfwdn7q';
  const a = PetCore.generate({ blockHash: bh, petId: tx, blockHeight: 975000 });
  a.species = 'doge'; a.tierIndex = 1; a.tier = PetCore.TIERS[1].id; a.shades = false;
  const b = PetCore.generate({ blockHash: bh, petId: tx + ':1', blockHeight: 975000 });
  b.shades = false;
  const p1 = { id: 10, owner: addr, art: a, species: 'doge', tier: 1, stats: Object.assign({}, a.baseStats), name: a.defaultName, hatchBlock: 975000, hatchTx: tx };
  const p2 = { id: 11, owner: addr, art: b, species: b.species, tier: b.tierIndex, stats: Object.assign({}, b.baseStats), name: b.defaultName, hatchBlock: 975000, hatchTx: tx + ':1' };
  const gear = { gid: 'g1', item: 'cap', label: 'Cap', slot: 'head', tier: 1, owner: addr2, on: 10 };
  const world = { tip: 975010, pets: [p1, p2], byId: { 10: p1, 11: p2 }, lookOwners: { 10: addr, 11: addr }, items: { g1: gear }, itemList: [gear] };
  const ctx = workerFns();
  const enc = encodeWorld(ctx, world);
  const info = Art.slimEncoded(enc.root, enc.parts, PetCore, opt);
  ok(info.art === 2 && info.artKept === 0, 'encoded art dropped for both pets (' + info.art + ')');
  ok(info.owners === 2, 'two owner addresses interned');
  const raw = Buffer.byteLength(JSON.stringify(enc.root)) + enc.parts.reduce((n, p) => n + Buffer.byteLength(JSON.stringify(p)), 0);
  const root = JSON.parse(JSON.stringify(enc.root));
  const parts = enc.parts.map(p => JSON.parse(JSON.stringify(p)));
  const back = wsDecode(root, parts);
  Art.restore(back, PetCore, opt);
  ok(!back._owners && !back._hashes, 'helper tables are removed after restore');
  ok(back.byId[10].owner === addr && back.byId[11].owner === addr && back.lookOwners[10] === addr && back.items.g1.owner === addr2, 'owner strings restored');
  ok(Art.diffArt(back.byId[10].art, a) == null && Art.diffArt(back.byId[11].art, b) == null, 'restored art matches');
  ok(!back.byId[10]._h && !back.byId[10].ax, 'art helpers are not left on the pet');
  console.log('encoded sample bytes ' + raw);
})();

(function saboAndScore() {
  const own = { id: 4, art: { dna: 'x' }, name: 'Mine' };
  const prev = { id: 4, _bits: 12.5, _hof: { n: 1, t: 2 }, art: { dna: 'rank' } };
  Art.carryRank(own, prev);
  ok(own._bits === 12.5 && own._hof.n === 1 && own.art.dna === 'x', 'a wallet pet keeps the builder trait score when it replaces the rank row');
  const board = [own, { id: 1765, dead: true, _bits: 40, name: 'Sabo' }, { id: 9, _bits: 3 }].filter(p => Art.onRankBoard(p) && p._bits != null && (p.id | 0) !== 1765);
  ok(board.map(p => p.id).join(',') === '4,9', 'Sabo #1765 is left off the trait board');
  ok(!board.some(p => p.dead), 'the trait board does not mark Sabo dead');
  const slim = Art.slimGear({ gid: 'cape', item: 'wojak-cape', tier: 1, slot: 'body', label: 'Cape', owner: 'a', on: 4 });
  const opened = Art.openGear(slim, 'a', 4, { itemOf: function () { return { label: 'Cape', slot: 'back' }; } });
  ok(opened.slot === 'body', 'a stored body slot stays body when the catalog says back');
})();

(async function view() {
  const pets = [];
  for (let i = 1; i <= 30; i++) pets.push({ id: i, owner: 'carol', name: 'P' + i, species: 'pepe', tier: 0, stage: 1, care: i, dead: i % 2 === 0, wins: 0, losses: 0, released: false, hatchBlock: 1000 + i, stats: { vigor: 1, spark: 1, grit: 1, zoom: 1, luck: 1 } });
  pets[0].deed = 'A1';
  const world = { tip: 30, pets: pets, deeds: { A1: { petId: 1, holder: 'carol', block: 10, tx: 't', issuer: 'carol' } }, mythicOwners: { carol: 100 }, items: {
    g1: { gid: 'g1', item: 'hat', label: 'Hat', slot: 'head', tier: 1, owner: 'carol', on: 1 },
    g9: { gid: 'g9', item: 'wojak-cape', label: 'Wojak cape', slot: 'body', tier: 1, owner: 'carol', on: null },
    g10: { gid: 'g10', item: 'bandana', label: 'WOW bandana', slot: 'body', tier: 1, owner: 'carol', on: null, bag: 2 },
    g11: { gid: 'g11', item: 'hat', label: 'Hat', slot: 'head', tier: 0, owner: 'dana', on: null }
  }, community: { burned: 1, leaderboard: [] }, log: [] };
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'slim-view-'));
  const meta = await split.write(out, world, { tip: 30, rsig: 'rtest' });
  const summary = JSON.parse(fs.readFileSync(path.join(out, 'summary.json'), 'utf8'));
  ok(summary.v === 3 && summary.rank === 'view/rank.json', 'summary is the slim view');
  const key = split.ownerKey('carol');
  const first = JSON.parse(fs.readFileSync(path.join(out, 'own', key + '.json'), 'utf8'));
  ok(first.v === 3 && first.pets && first.pets.length === 15 && first.ids.length === 15 && first.pets.every(p => !p.dead), 'first owner page keeps the living rows and their ids');
  ok(!first.pets.some(p => p.art), 'owner page does not store art');
  const dead = JSON.parse(fs.readFileSync(path.join(out, 'own', key + '.d.json'), 'utf8'));
  ok(dead.ids.length === 15 && dead.pets && dead.pets.every(p => p.dead), 'grave page is ids plus the first page of rows');
  const rank = JSON.parse(fs.readFileSync(path.join(out, 'rank.json'), 'utf8'));
  ok(rank.pets.length === 30 && rank.owners.indexOf('carol') === 0, 'rank file lists every pet once');
  const shard = JSON.parse(fs.readFileSync(path.join(out, 'p', '00000.json'), 'utf8'));
  ok(shard.v === 3 && shard.pets['1'] && !shard.pets['1'].art && shard.pets['1'].o === 0, 'shard row is slim and owner is an index');
  ok(first.deeds && first.deeds.A1 && first.deeds.A1.holder === 'carol' && first.mythicAt === 100 && first.roster && first.roster.alive === 15 && Array.isArray(first.rise), 'page 0 keeps deeds, mythicAt, roster and rise');
  ok(first.stash && first.stash.length === 2 && first.stash.some(g => g.g === 'g9' && g.slot === 'body' && !g.i.includes('hat')) && first.stash.some(g => g.g === 'g10' && g.bag === 2) && !first.stash.some(g => g.g === 'g1' || g.g === 'g11'), 'page 0 stash is only this owner\'s unworn gear');
  const bare = JSON.parse(JSON.stringify(first)); delete bare.stash;
  const added = Buffer.byteLength(JSON.stringify(first)) - Buffer.byteLength(JSON.stringify(bare));
  ok(added > 20 && added < 400, 'two unworn pieces add ' + added + ' bytes to the owner page');
  const vm = require('vm');
  const ctx = {
    console: console, crypto: crypto, TextEncoder: TextEncoder, TextDecoder: TextDecoder, URL: URL, URLSearchParams: URLSearchParams,
    setTimeout: setTimeout, clearTimeout: clearTimeout, fetch: function () { return Promise.reject(new Error('offline')); },
    document: { scripts: [], getElementById: function () { return null; }, body: { insertBefore: function () {} } },
    location: { search: '', href: 'https://xcpets.fun/play.html' },
    localStorage: { getItem: function () { return null; }, setItem: function () {}, removeItem: function () {} },
    sessionStorage: { getItem: function () { return null; }, setItem: function () {}, removeItem: function () {} },
    V2Rules: { itemOf: function () { return { label: 'Cape', slot: 'back' }; } }
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js/v2-art.js'), 'utf8'), ctx, { filename: 'js/v2-art.js' });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js/v2-split.js'), 'utf8'), ctx, { filename: 'js/v2-split.js' });
  const built = ctx.V2Split.assemble({ tip: 30, n: 30, alive: 15, dead: 15, burned: 1, burns: 0, community: {}, cold: {}, wagmi: {} }, {
    owners: { carol: first.pets }, stash: first.stash, owner: 'carol', deeds: first.deeds, mythicOwners: { carol: first.mythicAt }, roster: first.roster, rise: first.rise
  });
  const cape = (built.itemList || []).filter(function (g) { return g.gid === 'g9'; })[0];
  const band = (built.itemList || []).filter(function (g) { return g.gid === 'g10'; })[0];
  ok(built.deeds && built.deeds.A1 && built.mythicOwners.carol === 100 && built._roster && built._roster.alive === 15, 'assemble keeps deeds, the Mythic block and the roster');
  ok(cape && cape.on == null && cape.owner === 'carol' && cape.slot === 'body' && cape.item === 'wojak-cape', 'assemble puts unworn stash gear on itemList');
  ok(band && band.bag === 2 && band.on == null, 'a bagged stash piece stays bagged');
  const { worldFile } = require('./sync-server/server');
  ok(worldFile('/data', ['r' + 'ab'.repeat(16), '30', 'view', 'rank.json']) && worldFile('/data', ['r' + 'ab'.repeat(16), '30', 'view', 'owners.json']), 'rank and owner tables are publishable paths');
  const fresh = [];
  for (let i = 1; i <= 30; i++) fresh.push({ id: i, owner: 'carol', name: 'P' + i, species: 'pepe', tier: 0, stage: 1, care: i, dead: i % 2 === 0, wins: 0, losses: 0, released: false, hatchBlock: 1000 + i, stats: { vigor: 1, spark: 1, grit: 1, zoom: 1, luck: 1 } });
  const saboWorld = { tip: 40, pets: fresh.concat([{ id: 1765, owner: 'carol', name: 'Sabo', species: 'wojak', tier: 3, stage: 5, care: 9, dead: true, wins: 0, losses: 0, released: false, hatchBlock: 900, stats: { vigor: 20, spark: 20, grit: 20, zoom: 20, luck: 20 }, art: { eyes: 'classic', pattern: 'none', background: 'solid', cheeks: false, species: 'wojak' } }]), items: {}, community: { burned: 1, leaderboard: [] }, log: [] };
  const saboOut = fs.mkdtempSync(path.join(os.tmpdir(), 'slim-sabo-'));
  await split.write(saboOut, saboWorld, { tip: 40, rsig: 'rtest' });
  const saboRank = JSON.parse(fs.readFileSync(path.join(saboOut, 'rank.json'), 'utf8'));
  ok(!saboRank.pets.some(p => p.id === 1765), 'rank.json leaves Sabo #1765 out');
  ok(saboRank.pets.some(p => p.id === 1 && p.rb != null), 'other pets still carry a trait score');
  console.log('toy view bytes ' + meta.bytes + ' rank ' + fs.statSync(path.join(out, 'rank.json')).size);
})().then(function () {
  const files = ['/tmp/s0.json', '/tmp/hyb.json'].filter(f => fs.existsSync(f));
  let pets = 0, okN = 0, kept = 0, artB = 0, noteB = 0, groups = { hy: 0, leg: 0, myth: 0, rare: 0, dead: 0 };
  files.forEach(f => {
    Object.values(JSON.parse(fs.readFileSync(f, 'utf8')).pets).forEach(p => {
      pets++; artB += Buffer.byteLength(JSON.stringify(p.art || {}));
      if (p.hybrid || (p.art && p.art.hybrid)) groups.hy++;
      if (p.tier === 3) groups.leg++;
      if ((p.stage || 0) >= 5) groups.myth++;
      if (p.rareHatch || (p.art && p.art.rareHatch)) groups.rare++;
      if (p.dead) groups.dead++;
      const n = Art.artNote(p, PetCore, opt);
      if (!n || n.keep) kept++; else { okN++; noteB += Buffer.byteLength(JSON.stringify({ h: n.bh, as: n.as, sid: n.sid, ax: n.ax })); }
    });
  });
  if (pets) {
    ok(okN === pets && kept === 0, 'live sample ' + pets + ' pets rebuilt (hybrid ' + groups.hy + ', legendary ' + groups.leg + ', mythic stage ' + groups.myth + ', rare hatch ' + groups.rare + ', dead ' + groups.dead + ')');
    console.log('sample art bytes ' + artB + ' note bytes ' + noteB + ' rssMB ' + Math.round(process.memoryUsage().rss / 1e6));
  }
  console.log(pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
}).catch(e => { console.error(e); process.exit(1); });
