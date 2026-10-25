#!/usr/bin/env node
/* HOTEL SORT tests (dev only; hotel-power-sort): js/pet-sort.js used by Gooby's Hotel and the egg review.
 * Power must be the ⚡ stat total (it used to be the Pet Score), every key sorts both ways, and the Power breakdown uses real rules only.
 *   node tools/hotel-sort-test.js */
'use strict';
const path = require('path');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
global.PetScore = { of: (w, p) => ({ score: p.sc }) };
global.PetCore = { TIERS: [{ label: 'Common', statBonus: 0 }, { label: 'Uncommon', statBonus: 3 }, { label: 'Rare', statBonus: 6 }, { label: 'Legendary', statBonus: 10 }] };
global.V2Rules = { wornOf: (w, id) => (w.worn[id] || []), isMythic: p => p.stage === 5, genOf: (w, p) => p.g || 0, breedsLeft: p => ({ left: 6 - (p.breeds || 0), cap: 6 }),
  QUESTS: { wiz: { name: "Wizard's Tower", fav: ['spark', 'zoom'] }, mine: { name: 'Burning Mines', fav: ['grit', 'vigor'] } }, questOdds: () => ({ haul: 650 }) };
const PS = require(path.join(__dirname, '..', 'js', 'pet-sort.js'));
const S = (v, s, g, z, l) => ({ vigor: v, spark: s, grit: g, zoom: z, luck: l });
const P = (id, o) => Object.assign({ id, tier: 0, stage: 3, care: 0, hatchBlock: 100 + id, wins: 0, losses: 0, species: 'doge', stats: S(1, 1, 1, 1, 1) }, o);
const pets = [P(1, { sc: 900, stats: S(5, 5, 5, 5, 5) }), P(2, { sc: 100, stats: S(30, 30, 30, 30, 30), questBoost: 3 }), P(3, { sc: 500, stats: S(10, 10, 10, 10, 10), questBoost: 1, wins: 7, losses: 1 })];
const w = { worn: { 3: [1, 2] } }, ids = k => PS.sort(w, pets, k).map(p => p.id).join(',');
ok(ids('pow') === '2,3,1', 'Power high to low = stat total, not Pet Score');
ok(ids('pow-') === '1,3,2', 'Power low to high');
ok(ids('sc') === '1,3,2', 'Pet Score is its own sort');
ok(ids('gain') === '1,3,2' && PS.gain(pets[0]) === 3 && PS.gain(pets[1]) === 0 && PS.gain(pets[2]) === 2, 'Power to gain = quest stat boosts left (cap 3)');
ok(ids('wins') === '3,1,2' && ids('gear') === '3,1,2', 'wins and gear sorts');
ok(ids('age') === '1,2,3' && ids('age-') === '3,2,1', 'age: oldest first, then youngest first');
ok(ids('') === '1,2,3' && ids('nope') === '1,2,3', 'hatch order and unknown keys keep the list order');
const keys = PS.KEYS.map(K => K[0]); ['pow', 'gain', 'vigor', 'spark', 'grit', 'zoom', 'luck', 'stage', 'rar', 'sp', 'age', 'gen', 'bl', 'wins', 'wr', 'care', 'gear', 'slots', 'looks', 'sc'].forEach(k => ok(keys.includes(k), 'key ' + k));
keys.forEach(k => { const a = ids(k), b = ids(k + '-'); ok(typeof a === 'string' && typeof b === 'string', 'both ways ' + k); });
const menu = PS.hotelOptions('pow') + PS.options('pow'); ok(!/price|series|×|\dx\b| x /i.test(menu.replace(/<[^>]+>/g, ' ')), 'menu words');
ok((menu.match(/<option/g) || []).length === 1 + PS.KEYS.length * 2 + PS.OPTS.length, 'every key in both directions');
const g0 = PS.ways(w, P(9, { tier: 2, stats: S(16, 7, 12, 9, 20) }), 1);
ok(g0.power === 64 && g0.parts.reduce((a, r) => a + r[1], 0) === 64, 'parts add up to Power');
ok(g0.parts.some(r => /Rare bonus/.test(r[0]) && r[1] === 30), 'hatch roll gets the rarity bonus on each stat');
ok(g0.steps.some(s => /Keep feeding until Mythic/.test(s)) && g0.gain === 3, 'non-Mythic: feed to Mythic, then quests');
const kid = PS.ways(w, P(10, { tier: 3, parents: [1, 2], stage: 5, questBoost: 2, breedBonus: { kind: 'stat', value: 3 }, stats: S(20, 20, 20, 20, 20) }), 1);
ok(!kid.parts.some(r => /bonus \(/.test(r[0])) && kid.parts.some(r => /Bred-true/.test(r[0]) && r[1] === 3) && kid.parts.some(r => /Haul/.test(r[0]) && r[1] === 2), 'bred pet: no rarity bonus line, bred-true and haul lines');
ok(kid.steps.some(s => /1 left/.test(s) && /Haul 6.50%/.test(s)) && kid.gain === 1, 'Mythic: quest step with Haul chance');
ok(/do not change Power/.test(kid.edge), 'gear and stage are fight edge, not Power');
const all = JSON.stringify([g0, kid]); ok(!/price|series|×|\dx\b/i.test(all), 'breakdown words');
const done = PS.ways(w, P(11, { questBoost: 3, stage: 5 }), 1); ok(done.gain === 0 && done.steps.some(s => /are used/.test(s)), 'cap reached');
const before = JSON.stringify(pets); PS.sort(w, pets, 'pow'); PS.ways(w, pets[0], 1); ok(JSON.stringify(pets) === before, 'read only');
console.log('hotel-sort-test: ' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
