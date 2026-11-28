#!/usr/bin/env node
/* Pool Dip (pet:dip:ID halves the breed cooldown left, once per cooldown; owner Nov 23 2026). Dev tooling only.
 *  1. gate off (below ACTIVATE_POOL_DIP_BLOCK): pet:dip reads as an unknown tag and changes nothing.
 *  2. gate on: a pet on cooldown dips, its cooldown left is halved, breedable() agrees, the dip is logged.
 *  3. a second dip in the same cooldown, a dip by someone else, an underpaid dip and a dip off cooldown are rejected.
 *  4. after the next breed the pet can dip again.
 *   node tools/dip-test.js [--boot FILE] */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..'), A = process.argv.slice(2), opt = k => { const i = A.indexOf(k); return i >= 0 ? A[i + 1] : null; };
const SCRIPTS = ['rjs/config.js', 'rjs/pet-core.js', 'rjs/game-core.js', 'rjs/bonus-gear.js', 'rjs/real-core.js', 'rjs/chain.js', '@LIVE', 'js/pet-core.js', 'js/bonus-gear.js', 'js/v2-gear.js', 'js/v2-fit.js', 'js/v2-rules.js', 'js/block-hashes.js'];
function load() { const store = {}; const ls = { getItem: k => store[k] || null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  const win = { console: { log() {}, warn() {}, error() {}, info() {} }, localStorage: ls, sessionStorage: ls, location: { search: '', hostname: 'xcpets.fun', href: 'https://xcpets.fun/' }, navigator: { userAgent: 'node' }, setTimeout: () => 0, clearTimeout() {}, URLSearchParams, URL, TextEncoder, TextDecoder, fetch: () => Promise.reject(new Error('offline')) };
  win.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ getContext: () => null, style: {} }), addEventListener() {}, body: null, documentElement: { style: {} } };
  win.addEventListener = () => {}; win.window = win; win.self = win; win.globalThis = win; const ctx = vm.createContext(win);
  for (const f of SCRIPTS) { if (f === '@LIVE') { vm.runInContext("window.LiveEngine={RealCore:window.RealCore,Chain:window.Chain&&window.Chain.Chain,CFG:window.XCPETS_CONFIG};", ctx); continue; } vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }); }
  return ctx; }
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const hex = s => Buffer.from(s, 'utf8').toString('hex');
/* one live replay, then each scenario continues from a copy of it (tools/lib/fork-replay): 10 full replays ran ~600 s and hit the CI limit */
const ctx = require('./lib/fork-replay').load(), V = ctx.V2Rules, E = ctx.LiveEngine;
const boot = JSON.parse(fs.readFileSync(path.resolve(opt('--boot') || path.join(ROOT, 'api', 'boot.json')), 'utf8'));
const rows = boot.rows.slice().sort((a, b) => a.block_index - b.block_index || a.tx_index - b.tx_index), tip = boot.tip || rows[rows.length - 1].block_index;
const hashes = Object.assign({}, ctx.XCPETS_BLOCK_HASHES || {}, boot.hashes || {}), nb = tip + 1, opts = t => ({ tip: t, live: E && E.RealCore, dex: boot.dex });
let tx = rows[rows.length - 1].tx_index + 1;
const row = (src, tag, amount, b) => ({ tx_index: tx++, tx_hash: ('p' + tx).padStart(64, '0'), block_index: b, source: src, asset: 'XCPETS', quantity: Math.round(amount * 1e8), tag: hex(tag), status: 'valid' });
const H = t => { const h = Object.assign({}, hashes); for (let b = tip; b <= t; b++) if (!h[b]) h[b] = '0'.repeat(56) + b.toString(16).padStart(8, '0'); return h; };
const sig = w => JSON.stringify(w.pets.map(p => [p.id, p.owner, p.care, p.lastFed, p.dead ? 1 : 0]));

const last = w => w.log[w.log.length - 1];

/* pick two adult pets of one owner that can breed each other now, breed them at nb, then dip at nb + 100 */
/* Each world is ~570 MB at 215k pets (Nov 28 2026): a world is dropped (set to null) once its checks are done, or the
 * heap fills, GC thrashes and the test crawls past the 600 s limit. */
let w0 = V.replay(rows, hashes, [], Object.assign(opts(tip), { _forkSave: true }));
/* Written before the gate was mined. Each case below sets its own activation block, so a mined gate (feed tip past it) is fine too. */
ok(Number.isFinite(V.dipGate()), 'ACTIVATE_POOL_DIP_BLOCK is set (' + V.dipGate() + (V.dipGate() > tip ? ', above' : ', mined before') + ' the feed tip ' + tip + ')');
ok(V.parseTag('pet:dip:12').action === 'dip' && V.parseTag('pet:dip:12').petId === 12 && V.parseTag('pet:dip').action !== 'dip', 'parseTag reads pet:dip:ID only');
const by = {}; w0.pets.forEach(p => { if (p.owner && !V.breedable(p, nb)) (by[p.owner] = by[p.owner] || []).push(p); });
let pair = null;
for (const o of Object.keys(by)) { const L = by[o].slice(0, 40); for (let i = 0; i < L.length && !pair; i++) for (let j = i + 1; j < L.length && !pair; j++) if (!(V.kinWhy && V.breedV2On(nb) && V.kinWhy(L[i], L[j])) && !V.resPairWhy(L[i], L[j], nb)) pair = [L[i], L[j]]; if (pair) break; }
ok(!!pair, 'found a pair that can breed (' + (pair && pair.map(p => '#' + p.id).join(' x ')) + ')');
const PA = pair[0], PB = pair[1], o = PA.owner, b2 = nb + 100;
w0 = null;
const brd = row(o, 'pet:breed:' + PA.id + ':' + PB.id, 690, nb);

