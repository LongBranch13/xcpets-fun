/* Roster gear-fit audit (display only). Renders every sprite base in each gear slot
 * through the live V2Render path and writes nearest-neighbour contact sheets.
 * Does not change rules, replays, or sprites. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), zlib = require('zlib'), crypto = require('crypto');
const { load } = require('../../tools/lib/load-rules');
const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DESIGN = __dirname;
const OUT_ART = '/opt/cursor/artifacts/gear-audit';
const SCALE = 4;
const STAGES = [1, 2, 3, 4, 5];
const STAGE_NAME = { 1: 'Hatchling', 2: 'Juvenile', 3: 'Adult', 4: 'Elder', 5: 'Mythic' };
const ORDER = ['pepe', 'wojak', 'chud', 'chad', 'bobo', 'mumu', 'snibby', 'dodo', 'kevin', 'peepo', 'sarutobi', 'doge', 'lenny', 'nakamoto', 'kek', 'wizard', 'funtrump', 'homer', 'rabbit', 'viking', 'djpepe', 'orangedragon', 'bojackson', 'rarepigeon', 'jacksonpepe', 'starlordkek', 'gooby', 'lukespam'];
const LABEL = { pepe: 'Pepe', wojak: 'Wojak', chud: 'Chud', chad: 'Chad', bobo: 'Bobo', mumu: 'Mumu', snibby: 'Snibby', dodo: 'Dodo', kevin: 'Kevin', peepo: 'Peepo', sarutobi: 'Sarutobi', doge: 'Doge', lenny: 'Lenny', nakamoto: 'Nakamoto', kek: 'Lord Kek', wizard: 'Wizard', funtrump: 'Funtrump', homer: 'Homer', rabbit: 'Rabbit', viking: 'Viking', djpepe: 'DJ Pepe', orangedragon: 'Dragon', bojackson: 'Bo Jackson', rarepigeon: 'Rarepigeon', jacksonpepe: 'Old Hickory', starlordkek: 'Star-Lord', gooby: 'Gooby', lukespam: 'Luke Spam' };

const FONT = {
  A: ['.#.', '#.#', '###', '#.#', '#.#'], B: ['##.', '#.#', '##.', '#.#', '##.'], C: ['.##', '#..', '#..', '#..', '.##'],
  D: ['##.', '#.#', '#.#', '#.#', '##.'], E: ['###', '#..', '##.', '#..', '###'], F: ['###', '#..', '##.', '#..', '#..'],
  G: ['.##', '#..', '#.#', '#.#', '.##'], H: ['#.#', '#.#', '###', '#.#', '#.#'], I: ['###', '.#.', '.#.', '.#.', '###'],
  J: ['.##', '..#', '..#', '#.#', '.#.'], K: ['#.#', '##.', '#..', '##.', '#.#'], L: ['#..', '#..', '#..', '#..', '###'],
  M: ['#.#', '###', '#.#', '#.#', '#.#'], N: ['###', '#.#', '#.#', '#.#', '#.#'], O: ['.#.', '#.#', '#.#', '#.#', '.#.'],
  P: ['##.', '#.#', '##.', '#..', '#..'], Q: ['.#.', '#.#', '#.#', '##.', '..#'], R: ['##.', '#.#', '##.', '#.#', '#.#'],
  S: ['.##', '#..', '.#.', '..#', '##.'], T: ['###', '.#.', '.#.', '.#.', '.#.'], U: ['#.#', '#.#', '#.#', '#.#', '###'],
  V: ['#.#', '#.#', '#.#', '#.#', '.#.'], W: ['#.#', '#.#', '#.#', '###', '#.#'], X: ['#.#', '#.#', '.#.', '#.#', '#.#'],
  Y: ['#.#', '#.#', '.#.', '.#.', '.#.'], Z: ['###', '..#', '.#.', '#..', '###'],
  '0': ['.#.', '#.#', '#.#', '#.#', '.#.'], '1': ['.#.', '##.', '.#.', '.#.', '###'], '2': ['##.', '..#', '.#.', '#..', '###'],
  '3': ['##.', '..#', '##.', '..#', '##.'], '4': ['#.#', '#.#', '###', '..#', '..#'], '5': ['###', '#..', '##.', '..#', '##.'],
  '6': ['.#.', '#..', '##.', '#.#', '.#.'], '7': ['###', '..#', '.#.', '.#.', '.#.'], '8': ['.#.', '#.#', '.#.', '#.#', '.#.'],
  '9': ['.#.', '#.#', '.##', '..#', '.#.'], ' ': ['...', '...', '...', '...', '...'], '-': ['...', '...', '###', '...', '...'],
  '+': ['.#.', '###', '.#.', '...', '...'], '/': ['..#', '.#.', '.#.', '#..', '...'], '.': ['...', '...', '...', '...', '.#.'],
  '(': ['.#.', '#..', '#..', '#..', '.#.'], ')': ['.#.', '..#', '..#', '..#', '.#.'], ':': ['...', '.#.', '...', '.#.', '...']
};

function loadGame() {
  const extra = ['js/wizard-sprite.js', 'js/kek-sprite.js', 'js/funtrump-sprite.js', 'js/homer-sprite.js', 'js/rabbit-sprite.js', 'js/djpepe-sprite.js', 'js/viking-sprite.js', 'js/dragon-sprite.js', 'js/bo-sprite.js', 'js/rarepigeon-sprite.js', 'js/jackson-sprite.js', 'js/contest-sprite.js', 'js/v2-clown-hair.js'];
  const c = load(extra);
  c.setInterval = () => 0; c.clearInterval = () => {}; c.requestAnimationFrame = () => 0; c.cancelAnimationFrame = () => {};
  c.ImageData = function ImageData(data, w, h) { this.data = data; this.width = w; this.height = h; };
  c.document.readyState = 'loading';
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/v2-render.js'), 'utf8'), c, { filename: 'js/v2-render.js' });
  return c;
}

const C = loadGame();
const V = C.V2Rules, R = C.V2Render, BG = C.BonusGear, PC = C.PetCore;
const GEAR = Object.keys(V.GEAR_BY_ID).map(id => V.GEAR_BY_ID[id]).filter(g => g && g.id && g.id !== 'none');
function def(id) { return (BG && BG.DEFS && BG.DEFS[id]) || {}; }
function bandType(id) { const b = (PC.BANDS || []).filter(x => x.id === id)[0]; return b ? b.type : null; }

function artFor(id) {
  let art;
  try { art = Object.assign({}, PC.characterPet(id, { bgColor: '#ff00fe', background: 'solid' })); }
  catch (e) { art = { species: id, pattern: 'none', eyes: 'classic', tier: 'legendary', tierIndex: 3, cheeks: false }; }
  art.species = id; art.background = 'solid'; art.bgColor = '#ff00fe'; art.pattern = 'none';
  if (!art.eyes) art.eyes = 'classic';
  return art;
}
function hybridArt(shape, color, parts) {
  const art = artFor(shape);
  art.species = shape;
  art.hybrid = { key: 'hyb:' + shape + ':' + color, roots: [shape, color], a: shape, b: color, shape: shape, color: color, parts: parts || [], feature: 'side', fix: 1, name: LABEL[shape] + ' x ' + LABEL[color] };
  return art;
}

const cache = new Map();
function pxbuf(data) { const b = Buffer.alloc(4096); for (let i = 0; i < 4096; i++) b[i] = data && data[i] ? data[i] & 255 : 0; return b; }
function render(art, stage, item) {
  const key = (art.species || '?') + '|' + (art.hybrid ? JSON.stringify(art.hybrid.parts) + art.hybrid.color : '') + '|' + stage + '|' + (item || '');
  if (cache.has(key)) return cache.get(key);
  let out;
  try {
    const fr = R.framesWith(art, stage, item ? [item] : [], [], 5);
    if (!fr || !fr[0] || !fr[0].data || fr[0].data.length < 4096) throw new Error('no frame');
    out = { ok: true, data: pxbuf(fr[0].data) };
  } catch (e) { out = { ok: false, err: String(e && e.message || e).slice(0, 80), data: Buffer.alloc(4096) }; }
  cache.set(key, out);
  return out;
}

function isKey(b, i) { return b[i] > 250 && b[i + 1] < 8 && b[i + 2] > 248; }
function silBox(b) {
  let minX = 32, minY = 32, maxX = -1, maxY = -1;
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) { const i = (y * 32 + x) * 4; if (isKey(b, i)) continue; if (x < minX) minX = x; if (y < minY) minY = y; if (x > maxX) maxX = x; if (y > maxY) maxY = y; }
  return { minX, minY, maxX, maxY, w: maxX - minX + 1, h: maxY - minY + 1, empty: maxX < 0 };
}
function rowWidth(b, y) { let n = 0, l = 32, r = -1; if (y < 0 || y > 31) return { n: 0, l: 0, r: 0, w: 0 }; for (let x = 0; x < 32; x++) { const i = (y * 32 + x) * 4; if (isKey(b, i)) continue; n++; if (x < l) l = x; if (x > r) r = x; } return { n, l, r, w: r >= l ? r - l + 1 : 0 }; }
function eyeBand(b, box) {
  let top = 99, bot = -1, n = 0, l = 32, r = -1;
  const y1 = Math.min(31, box.minY + Math.max(8, Math.round(box.h * 0.7)));
  for (let y = box.minY; y <= y1; y++) for (let x = box.minX; x <= box.maxX; x++) {
    const i = (y * 32 + x) * 4, R0 = b[i], G0 = b[i + 1], B0 = b[i + 2];
    const white = R0 > 210 && G0 > 210 && B0 > 200;
    const star = R0 > 230 && G0 > 170 && B0 < 90;
    if (!white && !star) continue;
    n++; if (y < top) top = y; if (y > bot) bot = y; if (x < l) l = x; if (x > r) r = x;
  }
  return n >= 2 ? { top, bot, n, l, r, w: r - l + 1 } : null;
}
function mouthY(b, box, eye) {
  const y0 = eye ? eye.bot + 1 : box.minY + 3;
  for (let y = y0; y <= Math.min(31, box.maxY); y++) {
    let reds = 0;
    for (let x = box.minX + 1; x < box.maxX; x++) { const i = (y * 32 + x) * 4; if (b[i] > 140 && b[i] > b[i + 1] + 40 && b[i] > b[i + 2] + 20) reds++; }
    if (reds >= 3) return y;
  }
  return null;
}
/* Interior dark dots between the eyes and the mouth: nostrils, when the sprite has them. */
function nostrils(b, box, eye, mouth) {
  if (!eye || mouth == null || mouth - eye.bot < 2) return null;
  const pts = [];
  for (let y = eye.bot + 1; y < mouth; y++) {
    const rw = rowWidth(b, y);
    for (let x = rw.l + 1; x < rw.r; x++) {
      const i = (y * 32 + x) * 4; if (isKey(b, i)) continue;
      const L = b[i] + b[i + 1] + b[i + 2];
      let brighter = 0, seen = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx > 31 || yy > 31) continue; const j = (yy * 32 + xx) * 4; if (isKey(b, j)) continue; seen++; if (b[j] + b[j + 1] + b[j + 2] > L + 70) brighter++; }
      if (seen >= 4 && brighter >= 4 && L < 280) pts.push([x, y]);
    }
  }
  if (pts.length < 1 || pts.length > 8) return null;
  const ys = pts.map(p => p[1]);
  return { y: Math.round(ys.reduce((s, v) => s + v, 0) / ys.length), n: pts.length, pts };
}
function gearMask(bare, worn) {
  const m = new Uint8Array(1024); let n = 0, minX = 32, minY = 32, maxX = -1, maxY = -1;
  for (let p = 0; p < 1024; p++) {
    const i = p * 4;
    if (bare[i] === worn[i] && bare[i + 1] === worn[i + 1] && bare[i + 2] === worn[i + 2]) continue;
    if (isKey(worn, i) && isKey(bare, i)) continue;
    m[p] = 1; n++;
    const x = p % 32, y = (p / 32) | 0;
    if (x < minX) minX = x; if (y < minY) minY = y; if (x > maxX) maxX = x; if (y > maxY) maxY = y;
  }
  return { m, n, minX, minY, maxX, maxY, w: maxX >= 0 ? maxX - minX + 1 : 0, h: maxY >= 0 ? maxY - minY + 1 : 0 };
}
function minDist(mask, bare) {
  let best = 99, touch = 0;
  for (let p = 0; p < 1024; p++) if (mask.m[p]) {
    const x = p % 32, y = (p / 32) | 0;
    let d = 99;
    for (let dy = -3; dy <= 3 && d > 0; dy++) for (let dx = -3; dx <= 3; dx++) {
      const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx > 31 || yy > 31) continue;
      const j = (yy * 32 + xx) * 4; if (isKey(bare, j)) continue;
      const dd = Math.max(Math.abs(dx), Math.abs(dy)); if (dd < d) d = dd;
    }
    if (d < best) best = d; if (d <= 1) touch++;
  }
  return { best: best === 99 ? null : best, touch };
}
function overlaps(mask, pred) { let n = 0; for (let p = 0; p < 1024; p++) if (mask.m[p] && pred(p % 32, (p / 32) | 0)) n++; return n; }

