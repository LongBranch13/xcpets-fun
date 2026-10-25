#!/usr/bin/env node
/* MYTHIC RAISED-ONLY tests (dev only; branch mythic-raised-only, owner decisions 2026-10-25 10:18 AM CT + "more than half the care" follow-up):
 * a Mythic qualifies its owner only if (a) the owner hatched/bred/was granted it and it never left them, or (b) the owner added MORE THAN HALF its care.
 * from ACTIVATE_MYTHIC_RAISED_ONLY_BLOCK a gifted Mythic and a bought (shop sale) Mythic give their new owner NO Mythic discount,
 * a Mythic the wallet raised itself does, finish() at the tip never registers a qualification history doesn't have, and replay before the gate is SAME.
 *   node tools/mythic-raised-only-test.js [snap-file-name]      (mock DEX data only: nothing is fetched, signed or sent) */
'use strict';
const crypto = require('crypto');
const { load, row, snap, fakeHash } = require('./lib/load-rules');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('ok  ', m); } else { fail++; console.log('FAIL', m); } };
const S = snap(process.argv[2]), T = S.tip, G = T + 6, D = 0.00000001, BIG = 50000;
const c = load(), V = c.V2Rules; V._setTokenOnly(false);
const BUYER2 = 'bc1qmythicraisedbuyer20000000000000000000', RAISER2 = 'bc1qmythicraisedraiser2000000000000000000';
const GIFTEE = 'bc1qmythicraisedgiftee0000000000000000000', BUYER = 'bc1qmythicraisedbuyer00000000000000000000', RAISER = 'bc1qmythicraisedraiser0000000000000000000';
const canon = v => JSON.stringify(v, (k, x) => x && typeof x === 'object' && !Array.isArray(x) ? Object.keys(x).sort().reduce((o, kk) => (o[kk] = x[kk], o), {}) : x);
function run(rows, tip, dex) { const H = Object.assign({}, c.XCPETS_BLOCK_HASHES, S.hashes); rows.forEach(r => { if (!H[r.block_index]) H[r.block_index] = fakeHash(r.block_index); });
  return V.replay(S.rows.concat(rows), H, [], { tip, live: c.LiveEngine.RealCore, dex }); }
let on = 0; const h = s => crypto.createHash('sha256').update('mr:' + s + ':' + (on++)).digest('hex');
function order(src, block, give, giveQ, get, getQ, exp) { const x = h(src + block); return { tx_index: 4e6 + on, tx_hash: x, block_index: block, source: src, give_asset: give, give_quantity: giveQ, give_remaining: giveQ, get_asset: get, get_quantity: getQ, get_remaining: getQ, expiration: exp, expire_index: block + exp - 1, status: 'open' }; }
function match(o0, o1, block, fq, bq) { return { id: o0.tx_hash + '_' + o1.tx_hash, tx0_hash: o0.tx_hash, tx1_hash: o1.tx_hash, tx0_address: o0.source, tx1_address: o1.source, forward_asset: o0.give_asset, forward_quantity: fq, backward_asset: o0.get_asset, backward_quantity: bq, block_index: block, tx1_index: o1.tx_index, status: 'completed' }; }
function iss(src, block, asset, desc) { return { tx_index: 3e6 + (on++), tx_hash: h('iss' + asset), block_index: block, source: src, issuer: src, asset, quantity: 1, divisible: false, locked: true, description: desc, status: 'valid' }; }
const bytes = k => Array.from(crypto.createHash('sha256').update('mr' + k).digest()).slice(0, 8);

