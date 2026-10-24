#!/usr/bin/env node
/* SPAM CITY RULES tests (owner, Oct 23 2026): ACTIVATE_SPAM_RULES_BLOCK gates (1) burn-address sends = pet out of play, (2) one move per pet per block,
 * (3) mint = tie by the pet's owner, plus the one-time grandfather of pre-sales-gate pet:deed ties. Replay SAME below the rules gate.
 *   node tools/spam-rules-test.js [snap-file-name]   (mock data only) */
'use strict';
const crypto = require('crypto');
const { load, row, snap, fakeHash } = require('./lib/load-rules');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const S = snap(process.argv[2]), T = S.tip, G = T + 6, D = 0.00000001;
const c = load(), V = c.V2Rules;
const F1 = 'bc1qtokentestfriend00000000000000000000001', F2 = 'bc1qtokentestfriend00000000000000000000002', X = 'bc1qtokentestfaker000000000000000000000000', BURN = '1CounterpartyXXXXXXXXXXXXXXXUWLpVr';
const canon = v => JSON.stringify(v, (k, x) => x && typeof x === 'object' && !Array.isArray(x) ? Object.keys(x).sort().reduce((o, kk) => (o[kk] = x[kk], o), {}) : x);
function run(rows, tip, dex) { const H = Object.assign({}, c.XCPETS_BLOCK_HASHES, S.hashes); rows.forEach(r => { if (!H[r.block_index]) H[r.block_index] = fakeHash(r.block_index); });
  for (let b = T + 1; b <= tip; b++) if (!H[b]) H[b] = fakeHash(b);
  return V.replay(S.rows.concat(rows), H, [], { tip, live: c.LiveEngine.RealCore, dex }); }
let on = 0; const h = s => crypto.createHash('sha256').update('r:' + s + ':' + (on++)).digest('hex');
const bytes = n => Array.from(crypto.createHash('sha256').update('rtok' + n).digest()).slice(0, 8);
let ci = 0; const cr = (asset, to, b, fn, txi) => ({ credit_index: 7e6 + (ci++), asset, address: to, quantity: 1, block_index: b, tx_index: txi || 5e6 + ci, tx_hash: h('cr' + asset + b), calling_function: fn || 'send' });
const iss = (src, b, asset, id, o) => Object.assign({ tx_index: 3e6 + (ci++), tx_hash: h('iss' + asset), block_index: b, source: src, issuer: src, asset, quantity: 1, divisible: false, locked: true, description: V.deedDesc(id), status: 'valid' }, o || {});
/* ONE TIE PATH (owner, Oct 24 2026): from ACTIVATE_ONE_TIE_PATH_BLOCK a mint alone ties nothing (mint, then a pet:deed tie burn).
 * Mint-only ties made before that gate stay tied. Gate null / after the tip = SAME world as today. */
const base = run([], T, null), owners = {};
base.pets.forEach(p => { if (!p.dead && !p.released && !p.community && p.owner) (owners[p.owner] = owners[p.owner] || []).push(p); });
const O = Object.keys(owners).sort((a, b) => owners[b].length - owners[a].length)[0], mine = owners[O].filter(p => !V.giveLocks(base, p, G + 10));
const A = mine[0], B = mine[1], C2 = mine[2];
ok(V.oneTieGate() === 972896, 'shipped: ACTIVATE_ONE_TIE_PATH_BLOCK is 972896 (deployed Oct 24 2026)');
V._setSalesActivation(G); V._setGiveActivation(G); V._setRulesActivation(G);
const b0 = G + 2, dA = V.randomDeed(bytes('A')), dB = V.randomDeed(bytes('B')), dC = V.randomDeed(bytes('C'));
const DX = () => ({ issuances: [iss(O, b0, dA, A.id), iss(O, b0 + 4, dB, B.id), iss(O, b0 + 4, dC, C2.id)], orders: [], matches: [], destructions: [],
  credits: [cr(dA, O, b0, 'issuance'), cr(dB, O, b0 + 4, 'issuance'), cr(dC, O, b0 + 4, 'issuance')] });
const DEX = DX(), dex = () => DEX;
const rows = [row(b0 + 6, O, D, V.deedTag(C2.id, dC))], tipX = b0 + 10;   /* C2: mint after the gate + tie burn */
V._setOneTieActivation(null); const w0 = run(rows, tipX, dex());
ok(w0.byId[A.id].deed === dA && w0.byId[B.id].deed === dB && w0.byId[C2.id].deed === dC, 'gate null: mint = tie as today (A, B, C2 tied)');
V._setOneTieActivation(tipX + 5); const w1 = run(rows, tipX, dex());
ok(canon(w1.pets) === canon(w0.pets) && canon(w1.log) === canon(w0.log) && canon(w1.deeds) === canon(w0.deeds) && canon(w1.itemList) === canon(w0.itemList), 'gate after the tip: world SAME as gate null');
V._setOneTieActivation(b0 + 2); const w = run(rows, tipX, dex());
ok(w.byId[A.id].deed === dA && w.deeds[dA] && w.deeds[dA].petId === A.id, 'mint-only tie BEFORE the gate still counts (A stays tied)');
ok(!w.byId[B.id].deed && !w.deeds[dB], 'mint-only AFTER the gate does not tie (B has no token)');
ok(w.byId[C2.id].deed === dC && w.deeds[dC].petId === C2.id, 'after the gate: mint + pet:deed tie burn ties (C2)');
ok(!w.log.some(l => l.kind === 'deed' && l.petId === B.id), 'no tie logged for the after-gate mint');
V._setOneTieActivation(null); V._setRulesActivation(null);
console.log('one-tie-path-test: ' + pass + ' passed, ' + fail + ' failed (snapshot tip ' + T + ')'); process.exit(fail ? 1 : 0);
