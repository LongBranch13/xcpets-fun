#!/usr/bin/env node
/* Gear Forge (Jake Nov 26 2026, picked "Wear for real + Smash + Fuse"): pet:gearup / pet:smash:T / pet:fuse / pet:dustroll:ID. Dev tooling only.
 *  1. parseTag reads the four tags; gate off they are unknown tags and change nothing.
 *  2. smash melts spare copies into Gear Dust, keeps one copy of every piece, never touches worn gear.
 *  3. fuse turns 3 spare copies into 1 piece of the same slot one rarity higher.
 *  4. gearup wears the best spare pieces on chain (no op needed), never lowers a slot, and battles' gear power goes up.
 *  5. dustroll spends 100 Gear Dust for one roll; the pre-sign check refuses forge burns that would do nothing.
 *   node tools/gear-forge-test.js [--boot FILE] */
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
const row = (src, tag, b, amount) => ({ tx_index: tx++, tx_hash: ('f' + tx).padStart(64, '0'), block_index: b, source: src, asset: 'XCPETS', quantity: Math.round((amount == null ? 0.00000001 : amount) * 1e8), tag: hex(tag), status: 'valid' });
const H = t => { const h = Object.assign({}, hashes); for (let b = tip; b <= t; b++) if (!h[b]) h[b] = '0'.repeat(56) + b.toString(16).padStart(8, '0'); return h; };
const run = (extra, t) => V.replay(rows.concat(extra), H(t), [], Object.assign(opts(t), { _forkUse: tip }));
const last = w => w.log[w.log.length - 1];
const mine = (w, a) => Object.keys(w.items).map(k => w.items[k]).filter(g => g.owner === a);
const kinds = (w, a) => { const m = {}; mine(w, a).forEach(g => { m[g.item] = (m[g.item] || 0) + 1; }); return m; };
const dmgOf = (w, pid) => V.wornOf(w, pid).reduce((s, g) => s + 1 + 2 * (g.tier | 0), 0);

const w0 = V.replay(rows, hashes, [], Object.assign(opts(tip), { _forkSave: true }));
/* the wallet with the most spare pieces */
const spare = {}; Object.keys(w0.items).forEach(k => { const g = w0.items[k]; if (g.owner && g.on == null && g.bag == null) spare[g.owner] = (spare[g.owner] || 0) + 1; });
const me = Object.keys(spare).sort((a, b) => spare[b] - spare[a])[0];
ok(!!me && spare[me] > 50, 'test wallet ' + (me || '').slice(0, 10) + '… has ' + spare[me] + ' pieces in its stash');

/* 1 */
ok(V.parseTag('pet:gearup').action === 'gearup' && V.parseTag('pet:gearup:12:34').ids.join() === '12,34' && V.parseTag('pet:gearup:1:2:3:4').action === 'invalid', 'parseTag: pet:gearup[:ID x3]');
ok(V.parseTag('pet:smash:R').top === 2 && V.parseTag('pet:smash:X').action === 'invalid' && V.parseTag('pet:fuse').action === 'fuse' && V.parseTag('pet:dustroll:7').petId === 7, 'parseTag: smash / fuse / dustroll');
/* the forge went live at its gate (977,675, Nov 26 2026): the gate in the code is a block number or still off; the gate-off check below sets it off itself */
const gate0 = V.forgeGate(); ok(gate0 === null || Number.isInteger(gate0), 'gate in the code: ' + (gate0 === null ? 'off' : gate0 + (gate0 <= tip ? ' (live, feed tip ' + tip + ')' : ' (ahead of the feed tip ' + tip + ')')));
V._setGearForge(null);
const wOff = run([row(me, 'pet:smash:L', nb)], nb);
ok(last(wOff).kind === 'rejected' && /unknown pet: tag/.test(last(wOff).msg) && mine(wOff, me).length === mine(w0, me).length, 'gate off: pet:smash is an unknown tag, nothing melts');

