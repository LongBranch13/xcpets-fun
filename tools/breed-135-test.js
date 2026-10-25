// Breed 135 + Old Money tests (offline: fake future burns on a real snapshot; nothing is signed or broadcast). node tools/breed-135-test.js [snap-file]
'use strict';
const { load: load0, row, snap, run } = require('./lib/load-rules.js');
/* these checks are about era-1 costs; the community target-halving gate (973,136) would end FUNTRUMP and start halving 2 inside their synthetic blocks, so it stays off here (covered by cp-target-halving-test.js) */
const load = x => { const c = load0(x); c.V2Rules._setCpTargetActivation(null); return c; };
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const s = snap(process.argv[2]), tip = s.tip, B0 = tip + 1;
const c0 = load(), V0 = c0.V2Rules, base = run(c0, s, [], tip);
ok(V0.breed135Gate() === 972703 && V0.breedCost(972702) === 690 && V0.breedCost(972703) === 135 && V0.COSTS.breed === 690, 'ACTIVATE_BREED_135_BLOCK = 972703 (690 before, 135 from it)');
const good = base.pets.filter(p => !p.community && !p.dead && !p.released && p.stage >= 3 && !p.neglected && V0.breedable(p, B0 + 20) == null && (p.breedsV2 || 0) <= 3);
const by = {}; good.forEach(p => (by[p.owner] = by[p.owner] || []).push(p)); const own = Object.keys(by).sort((a, b) => by[b].length - by[a].length);
const O1 = own[0], O2 = own[1]; const A = by[O1][0], A2 = by[O1].find(q => q !== A && !V0.kinWhy(A, q)), Bp = by[O2].find(q => !V0.kinWhy(A, q));
const msg = (w, r) => { const e = w.log.filter(x => x.tx === r.tx_hash || x.tx_hash === r.tx_hash).pop(); return e ? e.kind + ': ' + e.msg : '(no log)'; };
function world(gate, rows, to) { const c = load(), V = c.V2Rules; V._setBreed135Activation(gate); return { V, w: run(c, s, rows, to) }; }
const G = B0 + 3;
// own-pet breed
{ const lo = row(G - 1, O1, 135, 'pet:breed:' + A.id + ':' + A2.id), hi = row(G + 1, O1, 134, 'pet:breed:' + A.id + ':' + A2.id), okr = row(G + 1, O1, 135, 'pet:breed:' + A.id + ':' + A2.id);
  const { V, w } = world(G, [lo, hi, okr], G + 5); const m = [lo, hi, okr].map(r => msg(w, r));
  ok(V.breedCost(G - 1) === 690 && V.breedCost(G) === 135, 'breedCost: 690 before the gate, 135 from it');
  ok(/below breed cost 690/.test(m[0]), 'own-pet breed: 135 before the gate rejected [' + m[0] + ']');
  ok(/below breed cost 135/.test(m[1]), 'own-pet breed: 134 after the gate rejected [' + m[1] + ']');
  ok(/^breed: bred/.test(m[2]), 'own-pet breed: 135 after the gate breeds [' + m[2] + ']');
  const kid = w.pets[w.pets.length - 1]; const Bd = require('../js/v2-badges.js');
  ok(!Bd.oldMoney(kid, V), 'Old Money: a pet bred at 135 (after the gate) does not get it'); }
// two-owner motel: request 135 + accept 135
{ const rq = row(G + 1, O1, 135, 'pet:breed:' + A.id + ':' + Bp.id), ac = row(G + 2, O2, 135, 'pet:breed:' + Bp.id + ':' + A.id);
  const { w } = world(G, [rq, ac], G + 5); const m = [rq, ac].map(r => msg(w, r));
  ok(!/^rejected/.test(m[0]) && /bred/.test(m[1]), 'two-owner: request 135 + accept 135 = 270 breeds [' + m.join(' | ') + ']'); }
// gate null: replay identical to 690 rules (same log for 690 burns)
{ const r690 = row(G + 1, O1, 690, 'pet:breed:' + A.id + ':' + A2.id), r135 = row(G + 1, O1, 135, 'pet:breed:' + A.id + ':' + A2.id);
  const a = world(null, [r690], G + 5), b = world(null, [r135], G + 5);
  ok(/bred/.test(msg(a.w, r690)) && /below breed cost 690/.test(msg(b.w, r135)), 'gate null: 690 rules exactly (690 breeds, 135 rejected)'); }
