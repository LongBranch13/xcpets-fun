#!/usr/bin/env node
/* wasted-burns-rules-test (Nov 25 2026): the rules-file half of the wasted-burns audit (a full replay of the real chain listed every burn the
 * game rejected, skipped or overcharged). Page half: tools/wasted-burns-test.js.   node tools/wasted-burns-rules-test.js */
'use strict';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };

/* 1. Send check (not the replay): every feed burn is judged pet by pet before signing, the same checks as the replay.
 *    Real cases (sendBlock at the block before each burn, replayed to 977,522): Jake's feeds of discarded #190474 / #190994 (12 burns),
 *    pet:fr lists with Mythics (bc1pd8pant 977,344), the same pet:fm sent twice (bc1q26egum 976,823), lists of fully fed pets (92,460 in one go). */
const { load, row, run, fakeHash } = require('./lib/load-rules');
{ const c = load(), V = c.V2Rules, B0 = 977000, H2 = {}; for (let b = B0 - 5; b < B0 + 300; b++) H2[b] = fakeHash(b);
  const r1 = [row(B0, 'A', 690, 'pet:hatch'), row(B0, 'A', 690, 'pet:hatch'), row(B0, 'Z', 690, 'pet:hatch')];
  let w = run(c, { rows: [], hashes: {} }, r1, B0 + 1, H2); const ids = w.pets.filter(p => p.owner === 'A').map(p => p.id), z = w.pets.find(p => p.owner === 'Z').id;
  const meal = (w, id, b) => { const q = w.byId[id]; return V.mealCost(w, q, V.mealFor(q.care, q.species, b, V.petThresholds(w, q, b)), b); };
  const S = (w, tip, tag, amt, pend) => V.sendBlock(w, { tag, amount: amt }, tip, { me: 'A', pending: pend || [] });
  const m0 = meal(w, ids[0], B0 + 2), m1 = meal(w, ids[1], B0 + 2);
  ok(S(w, B0 + 1, 'pet:feed:' + ids[0], m0) === null, 'a good single feed passes');
  ok(/not yours/.test(S(w, B0 + 1, 'pet:feed:' + z, meal(w, z, B0 + 2)) || ''), "someone else's pet is blocked");
  ok(/still waiting to confirm/.test(S(w, B0 + 1, 'pet:feed:' + ids[0], m0, ['pet:feed:' + ids[0]]) || ''), 'a feed for a pet whose feed is still on its way is blocked');
  ok(/below its meal/.test(S(w, B0 + 1, 'pet:feed:' + ids[0], m0 - 1) || ''), 'a single feed below the meal is blocked');
  const fm = 'pet:fm:' + ids[0] + ':' + (1 | (1 << (ids[1] - ids[0]))).toString(32).toUpperCase(); /* bitmask from the first id */
  ok((V.parseTag(fm).ids || []).join() === ids.join(), 'test tag names both pets (' + fm + ')');
  ok(S(w, B0 + 1, fm, m0 + m1) === null, 'a good 2-pet feed passes');
  ok(/too small/.test(S(w, B0 + 1, fm, m0 + m1 - 1) || ''), 'a 2-pet feed that cannot pay the second meal is blocked (it would skip that pet)');
  w = run(c, { rows: [], hashes: {} }, r1.concat([row(B0 + 2, 'A', m0, 'pet:feed:' + ids[0])]), B0 + 2, H2);
  ok(/already fed this chain day/.test(S(w, B0 + 2, 'pet:feed:' + ids[0], 1e4) || ''), 'feeding the same pet again the same chain day is blocked');
  ok(/#\d+ already fed this chain day/.test(S(w, B0 + 2, fm, 1e5) || ''), 'a list with one pet already fed today is blocked');
  w.byId[ids[1]].hd = 'A'; ok(/discarded/.test(S(w, B0 + 2, 'pet:feed:' + ids[1], 1e4) || ''), 'a discarded pet is blocked');
  ok(V.sendBlock(w, { tag: 'pet:hatch', amount: 690 }, B0 + 2, { me: 'A' }) === null, 'other burns are untouched'); }

/* 2. Fire Sale grace (Jake Nov 25 2026: "Yes, 6-block grace"). Evan, block 977,493: 19 Electric Egg cases at the sale price landed
 *    2 blocks after the sale ended and were rejected (73,625 XCPETS). From ACTIVATE_FIRE_GRACE_BLOCK a sale-priced burn that lands in the
 *    6 blocks after the end still counts. Pages keep pricing at full cost from the end block, and a grace burn earns no Fire Sale spin. */
{ const G = 1000000, H = {}; for (let b = G - 10; b < G + 3000; b++) H[b] = fakeHash(b);
  const go = grace => { const c = load(), V = c.V2Rules; V._setFireHashes(H); V._setFiresaleActivation(G); V._setFireGraceActivation(grace ? G : null);
    const w0 = {}; V.fireExtend(w0, G + 2999); const s = w0.fire.sales[0], price = V.costAt(w0, 69, s.start);
    const rows = [row(s.end - 1, 'A', price, 'pet:hatch'), row(s.end, 'A', price, 'pet:hatch'), row(s.end + 5, 'A', price, 'pet:hatch'), row(s.end + 6, 'A', price, 'pet:hatch'), row(s.end + 2, 'B', 69, 'pet:hatch')];
    const w = run(c, { rows: [], hashes: {} }, rows, s.end + 10, H);
    return { V, w, s, kinds: rows.map(r => (w.log.find(l => l.tx === r.tx_hash) || {}).kind) }; };
  const a = go(true), b = go(false);
  ok(a.kinds.join() === 'hatch,hatch,hatch,rejected,hatch', 'grace on: sale price counts at end .. end+5, not at end+6 (' + a.kinds.join() + ')');
  ok(b.kinds.join() === 'hatch,rejected,rejected,rejected,hatch', 'grace off (below the gate): unchanged (' + b.kinds.join() + ')');
  ok(a.V.costAt(a.w, 69, a.s.end) === 69 && !a.V.fireInfo(a.w, a.s.end).live, 'pages and planners price at full cost from the end block (no grace outside the replay)');
  ok(!(a.w.fireSpinLog || []).length, 'a full-price burn inside the grace earns no Fire Sale spin');
  ok(a.V.fireInfo(a.w, a.s.end).grace === 6, 'fireInfo tells the page about the 6-block grace');
  ok(load().V2Rules.ACTIVATE_FIRE_GRACE_BLOCK === 977560, 'gate 977,560'); }

console.log(pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
