#!/usr/bin/env node
/* ORANGE DRAGON 1 of 1 tests (modeled on jackson-pepe-1of1-test): live gate, grant to bc1qr0nf...7zvgy, egg, Legendary, power exactly 141, once,
 * can breed, DragonSprite renders every stage and frame, and the Old Hickory Pepe grant is still there alongside it. node tools/orange-dragon-1of1-test.js */
'use strict';
const { load, snap, run } = require('./lib/load-rules');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const c = load(['js/kek-sprite.js', 'js/wizard-sprite.js', 'js/funtrump-sprite.js', 'js/viking-sprite.js', 'js/dragon-sprite.js', 'js/bo-sprite.js', 'js/rarepigeon-sprite.js', 'js/jackson-sprite.js', 'js/contest-sprite.js']), V = c.V2Rules, P = c.PetCore, K = P.STAT_KEYS, s0 = snap(), H = Object.assign({}, c.XCPETS_BLOCK_HASHES, s0.hashes);
const pw = p => K.reduce((a, k) => a + p.stats[k], 0), TO = 'bc1qr0nfspwd75gdyurds0aplau74rf45qq8w7zvgy';
const LIVE = 974644; ok(V.ACTIVATE_DRAGON_BLOCK === LIVE, 'gate live at ' + LIVE); ok(V.DRAGON_TO === TO, 'address'); ok(V.DRAGON_NAME === 'Emberkek' && V.DRAGON_TITLE === 'The Orange Dragon', 'name/title');
const tip = Math.max.apply(null, s0.rows.map(r => r.block_index).filter(b => H[b])), s = { tip, rows: s0.rows.filter(r => r.block_index <= tip), hashes: s0.hashes };
V._setDragon(null); V._setJp(null);
const w0 = run(c, s, [], tip); ok(!w0.pets.some(p => p.species === 'orangedragon'), 'no Orange Dragon while gate is OFF');
V._setDragon(tip); const w = run(c, s, [], tip), B = w.pets.filter(p => p.species === 'orangedragon');
ok(B.length === 1, 'exactly one'); const b = B[0] || {};
ok(b.owner === TO, 'owner'); ok(b.name === 'Emberkek' && b.tier === 3 && b.supreme && b.supreme.of === 1 && b.supreme.id === 'orangedragon' && b.supreme.title === 'The Orange Dragon', 'name/tier Legendary/1 of 1');
ok(b.stage === 0, 'granted as an egg'); ok(pw(b) === 141, 'power 141 (got ' + pw(b) + ')');
ok(run(c, s, [], tip).pets.filter(p => p.species === 'orangedragon').length === 1, 'once');
ok(V.breedable(Object.assign({}, b, { stage: 3 }), tip + 200) === null, 'can breed');
V._setJp(tip); const w2 = run(c, s, [], tip), J = w2.pets.filter(p => p.species === 'jacksonpepe'), D = w2.pets.filter(p => p.species === 'orangedragon');
ok(J.length === 1 && D.length === 1 && J[0].id !== D[0].id, 'both 1 of 1s granted, distinct ids'); ok(J[0] && J[0].owner === 'bc1qtke38j72qv4d8eljn7pccaykypw8luytfwdn7q' && D[0] && D[0].owner === TO, 'each to its own wallet');
const DS = c.DragonSprite; for (let st = 0; st < 6; st++) for (let f = 0; f < 4; f++) { let g; try { g = DS.draw(st, f, {}); } catch (e) { g = null; } ok(g && g.length === 32 && g.some(r => r.some(x => x)), 'renders stage ' + st + ' frame ' + f); }
V._setDragon(LIVE); V._setJp(974635);
console.log('Orange Dragon #' + b.id + ' stats ' + JSON.stringify(b.stats) + ' power ' + pw(b));
console.log(pass + ' pass, ' + fail + ' fail'); process.exit(fail ? 1 : 0);
