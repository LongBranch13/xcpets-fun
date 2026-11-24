/* carrier-tip (Nov 24 2026): the Power hover shows carried stats beside the pet's own, marked ⟦n⟧ (painted as a coloured "(n)").
 * Run: node tools/carrier-tip-test.js */
'use strict';
const assert = require('assert');
global.window = global;
require('../js/v2-power-tip.js');
const T = global.V2PowerTip;
const p = { stats: { vigor: 29, spark: 26, grit: 28, zoom: 20, luck: 22 }, carried: [{ stat: 'vigor', value: 30 }, { stat: 'grit', value: 27 }, { stat: 'grit', value: 30 }, { stat: 'nope', value: 99 }] };
assert.deepStrictEqual(T.carried(p), { vigor: 30, grit: 30 }, 'highest carried value per real stat');
const t = T.power(p);
assert.ok(t.startsWith('Vigor 29 ⟦30⟧ + Spark 26 + Grit 28 ⟦30⟧ + Zoom 20 + Luck 22 = 125'), t);
assert.ok(/⟦30⟧ = carried: when this pet breeds, its egg gets at least 30 Vigor/.test(t), t);
const a = T.attr(t);
assert.ok(a.includes('aria-label="Vigor 29 (carries 30) + Spark 26 + Grit 28 (carries 30)'), a);
assert.ok(!/aria-label="[^"]*⟦/.test(a), 'screen readers never get the markers');
const plain = { stats: { vigor: 1, spark: 2, grit: 3, zoom: 4, luck: 5 } };
assert.strictEqual(T.power(plain), 'Vigor 1 + Spark 2 + Grit 3 + Zoom 4 + Luck 5 = 15', 'no carriers: unchanged text');
assert.strictEqual(T.power(Object.assign({ carried: [] }, plain)), T.power(plain));
assert.ok(T.stats(p).startsWith('Vigor 29 ⟦30⟧ · Spark 26 · Grit 28 ⟦30⟧'));
console.log('carrier-tip-test: ok');
