#!/usr/bin/env node
/* BO JACKSON 1 of 1 tests: gated grant to the 3gqd address, egg, Legendary, power exactly 134, not boosted by the supreme sweep, grows/breeds/fights/gear,
 * sprite renders every stage. node tools/bo-1of1-test.js */
'use strict';
const { load, row, snap, run } = require('./lib/load-rules');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const c = load(), V = c.V2Rules, P = c.PetCore, K = P.STAT_KEYS, s0 = snap(), H = Object.assign({}, c.XCPETS_BLOCK_HASHES, s0.hashes);
const pw = p => K.reduce((a, k) => a + p.stats[k], 0);
ok(V.ACTIVATE_BO_BLOCK === 973333, 'gate 973333'); ok(V.BO_POWER === 134, 'power 134');
const tip = Math.max.apply(null, s0.rows.map(r => r.block_index).filter(b => H[b])), s = { tip, rows: s0.rows.filter(r => r.block_index <= tip), hashes: s0.hashes };
const w0 = run(c, s, [], tip); ok(!w0.pets.some(p => p.species === 'bojackson'), 'no Bo before the gate');
V._setBo(tip); const w = run(c, s, [], tip), B = w.pets.filter(p => p.species === 'bojackson');
ok(B.length === 1, 'exactly one Bo'); const b = B[0];
ok(b.owner === 'bc1pfvkpmllr7mtn5uazqxumwp39h2ny3c8l6fmrgvjv2cqn5wlpt7hssf3gqd', 'owner 3gqd');
ok(b.name === 'Bo Jackson' && b.tier === 3 && b.supreme && b.supreme.id === 'bo' && b.supreme.title === 'Bo Knows' && b.supreme.of === 1, 'name/tier/1 of 1');
ok(b.stage === 0 && b.care === 0, 'granted as an egg'); ok(pw(b) === 134, 'power 134 got ' + pw(b)); ok(!b.grantPower, 'not in the 155-160 supreme sweep');
ok(K.every(k => b.stats[k] >= 1 && b.stats[k] <= 30), 'stats 1..30');
const w2 = run(c, s, [], tip); ok(w2.pets.filter(p => p.species === 'bojackson').length === 1, 'once');
ok(V.breedable(Object.assign({}, b, { stage: 3 }), 973400) === null, 'can breed');
console.log('Bo #' + b.id + ' stats ' + JSON.stringify(b.stats) + ' power ' + pw(b));
const CS = require('../js/contest-sprite.js'); for (let st = 0; st <= 5; st++) { const f = CS.frames('bojackson', st, '#14101e', st ? { hand: { item: 'stick', cols: ['#8a5a2b', '#c8955a'] } } : null); ok(f.length === 4 && f[0].data.length === 4096, 'sprite stage ' + st); }
console.log(pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
