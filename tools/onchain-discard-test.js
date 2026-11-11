#!/usr/bin/env node
/* On-chain discard (pet:hd / pet:hu). Dev tooling only. Never signs or broadcasts.
 *   node tools/onchain-discard-test.js
 * Checks the planner (one burn for a class or a contiguous run, exact multi-burn
 * when a selection does not fit, no approximation), replay of the new tags, and
 * SAME replays at the historical checkpoints. */
'use strict';
const crypto = require('crypto'), cp = require('child_process'), fs = require('fs'), path = require('path');
const { load, row, fakeHash, ROOT } = require('./lib/load-rules');
const ctx = load(), V = ctx.V2Rules;
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
function md5(buf) { return crypto.createHash('md5').update(buf).digest('hex'); }
function gitFile(f) { return cp.execFileSync('git', ['show', 'origin/main:' + f], { cwd: ROOT }); }
const RULES = ['js/v2-rules.js', 'js/pet-core.js', 'rjs/pet-core.js', 'rjs/game-core.js', 'rjs/real-core.js', 'rjs/burn-core.js', 'rjs/config.js'];
console.log('rule MD5 versus origin/main');
RULES.forEach(f => {
  const now = md5(fs.readFileSync(path.join(ROOT, f))), was = md5(gitFile(f));
  console.log((now === was ? '  same ' : '  CHANGED ') + now + '  ' + f);
  if (f !== 'js/v2-rules.js') ok(now === was, 'only v2-rules.js may change (' + f + ')');
});
ok(V.ACTIVATE_ONCHAIN_DISCARD_BLOCK === 975490, 'gate is block 975490 (tip 975484 + 6)');
ok(V.parseTag('pet:hd:all').action === 'hd' && V.parseTag('pet:hd:NF').filter === 'nf' && V.parseTag('pet:hu:C').action === 'hu', 'class filters parse');
ok(V.parseTag('pet:hd:00:0HNN0').runs && V.parseTag('pet:hd:00:0HNN0').runs[1] === 6000, 'a run of 6,000 decodes');
ok(V.parseTag('pet:hd:1:00:0F').mode === 1, 'invert mode parses');
ok(V.parseTag('pet:hd:' + '1'.repeat(40)).action === 'invalid', 'an over-long discard tag is rejected');

const ME = 'bc1qdiscardowner000000000000000000000000';
function makeWorld(n) {
  const A = 975490, pets = [], byId = {};
  for (let i = 0; i < n; i++) {
    const p = { id: i + 1, owner: ME, community: false, hatchBlock: A - 30, lastFed: i % 19 === 0 ? null : A - 4, tier: i % 4, stage: i % 6, dead: false, released: false, name: 'P' + (i + 1) };
    if (i === 7) { p.deed = 'A12345678901234567'; p.tier = 3; } /* tokenized, not listed: discard is allowed */
    pets.push(p); byId[p.id] = p;
  }
  pets[2].deed = 'A123';
  return { pets: pets, byId: byId, tip: A, listings: [{ petId: 3, status: 'open', expire: 99999999, seller: ME, give: 'A123' }] };
}
function idsOf(plan) { const s = new Set(); (plan.plans || []).forEach(q => (q.petIds || []).forEach(id => s.add(id))); return s; }
function exact(plan, want) { const got = idsOf(plan); if (got.size !== want.length) return false; return want.every(id => got.has(id)); }
const big = makeWorld(8000);
const t0 = Date.now();
const all = V.hdPlan(big, ME, big.pets.map(p => p.id), big.tip + 1);
const allMs = Date.now() - t0;
ok(all.ok && all.one && all.plans.length === 1 && all.plans[0].tag === 'pet:hd:ALL' && all.plans[0].amount === V.HD_COST, 'discard every living pet is one pet:hd:ALL burn (' + allMs + 'ms)' + (all.ok ? '' : ' ' + all.why));
ok(all.plans[0].tag.length <= 34, 'the all tag fits in 34 bytes');
const sixIds = big.pets.slice(0, 6000).map(p => p.id);
const six = V.hdPlan(big, ME, sixIds, big.tip + 1);
ok(six.ok && six.one && six.plans.length === 1 && six.plans[0].tag.indexOf('pet:hd:') === 0 && six.plans[0].petIds.length === 5999, '6,000 contiguous pets (one listed left out) is one exact burn (' + (six.plans[0] && six.plans[0].tag) + ')');
ok(six.left.some(x => x.id === 3 && /listed/.test(x.why)) && !idsOf(six).has(3), 'a listed pet is refused and is not inside the burn');
ok(idsOf(all).has(8), 'a tokenized pet that is not listed can be discarded');
const keep = [1, 2, 4, 5, 6];
const rest = big.pets.map(p => p.id).filter(id => keep.indexOf(id) < 0 && id !== 3);
const tInv = Date.now();
const inv = V.hdPlan(big, ME, rest, big.tip + 1);
ok(inv.ok && inv.one && inv.plans[0].invert && inv.plans[0].tag.indexOf('pet:hd:1:') === 0 && inv.plans[0].tag.length <= 34, 'discard-all-except a compact keep set is one invert burn (' + (Date.now() - tInv) + 'ms, ' + (inv.plans[0] && inv.plans[0].tag) + ')');
const scatter = [];
for (let i = 1; i <= 6000; i += 30) scatter.push(i);
const tSc = Date.now();
const sc = V.hdPlan(big, ME, scatter.filter(id => id !== 3), big.tip + 1);
const scMs = Date.now() - tSc;
ok(sc.ok && !sc.one && sc.plans.length > 1 && exact(sc, scatter.filter(id => id !== 3)), 'a scattered set does not fit one tag and the offered burns are exact (' + sc.plans.length + ' burns, ' + scMs + 'ms)');
ok(sc.plans.every(q => q.tag.length <= 34 && q.amount === V.HD_COST), 'every offered burn is 1 dander and at most 34 bytes');
ok(/does not fit in one 34-byte burn/.test(sc.why), 'the planner says the selection does not fit one burn');
const dead = makeWorld(20); dead.pets[9].dead = true;
const mixed = V.hdPlan(dead, ME, [1, 2, 10], dead.tip + 1);
ok(mixed.ok && !mixed.exact && mixed.left.some(x => x.id === 10) && !idsOf(mixed).has(10) && exact(mixed, [1, 2].filter(id => idsOf(mixed).has(id))), 'a dead pet is left out instead of being approximated into the burn');
console.log('MEASURE planner all ' + allMs + 'ms, scattered 6000-step ' + scMs + 'ms for ' + sc.plans.length + ' exact burns');

