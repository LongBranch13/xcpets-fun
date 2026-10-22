#!/usr/bin/env node
/* Saved-spins tests (dev only): conversion at launch, the 10-spin cap per burn, spins never expire, lucky drops, closed pet:fr / pet:of. */
'use strict';
const { load, row, snap, run } = require('./lib/load-rules');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const S = snap(process.argv[2]), T = S.tip, G = T + 6;
const c = load(), V = c.V2Rules; V._setSpinsActivation(G); V._setFiresaleActivation(null);
const w0 = run(c, S, [], T); /* before the gate */
const fr = Object.assign({}, w0.freeRolls), founders = Object.keys(fr).filter(a => fr[a] > 0);
const owners = {}; w0.pets.forEach(p => { if (!p.community && p.owner) owners[p.owner] = 1; });
const ofBy = {}; Object.keys(owners).forEach(a => { const n = V.overflowSpins(w0, a, G); if (n > 0) ofBy[a] = n; });
ok(V.spinsLeft(w0, founders[0], T) === 0, 'no saved spins before the gate');
console.log('  founders with free rolls left:', founders.map(a => a.slice(0, 8) + '…=' + fr[a]).join(', ') || 'none', '| owners with overflow:', Object.keys(ofBy).length);
const ME = 'bc1qsavedspinstest00000000000000000000000';
const F = founders[0] || Object.keys(ofBy)[0];
const rows = [row(G, ME, 6900, 'pet:hatch144'), row(G + 1, F, 0.00000001, 'pet:usespin:10'), row(G + 1, F, 0.00000001, 'pet:usespin:11'), row(G + 2, F, 0.00000001, 'pet:fr:1'), row(G + 2, F, 0.00000001, 'pet:of:1'), row(G + 3, ME, 0.00000001, 'pet:usespin')];
const w = run(c, S, rows, G + 200), rej = tx => w.log.find(l => l.tx === tx);
/* conversion */
founders.forEach(a => ok(w.spins[a] && w.spins[a].log.some(x => x.src === 'founder' && x.n === fr[a]), 'founder ' + a.slice(0, 8) + ' converted ' + fr[a] + ' free rolls'));
ok(founders.every(a => !(w.freeRolls[a] > 0)), 'founder credits zeroed after conversion');
Object.keys(ofBy).slice(0, 5).forEach(a => ok(V.spinsLeft(w, a, G + 200) >= ofBy[a] - (a === F ? 10 : 0), 'overflow left counts as spins for ' + a.slice(0, 8)));
const startF = (fr[F] || 0) + (ofBy[F] || 0);
ok(V.spinsLeft(w, F, G + 200) === startF - (startF >= 10 ? 10 : 0), 'balance after one 10-spin burn: ' + V.spinsLeft(w, F, G + 200) + ' (start ' + startF + ')');
/* cap */
ok(V.parseTag('pet:usespin:10').n === 10 && V.parseTag('pet:usespin:11').action === 'invalid' && V.parseTag('pet:usespin:0').action === 'invalid', 'parse: 1-10 ok, 0/11 invalid');
const used10 = rej(rows[1].tx_hash), used11 = rej(rows[2].tx_hash);
ok(startF < 10 || (used10 && used10.kind === 'roll' && used10.spins.length === 10), 'pet:usespin:10 resolves 10 wheel spins in one burn');
ok(used11 && used11.kind === 'rejected', 'pet:usespin:11 rejected (cap 10 per burn)');
ok(V.useSpinPlan(25).tag === 'pet:usespin:10' && V.useSpinPlan(1).tag === 'pet:usespin' && V.useSpinPlan(3).amount === 0.00000001, 'plan builder caps at 10, 1-sat');
ok(V.sendBlock(w, { tag: 'pet:usespin:10' }, G + 200, { me: ME }) != null || V.spinsLeft(w, ME, G + 201) >= 10, 'send guard blocks more than the balance');
/* closed old tags */
ok(rej(rows[3].tx_hash).kind === 'rejected' && rej(rows[4].tx_hash).kind === 'rejected', 'pet:fr / pet:of closed after the gate');
/* lucky drops */
const toks = w.log.filter(l => l.token && l.spin && w.byId[l.petId] && w.byId[l.petId].owner === ME).length, meRec = w.spins[ME] || { earned: 0 };
ok(toks > 10 && toks < 70, 'case of 144 hatches: ~25% lucky drops (' + toks + ')'); ok(meRec.earned === toks, 'each lucky drop = +1 saved spin');
ok(!w.itemList.some(g => g.owner === ME && g.src === 'token'), 'lucky drops no longer auto-roll gear');
const u1 = rej(rows[5].tx_hash); ok(u1 && u1.kind === 'roll' && u1.saved, 'player spends a lucky-drop spin with pet:usespin');
/* never expire */
const a1 = V.spinsLeft(w, F, G + 200), wLate = run(c, S, rows, G + 200000); ok(V.spinsLeft(wLate, F, G + 200000) === a1, 'balance unchanged 200,000 blocks later (never expire)');
ok(V.spinsLeft(wLate, ME, G + 200000) === toks - 1, 'lucky-drop spins kept too');
/* pre-gate replay unchanged */
const c2 = load(), w2 = run(c2, S, [], T); ok(!w2.spins, 'live tip: no spins ledger yet');
console.log(`saved-spins-test: ${pass}/${pass + fail} pass`); process.exitCode = fail ? 1 : 0;
