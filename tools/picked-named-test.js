#!/usr/bin/env node
/* PICKED PETS = NAMED PETS, for EVERY burn that names pets by their place in a list (Nov 25 2026 root-cause pass).
 *
 * Why: a "runs" burn (pet:hd/hu discard, pet:ut/rw spins, pet:fr feed, pet:dc chores, pet:pp/px pantry, pet:zr/ar/sr/rr cemetery) does
 * not carry pet numbers. It says "places 3-9 and 12 in your list". The page counts that list on ITS copy of the world; the rules count it
 * on the full chain world. Four bugs on Nov 25 2026 were this one mistake:
 *   - PR 289 (G Money, 68 keepers discarded): the rules' list held a dead Mythic the page never loaded -> every place moved by one.
 *   - PR 288 (G Money, 5,267 XCPETS): a discard confirming just before a feed run moved the feed's places.
 *   - PR 284 / PR 295: screens judged "discarded" on their own copy (browser list only) -> picked pets the rules would not take.
 * The fix: before anything is signed, the checker (full world) reads every runs burn the way the rules will (V2Rules.runTargets) and
 * refuses it when those pets are not the pets the page picked (V2Rules.pickedIds / pickWant). This test proves it for every runs burn
 * type, on the real chain, against the three ways a page's list goes out of step:
 *   A. no false alarms: plans made on the full world pass;
 *   B. a pet the page never loaded (fast pages stitch partial files) -> each burn is either still exact or refused before signing;
 *   C. a page world without graves (PR 289's dead Mythic) -> same;
 *   D. another of my burns lands first (PR 288: a discard of an earlier place) -> the rules still read the places the page meant.
 *   E. a discard still waiting to confirm: no feed (single or run) may pay for a pet it names.
 * The server form (only want text travels, tools/sync-server/checker.js) is checked too.
 *   node --max-old-space-size=9000 tools/picked-named-test.js [--boot FILE] */
'use strict';
const fs = require('fs'), path = require('path');
const { load, ROOT } = require('./lib/load-rules');
const ARGV = process.argv.slice(2), opt = k => { const i = ARGV.indexOf(k); return i >= 0 ? ARGV[i + 1] : null; };
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const boot = JSON.parse(fs.readFileSync(path.resolve(opt('--boot') || path.join(ROOT, 'api', 'boot.json')), 'utf8'));
const rows = boot.rows.slice().sort((a, b) => a.block_index - b.block_index || a.tx_index - b.tx_index);
const TIP = rows[rows.length - 1].block_index, NB = TIP + 1;
const c = load(), V = c.V2Rules;
if (!V.runTargets || !V.pickedIds) { ok(false, 'V2Rules exports runTargets and pickedIds'); process.exit(1); }
const w = V.replay(rows, Object.assign({}, c.XCPETS_BLOCK_HASHES || {}, boot.hashes || {}), [], { tip: TIP, live: c.LiveEngine && c.LiveEngine.RealCore, dex: boot.dex });
if (!V.feedRunsOn(NB) || !V.cemRunsOn(NB) || !V.hdOn(NB)) { console.log('skip: runs burns are not all open at block ' + NB); process.exit(0); }

/* a mid-size wallet with hungry pets in its feed list (fast to plan, every list non-trivial) */
const eat = {}; w.pets.forEach(p => { if (p.owner && !p.dead && !p.released && V.frEats(p, NB)) eat[p.owner] = (eat[p.owner] || 0) + 1; });
const ME = Object.keys(eat).filter(o => eat[o] >= 50 && eat[o] <= 5000).map(o => [o, V.refList(w, o, TIP, NB).length]).filter(x => x[1] >= 100).sort((a, b) => (V.spinsLeft(w, b[0], NB) > 0) - (V.spinsLeft(w, a[0], NB) > 0) || b[1] - a[1])[0];
/* Nov 28 2026: prefer a wallet with saved spins, so the pet:ut (saved spins) burns are planned too. At tip 977,892 the biggest wallet had 0 spins
 * left, no pet:ut plan existed and check D "gate off moves a saved-spin burn" failed on main with nothing to move. */
if (!ME) { console.log('skip: no wallet with 50-5,000 hungry pets in its feed list'); process.exit(0); }
const me = ME[0];
console.log('wallet ' + me.slice(0, 10) + '... at block ' + TIP + ': ' + ME[1] + ' pets in its feed list, ' + eat[me] + ' hungry');
const zombie = w.pets.find(p => p.zombie && !p.zombie.end), grave = w.pets.find(p => p.dead && !p.zombie);