function measure(bare, worn) {
  const box = silBox(bare), eye = eyeBand(bare, box), mouth = mouthY(bare, box, eye), nose = nostrils(bare, box, eye, mouth);
  const g = gearMask(bare, worn), dist = g.n ? minDist(g, bare) : { best: null, touch: 0 };
  const headW = rowWidth(bare, Math.min(31, box.minY + 2)).w || box.w;
  const clip = g.n ? (g.minX <= 0 || g.maxX >= 31 || g.minY <= 0 || g.maxY >= 31) : false;
  const eyeOverlap = eye ? overlaps(g, (x, y) => y >= eye.top && y <= eye.bot && x >= eye.l - 1 && x <= eye.r + 1) : 0;
  let noseDy = null;
  if (nose && g.n) noseDy = Math.round((g.minY + g.maxY) / 2 - nose.y);
  return { box, eye, mouth, nose, g, dist, headW, clip, eyeOverlap, noseDy };
}

/* Conservative auto flags. The sheet marks these; audit.md keeps the ones a look at the pixels confirmed. */
function judge(family, met) {
  const f = [];
  const g = met.g;
  if (!met.box || met.box.empty) return ['MISS'];
  if (!g.n || g.n < 4) return ['MISS'];
  if (met.clip) f.push('CLIP');
  const gap = met.dist.best;
  if (family === 'hat' || family === 'crown' || family === 'band') {
    if (gap != null && gap > 2) f.push('FLOAT');
    if (met.eye && (met.eyeOverlap >= 2 || g.maxY >= met.eye.top)) f.push('LOW');
    else if (g.maxY < met.box.minY - 1) f.push('HIGH');
    if (family !== 'band' && met.headW && g.w > met.headW + 4) f.push('BIG');
    if (family === 'hat' && met.headW && g.w < met.headW * 0.45 && g.h >= 4) f.push('SML');
    if (family === 'band' && met.mouth != null && (g.minY + g.maxY) / 2 > met.mouth) f.push('NECK');
  } else if (family === 'nose') {
    if (gap != null && gap > 2) f.push('FLOAT');
    if (met.nose && g.maxY < met.nose.y) f.push('HIGH');
    if (met.mouth != null && g.maxY >= met.mouth) f.push('LOW');
    if (met.eye && g.minY <= met.eye.bot && g.maxY >= met.eye.top) f.push('EYE');
  } else if (family === 'eye') {
    if (gap != null && gap > 2) f.push('FLOAT');
    if (met.eye && g.maxY < met.eye.top - 1) f.push('HIGH');
    if (met.eye && g.minY > met.eye.bot + 2) f.push('LOW');
    if (met.headW && g.w > met.headW + 2) f.push('BIG');
  } else if (family === 'mouth') {
    if (gap != null && gap > 2) f.push('FLOAT');
    if (met.mouth != null && g.minY < met.mouth - 2) f.push('HIGH');
    if (met.eye && g.minY <= met.eye.bot) f.push('EYE');
  } else if (family === 'scarf' || family === 'cape') {
    if (gap != null && gap > 3) f.push('FLOAT');
    if (family === 'scarf' && met.mouth != null && g.maxY < met.mouth) f.push('HIGH');
  } else if (family === 'body') {
    if (met.eyeOverlap >= 3) f.push('HIGH');
    if (gap != null && gap > 2) f.push('FLOAT');
    if (g.maxY > met.box.maxY + 1) f.push('LOW');
  } else if (family === 'held' || family === 'weapon') {
    if (gap != null && gap > 3) f.push('FLOAT');
    if (met.mouth != null && g.maxY < met.mouth && g.n > 8 && met.dist.touch > g.n * 0.5) f.push('FACE');
  } else if (family === 'feet') {
    if (gap != null && gap > 2) f.push('FLOAT');
    if (g.maxY < met.box.maxY - 4) f.push('HIGH');
  }
  return f;
}
/* Pale faces and Peepo's eye domes read as "eyes", so a hoop on the snout was marked EYE.
 * refine() keeps the flags that were checked against the pixels. */
