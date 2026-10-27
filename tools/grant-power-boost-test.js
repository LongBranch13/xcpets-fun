#!/usr/bin/env node
/* GRANT POWER BOOST tests (branch grant-power-boost): supremes 155-160 (above every pet, cap 34), Burn Lords 142-149 (cap 30), gated, once,
 * shape kept, never lowered, nothing else changes, later grants of the same kind boosted too. node tools/grant-power-boost-test.js */
'use strict';
const { load, row, snap, run } = require('./lib/load-rules');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const c = load(), V = c.V2Rules, P = c.PetCore, K = P.STAT_KEYS, s0 = snap(), H = Object.assign({}, c.XCPETS_BLOCK_HASHES, s0.hashes);
const pw = p => K.reduce((a, k) => a + p.stats[k], 0);
ok(V.ACTIVATE_GRANT_POWER_BLOCK === null, 'preview: gate null (set to tip + 6 at deploy)');
/* pure scaler */
const sc = V.grantPowerScale({ vigor: 14, spark: 21, grit: 24, zoom: 23, luck: 17 }, 155, 34); ok(sc && K.reduce((a, k) => a + sc[k], 0) === 155 && K.every(k => sc[k] <= 34), 'scale hits target under cap');
ok(sc.grit >= sc.zoom && sc.zoom >= sc.spark && sc.spark >= sc.luck && sc.luck >= sc.vigor, 'scale keeps stat order');
ok(V.grantPowerScale({ vigor: 30, spark: 30, grit: 30, zoom: 30, luck: 30 }, 140, 30) === null, 'never lowers');
/* world: grant at the tip (like burn-lords-test), gate later */
const tip = Math.max.apply(null, s0.rows.map(r => r.block_index).filter(b => H[b])), s = { tip, rows: s0.rows.filter(r => r.block_index <= tip), hashes: s0.hashes };
const sm = s.rows.filter(r => r.block_index < tip).reduce((m, r) => Math.max(m, r.block_index), 0); V._setBurnLordsSnapshot(sm);
const ex = [row(tip + 3, 'bc1qgrantpowertestxxxxxxxxxxxxxxxxxxxxxxx', 1, 'PET:HATCH')];
V._setGrantPower(tip + 2); const wB = run(c, s, [], tip + 1); const pre = wB.pets.filter(p => p.burnLord || p.supreme);
ok(pre.length === 7 && pre.every(p => !p.grantPower), 'before the gate: 7 grant pets, no boost');
const w = run(c, s, ex, tip + 3), G = w.pets.filter(p => p.burnLord || p.supreme);
ok(G.length === 7, '7 grant pets after the gate');
const others = w.pets.filter(p => !(p.burnLord || p.supreme)), maxOther = Math.max.apply(null, others.map(pw));
G.forEach(p => { const b = pre.find(q => q.id === p.id), t = pw(p), cap = p.supreme ? 34 : 30;
  ok(p.grantPower && p.grantPower.block >= tip + 2 && p.grantPower.to === t, '#' + p.id + ' flagged at the gate');
  ok(p.supreme ? t >= 155 && t <= 160 : t >= 142 && t <= 149, '#' + p.id + ' power ' + t + ' in range');
  ok(K.every(k => p.stats[k] <= Math.max(cap, b.stats[k]) && p.stats[k] >= b.stats[k]), '#' + p.id + ' per-stat cap + never lower');
  ok(p.tier === b.tier && p.species === b.species && p.name === b.name && p.owner === b.owner && JSON.stringify(p.art) === JSON.stringify(b.art), '#' + p.id + ' rarity/art/name/owner same'); });
G.filter(p => p.supreme).forEach(p => ok(pw(p) > maxOther && pw(p) > Math.max.apply(null, G.filter(q => q.burnLord).map(pw)), '#' + p.id + ' supreme above every other pet'));
G.filter(p => p.burnLord).forEach(p => ok(pw(p) > maxOther, '#' + p.id + ' Burn Lord above every ordinary pet'));
/* nobody else touched */
const byB = {}; wB.pets.forEach(p => { byB[p.id] = p; });
ok(others.every(p => !byB[p.id] || !p.grantPower), 'no other pet flagged');
/* once: replay further does not boost again; deterministic */
const w2 = run(c, s, ex.concat([row(tip + 9, 'bc1qgrantpowertestxxxxxxxxxxxxxxxxxxxxxxx', 1, 'PET:HATCH')]), tip + 9);
ok(JSON.stringify(w2.pets.filter(p => p.grantPower).map(p => p.stats)) === JSON.stringify(G.map(p => p.stats)), 'one time, deterministic');
/* future grant of the same kind (grant after the gate) is boosted at its grant block */
V._setGrantPower(tip - 50); const w3 = run(c, s, [], tip); const G3 = w3.pets.filter(p => p.burnLord || p.supreme);
ok(G3.length === 7 && G3.every(p => p.grantPower && p.grantPower.block === tip), 'grant after the gate: boosted at the grant block');
/* real game feed (api/boot.json): the same world pet.html shows; real #46067-#46073 hit their ranges, Burn Lords above every ordinary pet */
{ const B = require('../api/boot.json'); V._setBurnLordsSnapshot(973300); V._setGrantPower(B.tip - 17); const wr = run(c, B, [], B.tip), R = wr.pets.filter(p => p.burnLord || p.supreme), mo = Math.max.apply(null, wr.pets.filter(p => !(p.burnLord || p.supreme)).map(pw));
  ok(R.length === 7 && R.map(p => p.id).sort().join() === '46067,46068,46069,46070,46071,46072,46073', 'feed: grant pets are #46067-#46073 got ' + R.map(p => p.id).join());
  R.forEach(p => { const t = pw(p); ok(p.grantPower && (p.supreme ? t >= 155 && t <= 160 : t >= 142 && t <= 149) && t > mo, 'feed #' + p.id + ' power ' + t + ' (ordinary max ' + mo + ')'); });
  ok(Math.min.apply(null, R.filter(p => p.supreme).map(pw)) > Math.max.apply(null, R.filter(p => p.burnLord).map(pw)), 'feed: 1-of-1s above every Burn Lord'); }
/* gate null = inert */
V._setGrantPower(null); const w4 = run(c, s, [], tip); ok(w4.pets.every(p => !p.grantPower), 'gate null: inert');
console.log((fail ? 'FAIL' : 'ok') + ' grant-power-boost-test: ' + pass + ' pass, ' + fail + ' fail'); process.exit(fail ? 1 : 0);
