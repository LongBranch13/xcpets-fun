#!/usr/bin/env node
/* X card for one Pantheon seat. Display tooling only. Writes a PNG. Does not post anywhere.
 * The picture is the seated pet's sprite, the seat title, "Seat N of XXI", the first and last
 * lines of that seat's book (the caller passes V2Pantheon.verse lines), and xcpets.fun/pantheon.html.
 *   node tools/pantheon-card.js --out card.png --name Nefu --species Dodo --seat 10 \
 *        --title "Guardian of the Proof of Burn" --line0 "..." --line1 "..."
 *   --sprite FILE   raw 32x32 RGBA (4096 bytes). Without it, a Mythic-stage pet sprite is drawn with PetCore (species from --species, default dodo).
 */
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib'), vm = require('vm');
const FONT = require('../js/papers-font.js');
const W = 640, H = 360;
const BG = [11, 10, 31], GOLD = [255, 201, 60], INK = [43, 25, 40], PAPER = [241, 230, 200], WHITE = [255, 248, 230];
function crc32(b) { let c, t = crc32.t; if (!t) { t = crc32.t = new Int32Array(256); for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } }
  c = -1; for (let i = 0; i < b.length; i++) c = t[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; }
function chunk(type, data) { const l = Buffer.alloc(4), td = Buffer.concat([Buffer.from(type), data]), cr = Buffer.alloc(4); l.writeUInt32BE(data.length); cr.writeUInt32BE(crc32(td)); return Buffer.concat([l, td, cr]); }
function png(data, w, h, s) { s = s || 1; const Wd = w * s, Hd = h * s, raw = Buffer.alloc((Wd * 4 + 1) * Hd);
  for (let y = 0; y < Hd; y++) { raw[y * (Wd * 4 + 1)] = 0; for (let x = 0; x < Wd; x++) { const si = (((y / s) | 0) * w + ((x / s) | 0)) * 4, di = y * (Wd * 4 + 1) + 1 + x * 4; raw[di] = data[si]; raw[di + 1] = data[si + 1]; raw[di + 2] = data[si + 2]; raw[di + 3] = data[si + 3] == null ? 255 : data[si + 3]; } }
  const ih = Buffer.alloc(13); ih.writeUInt32BE(Wd, 0); ih.writeUInt32BE(Hd, 4); ih[8] = 8; ih[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]); }
function Img(w, h) { this.w = w; this.h = h; this.d = new Uint8ClampedArray(w * h * 4); for (let i = 3; i < this.d.length; i += 4) this.d[i] = 255; }
Img.prototype.pt = function (x, y, c) { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= this.w || y >= this.h || !c) return; const i = (y * this.w + x) * 4; this.d[i] = c[0]; this.d[i + 1] = c[1]; this.d[i + 2] = c[2]; this.d[i + 3] = 255; };
Img.prototype.rect = function (x0, y0, x1, y1, c) { for (let y = Math.max(0, y0); y <= Math.min(this.h - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(this.w - 1, x1); x++) this.pt(x, y, c); };
Img.prototype.sprite = function (spr, sw, sh, s, ox, oy) { if (!spr) return; for (let y = 0; y < sh * s; y++) for (let x = 0; x < sw * s; x++) { const si = (((y / s) | 0) * sw + ((x / s) | 0)) * 4, a = spr[si + 3] == null ? 255 : spr[si + 3]; if (!a) continue;
  const X = ox + x, Y = oy + y; if (X < 0 || Y < 0 || X >= this.w || Y >= this.h) continue; const di = (Y * this.w + X) * 4;
  for (let ch = 0; ch < 3; ch++) this.d[di + ch] = Math.round((spr[si + ch] * a + this.d[di + ch] * (255 - a)) / 255); } };
const gcache = {};
function glyph(sz, ch) { const k = sz + ch; if (gcache[k]) return gcache[k]; const F = FONT[sz], s = F.g[ch] || F.g['?']; return (gcache[k] = s.split('.').map(h => parseInt(h, 16))); }
function clean(s) { return String(s == null ? '' : s).replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/\u2026/g, '...').replace(/[^\x20-\x7e]/g, '?'); }
function text(im, x, y, s, sz, c) { const F = FONT[String(sz)] || FONT['8']; s = clean(s);
  for (let j = 0; j < s.length; j++) { const G = glyph(String(sz), s[j]); for (let ry = 0; ry < G.length; ry++) { const row = G[ry]; if (!row) continue; for (let bx = 0; bx < F.w; bx++) if (row & (1 << bx)) im.pt(x + j * F.adv + bx, y + ry - F.oy, c); } } }
function wrap(s, sz, maxW) { const adv = (FONT[String(sz)] || FONT['8']).adv, max = Math.max(8, Math.floor(maxW / adv)); const words = clean(s).split(/\s+/), lines = []; let cur = '';
  words.forEach(w => { const n = cur ? cur + ' ' + w : w; if (n.length <= max) cur = n; else { if (cur) lines.push(cur); cur = w.length > max ? w.slice(0, max) : w; } });
  if (cur) lines.push(cur); return lines.slice(0, 3); }
