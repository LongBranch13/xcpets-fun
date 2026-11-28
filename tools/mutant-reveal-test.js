#!/usr/bin/env node
/* weird-looks-1128 part 2 (display only): a mutant egg gets its own "MUTATION!" hatch moment (js/v2-life-anim.js), HatchBot posts every
 * new mutant once (hatchbot/announce.js collect), and the Rare finds hall has a 🧬 Mutants tab (js/v2-rare-hall.js finds).
 *   node tools/mutant-reveal-test.js */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const ROOT = path.resolve(__dirname, '..'), rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
/* a 2D context that takes any call and remembers the colours it painted with */
function ctx2d(log) { const id = (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(Math.max(1, w * h * 4)) });
  const g = { canvas: null, set fillStyle(v) { log.add(String(v).toLowerCase()); }, get fillStyle() { return '#000'; }, getImageData: (x, y, w, h) => id(w, h), createImageData: (w, h) => id(w, h), measureText: () => ({ width: 6 }), createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }) };
  return new Proxy(g, { get: (t, k) => (k in t ? t[k] : typeof k === 'string' ? function () {} : undefined), set: (t, k, v) => { if (k === 'fillStyle') log.add(String(v).toLowerCase()); else t[k] = v; return true; } }); }
function load() {
  const store = {}, ls = { getItem: k => store[k] || null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } }, log = new Set();
  const el = () => { const e = { style: {}, width: 32, height: 32, appendChild() {}, setAttribute() {}, getAttribute: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false } }; e.getContext = () => ctx2d(log); return e; };
  const doc = { createElement: el, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, head: el(), documentElement: el(), body: el() };
  const win = { console: { log() {}, warn() {}, error() {}, info() {} }, localStorage: ls, sessionStorage: ls, document: doc, location: { search: '', hostname: 'xcpets.fun', href: 'https://xcpets.fun/' }, navigator: { userAgent: 'node' }, setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {}, requestAnimationFrame: () => 0, addEventListener() {}, MutationObserver: function () { this.observe = () => {}; }, URLSearchParams, URL, TextEncoder, TextDecoder };
  win.window = win; win.self = win; win.globalThis = win; const c = vm.createContext(win);
  for (const f of ['rjs/config.js', 'rjs/pet-core.js', 'rjs/game-core.js', 'rjs/bonus-gear.js', 'js/pet-core.js', 'js/bonus-gear.js', 'js/v2-gear.js', 'js/v2-fit.js', 'js/v2-rules.js', 'js/species-registry.js', 'js/weird-looks.js', 'js/v2-render.js', 'js/v2-life-anim.js', 'js/v2-rare-hall.js'])
    vm.runInContext(rd(f), c, { filename: f });
  c.__log = log; return c;
}
let pass = 0; const t = (name, fn) => { fn(); pass++; console.log('ok', name); };
const C = load(), L = C.V2LifeAnim, V = C.V2Rules, PC = C.PetCore;
const art = PC.generate({ blockHash: '00'.repeat(32), petId: 'mut1', blockHeight: 980000 });
const pet = (id, extra) => Object.assign({ id, name: 'Muta', species: art.species, stage: 1, tier: 1, owner: 'bc1qme', parents: [1, 2], hatchBlock: 977900, art: JSON.parse(JSON.stringify(art)) }, extra || {});
const par = [pet(1, { parents: null }), pet(2, { parents: null })];
const world = list => { const all = par.concat(list), byId = {}; all.forEach(p => { byId[p.id] = p; }); return { pets: all, byId, items: [], tip: 977910 }; };

/* ---------------- the hatch moment ---------------- */
t('a mutant egg is a special birth of its own', () => { assert(L.BIRTH_KINDS.indexOf('mutant') > L.BIRTH_KINDS.indexOf('cross') && L.BIRTH_KINDS.indexOf('mutant') < L.BIRTH_KINDS.indexOf('twins'));
  const g = pet(10, { mutation: { kind: 'glitch' } }); assert.strictEqual(L.specialOf(world([g]), g), 'mutant'); assert.strictEqual(L.specialOf(world([pet(11)]), pet(11)), null); });
