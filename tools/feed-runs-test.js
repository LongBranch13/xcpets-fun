#!/usr/bin/env node
/* feed-all-one-burn (owner Oct 28 2026): checks for the pet:fr one-burn feed tag. Dev tooling only.
 *  1. frVar / frDecode round trip, tag size.   2. gate: a pet:fr burn below ACTIVATE_FEED_RUNS_BLOCK reads exactly as before (unknown tag).
 *  3. live world (api/boot.json): for every owner, hungry pets vs pets that really eat, and the burns the planner needs.
 *  4. engine: the planned burns land at tip+1 and credit exactly the planned pets (no Mythic, no other pet).
 *  5. place stability: a pet that changes owner or dies after the anchor keeps its place in the list.
 *   node tools/feed-runs-test.js [--boot FILE] */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..'), A = process.argv.slice(2), opt = k => { const i = A.indexOf(k); return i >= 0 ? A[i + 1] : null; };
const SCRIPTS = ['rjs/config.js', 'rjs/pet-core.js', 'rjs/game-core.js', 'rjs/bonus-gear.js', 'rjs/real-core.js', 'rjs/chain.js', '@LIVE', 'js/pet-core.js', 'js/bonus-gear.js', 'js/v2-gear.js', 'js/v2-fit.js', 'js/v2-rules.js', 'js/block-hashes.js'];
function load() { const store = {}; const ls = { getItem: k => store[k] || null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  const win = { console: { log() {}, warn() {}, error() {}, info() {} }, localStorage: ls, sessionStorage: ls, location: { search: '', hostname: 'xcpets.fun', href: 'https://xcpets.fun/' }, navigator: { userAgent: 'node' }, setTimeout: () => 0, clearTimeout() {}, URLSearchParams, URL, TextEncoder, TextDecoder, fetch: () => Promise.reject(new Error('offline')) };
  win.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ getContext: () => null, style: {} }), addEventListener() {}, body: null, documentElement: { style: {} } };
  win.addEventListener = () => {}; win.window = win; win.self = win; win.globalThis = win; const ctx = vm.createContext(win);
  for (const f of SCRIPTS) { if (f === '@LIVE') { vm.runInContext("window.LiveEngine={RealCore:window.RealCore,Chain:window.Chain&&window.Chain.Chain,CFG:window.XCPETS_CONFIG};", ctx); continue; } const p = path.join(ROOT, f); if (fs.existsSync(p)) vm.runInContext(fs.readFileSync(p, 'utf8'), ctx, { filename: f }); }
  return ctx; }
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const hex = s => Buffer.from(s, 'utf8').toString('hex');
const ctx = load(), V = ctx.V2Rules, E = ctx.LiveEngine;
/* 1. encoding */
let rt = true; for (let k = 0; k < 2000; k++) { const a = Array.from({ length: 1 + (k % 9) }, (_, i) => Math.floor(Math.random() * (i % 3 ? 70000 : 300))); if (JSON.stringify(V.frDecode(a.map(V.frVar).join(''))) !== JSON.stringify(a)) { rt = false; break; } }
ok(rt, 'frVar / frDecode round trip (2,000 random lists)');
ok(V.frDecode('G') === null, 'an unfinished number does not decode');
ok(V.parseTag('pet:fr:00:01').action === 'feedr' && V.parseTag('pet:fr:00:0').action === 'invalid' && V.parseTag('pet:fr:00:00').action === 'invalid', 'parseTag: pet:fr needs 2+ values, each take run above 0');
ok(V.parseTag('pet:fr:00:' + '1'.repeat(26)).action === 'invalid', 'parseTag: tags over 34 bytes are rejected');
/* live world */
const boot = JSON.parse(fs.readFileSync(path.resolve(opt('--boot') || path.join(ROOT, 'api', 'boot.json')), 'utf8'));
const rows = boot.rows.slice().sort((a, b) => a.block_index - b.block_index || a.tx_index - b.tx_index), tip = boot.tip || rows[rows.length - 1].block_index;
const hashes = Object.assign({}, ctx.XCPETS_BLOCK_HASHES || {}, boot.hashes || {}), nb = tip + 1, opts = t => ({ tip: t, live: E && E.RealCore, dex: boot.dex });
const GATE0 = V.ACTIVATE_FEED_RUNS_BLOCK; V._setFeedRunsActivation(nb);
const w = V.replay(rows, hashes, [], opts(tip));
const owners = {}; w.pets.forEach(p => { if (!p.community && !p.dead && !p.released && p.owner) (owners[p.owner] = owners[p.owner] || []).push(p); });
console.log('\nlive world tip ' + tip + ' (' + rows.length + ' burns). Per owner: hungry (the old count) / Mythic among those / really eat / burns, old plan vs one-burn plan');
const res = [];
Object.keys(owners).forEach(o => { const ps = owners[o], hungry = ps.filter(p => p.hungry), eat = ps.filter(p => V.frEats(p, nb));
  const fr = eat.length ? V.feedRunsPlan(w, o, eat, nb) : [], old = eat.length ? V.feedQueue(w, o, eat.map(p => p.id), nb) : [];
  const oldL = eat.length && eat.length <= 3000 && V.FEED_ALL_BLOCK ? V.feedQueue(w, o, eat.map(p => p.id), V.FEED_ALL_BLOCK - 1).length : null; /* the old Feed selected (pet-number burns) */
  res.push({ o, n: ps.length, hungry: hungry.length, myth: hungry.filter(p => p.ascended || p.mythicCare || p.stage === 5).length, eat: eat.length, fr, old, oldL }); });
