#!/usr/bin/env node
/* resurrected-breed-test (branch resurrected-breed-only, owner idea Oct 31 2026 6:08 AM CT): from ACTIVATE_RES_BREED_ONLY_BLOCK a resurrected pet
 * breeds only with another resurrected pet. Story (snapshot 972901, synthetic burns, nothing signed or sent; the Resurrection story of
 * resurrect-deed-test): the owner raises + resurrects #18846, feeds it once, then tries to breed it with its own non-resurrected #13.
 * Gate null (as shipped on the branch) = no change; gate on = pet:breed rejected with 'resurrected pets only breed with other resurrected pets'
 * (both orders); the send guard and the breed picker give the same reason. Also the display-only 'God' tier label.   node tools/resurrected-breed-test.js */
'use strict';
const crypto = require('crypto');
const L = require('./lib/load-rules');
const S = L.snap('snap-972901.json'); let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const OW = 'bc1ps9av86ymmlzy9zj3a8pn6g94pz4j5e0kagv3td3wutaagfjvekjs26m3s4', SB = 'bc1qs88hlk930p8l6h5s2svcrvzd45ny2pn54y0j6n';
const F = 'bc1qresurrecttestfriend000000000000000001', PET = 18846, R = 973450, D = 0.00000001, ON = 972905;
const b32 = n => n.toString(32).toUpperCase(), sha = s => crypto.createHash('sha256').update(s).digest('hex');
let q = 0; const h = s => sha('rbo:' + s + ':' + (q++));
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
/* W(rows, tip, dex, o): owner-test mode (grave #18846, owner wallet only), like live; o.retie / o.resb = preview gate blocks */
function W(rows, tip, dex, o) { o = o || {}; const c = L.load(), V = c.V2Rules; V._setCemeteryActivation(ON); V._setCemeteryPublic(null); V._setCemOwnerTest(OW, PET);
  if (o.retie !== undefined) V._setResurrectRetieActivation(o.retie); if (o.resb !== undefined) V._setResBreedOnlyActivation(o.resb);
  const H = Object.assign({}, c.XCPETS_BLOCK_HASHES, S.hashes); rows.forEach(r => { if (!H[r.block_index]) H[r.block_index] = L.fakeHash(r.block_index); });
  return { V, w: V.replay(S.rows.concat(rows), H, [], { tip, live: c.LiveEngine.RealCore, dex }) }; }
const dexOf = (credits, more) => { const d = { issuances: [iss(OW, 973099, TA)], orders: [], matches: [], credits: [cr(TA, OW, 973099, 'issuance'), cr(TA, SB, 973110)].concat(credits || []), destructions: [] };
  (more || []).forEach(x => d.issuances.push(iss(OW, x[1], x[0]))); return d; };
const TIE = [row(973100, OW, D, V0.deedTag(PET, TA))];
const RAISE = [row(R, OW, 10000, 'pet:seance:' + PET + ':' + b32(4428)), row(R + 5, OW, 10000, 'pet:rpl:' + PET + ':' + b32(15367))];
const RES = [row(RB, OW, 10000, 'pet:resurrect:' + PET, RES_TX)];
const logs = (w, b0, b1) => w.log.filter(e => e.block >= b0 && e.block <= b1);
const dex = dexOf(), MATE = 13, FEEDS = [];
for (let d = 0; d < 5; d++) FEEDS.push(row(RB + 1 + d * 144, OW, 10000, 'pet:feed:' + PET), row(RB + 1 + d * 144, OW, 10000, 'pet:feed:' + MATE)); /* 5 daily meals: the resurrected pet grows back to Adult+ */
const BB = RB + 1 + 4 * 144 + 2, BASE = TIE.concat(RAISE, RES, FEEDS);
const BREED = (a, c) => [row(BB, OW, 10000, 'pet:breed:' + a + ':' + c)];
const pair = [MATE, PET].sort((x, y) => x - y).join(':');
const eggs = w => w.pets.filter(p => p.parents && p.parents.map(Number).sort((x, y) => x - y).join(':') === pair);
const g0why = (w, p) => V0.breedable(p, BB);
const rej = w => w.log.filter(e => e.block === BB && e.kind === 'rejected').map(e => e.msg);
/* 0. shipped value on the branch: null = OFF */
ok(V0.resBreedOnlyGate() === null && V0.resBreedOn(BB) === false && V0.resBreedOn(1e9) === false, 'branch ships ACTIVATE_RES_BREED_ONLY_BLOCK = null (off; set to tip + 6 or more at deploy)');
ok(V0.RES_BREED_WHY === 'resurrected pets only breed with other resurrected pets', 'reason text');
/* 1. unit: a reason only when exactly one parent is resurrected and the gate is on */
{ const V = L.load().V2Rules, R1 = { id: 1, resurrected: { block: 1 } }, R2 = { id: 2, resurrected: { block: 2 } }, N1 = { id: 3 }, N2 = { id: 4 };
  ok([[R1, N1], [N1, R1], [R1, R2], [N1, N2]].every(x => V.resPairWhy(x[0], x[1], 100) === null), 'gate off: no pair is blocked');
  V._setResBreedOnlyActivation(100);
  ok(V.resPairWhy(R1, N1, 99) === null, 'gate on: a block before the gate is not blocked');
  ok(V.resPairWhy(R1, N1, 100) === V.RES_BREED_WHY && V.resPairWhy(N1, R1, 100) === V.RES_BREED_WHY, 'gate on: resurrected x normal blocked (both orders)');
  ok(V.resPairWhy(R1, R2, 100) === null && V.resPairWhy(N1, N2, 100) === null, 'gate on: resurrected x resurrected and normal x normal allowed');
  ok(V.tierLabelOf({ tier: 3, stage: 5, resurrected: { block: 1 } }) === 'God' && V.tierLabelOf({ tier: 3 }) === V.TIER_LABELS[3] && V.tierLabelOf({ tier: 0 }) === V.TIER_LABELS[0], 'tierLabelOf: resurrected -> God, others unchanged');
  ok(V.GOD_LABEL === 'God' && V.GOD_PLURAL === 'Gods', 'labels are God / Gods (not "God tier")'); }
