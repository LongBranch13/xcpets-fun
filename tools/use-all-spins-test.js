#!/usr/bin/env node
/* Use-all-spins tests (dev only; owner Oct 27 2026 'use all spins 1 tx'): pet:usespin:all before / after ACTIVATE_USE_ALL_SPINS_BLOCK,
 * and the wheel-pool-once-per-burn speed fix giving the same results as the old per-spin rebuild. */
'use strict';
const crypto = require('crypto');
const { load, row, snap, run } = require('./lib/load-rules');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const S = snap(process.argv[2]), T = S.tip, G = T + 6;
const c = load(), V = c.V2Rules; ok(V.ACTIVATE_USE_ALL_SPINS_BLOCK === 973484 && !V.useAllOn(973483) && V.useAllOn(973484), 'gate 973484 (tip 973478 + 6)'); V._setUseAllActivation(G); V._setFiresaleActivation(null);
ok(V.spinsOn(T + 1), 'saved spins already live at the snapshot tip ' + T);
const w0 = run(c, S, [], T), owners = {}; w0.pets.forEach(p => { if (!p.community && p.owner) owners[p.owner] = 1; });
const rich = Object.keys(owners).map(a => [a, V.spinsLeft(w0, a, G)]).sort((x, y) => y[1] - x[1]), A = rich[0][0], HAVE = rich[0][1];
console.log('  wallet with the most saved spins: ' + A.slice(0, 10) + '… = ' + HAVE);
ok(HAVE > V.SPINS_MAX_PER_BURN, 'test wallet has more than ' + V.SPINS_MAX_PER_BURN + ' spins (' + HAVE + ')');
/* parse + plan */
const pa = V.parseTag('pet:usespin:all');
ok(pa.action === 'usespin' && pa.all === true, 'parse: pet:usespin:all');
ok(V.parseTag('pet:usespin:10').n === 10 && !V.parseTag('pet:usespin:10').all && V.parseTag('pet:usespin:11').action === 'invalid' && V.parseTag('pet:usespin:0').action === 'invalid', 'parse: 1-10 unchanged, 0/11 still invalid');
const plan = V.useAllSpinsPlan(HAVE); ok(plan.tag === 'pet:usespin:all' && plan.amount === 0.00000001 && plan.n === HAVE, 'plan: 1-sat pet:usespin:all');
/* BEFORE the gate: pet:usespin:all is the same as any unknown pet: tag (community food), nothing spent */
const pre = row(G - 1, A, 0.00000001, 'pet:usespin:all'), preX = Object.assign({}, pre, { tag: Buffer.from('pet:usespin:zz', 'utf8').toString('hex') });
const wPre = run(c, S, [pre], G + 3), wPreX = run(c, S, [preX], G + 3), lp = wPre.log.find(l => l.tx === pre.tx_hash);
ok(lp && lp.kind === 'rejected' && /unknown pet: tag \(community food\)/.test(lp.msg), 'before the gate: rejected as an unknown tag (community food) [' + (lp && lp.msg) + ']');
const strip = w => JSON.stringify({ log: w.log, items: w.items, spins: w.spins, pets: w.pets.map(p => [p.id, p.owner, p.care, p.stage]) });
ok(strip(wPre) === strip(wPreX), 'before the gate: world identical to an unknown tag with the same tx');
ok(V.spinsLeft(wPre, A, G) === HAVE, 'before the gate: no spins spent (' + V.spinsLeft(wPre, A, G) + ')');
ok(/opens at block/.test(V.sendBlock(w0, { tag: 'pet:usespin:all' }, G - 2, { me: A }) || ''), 'send guard before the gate: "Use all spins opens at block ' + G + '"');
/* AT / AFTER the gate: one burn uses every spin (> 10, no cap) */
const post = row(G, A, 0.00000001, 'pet:usespin:all'), post2 = row(G + 1, A, 0.00000001, 'pet:usespin:all');
let t0 = Date.now(); const wNew = run(c, S, [post, post2], G + 3), msNew = Date.now() - t0;
const lu = wNew.log.find(l => l.tx === post.tx_hash), lu2 = wNew.log.find(l => l.tx === post2.tx_hash);
ok(lu && lu.kind === 'roll' && lu.saved && lu.all && lu.spins.length === HAVE, 'after the gate: one burn used all ' + HAVE + ' spins (' + (lu && lu.spins.length) + ') [' + (lu && lu.msg) + ']');
ok(V.spinsLeft(wNew, A, G + 3) === 0, 'after the gate: 0 spins left');
ok(lu2 && lu2.kind === 'rejected' && /no saved spins left/.test(lu2.msg), 'second pet:usespin:all with 0 left: rejected, nothing spent');
ok(wNew.spins[A].log.some(x => x.tx === post.tx_hash && x.n === -HAVE), 'spin ledger logs -' + HAVE);
ok(V.sendBlock(wNew, { tag: 'pet:usespin:all' }, G + 3, { me: A }) === 'no saved spins left', 'send guard: no saved spins left');
ok(V.spinsLeft(w0, A, G, ['pet:usespin:all']) === 0, 'an unconfirmed pet:usespin:all counts as spending them all');
const gs = lu ? lu.spins.map(s => wNew.items[s.gid]) : [], bag = gs.filter(g => g.bag != null).length, worn = gs.filter(g => g.on != null).length, stash = gs.length - bag - worn;
console.log('  ' + HAVE + ' spins: ' + worn + ' worn, ' + bag + ' in pet bags, ' + stash + ' in the stash; ' + new Set(lu ? lu.spins.map(s => s.petId) : []).size + ' pets');
ok(gs.length === HAVE && gs.every(g => g.owner === A && g.src === 'usespin' && g.saved), 'every piece belongs to the signer');
/* SPEED FIX: the old per-spin pool rebuild gives the exact same results */
const H = w => crypto.createHash('sha256').update(JSON.stringify({ log: w.log, items: w.items, bags: w.bags || {}, spins: w.spins, list: (w.itemList || []).map(g => g.gid), pets: w.pets.map(p => [p.id, p.owner, p.stage, p.openSlots, p.capacity]) })).digest('hex');
V._setWheelPoolEachSpin(true); t0 = Date.now(); const wOld = run(c, S, [post, post2], G + 3), msOld = Date.now() - t0; V._setWheelPoolEachSpin(false);
ok(H(wNew) === H(wOld), 'speed fix: ' + HAVE + '-spin burn identical to the per-spin pool rebuild (' + H(wNew).slice(0, 12) + ')');
const ten = [row(G, A, 0.00000001, 'pet:usespin:10'), row(G + 1, rich[1][0], 0.00000001, 'pet:usespin:7')];
const wT1 = run(c, S, ten, G + 3); V._setWheelPoolEachSpin(true); const wT0 = run(c, S, ten, G + 3); V._setWheelPoolEachSpin(false);
ok(H(wT1) === H(wT0) && wT1.log.find(l => l.tx === ten[0].tx_hash).spins.length === 10, 'speed fix: pet:usespin:10 / :7 identical too');
console.log('  replay with the ' + HAVE + '-spin burn: ' + msNew + ' ms (pool once per burn) vs ' + msOld + ' ms (pool every spin)');
console.log(`use-all-spins-test: ${pass}/${pass + fail} pass`); process.exitCode = fail ? 1 : 0;
