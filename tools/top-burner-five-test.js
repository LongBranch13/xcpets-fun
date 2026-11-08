#!/usr/bin/env node
/* TOP BURNER FIVE tests (branch top-burner-five-1107). Gate null = no pets (replay SAME).
 * With the gate set in memory: five Legendary eggs to the #1 burner, distinct powers, breed / fight / gear,
 * and the art + frame checks (every stage, idle and action frames, gear clears the eyes, dead greys, zombie rises).
 *   node tools/top-burner-five-test.js */
'use strict';
const { load, snap, run } = require('./lib/load-rules');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const c = load(['js/topburner-sprites.js', 'js/kek-sprite.js', 'js/wizard-sprite.js', 'js/funtrump-sprite.js', 'js/viking-sprite.js', 'js/dragon-sprite.js', 'js/v2-zombie-look.js']);
const V = c.V2Rules, P = c.PetCore, K = P.STAT_KEYS, S = c.TopBurnerSprites, Z = c.V2ZombieLook;
const s0 = snap(), H = Object.assign({}, c.XCPETS_BLOCK_HASHES, s0.hashes);
const pw = p => K.reduce((a, k) => a + p.stats[k], 0);
const TO = 'bc1qs88hlk930p8l6h5s2svcrvzd45ny2pn54y0j6n';
const IDS = ['yeti', 'sasquatch', 'greypepe', 'chupacabra', 'starman'];
ok(V.ACTIVATE_TOP_BURNER_FIVE_BLOCK == null, 'gate is off');
ok(V.TOP_BURNER_TO === TO, 'grant wallet is the verified #1 burner');
ok(V.VIKING_NAME === 'Ragnar Kekbeard', 'Ragnar is untouched');
const tip = Math.max.apply(null, s0.rows.map(r => r.block_index).filter(b => H[b]));
const snapR = { tip, rows: s0.rows.filter(r => r.block_index <= tip), hashes: s0.hashes };
const w0 = run(c, snapR, [], tip);
ok(!w0.pets.some(p => IDS.indexOf(p.species) >= 0), 'no top-burner pets while the gate is off');
V._setTopBurnerFive(tip);
const w = run(c, snapR, [], tip), got = w.pets.filter(p => IDS.indexOf(p.species) >= 0);
ok(got.length === 5, 'exactly five (' + got.length + ')');
const seen = {};
IDS.forEach(id => { const p = got.filter(q => q.species === id)[0], D = V.TOP_BURNER_FIVE[id];
  ok(!!p, id + ' granted'); if (!p) return; seen[p.id] = 1;
  ok(p.owner === TO, id + ' owner');
  ok(p.name === D.name && p.tier === 3 && p.stage === 0 && p.supreme && p.supreme.of === 1 && p.supreme.id === id, id + ' Legendary 1 of 1 egg');
  ok(pw(p) === D.power, id + ' power ' + D.power + ' (got ' + pw(p) + ')');
  ok(V.speciesLabel(id) === D.name, id + ' species label');
  ok(V.breedable(Object.assign({}, p, { stage: 3 }), tip + 200) === null, id + ' can breed once Adult');
  ok(V.fightable(Object.assign({}, p, { stage: 3 }), tip + 200) === null, id + ' can fight once Juvenile+');
  ok(!p.grantPower, id + ' keeps its fixed power (not the 155-160 sweep)'); });
ok(Object.keys(seen).length === 5, 'five distinct ids');
ok(run(c, snapR, [], tip).pets.filter(p => IDS.indexOf(p.species) >= 0).length === 5, 'grant fires once');
/* a baby of one of these is a normal pet, never a second pure 1 of 1 */
const adult = Object.assign({}, got[0], { stage: 3 }), partner = w.pets.filter(p => p && !p.dead && !p.released && p.species === 'pepe' && p.stage >= 3)[0];
if (partner) { const kid = V.breedOne(w, adult, partner, H[tip] || 'ab', 'tb5-breed', tip + 300, adult.owner);
  ok(kid && kid.species !== 'yeti' && !kid.supreme && kid.stage === 0, 'baby is a normal pet (' + (kid && kid.species) + ')'); }
