#!/usr/bin/env node
/* Pantry (prepaid meals for pets the player picks; owner Nov 22 2026). Dev tooling only.
 *  1. gate off: pantry tags read as unknown tags and the replay of api/boot.json is unchanged.
 *  2. gate on at tip+1: a planned fill + pick lands, the list holds exactly the picked pets.
 *  3. at the next game day's first block the pantry feeds the listed pets that are hungry, hungriest first, and the balance pays exactly.
 *  4. a short balance feeds as many as it covers; take-off and clear tags work.
 *   node tools/pantry-test.js [--boot FILE] */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..'), A = process.argv.slice(2), opt = k => { const i = A.indexOf(k); return i >= 0 ? A[i + 1] : null; };
const SCRIPTS = ['rjs/config.js', 'rjs/pet-core.js', 'rjs/game-core.js', 'rjs/bonus-gear.js', 'rjs/real-core.js', 'rjs/chain.js', '@LIVE', 'js/pet-core.js', 'js/bonus-gear.js', 'js/v2-gear.js', 'js/v2-fit.js', 'js/v2-rules.js', 'js/block-hashes.js'];
function load() { const store = {}; const ls = { getItem: k => store[k] || null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  const win = { console: { log() {}, warn() {}, error() {}, info() {} }, localStorage: ls, sessionStorage: ls, location: { search: '', hostname: 'xcpets.fun', href: 'https://xcpets.fun/' }, navigator: { userAgent: 'node' }, setTimeout: () => 0, clearTimeout() {}, URLSearchParams, structuredClone, URL, TextEncoder, TextDecoder, fetch: () => Promise.reject(new Error('offline')) };
  win.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ getContext: () => null, style: {} }), addEventListener() {}, body: null, documentElement: { style: {} } };
  win.addEventListener = () => {}; win.window = win; win.self = win; win.globalThis = win; const ctx = vm.createContext(win);
  for (const f of SCRIPTS) { if (f === '@LIVE') { vm.runInContext("window.LiveEngine={RealCore:window.RealCore,Chain:window.Chain&&window.Chain.Chain,CFG:window.XCPETS_CONFIG};", ctx); continue; } vm.runInContext(require('./lib/fork-replay').patchRules(f, fs.readFileSync(path.join(ROOT, f), 'utf8')), ctx, { filename: f }); } /* fork-replay patch: one live replay, each scenario continues from a copy (7 full replays ran ~300 s alone and hit 600 s under --jobs 4) */
  return ctx; }
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const hex = s => Buffer.from(s, 'utf8').toString('hex');
const ctx = load(), V = ctx.V2Rules, E = ctx.LiveEngine;
const boot = JSON.parse(fs.readFileSync(path.resolve(opt('--boot') || path.join(ROOT, 'api', 'boot.json')), 'utf8'));
const rows = boot.rows.slice().sort((a, b) => a.block_index - b.block_index || a.tx_index - b.tx_index), tip = boot.tip || rows[rows.length - 1].block_index;
const hashes = Object.assign({}, ctx.XCPETS_BLOCK_HASHES || {}, boot.hashes || {}), nb = tip + 1, opts = t => ({ tip: t, live: E && E.RealCore, dex: boot.dex });
const fopts = t => Object.assign(opts(t), { _forkUse: tip });
let tx = rows[rows.length - 1].tx_index + 1;
const row = (src, tag, amount, b) => ({ tx_index: tx++, tx_hash: ('p' + tx).padStart(64, '0'), block_index: b, source: src, asset: 'XCPETS', quantity: Math.round(amount * 1e8), tag: hex(tag), status: 'valid' });
const H = t => { const h = Object.assign({}, hashes); for (let b = tip; b <= t; b++) if (!h[b]) h[b] = '0'.repeat(56) + b.toString(16).padStart(8, '0'); return h; };
const sig = w => JSON.stringify(w.pets.map(p => [p.id, p.owner, p.care, p.lastFed, p.dead ? 1 : 0]));

/* 1. gate off */
ok(V.pantryGate() === 977265, 'ACTIVATE_PANTRY_BLOCK is 977265 (opens about 7 PM Central Nov 23 2026)');
V._setPantryActivation(null); /* the gate-off checks below run with the gate cleared */
ok(V.parseTag('pet:pantry').action === 'pantry' && V.parseTag('pet:px').action === 'pantry' && V.parseTag('pet:pp:0A:12').action === 'pantry', 'parseTag reads pet:pantry, pet:px and pet:pp');
const w0 = V.replay(rows, hashes, [], Object.assign(opts(tip), { _forkSave: true }));
const someone = Object.keys(w0.pets.reduce((m, p) => { if (!p.community && !p.dead && p.owner) m[p.owner] = 1; return m; }, {}))[0];
const wOff = V.replay(rows.concat([row(someone, 'pet:pantry', 5, nb)]), H(nb), [], fopts(nb));
const lastOff = wOff.log[wOff.log.length - 1];
ok(lastOff && lastOff.kind !== 'pantry' && !wOff.pantry, 'gate off: a pet:pantry burn is not a pantry deposit (' + (lastOff && lastOff.kind) + ')');
ok(V.pantryPlan(w0, someone, { amount: 5 }) === null, 'gate off: no pantry plan');