/* 2. replay */
{ const { w } = W(BASE, BB - 1, dex); const Z = w.byId[PET];
  ok(Z.resurrected && !Z.dead && !Z.zombie && Z.owner === OW && !w.byId[MATE].resurrected && w.byId[MATE].owner === OW, 'story: #' + PET + ' resurrected at ' + RB + ', mate #' + MATE + ' (same owner) is not');
  ok(!g0why(w, Z) && !g0why(w, w.byId[MATE]), 'story: both can breed at ' + BB);
  let r = W(BASE.concat(BREED(PET, MATE)), BB + 1, dex).w;
  ok(eggs(r).length === 1 && !rej(r).length, 'gate off: resurrected x normal breeds as on main ' + JSON.stringify(rej(r)));
  r = W(BASE.concat(BREED(PET, MATE)), BB + 1, dex, { resb: BB - 5 }).w;
  ok(eggs(r).length === 0 && rej(r).some(m => m.indexOf(V0.RES_BREED_WHY) >= 0), 'gate on: pet:breed:' + PET + ':' + MATE + ' rejected with the reason ' + JSON.stringify(rej(r)));
  r = W(BASE.concat(BREED(MATE, PET)), BB + 1, dex, { resb: BB - 5 }).w;
  ok(eggs(r).length === 0 && rej(r).some(m => m.indexOf(V0.RES_BREED_WHY) >= 0), 'gate on: pet:breed:' + MATE + ':' + PET + ' rejected too');
  r = W(BASE.concat(BREED(PET, MATE)), BB + 1, dex, { resb: BB + 1 }).w;
  ok(eggs(r).length === 1, 'gate set after the breed block: not applied');
  /* send guard + breed picker (gate on) */
  const g = W(BASE, BB - 1, dex, { resb: BB - 5 }), sb = g.V.sendBlock(g.w, { tag: 'pet:breed:' + PET + ':' + MATE, amount: 135 }, BB - 1, { me: OW });
  ok(typeof sb === 'string' && sb.indexOf(g.V.RES_BREED_WHY) >= 0, 'send guard stops the burn before it is sent: ' + sb);
  const m = g.V.breedPicker(g.w, OW, BB - 1, PET).partners.filter(x => x.p.id === MATE)[0];
  ok(m && m.why === g.V.RES_BREED_WHY, 'breed picker: #' + PET + ' as parent A -> #' + MATE + ' not selectable, with the reason');
  const z = g.V.breedPicker(g.w, OW, BB - 1, MATE).partners.filter(x => x.p.id === PET)[0];
  ok(z && z.why === g.V.RES_BREED_WHY, 'breed picker: normal parent A -> the resurrected pet not selectable');
  const off = W(BASE, BB - 1, dex), m3 = off.V.breedPicker(off.w, OW, BB - 1, PET).partners.filter(x => x.p.id === MATE)[0];
  ok(m3 && m3.why === null, 'gate off: picker unchanged');
  ok(g.V.petFilterMatch(g.w, { p: g.w.byId[PET] }, { tier: 'G' }) && !g.V.petFilterMatch(g.w, { p: g.w.byId[MATE] }, { tier: 'G' }), 'pet filter "Gods": only resurrected pets');
  ok(!g.V.petFilterMatch(g.w, { p: g.w.byId[PET] }, { tier: 'M' }), 'pet filter "Mythic": a God is not listed as Mythic'); }
console.log('resurrected-breed-test: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
