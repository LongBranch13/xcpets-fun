/* Unique names (gate ACTIVATE_UNIQUE_NAME_BLOCK): old pets keep exact old names and every trait; new pets get v2 names from a separate hash. */
'use strict';
const PC = require('../js/pet-core.js'), G = PC.ACTIVATE_UNIQUE_NAME_BLOCK; let bad = 0;
const ok = (c, m) => { if (!c) { bad++; console.log('FAIL ' + m); } };
const hash = i => require('crypto').createHash('sha256').update('b' + i).digest('hex');
const gen = (i, h) => PC.generate({ blockHash: hash(i), petId: i, blockHeight: h });
const names = new Map(); let old = 0;
for (let i = 1; i <= 10000; i++) {
  const a = gen(i, G - 1), b = gen(i, G), c = gen(i, null);
  ok(a.defaultName === c.defaultName, 'pre-gate name changed #' + i);
  const ka = Object.assign({}, a, { defaultName: 0 }), kb = Object.assign({}, b, { defaultName: 0 });
  ok(JSON.stringify(ka) === JSON.stringify(kb), 'traits shifted #' + i);
  ok(!PC.oldStyle(b.defaultName.toLowerCase()), "old-style " + b.defaultName); ok(!PC.nameBlocked(b.defaultName.toLowerCase()), 'blocked name ' + b.defaultName);
  ok(/^[A-Z][a-z]{3,13}$/.test(b.defaultName), 'odd name ' + b.defaultName);
  names.set(b.defaultName, (names.get(b.defaultName) || 0) + 1);
}
const rep = [...names.values()].reduce((s, v) => s + v - 1, 0);
console.log('10,000 new pets: ' + names.size + ' distinct names, ' + rep + ' repeats, most used ' + Math.max(...names.values()) + ' times');
console.log('sample: ' + [...names.keys()].slice(0, 20).join(', '));
ok(rep < 60, 'too many repeats');
console.log(bad ? bad + ' FAILED' : 'unique-names: all ok');
process.exit(bad ? 1 : 0);