/* 2 */
V._setGearForge(nb);
const k0 = kinds(w0, me), worn0 = mine(w0, me).filter(g => g.on != null).map(g => g.gid).sort().join();
const pv = V.forgePreview(w0, me, 'smash', 0, nb);
const wS = run([row(me, 'pet:smash:C', nb)], nb), k1 = kinds(wS, me);
ok(last(wS).kind === 'smash' && wS.dust[me] === pv.dust && pv.dust > 0, 'smash Commons: ' + last(wS).msg + ' (preview said ' + pv.n + ' pieces, ' + pv.dust + ' dust)');
ok(Object.keys(k0).every(id => k1[id] >= 1), 'every piece the wallet owned still has at least one copy (' + Object.keys(k0).length + ' kinds)');
ok(mine(wS, me).filter(g => g.on != null).map(g => g.gid).sort().join() === worn0, 'no worn piece was smashed');
ok(Object.keys(wS.items).map(k => wS.items[k]).filter(g => g.spent && g.spent.why === 'smash').every(g => (g.tier | 0) === 0 && g.owner == null), 'only Commons melted, and they belong to nobody now');

/* 3 */
const fp = V.forgePreview(w0, me, 'fuse', null, nb);
const wF = run([row(me, 'pet:fuse', nb)], nb), fused = Object.keys(wF.items).map(k => wF.items[k]).filter(g => g.src === 'fuse');
if (fp.ok) { ok(last(wF).kind === 'fuse' && fused.length === fp.n, 'fuse: ' + last(wF).msg);
  ok(fused.every(g => { const from = ctx.V2Gear && null; const src = Object.keys(wF.items).map(k => wF.items[k]).filter(x => x.spent && x.spent.why === 'fuse' && x.item === g.fusedFrom)[0]; return src && src.slot === g.slot && (g.tier | 0) === (src.tier | 0) + 1; }), 'each fused piece is the same slot, one rarity higher');
  ok(Object.keys(k0).every(id => kinds(wF, me)[id] >= 1), 'fuse also keeps one copy of every piece'); }
else ok(last(wF).kind === 'rejected', 'fuse with nothing to fuse is rejected (' + fp.why + ')');

/* 4 */
const gp = V.forgePreview(w0, me, 'gearup', [], nb), pets = Array.from(new Set(gp.moves.map(m => m.petId)));
const wG = run([row(me, 'pet:gearup', nb)], nb);
ok(gp.ok && last(wG).kind === 'gearup' && last(wG).n === gp.n, 'gear up: ' + last(wG).msg + ' (preview ' + gp.n + ')');
ok(pets.every(id => dmgOf(wG, id) >= dmgOf(w0, id)) && pets.some(id => dmgOf(wG, id) > dmgOf(w0, id)), 'no pet lost damage per hit, ' + pets.length + ' gained (no local op involved: this is chain gear, the gear battles read)');
const wG2 = run([row(me, 'pet:gearup', nb), row(me, 'pet:gearup', nb + 1)], nb + 1);
ok(last(wG2).kind === 'rejected', 'a second gear up right after has nothing left to do: ' + last(wG2).msg);
const one = pets[0], w1 = run([row(me, 'pet:gearup:' + one, nb)], nb);
ok(last(w1).kind === 'gearup' && last(w1).petIds.join() === String(one), 'pet:gearup:' + one + ' dresses only that pet');

/* 5 */
const wD0 = run([row(me, 'pet:smash:L', nb), row(me, 'pet:dustroll:' + one, nb + 1)], nb + 1), d0 = wD0.dust[me];
const smL = wD0.log.filter(l => l.kind === 'smash').pop();
if (smL && (smL.dust || 0) >= 100) ok(last(wD0).kind === 'roll' && last(wD0).dust && d0 === smL.dust - 100, 'dust roll: ' + last(wD0).msg);
else ok(last(wD0).kind === 'rejected' && /Gear Dust/.test(last(wD0).msg), 'dust roll without 100 dust is rejected: ' + last(wD0).msg);
ok(/nothing|already/.test(V.sendBlock(wG, { tag: 'pet:gearup', amount: 0.00000001 }, nb, { me: me }) || ''), 'pre-sign: a gear up that would do nothing is blocked');
ok(/Gear Dust/.test(V.sendBlock(w0, { tag: 'pet:dustroll:' + one, amount: 0.00000001 }, nb, { me: me }) || '') || (w0.dust || {})[me] >= 100, 'pre-sign: a dust roll without the dust is blocked');
ok(!V.sendBlock(w0, { tag: 'pet:gearup', amount: 0.00000001 }, nb, { me: me }), 'pre-sign: a useful gear up goes through');
V._setGearForge(null); ok(/later block/.test(V.sendBlock(w0, { tag: 'pet:fuse', amount: 0.00000001 }, nb, { me: me }) || ''), 'pre-sign: before the gate every forge burn is blocked');
V._setGearForge(gate0);
console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
