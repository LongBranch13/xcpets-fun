#!/usr/bin/env node
/* SEANCE ALWAYS RAISES (owner approved Nov 1 2026 1:40 AM CT [pt2553u] "Yes live do that. It seems less confusing"): checks for
 * ACTIVATE_SEANCE_RAISES_BLOCK. From the gate every valid seance raises the pet for its sender, no seance is turned into a pledge and pledging
 * to a shared pool is gone. Below the gate the old rules run unchanged.
 *   node tools/seance-raises-test.js [--boot FILE]   Dev tooling only. */
'use strict';
const fs = require('fs'), path = require('path');
const { load, row } = require('./lib/load-rules');
const ROOT = path.resolve(__dirname, '..'), A = process.argv.slice(2), opt = k => { const i = A.indexOf(k); return i >= 0 ? A[i + 1] : null; };
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const ctx = load(), V = ctx.V2Rules, E = ctx.LiveEngine;
const boot = JSON.parse(fs.readFileSync(path.resolve(opt('--boot') || path.join(ROOT, 'api', 'boot.json')), 'utf8'));
const rows = boot.rows.slice().sort((a, b) => a.block_index - b.block_index || a.tx_index - b.tx_index), tip = boot.tip || rows[rows.length - 1].block_index, nb = tip + 1;
const H = Object.assign({}, ctx.XCPETS_BLOCK_HASHES || {}, boot.hashes || {}); for (let b = nb; b < nb + 400; b++) if (!H[b]) H[b] = require('crypto').createHash('sha256').update('fake-block-' + b).digest('hex');
const opts = t => ({ tip: t, live: E && E.RealCore, dex: boot.dex });
const GATE0 = V.seanceRaisesGate(); ok(GATE0 == null || Number.isInteger(GATE0), 'gate in the code is null or a block (' + GATE0 + ', snapshot tip ' + tip + ')');
const canon = v => Array.isArray(v) ? '[' + v.map(canon).join(',') + ']' : v && typeof v === 'object' ? '{' + Object.keys(v).sort().filter(k => v[k] !== undefined && typeof v[k] !== 'function').map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}' : JSON.stringify(v);
const sig = w => canon({ pets: w.pets, items: w.items, log: w.log.map(x => [x.block, x.tx, x.kind, x.msg]), cem: w.cem && w.cem.altarList.map(a => [a.grave, a.status, a.closesAt, a.owner]) });
/* 1. live world: the same with the gate null and with the gate at tip + 1 */
V._setSeanceRaisesActivation(null); const w0 = V.replay(rows, H, [], opts(tip)), s0 = sig(w0);
V._setSeanceRaisesActivation(nb); const w = V.replay(rows, H, [], opts(tip));
ok(sig(w) === s0, 'live world (' + rows.length + ' burns, tip ' + tip + '): same replay with the gate null and with the gate at tip + 1');
/* fixtures from the live world: two wallets with 4+ offerable pets, Common graves and one Rare grave nobody holds pieces on */
const own = {}; w.pets.forEach(p => { if (p.owner && !V.cemOfferWhy(w, p, p.owner, nb) && (p.deathBlock == null || p.deathBlock > nb + 400)) /* alive for the whole test window */ (own[p.owner] = own[p.owner] || []).push(p); });
const W = Object.keys(own).filter(o => own[o].filter(p => (p.tier | 0) === 0).length >= 4 && own[o].some(p => (p.tier | 0) >= 1)).sort((a, b) => own[b].length - own[a].length);
const AW = W[0], BW = W[1]; ok(!!AW && !!BW, 'two test wallets found (' + (AW || '').slice(0, 10) + '…, ' + (BW || '').slice(0, 10) + '…)');
const com = o => own[o].filter(p => (p.tier | 0) === 0).map(p => p.id).sort((a, b) => a - b), aC = com(AW), bC = com(BW);
const graves = w.pets.filter(p => !V.cemView(w, p, nb).zombie && V.cemView(w, p, nb).grave && !V.cemView(w, p, nb).why && !V.cemView(w, p, nb).altar && !p.mgDead);
const Gc = graves.filter(p => (p.tier | 0) === 0).map(p => p.id), Gr = graves.filter(p => (p.tier | 0) === 2).map(p => p.id)[0];
ok(Gc.length >= 8 && Gr != null, 'raisable graves found (' + Gc.length + ' Common, Rare #' + Gr + ')');
const plan = (kind, g, ids, b) => { const q = V.cemPlan(w, kind, g, ids, b); return V.cemPetAmount ? V.cemPetAmount(w, q, b) : q; };
const burn = (b, src, kind, g, ids) => { const q = plan(kind, g, ids || [], b); return row(b, src, q.amount + 1, q.tag); };
const go = (extra, t) => V.replay(rows.concat(extra), H, [], opts(t));
const logOf = (w2, r) => w2.log.find(x => x.tx === r.tx_hash);
const used = (w2, ids) => ids.every(id => w2.byId[id].released), free = (w2, ids) => ids.every(id => !w2.byId[id].released && w2.byId[id].pledge == null);
const noPledge = (w2, from) => w2.log.filter(x => x.block >= from && /pledg/i.test((x.kind || '') + ' ' + (x.msg || '')) && !/^rpl/.test(x.kind)).length === 0;
/* 2. the #33691 case BEFORE the gate (gate null): A pledges more, B's seance becomes a pledge and A's zombie takes B's pets */
{ V._setSeanceRaisesActivation(null); const G = Gc[0], a = burn(nb, AW, 'pledge', G, aC.slice(0, 3)), s = burn(nb + 1, BW, 'seance', G, bC.slice(0, 1));
  const w2 = go([a, s], nb + 1 + 144), L = logOf(w2, s);
  ok(L && L.kind === 'pledge' && /seance pledge/.test(L.msg) && w2.byId[G].owner === AW && used(w2, bC.slice(0, 1)) && /raised together by 2/.test((w2.log.find(x => x.kind === 'raise' && x.petId === G) || {}).msg || ''),
    'before the gate: unchanged (B\'s seance became a pledge, the pool closed by itself and A\'s zombie used B\'s pet: ' + (L && L.msg) + ')');
  V._setSeanceRaisesActivation(nb); }
