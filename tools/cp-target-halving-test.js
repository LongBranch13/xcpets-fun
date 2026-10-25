/* cp-target-halving-test: from ACTIVATE_CP_TARGET_HALVING_BLOCK the current community pet's targets = base / 2^era (same era as costAt, 8 dp).
 * Covers eras 0-3, same-replay before the gate, the gate edge (a pet already past its new target -> Mythic + Cold Storage AT the gate, halving +6),
 * and a mid-progress pet (below its new target at the gate -> Mythic at the burn that reaches it). Dev only; nothing signed or sent. */
'use strict';
const L = require('./lib/load-rules');
const X = ['js/kek-sprite.js', 'js/wizard-sprite.js', 'js/funtrump-sprite.js'];
const S = L.snap('snap-973128.json'), T = S.tip; let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const src = 'bc1qs88hlk930p8l6h5s2svcrvzd45ny2pn54y0j6n';
const BASE = [0, 69000, 834900, 2214900, 4146900, 6906900];
function world(gate, extra, tip) { const c = L.load(X); if (gate !== undefined) c.V2Rules._setCpTargetActivation(gate); const s = tip < S.tip ? Object.assign({}, S, { rows: S.rows.filter(r => (r.raw || r).block_index <= tip) }) : S; return { c, V: c.V2Rules, w: L.run(c, s, extra || [], tip) }; }
const G = 973136;
{ const c = L.load(X), V = c.V2Rules; ok(V.ACTIVATE_CP_TARGET_HALVING_BLOCK === G, 'gate ' + G + ' (tip 973130 + 6)');
  /* eras 0-3: base / 2^era, 8 dp; same number of minimum community feeds per target in every era */
  for (let e = 0; e <= 3; e++) { const t = V.cpScaled(e); ok(t.length === 6 && t.every((v, i) => Math.abs(v - Math.round(BASE[i] / 2 ** e * 1e8) / 1e8) < 1e-9), 'era ' + e + ' thresholds = base / 2^' + e + ': ' + t);
    ok(Math.abs(t[5] / (69 / 2 ** e) - 100100) < 1e-6, 'era ' + e + ': Mythic = 100,100 minimum feeds (' + t[5] + ' / ' + 69 / 2 ** e + ')'); }
  ok(V.cpScaled(0) === V.COMMUNITY_THRESHOLDS, 'era 0 = the original array'); }
/* same replay before the gate: gate on vs gate off at tip T (< gate) */
const strip = w => JSON.stringify({ p: w.pets.map(p => [p.id, p.stage, p.care, p.dead, p.tier]), c: [w.community.burned, w.community.petStage, w.community.funtrumpFed], ft: w.funtrumpMythic || null, log: w.log.length, h: w.halvings || null });
{ const a = world(undefined, [], T), b = world(null, [], T); ok(strip(a.w) === strip(b.w), 'replay at ' + T + ' identical with the gate set vs off');
  const a2 = world(undefined, [], G - 1), b2 = world(null, [], G - 1); ok(strip(a2.w) === strip(b2.w) && !a2.w.funtrumpMythic, 'replay at ' + (G - 1) + ' (gate - 1) identical, FUNTRUMP not Mythic');
  ok(a.V.cpThresholds(a.w, G - 1) === a.V.COMMUNITY_THRESHOLDS, 'before the gate: original thresholds'); }
/* gate edge with the real FUNTRUMP care */
{ const { V, w } = world(undefined, [], G); const fed = w.funtrump ? w.funtrump.fed : 0, era = V.eraAt(w, G - 1), tgt = V.cpScaled(V.eraAt(w, G - 1))[5];
  if (fed >= tgt) { ok(w.funtrumpMythic && w.funtrumpMythic.block === G && w.funtrumpMythic.why === 'gate' && w.funtrumpMythic.tx == null, 'FUNTRUMP care ' + fed + ' >= new target ' + tgt + ': Mythic + Cold Storage at the gate ' + G);
    ok(V.halvingBlocks(w).join() === '972875,' + (G + 6), 'next halving = gate + 6: ' + V.halvingBlocks(w));
    ok(V.eraAt(w, G + 5) === era && V.eraAt(w, G + 6) === era + 1, 'era ' + era + ' until gate + 5, era ' + (era + 1) + ' from gate + 6');
    ok(w.log.some(l => l.kind === 'funtrumpcold' && l.block === G), 'Cold Storage logged at the gate');
    ok(V.cpThresholds(w, G + 6)[5] === V.cpScaled(era + 1)[5], 'next pet target after halving: ' + V.cpThresholds(w, G + 6)[5]);
    /* burns in the gate block feed the next pet, not FUNTRUMP */
    const x = world(undefined, [L.row(G, src, 69000, 'pet:feed')], G); ok(x.w.funtrumpMythic && x.w.funtrumpMythic.total === w.funtrumpMythic.total, 'a burn in the gate block does not count for FUNTRUMP');
    const y = world(undefined, [L.row(G + 2, src, 69, 'pet:feed')], G + 3); ok(y.w.funtrumpMythic && y.w.funtrumpMythic.block === G, 'sweep from a later event still places Mythic at the gate block');
  } else { ok(!w.funtrumpMythic, 'FUNTRUMP care ' + fed + ' < target ' + tgt + ': no Mythic at the gate (older snapshot)'); } }
/* mid-progress pet: gate set early (972,885, era 1 since 972,875) -> FUNTRUMP below 3,453,450 at the gate, Mythic at the burn that reaches it */
{ const { V, w } = world(972885, [], T); const m = w.funtrumpMythic, tgt = V.cpScaled(1)[5];
  if ((w.funtrump && w.funtrump.fed) >= tgt) { ok(m && m.block > 972885 && m.tx && !m.why, 'mid-progress pet reaches Mythic at a burn (' + (m && m.block) + '), not at the gate');
    ok(m && m.total >= tgt && m.total - tgt < 1e6, 'total at Mythic just past the era-1 target: ' + (m && m.total));
    ok(V.halvingBlocks(w)[1] === m.block + 6, 'halving 2 = that Cold Storage + 6'); }
  else ok(!m, 'snapshot too early: FUNTRUMP still below the era-1 target');
  const z = world(972885, [], 972890); ok(!z.w.funtrumpMythic, 'early gate, little care: no Mythic at the gate');
  const f = z.w.funtrump.fed, th = V.cpScaled(1), st = th.filter(v => f >= v).length - 1; ok(z.w.community.funtrumpStage === st && st > [0, 69000, 834900, 2214900, 4146900, 6906900].filter(v => f >= v).length - 1, 'mid-progress stage uses era-1 lines: care ' + f + ' -> stage ' + z.w.community.funtrumpStage);
  ok(Math.abs(z.w.community.target[5] - 3453450) < 1e-9, 'community.target Mythic = 3,453,450 in era 1'); }
/* era 0 with the gate on (gate before halving 1): original targets */
{ const { V, w } = world(972800, [], 972870); ok(V.cpThresholds(w, 972870)[5] === 6906900, 'gate on, era 0: Mythic 6,906,900'); }
console.log('cp-target-halving-test: ' + pass + ' passed, ' + fail + ' failed (snapshot tip ' + T + ')'); process.exit(fail ? 1 : 0);
