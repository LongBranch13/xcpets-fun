#!/usr/bin/env node
/* Player-friction timings (display only). A large wallet must not do O(pets × pieces) or O(pets × look-copies)
 * work on Select all, Auto-equip, or the hotel Looks sort. Same pieces and the same look counts as the slow path.
 *   node tools/friction-perf-test.js
 *   node tools/friction-perf-test.js --feed     also time api/pets.json (the public feed, owner-scale)
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const FEED = process.argv.indexOf('--feed') >= 0;
let fail = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };
function ms(fn) { const t = process.hrtime.bigint(); const r = fn(); return { ms: Number(process.hrtime.bigint() - t) / 1e6, r: r }; }
function load() {
  const SCRIPTS = ['rjs/config.js', 'rjs/pet-core.js', 'rjs/game-core.js', 'rjs/bonus-gear.js', 'rjs/real-core.js', 'rjs/chain.js', '@LIVE', 'js/pet-core.js', 'js/bonus-gear.js', 'js/v2-gear.js', 'js/v2-fit.js', 'js/v2-rules.js', 'js/block-hashes.js', 'js/pet-sort.js', 'js/v2-lair-qol.js'];
  const ls = { getItem: () => null, setItem() {}, removeItem() {} };
  const win = { console: { log() {}, warn() {}, error() {}, info() {} }, localStorage: ls, sessionStorage: ls, location: { search: '', hostname: 'xcpets.fun', href: 'https://xcpets.fun/' }, navigator: { userAgent: 'node' }, setTimeout: () => 0, clearTimeout() {}, URLSearchParams, URL, TextEncoder, TextDecoder, performance: { now: () => Number(process.hrtime.bigint()) / 1e6 }, fetch: () => Promise.reject(new Error('offline')) };
  win.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ style: {}, appendChild() {} }), addEventListener() {}, head: { appendChild() {} }, body: null, documentElement: { style: {} } };
  win.addEventListener = () => {}; win.window = win; win.self = win; win.globalThis = win;
  const ctx = vm.createContext(win);
  for (const f of SCRIPTS) {
    if (f === '@LIVE') { vm.runInContext('window.LiveEngine={RealCore:window.RealCore,Chain:window.Chain&&window.Chain.Chain,CFG:window.XCPETS_CONFIG};', ctx); continue; }
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  }
  return ctx;
}
const ctx = load(), V = ctx.V2Rules, PS = ctx.PetSort, LQ = ctx.V2LairQoL;
const SLOTS = ['head', 'face', 'body', 'back', 'hand', 'feet'];
const ME = 'bc1qfrictionowner00000000000000000000000000';
const OTHER = 'bc1qfrictionother00000000000000000000000000';
const plain = (V.ALL_GEAR || []).filter(g => g && !g.exclusive && SLOTS.indexOf(g.slot) >= 0);
const locked = (V.ALL_GEAR || []).filter(g => g && g.exclusive && g.origin === 'pepe' && g.slot === 'head')[0];
ok(plain.length >= 4 && locked, 'gear catalog has plain pieces and a Pepe-only head piece');

function pet(id, o) {
  return Object.assign({ id: id, owner: ME, name: 'P' + id, species: 'doge', tier: 1, stage: 3, dead: false, released: false, community: false, openSlots: SLOTS.slice(0, 4), stats: { vigor: 1, spark: 1, grit: 1, zoom: 1, luck: 1 }, art: { species: 'doge' }, flameLooks: [] }, o);
}
const pets = [];
const byId = {};
for (let i = 1; i <= 900; i++) {
  const mine = i <= 400;
  const p = pet(i, { owner: mine ? ME : OTHER, species: i % 17 === 0 ? 'pepe' : 'doge', tier: i % 4, openSlots: SLOTS.slice(0, 1 + (i % 4)) });
  if (i === 7) { p.species = 'wizard'; p.openSlots = SLOTS.slice(); }
  if (i <= 30) p.flameLooks = i % 2 ? ['laurels'] : ['halo'];
  pets.push(p); byId[i] = p;
}
const items = {}, itemList = [];
let gid = 1;
function add(it, owner, on, tier) { const g = { gid: 'g' + (gid++), item: it.id, label: it.label, slot: it.slot, tier: tier == null ? it.tier : tier, owner: owner, on: on }; items[g.gid] = g; itemList.push(g); return g; }
/* a low-tier piece already worn, then several free copies, including one the wrong species cannot wear */
for (let i = 1; i <= 400; i++) add(plain[i % plain.length], ME, i, 0);
for (let i = 0; i < 180; i++) add(plain[i % plain.length], ME, null, (i % 3) + 1);
if (locked) { add(locked, ME, null, 3); add(locked, ME, 2, 1); }
for (let i = 0; i < 40; i++) add(plain[i % plain.length], OTHER, null, 3);
const lookCopies = {};
const kinds = [['quest', 'neon-trail'], ['quest', 'aurora'], ['earn', 'laurels'], ['earn', 'halo'], ['earn', 'wings']];
for (let i = 0; i < 220; i++) {
  const host = pets[(i * 3) % 400];
  const pair = kinds[i % kinds.length];
  const holder = i % 11 === 0 ? OTHER : ME;
  const key = pair[0] + ':' + pair[1] + ':' + (1000 + i);
  lookCopies[key] = { key: key, kind: pair[0], id: pair[1], src: host.id, holder: holder, at: i % 13 === 0 ? 0 : host.id };
}
const w = { pets: pets, byId: byId, items: items, itemList: itemList, tip: 975315, lookCopies: lookCopies };
V.reindex(w);
const live = pets.filter(p => p.owner === ME && !p.dead);