/* 3. from the gate: the same burns raise the grave for B, with only B's pieces; A's pieces are handed back */
{ const G = Gc[0], a = burn(nb, AW, 'pledge', G, aC.slice(0, 3)), s = burn(nb + 1, BW, 'seance', G, bC.slice(0, 1)), w2 = go([a, s], nb + 1), L = logOf(w2, s), La = logOf(w2, a);
  ok(La && La.kind === 'spart' && /held for your seance/.test(La.msg), 'gate: A\'s pet:alt is a seance part held for A (' + (La && La.msg) + ')');
  ok(L && L.kind === 'raise' && w2.byId[G].owner === BW && w2.byId[G].zombie && w2.byId[G].zombie.pool === false && !/together/.test(L.msg), 'gate: B\'s seance raises #' + G + ' for B (' + (L && L.msg) + ')');
  ok(used(w2, bC.slice(0, 1)) && free(w2, aC.slice(0, 3)), 'gate: only B\'s own pet is used up; A\'s 3 pets are handed back unlocked');
  ok(w2.byId[G].zombie.givers.length === 1 && w2.byId[G].zombie.givers[0].src === BW, 'gate: the zombie lists B as its only giver');
  ok(noPledge(w2, nb), 'gate: no log line after the gate says pledge'); }
/* 4. a seance that lands BEFORE its own parts in the same block still gets them; the raise happens at the end of that block */
{ const G = Gc[1], s = burn(nb, BW, 'seance', G, bC.slice(0, 1)), p = burn(nb, BW, 'pledge', G, bC.slice(1, 4)), x = burn(nb + 1, AW, 'pledge', aC[0] === G ? G : G, aC.slice(0, 1));
  const w2 = go([s, p], nb), L = logOf(w2, s), Lp = logOf(w2, p);
  ok(L && L.kind === 'raise' && Lp && Lp.kind === 'spart' && used(w2, bC.slice(0, 4)) && w2.byId[G].owner === BW, 'same block, seance first: all 4 of B\'s pets raise #' + G + ' for B (' + (L && L.msg) + ')');
  const w3 = go([s, p, x], nb + 1), Lx = logOf(w3, x); ok(Lx && Lx.kind === 'rejected' && /already risen/.test(Lx.msg), 'next block: a part on the risen grave is rejected (' + (Lx && Lx.msg) + ')'); }
/* 5. two wallets in one block: the first seance wins, the second wallet's burn is rejected with nothing used */
{ const G = Gc[2], s = burn(nb, AW, 'seance', G, aC.slice(0, 2)), t = burn(nb, BW, 'seance', G, bC.slice(0, 2)), w2 = go([s, t], nb), L = logOf(w2, s), Lt = logOf(w2, t);
  ok(L.kind === 'raise' && w2.byId[G].owner === AW && Lt.kind === 'rejected' && free(w2, bC.slice(0, 2)) && used(w2, aC.slice(0, 2)), 'same block, two wallets: A\'s seance raises, B\'s is rejected and B keeps its pets (' + Lt.msg + ')'); }
