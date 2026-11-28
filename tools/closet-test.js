#!/usr/bin/env node
/* Closet (js/v2-closet.js) + Gear Collection book (js/v2-gearbook.js) + the Wardrobe layer in js/v2-render.js (gear-closet, Nov 28 2026).
 * Runs the real functions with a small stub of V2Rules (no world replay): outfit plans skip pieces a pet can't show and always hide '-',
 * a look never changes the pet's real (worn) pieces, the book counts found pieces and complete sets, and the renderer's wardrobe() swaps,
 * adds and hides slots only on the owner's own living pets. Display only: no rules file is touched (rules MD5 checked). */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');
const ROOT = path.join(__dirname, '..');
let fails = 0; const ok = (c, m) => { if (c) console.log('  ok ' + m); else { fails++; console.log('  FAIL ' + m); } };
const ALL = [
  { id: 'cap', slot: 'head', tier: 0, label: 'Cap' }, { id: 'crown', slot: 'head', tier: 3, label: 'Crown' }, { id: 'pepe-hat', slot: 'head', tier: 3, label: 'Pepe hat', exclusive: true, origin: 'pepe' },
  { id: 'shades', slot: 'face', tier: 1, label: 'Shades' }, { id: 'cape', slot: 'back', tier: 2, label: 'Cape' }, { id: 'boots', slot: 'feet', tier: 0, label: 'Boots' }, { id: 'sword', slot: 'hand', tier: 2, label: 'Sword' }];
const BY = {}; ALL.forEach(x => { BY[x.id] = x; });
const SL = ['head', 'hand', 'body', 'back', 'face', 'feet'];
const V2Rules = { GEAR_BY_ID: BY, V2_SLOTS: SL, slotOpen: (p, s) => (p.openSlots || []).indexOf(s) >= 0, slotLabel: s => s,
  wornOf: (w, id) => w.itemList.filter(g => g.on === id),
  catalogBySlot: () => { const o = {}; SL.forEach(s => { o[s] = ALL.filter(x => x.slot === s); }); return o; },
  equipCheck: (w, me, pid, id) => { const p = w.byId[pid], it = BY[id]; if (it.exclusive && it.origin !== p.species) return { ok: false, why: 'species-only legendary' }; return { ok: true }; },
  GEAR_SETS: [{ key: 'royal', name: 'Royal', items: ['crown', 'cape', 'sword'], need: 3 }] };
const ME = 'bc1me', OTHER = 'bc1other';
const pets = [{ id: 1, owner: ME, species: 'doge', openSlots: SL.slice() }, { id: 2, owner: ME, species: 'pepe', openSlots: ['head', 'hand'] }, { id: 3, owner: OTHER, species: 'pepe', openSlots: SL.slice() }, { id: 4, owner: ME, species: 'doge', dead: true, openSlots: SL.slice() }];
const itemList = [{ gid: 10, item: 'cap', slot: 'head', owner: ME, on: 1 }, { gid: 11, item: 'crown', owner: ME, on: null }, { gid: 12, item: 'shades', owner: ME, on: null }, { gid: 13, item: 'pepe-hat', owner: ME, on: null },
  { gid: 14, item: 'cape', owner: ME, on: null }, { gid: 15, item: 'boots', slot: 'feet', owner: ME, on: 1 }, { gid: 16, item: 'sword', owner: OTHER, on: 3 }];
const w = { pets, byId: {}, itemList, items: {} }; pets.forEach(p => { w.byId[p.id] = p; }); itemList.forEach(g => { w.items[g.gid] = g; });

/* one browser-like context with localStorage, the real v2-closet.js and v2-gearbook.js */
const store = {}; const localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
const R = { get: () => { try { return JSON.parse(store['xcpets-wardrobe-v1']) || { v: 1, w: {} }; } catch (e) { return { v: 1, w: {} }; } }, save: P => { store['xcpets-wardrobe-v1'] = JSON.stringify(P); },
  apply: (w2, p, L) => L };
const win = { V2Rules, V2Render: { wardrobe: R }, localStorage }; win.window = win;
const cx = vm.createContext(win);
['js/v2-own.js', 'js/v2-closet.js', 'js/v2-gearbook.js'].forEach(f => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), cx, { filename: f }));
const C = win.V2Closet, B = win.V2GearBook;

console.log('owned + looks');
const own = C.owned(w, ME); ok(own.cap === 1 && own.crown === 1 && !own.sword, 'owned counts only this wallet\'s copies, worn or spare');
ok(C.looksFor(w, ME, pets[0], 'head').map(x => x.id).join() === 'crown,cap', 'doge head looks: rarest first, no Pepe-only hat');
ok(C.looksFor(w, ME, pets[1], 'head').map(x => x.id).join() === 'crown,pepe-hat,cap', 'pepe head looks include its own species piece (same tier: A-Z)');
ok(C.looksFor(w, ME, pets[1], 'face').length === 0, 'a locked slot offers no looks');

