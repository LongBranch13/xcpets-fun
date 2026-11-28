#!/usr/bin/env node
/* FEED PLANS PAY ONLY FOR PETS THAT CAN STILL EAT WHEN THE BURN LANDS (Nov 28 2026).
 *
 * Found by the play-test robot on Evan's 40,000-pet wallet at block 977,883: "Do it all in one burn" said it fed 21,107 pets for
 * 10,917,274.875 XCPETS; the rules fed 20,972. The 135 missing were never-fed hatchlings whose last feed day ended at the next chain-day
 * turn, two blocks later: the planner (and the check before signing) looked at them at the next block only, so the burn paid for meals the
 * rules refused once it landed a block or two late. One more: a living zombie counted as "hungry" (zombies eat pets, never burns), and the
 * check before signing let a single pet:feed at a zombie through.
 * Fix (planner + check before signing only, the replay is unchanged): V2Rules.burnMeal(p, nb) leaves out zombies and every pet that starves
 * before nb + FEED_LAND_BLOCKS, in every feed planner (runs, chores, feed all, pet-number lists); feedSendWhy refuses such a pet in any feed
 * burn (a run's place too: if the burn lands in time it eats a later pet's meal); starveSendWhy refuses other paid burns (gear roll, breed,
 * fight, quest...) naming such a pet.
 * Real chain, any block: a wallet's pet is made to starve soon by moving its last meal back, and a hungry pet is made a zombie.
 *   node --max-old-space-size=9000 tools/feed-landing-test.js [--boot FILE] */
'use strict';
const fs = require('fs'), path = require('path');
const { load, ROOT } = require('./lib/load-rules');
const ARGV = process.argv.slice(2), opt = k => { const i = ARGV.indexOf(k); return i >= 0 ? ARGV[i + 1] : null; };
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const boot = JSON.parse(fs.readFileSync(path.resolve(opt('--boot') || path.join(ROOT, 'api', 'boot.json')), 'utf8'));
const rows = boot.rows.slice().sort((a, b) => a.block_index - b.block_index || a.tx_index - b.tx_index);
const TIP = rows[rows.length - 1].block_index, NB = TIP + 1;
const c = load(), V = c.V2Rules;
if (!V.burnMeal || !V._setFeedLandBlocks) { ok(false, 'V2Rules exports burnMeal and _setFeedLandBlocks'); process.exit(1); }
const w = V.replay(rows, Object.assign({}, c.XCPETS_BLOCK_HASHES || {}, boot.hashes || {}), [], { tip: TIP, live: c.LiveEngine && c.LiveEngine.RealCore, dex: boot.dex });
if (!V.feedRunsOn(NB) || !V.choresOn(NB)) { console.log('skip: feed runs / daily chores not open at block ' + NB); process.exit(0); }
const M = V.FEED_LAND_BLOCKS;
ok(M >= 2, 'a feed burn gets at least 2 blocks to confirm (FEED_LAND_BLOCKS = ' + M + ')');

/* a mid-size wallet with hungry pets that eat */
const eat = {}; w.pets.forEach(p => { if (p.owner && !p.dead && !p.released && V.frEats(p, NB)) eat[p.owner] = (eat[p.owner] || 0) + 1; });
const me = Object.keys(eat).filter(o => eat[o] >= 20 && eat[o] <= 5000).sort((a, b) => eat[b] - eat[a])[0];
if (!me) { console.log('skip: no wallet with 20-5,000 hungry pets'); process.exit(0); }
const ref = V.refList(w, me, TIP, NB), hungry = ref.filter(p => V.frEats(p, NB));
console.log('wallet ' + me.slice(0, 10) + '... at block ' + TIP + ': ' + ref.length + ' pets in its feed list, ' + hungry.length + ' eat');

/* X starves soon: its last feed day ends within the next day. A one-day landing window (144 blocks) always holds a chain-day turn, so the
 * case exists at any tip; it is the same rule as the real 3-block window. */
