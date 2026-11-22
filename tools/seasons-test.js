#!/usr/bin/env node
/* Seasons tests (ACTIVATE_SEASONS_BLOCK): inert before the gate, season eggs (normal pets + trait, supply/wallet counts), points with the
 * 50-a-day cap, tiers and rewards at end + 6, trait inheritance odds. node tools/seasons-test.js */
'use strict';
const { load, row, snap, run, fakeHash } = require('./lib/load-rules');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const c = load(), V = c.V2Rules, s0 = snap(), H0 = Object.assign({}, c.XCPETS_BLOCK_HASHES, s0.hashes);
const tip = Math.max.apply(null, s0.rows.map(r => r.block_index).filter(b => H0[b])), s = { tip, rows: s0.rows.filter(r => r.block_index <= tip), hashes: s0.hashes };
const G = Math.max(tip + 10, 977200) /* after the Nov 14-18 pause (paused blocks share a chain day) */, L = V.SEASON.LEN, HH = {}; for (let b = tip + 1; b <= G + L + 20; b++) HH[b] = fakeHash(b);
const A = 'bc1qseasontestaaaa', B = 'bc1qseasontestbbbb', C = 'bc1qseasontestcccc', BIG = 9e6;
/* 1) gate off: pet:hatchs is an unknown tag */
V._setSeasonsActivation(null); const off = run(c, s, [row(G + 1, A, BIG, 'pet:hatchs')], G + 2, HH), lo = off.log.find(l => l.block === G + 1 && /unknown/.test(l.msg));
ok(lo && lo.kind === 'rejected' && !off.seasons, 'gate off: pet:hatchs = unknown tag, no season state');
/* 2) season on */
V._setSeasonTable([{ n: 1, id: 'test', start: G }]); V._setSeasonsActivation(G - 1);
ok(V.seasonAt(G) && V.seasonAt(G + L - 1) && !V.seasonAt(G + L) && !V.seasonAt(G - 1), 'season window is 4,032 blocks');
const day = k => G + 2 + k * 144, rows = [row(G - 1, C, BIG, 'pet:hatchs'), row(day(0), A, BIG, 'pet:hatchs:3'), row(day(0) + 1, B, BIG, 'pet:hatchs:10')];
for (let k = 1; k <= 23; k++) rows.push(row(day(k), A, BIG, 'pet:hatch144')); /* A: 25 + 23 x 50 = 1,175 */
rows.push(row(day(24), A, BIG, 'pet:hatch144')); /* A: + 50 = 1,225 Diamond Hands */
rows.push(row(G + L + 1, C, BIG, 'pet:hatchs')); /* after the season: rejected */
const w = run(c, s, rows, G + L + 10, HH), Z = w.seasons && w.seasons[1];
const lc = w.log.filter(l => l.tx === rows[0].tx_hash).pop(); ok(lc && lc.kind === 'rejected' && /no season/.test(lc.msg), 'before the season starts: rejected');
const la = w.log.filter(l => l.tx === rows[1].tx_hash && l.kind === 'hatch').pop(), w1 = run(c, s, rows.slice(0, 3), G + 5, HH), sp = w1.pets.filter(p => p.owner === A && p.season === 1 && !p.seasonGift); /* early look: unfed pets die and retire long before the season ends */
ok(la && la.kind === 'hatch' && la.seasonEggs === 3 && sp.length === 3, 'pet:hatchs:3 hatches 3 season pets (' + (la && la.msg) + ' / ' + sp.length + ' ' + JSON.stringify(la) + ')');
ok(sp.every(p => p.species && !p.community && p.stage >= 0), 'season pets are normal pets');
ok(Z && Z.sold === 13 && Z.bought[A] === 3 && Z.bought[B] === 10, 'supply counted (sold ' + (Z && Z.sold) + ')');
ok(Z.pts[B] === 50, 'B: 10 + 10 x 5 capped at 50 a day (' + Z.pts[B] + ')');
ok(Z.pts[A] === 1225, 'A: 25 + 24 days x 50 = 1,225 (' + Z.pts[A] + ')');
const late = w.log.filter(l => l.tx === rows[rows.length - 1].tx_hash).pop(); ok(late && late.kind === 'rejected', 'after the season: rejected');
ok(Z.settled && Z.decided === G + L - 1 + 6, 'settled at end + 6');
ok(Z.tiers[A] === 4 && !Z.tiers[B], 'tiers: A Diamond Hands, B none');
ok(Z.freeEggs.length === 1 && w.byId[Z.freeEggs[0]].owner === A && w.byId[Z.freeEggs[0]].season === 1, 'Diamond Hands free season egg');
ok(Z.champions[0] === A && Z.champions[1] === B, 'champions ranked by points');
ok(w.log.some(l => l.kind === 'season' && /Season 1 is over/.test(l.msg)), 'season result log line');
const I = V.seasonInfo(w, G + 100, A); ok(I.season && I.season.n === 1 && I.me.pts === 1225 && I.me.tierName === 'Diamond Hands' && I.eggsLeft === 690 - 13, 'seasonInfo');
ok(V.seasonPlan(w, G + 100, 3).tag === 'pet:hatchs:3', 'seasonPlan tag');
/* 3) trait inheritance about 1 in 7 */
let got = 0; for (let i = 0; i < 7000; i++) { const kid = {}; V._seasonInherit({ season: 1, id: 5 }, { id: 6 }, kid, fakeHash('h' + i), 'tx' + i, G + 1); if (kid.season === 1) got++; }
ok(got > 850 && got < 1150, 'trait passes about 1 in 7 (' + got + ' of 7000)');
const k0 = {}; V._seasonInherit({ season: 1 }, {}, k0, 'aa', 'bb', G - 2); ok(!k0.season, 'no inheritance before the gate');
console.log('seasons: ' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
