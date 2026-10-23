#!/usr/bin/env node
/* PET SHOP SALES tests (dev only; pet-shop-sales): PET TOKENS. A free numeric asset (qty 1, indivisible, locked, 'xcpets pet #ID') bound by a
 * pet:deed burn; a DEX order on the token's own pair is the listing; exact completed match = sale (binding travels); pet:unsell; invalidation;
 * remint; locks; expiry; replay SAME below ACTIVATE_SALES_BLOCK.
 *   node tools/pet-sales-test.js [snap-file-name]      (mock DEX data only: nothing is fetched, signed or sent) */
'use strict';
const crypto = require('crypto');
const { load, row, snap, fakeHash } = require('./lib/load-rules');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const S = snap(process.argv[2]), T = S.tip, G = T + 6, D = 0.00000001;
const c = load(), V = c.V2Rules, BUYER = 'bc1qsaletestbuyer00000000000000000000000000', BUYER2 = 'bc1qsaletestbuyer00000000000000000000000002';
const canon = v => JSON.stringify(v, (k, x) => x && typeof x === 'object' && !Array.isArray(x) ? Object.keys(x).sort().reduce((o, kk) => (o[kk] = x[kk], o), {}) : x);
function run(rows, tip, dex) { const H = Object.assign({}, c.XCPETS_BLOCK_HASHES, S.hashes); rows.forEach(r => { if (!H[r.block_index]) H[r.block_index] = fakeHash(r.block_index); });
  return V.replay(S.rows.concat(rows), H, [], { tip, live: c.LiveEngine.RealCore, dex }); }