console.log('outfits');
const fit = { n: 'Drip', s: { head: 'crown', face: 'shades', back: 'cape', feet: '-' } };
const pl = C.planOutfit(w, ME, fit, [pets[0], pets[1], pets[2], pets[3]]);
ok(pl.pets === 2, 'only my living pets get the outfit (not another wallet\'s, not a dead pet)');
ok(JSON.stringify(pl.maps[1]) === JSON.stringify({ head: 'crown', face: 'shades', back: 'cape', feet: '-' }), 'pet 1 gets every piece and the hidden feet');
ok(JSON.stringify(pl.maps[2]) === JSON.stringify({ head: 'crown', feet: '-' }) && pl.skipped === 2, 'pet 2 skips the locked face/back slots (2 skipped), hides feet');
C.applyPlan(ME, pl);
ok(C.lookOf(ME, 1).head === 'crown' && C.lookOf(ME, 2).feet === '-', 'applyPlan writes the looks');
ok(itemList.find(g => g.gid === 10).on === 1 && itemList.find(g => g.gid === 11).on === null, 'a look never moves a real piece (cap stays worn, crown stays spare)');
const f1 = C.saveOutfit(ME, '  Boss   fight ', { head: 'crown' }); ok(f1 && f1.n === 'Boss fight', 'outfit names are tidied');
C.saveOutfit(ME, 'boss FIGHT', { head: 'cap' }); ok(C.outfits(ME).length === 1 && C.outfits(ME)[0].s.head === 'cap', 'same name (any case) replaces the outfit');
for (let i = 0; i < 30; i++) C.saveOutfit(ME, 'o' + i, { head: 'cap' }); ok(C.outfits(ME).length === 24, 'at most 24 outfits');
ok(C.allFits(ME).some(f => f.preset && f.n === 'Naked chad'), 'Naked chad preset is always there');
ok(C.clearLooks(ME, [1, 2]) === 2 && !C.lookOf(ME, 1), 'clearLooks takes the looks off');
C.setLook(ME, 1, 'head', 'crown'); C.setLook(ME, 1, 'head', null); ok(!C.lookOf(ME, 1), 'setLook(null) on the last slot removes the pet entry');

console.log('sets + book');
ok(C.sets().length === 1 && C.sets()[0].name === 'Royal' && !C.sets()[0].draft, 'sets come from V2Rules.GEAR_SETS when present');
ok(C.setOf('cape').key === 'royal' && C.setOf('cap') === null, 'setOf finds a piece\'s set');
const bk = B.compute(V2Rules.catalogBySlot(), own, C.sets());
ok(bk.total === ALL.length && bk.got === 6, 'book: 6 of 7 pieces found');
ok(bk.sets[0].n === 2 && !bk.sets[0].done && bk.setsDone === 0, 'book: Royal set 2/3, not complete');
const bk2 = B.compute(V2Rules.catalogBySlot(), Object.assign({ sword: 1 }, own), C.sets()); ok(bk2.sets[0].done && bk2.setsDone === 1, 'book: owning all 3 completes the set');
delete V2Rules.GEAR_SETS; ok(C.sets().every(s => s.draft), 'without GEAR_SETS the draft list shows, marked coming soon');

console.log('renderer wardrobe (js/v2-render.js)');
{ const src = fs.readFileSync(path.join(ROOT, 'js/v2-render.js'), 'utf8'), a = src.indexOf('  var WD_KEY ='), b = src.indexOf("  try { window.addEventListener('storage', function (e) { if (e.key === GS_KEY)");
  ok(a > 0 && b > a, 'found the wardrobe block');
  const st = {}, ctx = vm.createContext({ V: V2Rules, localStorage: { getItem: k => st[k] || null, setItem: (k, v) => { st[k] = v; } }, frCache: new Map(), JSON });
  vm.runInContext(src.slice(a, b) + ';this.wardrobe = wardrobe; this.wdSave = wdSave; this.wdGet = wdGet;', ctx);
  ctx.wdSave({ v: 1, w: { [ME]: { pets: { 1: { head: 'crown', face: 'shades', feet: '-' }, 4: { head: 'crown' } } } } });
  const worn1 = itemList.filter(g => g.on === 1).map(g => ({ item: g.item, slot: g.slot, gid: g.gid }));
  const out = ctx.wardrobe(w, pets[0], worn1), by = {}; out.forEach(g => { by[g.slot] = g.item; });
  ok(by.head === 'crown' && by.face === 'shades' && !by.feet, 'swaps head, adds face, hides feet');
  ok(worn1.length === 2 && worn1[0].item === 'cap', 'the worn list passed in is not changed');
  ok(ctx.wardrobe(w, pets[3], []).length === 0, 'a dead pet shows no looks');
  ok(ctx.wardrobe(w, Object.assign({}, pets[0], { owner: OTHER }), worn1) === worn1, 'a look saved by one wallet never shows on a pet another wallet owns');
  ctx.wdSave({ v: 1, w: { [ME]: { pets: { 2: { face: 'shades' } } } } }); ok(ctx.wardrobe(w, pets[1], []).length === 0, 'no look in a locked slot'); }

console.log('rules untouched');
const pin = require('./lib/rules-pin').pin('js/v2-rules.js'), md5 = crypto.createHash('md5').update(fs.readFileSync(path.join(ROOT, 'js/v2-rules.js'))).digest('hex');
ok(md5 === pin, 'js/v2-rules.js MD5 matches the pin');
console.log(fails ? fails + ' FAILED' : 'all ok'); process.exit(fails ? 1 : 0);
