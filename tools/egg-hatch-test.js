#!/usr/bin/env node
/* EGG HATCH (Jake, Nov 28 2026: "you're buying the eggs and then feeding them once to hatch"; the hatching meal must not slow the road to Mythic).
 *  1. gate off: a bought pet is born a Hatchling (care = hatch price 69) as before.
 *  2. gate on: pet:hatch / pet:hatch12 give Eggs (care 0, stage 0, hungry, meal = the hatch price).
 *  3. one meal hatches it (care 69, Hatchling) WITHOUT using the day's meal: a second meal the same chain day is taken.
 *  4. a third meal that day is refused (already fed this day), so only the hatching meal is free.
 *  5. multi-pet feeds (pet:fm) hatch eggs the same way; the pre-sign check (sendBlock) lets the same-day second meal through.
 *   node tools/egg-hatch-test.js [--boot FILE] */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..'), A = process.argv.slice(2), opt = k => { const i = A.indexOf(k); return i >= 0 ? A[i + 1] : null; };
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const hex = s => Buffer.from(s, 'utf8').toString('hex');
const ctx = require('./lib/fork-replay').load(), V = ctx.V2Rules, E = ctx.LiveEngine;
const boot = JSON.parse(fs.readFileSync(path.resolve(opt('--boot') || path.join(ROOT, 'api', 'boot.json')), 'utf8'));
const rows = boot.rows.slice().sort((a, b) => a.block_index - b.block_index || a.tx_index - b.tx_index), tip = boot.tip || rows[rows.length - 1].block_index;
const hashes = Object.assign({}, ctx.XCPETS_BLOCK_HASHES || {}, boot.hashes || {}), opts = t => ({ tip: t, live: E && E.RealCore, dex: boot.dex });
/* a block early in a chain day, so hatch + both meals fit inside one day */
let nb = tip + 1; while (V.clock(nb) % 144 > 100 || V.clock(nb + 2) % 144 < V.clock(nb) % 144) nb++;
let tx = rows[rows.length - 1].tx_index + 1;
const row = (src, tag, b, amount) => ({ tx_index: tx++, tx_hash: ('e' + tx).padStart(64, '0'), block_index: b, source: src, asset: 'XCPETS', quantity: Math.round(amount * 1e8), tag: hex(tag), status: 'valid' });
const H = t => { const h = Object.assign({}, hashes); for (let b = tip; b <= t; b++) if (!h[b]) h[b] = '0'.repeat(56) + b.toString(16).padStart(8, '0'); return h; };
const run = (extra, t) => V.replay(rows.concat(extra), H(t), [], Object.assign(opts(t), { _forkUse: tip }));
const ME = 'bc1qeggtesteggtesteggtesteggtesteggtest00';
const w0 = V.replay(rows, hashes, [], Object.assign(opts(tip), { _forkSave: true }));
const hatchAmt = 1000, packAmt = 10000; /* over-paying is fine; the test is about care, not price */
const mineNew = w => w.pets.filter(p => p.owner === ME).sort((a, b) => a.id - b.id);
const g0 = V.eggHatchGate(); ok(g0 === null || Number.isInteger(g0), 'gate in the code: ' + g0 + ' (feed tip ' + tip + ', test block ' + nb + ')');

/* 1 gate off */
V._setEggHatch(null);
let w = run([row(ME, 'pet:hatch', nb, hatchAmt)], nb), P = mineNew(w);
ok(P.length === 1 && P[0].care === 69 && P[0].stage === 1, 'gate off: pet:hatch gives a Hatchling with care 69 (care ' + (P[0] && P[0].care) + ', stage ' + (P[0] && P[0].stage) + ')');

