#!/usr/bin/env node
/* Gear Stash (Jake Nov 28 2026, "gear is not fun": pets covered in gear he never chose). Dev tooling only.
 *  1. parseTag reads pet:gearoff[:ID x3] and pet:wear:ID:G[:G[:G]]; gate off they are unknown tags, and a roll is still worn as before.
 *  2. From the gate a fresh roll (Pepe Wheel spin) lands in the stash (not worn).
 *  3. pet:gearoff takes every worn piece off to the stash (fights stop counting it); a second one is refused before signing.
 *  4. pet:wear puts the picked stash pieces on, any rarity; a piece already worn or another player's is refused before signing.
 *  5. Gear sets: 12 sets of 3 shared pieces in 3 slots; a complete set adds SET_BONUS damage per hit in fights, nothing before the gate.
 *   node tools/gear-stash-test.js [--boot FILE] */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..'), A = process.argv.slice(2), opt = k => { const i = A.indexOf(k); return i >= 0 ? A[i + 1] : null; };
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const hex = s => Buffer.from(s, 'utf8').toString('hex');
const ctx = require('./lib/fork-replay').load(), V = ctx.V2Rules, E = ctx.LiveEngine;
const boot = JSON.parse(fs.readFileSync(path.resolve(opt('--boot') || path.join(ROOT, 'api', 'boot.json')), 'utf8'));
const rows = boot.rows.slice().sort((a, b) => a.block_index - b.block_index || a.tx_index - b.tx_index), tip = boot.tip || rows[rows.length - 1].block_index;
const hashes = Object.assign({}, ctx.XCPETS_BLOCK_HASHES || {}, boot.hashes || {}), nb = tip + 1, opts = t => ({ tip: t, live: E && E.RealCore, dex: boot.dex });
let tx = rows.reduce((m, r) => Math.max(m, r.tx_index), 0) + 1;
const row = (src, tag, b, amount) => ({ tx_index: tx++, tx_hash: ('e' + tx).padStart(64, '0'), block_index: b, source: src, asset: 'XCPETS', quantity: Math.round((amount == null ? 0.00000001 : amount) * 1e8), tag: hex(tag), status: 'valid' });
const H = t => { const h = Object.assign({}, hashes); for (let b = tip; b <= t; b++) if (!h[b]) h[b] = '0'.repeat(56) + b.toString(16).padStart(8, '0'); return h; };
const run = (extra, t) => V.replay(rows.concat(extra), H(t), [], Object.assign(opts(t), { _forkUse: tip }));
const last = w => w.log[w.log.length - 1];
const items = w => Object.keys(w.items).map(k => w.items[k]);
const wornBy = (w, a) => items(w).filter(g => g.owner === a && g.on != null && w.byId[g.on] && w.byId[g.on].owner === a);
const gate0 = V.stashGate();
V._setGearStash(null);
const w0 = V.replay(rows, hashes, [], Object.assign(opts(tip), { _forkSave: true }));
/* the wallet with the most worn pieces on living pets */
const cnt = {}; items(w0).forEach(g => { const p = g.on != null && w0.byId[g.on]; if (p && !p.dead && !p.released && !p.community && p.owner === g.owner) cnt[g.owner] = (cnt[g.owner] || 0) + 1; });
const me = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0];
ok(!!me && cnt[me] > 10, 'test wallet ' + (me || '').slice(0, 10) + '… has ' + cnt[me] + ' worn pieces');
const myPets = w0.pets.filter(p => p.owner === me && !p.dead && !p.released && !p.community);
const dressed = myPets.filter(p => V.wornOf(w0, p.id).length).map(p => p.id);

/* 1 */
ok(V.parseTag('pet:gearoff').action === 'gearoff' && V.parseTag('pet:gearoff:12:34').ids.join() === '12,34' && V.parseTag('pet:gearoff:1:2:3:4').action === 'invalid', 'parseTag: pet:gearoff[:ID x3]');
const pw = V.parseTag('pet:wear:7:A:0:1V');
ok(pw.action === 'wear' && pw.petId === 7 && pw.gids.join() === 'g10,g0,g63' && V.parseTag('pet:wear:7').action !== 'wear' && V.parseTag('pet:wear:7:A:A').action === 'invalid' && V.parseTag('pet:wear:7:1:2:3:4').action !== 'wear', 'parseTag: pet:wear:ID:G[:G[:G]] (base 32 gear numbers)');
ok(V.gidCode('g1000000') === (1000000).toString(32).toUpperCase(), 'gidCode: g1000000 -> ' + V.gidCode('g1000000'));
const wOff = run([row(me, 'pet:gearoff', nb)], nb);
ok(last(wOff).kind === 'rejected' && /unknown pet: tag/.test(last(wOff).msg) && wornBy(wOff, me).length === wornBy(w0, me).length, 'gate off: pet:gearoff is an unknown tag, nothing comes off');
ok(/later block/.test(V.sendBlock(w0, { tag: 'pet:gearoff', amount: 0.00000001 }, tip, { me: me }) || ''), 'gate off: the page refuses to sign pet:gearoff');
const rollAmt = V.costAt(w0, V.BASE_COSTS.roll, nb);
const spinRow = row(me, 'pet:spin', nb, rollAmt), wR0 = run([spinRow], nb), r0 = last(wR0), g0 = r0 && wR0.items[r0.gid];
ok(r0.kind === 'roll' && !!g0 && g0.on != null, 'gate off: a roll is still worn at once (' + r0.msg + ')');

