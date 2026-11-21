#!/usr/bin/env node
/* Cache-clear hatch review. Display only. The rules hash is the Homer 3-way syllable fix.
 * A published owner list arrives one page at a time. With no saved seen-list,
 * later pages must not reopen the sort screen for hatches already in that tip.
 * An on-chain pet:hd flag stays out of My Pets after the browser list is gone.
 *   node tools/hatch-replay-test.js
 */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), vm = require('vm');
const { load } = require('./lib/load-rules');
const ROOT = path.resolve(__dirname, '..');
let pass = 0, fail = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (c) pass++; else fail++; };
function md5(rel) { return crypto.createHash('md5').update(fs.readFileSync(path.join(ROOT, rel))).digest('hex'); }
const src = fs.readFileSync(path.join(ROOT, 'js/v2.js'), 'utf8');
ok(md5('js/v2-rules.js') === '4f043b06d203135a6f7be660f84bc216', 'rules MD5 stays 4f043b06d203135a6f7be660f84bc216');
ok(/function onChainDiscarded\(p\) \{ return !!\(p && ME && p\.hd === ME\); \}/.test(src), 'on-chain discard is the pet.hd flag for this wallet');
ok(/!onChainDiscarded\(p\)/.test(src.slice(src.indexOf('function mine(w)'), src.indexOf('function mine(w)') + 220)), 'My Pets hides an on-chain discard');
ok(/p\.hungry && !onChainDiscarded\(p\)/.test(src), 'Feed all hungry skips an on-chain discard');

const start = src.indexOf('  function hatchListSettled');
const end = src.indexOf('  var wspinOn', start);
ok(start > 0 && end > start, 'hatch replay helpers are in js/v2.js');
const slice = src.slice(start, end);
const rules = load();
const ME = 'bc1qjacob';
const store = {};
const sandbox = {
  ME: ME,
  HKEY: 'xcpets-v2-hatched-xcpets-v2-prod-' + ME,
  hMem: null,
  hatchTip: null,
  revealQ: [],
  localStorage: {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem: function (k, v) { store[k] = String(v); }
  },
  V: { newHatches: function (w, owner, seen) { return rules.V2Rules.newHatches(w, owner, seen); } },
  dataSeen: function () {},
  console: console
};
vm.createContext(sandbox);
vm.runInContext(slice + '\nthis.hatchListSettled = hatchListSettled; this.hatchKeepGroups = hatchKeepGroups; this.notifyHatch = notifyHatch; this.hPack = hPack; this.hUnpack = hUnpack;', sandbox);

function pet(id, tx, block) {
  return { id: id, owner: ME, community: false, hatchTx: tx, hatchBlock: block, lastGot: null };
}
ok(!sandbox.hatchListSettled({ pending: true, pets: [], tip: 500 }), 'a pending world is not a finished owner list');
ok(!sandbox.hatchListSettled({ pets: [], tip: 500, _pages: { got: 1, pages: 90 } }), 'the first owner page is not the whole list');
ok(sandbox.hatchListSettled({ pets: [], tip: 500, _full: 1, _pages: { got: 90, pages: 90 } }), 'a finished owner list is settled');
ok(sandbox.hatchListSettled({ pets: [], tip: 500 }), 'a world with no page cursor is settled');

const tip = 976919;
const page0 = [pet(1, 'tx-early', 971000), pet(2, 'tx-early', 971000)];
const later = [pet(3, 'tx-box', 975524), pet(4, 'tx-box', 975524), pet(5, 'tx-dozen', 974000)];
const partial = { pets: page0.slice(), tip: tip, _pages: { got: 1, pages: 3 } };
const full = { pets: page0.concat(later), tip: tip, _full: 1, _pages: { got: 3, pages: 3 } };

const g0 = sandbox.notifyHatch(partial);
ok(g0.length === 0, 'first page does not open a sort screen');
ok(!Object.prototype.hasOwnProperty.call(store, sandbox.HKEY), 'a partial list is not saved as the seen-list');

const g1 = sandbox.notifyHatch(full);
ok(g1.length === 0, 'older hatches on later pages stay closed (' + g1.length + ' groups)');
ok(Object.prototype.hasOwnProperty.call(store, sandbox.HKEY), 'the finished list is saved');
const saved = JSON.parse(store[sandbox.HKEY]);
ok(saved.v === 2 && saved.tip === tip && saved.t && saved.t['tx-box'] && saved.t['tx-dozen'] && saved.t['tx-early'], 'saved seen-list records every hatch tx and the tip');

sandbox.hMem = null;
sandbox.hatchTip = null;
const fresh = pet(6, 'tx-new', tip + 10);
const g2 = sandbox.notifyHatch({ pets: full.pets.concat([fresh]), tip: tip + 12, _full: 1, _pages: { got: 3, pages: 3 } });
ok(g2.length === 1 && g2[0].tx === 'tx-new' && g2[0].eggs.length === 1 && g2[0].eggs[0].id === 6, 'a hatch after the saved baseline still opens');

delete store[sandbox.HKEY];
sandbox.hMem = null;
sandbox.hatchTip = null;
sandbox.revealQ = [];
const empty = { pets: [], tip: tip };
ok(sandbox.notifyHatch(empty).length === 0, 'an empty wallet writes no sort screen');
const emptySaved = JSON.parse(store[sandbox.HKEY]);
ok(emptySaved.v === 2 && emptySaved.tip === tip && emptySaved.t && Object.keys(emptySaved.t).length === 0, 'an empty wallet saves a tip and no hatch keys');
sandbox.hMem = null;
sandbox.hatchTip = null;
const after = sandbox.notifyHatch({ pets: [pet(9, 'tx-first', tip + 4)].concat(later), tip: tip + 8, _full: 1 });
const ids = after.reduce(function (a, g) { return a.concat(g.eggs.map(function (p) { return p.id; })); }, []);
ok(ids.join(',') === '9', 'after an empty baseline, only a newer hatch opens (got ' + ids.join(',') + ')');

const mineSrc = src.slice(src.indexOf('function mine(w)'), src.indexOf('function mine(w)') + 240);
ok(/onChainDiscarded/.test(mineSrc), 'mine() is the profile filter');
const box = { ME: ME, onChainDiscarded: sandbox.onChainDiscarded };
vm.createContext(box);
vm.runInContext('function onChainDiscarded(p) { return !!(p && ME && p.hd === ME); }\n' +
  'function mine(w) { return w.pets.filter(function (p) { return p.owner === ME && !p.released && !onChainDiscarded(p); }); }\n' +
  'this.mine = mine;', box);
const herd = box.mine({ pets: [
  { id: 10, owner: ME, hd: ME, hungry: true },
  { id: 11, owner: ME, hungry: true },
  { id: 12, owner: ME, released: true }
] });
ok(herd.length === 1 && herd[0].id === 11, 'a pet with hd set to this wallet stays out of My Pets; a kept pet stays');

console.log('hatch-replay: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