/* 1. gate off */
const gOff = V.dipGate(); V._setDipActivation(b2 + 1);
let wB = V.replay(rows.concat([brd]), H(b2), [], Object.assign(opts(b2), { _forkUse: tip })), a0 = wB.byId[PA.id];
ok(a0.lastBreed === nb, 'the breed landed (#' + PA.id + ' lastBreed ' + a0.lastBreed + ')');
let wOff = V.replay(rows.concat([brd, row(o, 'pet:dip:' + PA.id, 345, b2)]), H(b2), [], Object.assign(opts(b2), { _forkUse: tip }));
ok(last(wOff).kind === 'rejected' && /unknown pet: tag/.test(last(wOff).msg) && wOff.byId[PA.id].dipFor == null, 'gate off: pet:dip is an unknown tag (' + last(wOff).msg + ')');
wOff = null;

/* 2. gate on. Once the real gate is mined (feed tip past it), keep it: the checkpoint above replayed the chain's real dips
 * (first ones at 977,465), and moving the gate up to nb would turn those into unknown tags in a full replay only, so forked and
 * full worlds would follow two different rule sets (red from block 977,843, where a real dip changed a later breed). */
const ON = gOff != null && gOff <= tip ? gOff : nb;
V._setDipActivation(ON);
const left0 = V.dipLeft(wB.byId[PA.id], b2);
let wOn = V.replay(rows.concat([brd, row(o, 'pet:dip:' + PA.id, 345, b2)]), H(b2), [], Object.assign(opts(b2), { _forkUse: tip })), a1 = wOn.byId[PA.id];
ok(last(wOn).kind === 'dip' && a1.dipFor === nb && a1.dipCut === Math.floor(left0 / 2), 'dip lands: ' + last(wOn).msg);
const left1 = V.dipLeft(a1, b2);
ok(left1 === left0 - Math.floor(left0 / 2), 'cooldown left ' + left0 + ' -> ' + left1);
const ready = nb + V.mgBreedCool(a1);
ok(/cooldown/.test(V.breedable(a1, ready - 1) || '') && !V.breedable(a1, ready), 'breedable() agrees: on cooldown at ' + (ready - 1) + ', ready at ' + ready);
ok(!wOn.byId[PB.id].dipFor && V.dipLeft(wOn.byId[PB.id], b2) === left0, 'the partner keeps its full cooldown');
wOn = null;

/* 3. rejections */
const rej = (tag, amt, src, why) => { const w = V.replay(rows.concat([brd, row(o, 'pet:dip:' + PA.id, 345, b2)], [row(src, tag, amt, b2 + 1)]), H(b2 + 1), [], Object.assign(opts(b2 + 1), { _forkUse: tip })); ok(last(w).kind === 'rejected' && why.test(last(w).msg), last(w).msg); };
rej('pet:dip:' + PA.id, 345, o, /already dipped/);
rej('pet:dip:' + PB.id, V.dipInfo(wB, wB.byId[PB.id], b2 + 1).cost / 2, o, /below dip cost/);
const other = Object.keys(by).find(x => x !== o);
rej('pet:dip:' + PB.id, 345, other, /not your pet/);
const fresh = by[Object.keys(by).find(x => x !== o)][0];
rej('pet:dip:' + fresh.id, 345, fresh.owner, /not on breed cooldown/);

/* 4. the next breed opens a new dip */
const dips = [brd, row(o, 'pet:dip:' + PA.id, 345, b2), row(o, 'pet:dip:' + PB.id, 345, b2)];
let wD = V.replay(rows.concat(dips), H(b2), [], Object.assign(opts(b2), { _forkUse: tip }));
const b3 = nb + Math.max(V.mgBreedCool(wD.byId[PA.id]), V.mgBreedCool(wD.byId[PB.id])) + 5; wD = null;
let wR = V.replay(rows.concat(dips, [row(o, 'pet:breed:' + PA.id + ':' + PB.id, 690, b3), row(o, 'pet:dip:' + PA.id, 345, b3 + 10)]), H(b3 + 10), [], Object.assign(opts(b3 + 10), { _forkUse: tip }));
ok(wR.byId[PA.id].lastBreed === b3 && last(wR).kind === 'dip', 'both dipped, bred again at ' + b3 + ', and the pet can dip again (' + last(wR).msg + ')');
wR = null;
const info = V.dipInfo(wB, wB.byId[PA.id], b2);
ok(info && info.on && info.cost > 0 && info.after === left0 - Math.floor(left0 / 2) && info.why === null && info.tag === 'pet:dip:' + PA.id, 'dipInfo: cost ' + (info && info.cost) + ', ' + (info && info.left) + ' -> ' + (info && info.after));
wB = null;
/* the shortcut must not change the answer: the gate-on dip scenario, forked vs a full replay */
{ V._setDipActivation(ON); const ex = rows.concat([brd, row(o, 'pet:dip:' + PA.id, 345, b2)]);
  let f = V.replay(ex, H(b2), [], Object.assign(opts(b2), { _forkUse: tip })); const fs0 = sig(f), fp = JSON.stringify(f.byId[PA.id]); f = null;
  const full = V.replay(ex, H(b2), [], opts(b2));
  ok(fs0 === sig(full) && fp === JSON.stringify(full.byId[PA.id]), 'forked replay = full replay (pets and the dipped pet)'); }
V._setDipActivation(gOff);
console.log(fails ? '\n' + fails + ' failed' : '\nall passed'); process.exit(fails ? 1 : 0);
