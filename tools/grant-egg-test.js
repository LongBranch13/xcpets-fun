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
V._setBurnLordsSnapshot(sm);
const wb = run(c, s, [], tip); wb.pets.filter(p => p.burnLord || p.supreme).forEach(p => ok(/cannot breed/.test(V.breedable(Object.assign({}, p, { stage: 3 }), tip) || ''), p.name + ' unbreedable while the go-live gate is null'));
/* go-live first, grant later (winners known only after judging): no contest pets before CONTEST_GRANT_BLOCK */
V._setContestActivation(tip, W, tip + 3); const wl = run(c, s, [], tip + 2); ok(!wl.pets.some(p => p.contest), 'go-live without grant: no contest pets yet');
ok(wl.pets.filter(p => p.burnLord || p.supreme).every(p => V.breedable(Object.assign({}, p, { stage: 3 }), tip + 2) === null), 'same go-live block: Burn Lords / Kekamozard / Don can breed');
const wl2 = run(c, s, [], tip + 5); ok(wl2.pets.filter(p => p.contest).length === 3 && wl2.pets.filter(p => p.contest).every(p => p.hatchBlock === tip + 3 && p.contest.gate === tip + 3), 'grant fires once at CONTEST_GRANT_BLOCK');
V._setContestActivation(tip + 3, W, tip); ok(!run(c, s, [], tip + 5).pets.some(p => p.contest), 'a grant block before go-live never fires');
V._setContestActivation(tip, W);
const wg = run(c, s, [], tip), G = wg.pets.filter(p => p.burnLord || p.supreme || p.contest);
ok(G.length === 10, '10 grant pets (5 Burn Lords + 2 Supreme + 3 contest): ' + G.length);
['starlordkek', 'gooby', 'lukespam'].forEach((id, i) => { const p = G.find(q => q.contest && q.contest.id === id);
  ok(p && p.owner === W[id] && p.species === id && p.tier === 3 && p.contest.of === 1 && p.contest.place === i + 1 && p.stage === 0, id + ' Legendary 1 of 1 egg to the winner');
  ok(p && V.breederBadges(wg, p).some(b => b.name === '1 of 1'), id + ' has the 1 of 1 badge'); });
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
/* BABIES: no signature parts. contest x contest = one normal random species; contest x normal = the partner's species. Never 1 of 1. */
const CP = id => wf.byId[G.find(p => p.contest && p.contest.id === id).id], N = wf.pets.find(p => !p.dead && !p.released && !p.hybrid && !p.community && /^[a-z]+$/.test(p.species) && !V.isContestSp(p.species) && p.species !== 'nakamoto' && p.species !== 'wizard' && p.species !== 'kek' && p.species !== 'funtrump');
const clone = () => { const ww = JSON.parse(JSON.stringify(wf)); ww.byId = {}; ww.pets.forEach(p => { ww.byId[p.id] = p; }); return ww; };
const sp13 = {}; for (let i = 0; i < 24; i++) { const ww = clone(), kid = V.breedOne(ww, ww.byId[CP('starlordkek').id], ww.byId[CP('gooby').id], fakeHash(END + i), 'test:cc' + i, END, CP('starlordkek').owner);
  ok(kid.stage === 0 && !kid.contest && !kid.burnLord && !kid.supreme && !V.isContestSp(kid.species) && kid.species !== 'nakamoto' && !kid.hybrid, 'contest x contest baby ' + i + ' is a normal pet (' + kid.species + ')'); sp13[kid.species] = 1; }
ok(Object.keys(sp13).length > 1, 'contest x contest babies vary in species (' + Object.keys(sp13).join('/') + ')');
['starlordkek', 'gooby', 'lukespam'].forEach(id => { for (let i = 0; i < 6; i++) { const ww = clone(), kid = V.breedOne(ww, ww.byId[CP(id).id], ww.byId[N.id], fakeHash(END + 50 + i), 'test:cn' + i, END, CP(id).owner);
  ok(kid.species === N.species && !kid.hybrid && !kid.contest, id + ' x ' + N.species + ' baby ' + i + ' = ' + N.species + ' (' + kid.species + ')'); } });
V._setContestActivation(null, null, null); Object.keys(W).forEach(k => { V.CONTEST_TO[k] = null; }); V._setBurnLordsSnapshot(SNAP0);
console.log((fail ? 'FAILED ' : 'ALL PASS ') + pass + ' pass, ' + fail + ' fail');
process.exitCode = fail ? 1 : 0;