/* a real PetCore sprite (stage Mythic) for the seated pet. species forces the body; the dna is fixed so the card does not change between runs. */
function petSprite(species) {
  const key = species || '';
  petSprite.cache = petSprite.cache || {};
  if (petSprite.cache[key]) return petSprite.cache[key];
  if (!petSprite.ctx) {
    const ls = { getItem: () => null, setItem() {}, removeItem() {} };
    const win = { console: { log() {}, warn() {}, error() {}, info() {} }, document: { createElement: () => ({ style: {}, appendChild() {}, addEventListener() {} }), getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, head: { appendChild() {} }, body: { appendChild() {} }, documentElement: { style: {} } }, location: { search: '', href: 'http://xcpets.fun/', hostname: 'xcpets.fun' }, navigator: { userAgent: 'node' }, localStorage: ls, sessionStorage: ls, setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {}, URL, URLSearchParams, TextEncoder, TextDecoder };
    win.window = win; win.self = win; win.globalThis = win;
    const ctx = vm.createContext(win), root = path.resolve(__dirname, '..');
    vm.runInContext(fs.readFileSync(path.join(root, 'rjs/pet-core.js'), 'utf8'), ctx, { filename: 'rjs/pet-core.js' });
    vm.runInContext(fs.readFileSync(path.join(root, 'js/pet-core.js'), 'utf8'), ctx, { filename: 'js/pet-core.js' });
    petSprite.ctx = ctx;
  }
  const pet = petSprite.ctx.PetCore.generate({ blockHash: 'cd'.repeat(32), petId: 8033 });
  if (species) pet.species = species;
  const fr = petSprite.ctx.PetCore.renderFrames(pet, { stage: 5, frame: 0 });
  const data = fr && fr[0] && fr[0].data;
  if (!data || data.length < 4096) throw new Error('no pet sprite');
  petSprite.cache[key] = data;
  return data;
}
function builtinSprite() {
  const a = new Uint8ClampedArray(32 * 32 * 4), put = (x, y, c) => { if (x < 0 || y < 0 || x > 31 || y > 31) return; const i = (y * 32 + x) * 4; a[i] = c[0]; a[i + 1] = c[1]; a[i + 2] = c[2]; a[i + 3] = 255; };
  const skin = [90, 168, 60], dark = [40, 90, 36], eye = [244, 244, 238], ink = [16, 16, 16];
  for (let y = 8; y < 28; y++) for (let x = 8; x < 24; x++) { const dx = x - 16, dy = y - 16; if (dx * dx / 49 + dy * dy / 64 < 1) put(x, y, (x + y) % 9 === 0 ? dark : skin); }
  [[12, 14], [13, 14], [18, 14], [19, 14]].forEach(p => put(p[0], p[1], eye));
  put(13, 15, ink); put(19, 15, ink); put(15, 18, [224, 88, 46]); put(16, 18, [224, 88, 46]);
  return a;
}
function renderCard(o) {
  o = o || {}; const im = new Img(W, H); im.rect(0, 0, W - 1, H - 1, BG); im.rect(8, 8, W - 9, H - 9, GOLD); im.rect(12, 12, W - 13, H - 13, BG);
  im.rect(28, 36, 212, 248, [22, 18, 48]); im.rect(36, 44, 204, 212, [18, 16, 40]);
  const spr = o.sprite || builtinSprite(), sw = o.spriteW || 32, sh = o.spriteH || 32;
  im.sprite(spr, sw, sh, 5, 40, 48);
  text(im, 236, 48, 'MYTHIC GOD', 16, GOLD);
  text(im, 236, 84, clean(o.title || 'Pantheon seat').slice(0, 42), 8, GOLD);
  text(im, 236, 108, 'Seat ' + (o.seat || 1) + ' of XXI', 8, WHITE);
  im.rect(236, 136, W - 28, 292, PAPER);
  let y = 152; wrap(o.line0 || '', 6, 360).forEach(ln => { text(im, 248, y, ln, 6, INK); y += 14; });
  y = Math.max(y + 6, 210); wrap(o.line1 || '', 6, 360).forEach(ln => { text(im, 248, y, ln, 6, INK); y += 14; });
  text(im, 236, 318, 'xcpets.fun/pantheon.html', 8, GOLD);
  const scale = o.scale || 2;
  return { png: png(im.d, W, H, scale), rgba: im.d, w: W * scale, h: H * scale, lw: W, lh: H };
}
function arg(k) { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : null; }
function main() {
  const out = arg('--out'); if (!out) { console.error('usage: node tools/pantheon-card.js --out card.png [--name N] [--species S] [--seat N] [--title T] [--line0 A] [--line1 B] [--sprite file.rgba]'); process.exit(2); }
  let sprite = null; const sf = arg('--sprite');
  if (sf) sprite = new Uint8ClampedArray(fs.readFileSync(sf));
  else try { sprite = petSprite(arg('--species') || 'dodo'); } catch (e) { sprite = null; }
  const card = renderCard({ name: arg('--name'), species: arg('--species'), seat: +(arg('--seat') || 1), title: arg('--title') || 'Pantheon seat', line0: arg('--line0') || '', line1: arg('--line1') || '', sprite: sprite });
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true }); fs.writeFileSync(out, card.png);
  console.log(out, card.w + 'x' + card.h, card.png.length + ' bytes (sends nothing)');
}
module.exports = { renderCard, png, builtinSprite, petSprite, W, H };
if (require.main === module) main();
