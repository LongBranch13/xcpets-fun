#!/usr/bin/env node
/* PET GIFTING tests (dev only; pet-gift preview): pet:give / pet:gives / pet:hi, player numbers, gear moves, locks, settle,
 * batch skip-with-reason, burn packing, and replay SAME below ACTIVATE_GIVE_BLOCK.   node tools/pet-gift-test.js [snap-file-name] */
'use strict';
const { load, row, snap, run } = require('./lib/load-rules');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const S = snap(process.argv[2]), T = S.tip, G = T + 6, D = 0.00000001;
const c = load(), V = c.V2Rules; V._setTokenOnly(false); const NEW = 'bc1qgifttestnewwallet000000000000000000000', NEW2 = 'bc1qgifttestnewwallet000000000000000000002';
const canon = v => JSON.stringify(v, (k, x) => x && typeof x === 'object' && !Array.isArray(x) ? Object.keys(x).sort().reduce((o, kk) => (o[kk] = x[kk], o), {}) : x);
/* 1. below the gate: same as an unknown tag */
const base = run(c, S, [], T);
const owners = {}; base.pets.forEach(p => { if (!p.dead && !p.released && !p.community && p.owner) (owners[p.owner] = owners[p.owner] || []).push(p); });
const O = Object.keys(owners).sort((a, b) => owners[b].length - owners[a].length)[0], mine = owners[O].filter(p => !V.giveLocks(base, p, G + 10));
const withGear = mine.find(p => V.giftMoves(base, p).worn.length) || mine[0], P1 = mine.filter(p => p !== withGear).slice(0, 4);
ok(V.playerNo(base, O) >= 1, 'history gives the owner a player #');
const pre = [row(T + 1, O, D, 'pet:give:' + withGear.id + ':1'), row(T + 1, O, D, 'pet:hi'), row(T + 2, O, D, 'pet:swap:' + P1[0].id + ':1'), row(T + 2, O, D, 'pet:swapok:1'), row(T + 2, O, D, 'pet:swapno:1'), row(T + 2, O, D, 'pet:gives:1:' + P1.map(p => p.id.toString(32).toUpperCase()).join('.'))];
const unk = pre.map(r => Object.assign({}, r, { tag: Buffer.from('pet:zz' + r.tx_hash.slice(0, 6)).toString('hex') }));
const wa = run(c, S, pre, T + 3), wb = run(c, S, unk, T + 3);
ok(canon(wa.pets) === canon(wb.pets) && canon(wa.itemList) === canon(wb.itemList) && wa.community.burned === wb.community.burned, 'below gate: pets/gear/community identical to unknown tags');
ok(pre.every(r => wa.log.find(l => l.tx === r.tx_hash && l.msg === 'unknown pet: tag (community food)')), 'below gate: logged as unknown pet: tag (community food)');
/* 2. above the gate */
V._setGiveActivation(G);
const b0 = G + 2, rows = [row(b0, NEW, D, 'pet:hi')];
let w = run(c, S, rows, b0); const NP = V.playerNo(w, NEW); ok(NP === w.playerList.length && V.playerAddr(w, NP) === NEW, 'pet:hi gives a new wallet the next player #' + V.playerCode(NP));
ok(w.log.find(l => l.tx === rows[0].tx_hash).kind === 'hi', 'pet:hi logged');
const PC = V.playerCode(NP), mv = V.giftMoves(w, w.byId[withGear.id]), gids = mv.worn.concat(mv.bag).map(g => g.gid);
rows.push(row(b0 + 1, O, D, 'pet:give:' + withGear.id + ':' + PC));
rows.push(row(b0 + 2, NEW, D, 'pet:give:' + withGear.id + ':' + V.playerCode(V.playerNo(w, O)))); /* re-gift too soon */
rows.push(row(b0 + 2, O, D, 'pet:give:' + P1[0].id + ':' + V.playerCode(V.playerNo(w, O)))); /* to self */
rows.push(row(b0 + 2, O, D, 'pet:give:' + P1[0].id + ':VVVV')); /* unknown player */
rows.push(row(b0 + 2, O, 0, 'pet:give:' + P1[0].id + ':' + PC)); /* below cost */
w = run(c, S, rows, b0 + 3); const L = i => w.log.find(l => l.tx === rows[i].tx_hash);
const gp = w.byId[withGear.id]; ok(gp.owner === NEW && L(1).kind === 'gift', 'pet:give moves the pet');
ok(gids.every(g => w.items[g].owner === NEW), 'worn + bag gear moves with the pet (' + gids.length + ')');
ok(gids.every(g => w.items[g].on === (mv.worn.find(x => x.gid === g) ? gp.id : null)), 'worn gear stays worn');
ok(/just changed hands/.test(L(2).msg) && gp.owner === NEW, 're-gift within ' + V.GIVE_SETTLE + ' blocks rejected');
ok(/your own/.test(L(3).msg) && /no such player/.test(L(4).msg) && /below gift cost/.test(L(5).msg), 'self / unknown player / below cost rejected');
ok(V.giftsTo(w, NEW).length === 1 && V.giftsTo(w, NEW)[0].from === O, 'giftLog for the recipient');
rows.push(row(b0 + 1 + V.GIVE_SETTLE, NEW, D, 'pet:give:' + withGear.id + ':' + V.playerCode(V.playerNo(w, O))));
w = run(c, S, rows, b0 + 10); ok(w.byId[withGear.id].owner === O, 're-gift allowed after the settle wait');
/* 3. locks */
const lk = [row(b0 + 20, O, 690, 'pet:fight:' + P1[1].id + ':' + P1[2].id), row(b0 + 21, O, D, 'pet:give:' + P1[1].id + ':' + PC)];
w = run(c, S, rows.concat(lk), b0 + 22); ok(w.log.find(l => l.tx === lk[0].tx_hash).kind === 'fight' ? /open fight/.test(w.log.find(l => l.tx === lk[1].tx_hash).msg) : true, 'open fight locks the gift');
/* 4. batch: each pet on its own */
const batch = [P1[0].id, P1[2].id, P1[3].id, 999999].sort((a, b) => a - b), bt = V.giveBatches(batch, NP);
ok(bt.every(p => p.tag.length <= 34), 'batch tags fit 34 bytes');
const brows = rows.concat(lk, bt.map(p => row(b0 + 22, O, D, p.tag))); w = run(c, S, brows, b0 + 23);
ok(w.byId[P1[0].id].owner === NEW && w.byId[P1[3].id].owner === NEW, 'batch moved the free pets');
ok(w.byId[P1[2].id].owner === O, 'batch skipped the pet in an open fight (still the owner\'s)');
const bl = w.log.filter(l => brows.slice(-bt.length).some(r => r.tx_hash === l.tx)); ok(bl.some(l => /skipped .*#999999 no such pet/.test(l.msg) || /skipped .*open fight/.test(l.msg)), 'skips logged with reasons: ' + bl.map(l => l.msg).join(' | '));
/* 5. packing */
const run70 = []; for (let i = 20000; i < 20070; i++) run70.push(i); const pk = V.giveBatches(run70, 1234);
ok(pk.length === 1 && pk[0].ids.length === 70 && pk[0].tag.length === 34, 'mask form: 70 consecutive pets in one 34-byte burn');
ok(V.giveBatches([5, 900, 3000, 12000, 20001, 20500], 1234)[0].ids.length === 6, 'list form: 6 scattered pets in one burn');
const rt = V.parseTag(pk[0].tag); ok(rt.action === 'gives' && rt.ids.length === 70 && rt.to === 1234, 'mask tag parses back');
ok(V.parseTag('pet:gives:1:5.3').action === 'invalid', 'list ids must ascend');
/* 6. sendBlock mirrors the engine */
ok(V.sendBlock(w, V.givePlan(P1[2].id, NP), b0 + 23, { me: O }) && /open fight/.test(V.sendBlock(w, V.givePlan(P1[2].id, NP), b0 + 23, { me: O })), 'sendBlock blocks a locked gift');
/* 7. swaps */
const sA = P1[0], sB = withGear, sr = rows.concat([ /* after the step-2 rows #withGear is back with O at b0+7; give #P1[0] (O) away to NEW first so the owners differ */
  row(b0 + 30, O, D, 'pet:give:' + sA.id + ':' + PC),
  row(b0 + 40, O, D, 'pet:swap:' + sB.id + ':' + sA.id),            /* offer 1: O's #sB for NEW's #sA */
  row(b0 + 41, NEW2, D, 'pet:swapok:1'),                              /* stranger can't accept */
  row(b0 + 42, O, D, 'pet:give:' + sB.id + ':' + PC),                 /* offered pet is locked for gifts */
  row(b0 + 43, NEW, D, 'pet:swapok:1'),                               /* accept */
  row(b0 + 44, NEW, D, 'pet:swapok:1'),                               /* twice */
  row(b0 + 60, NEW, D, 'pet:swap:' + sB.id + ':' + sA.id),            /* offer 2 back */
  row(b0 + 61, NEW, D, 'pet:swapno:2'),                               /* cancel */
  row(b0 + 62, O, D, 'pet:swapok:2'),
  row(b0 + 70, O, D, 'pet:swap:' + sA.id + ':' + sB.id),              /* offer 3, expires */
  row(b0 + 70 + V.SWAP_WINDOW + 1, NEW, D, 'pet:swapok:3')]);
w = run(c, S, sr, b0 + 70 + V.SWAP_WINDOW + 2); const SL = r => w.log.find(l => l.tx === r.tx_hash), K = sr.length - 11;
ok(SL(sr[K + 1]).kind === 'swapOffer', 'swap offer opens');
ok(/only the owner/.test(SL(sr[K + 2]).msg), 'stranger cannot accept');
ok(/open swap/.test(SL(sr[K + 3]).msg), 'offered pet cannot be gifted meanwhile');
ok(SL(sr[K + 4]).kind === 'swap' && w.byId[sA.id].owner !== NEW, 'accept swaps the owners');
ok(/offer is done/.test(SL(sr[K + 5]).msg), 'accept only once');
ok(SL(sr[K + 7]).kind === 'swapClose' && /cancelled/.test(SL(sr[K + 7]).msg) && /cancelled/.test(SL(sr[K + 8]).msg), 'offerer can cancel; cancelled offer cannot be accepted');
ok(/expired/.test(SL(sr[K + 10]).msg), 'offer expires after ' + V.SWAP_WINDOW + ' blocks');
V._setGiveActivation(null); ok(/later block/.test(V.sendBlock(w, V.givePlan(P1[0].id, NP), b0, { me: O })), 'sendBlock: gate off');
/* 8. HatchBot hook: Legendary / Mythic only, no addresses, disabled */
const HB = require('./hatchbot-gifts'); const fake = { byId: { 1: { name: 'Pep', species: 'pepe', tier: 3, stage: 2 }, 2: { name: 'Woj', species: 'wojak', tier: 0, stage: 1 }, 3: { name: 'Big', species: 'pepe', tier: 1, stage: 5 } },
  giftLog: [{ tx: 'a', petId: 1, tier: 3, block: 5, gear: 2 }, { tx: 'b', petId: 2, tier: 0, block: 6 }, { tx: 'c', petId: 3, tier: 1, block: 7, swap: 1 }, { tx: 'c', petId: 2, tier: 0, block: 7, swap: 1 }], swaps: [{ mine: 3, theirs: 2, doneTx: 'c', doneBlock: 7 }] };
const hm = HB.messages(fake); ok(hm.length === 2 && /Legendary Pep #1/.test(hm[0].text) && /Mythic Big #3/.test(hm[1].text), 'HatchBot: only Legendary/Mythic gifts and swaps');
ok(hm.every(m => HB.guard(m.text) && !/bc1|player/i.test(m.text)), 'HatchBot: texts pass the send-guard, no addresses');
ok(HB.DEFAULT.enabled === false, 'HatchBot hook disabled');
console.log('pet-gift-test: ' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
