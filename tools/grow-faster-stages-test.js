#!/usr/bin/env node
/* GROW FASTER tests (dev only; branch grow-faster-stages, owner idea 2026-10-29 "Instead of skipping stages maybe they should just grow faster"):
 * from ACTIVATE_GROW_FASTER_BLOCK a pet on the lower Mythic line (Mythic shortcut, 21,000) gets Juvenile / Adult / Elder lines scaled down by the same
 * factor (21,000 / 69,069), so it passes through every stage instead of jumping Juvenile -> Mythic. The Mythic line, care to Mythic, every meal's size, meals to Mythic,
 * Mythic status, overflow and the roll-token odds stay as they were; before the gate the replay is SAME.
 *   node tools/grow-faster-stages-test.js [snap-file-name]      (snapshot data only: nothing is fetched, signed or sent) */
'use strict';
const { load, row, snap, fakeHash } = require('./lib/load-rules');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('ok  ', m); } else { fail++; console.log('FAIL', m); } };
const S = snap(process.argv[2]), T = S.tip, G = T + 6, BIG = 50000;
const c = load(), V = c.V2Rules; if (V._setTokenOnly) V._setTokenOnly(false);
const canon = v => JSON.stringify(v, (k, x) => x && typeof x === 'object' && !Array.isArray(x) ? Object.keys(x).sort().reduce((o, kk) => (o[kk] = x[kk], o), {}) : x);
function run(rows, tip) { const H = Object.assign({}, c.XCPETS_BLOCK_HASHES, S.hashes); rows.forEach(r => { if (!H[r.block_index]) H[r.block_index] = fakeHash(r.block_index); });
  return V.replay(S.rows.concat(rows), H, [], { tip, live: c.LiveEngine.RealCore }); }
const OFF = 999999999, SHIPPED = V.ACTIVATE_GROW_FASTER_BLOCK;
ok(SHIPPED === 973754, 'shipped gate is 973754 (Bitcoin tip 973748 + 6)');

/* 1) thresholds on their own (no replay) */
{ const w = { mythicOwners: { A: 971900 } }, kek = { owner: 'A', species: 'kek' }, other = { owner: 'B', species: 'kek' }, G = Math.max(T + 6, 973200); /* past the shortcut gate */
  V._setGrowFasterActivation(G);
  const pre = V.petThresholds(w, kek, G - 1), post = V.petThresholds(w, kek, G), base = V.thresholdsFor('kek', G);
  ok(canon(pre) === canon([0, 69, 8349, 22149, 41469, 21000]), 'block before the gate: only the Mythic line is lower ' + canon(pre));
  ok(canon(post) === canon([0, 69, 2538, 6734, 12608, 21000]), 'at the gate: Juvenile, Adult, Elder scaled by 21,000 / 69,069 ' + canon(post));
  ok(post[5] === pre[5] && post[1] === pre[1], 'Mythic line and hatching unchanged');
  ok(post.every((v, i) => i === 0 || v > post[i - 1]), 'stage lines still go up in order');
  ok(canon(V.petThresholds(w, other, G)) === canon(base), 'owner with no Mythic shortcut: thresholds untouched');
  ok(canon(V.petThresholds(w, kek, G, true)) === canon(pre), 'noScale (drop odds) gives the old shortcut ladder');
  ok(V.thresholdsFor('kek', G)[2] === 8349, 'shared THRESHOLDS table not changed in place');
  /* the two example cards: care 15,249 */
  ok(V.stageFor(15249, pre) === 2 && V.stageFor(15249, post) === 4, 'care 15,249: Juvenile before, Elder after');
  ok(V.mealFor(15249, 'kek', G, pre) === 5751 && V.mealFor(15249, 'kek', G, post) === 5751, 'care 15,249: next meal is the same 5,751 to Mythic');
  const cnt = (c0, th) => { let x = c0, n = 0; while (x < th[5] && n < 99) { const m = V.mealFor(x, 'kek', G, th); if (!(m > 0)) break; x += m; n++; } return { n, x }; };
  let same = true, jump = 0, bad = []; for (let c0 = 0; c0 < 21000; c0++) { const a = cnt(c0, pre), b = cnt(c0, post), m = V.mealFor(c0, 'kek', G, post);
    if (m !== V.mealFor(c0, 'kek', G, pre) || a.n !== b.n || a.x !== b.x) { same = false; if (bad.length < 3) bad.push(c0 + ':' + a.n + '/' + b.n); }
    if (c0 >= 69 && V.stageFor(c0 + m, post) - V.stageFor(c0, post) > 1) jump++; }
  ok(same, 'for every care 0..20,999: the same meal, the same meals to Mythic and Mythic at the same 21,000 care ' + bad.join(' '));
  ok(jump === 0, 'from hatching on, no single meal skips a stage on the scaled ladder');
  { let x = 69, st = []; while (x < 21000) { x += V.mealFor(x, 'kek', G, post); st.push(V.stageFor(x, post)); } ok(canon(st) === canon([2, 3, 4, 5]), 'fresh hatchling: Juvenile, Adult, Elder, Mythic, one stage a meal ' + canon(st)); }
  ok(cnt(15249, post).n === 1, 'the example cards (care 15,249): Mythic in 1 meal');
  ok(V.stageFor(21000, post) === 5 && V.stageFor(69069, post) === 5, 'care at or above 21,000 is Mythic before and after'); }

