#!/usr/bin/env node
/* jackpot-nobreed-1103 tests (dev tooling only): gated rule "a quest jackpot egg is still a child but uses no lifetime breed" (give-back sweep at the gate, twins once), Breedings line, quest-clarity egg note, rules.html. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const ROOT = path.resolve(__dirname, '..'), rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const store = {}, ls = { getItem: k => store[k] || null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
const el = () => ({ style: {}, appendChild() {}, setAttribute() {}, addEventListener() {}, getContext: () => null, classList: { add() {}, remove() {}, toggle() {} } });
const doc = { createElement: el, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, head: null, documentElement: el(), body: el() };
const win = { console: { log() {}, warn() {}, error() {}, info() {} }, localStorage: ls, sessionStorage: ls, document: doc, location: { search: '', hostname: 'xcpets.fun', href: 'https://xcpets.fun/' }, navigator: { userAgent: 'node' }, setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {}, requestAnimationFrame: () => 0, MutationObserver: function () { this.observe = () => {}; }, URLSearchParams, URL, TextEncoder, TextDecoder };
win.window = win; win.self = win; win.globalThis = win; const ctx = vm.createContext(win);
for (const f of ['rjs/config.js', 'rjs/pet-core.js', 'rjs/game-core.js', 'rjs/bonus-gear.js', 'js/pet-core.js', 'js/bonus-gear.js', 'js/v2-gear.js', 'js/v2-fit.js', 'js/v2-rules.js', 'js/v2-render.js', 'js/pet-score.js', 'js/v2-quest-clarity.js']) vm.runInContext(rd(f), ctx, { filename: f });
const V = ctx.V2Rules, R = ctx.V2Render, S = ctx.PetScore;
let pass = 0, fail = 0; const t = (n, f) => { try { f(); pass++; console.log('ok   ' + n); } catch (e) { fail++; console.log('FAIL ' + n + ': ' + (e && e.message)); } };
const mk = (id, o) => Object.assign({ id, name: 'P' + id, species: 'pepe', parents: null, children: [], breeds: 0, breedsV2: 0, lastBreed: null }, o || {});
function world() { const P = mk(1, { breeds: 1, breedsV2: 1, lastBreed: 972700, children: [3] }), M = mk(2, { breeds: 1, breedsV2: 1, children: [3] }), B = mk(3, { parents: [1, 2] }),
    Q = mk(4, { breeds: 6, breedsV2: 6, lastBreed: 973100, children: [] }), J1 = mk(5, { parents: [1], jackpot: { from: 1, wild: 'doge', block: 973391 } }),
    T1 = mk(6, { parents: [4], twinOf: 7, jackpot: { from: 4, wild: 'mumu', block: 973500 } }), T2 = mk(7, { parents: [4], twinOf: 6, jackpot: { from: 4, wild: 'mumu', block: 973500 } }), G = mk(8, { parents: [5, 3] });
  const pets = [P, M, B, Q, J1, T1, T2, G], byId = {}; pets.forEach(p => { byId[p.id] = p; }); return { pets, byId, tip: 974300 }; }

const CG = V.ACTIVATE_JACKPOT_CHILD_BLOCK, NG = V.ACTIVATE_JACKPOT_NOBREED_BLOCK, Q = ctx.V2QuestClarity;
const both = (c, n, f) => { V._setJackpotChildActivation(c); V._setJackpotNobreedActivation(n); try { return f(); } finally { V._setJackpotChildActivation(CG); V._setJackpotNobreedActivation(NG); } };
t('gate set after the jackpot-child gate, off before it', () => { assert.ok(NG > CG, NG + ' > ' + CG); assert.strictEqual(V.jackpotNobreedOn(NG - 1), false); assert.strictEqual(V.jackpotNobreedOn(NG), true); assert.strictEqual(V.jackpotNobreedOn(null), false); });
t('before the gate: the give-back sweep changes nothing (world identical)', () => both(974250, 974400, () => { const w = world(); V._jackpotChildSweep(w, 974250); const s = JSON.stringify(w); V._jackpotNobreedSweep(w, 974399); assert.strictEqual(JSON.stringify(w), s); assert.strictEqual(w.byId[1].breedsV2, 2); assert.strictEqual(w.byId[4].breedsV2, 7); }));
t('at the gate: lifetime breeds used by jackpot eggs come back (twins once); children, breeds and cooldown stay', () => both(974250, 974400, () => { const w = world(); V._jackpotChildSweep(w, 974250); V._jackpotNobreedSweep(w, 974400);
  const P = w.byId[1], Qp = w.byId[4]; assert.strictEqual(P.breedsV2, 1); assert.strictEqual(Qp.breedsV2, 6); assert.strictEqual(P.breeds, 2); assert.strictEqual(Qp.breeds, 7);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(P.children)), [3, 5]); assert.deepStrictEqual(JSON.parse(JSON.stringify(Qp.children)), [6, 7]); assert.strictEqual(P.lastBreed, 972700); assert.strictEqual(Qp.lastBreed, 973100);
  assert.ok(w.byId[5].jackpot.child && w.byId[6].jackpot.child && w.byId[7].jackpot.child); assert.deepStrictEqual(JSON.parse(JSON.stringify(w.jackpotNobreedDone)), { block: 974400, pets: 2, slots: 2 });
  assert.strictEqual(V.breedsLeft(P, 974400).left, 5); assert.strictEqual(V.breedsLeft(Qp, 974400).left, 0); assert.strictEqual(w.byId[2].breedsV2, 1); }));
t('the give-back runs once', () => both(974250, 974400, () => { const w = world(); V._jackpotChildSweep(w, 974250); V._jackpotNobreedSweep(w, 974400); const s = JSON.stringify(w); V._jackpotNobreedSweep(w, 974410); V._jackpotChildSweep(w, 974410); assert.strictEqual(JSON.stringify(w), s); }));
t('from the gate a new jackpot egg is a child and a Breedings count but no lifetime breed', () => both(974250, 974400, () => { const w = world(); V._jackpotChildSweep(w, 974250); V._jackpotNobreedSweep(w, 974400);
  const K = mk(9, { parents: [1], jackpot: { from: 1, wild: 'doge', block: 974420 } }); w.pets.push(K); w.byId[9] = K; const P = w.byId[1], b0 = P.breedsV2;
  w.jackpotChildDone = null; V._jackpotChildSweep(w, 974420); /* counts any uncounted egg the same way jackpotEgg does */
  assert.ok(K.jackpot.child); assert.ok(P.children.includes(9)); assert.strictEqual(P.breeds, 3); assert.strictEqual(P.breedsV2, b0); assert.strictEqual(V.jackpotUsedBreed(w, K), false); }));
