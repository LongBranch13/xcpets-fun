#!/usr/bin/env node
/* Raid upgrade tests (ACTIVATE_RAID_UPGRADE_BLOCK): an open raid that started before the rebalance switches to the rebalanced HP and
 * chipping at the first event block at or after the gate. Gate off (null) or in the future replays exactly as before.
 * node tools/raid-upgrade-test.js */
'use strict';
const { load, row, snap, run, fakeHash } = require('./lib/load-rules');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const c = load(), V = c.V2Rules, s0 = snap(), H0 = Object.assign({}, c.XCPETS_BLOCK_HASHES, s0.hashes);
const tip = Math.max.apply(null, s0.rows.map(r => r.block_index).filter(b => H0[b])), s = { tip, rows: s0.rows.filter(r => r.block_index <= tip), hashes: s0.hashes };
ok(V.raidUpgradeGate() === null || typeof V.raidUpgradeGate() === 'number', 'gate exported');
const G = tip + 10, HH = {}; for (let b = tip + 1; b <= G + 1500; b++) HH[b] = fakeHash(b);
V._setRaidActivation(G); V._setRaidV2Activation(G + 5000); /* the raid opening at G is an old-balance raid */
const hA = row(G + 2, 'bc1qraidupgaaaa', 1000, 'pet:hatch'), hB = row(G + 8, 'bc1qraidupgbbbb', 1000, 'pet:hatch');
V._setRaidUpgradeActivation(null); const off = run(c, s, [hA, hB], G + 20, HH), Roff = off.raids[0], B = V.raidBossById(Roff.boss);
ok(!Roff.v2 && Roff.hp === B.hp && Roff.left === B.hp && Roff.upgraded === undefined, 'gate off: old raid keeps table HP, no chip');
V._setRaidUpgradeActivation(G + 2000); const fut = run(c, s, [hA, hB], G + 20, HH);
ok(JSON.stringify(fut.raids) === JSON.stringify(off.raids) && JSON.stringify(fut.log) === JSON.stringify(off.log), 'gate in the future: replay identical');
V._setRaidUpgradeActivation(G + 5); const w = run(c, s, [hA, hB], G + 20, HH), R = w.raids[0];
const hp2 = Math.max(1000, Math.floor(B.hp / 20));
ok(R.v2 === 1 && R.upgraded === G + 8 && R.oldHp === B.hp, 'upgraded at the first event block after the gate (' + R.upgraded + ')');
ok(R.hp <= hp2 && R.hp >= 1000, 'HP is the rebalanced HP (' + B.hp + ' -> ' + R.hp + ')');
const la = w.log.find(l => l.tx === hA.tx_hash), lb = w.log.find(l => l.tx === hB.tx_hash);
ok(!R.chip['bc1qraidupgaaaa'], 'a hatch before the gate does not chip');
if (lb && lb.kind === 'hatch') ok(R.chip['bc1qraidupgbbbb'] === 20 && R.left === R.hp - 20, 'a hatch after the gate chips 20');
else ok(true, 'second hatch rejected (' + (lb && lb.msg) + ')');
ok(w.log.some(l => l.kind === 'raid' && /is weakened/.test(l.msg)), 'log line says the boss is weakened');
console.log('raid-upgrade: ' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
