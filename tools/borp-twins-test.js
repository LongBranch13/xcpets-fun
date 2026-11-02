#!/usr/bin/env node
/* BO PIGEON + TWINS ALIKE tests (branch borp-twins, owner Oct 31 2026 9:49 AM CT, PREVIEW). Both gates null on main (tested via _setBorp / _setTwinAlike).
 * Bo Pigeon: a Bo Jackson times Rarepigeon baby gets species 'borp' (looks only: same tier / stats / name / marks as with the gate off), renders every stage + gear,
 * breeds like a 1 of 1. Twins alike: twin odds unchanged, the first egg unchanged, the twin copies its sibling's body and differs in stats by -1/0/+1 and one look detail.
 * node tools/borp-twins-test.js */
'use strict';
const { load, snap, run, fakeHash } = require('./lib/load-rules');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const c = load(['js/kek-sprite.js', 'js/wizard-sprite.js', 'js/funtrump-sprite.js', 'js/homer-sprite.js', 'js/viking-sprite.js', 'js/bo-sprite.js', 'js/rarepigeon-sprite.js', 'js/contest-sprite.js']), _vr = (c.setInterval = () => 0, c.document.readyState = 'loading', c.clearInterval = () => {}, c.requestAnimationFrame = () => 0, c.ImageData = c.ImageData || function (d, w, h) { this.data = d; this.width = w; this.height = h; }, require('vm').runInContext(require('fs').readFileSync(require('path').join(__dirname, '../js/v2-render.js'), 'utf8'), c)), V = c.V2Rules, P = c.PetCore, K = P.STAT_KEYS, R = c.V2Render, s0 = snap(), H = Object.assign({}, c.XCPETS_BLOCK_HASHES, s0.hashes);
ok(V.borpGate() === 974207 && V.ACTIVATE_BORP_BLOCK === 974207 && !V.borpOn(974206) && V.borpOn(974207), 'Bo Pigeon gate 974207 (go-live)'); ok(V.twinAlikeGate() === 974207 && V.ACTIVATE_TWIN_ALIKE_BLOCK === 974207 && !V.twinAlikeOn(974206), 'twins-alike gate 974207 (go-live)');
const tip = Math.max.apply(null, s0.rows.map(r => r.block_index).filter(b => H[b])), s = { tip, rows: s0.rows.filter(r => r.block_index <= tip), hashes: s0.hashes };
V._setBo(Math.min(V.ACTIVATE_BO_BLOCK, tip)); V._setRp(Math.min(V.ACTIVATE_RP_BLOCK, tip));
const w = run(c, s, [], tip), END = Math.max(tip, V.ACTIVATE_RP_BLOCK) + 400; for (let x = tip + 1; x <= END + 3000; x++) if (!s.hashes[x] && !H[x]) s.hashes[x] = fakeHash(x);
const bo = w.pets.find(p => p.species === 'bojackson'), rp = w.pets.find(p => p.species === 'rarepigeon'); ok(bo && rp, 'Bo + Rarepigeon in the world');
const wb = JSON.parse(JSON.stringify(w)); wb.byId = {}; wb.pets.forEach(p => { wb.byId[p.id] = p; }); [bo.id, rp.id].forEach(id => { wb.byId[id].stage = 3; wb.byId[id].care = 999; });
const wbRest = JSON.stringify(Object.assign({}, wb, { pets: undefined, byId: undefined }));
/* fast clone: every non-pet field deep-copied, pets copied on demand (the bred parents), the rest shared read-only */
const clone = (ids) => { const ww = JSON.parse(wbRest); ww.pets = wb.pets.slice(); ww.byId = Object.assign({}, wb.byId); (ids || []).forEach(id => { const q = JSON.parse(JSON.stringify(wb.byId[id])); ww.byId[id] = q; ww.pets[ww.pets.indexOf(wb.byId[id])] = q; }); return ww; };
const live = wb.pets.filter(p => !p.dead && !p.released && !p.community && !p.supreme && !p.burnLord && !p.contest && p.species !== 'bojackson' && p.species !== 'rarepigeon');
const strip = k => { const o = JSON.parse(JSON.stringify(k)); delete o.species; delete o.art.species; return JSON.stringify(o); };
/* ---------- BO PIGEON ---------- */
const borps = [];
for (let i = 0; i < 12; i++) { const order = i % 2 ? [rp.id, bo.id] : [bo.id, rp.id], bh = fakeHash(END + i), tx = 'test:borp' + i;
  V._setBorp(null); const w0 = clone([bo.id, rp.id]), k0 = V.breedOne(w0, w0.byId[order[0]], w0.byId[order[1]], bh, tx, END, bo.owner);
  V._setBorp(END + 1); const w1 = clone([bo.id, rp.id]), kL = V.breedOne(w1, w1.byId[order[0]], w1.byId[order[1]], bh, tx, END, bo.owner); ok(kL.species !== 'borp', 'gate set after the block: no Bo Pigeon');
  V._setBorp(END); const w2 = clone([bo.id, rp.id]), k = V.breedOne(w2, w2.byId[order[0]], w2.byId[order[1]], bh, tx, END, bo.owner);
  ok(k0.species !== 'borp' && P.SPECIES.some(x => x.id === k0.species), i + ': gate off -> random plain species (' + k0.species + ')');
  ok(k.species === 'borp' && k.art.species === 'borp' && !k.hybrid, i + ': gate on -> Bo Pigeon');
  ok(strip(k) === strip(k0), i + ': only the species changes (tier, stats, name, marks, look the same)');
  ok(k.tier === 3 && k.art.boMark === 1 && k.art.rpMark === 1 && !k.supreme && !k.contest, i + ': Legendary, marks kept for the line, not a 1 of 1');
  ok(V.speciesLabel('borp') === 'Bo Pigeon', 'label'); borps.push(k); }
{ const k = borps[0];
  for (let st = 0; st <= 5; st++) { let fr; try { fr = R.framesWith(k.art, st, [], []); } catch (e) { ok(false, 'borp render st' + st + ' ' + e.message); continue; }
    ok(fr && fr.length === 4 && fr[0].data.length === 4096, 'Bo Pigeon frames st' + st);
    const rpf = R.framesWith(Object.assign({}, k.art, { species: 'rarepigeon' }), st, [], [])[0].data; let d = 0; for (let q = 0; q < 4096; q += 4) if (rpf[q] !== fr[0].data[q] || rpf[q + 1] !== fr[0].data[q + 1]) d++; ok(d > (st ? 8 : 3), 'Bo Pigeon differs from Rarepigeon st' + st + ' (' + d + 'px)'); }
  const gids = (c.V2Gear.ITEMS || []).map(x => x.id).filter(id => V.itemOf(id) && V.eligible(V.itemOf(id), k.species, null, k.tier)); let gOk = 0;
  gids.forEach(id => { try { R.framesWith(k.art, 4, [id], []); gOk++; } catch (e) { ok(false, 'gear ' + id + ' ' + e.message); } }); ok(gOk === gids.length && gOk > 0, 'gear renders on a Bo Pigeon (' + gOk + ')');
  (c.V2Gear.RP_GEAR || []).forEach(x => { const a = R.framesWith(k.art, 4, [x[0]], [])[0].data, z = R.framesWith(k.art, 4, [], [])[0].data; let d = 0; for (let q = 0; q < 4096; q += 4) if (a[q] !== z[q] || a[q + 1] !== z[q + 1]) d++; ok(d > 0, x[0] + ' on a Bo Pigeon (' + d + 'px)'); });
  /* breeding a Bo Pigeon: like the 1 of 1s (partner species), never a new Bo Pigeon, the line keeps both marks */
  const ww = clone([bo.id, rp.id, (live.find(p => p.species === 'pepe') || live[0]).id]); V._setBorp(END); const kid = V.breedOne(ww, ww.byId[bo.id], ww.byId[rp.id], fakeHash(END + 50), 'test:bp', END, bo.owner); kid.stage = 3; kid.care = 999; kid.breeds = 0; kid.lastBreed = null;
  const pe = live.find(p => p.species === 'pepe') || live[0], g2 = V.breedOne(ww, kid, ww.byId[pe.id], fakeHash(END + 2051), 'test:bp2', END + 2000, bo.owner);
  ok(g2.species === pe.species && g2.art.boMark === 1 && g2.art.rpMark === 1, 'Bo Pigeon times ' + pe.species + ' -> ' + g2.species + ' with both marks');
  const k2 = V.breedOne(ww, kid, ww.byId[bo.id], fakeHash(END + 2052), 'test:bp3', END + 2000, bo.owner); ok(k2.species !== 'borp' && P.SPECIES.some(x => x.id === k2.species), 'Bo Pigeon times Bo -> plain species (' + k2.species + ')');
  const CS = require('../js/contest-sprite.js'); for (let st = 0; st <= 5; st++) { const f = CS.frames('borp', st, '#14101e', st ? { hand: { item: 'stick', cols: ['#8a5a2b', '#c8955a'] } } : null); ok(f.length === 4 && f[0].data.length === 4096, 'borp sprite stage ' + st); } }
