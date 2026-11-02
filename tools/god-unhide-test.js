#!/usr/bin/env node
/* gmoney-god-1102 tests (Nov 2 2026, UI/localStorage only, no rule change). G Money's God #22043 was a risen zombie in his My Pets
 * (raised 974024, resurrected 974159): zombies eat zombie meals, so lastFed stayed null and '🗑️ Discard unfed' swept it into this
 * browser's Discard pile, where it stayed after the Resurrection.
 *   (1) js/v2-deluncommon.js neverFed / unfed: a risen zombie and a God are never 'unfed' (a plain never-fed pet still is),
 *   (2) js/v2.js godUnhide: a God in the Discard pile comes back to My Pets once per pet; other discards stay; a later discard is kept.
 *   node tools/god-unhide-test.js */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const REPO = path.resolve(__dirname, '..'), rd = f => fs.readFileSync(path.join(REPO, f), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const st = {}, ls = { getItem: k => (k in st ? st[k] : null), setItem: (k, v) => { st[k] = String(v); }, removeItem: k => { delete st[k]; } };
const el = () => ({ style: {}, classList: { add() {}, remove() {}, toggle() {} }, setAttribute() {}, appendChild() {}, querySelectorAll: () => [] });
const win = { console, localStorage: ls, sessionStorage: ls, setTimeout, clearTimeout };
win.document = { readyState: 'complete', getElementById: () => null, createElement: el, head: el(), body: el(), addEventListener() {} };
win.window = win; const ctx = vm.createContext(win);
// (1) Discard unfed
vm.runInContext(rd('js/v2-deluncommon.js'), ctx, { filename: 'js/v2-deluncommon.js' });
const DU = ctx.V2DelUnc; ok(DU && typeof DU.neverFed === 'function' && typeof DU.unfed === 'function', 'V2DelUnc loads');
const plain = { id: 1, owner: 'me', lastFed: null, feedDays: {} }, fed = { id: 2, owner: 'me', lastFed: 900, feedDays: { 6: 1 } };
const zombie = { id: 3, owner: 'me', lastFed: null, feedDays: {}, zombie: { gen: 1, raisedAt: 974024, feralAt: 974582 } };
const god = { id: 22043, owner: 'me', lastFed: null, feedDays: {}, zombie: null, resurrected: { block: 974159, tx: '5e82dba5', cap: 4 } };
const dust = { id: 4, owner: 'me', lastFed: null, feedDays: {}, zombie: { end: { kind: 'dust' } } };
ok(DU.neverFed(plain), 'a plain never-fed pet is still unfed');
ok(!DU.neverFed(fed), 'a fed pet is not unfed');
ok(!DU.neverFed(zombie), 'a risen zombie (zombie meals, lastFed null) is not unfed');
ok(!DU.neverFed(god), 'a God (resurrected) is never unfed');
ok(DU.neverFed(dust), 'an ended zombie record does not count as risen');
const D = { mine: () => [plain, fed, zombie, god, Object.assign({}, plain, { id: 5, dead: true })], world: () => ({}), isKept: () => false };
ok(JSON.stringify(DU.unfed(D).map(p => p.id)) === '[1]', 'Discard unfed picks only the plain never-fed pet (not the zombie, the God or the dead pet)');
// the My Pets never-fed fold agrees on zombies
vm.runInContext(rd('js/v2-habits.js'), ctx, { filename: 'js/v2-habits.js' }); const HB = ctx.V2Habits || (ctx.module && ctx.module.exports);
if (HB && HB.neverFed) ok(!HB.neverFed(zombie) && HB.neverFed(plain), 'habits never-fed fold also keeps risen zombies out');
// (2) godUnhide, taken straight from js/v2.js
const src = rd('js/v2.js'), a = src.indexOf('  function godUnhide(w)'), b = src.indexOf('\n  function keepBtn(id)', a);
ok(a > 0 && b > a, 'godUnhide found in js/v2.js'); ok(/try \{ godUnhide\(w\); \} catch \(e\) \{ \}/.test(src.slice(src.indexOf('  function render() {'), src.indexOf('  function render() {') + 400)), 'render() runs godUnhide before the pet list draws');
const toasts = []; ctx.__toast = h => toasts.push(String(h));
vm.runInContext('var NET = "mainnet", ME = "me"; function toast(h) { __toast(h); } function idList(ids) { return "#" + ids.join(", #"); }\n' +
  'function hidKey() { return "xcpets-hidden-" + NET + "-" + (ME || ""); } function hiddenIds() { try { return JSON.parse(localStorage.getItem(hidKey()) || "[]"); } catch (e) { return []; } }\n' +
  'function setHidden(l) { localStorage.setItem(hidKey(), JSON.stringify(l.filter(function (x, i, a) { return a.indexOf(x) === i; }))); }\n' + src.slice(a, b) + '\nthis.godUnhide = godUnhide; this.hiddenIds = hiddenIds;', ctx);
const HK = 'xcpets-hidden-mainnet-me', other = { id: 7, owner: 'them', resurrected: { block: 1 } }, w = { pets: [plain, zombie, god, other], byId: { 1: plain, 3: zombie, 22043: god, 7: other } };
st[HK] = JSON.stringify([1, 3, 22043, 7]); ctx.godUnhide(w);
ok(JSON.stringify(ctx.hiddenIds()) === '[1,3,7]', 'the God comes back; the plain pet, the zombie and a pet that is not mine stay in the pile');
ok(toasts.length === 1 && /#22043/.test(toasts[0]) && /God/.test(toasts[0]), 'one toast names the God that came back');
st[HK] = JSON.stringify([1, 3, 7, 22043]); toasts.length = 0; ctx.godUnhide(w);
ok(JSON.stringify(ctx.hiddenIds()) === '[1,3,7,22043]' && toasts.length === 0, 'once per pet: a God discarded again on purpose stays in the pile');
for (const k in st) delete st[k]; ctx.godUnhide(w); ok(ctx.hiddenIds().length === 0 && toasts.length === 0, 'empty pile: nothing to do');
ok(!/V2Rules|replay\(/.test(src.slice(a, b)), 'godUnhide is display only (no rules call)');
console.log(`god-unhide: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