const shownN = {};
live.forEach(p => { shownN[p.id] = V.shownLooks(w, p).length; });
const fastOrder = PS.sort(w, live, 'looks').map(p => p.id);
const slowOrder = live.map((p, i) => ({ p: p, i: i })).sort((a, b) => shownN[b.p.id] - shownN[a.p.id] || a.i - b.i).map(x => x.p.id);
ok(fastOrder.join() === slowOrder.join(), 'Looks sort matches shownLooks counts (' + live.length + ' pets)');
const overlap = live.filter(p => (p.flameLooks || []).length && Object.keys(lookCopies).some(k => lookCopies[k].at === p.id));
ok(overlap.length > 0 && overlap.every(p => V.shownLooks(w, p).length >= 1), 'flame look and a wallet copy share pets (' + overlap.length + ')');

const tSlowLooks = ms(() => live.reduce((n, p) => n + V.shownLooks(w, p).length, 0));
const tFastLooks = ms(() => PS.sort(w, live, 'looks').length);
console.log('MEASURE looks  pets ' + live.length + '  copies ' + Object.keys(lookCopies).length + '  shownLooks-each ' + Math.round(tSlowLooks.ms) + 'ms  PetSort.looks ' + Math.round(tFastLooks.ms) + 'ms');
ok(tFastLooks.ms < tSlowLooks.ms, 'Looks sort is faster than calling shownLooks per pet');