const X = hungry[Math.floor(hungry.length / 2)], keepX = { lastFed: X.lastFed, clockFrom: X.clockFrom, hatchBlock: X.hatchBlock };
V._setFeedLandBlocks(144);
let L = null; for (let b = TIP; b > TIP - 2000 && L == null; b--) { X.lastFed = b; X.clockFrom = null; if (!V.starvesBy(X, NB) && V.starvesBy(X, NB + 144)) L = b; }
ok(L != null, 'found a last meal (block ' + L + ') after which #' + X.id + ' is alive at the next block but starves within a day');
if (L == null) process.exit(1);
X.lastFed = L;
ok(!V.burnMeal(X, NB) && !V.frEats(X, NB), '#' + X.id + ': no feed burn can pay for it (burnMeal / frEats false)');
const ids = p => [].concat(...p.map(q => q.petIds || (q.petId != null ? [q.petId] : [])));
const dc = V.dailyChoresPlan(w, me, NB, {}), fq = V.feedQueue(w, me, null, NB), fr = V.feedRunsQueue(w, me, null, NB);
ok(dc && !ids(dc.plans).includes(X.id), 'Daily chores ("Do it all in one burn") leaves it out');
ok(!ids(fq).includes(X.id), 'Feed all (feedQueue) leaves it out');
ok(fr && !ids(fr).includes(X.id), 'one-burn feed runs leave it out');
ok(dc.plans.every((p, i) => V.sendBlock(w, p, TIP, { me, pending: dc.plans.slice(0, i).map(q => q.tag) }) === null), 'no false alarm: every chores burn passes the check before signing');

/* the old planner (no landing window) put X in; the check before signing now refuses that burn */
V._setFeedLandBlocks(0);
const old = V.dailyChoresPlan(w, me, NB, {}), oldB = old && old.plans.find(p => (p.petIds || []).includes(X.id));
V._setFeedLandBlocks(144);
ok(!!oldB, 'without the window the planner would pay for #' + X.id + ' (' + (oldB && oldB.tag) + ')');
const why = oldB && V.sendBlock(w, oldB, TIP, { me });
ok(/starves before this burn/.test(why || ''), 'that burn is refused before signing: ' + String(why).slice(0, 120));
const one = V.sendBlock(w, { tag: 'pet:feed:' + X.id, amount: X.nextMeal }, TIP, { me });
ok(/starves before this burn/.test(one || ''), 'a single pet:feed for it is refused too');
const P2 = hungry.find(p => p !== X), sv = (tag, pend) => V._starveSendWhy(w, V.parseTag(tag), me, NB, (pend || []).map(g => V.parseTag(g)));
ok(/starves within/.test(sv('pet:fr:' + X.id) || ''), 'a gear roll naming it is refused (the rules refuse a dead pet)');
ok(/starves within/.test(sv('pet:breed:' + P2.id + ':' + X.id) || '') && /starves within/.test(sv('pet:quest:' + X.id + ':SPAM') || ''), 'a breed or quest naming it is refused');
ok(sv('pet:fr:' + P2.id) === null, 'no false alarm for a pet that does not starve');
const pendFeed = sv('pet:fr:' + X.id, ['pet:feed:' + X.id]);
ok(!/starves/.test(pendFeed || ''), 'not refused for starving while a feed for it is still waiting to confirm');
Object.assign(X, keepX);
V._setFeedLandBlocks(M);

/* a living zombie is "hungry" but eats pets, never burns */
const Z = hungry[Math.floor(hungry.length / 3)], keepZ = Z.zombie;
Z.zombie = { gen: 1, raisedAt: TIP - 10, by: me };
ok(!V.burnMeal(Z, NB) && !V.frEats(Z, NB), 'a living zombie: no feed burn pays for it');
ok(!ids(V.dailyChoresPlan(w, me, NB, {}).plans).includes(Z.id) && !ids(V.feedQueue(w, me, null, NB)).includes(Z.id), 'chores and Feed all leave the zombie out');
Z.zombie = keepZ;
const RZ = w.pets.find(p => p.zombie && !p.zombie.end && !p.dead && !p.released && p.owner), zw = RZ ? V.feedSendWhy(w, V.parseTag('pet:feed:' + RZ.id), RZ.owner, NB, 1e6, []) : 'zombie (none living: skipped)';
ok(/zombie/.test(zw || ''), 'a single pet:feed at a zombie is refused before signing (the rules reject it): ' + zw);
Z.zombie = keepZ;

