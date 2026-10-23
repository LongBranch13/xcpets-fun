#!/usr/bin/env node
/* PET SHOP SALES tests (dev only; pet-shop-sales preview): pet:sell listings backed by Counterparty DEX orders, exact-match settlement,
 * locks, auto-void, expiry, unique prices, Buy guard (book simulation), and replay SAME below ACTIVATE_SALES_BLOCK.
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
/* pick an owner with free pets */
const base = run([], T, null), owners = {};
base.pets.forEach(p => { if (!p.dead && !p.released && !p.community && p.owner) (owners[p.owner] = owners[p.owner] || []).push(p); });
const O = Object.keys(owners).sort((a, b) => owners[b].length - owners[a].length)[0], mine = owners[O].filter(p => !V.giveLocks(base, p, G + 10));
const withGear = mine.find(p => V.giftMoves(base, p).worn.length) || mine[0], P = mine.filter(p => p !== withGear).slice(0, 6);
ok(V.salesGate() === null, 'shipped gate: ACTIVATE_SALES_BLOCK is null');
/* 1. below the gate: pet:sell is an unknown tag, dex data ignored */
const o1 = order(O, T + 1, 'XCPETS', 1, 'XCPETS' === 'x' ? '' : 'XCP', 250000017, 288);
const pre = [row(T + 1, O, D, V.saleTag(withGear.id, o1.tx_hash)), row(T + 2, O, D, 'pet:sell:' + P[0].id + ':0badc0de')];
const unk = pre.map(r => Object.assign({}, r, { tag: Buffer.from('pet:zz' + r.tx_hash.slice(0, 6)).toString('hex') }));
const dexPre = { orders: [o1], matches: [match(o1, order(BUYER, T + 2, 'XCP', 250000017, 'XCPETS', 1, 1), T + 2, 1, 250000017)] };
const wa = run(pre, T + 3, dexPre), wb = run(unk, T + 3, null);
ok(canon(wa.pets) === canon(wb.pets) && canon(wa.itemList) === canon(wb.itemList) && wa.community.burned === wb.community.burned, 'below gate: pets/gear/community identical to unknown tags (even with DEX data)');
ok(pre.every(r => wa.log.find(l => l.tx === r.tx_hash && l.msg === 'unknown pet: tag (community food)')), 'below gate: logged as unknown pet: tag (community food)');
ok(wa.listings === undefined && wa.byId[withGear.id].owner === O, 'below gate: no listings, no move');
ok(V.parseTag(V.saleTag(123456789, 'ABCDEF0123')).action === 'sell' && V.saleTag(999999999, 'f'.repeat(64)).length <= 34, 'pet:sell tag parses and fits 34 bytes');
ok(V.parseTag('pet:sell:5:abcdefg1').action !== 'sell' && V.parseTag('pet:sell:5:abc').action !== 'sell', 'bad hex rejected by parser');
/* 2. above the gate */
V._setSalesActivation(G);
const b0 = G + 2, A = withGear, mv = V.giftMoves(base, base.byId[A.id]), gids = mv.worn.concat(mv.bag).map(g => g.gid);
const ask = V.uniqueAsk(base, 'XCP', 250000000, b0), oA = order(O, b0, 'XCPETS', 1, 'XCP', ask, V.SALE_EXPIRY);
ok(ask === 250000001, 'uniqueAsk adds the smallest free offset (+1 sat)');
const pA = V.sellOrderPlan(A.id, 'XCP', ask); ok(pA.give_asset === 'XCPETS' && pA.give_quantity === 1 && pA.get_quantity === ask && pA.expiration === 288, 'sell order plan: give 1 dander, get the exact ask, 288 blocks');
const bA = V.sellBurnPlan(A.id, oA.tx_hash); ok(bA.amount === D && bA.tag === 'pet:sell:' + A.id + ':' + oA.tx_hash.slice(0, 8), 'sell burn plan: 1 dander pet:sell:ID:HEX8');
const rows = [row(b0, O, D, bA.tag)], dex = { orders: [oA], matches: [] };
let w = run(rows, b0 + 1, dex); const L = (ww, r) => ww.log.find(l => l.tx === r.tx_hash);
ok(L(w, rows[0]).kind === 'listing' && w.listings.length === 1 && V.saleState(w, w.listings[0], b0 + 1) === 'open', 'listing created');
ok(/listed in the shop/.test(V.giveLocks(w, w.byId[A.id], b0 + 1)), 'listed pet: gift/swap locked');
ok(run(rows, b0 + 1, null).log.find(l => l.tx === rows[0].tx_hash).kind === 'rejected', 'no DEX data: listing burn rejected (retry), never guessed');
/* same-price clash, wrong orders */
const oDup = order(O, b0 + 1, 'XCPETS', 1, 'XCP', ask, 288), oTwo = order(O, b0 + 1, 'XCPETS', 2, 'XCP', ask + 5, 288), oOld = order(O, b0 - 10, 'XCPETS', 1, 'XCP', ask + 6, 288),
  oOther = order(BUYER, b0 + 1, 'XCPETS', 1, 'XCP', ask + 7, 288), oLong = order(O, b0 + 1, 'XCPETS', 1, 'XCP', ask + 8, 2000), oLow = order(O, b0 + 1, 'XCP', 1, 'XCPETS', 5000, 288);
