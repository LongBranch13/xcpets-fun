#!/usr/bin/env node
/* daily-chores (PLAN item 8, owner Nov 1 2026 [pt2570u]; PREVIEW, gate not set): checks for the pet:dc:F[:AA:RUNS] one-burn daily chores tag.
 *  1. parse: flags 0-3, optional feed-runs part, 34-byte limit.   2. gate off (null, as shipped): plan is null, a pet:dc burn is an unknown tag (community food),
 *     world identical to any other unknown tag.   3. gate on (tip + 1, live world api/boot.json): one pet:dc burn = WAGMI + feed runs + use all spins,
 *     same result as the three separate burns (care, fed days, WAGMI day, spins used).   4. skips: a second burn the same day does nothing -> rejected.
 *   5. every owner's plan fits 34 bytes and needs fewer burns than the old daily routine.   6. send guard.   node tools/daily-chores-test.js [--boot FILE] */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { load, ROOT } = require('./lib/load-rules');
const A = process.argv.slice(2), opt = k => { const i = A.indexOf(k); return i >= 0 ? A[i + 1] : null; };
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const hex = s => Buffer.from(s, 'utf8').toString('hex');
const ctx = load(), V = ctx.V2Rules, E = ctx.LiveEngine;
/* 1. parse */
const P = t => V.parseTag(t);
ok(P('pet:dc:1').action === 'chores' && P('pet:dc:1').wagmi && !P('pet:dc:1').spins && !P('pet:dc:1').runs, 'parse: pet:dc:1 = WAGMI only');
ok(P('pet:dc:2').spins && !P('pet:dc:2').wagmi && P('pet:dc:3').wagmi && P('pet:dc:3').spins, 'parse: pet:dc:2 = spins, pet:dc:3 = both');
ok(P('pet:dc:0').action === 'invalid' && P('pet:dc:4').action === 'invalid' && P('pet:dc').action !== 'chores' && P('pet:dc:3:00').action === 'invalid', 'parse: 0 alone, 4+, missing flag, half a feed part = invalid');
const pr = P('pet:dc:3:A1:0513'); ok(pr.action === 'chores' && pr.a === parseInt('A1', 32) && JSON.stringify(pr.runs) === '[0,5,1,3]', 'parse: feed part reads like pet:fr (anchor A1, runs 0,5,1,3)');
ok(P('pet:dc:0:A1:05').action === 'chores' && !P('pet:dc:0:A1:05').wagmi, 'parse: flag 0 with a feed part = feed only');
ok(P('pet:dc:3:00:' + '1'.repeat(22)).action === 'chores' && P('pet:dc:3:00:' + '1'.repeat(23)).action === 'invalid', 'parse: 22 run characters fit (34 bytes), 23 do not');
ok(P('pet:dc:3:00:00').action === 'invalid', 'parse: a take run of 0 is invalid (same as pet:fr)');
/* live world */
const boot = JSON.parse(fs.readFileSync(path.resolve(opt('--boot') || path.join(ROOT, 'api', 'boot.json')), 'utf8'));
const rows = boot.rows.slice().sort((a, b) => a.block_index - b.block_index || a.tx_index - b.tx_index), tip = boot.tip || rows[rows.length - 1].block_index, nb = tip + 1;
const hashes = Object.assign({}, ctx.XCPETS_BLOCK_HASHES || {}, boot.hashes || {}); [nb, nb + 1, nb + 2].forEach(b => { if (!hashes[b]) hashes[b] = crypto.createHash('sha256').update('fake-block-' + b).digest('hex'); });
const opts = t => ({ tip: t, live: E && E.RealCore, dex: boot.dex }); let txi = rows[rows.length - 1].tx_index + 1;
const mk = (b, src, amt, tag, seed) => ({ tx_index: txi++, tx_hash: crypto.createHash('sha256').update('dc-test:' + (seed || tag) + ':' + b + ':' + txi).digest('hex'), block_index: b, source: src, asset: 'XCPETS', quantity: Math.round(amt * 1e8), tag: hex(tag), status: 'valid' });
ok(V.dailyChoresGate() === null && !V.choresOn(nb) && !V.choresOn(9e9), 'gate as shipped: ACTIVATE_DAILY_CHORES_BLOCK = null (placeholder, set to tip + 6 at deploy), rule off at every block');
const w = V.replay(rows, hashes, [], opts(tip));
const owners = {}; w.pets.forEach(p => { if (!p.community && !p.dead && !p.released && p.owner) (owners[p.owner] = owners[p.owner] || []).push(p); });
ok(V.dailyChoresPlan(w, Object.keys(owners)[0], nb) === null, 'gate off: the planner offers nothing');
ok(/not set yet/.test(V.sendBlock(w, { tag: 'pet:dc:3' }, tip, { me: Object.keys(owners)[0] }) || ''), 'gate off: send guard says "opens at block (not set yet)"');
/* 2. gate off: same as any unknown tag */
const said = o => !!(w.wagmi[o] && w.wagmi[o][V.day(nb)]), who = Object.keys(owners).map(o => ({ o, eat: owners[o].filter(p => V.frEats(p, nb)).length, spins: V.spinsLeft(w, o, nb), said: said(o) })).filter(x => x.eat <= 400).sort((a, b) => (b.eat > 0) - (a.eat > 0) || a.said - b.said || (b.spins > 0) - (a.spins > 0) || b.eat - a.eat)[0];
console.log('  test wallet ' + who.o.slice(0, 10) + '…: ' + who.eat + ' pets that eat, ' + who.spins + ' saved spins, WAGMI today: ' + who.said);
{ const r1 = mk(nb, who.o, 1, 'pet:dc:3', 'g'), r2 = Object.assign({}, r1, { tag: hex('pet:zz:3') });
  const a = V.replay(rows.concat([r1]), hashes, [], opts(nb + 1)), b = V.replay(rows.concat([r2]), hashes, [], opts(nb + 1)), l = a.log.find(x => x.tx === r1.tx_hash);
  ok(l && l.kind === 'rejected' && /unknown pet: tag \(community food\)/.test(l.msg), 'gate off: pet:dc burn = unknown pet: tag (community food) [' + (l && l.msg) + ']');
  const strip = x => JSON.stringify({ log: x.log, wagmi: x.wagmi, spins: x.spins, pets: x.pets.map(p => [p.id, p.owner, p.care, p.lastFed]), c: x.community.burned });
  ok(strip(a) === strip(b), 'gate off: world identical to an unknown pet: tag with the same tx'); }
