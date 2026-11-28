#!/usr/bin/env node
/* Daily Loot real prizes (Jake Nov 27 2026 okayed the plan): pet:loot, once per wallet per game day, no gear. Dev tooling only.
 *  1. parseTag reads pet:loot; gate off it is an unknown tag and changes nothing.
 *  2. the roll table: odds 60/25/10/4/1 over 100k sha rolls, the day-3 floor never gives 1 meal, chests every 7th / 30th day.
 *  3. gate on: a claim lands meals in the Pantry or an egg in the wallet; a second claim the same game day is rejected and refused before signing.
 *  4. a claim the next game day counts the streak; a missed day starts again at 1; Lucky Egg art is always Legendary, Golden keeps the best of 3.
 *   node tools/daily-loot-rules-test.js [--boot FILE] */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..'), A = process.argv.slice(2), opt = k => { const i = A.indexOf(k); return i >= 0 ? A[i + 1] : null; };
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const hex = s => Buffer.from(s, 'utf8').toString('hex');
const ctx = require('./lib/fork-replay').load(), V = ctx.V2Rules, E = ctx.LiveEngine;
const boot = JSON.parse(fs.readFileSync(path.resolve(opt('--boot') || path.join(ROOT, 'api', 'boot.json')), 'utf8'));
const rows = boot.rows.slice().sort((a, b) => a.block_index - b.block_index || a.tx_index - b.tx_index), tip = boot.tip || rows[rows.length - 1].block_index;
const hashes = Object.assign({}, ctx.XCPETS_BLOCK_HASHES || {}, boot.hashes || {}), nb = tip + 1, opts = t => ({ tip: t, live: E && E.RealCore, dex: boot.dex });
let tx = rows[rows.length - 1].tx_index + 1;
const row = (src, tag, b, amount) => ({ tx_index: tx++, tx_hash: ('d' + tx).padStart(64, '0'), block_index: b, source: src, asset: 'XCPETS', quantity: Math.round((amount == null ? 0.00000001 : amount) * 1e8), tag: hex(tag), status: 'valid' });
const H = t => { const h = Object.assign({}, hashes); for (let b = tip; b <= t; b++) if (!h[b]) h[b] = '0'.repeat(56) + b.toString(16).padStart(8, '0'); return h; };
const run = (extra, t) => V.replay(rows.concat(extra), H(t), [], Object.assign(opts(t), { _forkUse: tip }));
const logs = (w, n) => w.log.slice(w.log.length - n);

/* 1. parse + gate off */
ok(V.parseTag('pet:loot').action === 'loot' && V.parseTag('pet:loot:1').action !== 'loot', 'parseTag reads pet:loot (and nothing longer)');
const gate0 = V.lootGate(); ok(gate0 > tip, 'ACTIVATE_LOOT_BLOCK ' + gate0 + ' is above the tip ' + tip + ' (replay unchanged)');
const w0 = V.replay(rows, hashes, [], Object.assign(opts(tip), { _forkSave: true }));
const me = Object.keys(w0.pets.reduce((m, p) => { if (!p.community && !p.dead && p.owner) m[p.owner] = 1; return m; }, {})).sort()[0];
const wOff = run([row(me, 'pet:loot', nb)], nb);
ok(!wOff.loot && logs(wOff, 1)[0].kind !== 'loot', 'gate off: pet:loot is an unknown tag (' + logs(wOff, 1)[0].kind + ')');
ok(V.sendBlock(w0, V.lootPlan(), tip, { me }) !== null, 'gate off: the pre-sign check refuses a claim');

/* 2. roll table */
const cnt = {}; for (let i = 0; i < 100000; i++) { const k = V.lootRoll(crypto.createHash('sha256').update('t' + i).digest('hex'), 1); cnt[k] = (cnt[k] || 0) + 1; }
const pct = k => (cnt[k] || 0) / 1000;
ok(Math.abs(pct('meal1') - 60) < 1 && Math.abs(pct('meal3') - 25) < 1 && Math.abs(pct('egg') - 10) < 0.6 && Math.abs(pct('golden') - 4) < 0.4 && Math.abs(pct('lucky') - 1) < 0.2, 'odds ' + JSON.stringify(cnt));
let floorOk = true; for (let i = 0; i < 20000; i++) if (V.lootRoll(crypto.createHash('sha256').update('f' + i).digest('hex'), 3) === 'meal1') floorOk = false;
ok(floorOk, 'from streak day 3 the chest never gives just 1 meal');
ok(V.lootChest(7) === 'gold' && V.lootChest(14) === 'gold' && V.lootChest(30) === 'lucky' && V.lootChest(210) === 'lucky' && V.lootChest(6) === null && V.lootChest(1) === null, 'Gold Chest every 7th day, Lucky Chest every 30th');
let luckyOk = true, goldBetter = 0; for (let i = 0; i < 40; i++) { const bh = crypto.createHash('sha256').update('b' + i).digest('hex'), tid = crypto.createHash('sha256').update('x' + i).digest('hex');
  if (V.lootEggArt(bh, tid, nb, 'lucky').art.tierIndex !== 3) luckyOk = false; if (V.lootEggArt(bh, tid, nb, 'golden').art.tierIndex >= V.lootEggArt(bh, tid, nb, 'egg').art.tierIndex) goldBetter++; }
