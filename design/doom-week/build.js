/* Renders Doom Week item art, showcase swaps and the roster fit sheet. Display only. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), zlib = require('zlib'), { spawnSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..', '..');
const ART = '/opt/cursor/artifacts/doom-week-v3';
const SHOW = path.join(ART, 'showcase');
const PLACES_DIR = path.join(ART, 'places');
const DESIGN = __dirname;
const DESIGN_SHOW = path.join(DESIGN, 'showcase');
[ART, SHOW, DESIGN_SHOW, PLACES_DIR, path.join(ROOT, 'img/doom')].forEach(d => fs.mkdirSync(d, { recursive: true }));

function load() {
  const st = {};
  const win = { console, localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    location: { search: '', href: 'https://xcpets.fun/', hostname: 'xcpets.fun' }, navigator: { userAgent: 'node' },
    setTimeout: () => 0, clearTimeout() {}, URLSearchParams, URL, TextEncoder, TextDecoder, Uint8ClampedArray };
  win.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ getContext: () => null, style: {} }), addEventListener() {}, currentScript: { src: '' }, head: { appendChild() {} }, body: null, documentElement: { style: {} }, readyState: 'loading' };
  win.window = win; win.self = win;
  const c = vm.createContext(win);
  ['js/bonus-gear.js', 'js/v2-fit.js', 'js/pet-core.js', 'js/v2-gear.js', 'js/kek-sprite.js', 'js/wizard-sprite.js', 'js/doom-gear.js'].forEach(f => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), c, { filename: f }));
  return c;
}
const C = load();
const PC = C.PetCore, DG = C.DoomGear;
if (!PC || !DG) throw new Error('renderer failed to load');

function pngOf(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; Buffer.from(rgba.buffer, rgba.byteOffset, rgba.byteLength).copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  const crcTable = pngOf.t || (pngOf.t = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; } return t; })());
  function crc32(buf) { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
  function chunk(type, data) { const t = Buffer.from(type), len = Buffer.alloc(4); len.writeUInt32BE(data.length); const cc = Buffer.alloc(4); cc.writeUInt32BE(crc32(Buffer.concat([t, data]))); return Buffer.concat([len, t, data, cc]); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
function pngRead(file) {
  const buf = fs.readFileSync(file); let o = 8, w = 0, h = 0, type = 6, idat = [];
  while (o < buf.length) { const len = buf.readUInt32BE(o); const kind = buf.slice(o + 4, o + 8).toString(); const data = buf.slice(o + 8, o + 8 + len); o += 12 + len;
    if (kind === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); type = data[9]; }
    else if (kind === 'IDAT') idat.push(data); else if (kind === 'IEND') break; }
  const raw = zlib.inflateSync(Buffer.concat(idat)), bpp = type === 6 ? 4 : 3, out = Buffer.alloc(w * h * 4);
  let p = 0, prev = Buffer.alloc(w * bpp);
  for (let y = 0; y < h; y++) { const f = raw[p++]; const row = Buffer.alloc(w * bpp);
    for (let i = 0; i < row.length; i++) { const x = raw[p++], a = i >= bpp ? row[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
      let v = x; if (f === 1) v = (x + a) & 255; else if (f === 2) v = (x + b) & 255; else if (f === 3) v = (x + ((a + b) >> 1)) & 255; else if (f === 4) { const q = a + b - c, pa = Math.abs(q - a), pb = Math.abs(q - b), pc = Math.abs(q - c); v = (x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255; }
      row[i] = v; }
    for (let x = 0; x < w; x++) { const s = x * bpp, d = (y * w + x) * 4; out[d] = row[s]; out[d + 1] = row[s + 1]; out[d + 2] = row[s + 2]; out[d + 3] = bpp === 4 ? row[s + 3] : 255; }
    prev = row; }
  return { w, h, rgba: out };
}
function scale(src, sw, sh, k) {
  const w = sw * k, h = sh * k, out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const si = ((y / k | 0) * sw + (x / k | 0)) * 4, di = (y * w + x) * 4; out[di] = src[si]; out[di + 1] = src[si + 1]; out[di + 2] = src[si + 2]; out[di + 3] = src[si + 3]; }
  return { w, h, rgba: out };
}
function bufOf(img) { const b = Buffer.alloc(32 * 32 * 4); for (let i = 0; i < b.length; i++) b[i] = img.data[i] & 255; return b; }
function save(file, w, h, rgba) { const png = pngOf(w, h, rgba); fs.writeFileSync(file, png); return png; }
function copyBoth(rel, png) { fs.writeFileSync(path.join(ROOT, rel), png); fs.writeFileSync(path.join(ART, path.basename(rel)), png); fs.writeFileSync(path.join(DESIGN, path.basename(rel)), png); }
const FONT = { A: ['.#.', '#.#', '###', '#.#', '#.#'], B: ['##.', '#.#', '##.', '#.#', '##.'], C: ['.##', '#..', '#..', '#..', '.##'], D: ['##.', '#.#', '#.#', '#.#', '##.'], E: ['###', '#..', '##.', '#..', '###'], F: ['###', '#..', '##.', '#..', '#..'], G: ['.##', '#..', '#.#', '#.#', '.##'], H: ['#.#', '#.#', '###', '#.#', '#.#'], I: ['###', '.#.', '.#.', '.#.', '###'], K: ['#.#', '##.', '#..', '##.', '#.#'], L: ['#..', '#..', '#..', '#..', '###'], M: ['#.#', '###', '#.#', '#.#', '#.#'], N: ['###', '#.#', '#.#', '#.#', '#.#'], O: ['.#.', '#.#', '#.#', '#.#', '.#.'], P: ['##.', '#.#', '##.', '#..', '#..'], R: ['##.', '#.#', '##.', '#.#', '#.#'], S: ['.##', '#..', '.#.', '..#', '##.'], T: ['###', '.#.', '.#.', '.#.', '.#.'], U: ['#.#', '#.#', '#.#', '#.#', '###'], V: ['#.#', '#.#', '#.#', '#.#', '.#.'], W: ['#.#', '#.#', '#.#', '###', '#.#'], Y: ['#.#', '#.#', '.#.', '.#.', '.#.'], '0': ['.#.', '#.#', '#.#', '#.#', '.#.'], '1': ['.#.', '##.', '.#.', '.#.', '###'], '2': ['##.', '..#', '.#.', '#..', '###'], '4': ['#.#', '#.#', '###', '..#', '..#'], ' ': ['...', '...', '...', '...', '...'], '-': ['...', '...', '###', '...', '...'] };
function text(dst, dw, dh, str, x, y, rgb, sc) { let cx = x; String(str || '').toUpperCase().split('').forEach(ch => { const g = FONT[ch] || FONT[' ']; for (let row = 0; row < 5; row++) for (let col = 0; col < 3; col++) if (g[row][col] === '#') for (let oy = 0; oy < sc; oy++) for (let ox = 0; ox < sc; ox++) { const X = cx + col * sc + ox, Y = y + row * sc + oy; if (X < 0 || Y < 0 || X >= dw || Y >= dh) continue; const i = (Y * dw + X) * 4; dst[i] = rgb[0]; dst[i + 1] = rgb[1]; dst[i + 2] = rgb[2]; dst[i + 3] = 255; } cx += 4 * sc; }); }
function blitAt(dst, dw, dh, src, sw, sh, dx, dy, sc) { for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) { const si = (y * sw + x) * 4; for (let oy = 0; oy < sc; oy++) for (let ox = 0; ox < sc; ox++) { const X = dx + x * sc + ox, Y = dy + y * sc + oy; if (X < 0 || Y < 0 || X >= dw || Y >= dh) continue; const i = (Y * dw + X) * 4; dst[i] = src[si]; dst[i + 1] = src[si + 1]; dst[i + 2] = src[si + 2]; dst[i + 3] = src[si + 3]; } } }
function paper(w, h) { const d = Buffer.alloc(w * h * 4); for (let i = 0; i < d.length; i += 4) { d[i] = 16; d[i + 1] = 6; d[i + 2] = 10; d[i + 3] = 255; } return d; }

function silAnchors(data, species) {
  const bg = [data[0], data[1], data[2]];
  let minX = 99, maxX = -1, minY = 99, maxY = -1; const sil = [];
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const i = (y * 32 + x) * 4, on = Math.abs(data[i] - bg[0]) + Math.abs(data[i + 1] - bg[1]) + Math.abs(data[i + 2] - bg[2]) > 36;
    sil.push(on); if (on) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  }
  const isSil = (x, y) => x >= 0 && y >= 0 && x < 32 && y < 32 && !!sil[y * 32 + x];
  const H = 20, top = minY + 1, h = Math.max(1, maxY - minY - 1);
  return { minX, maxX, minY, maxY, eyeL: [Math.round(minX + (maxX - minX) * 0.35), minY + 6, []], eyeR: [Math.round(minX + (maxX - minX) * 0.65), minY + 6, []],
    gear: { armor: [14, 18, 0], cape: 12, scarf: 12 }, row: r => top + Math.floor(Number(r) * h / H), isSil, isFg: isSil, spId: species, stage: 5 };
}
function spriteDoom(mod, id) {
  if (!mod || !mod.frames) return null;
  const frames = [];
  for (let f = 0; f < 4; f++) {
    const src = mod.render ? mod.render(5, f, '#14060c', {}, {}) : mod.frames(5, '#14060c', {}, {})[f];
    const data = new Uint8ClampedArray(src.data);
    const img = { width: 32, height: 32, data };
    DG.install(); DG.dress(img, silAnchors(data, id), id, f);
    frames.push(bufOf(img));
  }
  frames.adult = frames[0];
  return frames;
}
const species = PC.SPECIES.map(s => s.id);
console.log('species', species.join(','));
const doomed = {};
species.forEach(id => {
  const pet = PC.characterPet(id, { tier: 'legendary', background: 'solid', bgColor: '#14060c' });
  const fr = DG.frames(pet, 5);
  if (!fr) { console.log('skip', id); return; }
  doomed[id] = fr.map(bufOf);
  const adult = DG.frames(PC.characterPet(id, { tier: 'legendary' }), 3);
  if (adult) doomed[id].adult = bufOf(adult[0]);
});
[['kek', C.KekSprite], ['wizard', C.WizardSprite]].forEach(pair => { const fr = spriteDoom(pair[1], pair[0]); if (fr) { doomed[pair[0]] = fr; species.push(pair[0]); console.log('sprite', pair[0]); } });

/* theme portraits: mythic frame 0, 32px, replaces img/theme/sp-*.png only while the switch is on */
const swapped = [];
fs.readdirSync(path.join(ROOT, 'img/theme')).filter(f => /^sp-.*\.png$/.test(f)).forEach(f => {
  const id = f.slice(3, -4);
  if (!doomed[id]) { console.log('no doom render for', f); return; }
  const png = pngOf(32, 32, doomed[id][0]);
  fs.writeFileSync(path.join(ROOT, 'img/doom', f), png);
  swapped.push(['img/theme/' + f, 'img/doom/' + f, id]);
});

