#!/usr/bin/env node
/* Root fix (Nov 24 2026, Jake: "why do zombies keep disappearing"). Display/localStorage only, no rule change.
 * Zombies vanished from My Pets because a discard outlived the pet's life, and each discard button had its own idea of what may go:
 *   (1) js/v2.js discardIds: the ONE place every discard path ends refuses risen zombies (the rules refuse pet:hd for zombies too),
 *   (2) js/v2.js mine()/inPile(): a risen zombie is never hidden, neither by this browser's pile nor by an old on-chain discard flag
 *       left from before it died (raising your own discarded grave kept hd = you),
 *   (3) one 'never fed' answer: V2Habits.neverFed, which Discard unfed (v2-deluncommon) and Clear the pile ask too.
 *   node tools/zombie-discard-test.js */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const REPO = path.resolve(__dirname, '..'), rd = f => fs.readFileSync(path.join(REPO, f), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const src = rd('js/v2.js');
const cut = (from, to) => { const a = src.indexOf(from), b = src.indexOf(to, a + 1); if (a < 0 || b < 0) throw new Error('not found: ' + from); return src.slice(a, b); };
const st = {}, ls = { getItem: k => (k in st ? st[k] : null), setItem: (k, v) => { st[k] = String(v); }, removeItem: k => { delete st[k]; } };
const el = () => ({ style: {}, classList: { add() {}, remove() {}, toggle() {} }, setAttribute() {}, appendChild() {}, querySelectorAll: () => [] });
const win = { console, localStorage: ls, sessionStorage: ls, setTimeout, clearTimeout }; win.window = win;
win.document = { readyState: 'complete', getElementById: () => null, createElement: el, head: el(), body: el(), addEventListener() {} }; const ctx = vm.createContext(win);
const toasts = [], hidden = []; ctx.__toast = h => toasts.push(String(h)); ctx.__hide = ids => hidden.push(...ids);
vm.runInContext([
  'var NET = "mainnet", ME = "me", W = null; function world() { return W; } function toast(h) { __toast(h); } function idList(ids) { return "#" + ids.join(", #"); }',
  'function keptIds() { return [9]; } function hideLocal(ids) { __hide(ids); }',
  src.slice(src.indexOf('  function ZB(p)'), src.indexOf('\n', src.indexOf('  function ZB(p)'))),
  cut('  function hidKey()', '\n  function setHidden('),
  cut('  function hiddenSet()', '\n  function sel()'),
  cut('  function discardIds(ids)', '\n  function hiddenSet()'),
  'this.setW = function (w) { W = w; }; this.mine = mine; this.inPile = inPile; this.discardIds = discardIds; this.hiddenSet = hiddenSet;'
].join('\n'), ctx);
/* since root cause #4 (Nov 24 2026) the discard rules live in js/v2-sac-guard.js (V2SacGuard.split): load it, with the star list above */
ctx.V2UI = { isKept: id => +id === 9 }; vm.runInContext(rd('js/v2-sac-guard.js'), ctx);

const plain = { id: 1, owner: 'me', lastFed: null, feedDays: {} };
const zombie = { id: 3, owner: 'me', lastFed: null, feedDays: {}, zombie: { gen: 1, raisedAt: 977000 } };
const zOldHd = { id: 4, owner: 'me', hd: 'me', zombie: { gen: 1, raisedAt: 977100 } }; /* discarded on chain, died, raised by the same owner */
const dusted = { id: 5, owner: 'me', hd: 'me', dead: true, zombie: { end: { kind: 'dust' } } };
const hdLiving = { id: 6, owner: 'me', hd: 'me' };
const starred = { id: 9, owner: 'me' };
const w = { pets: [plain, zombie, zOldHd, dusted, hdLiving, starred], byId: {} }; w.pets.forEach(p => { w.byId[p.id] = p; }); ctx.setW(w);

// (1) the discard chokepoint
ctx.discardIds([1, 3, 9]);
ok(JSON.stringify(hidden) === '[1]', 'discardIds hides the plain pet only (zombie and starred skipped), got ' + JSON.stringify(hidden));
ok(toasts.some(t => /#3/.test(t) && /zombies are never discarded/.test(t)), 'one toast says the zombie was skipped and why');
ok(toasts.some(t => /#9/.test(t) && /starred/.test(t)), 'starred pets still skipped as before');
hidden.length = 0; toasts.length = 0; ctx.discardIds(['3']);
ok(hidden.length === 0 && toasts.length === 1, 'a string id (#discard-ID link) for a zombie is refused too');

// (2) mine(): who is in the pile
st['xcpets-hidden-mainnet-me'] = JSON.stringify([1, 3]);
const ids = ctx.mine(w).map(p => p.id).sort((a, b) => a - b);
ok(JSON.stringify(ids) === '[3,4,9]', 'My Pets keeps both zombies (browser pile + old on-chain flag); hides the discarded plain pet and the on-chain discarded pets (living, dust); got ' + JSON.stringify(ids));
ok(!ctx.inPile(zombie, ctx.hiddenSet()) && !ctx.inPile(zOldHd, ctx.hiddenSet()), 'inPile: a risen zombie is never in the pile');
ok(ctx.inPile(dusted, ctx.hiddenSet()), 'a zombie that turned to dust follows the normal rule again');
ok(ctx.inPile(hdLiving, ctx.hiddenSet()) && ctx.inPile(plain, ctx.hiddenSet()), 'inPile: normal discards still count');

// the pile box and the on-chain list use the same rule
/* since PR 295 (Nov 25 2026) the box lists V2Own.pileList (browser pile + living on-chain discards): run it, don't pin v2.js text */
vm.runInContext(rd('js/v2-own.js'), ctx);
const box = ctx.V2Own.pileList(w, 'me', ctx.hiddenSet(), false).map(p => p.id).sort((a, b) => a - b), graves = ctx.V2Own.pileList(w, 'me', ctx.hiddenSet(), true).map(p => p.id);
ok(JSON.stringify(box) === '[1,6]' && JSON.stringify(graves) === '[]', 'the Discard pile box leaves risen zombies out (living ' + JSON.stringify(box) + ', graves ' + JSON.stringify(graves) + ')');
ok(/V2Own\.pileList\(/.test(src), 'the Discard pile box in js/v2.js reads V2Own.pileList'); // stale-pin-ok: the box must ask the one shared list, not its own copy
ok(/onChainDiscarded\(p\) && !p\.dead && !p\.released/.test(src), 'the "make permanent / add back" list uses onChainDiscarded (zombie-aware)');
ok(/hideLocal\(ids\)/.test(cut('  function discardIds(ids)', '\n  function hiddenSet()')) && (src.match(/hideLocal\(/g) || []).length === 2, 'hideLocal is only called from discardIds (one chokepoint)');

// (3) one 'never fed' answer
vm.runInContext(rd('js/v2-habits.js'), ctx, { filename: 'js/v2-habits.js' });
vm.runInContext(rd('js/v2-deluncommon.js'), ctx, { filename: 'js/v2-deluncommon.js' });
const HB = ctx.V2Habits, DU = ctx.V2DelUnc; ok(HB && DU, 'habits + Discard unfed load');
const god = { id: 7, owner: 'me', lastFed: null, feedDays: {}, resurrected: { block: 1 } }, oldFed = { id: 8, owner: 'me', lastFed: null, feedDays: { 3: 1 } };
[plain, zombie, god, oldFed, { id: 10, lastFed: 5 }].forEach(p => ok(HB.neverFed(p) === DU.neverFed(p), 'My Pets chip and Discard unfed agree on #' + p.id));
ok(HB.neverFed(plain) && !HB.neverFed(zombie) && !HB.neverFed(god) && !HB.neverFed(oldFed), 'never fed: plain yes; zombie, God, pet with feed days no');
ok(/V2DelUnc\.neverFed/.test(rd('js/v2-clear-pile.js')), 'Clear the pile asks the same function');

console.log(`zombie-discard: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