function refine(row, pick, stage, met, flags) {
  const raw = String(row.id || '');
  const sp = raw === 'peepo' || raw.indexOf('peepo-') === 0 || raw.indexOf('hyb-peepo') === 0 ? 'peepo' : raw;
  const item = pick && pick.id || '';
  const family = pick && pick.family || '';
  let f = flags.filter(function (x) { return x !== 'EYE'; });
  if (met && met.headW < 6) f = f.filter(function (x) { return x !== 'BIG'; });
  if (sp === 'peepo' && family === 'nose') {
    f = f.filter(function (x) { return x !== 'LOW' && x !== 'HIGH' && x !== 'MISS'; });
    f.push(item === 'v2-diamond-stud' ? 'MISS' : 'HIGH');
  }
  if (sp === 'doge' && family === 'nose') { f = f.filter(function (x) { return x !== 'HIGH'; }); if (f.indexOf('LOW') < 0 && f.indexOf('MISS') < 0) f.push('LOW'); }
  if (sp === 'snibby' && family === 'nose' && stage >= 3) { f = f.filter(function (x) { return x !== 'LOW'; }); if (f.indexOf('HIGH') < 0) f.push('HIGH'); }
  if (sp === 'dodo' && family === 'nose') f = f.filter(function (x) { return x !== 'LOW' && x !== 'HIGH'; });
  if (sp === 'kevin' && family === 'nose') f = f.filter(function (x) { return x !== 'LOW'; });
  if ((sp === 'pepe' || sp === 'mumu' || sp === 'lenny') && family === 'nose' && stage >= 3) { f = f.filter(function (x) { return x !== 'HIGH'; }); if (f.indexOf('LOW') < 0 && f.indexOf('MISS') < 0) f.push('LOW'); }
  if (['kek', 'wizard', 'funtrump', 'homer', 'rabbit', 'viking', 'bojackson', 'rarepigeon', 'jacksonpepe', 'starlordkek', 'gooby', 'lukespam', 'sarutobi'].indexOf(sp) >= 0 && family === 'nose') f = ['MISS'];
  if ((sp === 'djpepe' || sp === 'orangedragon') && family === 'nose') { f = f.filter(function (x) { return x !== 'LOW'; }); if (f.indexOf('MISS') < 0 && f.indexOf('HIGH') < 0) f.push('HIGH'); }
  const out = []; f.forEach(function (x) { if (out.indexOf(x) < 0) out.push(x); }); return out;
}

