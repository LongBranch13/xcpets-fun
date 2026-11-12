/* DJ Pepe breeding (owner Nov 12 2026). DJ Pepe is a Legend egg, not a community pet, and never goes to Cold Storage.
 * ACTIVATE_DJ_BREED_BLOCK stays null in this PR. Before it, breedable() and the legendary-mix pool match the old gate.
 * Dev only: nothing is signed or sent. */
'use strict';
const assert = require('assert'), crypto = require('crypto'), { execFileSync } = require('child_process'), path = require('path');
const { load, row } = require('./lib/load-rules');
const ROOT = path.resolve(__dirname, '..');
const c = load(['js/djpepe-sprite.js']);
const V = c.V2Rules;
const GATE = 980000, bh = 'a'.repeat(64);
const H = s => crypto.createHash('sha256').update(String(s)).digest('hex');
const WHY = 'DJ Pepe breeding awaits his community Cold Storage';
const st = { vigor: 12, spark: 12, grit: 12, zoom: 12, luck: 12 };
let n = 0, fail = 0;
function ok(fn) { try { fn(); n++; } catch (e) { fail++; console.log('FAIL ' + (e && e.message ? e.message : e)); } }

const adult = { id: 101, species: 'djpepe', stage: 3, tier: 2, breeds: 0, breedsV2: 0, owner: 'dj-owner', stats: Object.assign({}, st), parents: [], children: [], art: { species: 'djpepe', tierIndex: 2 } };

ok(() => assert.strictEqual(V.ACTIVATE_DJ_BREED_BLOCK, null));
ok(() => assert.strictEqual(V.djBreedGate(), null));
for (const b of [0, 1, 974961, 974962, 975000, 975555, GATE - 1, GATE, GATE + 6]) {
  ok(() => assert.strictEqual(V.djBreedOn(b), V.djRareBreedOn(b), 'null gate matches the old breed check at ' + b));
}
ok(() => assert.strictEqual(V.breedable(adult, GATE), WHY));
ok(() => assert.strictEqual(V.breedable(Object.assign({}, adult, { dead: true }), GATE - 1), 'dead'));
ok(() => assert.strictEqual(V.breedable(Object.assign({}, adult, { released: true }), GATE - 1), 'released'));

V._setDjBreedActivation(Infinity);
ok(() => assert.strictEqual(V.djBreedOn(GATE), false));
ok(() => assert.strictEqual(V.breedable(adult, GATE), WHY));
V._setDjBreedActivation(null);
ok(() => assert.strictEqual(V.breedable(adult, GATE), WHY));

V._setDjBreedActivation(GATE);
ok(() => assert.strictEqual(V.djBreedGate(), GATE));
ok(() => assert.strictEqual(V.djBreedOn(GATE - 1), false));
ok(() => assert.strictEqual(V.breedable(adult, GATE - 1), WHY));
ok(() => assert.strictEqual(V.djBreedOn(GATE), true));
ok(() => assert.strictEqual(V.breedable(adult, GATE), null));
ok(() => assert.strictEqual(V.breedable(adult, GATE + 100), null));
ok(() => assert.strictEqual(V.breedable(Object.assign({}, adult, { dead: true }), GATE), 'dead'));
ok(() => assert.strictEqual(V.breedable(Object.assign({}, adult, { released: true }), GATE), 'released'));
ok(() => assert.strictEqual(V.breedable(Object.assign({}, adult, { stage: 2 }), GATE), 'needs Adult+'));
ok(() => assert(/away on a quest/.test(V.breedable(Object.assign({}, adult, { quest: { code: 'spam', end: GATE + 40 } }), GATE) || '')));
ok(() => assert(/breeding cooldown/.test(V.breedable(Object.assign({}, adult, { lastBreed: GATE }), GATE + 10) || '')));
ok(() => assert.strictEqual(V.breedable(Object.assign({}, adult, { lastBreed: GATE }), GATE + V.BREED_COOLDOWN), null));

/* Legendary-mix third root: the same hashes, one block before the gate, never pick djpepe and match the gate-off pool. */
function legMix(hex, b) {
  const kid = { species: 'hyb:pepe:wojak', hybrid: { roots: ['pepe', 'wojak'], shape: 'pepe', parts: [] } };
  V._breedExtras({ id: 1, tier: 3, species: 'pepe', stats: st }, { id: 2, tier: 3, species: 'wojak', stats: st }, hex, kid, b);
  return kid.hybrid.legMix || null;
}
V._setDjBreedActivation(null);
const before = [];
for (let i = 0; i < 2400; i++) before.push(legMix(H('legmix-' + i), GATE - 1));
ok(() => assert(!before.some(x => x === 'djpepe')));
V._setDjBreedActivation(GATE);
const edge = [];
for (let i = 0; i < 2400; i++) edge.push(legMix(H('legmix-' + i), GATE - 1));
ok(() => assert.deepStrictEqual(edge, before));
const after = [];
for (let i = 0; i < 2400; i++) after.push(legMix(H('legmix-' + i), GATE));
ok(() => assert(after.indexOf('djpepe') >= 0, 'djpepe joins the third-root pool at the gate'));

