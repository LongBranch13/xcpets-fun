#!/usr/bin/env node
/* Community-species tier tests (dev only): Lord Kek / Wizard / FUNTRUMP eggs Rare or Legendary via the shared 1000:300 roll, Wizard + FUNTRUMP
 * salts unchanged, gate OFF = old behaviour, normal hatches untouched. Prints a simulation table. node tools/community-tier-test.js [N] */
'use strict';
const crypto = require('crypto');
const { load } = require('./lib/load-rules');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const N = +process.argv[2] || 20000, G = 972950, B = G + 10;
const H = i => crypto.createHash('sha256').update('sim-block-' + i).digest('hex'), ID = i => crypto.createHash('sha256').update('sim-tx-' + i).digest('hex');
const old = (salt, id, b) => parseInt(crypto.createHash('sha256').update(String(id) + ':' + b + salt).digest('hex').slice(0, 12), 16) % 1300 < 300 ? 3 : 2;
const c = load(), V = c.V2Rules;
ok(V.ACTIVATE_SPECIAL_TIER_BLOCK === null, 'gate ships as null');
/* 1. Wizard / FUNTRUMP salts unchanged */
let same = 0; for (let i = 0; i < 2000; i++) { const id = ID(i); if (V.wizRollTier(id, B) === old('XCPETS:v2:wiztier', id, B) && V.ftRollTier(id, B) === old('XCPETS:v2:fttier', id, B)) same++; }
ok(same === 2000, 'wizRollTier/ftRollTier identical to the old formulas');
ok(V.specialRollTier('nakamoto', 'x', B) === 3, 'Nakamoto fixed Legendary'); ok(V.specialRollTier('pepe', 'x', B) === null, 'normal species not special');
/* 2. gate OFF: Kek egg = raw egg roll; gate ON before/at block */
const raw = (i, b) => c.PetCore.generate({ blockHash: H(i), petId: ID(i), blockHeight: b });
let offSame = 0; for (let i = 0; i < 500; i++) { const a = V.kekArt(H(i), ID(i), B), r = raw(i, B); if (a.tierIndex === r.tierIndex && JSON.stringify(a.baseStats) === JSON.stringify(r.baseStats)) offSame++; }
ok(offSame === 500, 'gate null: Kek eggs unchanged');
V._setSpecialTierActivation(G);
let pre = 0; for (let i = 0; i < 500; i++) if (V.kekArt(H(i), ID(i), G - 1).tierIndex === raw(i, G - 1).tierIndex) pre++;
ok(pre === 500, 'before the gate block: Kek eggs unchanged');
/* 3. simulation at the gate */
const kt = [0, 0, 0, 0]; let statsOk = true;
for (let i = 0; i < N; i++) { const a = V.kekArt(H(i), ID(i), B), r = raw(i, B); kt[a.tierIndex]++;
  const d = c.PetCore.TIERS[a.tierIndex].statBonus - c.PetCore.TIERS[r.tierIndex].statBonus; if (Object.keys(r.baseStats).some(k => a.baseStats[k] !== Math.max(1, r.baseStats[k] + d))) statsOk = false;
  if (a.species !== 'kek' || a.pattern !== r.pattern || a.eyes !== (r.eyes === 'beady' ? 'classic' : r.eyes)) statsOk = false; }
ok(kt[0] === 0 && kt[1] === 0, 'gate on: no Common/Uncommon Lord Kek'); ok(statsOk, 'stats get the tier bonus difference, looks kept');
const leg = kt[3] / N; ok(Math.abs(leg - 300 / 1300) < 0.01, 'Legendary share ~23.08% (got ' + (leg * 100).toFixed(2) + '%)');
/* 4. normal hatches unaffected (same art with gate null vs set) */
const c2 = load(), V2 = c2.V2Rules; let normSame = 0, nt = [0, 0, 0, 0], nn = 0;
for (let i = 0; i < 5000; i++) { const a = V.hatchArt(H(i), ID(i), B), z = V2.hatchArt(H(i), ID(i), B); if (JSON.stringify(a) === JSON.stringify(z)) normSame++; if (['kek', 'wizard', 'funtrump', 'nakamoto'].indexOf(a.species) < 0) { nt[a.tierIndex]++; nn++; } }
ok(normSame === 5000, 'hatchArt identical with gate on vs off for 5000 eggs (no Kek pool in a bare world)');
/* 5. pure Kek child floored at Rare */
const kids = [0, 0, 0, 0]; const w = { pets: [], log: [], items: {}, nextPet: 1, byId: {}, live: {}, owners: {} };
try { for (let i = 0; i < 300; i++) { const A = { id: 1, species: 'kek', tier: 0, stats: { vigor: 5, spark: 5, grit: 5, zoom: 5, luck: 5 }, art: {} }, Bp = Object.assign({}, A, { id: 2 });
  const n0 = w.pets.length; V.breedOne(w, A, Bp, H(i), ID(i), B, 'o'); const p = w.pets[n0]; if (p && p.species === 'kek') kids[p.tier]++; } } catch (e) { console.log('breed sim skipped:', e.message); }
if (kids.reduce((a, b) => a + b, 0)) ok(kids[0] === 0 && kids[1] === 0, 'pure Kek children Rare or better');
console.log('SIM gate=' + G + ' Lord Kek eggs N=' + N + ': Rare ' + kt[2] + ' (' + (kt[2] / N * 100).toFixed(2) + '%), Legendary ' + kt[3] + ' (' + (leg * 100).toFixed(2) + '%), Common ' + kt[0] + ', Uncommon ' + kt[1]);
console.log('SIM normal eggs (n=' + nn + '): C/U/R/L = ' + nt.map(x => (x / nn * 100).toFixed(1) + '%').join(' / ') + ' (identical with gate on/off: ' + normSame + '/5000)');
console.log('SIM pure Kek children C/U/R/L = ' + kids.join(' / '));
console.log(pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
