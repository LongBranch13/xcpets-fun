#!/usr/bin/env node
/* token-proof tests (branch token-proof, Oct 24 2026). Every pet-token mint path builds the SAME Proof of Pet token and is blocked when the
 * proof or its picture can't be built.  node tools/token-proof-test.js   (offline, mock data only) */
'use strict';
const fs = require('fs'), path = require('path');
const { load } = require('./lib/load-rules');
const TP = require('../js/token-proof.js'), PAPERS = require('../js/v2-papers.js'), TM = require('./token-meta.js');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const V = load().V2Rules, ROOT = path.resolve(__dirname, '..');
const A = V.randomDeed([1, 2, 3, 4, 5, 6, 7, 8]);
/* 1) the canonical plan passes for any pet id; every bad variant is blocked with a reason */
for (const id of [2, 1111, 3150, 14749, 24209, 26277, 99999]) ok(TP.planWhy(id, V.mintPlan(id, A), V) === null, 'mintPlan #' + id + ' carries the proof link');
const good = V.mintPlan(1643, A);
ok(good.description === 'https://xcpets.fun/t/1643.json' && good.description.length <= 52, 'description = the t/<id>.json proof link, <= 52 bytes');
const bad = [Object.assign({}, good, { description: '' }), Object.assign({}, good, { description: 'xcpets pet #1643' }), Object.assign({}, good, { description: 'https://xcpets.fun/t/1644.json' }),
  Object.assign({}, good, { description: 'https://xcpets.fun/t/1643.png' }), Object.assign({}, good, { quantity: 2 }), Object.assign({}, good, { divisible: true }), Object.assign({}, good, { lock: false }),
  Object.assign({}, good, { asset: 'XCPETS' }), null];
bad.forEach((p, i) => ok(typeof TP.planWhy(1643, p, V) === 'string', 'bad plan ' + i + ' blocked'));
/* 2) the proof writer must be current */
ok(TP.serviceWhy({ lastBlock: 972970 }, 972973) === null, 'writer current: mint allowed');
ok(/catching up/.test(TP.serviceWhy({ lastBlock: 972935 }, 972973) || ''), 'writer 38 blocks behind: blocked, clear message');
ok(/could not be checked/.test(TP.serviceWhy(null, 972973) || ''), 'writer state unreadable: blocked');
/* 3) every mint path goes through the one check (no direct V.mintPlan into a wallet window) */
const sales = fs.readFileSync(path.join(ROOT, 'js/v2-sales.js'), 'utf8'), card = fs.readFileSync(path.join(ROOT, 'js/v2-pet-card.js'), 'utf8');
ok(!/walletDex\(V\.mintPlan/.test(sales) && !/sendDex\(V\.mintPlan/.test(card), 'no mint path skips the proof check');
ok((sales.match(/mintCheck\(p\.id, A, TIP\)/g) || []).length === 2, 'Spam City Sell + Token Press use mintCheck');
ok(/T\.mintCheck\(p\.id, A, tip\(\)\)/.test(card), 'pet card Tokenize uses mintCheck');
ok(!/mintPlan/.test(fs.readFileSync(path.join(ROOT, 'js/v2-gift.js'), 'utf8')), 'Gift Wrap mints nothing (points to the Token Press)');
for (const f of ['shop.html', 'pet.html']) { const h = fs.readFileSync(path.join(ROOT, f), 'utf8'); ok(h.indexOf('js/token-proof.js') > 0 && h.indexOf('js/token-proof.js') < h.indexOf('js/v2-sales.js'), f + ' loads token-proof.js before v2-sales.js'); }
/* 4) a tied pet's metadata = full Proof of Pet (same shape as the first 3) and its badge renders */
const p = { id: 1643, name: 'Zolu', tier: 'Legendary', species: 'bobo', speciesLabel: 'Bobo', stageName: 'Mythic', rarityScore: 665, status: 'alive', generation: 0 };
const m = TM.meta(p, { asset: A, block: 972936, tx: 'ab'.repeat(32), by: 'bc1qx' }, null, false);
ok(m.verified && m.verified.asset === A && m.verified.tiedBlock === 972936 && m.image === 'https://xcpets.fun/t/1643.png' && m.website.endsWith('id=1643') && m.pet.rarity === 'Legendary', 'tied metadata has verified + image + stats');
const spr = new Uint8Array(4096).fill(200), r = PAPERS.render({ id: 1643, name: 'Zolu', tier: 'Legendary', speciesLabel: 'Bobo' }, spr, 'token');
ok(r.w === 128 && r.h === 128 && r.data.length === 128 * 128 * 4, 'Proof of Pet badge renders 128x128');
/* 5) Fix my token proof: off (design only); a token whose link is already right needs no signature */
ok(TP.FIX_ON === false, 'Fix my token proof is gated off');
ok(TP.fixPlan(1643, { asset: A, description: V.deedDesc(1643), issuer: 'bc1qx' }, 'bc1qx', V).needed === false, 'right link: off-chain refresh only, nothing to sign');
ok(TP.fixPlan(1643, { asset: A, description: 'xcpets pet #9', issuer: 'bc1qx' }, 'bc1qx', V).plan === undefined, 'gated off: no plan built');
/* 6) CI: token-meta reuses the feed's chain read */
const wf = fs.readFileSync(path.join(ROOT, '.github/workflows/api-feed.yml'), 'utf8');
ok(/api-feed\.js --out api --save-input \/tmp\/feed-input\.json/.test(wf) && /token-meta\.js --tokened --input \/tmp\/feed-input\.json/.test(wf), 'workflow passes the feed input to token-meta');
console.log('token-proof-test', pass, 'pass', fail, 'fail'); process.exit(fail ? 1 : 0);
