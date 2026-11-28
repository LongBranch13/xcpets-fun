#!/usr/bin/env node
/* Holder welcome gift (Jake Nov 28 2026: one-time free starter pack for XCPETS holders who never played): pet:welcome. Dev tooling only.
 *  1. parseTag reads pet:welcome; gate off it is an unknown tag and changes nothing; the list is fixed (97 wallets, none that ever burned before).
 *  2. gate on: a listed wallet's claim makes 3 Eggs (the last Golden, best of 3 rolls) + 3 Pantry meals; a second claim is rejected and refused before signing.
 *  3. a wallet not on the list, a late claim (after WELCOME_DAYS game days) and a below-cost burn are rejected and refused before signing.
 *  4. with EGG HATCH on, the gift eggs are born Eggs (care 0) and the 3 meals are enough to hatch all of them.
 *   node tools/welcome-gift-rules-test.js [--boot FILE] */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..'), A = process.argv.slice(2), opt = k => { const i = A.indexOf(k); return i >= 0 ? A[i + 1] : null; };
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const hex = s => Buffer.from(s, 'utf8').toString('hex');
const ctx = require('./lib/fork-replay').load(), V = ctx.V2Rules, E = ctx.LiveEngine;
const boot = JSON.parse(fs.readFileSync(path.resolve(opt('--boot') || path.join(ROOT, 'api', 'boot.json')), 'utf8'));
const rows = boot.rows.slice().sort((a, b) => a.block_index - b.block_index || a.tx_index - b.tx_index), tip = boot.tip || rows[rows.length - 1].block_index;
const hashes = Object.assign({}, ctx.XCPETS_BLOCK_HASHES || {}, boot.hashes || {}), nb = tip + 1, opts = t => ({ tip: t, live: E && E.RealCore, dex: boot.dex });
let tx = rows[rows.length - 1].tx_index + 1;
const row = (src, tag, b, amount) => ({ tx_index: tx++, tx_hash: ('e' + tx).padStart(64, '0'), block_index: b, source: src, asset: 'XCPETS', quantity: Math.round((amount == null ? 0.00000001 : amount) * 1e8), tag: hex(tag), status: 'valid' });
const H = t => { const h = Object.assign({}, hashes); for (let b = tip; b <= t; b++) if (!h[b]) h[b] = '0'.repeat(56) + b.toString(16).padStart(8, '0'); return h; };
const run = (extra, t) => V.replay(rows.concat(extra), H(t), [], Object.assign(opts(t), { _forkUse: tip }));
const logs = (w, n) => w.log.slice(w.log.length - n);

/* 1. parse, list, gate off */
ok(V.parseTag('pet:welcome').action === 'welcome' && V.parseTag('pet:welcome:1').action !== 'welcome', 'parseTag reads pet:welcome (and nothing longer)');
const L = V.WELCOME_LIST, snap = V.WELCOME_SNAPSHOT_BLOCK;
ok(L.length === 97 && new Set(L).size === 97, 'the welcome list holds 97 different wallets');
const burnedBefore = new Set(rows.filter(r => r.block_index <= snap && r.status === 'valid').map(r => r.source));
ok(!L.some(a => burnedBefore.has(a)), 'no listed wallet burned for the game up to the snapshot block ' + snap);
ok(!L.some(a => /^1CounterpartyXXX/.test(a)), 'the burn address is not on the list');
const gate0 = V.welcomeGate(); ok(gate0 > tip - 2000 && gate0 > snap, 'ACTIVATE_WELCOME_BLOCK ' + gate0 + ' is after the snapshot');
V._setWelcomeActivation(null);
const w0 = V.replay(rows, hashes, [], Object.assign(opts(tip), { _forkSave: true }));
const me = L.find(a => !w0.pets.some(p => p.owner === a)) || L[0];
const player = rows.filter(r => r.status === 'valid' && r.quantity > 1e6).map(r => r.source).sort()[0]; /* a wallet that has burned for the game */
const wOff = run([row(me, 'pet:welcome', nb)], nb);
ok(!wOff.welcome && logs(wOff, 1)[0].kind !== 'welcome', 'gate off: pet:welcome is an unknown tag (' + logs(wOff, 1)[0].kind + ')');
ok(V.sendBlock(w0, V.welcomePlan(), tip, { me }) !== null, 'gate off: the pre-sign check refuses a claim');

