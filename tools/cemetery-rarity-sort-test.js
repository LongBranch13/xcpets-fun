/* cemetery-rarity-1103 (owner [pt2761u]): the grave finder sorts do what their labels say, "Rarest first" = rarity rank (Mythic, Legendary,
 * Rare, Uncommon, Common), then 💎 Rarity score, then power; every grave card shows a rarity chip; cemetery.html loads js/pet-score.js. */
'use strict';
const fs = require('fs'), path = require('path'), assert = require('assert'), ROOT = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'js/v2-cemetery-scene.js'), 'utf8'), html = fs.readFileSync(path.join(ROOT, 'cemetery.html'), 'utf8');
const m = /var SORTF = (\{[\s\S]*?\n    id: function \(a, c\) \{ return a\.id - c\.id; \} \});/.exec(src); assert(m, 'SORTF block found');
const life = p => p.born != null && p.died != null ? p.died - p.born : -1; // same as the scene
const SORTF = new Function('life', 'return ' + m[1])(life);
const keys = (/var SORTS = (\[.*?\]\]);/.exec(src) || [])[1]; assert(keys, 'SORTS found'); const SORTS = JSON.parse(keys.replace(/'/g, '"'));
SORTS.forEach(s => assert(SORTF[s[0]], 'a local sort for ' + s[0]));
assert(/var LOC = SORTF;/.test(src), 'every sort is local');
assert(!SORTS.some(s => /Strongest at death/.test(s[1])) && SORTS.some(s => /power/i.test(s[1])), 'power is a named sort');
const g = (id, o) => Object.assign({ id, rank: 0, rbits: 10, power: 50, died: 1000, born: 100, need: 0, af: 1, raisable: true, gear: 0 }, o);
const order = (k, L) => L.slice().sort(SORTF[k]).map(x => x.id);
// rarest: rank first (a weak Mythic beats a strong Legendary), then rarity bits, then power
assert.deepStrictEqual(order('rarest', [g(1, { rank: 3, rbits: 30, power: 200 }), g(2, { rank: 4, rbits: 5, power: 1 }), g(3, { rank: 3, rbits: 31, power: 1 }), g(4, { rank: 3, rbits: 30, power: 300 }), g(5, { rank: 0, rbits: 40, power: 999 }), g(6, { rank: 2, rbits: 1 })]), [2, 3, 4, 1, 6, 5]);
assert.deepStrictEqual(order('newest', [g(1, { died: 10 }), g(2, { died: 30 }), g(3, { died: 20 })]), [2, 3, 1]);
assert.deepStrictEqual(order('oldest', [g(1, { died: 10 }), g(2, { died: 30 }), g(3, { died: 20 })]), [1, 3, 2]);
// easiest: graves that can be raised come first (a dust grave needing Common+ is not "easy"), then the lowest offering, then grave strength
assert.deepStrictEqual(order('easiest', [g(1, { raisable: false, need: 0 }), g(2, { need: 1 }), g(3, { need: 0, af: .5 }), g(4, { need: 0, af: .9 })]), [4, 3, 2, 1]);
assert.deepStrictEqual(order('strongest', [g(1, { power: 5 }), g(2, { power: 50 }), g(3, { power: 7 })]), [2, 3, 1]);
assert.deepStrictEqual(order('gear', [g(1, { gear: 1 }), g(2, { gear: 3 }), g(3, { gear: 1, power: 99 })]), [2, 3, 1]);
assert.deepStrictEqual(order('lived', [g(1, { born: 900 }), g(2, { born: 100 }), g(3, { born: null })]), [2, 1, 3]);
assert.deepStrictEqual(order('id', [g(9), g(2), g(5)]), [2, 5, 9]);
// chip on every grave card + the score file on the page
assert(/'"><\/canvas>' \+ rarChip\(p\) \+ '<h4>/.test(src), 'rarity chip on the grave card');
const ip = html.indexOf('js/pet-score.js'), is = html.indexOf('js/v2-cemetery-scene.js'); assert(ip > 0 && is > ip, 'cemetery.html loads pet-score.js before the scene');
console.log('cemetery-rarity-sort: OK (8 sorts, rarest = rank > 💎 rarity > power, chip on every grave)');