/* logo 256 and favicon 32 from Pepe */
if (doomed.pepe) {
  const big = scale(doomed.pepe[0], 32, 32, 8);
  fs.writeFileSync(path.join(ROOT, 'img/doom/logo.png'), pngOf(big.w, big.h, big.rgba));
  fs.writeFileSync(path.join(ROOT, 'img/doom/favicon.png'), pngOf(32, 32, doomed.pepe[0]));
  swapped.push(['img/logo.png', 'img/doom/logo.png', 'logo'], ['img/favicon.png', 'img/doom/favicon.png', 'favicon']);
}

/* token: twelve pets around Nakamoto, 512px */
(function token() {
  const ring = ['pepe', 'wojak', 'chud', 'bobo', 'mumu', 'snibby', 'dodo', 'kevin', 'peepo', 'sarutobi', 'doge', 'lenny'].filter(id => doomed[id]);
  const S = 512, sc = 4, dst = paper(S, S);
  if (doomed.nakamoto) blitAt(dst, S, S, doomed.nakamoto[0], 32, 32, (S - 32 * sc) / 2, (S - 32 * sc) / 2, sc);
  ring.forEach((id, i) => { const a = -Math.PI / 2 + i * Math.PI * 2 / ring.length; const cx = S / 2 + Math.cos(a) * 180 - 16 * sc, cy = S / 2 + Math.sin(a) * 180 - 16 * sc; blitAt(dst, S, S, doomed[id][0], 32, 32, cx, cy, sc); });
  fs.writeFileSync(path.join(ROOT, 'img/doom/token.png'), pngOf(S, S, dst));
  swapped.push(['img/xcpets_token.png', 'img/doom/token.png', 'token']);
})();

