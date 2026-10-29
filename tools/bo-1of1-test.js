#!/usr/bin/env node
/* BO JACKSON 1 of 1 tests: gated grant to the 3gqd address, egg, Legendary, power exactly 134, not boosted by the supreme sweep, grows/breeds/fights/gear,
 * sprite renders every stage. node tools/bo-1of1-test.js */
'use strict';
const { load, row, snap, run, fakeHash } = require('./lib/load-rules');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const c = load(['js/kek-sprite.js', 'js/wizard-sprite.js', 'js/funtrump-sprite.js', 'js/bo-sprite.js', 'js/contest-sprite.js']), _vr = (c.setInterval = () => 0, c.document.readyState = 'loading', c.clearInterval = () => {}, c.requestAnimationFrame = () => 0, c.ImageData = c.ImageData || function (d, w, h) { this.data = d; this.width = w; this.height = h; }, require('vm').runInContext(require('fs').readFileSync(require('path').join(__dirname, '../js/v2-render.js'), 'utf8'), c)), V = c.V2Rules, P = c.PetCore, K = P.STAT_KEYS, s0 = snap(), H = Object.assign({}, c.XCPETS_BLOCK_HASHES, s0.hashes);
const V2S = ['head', 'face', 'back', 'hand', 'body', 'feet', 'weapon'];
const pw = p => K.reduce((a, k) => a + p.stats[k], 0);
ok(V.ACTIVATE_BO_BLOCK === 973343, 'gate 973343'); ok(V.BO_POWER === 134, 'power 134');
const tip = Math.max.apply(null, s0.rows.map(r => r.block_index).filter(b => H[b])), s = { tip, rows: s0.rows.filter(r => r.block_index <= tip), hashes: s0.hashes };
/* gate/blocks derived from the snapshot tip (never hand-fixed when the chain passes the gate): the 'before' world is the tip with the gate moved
 * just past it; the grant world uses the real gate, or the tip if the chain has not reached it yet. */
const G = Math.min(V.ACTIVATE_BO_BLOCK, tip); const END = Math.max(tip, V.ACTIVATE_BO_BLOCK) + 157; /* breeding blocks after both the snapshot tip and the real gate (973500 on the frozen fixture, as before) */ V._setBo(tip + 1);
const w0 = run(c, s, [], tip); ok(!w0.pets.some(p => p.species === 'bojackson'), 'no Bo before the gate');
V._setBo(G); const w = run(c, s, [], tip), B = w.pets.filter(p => p.species === 'bojackson');
ok(B.length === 1, 'exactly one Bo'); const b = B[0];
ok(b.owner === 'bc1pfvkpmllr7mtn5uazqxumwp39h2ny3c8l6fmrgvjv2cqn5wlpt7hssf3gqd', 'owner 3gqd');
ok(b.name === 'Bo Jackson' && b.tier === 3 && b.supreme && b.supreme.id === 'bo' && b.supreme.title === 'Bo Knows' && b.supreme.of === 1, 'name/tier/1 of 1');
{ const eg = G < tip ? run(c, { tip: G, rows: s.rows.filter(r => r.block_index <= G), hashes: s.hashes }, [], G).pets.find(p => p.species === 'bojackson') : b; ok(eg && eg.id === b.id && eg.stage === 0 && eg.care === 0, 'granted as an egg (at the gate ' + G + ')'); } /* past the gate the real owner may already have fed it */ ok(pw(b) === 134, 'power 134 got ' + pw(b)); ok(!b.grantPower, 'not in the 155-160 supreme sweep');
ok(K.every(k => b.stats[k] >= 1 && b.stats[k] <= 30), 'stats 1..30');
const w2 = run(c, s, [], tip); ok(w2.pets.filter(p => p.species === 'bojackson').length === 1, 'once');
ok(V.breedable(Object.assign({}, b, { stage: 3 }), END) === null, 'can breed');
/* BO GEAR (owner: just give to player): one of each Bo piece in 3gqd's inventory, unworn; nobody else has any; never in a roll pool; renders */
{ const BG = (c.V2Gear.BO_GEAR || []).map(x => x[0]); ok(BG.length === 6, 'six Bo gear pieces');
  BG.forEach(id => { const mine = Object.values(w.items).filter(g => g.item === id); ok(mine.length === 1 && mine[0].owner === b.owner && !mine[0].on, id + ': one, owned by 3gqd, unworn');
    ok(!Object.values(w0.items).some(g => g.item === id), id + ': none before the gate'); ok(V.itemOf(id) && V.itemOf(id).noRoll, id + ': noRoll');
    ok(!V.ALL_GEAR.some(x => x.id === id), id + ': not in the gear list'); ok(!(c.V2Gear.ITEMS || []).some(x => x.id === id), id + ': not in ITEMS');
    ['pepe', 'wojak', 'kek', 'nakamoto'].forEach(sp => [0, 1, 2, 3].forEach(ti => V2S.forEach(sl => { const P = V.pool(sl, sp, ti); ok(!(P || []).some(x => x && (x.id === id || x.item === id)), id + ' not in ' + sl + ' pool ' + sp + ' t' + ti); }))); });
  ok(pw(b) === 134, 'Bo power 134 with gear granted'); }
