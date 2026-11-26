#!/usr/bin/env node
/* seat-battles-test: Pantheon seat battles (owner Jake Nov 26 2026, "Seat battles", seats are "Glory only").
 * Built on a snapshot with synthetic burns, like tools/mythic-god-test.js. Filling 21 seats through real unleash / Resurrection rolls would take
 * thousands of burns, so a test-only seam (patched in memory, never on disk) seats 21 Gods and 2 seatless Gods at one block before the burns.
 * Checks: below the gate pet:throne is an unknown tag and a full Pantheon still blocks rising; from the gate a challenge is fought at once, the
 * winner sits and the loser is Fallen; a God that held its seat keeps it; one challenge per God per day; own seat / seated challenger / not a God /
 * below cost are rejected (and refused before signing); two challenges on one seat in one block fight in order (gauntlet); a holder that left the
 * game loses the seat without a fight; only the seat moves (no gear, no black eye, no wins/losses).
 *   node tools/seat-battles-test.js */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const L = require('./lib/load-rules'), ROOT = L.ROOT, S = L.snap('snap-972901.json');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const GATE = 972905, R = 973450, SEED = R + 10;
/* the loader of tools/lib/load-rules.js with one in-memory seam: a hook at the start of mgSweep (before the burns of a block) */
function load() { const c = L.load(); const src = fs.readFileSync(path.join(ROOT, 'js/v2-rules.js'), 'utf8'), A = '  function mgSweep(w, b, H) { ';
  if (src.split(A).length !== 2) throw new Error('seat-battles-test: mgSweep anchor not found exactly once');
  vm.runInContext(src.replace(A, A + 'if (window.__seatSeed) window.__seatSeed(w, b, cemW, mgW); '), c); vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/block-hashes.js'), 'utf8'), c); return c; }
let PLAN = null;
function world(rows, tip, gate) { const c = load(), V = c.V2Rules;
  V._setCemeteryActivation(GATE); V._setCemeteryPublic(GATE); V._setMythicUnleashActivation(GATE); V._setSeatBattleActivation(gate === undefined ? GATE : gate);
  let seeded = false;
  c.__seatSeed = (w, b, cemW, mgW) => { if (seeded || b < SEED) return; seeded = true;
    /* the 2 seatless Gods get their own wallets; the 21 seats go to pets of the other wallets (a wallet may hold several seats) */
    const ok3 = p => !(p.dead || p.released || p.community || p.stage < 3 || !p.owner || p.zombie), live = w.pets.filter(ok3), owners = [...new Set(live.map(p => p.owner))];
    const freeO = owners.slice(0, 2), free = freeO.map(o => live.find(p => p.owner === o)), rest = live.filter(p => freeO.indexOf(p.owner) < 0);
    const pick = [], per = {}; for (let k = 0; pick.length < 21 && k < 50; k++) rest.forEach(p => { if (pick.length < 21 && (per[p.owner] | 0) === k && pick.indexOf(p) < 0) { per[p.owner] = k + 1; pick.push(p); } }); pick.push(...free);
    const M = mgW(w); M.gods = {};
    pick.forEach((p, i) => { p.stage = 5; p.mythicCare = true; const rec = { n: i < 21 ? i + 1 : 0, petId: p.id, name: p.name || null, species: p.species, block: SEED - 5, tx: 'seed' + i, owner: p.owner, eatenBy: 1, eatenAt: SEED - 50 };
      p.mythicGod = { seat: rec.n, block: SEED - 5, tx: rec.tx }; if (i < 21) M.seats.push(rec); else M.gods[p.id] = rec; });
    PLAN = { seated: pick.slice(0, 21).map(p => ({ id: p.id, owner: p.owner })), free: pick.slice(21).map(p => ({ id: p.id, owner: p.owner })) }; };
  const w = L.run(c, S, rows, tip); return { c, V, w };
}
const logsAt = (w, b) => w.log.filter(e => e.block === b);
/* pass 1: learn who sits where (the seed is deterministic) */
const P0 = world([L.row(SEED, 'bc1qnobody', 1, 'pet:hatch')], SEED + 1);
ok(PLAN && PLAN.seated.length === 21 && PLAN.free.length === 2, 'seam seated 21 Gods and left 2 Gods without a seat');
const A = PLAN.free[0], B = PLAN.free[1], H5 = PLAN.seated[4], H9 = PLAN.seated[8];
ok(P0.w.cem.mg.seats.length === 21 && P0.V.mgSeatsLeft(P0.w) === 0, 'the Pantheon is full');
ok(P0.V.mgFullBlocks(P0.w, SEED + 2) === false, 'from the gate a full Pantheon no longer blocks an unleash or a Resurrection');
const off = world([L.row(SEED, 'bc1qnobody', 1, 'pet:hatch')], SEED + 1, null);
ok(off.V.mgFullBlocks(off.w, SEED + 2) === true, 'below the gate a full Pantheon still blocks rising (as before)');
/* 1. below the gate: an unknown tag */
const T1 = L.row(SEED + 1, A.owner, 100000, 'pet:throne:' + A.id + ':5');
const G0 = world([T1], SEED + 2, null);
ok(logsAt(G0.w, SEED + 1).some(e => e.kind === 'rejected' && /unknown pet: tag/.test(e.msg)) && !(G0.w.cem.mg.battles || []).length, 'below the gate pet:throne is an unknown tag (community food), no battle');
/* 2. a challenge is fought at once */
const G1 = world([T1], SEED + 2), M1 = G1.w.cem.mg, B1 = (M1.battles || [])[0], ch = G1.w.byId[A.id], ho = G1.w.byId[H5.id];
ok(B1 && B1.seat === 5 && B1.challenger === A.id && B1.holder === H5.id && B1.block === SEED + 1 && [A.id, H5.id].indexOf(B1.winner) >= 0, 'the battle is fought in the burn\'s block and recorded in M.battles');
ok(logsAt(G1.w, SEED + 1).some(e => e.kind === 'throne'), 'the burn logs a seat battle');
if (B1 && B1.winner === A.id) ok(ch.mythicGod.seat === 5 && ho.mythicGod.seat === 0 && ho.mythicGod.fallen && ho.mythicGod.fallen.by === A.id && M1.seats[4].petId === A.id && M1.seats[4].won === SEED + 1 && M1.gods[H5.id] && !M1.gods[A.id], 'challenger won: it sits in Seat V, the old holder is a Fallen God with its record kept');
else ok(ch.mythicGod.seat === 0 && ho.mythicGod.seat === 5 && M1.seats[4].petId === H5.id && M1.gods[A.id], 'holder won: it keeps Seat V, the challenger stays seatless');
ok(!ho.dead && !ch.dead && ch.mythicGod && ho.mythicGod, 'both stay Gods');
ok(!ch.blackEyeUntil && !ho.blackEyeUntil && !(ch.wins || ch.losses || ho.wins || ho.losses), 'only the seat is at stake: no black eye, no wins or losses');
/* find one battle each way across seats */
let won = null, held = null;
for (let s = 1; s <= 21 && !(won && held); s++) { const X = world([L.row(SEED + 1, A.owner, 100000, 'pet:throne:' + A.id + ':' + s)], SEED + 2), Bx = X.w.cem.mg.battles[0]; if (!Bx) continue; if (Bx.winner === A.id && !won) won = { s, X }; if (Bx.winner !== A.id && !held) held = { s, X }; }
ok(won && held, 'over the 21 seats the challenger both wins and loses (the fight is real)');
if (won) { const s = won.s, X = won.X, H = PLAN.seated[s - 1]; ok(X.w.byId[A.id].mythicGod.seat === s && X.w.byId[H.id].mythicGod.seat === 0 && X.w.cem.mg.seats[s - 1].petId === A.id, 'a win moves the seat'); }
if (held) { const s = held.s, X = held.X, H = PLAN.seated[s - 1]; ok(X.w.byId[A.id].mythicGod.seat === 0 && X.w.byId[H.id].mythicGod.seat === s, 'a hold keeps the seat'); }
/* 3. rejections */
const rej = (rows, b, re, m) => { const X = world(rows, b + 1); ok(logsAt(X.w, b).some(e => e.kind === 'rejected' && re.test(e.msg)), m); return X; };
const heldSeat = held ? held.s : 5;
rej([L.row(SEED + 1, A.owner, 100000, 'pet:throne:' + A.id + ':' + heldSeat), L.row(SEED + 2, A.owner, 100000, 'pet:throne:' + A.id + ':' + (heldSeat % 21 + 1))], SEED + 2, /one seat challenge per God per chain day/, 'one challenge per God per day');
rej([L.row(SEED + 1, H9.owner, 100000, 'pet:throne:' + H9.id + ':5')], SEED + 1, /already sits in Seat 9/, 'a seated God cannot challenge');
rej([L.row(SEED + 1, A.owner, 100000, 'pet:throne:' + B.id + ':5')], SEED + 1, /not your God/, 'only your own God');
rej([L.row(SEED + 1, A.owner, 0.0001, 'pet:throne:' + A.id + ':5')], SEED + 1, /below cost/, 'below cost is rejected');
rej([L.row(SEED + 1, H5.owner, 100000, 'pet:throne:' + PLAN.seated[0].id + ':5')], SEED + 1, /not your God|already sits/, 'not a seatless God of yours');
const notGod = P0.w.pets.find(p => p.owner === A.owner && !p.mythicGod && !p.dead && !p.released);
if (notGod) rej([L.row(SEED + 1, A.owner, 100000, 'pet:throne:' + notGod.id + ':5')], SEED + 1, /only a Mythic God/, 'a pet that is not a God cannot challenge');
/* 4. before signing: the same answers, plus a waiting burn */
const V = P0.V, w = P0.w, tip = SEED;
ok(V.sendBlock(w, { tag: 'pet:throne:' + A.id + ':5', amount: 100000 }, tip, { me: A.owner }) == null, 'sendBlock lets a valid challenge through');
ok(/already sits/.test(V.sendBlock(w, { tag: 'pet:throne:' + H9.id + ':5', amount: 100000 }, tip, { me: H9.owner }) || ''), 'sendBlock refuses a seated challenger');
ok(/below seat battle cost/.test(V.sendBlock(w, { tag: 'pet:throne:' + A.id + ':5', amount: 0.0001 }, tip, { me: A.owner }) || ''), 'sendBlock refuses an underpaid challenge');
ok(/still waiting to confirm/.test(V.sendBlock(w, { tag: 'pet:throne:' + A.id + ':6', amount: 100000 }, tip, { me: A.owner, pending: ['pet:throne:' + A.id + ':5'] }) || ''), 'sendBlock refuses a second challenge while one is waiting');
ok(/seat battles open at block/.test(off.V.sendBlock(off.w, { tag: 'pet:throne:' + A.id + ':5', amount: 100000 }, tip, { me: A.owner }) || ''), 'sendBlock refuses below the gate');
const plan = V.mgThronePlan(w, A.id, 5, tip + 1); ok(plan.tag === 'pet:throne:' + A.id + ':5' && plan.amount > 0, 'mgThronePlan gives the tag and the price');
const odds = V.mgThroneOdds(w, A.id, 5, tip + 1, 20); ok(odds && odds.of === 20 && odds.wins >= 0 && odds.wins <= 20, 'mgThroneOdds gives a practice win count');
/* 5. gauntlet: A and B on the same seat in one block */
const G5 = world([L.row(SEED + 1, A.owner, 100000, 'pet:throne:' + A.id + ':' + heldSeat), L.row(SEED + 1, B.owner, 100000, 'pet:throne:' + B.id + ':' + heldSeat)], SEED + 2), Bs = G5.w.cem.mg.battles || [];
ok(Bs.length === 2 && Bs[1].holder === Bs[0].winner && !logsAt(G5.w, SEED + 1).some(e => e.kind === 'rejected'), 'two challenges on one seat in one block both fight; the second fights whoever holds it after the first');
/* 6. walkover: the holder released itself */
const G6 = world([L.row(SEED + 1, H5.owner, 1, 'pet:rel:' + H5.id), L.row(SEED + 2, A.owner, 100000, 'pet:throne:' + A.id + ':5')], SEED + 3), B6 = (G6.w.cem.mg.battles || [])[0];
if (G6.w.byId[H5.id].released) ok(B6 && B6.walkover && B6.winner === A.id && G6.w.byId[A.id].mythicGod.seat === 5, 'a holder that left the game loses the seat without a fight');
else ok(false, 'walkover set-up: the holder should have been released');
/* 7. replay determinism */
const again = world([T1], SEED + 2); ok(JSON.stringify(again.w.cem.mg.battles) === JSON.stringify(M1.battles), 'same burns, same battle');
console.log('seat-battles-test: ' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
