#!/usr/bin/env node
/* One-tx feed (pet:fa / pet:fx, FEED_ALL_BLOCK). Uses the repo's api/boot.json rows (live chain data) cut before block 973,358,
 * i.e. before bc1qs88…j6n needed ~40 separate pet:fl/pet:fm burns to feed one day. */
'use strict';
const fs = require('fs'), path = require('path'), L = require('./lib/load-rules');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('ok   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const B = JSON.parse(fs.readFileSync(path.join(L.ROOT, 'api', 'boot.json'), 'utf8')), CUT = 973357, ME = 'bc1qs88hlk930p8l6h5s2svcrvzd45ny2pn54y0j6n';
const s = { rows: B.rows.filter(r => r.block_index <= CUT), hashes: B.hashes };
function world(gate, extra, tip) { const c = L.load(); c.V2Rules._setFeedAllActivation(gate); return { c, w: L.run(c, s, extra || [], tip || CUT) }; }
const T = 973400;
// parse
{ const c = L.load(), V = c.V2Rules;
  ok(V.parseTag('pet:fa').action === 'feeda', 'pet:fa parses'); ok(V.parseTag('pet:fx:1CVJ.1CVO').ex.join() === '46067,46072', 'pet:fx parses base-32 exclusions');
  ok(V.parseTag('pet:fx:1CVO.1CVJ').action === 'invalid', 'pet:fx descending is invalid'); ok(V.parseTag('pet:fa:1').action === 'invalid', 'pet:fa with extra field is invalid'); }
// plan: one burn for the whole wallet
const a = world(T - 1, [], T - 1), V = a.c.V2Rules, hungry = a.w.pets.filter(p => p.owner === ME && p.hungry);
const plans = V.feedQueue(a.w, ME, null, T);
ok(plans.length === 1 && plans[0].tag === 'pet:fa', 'Feed all hungry -> ONE burn pet:fa (' + hungry.length + ' hungry pets)');
const amt = plans[0].amount; ok(Math.abs(amt - hungry.reduce((x, p) => x + p.nextMeal, 0)) < 1e-6, 'amount = exact sum of meals ' + amt);
const oldPlans = (() => { const c = world(1e9, [], T - 1); return c.c.V2Rules.feedQueue(c.w, ME, null, T).length; })();
ok(oldPlans > 1, 'before the gate the same wallet needs ' + oldPlans + ' burns');
// replay the one burn after the gate
const r1 = L.row(T, ME, amt, 'pet:fa'), b = world(T - 1, [r1], T + 1), fed = (b.w.log || []).find(l => l.tx === r1.tx_hash && (l.kind === 'feed' || l.kind === 'rejected'));
ok(fed && fed.kind === 'feed' && fed.petIds.length === hungry.length, 'pet:fa fed all ' + hungry.length + ' pets in one tx (' + (fed && fed.msg.slice(0, 60)) + ')');
// selected subset -> pet:fx
const pick = hungry.slice(0, hungry.length - 3), px = V.feedQueue(a.w, ME, pick.map(p => p.id), T);
ok(px.length === 1 && /^pet:fx:/.test(px[0].tag) && px[0].tag.length <= 34, 'Feed selected (all but 3) -> ONE burn ' + (px[0] && px[0].tag));
const r2 = L.row(T, ME, px[0].amount, px[0].tag), c2 = world(T - 1, [r2], T + 1), f2 = (c2.w.log || []).find(l => l.tx === r2.tx_hash && (l.kind === 'feed' || l.kind === 'rejected'));
ok(f2 && f2.petIds.join() === pick.map(p => p.id).sort((x, y) => x - y).join(), 'pet:fx fed exactly the selected pets');
// before the gate: community food only, nothing fed
const r3 = L.row(T, ME, amt, 'pet:fa'), d = world(T + 5, [r3], T + 1), f3 = (d.w.log || []).find(l => l.tx === r3.tx_hash && (l.kind === 'feed' || l.kind === 'rejected'));
ok(!f3 || f3.kind !== 'feed', 'before FEED_ALL_BLOCK pet:fa is not a feed (' + (f3 ? f3.kind + ': ' + f3.msg : 'no log') + ')');
// short burn: pets in id order, the rest skipped
const r4 = L.row(T, ME, amt / 2, 'pet:fa'), e = world(T - 1, [r4], T + 1), f4 = (e.w.log || []).find(l => l.tx === r4.tx_hash && (l.kind === 'feed' || l.kind === 'rejected'));
ok(f4 && f4.kind === 'feed' && f4.petIds.length > 0 && f4.petIds.length < hungry.length, 'half-paid pet:fa feeds a prefix and skips the rest (' + (f4 && f4.petIds.length) + ')');
// skip discarded: the UI passes only non-discarded hungry pets; discarded hungry pets go in the pet:fx exclusion list, else explicit-list burns
{ const disc = hungry.slice(10, 13).map(p => p.id), keep = hungry.filter(p => disc.indexOf(p.id) < 0), q = V.feedQueue(a.w, ME, keep.map(p => p.id), T);
  ok(q.length === 1 && V.parseTag(q[0].tag).ex.join() === disc.slice().sort((x, y) => x - y).join(), 'feed all minus 3 discarded -> ONE pet:fx excluding them (' + q[0].tag + ')');
  const r = L.row(T, ME, q[0].amount, q[0].tag), z = world(T - 1, [r], T + 1), f = z.w.log.find(l => l.tx === r.tx_hash && (l.kind === 'feed' || l.kind === 'rejected'));
  ok(f && f.petIds.length === keep.length && !f.petIds.some(id => disc.indexOf(id) >= 0), 'no discarded pet fed (' + keep.length + ' fed)');
  // ANY discard set -> on-chain feed-skip set. Big new discard sets need one-time pet:sk burns, then every feed is ONE pet:fa.
  const rnd = (k => () => (k = (k * 1103515245 + 12345) % 2147483648) / 2147483648)(7);
  const runPlans = (qs, blk) => qs.map(x => L.row(blk, ME, x.amount, x.tag));
  for (const [name, discN] of [['half (every 2nd)', -1], ['300 random', 300], ['1,000 random', 1000], ['5 random', 5]]) {
    const disc = new Set(discN < 0 ? hungry.filter((p, i) => i % 2 === 0).map(p => p.id) : hungry.map(p => p.id).sort(() => rnd() - 0.5).slice(0, discN));
    const keep = hungry.filter(p => !disc.has(p.id)), q = V.feedQueue(a.w, ME, keep.map(p => p.id), T), feeds = q.filter(x => !x.setOnly);
    ok(feeds.length === 1 && q.every(x => x.tag.length <= 34), name + ' discarded (' + disc.size + '): ONE feed burn + ' + (q.length - 1) + ' one-time skip burns');
    const rows = runPlans(q, T), z = world(T - 1, rows, T + 1), fl = z.w.log.filter(l => rows.some(r => r.tx_hash === l.tx) && l.kind === 'feed'), fedIds = [].concat(...fl.map(l => l.petIds));
    ok(fedIds.length === keep.length && !fedIds.some(id => disc.has(id)), name + ': fed exactly the ' + keep.length + ' kept pets, no discarded pet');
    // next day, same discards: ONE pet:fa
    const z2 = world(T - 1, rows, T + 150), keep2 = z2.w.pets.filter(p => p.owner === ME && p.hungry && !disc.has(p.id)), q3 = V.feedQueue(z2.w, ME, keep2.map(p => p.id), T + 151);
    ok(q3.length === 1 && q3[0].tag === 'pet:fa', name + ': next day feed = ONE burn ' + (q3[0] && q3[0].tag) + ' (' + keep2.length + ' pets)');
    if (discN === 300) { // change mind about 4 pets: un-discard -> ONE pet:fy
      const back = [...disc].slice(0, 4), keep3 = keep2.concat(z2.w.pets.filter(p => back.includes(p.id) && p.hungry)), q4 = V.feedQueue(z2.w, ME, keep3.map(p => p.id), T + 151);
      ok(q4.length === 1 && /^pet:fy:/.test(q4[0].tag), 'un-discard 4 pets -> ONE burn ' + q4[0].tag);
      const r4 = runPlans(q4, T + 151), z4 = world(T - 1, rows.concat(r4), T + 152), f4 = z4.w.log.find(l => l.tx === r4[0].tx_hash);
      ok(f4 && f4.kind === 'feed' && f4.petIds.length === keep3.length, 'pet:fy fed ' + (f4 && f4.petIds.length) + ' incl. the 4 re-included'); }
  }
  // transfer clears the skip; sk is invalid before the gate (replay stays SAME)
  ok(V.parseTag('pet:sk:100:V').action === 'skip' && V.parseTag('pet:su:1.2').un === true, 'pet:sk / pet:su parse');
  { const r = L.row(T, ME, 1, 'pet:sk:' + hungry[0].id.toString(32).toUpperCase()), z = world(T + 5, [r], T + 1); ok(!z.w.pets.find(p => p.id === hungry[0].id).skipBy, 'pet:sk before FEED_ALL_BLOCK does nothing'); }
}
console.log(pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
