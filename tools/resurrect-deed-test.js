#!/usr/bin/env node
/* resurrect-deed-test: who owns a pet after a cemetery Resurrection when its old pet token is held by someone else.
 * Story (snapshot 972901, synthetic burns and token events, nothing signed or sent): the owner ties a token to pet #18846, sends the
 * token to another wallet (the pet moves with it), the pet dies (block 973440), the original owner raises it as a zombie and resurrects it.
 * Then: the pet is the raiser's, the old token can no longer move, list or re-tie it, and a new token tied with pet:deed works as usual.
 * Also the preview gate ACTIVATE_RESURRECT_RETIE_BLOCK (shipped 973850; synthetic blocks below it = off): a token tied while the pet was a zombie survives the Resurrection
 * with the gate off, and is untied (a keepsake) with the gate on.   node tools/resurrect-deed-test.js */
'use strict';
const crypto = require('crypto');
const L = require('./lib/load-rules');
const S = L.snap('snap-972901.json'); let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const OW = 'bc1ps9av86ymmlzy9zj3a8pn6g94pz4j5e0kagv3td3wutaagfjvekjs26m3s4', SB = 'bc1qs88hlk930p8l6h5s2svcrvzd45ny2pn54y0j6n';
const F = 'bc1qresurrecttestfriend000000000000000001', PET = 18846, R = 973450, D = 0.00000001, ON = 972905;
const b32 = n => n.toString(32).toUpperCase(), sha = s => crypto.createHash('sha256').update(s).digest('hex');
let q = 0; const h = s => sha('rr:' + s + ':' + (q++));
const row = (b, src, amt, tag, txh) => Object.assign(L.row(b, src, amt, tag), txh ? { tx_hash: txh } : {});
let ci = 0; const cr = (a, to, b, fn) => ({ credit_index: 7e6 + (ci++), asset: a, address: to, quantity: 1, block_index: b, tx_index: 5e6 + ci, tx_hash: h('cr' + a + b), calling_function: fn || 'send' });
const c0 = L.load(), V0 = c0.V2Rules, tok = s => V0.randomDeed(Array.from(crypto.createHash('sha256').update('resurrect-deed:' + s).digest()).slice(0, 8));
const iss = (src, b, a) => ({ tx_index: 3e6 + (ci++), tx_hash: h('iss' + a), block_index: b, source: src, issuer: src, asset: a, quantity: 1, divisible: false, locked: true, description: V0.deedDesc(PET), status: 'valid' });
const TA = tok('old'), TB = tok('new'), TC = tok('zombie'), TD = tok('after');
const H0 = Object.assign({}, c0.XCPETS_BLOCK_HASHES, S.hashes), bh = b => H0[b] || L.fakeHash(b);
/* the Resurrection roll comes from the block hash and the tx: pick a block whose roll passes (33 points: chance 5% + 60% times 33 / 133) */
const RES_TX = sha('resurrect-deed-test:resurrect'), NEED = Math.round((0.05 + 0.6 * 33 / 133) * 10000);
let K = 9; while (parseInt(sha(bh(R + K) + ':' + RES_TX + ':resurrect').slice(0, 8), 16) % 10000 >= NEED) K++;
const RB = R + K;
/* W(rows, tip, dex, o): owner-test mode (grave #18846, owner wallet only), like live; o.retie = preview gate block */
function W(rows, tip, dex, o) { o = o || {}; const c = L.load(), V = c.V2Rules; V._setCemeteryActivation(ON); V._setCemeteryPublic(null); V._setCemOwnerTest(OW, PET);
  if (o.retie !== undefined) V._setResurrectRetieActivation(o.retie);
  const H = Object.assign({}, c.XCPETS_BLOCK_HASHES, S.hashes); rows.forEach(r => { if (!H[r.block_index]) H[r.block_index] = L.fakeHash(r.block_index); });
  return { V, w: V.replay(S.rows.concat(rows), H, [], { tip, live: c.LiveEngine.RealCore, dex }) }; }
const dexOf = (credits, more) => { const d = { issuances: [iss(OW, 973099, TA)], orders: [], matches: [], credits: [cr(TA, OW, 973099, 'issuance'), cr(TA, SB, 973110)].concat(credits || []), destructions: [] };
  (more || []).forEach(x => d.issuances.push(iss(OW, x[1], x[0]))); return d; };
const TIE = [row(973100, OW, D, V0.deedTag(PET, TA))];
const RAISE = [row(R, OW, 10000, 'pet:seance:' + PET + ':' + b32(4428)), row(R + 5, OW, 10000, 'pet:rpl:' + PET + ':' + b32(15367))];
const RES = [row(RB, OW, 10000, 'pet:resurrect:' + PET, RES_TX)];
const logs = (w, b0, b1) => w.log.filter(e => e.block >= b0 && e.block <= b1);

ok(V0.resurrectRetieGate() === 973850 && V0.retieOn(973849) === false && V0.retieOn(973850) === true, 'shipped: ACTIVATE_RESURRECT_RETIE_BLOCK is 973850 (BTC tip 973844 + 6 at deploy)');
ok(RB + 8 < V0.resurrectRetieGate(), 'synthetic story blocks (to ' + (RB + 8) + ') are before the shipped gate, so "gate off" = main rules before block 973850');
/* 1. tie, send, death */
{ let { w } = W(TIE, 973120, dexOf()); ok(w.byId[PET].deed === TA && w.byId[PET].owner === SB && w.deeds[TA].holder === SB, 'token sent to another wallet: the pet moved with it');
  ({ w } = W(TIE, 973445, dexOf())); ok(w.byId[PET].dead && w.byId[PET].owner === SB && w.byId[PET].deed === TA, 'the pet dies held by the other wallet, still tied'); }
