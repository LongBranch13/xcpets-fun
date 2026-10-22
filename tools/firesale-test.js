#!/usr/bin/env node
/* Fire Sale tests (dev only): scheduling determinism, cooldown, stacking with halvings, Lord Kek blackout, saved-spin ledger. node tools/firesale-test.js */
'use strict';
const { load, row, snap, run, fakeHash } = require('./lib/load-rules');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const G = 1000000, N = 60000; const H = {}; for (let b = G - 10; b < G + N; b++) H[b] = fakeHash(b);
function sched(V, w, steps) { V._setFireHashes(H); V._setFiresaleActivation(G); w.fire = null; (steps || [G + N - 1]).forEach(s => V.fireExtend(w, s)); return w.fire.sales; }
const c = load(), V = c.V2Rules; V._setHalvingActivation(G);
/* 1. determinism */
{ const a = sched(V, {}), b = sched(V, {}, [G + 5, G + 777, G + 20000, G + N - 1]), c2 = load().V2Rules, d = sched(c2, {});
  ok(a.length > 50, 'sales found: ' + a.length); ok(JSON.stringify(a) === JSON.stringify(b), 'same schedule extended in chunks'); ok(JSON.stringify(a) === JSON.stringify(d), 'same schedule in a fresh context');
  ok(a.every(s => V.fireRoll(H[s.arm]) < 3), 'every arm block rolled < 3/1000');
  ok(a.every(s => s.start === s.arm + 6 && s.end === s.start + 36), 'live 6 blocks after the warning, 36 blocks long');
  const w = { fire: { sales: a } }; ok(V.saleAt(w, a[0].start) && V.saleAt(w, a[0].end - 1) && !V.saleAt(w, a[0].end) && !V.saleAt(w, a[0].arm + 5), 'saleAt window exact');
  const avg = N / a.length; ok(avg > 400 && avg < 1000, 'about one sale every 2-7 days with the cooldown (avg ' + avg.toFixed(0) + ' blocks)');
  const w2 = {}; V._setFireHashes({}); V.fireExtend(w2, G + 100); ok(w2.fire.sales.length === 0 && w2.fire.missing === G, 'stops at the first unknown hash'); }
/* 2. cooldown */
{ const a = sched(V, {}); let gapOk = true; for (let i = 1; i < a.length; i++) if (a[i].arm < a[i - 1].end + 432) gapOk = false; ok(gapOk, 'next arm >= previous end + 432 (3 days)');
  let skipped = 0; for (let i = 1; i < a.length; i++) for (let B = a[i - 1].arm + 1; B < a[i - 1].end + 432; B++) if (V.fireRoll(H[B]) < 3) skipped++; ok(skipped > 0, 'lucky blocks inside warning/sale/cooldown are skipped (' + skipped + ')'); }
