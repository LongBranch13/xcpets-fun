#!/usr/bin/env node
/* BO PIGEON + TWINS LOOK ALIKE tests (branch borp-twins, owner Oct 31 2026 PREVIEW). Both gates null (tested via _setBorp / _setTwinAlike):
 * off = the baby / twin is exactly what main makes; on = a direct Bo Jackson x Rarepigeon baby is species 'borp' (same tier/stats/name, both line marks kept,
 * own body drawn by ContestSprite, no mark overlay), and a twin copies its sibling's look with ONE small difference (own tier/stats/name).
 * node tools/borp-twins-test.js   (BORP_SHEET=file.json writes the frames used by the preview script) */
'use strict';
const { snap, run, fakeHash } = require('./lib/load-rules');
const { load } = require('./lib/load-rules');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const c = load(['js/kek-sprite.js', 'js/wizard-sprite.js', 'js/funtrump-sprite.js', 'js/bo-sprite.js', 'js/rarepigeon-sprite.js', 'js/contest-sprite.js']), _vr = (c.setInterval = () => 0, c.document.readyState = 'loading', c.clearInterval = () => {}, c.requestAnimationFrame = () => 0, c.ImageData = c.ImageData || function (d, w, h) { this.data = d; this.width = w; this.height = h; }, require('vm').runInContext(require('fs').readFileSync(require('path').join(__dirname, '../js/v2-render.js'), 'utf8'), c)), V = c.V2Rules, P = c.PetCore, K = P.STAT_KEYS, s0 = snap(), H = Object.assign({}, c.XCPETS_BLOCK_HASHES, s0.hashes);
const R = c.V2Render, CS = c.ContestSprite;
ok(V.ACTIVATE_BORP_BLOCK === null && V.ACTIVATE_TWIN_ALIKE_BLOCK === null, 'both gates null (off)');
ok(CS.SPECIES.indexOf('borp') >= 0 && CS.NAMES.borp === 'Bo Pigeon', 'ContestSprite knows borp'); ok(V.speciesLabel('borp') === 'Bo Pigeon', 'label Bo Pigeon'); ok(V.isContestSp('borp'), 'borp breeds like the 1 of 1s');
for (let st = 0; st <= 5; st++) { const f = CS.frames('borp', st, '#14101e'); ok(f.length === 4 && f[0].data.length === 32 * 32 * 4, 'borp frames st' + st); let n = 0; for (let q = 0; q < f[0].data.length; q += 4) if (f[0].data[q] !== 0x14 || f[0].data[q + 1] !== 0x10) n++; ok(n > 60, 'borp st' + st + ' draws a body (' + n + ' px)'); }
const tip = Math.max.apply(null, s0.rows.map(r => r.block_index).filter(b => H[b])), s = { tip, rows: s0.rows.filter(r => r.block_index <= tip), hashes: s0.hashes };
const G = Math.min(V.ACTIVATE_RP_BLOCK, V.ACTIVATE_BO_BLOCK, tip), END = Math.max(tip, V.ACTIVATE_RP_BLOCK) + 155; V._setBo(G); V._setRp(G);
const w = run(c, s, [], tip); for (let x = tip + 1; x <= END + 3000; x++) if (!s.hashes[x] && !H[x]) s.hashes[x] = fakeHash(x);
const bo = w.pets.find(p => p.species === 'bojackson'), rp = w.pets.find(p => p.species === 'rarepigeon'); ok(bo && rp, 'Bo and Rarepigeon in the world');
[bo, rp].forEach(p => { p.stage = 3; p.care = 999; });
const clone = () => { const ww = JSON.parse(JSON.stringify(w)); ww.byId = {}; ww.pets.forEach(p => { ww.byId[p.id] = p; }); return ww; };
const strip = k => { const o = JSON.parse(JSON.stringify(k)); delete o.species; delete o.hybrid; if (o.art) { delete o.art.species; delete o.art.hybrid; } return o; };
/* BO x RAREPIGEON */
const sheet = { borp: [], twins: [] };
for (let r = 0; r < 6; r++) { const tx = 'test:borp' + r, bh = fakeHash(END + r);
  V._setBorp(null); const w1 = clone(), off = V.breed(w1, w1.byId[bo.id], w1.byId[rp.id], bh, tx, END, bo.owner);
  V._setBorp(END); const w2 = clone(), on = V.breed(w2, w2.byId[r % 2 ? rp.id : bo.id], w2.byId[r % 2 ? bo.id : rp.id], bh, tx, END, bo.owner);
  ok(off.species !== 'borp' && off.art.boMark === 1 && off.art.rpMark === 1, 'gate off: plain species with both marks (' + off.species + ')');
  if (r % 2 === 0) ok(JSON.stringify(strip(off)) === JSON.stringify(strip(on)), 'gate on: only the species changes (same tier/stats/name/draws)');
  ok(on.species === 'borp' && on.art.species === 'borp' && !on.hybrid && !on.art.hybrid, 'gate on: Bo Pigeon (either parent order)');
  ok(on.art.boMark === 1 && on.art.rpMark === 1 && !on.supreme && !on.contest, 'Bo Pigeon keeps both line marks, not a 1 of 1');
  if (on.twinOf) { const tw = w2.byId[on.twinOf]; ok(tw && tw.species === 'borp', 'Bo Pigeon twin is a Bo Pigeon too'); }
  for (let st = 0; st <= 5; st++) { const a = R.framesWith(on.art, st, [], [])[0].data, b = CS.frames('borp', st, on.art.bgColor || '#14101e')[0].data; let d = 0; for (let q = 0; q < a.length; q++) if (a[q] !== b[q]) d++; ok(d === 0, 'Bo Pigeon st' + st + ' = its own body (no mark overlay)'); }
  if (r === 0) sheet.borp = [0, 1, 2, 3, 4, 5].map(st => ({ st, off: Array.from(R.framesWith(off.art, st, [], [])[0].data), on: Array.from(R.framesWith(on.art, st, [], [])[0].data) })), sheet.offSpecies = off.species; }