V._setBorp(null);
/* ---------- TWINS ALIKE ---------- */
const pairs = []; { const by = {}; live.filter(p => p.stage >= 3 && !V.isHybrid(p.species)).forEach(p => (by[p.species] = by[p.species] || []).push(p)); const sp = Object.keys(by).filter(k => by[k].length >= 2);
  sp.slice(0, 3).forEach(k => pairs.push([by[k][0], by[k][1]])); for (let i = 0; i + 1 < sp.length && pairs.length < 6; i += 2) pairs.push([by[sp[i]][0], by[sp[i + 1]][0]]); }
ok(pairs.length >= 4, 'test pairs ' + pairs.length);
let nTw = 0, nTw1 = 0, nHyb = 0, diffs = {}; const sheet = [];
const bv2 = Math.max(END, V.ACTIVATE_BREEDING_V2_BLOCK || 0) + 10;
for (let i = 0; i < 6000; i++) { const pr = pairs[i % pairs.length], bh = fakeHash(bv2 + (i % 97)), tx = 'test:tw' + i;
  if (!V.twinDraw(V.sha(bh + tx))) { if (i < 20) { V._setTwinAlike(bv2); const ww = clone(pr.map(p => p.id)), k = V.breed(ww, ww.byId[pr[0].id], ww.byId[pr[1].id], bh, tx, bv2, pr[0].owner); ok(!k.twinOf, 'no twin when twinDraw says no'); V._setTwinAlike(null); } continue; }
  V._setTwinAlike(null); const w0 = clone(pr.map(p => p.id)), a0 = V.breed(w0, w0.byId[pr[0].id], w0.byId[pr[1].id], bh, tx, bv2, pr[0].owner), t0 = w0.byId[a0.twinOf];
  V._setTwinAlike(bv2); const w1 = clone(pr.map(p => p.id)), a1 = V.breed(w1, w1.byId[pr[0].id], w1.byId[pr[1].id], bh, tx, bv2, pr[0].owner), t1 = w1.byId[a1.twinOf]; V._setTwinAlike(null);
  nTw++; ok(t0 && t1 && t0.id === t1.id, 'twin in both (same id)'); ok(JSON.stringify(a0) === JSON.stringify(Object.assign({}, a1)), 'first egg unchanged by the gate');
  ok(t1.species === a1.species && t1.tier === a1.tier, 'twin shares species + tier'); if (a1.hybrid) { nHyb++; ok(JSON.stringify(t1.hybrid.parts) === JSON.stringify(a1.hybrid.parts) && t1.hybrid.shape === a1.hybrid.shape, 'hybrid twin shares body + parts'); }
  ok(K.every(k => Math.abs(t1.stats[k] - a1.stats[k]) <= 1 && t1.stats[k] >= 1), 'stats within 1'); ok(t1.name === t0.name, 'twin keeps its own name');
  ok(JSON.stringify(t1.mutation || null) === JSON.stringify(a1.mutation || null) && (t1.hidden || null) === (a1.hidden || null), 'shares mutation + hidden trait');
  const ka = Object.keys(a1.art).filter(k => k !== 'baseStats' && k !== 'defaultName' && k !== 'rareTier' && k !== 'rareSide' && k !== 'dynast' && JSON.stringify(a1.art[k]) !== JSON.stringify(t1.art[k])); const td = t1.twinAlike;
  const hybEye = td && td.trait === 'eyes' && a1.art.hybrid && a1.art.hybrid.eyes != null;
  ok(td && (hybEye ? ka.length === 1 && ka[0] === 'hybrid' : ka.length <= 1 && (ka.length === 0 ? td.from === td.to : ka[0] === td.trait)), 'one look detail differs (' + ka.join(',') + ' / ' + (td && td.trait) + ')');
  if (td && td.trait === 'eyes') ok(td.to !== 'beady', 'never born shades'); diffs[td.trait] = (diffs[td.trait] || 0) + 1;
  for (const st of [1, 3, 5]) { try { R.framesWith(t1.art, st, [], []); } catch (e) { ok(false, 'twin render ' + e.message); } }
  if (sheet.filter(x => x.hyb === !!a1.hybrid).length < 2) sheet.push({ hyb: !!a1.hybrid, a: a1.id, t: t1.id, sp: a1.species, aArt: a1.art, t0Art: t0.art, t1Art: t1.art, td }); }
