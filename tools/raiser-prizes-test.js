'use strict';
/* raiser-prizes-test (Nov 23 2026): community raiser prizes (V2Rules grantRaisers). When a community pet reaches Mythic, every wallet that fed it
 * RAISER_MIN+ gets the pet's 'all' piece and the top RAISER_TOP also get its 'top' piece; once per pet; nothing while the gate is null. */
const S = require('./sync-server/snapshot');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const ctx = S.workerFns(); S.replayWorld(ctx, [], {}, 980000, null); const V = ctx.V2Rules;
ok(V.ACTIVATE_RAISERS_BLOCK === null || typeof V.ACTIVATE_RAISERS_BLOCK === 'number', 'gate exported');
ok(V.RAISER_PRIZES.rabbit && V.RAISER_PRIZES.rabbit.all === 'wr-golden-carrot' && V.RAISER_PRIZES.rabbit.top === 'wr-mad-hatter', 'White Rabbit prizes');
const gear = ctx.V2Gear || ctx.window && ctx.window.V2Gear; ok(gear && gear.WR_RAISER_GEAR && gear.WR_RAISER_GEAR.length === 2, 'render maps exported');
const mkW = () => ({ items: {}, nextItem: 1, log: [], pets: [], rabbitMythic: { block: 981000, tx: 't', total: 6906900, by: { A: 5000, B: 9000, C: 9000, D: 70, E: 68.99, F: 100 } } });
const live = V.ACTIVATE_RAISERS_BLOCK;
V._setRaisersActivation(null); let w = mkW(); V._grantRaisers(w, 981001); ok(!Object.keys(w.items).length && !w.raiserGrants, 'gate null: nothing granted');
V._setRaisersActivation(981500); w = mkW(); V._grantRaisers(w, 981600); ok(!Object.keys(w.items).length, 'Mythic before the gate: nothing granted');
V._setRaisersActivation(980000); w = mkW(); V._grantRaisers(w, 980999); ok(!Object.keys(w.items).length, 'not before the Mythic block');
V._grantRaisers(w, 981000); const its = Object.values(w.items);
const by = (id) => its.filter(g => g.item === id).map(g => g.owner).sort().join(',');
ok(by('wr-golden-carrot') === 'A,B,C,D,F', 'carrot to every raiser with 69+ (E at 68.99 left out): ' + by('wr-golden-carrot'));
ok(by('wr-mad-hatter') === 'A,B,C', 'top hat to the top 3 (ties by address): ' + by('wr-mad-hatter'));
ok(its.every(g => g.on === null), 'unworn, in the stash');
ok(its.filter(g => g.item === 'wr-mad-hatter').every(g => g.tier === 3) && its.filter(g => g.item === 'wr-golden-carrot').every(g => g.tier === 2), 'hat Legendary, carrot Rare');
V._grantRaisers(w, 981005); ok(Object.keys(w.items).length === its.length, 'granted once');
ok(w.log.some(l => /raisers: 5 wallets/.test(l.msg)), 'log line');
V._setRaisersActivation(live);
console.log('raiser-prizes-test: ' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