/* 2. gate on at tip+1: a listed wallet claims */
V._setWelcomeActivation(nb);
const I0 = V.welcomeInfo(w0, me, nb); ok(I0.on && I0.open && I0.listed && !I0.claimed && I0.daysLeft === V.WELCOME_DAYS, 'welcomeInfo before a claim: on, open, listed, not claimed, ' + I0.daysLeft + ' days left');
ok(V.sendBlock(w0, V.welcomePlan(), tip, { me }) === null, 'pre-sign: a listed wallet may claim');
ok(/already waiting/.test(V.sendBlock(w0, V.welcomePlan(), tip, { me, pending: ['pet:welcome'] }) || ''), 'pre-sign: a second claim while one is pending is refused');
ok(/below/.test(V.sendBlock(w0, { tag: 'pet:welcome', amount: 0 }, tip, { me }) || ''), 'pre-sign: an amount below 1 dander is refused');
const n0 = w0.nextPet, bal0 = (w0.pantry && w0.pantry[me] && w0.pantry[me].bal) || 0;
const w1 = run([row(me, 'pet:welcome', nb), row(me, 'pet:welcome', nb)], nb), [l1, l2] = logs(w1, 2), R1 = w1.welcome[me];
ok(l1.kind === 'welcome' && R1 && R1.eggs.length === 3, 'claim lands: ' + l1.msg);
ok(l2.kind === 'rejected' && /already claimed/.test(l2.msg), 'a second claim is rejected: ' + l2.msg);
const eggs = R1.eggs.map(id => w1.byId[id]);
ok(w1.nextPet === n0 + 3 && eggs.every(p => p && p.owner === me && !p.dead), '3 new pets belong to the claimer: #' + R1.eggs.join(', #'));
ok(eggs[2].welcome === 'golden' && eggs[0].welcome === 'egg' && eggs[1].welcome === 'egg', 'the last egg is the Golden Egg');
const meal = V.welcomeInfo(w0, me, nb).meal;
ok(Math.abs(w1.pantry[me].bal - bal0 - meal * 3) < 1e-8 && Math.abs(R1.credit - meal * 3) < 1e-8, '3 meals = ' + R1.credit + ' XCPETS into the Pantry');
ok(!Object.keys(w1.items).some(k => w1.items[k].owner === me), 'no gear is part of the gift');
ok(/already claimed/.test(V.sendBlock(w1, V.welcomePlan(), nb, { me }) || ''), 'pre-sign: after the claim a new claim is refused');
ok(V.welcomeInfo(w1, me, nb + 1).claimed, 'welcomeInfo after the claim: claimed');
let goldOk = true; for (let i = 0; i < 40; i++) { const bh = require('crypto').createHash('sha256').update('w' + i).digest('hex'), t = require('crypto').createHash('sha256').update('t' + i).digest('hex');
  const g = V.welcomeEggArt(bh, t, nb, 2); if (!g.art || !/:8902[0-2]$/.test(g.id)) goldOk = false; }
ok(goldOk, 'Golden Egg rolls use their own sub-ids (89020-89022), never the loot or pack ids');

/* 3. not listed, late, below cost */
const w2 = run([row(player, 'pet:welcome', nb)], nb), l3 = logs(w2, 1)[0];
ok(!L.includes(player) && l3.kind === 'rejected' && /not on the holder welcome list/.test(l3.msg) && !(w2.welcome && w2.welcome[player]), 'a wallet that already played is not on the list: ' + l3.msg);
ok(/not on the holder welcome list/.test(V.sendBlock(w0, V.welcomePlan(), tip, { me: player }) || ''), 'pre-sign: a wallet not on the list is refused');
const lateB = (() => { let b = nb; while (V.welcomeOpen(b)) b += 144; return b; })();
const w3 = run([row(me, 'pet:welcome', lateB)], lateB), l4 = logs(w3, 1)[0];
ok(l4.kind === 'rejected' && /ended/.test(l4.msg) && !(w3.welcome && w3.welcome[me]), 'a claim after ' + V.WELCOME_DAYS + ' game days is rejected (block ' + lateB + '): ' + l4.msg);
ok(/ended/.test(V.sendBlock(w0, V.welcomePlan(), lateB - 1, { me }) || ''), 'pre-sign: a late claim is refused');
const w4 = run([row(me, 'pet:welcome', nb, 0)], nb), l5 = logs(w4, 1)[0];
ok(l5.kind !== 'welcome' && !(w4.welcome && w4.welcome[me]), 'a 0-amount burn gives nothing (' + l5.kind + ')');

/* 4. EGG HATCH on: the gift eggs are Eggs, and the 3 meals hatch them */
const eg0 = V.eggHatchGate(); V._setEggHatch(nb);
const w5 = run([row(me, 'pet:welcome', nb)], nb), E5 = w5.welcome[me].eggs.map(id => w5.byId[id]);
ok(E5.every(p => p.care === 0 && p.stage === 0), 'EGG HATCH on: the gift eggs are born Eggs (care 0)');
const pi = V.pantryInfo ? V.pantryInfo(w5, me, nb + 1) : null, mealNow = V.welcomeInfo(w5, me, nb + 1).meal;
ok(w5.pantry[me].bal + 1e-9 >= mealNow * E5.length, 'the Pantry (' + w5.pantry[me].bal + ') pays a hatching meal (' + mealNow + ') for each egg');
V._setEggHatch(eg0);
V._setWelcomeActivation(gate0);
console.log(fails ? fails + ' FAILED' : 'welcome-gift-rules-test: all checks pass'); process.exit(fails ? 1 : 0);
