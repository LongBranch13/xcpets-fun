#!/usr/bin/env node
/* VIKING 1 of 1 tests (branch viking-1of1, modeled on rarepigeon-1of1-test): gate null = replay SAME (tested via _setViking), one Legendary egg to
 * 15dx2KbwKxppVjJYvXrK6pCwnQeqat71ZA, power exactly 141, not boosted by the grant power sweep, no gear granted; GROWS (feed to Mythic), BREEDS (every baby keeps
 * the viking root, so the horned helmet or braided beard carries over), FIGHTS, HOLDS gear; sprite renders every stage; no fire aura / flame crown / gold frame.
 * node tools/viking-1of1-test.js */
'use strict';
const { load, row, snap, run, fakeHash } = require('./lib/load-rules');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const c = load(['js/kek-sprite.js', 'js/wizard-sprite.js', 'js/funtrump-sprite.js', 'js/homer-sprite.js', 'js/viking-sprite.js', 'js/bo-sprite.js', 'js/rarepigeon-sprite.js', 'js/contest-sprite.js']), _vr = (c.setInterval = () => 0, c.document.readyState = 'loading', c.clearInterval = () => {}, c.requestAnimationFrame = () => 0, c.ImageData = c.ImageData || function (d, w, h) { this.data = d; this.width = w; this.height = h; }, require('vm').runInContext(require('fs').readFileSync(require('path').join(__dirname, '../js/v2-render.js'), 'utf8'), c)), V = c.V2Rules, P = c.PetCore, K = P.STAT_KEYS, R = c.V2Render, s0 = snap(), H = Object.assign({}, c.XCPETS_BLOCK_HASHES, s0.hashes);
const pw = p => K.reduce((a, k) => a + p.stats[k], 0), TO = '15dx2KbwKxppVjJYvXrK6pCwnQeqat71ZA';
ok(V.ACTIVATE_VIKING_BLOCK === 974009, 'gate 974009 (live)'); /* null-gate world still tested below via _setViking(null) */ ok(V.VIKING_POWER === 141, 'power 141'); ok(V.VIKING_TO === TO, 'address');
ok(V.VIKING_NAME === 'Ragnar Kekbeard' && V.VIKING_TITLE === 'The Last Viking', 'name / title');
const tip = Math.max.apply(null, s0.rows.map(r => r.block_index).filter(b => H[b])), s = { tip, rows: s0.rows.filter(r => r.block_index <= tip), hashes: Object.assign({}, s0.hashes) };
const DAY = 144, G = tip + 1, END = tip + DAY * 14; for (let b = tip + 1; b <= END + 400; b++) if (!H[b] && !s.hashes[b]) s.hashes[b] = fakeHash(b);
/* gate null: nothing changes */
V._setViking(null); const w0 = run(c, s, [], END); ok(!w0.pets.some(p => p.species === 'viking' || /viking/.test(p.species)), 'no Viking while the gate is null');
V._setViking(END + 999); const w1 = run(c, s, [], END); ok(JSON.stringify(w1.pets.map(p => [p.id, p.species, p.owner, p.stats])) === JSON.stringify(w0.pets.map(p => [p.id, p.species, p.owner, p.stats])), 'gate in the future: identical world');
/* grant */
V._setViking(G); const w = run(c, s, [], G), B = w.pets.filter(p => p.species === 'viking');
ok(B.length === 1, 'exactly one Viking'); const b = B[0];
ok(b.owner === TO, 'owner 15dx2...71ZA'); ok(b.stage === 0 && b.care === 0 && b.hatchBlock === G, 'granted as an egg at the gate');
ok(b.name === 'Ragnar Kekbeard' && b.tier === 3 && b.supreme && b.supreme.id === 'viking' && b.supreme.title === 'The Last Viking' && b.supreme.n === 1 && b.supreme.of === 1 && b.supreme.egg, 'name / Legendary / 1 of 1');
ok(pw(b) === 141, 'power 141 got ' + pw(b)); ok(!b.grantPower, 'not in the grant power sweep'); ok(K.every(k => b.stats[k] >= 1 && b.stats[k] <= 30), 'stats 1..30');
ok(!Object.values(w.items).some(g => g.owner === TO && g.from === 'viking'), 'no gear granted (axe and shield are drawn on him)');
ok(V.breederBadges(w, b).some(x => x.id === 'supreme-viking' && x.name === 'The Last Viking' && /1 of 1/.test(x.tip)), '1 of 1 badge'); ok(V.speciesLabel ? V.speciesLabel('viking') === 'Viking' : true, 'species label');
ok(run(c, s, [], G + 50).pets.filter(p => p.species === 'viking').length === 1, 'granted once');
/* GROW / FIGHT / HOLD: one PET:FEED per day from the owner */
const feeds = []; for (let d = 0; d < 13; d++) feeds.push(row(G + 1 + d * DAY, TO, 1e6, 'PET:FEED:' + b.id));
const wf = run(c, s, feeds, END), h = wf.byId[b.id];
ok(h && h.stage === 5, 'grows to Mythic by normal feeding (stage ' + (h && h.stage) + ')'); ok(h && h.species === 'viking' && h.tier === 3 && pw(h) >= 141, 'keeps species / tier');
ok(V.breedable(h, END) === null, 'can breed (' + V.breedable(h, END) + ')'); ok(V.fightable(h, END) === null, 'can fight (' + V.fightable(h, END) + ')');
{ const ids = [].concat(...['BANDS', 'ARMORS', 'CAPES', 'WEAPONS', 'CROWNS'].map(k => (P[k] || []).map(x => x.id)), (c.BonusGear.ITEMS || []).map(x => x.id), (c.V2Gear.ITEMS || []).map(x => x.id)), items = ids.map(i => V.itemOf(i)).filter(Boolean), slots = {};
  items.forEach(it => { if (V.eligible(it, 'viking', V.bodyOf ? V.bodyOf(h) : null, 3)) slots[it.slot] = 1; }); ok(['head', 'face', 'body', 'hand'].every(k => slots[k]), 'can equip head/face/body/hand gear (' + Object.keys(slots).join('/') + ')');
  let gOk = 0, gN = 0; items.filter(it => V.eligible(it, 'viking', null, 3)).slice(0, 60).forEach(it => { gN++; try { const f = R.framesWith(h.art, 4, [it.id], []); if (f && f.length >= 1) gOk++; } catch (e) { ok(false, 'gear ' + it.id + ' ' + e.message); } }); ok(gN > 0 && gOk === gN, 'gear renders on him ' + gOk + '/' + gN); }