ok(V.ACTIVATE_MYTHIC_RAISED_ONLY_BLOCK === 999999999 && !V.mythicRaisedOnlyOn(T + 1000), 'shipped gate is the 999999999 placeholder (OFF)');
/* pick pets from history */
const base = run([], T), live = p => !p.dead && !p.released && !p.community && p.owner;
const free = p => live(p) && !V.giveLocks(base, p, G + 10);
const myth = base.pets.filter(p => free(p) && p.stage === 5 && p.care >= 69069); /* true Mythics (not only via the owner's discount) */
const gm = myth[0], sm = myth.find(p => p.id !== gm.id), O = gm && gm.owner, OS = sm && sm.owner;
const unq = base.pets.filter(p => free(p) && p.stage < 5 && !(base.mythicOwners || {})[p.owner]).sort((a, b) => b.care - a.care)[0];
const used = p => [gm, sm, unq].some(x => x && x.id === p.id), unqOwner = p => !(base.mythicOwners || {})[p.owner];
const low = base.pets.filter(p => free(p) && p.stage < 5 && !used(p) && p.care >= 1000 && p.care < 15000).sort((a, b) => a.care - b.care)[0];
const hi = base.pets.filter(p => free(p) && p.stage < 5 && !used(p) && unqOwner(p) && (!unq || p.owner !== unq.owner) && (!low || p.owner !== low.owner)).sort((a, b) => b.care - a.care)[0];
(gm ? ok : (x, m) => console.log('info', m))(low && hi, 'found a low-care pet #' + (low && low.id) + ' (care ' + (low && low.care) + ') and a high-care pet #' + (hi && hi.id) + ' (care ' + (hi && hi.care) + ')');
/* owner feeds of hi until ONE meal short of Mythic (care clamps at stage lines, so this lands just under the line, the "68,000" case) */
const hiTh = hi && V.petThresholds(base, hi, G), hiK = hi && (() => { let c0 = hi.care, n = 0; for (;;) { const m = V.mealFor(c0, hi.species, G, hiTh); if (c0 + m >= hiTh[5]) return { n, care: c0 }; c0 += m; n++; } })();
(myth.length ? ok : (x, m) => console.log('info', m))(O && gm && sm && unq, 'found 2 true Mythics (#' + (gm && gm.id) + ' gift, #' + (sm && sm.id) + ' sale) and a non-Mythic #' + (unq && unq.id) + ' (care ' + (unq && unq.care) + ') of an unqualified owner');

function beforeGateSame() { /* before the gate: SAME */
  V._setMythicRaisedOnlyActivation(999999999); const off = run([], T); V._setMythicRaisedOnlyActivation(G); const onG = run([], T); V._setMythicRaisedOnlyActivation(999999999);
  ok(canon(off.pets) === canon(onG.pets) && canon(off.itemList) === canon(onG.itemList) && canon(off.mythicOwners) === canon(onG.mythicOwners), 'replay before the gate (tip ' + T + '): SAME with the gate set vs off'); }
