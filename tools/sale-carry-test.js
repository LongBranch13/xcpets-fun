#!/usr/bin/env node
/* Sale carry test (branch gear-stick-fix, owner rule 2026-10-28: "whatever you advertise your pet wearing has to go with him"). Dev only.
 *   node tools/sale-carry-test.js          (mock DEX data on the fixture snapshot: nothing is fetched, signed or sent)
 * From ACTIVATE_SALE_CARRY_BLOCK: the chain-worn gear a pet shows when listed (S.adv) plus what it still wears at the sale goes to the buyer and stays
 * on; the seller's tab-only equips come off and stay with the seller; Flex Forge looks (flameLooks + the seller's look copies on the pet) go too.
 * Token sends outside a listing carry the same way. Before the gate everything is exactly as on main. */
'use strict';
const crypto = require('crypto');
const { load, snap, fakeHash } = require('./lib/load-rules');
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const S = snap('snap-972901.json'), T = S.tip, BUY = 'bc1qsalecarrybuyer000000000000000000000000', BUY2 = 'bc1qsalecarrybuyer000000000000000000000002';
let on = 0; const h = s => crypto.createHash('sha256').update('carry:' + s + ':' + (on++)).digest('hex');
const canon = v => JSON.stringify(v, (k, x) => x && typeof x === 'object' && !Array.isArray(x) ? Object.keys(x).sort().reduce((o, kk) => (o[kk] = x[kk], o), {}) : x);
function ctx(carry) { const c = load(), V = c.V2Rules; V._setQuestActivation(972700); V._setEarnActivation(972700); V._setLookPickActivation(972800); if (carry != null) V._setSaleCarry(carry); return c; }
function run(carry, rows, ops, dex, tip) { const c = ctx(carry), H = Object.assign({}, c.XCPETS_BLOCK_HASHES, S.hashes); for (let b = 972690; b <= T + 40; b++) if (!H[b]) H[b] = fakeHash(b);
  return { V: c.V2Rules, w: c.V2Rules.replay(S.rows.concat(rows || []), H, ops || [], { tip: tip || T + 20, live: c.LiveEngine.RealCore, dex }) }; }
