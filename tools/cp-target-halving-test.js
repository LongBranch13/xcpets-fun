/* cp-target-halving-test (v2, owner Oct 25 2026): community pets that START at or after ACTIVATE_CP_TARGET_HALVING_BLOCK (pet #5 on) get
 * targets = base times 0.9^(era - era at the gate), r8 (v4: spread out). FUNTRUMP (started before the gate) keeps 6,906,900 and his normal path.
 * Costs and targets stop halving after MAX_ERA (8). Replay SAME before the gate. Dev only; nothing signed or sent. */
'use strict';
const L = require('./lib/load-rules');
const X = ['js/kek-sprite.js', 'js/wizard-sprite.js', 'js/funtrump-sprite.js'];
const S = L.snap('snap-973128.json'), T = S.tip; let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const src = 'bc1qs88hlk930p8l6h5s2svcrvzd45ny2pn54y0j6n';
const BASE = [0, 69000, 834900, 2214900, 4146900, 6906900], G = 973136;
function world(gate, extra, tip) { const c = L.load(X); if (gate !== undefined) c.V2Rules._setCpTargetActivation(gate); const s = tip < S.tip ? Object.assign({}, S, { rows: S.rows.filter(r => (r.raw || r).block_index <= tip) }) : S; return { c, V: c.V2Rules, w: L.run(c, s, extra || [], tip) }; }
const strip = w => JSON.stringify({ p: w.pets.map(p => [p.id, p.stage, p.care, p.dead, p.tier]), c: [w.community.burned, w.community.petStage, w.community.funtrumpFed, w.community.target || null], ft: w.funtrumpMythic || null, log: w.log.length });
{ const V = L.load(X).V2Rules; ok(V.ACTIVATE_CP_TARGET_HALVING_BLOCK === G && V.CP_TARGET_FACTOR === 0.9 && V.MAX_ERA === 8, 'gate 973136, factor 0.9, era cap 8');
  for (let k = 0; k <= 3; k++) { const t = V.cpScaled(k); ok(t.every((v, i) => Math.abs(v - Math.round(BASE[i] * 0.9 ** k * 1e8) / 1e8) < 1e-9), 'step ' + k + ': base times 0.9^' + k + ' = ' + t[5]);
    ok(Math.abs(t[5] / (69 / 2 ** (k + 1)) - 200200 * 1.8 ** k) < 1e-3, 'step ' + k + ': ' + Math.round(200200 * 1.8 ** k) + ' minimum feeds (1.8 times the step before)'); }
  ok(V.cpScaled(0) === V.COMMUNITY_THRESHOLDS, 'step 0 = the original array');
  ok(69 / 2 ** V.MAX_ERA === 0.26953125, 'era cap: lowest community feed 0.26953125');
  ok(V.cpScaled(V.MAX_ERA - 1)[5] === 3303548.85861, 'cap: lowest Mythic target 3,303,548.85861'); }
/* replay SAME before the gate, and FUNTRUMP untouched at / after it */
for (const tip of [T, G - 1, G, G + 6]) { const a = world(undefined, [], tip), b = world(null, [], tip); ok(strip(a.w) === strip(b.w), 'tip ' + tip + ': same world with the gate on vs off');
  ok(!a.w.funtrumpMythic && !a.w.community.target, 'tip ' + tip + ': FUNTRUMP not in Cold Storage, no adjusted target (care ' + Math.floor(a.w.funtrump.fed) + ')'); }
{ const { V, w } = world(undefined, [], T); ok(V.cpThresholds(w, G + 100, w.kekMythic.block)[5] === 6906900, 'FUNTRUMP target after the gate = 6,906,900');
  ok(V.halvingInfo(w).cpTarget === 6906900, 'halvingInfo cpTarget = 6,906,900'); }
/* FUNTRUMP past 3,453,450 but below 6,906,900 after the gate: still not Mythic; reaching 6,906,900 = same Cold Storage as without the rule */
const need = 6906900 - 5930552.5;
{ const part = [L.row(G + 2, src, 100000, 'pet:feed')], a = world(undefined, part, G + 3); ok(!a.w.funtrumpMythic, 'partway FUNTRUMP after the gate: no Cold Storage');
  const full = [L.row(G + 2, src, Math.ceil(need) + 100, 'pet:feed'), L.row(G + 20, src, 69, 'pet:feed')], on = world(undefined, full, G + 30), off = world(null, full, G + 30);
  ok(on.w.funtrumpMythic && on.w.funtrumpMythic.block === G + 2 && on.w.funtrumpMythic.tx, 'FUNTRUMP Mythic at the burn that reaches 6,906,900 (' + (on.w.funtrumpMythic && on.w.funtrumpMythic.block) + ')');
  ok(strip(on.w) === strip(off.w), 'FUNTRUMP path identical with the gate on vs off');
  const V = on.V, w = on.w, cs = w.funtrumpMythic.block; ok(V.halvingBlocks(w).join() === '972875,' + (cs + 6), 'halving 2 = his Cold Storage + 6');
  ok(V.eraAt(w, G) === 1 && V.eraAt(w, cs + 6) === 2, 'era 1 at the gate, era 2 after halving 2');
  ok(V.cpThresholds(w, cs + 6, cs)[5] === 6216210, 'pet #5 (starts at ' + cs + ', after the gate) Mythic 6,216,210 in era 2');
  ok(V.cpThresholds(w, cs + 3, cs)[5] === 6906900, 'pet #5 before halving 2 (still era 1): base target');
  ok(V.cpThresholds(w, cs + 6, w.kekMythic.block)[5] === 6906900, 'a pet started before the gate never changes');
  ok(V.cpThresholds(w, cs + 6, G - 1)[5] === 6906900, 'start one block before the gate: base'); }
console.log('cp-target-halving-test: ' + pass + ' passed, ' + fail + ' failed (snapshot tip ' + T + ')'); process.exit(fail ? 1 : 0);
