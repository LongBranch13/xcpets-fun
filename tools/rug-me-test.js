// Rug Me tests (offline: fake future burns on a real snapshot; nothing is signed or broadcast). node tools/rug-me-test.js [snap-file]
'use strict';
const { load, row, snap, run } = require('./lib/load-rules.js');
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const s = snap(process.argv[2]), c = load(), V = c.V2Rules, tip = s.tip;
const base = run(c, s, [], tip), B0 = tip + 1;
// two different owners with breedable, unrelated Adult+ pets
const good = base.pets.filter(p => !p.community && !p.dead && !p.released && p.stage >= 3 && !p.neglected && V.breedable(p, B0 + 20) == null && (p.breedsV2 || 0) <= 3);
const by = {}; good.forEach(p => (by[p.owner] = by[p.owner] || []).push(p)); const owners = Object.keys(by).sort((a, b) => by[b].length - by[a].length);
const O1 = owners[0], O2 = owners[1], O3 = owners[2]; let A = by[O1][0], A2 = by[O1][1], Bp = by[O2].find(q => !V.kinWhy(A, q)) || by[O2][0], Bp2 = by[O2].find(q => q !== Bp && !V.kinWhy(A2, q)), C = by[O3][0];
console.log(`snapshot tip ${tip}; poster ${O1.slice(0, 8)} #${A.id}/#${A2.id}, accepter ${O2.slice(0, 8)} #${Bp.id}/#${Bp2 && Bp2.id}, third ${O3.slice(0, 8)} #${C.id}`);
const msgs = (w, rows) => rows.map(r => { const e = w.log.filter(x => x.tx === r.tx_hash || x.tx_hash === r.tx_hash).pop(); return e ? e.kind + ': ' + e.msg : '(no log)'; });
const req = 'T' + Math.max(1, Bp.tier) + '.S3';
const tags = (b0) => [row(b0, O1, 690, 'pet:ad:' + A.id + ':ANY'), row(b0, O2, 690, 'pet:dtb:' + Bp.id + ':1'), row(b0, O1, 1e-8, 'pet:unad:1'), row(b0, O1, 1e-8, 'pet:dtbon:' + A.id), row(b0, O1, 1e-8, 'pet:dtboff:' + A.id)];
// 1) gate OFF (placeholder null): every new tag = exactly today's outcome, world unchanged
ok(V.rugGate() === null && !V.rugOn(B0 + 5), 'ACTIVATE_RUGME_BLOCK is the null placeholder (off)');
let rs = tags(B0 + 2), w = run(c, s, rs, B0 + 10), m = msgs(w, rs);
ok(m.every(x => x === 'rejected: unknown pet: tag (community food)'), 'pre-gate: all 5 tags -> "unknown pet: tag (community food)" [' + m[0] + ']');
ok(!w.ads && !w.byId[A.id].dtb, 'pre-gate: no w.ads, no dtb field (lazy state)');
// 2) gate below the tags but AFTER them (gate at B0+5, tags at B0+2) -> still old outcome
V._setRugActivation(B0 + 5); w = run(c, s, rs, B0 + 10); m = msgs(w, rs);
ok(m.every(x => x === 'rejected: unknown pet: tag (community food)'), 'gate set, tags below it: same old outcome');
// 3) post-gate flow
const G = B0 + 5; V._setRugActivation(G);
const R = []; const add = (b, src, amt, tag) => { const r = row(b, src, amt, tag); R.push(r); return r; };
const rBad = add(G, O1, 690, 'pet:ad:' + A.id + ':T9');
const rLow = add(G, O1, 69, 'pet:ad:' + A.id + ':ANY');
const rNot = add(G, O2, 690, 'pet:ad:' + A.id + ':ANY');
const rAd = add(G, O1, 690, 'pet:ad:' + A.id + ':' + req);
const rDup = add(G, O1, 690, 'pet:ad:' + A.id + ':ANY');
const rSelf = add(G + 1, O1, 690, 'pet:dtb:' + A2.id + ':1');
const rLowB = add(G + 1, O2, 69, 'pet:dtb:' + Bp.id + ':1');
const rUnN = add(G + 1, O2, 1e-8, 'pet:unad:1');
const rOn = add(G + 1, O1, 1e-8, 'pet:dtbon:' + A2.id);
const rOnX = add(G + 1, O2, 1e-8, 'pet:dtbon:' + A2.id);
const rTake = add(G + 2, O2, 690, 'pet:dtb:' + Bp.id + ':1');
const rTake2 = add(G + 2, O3, 690, 'pet:dtb:' + C.id + ':1');
const rAd2 = add(G + 3, O1, 690, 'pet:ad:' + A2.id + ':W999');
const rMiss = Bp2 ? add(G + 4, O2, 690, 'pet:dtb:' + Bp2.id + ':2') : null;
const rUn = add(G + 4, O1, 1e-8, 'pet:unad:2');
const rUn2 = add(G + 5, O1, 1e-8, 'pet:unad:2');
const rAd3 = add(G + 6, O1, 690, 'pet:ad:' + A2.id + ':ANY');
const rExp = add(G + 6 + 1008, O3, 690, 'pet:dtb:' + C.id + ':3');
const rOff = add(G + 7, O1, 1e-8, 'pet:dtboff:' + A2.id);
const n0 = base.pets.length;
w = run(c, s, R, G + 1100); const L = r => msgs(w, [r])[0];
ok(/^rejected: Rug Me: bad standards/.test(L(rBad)), 'bad REQ code rejected: ' + L(rBad));
ok(/^rejected: below Rug Me ad cost/.test(L(rLow)), 'ad below 690 rejected');
ok(/not yours/.test(L(rNot)), 'ad for someone else\'s pet rejected');
ok(/^rugAd: #\d+ posted Rug Me ad 1/.test(L(rAd)), 'ad posted: ' + L(rAd));
ok(/already has an open ad/.test(L(rDup)), 'one open ad per pet');
ok(/your own ad/.test(L(rSelf)), 'cannot accept your own ad');
ok(/below Rug Me cost/.test(L(rLowB)), 'accept below 690 rejected');
ok(/not yours/.test(L(rUnN)), 'only the poster can cancel');
ok(/^dtb: .*Down to Breed/.test(L(rOn)), 'pet:dtbon labels the pet');
ok(/not yours/.test(L(rOnX)), 'cannot DTB-label another owner\'s pet');
ok(/^breed: Rug Me match \(ad 1\)/.test(L(rTake)), 'accept breeds at once: ' + L(rTake));
ok(/ad 1 is taken/.test(L(rTake2)), 'second accept of a taken ad rejected');
const ad1 = w.ads[0], kid = w.byId[ad1.taken && ad1.taken.kid];
ok(kid && kid.owner === O1, 'egg goes to the POSTER (#' + (kid && kid.id) + ' owner ' + (kid && kid.owner.slice(0, 8)) + ')');
ok(kid && kid.parents && kid.parents[0] === A.id && kid.parents[1] === Bp.id, 'parents = poster pet, accepter pet');
ok(w.byId[A.id].lastBreed === G + 2 && w.byId[Bp.id].lastBreed === G + 2, 'both parents count the breed (cooldown)');
if (rMiss) ok(/needs Power 999\+/.test(L(rMiss)), 'threshold enforced: ' + L(rMiss));
ok(/^rugUnad: Rug Me ad 2 cancelled/.test(L(rUn)), 'poster cancels');
ok(/ad 2 is cancelled/.test(L(rUn2)), 'cannot cancel twice');
ok(/ad 3 is expired/.test(L(rExp)), 'ad expires after 1,008 blocks: ' + L(rExp));
ok(/no longer DTB/.test(L(rOff)) && !w.byId[A2.id].dtb, 'pet:dtboff removes the label');
// standards helper
ok(V.reqTag(V.parseReq('t3.S4.PPEPE.W60')) === 'T3.S4.PPEPE.W60' && V.parseReq('T3.T2') === null && V.parseReq('PNOPE') === null && V.parseReq('T1.S3.W5.PPEPE.T2') === null, 'parseReq round trip, duplicates/unknown/5 codes rejected');
ok(V.reqText(V.parseReq('T3.S4')) === 'Legendary · Elder+', 'reqText: ' + V.reqText(V.parseReq('T3.S4')));
// gear owned
const g = Object.values(w.items).find(x => x.owner === O2 && (x.on === Bp.id || x.bag === Bp.id));
if (g) { ok(V.meetsReq(w, w.byId[Bp.id], V.parseReq('G' + V.resolveItem(g.item).toUpperCase())) === null, 'owned gear (' + g.item + ') meets G code'); }
ok(/needs to own/.test(V.meetsReq(w, w.byId[Bp.id], { gear: 'jeweled-crown' }) || (g && g.item === 'jeweled-crown' ? 'needs to own' : '')), 'missing gear fails G code');
// dead poster closes ad; DTB auto-clear
const X = w.byId[A2.id]; X.dtb = 1; X.dead = true; ok(!V.dtbOn(X, G + 9) && V.adState(w, { state: 'open', pet: X.id, owner: O1, block: G }, G + 9) === 'closed', 'dead poster pet: ad closed, DTB auto-clears');
X.dead = false; X.breedsV2 = 6; ok(!V.dtbOn(X, G + 9), 'DTB auto-clears at the 6-breed cap');
// sort: DTB-labelled first, then newest
const fakeW = { byId: { 1: { dtb: 1, owner: 'a' }, 2: { owner: 'b' }, 3: { owner: 'c' } }, ads: [{ id: 1, pet: 1, owner: 'a', block: 10, state: 'open' }, { id: 2, pet: 2, owner: 'b', block: 30, state: 'open' }, { id: 3, pet: 3, owner: 'c', block: 20, state: 'open' }] };
ok(V.openAds(fakeW, 40).map(a => a.id).join() === '1,2,3', 'openAds order: DTB first, then newest');
// send guard mirrors replay
ok(V.sendBlock(w, { tag: 'pet:dtb:' + Bp.id + ':1', amount: 690 }, G + 50, { me: O2 }) != null, 'send guard blocks a taken ad');
// determinism + no randomness: same input twice -> identical pets
const w2 = run(c, s, R, G + 1100); ok(JSON.stringify(w.pets.map(p => [p.id, p.species, p.tier, p.owner])) === JSON.stringify(w2.pets.map(p => [p.id, p.species, p.tier, p.owner])), 'deterministic replay');
ok(w.pets.length === n0 + 1 + (kid && kid.twinOf ? 1 : 0), 'exactly one egg (or twins) from the match');
console.log(fails ? fails + ' FAILED' : 'ALL PASS'); process.exit(fails ? 1 : 0);