const hex = s => Buffer.from(s, 'utf8').toString('hex');
let rn = 0; const row = (b, src, tag) => ({ tx_index: 9e9 + (rn++), tx_hash: h('row' + tag), block_index: b, source: src, asset: 'XCPETS', quantity: 1, tag: hex(tag), status: 'valid' });
const B0 = run(null, [], [], null, T), V0 = B0.V, w0 = B0.w, C0 = w0.lookCopies || {};
ok(V0.ACTIVATE_SALE_CARRY_BLOCK === 973646 && V0.ACTIVATE_SALE_CARRY_BLOCK > 973638, "shipped gate 973646 is after tip 973638 (+8)");
const P = w0.pets.find(p => !p.dead && !p.released && !p.community && p.owner && V0.wornOf(w0, p.id).length && Object.values(C0).some(x => x.at === p.id && x.holder === p.owner) && !V0.giveLocks(w0, p, T + 10));
ok(!!P, 'fixture pet with worn gear + a Flex Forge look copy: #' + (P && P.id));
const O = P.owner, worn0 = V0.wornOf(w0, P.id).map(g => g.gid).sort(), copy = Object.keys(C0).find(k => C0[k].at === P.id && C0[k].holder === O);
const spare = Object.values(w0.items).find(g => g.owner === O && g.on == null && g.grave == null && !V0.wornOf(w0, P.id).some(x => x.slot === g.slot) && V0.equipCheck(w0, O, P.id, g.item).ok);
ok(!!spare, 'seller has a spare piece that fits an open slot: ' + (spare && spare.item));
const strip = worn0[0], stripSlot = w0.items[strip].slot;
/* mint -> tie -> list -> buyer match */
const b0 = T + 2, deed = V0.randomDeed(Array.from(crypto.createHash('sha256').update('carry-deed').digest()).slice(0, 8));
const iss = { tx_index: 3e6, tx_hash: h('iss'), block_index: b0, source: O, issuer: O, asset: deed, quantity: 1, divisible: false, locked: true, description: V0.deedDesc(P.id), status: 'valid' };
const tie = row(b0 + 1, O, V0.deedTag(P.id, deed));
const ord = (src, b, give, gq, get, getQ) => ({ tx_index: 4e6 + (on++), tx_hash: h(src + b), block_index: b, source: src, give_asset: give, give_quantity: gq, give_remaining: gq, get_asset: get, get_quantity: getQ, get_remaining: getQ, expiration: 288, expire_index: b + 287, status: 'open' });
const oS = ord(O, b0 + 1, deed, 1, 'XCP', 250000000), oB = ord(BUY, b0 + 5, 'XCP', 250000000, deed, 1);
const m = { id: oS.tx_hash + '_' + oB.tx_hash, tx0_hash: oS.tx_hash, tx1_hash: oB.tx_hash, tx0_address: O, tx1_address: BUY, forward_asset: deed, forward_quantity: 1, backward_asset: 'XCP', backward_quantity: 250000000, block_index: b0 + 5, tx1_index: oB.tx_index, status: 'completed' };
const dexSale = { issuances: [iss], orders: [oS], matches: [m] };
const stripOps = [{ kind: 'equip', owner: O, petId: P.id, slot: stripSlot, gid: null, block_index: b0 + 3 }, { kind: 'equip', owner: O, petId: P.id, slot: spare.slot, gid: spare.gid, block_index: b0 + 3 }];
const view = (V, w) => { const Q = w.byId[P.id], C = w.lookCopies || {}; return { owner: Q.owner, worn: V.wornOf(w, P.id).map(g => g.gid).sort(), wornBuyer: V.wornOf(w, P.id).every(g => g.owner === Q.owner), copy: C[copy] && { holder: C[copy].holder, at: C[copy].at }, lo: (w.lookOwners || {})[P.id], L: (w.listings || []).find(x => x.petId === P.id), spare: w.items[spare.gid] && { owner: w.items[spare.gid].owner, on: w.items[spare.gid].on }, strip: w.items[strip] && { owner: w.items[strip].owner, on: w.items[strip].on } }; };
const G = b0;
/* before the gate (main rules) */
const off = run(null, [tie], [], dexSale), A = view(off.V, off.w);
ok(A.L && A.L.status === 'sold' && A.owner === BUY, 'gate off: the sale goes through');
ok(canon(A.worn) === canon(worn0) && A.wornBuyer && A.L.adv === undefined, 'gate off: chain world moves the worn gear as before, no adv recorded');
ok(A.copy && A.copy.holder === O, 'gate off (bug): the forged look copy stays with the SELLER after the sale');
const offS = run(null, [tie], stripOps, dexSale), AS = view(offS.V, offS.w);
ok(AS.strip.owner === O && AS.spare.owner === BUY, 'gate off (bug): seller\'s tab stripped the advertised piece after listing and the buyer got the swap-in instead');
/* from the gate */
const onR = run(G, [tie], [], dexSale), B = view(onR.V, onR.w);
ok(B.L && B.L.status === 'sold' && B.owner === BUY && canon(B.L.adv.slice().sort()) === canon(worn0), 'gate on: listing records the advertised (chain-worn) gear');
ok(canon(B.worn) === canon(worn0) && B.wornBuyer, 'gate on: buyer owns and WEARS every advertised piece');
ok(B.copy && B.copy.holder === BUY && B.copy.at === P.id && B.lo === BUY, 'gate on: the Flex Forge look copy goes to the buyer, still on the pet');
const onS = run(G, [tie], stripOps, dexSale), BS = view(onS.V, onS.w);
ok(BS.strip.owner === BUY && BS.strip.on === P.id, 'gate on: piece stripped in the seller\'s tab after listing still goes to the buyer, worn');
ok(BS.spare.owner === O && BS.spare.on == null, 'gate on: tab-only swap-in comes off and stays with the seller');
ok(canon(BS.worn) === canon(B.worn) && BS.copy.holder === BUY, 'gate on: seller\'s tab and every other viewer agree on what the buyer got');
/* token send outside a listing (DEX credit) */
const cr = (addr, b, fn, ev) => ({ asset: deed, address: addr, quantity: 1, block_index: b, tx_index: 5e6 + (on++), calling_function: fn, event: ev });
const dexSend = { issuances: [iss], orders: [], matches: [], credits: [cr(O, b0, 'issuance', iss.tx_hash), cr(BUY2, b0 + 4, 'send', h('send'))] };
const sOff = view(run(null, [tie], [], dexSend).V, run(null, [tie], [], dexSend).w), sOn = (() => { const r = run(G, [tie], stripOps, dexSend); return view(r.V, r.w); })();
ok(sOff.owner === BUY2 && sOff.copy.holder === O, 'gate off: token send moves the pet, forged look stays with the old owner (bug)');
ok(sOn.owner === BUY2 && sOn.copy.holder === BUY2 && sOn.strip.owner === BUY2 && sOn.strip.on === P.id && sOn.spare.owner === O, 'gate on: token send carries chain gear + forged look; tab-only equip stays');
/* no transfer: gate changes nothing */
const n1 = run(G, [tie], [], { issuances: [iss], orders: [], matches: [] }).w, n2 = run(null, [tie], [], { issuances: [iss], orders: [], matches: [] }).w;
ok(canon(n1.pets) === canon(n2.pets) && canon(n1.itemList) === canon(n2.itemList) && canon(n1.lookCopies) === canon(n2.lookCopies), 'gate on without any transfer: pets, gear, looks identical');
console.log(fail ? fail + ' FAILED' : 'ALL PASS'); process.exit(fail ? 1 : 0);
