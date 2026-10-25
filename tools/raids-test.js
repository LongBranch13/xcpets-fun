#!/usr/bin/env node
/* Raids tests (dev only, preview branch raids): gate inert, schedule, boss pick, event boss, damage = burn times multiplier times crit,
 * once per pet per chain day, HP cap + killing blow, 6-confirmation results, rewards (badge, top 3, kill, lucky drop), escape = nothing. node tools/raids-test.js */
'use strict';
const { load, row, snap, run, fakeHash } = require('./lib/load-rules');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const c = load(), V = c.V2Rules, s0 = snap(), H0 = Object.assign({}, c.XCPETS_BLOCK_HASHES, s0.hashes);
const tip = Math.max.apply(null, s0.rows.map(r => r.block_index).filter(b => H0[b])), s = { tip, rows: s0.rows.filter(r => r.block_index <= tip), hashes: s0.hashes };
const G0 = V.raidGate(); ok(typeof G0 === 'number' && G0 > 972990, 'gate set (' + G0 + ')');
const G = tip + 10, HH = {}; for (let b = tip + 1; b <= G + 3000; b++) HH[b] = fakeHash(b);
/* inert before the gate: a pet:raid burn is an unknown tag (community food), same as main */
V._setRaidActivation(null); const pre = run(c, s, [row(tip, 'bc1qraidtestxx', 100, 'pet:raid:1')], tip, HH); const lp = pre.log[pre.log.length - 1];
ok(lp.kind === 'rejected' && /unknown pet: tag/.test(lp.msg), 'gate off: pet:raid = unknown tag (' + lp.msg + ')');
V._setRaidActivation(G);
const w0 = run(c, s, [], G, HH);
ok(w0.raids && w0.raids.length === 1 && w0.raids[0].open === G && w0.raids[0].end === G + 431, 'raid 1 opens at the gate, lasts 432 blocks');
const R1 = w0.raids[0], B1 = V.raidBossById(R1.boss); ok(B1 && R1.hp === B1.hp && R1.left === B1.hp, 'boss HP from table (' + B1.name + ' ' + B1.hp + ')');
ok(V.raidBossFor(G, HH[G]).id === R1.boss, 'boss from opening block hash');
/* boss pick spreads over all 13 regular bosses, event boss only on windows holding a height ending 2140 */
const seen = {}; for (let i = 0; i < 400; i++) seen[V.raidBossFor(980000 + 2141 + i * 13, fakeHash(i)).id] = 1; ok(Object.keys(seen).length === 13 && !seen.blockschild, 'all 13 regular bosses appear');
ok(V.raidBossFor(982000, 'aa').id === 'blockschild' && V.raidEventAt(981709) && !V.raidEventAt(981708) && V.raidEventAt(982140) && !V.raidEventAt(982141), 'Lord Blockschild on windows holding ...2140');
/* multiplier and crit */
ok(V.raidMult({ stage: 1, tier: 0 }) === 100 && V.raidMult({ stage: 5, tier: 3 }) === 150 && V.raidMult({ stage: 3, tier: 1 }) === 123, 'multiplier 1.00 to 1.50 times');
const cr = { 1: 0, 2: 0, 3: 0 }; for (let i = 0; i < 4000; i++) cr[V.raidCrit(fakeHash('c' + i))]++; ok(cr[3] > 120 && cr[3] < 280 && cr[2] > 640 && cr[2] < 960, 'crit odds about 5% / 20% (' + JSON.stringify(cr) + ')');
/* eligible pets at the gate */
const pets = w0.pets.filter(p => !p.community && !p.dead && !p.released && !p.neglected && !p.cold && p.stage >= 1 && !(p.quest && p.quest.end >= G));
ok(pets.length >= 4, 'have test pets (' + pets.length + ')');
const [a, b2, c3, d4] = pets, egg = w0.pets.find(p => !p.community && !p.dead && !p.released && p.stage === 0);
const atk = (p, blk, amt) => row(blk, p.owner, amt, 'pet:raid:' + p.id);
const r1 = atk(a, G + 1, 1000), r1b = atk(a, G + 2, 1000), rOther = row(G + 1, 'bc1qnotowner', 1000, 'pet:raid:' + a.id), rLow = atk(b2, G + 1, 10);
let w = run(c, s, [r1, r1b, rOther, rLow].concat(egg ? [atk(egg, G + 1, 500)] : []), G + 3, HH);
const L = tx => w.log.find(x => x.tx === tx.tx_hash);
const exp = Math.floor(1000 * V.raidMult(w.byId[a.id]) * V.raidCrit(r1.tx_hash) / 100);
ok(L(r1).kind === 'raid' && w.raids[0].dmg[a.id] === exp, 'damage = burn times multiplier times crit (' + exp + ')');
ok(L(r1b).kind === 'rejected' && /already attacked this chain day/.test(L(r1b).msg), 'once per pet per chain day');
ok(L(rOther).kind === 'rejected' && /owner only/.test(L(rOther).msg), 'owner only');
ok(L(rLow).kind === 'rejected' && /below raid minimum/.test(L(rLow).msg), 'minimum 69');
if (egg) { const le = w.log.find(x => x.msg && /eggs cannot raid/.test(x.msg)); ok(!!le, 'eggs cannot raid'); }
const nd = G + 144 - (G % 144) + 1, r2 = atk(a, nd, 1000); w = run(c, s, [r1, r2], nd, HH); ok(L(r2).kind === 'raid', 'next chain day: same pet may attack again');
/* escape: small damage, window ends -> no rewards */
w = run(c, s, [r1], G + 431 + 6, HH); ok(w.raids[0].result === 'escaped' && !w.pets.some(p => p.raidBadges), 'boss escapes: no rewards');
const late = atk(b2, G + 432, 1000); w = run(c, s, [late], G + 440, HH); ok(L(late).kind === 'rejected' && /no raid is open/.test(L(late).msg), 'after window: no raid open');
/* kill: big burns */
const k1 = atk(a, G + 5, 10000), k2 = atk(b2, G + 6, 20000), k3 = atk(c3, G + 7, 30000), k4 = atk(d4, G + 8, 9e6), k5 = atk(w0.pets.filter(p => pets.includes(p))[4] || a, G + 9, 5000);
const rowsK = [k1, k2, k3, k4, k5];
w = run(c, s, rowsK, G + 8 + 5, HH); const RK = w.raids[0];
ok(RK.killBlock === G + 8 && RK.killPet === d4.id && RK.left === 0, 'killing blow at block ' + (G + 8));
ok(RK.dmg[d4.id] === RK.hp - RK.dmg[a.id] - RK.dmg[b2.id] - RK.dmg[c3.id], 'credited damage capped at HP left');
ok(L(k5).kind === 'rejected' && /already defeated/.test(L(k5).msg), 'after kill: attacks rejected');
ok(!RK.settled && !w.pets.some(p => p.raidBadges), '5 blocks after kill: results not counted yet');
w = run(c, s, rowsK, G + 8 + 6, HH); const RS = w.raids[0];
ok(RS.settled && RS.result === 'won', '6 confirmations: results count');
ok([a, b2, c3, d4].every(p => (w.byId[p.id].raidBadges || []).length === 1), 'badge for every attacker');
const tro = id => (w.byId[id].raidTrophies || []).map(x => x.kind).sort().join();
ok(tro(d4.id) === 'kill,top1', 'killer is top 1 + kill trophy (' + tro(d4.id) + ')');
const rest = [a, b2, c3].sort((x, y) => (RS.dmg[y.id] - RS.dmg[x.id]) || (RS.order.indexOf(x.id) - RS.order.indexOf(y.id)));
ok(tro(rest[0].id) === 'top2' && tro(rest[1].id) === 'top3' && tro(rest[2].id) === '', 'top 2 and 3 trophies, 4th gets none');
ok(RS.lucky != null && [a, b2, c3, d4].some(p => p.id === RS.lucky) && (w.byId[RS.lucky].raidRelics || []).length === 1, 'one lucky drop to an attacker (#' + RS.lucky + ')');
ok(!w.pets.some(p => p.goldHolo && !w0.byId[p.id].goldHolo), 'no Gold holo');
const bd = V.breederBadges(w, w.byId[d4.id]); ok(bd.some(x => x.name === 'RAIDER') && bd.some(x => x.name === 'KILLING BLOW'), 'badges shown on pet');
/* lucky drop weighted by damage: over many hashes the big hitter wins most */
const wins = {}; for (let i = 0; i < 40; i++) { const HX = Object.assign({}, HH, { [G + 8]: fakeHash('L' + i) }); const wx = run(c, s, rowsK, G + 14, HX); wins[wx.raids[0].lucky] = (wins[wx.raids[0].lucky] || 0) + 1; }
ok((wins[d4.id] || 0) > 24, 'lucky drop weighted by damage (' + JSON.stringify(wins) + ')');
/* deterministic */
const wA = run(c, s, rowsK, G + 20, HH), wB = run(c, s, rowsK, G + 20, HH); ok(JSON.stringify(wA.raids) === JSON.stringify(wB.raids), 'deterministic replay');
/* raid 2 opens 1,008 blocks later */
w = run(c, s, [], G + 1008, HH); ok(w.raids.length === 2 && w.raids[1].open === G + 1008, 'raid 2 opens 1,008 blocks later');
const info = V.raidInfo(wA, G + 20); ok(info.raid && info.raid.board[0].petId === d4.id && info.raid.result === 'won' && info.nextOpen === G + 1008, 'raidInfo leaderboard + next raid');
V._setRaidActivation(G0);
console.log((fail ? 'FAILED ' : 'ALL PASS ') + pass + ' pass, ' + fail + ' fail');
process.exitCode = fail ? 1 : 0;