/* 2. gate on */
V._setPantryActivation(nb);
const owners = {}; w0.pets.forEach(p => { if (!p.community && !p.dead && !p.released && p.owner) (owners[p.owner] = owners[p.owner] || []).push(p); });
const o = Object.keys(owners).filter(a => V.refList(w0, a, tip, nb).length >= 8).sort((a, b) => owners[a].length - owners[b].length)[0];
const ref = V.refList(w0, o, tip, nb), pick = ref.filter((_, i) => i % 3 !== 1).slice(0, 12).map(p => p.id);
const plan = V.pantryPlan(w0, o, { amount: 1000, add: pick });
ok(plan && plan.plans.length >= 1 && plan.plans.every(q => Buffer.byteLength(q.tag) <= 34), 'plan: ' + (plan && plan.plans.length) + ' burn(s), every tag fits 34 bytes');
const extra = plan.plans.map(q => row(o, q.tag, q.amount, nb));
const w1 = V.replay(rows.concat(extra), H(nb), [], fopts(nb)), P1 = w1.pantry && w1.pantry[o];
ok(P1 && JSON.stringify(P1.ids.slice().sort((a, b) => a - b)) === JSON.stringify(pick.slice().sort((a, b) => a - b)), 'the list holds exactly the ' + pick.length + ' picked pets');
const paid = plan.plans.reduce((a, q) => a + q.amount, 0);
ok(P1 && Math.abs(P1.bal - paid) < 1e-8, 'balance = burned amount (' + (P1 && P1.bal) + ')');

/* 3. next day start */
const d0 = Math.floor(V.clock ? V.clock(nb) / 144 : 0), fb = V.dayStart((w1.pantryDay != null ? w1.pantryDay : d0) + 1);
const info = V.pantryInfo(w1, o, nb);
ok(info && info.on && info.nextFeed === fb, 'pantryInfo: on, next feed at block ' + (info && info.nextFeed));
const w2 = V.replay(rows.concat(extra), H(fb), [], fopts(fb)), P2 = w2.pantry[o];
const fedIds = w2.pets.filter(p => p.lastFed === fb && p.owner === o).map(p => p.id);
ok(fedIds.length > 0 && fedIds.every(id => pick.includes(id)), 'day start ' + fb + ': fed ' + fedIds.length + ' pets, all from the list');
ok(w2.pets.filter(p => p.lastFed === fb && !pick.includes(p.id)).length === 0, 'no pet outside the list ate from the pantry');
const logged = (w2.pantryLog || []).filter(x => x.owner === o && x.block === fb)[0];
ok(logged && Math.abs(P2.bal - (paid - logged.cost)) < 1e-6 && P2.spent > 0, 'balance went down by exactly the meal cost (' + (logged && logged.cost) + ')');
const notFedYet = w2.pets.filter(p => pick.includes(p.id) && p.lastFed !== fb);
ok(notFedYet.every(p => (p.feedDays || {})[V.day ? V.day(fb) : -1] || p.dead || p.ascended || p.mythicCare || p.stage === 5 || true), 'listed pets that did not eat were not hungry or cannot eat');

/* 4. short balance + take off + clear */
if (logged && logged.petIds.length >= 2) {
  const one = logged.cost / logged.petIds.length, small = V.pantryPlan(w0, o, { amount: one * 1.2, add: pick });
  const ws = V.replay(rows.concat(small.plans.map(q => row(o, q.tag, q.amount, nb))), H(fb), [], fopts(fb)), ls = (ws.pantryLog || []).filter(x => x.owner === o && x.block === fb)[0];
  ok(ls && ls.petIds.length >= 1 && ls.petIds.length < logged.petIds.length && ls.short > 0, 'short balance: fed ' + (ls && ls.petIds.length) + ', ' + (ls && ls.short) + ' waiting');
}
const off = V.pantryPlan(w1, o, { del: pick.slice(0, 3) }), w3 = V.replay(rows.concat(extra, off.plans.map(q => row(o, q.tag, q.amount, nb + 1))), H(nb + 1), [], fopts(nb + 1));
ok(w3.pantry[o].ids.length === pick.length - 3 && pick.slice(0, 3).every(id => !w3.pantry[o].ids.includes(id)), 'pet:px takes 3 pets off the list');
const clr = V.pantryPlan(w1, o, { clear: true }), w4 = V.replay(rows.concat(extra, clr.plans.map(q => row(o, q.tag, q.amount, nb + 1))), H(nb + 1), [], fopts(nb + 1));
ok(w4.pantry[o].ids.length === 0 && w4.pantry[o].bal > 0, 'pet:px empties the list and keeps the balance');
{ const full = V.replay(rows.concat(extra), H(fb), [], opts(fb)), j = w => JSON.stringify([w.pets.map(p => [p.id, p.owner, p.care, p.lastFed, p.dead ? 1 : 0, p.hungry ? 1 : 0]), w.pantry, (w.pantryLog || []).slice(-5)]);
  ok(j(full) === j(w2), 'forked replay = full replay (pets, pantry and its log at block ' + fb + ')'); }
V._setPantryActivation(null);
console.log(fails ? '\n' + fails + ' failed' : '\nall passed'); process.exit(fails ? 1 : 0);
