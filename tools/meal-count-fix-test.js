#!/usr/bin/env node
/* meal-count-fix tests (Oct 27 2026, display only): js/v2-intuitive.js careNext() / careShort() / the '?' care sheet count meals by stepping
 * V2Rules.mealFor() with V2Rules.petThresholds(), target the lower of the next stage and the pet's Mythic line, and show care (not XCPETS) per meal.
 *   node tools/meal-count-fix-test.js */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const REPO = path.resolve(__dirname, '..'), rd = f => fs.readFileSync(path.join(REPO, f), 'utf8');
const st = {}, ls = { getItem: k => st[k] || null, setItem: (k, v) => { st[k] = String(v); }, removeItem: k => { delete st[k]; } };
const el = () => ({ style: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, setAttribute() {}, getAttribute: () => null, addEventListener() {}, appendChild() {}, insertAdjacentHTML() {}, querySelector: () => null, querySelectorAll: () => [], dataset: {} });
const win = { console: { log() {}, warn() {}, error() {}, info() {} }, localStorage: ls, sessionStorage: ls, location: { search: '', pathname: '/play.html', hostname: 'xcpets.fun', href: 'https://xcpets.fun/play.html' }, navigator: { userAgent: 'node' }, setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {}, TextEncoder, TextDecoder, URLSearchParams, MutationObserver: function () { this.observe = () => {}; this.disconnect = () => {}; }, Event: function () {}, CustomEvent: function () {}, requestAnimationFrame: () => 0, matchMedia: () => ({ matches: false, addEventListener() {} }) };
win.document = Object.assign(el(), { readyState: 'loading', getElementById: () => null, createElement: el, documentElement: el(), body: el(), head: el() });
win.addEventListener = () => {}; win.window = win; win.self = win; win.globalThis = win;
const ctx = vm.createContext(win); for (const f of ['js/pet-core.js', 'js/bonus-gear.js', 'js/v2-gear.js', 'js/v2-fit.js', 'js/v2-rules.js']) vm.runInContext(rd(f), ctx, { filename: f });
const V = ctx.V2Rules;
/* same careTarget as js/v2-render.js (the card bar), so the test needs no DOM render module */
ctx.V2Render = { careTarget(w, p, tip) { const th = V.petThresholds(w, p, tip), base = V.thresholdsFor(p.species, tip); return { th, mythic: th[5], discount: th[5] < base[5], pct: Math.min(100, 100 * p.care / th[5]) }; } };
vm.runInContext(rd('js/v2-intuitive.js'), ctx, { filename: 'js/v2-intuitive.js' });
const I = ctx.IPQ;
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const TIP = 973465, SC = 'bc1qshortcut', NO = 'bc1qnormal';
const w = { tip: TIP, pets: [], byId: {}, mythicOwners: { [SC]: 972723 } };
const add = (id, o) => { const p = Object.assign({ id, species: 'mumu', owner: NO, stage: 2, care: 8349, fedToday: true, nextMeal: 1725, nextCare: 6900, dead: false, released: false }, o); w.pets.push(p); w.byId[id] = p; return p; };
const tipo = add(50237, { owner: SC });                       // Tipotot #50237: Juvenile 8,349, shortcut 21,000 (halving era 2: a meal burns 1,725 for 6,900 care)
const norm = add(1, {});                                       // same pet, no shortcut
const hatch = add(2, { stage: 1, care: 69, nextMeal: 1035, nextCare: 4140, fedToday: false, owner: SC });
const elder = add(3, { stage: 4, care: 41469, nextMeal: 2300, nextCare: 9200 });
const adultNo = add(4, { stage: 3, care: 22149, nextMeal: 2415, nextCare: 9660, fedToday: false });
const era0 = add(5, { nextMeal: 6900, nextCare: undefined });  // era 0: nextMeal is the care (no nextCare)
ctx.V2UI = { world: () => w };

let n = I.careNext(w, tipo);
ok(n && n.next === 'Mythic' && n.meals === 2 && n.at === 21000 && n.need === 12651 && n.skip, 'Tipotot: Mythic in 2 meals (21,000), got ' + JSON.stringify(n && { next: n.next, meals: n.meals, at: n.at }));
ok(I.careShort(w, tipo) === '→ Mythic in 2 meals', 'Tipotot card line, got ' + I.careShort(w, tipo));
ok(n.per === 6900, 'care per meal is nextCare 6,900, not the 1,725 burned');
ok(n.earliest === 973728, 'fed today (day 6760): meals on days 6761 and 6762 -> earliest block 973,728, got ' + n.earliest);
n = I.careNext(w, norm);
ok(n.next === 'Adult' && n.meals === 2 && n.at === 22149 && !n.skip, 'no shortcut: Adult in 2 meals');
ok(I.careShort(w, norm) === '→ Adult in 2 meals', 'normal card line');
n = I.careNext(w, hatch);
ok(n.next === 'Juvenile' && n.meals === 2 && !n.skip && n.earliest === Math.floor((TIP + 1) / 144) * 144 + 144, 'shortcut hatchling: Juvenile in 2 (shortcut is after Juvenile), not fed today -> today + tomorrow, got ' + n.earliest);
n = I.careNext(w, elder);
ok(n.next === 'Mythic' && n.meals === 3 && n.at === 69069, 'normal Elder: Mythic in 3 meals (9,200 each)');
n = I.careNext(w, adultNo);
ok(n.next === 'Elder' && n.meals === 2 && n.earliest === Math.floor((TIP + 1) / 144) * 144 + 144, 'normal Adult not fed today: Elder in 2');
n = I.careNext(w, era0);
ok(n.per === 6900 && n.meals === 2, 'era 0: nextMeal used as care per meal');
const one = add(6, { owner: SC, care: 15249, fedToday: false });
n = I.careNext(w, one); ok(n.meals === 1 && n.next === 'Mythic' && n.earliest === TIP + 1, 'one meal left, not fed today: next block');
ok(I.careNext(w, add(7, { stage: 5, care: 21000, owner: SC })) === null, 'Mythic: no next line');
ok(I.careNext(w, add(8, { dead: true })) === null, 'dead: no next line');

const sh = I.careSheet(50237);
ok(/Juvenile → <b>Mythic<\/b> at 21,000 care: 12,651 to go · 2 meals \(one per chain day, up to 6,900 care each\) · earliest ~block 973,728\./.test(sh), 'care sheet line for Tipotot: ' + sh.replace(/<ol[\s\S]*<\/ol>/, ''));
ok(/skips Adult and Elder/.test(sh), 'care sheet says the shortcut skips Adult and Elder');
ok(/Adult <span class="muted">22,149 · skipped/.test(sh) && /Elder <span class="muted">41,469 · skipped/.test(sh), 'ladder marks skipped stages');
ok(!/1,725/.test(sh), 'care sheet never shows the XCPETS burned as care');
const sn = I.careSheet(1);
ok(/Juvenile → <b>Adult<\/b> at 22,149 care: 13,800 to go · 2 meals \(one per chain day, up to 6,900 care each\) · earliest ~block 973,728\./.test(sn) && !/skipped|skips/.test(sn), 'care sheet line for a normal pet');
const bad = (sh + sn).replace(/<[^>]+>/g, ' ');
ok(!/[×]|\b\d+\s?x\b|\bprice\b|\bseries\b|\bdiscount\b/i.test(bad), 'wording: no x / × / price / series / discount');
console.log(fail ? fail + ' FAILED, ' + pass + ' passed' : 'meal-count-fix: all ' + pass + ' pass');
process.exit(fail ? 1 : 0);