dex.orders.push(oDup, oTwo, oOld, oOther, oLong, oLow);
const r2 = [row(b0 + 1, O, D, V.saleTag(P[0].id, oDup.tx_hash)), row(b0 + 1, O, D, V.saleTag(P[1].id, oTwo.tx_hash)), row(b0 + 1, O, D, V.saleTag(P[2].id, oOld.tx_hash)),
  row(b0 + 1, O, D, V.saleTag(P[3].id, oOther.tx_hash)), row(b0 + 1, O, D, V.saleTag(P[3].id, oLong.tx_hash)), row(b0 + 1, O, D, V.saleTag(P[3].id, oLow.tx_hash)),
  row(b0 + 1, O, D, V.saleTag(A.id, oDup.tx_hash)), row(b0 + 1, O, 0, V.saleTag(P[4].id, oDup.tx_hash))];
rows.push(...r2); w = run(rows, b0 + 2, dex); const msg = i => (L(w, r2[i]) || {}).msg || '';
ok(/same exact price/.test(msg(0)), 'same exact price as an open listing: rejected');
ok(/exactly 1 smallest unit/.test(msg(1)), 'order giving more than 1 unit: rejected');
ok(/more than 6 blocks older/.test(msg(2)), 'order older than the listing lag: rejected');
ok(/no DEX order/.test(msg(3)), 'order from another address: rejected');
ok(/expiry over/.test(msg(4)), 'order expiry over the max: rejected');
ok(/price below/.test(msg(5)), 'price below the minimum: rejected');
ok(/listed in the shop/.test(msg(6)), 'listing an already-listed pet: rejected');
ok(/below listing cost/.test(msg(7)), 'below 1 dander: rejected');
/* locks while listed */
const r3 = [row(b0 + 2, O, 10, 'pet:fight:' + A.id + ':' + P[5].id), row(b0 + 2, O, D, 'pet:rel:' + A.id), row(b0 + 2, O, D, 'pet:give:' + A.id + ':1')];
rows.push(...r3); w = run(rows, b0 + 3, dex);
ok(/listed in the shop/.test(L(w, r3[0]).msg) && /listed in the shop/.test(L(w, r3[1]).msg) && /listed in the shop|unknown pet/.test(L(w, r3[2]).msg) && !w.byId[A.id].released, 'listed pet can\'t fight / be released (gift: locked via giveLocks; gift gate off here)');
/* other locks block listing: open fight */
const oF = order(O, b0 + 2, 'XCPETS', 1, 'XCP', ask + 20, 288); dex.orders.push(oF);
const r4 = [row(b0 + 2, O, 10, 'pet:fight:' + P[5].id + ':' + P[4].id), row(b0 + 3, O, D, V.saleTag(P[5].id, oF.tx_hash))];
rows.push(...r4); w = run(rows, b0 + 4, dex);
ok(L(w, r4[0]).kind === 'fight' ? /open fight/.test(L(w, r4[1]).msg) : true, 'pet with an open fight can\'t be listed');
/* buy guard: book simulation */
const SA = w.listings[0], book0 = [Object.assign({}, oA)];
ok(V.buyGuard(w, SA, book0, b0 + 4, BUYER) === null, 'Buy allowed when the listing fills first and fully');
ok(/own listing/.test(V.buyGuard(w, SA, book0, b0 + 4, O)), 'Buy off on your own listing');
const mkt = order(BUYER2, b0 - 1, 'XCPETS', 2e13, 'XCP', 15e8, 1000);
ok(/fill first/.test(V.buyGuard(w, SA, book0.concat([mkt]), b0 + 4, BUYER)), 'Buy off when a market ask would fill the buyer first');
const bp = V.buyPlan(SA); ok(bp.give_asset === 'XCP' && bp.give_quantity === ask && bp.get_quantity === 1 && bp.expiration === 1, 'buy plan: give exactly the ask, get 1 unit, 1-block expiry');
ok(V.cancelPlan(SA).kind === 'cancel' && V.cancelPlan(SA).offer_hash === oA.tx_hash, 'cancel plan is one Counterparty cancel');
/* exact completed match -> pet + gear move */
const ob = order(BUYER, b0 + 5, 'XCP', ask, 'XCPETS', 1, 1); dex.orders.push(ob); dex.matches.push(match(oA, ob, b0 + 5, 1, ask));
w = run(rows, b0 + 6, dex); const S1 = w.listings[0];
ok(S1.status === 'sold' && S1.buyer === BUYER && w.byId[A.id].owner === BUYER, 'exact completed match moves the pet to the buyer');
ok(gids.every(g => w.items[g].owner === BUYER), 'worn + bag gear moves too (' + gids.length + ')');
ok(w.log.find(l => l.kind === 'sale' && l.listing === 1 && !/price|trad| x /i.test(l.msg)), 'sale logged (no price/trade words)');
ok(!V.giveLocks(w, w.byId[A.id], b0 + 6 + V.GIVE_SETTLE), 'sold pet unlocks for its new owner after the settle wait');
/* same-block determinism: the match settles before the next block's burns */
const wSame = run(rows, b0 + 5, dex); ok(wSame.byId[A.id].owner === BUYER, 'match at the tip settles at the tip');
/* wrong amount / pending / self-fill / expiry / death */
function one(petIdx, mk) { const blk = b0 + 10, o = order(O, blk, 'XCPETS', 1, 'XCP', ask + 100 + petIdx, 288), d2 = { orders: [o], matches: [] }, rr = [row(blk, O, D, V.saleTag(P[petIdx].id, o.tx_hash))]; mk(o, d2, blk); return { w: run(rr, blk + 300, d2), id: P[petIdx].id }; }
let x = one(0, (o, d, blk) => { const q = order(BUYER, blk + 1, 'XCP', o.get_quantity - 1, 'XCPETS', 1, 1); d.matches.push(match(o, q, blk + 1, 1, o.get_quantity - 1)); });
ok(x.w.byId[x.id].owner === O && x.w.listings[0].status === 'void', 'underpaid match: no sale, listing voids');
x = one(1, (o, d, blk) => { const q = order(BUYER, blk + 1, 'XCP', o.get_quantity, 'XCPETS', 1, 1); d.matches.push(match(o, q, blk + 1, 1, o.get_quantity, 'pending')); });
ok(x.w.byId[x.id].owner === O, 'non-completed match: no sale');
x = one(2, (o, d, blk) => { const q = order(O, blk + 1, 'XCP', o.get_quantity, 'XCPETS', 1, 1); d.matches.push(match(o, q, blk + 1, 1, o.get_quantity)); });
ok(x.w.byId[x.id].owner === O && /seller/.test(x.w.listings[0].voidWhy), 'self-fill: no sale');
x = one(3, (o, d, blk) => { const q = order(BUYER, blk + 290, 'XCP', o.get_quantity, 'XCPETS', 1, 1); d.matches.push(match(o, q, blk + 290, 1, o.get_quantity)); });
ok(x.w.byId[x.id].owner === O && V.saleState(x.w, x.w.listings[0], b0 + 10 + 300) === 'expired' && !V.saleListing(x.w, x.id, b0 + 310), 'match after expire_index ignored; listing expires and unlocks');
x = one(4, (o, d, blk) => { const q = order(BUYER, blk + 1, 'XCP', o.get_quantity, 'XCPETS', 1, 1); d.matches.push(match(o, q, blk + 1, 2, o.get_quantity)); });
ok(x.w.byId[x.id].owner === O, 'other fill size (not exactly 1 unit): no sale');
/* auto-void when the pet dies */
const dp = base.pets.find(p => p.owner === O && !p.dead && !p.released && !p.community && p.deathBlock && p.deathBlock > G + 2 && p.deathBlock < G + 250 && !V.giveLocks(base, p, G + 2));
if (dp) { const blk = G + 2, o = order(O, blk, 'XCPETS', 1, 'XCP', 777000001, 288), q = order(BUYER, dp.deathBlock + 1, 'XCP', 777000001, 'XCPETS', 1, 1);
  const ww = run([row(blk, O, D, V.saleTag(dp.id, o.tx_hash))], dp.deathBlock + 5, { orders: [o, q], matches: [match(o, q, dp.deathBlock + 1, 1, 777000001)] });
  ok(ww.byId[dp.id].owner === O && ww.listings[0].status === 'void', 'pet died while listed: listing voids, no move'); } else ok(true, 'death void: no candidate pet (skipped)');
