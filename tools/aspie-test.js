#!/usr/bin/env node
/* ASPIE (Grinder-only species). Dev tooling only. Never signs or broadcasts.
 *   node tools/aspie-test.js [--png DIR]
 * Checks: gate off = no Aspie anywhere and the Grinder keeps the slot pet; from the gate the Golden Sausage is a Legendary Aspie and the 1-in-77
 * Sausage Egg is an Aspie (Rare or Legendary); breeding never makes a second pure Aspie (aspieChild keeps her root as a hybrid); names, labels,
 * and every hybrid with her (as shape, colour, feature) renders with her own keys. --png writes a hybrid sheet. */
'use strict';
const fs = require('fs'), path = require('path');
const { load, row, fakeHash } = require('./lib/load-rules');
const ctx = load(['js/aspie-sprite.js']), V = ctx.V2Rules, PC = ctx.PetCore;
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const ME = 'bc1qaspieowner00000000000000000000000000000';
function play(list, tip) { const hashes = {}; list.forEach(r => { hashes[r.block_index] = fakeHash(r.block_index); }); return V.replay(list, hashes, [], { tip: tip, live: ctx.LiveEngine && ctx.LiveEngine.RealCore }); }
const mine = w => w.pets.filter(p => p.owner === ME);
const K = 990000, GA = V.aspieGate(), G1 = V.grindGate(), G2 = V.grind2Gate();
ok(!!ctx.AspieSprite, 'AspieSprite loads');
ok(GA === 977468, 'Aspie switches on at block 977,468');
ok(V.speciesLabel('aspie') === 'Aspie', 'species label: Aspie');

/* grinder rows: 2,000 discarded pets so every grind can roll the Golden Sausage at 20% */
function grindRows(n) { const r = [row(K - 40, ME, 0.00000001, 'pet:hi')]; for (let i = 0; i < n; i++) r.push(row(K - 30, ME, 69, 'pet:hatch')); r.push(row(K - 20, ME, 0.00000001, 'pet:hd:ALL')); return r; }
const base = grindRows(60);
function goldRun(gateOn) { V._setAspieActivation(gateOn ? K - 10 : null);
  for (let i = 0; i < 600; i++) { const rr = base.concat([row(K - 9, ME, 69, 'pet:grind')]); const w = play(rr, K - 9); if (w.grind[ME].golden) return w; } return null; }
V._setGrindActivation(K - 50); V._setGrind2Activation(K - 50);
let w0 = goldRun(false), g0 = w0 && mine(w0).filter(p => p.golden)[0];
ok(!!g0 && g0.species !== 'aspie' && w0.pets.every(p => p.species !== 'aspie'), 'gate off: the Golden Sausage is still the slot pet (' + (g0 && g0.species) + '), no Aspie anywhere');
let w1 = goldRun(true), g1 = w1 && mine(w1).filter(p => p.golden)[0];
ok(!!g1 && g1.species === 'aspie' && g1.tier === 3, 'gate on: the Golden Sausage is a Legendary Aspie (' + (g1 && g1.species + ' tier ' + g1.tier) + ')');
ok(!!g1 && g1.art && g1.art.defaultName === 'Aspie', 'she is born named Aspie');
let sp = 0, tiers = {}; for (let i = 0; i < 4000; i++) { const a = V._grinderSpecialArt(fakeHash(i), 'z' + i, K); if (a.species === 'aspie') sp++; tiers[a.tierIndex] = (tiers[a.tierIndex] || 0) + 1; }
ok(sp === 4000 && !tiers[0] && !tiers[1], 'from the gate the Grinder prize is always Aspie, Rare or Legendary (' + JSON.stringify(tiers) + ')');
V._setAspieActivation(null);
ok(V._grinderSpecialArt(fakeHash(1), 'z1', K).species !== 'aspie', 'gate off: the Grinder prize is the slot pet');