if (!(gm && sm && unq && low && hi)) { console.log('snapshot ' + T + ' has too few Mythics for the move scenarios: only the before-gate check runs'); beforeGateSame(); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0); }
function scenario(gate) {
  if (gate != null) V._setMythicRaisedOnlyActivation(gate);
  const b0 = G + 2, rows = [row(b0, GIFTEE, D, 'pet:hi'), row(b0, BUYER, D, 'pet:hi'), row(b0, RAISER, D, 'pet:hi'), row(b0, BUYER2, D, 'pet:hi'), row(b0, RAISER2, D, 'pet:hi')];
  const w0 = run(rows, b0 + 1), code = a => V.playerCode(V.playerNo(w0, a));
  rows.push(row(b0 + 1, O, D, 'pet:give:' + gm.id + ':' + code(GIFTEE)));            /* gifted Mythic */
  rows.push(row(b0 + 1, unq.owner, D, 'pet:give:' + unq.id + ':' + code(RAISER)));   /* non-Mythic gift: RAISER raises it */
  const dA = V.randomDeed(bytes('sale')), oA = order(OS, b0 + 1, dA, 1, 'XCP', 250000000, V.SALE_EXPIRY), ob = order(BUYER, b0 + 3, 'XCP', 250000000, dA, 1, 1);
  rows.push(row(b0 + 1, low.owner, D, 'pet:give:' + low.id + ':' + code(RAISER2)));  /* low-care gift: RAISER2 adds well over half */
  rows.push(row(b0 + 1, OS, D, V.deedTag(sm.id, dA)));                                /* tie + list, then a completed buy = bought Mythic */
  const dex = { issuances: [iss(OS, b0, dA, V.deedDesc(sm.id))], orders: [oA, ob], matches: [match(oA, ob, b0 + 3, 1, 250000000)] };
  let fb = b0 + 4; for (let i = 0; i < 12; i++, fb += 144) rows.push(row(fb, RAISER, BIG, 'pet:feed:' + unq.id));
  for (let i = 0, lb = b0 + 4; i < 20; i++, lb += 144) rows.push(row(lb, RAISER2, BIG, 'pet:feed:' + low.id)); fb = Math.max(fb, b0 + 4 + 20 * 144);
  /* hi: its owner feeds it to one meal short of Mythic, sells it in the shop, BUYER2 feeds it ONCE */
  let hb = b0 + 4; for (let i = 0; i < hiK.n; i++, hb += 144) rows.push(row(hb, hi.owner, BIG, 'pet:feed:' + hi.id));
  const dH = V.randomDeed(bytes('sale68')), oH = order(hi.owner, hb, dH, 1, 'XCP', 250000000, V.SALE_EXPIRY), oh = order(BUYER2, hb + 2, 'XCP', 250000000, dH, 1, 1);
  rows.push(row(hb, hi.owner, D, V.deedTag(hi.id, dH))); dex.issuances.push(iss(hi.owner, hb - 1, dH, V.deedDesc(hi.id))); dex.orders.push(oH, oh); dex.matches.push(match(oH, oh, hb + 2, 1, 250000000));
  rows.push(row(hb + 3 + 144, BUYER2, BIG, 'pet:feed:' + hi.id)); fb = Math.max(fb, hb + 3 + 288);
  /* the new owners keep touching the pets they got (the old "next burn makes it permanent" path) */
  rows.push(row(fb, GIFTEE, BIG, 'pet:feed:' + gm.id), row(fb, BUYER, BIG, 'pet:feed:' + sm.id));
  return { w: run(rows, fb + 1, dex), mid: run(rows, b0 + 4, dex), rows, dex, fb };
}
const A = scenario(G), w = A.w, M = w.mythicOwners || {};
ok(w.byId[gm.id].owner === GIFTEE && w.byId[sm.id].owner === BUYER && w.byId[unq.id].owner === RAISER, 'gift, sale and gift moved the pets');
ok(w.byId[unq.id].stage === 5, 'RAISER fed #' + unq.id + ' to Mythic (care ' + w.byId[unq.id].care + ')');
ok(M[GIFTEE] == null, 'gifted Mythic: GIFTEE gets NO discount (history)');
ok(M[BUYER] == null, 'bought Mythic: BUYER gets NO discount (history)');
ok(M[RAISER] == null, 'gifted at care ' + unq.care + ', RAISER fed it to Mythic but added less than half (' + (w.mythicGot[unq.id] || {}).own + ' of ' + w.byId[unq.id].care + '): NO');
ok(w.byId[hi.id].owner === BUYER2 && w.byId[hi.id].stage === 5 && hiK.care >= 59000, 'bought #' + hi.id + ' at care ' + hiK.care + ', BUYER2 fed it once to Mythic (care ' + w.byId[hi.id].care + ')');
ok(M[BUYER2] == null, 'buy just under Mythic and feed once: NO (own ' + (w.mythicGot[hi.id] || {}).own + ')');
ok(w.byId[low.id].owner === RAISER2 && w.byId[low.id].stage === 5, 'RAISER2 fed gifted #' + low.id + ' (got at care ' + low.care + ') to Mythic');
ok(M[RAISER2] != null && M[RAISER2] >= G, 'gifted at low care and fed past half: RAISER2 qualifies (own ' + (w.mythicGot[low.id] || {}).own + ' of ' + w.byId[low.id].care + ', block ' + M[RAISER2] + ')');
{ const R = V.raisedBy, g = own => ({ mythicGot: { 1: { owner: 'A', own } } }), p = { id: 1, owner: 'A', care: 1000 };
  ok(R({}, p) === true, 'never moved (hatched / bred / granted, never left): raised');
  ok(R(g(500), p) === false, 'exactly half the care: NOT raised');
  ok(R(g(501), p) === true, 'more than half: raised');
  ok(R({ mythicGot: { 1: { owner: 'B', own: 900 } } }, p) === false, 'record of another owner: NOT raised'); }
ok(M[O] != null && M[OS] != null, 'the gifter and the seller, who raised them, keep the discount');
ok(A.mid.mythicOwners[GIFTEE] == null && A.mid.mythicOwners[BUYER] == null, 'finish() at the tip right after the move: no discount on screen either');
ok(V.petThresholds(w, w.byId[gm.id], A.fb + 1)[5] > 21000 && V.petThresholds(w, w.byId[sm.id], A.fb + 1)[5] > 21000, 'gifted / bought pets keep the full Mythic threshold for the new owner');
/* old rule (gate far in the future) for the same rows: the bug this fixes */
const B = scenario(999999999);
ok(B.w.mythicOwners[GIFTEE] != null && B.w.mythicOwners[BUYER] != null, 'without the gate the gifted and bought Mythics DO qualify (old behaviour unchanged)');
beforeGateSame(); V._setMythicRaisedOnlyActivation(A.fb + 10); const pre1 = run(A.rows, A.fb + 1, A.dex); V._setMythicRaisedOnlyActivation(999999999); const pre0 = run(A.rows, A.fb + 1, A.dex);
ok(canon(pre1.pets) === canon(pre0.pets) && canon(pre1.mythicOwners) === canon(pre0.mythicOwners), 'same moves + feeds all before the gate: SAME as no gate');
V._setMythicRaisedOnlyActivation(999999999);
console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
