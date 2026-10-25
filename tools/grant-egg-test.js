#!/usr/bin/env node
/* GIVEAWAY EGG RULE test (owner Oct 25 2026, branch contest-eggs, dev only; synthetic burns, nothing broadcast).
 * Rule: EVERY grant / edition / giveaway pet must GROW (all stages), BREED, FIGHT and HOLD THINGS (equip gear) after its gate.
 * Covers: Burn Lords 1-5, Lord Kekamozard, Don Kekamoto, Star-Lord Kek, Gooby, Luke Spam Junior.
 * Gates are set with the test setters (_setBurnLordsSnapshot / _setContestActivation / _setGrantBreedActivation) and restored at the end.
 *   node tools/grant-egg-test.js */
'use strict';
const { load, row, snap, run, fakeHash } = require('./lib/load-rules');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const c = load(), V = c.V2Rules, s0 = snap(), H = Object.assign({}, c.XCPETS_BLOCK_HASHES, s0.hashes);
const tip = Math.max.apply(null, s0.rows.map(r => r.block_index).filter(b => H[b]));
const sm = s0.rows.filter(r => r.block_index < tip).reduce((m, r) => Math.max(m, r.block_index), 0);
const s = { tip, rows: s0.rows.filter(r => r.block_index <= tip), hashes: Object.assign({}, s0.hashes) };
const DAY = 144, END = tip + DAY * 14; for (let b = tip + 1; b <= END + 10; b++) if (!H[b]) s.hashes[b] = fakeHash(b);
const W = { starlordkek: 'bc1qcontestwinner1xxxxxxxxxxxxxxxxxxxxxxx', gooby: 'bc1qcontestwinner2xxxxxxxxxxxxxxxxxxxxxxx', lukespam: 'bc1qcontestwinner3xxxxxxxxxxxxxxxxxxxxxxx' };
const SNAP0 = V.burnLordsSnapshot();
/* gates OFF: old rules hold (contest inert, editions unbreedable) */
const w0 = run(c, s, [], tip); ok(!w0.pets.some(p => p.contest), 'contest gate null: no contest pets');
V._setBurnLordsSnapshot(sm); V._setContestActivation(tip, W);
const wg = run(c, s, [], tip), G = wg.pets.filter(p => p.burnLord || p.supreme || p.contest);
ok(G.length === 10, '10 grant pets (5 Burn Lords + 2 Supreme + 3 contest): ' + G.length);
['starlordkek', 'gooby', 'lukespam'].forEach((id, i) => { const p = G.find(q => q.contest && q.contest.id === id);
  ok(p && p.owner === W[id] && p.species === id && p.tier === 3 && p.contest.of === 1 && p.contest.place === i + 1 && p.stage === 0, id + ' Legendary 1 of 1 egg to the winner');
  ok(p && V.breederBadges(wg, p).some(b => b.name === '1 of 1'), id + ' has the 1 of 1 badge'); });
G.forEach(p => ok(/cannot breed/.test(V.breedable(Object.assign({}, p, { stage: 3 }), tip) || ''), (p.name || p.species) + ' unbreedable while the grant-breed gate is null'));
V._setGrantBreedActivation(tip);
/* GROW: one real PET:FEED per day from the owner, through the normal rules, Egg -> Mythic */
const feeds = []; G.forEach(p => { for (let d = 0; d < 13; d++) feeds.push(row(tip + 1 + d * DAY, p.owner, 1e6, 'PET:FEED:' + p.id)); });
const wf = run(c, s, feeds, END);
G.forEach(e => { const h = wf.byId[e.id], nm = e.name || e.species;
  ok(h && h.stage === 5, nm + ' grows to Mythic by normal feeding (stage ' + (h && h.stage) + ')');
  ok(h && h.species === e.species && h.tier === e.tier && JSON.stringify(h.contest || h.supreme || h.burnLord) === JSON.stringify(e.contest || e.supreme || e.burnLord), nm + ' keeps its fixed outcome');
  /* BREED: breedable after the gate (normal cap / cooldown still apply) */
  ok(h && V.breedable(h, END) === null, nm + ' can breed after the gate (' + (h && V.breedable(h, END)) + ')');
  /* FIGHT */
  ok(h && V.fightable(h, END) === null, nm + ' can fight (' + (h && V.fightable(h, END)) + ')');
  /* HOLD THINGS: at least one piece per open slot kind is eligible for its species/body */
  const ids = [].concat(...['BANDS', 'ARMORS', 'CAPES', 'WEAPONS', 'CROWNS'].map(k => (c.PetCore[k] || []).map(x => x.id)), (c.BonusGear.ITEMS || []).map(x => x.id), (c.V2Gear.ITEMS || []).map(x => x.id)), items = ids.map(i => V.itemOf(i)).filter(Boolean);
  const slots = {}; items.forEach(it => { if (V.eligible(it, h.species, V.bodyOf ? V.bodyOf(h) : null, h.tier)) slots[it.slot] = 1; });
  ok(['head', 'face', 'body', 'hand'].every(k => slots[k]), nm + ' can equip head/face/body/hand gear (' + Object.keys(slots).join('/') + ')'); });
/* REAL BREED: two contest pets (different owners -> owner A breeds with own pet pair; use two pets of the same owner by gifting is out of scope),
 * so breed Star-Lord Kek with a Burn Lord of the same draft world by moving ownership in a clone: check the baby rule is a contest blend, not 1 of 1. */
const A = wf.byId[G.find(p => p.contest && p.contest.id === 'starlordkek').id], B = wf.byId[G.find(p => p.contest && p.contest.id === 'gooby').id];
if (V.breedOne) { const ww = JSON.parse(JSON.stringify(wf)); ww.byId = {}; ww.pets.forEach(p => { ww.byId[p.id] = p; });
  const kid = V.breedOne(ww, ww.byId[A.id], ww.byId[B.id], fakeHash(END), 'test:breed', END, A.owner);
  ok(kid && kid.stage === 0 && !kid.contest && !kid.burnLord && !kid.supreme, 'baby is an egg and never gets the 1 of 1 edition');
  ok(kid && kid.contestHyb && ['starlordkek', 'gooby'].indexOf(kid.contestHyb.body) >= 0 && kid.contestHyb.donor !== kid.contestHyb.body, 'baby = contest body from one parent, signature part from the other (' + JSON.stringify(kid && kid.contestHyb) + ')'); }
else ok(false, 'V.breedOne exported');
V._setGrantBreedActivation(null); V._setContestActivation(null); Object.keys(W).forEach(k => { V.CONTEST_TO[k] = null; }); V._setBurnLordsSnapshot(SNAP0);
console.log((fail ? 'FAILED ' : 'ALL PASS ') + pass + ' pass, ' + fail + ' fail');
process.exitCode = fail ? 1 : 0;
