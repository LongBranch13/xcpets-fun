#!/usr/bin/env node
/* ACTIVATE_FIGHT_GEAR_BLOCK tests (dev tooling only; synthetic burns + local equip ops, nothing broadcast).
 * From the gate, a fight reads only on-chain gear: local equip ops (one device's localStorage) must not change any fight result.
 *   node tools/fight-gear-test.js */
'use strict';
const assert = require('assert'), L = require('./lib/load-rules');
const ctx = L.load(), V = ctx.V2Rules, snap = L.snap('snap-972901.json'), TIP = snap.tip, B = TIP + 5;
const H = Object.assign({}, ctx.XCPETS_BLOCK_HASHES, snap.hashes); for (let b = TIP + 1; b <= TIP + 40; b++) H[b] = L.fakeHash(b);
const run = (extra, ops, gate) => { V._setFightGearActivation(gate); return V.replay(snap.rows.concat(extra), H, ops, { tip: TIP + 40, live: ctx.LiveEngine.RealCore }); };
const OFF = 1e9, base = run([], [], OFF), D = V.day(B);
const ok = p => !p.dead && !p.released && !p.neglected && p.stage >= 2 && !p.community && !(p.fightDays || {})[D] && p.owner;
const worn = (w, id) => w.itemList ? w.itemList.filter(g => g.on === id) : Object.values(w.items).filter(g => g.on === id);
const geared = base.pets.filter(p => ok(p) && worn(base, p.id).length >= 2);
assert(geared.length >= 2, 'need two geared pets');
const A = geared[0], Bp = geared.find(p => p.owner !== A.owner); assert(Bp, 'need a second owner');
const F0 = base.fights.length, ex = [L.row(B, A.owner, 690, `pet:fight:${A.id}:${Bp.id}`), L.row(B + 1, Bp.owner, 690, `pet:accept:${F0 + 1}`)];
/* local-only ops: A's owner takes every piece off A on this device, one block before the fight */
const ops = worn(base, A.id).map(g => ({ kind: 'equip', owner: A.owner, petId: A.id, slot: g.slot, gid: null, block_index: B - 1 }));
const pick = f => JSON.stringify({ a: f.snapA, b: f.snapB, w: f.winner, t: f.turns, s: f.spoils });
let pass = 0; const t = (n, fn) => { fn(); pass++; console.log('PASS ' + n); };
t('gate off (old rule): local equips change the fight snapshot (the audit finding)', () => {
  const a = run(ex, [], OFF).fights[F0], b = run(ex, ops, OFF).fights[F0];
  assert.strictEqual(a.status, 'done'); assert(a.snapA.gear.length >= 2); assert.strictEqual(b.snapA.gear.length, 0); });
t('gate on: the same fight with or without local equip ops is identical (gear, turns, winner, spoils)', () => {
  const a = run(ex, [], B - 3).fights[F0], b = run(ex, ops, B - 3).fights[F0];
  assert.strictEqual(a.status, 'done'); assert.strictEqual(pick(b), pick(a)); assert(b.snapA.gear.length >= 2); });
t('gate on: gate on or off gives the same fight when nobody has local ops (no change for chain-only viewers)', () => {
  assert.strictEqual(pick(run(ex, [], B - 3).fights[F0]), pick(run(ex, [], OFF).fights[F0])); });
t('gate on: local equips still show on the pet (only fights ignore them)', () => {
  const w = run(ex, ops, B - 3); assert.strictEqual(worn(w, A.id).length, 0); });
t('gate on: spoils go to the same owner in every viewer', () => {
  const a = run(ex, [], B - 3), b = run(ex, ops, B - 3), s = a.fights[F0].spoils;
  if (s) { const own = w => (w.items[s.gid] || w.itemList.find(g => g.gid === s.gid)).owner; assert.strictEqual(own(b), own(a)); } });
t('gate after the fight: old rule still applies (nothing changes before the block)', () => {
  assert.strictEqual(pick(run(ex, ops, B + 10).fights[F0]), pick(run(ex, ops, OFF).fights[F0])); });
t('deterministic: same inputs, same fight', () => { assert.strictEqual(pick(run(ex, ops, B - 3).fights[F0]), pick(run(ex, ops, B - 3).fights[F0])); });
console.log('fight-gear-test: ' + pass + ' passed, 0 failed (snapshot tip ' + TIP + ', gate ' + V.ACTIVATE_FIGHT_GEAR_BLOCK + ')');