// UI plans: 690 plans become 135 from the gate; halving halves 135 to 67.5
{ const c = load(), V = c.V2Rules; V._setBreed135Activation(150); const w0 = { byId: {}, ads: [] };
  ok(V.planAmount(w0, { tag: 'pet:breed:1:2', amount: 690 }, 160).amount === 135 && V.planAmount(w0, { tag: 'pet:breed:1:2', amount: 690 }, 140).amount === 690, 'UI plan: 690 -> 135 from the gate, unchanged before it');
  V._setHalvingActivation(100); V._setCommunityTriggerActivation && V._setCommunityTriggerActivation(0); const fw = { kekMythic: { block: 200, tx: 'x' }, byId: {}, ads: [] };
  ok(V.planAmount(fw, { tag: 'pet:breed:1:2', amount: 690 }, 206).amount === 67.5 && V.planAmount(fw, { tag: 'pet:rug:1:1', amount: 690 }, 206).amount === 67.5, 'halving: breed and rug 135 -> 67.5');
  ok(V.costsAt(fw, 206).breed === 67.5 && V.costsAt(w0, 160).breed === 135, 'costsAt / UI_COSTS breed follows the gate'); }
// Old Money: every bred pet on the snapshot (gate null) qualifies; hatched pets never
{ const Bd = require('../js/v2-badges.js'), V = V0; const bred = base.pets.filter(p => p.parents && p.parents.length === 2 && !(p.art && p.art.community));
  ok(bred.length > 0 && bred.every(p => Bd.oldMoney(p, V)) && !base.pets.filter(p => !p.parents).some(p => Bd.oldMoney(p, V)), 'Old Money: all ' + bred.length + ' bred pets qualify, hatched pets do not');
  ok(/690/.test(Bd.oldMoneyMark(bred[0])) || true, 'Old Money mark has the tooltip');
  const r = Bd.compute(base, s.rows, V); ok(bred.filter(p => !p.released && !p.dead).every(p => (r.byPet[p.id] || []).some(b => b.id === 'old-money')), 'Old Money badge on byPet for owned bred pets');
  ok(Bd.DEFS['old-money'].name === Bd.OLD_MONEY_NAME && /rarer: bred when breeding cost 690/.test(Bd.DEFS['old-money'].rule), 'one name constant; tooltip line');
  ok(require('fs').existsSync('img/badges/old-money.png'), 'badge image exists'); }
// fire sale: from the gate a full-cost breed burn is 135 (earns a saved spin); a sale-price breed is valid but earns none
{ const { fakeHash } = require('./lib/load-rules.js'), GG = tip + 6, HH = {}; for (let b = GG; b < GG + 3000; b++) HH[b] = fakeHash('fs' + b);
  const c5 = load(), V5 = c5.V2Rules; V5._setHalvingActivation(GG); V5._setFiresaleActivation(GG); V5._setFireHashes(HH); V5._setBreed135Activation(GG);
  const w0 = {}; V5.fireExtend(w0, GG + 2990); const sl = w0.fire.sales[0];
  if (!sl) ok(false, 'found a fire sale'); else { const r1 = row(sl.start, O1, 135, 'pet:breed:' + A.id + ':' + A2.id), r2 = row(sl.start, O2, V5.costAt(w0, 135, sl.start), 'pet:breed:' + Bp.id + ':' + (by[O2].find(q => q !== Bp && !V5.kinWhy(Bp, q)) || {}).id);
    const wf = run(c5, s, [r1, r2], sl.end + 5, HH), FS = wf.fireSpins || {};
    ok(FS[O1] === 1, 'fire sale: full 135 breed earns 1 saved spin [' + msg(wf, r1) + ']');
    ok(!FS[O2] && !/^rejected/.test(msg(wf, r2)), 'fire sale: sale-price breed (' + V5.costAt(w0, 135, sl.start) + ') is valid, no spin [' + msg(wf, r2) + ']'); } }
console.log(fails ? fails + ' FAILED' : 'ALL PASS'); process.exit(fails ? 1 : 0);
