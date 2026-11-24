#!/usr/bin/env node
/* V2Own (js/v2-own.js): one "my living pets" answer for the gift, swap, sell, Rug Me, dress-up, My Pets header and cemetery pickers.
 *   - the same rule the old inline filters wrote (owner, not dead, not released, not the community pet),
 *   - zombies: in by default, out with { zombies: false } (the cemetery scene's list),
 *   - no page file writes the old inline filter again, and every page that loads one of those files loads v2-own.js first.
 *   node tools/own-living-test.js */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..'), rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
let fails = 0, n = 0; const ok = (c, m) => { n++; console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const ctx = vm.createContext({}); ctx.self = ctx; vm.runInContext(rd('js/v2-own.js'), ctx); const O = ctx.V2Own;
ok(O && typeof O.living === 'function' && typeof O.isLiving === 'function', 'js/v2-own.js exports V2Own.living / isLiving');
const pets = [{ id: 1, owner: 'a' }, { id: 2, owner: 'a', dead: true }, { id: 3, owner: 'a', released: true }, { id: 4, owner: 'a', community: true },
  { id: 5, owner: 'b' }, { id: 6, owner: 'a', zombie: { gen: 1 } }, { id: 7, owner: 'a', dead: true, zombie: { end: { kind: 'dust' } } }, { id: 8, owner: 'a', zombie: { end: { kind: 'resurrected' } } }];
const w = { pets }, ids = l => l.map(p => p.id).join(',');
ok(ids(O.living(w, 'a')) === '1,6,8', 'living: alive, own, not released, not community; zombies in (' + ids(O.living(w, 'a')) + ')');
ok(ids(O.living(w, 'a', { zombies: false })) === '1,8', 'living without zombies: a Resurrected pet stays (' + ids(O.living(w, 'a', { zombies: false })) + ')');
ok(O.living(null, 'a').length === 0 && O.living(w, null).length === 0 && !O.isLiving(pets[0], ''), 'no world or no wallet: nothing');
/* no copies left, and the script is loaded where it is used */
const FILES = ['js/v2-cemetery-scene.js', 'js/v2-gift.js', 'js/v2-look-picker.js', 'js/v2-mypets-top.js', 'js/v2-rugme.js', 'js/v2-sales.js'];
const COPY = /owner === (ME|me) && !p\.dead && !p\.released && !p\.community/;
FILES.forEach(f => ok(!COPY.test(rd(f)) && /V2Own\./.test(rd(f)), f + ' asks V2Own (no inline copy)'));
const pages = fs.readdirSync(ROOT).filter(f => f.endsWith('.html')).concat(['templates/game.html']);
const bad = pages.filter(f => { const s = rd(f), i = s.indexOf('js/v2-own.js'); return FILES.some(u => { const j = s.indexOf(u); return j >= 0 && (i < 0 || i > j); }); });
ok(bad.length === 0, 'every page loading one of those files loads js/v2-own.js before it' + (bad.length ? ' (not: ' + bad.join(', ') + ')' : ''));
console.log(`own-living: ${n - fails} passed, ${fails} failed`); process.exit(fails ? 1 : 0);