/* 3. stacking */
{ const a = sched(V, {}), s = a[3], w = { fire: { sales: a } };
  ok(V.costAt(w, 69, s.start) === 21.39 && V.costAt(w, 345, s.start) === 106.95 && V.costAt(w, 690, s.start) === 213.9 && V.costAt(w, 6900, s.start) === 2139, 'era 0 sale: 31% of base');
  ok(V.costAt(w, 9200, s.start, true) === 2852 && V.costAt(w, 69, s.start, true) === 21.39, 'meals and feeds 69% off too (9,200 -> 2,852; 69 -> 21.39)');
  w.kekMythic = { block: s.start + 4, tx: 'x' }; /* halving lands inside the sale at start + 10 */
  ok(V.costAt(w, 69, s.start + 9) === 21.39 && V.costAt(w, 69, s.start + 10) === 10.695, 'halving inside a sale reprices at once (21.39 -> 10.695)');
  ok(V.mealCost(w, {}, 9200, s.start + 10) === 1426, 'a 9,200-care meal costs 1,426 in a halving-1 sale (care unchanged)');
  ok(V.costAt(w, 69, s.end) === 34.5, 'after the sale: halving price only');
  ok(V.below(w, 10.69, 69, s.start + 10) && !V.below(w, 10.695, 69, s.start + 10), 'below() uses the stacked price');
  { const c0 = V.syncCosts({ fire: { sales: a } }, s.start); ok(c0.feedMin === 21.39 && c0.cquick.join() === '21.39,213.9,2139' && V.communityFeedPlan(21.39).ok && !V.communityFeedPlan(21.38).ok, 'era 0 sale: community feed 69% off (min 69 x 0.31 = 21.39; 21.39 / 213.9 / 2,139)'); }
  { const c1 = V.syncCosts(w, s.start + 10); ok(c1.feedMin === 10.695 && c1.cquick.join() === '10.695,106.95,1069.5' && V.communityFeedPlan(10.695).ok && !V.communityFeedPlan(10.69499999).ok, 'era 1 sale: community feed stacks (min 34.5 x 0.31 = 10.695; 10.695 / 106.95 / 1,069.5)'); V.syncCosts(w, s.end); ok(V.UI_COSTS ? V.UI_COSTS.feedMin === 34.5 : true, 'after the sale: community feed back to the halving price'); } }
/* 4. Lord Kek blackout */
{ const a0 = sched(V, {}), D = a0[5].arm - 3, w = { kekMythic: { block: D, tx: 'x' } }, a = sched(V, w), h1 = V.halving1Block(w);
  ok(h1 === D + 6, 'halving 1 = defeat + 6'); ok(!a.some(s => s.arm >= D && s.arm < h1 + 144), 'no sale arms from the defeat block to halving 1 + 144');
  ok(a0.some(s => s.arm >= D && s.arm < h1 + 144), 'the same window had a sale without the defeat');
  ok(a.some(s => s.arm >= h1 + 144), 'sales resume after the pause'); }
/* 5. replay + saved-spin ledger (real snapshot, fake hashes from the gate) */
{ const S = snap(process.argv[2]), c3 = load(), V3 = c3.V2Rules, T = S.tip, GG = T + 6; V3._setHalvingActivation(GG); V3._setFiresaleActivation(GG);
  const HH = {}; for (let b = GG; b < GG + 3000; b++) HH[b] = fakeHash('fs' + b); V3._setFireHashes(HH); const w0 = {}; V3.fireExtend(w0, GG + 2990); const s = w0.fire.sales[0];
  ok(!!s, 'found a sale for the replay test'); const ME = 'bc1qfiresaletest0000000000000000000000000';
  const rows = [row(s.start, ME, 69, 'pet:hatch'), row(s.start, ME, 21.39, 'pet:hatch'), row(s.start + 1, ME, 21.38, 'pet:hatch'), row(s.start + 1, ME, 690, 'pet:hatch12'), row(s.end, ME, 21.39, 'pet:hatch')];
  const w = run(c3, S, rows, s.end + 10, HH), mine = w.pets.filter(p => p.owner === ME);
  ok(mine.length === 14, 'full + sale hatch + sale dozen valid; underpaid sale hatch and post-sale sale-price hatch rejected (' + mine.length + ')');
  ok(V3.fireSpinsOf(w, ME) === 2 && w.fireSpinLog.length === 2, 'two full-price burns in the sale -> 2 saved spins in the ledger');
  ok(w.fireSpinLog.every(x => x.sale === s.arm && x.owner === ME), 'ledger rows carry the sale + owner');
  const w2 = run(c3, S, rows, s.end + 10, HH); ok(JSON.stringify(w2.fireSpinLog) === JSON.stringify(w.fireSpinLog), 'ledger replays identically');
  const c4 = load(); const w4 = run(c4, S, [], T); ok(!w4.fireSpins && !(w4.fire && w4.fire.sales.length), 'live tip: no sale, empty ledger'); }
console.log(`firesale-test: ${pass}/${pass + fail} pass`); process.exitCode = fail ? 1 : 0;
