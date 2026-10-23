#!/usr/bin/env node
/* TOKEN IS THE PET tests (Spam City): from the gate, a tied pet's owner = its token holder (sends, MPMA, DEX, dispensers);
 * burn gifts (pet:give / pet:gives / pet:swap) do nothing; destroy unties; fakes ignored; replay SAME below the gate.
 *   node tools/pet-token-test.js [snap-file-name]   (mock data only) */
'use strict';
const crypto = require('crypto');
const { load, row, snap, fakeHash } = require('./lib/load-rules');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const S = snap(process.argv[2]), T = S.tip, G = T + 6, D = 0.00000001;
const c = load(), V = c.V2Rules;
const F1 = 'bc1qtokentestfriend00000000000000000000001', F2 = 'bc1qtokentestfriend00000000000000000000002', X = 'bc1qtokentestfaker000000000000000000000000';
const canon = v => JSON.stringify(v, (k, x) => x && typeof x === 'object' && !Array.isArray(x) ? Object.keys(x).sort().reduce((o, kk) => (o[kk] = x[kk], o), {}) : x);
function run(rows, tip, dex) { const H = Object.assign({}, c.XCPETS_BLOCK_HASHES, S.hashes); rows.forEach(r => { if (!H[r.block_index]) H[r.block_index] = fakeHash(r.block_index); });
  return V.replay(S.rows.concat(rows), H, [], { tip, live: c.LiveEngine.RealCore, dex }); }
let on = 0; const h = s => crypto.createHash('sha256').update('t:' + s + ':' + (on++)).digest('hex');
const bytes = n => Array.from(crypto.createHash('sha256').update('tok' + n).digest()).slice(0, 8);
let ci = 0; const cr = (asset, to, b, fn) => ({ credit_index: 7e6 + (ci++), asset, address: to, quantity: 1, block_index: b, tx_index: 5e6 + ci, tx_hash: h('cr' + asset + b), calling_function: fn || 'send' });
const iss = (src, b, asset, id) => ({ tx_index: 3e6 + (ci++), tx_hash: h('iss' + asset), block_index: b, source: src, issuer: src, asset, quantity: 1, divisible: false, locked: true, description: V.deedDesc(id), status: 'valid' });
const base = run([], T, null), owners = {};
base.pets.forEach(p => { if (!p.dead && !p.released && !p.community && p.owner) (owners[p.owner] = owners[p.owner] || []).push(p); });
const O = Object.keys(owners).sort((a, b) => owners[b].length - owners[a].length)[0], mine = owners[O].filter(p => !V.giveLocks(base, p, G + 10));
const A = mine.find(p => V.giftMoves(base, p).worn.length) || mine[0], B = mine.filter(p => p !== A)[0], C = mine.filter(p => p !== A)[1];
ok(V.tokenOnly() === true, 'shipped: TOKEN_ONLY on (burn gifts off from the gate)');
/* below the gate: credits/sends and give burns change nothing */
{ const dA = V.randomDeed(bytes('below')), rows = [row(T + 2, O, D, V.deedTag(A.id, dA)), row(T + 2, O, D, 'pet:give:' + B.id + ':1')];
  const unk = rows.map(r => Object.assign({}, r, { tag: Buffer.from('pet:zz' + r.tx_hash.slice(0, 6)).toString('hex') }));
  const wa = run(rows, T + 4, { issuances: [iss(O, T + 1, dA, A.id)], orders: [], matches: [], credits: [cr(dA, O, T + 1, 'issuance'), cr(dA, F1, T + 3)], destructions: [] }), wb = run(unk, T + 4, null);
  ok(canon(wa.pets) === canon(wb.pets) && canon(wa.itemList) === canon(wb.itemList) && wa.community.burned === wb.community.burned, 'below gate: identical to unknown tags even with token credits'); }