console.log('Bo #' + b.id + ' stats ' + JSON.stringify(b.stats) + ' power ' + pw(b));

/* BREEDING: Bo breeds like the contest 1 of 1s (Bo counts as a copy of the partner's species; normal odds, tier, stats, cap, cooldown) and every
 * Bo baby gets Bo's eye black (art.boMark, looks only). Never a Bo, never a 1 of 1. Hybrid partner -> hybrid baby; 3-way partner -> 3-way baby. */
const R = c.V2Render; for (let x = tip + 1; x <= END + 300; x++) if (!s.hashes[x] && !H[x]) s.hashes[x] = fakeHash(x);
const wb = JSON.parse(JSON.stringify(w)); wb.byId = {}; wb.pets.forEach(p => { wb.byId[p.id] = p; }); const bo = wb.byId[b.id]; bo.stage = 3; bo.care = 999;
const clone = () => { const ww = JSON.parse(JSON.stringify(wb)); ww.byId = {}; ww.pets.forEach(p => { ww.byId[p.id] = p; }); return ww; };
const live = wb.pets.filter(p => !p.dead && !p.released && !p.community && !p.supreme && !p.burnLord && !p.contest && p.species !== 'bojackson');
const partners = {}; live.forEach(p => { const sp = p.species, k = /^hyb3:/.test(sp) ? '3way' : /^hyb/.test(sp) ? 'hybrid' : sp; if (!partners[k]) partners[k] = p; });
const shown = []; let nb = 0;
Object.keys(partners).forEach((k, i) => { const P2 = partners[k]; for (let r = 0; r < 3; r++) { const ww = clone(), kid = V.breedOne(ww, ww.byId[bo.id], ww.byId[P2.id], fakeHash(END + i * 7 + r), 'test:bo' + k + r, END, bo.owner); nb++;
  ok(kid.art.boMark === 1, k + ': Bo eye black'); ok(kid.species !== 'bojackson' && !kid.supreme && !kid.contest, k + ': not a Bo / not 1 of 1');
  if (k === 'hybrid' || k === '3way') ok(V.isHybrid(kid.species), k + ' partner gives a hybrid baby (' + kid.species + ')'); else ok(kid.species === P2.species, k + ': partner species');
  for (let st = 0; st <= 5; st++) { let fr; try { fr = R.framesWith(kid.art, st, [], []); } catch (e) { ok(false, k + ' render st' + st + ' ' + e.message); continue; } ok(fr && fr.length >= 1, k + ' frames st' + st);
    if (st >= 1) { const bare = R.framesWith(Object.assign({}, kid.art, { boMark: 0 }), st, [], [])[0].data; let diff = 0; for (let q = 0; q < bare.length; q += 4) if (bare[q] !== fr[0].data[q] || bare[q + 1] !== fr[0].data[q + 1]) diff++; ok(diff > 0 && diff < 20, k + ' eye black drawn st' + st + ' (' + diff + 'px)'); } }
  if (r === 0) shown.push({ k, kid }); } });
/* GEAR on a Bo baby: every eligible item renders */
const gk = shown[0].kid, gids = [].concat((c.V2Gear.ITEMS || []).map(x => x.id)).filter(id => V.itemOf(id) && V.eligible(V.itemOf(id), gk.species, null, gk.tier)); let gOk = 0;
gids.forEach(id => { try { R.framesWith(gk.art, 4, [id], []); gOk++; } catch (e) { ok(false, 'gear ' + id + ' ' + e.message); } }); ok(gOk === gids.length && gOk > 0, 'gear on Bo baby ' + gOk);
/* LINEAGE: the mark passes to grandchildren and every later generation (a marked parent marks the baby) */
{ const ww = clone(), P2 = partners.pepe || partners[Object.keys(partners)[0]]; let par = V.breedOne(ww, ww.byId[bo.id], ww.byId[P2.id], fakeHash(END + 901), 'test:g1', END, bo.owner);
  for (let g = 2; g <= 4; g++) { par.stage = 3; par.care = 999; const mate = live.find(p => p.species === par.species && p.id !== par.id && p.id !== P2.id) || P2;
    const kid = V.breedOne(ww, ww.byId[par.id] || par, ww.byId[mate.id], fakeHash(END + 901 + g), 'test:g' + g, END + g, bo.owner); ok(kid.art.boMark === 1, 'generation ' + g + ' keeps eye black (' + kid.species + ')'); par = kid; } }
