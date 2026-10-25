#!/usr/bin/env node
/* Pet token second issuance / second token (audit-fixes, Oct 24 2026). Can "the newest holder of the tied token owns the pet" be gamed by
 * a second issuance? Mock Counterparty data on the real snapshot, sales + rules gates moved to tip + 6.
 *   1) a later issuance on the SAME asset (qty 0, description changed to another pet) ties nothing and changes nothing;
 *   2) a third party's token naming the pet is never tied (owner only);
 *   3) a SECOND token for the same pet: before ACTIVATE_DEED_REBIND_BLOCK the owner can tie it while still holding the first one; the first
 *      token is then stale (sending it does not move the pet). From the gate that rebind is refused until the first token is destroyed.
 *   4) gate after the tip = world SAME as gate null.
 *   node tools/token-second-issuance-test.js [snap-file-name] */
'use strict';
const crypto = require('crypto');
const { load, row, snap, fakeHash } = require('./lib/load-rules');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const S = snap(process.argv[2]), T = S.tip, G = T + 6, D = 0.00000001;
const c = load(), V = c.V2Rules;
const X = 'bc1qtokentestfaker000000000000000000000000', BUYER = 'bc1qtokentestbuyer000000000000000000000000';
const canon = v => JSON.stringify(v, (k, x) => x && typeof x === 'object' && !Array.isArray(x) ? Object.keys(x).sort().reduce((o, kk) => (o[kk] = x[kk], o), {}) : x);
function run(rows, tip, dex) { const H = Object.assign({}, c.XCPETS_BLOCK_HASHES, S.hashes); rows.forEach(r => { if (!H[r.block_index]) H[r.block_index] = fakeHash(r.block_index); });
  for (let b = T + 1; b <= tip; b++) if (!H[b]) H[b] = fakeHash(b);
  return V.replay(S.rows.concat(rows), H, [], { tip, live: c.LiveEngine.RealCore, dex }); }
let on = 0; const h = s => crypto.createHash('sha256').update('t2:' + s + ':' + (on++)).digest('hex');
const bytes = n => Array.from(crypto.createHash('sha256').update('t2tok' + n).digest()).slice(0, 8);
let ci = 0; const cr = (asset, to, b, fn) => ({ credit_index: 8e6 + (ci++), asset, address: to, quantity: 1, block_index: b, tx_index: 6e6 + ci, tx_hash: h('cr' + asset + b), calling_function: fn || 'send' });
const iss = (src, b, asset, id, o) => Object.assign({ tx_index: 4e6 + (ci++), tx_hash: h('iss' + asset), block_index: b, source: src, issuer: src, asset, quantity: 1, divisible: false, locked: true, description: V.deedDesc(id), status: 'valid' }, o || {});
const base = run([], T, null), owners = {};
base.pets.forEach(p => { if (!p.dead && !p.released && !p.community && p.owner) (owners[p.owner] = owners[p.owner] || []).push(p); });
const O = Object.keys(owners).sort((a, b) => owners[b].length - owners[a].length)[0], mine = owners[O].filter(p => !V.giveLocks(base, p, G + 30));
const A = mine[0], B = mine[1];
V._setSalesActivation(G); V._setGiveActivation(G); V._setRulesActivation(G); V._setOneTieActivation(G);
const b0 = G + 2, d1 = V.randomDeed(bytes('1')), d2 = V.randomDeed(bytes('2')), dx = V.randomDeed(bytes('x'));
/* O mints d1 for A and ties it; later O re-issues d1 (qty 0, description -> B); X mints dx naming A and burns pet:deed for it;
 * O mints a second token d2 for A and ties it while still holding d1; then O sends d1 to BUYER. */
const DEX = { orders: [], matches: [], destructions: [],
  issuances: [iss(O, b0, d1, A.id), iss(O, b0 + 3, d1, B.id, { quantity: 0 }), iss(X, b0 + 1, dx, A.id), iss(O, b0 + 4, d2, A.id)],
  credits: [cr(d1, O, b0, 'issuance'), cr(dx, X, b0 + 1, 'issuance'), cr(d2, O, b0 + 4, 'issuance'), cr(d1, BUYER, b0 + 8)] };
const rows = [row(b0 + 1, O, D, V.deedTag(A.id, d1)), row(b0 + 2, X, D, V.deedTag(A.id, dx)), row(b0 + 4, O, D, V.deedTag(B.id, d1)), row(b0 + 6, O, D, V.deedTag(A.id, d2))];
const tipX = b0 + 10;
ok(V.rebindGate() != null, 'rebind guard gate is set (' + V.rebindGate() + ')');
/* gate null = old rule */
V._setRebindActivation(null); const w0 = run(rows, tipX, DEX);
ok(!w0.byId[B.id].deed && w0.deeds[d1] && w0.deeds[d1].petId === A.id, '1) second issuance on d1 (description -> B) ties nothing: B has no token, d1 stays A\'s');
ok(!w0.deeds[dx] && w0.byId[A.id].owner !== X, '2) a third party\'s token naming A is never tied');
ok(w0.byId[A.id].deed === d2, '3) gate null: the owner can tie a second token d2 while holding d1 (old rule)');
ok(w0.byId[A.id].owner === O, '3) gate null: sending the stale token d1 to a buyer does NOT move A (the problem is real: d1 is a dead token)');
/* gate after the tip = SAME */
V._setRebindActivation(tipX + 5); const w1 = run(rows, tipX, DEX);
ok(canon(w1.pets) === canon(w0.pets) && canon(w1.log) === canon(w0.log) && canon(w1.deeds) === canon(w0.deeds), '4) gate after the tip: world SAME as gate null');
/* gate on */
V._setRebindActivation(b0 + 5); const w = run(rows, tipX, DEX);
ok(w.byId[A.id].deed === d1 && !w.deeds[d2], '3) from the gate: tying d2 while O holds d1 is refused, A keeps d1');
ok(w.byId[A.id].owner === BUYER, '3) from the gate: the token O can sell is the real one, A moves to the buyer with d1');
ok(/destroy that token first/.test(V.deedWhy(run(rows.slice(0, 1), b0 + 5, DEX), { petId: A.id, asset: d2 }, O, b0 + 6, D, V.dexIndex(DEX)) || ''), '3) the refusal says to destroy the current token first');
/* destroy first, then the new tie works */
const DEX2 = Object.assign({}, DEX, { destructions: [{ asset: d1, source: O, quantity: 1, block_index: b0 + 5, tx_index: 7e6, tx_hash: h('destroy'), status: 'valid' }], credits: DEX.credits.slice(0, 3) });
const w2 = run(rows, tipX, DEX2);
ok(w2.byId[A.id].deed === d2, '3) from the gate: after destroying d1 the owner can tie d2');
V._setRebindActivation(null); V._setOneTieActivation(972896); V._setRulesActivation(null);
console.log('token-second-issuance-test: ' + pass + ' passed, ' + fail + ' failed (snapshot tip ' + T + ')'); process.exit(fail ? 1 : 0);
