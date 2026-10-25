#!/usr/bin/env node
/* PET SORT tests (dev only; pet-sort): sort comparator for My Pets + pickers (js/v2-pet-sort.js). Display only, no rule change.
 *   node tools/pet-sort-test.js */
'use strict';
const path = require('path');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
global.V2Rules = { wornOf: (w, id) => (w.worn[id] || []) };
const PS = require(path.join(__dirname, '..', 'js', 'v2-pet-sort.js'));
const P = (id, o) => Object.assign({ id, name: 'P' + id, tier: 0, stage: 1, care: 0, hatchBlock: 100 + id, wins: 0, stats: { vigor: 1, spark: 1, grit: 1, zoom: 1, luck: 1 } }, o);
const pets = [P(3, { name: 'Zoka', tier: 2, stage: 3, care: 9000, wins: 4, stats: { vigor: 20, spark: 2, grit: 5, zoom: 9, luck: 3 } }),
  P(1, { name: 'Moyo', tier: 3, stage: 2, wins: 1, hatchBlock: 500, stats: { vigor: 5, spark: 30, grit: 5, zoom: 2, luck: 9 } }),
  P(2, { name: 'pori', tier: 2, stage: 3, care: 12000, wins: 4, stats: { vigor: 20, spark: 1, grit: 30, zoom: 1, luck: 1 } }),
  P(4, { name: 'Abe', stats: { vigor: 0, spark: 0, grit: 0, zoom: 30, luck: 30 } })];
const w = { worn: { 4: [1, 2, 3], 2: [1] } };
const ids = s => pets.slice().sort(PS.comparator(s, w)).map(p => p.id).join(',');
ok(ids('num') === '1,2,3,4', 'Pet # low first');
ok(ids('new') === '1,4,3,2', 'Newest by hatch block');
ok(ids('old') === '2,3,4,1', 'Oldest by hatch block');
ok(ids('name') === '4,1,2,3', 'Name A-Z, case-insensitive');
ok(ids('tier') === '1,2,3,4', 'Rarity high first, ties lowest #');
ok(ids('stage') === '2,3,1,4', 'Stage high first, then care');
ok(ids('vigor') === '2,3,1,4', 'Vigor high first, tie lowest #');
ok(ids('spark') === '1,3,2,4' && ids('grit') === '2,1,3,4' && ids('zoom') === '4,3,1,2' && ids('luck') === '4,1,3,2', 'each stat high first');
ok(ids('power') === '4,2,1,3', 'Total stats high first');
ok(PS.total(pets[0]) === 39 && PS.total(pets[3]) === 60, 'total = sum of 5 stats');
ok(ids('wins') === '2,3,1,4', 'Wins high first, tie lowest #');
ok(ids('gear') === '4,2,1,3', 'Gear count high first');
ok(PS.comparator('nope', w) === null && !PS.has('nope') && PS.has('luck'), 'unknown sort = null');
ok(PS.SORTS.length === 14 && PS.SORTS.every(s => !/price|×|\dx\b/i.test(s[1])), 'labels: 14 sorts, no forbidden words');
const before = JSON.stringify(pets); pets.slice().sort(PS.comparator('gear', w)); ok(JSON.stringify(pets) === before, 'sorting never changes pets');
const filtered = pets.filter(p => p.tier >= 2); ok(filtered.sort(PS.comparator('grit', w)).map(p => p.id).join(',') === '2,1,3', 'works on a search-filtered list');
console.log('pet-sort-test: ' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
