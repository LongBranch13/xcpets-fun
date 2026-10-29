#!/usr/bin/env node
/* Halving tests (dev only): cost math across halvings (community-pet trigger), STAR LORD KEK trigger detection (w.kekMythic), before-launch case. node tools/halving-test.js */
'use strict';
const { load, row, snap, run } = require('./lib/load-rules');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
/* Sections 2-4 burn Lord Kek over Mythic themselves, so they need a world from BEFORE the real defeat. The fixture snapshots now include the real defeat
 * (halving 1) and later halvings, so cut the snapshot just before the real kekMythic block, read from the replayed snapshot (never a hand-set block). */
const S0 = snap(process.argv[2]), ME = 'bc1qtestplayer000000000000000000000000000', REAL = run(load(), S0, [], S0.tip), KD = REAL.kekMythic ? REAL.kekMythic.block : null;
const S = KD == null ? S0 : { tip: KD - 1, rows: S0.rows.filter(r => r.block_index < KD), hashes: Object.fromEntries(Object.entries(S0.hashes || {}).filter(([b]) => +b < KD)) }, T0 = S.tip;
function world(gate, defeatAt, extra, tip) { const c = load(); const V = c.V2Rules; V._setHalvingActivation(gate); const w0 = run(c, S, [], T0);
  const need = V.COMMUNITY_THRESHOLDS ? 0 : 0; const left = 6906900 - w0.kek.fed + 1; /* just over Mythic */
  const rows = [row(defeatAt - 1, ME, left / 2, 'pet:feed'), row(defeatAt, ME, left / 2 + 5, 'pet:feed')].concat(extra ? extra(V) : []);
  return { c, V, w: run(c, S, rows, tip || defeatAt + 400), rows }; }
/* 1. pure cost math (no world needed) */
{ const c = load(), V = c.V2Rules; V._setHalvingActivation(100); V._setCommunityTriggerActivation(0); const fw = h => ({ kekMythic: { block: h, tx: 'x' } });
  ok(V.eraAt(fw(200), 150) === 0 && V.eraAt(fw(200), 205) === 0 && V.eraAt(fw(200), 206) === 1, 'era flips exactly at defeat + 6');
  ok(V.costAt(fw(200), 69, 206) === 34.5 && V.costAt(fw(200), 345, 206) === 172.5 && V.costAt(fw(200), 6900, 206) === 3450, 'era 1 halves 69/345/6900');
  /* halving 2+ (legacy COMMUNITY_PET_ARRIVAL_BLOCKS path, used only when auto halving is off) */
  const AUTO = V.ACTIVATE_AUTO_HALVING_BLOCK; V._setAutoHalvingActivation(null);
  V._setCommunityPetArrivals([300, 400]);
  ok(V.eraAt(fw(200), 306) === 2 && V.costAt(fw(200), 69, 306) === 17.25 && V.costAt(fw(200), 345, 406) === 43.125, 'each new community pet + 6 halves again (no floor)');
  ok(V.costAt(fw(200), 690, 999999) === 86.25, 'era 3 breed = 86.25');
  ok(V.eraAt({}, 500) === 0, 'no defeat -> no halving even with community pet arrivals');
  V._setCommunityPetArrivals([150]); ok(V.halvingBlocks(fw(200)).join() === '206', 'an arrival before halving 1 adds no halving'); V._setCommunityPetArrivals([]);
  const p1 = {};
  ok(V.mealCost(fw(200), p1, 9200, 206) === 4600, 'meal fix: a 9,200-care meal costs 4,600 in halving 1, care unchanged');
  V._setCommunityPetArrivals([300]); ok(V.mealCost(fw(200), p1, 9200, 306) === 2300 && V.mealCost(fw(200), p1, 4140, 205) === 4140, 'halving 2: 2,300; before halving 1 cost === care'); V._setCommunityPetArrivals([]);
  /* AUTO HALVING (live rule): halving N+1 = Cold Storage of community pet N after Kek + 6; costs = base / 2^(halvings so far), derived from halvingBlocks */
  V._setAutoHalvingActivation(0); const aw = { kekMythic: { block: 200, tx: 'x' }, funtrumpMythic: { block: 294 }, homerMythic: { block: 394 } }, HB = V.halvingBlocks(aw);
  ok(HB.join() === '206,300,400', 'auto: halvings at defeat + 6 and each Cold Storage + 6 (' + HB.join() + ')');
  [150, 205, 206, 299, 300, 399, 400, 999999].forEach(b => { const n = HB.filter(h => b >= h).length; ok(V.eraAt(aw, b) === n && V.costAt(aw, 690, b) === 690 / Math.pow(2, n) && V.costAt(aw, 69, b) === 69 / Math.pow(2, n), 'auto: block ' + b + ' era ' + n + ' = halvings so far, cost 690 / 2^' + n); });
  ok(V.mealCost(aw, p1, 9200, 300) === 2300 && V.costAt(aw, 690, 999999) === 86.25, 'auto: halving 2 meal 2,300; era 3 breed 86.25');
  ok(V.halvingBlocks({ funtrumpMythic: { block: 294 } }).length === 0, 'auto: no Kek defeat -> no halving even with Cold Storage');
  V._setAutoHalvingActivation(AUTO);
  ok(V.seriesOf === undefined && V.hatchSeries === undefined && V.breedSeries === undefined && V.SERIES_LAUNCH_BLOCKS === undefined, 'no series API at all');
  ok(V.below(fw(200), 34.49999999, 69, 206) && !V.below(fw(200), 34.499999996, 69, 206) && !V.below(fw(200), 34.5, 69, 206) && V.below(fw(200), 68.9, 69, 205), 'below() at 8 dp, exact old check before');
  ok(V.mealsToMythic('pepe') > 0, 'mealsToMythic still works'); }