/* determinism: same inputs -> same world; order of DEX arrays irrelevant */
const w1 = run(rows, b0 + 6, dex), w2 = run(rows, b0 + 6, { orders: dex.orders.slice().reverse(), matches: dex.matches.slice().reverse() });
ok(canon(w1.pets) === canon(w2.pets) && canon(w1.listings) === canon(w2.listings), 'deterministic: DEX array order does not matter');
/* simulator sanity: overfill + price-time priority */
const s1 = V.dexSimulate([order('a', 1, 'XCPETS', 1, 'XCP', 500, 10), order('b', 1, 'XCPETS', 1, 'XCP', 300, 10)], { give_asset: 'XCP', give_quantity: 500, get_asset: 'XCPETS', get_quantity: 1 }, 2);
ok(s1.length === 1 && s1[0].backward === 300 && s1[0].source === 'b', 'simulator: the cheaper listing fills first (intercept case)');
ok(V.saleAmountText('XCPETS', 123400000017) === '1,234 XCPETS + 17 dander' && V.saleAmountText('XCP', 250000001) === '250,000,001 sats', 'amount text: XCPETS + dander, XCP in sats');

// ---- Old Money badge + shared pet filter (display only)
{ const fs = require('fs'), pm = (id, o) => Object.assign({ id, species: 'pepe', tier: 1, stage: 2, owner: 'bc1qx', stats: { vigor: 10, spark: 10, grit: 10, zoom: 10, luck: 10 }, hatchBlock: 900000, parents: null, breedsV2: 0 }, o);
  const a = pm(1, { parents: [8, 9], hatchBlock: 950000 }), g = pm(2, { species: 'kek', tier: 3, stage: 4, hatchBlock: 960000, stats: { vigor: 50, spark: 50, grit: 50, zoom: 50, luck: 50 } }), h = pm(3, { parents: [8, 9], hatchBlock: 980000, tier: 0, stage: 1 });
  ok(V.OLD_MONEY_LABEL === 'Old Money 💰' && V.oldMoneyBefore() === null, 'old money: label constant, gate null');
  ok(V.oldMoney(a) && V.oldMoney(h) && !V.oldMoney(g) && !V.oldMoney(null), 'old money: gate null = every bred pet, hatched (genesis) pets never');
  V._setOldMoneyBefore(970000); ok(V.oldMoney(a) && !V.oldMoney(h), 'old money: only pets bred before the 135-cost block'); V._setOldMoneyBefore(null);
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
V._setSalesActivation(null);
console.log('pet-sales-test: ' + pass + ' passed, ' + fail + ' failed (snapshot tip ' + T + ')'); process.exit(fail ? 1 : 0);