t('the sub line names the mutation', () => { const g = pet(10, { mutation: { kind: 'glitch' } }), p = pet(12, { mutation: { kind: 'palette', set: 'goldrush' } });
  assert.strictEqual(L.birthOf(world([g]), [10]).sub, 'GLITCH MUTATION'); const e = L.birthOf(world([p]), [12]); assert.strictEqual(e.tier, 'mutant'); assert.strictEqual(e.sub, (V.PALETTE_SETS.goldrush.label + ' palette').toUpperCase()); });
t('a mutant beats plain twins, a cross still wins', () => { const a = pet(20, { twinOf: 21, mutation: { kind: 'glitch' } }), b = pet(21, { twinOf: 20 }); assert.strictEqual(L.birthOf(world([a, b]), [20, 21]).tier, 'mutant');
  const x = pet(22, { mutation: { kind: 'glitch' } }); x.art.cross = { body: 'bojackson' }; assert.strictEqual(L.specialOf(world([x]), x), 'cross'); });
t('caption: MUTATION!, the label and the odds', () => { const p = pet(12, { mutation: { kind: 'palette', set: 'goldrush' } }), w = world([p]), e = L.birthOf(w, [12]), s = L.caption(e, w);
  assert(/MUTATION!/.test(s) && s.indexOf(V.PALETTE_SETS.goldrush.label) >= 0 && /1 in 100/.test(s), s);
  const j = pet(13, { mutation: { kind: 'glitch' }, jackpot: { from: 1 } }), wj = world([j]); assert(/Jackpot Egg, 1 in 5/.test(L.caption(L.birthOf(wj, [13]), wj))); });
t('every frame paints; a palette mutant paints in its own colours', () => { const p = pet(12, { mutation: { kind: 'palette', set: 'goldrush' } }), w = world([p]), e = L.birthOf(w, [12]), cv = C.document.createElement('canvas'); cv.width = 256; cv.height = 160;
  C.__log.clear(); for (let f = 0; f < 60; f++) L.paint(cv, e, f, w); const ramp = V.PALETTE_SETS.goldrush.ramp.map(c => c.toLowerCase()); assert(ramp.filter(c => C.__log.has(c)).length >= 3, 'ramp colours used: ' + ramp.filter(c => C.__log.has(c)));
  const g = pet(10, { mutation: { kind: 'glitch' } }), wg = world([g]), eg = L.birthOf(wg, [10]); C.__log.clear(); for (let f = 0; f < 60; f++) L.paint(cv, eg, f, wg); assert(C.__log.has('#ff4fd8') && C.__log.has('#3cf6ff')); });

/* ---------------- Rare finds ---------------- */
t('Rare finds lists mutants with a 🧬 MUTANT card', () => { const p = pet(12, { mutation: { kind: 'palette', set: 'goldrush' } }), F = C.V2RareHall.finds(world([p, pet(14)])); const m = F.filter(x => x.p.id === 12)[0];
  assert(m && m.i.mutant && m.i.icon === '🧬' && /Palette mutation/.test(m.i.name)); assert(!F.some(x => x.p.id === 14)); });

/* ---------------- HatchBot ---------------- */
global.window = undefined; const A = require(path.join(ROOT, 'hatchbot/announce.js'));
t('HatchBot posts a new mutant once (twins once), never an old one', () => { const a = pet(30, { twinOf: 31, mutation: { kind: 'palette', set: 'goldrush' } }), b = pet(31, { twinOf: 30, mutation: { kind: 'palette', set: 'goldrush' } }), old = pet(32, { mutation: { kind: 'glitch' }, hatchBlock: 977000 }), g = pet(33, { mutation: { kind: 'glitch' }, jackpot: { from: 1 } });
  const w = Object.assign(world([a, b, old, g]), { log: [] }), out = A.collect(V, w, 977910, 977800).filter(x => /^mutant-/.test(x.key));
  assert.deepStrictEqual(out.map(x => x.key).sort(), ['mutant-30', 'mutant-33']); assert(out.every(x => x.prio >= 4 && x.art && x.art.kind === 'hatch'));
  const tw = out.filter(x => x.key === 'mutant-30')[0].text; assert(/MUTATION!!/.test(tw) && /both/.test(tw) && /#31/.test(tw), tw); assert(/Jackpot Egg/.test(out.filter(x => x.key === 'mutant-33')[0].text)); });
console.log('ALL PASS (' + pass + ')');
