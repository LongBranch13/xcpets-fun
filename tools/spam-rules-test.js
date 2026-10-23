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
const base = run([], T, null), owners = {};
base.pets.forEach(p => { if (!p.dead && !p.released && !p.community && p.owner) (owners[p.owner] = owners[p.owner] || []).push(p); });
const O = Object.keys(owners).sort((a, b) => owners[b].length - owners[a].length)[0], mine = owners[O].filter(p => !V.giveLocks(base, p, G + 10));
const A = mine[0], B = mine[1], C2 = mine[2];
ok(V.rulesGate() === null, 'shipped: ACTIVATE_SPAM_RULES_BLOCK is null');
ok(V.isBurnAddr(BURN) && V.isBurnAddr('1BitcoinEaterAddressDontSendf59kuE') && V.isBurnAddr('1111111111111111111114oLvT2') && !V.isBurnAddr(O) && !V.isBurnAddr(F1) && !V.isBurnAddr(''), 'isBurnAddr: known burn addresses yes, players no');
ok(V.mintId(V.deedDesc(42)) === 42 && V.mintId('xcpets pet #7') === 7 && V.mintId('https://evil.example/t/2.json') === null && V.mintId('xcpets.fun/t/2.json?x') === null, 'mintId parses only the pet metadata URL forms');
V._setSalesActivation(G); V._setGiveActivation(G);
const b0 = G + 2, dA = V.randomDeed(bytes('A')), dB = V.randomDeed(bytes('B')), dC = V.randomDeed(bytes('C')), fk = V.randomDeed(bytes('fake'));
/* scenario rows + dex used both above and below the rules gate */
const tieB = [row(b0 + 1, O, D, V.deedTag(B.id, dB))];
const pre = [row(T + 2, O, D, V.deedTag(C2.id, dC))]; /* a tie before the sales gate (like Nezu #2 at 972714) */
const dex = extra => ({ issuances: [iss(O, b0, dA, A.id), iss(O, b0, dB, B.id), iss(O, T + 1, dC, C2.id), iss(X, b0, fk, A.id)], orders: [], matches: [], destructions: [],
  credits: [cr(dA, O, b0, 'issuance'), cr(dB, O, b0, 'issuance'), cr(dC, O, T + 1, 'issuance'), cr(fk, X, b0, 'issuance')].concat(extra || []) });