let on = 0; const h = s => crypto.createHash('sha256').update('order:' + s + ':' + (on++)).digest('hex');
function order(src, block, give, giveQ, get, getQ, exp, extra) { const x = h(src + block); return Object.assign({ tx_index: 4e6 + on, tx_hash: x, block_index: block, source: src, give_asset: give, give_quantity: giveQ, give_remaining: giveQ, get_asset: get, get_quantity: getQ, get_remaining: getQ, expiration: exp, expire_index: block + exp - 1, status: 'open' }, extra || {}); }
function match(o0, o1, block, fq, bq, st) { return { id: o0.tx_hash + '_' + o1.tx_hash, tx0_hash: o0.tx_hash, tx1_hash: o1.tx_hash, tx0_address: o0.source, tx1_address: o1.source, forward_asset: o0.give_asset, forward_quantity: fq, backward_asset: o0.get_asset, backward_quantity: bq, block_index: block, tx1_index: o1.tx_index, status: st || 'completed' }; }
let ix0 = 0; function iss(src, block, asset, desc, extra) { return Object.assign({ tx_index: 3e6 + (ix0++), tx_hash: h('iss' + asset), block_index: block, source: src, issuer: src, asset, quantity: 1, divisible: false, locked: true, description: desc, status: 'valid' }, extra || {}); }
/* pick an owner with free pets */
const base = run([], T, null), owners = {};
base.pets.forEach(p => { if (!p.dead && !p.released && !p.community && p.owner) (owners[p.owner] = owners[p.owner] || []).push(p); });
const O = Object.keys(owners).sort((a, b) => owners[b].length - owners[a].length)[0], mine = owners[O].filter(p => !V.giveLocks(base, p, G + 10));
const withGear = mine.find(p => V.giftMoves(base, p).worn.length) || mine[0], P = mine.filter(p => p !== withGear).slice(0, 8);
ok(V.salesGate() === null, 'shipped gate: ACTIVATE_SALES_BLOCK is null');
ok(V.spamCityGate() === null && V.giveGate() === V.salesGate() && /ACTIVATE_GIVE_BLOCK = ACTIVATE_SPAM_CITY_BLOCK/.test(require('fs').readFileSync(__dirname + '/../js/v2-rules.js', 'utf8')) && /ACTIVATE_SALES_BLOCK = ACTIVATE_SPAM_CITY_BLOCK/.test(require('fs').readFileSync(__dirname + '/../js/v2-rules.js', 'utf8')), 'one launch gate: gifts/swaps and sales follow ACTIVATE_SPAM_CITY_BLOCK');
{ V._setSpamCityActivation(5); ok(V.giveOn(5) && V.salesOn(5) && !V.giveOn(4) && !V.salesOn(4), 'one launch gate switches both'); V._setSpamCityActivation(null); }
/* token names + tags */
const DA = 'A' + '12345678901234567890'.slice(0, 19), bytes = n => Array.from(crypto.createHash('sha256').update('r' + n).digest()).slice(0, 8);
ok(V.deedOk('A95428956661682177') && V.deedOk('A18446744073709551615') && !V.deedOk('A95428956661682176') && !V.deedOk('A18446744073709551616') && !V.deedOk('XCPETS') && !V.deedOk('A0123'), 'numeric range: 26^12+1 .. 2^64-1');
let rOk = true; for (let i = 0; i < 300; i++) { const a = V.randomDeed(bytes(i)); if (!V.deedOk(a) || a.length < 18 || a.length > 21) rOk = false; } ok(rOk && V.randomDeed([0,0,0,0,0,0,0,0]) === 'A95428956661682177' && V.randomDeed([255,255,255,255,255,255,255,255]) === 'A18446744073709551615', 'randomDeed: always A + 17-20 digits in range');
ok(V.b36ToDec(V.decTo36('18446744073709551615')) === '18446744073709551615' && V.deedTag(999999999, 'A18446744073709551615').length <= 34, 'pet:deed tag round-trips and fits 34 bytes');
const pt = V.parseTag(V.deedTag(123, DA)); ok(pt.action === 'deed' && pt.petId === 123 && pt.asset === DA, 'pet:deed parses to the asset');
ok(V.parseTag('pet:deed:5:zz').action !== 'deed' && V.parseTag('pet:sell:5:abcdef01').action !== 'sell', 'out-of-range token rejected by parser; pet:sell retired (unknown tag)');
ok(V.parseTag(V.unsellTag('ABCDEF0123')).action === 'unsell' && V.parseTag('pet:unsell:abc').action !== 'unsell', 'pet:unsell:HEX8 parses');
const mp = V.mintPlan(77, DA); ok(mp.kind === 'issuance' && mp.quantity === 1 && mp.divisible === false && mp.lock === true && mp.description === 'https://xcpets.fun/t/77.json', 'mint plan: qty 1, indivisible, locked, description');
/* 1. below the gate: pet:deed / pet:unsell are unknown tags, dex data ignored */
const dA0 = V.randomDeed(bytes('pre')), iA0 = iss(O, T + 1, dA0, 'xcpets pet #' + withGear.id), o1 = order(O, T + 2, dA0, 1, 'XCP', 250000017, 288);
const pre = [row(T + 2, O, D, V.deedTag(withGear.id, dA0)), row(T + 3, O, D, V.unsellTag(o1.tx_hash)), row(T + 3, O, D, 'pet:sell:' + P[0].id + ':0badc0de')];
const unk = pre.map(r => Object.assign({}, r, { tag: Buffer.from('pet:zz' + r.tx_hash.slice(0, 6)).toString('hex') }));
const dexPre = { issuances: [iA0], orders: [o1], matches: [match(o1, order(BUYER, T + 3, 'XCP', 250000017, dA0, 1, 1), T + 3, 1, 250000017)] };
const wa = run(pre, T + 4, dexPre), wb = run(unk, T + 4, null);
ok(canon(wa.pets) === canon(wb.pets) && canon(wa.itemList) === canon(wb.itemList) && wa.community.burned === wb.community.burned, 'below gate: pets/gear/community identical to unknown tags (even with DEX data)');
ok(pre.every(r => wa.log.find(l => l.tx === r.tx_hash && l.msg === 'unknown pet: tag (community food)')), 'below gate: logged as unknown pet: tag (community food)');
ok(wa.listings === undefined && wa.deeds === undefined && wa.byId[withGear.id].owner === O, 'below gate: no tokens, no listings, no move');
/* 2. above the gate: mint -> wait 1 block -> tie + list */
V._setSalesActivation(G);
const b0 = G + 2, A = withGear, mv = V.giftMoves(base, base.byId[A.id]), gids = mv.worn.concat(mv.bag).map(g => g.gid);
const dA = V.randomDeed(bytes('A')), iA = iss(O, b0, dA, V.deedDesc(A.id)), tieA = row(b0 + 1, O, D, V.deedTag(A.id, dA));
const lp = V.listPlan(A.id, dA, 'XCP', 250000000), oA = order(O, b0 + 1, dA, 1, 'XCP', 250000000, V.SALE_EXPIRY);
ok(lp.give_asset === dA && lp.give_quantity === 1 && lp.get_asset === 'XCP' && lp.get_quantity === 250000000 && lp.expiration === 288, 'list plan: give the 1 token, get the exact price, 288 blocks');
const dex = { issuances: [iA], orders: [oA], matches: [] }, rows = [tieA];
let w = run(rows, b0 + 2, dex); const L = (ww, r) => ww.log.find(l => l.tx === r.tx_hash);
ok(L(w, tieA).kind === 'deed' && w.byId[A.id].deed === dA && V.deedOf(w, w.byId[A.id]).ok, 'token tied to the pet');
ok(w.listings.length === 1 && w.listings[0].give === dA && w.listings[0].block === b0 + 1 && V.saleState(w, w.listings[0], b0 + 2) === 'open', 'same-block order (after the tie burn) becomes a listing');
ok(/listed in the shop/.test(V.giveLocks(w, w.byId[A.id], b0 + 2)), 'listed pet: gift/swap locked');
ok(L(run(rows, b0 + 2, null), tieA).kind === 'rejected', 'no DEX data: token burn rejected (retry), never guessed');
ok(V.sellStep(w, w.byId[A.id], O) === 'list' && V.sellStep(base, base.byId[P[0].id], O) === 'mint', 'sell step: mint first time, list when the token is held');
/* order placed before the tie burn (within the lag) also counts, from the tie block */
{ const d2 = V.randomDeed(bytes('early')), o = order(O, b0, d2, 1, 'XCPETS', 5e8, 288), ww = run([row(b0 + 3, O, D, V.deedTag(P[6].id, d2))], b0 + 4, { issuances: [iss(O, b0 - 1, d2, 'xcpets pet #' + P[6].id)], orders: [o], matches: [] });
  ok(ww.listings.length === 1 && ww.listings[0].block === b0 + 3, 'order up to 6 blocks before the tie: listing from the tie block'); }