const same = (a, b) => V.pickWant(a) === V.pickWant(b);
const live = x => V.refList(x, me, x.tip, NB);
/* every runs planner the pages use, on a given world x (picks spread over the wallet's list so a shift shows) */
function plans(x) {
  const L = live(x), spread = L.filter((p, i) => i % 7 === 3).slice(0, 40).map(p => p.id), hun = L.filter(p => V.frEats(p, NB)).slice(0, 60).map(p => p.id);
  const out = {}, add = (k, ps) => { if (ps && ps.length) out[k] = ps; };
  const hd = V.hdPlan(x, me, spread, NB); add('pet:hd (discard)', hd && hd.plans);
  const sp = V.spinTargetPlans ? V.spinTargetPlans(x, me, spread, spread.length, NB) : null; add('pet:ut (saved spins)', sp && (sp.plans || sp));
  add('pet:fr (feed run)', V.feedRunsQueue(x, me, hun, NB));
  const dc = V.dailyChoresPlan ? V.dailyChoresPlan(x, me, NB, { ids: hun }) : null; add('pet:dc (daily chores)', dc && dc.plans.filter(p => /^pet:dc:/.test(p.tag)));
  const pp = V.pantryOn && V.pantryOn(NB) ? V.pantryPlan(x, me, { add: spread }) : null; add('pet:pp (pantry list)', pp && pp.plans);
  if (zombie) { add('pet:zr (zombie meal)', V.cemRunsPlan(x, 'zfeed', zombie.id, spread, me, NB)); add('pet:rr (zombie re-roll)', V.cemRunsPlan(x, 'rpl', zombie.id, spread, me, NB)); }
  if (grave) { add('pet:ar (altar offering)', V.cemRunsPlan(x, 'pledge', grave.id, spread, me, NB)); add('pet:sr (seance)', V.cemRunsPlan(x, 'seance', grave.id, spread, me, NB)); }
  return out; }
const tag = p => V.parseTag(p.tag);
const named = (p, x) => V.runTargets(x || w, me, tag(p), NB, []);
const DIFF = /different pets/;

/* A. plans made on the full world: the rules read exactly the picked pets, and the check never cries wolf */
const full = plans(w), kinds = Object.keys(full);
ok(kinds.length >= 8, kinds.length + ' runs burn types planned (' + kinds.join(', ') + ')');
kinds.forEach(k => { const bad = full[k].filter(p => { const g = named(p); return !g || !same(g, V.pickedIds(p)); });
  const cry = full[k].filter(p => DIFF.test(V.sendBlock(w, p, TIP, { me }) || '') || DIFF.test(V.sendBlock(w, { tag: p.tag, amount: p.amount, want: V.pickWant(V.pickedIds(p)) }, TIP, { me }) || ''));
  ok(!bad.length && !cry.length, 'A ' + k + ': ' + full[k].length + ' burn(s) on the full world name exactly the picked pets' + (bad.length || cry.length ? ' (' + bad.length + ' differ, ' + cry.length + ' false alarms)' : '')); });

/* B / C: plan on a page world that is out of step, judge on the full world */
function pageWorld(drop) { const pets = w.pets.filter(p => !drop(p)), byId = {}; pets.forEach(p => { byId[p.id] = p; }); return Object.assign({}, w, { pets, byId }); }
function outOfStep(label, x) { const pl = plans(x); let shifted = 0, kindsShifted = 0;
  Object.keys(pl).forEach(k => { let n = 0, leak = 0;
    pl[k].forEach(p => { const g = named(p); if (g && same(g, V.pickedIds(p))) return; n++;
      const why = V.sendBlock(w, p, TIP, { me }), whyS = V.sendBlock(w, { tag: p.tag, amount: p.amount, want: V.pickWant(V.pickedIds(p)) }, TIP, { me });
      if (!DIFF.test(why || '') || !DIFF.test(whyS || '')) leak++; }); /* refused BY this check: another check refusing it is luck (a shift onto pets that also qualify passes those) */
    if (n) kindsShifted++; shifted += n;
    ok(!leak, label + ' ' + k + ': ' + (n ? n + ' burn(s) would land on other pets, all refused before signing' : 'still exact') + (leak ? ' (' + leak + ' NOT refused as a shifted list: real XCPETS / pets at risk)' : '')); });
  return kindsShifted; }
