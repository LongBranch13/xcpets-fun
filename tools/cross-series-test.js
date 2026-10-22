#!/usr/bin/env node
/* Cross-series breeding tests (dev only): baby series rule, everything else unchanged (species/hybrid/stats, 6-cap, odd eyes path, who can't breed). */
'use strict';
const { load, snap, run, fakeHash } = require('./lib/load-rules');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const S = snap(process.argv[2]), T = S.tip, G = T + 6, B = G + 10;
const c = load(), V = c.V2Rules; V._setCrossSeriesActivation(G);
/* 1. pure rule */
const s = (a, b, blk) => V.breedSeries({}, { series: a }, { series: b }, blk == null ? B : blk);
ok(s(1, 2) === 2 && s(2, 1) === 2, 'old x new -> newer parent series (both orders)'); ok(s(1, 1) === 1, 'old x old -> old series'); ok(s(2, 3) === 3 && s(3, 3) === 3, 'series 2 x 3 -> 3');
ok(V.breedSeries({}, {}, {}, B) === 1, 'untagged pets are series 1'); ok(s(1, 2, G - 1) === 1, 'before the gate: the old rule (first parent)');
/* 2. real pets: breed with and without a series tag -> same child except series + care units */
function pair(w) { const by = {}; w.pets.forEach(p => { if (!V.breedable(p, B)) (by[p.owner] = by[p.owner] || []).push(p); }); const o = Object.keys(by).find(k => by[k].length >= 2); return o ? [by[o][0], by[o][1], o] : null; }
const wA = run(c, S, [], T), P = pair(wA); ok(!!P, 'found two breedable pets of one owner');
const bh = fakeHash('x-breed'), tx = 'ab'.repeat(32);
const wB = run(load(), S, [], T), cB = load(), wC = run(cB, S, [], T); /* fresh copies */
const k0 = V.breed(wA, P[0], P[1], bh, tx, B, P[2]);
const Q = [wC.byId[P[0].id], wC.byId[P[1].id]]; Q[1].series = 2; cB.V2Rules._setCrossSeriesActivation(G); const k1 = cB.V2Rules.breed(wC, Q[0], Q[1], bh, tx, B, P[2]);
ok(!k0.series, 'old x old baby has no series tag (series 1)'); ok(k1.series === 2, 'old x new baby is series 2');
ok(k0.species === k1.species && k0.tier === k1.tier && JSON.stringify(k0.stats) === JSON.stringify(k1.stats) && JSON.stringify(k0.hybrid || null) === JSON.stringify(k1.hybrid || null) && JSON.stringify(k0.art) === JSON.stringify(k1.art),
  'species / tier / stats / hybrid plan / art (odd eyes, parts) identical: ' + k0.species);
ok(cB.V2Rules.petThresholds(wC, k1, B)[5] === V.petThresholds(wA, k0, B)[5] / 2, 'series-2 baby grows on half-size care steps');
ok(k1.stage === 0 && k1.care === 0 && k1.parents.join() === [Q[0].id, Q[1].id].join(), 'baby starts as an Egg with both parents');
/* 3. caps and who can't breed: unchanged by series */
const capped = Object.assign({}, Q[1], { breedsV2: 6 }); ok(/breeding cap reached \(6\/6/.test(V.breedable(capped, B) || ''), '6-breed lifetime cap still applies to series pets');
ok(V.breedable(Object.assign({}, Q[1], { community: true }), B) != null, 'community pets still cannot breed');
ok(/Wizard cannot breed/.test(V.breedable(Object.assign({}, Q[1], { species: 'wizard' }), B) || ''), 'Wizards still cannot breed');
/* 4. replay unchanged at the live tip */
ok(!run(load(), S, [], T).pets.some(p => p.series), 'live tip: no pet has a series tag');
console.log(`cross-series-test: ${pass}/${pass + fail} pass`); process.exitCode = fail ? 1 : 0;
