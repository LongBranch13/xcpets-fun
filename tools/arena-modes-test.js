#!/usr/bin/env node
/* Arena modes tests (dev tooling only): Sudden Death, Tag Team (one- and two-owner), gate OFF = unknown tags, Classic unchanged.
 * Synthetic burns are appended to a snapshot locally; nothing is broadcast. node tools/arena-modes-test.js [--snap FILE] */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert'), crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..'), A = process.argv.slice(2), SNAP = A.includes('--snap') ? A[A.indexOf('--snap') + 1] : path.join(__dirname, 'snapshots', 'snap-972550.json');
const snap = JSON.parse(fs.readFileSync(SNAP, 'utf8'));
function load() { const store = {}, ls = { getItem: k => store[k] || null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  const win = { console: { log() {}, warn() {}, error() {}, info() {} }, localStorage: ls, sessionStorage: ls, location: { search: '', hostname: 'xcpets.fun', href: 'https://xcpets.fun/' }, navigator: { userAgent: 'node' }, setTimeout: () => 0, clearTimeout() {}, URLSearchParams, URL, TextEncoder, TextDecoder };
  win.window = win; win.self = win; win.globalThis = win; const ctx = vm.createContext(win);
  for (const f of ['rjs/config.js', 'rjs/pet-core.js', 'rjs/game-core.js', 'rjs/bonus-gear.js', 'rjs/real-core.js', 'rjs/chain.js', 'js/pet-core.js', 'js/bonus-gear.js', 'js/v2-gear.js', 'js/v2-fit.js', 'js/v2-rules.js', 'js/block-hashes.js']) { const p = path.join(ROOT, f); if (fs.existsSync(p)) vm.runInContext(fs.readFileSync(p, 'utf8'), ctx, { filename: f }); }
  return ctx; }
const ctx = load(), V = ctx.V2Rules, HASH = Object.assign({}, ctx.XCPETS_BLOCK_HASHES || {}, snap.hashes), TIP = snap.tip;
const h = s => crypto.createHash('sha256').update(String(s)).digest('hex');
for (let b = TIP + 1; b <= TIP + 40; b++) HASH[b] = h('fake-block-' + b);
let txn = 0; const row = (block, source, tag, amount) => ({ tx_index: 9e9 + (++txn), tx_hash: h('tx' + txn + tag), block_index: block, source, asset: 'XCPETS', quantity: Math.round(amount * 1e8), tag, status: 'valid' });
const run = (extra, gate, tip) => { V._setArenaModesActivation(gate); return V.replay(snap.rows.concat(extra), HASH, [], { tip: tip || TIP + 40, live: ctx.RealCore }); };
/* pick fighters from the base world, eligible through the test window, from owners with 2+ eligible pets, avoiding the first eligible days */
const base = run([], null, TIP + 40), D = V.day(TIP + 5);
const ok = p => !p.dead && !p.released && !p.neglected && p.stage >= 2 && !p.community && !(p.fightDays || {})[D] && p.owner;
const by = {}; base.pets.filter(ok).forEach(p => (by[p.owner] = by[p.owner] || []).push(p.id));
const owners = Object.keys(by).filter(o => by[o].length >= 4).sort((a, b) => by[b].length - by[a].length);
assert(owners.length >= 2, 'need two owners with 4+ eligible pets');
const [X, Y] = owners, x = by[X], y = by[Y]; let pass = 0; const t = (n, fn) => { fn(); pass++; console.log('ok', n); };
const B = TIP + 5;
t('gate OFF: sd/tt/join are unknown tags (no fight)', () => { const w = run([row(B, X, `pet:sd:${x[0]}:${y[0]}`, 690), row(B + 1, Y, 'pet:accept:999', 690), row(B, X, `pet:tt:${x[0]}.${x[1]}:${y[0]}.${y[1]}`, 1380)], null);
  assert.strictEqual(w.fights.length, base.fights.length); assert(w.log.filter(l => l.block >= B && /unknown pet: tag/.test(l.msg)).length >= 2); });
const G = TIP + 1, F0 = base.fights.length;
t('Sudden Death: challenge + accept -> done, loser black eye, <= 2 pieces, deterministic', () => {
  const ex = [row(B, X, `pet:sd:${x[0]}:${y[0]}`, 690), row(B + 1, Y, `pet:accept:${F0 + 1}`, 690)], w = run(ex, G), f = w.fights[F0];
  assert.strictEqual(f.mode, 'sd'); assert.strictEqual(f.status, 'done'); assert(f.spoilsList.length <= 2); assert(w.byId[f.loser].blackEyeUntil === B + 1 + V.BLACK_EYE_BLOCKS);
  const last = f.turns[f.turns.length - 1]; assert(f.coin || (last.hpA === 0 || last.hpB === 0));
  const w2 = run(ex, G); assert.strictEqual(JSON.stringify(w2.fights[F0]), JSON.stringify(f));
  f.spoilsList.forEach(g => assert.strictEqual(w.items[g.gid] ? w.items[g.gid].owner : w.itemList.find(i => i.gid === g.gid).owner, w.byId[f.winner].owner)); });
t('Sudden Death below cost is rejected', () => { const w = run([row(B, X, `pet:sd:${x[0]}:${y[0]}`, 600)], G); assert.strictEqual(w.fights.length, F0); });
t('Tag Team one owner per side: 1,380 each, relay result, one piece per knocked-out pet', () => {
  const w = run([row(B, X, `pet:tt:${x[0]}.${x[1]}:${y[0]}.${y[1]}`, 1380), row(B + 1, Y, `pet:accept:${F0 + 1}`, 1380)], G), f = w.fights[F0];
  assert.strictEqual(f.status, 'done'); assert(f.bouts.length >= 2 && f.bouts.length <= 3); assert(f.out.length === f.bouts.length);
  assert(f.spoilsList.length <= f.out.length); f.out.forEach(o => assert(w.byId[o.id].blackEyeUntil === B + 1 + V.BLACK_EYE_BLOCKS));
  const loseSide = f.losers; assert(loseSide.every(id => f.out.some(o => o.id === id)));
  assert(f.bouts.slice(1).every((bt, i) => { const prev = f.bouts[i]; return (bt.a === prev.winner ? bt.startA < bt.maxA || bt.startA === bt.maxA : true); })); });
t('Tag Team challenge at 690 (same-owner team) is rejected; accept at 690 is rejected', () => {
  let w = run([row(B, X, `pet:tt:${x[0]}.${x[1]}:${y[0]}.${y[1]}`, 690)], G); assert.strictEqual(w.fights.length, F0);
  w = run([row(B, X, `pet:tt:${x[0]}.${x[1]}:${y[0]}.${y[1]}`, 1380), row(B + 1, Y, `pet:accept:${F0 + 1}`, 690)], G); assert.strictEqual(w.fights[F0].status, 'open'); });
t('Two-owner Tag Team: lead 690 + partner join 690; waits for the join, resolves on it', () => {
  const ex = [row(B, X, `pet:tt:${x[0]}.${y[2]}:${y[0]}.${y[1]}`, 690), row(B + 1, Y, `pet:accept:${F0 + 1}`, 1380)];
  let w = run(ex, G), f = w.fights[F0]; assert.deepStrictEqual(Array.from(f.needJoin), [y[2]]); assert.strictEqual(f.status, 'open'); assert(f.accepted);
  w = run(ex.concat([row(B + 2, X, `pet:join:${F0 + 1}:${y[2]}`, 690)]), G); assert.strictEqual(w.fights[F0].status, 'open', 'wrong owner cannot join');
  w = run(ex.concat([row(B + 2, Y, `pet:join:${F0 + 1}:${y[2]}`, 690)]), G); f = w.fights[F0]; assert.strictEqual(f.status, 'done'); assert.strictEqual(f.acceptBlock, B + 2); });
t('Partner in an open Tag Team cannot start a Classic challenge (gate on)', () => {
  const w = run([row(B, X, `pet:tt:${x[0]}.${x[1]}:${y[0]}.${y[1]}`, 1380), row(B + 1, X, `pet:fight:${x[1]}:${y[3]}`, 690)], G);
  assert.strictEqual(w.fights.length, F0 + 1); });
t('Classic fight is identical with the gate on or off', () => {
  const ex = [row(B, X, `pet:fight:${x[0]}:${y[0]}`, 690), row(B + 1, Y, `pet:accept:${F0 + 1}`, 690)];
  const a = run(ex, null).fights[F0], b = run(ex, G).fights[F0]; assert.strictEqual(a.status, 'done'); assert.strictEqual(JSON.stringify(a), JSON.stringify(b)); });
t('dead / egg pets are rejected', () => { const dead = base.pets.find(p => p.dead && !p.released && p.owner === X) || base.pets.find(p => p.dead && !p.released);
  const w = run([row(B, dead.owner, `pet:sd:${dead.id}:${y[0]}`, 690)], G); assert.strictEqual(w.fights.length, F0); });
t('simulateFight without start HP is unchanged (Classic)', () => { const s1 = { stats: { vigor: 10, spark: 10, grit: 10, zoom: 10, luck: 10 }, stage: 3, gear: [] };
  assert.strictEqual(JSON.stringify(V.simulateFight('seed', s1, s1)), JSON.stringify(V.simulateFight('seed', s1, s1, undefined))); });
console.log('owners', X.slice(0, 8), Y.slice(0, 8), 'ALL PASS (' + pass + ')');
