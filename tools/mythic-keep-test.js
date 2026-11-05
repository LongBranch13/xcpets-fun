#!/usr/bin/env node
/* MYTHIC KEEP tests (dev only; branch mythic-keep-1105, owner decision 2026-11-05 6:38 AM CT [pt2887u]:
 * "I don't think they should lose mythic status if sold"):
 * once a pet reaches Mythic it stays Mythic (ascended / never-starve) across DEX sales and gifts;
 * pets that already died the discount-Mythic-sold way revive as alive Mythics under their current owner;
 * RAISED-ONLY still denies the buyer the wallet discount; gate OFF (null) leaves replay SAME.
 *   node tools/mythic-keep-test.js [snap-file-name]      (mock DEX data only) */
'use strict';
const crypto = require('crypto');
const { load, row, snap, fakeHash } = require('./lib/load-rules');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('ok  ', m); } else { fail++; console.log('FAIL', m); } };
const S = snap(process.argv[2]), T = S.tip, G = T + 6, D = 0.00000001;
const c = load(), V = c.V2Rules; V._setTokenOnly(false);
const BUYER = 'bc1qmythickeepbuyer000000000000000000000', GIFTEE = 'bc1qmythickeepgiftee00000000000000000000';
const canon = v => JSON.stringify(v, (k, x) => x && typeof x === 'object' && !Array.isArray(x) ? Object.keys(x).sort().reduce((o, kk) => (o[kk] = x[kk], o), {}) : x);
function run(rows, tip, dex) {
  const H = Object.assign({}, c.XCPETS_BLOCK_HASHES, S.hashes);
  rows.forEach(r => { if (!H[r.block_index]) H[r.block_index] = fakeHash(r.block_index); });
  return V.replay(S.rows.concat(rows), H, [], { tip, live: c.LiveEngine.RealCore, dex });
}
let on = 0; const h = s => crypto.createHash('sha256').update('mk:' + s + ':' + (on++)).digest('hex');
function order(src, block, give, giveQ, get, getQ, exp) {
  const x = h(src + block + give);
  return { tx_index: 4e6 + on, tx_hash: x, block_index: block, source: src, give_asset: give, give_quantity: giveQ, give_remaining: giveQ, get_asset: get, get_quantity: getQ, get_remaining: getQ, expiration: exp, expire_index: block + exp - 1, status: 'open' };
}
function match(o0, o1, block, fq, bq) {
  return { id: o0.tx_hash + '_' + o1.tx_hash, tx0_hash: o0.tx_hash, tx1_hash: o1.tx_hash, tx0_address: o0.source, tx1_address: o1.source, forward_asset: o0.give_asset, forward_quantity: fq, backward_asset: o0.get_asset, backward_quantity: bq, block_index: block, tx1_index: o1.tx_index, status: 'completed' };
}
function iss(src, block, asset, desc) {
  return { tx_index: 3e6 + (on++), tx_hash: h('iss' + asset), block_index: block, source: src, issuer: src, asset, quantity: 1, divisible: false, locked: true, description: desc, status: 'valid' };
}
const bytes = k => Array.from(crypto.createHash('sha256').update('mk' + k).digest()).slice(0, 8);

ok(V.ACTIVATE_MYTHIC_KEEP_BLOCK === 974679, 'gate live at 974679');
ok(typeof V._setMythicKeepActivation === 'function' && V.mythicKeepOn(974679) === true && V.mythicKeepOn(974678) === false, '_setMythicKeepActivation + mythicKeepOn respects live gate');

const base = run([], T);
const live = p => !p.dead && !p.released && !p.community && p.owner;
const free = p => live(p) && !V.giveLocks(base, p, G + 10);
/* Prefer a living discount Mythic (care in [21000, 69069)) under a mythicOwner — the exact at-risk class. */
const disc = base.pets.filter(p => free(p) && p.stage === 5 && p.care >= 21000 && p.care < 69069 && (base.mythicOwners || {})[p.owner] != null)
  .sort((a, b) => a.id - b.id)[0];
/* Fallback: any free Mythic. */
const anyM = disc || base.pets.filter(p => free(p) && p.stage === 5).sort((a, b) => a.id - b.id)[0];
ok(!!anyM, 'found a Mythic to sell (id ' + (anyM && anyM.id) + ', care ' + (anyM && anyM.care) + ', discount=' + !!disc + ')');

