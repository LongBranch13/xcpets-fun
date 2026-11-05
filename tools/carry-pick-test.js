#!/usr/bin/env node
/* carry-fix-1105 tests (dev tooling only): breed carry pick, gated by V2Rules.ACTIVATE_CARRYPICK_BLOCK.
 *  1) gate: placeholder 999999999, off before, null-able
 *  2) Luck 30 vs Vigor 29 + 1 shard (A.stats both 30): before the gate Vigor wins the tie and carries 29; after it Luck carries 30
 *  3) ties on carried value keep the first key; no shards = same pick both ways
 *  4) replay: newest snapshot, gate at placeholder vs null vs moved to block 0: identical carries (forward-only) */
'use strict';
const assert = require('assert'), crypto = require('crypto');
const L = require('./lib/load-rules'), c = L.load(), V = c.V2Rules, GATE0 = V.ACTIVATE_CARRYPICK_BLOCK, SH0 = V.shardsGate ? null : null;
const sha = s => crypto.createHash('sha256').update(String(s)).digest('hex');
let pass = 0, fail = 0; const t = (n, f) => { try { f(); pass++; console.log('ok   ' + n); } catch (e) { fail++; console.log('FAIL ' + n + ': ' + (e && e.stack ? e.stack.split('\n').slice(0, 2).join(' ') : e)); } };
const KEYS = c.PetCore.STAT_KEYS;
const S = L.snap(), H0 = Object.assign({}, c.XCPETS_BLOCK_HASHES, S.hashes);
const run = () => V.replay(S.rows, H0, [], { tip: S.tip, live: c.LiveEngine.RealCore });
const W = run();
const BB = Math.max(S.tip, V.ACTIVATE_QUEST_SHARDS_BLOCK) + 100; /* a block with shards on */
/* parent A (owner X) with Vigor-first key order: Vigor 29 base + 1 shard = 30, Luck 30, others 10; parent B owned by someone else */
function carryAt(b, stats, shards) {
  const w = JSON.parse(JSON.stringify(W)); w.byId = {}; w.pets.forEach(p => { w.byId[p.id] = p; });
  const live = w.pets.filter(p => !p.dead && !p.community && !p.released && p.species === 'pepe');
  const A = live[0], B = live.find(p => p.owner !== A.owner); assert.ok(A && B, 'two pepes, two owners');
  A.stats = Object.assign({}, stats); A.shards = shards ? Object.assign({}, shards) : undefined; B.carried = [];
  V.breed(w, A, B, sha('h' + b), 'test:carry:' + b, b, A.owner);
  return B.carried[B.carried.length - 1];
}
const vig = KEYS.indexOf('vigor') >= 0 ? 'vigor' : KEYS[0], luck = KEYS.indexOf('luck') >= 0 ? 'luck' : KEYS[KEYS.length - 1];
const base = () => { const o = {}; KEYS.forEach(k => { o[k] = 10; }); o[vig] = 30; o[luck] = 30; return o; };
assert.ok(KEYS.indexOf(vig) < KEYS.indexOf(luck), 'vigor before luck in key order');

t('gate: placeholder 999999999, off before it, null-able', () => { assert.strictEqual(GATE0, 999999999); assert.strictEqual(V.carryPickOn(GATE0 - 1), false); assert.strictEqual(V.carryPickOn(GATE0), true);
  V._setCarryPick(null); try { assert.strictEqual(V.carryPickOn(2e9), false); } finally { V._setCarryPick(GATE0); } });
t('BEFORE the gate: Luck 30 vs Vigor 29+1 shard -> Vigor wins the tie, carries 29 (old behaviour)', () => {
  const cr = carryAt(BB, base(), { [vig]: 1 }); assert.strictEqual(cr.stat, vig); assert.strictEqual(cr.value, 29); console.log('     before: ' + cr.stat + ' ' + cr.value); });
t('AFTER the gate: Luck 30 vs Vigor 29+1 shard -> Luck carries 30', () => { V._setCarryPick(BB); try {
  const cr = carryAt(BB, base(), { [vig]: 1 }); assert.strictEqual(cr.stat, luck); assert.strictEqual(cr.value, 30); console.log('     after:  ' + cr.stat + ' ' + cr.value); } finally { V._setCarryPick(GATE0); } });
t('AFTER the gate: tie on carried value keeps the first key (Vigor 28+4 shards = 30 carried vs Luck 30)', () => { V._setCarryPick(BB); try {
  const s = base(); s[vig] = 32; const cr = carryAt(BB, s, { [vig]: 4 }); assert.strictEqual(cr.stat, vig); assert.strictEqual(cr.value, 30); } finally { V._setCarryPick(GATE0); } });
t('no shards: same pick both sides of the gate', () => { const a = carryAt(BB, base(), null); V._setCarryPick(BB); let b; try { b = carryAt(BB, base(), null); } finally { V._setCarryPick(GATE0); }
  assert.deepStrictEqual([a.stat, a.value], [b.stat, b.value]); assert.strictEqual(a.stat, vig); });
t('replay ' + S.tip + ': carries identical with gate = placeholder, null, and moved to 0 (forward-only dry run)', () => {
  const sig = w => JSON.stringify(w.pets.filter(p => p.carried && p.carried.length).map(p => [p.id, p.carried]));
  const real = sig(W); V._setCarryPick(null); const nul = sig(run()); V._setCarryPick(0); const now = sig(run()); V._setCarryPick(GATE0);
  const n = JSON.parse(real).reduce((a, x) => a + x[1].length, 0); console.log('     carries in snapshot: ' + n + ' across ' + JSON.parse(real).length + ' pets');
  assert.strictEqual(real, nul); assert.strictEqual(real, now, 'gate at 0 changes past carries'); });
console.log(pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