/* 2) replay: before the gate SAME, and after it only the stage labels move */
V._setGrowFasterActivation(OFF); const off = run([], T); V._setGrowFasterActivation(G); const onG = run([], T);
ok(canon(off.pets) === canon(onG.pets) && canon(off.itemList) === canon(onG.itemList) && canon(off.mythicOwners) === canon(onG.mythicOwners), 'replay before the gate (tip ' + T + '): SAME with the gate set vs off');
const MO = onG.mythicOwners || {}, cand = onG.pets.filter(p => !p.dead && !p.released && !p.community && MO[p.owner] != null && p.stage < 5 && !p.ascended && p.deathBlock > G + 200).sort((a, b) => a.care - b.care);
if (!cand.length) { console.log('info snapshot ' + T + ' has no living pet on the lower Mythic line: replay scenario skipped'); }
else {
  const P = cand[0], rows = []; let fb = G + 2; for (let i = 0; i < 8; i++, fb += 144) rows.push(row(fb, P.owner, BIG, 'pet:feed:' + P.id));
  V._setGrowFasterActivation(OFF); const a = run(rows, fb + 1); V._setGrowFasterActivation(G); const b = run(rows, fb + 1);
  const pa = a.byId[P.id], pb = b.byId[P.id], th = V.petThresholds(b, pb, fb + 1);
  ok(pa.care === pb.care && pa.mythicCare === pb.mythicCare, 'pet #' + P.id + ' (care ' + P.care + ' at tip): same care ' + pb.care + ' and Mythic status after 8 days of meals');
  ok(canon(a.itemList) === canon(b.itemList), 'same gear drops with the gate on vs off (stage-up odds kept)');
  ok(pb.stage === V.stageFor(pb.care, th), 'stage label matches care on the scaled ladder (' + pb.stageName + ' at ' + pb.care + ')');
  /* walk the stages it passed: every stage 2..5 reached in turn after the gate */
  const seen = {}; let x = P.care, n = 0; while (x < th[5] && n < 20) { seen[V.stageFor(x, th)] = 1; x += V.mealFor(x, P.species, G, th); n++; } seen[V.stageFor(x, th)] = 1;
  ok([3, 4, 5].every(s => seen[s] || V.stageFor(P.care, th) > s), 'growing from care ' + P.care + ' passes Adult, Elder, Mythic (stages seen ' + Object.keys(seen).join(',') + ')');
  const myth = onG.pets.filter(p => !p.dead && !p.released && !p.community && p.stage === 5);
  V._setGrowFasterActivation(T); const late = run([], T + 1);
  ok(myth.every(p => late.byId[p.id].stage === 5), 'all ' + myth.length + ' Mythic pets stay Mythic past the gate');
  const lab = onG.pets.filter(p => !p.dead && !p.released && !p.community && MO[p.owner] != null && !p.ascended).every(p => late.byId[p.id].stage === V.stageFor(late.byId[p.id].care, V.petThresholds(late, late.byId[p.id], T + 1)));
  ok(lab, 'past the gate every lower-line pet is staged on the scaled ladder');
}
V._setGrowFasterActivation(SHIPPED);
console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