/* Naming stays the mashup already shipped. */
ok(() => assert.strictEqual(V.hybridName('hyb:djpepe:pepe'), 'DJepe'));
ok(() => assert.strictEqual(V.hybridName('hyb:pepe:djpepe'), 'DJepe'));
ok(() => assert.strictEqual(V.speciesLabel('hyb:djpepe:pepe'), 'DJepe (hybrid)'));

/* A real DJ Pepe x Pepe egg, with the ordinary cost check on the send guard. */
V._setHalvingActivation(null);
V._setFiresaleActivation(null);
const rows = [row(GATE, 'dj-owner', 100000, 'pet:hatch'), row(GATE, 'dj-owner', 100000, 'pet:hatch')];
const w = V.replay(rows, { [GATE]: bh }, [], { tip: GATE });
const mine = w.pets.filter(p => p.owner === 'dj-owner');
ok(() => assert(mine.length >= 2));
const A = mine[0], B = mine[1];
A.species = 'djpepe'; A.art.species = 'djpepe'; A.stage = 3; A.tier = 2;
B.species = 'pepe'; B.art.species = 'pepe'; B.stage = 3; B.tier = 2;
const tag = 'pet:breed:' + A.id + ':' + B.id;
V._setDjBreedActivation(null);
ok(() => assert(String(V.sendBlock(w, { tag: tag, amount: 100000 }, GATE - 1, { me: 'dj-owner' }) || '').indexOf('Cold Storage') >= 0));
V._setDjBreedActivation(GATE);
ok(() => assert(/below breed cost/.test(V.sendBlock(w, { tag: tag, amount: 0 }, GATE - 1, { me: 'dj-owner' }) || '')));
ok(() => assert.strictEqual(V.sendBlock(w, { tag: tag, amount: 100000 }, GATE - 1, { me: 'dj-owner' }), null));
let sawDj = 0;
for (let i = 0; i < 64; i++) {
  const kid = V.breedOne(w, A, B, bh, H('dj-x-pepe-' + i), GATE, 'dj-owner');
  ok(() => assert(kid && kid.id && kid.art && kid.stage === 0));
  ok(() => assert(kid.parents[0] === A.id && kid.parents[1] === B.id));
  ok(() => assert(!kid.art.rareHatch && !kid.rareHatch));
  const roots = V.hybridRoots(kid.species);
  ok(() => assert(kid.species === 'djpepe' || kid.species === 'pepe' || roots.indexOf('djpepe') >= 0));
  if (kid.species === 'djpepe' || roots.indexOf('djpepe') >= 0) sawDj++;
  if (V.isHybrid && V.isHybrid(kid.species)) ok(() => assert.strictEqual(V.hybridName(kid.species), 'DJepe'));
}
ok(() => assert(sawDj > 0, 'at least one child carries DJ Pepe'));

/* The old mythic path still opens breeding, so the cold-storage tests keep their meaning. */
V._setDjBreedActivation(null);
V._setRareEggsActivation(GATE);
ok(() => assert(!V.djRareBreedOn(GATE)));
V.reindex({ items: {}, djpepeMythic: { block: GATE + 10 } });
ok(() => assert(!V.djRareBreedOn(GATE + 10)));
ok(() => assert(V.djRareBreedOn(GATE + 11)));
ok(() => assert.strictEqual(V.breedable(adult, GATE + 11), null));
V.reindex({ items: {} });
ok(() => assert.strictEqual(V.breedable(adult, GATE + 11), WHY));

/* History replay with the constant left null matches origin/main. */
const snaps = ['snap-971786.json', 'snap-972883.json', 'snap-972901.json'];
for (const s of snaps) {
  let out = '';
  try {
    out = execFileSync(process.execPath, ['tools/replay-check.js', '--compare', 'origin/main', '--snap', path.join('tools', 'snapshots', s)], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64e6 });
  } catch (e) { out = (e.stdout || '') + '\n' + (e.stderr || ''); }
  const same = out.split('\n').some(l => l.trim() === 'SAME');
  ok(() => assert(same, s + ' pre-gate replay is not SAME\n' + out.split('\n').slice(-12).join('\n')));
}

if (fail) { console.log('FAIL ' + fail + ' of ' + (n + fail)); process.exit(1); }
console.log('PASS ' + n + ' DJ Pepe breed-gate checks');