V._setSalesActivation(G); V._setGiveActivation(G);
const b0 = G + 2, dA = V.randomDeed(bytes('A')), dB = V.randomDeed(bytes('B'));
const mv = V.giftMoves(base, base.byId[A.id]), gids = mv.worn.concat(mv.bag).map(g => g.gid);
const ties = [row(b0 + 1, O, D, V.deedTag(A.id, dA)), row(b0 + 1, O, D, V.deedTag(B.id, dB))];
const dex = (credits, extra) => Object.assign({ issuances: [iss(O, b0, dA, A.id), iss(O, b0, dB, B.id)], orders: [], matches: [], credits: [cr(dA, O, b0, 'issuance'), cr(dB, O, b0, 'issuance')].concat(credits), destructions: [] }, extra || {});
let w = run(ties, b0 + 2, dex([]));
ok(w.byId[A.id].deed === dA && w.byId[A.id].owner === O && w.deeds[dA].holder === O, 'tie: issuer holds the token and owns the pet');
/* send = gift; gear moves */
w = run(ties, b0 + 4, dex([cr(dA, F1, b0 + 3)]));
ok(w.byId[A.id].owner === F1 && w.deeds[dA].holder === F1, 'token send moves the pet');
ok(gids.every(g => { const it = w.itemList.find(i => i.gid === g); return !it || it.owner === F1; }), 'worn + bag gear moves with the token (' + gids.length + ')');
ok(w.log.some(l => l.kind === 'tokenMove' && l.petId === A.id), 'logged as tokenMove');
/* MPMA bundle: two credits in one tx */
{ const t = h('mpma'), c1 = Object.assign(cr(dA, F1, b0 + 3, 'mpma send'), { tx_hash: t }), c2 = Object.assign(cr(dB, F1, b0 + 3, 'mpma send'), { tx_hash: t });
  const ww = run(ties, b0 + 4, dex([c1, c2])); ok(ww.byId[A.id].owner === F1 && ww.byId[B.id].owner === F1, 'MPMA: both pets move in one send'); }
/* re-send */
w = run(ties, b0 + 6, dex([cr(dA, F1, b0 + 3), cr(dA, F2, b0 + 5)]));
ok(w.byId[A.id].owner === F2, 're-send: new holder can pass it on, no retie needed');
/* DEX/dispenser credit (any calling function) */
w = run(ties, b0 + 4, dex([cr(dA, F2, b0 + 3, 'order match')]));
ok(w.byId[A.id].owner === F2, 'DEX fill credit moves the pet');
w = run(ties, b0 + 4, dex([cr(dA, F2, b0 + 3, 'dispense')]));
ok(w.byId[A.id].owner === F2, 'dispense credit moves the pet');
/* send before tie (mint -> send -> tie): holder at the tie owns */
{ const ww = run(ties, b0 + 2, dex([Object.assign(cr(dA, F1, b0), { credit_index: 9e6, tx_index: 9e6 })])); ok(ww.byId[A.id].owner === F1, 'tie after a send: the holder at the tie block owns the pet'); }
/* fake token (different asset, same description) ignored */
{ const fk = V.randomDeed(bytes('fake')), d = dex([cr(fk, F2, b0 + 3)]); d.issuances.push(iss(X, b0, fk, A.id));
  const ww = run(ties.concat([row(b0 + 2, X, D, V.deedTag(A.id, fk))]), b0 + 4, d);
  ok(ww.byId[A.id].owner === O && ww.byId[A.id].deed === dA, 'fake token by a non-owner: ignored, pet stays'); }
/* destroy unties: pet stays with last holder; later credits ignored */
{ const ww = run(ties, b0 + 6, dex([cr(dA, F1, b0 + 3), cr(dA, F2, b0 + 5)], { destructions: [{ asset: dA, quantity: 1, block_index: b0 + 4, tx_index: 1, tx_hash: h('x'), status: 'valid' }] }));
  ok(ww.byId[A.id].owner === F1 && !ww.byId[A.id].deed, 'destroy: pet untied, stays with last holder'); }
/* burn gifts do nothing from the gate */
{ const g = [row(b0 + 3, O, D, 'pet:give:' + C.id + ':1'), row(b0 + 3, O, D, 'pet:swap:' + C.id + ':1'), row(b0 + 3, O, D, 'pet:gives:1:' + C.id.toString(32).toUpperCase())];
  const ww = run(ties.concat(g), b0 + 4, dex([]));
  ok(ww.byId[C.id].owner === O && g.every(r => { const l = ww.log.find(x => x.tx === r.tx_hash); return l && l.kind === 'rejected'; }), 'pet:give / pet:swap / pet:gives rejected from the gate'); }
/* no credits loaded (full node down): ownership not guessed from credits */
{ const d = dex([]); delete d.credits; const ww = run(ties, b0 + 4, d); ok(ww.byId[A.id].owner === O, 'no credit data: pet stays with the tie owner'); }
V._setSalesActivation(null); V._setGiveActivation(null);
console.log('pet-token-test: ' + pass + ' passed, ' + fail + ' failed (snapshot tip ' + T + ')'); process.exit(fail ? 1 : 0);