V._setBorp(END);
{ const ww = clone(), mate = ww.pets.find(p => p.species === 'pepe' && !p.dead && !p.supreme), k = V.breed(ww, ww.byId[bo.id], mate, fakeHash(END + 50), 'test:bopepe', END, bo.owner); ok(k.species !== 'borp' && k.art.boMark === 1, 'Bo x pepe is not a Bo Pigeon');
  const pg = V.breed(ww, ww.byId[bo.id], ww.byId[rp.id], fakeHash(END + 51), 'test:pg', END, bo.owner); pg.stage = 3; pg.care = 999; const m2 = ww.pets.find(p => p.species === 'wojak' && !p.dead && !p.supreme) || mate;
  const g2 = V.breed(ww, pg, m2, fakeHash(END + 52), 'test:pg2', END + 1, bo.owner); ok(g2.species === m2.species && g2.art.boMark === 1 && g2.art.rpMark === 1, 'Bo Pigeon x ' + m2.species + ': partner species, both line marks (' + g2.species + ')');
  ok(V.breedable(Object.assign({}, pg, { stage: 3 }), END + 400) === null || true, 'breedable check runs'); }
V._setBorp(null);
/* TWINS LOOK ALIKE */
const live = w.pets.filter(p => !p.dead && !p.released && !p.community && !p.supreme && !p.burnLord && !p.contest && p.stage >= 3);
const pairs = []; const bySp = {}; live.forEach(p => { (bySp[p.species] = bySp[p.species] || []).push(p); }); Object.keys(bySp).forEach(sp => { if (bySp[sp].length >= 2) pairs.push([bySp[sp][0], bySp[sp][1]]); });
const hyb = live.filter(p => V.isHybrid(p.species)); if (hyb.length >= 2) pairs.push([hyb[0], hyb[1]]); if (live.length > 3) pairs.push([live[0], live[live.length - 1]]);
let twins = 0, diffs = {};
pairs.forEach((pr, pi) => { let found = 0; for (let i = 0; i < 2000 && found < 3; i++) { const bh = fakeHash(END + 100 + i), tx = 'test:tw' + pi + ':' + i;
  if (!V.twinDraw(V.sha(bh + tx))) continue; found++; twins++;
  V._setTwinAlike(null); const w1 = clone(), A1 = w1.byId[pr[0].id], B1 = w1.byId[pr[1].id]; [A1, B1].forEach(p => { p.care = 999; p.lastBreed = 0; }); const k1 = V.breed(w1, A1, B1, bh, tx, END, A1.owner), t1 = w1.byId[k1.twinOf];
  V._setTwinAlike(END); const w2 = clone(), A2 = w2.byId[pr[0].id], B2 = w2.byId[pr[1].id]; [A2, B2].forEach(p => { p.care = 999; p.lastBreed = 0; }); const k2 = V.breed(w2, A2, B2, bh, tx, END, A2.owner), t2 = w2.byId[k2.twinOf];
  ok(t1 && t2, 'twin egg made'); if (!t1 || !t2) continue;
  ok(JSON.stringify(k1) === JSON.stringify(k2), 'first egg untouched by the twin gate');
  ok(t2.name === t1.name && t2.tier === t1.tier && JSON.stringify(t2.stats) === JSON.stringify(t1.stats) && t2.id === t1.id, 'twin keeps its own name/tier/stats/id');
  ok(t2.species === k2.species && JSON.stringify(t2.hybrid || null) === JSON.stringify(k2.hybrid || null), 'twin shares species / hybrid plan');
  const a = t2.art, b = k2.art; ok(a.seed === b.seed && a.bgColor === b.bgColor && a.background === b.background, 'twin shares art seed + background');
  const capped = (t2.traitCap || []).map(x => x.trait), dk = ['cheeks', 'eyes', 'pattern'].filter(f => a[f] !== b[f] && capped.indexOf(f) < 0); ok(dk.length === 1 && dk[0] === a.twinDiff || (dk.length === 0 && capped.indexOf(a.twinDiff) >= 0), 'exactly one small difference (' + a.twinDiff + ') besides a lower tier cap');
if (t2.tier >= k2.tier) ok(!t2.traitCap, 'twin of equal/higher tier needs no cap'); diffs[a.twinDiff] = (diffs[a.twinDiff] || 0) + 1;
  ok(['band', 'armor', 'cape', 'weapon', 'crown'].every(f => a[f] === b[f] || capped.indexOf(f) >= 0), 'same born gear look (bar a lower tier cap)');
  if (a.twinDiff !== 'cheeks' && capped.indexOf(a.twinDiff) < 0) { const pool = a.twinDiff === 'eyes' ? P.EYES : P.PATTERNS, t = id => pool.find(x => x.id === id).t; ok(t(a[a.twinDiff]) === t(b[a.twinDiff]) && (a.twinDiff !== 'eyes' || a.eyes !== 'beady'), 'difference keeps the rarity, never born shades'); }
  const st = 3, fa = R.framesWith(a, st, [], [])[0].data, fb = R.framesWith(b, st, [], [])[0].data, f0 = R.framesWith(t1.art, st, [], [])[0].data; let dOn = 0, dOff = 0; for (let q = 0; q < fa.length; q += 4) { if (fa[q] !== fb[q] || fa[q + 1] !== fb[q + 1] || fa[q + 2] !== fb[q + 2]) dOn++; if (f0[q] !== fb[q] || f0[q + 1] !== fb[q + 1] || f0[q + 2] !== fb[q + 2]) dOff++; }
  ok(dOn <= dOff, 'twins closer alike with the gate on (' + dOn + ' vs ' + dOff + ' px)');
  if (sheet.twins.length < 4 && (sheet.twins.length === 0 || sheet.twins[sheet.twins.length - 1].pi !== pi)) sheet.twins.push({ pi, sp: k2.species, diff: a.twinDiff, dOn, dOff, frames: [1, 3, 5].map(s2 => ({ kid: Array.from(R.framesWith(b, s2, [], [])[0].data), off: Array.from(R.framesWith(t1.art, s2, [], [])[0].data), on: Array.from(R.framesWith(a, s2, [], [])[0].data) })) }); } });
V._setTwinAlike(null);
ok(twins >= 6, 'enough twins tested (' + twins + ')');
console.log('twins tested ' + twins + ' diffs ' + JSON.stringify(diffs));
if (process.env.BORP_SHEET) require('fs').writeFileSync(process.env.BORP_SHEET, JSON.stringify(sheet));
console.log((fail ? 'FAILED ' : 'ok ') + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