/* 6. a raise that misses the minimum is rejected: nothing used, pieces handed back, the altar ends */
{ const G = Gr, p = burn(nb, AW, 'pledge', G, aC.slice(0, 2)), s = burn(nb + 1, AW, 'seance', G, aC.slice(2, 3)), w2 = go([p, s], nb + 1), L = logOf(w2, s), Al = w2.cem.altars[G];
  ok(L && L.kind === 'rejected' && /Uncommon\+/.test(L.msg) && free(w2, aC.slice(0, 3)) && Al.status === 'missed' && !w2.byId[G].zombie, 'min offering missed (Rare grave, Commons only): seance rejected, nothing used, pieces handed back (' + (L && L.msg) + ')'); }
/* 7. pieces held with no seance: handed back after 144 blocks, no auto-raise for anyone */
{ const G = Gc[3], p = burn(nb, AW, 'pledge', G, aC.slice(0, 2)), w2 = go([p], nb + 143), w3 = go([p], nb + 144), Lc = w3.log.find(x => x.kind === 'altarClosed' && x.petId === G);
  ok(w2.byId[aC[0]].pledge === G && w2.cem.altars[G].status === 'open', 'parts stay held for ' + 143 + ' blocks');
  ok(Lc && !w3.byId[G].zombie && free(w3, aC.slice(0, 2)) && !/pledg/i.test(Lc.msg), 'after 144 blocks with no seance: everything handed back, nothing raised (' + (Lc && Lc.msg) + ')');
  const p2 = burn(nb + 100, AW, 'pledge', G, aC.slice(2, 3)), w4 = go([p, p2], nb + 144); ok(w4.cem.altars[G].status === 'open' && w4.cem.altars[G].closesAt === nb + 244, 'a later part keeps the pieces held 144 blocks from the latest part'); }
/* 8. pet:raise from the gate = finish your own seance with the pieces you hold (raise fee only) */
{ const G = Gc[4], p = burn(nb, AW, 'pledge', G, aC.slice(0, 2)), rb = burn(nb + 1, BW, 'raise', G), rz = burn(nb + 2, AW, 'raise', G), w2 = go([p, rb, rz], nb + 2), L = logOf(w2, rz), Lb = logOf(w2, rb);
  ok(Lb.kind === 'rejected' && /nothing of yours is held/.test(Lb.msg), 'raise by a wallet with nothing held is rejected (' + Lb.msg + ')');
  ok(L.kind === 'raise' && w2.byId[G].owner === AW && used(w2, aC.slice(0, 2)), 'raise by the holder finishes its seance: #' + G + ' rises for A (' + L.msg + ')');
  ok(/nothing of yours/.test(V.cemSendWhy(w2, { action: 'raise', grave: Gc[5] }, AW, nb + 2, []) || ''), 'send guard: raise with nothing held is stopped before the wallet'); }
/* 9. OPEN POOL from before the gate (gate = nb + 2): auto-close keeps the old 'raised together' ending */
{ V._setSeanceRaisesActivation(nb + 2); const G = Gc[5], a = burn(nb, AW, 'pledge', G, aC.slice(0, 3)), b2 = burn(nb + 1, BW, 'pledge', G, bC.slice(0, 1)), w2 = go([a, b2], nb + 144), R = w2.log.find(x => x.kind === 'raise' && x.petId === G);
  ok(R && /raised together by 2/.test(R.msg) && /closed by itself/.test(R.msg) && w2.byId[G].owner === AW && used(w2, aC.slice(0, 3).concat(bC.slice(0, 1))), 'legacy pool with no seance after the gate: closes by itself, raised together for the top giver, as before (' + (R && R.msg) + ')');
  /* a seance after the gate on that old pool raises for the seancer with only the seancer's own pieces; the others' old pledges are handed back */
  const s = burn(nb + 3, BW, 'seance', G, bC.slice(1, 2)), w3 = go([a, b2, s], nb + 3), L = logOf(w3, s);
  ok(L.kind === 'raise' && w3.byId[G].owner === BW && used(w3, bC.slice(0, 2)) && free(w3, aC.slice(0, 3)) && !/together/.test(L.msg), 'legacy pool, seance after the gate: raises for B with B\'s old pledge + seance, A\'s old pledges handed back (' + L.msg + ')');
  V._setSeanceRaisesActivation(nb); }
/* 10. the risen zombie earns the seance burn (as a seance that raised at once did) */
{ const G = Gc[6], s = burn(nb, AW, 'seance', G, aC.slice(0, 1)), w2 = go([s], nb), z = w2.byId[G];
  ok(z.zombie && z.zombie.tx === s.tx_hash && w2.byId[G].owner === AW && logOf(w2, s).kind === 'raise' && logOf(w2, s).petId === G, 'one-burn seance: rises in its own block for its sender, zombie tx = the seance tx'); }
V._setSeanceRaisesActivation(GATE0);
console.log('\n' + (fails ? fails + ' FAILED' : 'all ok') + '  (gate in the code: ' + GATE0 + ')'); process.exitCode = fails ? 1 : 0;