/* badge */
(function badge() {
  const g = []; for (let i = 0; i < 32; i++) g.push(new Array(32).fill(null));
  function set(x, y, c) { if (x >= 0 && y >= 0 && x < 32 && y < 32) g[y][x] = c; }
  for (let y = 4; y < 26; y++) for (let x = 6; x < 26; x++) set(x, y, '#8e0b20');
  for (let x = 8; x < 24; x++) { set(x, 4, '#c8102e'); set(x, 25, '#1a1020'); }
  for (let y = 6; y < 24; y++) { set(6, y, '#c8102e'); set(25, y, '#1a1020'); }
  [[15, 8, '#fff'], [14, 9, '#ff2a2a'], [15, 9, '#ff2a2a'], [16, 9, '#ff2a2a'], [15, 10, '#c8102e'], [15, 11, '#c8102e'], [15, 12, '#c8102e']].forEach(p => set(p[0], p[1], p[2]));
  for (let x = 10; x < 22; x++) set(x, 18, '#fff');
  const img = Buffer.alloc(32 * 32 * 4); for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) { const c = g[y][x] || '#10080c'; const i = (y * 32 + x) * 4; img[i] = parseInt(c.slice(1, 3), 16); img[i + 1] = parseInt(c.slice(3, 5), 16); img[i + 2] = parseInt(c.slice(5, 7), 16); img[i + 3] = 255; }
  fs.writeFileSync(path.join(ROOT, 'img/doom/badge.png'), pngOf(32, 32, img));
  const z = scale(img, 32, 32, 4); save(path.join(ART, 'badge-4x.png'), z.w, z.h, z.rgba); save(path.join(DESIGN, 'badge-4x.png'), z.w, z.h, z.rgba);
  save(path.join(ART, 'badge-1x.png'), 32, 32, img); save(path.join(DESIGN, 'badge-1x.png'), 32, 32, img);
})();

