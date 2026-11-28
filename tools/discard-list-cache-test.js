#!/usr/bin/env node
/* DISCARD LIST READ ONCE PER CHANGE (Nov 28 2026). Play-test robot, Evan's 40,000 pets: discarding froze the page ~2-3 s, 2.2 s of it parsing
 * the browser's Discard pile list (localStorage xcpets-hidden-NET-ME) again on every one of hundreds of calls in one redraw. js/v2-own.js
 * (pileIds / pileOrder) and js/v2.js (hiddenIds) now keep the parsed list while the stored text is unchanged. This runs js/v2-own.js with a
 * pretend localStorage: the answer follows every write (this tab or another), a caller can't change the kept copy, and the parse is skipped
 * when nothing changed.   node tools/discard-list-cache-test.js */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };
const store = {}, ls = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
let parses = 0; const J = { parse: s => { parses++; return JSON.parse(s); }, stringify: JSON.stringify };
const root = { localStorage: ls, LiveEngine: { CFG: { network: 'mainnet' } }, JSON: J };
root.window = root; vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'js/v2-own.js'), 'utf8'), Object.assign(root, { JSON: J }));
const O = root.V2Own, ME = 'bc1qme', K = 'xcpets-hidden-mainnet-' + ME;
ok(!!(O && O.pileIds), 'V2Own.pileIds exists');
ok(Object.keys(O.pileIds(ME)).length === 0, 'empty pile');
ls.setItem(K, JSON.stringify([5, 7, '9']));
ok(JSON.stringify(Object.keys(O.pileIds(ME)).map(Number).sort((a, b) => a - b)) === '[5,7,9]', 'a write shows at once');
parses = 0; for (let i = 0; i < 200; i++) O.pileIds(ME); ok(parses === 0, '200 reads with no change parse nothing (' + parses + ')');
ls.setItem(K, JSON.stringify([5])); /* another tab or this one */
ok(JSON.stringify(Object.keys(O.pileIds(ME))) === '["5"]', 'a changed list is read again');
const h = O.pileIds(ME); h[99] = 1; ok(!O.pileIds(ME)[99], 'a caller changing its answer does not change the kept list');
ok(Object.keys(O.pileIds('bc1qother')).length === 0, 'another wallet has its own list');
const v2 = fs.readFileSync(path.join(ROOT, 'js/v2.js'), 'utf8');
ok(/function hiddenIds\(\)[^\n]*hidC\.raw !== raw[^\n]*hidC\.a\.slice\(\)/.test(v2), 'js/v2.js hiddenIds keeps its parse the same way (a copy each call)');
console.log('discard-list-cache: ' + (fail ? fail + ' failure(s)' : 'all good'));
process.exit(fail ? 1 : 0);