/* Bo gear renders on a Bo baby and on Bo himself */
(c.V2Gear.BO_GEAR || []).forEach(x => { try { const a = R.framesWith(gk.art, 4, [x[0]], [])[0].data, z = R.framesWith(gk.art, 4, [], [])[0].data; let d = 0; for (let q = 0; q < a.length; q += 4) if (a[q] !== z[q] || a[q + 1] !== z[q + 1] || a[q + 2] !== z[q + 2]) d++; ok(d > 0, x[0] + ' drawn on baby (' + d + 'px)'); } catch (e) { ok(false, x[0] + ' baby ' + e.message); }
  try { const f = R.framesWith(Object.assign({}, b.art, { species: 'bojackson' }), 4, [x[0]], []); ok(f && f.length >= 1, x[0] + ' on Bo'); } catch (e) { ok(false, x[0] + ' on Bo ' + e.message); } });
/* before the Bo gate: no mark (replay SAME) */ { const ww = clone(), P2 = partners[Object.keys(partners)[0]], kid = V.breedOne(ww, ww.byId[P2.id], ww.byId[live.find(p => p.species === P2.species && p.id !== P2.id).id], fakeHash(END), 'test:nb', END, P2.owner); ok(!kid.art.boMark, 'non-Bo babies unmarked'); }
console.log('Bo babies bred: ' + nb + ' partners ' + Object.keys(partners).join(','));
if (process.env.BO_SHEET) require('fs').writeFileSync(process.env.BO_SHEET, JSON.stringify(shown.map(x => ({ k: x.k, sp: x.kid.species, name: V.hybridName && V.isHybrid(x.kid.species) ? V.hybridName(x.kid.species) : x.kid.species,
  frames: [3, 4, 5].map(st => Array.from(R.framesWith(x.kid.art, st, [], [])[0].data)) }))));
const CS = require('../js/contest-sprite.js'); for (let st = 0; st <= 5; st++) { const f = CS.frames('bojackson', st, '#14101e', st ? { hand: { item: 'stick', cols: ['#8a5a2b', '#c8955a'] } } : null); ok(f.length === 4 && f[0].data.length === 4096, 'sprite stage ' + st); }
/* EYE BLACK PLACEMENT (owner Oct 26 ~10:32 PM CT): every species + Kek + Wizard body, every stage, every frame, each eye on its own: the stripe's top
 * row is exactly 2 rows below the eye's lowest pixel (ONE skin row between), no mark pixel in that gap row or above, and the painted pixels are the plan. */
{ const PC = c.PetCore, BODIES = PC.SPECIES.map(x => x.id).concat(['kek', 'wizard']), EMPTY_OK = { 'nakamoto:2:0': 1 }; let nEyes = 0;
  BODIES.forEach(sp => { for (let st = 1; st <= 5; st++) { const a = Object.assign({}, PC.characterPet(sp, { tier: 'legendary' }), { background: 'solid', bgColor: '#d8d8e0', pattern: 'none', band: 'none', armor: 'none', cape: 'none', weapon: 'none', crown: 'none' });
    V._boMarkLog = []; const on = R.framesWith(Object.assign({}, a, { boMark: 1 }), st, [], []), off = R.framesWith(a, st, [], []), LOG = V._boMarkLog; V._boMarkLog = null;
    ok(LOG.length === on.length, sp + ' st' + st + ': eyes found on every frame');
    LOG.forEach(L => { const f = L.frame, A = on[f].data, B = off[f].data, painted = []; for (let q = 0; q < 1024; q++) if (A[q * 4] !== B[q * 4] || A[q * 4 + 1] !== B[q * 4 + 1] || A[q * 4 + 2] !== B[q * 4 + 2]) painted.push(q);
      const want = [].concat(...L.plan.map(E => E.row)).sort((x, y) => x - y); ok(JSON.stringify(painted) === JSON.stringify(want), sp + ' st' + st + ' f' + f + ': painted = plan');
      L.plan.forEach((E, i) => { nEyes++; ok(E.y === E.by + 2, sp + ' st' + st + ' f' + f + ' eye' + i + ': stripe 2 rows below eye bottom');
        ok(E.row.every(q => (q >> 5) === E.by + 2), sp + ' st' + st + ' eye' + i + ': stripe on one row');
        ok(!painted.some(q => (q >> 5) <= E.by + 1 && (q & 31) >= E.lx && (q & 31) <= E.rx), sp + ' st' + st + ' f' + f + ' eye' + i + ': 1-row skin gap kept clear');
        ok(E.row.length > 0 || EMPTY_OK[sp + ':' + st + ':' + i], sp + ' st' + st + ' f' + f + ' eye' + i + ': stripe drawn'); }); }); } });
  ok(nEyes > 500, 'eyes checked ' + nEyes); }
console.log(pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