ok(luckyOk, 'Lucky Egg art is always Legendary (40 seeds)'); ok(goldBetter === 40, 'Golden Egg is never worse than the plain egg roll (best of 3)');

/* 3. gate on at tip+1 */
V._setLootActivation(nb);
const D = V.lootInfo(w0, me, nb); ok(D.on && !D.claimed && D.next === 1 && D.streak === 0, 'lootInfo before a claim: on, not claimed, next claim is day 1');
ok(V.sendBlock(w0, V.lootPlan(), tip, { me }) === null, 'pre-sign: the first claim of the day is allowed');
ok(/already waiting/.test(V.sendBlock(w0, V.lootPlan(), tip, { me, pending: ['pet:loot'] }) || ''), 'pre-sign: a second claim while one is pending is refused');
ok(/below/.test(V.sendBlock(w0, { tag: 'pet:loot', amount: 0 }, tip, { me }) || ''), 'pre-sign: an amount below 1 dander is refused');
const bal0 = (w0.pantry && w0.pantry[me] && w0.pantry[me].bal) || 0, n0 = w0.nextPet;
const w1 = run([row(me, 'pet:loot', nb), row(me, 'pet:loot', nb)], nb), [l1, l2] = logs(w1, 2), R1 = w1.loot[me];
ok(l1.kind === 'loot' && R1.n === 1 && R1.streak === 1 && R1.day === V.lootInfo(w1, me, nb).day, 'claim lands: ' + l1.msg);
ok(l2.kind === 'rejected' && /already open/.test(l2.msg), 'a second claim the same game day is rejected: ' + l2.msg);
const P1 = w1.pantry[me], meal = V.lootInfo(w0, me, nb).meal;
if (R1.last.meals) ok(Math.abs(P1.bal - bal0 - meal * R1.last.meals) < 1e-8 && Math.abs(P1.won - meal * R1.last.meals) < 1e-8 && w1.nextPet === n0, R1.last.meals + ' meal(s) = ' + R1.last.credit + ' XCPETS into the Pantry, no pet made');
else ok(w1.nextPet === n0 + 1 && w1.byId[R1.last.petId].owner === me && w1.byId[R1.last.petId].loot === R1.last.prize && R1.eggs[0] === R1.last.petId, 'egg prize: #' + R1.last.petId + ' belongs to the claimer');
ok(!Object.keys(w1.items).some(k => w1.items[k].src === 'loot'), 'no gear is ever a prize');
ok(/already opened/.test(V.sendBlock(w1, V.lootPlan(), nb, { me }) || ''), 'pre-sign: after a claim the same game day, a new claim is refused');
const I1 = V.lootInfo(w1, me, nb + 1); ok(I1.claimed && I1.streak === 1, 'lootInfo after a claim: claimed today, streak 1');

/* 4. streak across days: claims on 3 game days in a row, then a gap */
const dS = V.dayStart, d0 = V.lootInfo(w0, me, nb).day, b2 = dS(d0 + 1), b3 = dS(d0 + 2), b5 = dS(d0 + 4);
const w2 = run([row(me, 'pet:loot', nb), row(me, 'pet:loot', b2), row(me, 'pet:loot', b3)], b3), R2 = w2.loot[me];
ok(R2.streak === 3 && R2.best === 3 && R2.n === 3 && R2.last.prize !== 'meal1', 'three game days in a row: streak 3, day 3 prize is ' + R2.last.prize + ' (never just 1 meal)');
ok(V.sendBlock(w2, V.lootPlan(), dS(d0 + 3) - 1, { me }) === null && V.lootInfo(w2, me, dS(d0 + 3)).next === 4, 'the next game day the chest is open again (claim would be day 4)');
const w3 = run([row(me, 'pet:loot', nb), row(me, 'pet:loot', b2), row(me, 'pet:loot', b5)], b5), R3 = w3.loot[me];
ok(R3.streak === 1 && R3.best === 2, 'a missed game day starts the streak again at 1 (best stays 2)');

/* a 7-day run gives the Gold Chest (Golden Egg + 3 meals) */
const seven = []; for (let i = 0; i < 7; i++) seven.push(row(me, 'pet:loot', i ? dS(d0 + i) : nb));
const w7 = run(seven, dS(d0 + 6)), R7 = w7.loot[me], g7 = w7.byId[R7.last.petId];
ok(R7.streak === 7 && R7.gold === 1 && R7.last.chest === 'gold' && R7.last.prize === 'golden' && R7.last.meals === 3 && g7 && g7.loot === 'golden', 'day 7: Gold Chest = Golden Egg #' + (g7 && g7.id) + ' (' + (g7 && g7.tier) + ') + 3 meals');

V._setLootActivation(gate0);
console.log(fails ? fails + ' FAILED' : 'daily-loot-rules-test: all checks pass'); process.exit(fails ? 1 : 0);