/* breeding: never a second pure Aspie */
const mk = (species) => ({ species });
let pure = 0, hyb = 0, bad = [];
const MAIN = PC.SPECIES.map(s => s.id);
for (let i = 0; i < 3000; i++) { const hex = fakeHash('b' + i), partner = MAIN[i % MAIN.length];
  const cases = [[mk('aspie'), mk(partner), { species: i % 2 ? 'aspie' : partner, hybrid: false }], [mk('aspie'), mk('aspie'), { species: 'aspie', hybrid: false }],
    [mk('hyb:aspie:' + partner), mk(partner), { species: partner, hybrid: false }], [mk('hyb:' + partner + ':aspie'), mk('pepe'), { species: 'hyb:' + partner + ':pepe', hybrid: true }],
    [mk('hyb3:aspie:pepe:doge'), mk('wojak'), { species: 'hyb3:pepe:doge:wojak', hybrid: true }]];
  for (const [A, B, c] of cases) { V._aspieChild(hex, A, B, c); const r = V.hybridRoots ? V.hybridRoots(c.species) : c.species.replace(/^hyb3?:/, '').split(':');
    if (c.species === 'aspie') pure++; else if (c.hybrid && r.indexOf('aspie') >= 0) hyb++; else bad.push(JSON.stringify([A.species, B.species, c.species])); } }
ok(pure === 0 && bad.length === 0 && hyb === 15000, 'an Aspie-line parent always gives an Aspie hybrid, never a pure Aspie (' + hyb + ' babies, ' + bad.slice(0, 3).join(' ') + ')');
const c0 = { species: 'pepe', hybrid: false }; V._aspieChild(fakeHash(9), mk('pepe'), mk('doge'), c0);
ok(c0.species === 'pepe' && !c0.hybrid, 'no Aspie parent: the baby is untouched');

/* names */
const nm = V.hybridName ? V.hybridName('hyb:aspie:pepe') : null, nm2 = V.hybridName ? V.hybridName('hyb:doge:aspie') : null, nm3 = V.hybridName ? V.hybridName('hyb3:aspie:pepe:doge') : null;
ok(nm === 'Aspepe' && nm2 === 'Aspidoge' && !!nm3 && /^As/.test(nm3), 'hybrid names: ' + [nm, nm2, nm3].join(', '));

/* hybrid renders: Aspie as shape, colour and feature with every main species */
let rendered = 0, broken = [];
const sheet = [];
for (const p of MAIN.concat(['homer', 'groyper', 'rabbit', 'funtrump', 'kek', 'wizard'])) for (const key of ['hyb:aspie:' + p, 'hyb:' + p + ':aspie']) {
  const art = PC.generate({ blockHash: fakeHash(key), petId: key, blockHeight: K }), plan = V.hybridPlan(fakeHash(key + 'x'), key, K);
  if (!plan.parts) plan.parts = []; art.species = plan.shape; art.hybrid = plan;
  for (const st of [0, 1, 3, 5]) { try { const im = V.hybridRender(art, { stage: st, frame: 0 }); if (!im || im.data.length !== 4096) throw new Error('size'); let on = 0; for (let j = 0; j < 1024; j++) if (im.data[j * 4 + 3]) on++; if (!on) throw new Error('empty'); rendered++; if (st === 3) sheet.push({ key, data: Array.from(im.data) }); } catch (e) { broken.push(key + '@' + st + ' ' + e.message); } } }
ok(broken.length === 0, 'every Aspie hybrid renders at Egg, Hatchling, Adult and Mythic (' + rendered + ' renders' + (broken.length ? '; broken: ' + broken.slice(0, 4).join(' | ') : '') + ')');
const pi = process.argv.indexOf('--png'); if (pi > 0) fs.writeFileSync(path.join(process.argv[pi + 1], 'aspie-hybrids.json'), JSON.stringify(sheet));

V._setAspieActivation(GA); V._setGrindActivation(G1); V._setGrind2Activation(G2);
if (fails) { console.log(fails + ' failed'); process.exit(1); }
console.log('aspie ok');