/* SPRITE: every stage, 4 frames, 32x32; no fire aura, no flame crown, no gold frame (no flame/gold pixels anywhere) */
const VS = require('../js/viking-sprite.js'); for (let st = 0; st <= 5; st++) { const f = VS.frames(st, '#1b2430', {}); ok(f.length === 4 && f[0].data.length === 4096, 'sprite stage ' + st);
  const fr = R.framesWith(Object.assign({}, h.art, { species: 'viking' }), st, [], []); ok(fr && fr.length >= 1, 'render stage ' + st);
  let gold = 0; for (let q = 0; q < 4096; q += 4) { const r = f[0].data[q], g = f[0].data[q + 1], bl = f[0].data[q + 2]; if (r > 200 && g > 150 && g < 225 && bl < 90) gold++; } ok(gold === 0, 'no gold/flame pixels stage ' + st + ' (' + gold + ')'); }
/* BREEDING: every baby of the Viking line keeps the viking root (hybrid), never a 1 of 1, never a second pure Viking; the signature part carries over */
const wb = JSON.parse(JSON.stringify(wf)); wb.byId = {}; wb.pets.forEach(p => { wb.byId[p.id] = p; }); const vk = wb.byId[b.id]; vk.stage = 3; vk.care = 999;
const clone = () => { const ww = JSON.parse(JSON.stringify(wb)); ww.byId = {}; ww.pets.forEach(p => { ww.byId[p.id] = p; }); return ww; };
const live = wb.pets.filter(p => !p.dead && !p.released && !p.community && !p.supreme && !p.burnLord && !p.contest && p.species !== 'viking');
const partners = {}; live.forEach(p => { const sp = p.species, k = /^hyb3:/.test(sp) ? '3way' : /^hyb/.test(sp) ? 'hybrid' : sp; if (!partners[k]) partners[k] = p; });
let nb = 0, sig = 0; const kids = [];
Object.keys(partners).forEach((k, i) => { const P2 = partners[k]; for (let r = 0; r < 3; r++) { const ww = clone(), kid = V.breed(ww, ww.byId[vk.id], ww.byId[P2.id], fakeHash(END + i * 7 + r), 'test:vk' + k + r, END, vk.owner); nb++; /* breed = breedOne + breedExtras (lookFix) */
  ok(V.isHybrid(kid.species) && /(^|:)viking(:|$)/.test(kid.species), k + ': Viking hybrid baby (' + kid.species + ')'); ok(kid.species !== 'viking' && !kid.supreme && !kid.contest, k + ': not a Viking 1 of 1');
  if (k === '3way') ok(V.isHybrid3 ? V.isHybrid3(kid.species) : /^hyb3:/.test(kid.species), '3-way partner gives a 3-way (' + kid.species + ')');
  const pl = kid.art.hybrid; ok(pl && (pl.parts || []).length >= 1, k + ': has a hybrid part (' + JSON.stringify(pl && pl.parts) + ')');
  if (pl && (pl.parts || []).some(q => q.sp === 'viking') || (pl && pl.shape === 'viking')) sig++;
  ok(kid.lookFix === 1, k + ': Viking line uses the audited hybrid fixes'); ok(V.hybridName(kid.species) && !/undefined|null/.test(V.hybridName(kid.species)), k + ': name ' + V.hybridName(kid.species));
  for (let st = 0; st <= 5; st++) { let fr; try { fr = R.framesWith(kid.art, st, [], []); } catch (e) { ok(false, k + ' render st' + st + ' ' + e.message); continue; } ok(fr && fr.length >= 1 && fr[0].data.length === 4096, k + ' frames st' + st); }
  kids.push(kid); } });