/* bad tokens */
function tie(i, isx, extra) { const a = isx.asset, r = row(b0 + 1, O, extra && extra.amt != null ? extra.amt : D, V.deedTag(P[i].id, a)); const ww = run([r], b0 + 2, { issuances: [isx], orders: [], matches: [] }); return (L(ww, r) || {}).msg || ''; }
const rd = k => V.randomDeed(bytes(k));
ok(/another address/.test(tie(0, iss(BUYER, b0, rd(1), 'xcpets pet #' + P[0].id))), 'token issued by another address: rejected');
ok(/description/.test(tie(0, iss(O, b0, rd(2), 'xcpets pet #' + P[1].id))), 'wrong description: rejected');
ok(/quantity 1/.test(tie(0, iss(O, b0, rd(3), 'xcpets pet #' + P[0].id, { quantity: 2 }))) && /quantity 1/.test(tie(0, iss(O, b0, rd(4), 'xcpets pet #' + P[0].id, { locked: false }))) && /quantity 1/.test(tie(0, iss(O, b0, rd(5), 'xcpets pet #' + P[0].id, { divisible: true }))), 'qty != 1 / unlocked / divisible: rejected');
ok(/after the burn/.test(tie(0, iss(O, b0 + 2, rd(6), 'xcpets pet #' + P[0].id))), 'issuance confirmed after the tie burn: rejected');
ok(/below token cost/.test(tie(0, iss(O, b0, rd(7), 'xcpets pet #' + P[0].id), { amt: 0 })), 'below 1 dander: rejected');
{ const r = row(b0 + 1, BUYER, D, V.deedTag(P[0].id, rd(8))); ok(/owner only/.test(L(run([r], b0 + 2, { issuances: [iss(BUYER, b0, rd(8), 'xcpets pet #' + P[0].id)], orders: [], matches: [] }), r).msg), 'non-owner tie: rejected'); }
const tok = (m) => !/rejected|must|another|after|below|owner only|unknown|already/.test(m) ? 'OK' : m;
ok(tok(tie(0, iss(O, b0, rd('url0'), V.deedDesc(P[0].id)))) === 'OK', 'URL description: binds');
ok(tok(tie(0, iss(O, b0, rd('leg0'), 'xcpets pet #' + P[0].id))) === 'OK', 'legacy plain description: still binds');
ok(/description/.test(tie(0, iss(O, b0, rd('url1'), V.deedDesc(P[1].id)))), 'URL of another pet: rejected');
ok(/another address/.test(tie(0, iss(BUYER, b0, rd('fake1'), V.deedDesc(P[0].id)))), 'anti-fake: same URL description minted by a third party: rejected');
/* wrong orders on a bound token are not listings */
{ const d3 = rd('w'), i3 = iss(O, b0, d3, 'xcpets pet #' + P[2].id), t3 = row(b0 + 1, O, D, V.deedTag(P[2].id, d3));
  const bad = [order(O, b0 + 2, d3, 1, 'PEPECASH', 5e8, 288), order(O, b0 + 3, d3, 1, 'XCP', 999, 288), order(O, b0 + 4, d3, 1, 'XCP', 5000, 2000), order(BUYER, b0 + 5, d3, 1, 'XCP', 5000, 288)];
  const ww = run([t3], b0 + 9, { issuances: [i3], orders: bad, matches: [] });
  ok(ww.listings.length === 0 && ww.shopSkips.length === 4 && /XCPETS or XCP/.test(ww.shopSkips[0].why) && /price below/.test(ww.shopSkips[1].why) && /expiry over/.test(ww.shopSkips[2].why) && /not the pet owner/.test(ww.shopSkips[3].why), 'other quote / low price / long expiry / non-owner orders: no listing'); }