/* A wallet's FIRST Mythic switches on its Mythic discount in the middle of the burn: its other pets at 21,000+ care turn Mythic (meals refused),
 * the rest get other meal sizes, and its feed list shrinks under the next runs burns (chores-discard-test on main, Nov 28 2026: 55 planned, 14
 * fed, 2 burns "no pets at those places"). The trigger pet is fed alone. */
if (V.mythicDiscountOn && V.mythicDiscountOn(NB)) {
  const own = {}; w.pets.forEach(p => { if (p.owner && !p.dead && !p.released && V.frEats(p, NB)) (own[p.owner] = own[p.owner] || []).push(p); });
  const fresh = Object.keys(own).filter(o => !(w.mythicOwners && w.mythicOwners[o] != null) && own[o].length >= 5 && own[o].length <= 3000).sort((a, b) => own[b].length - own[a].length)[0];
  if (!fresh) console.log('skip first Mythic: no wallet without a Mythic and with 5+ hungry pets');
  else {
    const T = own[fresh].find(p => !p.ascended && V.petThresholds(w, p, NB)[5] > 21000 && !V.firstMythicPets(w, fresh, [p], NB).length), keepT = { care: T && T.care, got: w.mythicGot && T && w.mythicGot[T.id] };
    if (T) { const th = V.petThresholds(w, T, NB); T.care = th[5] - 1; if (w.mythicGot) delete w.mythicGot[T.id]; } /* raised by its owner (no bought-Mythic record) */
    const trig = T ? V.firstMythicPets(w, fresh, own[fresh], NB) : [];
    ok(trig.length >= 1, 'a pet one meal from Mythic in a wallet with no Mythic yet is a first-Mythic trigger (#' + (T && T.id) + ')');
    if (trig.length) {
      const one = trig.sort((a, b) => a.id - b.id)[0].id, P = V.dailyChoresPlan(w, fresh, NB, {}), q = V.feedQueue(w, fresh, null, NB), r = V.feedRunsQueue(w, fresh, null, NB);
      ok(P && ids(P.plans).length === 1 && ids(P.plans)[0] === one && P.parts.firstMythic === one, 'Daily chores feeds only #' + one + ' and says it is the first Mythic (' + (P && P.parts.waiting) + ' wait)');
      ok(ids(q).length === 1 && ids(q)[0] === one, 'Feed all feeds only #' + one);
      ok(r && ids(r).length === 1 && r[0].firstMythic === one, 'feed runs feed only #' + one + ' (' + (r && r[0].label) + ')');
      const both = V.feedRunsPlan(w, fresh, own[fresh], NB);
      ok(ids(both).length === 1, 'feedRunsPlan given every hungry pet still feeds the trigger alone');
      const many = own[fresh].filter(p => V.burnMeal(p, NB)).slice(0, 2).concat(T).map(p => p.id);
      const fl = V.feedPlan(own[fresh].filter(p => many.includes(p.id)), true)[0]; /* pet-number windows (pet:fm) */
      const fw = fl && V.sendBlock(w, fl, TIP, { me: fresh });
      ok(fl && (fl.petIds || []).length > 1 ? /first Mythic/.test(fw || '') : true, 'a pet-number feed of the trigger plus others is refused before signing: ' + String(fw).slice(0, 110));
      const wait = V.sendBlock(w, { tag: 'pet:feed:' + own[fresh].find(p => p.id !== one && V.burnMeal(p, NB)).id, amount: 1e6 }, TIP, { me: fresh, pending: ['pet:feed:' + one] });
      ok(/still confirming/.test(wait || ''), 'another feed waits while the first-Mythic feed confirms: ' + String(wait).slice(0, 100));
    }
    if (T) { T.care = keepT.care; if (w.mythicGot) { if (keepT.got) w.mythicGot[T.id] = keepT.got; else delete w.mythicGot[T.id]; } }
  }
}

console.log(fails ? fails + ' FAILED' : 'all passed');
process.exit(fails ? 1 : 0);
