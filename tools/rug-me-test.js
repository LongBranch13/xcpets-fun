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
const tags = (b0) => [row(b0, O1, 690, 'pet:ad:' + A.id + ':ANY'), row(b0, O1, 138, 'pet:ad:' + A.id + '.' + A2.id + ':ANY:B3'), row(b0, O2, 690, 'pet:rug:' + Bp.id + ':1'), row(b0, O1, 1e-8, 'pet:unad:1')];
// 1) gate OFF (placeholder null): every new tag = exactly today's outcome, world unchanged
const LIVE_GATE = V.rugGate(); ok(LIVE_GATE === null || (Number.isInteger(LIVE_GATE) && LIVE_GATE > tip), 'ACTIVATE_RUGME_BLOCK is null or above the snapshot tip (' + LIVE_GATE + ')');
V._setRugActivation(null); ok(!V.rugOn(B0 + 5), 'gate off -> Rug Me off');
let rs = tags(B0 + 2), w = run(c, s, rs, B0 + 10), m = msgs(w, rs);
ok(m.every(x => x === 'rejected: unknown pet: tag (community food)'), 'pre-gate: all 4 tags (incl. a multi-pet ad) -> "unknown pet: tag (community food)" [' + m[0] + ']');
ok(!w.ads, 'pre-gate: no w.ads (lazy state)');
// 2) gate below the tags but AFTER them (gate at B0+5, tags at B0+2) -> still old outcome
V._setRugActivation(B0 + 5); w = run(c, s, rs, B0 + 10); m = msgs(w, rs);
ok(m.every(x => x === 'rejected: unknown pet: tag (community food)'), 'gate set, tags below it: same old outcome');
// 3) post-gate flow
const G = B0 + 5; V._setRugActivation(G);
const R = []; const add = (b, src, amt, tag) => { const r = row(b, src, amt, tag); R.push(r); return r; };
const rBad = add(G, O1, 69, 'pet:ad:' + A.id + ':T9');
const rLow = add(G, O1, 60, 'pet:ad:' + A.id + ':ANY');
const rNot = add(G, O2, 69, 'pet:ad:' + A.id + ':ANY');
const rAd = add(G, O1, 69, 'pet:ad:' + A.id + ':' + req);
const rDup = add(G, O1, 69, 'pet:ad:' + A.id + ':ANY');
const rSelf = add(G + 1, O1, 690, 'pet:rug:' + A2.id + ':1');
const rLowB = add(G + 1, O2, 69, 'pet:rug:' + Bp.id + ':1');
const rUnN = add(G + 1, O2, 1e-8, 'pet:unad:1');
const rTake = add(G + 2, O2, 690, 'pet:rug:' + Bp.id + ':1');
const rTake2 = add(G + 2, O3, 690, 'pet:rug:' + C.id + ':1');
const rAd2 = add(G + 3, O1, 69, 'pet:ad:' + A2.id + ':W999');
const rMiss = Bp2 ? add(G + 4, O2, 690, 'pet:rug:' + Bp2.id + ':2') : null;
const rUn = add(G + 4, O1, 1e-8, 'pet:unad:2');
const rUn2 = add(G + 5, O1, 1e-8, 'pet:unad:2');
const rAd3 = add(G + 6, O1, 69, 'pet:ad:' + A2.id + ':ANY');
const rExp = add(G + 6 + 1008, O3, 690, 'pet:rug:' + C.id + ':3');
const n0 = base.pets.length;
w = run(c, s, R, G + 1100); const L = r => msgs(w, [r])[0];
ok(/^rejected: Rug Me: bad standards/.test(L(rBad)), 'bad REQ code rejected: ' + L(rBad));
ok(/^rejected: below Rug Me ad cost/.test(L(rLow)), 'ad below 69 rejected (posting = 69 per pet)');
ok(/not yours/.test(L(rNot)), 'ad for someone else\'s pet rejected');
ok(/^rugAd: #\d+ posted Rug Me ad 1/.test(L(rAd)), 'ad posted: ' + L(rAd));
ok(/already has an open ad/.test(L(rDup)), 'one open ad per pet');
ok(/your own ad/.test(L(rSelf)), 'cannot accept your own ad');
ok(/below Rug Me cost/.test(L(rLowB)), 'accept below 690 rejected');
ok(/not yours/.test(L(rUnN)), 'only the poster can cancel');
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
// standards helper
ok(V.reqTag(V.parseReq('t3.S4.PPEPE.W60')) === 'T3.S4.PPEPE.W60' && V.parseReq('T3.T2') === null && V.parseReq('PNOPE') === null && V.parseReq('T1.S3.W5.PPEPE.T2') === null, 'parseReq round trip, duplicates/unknown/5 codes rejected');
ok(V.reqText(V.parseReq('T3.S4')) === 'Legendary · Elder+', 'reqText: ' + V.reqText(V.parseReq('T3.S4')));
// gear owned
const g = Object.values(w.items).find(x => x.owner === O2 && (x.on === Bp.id || x.bag === Bp.id));
if (g) { ok(V.meetsReq(w, w.byId[Bp.id], V.parseReq('G' + V.resolveItem(g.item).toUpperCase())) === null, 'owned gear (' + g.item + ') meets G code'); }
ok(/needs to own/.test(V.meetsReq(w, w.byId[Bp.id], { gear: 'jeweled-crown' }) || (g && g.item === 'jeweled-crown' ? 'needs to own' : '')), 'missing gear fails G code');
// dead poster closes ad
const X = w.byId[A2.id]; X.dead = true; ok(V.adState(w, { state: 'open', pet: X.id, owner: O1, block: G }, G + 9) === 'closed', 'dead poster pet: ad closed'); X.dead = false;
// sort: newest first (post block, then ad number)
const fakeW = { byId: { 1: { owner: 'a' }, 2: { owner: 'b' }, 3: { owner: 'c' } }, ads: [{ id: 1, pet: 1, owner: 'a', block: 10, state: 'open' }, { id: 2, pet: 2, owner: 'b', block: 30, state: 'open' }, { id: 3, pet: 3, owner: 'c', block: 20, state: 'open' }] };
ok(V.openAds(fakeW, 40).map(a => a.id).join() === '2,3,1', 'openAds order: newest first');
// send guard mirrors replay
ok(V.sendBlock(w, { tag: 'pet:rug:' + Bp.id + ':1', amount: 690 }, G + 50, { me: O2 }) != null, 'send guard blocks a taken ad');
// determinism + no randomness: same input twice -> identical pets
const w2 = run(c, s, R, G + 1100); ok(JSON.stringify(w.pets.map(p => [p.id, p.species, p.tier, p.owner])) === JSON.stringify(w2.pets.map(p => [p.id, p.species, p.tier, p.owner])), 'deterministic replay');
ok(w.pets.length === n0 + 1 + (kid && kid.twinOf ? 1 : 0), 'exactly one egg (or twins) from the match');

// follow-up: tag length + malformed standards rejected with reasons; halving prices
{ const long = 'pet:ad:' + A2.id + ':T2.S4.PHYB.GGOLDEN-CAPE-X', why = V.reqWhy('T2.S4.PHYB.GGOLDEN-CAPE-X', A2.id);
  ok(why && /too long/.test(why), 'overlong standards rejected with a reason [' + why + ']');
  ok(/twice/.test(V.reqWhy('T1.T2', 5)) && /bad standards/.test(V.reqWhy('T1..S3', 5)) && /bad standards/.test(V.reqWhy('ANY.T1', 5)) && /letters/.test(V.reqWhy('T1_S3', 5)) && /at most/.test(V.reqWhy('T1.S3.W5.PHYB.GA', 5)) && V.reqWhy('T1.S3', 5) === null, 'malformed standards: duplicate / empty / ANY-mix / bad chars / too many codes all give reasons');
  const Rl = R.concat([row(G + 40, O1, 690, long)]), wl = run(c, s, Rl, G + 50), el = wl.log.filter(x => x.tx === Rl[Rl.length - 1].tx_hash).pop();
  ok(el && el.kind === 'rejected' && /too long/.test(el.msg), 'replay rejects an overlong ad with the reason [' + (el && el.msg) + ']'); }
{ V._setHalvingActivation(100); V._setCommunityTriggerActivation && V._setCommunityTriggerActivation(0); const fw = { kekMythic: { block: 200, tx: 'x' }, byId: {}, ads: [] };
  ok(V.costAt(fw, 690, 206) === 345 && V.planAmount(fw, { tag: 'pet:ad:5:ANY', amount: 69 }, 206).amount === 34.5 && V.planAmount(fw, { tag: 'pet:rug:5:1', amount: 690 }, 206).amount === 345 && V.planAmount(fw, { tag: 'pet:ad:5.6.7:ANY', amount: 207 }, 206).amount === 103.5, 'halving 1: UI plans: post 34.5 per pet, rug 345 (same costAt)');
  ok(/below Rug Me ad cost 34.5/.test(V.rugCheck(fw, { action: 'ad', petId: 5, req: 'ANY' }, 'z', 206, 34, () => null) || '') && !/below/.test(V.rugCheck(fw, { action: 'ad', petId: 5, req: 'ANY' }, 'z', 206, 34.5, () => null) || '') && /below Rug Me cost 345/.test(V.rugCheck(fw, { action: 'rug', petId: 5, adId: 1 }, 'z', 206, 344, () => null) || ''), 'halving 1: replay post 34.5 ok / 34 rejected, rug 344 rejected (matches the UI price)'); }
// multi-pet posting: one tag, several pets, one ad each; all-or-nothing; optional preset bio
{ const M = by[O1].filter(p => p !== A && p !== A2).slice(0, 3); if (M.length >= 2) { const [M1, M2] = M, ids = M1.id + '.' + M2.id;
  const Rm = [row(G, O1, 69, 'pet:ad:' + ids + ':ANY:B3'), row(G, O1, 138, 'pet:ad:' + ids + ':ANY:B3'), row(G + 1, O1, 138, 'pet:ad:' + ids + ':ANY'), row(G + 1, O1, 138, 'pet:ad:' + M1.id + '.' + M1.id + ':ANY'),
    row(G + 1, O1, 69, 'pet:ad:' + (M[2] || A).id + ':ANY:XYZ'), row(G + 1, O1, 138, 'pet:ad:' + (M[2] || A).id + '.' + Bp.id + ':ANY'), row(G + 2, O2, 690, 'pet:rug:' + Bp.id + ':2')];
  const wm = run(c, s, Rm, G + 20), Lm = Rm.map(r => msgs(wm, [r])[0]);
  ok(/below Rug Me ad cost 138 \(2 pets, 69 each\)/.test(Lm[0]), 'multi ad: 69 per pet [' + Lm[0] + ']');
  ok(/^rugAd: #\d+, #\d+ posted Rug Me ads 1-2/.test(Lm[1]) && wm.ads.length === 2 && wm.ads.every(a => a.bio === undefined && a.owner === O1), 'multi ad: one burn -> ads 1-2; an old-format :B3 field is ignored (no bio stored) [' + Lm[1] + ']');
  ok(/already has an open ad/.test(Lm[2]) && /listed twice/.test(Lm[3]) && /too many fields/.test(Lm[4]) && /not yours/.test(Lm[5]) && wm.ads.length === 2, 'multi ad: dup / twice / extra field / one foreign pet -> whole tag rejected with reasons');
  const ka = wm.ads[1].taken && wm.byId[wm.ads[1].taken.kid]; ok(ka && ka.owner === O1 && ka.parents[0] === M2.id, 'accept one ad of a multi post: egg to the poster');
  ok(V.onRug(wm, wm.byId[M1.id], G + 3) && !V.onRug(wm, wm.byId[M2.id], G + 3), 'onRug marker: open ad yes, taken ad no');
  ok(V.adTag([1234, 5678, 9012], 'T2.S4') === 'pet:ad:1234.5678.9012:T2.S4' && /too long/.test(V.reqWhy('T2.S4.W60', [12345, 12346, 12347, 12348]) || ''), 'adTag + 34-byte packing limit'); } }
// no DTB naming anywhere in Rug Me UI / HatchBot / rules
{ const fs = require('fs'), bad = ['js/v2-rugme.js', 'tools/hatchbot-rugme.js', 'js/v2-rules.js', 'css/rugme.css', 'design/breed-board.md'].filter(f => fs.existsSync(f) && /\bDTB\b|down to breed|dtbon|dtboff/i.test(fs.readFileSync(f, 'utf8')));
  ok(!bad.length, 'no DTB / Down to Breed naming left' + (bad.length ? ' in ' + bad.join(', ') : '')); }
ok(V.RUG_AD_COST + 690 === 759, 'a Rug Me breed totals 759 (69 post + 690 accept)');
// bios always random: UI has no picker, bio = BIOS[hash(tx + pet)] (13 presets)
{ const ui = require('fs').readFileSync('js/v2-rugme.js', 'utf8'); ok(!/rmBio|ad\.bio/.test(ui) && (ui.match(/^\s+'[^\n]*'[,\]]/gm) || []).length >= 0 && /pick\(BIOS, ad\.tx \+ ':' \+ ad\.pet\)/.test(ui), 'no bio picker; bio picked from tx hash + pet'); }
// fire-sale spin credit: pet:ad + pet:rug full-price burns in a live sale earn a saved spin, only from the Rug Me gate
{ const { fakeHash } = require('./lib/load-rules.js'), GG = tip + 6, HH = {}; for (let b = GG; b < GG + 3000; b++) HH[b] = fakeHash('fs' + b);
  const fr = (gate) => { const c5 = load(), V5 = c5.V2Rules; V5._setHalvingActivation(GG); V5._setFiresaleActivation(GG); V5._setFireHashes(HH); V5._setRugActivation(gate(GG));
    const w0 = {}; V5.fireExtend(w0, GG + 2990); const sl = w0.fire.sales[0]; if (!sl) return null; const g2 = gate(GG) > sl.start ? null : 1;
    const rows = [row(sl.start, O1, 69, 'pet:ad:' + A.id + ':ANY'), row(sl.start, O1, 138, 'pet:ad:' + A2.id + '.' + C.id + ':ANY'), row(sl.start + 1, O2, 690, 'pet:rug:' + Bp.id + ':1'), row(sl.start + 1, O3, V5.costAt(w0, 69, sl.start + 1), 'pet:ad:' + C.id + ':ANY')];
    const wf = run(c5, s, rows, sl.end + 5, HH); return { V5, wf, sl, rows, g2 }; };
  const F = fr(g => g); if (!F) ok(false, 'found a fire sale for the test'); else { const { V5, wf, rows } = F, Lf = rows.map(r => msgs(wf, [r])[0]);
    const FS = wf.fireSpins || {}; ok(FS[O1] === 1 && FS[O2] === 1 && (wf.fireSpinLog || []).map(x => x.action).sort().join() === 'ad,rug', 'fire sale: full-price pet:ad (69) and pet:rug (690) each earn 1 saved spin; a rejected multi-ad earns none [' + Lf.join(' | ') + ']');
    ok(/^rugAd/.test(Lf[3]) && !FS[O3], 'fire sale: a sale-price ad is valid but earns no spin'); }
  const F2 = fr(g => g + 2990); if (F2) ok(!(F2.wf.fireSpins || {})[O1] && !(F2.wf.fireSpins || {})[O2] && msgs(F2.wf, F2.rows).every(x => x === 'rejected: unknown pet: tag (community food)'), 'below ACTIVATE_RUGME_BLOCK: ad / rug burns earn no fire-sale spin (unknown tag, as today)'); }
console.log(fails ? fails + ' FAILED' : 'ALL PASS'); process.exit(fails ? 1 : 0);
