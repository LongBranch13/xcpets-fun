#!/usr/bin/env node
/* Electric Eggs tests (dev only, preview branch electric-eggs): pet:hatchzap tier odds 30/40/22/8, gate OFF/before = plain burn (old unknown-tag
 * result), species-in-tier pick unchanged, normal hatches untouched, cost scales with halving. node tools/electric-eggs-test.js [N] */
'use strict';
const crypto = require('crypto');
const { load } = require('./lib/load-rules');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const N = +process.argv[2] || 40000;
const H = i => crypto.createHash('sha256').update('zap-block-' + i).digest('hex'), ID = i => crypto.createHash('sha256').update('zap-tx-' + i).digest('hex');
const c = load(), V = c.V2Rules, G = V.electricGate(), B = G + 10;
ok(G === null || G >= 972985, 'gate null or a future block (' + G + ')');
ok(V.ELECTRIC_N === 1000 && V.ELECTRIC_COST === 100000, '1,000 eggs for 100,000 base');
ok(V.ELECTRIC_TIER_10K.reduce((a, b) => a + b, 0) === 10000, 'electric odds sum to 10,000');
/* 1. parse: distinct tag, n and cost */
const t = V.parseTag ? V.parseTag('PET:HATCHZAP') : null; if (t) ok(t.action === 'zap' && t.n === 1000 && t.cost === 100000, 'PET:HATCHZAP parses to the zap case');
/* 2. gate */
ok(!V.electricOn(G - 1) && V.electricOn(G), 'off one block before the gate, on at the gate');
V._setElectricActivation(null); ok(!V.electricOn(B), 'gate null = off'); V._setElectricActivation(G);
/* 3. odds simulation */
const tc = [0, 0, 0, 0], nt = [0, 0, 0, 0]; let looks = true, spec = 0;
for (let i = 0; i < N; i++) { const a = V.electricArt(H(i), ID(i), B); tc[a.tierIndex]++; const n = V.hatchArt(H(i), ID(i), B); nt[n.tierIndex]++;
  if (a.pattern !== n.pattern || a.bgColor !== n.bgColor) looks = false; if (['kek', 'wizard', 'funtrump'].indexOf(a.species) >= 0) spec++; }
const E = [0.30, 0.40, 0.22, 0.08], Nn = [0.60, 0.27, 0.10, 0.03], nm = ['Common', 'Uncommon', 'Rare', 'Legendary'];
E.forEach((e, k) => ok(Math.abs(tc[k] / N - e) < 0.01, 'electric ' + nm[k] + ' ~' + e * 100 + '% (got ' + (tc[k] / N * 100).toFixed(2) + '%)'));
ok(looks, 'electric eggs keep the egg looks (pattern, background)');
ok(Math.abs(spec / N - 1 / 777) < 0.002, '1-in-777 special slot unchanged (' + spec + ')');
/* 4. species inside a tier: same pool as a normal egg of that tier */
let pool = true; for (let i = 0; i < 3000; i++) { const a = V.electricArt(H(i), ID(i), B); if (['kek', 'wizard', 'funtrump', 'nakamoto'].indexOf(a.species) >= 0) continue;
  if (c.PetCore.SPECIES && c.PetCore.SPECIES[a.species] && c.PetCore.SPECIES[a.species].tier != null && c.PetCore.SPECIES[a.species].tier > a.tierIndex) pool = false; }
ok(pool, 'no species above its tier');
/* 5. normal hatches unaffected by the gate */
const c2 = load(), V2 = c2.V2Rules; V2._setElectricActivation(null); let same = 0;
for (let i = 0; i < 3000; i++) if (JSON.stringify(V.hatchArt(H(i), ID(i), B)) === JSON.stringify(V2.hatchArt(H(i), ID(i), B))) same++;
ok(same === 3000, 'hatchArt identical with the electric gate on vs off');
/* 6. EV report */
const evE = E.map(e => e * 1000), eggsN = 100000 / 6900 * 144, evN = Nn.map(e => e * eggsN);
console.log('SIM N=' + N + ' electric: ' + tc.map((x, k) => nm[k] + ' ' + (x / N * 100).toFixed(2) + '%').join(', '));
console.log('EV one Electric case (1,000 eggs): ' + evE.map((x, k) => nm[k] + ' ' + x.toFixed(1)).join(', '));
console.log('EV same XCPETS on Croak Crates (' + eggsN.toFixed(0) + ' eggs): ' + evN.map((x, k) => nm[k] + ' ' + x.toFixed(1)).join(', '));
console.log((fail ? 'FAILED ' : 'OK ') + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