/* art test: every species, every stage, pixels inside the frame, a body, no fire orange, no gold frame ring */
const FIRE = [255, 106, 0], GOLD = [255, 201, 60];
function near(px, i, rgb) { return Math.abs(px[i] - rgb[0]) < 8 && Math.abs(px[i + 1] - rgb[1]) < 8 && Math.abs(px[i + 2] - rgb[2]) < 8; }
console.log('art test');
IDS.forEach(id => { for (let st = 0; st <= 5; st++) { const fr = S.frames(id, st, '#1b2430', {});
  ok(fr.length === 4 && fr.every(f => f.data.length === 4096), 'art ' + id + ' stage ' + st + ' is 4 frames of 32x32');
  const px = fr[0].data; let body = 0, fire = 0, goldRing = 0;
  for (let i = 0; i < px.length; i += 4) { if (px[i] !== 27 || px[i + 1] !== 36 || px[i + 2] !== 48) body++; if (near(px, i, FIRE)) fire++; }
  for (let x = 0; x < 32; x++) if (near(px, x * 4, GOLD) || near(px, (31 * 32 + x) * 4, GOLD)) goldRing++;
  ok(body > 40, 'art ' + id + ' stage ' + st + ' has a body');
  ok(fire === 0, 'art ' + id + ' stage ' + st + ' has no fire pixels');
  if (id === 'starman') { let car = 0; for (let f = 0; f < 4; f++) S.draw(id, st, f, {}).forEach(r => r.forEach(k => { if (k === 'R' || k === 'r' || k === 'L') car++; })); ok(car === 0, 'starman stage ' + st + ' has no car'); }
  ok(goldRing < 8, 'art ' + id + ' stage ' + st + ' has no gold frame');
  if (st > 0) { const g = S.draw(id, st, 0, {}); let eyes = 0; g.forEach(r => r.forEach(k => { if (k === 'E' || k === 'P' || k === 'V') eyes++; })); ok(eyes >= 2, 'art ' + id + ' stage ' + st + ' has eyes'); } } });
/* frame test: idle bob, blink or glint, and the action frame all change pixels. Gear fits and leaves the eyes. */
console.log('frame test');
const GEAR = { head: { label: 'cap', cols: ['#d8433a', '#7a1820'] }, body: { label: 'wrap', cols: ['#2f6fe0', '#1a3a80'] }, back: { label: 'cape', cols: ['#3ddc84', '#145c38'] }, feet: { label: 'boots', cols: ['#6a3a1a'] }, hand: { label: 'stick', cols: ['#8a5a2b', '#c8c8d0'] }, face: { label: 'glasses', cols: ['#141018'] } };
IDS.forEach(id => { for (let st = 1; st <= 5; st++) { const a = S.render(id, st, 0, '#1b2430').data, b = S.render(id, st, 1, '#1b2430').data, c3 = S.render(id, st, 2, '#1b2430').data, d = S.render(id, st, 3, '#1b2430').data;
  const diff = (u, v) => { let n = 0; for (let i = 0; i < u.length; i += 4) if (u[i] !== v[i] || u[i + 1] !== v[i + 1] || u[i + 2] !== v[i + 2]) n++; return n; };
  ok(diff(a, b) > 0, 'frame ' + id + ' s' + st + ' bob');
  ok(diff(a, c3) > 0, 'frame ' + id + ' s' + st + ' blink');
  ok(diff(a, d) > 0, 'frame ' + id + ' s' + st + ' action');
  const bare = S.draw(id, st, 0, {}), worn = S.draw(id, st, 0, GEAR);
  let changed = 0, eyes = 0, eyesLeft = 0;
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) { if (bare[y][x] !== worn[y][x]) changed++; if (bare[y][x] === 'E' || bare[y][x] === 'P' || bare[y][x] === 'V') { eyes++; if (worn[y][x] === bare[y][x]) eyesLeft++; } }
  ok(changed > 8, 'gear ' + id + ' s' + st + ' changes the sprite');
  ok(eyesLeft >= Math.min(2, eyes), 'gear ' + id + ' s' + st + ' leaves the eyes (' + eyesLeft + '/' + eyes + ')'); }
  const live = S.render(id, 3, 0, '#1b2430').data, dead = S.render(id, 3, 0, '#1b2430', {}, { dead: true }).data;
  let dull = 0; for (let i = 0; i < live.length; i += 4) { const l1 = live[i] + live[i + 1] + live[i + 2], l2 = dead[i] + dead[i + 1] + dead[i + 2]; if (l1 !== l2) dull++; }
  ok(dull > 30, 'dead ' + id + ' is a different, greyed look');
  if (Z && Z.frame) { const src = S.render(id, 3, 0, '#1b2430').data, ka = S.render(id, 3, 0, '#ff00fe').data, kb = S.render(id, 3, 0, '#00ff01').data;
    let z = null; try { z = Z.frame(src, ka, kb, 11, 0, 4, {}); } catch (e) { z = null; }
    ok(z && z.img && z.img.length === 4096, 'zombie ' + id + ' rises'); } });
V._setTopBurnerFive(null);
console.log(pass + ' pass, ' + fail + ' fail');
process.exit(fail ? 1 : 0);
