#!/usr/bin/env node
/* Raid rebalance tests (ACTIVATE_RAID_V2_BLOCK): history before the gate replays the same, new raids get HP / 20, feed / breed / hatch burns
 * chip 2% of their amount into an open raid, a chip can land the killing blow, and every wallet that hit a won raid gets a saved spin.
 * node tools/raids-v2-test.js */
'use strict';
const { load, row, snap, run, fakeHash } = require('./lib/load-rules');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const c = load(), V = c.V2Rules, s0 = snap(), H0 = Object.assign({}, c.XCPETS_BLOCK_HASHES, s0.hashes);
const tip = Math.max.apply(null, s0.rows.map(r => r.block_index).filter(b => H0[b])), s = { tip, rows: s0.rows.filter(r => r.block_index <= tip), hashes: s0.hashes };
ok(V.raidV2Gate() === null || typeof V.raidV2Gate() === 'number', 'gate exported');
const G = tip + 10, HH = {}; for (let b = tip + 1; b <= G + 1500; b++) HH[b] = fakeHash(b);
V._setRaidActivation(G);
const hatchA = row(G + 2, 'bc1qraidvtwoaaaa', 3000000, 'pet:hatch'), hatchB = row(G + 3, 'bc1qraidvtwobbbb', 1000, 'pet:hatch'), hatchC = row(G + 1, 'bc1qraidvtwocccc', 1000, 'pet:hatch');
/* 1) gate off: the same burns replay exactly as before (no chip, table HP) */
V._setRaidV2Activation(null); const off = run(c, s, [hatchA, hatchB], G + 20, HH); const Roff = off.raids[0], Boff = V.raidBossById(Roff.boss);
ok(Roff.hp === Boff.hp && Roff.left === Boff.hp && !Roff.v2 && Roff.chip === undefined, 'gate off: table HP, no chip fields');
/* 2) gate in the future: raids that opened before it are untouched */
V._setRaidV2Activation(G + 1); const later = run(c, s, [hatchA, hatchB], G + 20, HH);
ok(JSON.stringify(later.raids[0]) === JSON.stringify(Roff), 'raid that opened before the gate replays the same');
ok(JSON.stringify(later.log.filter(l => l.kind === 'raid')) === JSON.stringify(off.log.filter(l => l.kind === 'raid')), 'no raid log lines change before the gate');
/* 3) gate at the opening: HP / 20, chip from hatches, chip kill, spins */
V._setRaidV2Activation(G); const w = run(c, s, [hatchB], G + 5, HH), R = w.raids[0], B = V.raidBossById(R.boss);
ok(R.v2 && R.hp === Math.max(1000, Math.floor(B.hp / 20)) && R.hp === V.raidHpAt(w, B, G), 'new raid HP = table / 20 (' + B.hp + ' -> ' + R.hp + ')');
const lb = w.log.find(l => l.tx === hatchB.tx_hash);
if (lb && lb.kind === 'hatch') ok(R.chipTotal === Math.floor(1000 * 0.02) && R.chip['bc1qraidvtwobbbb'] === 20 && R.left === R.hp - 20, 'hatch burn of 1,000 chips 20 HP');
else ok(R.chipTotal === 0, 'rejected burn does not chip (' + (lb && lb.msg) + ')');
const wk = run(c, s, [hatchC, hatchB, hatchA], G + 30, HH), RK = wk.raids[0], la = wk.log.find(l => l.tx === hatchA.tx_hash);
ok(la && la.kind === 'hatch', 'big hatch accepted (' + (la && la.kind + ' ' + la.msg) + ')');
ok(RK.killBlock === G + 2 && RK.killPet === null && RK.killBy === 'bc1qraidvtwoaaaa' && RK.left === 0, 'chip lands the killing blow');
ok(RK.settled && RK.result === 'won', 'chip-won raid settles at kill + 6');
ok(wk.log.some(l => l.kind === 'raid' && /KILLING BLOW/.test(l.msg)) && wk.log.some(l => l.kind === 'raid' && /defeated by 2 wallets/.test(l.msg)), 'kill and result log lines');
const I = V.raidInfo(wk, G + 30); ok(I.raid.v2 && I.raid.killBy === 'bc1qraidvtwoaaaa' && I.raid.spinWallets === 2 && I.raid.chipWallets === 2, 'raidInfo shows chip and spin counts');
/* hatchB happened after the kill (block G + 3): it must not chip */
ok(RK.chip['bc1qraidvtwobbbb'] === undefined, 'no chip after the boss is down');
console.log('raids-v2: ' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