/* 2 gate on */
V._setEggHatch(nb);
const h1 = [row(ME, 'pet:hatch', nb, hatchAmt), row(ME, 'pet:hatch12', nb, packAmt)];
w = run(h1, nb); P = mineNew(w);
ok(P.length === 13 && P.every(p => p.care === 0 && p.stage === 0 && p.stageName === 'Egg'), 'gate on: pet:hatch + pet:hatch12 give 13 Eggs (care 0, stage 0)');
ok(P.every(p => p.hungry && p.nextMeal > 0 && !p.dead), 'eggs are hungry, alive, meal ' + P[0].nextMeal + ' XCPETS');
const hp = V.costAt ? V.costAt(w, 69, nb + 1) : null; ok(hp == null || Math.abs(P[0].nextMeal - hp) < 1e-8, 'the hatching meal costs the hatch price (' + hp + ')');
ok(V.hatchMealFree(w, P[0], nb + 1) && !V.hatchMealFree(w, Object.assign({}, P[0], { care: 69 }), nb + 1), 'hatchMealFree: an egg yes, a Hatchling no');

/* 3 + 4 one pet: hatch meal, second meal same day, third refused */
const egg = P[0], b2 = nb + 1, m1 = egg.nextMeal;
const f1 = row(ME, 'pet:feed:' + egg.id, b2, m1);
w = run(h1.concat([f1]), b2); let e = w.byId[egg.id];
ok(e.care === 69 && e.stage === 1 && !e.fedToday && e.hungry, 'one meal hatches it (care ' + e.care + ', ' + e.stageName + ') and it can still eat today (fedToday ' + e.fedToday + ')');
const m2 = e.nextMeal, sw = V.sendBlock ? V.sendBlock(w, ME, [{ tag: 'pet:feed:' + egg.id, amount: m2 }], b2 + 1, []) : null;
ok(!sw, 'pre-sign check lets the same-day second meal through' + (sw ? ': ' + JSON.stringify(sw) : ''));
const f2 = row(ME, 'pet:feed:' + egg.id, b2 + 1, m2);
w = run(h1.concat([f1, f2]), b2 + 1); e = w.byId[egg.id];
ok(e.care === 69 + (w.log.find(l => l.tx === f2.tx_hash) ? e.care - 69 : 0) && e.care > 69 && e.fedToday && !e.hungry, 'the second meal that day is taken (care ' + e.care + ', fed today)');
const f3 = row(ME, 'pet:feed:' + egg.id, b2 + 2, 5000);
const w3 = run(h1.concat([f1, f2, f3]), b2 + 2), l3 = w3.log.filter(l => /already fed/.test(l.msg || '')).length;
ok(w3.byId[egg.id].care === e.care && l3 >= 1, 'a third meal that day is refused: already fed this day');

/* the road to Mythic: same day count as a pet born a Hatchling and fed on its hatch day */
V._setEggHatch(null);
const wo = run([row(ME, 'pet:hatch', nb, hatchAmt), row(ME, 'pet:feed:' + w0.nextPet, b2, 600)], b2), po = wo.byId[w0.nextPet];
ok(po && po.care === e.care, 'same care after the hatch day as before the change (old Hatchling fed once: ' + (po && po.care) + ', new egg hatched + fed: ' + e.care + ')');
V._setEggHatch(nb);

/* 5 multi-pet feed (pet:fm) */
const rest = P.slice(1).map(p => p.id), d = []; rest.forEach(i => { const o = i - rest[0], j = Math.floor(o / 5); while (d.length <= j) d.push(0); d[j] |= 1 << (o % 5); });
const fl = 'pet:fm:' + rest[0] + ':' + d.map(v => v.toString(32).toUpperCase()).join('');
const wf = run(h1.concat([row(ME, fl, b2, m1 * rest.length)]), b2), R = rest.map(i => wf.byId[i]);
ok(R.every(p => p.care === 69 && p.stage === 1 && !p.fedToday), 'pet:fm hatches ' + rest.length + ' eggs, none uses up its day (' + R.filter(p => p.fedToday).length + ' marked fed)');

V._setEggHatch(g0);
console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
