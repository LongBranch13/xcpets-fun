#!/usr/bin/env node
/* THE MEAT GRINDER (pet:grind). Dev tooling only. Never signs or broadcasts.
 *   node tools/grinder-test.js
 * Checks: below the gate pet:grind is community food; at the gate it grinds only on-chain discarded pets (never Wizards, Mythics,
 * tokenized pets or pets that were not discarded), meat per rarity, spins every 250 meat, Sausage Eggs every 1,000 (never Common),
 * the 2,000 cap and pet:grind:N, the preview matches the replay, and the send check. */
'use strict';
const { load, row, fakeHash } = require('./lib/load-rules');
const ctx = load(), V = ctx.V2Rules;
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const ME = 'bc1qgrinderowner0000000000000000000000000', YOU = 'bc1qgrinderother0000000000000000000000000';
const G = 980000;
function play(list, tip) { const hashes = {}; list.forEach(r => { hashes[r.block_index] = fakeHash(r.block_index); }); return V.replay(list, hashes, [], { tip: tip, live: ctx.LiveEngine && ctx.LiveEngine.RealCore }); }
const mine = w => w.pets.filter(p => p.owner === ME);
const alive = w => mine(w).filter(p => !p.dead && !p.released);

const GATE = V.grindGate(), GATE2 = V.grind2Gate();
ok(GATE2 === 977456, 'Meat Grinder 2 (better eggs, keep choice) opens at block 977,456');
V._setGrind2Activation(null); /* sections 1-4 check the first Grinder exactly as it was */
const GATE_AS = V.aspieGate ? V.aspieGate() : null; if (V._setAspieActivation) V._setAspieActivation(null); /* Aspie (the Grinder's own pet) has tools/aspie-test.js; here the prize stays the slot pet */
ok(GATE === 977220, 'the Grinder opens at block 977,220');
V._setGrindActivation(null); /* section 1 checks the switched-off behaviour */
ok(V.parseTag('pet:grind').action === 'grind' && V.parseTag('pet:grind:2000').n === 2000 && V.parseTag('pet:grind:2001').action === 'invalid' && V.parseTag('pet:grind:0').action === 'invalid', 'pet:grind and pet:grind:N (1-2000) parse');

/* 1 · gate off: community food */
let rows = [row(G - 40, ME, 0.00000001, 'pet:hi'), row(G - 40, YOU, 0.00000001, 'pet:hi')];
for (let i = 0; i < 12; i++) rows.push(row(G - 30, ME, 69, 'pet:hatch'));
rows.push(row(G - 20, ME, 0.00000001, 'pet:hd:ALL'));
rows.push(row(G - 10, ME, 69, 'pet:grind'));
let w = play(rows, G - 10);
ok(alive(w).length === 12 && alive(w).every(p => p.hd === ME), '12 pets hatched and discarded on chain');
ok(w.log.some(e => e.block === G - 10 && /community food/.test(e.msg)) && alive(w).length === 12, 'with the gate off, pet:grind is community food and grinds nothing');

/* 2 · gate on: grinds only discarded pets, meat by rarity */
V._setGrindActivation(G);
rows = rows.filter(r => r.block_index !== G - 10);
for (let i = 0; i < 3; i++) rows.push(row(G - 15, ME, 69, 'pet:hatch')); /* hatched after the discard: NOT discarded */
w = play(rows, G);
const keepIds = alive(w).filter(p => p.hd !== ME).map(p => p.id);
ok(keepIds.length === 3, '3 newer pets are not in the discard pile');
const pv = V.grindPreview(w, ME, G + 1);
const wantMeat = alive(w).filter(p => p.hd === ME).reduce((a, p) => a + V.GRIND.MEAT[p.tier], 0);
ok(pv.ok && pv.n === 12 && pv.meat === wantMeat, 'preview: 12 pets, ' + pv.meat + ' meat (Common 1, Uncommon 2, Rare 5, Legendary 20)');
ok(V.sendBlock(w, { tag: 'pet:grind', amount: 69 }, G, { me: ME }) === null, 'the send check passes for a 69 XCPETS grind');
ok(/below grind cost/.test(V.sendBlock(w, { tag: 'pet:grind', amount: 1 }, G, { me: ME }) || ''), 'the send check refuses a burn below the cost');
ok(/already waiting/.test(V.sendBlock(w, { tag: 'pet:grind', amount: 69 }, G, { me: ME, pending: ['pet:grind'] }) || ''), 'the send check refuses a second grind while one is pending');
rows.push(row(G + 1, ME, 69, 'pet:grind'));
w = play(rows, G + 1);
const gl = w.log.filter(e => e.kind === 'grind');
ok(gl.length === 1 && gl[0].petIds.length === 12 && gl[0].meat === wantMeat, 'one grind: 12 pets, ' + (gl[0] && gl[0].meat) + ' meat');
ok(mine(w).filter(p => p.ground === G + 1).every(p => p.released === G + 1 && p.usedUp === 'grind') && mine(w).filter(p => p.ground).length === 12, 'ground pets are used up at the grind block');
ok(keepIds.every(id => !w.byId[id].released && !w.byId[id].ground), 'pets that were not discarded on chain are untouched');
ok(w.grind[ME].meat === wantMeat && w.grind[ME].ground === 12 && w.grind[ME].grinds === 1, 'the meter keeps the meat');
const sp = Math.floor(wantMeat / 250);
ok(w.grind[ME].spins === sp && (w.spins[ME] || { earned: 0 }).log.filter(x => x.src === 'grind').reduce((a, x) => a + x.n, 0) === sp, sp + ' spin(s) for passing ' + sp + ' x 250 meat');
rows.push(row(G + 2, ME, 69, 'pet:grind'));
w = play(rows, G + 2);
ok(w.log.some(e => e.block === G + 2 && e.kind === 'rejected' && /nothing in your discard pile/.test(e.msg)), 'a second grind with an empty pile is rejected (nothing ground)');