const moves = [cr(dB, F1, b0 + 3, 'send', 100), cr(dB, F2, b0 + 3, 'send', 200), cr(dA, BURN, b0 + 4, 'send')];
const rows = pre.concat(tieB), tipX = b0 + 6;
/* rules gate null: old behaviour */
const w0 = run(rows, tipX, dex(moves));
ok(!w0.byId[A.id].deed, 'rules off: a mint alone does not tie');
ok(w0.byId[B.id].owner === F2, 'rules off: last move in a block wins (old behaviour)');
ok(!w0.byId[C2.id].deed, 'rules off: pre-gate tie stays ignored');
/* rules gate after the tip: identical to null */
V._setRulesActivation(tipX + 5); const w1 = run(rows, tipX, dex(moves));
ok(canon(w1.pets) === canon(w0.pets) && canon(w1.itemList) === canon(w0.itemList) && canon(w1.log) === canon(w0.log) && canon(w1.deeds) === canon(w0.deeds) && w1.community.burned === w0.community.burned, 'rules gate after the tip: world identical to rules off');
/* rules on at the sales gate */
V._setRulesActivation(G); const w = run(rows, tipX, dex(moves));
ok(w.byId[A.id].deed === dA, 'rule 3: owner mint with the right description ties at once (no burn)');
ok(w.log.some(l => l.kind === 'deed' && l.petId === A.id && /one step/.test(l.msg)), 'rule 3: logged as made and tied in one step');
ok(w.deeds[fk] === undefined, 'rule 3: third-party mint (same description) ignored');
ok(w.byId[B.id].owner === F1, 'rule 2: first move in the block wins (tx order)');
ok(w.deeds[dB].holder === F2, 'rule 2: the token holder is still tracked (F2)');
ok(w.log.some(l => l.kind === 'tokenMoveIgnored' && l.petId === B.id), 'rule 2: second move logged as ignored');
ok(w.byId[A.id].owner === BURN && w.byId[A.id].burnedTo && w.byId[A.id].burnedTo.addr === BURN, 'rule 1: token to a burn address: the pet belongs to it, marked burnedTo');
ok(w.log.some(l => l.kind === 'tokenBurnAddr' && l.petId === A.id), 'rule 1: logged as sent to a burn address');
ok(V.petFree(w, w.byId[A.id], O, tipX) === 'owner only', 'rule 1: the old owner can no longer use it');
ok(w.byId[C2.id].deed === dC && w.deeds[dC].block === G, 'grandfather: pre-gate tie honoured at the rules gate');
/* rule 2 next block: a later move works again */
{ const ww = run(rows, tipX + 2, dex(moves.concat([cr(dB, F1, b0 + 5, 'send')]))); ok(ww.byId[B.id].owner === F1 && ww.deeds[dB].holder === F1, 'rule 2: next-block move counts again'); }
{ const ww = run(rows, tipX + 2, dex(moves.concat([cr(dB, X, b0 + 5, 'send')]))); ok(ww.byId[B.id].owner === X, 'rule 2: the real holder moving it next block moves the pet'); }
/* rule 3 safety */
{ const d = dex([]); d.issuances[0] = iss(O, b0, dA, A.id, { locked: false }); const ww = run(rows, tipX, d); ok(!ww.byId[A.id].deed, 'rule 3: unlocked mint does not tie'); }
{ const d = dex([]); d.issuances[0] = iss(O, b0, dA, A.id, { quantity: 2 }); const ww = run(rows, tipX, d); ok(!ww.byId[A.id].deed, 'rule 3: quantity 2 does not tie'); }
{ const d = dex([]); d.issuances[0] = iss(F1, b0, dA, A.id); const ww = run(rows, tipX, d); ok(!ww.byId[A.id].deed, 'rule 3: mint by a non-owner does not tie'); }
{ const d = dex([]); d.issuances.push(iss(O, b0 + 2, V.randomDeed(bytes('A2')), B.id)); const ww = run(rows, tipX, d); ok(ww.byId[B.id].deed === dB, 'rule 3: a second mint does not replace a tied token (use pet:deed to replace)'); }
{ const ww = run(rows, tipX, dex([cr(dA, F1, b0 + 1, 'send')])); ok(ww.byId[A.id].owner === F1 && ww.byId[A.id].deed === dA, 'rule 3: mint then send: the holder owns the pet'); }
/* grandfather safety: owner changed or token left before the gate */
{ const ww = run(rows, tipX, dex([cr(dC, F1, T + 3, 'send')])); ok(!ww.byId[C2.id].deed && ww.byId[C2.id].owner === O, 'grandfather: token left the owner before the gate: not honoured'); }
{ const ww = run(rows.concat([row(T + 3, X, D, V.deedTag(B.id, dB))]), tipX, dex([])); ok(ww.byId[B.id].deed === dB && ww.deeds[dB].issuer === O, 'grandfather: non-owner pre-gate burn ignored'); }
/* rule 1 + rule 2 interplay: burn send first, then a send the same block: pet stays burned */
{ const ww = run(rows, tipX, dex([cr(dA, BURN, b0 + 3, 'send', 10), cr(dA, F1, b0 + 3, 'send', 20)])); ok(ww.byId[A.id].owner === BURN, 'burn send then another send same block: pet stays with the burn address'); }
/* DEX sale in the same block after a send is void */
V._setRulesActivation(null);
console.log('spam-rules-test: ' + pass + ' passed, ' + fail + ' failed (snapshot tip ' + T + ')'); process.exit(fail ? 1 : 0);
