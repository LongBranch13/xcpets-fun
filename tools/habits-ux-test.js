#!/usr/bin/env node
/* habits-ux tests (Oct 27 2026, UI only): js/v2-habits.js feed check before signing + never-fed folding, against the real V2Rules tags.
 *   node tools/habits-ux-test.js */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const REPO = path.resolve(__dirname, '..'), rd = f => fs.readFileSync(path.join(REPO, f), 'utf8');
const st = {}, ls = { getItem: k => st[k] || null, setItem: (k, v) => { st[k] = String(v); }, removeItem: k => { delete st[k]; } };
const win = { console: { log() {}, warn() {}, error() {}, info() {} }, localStorage: ls, sessionStorage: ls, location: { search: '', hostname: 'xcpets.fun', href: 'https://xcpets.fun/' }, navigator: { userAgent: 'node' }, setTimeout, clearTimeout, TextEncoder, TextDecoder };
win.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ getContext: () => null, style: {} }), addEventListener() {}, body: null, documentElement: { style: {} } };
win.addEventListener = () => {}; win.window = win; win.self = win; win.globalThis = win;
const ctx = vm.createContext(win); for (const f of ['js/pet-core.js', 'js/bonus-gear.js', 'js/v2-gear.js', 'js/v2-fit.js', 'js/v2-rules.js', 'js/v2-habits.js']) vm.runInContext(rd(f), ctx, { filename: f });
const V = ctx.V2Rules, H = ctx.V2Habits;
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const ME = 'bc1qme', NB = 980000;
const W = (() => { const w = { pets: [], byId: {} }; const add = (id, o) => { const p = Object.assign({ id, owner: ME, hungry: true, nextMeal: 0.5, stage: 1, care: 1, lastFed: 970000, fedToday: false, dead: false, released: false }, o || {}); w.pets.push(p); w.byId[id] = p; };
  for (let i = 1; i <= 12; i++) add(i); add(20, { fedToday: true, hungry: false }); add(21, { dead: true }); add(22, { quest: { end: NB + 500 } }); add(23, { owner: 'bc1qother' }); add(24, { quest: { end: NB - 1 } }); return w; })();