/* item sprites 1x and 4x */
const itemRow = paper(DG.IDS.length * 160, 80);
DG.IDS.forEach((id, n) => {
  const ic = DG.icon(id); const b = bufOf(ic);
  fs.writeFileSync(path.join(ROOT, 'img/doom', id + '.png'), pngOf(32, 32, b));
  const z1 = scale(b, 32, 32, 1), z4 = scale(b, 32, 32, 4);
  save(path.join(ART, id + '-1x.png'), 32, 32, z1.rgba); save(path.join(DESIGN, id + '-1x.png'), 32, 32, z1.rgba);
  save(path.join(ART, id + '-4x.png'), z4.w, z4.h, z4.rgba); save(path.join(DESIGN, id + '-4x.png'), z4.w, z4.h, z4.rgba);
  blitAt(itemRow, DG.IDS.length * 160, 80, b, 32, 32, n * 160 + 16, 8, 2);
  text(itemRow, DG.IDS.length * 160, 80, id.replace('doom-', '').replace('candle-', ''), n * 160 + 8, 78 - 8, [244, 230, 234], 1);
});
save(path.join(ART, 'items-1x-4x-sheet.png'), DG.IDS.length * 160, 80, itemRow);
save(path.join(DESIGN, 'items-1x-4x-sheet.png'), DG.IDS.length * 160, 80, itemRow);