function ownItems(pred, species) {
  return GEAR.filter(g => pred(g) && g.origin === species);
}
function prefer(list) {
  const sig = list.filter(g => g.sig || g.exclusive);
  return (sig[0] || list[0] || null);
}
function isHat(g) {
  const d = def(g.id);
  if (g.slot !== 'head') return false;
  if (g.kind === 'band' || g.kind === 'crown' || g.coreSlot === 'band' || g.coreSlot === 'crown') return false;
  if (d.kind === 'band' || d.kind === 'crown') return false;
  return d.at === 'head' || d.at === 'headset' || d.v2snug || g.kind === 'hat';
}
function isBand(g) {
  if (g.slot !== 'head') return false;
  const d = def(g.id);
  if (g.kind === 'band' || d.kind === 'band') return true;
  return g.coreSlot === 'band' && bandType(g.id) === 'headband';
}
function isEye(g) {
  const d = def(g.id);
  if (g.slot !== 'face') return false;
  if (d.v2eye || d.at === 'eyes' || d.at === 'monocle') return true;
  return false;
}
function isHeld(g) { const d = def(g.id); return g.slot === 'hand' && (g.kind === 'held' || d.at === 'handR' || d.at === 'handL' || d.at === 'mouth'); }
function isWeapon(g) { const d = def(g.id); return g.slot === 'hand' && (g.kind === 'weapon' || g.coreSlot === 'weapon' || d.at === 'tallR'); }

