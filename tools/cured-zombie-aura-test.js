#!/usr/bin/env node
/* Cured (Mythic-fed) zombie aura. Display only: a silver, white and red halo plus a small badge.
 * Default badge is the red cross. 'offset' is a shifted red cross on a dark round.
 * Bitcoin red left red, reduced motion holds still, v2-rules.js byte-identical.
 * Does not draw Sabo #1765. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto'), assert = require('assert');
const ROOT = path.resolve(__dirname, '..');
const RULES = 'js/v2-rules.js';
const md5 = crypto.createHash('md5').update(fs.readFileSync(path.join(ROOT, RULES))).digest('hex');
assert.strictEqual(md5, '8e98664087bab2e991680ebdb80ba143', 'v2-rules.js must stay byte-identical');
let pass = 0;
const t = (name, fn) => { fn(); pass++; console.log('ok', name); };
const eq = (a, b) => a && b && a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
const rgb = c => [c[0], c[1], c[2]];
const orange = c => c[0] > 200 && c[1] > 70 && c[1] < 180 && c[2] < 80;
function boot(match) {
  const el = () => ({ style: {}, classList: { add() {}, remove() {}, toggle() {} }, appendChild() {}, setAttribute() {}, addEventListener() {} });
  const win = {
    console, document: { createElement: el, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, head: el(), body: el(), documentElement: el() },
    location: { search: '', hostname: 'localhost', href: 'http://localhost/' },
    navigator: { userAgent: 'node' }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {}, addEventListener() {},
    matchMedia: () => ({ matches: !!match.matches }), MutationObserver: function () { this.observe = () => {}; },
    Uint8ClampedArray, URLSearchParams, URL, TextEncoder, TextDecoder
  };
  win.window = win; win.self = win; win.globalThis = win;
  const ctx = vm.createContext(win);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/v2-mythic-god.js'), 'utf8'), ctx, { filename: 'js/v2-mythic-god.js' });
  return ctx;
}
const stillFlag = { matches: false };
const G = boot(stillFlag).V2MythicGod;
const SILVER = [188, 196, 208], SILVER_HI = [232, 236, 244], WHITE = [255, 255, 255], RED = [214, 32, 40], RED_DEEP = [168, 20, 28], DARK = [36, 32, 48];
const GOLD = [255, 236, 176], TEAL = [112, 214, 198], TEAL2 = [64, 150, 142], CYAN = [96, 236, 255];
const AURA = [SILVER, SILVER_HI, WHITE, RED, RED_DEEP];
const tealish = c => c[1] > 140 && c[2] > 140 && c[1] > c[0] + 20 && c[2] > c[0] + 10;
t('palette is silver, white and red, not orange, gold or teal', () => {
  assert.strictEqual(G.CURED_BADGE, 'cross');
  assert.deepStrictEqual(rgb(G.CURED.silver), SILVER);
  assert.deepStrictEqual(rgb(G.CURED.red), RED);
  assert.deepStrictEqual(rgb(G.CURED.white), WHITE);
  [G.CURED.silver, G.CURED.silverHi, G.CURED.white, G.CURED.red, G.CURED.redDeep, G.CURED.badgeDark].forEach(c => {
    assert.ok(!orange(c), c.join(','));
    assert.ok(!tealish(c), 'teal ' + c.join(','));
    assert.ok(!eq(c, CYAN) && !eq(c, TEAL) && !eq(c, TEAL2) && !eq(c, GOLD));
  });
  assert.ok(G.CURED.red[0] > 180 && G.CURED.red[1] < 50 && G.CURED.red[2] < 60);
});
function disc() {
  const src = new Uint8ClampedArray(4096), ka = new Uint8ClampedArray(4096), kb = new Uint8ClampedArray(4096);
  for (let i = 0; i < 1024; i++) {
    const j = i * 4;
    src[j] = 8; src[j + 1] = 16; src[j + 2] = 40; src[j + 3] = 255;
    ka[j] = 255; ka[j + 1] = 0; ka[j + 2] = 254; ka[j + 3] = 255;
    kb[j] = 0; kb[j + 1] = 255; kb[j + 2] = 1; kb[j + 3] = 255;
  }
  const bodyAt = [];
  for (let y = 8; y < 24; y++) for (let x = 8; x < 24; x++) {
    if ((x - 16) * (x - 16) + (y - 16) * (y - 16) > 36) continue;
    const j = (y * 32 + x) * 4;
    src[j] = 80; src[j + 1] = 200; src[j + 2] = 60; src[j + 3] = 255; /* bright green the old wash treated as hot */
    ka[j] = kb[j] = 80; ka[j + 1] = kb[j + 1] = 200; ka[j + 2] = kb[j + 2] = 60;
    bodyAt.push(j);
  }
  const red = (16 * 32 + 16) * 4, pupil = (14 * 32 + 14) * 4;
  [src, ka, kb].forEach(d => { d[red] = 214; d[red + 1] = 46; d[red + 2] = 40; d[pupil] = 214; d[pupil + 1] = 255; d[pupil + 2] = 168; });
  const fr = [];
  for (let f = 0; f < 4; f++) fr.push({ width: 32, height: 32, data: src, pid: 50982 });
  return { fr, KA: [{ width: 32, height: 32, data: ka }], KB: [{ width: 32, height: 32, data: kb }], red, pupil, bodyAt };
}
function px(d, i) { const j = i * 4; return [d[j], d[j + 1], d[j + 2]]; }
const blob = disc();
stillFlag.matches = false;
const fed = G.zFrames(blob.fr, blob.KA, blob.KB, 'fed', { id: 50982 });
function at(d, x, y) { return px(d, y * 32 + x); }
function auraCount(d) {
  const n = { silver: 0, white: 0, red: 0 };
  for (let i = 0; i < 1024; i++) {
    const x = i % 32, y = (i / 32) | 0;
    if (x >= 26 && y < 5) continue;
    const c = px(d, i);
    if (eq(c, SILVER) || eq(c, SILVER_HI)) n.silver++;
    else if (eq(c, WHITE)) n.white++;
    else if (eq(c, RED) || eq(c, RED_DEEP)) n.red++;
  }
  return n;
}
t('cured aura shimmers in silver, white and red, with no gold or teal fringe', () => {
  assert.ok(fed && fed.length >= 8);
  let off = 0;
  const d = fed[0].data;
  const known = AURA.concat([DARK, [80, 200, 60], [214, 46, 40], [214, 255, 168], [8, 16, 40]]);
  for (let i = 0; i < 1024; i++) {
    const c = px(d, i);
    if (eq(c, GOLD) || eq(c, TEAL) || eq(c, TEAL2) || eq(c, CYAN)) off++;
    if (!known.some(k => eq(c, k))) off++;
  }
  const n = auraCount(d);
  assert.ok(n.silver > 8, 'silver ' + n.silver);
  assert.ok(n.white > 4, 'white ' + n.white);
  assert.ok(n.red > 4, 'red ' + n.red);
  assert.strictEqual(off, 0);
  assert.deepStrictEqual(px(d, 0), [8, 16, 40]);
});
t('the default badge is a red cross on white', () => {
  const d = fed[0].data;
  assert.deepStrictEqual(at(d, 27, 0), WHITE);
  assert.deepStrictEqual(at(d, 31, 4), WHITE);
  assert.deepStrictEqual(at(d, 29, 1), RED);
  assert.deepStrictEqual(at(d, 28, 2), RED);
  assert.deepStrictEqual(at(d, 29, 2), RED);
  assert.deepStrictEqual(at(d, 30, 2), RED);
  assert.deepStrictEqual(at(d, 29, 3), RED);
  assert.deepStrictEqual(at(d, 28, 1), WHITE);
});
t('the offset badge is a shifted red cross on a dark round, not a red cross on white', () => {
  G.CURED_BADGE = 'offset';
  const off = G.zFrames(blob.fr, blob.KA, blob.KB, 'fed', { id: 50982 });
  const d = off[0].data;
  assert.deepStrictEqual(at(d, 27, 0), [8, 16, 40]); /* rounded corner stays the backdrop */
  assert.deepStrictEqual(at(d, 31, 0), [8, 16, 40]);
  assert.deepStrictEqual(at(d, 28, 0), DARK);
  assert.deepStrictEqual(at(d, 30, 1), RED);
  assert.deepStrictEqual(at(d, 29, 2), RED);
  assert.deepStrictEqual(at(d, 30, 2), RED);
  assert.deepStrictEqual(at(d, 31, 2), RED);
  assert.deepStrictEqual(at(d, 30, 3), RED);
  let whiteSq = 0;
  for (let y = 0; y < 5; y++) for (let x = 27; x < 32; x++) if (eq(at(d, x, y), WHITE)) whiteSq++;
  assert.strictEqual(whiteSq, 0);
  G.CURED_BADGE = 'nope';
  const back = G.zFrames(blob.fr, blob.KA, blob.KB, 'fed', { id: 50982 });
  assert.deepStrictEqual(at(back[0].data, 27, 0), WHITE);
  G.CURED_BADGE = 'cross';
});
t('Bitcoin red stays red and the living colours are not repainted', () => {
  const d = fed[0].data;
  assert.deepStrictEqual(px(d, blob.red / 4), [214, 46, 40]);
  assert.ok(!orange(px(d, blob.red / 4)));
  const skin = blob.bodyAt.find(j => j !== blob.red && j !== blob.pupil);
  assert.deepStrictEqual(px(d, skin / 4), [80, 200, 60]);
  assert.deepStrictEqual(px(d, blob.pupil / 4), [214, 255, 168]);
});
t('the halo steps across idle frames, and reduced motion holds one calm frame', () => {
  assert.notDeepStrictEqual(Buffer.from(fed[0].data), Buffer.from(fed[3].data));
  const a0 = auraCount(fed[0].data), a3 = auraCount(fed[3].data);
  assert.ok(a0.silver && a0.white && a0.red);
  assert.ok(a3.silver && a3.white && a3.red);
  stillFlag.matches = true;
  const calm = G.zFrames(blob.fr, blob.KA, blob.KB, 'fed', { id: 50982 });
  assert.deepStrictEqual(Buffer.from(calm[0].data), Buffer.from(calm[3].data));
  const ac = auraCount(calm[0].data);
  assert.ok(ac.silver > 8 && ac.white > 4 && ac.red > 4);
  stillFlag.matches = false;
});
t('a gap through the face is not filled with the outline', () => {
  const src = new Uint8ClampedArray(4096), ka = new Uint8ClampedArray(4096), kb = new Uint8ClampedArray(4096);
  for (let i = 0; i < 1024; i++) {
    const j = i * 4;
    src[j] = 8; src[j + 1] = 16; src[j + 2] = 40; src[j + 3] = 255;
    ka[j] = 255; ka[j + 1] = 0; ka[j + 2] = 254; ka[j + 3] = 255;
    kb[j] = 0; kb[j + 1] = 255; kb[j + 2] = 1; kb[j + 3] = 255;
  }
  for (let y = 10; y < 22; y++) for (let x = 8; x < 24; x++) {
    if (y === 15 && x >= 12 && x <= 20) continue; /* a slot between the eyes, cheeks still on both sides */
    const j = (y * 32 + x) * 4;
    src[j] = 90; src[j + 1] = 140; src[j + 2] = 70;
    ka[j] = kb[j] = 90; ka[j + 1] = kb[j + 1] = 140; ka[j + 2] = kb[j + 2] = 70;
  }
  const fr = [{ width: 32, height: 32, data: src }];
  const out = G.zFrames(fr, [{ data: ka }], [{ data: kb }], 'fed', { id: 12044 });
  const gap = (15 * 32 + 16) * 4;
  assert.deepStrictEqual([out[0].data[gap], out[0].data[gap + 1], out[0].data[gap + 2]], [8, 16, 40]);
});
t('a Mythic zombie keeps the broken grey-blue trace, not the cured halo or badge', () => {
  const mz = G.zFrames(blob.fr, blob.KA, blob.KB, 'mythic', { id: 12044 });
  let curedCol = 0, grey = 0;
  for (let i = 0; i < 1024; i++) {
    const c = px(mz[0].data, i);
    if (eq(c, SILVER) || eq(c, RED) || eq(c, WHITE) || eq(c, TEAL) || eq(c, GOLD)) curedCol++;
    if (eq(c, [70, 80, 100]) || eq(c, [112, 128, 152])) grey++;
  }
  assert.strictEqual(curedCol, 0);
  assert.ok(grey > 10, 'grey ' + grey);
  assert.notDeepStrictEqual(at(mz[0].data, 29, 2), RED);
});
t('lookOf follows isMythicFed and does not invent state', () => {
  const w = { tip: 1, byId: {} };
  const fedPet = { id: 50982, zombie: { mfed: { mythic: 1, block: 2 } } };
  const before = JSON.stringify(fedPet);
  const ctx = boot(stillFlag);
  ctx.V2Rules = { isMythicFed: p => !!(p && p.zombie && p.zombie.mfed && p.zombie.mfed.yes !== false) };
  const see = o => JSON.stringify(o);
  assert.strictEqual(see(ctx.V2MythicGod.lookOf(fedPet, w)), see({ z: 'fed' }));
  fedPet.zombie.mfed.yes = false;
  ctx.V2Rules.isMythicFed = () => false;
  assert.strictEqual(ctx.V2MythicGod.lookOf(fedPet, w), null); /* helper says no, even though mfed is set */
  delete fedPet.zombie.mfed.yes;
  ctx.V2Rules = { isMythicFed: p => !!(p && p.zombie && p.zombie.mfed) };
  assert.strictEqual(ctx.V2MythicGod.lookOf({ id: 12044, zombie: { fedAt: 1 } }, w), null);
  assert.strictEqual(see(ctx.V2MythicGod.lookOf({ id: 12044, zombie: { fedAt: 1 }, mgDead: { by: 1 } }, w)), see({ z: 'mythic' }));
  ctx.V2Rules = { mgView: (w2, p) => ({ fed: !!(p && p.id === 50982) }) };
  assert.strictEqual(see(ctx.V2MythicGod.lookOf(fedPet, w)), see({ z: 'fed' }));
  assert.strictEqual(ctx.V2MythicGod.lookOf({ id: 12044, zombie: { fedAt: 1 } }, w), null);
  assert.ok(!ctx.V2MythicGod.lookOf({ id: 3, mythicGod: { seat: 1 } }).z);
  assert.strictEqual(JSON.stringify(fedPet), before);
  assert.notStrictEqual(50982, 1765);
});
/* full sprite path: pet card / My Pets / places all call V2Render.petFrames */
function bootFull() {
  const el = () => ({ style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } }, appendChild() {}, setAttribute() {}, addEventListener() {}, removeChild() {}, insertBefore() {} });
  const win = {
    console, document: { createElement: t => t === 'canvas' ? { width: 32, height: 32, getContext: () => null, style: {}, classList: el().classList } : el(), getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, head: el(), body: el(), documentElement: el(), hidden: false },
    location: { search: '', hostname: 'localhost', href: 'http://localhost/' },
    navigator: { userAgent: 'node' }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {}, addEventListener() {},
    matchMedia: () => ({ matches: false }), MutationObserver: function () { this.observe = () => {}; },
    Uint8ClampedArray, URLSearchParams, URL, TextEncoder, TextDecoder, innerWidth: 1280, devicePixelRatio: 1
  };
  win.window = win; win.self = win; win.globalThis = win;
  const ctx = vm.createContext(win);
  for (const f of ['rjs/config.js', 'rjs/pet-core.js', 'rjs/game-core.js', 'rjs/bonus-gear.js', 'js/pet-core.js', 'js/bonus-gear.js', 'js/v2-gear.js', 'js/v2-fit.js', 'js/v2-rules.js', 'js/v2-render.js', 'js/v2-zombie-look.js', 'js/v2-zombies.js', 'js/v2-mythic-god.js']) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  }
  return ctx;
}
const full = bootFull();
let mythCalls = 0;
const myth0 = full.V2Render.mythFx;
full.V2Render.mythFx = function () { mythCalls++; return myth0.apply(this, arguments); };
function peepo(id, fedFlag) {
  assert.notStrictEqual(id, 1765);
  const art = full.PetCore.generate({ blockHash: 'ab'.repeat(32), petId: String(id), blockHeight: 973397 });
  art.species = 'peepo'; art.background = 'solid'; art.bgColor = '#14203a'; art.pattern = 'none';
  const p = { id, name: id === 50982 ? 'Voogobo' : 'Zedling', species: 'peepo', stage: 5, stageName: 'Mythic', care: 69069, art, hatchBlock: 973397, zombie: { fedAt: 974000 } };
  if (fedFlag) p.zombie.mfed = { block: 974800, mythic: 42, took: 30 };
  return p;
}
function countSilver(fr) { let n = 0; const d = fr[0].data; for (let i = 0; i < 1024; i++) if (eq(px(d, i), SILVER) || eq(px(d, i), SILVER_HI)) n++; return n; }
t('petFrames: cured Peepo is the living sprite plus the aura; a normal zombie stays dead', () => {
  const w = p => ({ items: {}, pets: [p], byId: { [p.id]: p }, tip: 975606 });
  const alive = peepo(50982, false); delete alive.zombie;
  alive.stage = 2; alive.stageName = 'Juvenile'; alive.care = 69;
  const curedPet = peepo(50982, true);
  curedPet.art = alive.art; curedPet.stage = 2; curedPet.stageName = 'Juvenile'; curedPet.care = 69;
  const aliveFr = full.V2Render.petFrames(alive, w(alive), { noHunger: true });
  mythCalls = 0;
  const curedFr = full.V2Render.petFrames(curedPet, w(curedPet), { noHunger: true });
  const curedCalls = mythCalls;
  let bodyDiff = 0, auraPx = 0;
  const auraCol = c => AURA.some(k => eq(c, k)) || eq(c, DARK);
  for (let i = 0; i < 1024; i++) {
    const a = px(aliveFr[0].data, i), c = px(curedFr[0].data, i);
    if (eq(a, c)) continue;
    if (auraCol(c)) auraPx++; else bodyDiff++;
  }
  assert.strictEqual(bodyDiff, 0, 'living face and colours stay; only the aura and badge are added');
  assert.ok(auraPx > 20, 'aura pixels ' + auraPx);
  assert.ok(countSilver(curedFr) > 8);
  assert.deepStrictEqual(at(curedFr[0].data, 29, 2), RED);
  assert.deepStrictEqual(at(curedFr[0].data, 27, 0), WHITE);
  mythCalls = 0;
  const norm = peepo(12044, false);
  const normFr = full.V2Render.petFrames(norm, w(norm), { noHunger: true });
  assert.notDeepStrictEqual(at(normFr[0].data, 29, 1), RED);
  assert.strictEqual(curedCalls, 0);
  assert.ok(mythCalls > 0, 'normal zombie still takes the electric aura');
  let deadTint = 0;
  for (let i = 0; i < 1024; i++) if (!eq(px(normFr[0].data, i), px(aliveFr[0].data, i))) deadTint++;
  assert.ok(deadTint > 30, 'a normal zombie is still the dead look');
  assert.strictEqual(full.V2Zombies.cured(curedPet, w(curedPet)), true);
  assert.strictEqual(full.V2Zombies.cured(norm, w(norm)), false);
  full.V2MythicGod.CURED_BADGE = 'offset';
  const offFr = full.V2Render.petFrames(curedPet, w(curedPet), { noHunger: true });
  assert.deepStrictEqual(at(offFr[0].data, 30, 2), RED);
  assert.notDeepStrictEqual(at(offFr[0].data, 27, 0), WHITE);
  full.V2MythicGod.CURED_BADGE = 'cross';
});
t('rules file and replay worker are not part of this display change', () => {
  assert.strictEqual(crypto.createHash('md5').update(fs.readFileSync(path.join(ROOT, RULES))).digest('hex'), '8e98664087bab2e991680ebdb80ba143');
  const src = fs.readFileSync(path.join(ROOT, 'js/v2-mythic-god.js'), 'utf8');
  assert.ok(!src.includes('isHot'));
  assert.ok(!src.includes('255, 236, 176') && !src.includes('112, 214, 198') && !src.includes('64, 150, 142'));
  assert.ok(!/heart/i.test(src));
});
console.log('ALL PASS (' + pass + ')');
