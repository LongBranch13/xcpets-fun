#!/usr/bin/env node
/* OLD HICKORY PEPE 1 of 1 tests (modeled on rarepigeon-1of1-test): gate null = OFF (tested via _setJp), grant to GMONEY ...dn7q, egg, Legendary, power exactly 140,
 * once, can breed, sprite renders every stage and frame. node tools/jackson-pepe-1of1-test.js */
'use strict';
const { load, row, snap, run, fakeHash } = require('./lib/load-rules');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const c = load(['js/kek-sprite.js', 'js/wizard-sprite.js', 'js/funtrump-sprite.js', 'js/bo-sprite.js', 'js/rarepigeon-sprite.js', 'js/jackson-sprite.js', 'js/contest-sprite.js']), _vr = (c.setInterval = () => 0, c.document.readyState = 'loading', c.clearInterval = () => {}, c.requestAnimationFrame = () => 0, c.ImageData = c.ImageData || function (d, w, h) { this.data = d; this.width = w; this.height = h; }, require('vm').runInContext(require('fs').readFileSync(require('path').join(__dirname, '../js/v2-render.js'), 'utf8'), c)), V = c.V2Rules, P = c.PetCore, K = P.STAT_KEYS, s0 = snap(), H = Object.assign({}, c.XCPETS_BLOCK_HASHES, s0.hashes);
const pw = p => K.reduce((a, k) => a + p.stats[k], 0), TO = 'bc1qtke38j72qv4d8eljn7pccaykypw8luytfwdn7q';
const LIVE = 974635; ok(V.ACTIVATE_JP_BLOCK === LIVE && V.jpGate() === LIVE, 'gate live at ' + LIVE); V._setJp(null); ok(V.JP_POWER === 140, 'power 140'); ok(V.JP_TO === TO, 'address GMONEY');
const tip = Math.max.apply(null, s0.rows.map(r => r.block_index).filter(b => H[b])), s = { tip, rows: s0.rows.filter(r => r.block_index <= tip), hashes: s0.hashes };
const w0 = run(c, s, [], tip); ok(!w0.pets.some(p => p.species === 'jacksonpepe'), 'no Old Hickory Pepe while gate is OFF');
const G = tip; V._setJp(G); const w = run(c, s, [], tip), B = w.pets.filter(p => p.species === 'jacksonpepe');
ok(B.length === 1, 'exactly one'); const b = B[0] || {};
ok(b.owner === TO, 'owner GMONEY'); ok(b.name === 'Old Hickory Pepe' && b.tier === 3 && b.supreme && b.supreme.of === 1 && b.supreme.title === 'Old Hickory', 'name/tier/1 of 1');
ok(b.stage === 0, 'granted as an egg'); ok(pw(b) === 140, 'power 140 (got ' + pw(b) + ')');
ok(run(c, s, [], tip).pets.filter(p => p.species === 'jacksonpepe').length === 1, 'once');
ok(V.breedable(Object.assign({}, b, { stage: 3 }), tip + 200) === null, 'can breed');
const CS = c.ContestSprite; for (let st = 0; st < 6; st++) for (let f = 0; f < 4; f++) { let g; try { g = CS.draw('jacksonpepe', st, f, null); } catch (e) { g = null; } ok(g && g.length === 32 && g.some(r => r.some(x => x)), 'renders stage ' + st + ' frame ' + f); }
V._setJp(LIVE);
console.log('Old Hickory Pepe #' + b.id + ' stats ' + JSON.stringify(b.stats) + ' power ' + pw(b));
console.log(pass + ' pass, ' + fail + ' fail'); process.exit(fail ? 1 : 0);
