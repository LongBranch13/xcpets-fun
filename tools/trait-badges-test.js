#!/usr/bin/env node
/* trait-badges-1126 tests (display only): every special trait a pet is BORN with (Legendary Mix, twin, throwback, mutation, 1 of 1 cross, rare tier)
 * comes from ONE list (V2Render.traitsOf) and shows as the same tappable chip (traitChips) on the pet page, My Pets cards, the pet card and the hover card.
 * Jake Nov 26 2026: Yaboli #216448 had White Rabbit ears; only a line far down the page said why. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const ROOT = path.resolve(__dirname, '..'), rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const store = {}, ls = { getItem: k => store[k] || null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
const el = () => ({ style: {}, appendChild() {}, setAttribute() {}, addEventListener() {}, getContext: () => null, classList: { add() {}, remove() {}, toggle() {} } });
const doc = { createElement: el, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, head: null, documentElement: el(), body: el() };
const win = { console: { log() {}, warn() {}, error() {}, info() {} }, localStorage: ls, sessionStorage: ls, document: doc, location: { search: '', hostname: 'xcpets.fun', href: 'https://xcpets.fun/' }, navigator: { userAgent: 'node' }, setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {}, requestAnimationFrame: () => 0, MutationObserver: function () { this.observe = () => {}; }, URLSearchParams, URL, TextEncoder, TextDecoder };
win.window = win; win.self = win; win.globalThis = win; const ctx = vm.createContext(win);
for (const f of ['rjs/config.js', 'rjs/pet-core.js', 'rjs/game-core.js', 'rjs/bonus-gear.js', 'js/pet-core.js', 'js/bonus-gear.js', 'js/v2-gear.js', 'js/v2-fit.js', 'js/v2-rules.js', 'js/species-registry.js', 'js/v2-render.js', 'js/pet-score.js']) vm.runInContext(rd(f), ctx, { filename: f });
const V = ctx.V2Rules, R = ctx.V2Render, S = ctx.PetScore;
let pass = 0; const t = (name, fn) => { fn(); pass++; console.log('ok', name); };
const w = { byId: {}, pets: [] };
const yab = { id: 216448, species: 'hybrid', tier: 3, parents: [1, 2], hybrid: { legMix: 'rabbit', roots: ['peepo', 'nakamoto'], parts: [{ sp: 'peepo', part: Object.keys({ x: 1 })[0] }, { sp: 'rabbit', part: 'ears' }] } };
const plain = { id: 3, species: 'peepo', tier: 1, parents: [] };
t('Legendary Mix: named, says which species and which body part it borrowed, and the 1 in 4 odds', () => { const L = R.traitsOf(w, yab), m = L.filter(x => x.id === 'leg-mix')[0]; assert(m, 'no leg-mix'); assert.strictEqual(m.name, 'Legendary Mix'); assert(/White Rabbit/.test(m.tip), m.tip); assert(/ears/.test(m.tip), m.tip); assert(/1 in 4/.test(m.tip), m.tip); assert(/Looks only/.test(m.tip)); });
t('Legendary Mix from a quest Jackpot Egg gives the jackpot odds', () => { const m = R.traitsOf(w, Object.assign({}, yab, { jackpot: { from: 1, wild: 'frog', block: 1 } }))[0]; assert(/Jackpot Egg \(1 in 2/.test(m.tip), m.tip); });
t('a plain pet has no trait chips', () => { assert.deepStrictEqual(Array.from(R.traitsOf(w, plain)), []); assert.strictEqual(R.traitChips(w, plain), ''); });
const all = { id: 9, species: 'hybrid', tier: 3, parents: [1, 2], twinOf: 10, shows: 'frost', mutation: { kind: 'glitch', hue: 90, seed: 1 }, hybrid: { legMix: 'rabbit', roots: ['peepo', 'nakamoto'], parts: [] }, art: { cross: { tell: Object.keys({ a: 1 })[0], body: 'bo' }, rareTier: 'seraph' } };
t('every born trait the bottom Badges list shows is also a chip up top (one list, nothing left behind)', () => { const born = /^(mutant|leg-mix|twin|throwback|cross|rare-)/;
  const want = V.breederBadges(w, all).map(x => x.id).filter(id => born.test(id)), got = R.traitsOf(w, all).map(x => x.id); assert(want.length >= 5, want.join()); want.forEach(id => assert(got.indexOf(id) >= 0, 'missing chip for ' + id)); });
t('chips are tappable and carry the explainer (data-trait-tip + title), card mode uses short names', () => { const h = R.traitChips(w, yab); assert(/class="chip trait trait-legmix"/.test(h)); assert(/data-trait-tip="Legendary Mix: /.test(h)); assert(/role="button"/.test(h) && /tabindex="0"/.test(h)); assert(/👑 Legendary Mix/.test(h));
  const c = R.traitChips(w, all, "card"); assert(/🧬 Glitch</.test(c), c); assert(/♊ Twin</.test(c)); assert(/Frosted tips</.test(c)); });
t('the explainer text is escaped (no HTML from a pet field)', () => { const h = R.traitChips(w, Object.assign({}, plain, { twinOf: '<b>x</b>' })); assert(!/<b>x<\/b>/.test(h)); });
t('mutation chip keeps the wording players know (Glitch mutation)', () => { assert(/🧬 Glitch mutation/.test(R.traitChips(w, all))); });
console.log('trait-badges: ' + pass + ' passed, 0 failed');