/* 3 · never ground: Wizards, Mythics, tokenized */
const fake = { pets: [], byId: {}, tip: G + 5, listings: [], fights: [], cem: { altars: {} } };
[['wizard', {}], ['pepe', { mythicCare: 1, stage: 5 }], ['pepe', { deed: 'A99' }], ['pepe', { resurrected: 1 }], ['pepe', {}], ['pepe', { hd: YOU }]].forEach((x, i) => {
  const p = Object.assign({ id: i + 1, owner: ME, hd: ME, species: x[0], tier: 0, stage: 1, hatchBlock: G - 100, lastFed: G - 2, feedDays: {}, care: 69 }, x[1]); fake.pets.push(p); fake.byId[p.id] = p; });
const why = fake.pets.map(p => V.grindWhy(fake, p, ME, G + 6));
ok(/Wizards/.test(why[0]) && /Gods and Mythics/.test(why[1]) && /tokenized/.test(why[2]) && /Gods and Mythics/.test(why[3]) && why[4] === null && /discard pile/.test(why[5]), 'Wizards, Mythics, Gods and tokenized pets never go in; only my own discards do (' + why.join(' | ') + ')');

/* 4 · an Electric case: Sausage Eggs, the cap, pet:grind:N */
const H = G + 100;
let r2 = [row(H - 50, ME, 0.00000001, 'pet:hi'), row(H - 40, ME, 100000, 'pet:hatchzap'), row(H - 30, ME, 0.00000001, 'pet:hd:ALL')];
w = play(r2, H - 30);
const box = alive(w).filter(p => p.hd === ME);
ok(box.length === 1000, 'an Electric case hatched 1,000 pets, all discarded on chain (' + box.length + ')');
const pv2 = V.grindPreview(w, ME, H - 29, 300);
ok(pv2.n === 300 && pv2.ids[0] === Math.min.apply(null, box.filter(p => !V.grindWhy(w, p, ME, H - 29)).map(p => p.id)), 'pet:grind:300 takes the 300 lowest-numbered eligible pets');
r2.push(row(H - 29, ME, 69, 'pet:grind:300'));
w = play(r2, H - 29);
ok(w.grind[ME].ground === 300 && w.grind[ME].meat === pv2.meat, 'grind:300 ground 300 pets for ' + pv2.meat + ' meat, as the preview said');
const pv3 = V.grindPreview(w, ME, H - 28);
r2.push(row(H - 28, ME, 69, 'pet:grind'));
w = play(r2, H - 28);
const G2 = w.grind[ME], last = G2.last;
ok(G2.ground === 300 + pv3.n && G2.meat === pv2.meat + pv3.meat && last.spins === pv3.spins && last.eggs === pv3.eggs, 'the second grind matches its preview (' + pv3.n + ' pets, ' + pv3.meat + ' meat, ' + pv3.spins + ' spins, ' + pv3.eggs + ' eggs)');
const sausages = mine(w).filter(p => p.sausage && !p.golden);
ok(G2.eggs >= 1 && sausages.length === G2.eggs && sausages.every(p => p.tier >= 1 && p.owner === ME && !p.hd), G2.eggs + ' Sausage Egg(s) hatched, none Common (' + sausages.map(p => '#' + p.id + ' tier ' + p.tier).join(', ') + ')');
ok(G2.spins === Math.floor(G2.meat / 250) && G2.eggs === Math.floor(G2.meat / 1000), 'spins and eggs follow the meter: ' + G2.meat + ' meat = ' + G2.spins + ' spins + ' + G2.eggs + ' eggs');
ok(mine(w).filter(p => p.golden).length === G2.golden && mine(w).filter(p => p.golden).every(p => p.tier === 3), 'a Golden Sausage is always Legendary (' + G2.golden + ' this run)');
ok(Math.abs(pv3.goldPct - Math.min(10, pv3.n / 200)) < 1e-9 && V.grindPreview(Object.assign({}, w), ME, H - 27).ok === false, 'golden odds are 1% per 200 pets, at most 10%; the pile is empty afterwards');
/* odds sanity: over many fake tx hashes the Sausage ladder is about 60 / 32 / 8 */
const cnt = [0, 0, 0, 0];
for (let i = 0; i < 20000; i++) cnt[V._sausageTierTest(fakeHash(i), 'x' + i)]++;
if (V._sausageTierTest) ok(cnt[0] === 0 && Math.abs(cnt[1] / 20000 - 0.6) < 0.02 && Math.abs(cnt[2] / 20000 - 0.32) < 0.02 && Math.abs(cnt[3] / 20000 - 0.08) < 0.01, 'Sausage ladder over 20,000 rolls: ' + cnt.join(' / '));
/* 5 · MEAT GRINDER 2: better Sausage Eggs, a bigger Golden Sausage shot (always weird), and keep-rarity grinds */
ok(V.parseTag('pet:grind:2000:u').maxT === 1 && V.parseTag('pet:grind:5:C').maxT === 0 && V.parseTag('pet:grind:5:r').maxT === 2 && V.parseTag('pet:grind:5:L').action === 'invalid' && V.parseTag('pet:grind:0:u').action === 'invalid' && V.parseTag('pet:grind:2001:u').action === 'invalid', 'pet:grind:N:C|U|R parse (L and bad N do not)');
const K = G + 300;
let r3 = [row(K - 50, ME, 0.00000001, 'pet:hi'), row(K - 40, ME, 100000, 'pet:hatchzap'), row(K - 30, ME, 0.00000001, 'pet:hd:ALL'), row(K - 20, ME, 69, 'pet:grind:2000:u')];
w = play(r3, K - 20);
ok(!w.grind || !w.grind[ME] || !w.grind[ME].ground, 'gate off: pet:grind:N:U grinds nothing (unknown tag, as before)');
ok(w.log.some(e => e.block === K - 20 && /community food/.test(e.msg)), 'gate off: pet:grind:N:U is community food');
ok(/opens at block/.test(V.sendBlock(w, { tag: 'pet:grind:2000:u', amount: 69 }, K - 19, { me: ME }) || ''), 'gate off: the send check says the keep choice is not open yet');
const pvOld = V.grindPreview(w, ME, K - 19, 0, 1);
ok(pvOld.maxT === 3, 'gate off: the preview ignores the keep choice');
V._setGrind2Activation(K - 10);
r3 = r3.filter(r => r.block_index !== K - 20);
w = play(r3, K - 15);
const pile = alive(w).filter(p => p.hd === ME && !V.grindWhy(w, p, ME, K - 9));
const pvU = V.grindPreview(w, ME, K - 9, 0, 1), plU = V.grindPlan(w, ME, K - 9, 0, 1), pl5 = V.grindPlan(w, ME, K - 9, 5, 0), plAll = V.grindPlan(w, ME, K - 9);
ok(pvU.ok && pvU.n === pile.filter(p => p.tier <= 1).length && pvU.byTier[2] === 0 && pvU.byTier[3] === 0, 'keep U: the preview takes only Commons and Uncommons (' + pvU.n + ' of ' + pile.length + ')');
ok(plU.tag === 'pet:grind:2000:U' && pl5.tag === 'pet:grind:5:C' && plAll.tag === 'pet:grind', 'plans: pet:grind:2000:U, pet:grind:5:C, plain pet:grind');
ok(V.sendBlock(w, { tag: plU.tag, amount: 69 }, K - 9, { me: ME }) === null, 'the send check passes a keep grind');
const rareIds = pile.filter(p => p.tier >= 2).map(p => p.id);
r3.push(row(K - 9, ME, 69, plU.tag));
w = play(r3, K - 9);
ok(w.grind[ME].ground === pvU.n && w.grind[ME].meat === pvU.meat && w.grind[ME].last.eggs === pvU.eggs, 'the keep grind matches its preview (' + pvU.n + ' pets, ' + pvU.meat + ' meat)');
ok(rareIds.length > 0 && rareIds.every(id => !w.byId[id].ground && !w.byId[id].released && w.byId[id].hd === ME), 'every Rare and Legendary stays in the discard pile (' + rareIds.length + ')');
const pvR = V.grindPreview(w, ME, K - 8, 0, 0);
ok(!pvR.ok && /that rarity/.test(pvR.why), 'keep C with no Commons left: nothing to grind, and it says why');
r3.push(row(K - 8, ME, 69, 'pet:grind:2000:R'));
w = play(r3, K - 8);
ok(rareIds.filter(id => w.byId[id].tier === 2).every(id => w.byId[id].ground) && rareIds.filter(id => w.byId[id].tier === 3).every(id => !w.byId[id].ground), 'keep R: Rares go in, Legendaries stay');
ok(Math.abs(V.grindPreview(w, ME, K - 7).goldPct - Math.min(20, V.grindPreview(w, ME, K - 7).n / 100)) < 1e-9 && V.grindGoldOdds(2000, K) === 200000 && V.grindGoldOdds(2000, K - 11) === 100000 && V.grindGoldOdds(500, K) === 50000, 'golden odds: 1% per 100 pets up to 20% from the gate (1% per 200 up to 10% before)');
const c2 = [0, 0, 0, 0];
for (let i = 0; i < 20000; i++) c2[V._sausageTierTest(fakeHash(i), 'x' + i, K)]++;
ok(c2[0] === 0 && Math.abs(c2[1] / 20000 - 0.5) < 0.02 && Math.abs(c2[2] / 20000 - 0.38) < 0.02 && Math.abs(c2[3] / 20000 - 0.12) < 0.01, 'new Sausage ladder over 20,000 rolls: ' + c2.join(' / ') + ' (about 50 / 38 / 12)');
const c1 = [0, 0, 0, 0];
for (let i = 0; i < 20000; i++) c1[V._sausageTierTest(fakeHash(i), 'x' + i, K - 11)]++;
ok(c1.join() === cnt.join(), 'below the gate the ladder is exactly the old one');
/* golden: find a grind tx that wins, replay it, and check the Golden Sausage is the special egg */
let gw = null;
for (let i = 0; i < 400 && !gw; i++) { const rr = r3.slice(0, 3).concat([row(K - 9, ME, 69, 'pet:grind')]); const ww = play(rr, K - 9); if (ww.grind[ME].golden) gw = ww; }
const gold = gw && mine(gw).filter(p => p.golden)[0];
const SPECIAL = ['homer', 'rabbit', 'groyper', 'funtrump', 'kek', 'wizard'];
ok(!!gold && gold.tier === 3 && SPECIAL.indexOf(gold.species) >= 0 && gold.species === V._specialEggArt(fakeHash(K - 9), 'f'.repeat(64), K - 9).species, 'a Golden Sausage is THE SPECIAL EGG (the 1-in-777 slot pet), at Legendary (' + (gold ? gold.species + ' tier ' + gold.tier : 'none found') + ')');
let sh = 0; for (let i = 0; i < 77000; i++) if (V._sausageSpecialTest(fakeHash(i), 'y' + i, K)) sh++;
ok(Math.abs(sh - 1000) < 120 && !V._sausageSpecialTest(fakeHash(1), 'y1', K - 11) && [...Array(5000).keys()].every(i => !V._sausageSpecialTest(fakeHash(i), 'y' + i, K - 11)), 'Sausage Eggs hit the special egg about 1 in 77 from the gate (' + sh + ' of 77,000), never before');
const sp2 = mine(gw).filter(p => p.sausage && !p.golden);
ok(sp2.every(p => p.tier >= 1), 'Sausage Eggs are still never Common (' + sp2.map(p => p.species + ' ' + p.tier).join(', ') + ')');
V._setGrind2Activation(GATE2);
V._setGrindActivation(GATE);
if (V._setAspieActivation) V._setAspieActivation(GATE_AS);
if (fails) { console.log(fails + ' failed'); process.exit(1); }
console.log('grinder ok');