res.sort((a, b) => b.n - a.n).slice(0, 12).forEach(r => console.log('  ' + r.o.slice(0, 10) + '…  pets ' + r.n + '  hungry ' + r.hungry + '  Mythic ' + r.myth + '  eat ' + r.eat + '  burns: old Feed all ' + r.old.length + ', old Feed selected ' + (r.oldL == null ? 'n/a' : r.oldL) + ', one-burn ' + (r.fr ? r.fr.length : 'n/a') + (r.fr && r.fr[0] ? '  e.g. ' + r.fr[0].tag : '')));
ok(res.every(r => r.fr && r.fr.every(q => Buffer.byteLength(q.tag) <= 34)), 'every planned tag fits 34 bytes');
ok(res.every(r => r.fr.every(q => q.petIds.every(id => !w.byId[id].ascended && !w.byId[id].mythicCare && w.byId[id].stage !== 5))), 'no Mythic in any plan');
ok(res.every(r => r.fr.reduce((a, q) => a + q.petIds.length, 0) === r.eat), 'every plan covers all the pets that eat');
/* 3b. synthetic 400: the biggest owner, every living pet they own counted as an eater spot; worst case = random 400 of the list */
const big = res.slice().sort((a, b) => b.n - a.n)[0], list = V.refList(w, big.o, tip, nb);
function burnsFor(ids) { let runs = [], pos = 0, set = new Set(ids); for (let i = 0; i < list.length; i++) if (set.has(list[i].id)) { if (runs.length && runs[runs.length - 1][0] + runs[runs.length - 1][1] === i) runs[runs.length - 1][1]++; else runs.push([i, 1]); }
  let n = 0, len = 99; runs.forEach(r => { const add = (n && len < 99 ? V.frVar(r[0] - pos) : V.frVar(r[0])) + V.frVar(r[1]); if (!n || len + add.length > 24) { n++; len = V.frVar(r[0]).length + V.frVar(r[1]).length; } else len += add.length; pos = r[0] + r[1]; }); return { burns: n, runs: runs.length }; }
console.log('\nplace list of the biggest owner: ' + list.length + ' pets (Mythics left out)');
if (list.length >= 400) { const ids = list.map(p => p.id); [['400 in a row', ids.slice(0, 400)], ['400 with 1 skipped pet in every 40', ids.filter((_, i) => i % 41 !== 40).slice(0, 400)], ['400 with 1 skipped pet in every 15', ids.filter((_, i) => i % 16 !== 15).slice(0, 400)]].forEach(([l, s]) => { const b = burnsFor(s); console.log('  ' + l + ': ' + b.runs + ' runs -> ' + b.burns + ' burn(s)'); }); }
/* 4. engine */
const target = res.filter(r => r.eat > 0).sort((a, b) => b.eat - a.eat)[0];
if (target) { let tx = rows[rows.length - 1].tx_index + 1; const extra = target.fr.map(q => ({ tx_index: tx++, tx_hash: 'f'.repeat(64 - String(tx).length) + tx, block_index: nb, source: target.o, asset: 'XCPETS', quantity: Math.round(q.amount * 1e8), tag: hex(q.tag), status: 'valid' }));
  const h2 = Object.assign({}, hashes); if (!h2[nb]) h2[nb] = '0'.repeat(63) + '1';
  const w2 = V.replay(rows.concat(extra), h2, [], opts(nb)), want = new Set(target.fr.reduce((a, q) => a.concat(q.petIds), []));
  const fed = w2.pets.filter(p => p.lastFed === nb).map(p => p.id);
  ok(fed.length === want.size && fed.every(id => want.has(id)), 'engine: ' + target.fr.length + ' one-burn tag(s) fed exactly the ' + want.size + ' planned pets of the top eater owner');
  ok(fed.every(id => { const p = w.byId[id]; return !p.ascended && !p.mythicCare && p.stage !== 5; }), 'engine: no Mythic was fed');
  V._setFeedRunsActivation(nb + 1); const w3 = V.replay(rows.concat(extra), h2, [], opts(nb));
  ok(w3.pets.filter(p => p.lastFed === nb).length === 0, 'gate: the same burns one block before activation feed no pet (old reading: unknown tag)'); V._setFeedRunsActivation(nb); }
/* 5. place stability */
{ const l0 = V.refList(w, big.o, tip, nb).map(p => p.id), P = w.byId[l0[Math.floor(l0.length / 2)]], Q = w.byId[l0[1]], keep = { o: P.owner, g: P.lastGot, lb: w.leftBy && w.leftBy[P.id], d: Q.dead };
  w.leftBy = w.leftBy || {}; w.leftBy[P.id] = P.owner; P.owner = 'bc1qsomeoneelse'; P.lastGot = tip + 1; Q.dead = tip + 2;
  const l1 = V.refList(w, big.o, tip, tip + 3).map(p => p.id); ok(JSON.stringify(l0) === JSON.stringify(l1), 'places hold when a listed pet changes owner and another dies after the anchor');
  P.owner = keep.o; P.lastGot = keep.g; w.leftBy[P.id] = keep.lb; Q.dead = keep.d; }
V._setFeedRunsActivation(GATE0);
console.log('\n' + (fails ? fails + ' FAILED' : 'all ok') + '  (gate in the code: block ' + GATE0 + ')'); process.exitCode = fails ? 1 : 0;