const byId = id => V.GEAR_BY_ID[id];
function shared(id, family) { const g = byId(id); return g ? { id: g.id, label: g.label, family, shared: true } : null; }

function pickFor(species) {
  const hat = prefer(ownItems(isHat, species));
  const band = prefer(ownItems(isBand, species)) || byId('red-headband');
  const eye = prefer(ownItems(isEye, species)) || byId('v2-red-shades');
  const cape = prefer(GEAR.filter(g => g.slot === 'back' && g.origin === species)) || byId('red');
  const body = prefer(GEAR.filter(g => g.slot === 'body' && g.origin === species)) || byId('leather');
  const held = prefer(ownItems(isHeld, species)) || byId('rare-card');
  const weapon = prefer(ownItems(isWeapon, species).filter(g => g.kind === 'weapon' || def(g.id).at === 'tallR' || g.coreSlot === 'weapon')) || byId('wooden-sword');
  const feet = prefer(GEAR.filter(g => g.slot === 'feet' && g.origin === species));
  const cell = (g, family, fallbackNote) => !g ? null : { id: g.id, label: g.label || g.id, family, shared: !g.origin || g.origin !== species, note: fallbackNote || '' };
  return {
    hat: cell(hat, 'hat'),
    band: cell(band, 'band'),
    crown: cell(byId('gold-crown'), 'crown'),
    crown2: cell(byId('v2-crown-tin'), 'crown'),
    nose: cell(byId('v2-gold-nose-ring'), 'nose'),
    eye: cell(eye, 'eye'),
    mouth: cell(byId('v2-gold-grill'), 'mouth'),
    scarf: cell(byId('red-scarf'), 'scarf'),
    cape: cell(cape, 'cape'),
    body: cell(body, 'body'),
    held: cell(held, 'held'),
    weapon: cell(weapon, 'weapon'),
    feet: cell(feet, 'feet')
  };
}