ok(nTw > 60 && Math.abs(nTw / 6000 - 1 / 50) < 0.006, 'twin rate unchanged ~2% (' + nTw + '/6000)'); ok(nHyb > 0, 'some hybrid twins (' + nHyb + ')');
console.log('twins ' + nTw + ' hybrid ' + nHyb + ' diffs ' + JSON.stringify(diffs));
const fr = (a, st) => Array.from(R.framesWith(a, st, [], [])[0].data);
if (process.env.TWIN_SHEET) require('fs').writeFileSync(process.env.TWIN_SHEET, JSON.stringify(sheet.map(x => ({ hyb: x.hyb, a: x.a, t: x.t, sp: x.sp, td: x.td, f: [x.aArt, x.t0Art, x.t1Art].map(a => fr(a, 4)) }))));
if (process.env.BORP_SHEET) { const k = borps[0], gid = ((c.V2Gear.RP_GEAR || [])[0] || [])[0]; require('fs').writeFileSync(process.env.BORP_SHEET, JSON.stringify({ stages: [0, 1, 2, 3, 4, 5].map(st => fr(k.art, st)), mythic2: fr(borps[1].art, 5), gear: gid ? Array.from(R.framesWith(k.art, 4, [gid], [])[0].data) : null, gid, bo: fr(bo.art, 4), rp: fr(rp.art, 4), plain: fr(Object.assign({}, k.art, { species: 'rarepigeon' }), 4) })); }
console.log(pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