/* engine: below the gate the tag is community food; at the gate it hides, blocks breed and the wheel, and a transfer clears it */
const YOU = 'bc1qdiscardbuyer000000000000000000000000';
const B = 975488;
let rows = [row(B, ME, 0.00000001, 'pet:hi'), row(B, YOU, 0.00000001, 'pet:hi')];
for (let i = 0; i < 4; i++) rows.push(row(B, ME, 69, 'pet:hatch'));
rows.push(row(B + 1, ME, 0.00000001, 'pet:hd:ALL')); /* below the gate */
function play(list, tip) {
  const hashes = {};
  list.forEach(r => { hashes[r.block_index] = fakeHash(r.block_index); });
  return V.replay(list, hashes, [], { tip: tip, live: ctx.LiveEngine && ctx.LiveEngine.RealCore });
}
let w = play(rows, B + 1);
const mine = () => w.pets.filter(p => p.owner === ME && !p.dead);
ok(mine().length === 4 && mine().every(p => !p.hd), 'a discard below the gate does not hide any pet (' + mine().length + ' of yours)');
const early = w.log.filter(e => e.block === B + 1);
ok(early.some(e => /unknown pet: tag \(community food\)/.test(e.msg)), 'a discard below the gate is community food, same as any unknown pet tag');
rows.push(row(975491, ME, 0.00000001, 'pet:hd:ALL'));
w = play(rows, 975491);
ok(mine().length === 4 && mine().every(p => p.hd === ME), 'pet:hd:ALL at the gate discards every living pet the signer owns');
ok(V.refList(w, ME, 975491, 975492).length === 0, 'discarded pets leave refList');
ok(V.wheelPets(w, ME, 975492, true).length === 0, 'discarded pets leave the Pepe Wheel');
const breed = V.breedable(mine()[0], 975492);
ok(breed === 'discarded', 'a discarded pet cannot breed (' + breed + ')');
rows.push(row(975492, ME, 0.00000001, 'pet:hu:ALL'));
w = play(rows, 975492);
ok(mine().every(p => !p.hd) && V.refList(w, ME, 975492, 975493).length === 4, 'pet:hu:ALL adds every discarded pet back');
rows.push(row(975493, ME, 0.00000001, 'pet:hd:C'));
w = play(rows, 975493);
const commons = mine().filter(p => (p.tier | 0) === 0);
ok(commons.length && commons.every(p => p.hd === ME) && w.pets.some(p => (p.tier | 0) !== 0 && !p.hd), 'pet:hd:C discards only Commons');
const gifted = Object.assign({}, commons[0]);
V._noteGot(w, gifted, YOU); gifted.owner = YOU;
ok(!gifted.hd && commons[0].hd === ME, 'changing owner clears the discard flag; the copy still owned stays discarded');
ok(w.byId[commons[1].id].hd === ME, 'a pet that stayed behind is still discarded');

if (fails) { console.log(fails + ' failed'); process.exit(1); }
console.log('planner and engine ok');