t('jackpotUsedBreed: counted pre-gate eggs yes (a twin pair once), others no', () => both(974250, 974400, () => { const w = world(); assert.strictEqual(V.jackpotUsedBreed(w, w.byId[5]), false); V._jackpotChildSweep(w, 974250);
  assert.strictEqual(V.jackpotUsedBreed(w, w.byId[5]), true); assert.strictEqual(V.jackpotUsedBreed(w, w.byId[6]), true); assert.strictEqual(V.jackpotUsedBreed(w, w.byId[7]), false); assert.strictEqual(V.jackpotUsedBreed(w, w.byId[3]), false); }));
t('a jackpot egg from before breeding v2 never used a lifetime breed, so nothing comes back for it', () => both(972000, 974400, () => { const w = world(); w.byId[5].jackpot.block = 972000; V._jackpotChildSweep(w, 972000); assert.strictEqual(w.byId[1].breedsV2, 1); V._jackpotNobreedSweep(w, 974400); assert.strictEqual(w.byId[1].breedsV2, 1); }));
t('pet page: Breedings line says the jackpot egg uses no lifetime breed only from the gate', () => both(974250, 974400, () => { const w = world(); V._jackpotChildSweep(w, 974250);
  const pre = R.familyHtml(w, w.byId[1], 974300); assert.ok(/1 from a quest jackpot egg\)/.test(pre), pre); assert.ok(!/lifetime breed\)/.test(pre)); assert.ok(/Lifetime breeds:<\/b> <span class="brused">2\/6/.test(pre), pre);
  V._jackpotNobreedSweep(w, 974400); const h = R.familyHtml(w, w.byId[1], 974400), h4 = R.familyHtml(w, w.byId[4], 974400);
  assert.ok(/Breedings:<\/b> 2 <span class="muted">\(1 from a quest jackpot egg, which doesn\u2019t use a lifetime breed\)/.test(h), h); assert.ok(/Lifetime breeds:<\/b> <span class="brused">1\/6/.test(h), h); assert.ok(/7 <span class="muted">\(1 from a quest jackpot egg, which doesn/.test(h4), h4); }));
t('quest-clarity Cold Storage note agrees with the rule on each side of the gate', () => both(974250, 974400, () => { const w = world(); const p = Object.assign(mk(10, { stage: 5, stats: { vigor: 30, spark: 30, grit: 30, zoom: 30, luck: 30 } })); w.pets.push(p); w.byId[10] = p;
  const txt = b => (Q.outcomes(w, p, 'cold', b) || '').replace(/<[^>]+>/g, ' ');
  const a = txt(974300), c = txt(974400); assert.ok(/uses 1 of this pet.s 6 lifetime breeds/.test(a), a); assert.ok(/uses none of its 6 lifetime breeds/.test(c), c); assert.ok(!/uses 1 of/.test(c)); }));
const RH = rd('rules.html'), sec = RH.slice(RH.indexOf('id="jackpot-eggs"'), RH.indexOf('id="v2rules"'));
t('rules.html: jackpot section and rule history show the gate from v2-rules and say no lifetime breed', () => { const n = NG.toLocaleString('en-US'), c = CG.toLocaleString('en-US');
  assert.strictEqual((RH.match(new RegExp('JACKPOT-NOBREED-GATE[^>]*-->' + n + '|' + n + ' <!-- JACKPOT-NOBREED-GATE', 'g')) || []).length, 2);
  assert.ok(/does <b>not<\/b> use any of the parent's <b>6 lifetime breeds<\/b>/.test(sec)); assert.ok(sec.includes('given back at block ' + n)); assert.ok(sec.includes('from block ' + c)); assert.ok(!/as <b>one of its 6 lifetime breeds/.test(sec));
  assert.ok(/<li data-jackpot-nobreed><b>/.test(RH)); assert.ok(!/\u00d7|series|discount/i.test(sec)); });
console.log(`jackpot-nobreed-test: ${pass} pass, ${fail} fail`); process.exitCode = fail ? 1 : 0;