const SHEETS = [
  ['head-hats', 'Headwear — each species own hat', 'hat', 'Hats use the head anchor (brim sits a few rows into the top of the silhouette).'],
  ['head-bands', 'Headwear — headbands', 'band', 'V2 bands copy the red headband footprint. On no-headband species that footprint is a neck scarf.'],
  ['head-crown-gold', 'Headwear — gold crown (shared)', 'crown', 'Core crown. Sits on the species crown anchor (crownSink), not the v2 hat anchor.'],
  ['head-crown-tin', 'Headwear — tin crown (shared v2)', 'crown2', 'Shared v2 crown. Same head anchor as other overlay crowns.'],
  ['face-nose', 'Guise — gold nose ring (shared)', 'nose', 'Small gold hoop. Should sit on or through the nostrils.'],
  ['face-eyewear', 'Guise — eyewear', 'eye', 'Own glasses, visor, or mask. Shared red shades when a species has no eye piece.'],
  ['face-mouth', 'Guise — gold grill (shared)', 'mouth', 'Mouth anchor. Teeth sit on the detected mouth row.'],
  ['neck-scarf', 'Neck — red scarf (shared)', 'scarf', 'Core scarf, drawn on the scarf row.'],
  ['back-capes', 'Drip — cape', 'cape', 'Own cape when the species has one, otherwise the shared red cape.'],
  ['body-outfits', 'Outfits', 'body', 'Own outfit when the species has one, otherwise leather armor.'],
  ['hand-held', 'Grip — held item', 'held', 'Own held piece, otherwise the Rare Pepe card.'],
  ['hand-weapons', 'Grip — weapon', 'weapon', 'Own weapon, otherwise the wooden sword.'],
  ['feet', 'Footwear', 'feet', 'Own footwear. Empty when a sprite has no feet piece.']
];

const ROWS = [];
ORDER.forEach(id => {
  let art;
  try { art = artFor(id); const probe = render(art, 3, null); if (!probe.ok) throw new Error(probe.err); }
  catch (e) { ROWS.push({ id, label: LABEL[id] || id, skip: String(e.message || e) }); return; }
  ROWS.push({ id, label: LABEL[id] || id, art, picks: pickFor(id), kind: 'base' });
});
/* Peepo-bodied hybrids use art.species peepo, so overlay gear is measured on Peepo's anchors. */
[['bobo', [{ sp: 'bobo', part: 'ears' }], 'Peepo body + Bobo ears'], ['wojak', [{ sp: 'wojak', part: 'eyes' }], 'Peepo body + Wojak eyes']].forEach(spec => {
  const art = hybridArt('peepo', spec[0], spec[1]);
  const probe = render(art, 3, null);
  ROWS.push({ id: 'hyb-peepo-' + spec[0], label: spec[2], art, picks: pickFor('peepo'), kind: 'hybrid', skip: probe.ok ? '' : probe.err });
});

/* Extra Peepo head and face pieces, same anchors, so the original complaint is visible piece by piece. */
function extraRow(itemId, family) {
  const g = byId(itemId); if (!g) return;
  const art = artFor('peepo');
  const picks = { extra: { id: g.id, label: g.label || g.id, family } };
  ROWS.push({ id: 'peepo-' + itemId, label: 'Peepo', art, picks, kind: 'peepo-extra', only: 'extra' });
}
['v2-peepo-hat', 'party-hat', 'bino-hat', 'pimp-hat', 'v2-peepo-band', 'clown-hair', 'v2-honk'].forEach(id => extraRow(id, id.indexOf('band') >= 0 ? 'band' : 'hat'));
['v2-gold-nose-ring', 'v2-septum-chain', 'v2-diamond-stud', 'nose-ring', 'v2-mumu-face', 'v2-peepo-face', 'sig-peepo-face'].forEach(id => extraRow(id, id.indexOf('nose') >= 0 || id.indexOf('septum') >= 0 || id === 'v2-mumu-face' ? 'nose' : (id.indexOf('face') >= 0 ? 'eye' : 'nose')));

function anchorTuple(b) {
  const box = silBox(b), eye = eyeBand(b, box);
  return [box.minY, box.maxY, box.minX, box.maxX, eye ? eye.top : -1, eye ? eye.bot : -1].join(',');
}

const records = [];
function cellOf(row, slotKey, stage) {
  if (row.skip) return { flags: ['ERR'], err: row.skip, label: '' };
  const pick = row.picks[slotKey];
  if (!pick) return { flags: ['NONE'], label: 'none', none: true };
  const bare = render(row.art, stage, null);
  const worn = render(row.art, stage, pick.id);
  if (!bare.ok || !worn.ok) return { flags: ['ERR'], err: (worn.err || bare.err || 'render failed'), label: pick.label, item: pick.id, bare: bare.data, worn: worn.ok ? worn.data : bare.data };
  const met = measure(bare.data, worn.data);
  if (row.kind === 'hybrid' && met.eye && met.eye.top < 6) met.eye = null; /* corner badge, not the face */
  const flags = refine(row, pick, stage, met, judge(pick.family, met));
  return { flags, label: pick.label, item: pick.id, shared: !!pick.shared, bare: bare.data, worn: worn.data, met, anc: anchorTuple(bare.data) };
}

/* Which stages actually move the anchor, per base species (bare sprite). */
const anchorNotes = {};
ROWS.filter(r => r.kind === 'base' && !r.skip).forEach(r => {
  const tuples = STAGES.map(s => anchorTuple(render(r.art, s, null).data));
  const uniq = [...new Set(tuples)];
  anchorNotes[r.id] = { tuples, allDiffer: uniq.length === tuples.length, unique: uniq.length };
});