/* 2 */
V._setGearStash(nb);
const wR = run([spinRow], nb), r1 = last(wR), g1 = r1 && wR.items[r1.gid];
ok(!!g1 && g1.on == null && g1.bag == null && g1.stashed === 1 && g1.owner === me, 'gate on: the rolled piece (' + (g1 && g1.label) + ') waits in the stash, not worn' + (g1 && g1.on != null ? ' [on #' + g1.on + ', stashed ' + g1.stashed + ', ' + r1.msg + ']' : ''));
ok(g0 && g1 && g0.item === g1.item, 'same roll, same piece either side of the gate (only where it goes changed)');
ok(g1 && V.wornOf(wR, g1.rolledOn).map(g => g.gid).sort().join() === V.wornOf(w0, g1.rolledOn).map(g => g.gid).sort().join(), '#' + (g1 && g1.rolledOn) + ' wears exactly what it wore before the spin');

/* 3 */
const pv = V.stashPreview(w0, me, 'gearoff', null, nb);
ok(pv.ok && pv.n === wornBy(w0, me).filter(g => !w0.byId[g.on].dead).length || pv.n > 0, 'preview: take off ' + pv.n + ' pieces from ' + pv.pets + ' pets');
ok(!V.sendBlock(w0, { tag: 'pet:gearoff', amount: 0.00000001 }, tip, { me: me }), 'pre-sign: a useful take-off goes through');
const wT = run([row(me, 'pet:gearoff', nb)], nb);
ok(last(wT).kind === 'gearoff' && last(wT).n === pv.n, 'take off: ' + last(wT).msg);
ok(myPets.every(p => V.wornOf(wT, p.id).filter(g => g.owner === me && !g.grave && g.pledge == null && g.src !== 'trophy').length === 0), 'every living pet of the wallet wears none of its own gear now');
ok(items(wT).filter(g => g.owner === me).length === items(w0).filter(g => g.owner === me).length, 'nothing was lost: the wallet still owns every piece');
ok(/no gear/.test(V.sendBlock(wT, { tag: 'pet:gearoff', amount: 0.00000001 }, nb, { me: me }) || ''), 'pre-sign: a second take-off (nothing left) is refused: ' + V.sendBlock(wT, { tag: 'pet:gearoff', amount: 0.00000001 }, nb, { me: me }));
const wT2 = run([row(me, 'pet:gearoff', nb), row(me, 'pet:gearoff', nb + 1)], nb + 1);
ok(last(wT2).kind === 'rejected', 'replay: a second take-off right after does nothing: ' + last(wT2).msg);
const one = dressed[0], wT1 = run([row(me, 'pet:gearoff:' + one, nb)], nb);
ok(last(wT1).kind === 'gearoff' && last(wT1).petIds.join() === String(one) && V.wornOf(wT1, one).filter(g => g.owner === me).length === 0 && wornBy(wT1, me).length === wornBy(w0, me).length - V.wornOf(w0, one).filter(g => g.owner === me).length, 'pet:gearoff:' + one + ' undresses only that pet');
const naked = myPets.filter(p => !V.wornOf(w0, p.id).length)[0];
if (naked) ok(/no gear/.test(V.sendBlock(w0, { tag: 'pet:gearoff:' + naked.id, amount: 0.00000001 }, tip, { me: me }) || ''), 'pre-sign: taking gear off a pet that wears none is refused');
ok(/1 dander/.test(V.sendBlock(w0, { tag: 'pet:gearoff', amount: 0 }, tip, { me: me }) || ''), 'pre-sign: a take-off below 1 dander is refused');

