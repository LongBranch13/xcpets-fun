#!/usr/bin/env node
/* gods-breed-gods-test (gods-breed-gods-1102, owner Nov 2 2026 12:30 AM CT "gods only breed gods is a rule"): the rule is already live
 * (ACTIVATE_RES_BREED_ONLY_BLOCK 973982, resPairWhy). Every Mythic God is resurrected, so it counts as a God. This change is UI only:
 * the breed pickers (easy flow on play.html / breed.html, the motel 'Browse pets') never list a God with a non-God, even with 'Show all' on.
 *   node tools/gods-breed-gods-test.js */
'use strict';
const fs = require('fs'), path = require('path'), L = require('./lib/load-rules');
const ROOT = path.resolve(__dirname, '..'), rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const V = L.load().V2Rules;
/* 1. the live rule: a Mythic God is resurrected, so it breeds only with resurrected pets */
ok(V.resBreedOnlyGate() === 973982, 'live gate ACTIVATE_RES_BREED_ONLY_BLOCK = 973982');
const MG = { id: 1, mythicGod: { seat: 1 }, resurrected: { block: 974100 } }, MG2 = { id: 2, mythicGod: { seat: 2 }, resurrected: { block: 974110 } },
  G = { id: 3, resurrected: { block: 974000 } }, N = { id: 4 }, N2 = { id: 5 }, B = 974300;
ok(V.resPairWhy(MG, N, B) === V.RES_BREED_WHY && V.resPairWhy(N, MG, B) === V.RES_BREED_WHY, 'Mythic God and a normal pet: blocked (both orders)');
ok(V.resPairWhy(G, N, B) === V.RES_BREED_WHY, 'God (resurrected) and a normal pet: blocked');
ok(V.resPairWhy(MG, MG2, B) === null && V.resPairWhy(MG, G, B) === null && V.resPairWhy(G, MG, B) === null, 'Mythic God with a Mythic God or a God: allowed');
ok(V.resPairWhy(N, N2, B) === null, 'two normal pets: allowed');
ok(V.resPairWhy(MG, N, 973981) === null, 'before the gate: not blocked');
ok(V.tierLabelOf(MG) === 'Mythic God' && V.tierLabelOf(G) === 'God', 'labels: Mythic God / God');
/* 2. rules source: the Resurrection that makes a Mythic God also marks it resurrected */
const R = rd('js/v2-rules.js');
ok(/mgAscend/.test(R) && /function resPairWhy\(A,\s*B,\s*b\)/.test(R), 'rules: mgAscend and resPairWhy present');
/* 3. pickers: God and non-God mates are left out, 'Show all' included */
const E = rd('js/v2-easy-flows.js'), M = rd('js/v2-motel.js');
ok(/var resX = function \(p\) \{ return !!\(A && Vr\.resPairWhy && Vr\.resPairWhy\(A, p, T \+ 1\)\); \}/.test(E), 'easy flow: resX uses the live resPairWhy');
ok(/\(s\.fall \? x\.p\.stage >= 1 && !x\.p\.dead : !x\.why && x\.p\.stage >= 3\) && !resX\(x\.p\)/.test(E), "easy flow: the partner pool drops mixed mates in both views (incl. 'Show all')");
ok(/if \(Bp && !s\.req && !resX\(Bp\)/.test(E), 'easy flow: a picked mixed mate is not pinned back into the list');
ok(!/greyed out/.test(E), "easy flow: the hint says hidden (no 'greyed out' view left)");
ok(/src = sd === 'A' \? L\.mine : L\.partners\.filter\(function \(x\) \{ return !resX\(x\.p\); \}\)/.test(M), 'motel: Browse pets leaves out mixed mates');
ok(/okB = L\.partners\.filter\(function \(x\) \{ return !x\.why && x\.p\.stage >= 3; \}\)/.test(M), 'motel: chips list only mates with no reason (mixed ones have one)');
ok(/return '<button[^\n]*/.test(rd('js/v2.js')) && /okB = L\.partners\.filter\(function \(x\) \{ return !x\.why; \}\)/.test(rd('js/v2.js')), 'play grid: only mates with no reason');
/* 4. rules page copy + wording */
const H = rd('rules.html');
ok(/<b>Gods only breed with Gods<\/b> \(from block 973,982\)/.test(H), 'rules.html states the rule');
for (const [f, s] of [['js/v2-easy-flows.js', E], ['js/v2-motel.js', M], ['rules.html', H]]) {
  const lines = s.split('\n').filter(l => /gods-breed-gods-1102|Gods only breed with Gods/.test(l)).map(l => (l.match(/(gods-breed-gods-1102[^*]*\*\/|Gods only breed with Gods[^<]*<\/b>[^<]*)/) || [''])[0]);
  ok(lines.every(l => !/\b(series|discount)\b|\d\s*x\b|\bx\s*\d|\bGod x\b/i.test(l)), 'wording: no "x", series or discount in new text ' + f); }
console.log('gods-breed-gods-test: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