const qcount = { n: 0 }, queue = ids => { qcount.n++; return [{ tag: 'pet:fl:rebuilt', amount: ids.length, petIds: ids.slice() }]; };
const O = (o) => Object.assign({ me: ME, pend: {}, nb: NB, V, queue, idList: ids => '#' + ids.join(', #') }, o || {});
const ids = plans => plans.reduce((a, q) => a.concat(q.petIds || []), []);
// 1) feedWhy reasons
ok(H.feedWhy(W, W.byId[20], ME, {}, NB, V) === 'already fed this chain day', 'fed today');
ok(H.feedWhy(W, W.byId[21], ME, {}, NB, V) === 'dead', 'dead');
ok(V.questOn(NB) ? H.feedWhy(W, W.byId[22], ME, {}, NB, V) === 'away on a quest' : true, 'away on a quest');
ok(H.feedWhy(W, W.byId[24], ME, {}, NB, V) === null, 'back from quest can eat');
ok(H.feedWhy(W, W.byId[23], ME, {}, NB, V) === 'not yours', 'not yours');
ok(H.feedWhy(W, W.byId[1], ME, { 1: 1 }, NB, V) === 'a feed burn is still waiting to confirm', 'pending');
ok(H.feedWhy(W, W.byId[1], ME, {}, NB, V) === null, 'hungry ok');
// 2) old list burns: pet:feed, fm, fl
const single = [{ tag: 'pet:feed:20', amount: 1 }];
let g = H.feedGuardPlans(W, single, O()); ok(g.blocked && g.plans.length === 0 && /already fed/.test(g.text), 'pet:feed of a fed pet is blocked');
const fp = V.feedPlan([20, 21, 22].map(id => ({ id, nextMeal: 0.5 })));
ok(fp.length >= 1 && fp.every(q => /^pet:(feed|fm|fl):/.test(q.tag)), 'feedPlan builds list tags: ' + fp.map(q => q.tag).join(' '));
g = H.feedGuardPlans(W, fp, O()); ok(g.blocked && !g.plans.length, 'fm/fl of fed + dead + away is blocked (' + g.text + ')');
const fp2 = V.feedPlan([1, 2, 3, 20, 21].map(id => ({ id, nextMeal: 0.5 }))); qcount.n = 0;
g = H.feedGuardPlans(W, fp2, O()); ok(!g.blocked && JSON.stringify(ids(g.plans)) === '[1,2,3]' && g.skipped.length === 2, 'mixed list keeps only 1,2,3');
g = H.feedGuardPlans(W, V.feedPlan([1, 2].map(id => ({ id, nextMeal: 0.5 }))), O()); ok(!g.skipped.length && !g.blocked, 'all ok leaves plans as they are');
// 3) feed-all path: fa / fx / fy with petIds, sk/su skip-list burns, and an old plan without petIds
const skT = V.feedAllPlan(W, ME, [W.byId[1]], NB, true) || [];
const realSk = skT.filter(q => V.parseTag(q.tag) && V.parseTag(q.tag).action === 'skip');
const plansAll = realSk.concat([{ tag: 'pet:fa', amount: 1, petIds: [20, 21, 22] }]);
g = H.feedGuardPlans(W, plansAll, O()); ok(g.blocked && g.plans.length === 0, 'feed-all with nobody to feed: blocked and its sk/su burns dropped (sk ' + realSk.length + ')');
g = H.feedGuardPlans(W, [{ tag: 'pet:fa', amount: 1, petIds: [1, 20] }], O()); ok(!g.blocked && JSON.stringify(ids(g.plans)) === '[1]', 'feed-all rebuilt for the pets left');
const fx = V.feedAllPlan(W, ME, [W.byId[20]], NB, false); if (fx) { const t = V.parseTag(fx[0].tag); ok(t && t.action === 'feeda', 'fx/fy parse as feeda'); g = H.feedGuardPlans(W, fx, O()); ok(g.blocked, 'fx of a fed pet is blocked'); }
const fedW = { pets: W.pets.map(p => Object.assign({}, p, { fedToday: true, hungry: false })), byId: {} }; fedW.pets.forEach(p => { fedW.byId[p.id] = p; });
g = H.feedGuardPlans(fedW, [{ tag: 'pet:fa', amount: 1 }], O()); ok(g.blocked, 'old feed-all plan without petIds: derived from the tag, blocked when all are fed');
g = H.feedGuardPlans(W, [{ tag: 'pet:wagmi', amount: 1e-8 }], O()); ok(!g.blocked && g.plans.length === 1, 'non-feed burns pass untouched');
g = H.feedGuardPlans(W, [{ tag: 'pet:wagmi', amount: 1e-8 }, { tag: 'pet:feed:21', amount: 1 }], O()); ok(g.blocked && g.plans.length === 1 && g.plans[0].tag === 'pet:wagmi', 'blocked feed keeps the other burn');
// 4) never-fed split
const L = [{ id: 1, lastFed: null }, { id: 2, lastFed: 5 }, { id: 3, lastFed: null }, { id: 4, lastFed: null }];
let s = H.splitNeverFed(L, new Set([3]), new Set([4])); ok(JSON.stringify(s.shown.map(p => p.id)) === '[2,3,4]' && JSON.stringify(s.nf.map(p => p.id)) === '[1]', 'starred and selected stay listed');
s = H.splitNeverFed(L); ok(s.nf.length === 3 && s.shown.length === 1, 'plain split (cemetery)');
const big = []; for (let i = 0; i < 9000; i++) big.push({ id: i, lastFed: i % 20 ? null : 1 }); const t0 = process.hrtime.bigint();
for (let r = 0; r < 20; r++) s = H.splitNeverFed(big, new Set([1, 2, 3]), new Set()); const ms = Number(process.hrtime.bigint() - t0) / 1e6 / 20;
ok(s.nf.length === 8547 && ms < 15, '9k-pet split fast (' + ms.toFixed(2) + ' ms)');
// 5) wiring: v2.js uses the shared check, blocks instead of the unguarded queue, folds; pages load the helper before their users
const v2 = rd('js/v2.js'), pg = rd('js/v2-pages.js');
ok(/V2Habits\.feedWhy\(/.test(v2) && /V2Habits\.feedGuardPlans\(/.test(v2), 'v2.js uses V2Habits checks');
ok(!/if \(!g\.ok\.length\) return confirmPlans\(title, noDiscarded\(V\.feedQueue\(w, ME, hungry\)\)\)/.test(v2) && /return feedBlocked\(title, g\.text\)/.test(v2), 'big feed with nobody left is blocked');
ok(/if \(feedDrop\(\)\) return step\(\)/.test(v2), 'each chained feed burn is checked right before compose');
ok(/V2Habits\.splitNeverFed\(list/.test(v2) && /V2Habits\.splitNeverFed\(list\)/.test(pg), 'My Pets and Cemetery fold never-fed pets');
for (const f of ['templates/game.html', 'play.html', 'fight.html', 'breed.html', 'raid.html', 'rare-room.html']) { const h = rd(f), a = h.indexOf('"js/v2-habits.js'), b = h.indexOf('"js/v2.js', a); ok(a > 0 && b > a && h.lastIndexOf('"js/v2.js') === b, f + ' loads v2-habits.js before v2.js'); }
{ const h = rd('cemetery.html'), a = h.indexOf('"js/v2-habits.js'), b = h.indexOf('"js/v2-pages.js', a); ok(a > 0 && b > a, 'cemetery.html loads v2-habits.js before v2-pages.js'); }
console.log(pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
