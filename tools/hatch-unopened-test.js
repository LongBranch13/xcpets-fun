#!/usr/bin/env node
'use strict';
/* Shock Box reveal guard (Nov 25 2026, Jake: 3 Shock Boxes in one block, no pop-up, no pill; Select all froze the page).
 * Fast checks, no browser. The full-scale browser flow is tools/hatch-flow-e2e.js.
 *  1. js/v2-verify-worker.js keeps the look (art) of every pet that was not this wallet's in the published world (new hatches, pets that
 *     came in later). Without it the hatch review crashed on the new eggs after they were already marked seen.
 *  2. The 'unopened' list in js/v2.js packs ids into ranges and reads them back exactly (60,000 cap), so a missed reveal comes back as the pill.
 *  3. The hatch review never throws (drawReveal wraps drawReveal0) and skips eggs without a look (they go to the pill).
 *  4. A selection change in My Pets never plans Auto-equip with V2Rules.autoEquipOps (2+ s per tick on 3,000 selected pets). */
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const ROOT = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
let ok = 0; const t = (name, fn) => { fn(); ok++; console.log('ok', name); };

const worker = read('js/v2-verify-worker.js');
t('verify worker remembers who owned what in the published world before replaying', () => {
  const iSnap = worker.indexOf('pubOwner[pw[pj].id] = pw[pj].owner'), iReplay = worker.indexOf('world = self.V2Rules.replay(');
  assert(iSnap > 0 && iReplay > iSnap, 'pubOwner must be taken from the decoded world before the replay changes it');
});
t('verify worker keeps art for pets that were not this wallet\'s in the published world', () => {
  const m = /var needArt = ([^;]+);\s*for \(pi = 0; pi < pk\.length; pi\+\+\) if \(([^)]+)\) c\[pk\[pi\]\] = p\[pk\[pi\]\];/.exec(worker);
  assert(m, 'the mine copy loop must decide per pet whether art goes along');
  const keep = new Function('pubOwner', 'p', 'meAddr', 'pk', 'var needArt = ' + m[1] + ', c = [], pi; for (pi = 0; pi < pk.length; pi++) if (' + m[2] + ') c.push(pk[pi]); return c;');
  const me = 'bc1qme', pk = ['id', 'owner', 'art', 'hatchTx'];
  assert.deepStrictEqual(keep({ 5: me }, { id: 5 }, me, pk), ['id', 'owner', 'hatchTx'], 'a pet the page already has keeps the slim copy');
  assert.deepStrictEqual(keep({}, { id: 9 }, me, pk), pk, 'a new hatch carries its art');
  assert.deepStrictEqual(keep({ 7: 'bc1qother' }, { id: 7 }, me, pk), pk, 'a pet that came in from another wallet carries its art');
});
t('the verify worker cache token was bumped with the change', () => {
  assert(/v2-verify-worker\.js\?v=[\w.-]+/.test(read('js/v2-split.js')), 'bump the ?v= of the worker URL in js/v2-split.js');
});

const v2 = read('js/v2.js');
function grab(name) { const i = v2.indexOf('function ' + name + '('); assert(i > 0, name); let d = 0, j = v2.indexOf('{', i);
  for (; j < v2.length; j++) { if (v2[j] === '{') d++; else if (v2[j] === '}' && --d === 0) break; } return v2.slice(i, j + 1); }
t('unopened list: ranges round-trip, add and remove', () => {
  const store = {}; const ctx = { localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } }, ME: 'bc1qme', JSON, Set, Number, String };
  vm.createContext(ctx);
  vm.runInContext("var UKEY = 'u', U_MAX = 60000;\n" + grab('uRead') + '\n' + grab('uWrite') + '\n' + grab('uAdd') + '\n' + grab('uDel'), ctx);
  const ids = []; for (let i = 208298; i < 208298 + 3000; i++) ids.push(i); ids.push(5, 7, 6, 99999);
  ctx.uAdd(ids);
  assert(store.u.length < 80, 'three boxes of 1,000 eggs pack into a few ranges, not 3,000 numbers: ' + store.u.length);
  assert.strictEqual(JSON.stringify(ctx.uRead().sort((a, b) => a - b)), JSON.stringify(ids.slice().sort((a, b) => a - b)));
  ctx.uAdd([5, 208300]); assert.strictEqual(ctx.uRead().length, ids.length, 'adding again changes nothing');
  ctx.uDel(ids.slice(0, 1000)); assert.strictEqual(ctx.uRead().length, ids.length - 1000);
  ctx.uDel(ctx.uRead()); assert(!('u' in store), 'empty list is removed');
  store.u = "not json"; assert.strictEqual(ctx.uRead().length, 0, "a broken value reads as empty");
});
t('the hatch review never throws and skips eggs without a look', () => {
  assert(/function drawReveal\(\) \{ try \{ drawReveal0\(\); \} catch \(e\)/.test(v2), 'drawReveal must wrap drawReveal0');
  assert(/revReady\(rev\); if \(!rev\.eggs\.length\)/.test(v2), 'nextReveal must drop eggs without art before opening');
  assert(/function revReady\(r\)[^]*?x && x\.art[^]*?trayAdd\(bad\)/.test(v2), 'eggs without a look go to the pill');
});
t('eggs leave the unopened list only when the review is closed or the pill dismissed (Later keeps them)', () => {
  assert(/function closeReveal\(\) \{ if \(rev && rev\.kind === 'eggs'\) uDel\(/.test(v2));
  assert(/function packExit\(then\) \{ if \(rev && rev\.kind === 'eggs'\) uDel\(/.test(v2));
  assert(/\.htx'\)\) \{ if \(tray\) uDel\(tray\.eggs\)/.test(v2));
  assert(!/pkiLater'\)\.onclick = function \(\) \{[^}]*uDel/.test(v2), 'Later must not forget the eggs');
  assert(/uAdd\(away\.concat\(live\)\)/.test(v2), 'every new egg is remembered as unopened');
  assert(/if \(counted\) uRestore\(w\);/.test(v2), 'unopened eggs come back as the pill on every settled look');
});
t('3 boxes in one reveal say 3 boxes', () => {
  assert(/nBox \+ ' Shock Boxes opened!'/.test(v2) && /nBox \+ ' boxes'/.test(v2));
});
t('My Pets selection never plans Auto-equip with the slow rules planner', () => {
  const ux = read('js/ux-batch.js');
  assert(!/V2LairQoL\.autoEquipOps : V\.autoEquipOps/.test(ux), 'ux-batch must not fall back to V2Rules.autoEquipOps on every selection change');
});
console.log(ok + ' checks passed');
