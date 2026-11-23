#!/usr/bin/env node
/* Petdex (js/v2-petdex.js) compute + share text. Display only, so this checks counting rules, not the world. */
'use strict';
const assert = require('assert');
const P = require('../js/v2-petdex.js');
const MAIN = ['pepe', 'wojak', 'nakamoto'];
let id = 0; const pet = (o) => Object.assign({ id: ++id, owner: 'A', tier: 0, stage: 3 }, o);
const w = { pets: [
  pet({ species: 'pepe', tier: 0 }), pet({ species: 'pepe', tier: 1 }), pet({ species: 'pepe', tier: 2 }), pet({ species: 'pepe', tier: 3 }), pet({ species: 'pepe', tier: 3, stage: 5 }),
  pet({ species: 'wojak', tier: 0 }), pet({ species: 'wojak', tier: 3, owner: 'B' }),
  pet({ species: 'wojak', tier: 2, dead: true }),                    /* dead: exists, but not caught */
  pet({ species: 'nakamoto', tier: 3, stage: 5, community: true }),  /* community pets never count */
  pet({ species: 'wizard', tier: 2 }), pet({ species: 'kek', owner: 'B' }),
  pet({ species: 'hyb:pepe:wojak', tier: 1 }), pet({ species: 'hyb3:pepe:wojak:kek', owner: 'B' }),
  pet({ species: 'pepe', tier: 1, released: true, owner: 'C' })
] };
const x = P.compute(w, 'A', MAIN);
assert.deepStrictEqual(x.rows.map(r => r.sp), ['pepe', 'wojak'], 'nakamoto has no countable pets, so no row');
const pe = x.rows[0], wo = x.rows[1];
assert.strictEqual(pe.of, 5); assert.strictEqual(pe.have, 5); assert.ok(pe.done, 'pepe row mastered');
assert.strictEqual(wo.of, 3, 'wojak C, R (dead) and L exist'); assert.strictEqual(wo.have, 1); assert.ok(!wo.done);
assert.strictEqual(wo.cells[2].mine, 0, 'a dead pet is not caught'); assert.strictEqual(wo.cells[4], null, 'no Mythic wojak exists');
assert.deepStrictEqual(x.legends.map(c => [c.sp, !!c.mine]), [['wizard', true], ['kek', false]]);
assert.deepStrictEqual(x.hybrids.map(c => [c.sp, !!c.mine]), [['hyb:pepe:wojak', true], ['hyb3:pepe:wojak:kek', false]]);
assert.strictEqual(x.got, 7); assert.strictEqual(x.total, 10, 'score = species squares + legends; hybrids are their own count');
assert.strictEqual(x.pct, 70); assert.strictEqual(x.rank, 'Gotta Burn Em All'); assert.deepStrictEqual(x.mastered, ['pepe']);
assert.strictEqual(pe.cells[1].players, 1, 'released pets are not counted');
const t = P.shareText(x);
assert.ok(/^📖 My XCPETS Petdex: 7\/10 \(70%\)/.test(t)); assert.ok(t.includes('⬜🟩🟦🟨🟪 ⭐')); assert.ok(t.includes('⬜⬛⬛'));
assert.ok(!/\bA\b/.test(t.split('\n').slice(1).join(' ')), 'no address in the share text');
const none = P.compute(w, '', MAIN); assert.strictEqual(none.got, 0);
assert.strictEqual(P.rankOf(100), 'PETDEX GOD'); assert.strictEqual(P.rankOf(0), 'Egg Sniffer');
console.log('petdex-test: all checks pass');