const first = live(w)[0];
const kB = outOfStep('B (page never loaded #' + first.id + ')', pageWorld(p => p.id === first.id));
ok(kB >= 6, 'B: the missing pet moved ' + kB + ' burn types (the check is really exercised)');
const deadMine = w.pets.some(p => p.owner === me && p.dead && !(p.zombie && !p.zombie.end));
outOfStep('C (page without graves' + (deadMine ? '' : ', none in this wallet') + ')', pageWorld(p => p.dead && !(p.zombie && !p.zombie.end)));

/* D: another of my burns confirms first, in the same block (PR 288): something happens to the wallet's first listed pet at block NB, and
 * every other burn planned at the tip must still read the places the page meant (the lists read each pet as it was at the anchor). */
const D = plans(w), pre = live(w).find(p => !p.hd && !p.released);
function landsFirst(label, set) { const keep = { hd: pre.hd, hdH: pre.hdH, released: pre.released }; set(pre); const movedK = {}; let moved = 0;
  Object.keys(D).forEach(k => { D[k].forEach(p => { const g = named(p); if (!g || !same(g, V.pickedIds(p).filter(id => id !== pre.id))) { moved++; movedK[k] = 1; } }); });
  ['hd', 'hdH', 'released'].forEach(f => { if (keep[f] === undefined) delete pre[f]; else pre[f] = keep[f]; });
  return { moved, kinds: Object.keys(movedK) }; }
const discard = p => { p.hdH = (p.hdH || []).concat([[NB, p.hd || null]]); p.hd = me; }, release = p => { p.released = NB; };
const SG = V.ACTIVATE_SPIN_HD_ANCHOR_BLOCK;
ok(typeof SG === 'number' && SG > TIP || V.spinHdAnchorOn(NB), 'spin-list anchor gate ' + SG + (SG > TIP ? ' is after the replayed chain (replay unchanged)' : ' is on'));
V._setSpinHdAnchorActivation(null);
const off = landsFirst('discard', discard);
if (!D['pet:ut (saved spins)']) console.log('skip D gate off: wallet ' + me.slice(0, 10) + '... has no saved spins, so no pet:ut burn to move (no wallet in range has spins)');
else ok(off.kinds.length === 1 && off.kinds[0] === 'pet:ut (saved spins)', 'D gate off: a discard of #' + pre.id + ' landing first moved ' + off.moved + ' saved-spin burn(s) (the bug: ' + off.kinds.join(', ') + ')');
V._setSpinHdAnchorActivation(Math.min(NB, SG));
[['a discard', discard], ['a release', release]].forEach(([l, f]) => { const r = landsFirst(l, f);
  ok(r.moved === 0, 'D: ' + l + ' of #' + pre.id + ' landing first moves no other burn\'s places (' + r.moved + ' moved' + (r.moved ? ': ' + r.kinds.join(', ') : '') + ')'); });
V._setSpinHdAnchorActivation(SG);

/* E: a discard still waiting to confirm (PR 284 / 288): no feed may pay for a pet it names, whatever screen built the feed */
const hungry = live(w).filter(p => V.frEats(p, NB) && !p.hd).slice(0, 3), hdp = V.hdPlan(w, me, hungry.map(p => p.id), NB), hdTag = hdp && hdp.plans[0] && hdp.plans[0].tag;
if (hdTag && hungry.length) { const one = V.feedQueue(w, me, [hungry[0].id], NB)[0], fr = V.feedRunsQueue(w, me, hungry.map(p => p.id), NB);
  const w1 = one && V.sendBlock(w, one, TIP, { me, pending: [hdTag] }), w2 = fr && V.sendBlock(w, fr[0], TIP, { me, pending: [hdTag] });
  ok(one && V.sendBlock(w, one, TIP, { me, pending: [] }) === null, 'E: feeding #' + hungry[0].id + ' passes the check with no discard waiting');
  ok(/being discarded/.test(w1 || ''), 'E: a pet:feed of a pet named by a waiting pet:hd is refused (' + w1 + ')');
  ok(/being discarded/.test(w2 || ''), 'E: a feed run for pets named by a waiting pet:hd is refused (' + w2 + ')'); }
else ok(false, 'E: could plan a discard and a feed of hungry pets');

/* the guard reads the rules' own lists: no page-side copy of the place counting */
const src = fs.readdirSync(path.join(ROOT, 'js')).filter(f => /\.js$/.test(f) && f !== 'v2-rules.js').filter(f => /\b(frDecode|frVar)\s*\(/.test(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8')));
ok(!src.length, 'no page script decodes or builds run places itself (' + (src.join(', ') || 'none') + ')');
console.log(fails ? fails + ' failed' : 'all passed'); process.exit(fails ? 1 : 0);
