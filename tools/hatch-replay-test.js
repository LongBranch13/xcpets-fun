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
ok(md5('js/v2-rules.js') === require('./lib/rules-pin').pin('js/v2-rules.js'), 'rules MD5 stays pinned');
/* run the real onChainDiscarded / inPile / mine (not their source text): a risen zombie's old hd flag does not count (inPile rule) */
const pileFns = ['function onChainDiscarded(p)', 'function inPile(p, h)', 'function mine(w)'].map(k => { const i = src.indexOf('  ' + k); return i < 0 ? '' : src.slice(i, src.indexOf('\n', i) + 1); }).join('');
const pileBox = vm.createContext({ ME: 'bc1qme', ZB: p => !!(p && p.zombie && !p.zombie.end), hiddenSet: () => new Set([5]) });
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/v2-own.js'), 'utf8'), pileBox); vm.runInContext(pileFns + 'this.F = { onChainDiscarded, mine };', pileBox); /* v2-own first, as on the pages */
const PF = pileBox.F || {}, pp = (id, o) => Object.assign({ id, owner: 'bc1qme' }, o || {});
ok(PF.onChainDiscarded && PF.onChainDiscarded(pp(1, { hd: 'bc1qme' })) && !PF.onChainDiscarded(pp(2, { hd: 'bc1qother' })) && !PF.onChainDiscarded(pp(3)) && !PF.onChainDiscarded(pp(4, { hd: 'bc1qme', zombie: {} })), 'on-chain discard is the pet.hd flag for this wallet');
ok(PF.mine && PF.mine({ pets: [pp(1, { hd: 'bc1qme' }), pp(2), pp(4, { hd: 'bc1qme', zombie: {} }), pp(5), pp(6, { released: true }), pp(7, { owner: 'x' })] }).map(p => p.id).join() === '2,4', 'My Pets hides an on-chain discard');
ok(/p\.hungry && !V2Own\.discarded\(p, ME, dz\)/.test(src), 'Feed all hungry skips a discarded pet (on chain, browser pile or still confirming: V2Own.discarded; behaviour in tools/discard-one-answer-test.js)');

const start = src.indexOf('  function hatchListSettled');
const end = src.indexOf('  var wspinOn', start);
ok(start > 0 && end > start, 'hatch replay helpers are in js/v2.js');
const slice = src.slice(start, end);
const rules = load();
const ME = 'bc1qjacob';
const store = {};
const sandbox = {
  ME: ME,
  KEY: 'xcpets-v2-prod',
  hiddenSet: function () { return new Set(); },
  inPile: function () { return false; },
  HKEY: 'xcpets-v2-hatched-xcpets-v2-prod-' + ME,
  hMem: null,
  hatchTip: null,
  revealQ: [],
  localStorage: {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem: function (k, v) { store[k] = String(v); },
    removeItem: function (k) { delete store[k]; }
  },
  V: { newHatches: function (w, owner, seen) { return rules.V2Rules.newHatches(w, owner, seen); } },
  dataSeen: function () {},
  rev: null,
  $: function () { return { classList: { contains: function () { return false; } } }; },
  console: console
};
vm.createContext(sandbox);
vm.runInContext(slice + '\nthis.hatchListSettled = hatchListSettled; this.hatchKeepGroups = hatchKeepGroups; this.notifyHatch = notifyHatch; this.hPack = hPack; this.hUnpack = hUnpack;', sandbox);
/* hatch-tray-1124: away hatches go to the calm tray (no DOM here, so record them) */
let trayGot = [];
sandbox.trayAdd = function (ids) { trayGot = trayGot.concat(ids); };

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
ok(sandbox.revealQ.length === 1 && sandbox.revealQ[0].eggs.join(',') === '6' && trayGot.length === 0, 'a hatch that lands while the page is open gets the live review, not the tray');

/* hatch-tray-1124 (owner Nov 24 2026: one Shock Box showed as 47, then 353, then 600). A saved baseline + a wallet arriving in pages:
 * nothing is counted until the list settles, then ONE away batch goes to the tray, no automatic review. */
{
  const base = { pets: page0.slice(), tip: tip, _full: 1 };
  sandbox.hMem = null; sandbox.hatchTip = null; sandbox.revealQ = []; trayGot = [];
  delete store[sandbox.HKEY]; sandbox.notifyHatch(base);
  const boxEggs = []; for (let i = 0; i < 9; i++) boxEggs.push(pet(100 + i, 'tx-zap', tip + 2));
  const ctx2 = vm.createContext(Object.assign({}, sandbox, { revealQ: [], hMem: null, hatchTip: null }));
  vm.runInContext(slice + '\nthis.notifyHatch = notifyHatch;', ctx2); ctx2.trayAdd = function (ids) { ctx2.__tray = (ctx2.__tray || []).concat([ids]); };
  const P = n => ({ pets: page0.concat(boxEggs.slice(0, n)), tip: tip + 6, _pages: { got: n < 9 ? 1 : 3, pages: 3 }, _full: n < 9 ? 0 : 1 });
  ctx2.notifyHatch(P(2)); ctx2.notifyHatch(P(5));
  ok(!ctx2.__tray && ctx2.revealQ.length === 0, 'pages still arriving: no tray, no review yet');
  ctx2.notifyHatch(P(9));
  /* box-reveal-1124 (GMONEY via owner: 'the egg boxes dont pop up to preview like before'): the away batch opens ONE box reveal again (no egg-crack animation), not the tray */
  ok(!ctx2.__tray && ctx2.revealQ.length === 1 && ctx2.revealQ[0].eggs.length === 9 && ctx2.revealQ[0].away === 1 && ctx2.revealQ[0].hatchAnim === 1, 'the settled list opens ONE box reveal of all 9 eggs (away, no crack animation), not the tray');
  ctx2.notifyHatch(P(9));
  ok(ctx2.revealQ.length === 1 && ctx2.revealQ[0].eggs.length === 9, 'a second look adds nothing (still one reveal of 9)');
}
/* box-reveal-1124: a wallet still loading pages after the 90 s cap. Before, hSessTip was never set, so a hatch that landed while you watched went to the tray. */
{
  const base = { pets: page0.slice(), tip: tip, _full: 1 };
  sandbox.hMem = null; sandbox.hatchTip = null; delete store[sandbox.HKEY]; sandbox.notifyHatch(base);
  const ctx3 = vm.createContext(Object.assign({}, sandbox, { revealQ: [], hMem: null, hatchTip: null }));
  vm.runInContext(slice + '\nthis.notifyHatch = notifyHatch; this.setDefer = function (t) { hDefer0 = t; };', ctx3); ctx3.trayAdd = function (ids) { ctx3.__tray = (ctx3.__tray || []).concat([ids]); };
  const slow = extra => ({ pets: page0.concat(extra), tip: tip + (extra.length ? 9 : 6), _pages: { got: 1, pages: 40 } });
  ctx3.notifyHatch(slow([])); ctx3.setDefer(Date.now() - 26000); ctx3.notifyHatch(slow([]));
  ctx3.notifyHatch(slow([pet(300, 'tx-live', tip + 9)]));
  ok(!ctx3.__tray && ctx3.revealQ.length === 1 && ctx3.revealQ[0].eggs.join(',') === '300' && !ctx3.revealQ[0].away, 'past the 25 s cap, a hatch you watch land is live (egg crack + reveal), not the tray');
}

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
ok(/inPile\(p, h\)|onChainDiscarded/.test(mineSrc), 'mine() is the profile filter');
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