/* locks while listed */
const r3 = [row(b0 + 2, O, 10, 'pet:fight:' + A.id + ':' + P[5].id), row(b0 + 2, O, D, 'pet:rel:' + A.id)];
rows.push(...r3); w = run(rows, b0 + 3, dex);
ok(/listed in the shop/.test(L(w, r3[0]).msg) && /listed in the shop/.test(L(w, r3[1]).msg) && !w.byId[A.id].released, 'listed pet can\'t fight / be released');
/* buy guard */
const SA = w.listings[0], book0 = [Object.assign({}, oA)];
ok(V.buyGuard(w, SA, book0, b0 + 3, BUYER) === null, 'Buy allowed when the listing order is open');
ok(/own listing/.test(V.buyGuard(w, SA, book0, b0 + 3, O)), 'Buy off on your own listing');
ok(/not open/.test(V.buyGuard(w, SA, [Object.assign({}, oA, { status: 'cancelled', give_remaining: 0 })], b0 + 3, BUYER)), 'Buy off when the order was cancelled');
const bp = V.buyPlan(SA); ok(bp.give_asset === 'XCP' && bp.give_quantity === 250000000 && bp.get_asset === dA && bp.get_quantity === 1 && bp.expiration === 1, 'buy plan: give exactly the price, get the token, 1-block expiry');
ok(V.cancelPlan(SA).kind === 'cancel' && V.cancelPlan(SA).offer_hash === oA.tx_hash, 'cancel plan is one Counterparty cancel');
/* exact completed match -> pet + gear + binding move */
const ob = order(BUYER, b0 + 5, 'XCP', 250000000, dA, 1, 1); dex.orders.push(ob); dex.matches.push(match(oA, ob, b0 + 5, 1, 250000000));
w = run(rows, b0 + 6, dex); const S1 = w.listings[0];
ok(S1.status === 'sold' && S1.buyer === BUYER && w.byId[A.id].owner === BUYER, 'exact completed match moves the pet to the buyer');
ok(gids.every(g => w.items[g].owner === BUYER), 'worn + bag gear moves too (' + gids.length + ')');
ok(w.deeds[dA].holder === BUYER && w.byId[A.id].deed === dA && V.sellStep(w, w.byId[A.id], BUYER) === 'list', 'binding travels: buyer holds the token, relist is one order');
ok(w.log.find(l => l.kind === 'sale' && l.listing === 1 && !/price|trad| x /i.test(l.msg)), 'sale logged (no price/trade words)');
ok(run(rows, b0 + 5, dex).byId[A.id].owner === BUYER, 'match at the tip settles at the tip');
/* relist by the buyer (1 window), sold again */
const rb = b0 + 6 + V.GIVE_SETTLE, oR = order(BUYER, rb, dA, 1, 'XCPETS', 7e8, 288), ob2 = order(BUYER2, rb + 1, 'XCPETS', 7e8, dA, 1, 1); dex.orders.push(oR, ob2);
w = run(rows, rb, dex); ok(w.listings.length === 2 && w.listings[1].seller === BUYER && w.listings[1].asset === 'XCPETS' && V.saleState(w, w.listings[1], rb) === 'open', 'buyer relists with one order (no new burn)');
{ const oE = order(BUYER, b0 + 6, dA, 1, 'XCP', 5000, 288), ww = run(rows, b0 + 7, Object.assign({}, dex, { orders: dex.orders.concat([oE]) })); ok(ww.shopSkips.some(s => s.order === oE.tx_hash && /changed hands/.test(s.why)), 'relist waits out the settle blocks after a sale'); }
dex.matches.push(match(oR, ob2, rb + 1, 1, 7e8)); w = run(rows, rb + 2, dex);
ok(w.byId[A.id].owner === BUYER2 && w.deeds[dA].holder === BUYER2, 'relisted pet sells again; binding travels again');
/* the old seller's leftover order on the token isn't a listing (not the pet owner) */
{ const oX = order(O, rb + 3, dA, 1, 'XCP', 5000, 288), ww = run(rows, rb + 4, Object.assign({}, dex, { orders: dex.orders.concat([oX]) }));
  ok(ww.listings.length === 2 && ww.shopSkips.some(s => s.order === oX.tx_hash && /not the pet owner/.test(s.why)), 'order from a non-owner (old holder) is not a listing'); }