/* Doom flag beside two game flags, same pole and cloth shape, 1x and 4x. */
(function flags() {
  const VG = C.V2Gear;
  const cols = BGColors();
  function iconOf(map) {
    const h = map.length, w = map[0].length, img = Buffer.alloc(32 * 32 * 4);
    for (let i = 0; i < img.length; i += 4) { img[i] = 16; img[i + 1] = 8; img[i + 2] = 12; img[i + 3] = 255; }
    const x0 = Math.max(0, Math.floor((32 - w) / 2)), y0 = Math.max(0, Math.floor((32 - h) / 2));
    for (let y = 0; y < h; y++) for (let x = 0; x < map[y].length; x++) {
      const k = map[y][x]; if (!k || k === '.' || !cols[k]) continue;
      const X = x0 + x, Y = y0 + y; if (X < 0 || Y < 0 || X > 31 || Y > 31) continue;
      const c = cols[k], i = (Y * 32 + X) * 4; img[i] = c[0]; img[i + 1] = c[1]; img[i + 2] = c[2]; img[i + 3] = 255;
    }
    return img;
  }
  const pair = [['doom', DG.DEFS['doom-flag'].map], ['wagmi', VG.DEFS['v2-wagmi-flag'].map], ['burn', VG.DEFS['v2-burn-banner'].map]];
  const row1 = paper(pair.length * 48, 40), row4 = paper(pair.length * 160, 140);
  pair.forEach((p, n) => {
    const b = iconOf(p[1]);
    const z4 = scale(b, 32, 32, 4);
    save(path.join(ART, p[0] + '-flag-1x.png'), 32, 32, b);
    save(path.join(ART, p[0] + '-flag-4x.png'), z4.w, z4.h, z4.rgba);
    blitAt(row1, pair.length * 48, 40, b, 32, 32, n * 48 + 8, 4, 1);
    blitAt(row4, pair.length * 160, 140, b, 32, 32, n * 160 + 16, 8, 4);
    text(row4, pair.length * 160, 140, p[0], n * 160 + 16, 8, [255, 42, 42], 1);
  });
  save(path.join(ART, 'flags-compare-1x.png'), pair.length * 48, 40, row1);
  save(path.join(ART, 'flags-compare-4x.png'), pair.length * 160, 140, row4);
  save(path.join(DESIGN, 'flags-compare-4x.png'), pair.length * 160, 140, row4);
})();
function BGColors() {
  const C = {}, raw = (typeof global !== 'undefined' && false);
  const hex = { y: '#ffd23f', Q: '#da291c', r: '#b3121a', w: '#ffffff', L: '#8a5a2b', l: '#c8955a', m: '#2f9f5f', Z: '#2b2b33', R: '#ff2a2a', n: '#1a1020' };
  Object.keys(hex).forEach(k => { const h = hex[k]; C[k] = [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; });
  const live = C_BG();
  if (live) Object.keys(live).forEach(k => { const h = String(live[k]); if (h[0] === '#') C[k] = [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; });
  return C;
}
function C_BG() { try { return C.BonusGear && C.BonusGear.COLORS; } catch (e) { return null; } }

/* roster fit sheet: adult, full kit, anchors from v2-fit */
const roster = species.filter(id => doomed[id] && doomed[id].adult);
const CELL = 32 * 3, LABEL = 120, FW = LABEL + CELL + 16, FH = 28 + roster.length * (CELL + 10);
const fit = paper(FW, FH);
text(fit, FW, FH, 'DOOM WEEK FIT', 8, 6, [255, 42, 42], 2);
roster.forEach((id, i) => {
  const y = 28 + i * (CELL + 10);
  text(fit, FW, FH, id, 8, y + 8, [244, 230, 234], 1);
  const spec = C.V2Fit.doomAnchor(id, 'head');
  text(fit, FW, FH, spec.aboveEyes ? 'EYES -' + spec.aboveEyes : 'LIFT ' + (spec.lift || 0), 8, y + 20, [180, 80, 90], 1);
  blitAt(fit, FW, FH, doomed[id].adult, 32, 32, LABEL, y, 3);
});
save(path.join(ART, 'roster-fit-sheet.png'), FW, FH, fit);
save(path.join(DESIGN, 'roster-fit-sheet.png'), FW, FH, fit);
console.log('fit sheet', roster.length, 'species');

/* cast gif frames, 600x376 */
const castIds = roster.filter(id => id !== 'chad').slice(0, 14);
const frameDir = path.join(DESIGN, 'frames'); fs.mkdirSync(frameDir, { recursive: true });
for (let f = 0; f < 4; f++) {
  const W = 600, H = 376, dst = paper(W, H);
  const cols = 5, sc = 3;
  castIds.forEach((id, i) => { const col = i % cols, row = (i / cols) | 0; const x = 16 + col * 116, y = 24 + row * 120; blitAt(dst, W, H, doomed[id][f], 32, 32, x, y, sc); text(dst, W, H, id, x, y + 32 * sc + 4, [244, 230, 234], 1); });
  text(dst, W, H, 'DOOM WEEK', 16, 8, [255, 42, 42], 2);
  save(path.join(frameDir, 'f' + f + '.png'), W, H, dst);
}
const gif = path.join(ROOT, 'img/doom/xcpets-cast.gif');
const webp = path.join(ROOT, 'img/doom/xcpets-cast.webp');
let ff = spawnSync('ffmpeg', ['-y', '-framerate', '8', '-i', path.join(frameDir, 'f%d.png'), '-loop', '0', gif], { encoding: 'utf8' });
if (ff.status !== 0) console.log('gif fail', ff.stderr && ff.stderr.slice(-400));
else swapped.push(['img/xcpets-cast.gif', 'img/doom/xcpets-cast.gif', 'cast-gif']);
ff = spawnSync('ffmpeg', ['-y', '-framerate', '8', '-i', path.join(frameDir, 'f%d.png'), '-loop', '0', '-an', webp], { encoding: 'utf8' });
if (ff.status !== 0) console.log('webp fail', ff.stderr && ff.stderr.slice(-400));
else swapped.push(['img/xcpets-cast.webp', 'img/doom/xcpets-cast.webp', 'cast-webp']);

/* before / after for every swapped asset */
function sideBySide(before, after, title) {
  const gap = 16, sc = Math.max(1, Math.min(4, Math.round(256 / Math.max(before.w, after.w))));
  const bw = before.w * sc, bh = before.h * sc, aw = after.w * sc, ah = after.h * sc;
  const W = bw + aw + gap * 3, H = Math.max(bh, ah) + 36;
  const dst = paper(W, H);
  text(dst, W, H, title, 8, 6, [255, 42, 42], 2);
  text(dst, W, H, 'BEFORE', gap, 22, [180, 160, 160], 1);
  text(dst, W, H, 'DOOM', bw + gap * 2, 22, [255, 42, 42], 1);
  blitAt(dst, W, H, before.rgba, before.w, before.h, gap, 32, sc);
  blitAt(dst, W, H, after.rgba, after.w, after.h, bw + gap * 2, 32, sc);
  return { w: W, h: H, rgba: dst };
}
const castBefore = path.join(frameDir, 'cast-before.png');
spawnSync('ffmpeg', ['-y', '-i', path.join(ROOT, 'img/xcpets-cast.gif'), '-frames:v', '1', castBefore], { encoding: 'utf8' });
swapped.forEach(pair => {
  let before;
  if (/\.gif$/.test(pair[0])) before = pngRead(castBefore);
  else if (/\.webp$/.test(pair[0])) before = pngRead(castBefore);
  else before = pngRead(path.join(ROOT, pair[0]));
  let after;
  if (/\.gif$|\.webp$/.test(pair[1])) after = pngRead(path.join(frameDir, 'f0.png'));
  else after = pngRead(path.join(ROOT, pair[1]));
  const both = sideBySide(before, after, pair[2].toUpperCase());
  const name = pair[2] + '-before-after.png';
  save(path.join(SHOW, name), both.w, both.h, both.rgba);
  save(path.join(DESIGN_SHOW, name), both.w, both.h, both.rgba);
  console.log('showcase', name);
});

/* hero strip: original signature kit vs doom kit, mythic */
(function hero() {
  const ids = species.filter(id => doomed[id]).slice(0, 9);
  const sc = 3, cell = 32 * sc, W = 16 + ids.length * (cell + 8), H = 36 + cell * 2 + 28;
  const dst = paper(W, H);
  text(dst, W, H, 'HERO BEFORE', 8, 8, [180, 160, 160], 1);
  text(dst, W, H, 'HERO DOOM', 8, 20 + cell, [255, 42, 42], 1);
  ids.forEach((id, i) => {
    const pet = PC.characterPet(id, { tier: 'legendary' });
    const before = bufOf(PC.renderFrames(pet, { stage: 5 })[0]);
    blitAt(dst, W, H, before, 32, 32, 8 + i * (cell + 8), 24, sc);
    blitAt(dst, W, H, doomed[id][0], 32, 32, 8 + i * (cell + 8), 36 + cell, sc);
  });
  save(path.join(SHOW, 'hero-before-after.png'), W, H, dst);
  save(path.join(DESIGN_SHOW, 'hero-before-after.png'), W, H, dst);
})();

fs.writeFileSync(path.join(DESIGN, 'swapped.json'), JSON.stringify(swapped, null, 2));
fs.writeFileSync(path.join(ART, 'swapped.json'), JSON.stringify(swapped, null, 2));
console.log('swapped', swapped.length);

/* Place screens. Before is the ordinary night look. After is the same scene under the doom sky,
 * with one DOOM flag, a falling candle chart, down arrows and a little red ash. No pet is redrawn here. */
function rect(dst, dw, dh, x, y, w, h, rgb) {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
    if (xx < 0 || yy < 0 || xx >= dw || yy >= dh) continue;
    const i = (yy * dw + xx) * 4; dst[i] = rgb[0]; dst[i + 1] = rgb[1]; dst[i + 2] = rgb[2]; dst[i + 3] = 255;
  }
}
function skyFill(dst, W, H, doom) {
  for (let y = 0; y < H; y++) {
    const c = doom ? (y < 50 ? [58, 10, 18] : y < 100 ? [36, 8, 14] : [20, 6, 12]) : (y < 70 ? [11, 10, 31] : y < 120 ? [29, 21, 48] : [20, 16, 28]);
    rect(dst, W, H, 0, y, W, 1, c);
  }
}
function flagAt(dst, W, H, x, y) {
  const rows = DG.DEFS['doom-flag'].map;
  const col = BGColors();
  rows.forEach((row, yy) => { for (let xx = 0; xx < row.length; xx++) { const c = col[row[xx]]; if (!c) continue; rect(dst, W, H, x + xx * 2, y + yy * 2, 2, 2, c); } });
}
function chartAt(dst, W, H, x, y) {
  [[0, 0, 10], [8, 3, 7], [16, 6, 4]].forEach(c => { rect(dst, W, H, x + c[0], y + c[1], 5, 2, [255, 255, 255]); rect(dst, W, H, x + c[0], y + c[1] + 2, 5, 2, [255, 42, 42]); rect(dst, W, H, x + c[0], y + c[1] + 4, 5, c[2], [200, 16, 46]); });
}
function arrowAt(dst, W, H, x, y) {
  rect(dst, W, H, x + 2, y, 2, 6, [255, 42, 42]); rect(dst, W, H, x, y + 4, 6, 2, [255, 42, 42]); rect(dst, W, H, x + 1, y + 6, 4, 2, [200, 16, 46]); rect(dst, W, H, x + 2, y + 8, 2, 2, [142, 11, 32]);
}
function ashAt(dst, W, H, n) {
  for (let i = 0; i < n; i++) rect(dst, W, H, (i * 47 + 13) % (W - 4), 8 + (i * 19) % 40, 2, 2, i % 2 ? [200, 16, 46] : [255, 42, 42]);
}
function dressPlace(dst, W, H) { flagAt(dst, W, H, 12, 8); chartAt(dst, W, H, W - 40, 10); arrowAt(dst, W, H, W - 62, 14); arrowAt(dst, W, H, 150, 18); ashAt(dst, W, H, 8); }
const INK = [16, 14, 20], GOLD = [232, 179, 58], CREAM = [255, 241, 168], SAND = [179, 139, 85];
function paintPlace(id, doom) {
  const W = 320, H = 180, d = Buffer.alloc(W * H * 4);
  skyFill(d, W, H, doom);
  if (id === 'circus') {
    for (let i = 0; i < 10; i++) rect(d, W, H, i * 32, 28, 26, 70, doom ? [70, 16, 24] : [59, 23, 102]);
    rect(d, W, H, 0, 96, W, 28, doom ? [90, 24, 32] : [90, 58, 74]); rect(d, W, H, 0, 122, W, 58, SAND);
    rect(d, W, H, 118, 40, 84, 78, INK); rect(d, W, H, 126, 48, 68, 62, [82, 102, 85]); rect(d, W, H, 146, 78, 28, 32, [20, 12, 16]);
    rect(d, W, H, 36, 136, 22, 18, [140, 198, 63]); rect(d, W, H, 258, 134, 22, 18, GOLD);
    for (let i = 0; i < 18; i++) rect(d, W, H, 8 + (i % 9) * 10, 40 + Math.floor(i / 9) * 12, 4, 4, [i % 3 ? CREAM : [200, 16, 46]]);
  } else if (id === 'rare') {
    rect(d, W, H, 0, 0, W, 124, doom ? [42, 8, 16] : [42, 15, 74]);
    [[16, 22], [16, 70], [244, 22], [244, 70]].forEach((s, n) => { rect(d, W, H, s[0], s[1], 58, 40, INK); rect(d, W, H, s[0] + 3, s[1] + 3, 52, 34, GOLD); rect(d, W, H, s[0] + 8, s[1] + 8, 42, 24, [[154, 163, 181], [79, 209, 139], [79, 157, 255], [200, 16, 46]][n]); });
    rect(d, W, H, 140, 18, 40, 40, GOLD); rect(d, W, H, 148, 26, 24, 24, doom ? [200, 16, 46] : [191, 233, 214]);
    rect(d, W, H, 0, 124, W, 56, [239, 232, 246]); for (let x = 0; x < W; x += 16) rect(d, W, H, x, 124, 16, 8, (x / 16) % 2 ? [28, 15, 51] : [239, 232, 246]);
  } else if (id === 'motel') {
    for (let i = 0; i < 30; i++) rect(d, W, H, (i * 53) % W, (i * 19) % 60, 1, 1, CREAM);
    rect(d, W, H, 20, 36, 180, 28, INK); rect(d, W, H, 24, 40, 172, 20, doom ? [200, 16, 46] : [255, 79, 216]);
    rect(d, W, H, 40, 90, 240, 70, [232, 160, 180]); rect(d, W, H, 150, 104, 80, 40, [242, 215, 160]);
    rect(d, W, H, 0, 160, W, 20, [42, 42, 51]);
  } else if (id === 'spam') {
    [[0, 78, 36], [36, 58, 30], [284, 64, 36]].forEach(b => { rect(d, W, H, b[0], b[1], b[2], H - b[1], [43, 31, 77]); for (let yy = b[1] + 8; yy < 150; yy += 14) rect(d, W, H, b[0] + 6, yy, 6, 6, doom ? [200, 16, 46] : GOLD); });
    rect(d, W, H, 96, 36, 148, 120, [59, 42, 26]); rect(d, W, H, 108, 48, 124, 16, doom ? [200, 16, 46] : [11, 10, 31]);
    rect(d, W, H, 110, 78, 120, 46, [11, 10, 31]); rect(d, W, H, 0, 156, W, 24, [36, 26, 18]);
  } else if (id === 'raid') {
    for (let i = 0; i < 8; i++) rect(d, W, H, i * 40, 18, 30, 78, doom ? [58, 10, 18] : [59, 23, 102]);
    rect(d, W, H, 104, 36, 112, 86, [82, 102, 85]); rect(d, W, H, 124, 52, 28, 16, [208, 40, 79]); rect(d, W, H, 168, 52, 28, 16, [208, 40, 79]);
    rect(d, W, H, 140, 84, 40, 12, INK); rect(d, W, H, 0, 128, W, 52, SAND);
    rect(d, W, H, 28, 142, 18, 16, [140, 198, 63]); rect(d, W, H, 270, 144, 18, 16, GOLD);
  } else if (id === 'cemetery') {
    for (let i = 0; i < 40; i++) rect(d, W, H, (i * 71) % W, (i * 17) % 70, 1, 1, CREAM);
    rect(d, W, H, 248, 16, 28, 28, CREAM); rect(d, W, H, 0, 120, W, 60, [20, 48, 31]);
    [[40, 112], [100, 126], [160, 108], [226, 124], [276, 114]].forEach(g => { rect(d, W, H, g[0], g[1] - 28, 24, 28, [138, 138, 160]); rect(d, W, H, g[0] + 10, g[1] - 36, 4, 10, doom ? [200, 16, 46] : [42, 42, 58]); });
  } else if (id === 'pantheon') {
    for (let i = 0; i < 30; i++) rect(d, W, H, (i * 61) % W, (i * 13) % 60, 1, 1, CREAM);
    rect(d, W, H, 248, 16, 26, 26, CREAM); rect(d, W, H, 0, 148, W, 32, [20, 48, 31]);
    [[46, 78], [136, 62], [226, 78]].forEach(q => { rect(d, W, H, q[0], q[1], 40, 72, GOLD); rect(d, W, H, q[0] + 8, q[1] + 10, 24, 40, [42, 33, 80]); });
  } else if (id === 'tokens') {
    rect(d, W, H, 0, 0, W, 109, doom ? [42, 10, 18] : [37, 54, 90]);
    for (let i = 0; i < 5; i++) { rect(d, W, H, 18 + i * 60, 126, 24, 28, i % 2 ? GOLD : [140, 198, 63]); rect(d, W, H, 44 + i * 60, 90, 22, 28, doom ? [200, 16, 46] : GOLD); }
    rect(d, W, H, 0, 120, W, 60, [68, 68, 84]);
  } else {
    rect(d, W, H, 8, 8, 304, 100, doom ? [42, 8, 16] : [59, 23, 102]);
    rect(d, W, H, 78, 17, 168, 70, INK); rect(d, W, H, 82, 21, 160, 62, [37, 54, 90]);
    rect(d, W, H, 14, 18, 55, 16, [155, 16, 53]); rect(d, W, H, 0, 124, W, 56, [68, 68, 84]);
    text(d, W, H, 'ON AIR', 18, 30, CREAM, 1);
  }
  if (doom) dressPlace(d, W, H);
  text(d, W, H, doom ? 'DOOM' : id.toUpperCase(), 8, H - 8, doom ? [255, 42, 42] : CREAM, 1);
  return { w: W, h: H, rgba: d };
}
const PLACE_IDS = ['circus', 'rare', 'motel', 'spam', 'raid', 'cemetery', 'pantheon', 'tokens', 'live'];
PLACE_IDS.forEach(id => {
  const both = sideBySide(paintPlace(id, false), paintPlace(id, true), id.toUpperCase());
  save(path.join(PLACES_DIR, id + '-before-after.png'), both.w, both.h, both.rgba);
  console.log('place', id);
});
['doom-hodl-sign.png'].forEach(f => ['img/doom', 'design/doom-week'].forEach(dir => { const p = path.join(ROOT, dir, f); if (dir === 'design/doom-week') return; try { fs.unlinkSync(path.join(ROOT, dir, f)); } catch (e) {} }));
['doom-hodl-sign-1x.png', 'doom-hodl-sign-4x.png', 'doom-hodl-sign.png'].forEach(f => { try { fs.unlinkSync(path.join(DESIGN, f)); } catch (e) {} try { fs.unlinkSync(path.join(ROOT, 'img/doom', f)); } catch (e) {} });