/* 3. gate on */
V._setDailyChoresActivation(nb); ok(V.choresOn(nb) && !V.choresOn(nb - 1), 'gate set to ' + nb + ' (test only): on from that block');
const plan = V.dailyChoresPlan(w, who.o, nb); ok(!!plan && /^pet:dc:[0-3]/.test(plan.plans[0].tag), 'plan: first burn is pet:dc [' + (plan && plan.plans.map(q => q.tag + ' @ ' + q.amount).join(' | ')) + ']');
if (plan) { const head = plan.plans[0], all = plan.plans.map(q => mk(nb, who.o, q.amount, q.tag)), want = new Set(plan.plans.reduce((a, q) => a.concat(q.petIds || []), []));
  ok(plan.plans.every(q => Buffer.byteLength(q.tag) <= 34), 'plan: every tag fits 34 bytes');
  const w2 = V.replay(rows.concat(all), hashes, [], opts(nb + 1)), lc = w2.log.find(x => x.tx === all[0].tx_hash && x.kind === 'chores');
  ok(!!lc, 'engine: chores burn logged [' + (lc && lc.msg) + ']');
  ok(head.parts.wagmi ? !!(w2.wagmi[who.o] && w2.wagmi[who.o][V.day(nb)]) : true, 'engine: WAGMI check-in counted for chain day ' + V.day(nb));
  const fed = w2.pets.filter(p => p.lastFed === nb).map(p => p.id); ok(want.size > 0 && fed.length === want.size && fed.every(id => want.has(id)), 'engine: fed exactly the ' + want.size + ' planned pets');
  ok(V.spinsLeft(w2, who.o, nb + 1) === 0, 'engine: no saved spins left (all used, incl. spins earned in the same burn)');
  /* same as three separate burns (feed / WAGMI / use all) */
  const sep = []; if (head.parts.wagmi) sep.push(mk(nb, who.o, 0.00000001, 'pet:wagmi')); if (head.petIds.length) sep.push(mk(nb, who.o, head.amount, 'pet:fr:' + head.tag.split(':').slice(3).join(':')));
  sep.push.apply(sep, all.slice(1).map(r => mk(nb, who.o, r.quantity / 1e8, Buffer.from(r.tag, 'hex').toString()))); const usp = mk(nb, who.o, 0.00000001, 'pet:usespin:all'); sep.push(usp);
  const w3 = V.replay(rows.concat(sep), hashes, [], opts(nb + 1)), care = x => JSON.stringify(x.pets.filter(p => p.owner === who.o).map(p => [p.id, p.care, p.lastFed]));
  ok(care(w2) === care(w3), 'same care and fed days as ' + sep.length + ' separate burns');
  ok(JSON.stringify(w2.wagmi[who.o] || {}) === JSON.stringify(w3.wagmi[who.o] || {}), 'same WAGMI days as separate burns');
  const used = x => (x.spins && x.spins[who.o] ? x.spins[who.o].used : 0); console.log('  spins used: one burn ' + used(w2) + ', separate burns ' + used(w3) + ' (separate: the spin burn comes last; lucky drops differ by tx seed)');
  ok(V.spinsLeft(w3, who.o, nb + 1) === 0 && V.spinsLeft(w2, who.o, nb + 1) === 0, 'both ways end with 0 saved spins');
  ok(w2.community.burned - w.community.burned < w3.community.burned - w.community.burned + 1e-9, 'one burn burns no more XCPETS than separate burns (' + (w2.community.burned - w.community.burned).toFixed(8) + ' vs ' + (w3.community.burned - w.community.burned).toFixed(8) + ')');
  /* 4. second burn the same day: every part skipped -> rejected, nothing changes */
  const again = mk(nb + 1, who.o, 0.00000001, 'pet:dc:3'), w4 = V.replay(rows.concat(all, [again]), hashes, [], opts(nb + 2)), la = w4.log.filter(x => x.tx === again.tx_hash);
  ok(la.some(x => x.kind === 'rejected' && /did nothing/.test(x.msg)) && la.filter(x => x.kind === 'chores-skip').length === 2, 'second pet:dc:3 the same day: WAGMI + spins skipped, burn rejected [' + la.map(x => x.msg).join(' / ') + ']');
  ok(V.dailyChoresPlan(w2, who.o, nb + 1) === null, 'planner: nothing left to do after the chores');
  ok(/waiting to confirm/.test(V.sendBlock(w, head, tip, { me: who.o, pending: [head.tag] }) || ''), 'send guard: one chores burn at a time');
  ok(V.sendBlock(w, head, tip, { me: who.o }) === null, 'send guard: the planned burn may go');
  /* partial: spins only, none left -> rejected; WAGMI-only for a wallet that already said it today -> rejected */
  const sp0 = mk(nb + 1, who.o, 0.00000001, 'pet:dc:2'), w5 = V.replay(rows.concat(all, [sp0]), hashes, [], opts(nb + 2));
  ok(w5.log.some(x => x.tx === sp0.tx_hash && x.kind === 'rejected'), 'pet:dc:2 with 0 spins left: rejected (community food)'); }
/* 5. every owner: burns per day, old vs new */
let oldT = 0, newT = 0, fit = true, n = 0; Object.keys(owners).forEach(o => { const q = V.dailyChoresPlan(w, o, nb); if (!q) return; n++; oldT += q.oldBurns; newT += q.plans.length; if (!q.plans.every(x => Buffer.byteLength(x.tag) <= 34)) fit = false; });
ok(fit, 'every owner\u2019s plan fits 34 bytes (' + n + ' owners with something to do)');
ok(newT <= oldT, 'burns for one day of chores, all owners: old ' + oldT + ', new ' + newT + ' (' + (oldT - newT) + ' fewer signatures)');
V._setDailyChoresActivation(null);
console.log('\n' + (fails ? fails + ' FAILED' : 'all ok') + '  (gate in the code: ' + V.dailyChoresGate() + ')'); process.exitCode = fails ? 1 : 0;