/* gifted pet: token held elsewhere -> remint; old token invalid */
{ V._setGiveActivation(G); const d4 = rd('g'), d5 = rd('g2'), Q = P[3], t4 = row(b0 + 1, O, D, V.deedTag(Q.id, d4));
  const gv = row(b0 + 2, O, D, 'pet:give:' + Q.id + ':' + V.playerCode(1)), to = V.playerAddr(base, 1);
  const ww = run([t4, gv], b0 + 4, { issuances: [iss(O, b0, d4, 'xcpets pet #' + Q.id)], orders: [], matches: [] });
  const gOk = ww.byId[Q.id].owner === to;
  ok(!gOk || (V.deedOf(ww, ww.byId[Q.id]).ok === false && V.sellStep(ww, ww.byId[Q.id], to) === 'mint'), 'gifted pet: token held by the old owner -> new owner must remint');
  if (gOk) { const bl = b0 + 4 + V.GIVE_SETTLE, rr = [t4, gv, row(bl + 1, to, D, V.deedTag(Q.id, d5))], oN = order(to, bl + 2, d5, 1, 'XCP', 9000, 288), oOld = order(O, bl + 2, d4, 1, 'XCP', 8000, 288);
    const w5 = run(rr, bl + 3, { issuances: [iss(O, b0, d4, 'xcpets pet #' + Q.id), iss(to, bl, d5, 'xcpets pet #' + Q.id)], orders: [oN, oOld], matches: [] });
    ok(w5.byId[Q.id].deed === d5 && w5.deeds[d5].prev === d4 && w5.listings.length === 1 && w5.listings[0].give === d5 && w5.shopSkips.some(s => /old token|not the pet owner/.test(s.why)), 'remint: newest token is current; the old token cannot list'); }
  else ok(true, 'remint: gift did not apply in this snapshot (skipped)'); V._setGiveActivation(null); }
