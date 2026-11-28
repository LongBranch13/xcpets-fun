#!/usr/bin/env node
/* EGGS FIRST (eggs-first-1128, Jake Nov 28 2026: "eggs, not hatchlings, to be the first thing in my pets so you see all the eggs").
 * js/pet-sort.js PetSort.eggsFirst: a stable split, every Egg (stage 0) ahead of the rest, each part in the order it came in.
 * My Pets (js/v2.js petList) and the hatch review (sortEggs) run it after the picked sort. Display only: nothing is selected or discarded by place.
 *   node tools/eggs-first-test.js */
'use strict';
const path = require('path');
let fails = 0, n = 0; const ok = (c, m) => { n++; console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
global.V2Rules = { speciesLabel: s => s, isHybrid: s => /^hyb/.test(s) };
const PS = require(path.join(__dirname, '..', 'js', 'pet-sort.js'));
ok(typeof PS.eggsFirst === 'function' && typeof PS.isEgg === 'function', 'PetSort.eggsFirst and PetSort.isEgg exist');
const P = (id, stage, o) => Object.assign({ id, stage, care: stage ? 69 : 0, tier: 0, stats: { vigor: id % 7, spark: 1, grit: 1, zoom: 1, luck: 1 }, species: 'bobo' }, o);
const list = [P(1, 1), P(2, 0), P(3, 3), P(4, 0), P(5, 5), P(6, 1), P(7, 0)];
const ids = l => l.map(p => p.id).join(',');
ok(ids(PS.eggsFirst(list)) === '2,4,7,1,3,5,6', 'eggs first, each part keeps its incoming order: ' + ids(PS.eggsFirst(list)));
ok(ids(list) === '1,2,3,4,5,6,7', 'the incoming list is not changed');
const noEgg = list.filter(p => p.stage), allEgg = list.filter(p => !p.stage);
ok(PS.eggsFirst(noEgg) === noEgg && PS.eggsFirst(allEgg) === allEgg, 'no eggs or only eggs: the same list back (no copy)');
ok(!PS.isEgg(P(9, 0, { dead: true })) && !PS.isEgg(P(9, 0, { released: true })) && !PS.isEgg(P(9, 1)) && PS.isEgg(P(9, 0)) && PS.isEgg(P(9, undefined)), 'isEgg: living stage-0 pets only');
/* after a real sort: Power high to low, then eggs pulled up, still by Power inside each part */
const pw = PS.eggsFirst(PS.sort({}, list, 'pow'));
ok(ids(pw) === '4,2,7,6,5,3,1', 'Power sort then eggs first: eggs by Power, then the rest by Power: ' + ids(pw));
/* items that wrap a pet (hatch review / pickers) */
const wrapped = list.map(p => ({ pet: p })); ok(PS.eggsFirst(wrapped, x => x.pet).map(x => x.pet.id).join(',') === '2,4,7,1,3,5,6', 'works on wrapped items with a pet() map');
/* big wallet: 40,000 pets in well under 50 ms */
const big = []; for (let i = 0; i < 40000; i++) big.push(P(i + 1, i % 9 === 0 ? 0 : 1));
const t0 = process.hrtime.bigint(), out = PS.eggsFirst(big), ms = Number(process.hrtime.bigint() - t0) / 1e6;
ok(out.length === big.length && new Set(out.map(p => p.id)).size === big.length, 'big list: same pets, none lost or doubled');
ok(out.slice(0, 4445).every(p => p.stage === 0) && out.slice(4445).every(p => p.stage === 1), 'big list: all 4,445 eggs on top');
ok(ms < 50, 'big list: 40,000 pets split in ' + ms.toFixed(1) + ' ms');
console.log(fails ? fails + ' of ' + n + ' FAILED' : 'all ' + n + ' passed'); process.exit(fails ? 1 : 0);