function pngOf(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  const crcTable = pngOf.t || (pngOf.t = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; } return t; })());
  function crc32(buf) { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
  function chunk(type, data) { const t = Buffer.from(type), len = Buffer.alloc(4); len.writeUInt32BE(data.length); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(Buffer.concat([t, data]))); return Buffer.concat([len, t, data, c]); }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

function fill(dst, dw, x, y, w, h, rgb) {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) { if (xx < 0 || yy < 0) continue; const i = (yy * dw + xx) * 4; dst[i] = rgb[0]; dst[i + 1] = rgb[1]; dst[i + 2] = rgb[2]; dst[i + 3] = 255; }
}
function text(dst, dw, dh, str, x, y, rgb, scale) {
  let cx = x;
  const s = String(str || '').toUpperCase();
  for (let k = 0; k < s.length; k++) {
    const g = FONT[s[k]] || FONT[' '];
    for (let row = 0; row < 5; row++) for (let col = 0; col < 3; col++) if (g[row][col] === '#') {
      for (let oy = 0; oy < scale; oy++) for (let ox = 0; ox < scale; ox++) {
        const X = cx + col * scale + ox, Y = y + row * scale + oy; if (X < 0 || Y < 0 || X >= dw || Y >= dh) continue;
        const i = (Y * dw + X) * 4; dst[i] = rgb[0]; dst[i + 1] = rgb[1]; dst[i + 2] = rgb[2]; dst[i + 3] = 255;
      }
    }
    cx += 4 * scale;
  }
  return cx;
}
function blitSprite(dst, dw, dh, src, dx, dy, scale) {
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const si = (y * 32 + x) * 4;
    const key = isKey(src, si);
    const r = key ? 28 : src[si], g = key ? 22 : src[si + 1], b = key ? 40 : src[si + 2];
    for (let oy = 0; oy < scale; oy++) for (let ox = 0; ox < scale; ox++) {
      const X = dx + x * scale + ox, Y = dy + y * scale + oy; if (X < 0 || Y < 0 || X >= dw || Y >= dh) continue;
      const i = (Y * dw + X) * 4; dst[i] = r; dst[i + 1] = g; dst[i + 2] = b; dst[i + 3] = 255;
    }
  }
}
function rect(dst, dw, dh, x, y, w, h, rgb) {
  for (let xx = x; xx < x + w; xx++) { punch(dst, dw, dh, xx, y, rgb); punch(dst, dw, dh, xx, y + h - 1, rgb); }
  for (let yy = y; yy < y + h; yy++) { punch(dst, dw, dh, x, yy, rgb); punch(dst, dw, dh, x + w - 1, yy, rgb); }
}
function punch(dst, dw, dh, x, y, rgb) { if (x < 0 || y < 0 || x >= dw || y >= dh) return; const i = (y * dw + x) * 4; dst[i] = rgb[0]; dst[i + 1] = rgb[1]; dst[i + 2] = rgb[2]; dst[i + 3] = 255; }

const INK = [244, 236, 220], RED = [214, 40, 64], MUTED = [168, 160, 150], OKC = [120, 190, 140], PAPER = [22, 18, 32];
const GUT = 168, CELL = 32 * SCALE + 12, ROW_H = 32 * SCALE + 36, HEAD = 52;

function sheetRows(slotFile) {
  if (slotFile === 'peepo-headgear') return ROWS.filter(r => r.kind === 'peepo-extra' && r.picks.extra && r.picks.extra.family !== 'nose' && r.picks.extra.family !== 'eye');
  if (slotFile === 'peepo-face') return ROWS.filter(r => r.kind === 'peepo-extra' && (r.picks.extra.family === 'nose' || r.picks.extra.family === 'eye'));
  return ROWS.filter(r => r.kind === 'base' || r.kind === 'hybrid');
}