ok(sig === nb, 'every baby carries a Viking signature (helmet/horns, beard or Viking body): ' + sig + '/' + nb);
/* generations: a Viking-line baby bred with a non-Viking pet still keeps the viking root */
{ const ww = clone(), P2 = partners.pepe || partners[Object.keys(partners)[0]]; let par = V.breedOne(ww, ww.byId[vk.id], ww.byId[P2.id], fakeHash(END + 901), 'test:g1', END, vk.owner);
  for (let g = 2; g <= 4; g++) { par.stage = 3; par.care = 999; ww.byId[par.id] = par; const mate = live.find(p => p.id !== P2.id && !V.isHybrid(p.species)) || P2;
    const kid = V.breedOne(ww, par, ww.byId[mate.id], fakeHash(END + 901 + g), 'test:g' + g, END + g * 300, vk.owner); ok(/(^|:)viking(:|$)/.test(kid.species), 'generation ' + g + ' keeps the viking root (' + kid.species + ')'); par = kid; } }
/* non-Viking breeding is untouched */ { const ww = clone(), P2 = partners.pepe || partners[Object.keys(partners)[0]], m = live.find(p => p.species === P2.species && p.id !== P2.id), kid = V.breedOne(ww, ww.byId[P2.id], ww.byId[m.id], fakeHash(END), 'test:nb', END, P2.owner); ok(!/viking/.test(kid.species), 'non-Viking parents never make a Viking hybrid'); }
console.log('Viking #' + b.id + ' stats ' + JSON.stringify(b.stats) + ' power ' + pw(b) + '; babies bred: ' + nb + ' partners ' + Object.keys(partners).join(','));
if (process.env.VK_SHEET) require('fs').writeFileSync(process.env.VK_SHEET, JSON.stringify(kids.filter((x, i) => i % 3 === 0).map(x => ({ sp: x.species, name: V.hybridName(x.species), frames: [1, 3, 5].map(st => Array.from(R.framesWith(x.art, st, [], [])[0].data)) }))));
console.log(pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