/* 2. trigger detection + pets after the halving (no series) */
{ const D = T0 + 20, G = T0 + 6; const { V, w } = world(G, D, () => [row(D + 5, ME, 34.5, 'pet:hatch'), row(D + 6, ME, 34.5, 'pet:hatch'), row(D + 6, ME, 345, 'pet:hatch12'), row(D + 7, ME, 172.5, 'pet:roll:1')]);
  ok(w.kekMythic && w.kekMythic.block === D, 'kekMythic = the burn that takes Lord Kek to 6,906,900 (block ' + (w.kekMythic && w.kekMythic.block) + ')');
  ok(w.kekMythic.total >= 6906900, 'kek care at defeat >= Mythic');
  ok(V.halving1Block(w) === D + 6, 'halving 1 = defeat + 6 when defeat is after launch');
  const mine = w.pets.filter(p => p.owner === ME);
  ok(mine.length === 13, 'half-price hatch before the gate rejected, at the gate accepted (+ dozen): ' + mine.length);
  ok(mine.every(p => p.series === undefined && p.care === 69 && p.stage === 1), 'new pets: no series tag, Hatchling at full 69 care (paid 34.5)');
  const th = V.petThresholds(w, mine[0], D + 10); ok(th[5] === 69069 && th[2] === 8349, 'thresholds unchanged after the halving: ' + th.join('/'));
  ok(mine[0].nextCare > 0 && mine[0].nextMeal * 2 === mine[0].nextCare, 'new hatchling: meal costs half its care: ' + mine[0].nextMeal + ' for ' + mine[0].nextCare);
  const old = w.pets.find(p => p.owner !== ME && !p.dead && !p.community && p.nextMeal > 0); ok(!old || (old.nextCare > 0 && Math.abs(old.nextMeal - old.nextCare / 2) < 1e-8), 'old pet pays half, gets full care');
  ok(w.log.some(l => l.kind === 'rejected' && /below hatch cost 34.5/.test(l.msg) === false && l.block === D + 5), 'pre-gate half hatch rejected'); }
/* 2b. community feed halves too (owner Oct 22 2026) */
{ const D = T0 + 20, G = T0 + 6, CF = 'bc1qcommunityfeedtest0000000000000000000'; const { V, w, rows } = world(G, D, () => [row(D + 5, CF, 34.5, 'pet:feed'), row(D + 6, CF, 34.5, 'pet:feed'), row(D + 6, CF, 34.4, 'pet:feed'), row(D + 7, CF, 345, 'pet:feed')]);
  const lg = tx => w.log.find(l => l.tx === tx), x = rows.slice(-4);
  ok(lg(x[0].tx_hash).kind === 'rejected' && lg(x[1].tx_hash).kind === 'cfeed' && lg(x[2].tx_hash).kind === 'rejected' && lg(x[3].tx_hash).kind === 'cfeed', 'community feed min 69 -> 34.5 at the halving (34.4 rejected, before the gate 34.5 rejected)');
  const c = V.syncCosts(w, D + 10); ok(c.cquick.join() === '34.5,345,3450' && c.feedMin === 34.5, 'community quick choices 34.5 / 345 / 3,450');
  ok(V.communityFeedPlan(34.5).ok && V.communityFeedPlan(34.5).amount === 34.5 && !V.communityFeedPlan(34.4).ok, 'community feed plan keeps decimals and the halved minimum');
  V.syncCosts(w, D); ok(V.communityFeedPlan(68.9).ok === false && V.communityFeedPlan(69.7).amount === 69, 'era 0: community feed plan exactly as before (whole XCPETS, min 69)'); }
/* 3. before-launch case: defeat already happened when the code ships -> halving 1 = ACTIVATE_HALVING_BLOCK */
{ const D = T0 + 10, G = T0 + 50; const { V, w } = world(G, D);
  ok(V.halving1Block(w) === G, 'defeat before launch -> halving 1 at the launch block');
  ok(V.eraAt(w, G - 1) === 0 && V.eraAt(w, G) === 1, 'era 0 until the launch block'); }
/* 4. replay unchanged with no defeat (the snapshot cut before the real defeat) + the real chain's halvings follow the rule */
{ const c = load(); const w = run(c, S, [], T0); ok(!w.kekMythic && c.V2Rules.eraAt(w, T0 + 1000) === 0, 'chain before the real defeat (tip ' + T0 + '): no defeat, era 0');
  if (KD != null) { const V = c.V2Rules, HB = V.halvingBlocks(REAL); ok(HB[0] === Math.max(KD + 6, V.ACTIVATE_HALVING_BLOCK) && V.eraAt(REAL, S0.tip + 1) === HB.filter(h => S0.tip + 1 >= h).length, 'real chain: halving 1 = defeat ' + KD + ' + 6, era at the tip = ' + V.eraAt(REAL, S0.tip + 1) + ' halvings (' + HB.join(', ') + ')'); } ok(!w.pets.some(p => p.series), 'no pet has a series tag at the live tip'); }
console.log(`halving-test: ${pass}/${pass + fail} pass`); process.exitCode = fail ? 1 : 0;