function eqOps(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
[1, 40, live.length].forEach(n => {
  const ids = live.slice(0, n).map(p => p.id);
  const slow = V.autoEquipOps(w, ME, ids, w.tip);
  const fast = LQ.autoEquipOps(w, ME, ids, w.tip);
  ok(eqOps(slow, fast), 'auto-equip same pieces for ' + n + ' pets (' + slow.length + ' ops)');
});
ok(eqOps(LQ.autoEquipOps(w, ME, [], w.tip), []), 'auto-equip of nobody is empty');
const again = LQ.autoEquipOps(w, ME, live.map(p => p.id), w.tip);
ok(eqOps(again, V.autoEquipOps(w, ME, live.map(p => p.id), w.tip)), 'cached planner still matches after a second call');
const tSlowEq = ms(() => V.autoEquipOps(w, ME, live.map(p => p.id), w.tip).length);
const tFastEq = ms(() => { const ids = live.map(p => p.id); return LQ.autoEquipOps(Object.assign({}, w, { tip: w.tip + 1 }), ME, ids, w.tip + 1).length; });
console.log('MEASURE auto-equip  pets ' + live.length + '  pieces ' + itemList.length + '  rules ' + Math.round(tSlowEq.ms) + 'ms  planner ' + Math.round(tFastEq.ms) + 'ms');

/* discard list: one Set, same pets as indexOf. Parsing the list inside the pet loop is the freeze. */
const hid = live.slice(0, 250).map(p => p.id);
const raw = JSON.stringify(hid);
const set = new Set(JSON.parse(raw));
let same = 0, via = 0;
pets.forEach(p => { const a = p.owner === ME && !p.released && hid.indexOf(p.id) >= 0; const b = p.owner === ME && !p.released && set.has(p.id); if (a) same++; if (a === b) via++; });
ok(via === pets.length && same === hid.length, 'discard Set matches indexOf (' + same + ' hidden)');
const tParse = ms(() => { let n = 0; pets.forEach(p => { if (p.owner === ME && !p.released && JSON.parse(raw).indexOf(p.id) >= 0) n++; }); return n; });
const tOnce = ms(() => { const s = new Set(JSON.parse(raw)); let n = 0; pets.forEach(p => { if (p.owner === ME && !p.released && s.has(p.id)) n++; }); return n; });
console.log('MEASURE discard  hidden ' + hid.length + '  parse-each ' + Math.round(tParse.ms) + 'ms  once ' + Math.round(tOnce.ms) + 'ms');
ok(tOnce.r === tParse.r && tOnce.ms < tParse.ms, 'one parse finds the same discarded pets');

if (FEED) {
  const doc = JSON.parse(fs.readFileSync(path.join(ROOT, 'api/pets.json'), 'utf8'));
  const exp = require(path.join(ROOT, 'js/pets-feed.js')).expand(doc);
  const OWNER = 'bc1ps9av86ymmlzy9zj3a8pn6g94pz4j5e0kagv3td3wutaagfjvekjs26m3s4';
  const TIER = { Common: 0, Uncommon: 1, Rare: 2, Legendary: 3 };
  const by = {}, wp = exp.pets.map(p => {
    const tier = TIER[p.tier] != null ? TIER[p.tier] : 0;
    const o = { id: p.id, owner: p.owner, name: p.name || '', species: p.species, tier: tier, stage: p.stage || 0, dead: p.status === 'dead', released: p.status === 'released', community: !!p.community, openSlots: p.status === 'alive' ? SLOTS.slice(0, Math.min(6, Math.max(1, p.stage || 1))) : [], art: { species: p.species }, flameLooks: [], stats: p.stats || {} };
    by[o.id] = o; return o;
  });
  const its = {}, il = []; let g = 1;
  exp.pets.forEach(p => (p.gear || []).forEach(piece => { const it = { gid: 'g' + (g++), item: piece.item, slot: piece.slot, tier: TIER[piece.tier] != null ? TIER[piece.tier] : 0, owner: p.owner, on: p.id }; its[it.gid] = it; il.push(it); }));
  const own = il.filter(x => x.owner === OWNER);
  own.forEach((src, i) => { const it = { gid: 'f' + i, item: src.item, slot: src.slot, tier: src.tier, owner: OWNER, on: null }; its[it.gid] = it; il.push(it); });
  const fw = { pets: wp, byId: by, items: its, itemList: il, tip: doc.blockHeight, lookCopies: {} };
  V.reindex(fw);
  const flive = wp.filter(p => p.owner === OWNER && !p.dead && !p.released);
  for (let i = 0; i < 582; i++) { const p = flive[i % flive.length]; const key = (i % 2 ? 'quest' : 'earn') + ':' + kinds[i % kinds.length][1] + ':' + (50000 + i); fw.lookCopies[key] = { key: key, kind: i % 2 ? 'quest' : 'earn', id: kinds[i % kinds.length][1], src: p.id, holder: OWNER, at: p.id }; }
  const ids = flive.map(p => p.id);
  const a = ms(() => V.autoEquipOps(fw, OWNER, ids, fw.tip));
  const b = ms(() => LQ.autoEquipOps(fw, OWNER, ids, fw.tip + 1));
  console.log('MEASURE feed auto-equip  living ' + flive.length + '  pieces ' + il.length + '  before ' + Math.round(a.ms) + 'ms  after ' + Math.round(b.ms) + 'ms  ops ' + a.r.length);
  ok(eqOps(a.r, LQ.autoEquipOps(fw, OWNER, ids, fw.tip)), 'feed: planner matches rules auto-equip (' + a.r.length + ' ops)');
  ok(b.ms * 2 < a.ms, 'feed: planner is at least twice as fast (' + Math.round(b.ms) + 'ms vs ' + Math.round(a.ms) + 'ms)');
  const beforeL = ms(() => { let n = 0; for (let i = 0; i < flive.length; i++) n += V.shownLooks(fw, flive[i]).length; return n; });
  const afterL = ms(() => PS.sort(fw, flive, 'looks').length);
  const counts = {}; flive.forEach(p => { counts[p.id] = V.shownLooks(fw, p).length; });
  const ord = PS.sort(fw, flive, 'looks').map(p => p.id);
  const expOrd = flive.map((p, i) => ({ p: p, i: i })).sort((a, b) => counts[b.p.id] - counts[a.p.id] || a.i - b.i).map(x => x.p.id);
  console.log('MEASURE feed looks  living ' + flive.length + '  copies 582  shownLooks-each ' + Math.round(beforeL.ms) + 'ms  PetSort ' + Math.round(afterL.ms) + 'ms');
  ok(ord.join() === expOrd.join(), 'feed: Looks sort matches shownLooks');
  const pile = JSON.stringify(flive.slice(0, 5000).map(p => p.id));
  const slowH = ms(() => { let n = 0; wp.forEach(p => { if (p.owner === OWNER && !p.released && JSON.parse(pile).indexOf(p.id) >= 0) n++; }); return n; });
  const fastH = ms(() => { const s = new Set(JSON.parse(pile)); let n = 0; wp.forEach(p => { if (p.owner === OWNER && !p.released && s.has(p.id)) n++; }); return n; });
  console.log('MEASURE feed discard  hidden 5000  owned ' + (flive.length) + '  parse-each ' + Math.round(slowH.ms) + 'ms  once ' + Math.round(fastH.ms) + 'ms');
  ok(slowH.r === fastH.r, 'feed: discard Set finds the same pets');
}

console.log(fail ? 'FAILED ' + fail : 'friction-perf-test PASS');
process.exit(fail ? 1 : 0);