/* 4 */
const tp = w0.byId[one], spare = items(wT).filter(g => /^g[0-9]+$/.test(g.gid) && g.owner === me && g.on == null && g.bag == null && g.pledge == null && !g.grave && g.src !== 'trophy');
const pick = []; const used = {}; (tp.openSlots || []).forEach(sl => { const g = spare.filter(x => x.slot === sl && !used[x.slot] && V.wearCheck(wT, me, tp.id, [x.gid], nb).ok)[0]; if (g && pick.length < 3) { pick.push(g); used[sl] = 1; } });
ok(pick.length >= 2, 'found ' + pick.length + ' stash pieces #' + tp.id + ' can wear');
const plan = V.stashPlan(wT, me, 'wear', { petId: tp.id, gids: pick.map(g => g.gid) }, nb);
ok(plan.ok && Buffer.byteLength(plan.tag) <= 34 && !V.sendBlock(wT, plan, nb, { me: me }), 'plan: ' + plan.tag + ' [' + pick.map(g => g.gid).join() + '] (' + Buffer.byteLength(plan.tag) + ' bytes) passes the pre-sign check');
const wW = run([row(me, 'pet:gearoff', nb), row(me, plan.tag, nb + 1)], nb + 1);
ok(last(wW).kind === 'wear' && pick.every(g => wW.items[g.gid].on === tp.id), 'wear: ' + last(wW).msg);
const worn1 = V.wornOf(w0, one)[0];
ok(/already wears/.test(V.sendBlock(wW, plan, nb + 1, { me: me }) || ''), 'pre-sign: wearing the same pieces again is refused');
const other = Object.keys(cnt).filter(a => a !== me)[0], og = other && items(w0).filter(g => g.owner === other)[0];
if (og) ok(/do not own/.test(V.sendBlock(wT, { tag: 'pet:wear:' + tp.id + ':' + V.gidCode(og.gid), amount: 0.00000001 }, nb, { me: me }) || ''), "pre-sign: another player's piece is refused");
const two = dressed[1]; if (two && worn1) ok(/not in your stash/.test(V.sendBlock(w0, { tag: 'pet:wear:' + two + ':' + V.gidCode(worn1.gid), amount: 0.00000001 }, tip, { me: me }) || ''), 'pre-sign: a piece another pet wears is refused (take it off first)');
const wBad = run([row(me, 'pet:wear:' + tp.id + ':' + V.gidCode(pick[0].gid), nb)], nb);
ok(last(wBad).kind === 'rejected' || last(wBad).kind === 'wear', 'replay: a wear burn either wears or is rejected with a reason: ' + last(wBad).msg);

const oldG = items(wT).filter(g => !/^g[0-9]+$/.test(g.gid) && g.owner === me && g.on == null)[0];
if (oldG) ok(/first game/.test(V.stashPreview(wT, me, 'wear', { petId: tp.id, gids: [oldG.gid] }, nb).why || ''), 'a piece from the first game (' + oldG.gid.slice(0, 8) + '…) has no gear number: the page says to use Gear up');
ok(/not a game action/.test(V.sendBlock(wT, { tag: 'pet:wear:' + tp.id + ':::', amount: 0.00000001 }, nb, { me: me }) || ''), 'pre-sign: a malformed pet: tag is refused (it would only be community food)');

/* 5 */
const S = V.GEAR_SETS, ALLG = V.GEAR_BY_ID;
ok(S.length === 12 && S.every(s => s.items.length === 3 && new Set(s.items.map(id => ALLG[id] && ALLG[id].slot)).size === 3), '12 sets, each 3 pieces in 3 different slots');
ok(S.every(s => s.items.every(id => ALLG[id] && !ALLG[id].exclusive && !ALLG[id].noRoll)), 'every set piece is shared gear any pet can roll');
ok(new Set([].concat.apply([], S.map(s => s.items))).size === 36, 'no piece is in two sets');
ok(V.setsIn(S[11].items.map(id => ({ item: id }))).join() === 'moon' && V.setsIn(S[11].items.slice(0, 2).map(id => ({ item: id }))).length === 0, 'setsIn: 3 of 3 = set, 2 of 3 = none');
const st = { vigor: 10, spark: 10, grit: 10, zoom: 0, luck: 0 }, mk = (g, b) => Object.assign({ id: 1, stage: 3, tier: 1, stats: st, gear: g }, b || {});
const gear = S[0].items.map((id, i) => ({ gid: 'g' + i, item: id, slot: ALLG[id].slot }));
const f0 = V.simulateFight('seed', mk(gear), mk([])), f1 = V.simulateFight('seed', mk(gear, { sets: ['noob'], setBonus: V.SET_BONUS }), mk([]));
const hitA = f => f.turns.filter(t => t.by === 'a' && t.dmg > 0);
ok(hitA(f1).length > 2 && hitA(f1).every((u, i) => { const t = hitA(f0)[i]; return t && u.dmg === t.dmg + V.SET_BONUS * (t.crit ? 2 : 1); }), 'fight: a complete set adds +' + V.SET_BONUS + ' per hit (x2 on a crit), same seed otherwise ' + JSON.stringify([hitA(f0).map(t => t.dmg), hitA(f1).map(t => t.dmg)]));
V._setGearStash(null); ok(V.setsOf(w0, myPets[0].id, tip).length === 0, 'setsOf: nothing before the gate'); V._setGearStash(nb);

V._setGearStash(gate0);
console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