function beforeGateSame() {
  V._setMythicKeepActivation(null);
  const off = run([], T);
  V._setMythicKeepActivation(G);
  const gated = run([], T); /* tip T < G so keep is not yet on */
  V._setMythicKeepActivation(null);
  const strip = w => w.pets.map(p => { const o = Object.assign({}, p); delete o.children; return o; });
  ok(canon(strip(off)) === canon(strip(gated)), 'replay at tip ' + T + ' (before gate ' + G + '): SAME pets with gate set vs null');
}

if (!anyM) { beforeGateSame(); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0); }

/* Clean sale-only scenario */
function saleOnly(gate) {
  if (gate != null) V._setMythicKeepActivation(gate); else V._setMythicKeepActivation(null);
  const b0 = G + 2;
  const rows = [row(b0, BUYER, D, 'pet:hi')];
  const dA = V.randomDeed(bytes('mk-sale-' + String(gate)));
  const oA = order(anyM.owner, b0 + 1, dA, 1, 'XCP', 250000000, V.SALE_EXPIRY);
  const oB = order(BUYER, b0 + 3, 'XCP', 250000000, dA, 1, 1);
  rows.push(row(b0 + 1, anyM.owner, D, V.deedTag(anyM.id, dA)));
  const dex = { issuances: [iss(anyM.owner, b0, dA, V.deedDesc(anyM.id))], orders: [oA, oB], matches: [match(oA, oB, b0 + 3, 1, 250000000)] };
  /* Tip far enough that an unfed sold pet with old lastFed would die without keep. */
  const tipSale = b0 + 3 + 2000;
  const w = run(rows, tipSale, dex);
  V._setMythicKeepActivation(null);
  return { w, tipSale, b0, pet: w.byId[anyM.id] };
}

const OFF = saleOnly(null);
ok(OFF.pet && OFF.pet.owner === BUYER, 'gate OFF: buyer owns sold #' + anyM.id);
ok(OFF.pet && !OFF.pet.ascended, 'gate OFF: sold pet is not ascended');
ok(!(OFF.pet.stage === 5 && OFF.pet.mythicCare && !OFF.pet.dead), 'gate OFF: sold pet is NOT an alive Mythic under buyer (stage=' + OFF.pet.stageName + ' dead=' + !!OFF.pet.dead + ')');

const ON = saleOnly(G);
ok(ON.pet && ON.pet.owner === BUYER, 'gate ON: buyer owns sold #' + anyM.id);
ok(!!(ON.pet && ON.pet.ascended), 'gate ON: sold pet is ascended');
ok(ON.pet && ON.pet.stage === 5 && ON.pet.mythicCare && !ON.pet.dead && ON.pet.deathBlock == null, 'gate ON: sold pet is alive never-starve Mythic');
ok(!(ON.w.mythicOwners || {})[BUYER], 'gate ON: buyer does NOT gain wallet Mythic discount (raised-only)');

/* Gift path: Mythic gifted away stays Mythic under keep. */
{
  V._setMythicKeepActivation(G);
  const b0 = G + 2;
  const rows = [row(b0, GIFTEE, D, 'pet:hi')];
  const w0 = run(rows, b0 + 1);
  const code = a => V.playerCode(V.playerNo(w0, a));
  /* Pick a different free Mythic than anyM if possible. */
  const gM = base.pets.filter(p => free(p) && p.stage === 5 && p.id !== anyM.id).sort((a, b) => a.id - b.id)[0] || anyM;
  rows.push(row(b0 + 1, gM.owner, D, 'pet:give:' + gM.id + ':' + code(GIFTEE)));
  const tipG = b0 + 1 + 2000;
  const w = run(rows, tipG);
  const p = w.byId[gM.id];
  ok(p && p.owner === GIFTEE, 'gate ON gift: giftee owns #' + gM.id);
  ok(p && p.ascended && p.stage === 5 && !p.dead, 'gate ON gift: gifted Mythic stays alive ascended Mythic');
  ok(!(w.mythicOwners || {})[GIFTEE], 'gate ON gift: giftee does NOT gain wallet discount');
  V._setMythicKeepActivation(null);
}

/* Existing Mythics at tip become ascended when gate = tip (keep, no sale needed). */
{
  V._setMythicKeepActivation(T);
  const w = run([], T);
  const p = w.byId[anyM.id];
  ok(p && p.ascended && p.stage === 5 && !p.dead, 'gate ON at tip: existing Mythic #' + anyM.id + ' is ascended');
  V._setMythicKeepActivation(null);
}

beforeGateSame();

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