/* 2. raise + resurrect, gate off (main rules) and gate on: same result */
[undefined, ON].forEach(g => { const tag = g === undefined ? 'gate off' : 'gate on';
  let { w } = W(TIE.concat(RAISE), R + 6, dexOf([cr(TA, F, R + 3)]), { retie: g }); let Z = w.byId[PET];
  ok(Z.zombie && Z.owner === OW && Z.deed == null && Z.keepsake === TA && w.deeds[TA].untied === R, tag + ': raising unties the old token (keepsake), the zombie is the raiser\'s');
  ok(Z.owner === OW && w.deeds[TA].holder === F, tag + ': old token sent on while a zombie: the zombie stays with the raiser');
  const dex = dexOf([cr(TA, F, R + 3), cr(TA, SB, RB + 2), cr(TB, F, RB + 6)], [[TB, RB + 3]]); dex.credits.push(cr(TB, OW, RB + 3, 'issuance'));
  dex.orders.push({ tx_index: 4e6, tx_hash: h('ord'), block_index: RB + 2, source: SB, give_asset: TA, give_quantity: 1, give_remaining: 1, get_asset: 'XCPETS', get_quantity: 1e8, get_remaining: 1e8, expiration: 100, expire_index: RB + 101, status: 'open' });
  const rows = TIE.concat(RAISE, RES, [row(RB + 4, SB, D, V0.deedTag(PET, TA)), row(RB + 4, OW, D, V0.deedTag(PET, TA))]);
  ({ w } = W(rows, RB + 5, dex, { retie: g })); Z = w.byId[PET];
  ok(Z.resurrected && Z.resurrected.block === RB && !Z.dead && !Z.zombie, tag + ': Resurrection succeeds (block ' + RB + ')');
  ok(Z.owner === OW && Z.deed == null, tag + ': after the Resurrection the pet is the original owner\'s, with no token');
  ok(w.deeds[TA].holder === SB && Z.owner === OW, tag + ': old token sent back to the buyer after the Resurrection: the pet does not move');
  ok((w.shopSkips || []).some(s => /old token/.test(s.why)) && !(w.listings || []).some(s => s.give === TA), tag + ': the old token cannot list the pet');
  ok(logs(w, RB + 4, RB + 4).filter(e => e.kind === 'rejected' && /shop token/.test(e.msg)).length === 2 && Z.deed == null, tag + ': the old token cannot be tied again (holder or owner)');
  ({ w } = W(rows.concat([row(RB + 4, OW, D, V0.deedTag(PET, TB))]), RB + 8, dex, { retie: g })); Z = w.byId[PET];
  ok(Z.deed === TB && Z.owner === F, tag + ': the owner makes a new token, ties it with pet:deed, and sending it moves the pet as usual'); });
/* 3. a token tied while the pet is a zombie: survives the Resurrection with the gate off, untied with the gate on */
{ const dex = dexOf([cr(TC, OW, R + 6, 'issuance'), cr(TC, F, RB + 3)], [[TC, R + 6]]), rows = TIE.concat(RAISE, [row(R + 7, OW, D, V0.deedTag(PET, TC))], RES);
  let { w } = W(rows.slice(0, -1), R + 8, dex); ok(w.byId[PET].zombie && w.byId[PET].deed === TC, 'a zombie can get a new token (pet:deed)');
  ({ w } = W(rows, RB + 1, dex)); let Z = w.byId[PET]; ok(Z.resurrected && Z.deed === TC && Z.owner === OW, 'gate off: the zombie-time token stays tied after the Resurrection');
  ({ w } = W(rows, RB + 5, dex)); ok(w.byId[PET].owner === F, 'gate off: that token still moves the resurrected pet');
  ({ w } = W(rows, RB + 1, dex, { retie: ON })); Z = w.byId[PET];
  ok(Z.resurrected && Z.deed == null && Z.keepsake === TC && w.deeds[TC].untied === RB && Z.owner === OW, 'gate on: the Resurrection unties it (keepsake), the pet stays with the resurrecting owner');
  ok(logs(w, RB, RB).some(e => e.kind === 'resurrect' && /untied/.test(e.msg)), 'gate on: the Resurrection log says the token is untied');
  ({ w } = W(rows, RB + 5, dex, { retie: ON })); ok(w.byId[PET].owner === OW && w.deeds[TC].holder === F, 'gate on: sending that old token after the Resurrection does not move the pet');
  const d2 = dexOf([cr(TC, OW, R + 6, 'issuance'), cr(TC, F, RB + 3), cr(TD, OW, RB + 3, 'issuance'), cr(TD, F, RB + 6)], [[TC, R + 6], [TD, RB + 3]]);
  ({ w } = W(rows.concat([row(RB + 4, OW, D, V0.deedTag(PET, TD))]), RB + 8, d2, { retie: ON })); Z = w.byId[PET];
  ok(Z.deed === TD && Z.owner === F, 'gate on: the owner ties a new token with pet:deed and it works as usual'); }
/* 4. gate below the Resurrection block = off: a gate set later changes nothing */
{ const dex = dexOf([cr(TC, OW, R + 6, 'issuance')], [[TC, R + 6]]), rows = TIE.concat(RAISE, [row(R + 7, OW, D, V0.deedTag(PET, TC))], RES);
  const { w } = W(rows, RB + 1, dex, { retie: RB + 1 }); ok(w.byId[PET].deed === TC, 'gate after the Resurrection block: rule not applied'); }
console.log('resurrect-deed-test: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
