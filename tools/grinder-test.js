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

ok(V.grindGate() === null, 'the Grinder is OFF on main (gate null)');
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
V._setGrindActivation(null);
if (fails) { console.log(fails + ' failed'); process.exit(1); }
console.log('grinder ok');
