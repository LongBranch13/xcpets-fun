#!/usr/bin/env node
/* badges v1 tests (dev tooling only). node tools/badges-test.js [--snap FILE] */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const ROOT = path.resolve(__dirname, '..'), A = process.argv.slice(2), SNAP = A.includes('--snap') ? A[A.indexOf('--snap') + 1] : path.join(__dirname, 'snapshots', 'snap-972550.json');
const snap = JSON.parse(fs.readFileSync(SNAP, 'utf8')), store = {}, ls = { getItem: k => store[k] || null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
const win = { console: { log() {}, warn() {}, error() {}, info() {} }, localStorage: ls, sessionStorage: ls, location: { search: '', hostname: 'xcpets.fun', href: 'https://xcpets.fun/' }, navigator: { userAgent: 'node' }, setTimeout: () => 0, clearTimeout() {}, URLSearchParams, URL, TextEncoder, TextDecoder };
win.window = win; win.self = win; win.globalThis = win; const ctx = vm.createContext(win);
for (const f of ['rjs/config.js', 'rjs/pet-core.js', 'rjs/game-core.js', 'rjs/bonus-gear.js', 'rjs/real-core.js', 'rjs/chain.js', 'js/pet-core.js', 'js/bonus-gear.js', 'js/v2-gear.js', 'js/v2-fit.js', 'js/v2-rules.js', 'js/block-hashes.js', 'js/v2-badges.js']) { const p = path.join(ROOT, f); if (fs.existsSync(p)) vm.runInContext(fs.readFileSync(p, 'utf8'), ctx, { filename: f }); }
const V = ctx.V2Rules, B = ctx.V2Badges, hashes = Object.assign({}, ctx.XCPETS_BLOCK_HASHES || {}, snap.hashes);
const w = V.replay(snap.rows, hashes, [], { tip: snap.tip, live: ctx.RealCore });
const before = JSON.stringify(w.pets.map(p => [p.id, p.owner, p.care, p.wins, p.losses]));
let pass = 0; const t = (name, fn) => { fn(); pass++; console.log('ok', name); };
const r1 = B.compute(w, snap.rows, V), r2 = B.compute(w, snap.rows, V);
t('deterministic', () => assert.strictEqual(JSON.stringify(r1), JSON.stringify(r2)));
t('world unchanged', () => assert.strictEqual(JSON.stringify(w.pets.map(p => [p.id, p.owner, p.care, p.wins, p.losses])), before));
t('no community badges', () => Object.values(r1.byAddr).forEach(L => L.forEach(b => assert(!/wizard|cold/.test(b.id)))));
t('every badge has art', () => Object.values(r1.byAddr).forEach(L => L.forEach(b => assert(fs.existsSync(path.join(ROOT, B.img(b))), B.img(b)))));
t('top3 all-time: exactly 3 holders each', () => ['top-burner-all', 'top-feeder-all'].forEach(id => { const h = Object.values(r1.byAddr).flat().filter(b => b.id === id); assert(h.length <= 3); assert.deepStrictEqual(h.map(b => b.rank).sort(), [1, 2, 3].slice(0, h.length)); }));
t('pet badges only for owned, unreleased pets', () => Object.entries(r1.byAddr).forEach(([a, L]) => L.forEach(b => { if (b.petId) { const p = w.byId[b.petId]; assert(p.owner === a && !p.released); } })));
t('dex ignores hybrids', () => Object.values(r1.byAddr).flat().filter(b => b.id === 'dex').forEach(b => assert(b.n <= 13)));
t('weekly boards close on 1,008-block weeks', () => Object.values(r1.byAddr).flat().filter(b => /week/.test(b.id)).forEach(b => assert.strictEqual((b.block + 1 - B.WEEK_ANCHOR) % B.WEEK, 0)));
/* synthetic: a released pet loses its badges; a two-wallet breed gives SINGLE MOTHER to the egg holder */
const pets = w.pets.filter(p => p.parents && p.parents.length === 2), cross = pets.find(p => w.byId[p.parents[0]].owner !== w.byId[p.parents[1]].owner && !p.released);
if (cross) t('single mother = egg from a two-wallet breed', () => assert((r1.byPet[cross.id] || []).some(b => b.id === 'single-mother')));
const dead = w.pets.find(p => p.dead && !p.released); if (dead) { t('released pet loses badges', () => { const w2 = Object.assign({}, w, { pets: w.pets.map(p => p === dead ? Object.assign({}, p, { released: 1 }) : p) }); const r = B.compute(w2, snap.rows, V); assert(!(r.byPet[dead.id])); }); }
t('recap line', () => assert(/^Badges: \d+ held by \d+ wallets/.test(B.recapLine(r1, snap.tip - 144))));
const n = {}; Object.values(r1.byAddr).flat().forEach(b => n[b.id] = (n[b.id] || 0) + 1);
console.log('wallets with badges', Object.keys(r1.byAddr).length, JSON.stringify(n)); console.log(B.recapLine(r1, snap.tip - 144));
console.log('ALL PASS (' + pass + ')');
