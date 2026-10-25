#!/usr/bin/env node
/* 7-day streak spin (player-tutorial reward, rule change behind ACTIVATE_STREAK_SPIN_BLOCK): +1 saved Pepe Wheel spin once per wallet for
 * feeding own pets 7 chain days in a row; only pets hatched before the streak's first day count; nothing before the gate. */
'use strict';
const { load, row, snap, run } = require('./lib/load-rules');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else fail++; console.log((c ? 'ok   ' : 'FAIL ') + m); };
const S = snap(process.argv[2]), T = S.tip, G = T + 6, BPD = 144, d0 = Math.floor(G / BPD) + 1, at = (d, k) => d * BPD + 10 + (k || 0);
const c = load(), V = c.V2Rules; V._setSpinsActivation(Math.min(V.ACTIVATE_SPINS_BLOCK, G));
ok(V.ACTIVATE_STREAK_SPIN_BLOCK === 973100, 'gate is 973100 (tip 973094 + 6)');
const A = 'bc1qstreakspinaaaaaaaaaaaaaaaaaaaaaaaaaaaa', B = 'bc1qstreakspinbbbbbbbbbbbbbbbbbbbbbbbbbbbb', C = 'bc1qstreakspincccccccccccccccccccccccccccc';
const hatches = [row(G, A, 69, 'pet:hatch'), row(G, B, 69, 'pet:hatch'), row(G + 1, B, 69, 'pet:hatch'), row(at(d0), C, 69, 'pet:hatch')];
const w0 = run(c, S, hatches, at(d0, 5)), idOf = a => (w0.pets.find(p => p.owner === a && !p.community) || {}).id;
const ia = idOf(A), ib = idOf(B), ib2 = w0.pets.filter(p => p.owner === B)[1].id, ic = idOf(C); ok(ia && ib && ic, 'test pets hatched #' + ia + ' #' + ib + ' #' + ic);
const feeds = (a, id, days) => days.map(d => row(at(d, 20), a, 100000, 'pet:feed:' + id));
const rng = (s, n) => Array.from({ length: n }, (_, i) => s + i);
const rows = hatches.concat(feeds(A, ia, rng(d0, 14)), feeds(B, ib, rng(d0, 6)), feeds(B, ib2, [d0 + 3]), feeds(B, ib2, rng(d0 + 7, 7)), feeds(C, ic, rng(d0, 7)));
const END = at(d0 + 15), streak = (w, a) => ((w.spins && w.spins[a] && w.spins[a].log) || []).filter(x => x.src === 'streak7');
/* before the gate: inert, world identical to a build without the feature */
V._setStreakSpinActivation(999999999); const wOff = run(c, S, rows, END); ok(!streak(wOff, A).length && !wOff.streakSpin, 'gate not reached: no streak spins, no ledger');
V._setStreakSpinActivation(null); const wNull = run(c, S, rows, END);
ok(JSON.stringify(wOff.spins || {}) === JSON.stringify(wNull.spins || {}) && JSON.stringify(wOff.pets.map(p => [p.id, p.care, p.stage])) === JSON.stringify(wNull.pets.map(p => [p.id, p.care, p.stage])), 'before the gate replay is SAME as no feature');
V._setStreakSpinActivation(G); const w = run(c, S, rows, END);
ok(streak(w, A).length === 1 && streak(w, A)[0].block === at(d0 + 6, 20), 'A: 7 days in a row = 1 spin on day 7');
ok(streak(w, A).length === 1, 'A: 14 days still only 1 spin (once per wallet)');
ok(streak(w, B).length === 1 && streak(w, B)[0].block === at(d0 + 13, 20), 'B: 6 days, a gap, then 7 days (another pet) = spin only after the full 7');
ok(streak(w, C).length === 0, 'C: pet hatched on the streak\'s first day does not count');
ok(V.spinsLeft(w, A, END) >= 1, 'A: the spin shows in the saved-spins balance');
const early = run(c, S, hatches.concat(feeds(A, ia, rng(d0, 7))), END); V._setStreakSpinActivation(at(d0 + 3)); const half = run(c, S, hatches.concat(feeds(A, ia, rng(d0, 7))), END);
ok(streak(early, A).length === 1 && streak(half, A).length === 0, 'feeds before the gate never count toward a streak');

console.log((fail ? fail + ' FAILED' : 'all ' + pass + ' checks pass'));
process.exit(fail ? 1 : 0);
