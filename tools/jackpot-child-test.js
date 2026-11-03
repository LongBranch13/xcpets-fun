#!/usr/bin/env node
/* jackpot-child-1102 tests (dev tooling only): gated rule "a quest jackpot egg is a child and one breed of its parent" (sweep at the gate, twins once, no cooldown), gated V2Rules.genOf, rules.html section. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const ROOT = path.resolve(__dirname, '..'), rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const store = {}, ls = { getItem: k => store[k] || null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
const el = () => ({ style: {}, appendChild() {}, setAttribute() {}, addEventListener() {}, getContext: () => null, classList: { add() {}, remove() {}, toggle() {} } });
const doc = { createElement: el, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, head: null, documentElement: el(), body: el() };
const win = { console: { log() {}, warn() {}, error() {}, info() {} }, localStorage: ls, sessionStorage: ls, document: doc, location: { search: '', hostname: 'xcpets.fun', href: 'https://xcpets.fun/' }, navigator: { userAgent: 'node' }, setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {}, requestAnimationFrame: () => 0, MutationObserver: function () { this.observe = () => {}; }, URLSearchParams, URL, TextEncoder, TextDecoder };
win.window = win; win.self = win; win.globalThis = win; const ctx = vm.createContext(win);
for (const f of ['rjs/config.js', 'rjs/pet-core.js', 'rjs/game-core.js', 'rjs/bonus-gear.js', 'js/pet-core.js', 'js/bonus-gear.js', 'js/v2-gear.js', 'js/v2-fit.js', 'js/v2-rules.js', 'js/v2-render.js', 'js/pet-score.js']) vm.runInContext(rd(f), ctx, { filename: f });
const V = ctx.V2Rules, R = ctx.V2Render, S = ctx.PetScore;
let pass = 0, fail = 0; const t = (n, f) => { try { f(); pass++; console.log('ok   ' + n); } catch (e) { fail++; console.log('FAIL ' + n + ': ' + (e && e.message)); } };
const mk = (id, o) => Object.assign({ id, name: 'P' + id, species: 'pepe', parents: null, children: [], breeds: 0, breedsV2: 0, lastBreed: null }, o || {});
function world() { const P = mk(1, { breeds: 1, breedsV2: 1, lastBreed: 972700, children: [3] }), M = mk(2, { breeds: 1, breedsV2: 1, children: [3] }), B = mk(3, { parents: [1, 2] }),
    Q = mk(4, { breeds: 6, breedsV2: 6, lastBreed: 973100, children: [] }), J1 = mk(5, { parents: [1], jackpot: { from: 1, wild: 'doge', block: 973391 } }),
    T1 = mk(6, { parents: [4], twinOf: 7, jackpot: { from: 4, wild: 'mumu', block: 973500 } }), T2 = mk(7, { parents: [4], twinOf: 6, jackpot: { from: 4, wild: 'mumu', block: 973500 } }), G = mk(8, { parents: [5, 3] });
  const pets = [P, M, B, Q, J1, T1, T2, G], byId = {}; pets.forEach(p => { byId[p.id] = p; }); return { pets, byId, tip: 974300 }; }
const GATE0 = V.ACTIVATE_JACKPOT_CHILD_BLOCK;
t('gate set (974435 at deploy, or a placeholder) and off before it', () => { assert.ok(GATE0 >= 974435); assert.strictEqual(V.jackpotChildOn(974300), false); assert.strictEqual(V.jackpotChildOn(GATE0 - 1), false); assert.strictEqual(V.jackpotChildOn(GATE0), true); });
t('before the gate: the sweep changes nothing and genOf ignores one-parent pets', () => { const w = world(), s = JSON.stringify(w); V._jackpotChildSweep(w, 974300); assert.strictEqual(JSON.stringify(w), s); assert.strictEqual(V.genOf(w, w.byId[5]), 0); });
t('at the gate: each jackpot egg becomes a child and one breed (twins once), no cooldown', () => { V._setJackpotChildActivation(974250); try { const w = world(); V._jackpotChildSweep(w, 974250);
  const P = w.byId[1], Q = w.byId[4]; assert.deepStrictEqual(JSON.parse(JSON.stringify(P.children)), [3, 5]); assert.strictEqual(P.breeds, 2); assert.strictEqual(P.breedsV2, 2); assert.strictEqual(P.lastBreed, 972700);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(Q.children)), [6, 7]); assert.strictEqual(Q.breeds, 7); assert.strictEqual(Q.breedsV2, 7); assert.strictEqual(Q.lastBreed, 973100);
  assert.ok(w.byId[5].jackpot.child && w.byId[6].jackpot.child && w.byId[7].jackpot.child); assert.strictEqual(w.jackpotChildDone.n, 2);
  assert.strictEqual(w.byId[2].breeds, 1); } finally { V._setJackpotChildActivation(GATE0); } });
t('the sweep runs once', () => { V._setJackpotChildActivation(974250); try { const w = world(); V._jackpotChildSweep(w, 974250); const s = JSON.stringify(w); V._jackpotChildSweep(w, 974260); assert.strictEqual(JSON.stringify(w), s); } finally { V._setJackpotChildActivation(GATE0); } });
t('a parent over the cap: count shows it, no breeds left', () => { V._setJackpotChildActivation(974250); try { const w = world(); V._jackpotChildSweep(w, 974250); const bl = V.breedsLeft(w.byId[4], 974300); assert.strictEqual(bl.used, 7); assert.strictEqual(bl.left, 0); } finally { V._setJackpotChildActivation(GATE0); } });
t('gated genOf matches the pages (jackpot egg = parent + 1, its baby one more)', () => { V._setJackpotChildActivation(974250); try { const w = world();
  assert.strictEqual(V.genOf(w, w.byId[5]), 1); assert.strictEqual(V.genOf(w, w.byId[8]), 2); w.pets.forEach(p => assert.strictEqual(V.genOf(w, p), R.genOf(w, p), 'pet #' + p.id)); } finally { V._setJackpotChildActivation(GATE0); } });
t('genOf before the gate is unchanged for two-parent pets', () => { const w = world(); assert.strictEqual(V.genOf(w, w.byId[3]), 1); assert.strictEqual(V.genOf(w, w.byId[8]), 2); });
t('pet page: Breedings line names the counted jackpot eggs', () => { V._setJackpotChildActivation(974250); try { const w = world(); V._jackpotChildSweep(w, 974250);
  const h1 = R.familyHtml(w, w.byId[1], 974300), h4 = R.familyHtml(w, w.byId[4], 974300); assert.ok(/Breedings:<\/b> 2[^]*1 from a quest jackpot egg/.test(h1), h1); assert.ok(/1 from a quest jackpot egg/.test(h4), h4);
  const w0 = world(); assert.ok(!/from a quest jackpot egg/.test(R.familyHtml(w0, w0.byId[1], 974300))); } finally { V._setJackpotChildActivation(GATE0); } });
const RH = rd('rules.html');
t('rules.html: quest jackpot egg section with odds from the rules', () => { const sec = RH.slice(RH.indexOf('id="jackpot-eggs"'), RH.indexOf('id="v2rules"')); assert.ok(sec.length > 100);
  const src = rd('js/v2-rules.js'), J = JSON.parse(src.match(/var JACKPOT = (\{[^}]*\})/)[1].replace(/(\w+):/g, '"$1":'));
  assert.ok(sec.includes('mutation 1 in ' + J.mutation1In)); assert.ok(sec.includes('twins 1 in ' + J.twin1In)); assert.ok(sec.includes('hidden trait 1 in ' + J.hidden1In)); assert.ok(sec.includes('three-way mix look 1 in ' + J.legMix1In));
  assert.ok(sec.includes('1 in 100')); assert.ok(sec.includes('1 in 69')); assert.ok(!/\u00d7|series|discount/i.test(sec)); });
t('rules.html: the gate block is shown and matches v2-rules', () => { assert.ok((RH.match(/JACKPOT-CHILD-GATE/g) || []).length >= 2); assert.ok(!/go-live/.test(RH)); const n = GATE0.toLocaleString('en-US'); assert.strictEqual((RH.match(new RegExp('JACKPOT-CHILD-GATE[^>]*-->' + n + '|' + n + ' <!-- JACKPOT-CHILD-GATE', 'g')) || []).length, 2); });
console.log(`jackpot-child-test: ${pass} pass, ${fail} fail`); process.exitCode = fail ? 1 : 0;