function compose(file, title, blurb, slotKey) {
  const rows = sheetRows(file);
  const W = GUT + STAGES.length * CELL + 16, H = HEAD + rows.length * ROW_H + 36;
  const dst = Buffer.alloc(W * H * 4, 0);
  fill(dst, W, 0, 0, W, H, PAPER);
  text(dst, W, H, title, 8, 8, INK, 2);
  text(dst, W, H, blurb.slice(0, 90), 8, 28, MUTED, 1);
  STAGES.forEach((s, i) => text(dst, W, H, STAGE_NAME[s], GUT + i * CELL, 36, INK, 1));
  rows.forEach((row, ri) => {
    const y = HEAD + ri * ROW_H;
    fill(dst, W, 0, y, W, ROW_H - 4, ri % 2 ? [28, 24, 40] : [24, 20, 36]);
    text(dst, W, H, row.label, 8, y + 8, INK, 2);
    const pick = row.picks && (row.picks[slotKey] || row.picks.extra);
    text(dst, W, H, (pick ? pick.label : row.skip || 'none').slice(0, 20), 8, y + 28, MUTED, 1);
    if (row.kind === 'hybrid') text(dst, W, H, 'PEEPO ANCHORS', 8, y + 44, [255, 196, 96], 1);
    STAGES.forEach((stage, si) => {
      const x = GUT + si * CELL;
      const cell = cellOf(row, row.only || slotKey, stage);
      const flags = (cell.flags || []).filter(f => f !== 'NONE');
      records.push({ sheet: file, species: row.id, label: row.label, stage, stageName: STAGE_NAME[stage], item: cell.item || '', itemLabel: cell.label || '', shared: !!cell.shared, flags, err: cell.err || '', anc: cell.anc || '', noseDy: cell.met && cell.met.noseDy, eyeOverlap: cell.met && cell.met.eyeOverlap, gearW: cell.met && cell.met.g.w, headW: cell.met && cell.met.headW, gearBottom: cell.met && cell.met.g.maxY, eyeTop: cell.met && cell.met.eye && cell.met.eye.top, headTop: cell.met && cell.met.box.minY, nostrilY: cell.met && cell.met.nose && cell.met.nose.y, clip: cell.met && cell.met.clip, dist: cell.met && cell.met.dist.best, gearN: cell.met && cell.met.g.n });
      if (cell.worn) blitSprite(dst, W, H, cell.worn, x, y + 4, SCALE);
      else fill(dst, W, x, y + 4, 32 * SCALE, 32 * SCALE, [40, 32, 48]);
      if (flags.length && flags[0] !== 'NONE') rect(dst, W, H, x - 1, y + 3, 32 * SCALE + 2, 32 * SCALE + 2, RED);
      const tag = flags.filter(f => f !== 'NONE').join(' ') || (cell.none ? 'NONE' : 'OK');
      text(dst, W, H, tag.slice(0, 16), x, y + 8 + 32 * SCALE, tag === 'OK' ? OKC : RED, 1);
    });
  });
  text(dst, W, H, 'RED EDGE = MISFIT. OK = FITS. CODES: LOW HIGH BIG SML CLIP FLOAT NECK MISS FACE.', 8, H - 16, MUTED, 1);
  return pngOf(W, H, dst);
}

fs.mkdirSync(OUT_DESIGN, { recursive: true });
fs.mkdirSync(OUT_ART, { recursive: true });
const written = [];
SHEETS.forEach(s => {
  process.stderr.write('sheet ' + s[0] + '\n');
  const png = compose(s[0], s[1], s[3], s[2]);
  const name = s[0] + '.png';
  fs.writeFileSync(path.join(OUT_DESIGN, name), png);
  fs.writeFileSync(path.join(OUT_ART, name), png);
  written.push(name);
});
[['peepo-headgear', 'Peepo headgear — every head piece', 'Own hats, the shared pimp hat, bands, clown hair.', 'extra'],
 ['peepo-face', 'Peepo guise — nose ring and face pieces', 'Gold hoop, septum, stud, Mumu rings, blush, signature eyes.', 'extra']].forEach(s => {
  process.stderr.write('sheet ' + s[0] + '\n');
  const png = compose(s[0], s[1], s[2], s[3]);
  const name = s[0] + '.png';
  fs.writeFileSync(path.join(OUT_DESIGN, name), png);
  fs.writeFileSync(path.join(OUT_ART, name), png);
  written.push(name);
});

const summary = {};
records.forEach(r => { if (!r.flags.length) return; const k = r.flags.slice().sort().join('+'); summary[k] = (summary[k] || 0) + 1; });
fs.writeFileSync(path.join(OUT_DESIGN, 'metrics.json'), JSON.stringify({ anchorNotes, summary, records }, null, 0));
const md5 = crypto.createHash('md5').update(fs.readFileSync(path.join(ROOT, 'js/v2-rules.js'))).digest('hex');
fs.writeFileSync(path.join(OUT_DESIGN, 'render-log.json'), JSON.stringify({ sheets: written, summary, md5, anchors: anchorNotes, rows: ROWS.map(r => ({ id: r.id, kind: r.kind, skip: r.skip || '', picks: r.picks && Object.keys(r.picks).reduce((o, k) => { const p = r.picks[k]; if (p) o[k] = p.id + ' ' + p.label; return o; }, {}) })) }, null, 2));
console.log('sheets', written.join(', '));
console.log('md5', md5);
console.log('flags', JSON.stringify(summary));
console.log('anchors', JSON.stringify(Object.keys(anchorNotes).reduce((o, k) => { o[k] = anchorNotes[k].unique; return o; }, {})));
