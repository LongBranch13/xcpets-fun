#!/usr/bin/env node
/* favorite-star tests (Oct 30 2026, UI/localStorage only, owner "yes and yes"):
 *   (1) feeding a pet from this browser stars it (keepFed on every feed burn shape + once-per-pet autoStarBackfill),
 *   (2) starred pets are never discarded (discardIds / dropKept, and every discard path checks the star).
 * The star functions are taken straight from js/v2.js and run against the real V2Rules tags.   node tools/favorite-star-test.js */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const REPO = path.resolve(__dirname, '..'), rd = f => fs.readFileSync(path.join(REPO, f), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const st = {}, ls = { getItem: k => (k in st ? st[k] : null), setItem: (k, v) => { st[k] = String(v); }, removeItem: k => { delete st[k]; } };
const toasts = [], hidden = [];
const win = { console: { log() {}, warn() {}, error() {}, info() {} }, localStorage: ls, sessionStorage: ls, location: { search: '', hostname: 'xcpets.fun', href: 'https://xcpets.fun/' }, navigator: { userAgent: 'node' }, setTimeout, clearTimeout, TextEncoder, TextDecoder };
win.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ getContext: () => null, style: {} }), addEventListener() {}, body: null, documentElement: { style: {} } };
win.addEventListener = () => {}; win.window = win; win.self = win; win.globalThis = win;
const ctx = vm.createContext(win); for (const f of ['js/pet-core.js', 'js/bonus-gear.js', 'js/v2-gear.js', 'js/v2-fit.js', 'js/v2-rules.js']) vm.runInContext(rd(f), ctx, { filename: f });
const V = ctx.V2Rules, src = rd('js/v2.js');
const a = src.indexOf('  function keepKey()');
const endDisc = src.indexOf('\n', src.indexOf('hideLocal(ids); }', src.indexOf('  function discardIds(ids)')));
ok(a > 0 && endDisc > a, 'star block found in js/v2.js');
ctx.__toast = (h) => toasts.push(String(h)); ctx.__hide = (ids) => hidden.push.apply(hidden, ids);
vm.runInContext('var NET = "mainnet", ME = "bc1qme", V = V2Rules, S = {}; function $() { return { value: "" }; } function render() { } function toast(h) { __toast(h); } function fmt(n) { return String(n); } function idList(ids) { return "#" + ids.join(", #"); } function hideLocal(ids) { __hide(ids); }\n' + src.slice(a, endDisc) + '\nthis.T = { keepKey, keptIds, isKept, toggleKeep, keepFed, autoStarBackfill, dropKept, discardIds };', ctx, { filename: 'js/v2.js (star block)' });
const T = ctx.T, KK = 'xcpets-keep-mainnet-bc1qme', kept = () => JSON.parse(st[KK] || '[]').map(Number).sort((x, y) => x - y), reset = () => { for (const k in st) delete st[k]; toasts.length = 0; hidden.length = 0; };
// key: the same browser-only list older builds used
ok(T.keepKey() === KK, 'keep key is xcpets-keep-<net>-<addr>');
// (1) feed auto-star
reset(); ok(T.keepFed('pet:feed:5') === 1 && JSON.stringify(kept()) === '[5]', 'pet:feed:ID stars the pet');
ok(T.keepFed('pet:feed:5') === 0 && JSON.stringify(kept()) === '[5]', 'feeding a starred pet again adds nothing');
reset(); const fp = V.feedPlan([3, 4, 9, 12, 13].map(id => ({ id, nextMeal: 0.5 })));
let n = 0; fp.forEach(q => { n += T.keepFed(q.tag, q); }); ok(n === 5 && JSON.stringify(kept()) === '[3,4,9,12,13]', 'bundled list burns (' + fp.map(q => q.tag).join(' ') + ') star every fed pet');
reset(); ok(T.keepFed('pet:fr:0a:3-7', { tag: 'pet:fr:0a:3-7', petIds: [3, 4, 5, 6, 7], runs: true }) === 5 && JSON.stringify(kept()) === '[3,4,5,6,7]', 'Feed selected / Feed all run burn (pet:fr) stars the ids on the plan');
reset(); ok(T.keepFed('pet:fa', { tag: 'pet:fa', petIds: [8, 2] }) === 2 && JSON.stringify(kept()) === '[2,8]', 'feed-all burn (pet:fa) stars the fed pets');
reset(); ok(T.keepFed('pet:sk:1', { tag: 'pet:sk:1', petIds: [1], setOnly: true }) === 0 && !kept().length, 'a skip-list burn (setOnly) stars nothing');
reset(); ok(T.keepFed('pet:breed:1:2', { tag: 'pet:breed:1:2', petIds: [1, 2] }) === 0 && !kept().length, 'non-feed burns star nothing');
// backfill: every fed living pet of mine, once; an un-star later is respected
reset(); const w = { pets: [{ id: 1, owner: 'bc1qme', lastFed: 970000 }, { id: 2, owner: 'bc1qme', lastFed: null, feedDays: { 5: 1 } }, { id: 3, owner: 'bc1qme', lastFed: null }, { id: 4, owner: 'bc1qother', lastFed: 1 }, { id: 5, owner: 'bc1qme', lastFed: 1, dead: true }, { id: 6, owner: 'bc1qme', lastFed: 1, released: true }] };
T.autoStarBackfill(w); ok(JSON.stringify(kept()) === '[1,2]', 'backfill stars fed pets of mine only (not unfed, others, dead, released): ' + JSON.stringify(kept()));
T.toggleKeep(1); ok(JSON.stringify(kept()) === '[2]', 'unstar works'); T.autoStarBackfill(w); ok(JSON.stringify(kept()) === '[2]', 'backfill does not re-star a pet the player unstarred');
w.pets.push({ id: 7, owner: 'bc1qme', lastFed: 970100 }); T.autoStarBackfill(w); ok(JSON.stringify(kept()) === '[2,7]', 'a newly fed pet is starred on the next load');
// (2) starred pets are never discarded
reset(); st[KK] = '[2,7]';
T.discardIds([1, 2, 3]); ok(JSON.stringify(hidden) === '[1,3]', 'discardIds hides only the unstarred pets'); ok(toasts.some(t => /never discarded/.test(t) && /#2/.test(t)), 'and says the starred one was skipped');
hidden.length = 0; T.discardIds([7]); ok(!hidden.length, 'discarding only starred pets hides nothing');
ok(JSON.stringify(T.dropKept([1, 2, 7, 9])) === '[1,9]', 'dropKept drops starred ids');
T.toggleKeep(7); hidden.length = 0; T.discardIds([7]); ok(JSON.stringify(hidden) === '[7]', 'after unstar the pet can be discarded');
// wiring: every feed burn goes through keepFed with its plan; backfill runs on world load; every discard path checks the star
ok(/starred \+= keepFed\(p\.tag, p\)/.test(src), 'send loop stars fed pets (keepFed(p.tag, p))');
ok(/autoStarBackfill\(w\)/.test(src.slice(endDisc)), 'world load runs autoStarBackfill');
ok(/function hideIds\(ids\) \{ discardIds\(ids\); \}/.test(src), 'hideIds goes through discardIds');
ok(/dDiscard'\)\.onclick = function \(\) \{[^}]*isKept\(id\)/.test(src), 'pet detail Discard refuses a starred pet');
ok(/function revHide[\s\S]{0,200}ids\.filter\(isKept\)/.test(src), 'hatch review skips starred pets');
const pd = rd('js/v2-petdiscard.js'), du = rd('js/v2-deluncommon.js');
ok(/D\.isKept && D\.isKept\(id\)/.test(pd), 'card 🗑️ checks the star'); ok(/ids\.filter\(D\.isKept\)/.test(pd), 'Discard selected skips starred');
ok(/!\(D\.isKept && D\.isKept\(p\.id\)\)/.test(du), 'Discard unfed skips starred');
ok(/isKept: isKept/.test(src) && /discardIds: discardIds/.test(src), 'isKept / discardIds exported for the add-ons');
// keep: checkboxes stay the selection
ok(/class="pick-cb"|pick-cb/.test(src), 'My Pets checkboxes still there');
console.log(pass + ' pass, ' + fail + ' fail'); if (fail) { console.log(fail + ' FAILED'); process.exit(1); }