/* wrong amount / pending / self-fill / expiry / unsell */
function one(i, price, mk, tipAdd) { const blk = b0 + 10, d = rd('one' + i), o = order(O, blk + 1, d, 1, 'XCP', price, 288), d2 = { issuances: [iss(O, blk - 1, d, 'xcpets pet #' + P[i].id)], orders: [o], matches: [] }, rr = [row(blk, O, D, V.deedTag(P[i].id, d))]; mk(o, d2, blk, rr, d); return { w: run(rr, blk + (tipAdd || 300), d2), id: P[i].id }; }
let x = one(0, 5000, (o, d, blk, rr, a) => { const q = order(BUYER, blk + 2, 'XCP', 4999, a, 1, 1); d.matches.push(match(o, q, blk + 2, 1, 4999)); });
ok(x.w.byId[x.id].owner === O && x.w.listings[0].status === 'void', 'underpaid match: no sale, listing voids');
x = one(1, 5000, (o, d, blk, rr, a) => { const q = order(BUYER, blk + 2, 'XCP', 5000, a, 1, 1); d.matches.push(match(o, q, blk + 2, 1, 5000, 'pending')); });
ok(x.w.byId[x.id].owner === O, 'non-completed match: no sale');
x = one(2, 5000, (o, d, blk, rr, a) => { const q = order(O, blk + 2, 'XCP', 5000, a, 1, 1); d.matches.push(match(o, q, blk + 2, 1, 5000)); });
ok(x.w.byId[x.id].owner === O && /seller/.test(x.w.listings[0].voidWhy), 'self-fill: no sale');
x = one(3, 5000, (o, d, blk, rr, a) => { const q = order(BUYER, blk + 291, 'XCP', 5000, a, 1, 1); d.matches.push(match(o, q, blk + 291, 1, 5000)); });
ok(x.w.byId[x.id].owner === O && V.saleState(x.w, x.w.listings[0], b0 + 310) === 'expired' && !V.saleListing(x.w, x.id, b0 + 310), 'match after expire_index ignored; listing expires and unlocks');
x = one(4, 5000, (o, d, blk, rr) => { rr.push(row(blk + 3, O, D, V.unsellTag(o.tx_hash))); }, 20);
ok(V.saleState(x.w, x.w.listings[0], b0 + 10 + 3 + 5) === 'open' && V.saleState(x.w, x.w.listings[0], b0 + 10 + 3 + 6) === 'ended' && !V.saleListing(x.w, x.id, b0 + 19), 'pet:unsell ends the listing 6 blocks later (pet unlocks)');
x = one(5, 5000, (o, d, blk, rr, a) => { rr.push(row(blk + 3, O, D, V.unsellTag(o.tx_hash))); const q = order(BUYER, blk + 8, 'XCP', 5000, a, 1, 1), q2 = order(BUYER, blk + 9, 'XCP', 5000, a, 1, 1); d.matches.push(match(o, q2, blk + 9, 1, 5000)); }, 20);
ok(x.w.byId[x.id].owner === O, 'match after the unsell settle: no sale');
x = one(7, 5000, (o, d, blk, rr, a) => { rr.push(row(blk + 3, O, D, V.unsellTag(o.tx_hash))); const q = order(BUYER, blk + 5, 'XCP', 5000, a, 1, 1); d.matches.push(match(o, q, blk + 5, 1, 5000)); }, 20);
ok(x.w.byId[x.id].owner === BUYER, 'match inside the unsell settle still sells (deterministic)');
{ const r = row(b0 + 3, BUYER, D, V.unsellTag(oA.tx_hash)), ww = run(rows.concat([r]), b0 + 4, dex); ok(/no open listing/.test(L(ww, r).msg), 'pet:unsell from another address: rejected'); }
/* auto-void when the pet dies */
const dp = base.pets.find(p => p.owner === O && !p.dead && !p.released && !p.community && p.deathBlock && p.deathBlock > G + 4 && p.deathBlock < G + 250 && !V.giveLocks(base, p, G + 2));
if (dp) { const blk = G + 2, d = rd('dead'), o = order(O, blk + 1, d, 1, 'XCP', 777000001, 288), q = order(BUYER, dp.deathBlock + 1, 'XCP', 777000001, d, 1, 1);
  const ww = run([row(blk, O, D, V.deedTag(dp.id, d))], dp.deathBlock + 5, { issuances: [iss(O, blk - 1, d, 'xcpets pet #' + dp.id)], orders: [o, q], matches: [match(o, q, dp.deathBlock + 1, 1, 777000001)] });
  ok(ww.byId[dp.id].owner === O && ww.listings[0].status === 'void', 'pet died while listed: listing voids, no move'); } else ok(true, 'death void: no candidate pet (skipped)');
/* determinism */
const w1 = run(rows, b0 + 10, dex), w2 = run(rows, b0 + 10, { issuances: dex.issuances.slice().reverse(), orders: dex.orders.slice().reverse(), matches: dex.matches.slice().reverse() });
ok(canon(w1.pets) === canon(w2.pets) && canon(w1.listings) === canon(w2.listings), 'deterministic: DEX array order does not matter');
ok(V.saleAmountText('XCPETS', 123400000017) === '1,234 XCPETS + 17 dander' && V.saleAmountText('XCP', 250000001) === '250,000,001 sats', 'amount text: XCPETS + dander, XCP in sats');
const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'js/v2-sales.js'), 'utf8') + require('fs').readFileSync(require('path').join(__dirname, '..', 'js/v2-rules.js'), 'utf8');
ok(!/uniqueAsk|dexSimulate|sellBurnPlan|saleTag\(/.test(src), 'quick listing path (shared XCPETS/XCP pair) is gone');
// ---- Old Money badge + shared pet filter (display only)
{ const fs = require('fs'), pm = (id, o) => Object.assign({ id, species: 'pepe', tier: 1, stage: 2, owner: 'bc1qx', stats: { vigor: 10, spark: 10, grit: 10, zoom: 10, luck: 10 }, hatchBlock: 900000, parents: null, breedsV2: 0 }, o);
  const a = pm(1, { parents: [8, 9], hatchBlock: 950000 }), g = pm(2, { species: 'kek', tier: 3, stage: 4, hatchBlock: 960000, stats: { vigor: 50, spark: 50, grit: 50, zoom: 50, luck: 50 } }), h = pm(3, { parents: [8, 9], hatchBlock: 971000, tier: 0, stage: 1 });
  ok(V.OLD_MONEY_LABEL === 'Old Money 💰' && V.oldMoneyBefore() === 972703 && V.oldMoneyBefore() === V.breed135Gate(), 'old money: label constant, uses main\'s ACTIVATE_BREED_135_BLOCK (972703)');
  ok(V.oldMoney(a) && V.oldMoney(h) && !V.oldMoney(g) && !V.oldMoney(null), 'old money: bred before 972703 qualify, hatched (genesis) pets never');
  ok(!V.oldMoney(pm(4, { parents: [8, 9], hatchBlock: 972703 })), 'old money: bred at/after the 135 gate does not');
  { const G = V.breed135Gate(); V._setBreed135Activation(970000); ok(V.oldMoney(a) && !V.oldMoney(h), 'old money: follows the breed-135 gate'); V._setBreed135Activation(G); }
  { const Bd = require('../js/v2-badges.js'); ok(typeof Bd.oldMoney === 'function' && [a, g, h].every(p => Bd.oldMoney(p, V) === V.oldMoney(p)), 'old money: ONE check (V2Badges delegates to V2Rules.oldMoney)'); }
  const w = { byId: { 1: a, 2: g, 3: h }, pets: [a, g, h], listings: [], items: { x: { id: 'x', on: 2 } } };
  const S = (n, id, asset, price, o) => Object.assign({ n, petId: id, seller: 'bc1qx', asset, price, expire: 10000, status: 'open' }, o);
  const xs = [{ p: a, S: S(1, 1, 'XCPETS', 500e8, {}), buy: true }, { p: g, S: S(2, 2, 'XCP', 3000, {}), buy: false }, { p: h, S: S(3, 3, 'XCPETS', 100e8, { status: 'sold' }), buy: true }];
  const F = f => V.petFilter(w, xs, f, 100).map(x => x.p.id).join(',');
  ok(F({}) === '1,2,3', 'filter: empty filter keeps all');
  ok(F({ sp: 'kek' }) === '2' && F({ tier: '3' }) === '2' && F({ st: '1' }) === '3', 'filter: species / tier / stage');
  ok(F({ badge: 'om' }) === '1,3', 'filter: Old Money only');
  ok(F({ cur: 'XCP' }) === '2' && F({ cur: 'XCPETS', min: '200' }) === '1' && F({ cur: 'XCP', max: '2999' }) === '', 'filter: currency + cost range (XCPETS whole, XCP sats)');
  ok(F({ pw: '200' }) === '2' && F({ gear: '1' }) === '2' && F({ buy: '1' }) === '1,3', 'filter: power min / gear worn / buyable now');
  ok(F({ state: 'sold' }) === '3' && F({ state: 'open' }) === '1,2', 'filter: listing status');
  ok(F({ sort: 'power' }).startsWith('2') && F({ sort: 'new' }) === '3,2,1' && F({ sort: 'rarity' }).startsWith('2'), 'sort: power / newest / rarity');
  ok(F({ sort: 'cost', cur: 'XCPETS' }) === '3,1' && F({ sort: '-cost', cur: 'XCPETS' }) === '1,3', 'sort: cost low/high');
  const rep = ['js/v2-replay-worker.js', 'js/v2-chain.js'].map(f => { try { return fs.readFileSync(require('path').join(__dirname, '..', f), 'utf8'); } catch (e) { return ''; } }).join('');
  const rules = fs.readFileSync(require('path').join(__dirname, '..', 'js/v2-rules.js'), 'utf8').replace(/function oldMoney[\s\S]*?\n/, '').replace(/oldMoney: oldMoney[^,]*,/, '');
  ok(!/oldMoney|OLD_MONEY/.test(rep) && (rules.match(/oldMoney\(/g) || []).filter(Boolean).length <= 2, 'old money: display only, replay never reads it'); }

{ /* wallet: pet token issuance compose + echo check */
  const Wm = require('../js/v2-wallet.js')({ win: {}, fetch: () => Promise.reject(new Error('no net')), storage: { getItem: () => null, setItem() {} }, CFG: { network: 'mainnet' }, BurnCore: {}, Wallet: { Tracker: function () { return { add() {}, list: () => [] }; } } });
  const plan = V.mintPlan(4107, 'A123456789012345678'), u = Wm._dexUrl('https://node.example/v2', 'bc1qme', plan, 3);
  ok(/\/compose\/issuance\?/.test(u) && /asset=A123456789012345678/.test(u) && /quantity=1&/.test(u) && /divisible=false/.test(u) && /lock=true/.test(u) && /description=https%3A%2F%2Fxcpets.fun%2Ft%2F4107.json/.test(u), 'wallet: issuance compose url');
  const good = { rawtransaction: 'ab', name: 'issuance', params: { source: 'bc1qme', asset: plan.asset, quantity: 1, divisible: false, lock: true, description: plan.description } };
  ok(Wm._dexCheck(good, 'bc1qme', plan).length === 0, 'wallet: issuance echo ok');
  ok(Wm._dexCheck(Object.assign({}, good, { params: Object.assign({}, good.params, { quantity: 2 }) }), 'bc1qme', plan).length > 0, 'wallet: issuance qty 2 rejected');
  ok(Wm._dexCheck(Object.assign({}, good, { params: Object.assign({}, good.params, { description: 'x' }) }), 'bc1qme', plan).length > 0, 'wallet: issuance wrong description rejected');
  ok(Wm._dexCheck(good, 'bc1qme', V.mintPlan(4107, 'PEPECASH')).length > 0, 'wallet: named asset rejected');
  const sales = require('fs').readFileSync(require('path').join(__dirname, '..', 'js/v2-sales.js'), 'utf8');
  ok(!/Paid in|uniqueAsk|smallest free extra/.test(sales) && /loadDex\(rows\)|function loadDex\(rows\)/.test(sales) && /crypto\.getRandomValues/.test(sales), 'shop UI: no shared-pair choice; token discovery from burns; random token'); }
V._setSalesActivation(null);
/* token metadata URL (token-meta) */
ok(V.deedDesc(2) === 'https://xcpets.fun/t/2.json' && Buffer.byteLength(V.deedDesc(1844674407)) <= 52, 'deedDesc = metadata URL, fits 52 bytes');
ok(V.deedDescOk('https://xcpets.fun/t/2.json', 2) && V.deedDescOk('xcpets pet #2', 2) && V.deedDescOk('xcpets.fun/t/2.json', 2) && !V.deedDescOk('https://xcpets.fun/t/3.json', 2) && !V.deedDescOk('https://evil.example/t/2.json', 2) && !V.deedDescOk('https://xcpets.fun/t/22.json', 2), 'deedDescOk: URL with the right id only (+ legacy)');
{ const TM = require('./token-meta.js'), j = TM.meta({ id: 2, name: 'X', tier: 'Common', speciesLabel: 'Pepe', species: 'pepe', stageName: 'Adult', status: 'alive', generation: 0, rarityScore: 1 }, 'A1');
  ok(j.asset === 'A1' && j.image === 'https://xcpets.fun/t/2.png' && j.pet.id === 2 && j.name && j.images[0].data === j.image, 'token JSON: asset, name, image, pet id');
  const pg = TM.png(new Uint8ClampedArray(4096).fill(200), 32, 32, 4); ok(pg.slice(1, 4).toString() === 'PNG' && pg.readUInt32BE(16) === 128, 'sprite PNG 128x128'); }
console.log('pet-sales-test: ' + pass + ' passed, ' + fail + ' failed (snapshot tip ' + T + ')'); process.exit(fail ? 1 : 0);
