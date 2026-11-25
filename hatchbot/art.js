/* HatchBot art (Nov 23 2026): pictures and short animations for HatchBot's Telegram posts.
 * The pets are drawn by the site's own renderer (js/v2-render.js petFramesRaw, the same call tools/token-meta.js uses for
 * t/<id>.png), so a post shows exactly the sprite, gear and looks the player sees on xcpets.fun. Everything else here is
 * plain pixel work on top: a small scene canvas, a few effects, and dependency-free PNG and GIF encoders.
 * Display only. It reads the replayed world and never changes it.
 *
 *   const A = require('./art.js'); A.load(ctx);                 // ctx: the announcer's vm context (rules already loaded)
 *   const out = A.event(ctx, w, { kind: 'hatch', id: 205424 }); // { type: 'animation' | 'photo', file: Buffer, name }
 *
 * Kinds: idle, shine (new Mythic, Legendary), hatch (egg wobbles, cracks, pet pops out), rise (zombie climbs out of its grave),
 * miracle (resurrection: grey pet, light from above, colour and halo), dust (failed resurrection: the pet crumbles),
 * breed (two parents, a heart, an egg), devour (a zombie eats a Mythic), rage (unleashed or full-power zombie),
 * lineup, grind, raid, banner. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), zlib = require('zlib');
const ROOT = path.resolve(__dirname, '..');
/* the species registry + every pet's sprite script (js/species-registry.js scripts(), the same files pet.html loads), then the renderer */
const EXTRA = ['js/species-registry.js'].concat(require('../js/species-registry.js').scripts(), ['js/dan-sprite.js', 'js/v2-bg.js', 'js/v2-looks.js', 'js/v2-clown-hair.js', 'js/v2-render.js']);

function load(ctx) {
  if (ctx.V2Render) return ctx;
  ctx.setInterval = ctx.setInterval || (() => 0); ctx.clearInterval = ctx.clearInterval || (() => {}); ctx.requestAnimationFrame = ctx.requestAnimationFrame || (() => 0);
  const nop = function () { return { observe() {}, disconnect() {} }; };
  ctx.MutationObserver = ctx.MutationObserver || nop; ctx.ResizeObserver = ctx.ResizeObserver || nop; ctx.IntersectionObserver = ctx.IntersectionObserver || nop;
  ctx.document.head = ctx.document.head || { appendChild() {} }; ctx.document.addEventListener = undefined;
  for (const f of EXTRA) { const p = path.join(ROOT, f); if (fs.existsSync(p)) vm.runInContext(fs.readFileSync(p, 'utf8'), ctx, { filename: f }); }
  if (!ctx.V2Render) throw new Error('V2Render did not load');
  return ctx;
}

/* ---------------------------------------------------------------- encoders */
let CRC;
function crc32(b) { if (!CRC) { CRC = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; CRC[n] = c; } }
  let c = -1; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; }
function chunk(type, data) { const l = Buffer.alloc(4), td = Buffer.concat([Buffer.from(type), data]), cr = Buffer.alloc(4); l.writeUInt32BE(data.length); cr.writeUInt32BE(crc32(td)); return Buffer.concat([l, td, cr]); }
/** png(img, scale): RGB PNG, nearest-neighbour upscale. */
function png(img, s) { s = s || 1; const W = img.w * s, H = img.h * s, raw = Buffer.alloc((W * 3 + 1) * H);
  for (let y = 0; y < H; y++) { const o = y * (W * 3 + 1); for (let x = 0; x < W; x++) { const si = (((y / s) | 0) * img.w + ((x / s) | 0)) * 4, di = o + 1 + x * 3; raw[di] = img.d[si]; raw[di + 1] = img.d[si + 1]; raw[di + 2] = img.d[si + 2]; } }
  const ih = Buffer.alloc(13); ih.writeUInt32BE(W, 0); ih.writeUInt32BE(H, 4); ih[8] = 8; ih[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]); }

/* GIF: one global palette for all frames, by median cut over every colour used (exact when 256 or fewer). */
function palette(frames) {
  const cnt = new Map();
  for (const f of frames) for (let i = 0; i < f.d.length; i += 4) { const k = (f.d[i] << 16) | (f.d[i + 1] << 8) | f.d[i + 2]; cnt.set(k, (cnt.get(k) || 0) + 1); }
  const cols = [...cnt.entries()], map = new Map();
  if (cols.length <= 256) { cols.forEach(([k], i) => map.set(k, i)); return { map, pal: cols.map(([k]) => k) }; }
  const stat = b => { const mn = [255, 255, 255], mx = [0, 0, 0]; let n = 0; for (const [k, c] of b) { const r = [k >> 16 & 255, k >> 8 & 255, k & 255]; for (let a = 0; a < 3; a++) { if (r[a] < mn[a]) mn[a] = r[a]; if (r[a] > mx[a]) mx[a] = r[a]; } n += c; }
    let axis = 0, best = -1; for (let a = 0; a < 3; a++) { const s = (mx[a] - mn[a]) * (a === 1 ? 1.2 : 1); if (s > best) { best = s; axis = a; } } return { b, axis, score: b.length < 2 ? -1 : best * Math.sqrt(n) }; };
  const boxes = [stat(cols)];
  while (boxes.length < 256) { let bi = -1, best = 0; boxes.forEach((x, i) => { if (x.score > best) { best = x.score; bi = i; } }); if (bi < 0) break;
    const { b, axis } = boxes[bi], sh = 16 - axis * 8; b.sort((p, q) => ((p[0] >> sh) & 255) - ((q[0] >> sh) & 255));
    let tot = 0; for (const e of b) tot += e[1]; let acc = 0, cut = 1; for (let i = 0; i < b.length; i++) { acc += b[i][1]; if (acc >= tot / 2) { cut = Math.max(1, Math.min(b.length - 1, i + 1)); break; } }
    boxes.splice(bi, 1, stat(b.slice(0, cut)), stat(b.slice(cut))); }
  const pal = []; boxes.forEach(({ b }, i) => { let r = 0, g = 0, bl = 0, n = 0; for (const [k, c] of b) { r += (k >> 16 & 255) * c; g += (k >> 8 & 255) * c; bl += (k & 255) * c; n += c; map.set(k, i); } pal.push((Math.round(r / n) << 16) | (Math.round(g / n) << 8) | Math.round(bl / n)); });
  return { map, pal };
}
function lzw(ix, minCode) {
  const out = [], clear = 1 << minCode, eoi = clear + 1; let size = minCode + 1, next = eoi + 1, dict = new Map(), cur = 0, nb = 0;
  const put = c => { cur |= c << nb; nb += size; while (nb >= 8) { out.push(cur & 255); cur >>>= 8; nb -= 8; } };
  put(clear); let pre = ix[0];
  for (let i = 1; i < ix.length; i++) { const k = ix[i], key = pre * 256 + k, v = dict.get(key);
    if (v !== undefined) { pre = v; continue; }
    put(pre);
    if (next === 4096) { put(clear); dict = new Map(); size = minCode + 1; next = eoi + 1; }
    else { if (next >= (1 << size)) size++; dict.set(key, next++); }
    pre = k; }
  put(pre); put(eoi); if (nb > 0) out.push(cur & 255);
  return out;
}
/** gif(frames[{w,h,d}], delays (1/100 s, one per frame or a number), scale): looping animated GIF. */
function gif(frames, delays, s) {
  s = s || 1; const w = frames[0].w, h = frames[0].h, W = w * s, H = h * s, { map, pal } = palette(frames);
  let bits = 1; while ((1 << bits) < pal.length) bits++; const n = 1 << bits, minCode = Math.max(2, bits);
  const B = []; const u16 = v => B.push(v & 255, v >> 8 & 255), push = a => { for (let i = 0; i < a.length; i++) B.push(a[i]); };
  push(Buffer.from('GIF89a')); u16(W); u16(H); B.push(0x80 | (bits - 1), 0, 0);
  for (let i = 0; i < n; i++) { const k = pal[i] || 0; B.push(k >> 16 & 255, k >> 8 & 255, k & 255); }
  B.push(0x21, 0xff, 11); push(Buffer.from('NETSCAPE2.0')); B.push(3, 1, 0, 0, 0);
  const ix = new Uint8Array(W * H), row = new Uint8Array(w);
  frames.forEach((f, fi) => { const dl = Array.isArray(delays) ? delays[fi] : delays;
    B.push(0x21, 0xf9, 4, 0x04, dl & 255, dl >> 8 & 255, 0, 0);
    B.push(0x2c); u16(0); u16(0); u16(W); u16(H); B.push(0);
    for (let y = 0; y < h; y++) { for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; row[x] = map.get((f.d[i] << 16) | (f.d[i + 1] << 8) | f.d[i + 2]); }
      for (let yy = 0; yy < s; yy++) { const o = (y * s + yy) * W; for (let x = 0; x < w; x++) { const v = row[x], p = o + x * s; for (let xx = 0; xx < s; xx++) ix[p + xx] = v; } } }
    const data = lzw(ix, minCode); B.push(minCode);
    for (let i = 0; i < data.length; i += 255) { const c = data.slice(i, i + 255); B.push(c.length); push(c); }
    B.push(0); });
  B.push(0x3b);
  return Buffer.from(B);
}
/** readPng(file): { w, h, d (RGBA) } for 8-bit non-interlaced PNGs (RGB, RGBA, grey, palette). Used for the raid bosses and the logo. */
function readPng(file) {
  const b = fs.readFileSync(file); let p = 8, w = 0, h = 0, ct = 0, bd = 8, plte = null, trns = null; const idat = [];
  while (p < b.length) { const len = b.readUInt32BE(p), type = b.toString('ascii', p + 4, p + 8), data = b.subarray(p + 8, p + 8 + len); p += 12 + len;
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); bd = data[8]; ct = data[9]; if (data[12]) throw new Error('interlaced png'); }
    else if (type === 'PLTE') plte = data; else if (type === 'tRNS') trns = data; else if (type === 'IDAT') idat.push(data); else if (type === 'IEND') break; }
  if (bd !== 8) throw new Error('png bit depth ' + bd);
  const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ct], raw = zlib.inflateSync(Buffer.concat(idat)), st = w * ch, out = new Uint8ClampedArray(w * h * 4), cur = new Uint8Array(st), prev = new Uint8Array(st);
  for (let y = 0; y < h; y++) { const ft = raw[y * (st + 1)], o = y * (st + 1) + 1;
    for (let x = 0; x < st; x++) { const a = x >= ch ? cur[x - ch] : 0, up = prev[x], c = x >= ch ? prev[x - ch] : 0, v = raw[o + x];
      let r; if (ft === 0) r = v; else if (ft === 1) r = v + a; else if (ft === 2) r = v + up; else if (ft === 3) r = v + ((a + up) >> 1); else { const pp = a + up - c, pa = Math.abs(pp - a), pb = Math.abs(pp - up), pc = Math.abs(pp - c); r = v + (pa <= pb && pa <= pc ? a : pb <= pc ? up : c); }
      cur[x] = r & 255; }
    for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; let R, G, B2, A = 255;
      if (ct === 6) { R = cur[x * 4]; G = cur[x * 4 + 1]; B2 = cur[x * 4 + 2]; A = cur[x * 4 + 3]; } else if (ct === 2) { R = cur[x * 3]; G = cur[x * 3 + 1]; B2 = cur[x * 3 + 2]; }
      else if (ct === 3) { const k = cur[x]; R = plte[k * 3]; G = plte[k * 3 + 1]; B2 = plte[k * 3 + 2]; A = trns && k < trns.length ? trns[k] : 255; } else if (ct === 4) { R = G = B2 = cur[x * 2]; A = cur[x * 2 + 1]; } else { R = G = B2 = cur[x]; }
      out[i] = R; out[i + 1] = G; out[i + 2] = B2; out[i + 3] = A; }
    prev.set(cur); }
  return { w, h, d: out };
}
/** an image as a sprite set (one frame), shrunk by area averaging to fit maxW x maxH; alpha > 128 is the mask. */
function imageSprite(file, maxW, maxH) {
  const im = readPng(file), k = Math.max(im.w / maxW, im.h / maxH, 1), w = Math.max(1, Math.round(im.w / k)), h = Math.max(1, Math.round(im.h / k)), d = new Uint8ClampedArray(w * h * 4), m = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let r = 0, g = 0, bl = 0, a = 0, n = 0; const x0 = Math.floor(x * k), x1 = Math.max(x0 + 1, Math.floor((x + 1) * k)), y0 = Math.floor(y * k), y1 = Math.max(y0 + 1, Math.floor((y + 1) * k));
    for (let yy = y0; yy < y1 && yy < im.h; yy++) for (let xx = x0; xx < x1 && xx < im.w; xx++) { const i = (yy * im.w + xx) * 4, al = im.d[i + 3] / 255; r += im.d[i] * al; g += im.d[i + 1] * al; bl += im.d[i + 2] * al; a += al; n++; }
    const j = y * w + x; if (a > 0) { d[j * 4] = r / a; d[j * 4 + 1] = g / a; d[j * 4 + 2] = bl / a; } d[j * 4 + 3] = 255; m[j] = n && a / n > 0.5 ? 1 : 0; }
  const S = [{ w, h, d, m }]; S.bb = bbox(S); return S;
}

/* ---------------------------------------------------------------- canvas */
function Img(w, h, bg) { this.w = w; this.h = h; this.d = new Uint8ClampedArray(w * h * 4); if (bg) this.fill(bg); }
Img.prototype.fill = function (c) { for (let i = 0; i < this.d.length; i += 4) { this.d[i] = c[0]; this.d[i + 1] = c[1]; this.d[i + 2] = c[2]; this.d[i + 3] = 255; } return this; };
Img.prototype.copy = function () { const o = new Img(this.w, this.h); o.d.set(this.d); return o; };
Img.prototype.px = function (x, y, c, a) { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= this.w || y >= this.h || !c) return; const i = (y * this.w + x) * 4; a = a == null ? 1 : a; if (a <= 0) return; if (a > 1) a = 1;
  this.d[i] = c[0] * a + this.d[i] * (1 - a); this.d[i + 1] = c[1] * a + this.d[i + 1] * (1 - a); this.d[i + 2] = c[2] * a + this.d[i + 2] * (1 - a); this.d[i + 3] = 255; };
Img.prototype.get = function (x, y) { x = Math.max(0, Math.min(this.w - 1, Math.round(x))); y = Math.max(0, Math.min(this.h - 1, Math.round(y))); const i = (y * this.w + x) * 4; return [this.d[i], this.d[i + 1], this.d[i + 2]]; };
Img.prototype.rect = function (x0, y0, w, h, c, a) { x0 = Math.round(x0); y0 = Math.round(y0); for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) this.px(x, y, c, a); };
/** draw a sprite {w,h,d,m} at 1:1. opts: { cut: pet pixels only, fx(x, y, rgb) -> rgb|null, clipY } (kept for older callers) */
Img.prototype.sprite = function (sp, ox, oy, o) { o = o || {};
  for (let y = 0; y < sp.h; y++) for (let x = 0; x < sp.w; x++) { const j = y * sp.w + x; if (o.cut && !sp.m[j]) continue; if (o.clipY != null && oy + y > o.clipY) continue;
    let c = [sp.d[j * 4], sp.d[j * 4 + 1], sp.d[j * 4 + 2]]; if (o.fx) { c = o.fx(x, y, c, j); if (!c) continue; } this.px(ox + x, oy + y, c, o.alpha); } };
/** the whole frame shifted (screen shake); the edge pixels repeat. */
function shake(im, dx, dy) { if (!dx && !dy) return im; const o = new Img(im.w, im.h); for (let y = 0; y < im.h; y++) for (let x = 0; x < im.w; x++) { const c = im.get(x - dx, y - dy), i = (y * im.w + x) * 4; o.d[i] = c[0]; o.d[i + 1] = c[1]; o.d[i + 2] = c[2]; o.d[i + 3] = 255; } return o; }
function wash(im, c, a) { if (a <= 0) return; for (let i = 0; i < im.d.length; i += 4) { im.d[i] = c[0] * a + im.d[i] * (1 - a); im.d[i + 1] = c[1] * a + im.d[i + 1] * (1 - a); im.d[i + 2] = c[2] * a + im.d[i + 2] * (1 - a); } }
function vignette(im, k) { const cx = im.w / 2, cy = im.h / 2; for (let y = 0; y < im.h; y++) for (let x = 0; x < im.w; x++) { const dx = (x - cx) / cx, dy = (y - cy) / cy, v = Math.max(0, Math.sqrt(dx * dx + dy * dy) - 0.75) * k; if (v > 0) im.px(x, y, [0, 0, 0], Math.min(0.7, v)); } }

/* ---------------------------------------------------------------- pet sprites */
const KEY = '#ff00fe';
function flat(fr) { const a = fr.rareScene || fr; return { w: a.width || 32, h: a.height || 32, d: a.data }; }
function bbox(S) { let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1; S.forEach(sp => { for (let y = 0; y < sp.h; y++) for (let x = 0; x < sp.w; x++) if (sp.m[y * sp.w + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } });
  return x1 < 0 ? { x0: 0, y0: 0, x1: S[0].w - 1, y1: S[0].h - 1 } : { x0, y0, x1, y1 }; }
/** spriteSet(ctx, w, p, opts): the pet's animation frames as the site draws them, each with a mask of the pet's own pixels. */
function spriteSet(ctx, w, p, o) {
  o = o || {}; const R = ctx.V2Render, q = o.stage != null ? Object.assign({}, p, { stage: o.stage }) : p, ex = { noHunger: true };
  const real = R.petFramesRaw(q, w, ex).map(flat);
  let keyed = null; try { keyed = R.petFramesRaw(Object.assign({}, q, { hatchBlock: 0, mutation: null, shows: null, art: Object.assign({}, q.art, { background: 'solid', bgColor: KEY, pattern: 'none' }) }), w, ex).map(flat); } catch (e) { keyed = null; }
  const S = real.map((f, i) => { const m = new Uint8Array(f.w * f.h), k = keyed && keyed[i % keyed.length];
    for (let j = 0; j < m.length; j++) m[j] = k && k.w === f.w ? (Math.abs(k.d[j * 4] - 255) + k.d[j * 4 + 1] + Math.abs(k.d[j * 4 + 2] - 254) > 24 ? 1 : 0) : 1;
    return { w: f.w, h: f.h, d: f.d, m }; });
  S.bb = bbox(S); return S;
}
/** draw frame f of a sprite set, its feet at (cx, by). o: { z zoom (2), sx, sy squash, flip, shear, clipY, fx(x, y, rgb), alpha }. Returns the box drawn. */
function pet(im, S, f, cx, by, o) { o = o || {}; const sp = S[((f % S.length) + S.length) % S.length], bb = S.bb || (S.bb = bbox(S)), z = o.z || 2, zx = z * (o.sx || 1), zy = z * (o.sy || 1);
  const bw = bb.x1 - bb.x0 + 1, bh = bb.y1 - bb.y0 + 1, W = Math.max(1, Math.round(bw * zx)), H = Math.max(1, Math.round(bh * zy)), x0 = Math.round(cx - W / 2), y0 = Math.round(by - H);
  for (let y = 0; y < H; y++) { const Y = y0 + y; if (o.clipY != null && Y > o.clipY) continue; if (o.clipTop != null && Y < o.clipTop) continue; const sy = bb.y0 + Math.min(bh - 1, (y / zy) | 0), sh = o.shear ? Math.round(o.shear * (H - y) / H) : 0;
    for (let x = 0; x < W; x++) { let sx = Math.min(bw - 1, (x / zx) | 0); if (o.flip) sx = bw - 1 - sx; sx += bb.x0; const j = sy * sp.w + sx; if (!sp.m[j]) continue;
      let c = [sp.d[j * 4], sp.d[j * 4 + 1], sp.d[j * 4 + 2]]; if (o.fx) { c = o.fx(sx - bb.x0, sy - bb.y0, c, x0 + x + sh, Y); if (!c) continue; } im.px(x0 + x + sh, Y, c, o.alpha); } }
  return { x: x0, y: y0, w: W, h: H, cx: x0 + W / 2, top: y0 }; }
/** a glowing outline around the pet (drawn before it). */
function aura(im, S, f, cx, by, o, c, a) { for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2], [-1, -1], [1, -1], [-1, 1], [1, 1]]) pet(im, S, f, cx + dx, by + dy, Object.assign({}, o, { fx: () => c, alpha: a })); }
function shadow(im, cx, y, rw, a) { for (let x = -rw; x <= rw; x++) { const k = 1 - Math.abs(x) / (rw + 1); im.px(cx + x, y, [0, 0, 0], a * k); im.px(cx + x, y + 1, [0, 0, 0], a * k * 0.5); } }

/* ---------------------------------------------------------------- meme font (5x7, outlined) */
const GL = {};
["A01110100011000111111100011000110001","B11110100011000111110100011000111110","C01110100011000010000100001000101110","D11110100011000110001100011000111110","E11111100001000011110100001000011111","F11111100001000011110100001000010000","G01110100011000010111100011000101111","H10001100011000111111100011000110001","I01110001000010000100001000010001110","J00111000100001000010000101001001100","K10001100101010011000101001001010001","L10000100001000010000100001000011111","M10001110111010110101100011000110001","N10001100011100110101100111000110001","O01110100011000110001100011000101110","P11110100011000111110100001000010000","Q01110100011000110001101011001001101","R11110100011000111110101001001010001","S01111100001000001110000010000111110","T11111001000010000100001000010000100","U10001100011000110001100011000101110","V10001100011000110001100010101000100","W10001100011000110101101011010101010","X10001100010101000100010101000110001","Y10001100010101000100001000010000100","Z11111000010001000100010001000011111","001110100011001110101110011000101110","100100011000010000100001000010001110","201110100010000100010001000100011111","311111000100010000010000011000101110","400010001100101010010111110001000010","511111100001111000001000011000101110","600110010001000011110100011000101110","711111000010001000100010000100001000","801110100011000101110100011000101110","901110100011000101111000010001001100","!00100001000010000100001000000000100","?01110100010000100010001000000000100",".00000000000000000000000000110001100",",00000000000000000000011000010001000","'00100001000100000000000000000000000","\"01010010100000000000000000000000000","-00000000000000011111000000000000000","+00000001000010011111001000010000000",":00000011000110000000011000110000000","#01010010101111101010111110101001010","/00001000100001000100010000100010000","%11001110010001000100010001001110011","&01100100101010001000101011001001101","*00000101010111011111011101010100000","(00010001000100001000010000010000010",")01000001000001000010000100010001000","=00000000001111100000111110000000000","$00100011111010001110001011111000100","~00000010101111111111011100010000000"].forEach(s => { GL[s[0]] = s.slice(1); });
GL[' '] = '0'.repeat(35);
function glyphW(ch) { const g = GL[ch]; if (!g || /[A-Z0-9 #%&*$~?]/.test(ch)) return 5; let a = 5, b = -1; for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) if (g[r * 5 + c] === '1') { if (c < a) a = c; if (c > b) b = c; } return b < 0 ? 3 : b - a + 1; }
function glyphX0(ch) { const g = GL[ch]; if (!g || /[A-Z0-9 #%&*$~?]/.test(ch)) return 0; let a = 5; for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) if (g[r * 5 + c] === '1' && c < a) a = c; return a === 5 ? 0 : a; }
const T = s => String(s == null ? '' : s).toUpperCase().replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/♥|❤️?/g, '~').split('').filter(ch => GL[ch]).join('');
function textW(s, z) { s = T(s); let w = 0; for (const ch of s) w += (glyphW(ch) + 1) * z; return Math.max(0, w - z); }
/** text(im, s, cx, y, o): centred meme text. o: { z (2, shrinks to fit), c fill, c2 bottom fill, o outline, wave, t, alpha } */
function text(im, s, cx, y, o) { o = o || {}; s = T(s); if (!s) return 0; let z = o.z || 2; while (z > 1 && textW(s, z) > im.w - 6) z--;
  if (textW(s, z) > im.w - 4 && !o.line) { const ws = s.split(' '); let best = null; for (let i = 1; i < ws.length; i++) { const a = ws.slice(0, i).join(' '), b = ws.slice(i).join(' '), m = Math.max(textW(a, z), textW(b, z)); if (!best || m < best[2]) best = [a, b, m]; }
    if (best) { const lh = 7 * z + 3, y0 = o.up ? y - lh : y; text(im, best[0], cx, y0, Object.assign({}, o, { z, line: 1 })); text(im, best[1], cx, y0 + lh, Object.assign({}, o, { z, line: 1 })); return 2 * lh; } }
  while (s.length > 1 && textW(s, z) > im.w - 2) s = s.slice(0, -1);
  const tw = textW(s, z), x0 = Math.round(cx - tw / 2), c1 = o.c || C.white, c2 = o.c2 || c1, ol = o.o || [0, 0, 0], pts = [];
  let x = x0; s.split('').forEach((ch, i) => { const g = GL[ch], gw = glyphW(ch), gx = glyphX0(ch), dy = o.wave ? Math.round(Math.sin((o.t || 0) * 0.7 + i * 0.8) * o.wave) : 0;
    for (let r = 0; r < 7; r++) for (let c = gx; c < gx + gw; c++) if (g[r * 5 + c] === '1') pts.push([x + (c - gx) * z, y + r * z + dy, r]);
    x += (gw + 1) * z; });
  const a = o.alpha == null ? 1 : o.alpha;
  pts.forEach(([px, py]) => { for (let yy = -1; yy <= z + 1; yy++) for (let xx = -1; xx <= z + 1; xx++) im.px(px + xx + 1, py + yy + 1, [0, 0, 0], a * 0.6); });
  pts.forEach(([px, py]) => { for (let yy = -1; yy <= z; yy++) for (let xx = -1; xx <= z; xx++) im.px(px + xx, py + yy, ol, a); });
  pts.forEach(([px, py, r]) => { const k = r / 6; for (let yy = 0; yy < z; yy++) for (let xx = 0; xx < z; xx++) im.px(px + xx, py + yy, lerp(c1, c2, Math.min(1, k + yy / z / 7)), a); });
  return 7 * z; }
/** a caption that pops in (big, then settles) from frame f0. */
function pop(im, s, cx, y, f, f0, o) { if (f < f0 || !s) return; o = o || {}; const k = f - f0, z0 = o.z || 2, z = k === 0 ? z0 + 2 : k === 1 ? z0 + 1 : z0; text(im, s, cx, Math.max(1, y - (z - z0) * 4), Object.assign({}, o, { z, t: f })); }

/* ---------------------------------------------------------------- scenery */
const C = { night: [16, 14, 34], night2: [28, 24, 56], ground: [52, 40, 46], dirt: [92, 64, 52], dirtL: [130, 92, 70], grass: [56, 120, 60], grassL: [96, 170, 80], stone: [140, 140, 156], stoneD: [90, 90, 110],
  gold: [255, 201, 60], goldL: [255, 240, 170], goldD: [200, 120, 20], white: [255, 255, 255], pink: [255, 92, 150], pinkL: [255, 170, 205], red: [225, 29, 46], redD: [110, 10, 24], green: [120, 230, 90], toxic: [150, 255, 60],
  purple: [170, 90, 255], purpleL: [220, 180, 255], swamp: [24, 52, 40], swamp2: [36, 76, 54], sky: [40, 36, 84], cyan: [90, 230, 255], orange: [255, 140, 40], meat: [196, 82, 78], meatL: [236, 130, 120] };
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const grey = c => { const l = 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]; return [l, l, l]; };
const rnd = seed => () => (seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296;
const ease = t => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3), easeIn = t => Math.pow(Math.max(0, Math.min(1, t)), 2);
const back = t => { t = Math.max(0, Math.min(1, t)); const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
function sky(im, top, bot, y1) { y1 = y1 || im.h; for (let y = 0; y < y1; y++) { const c = lerp(top, bot, y / Math.max(1, y1 - 1)); for (let x = 0; x < im.w; x++) im.px(x, y, c); } }
function stars(im, seed, t, yMax) { const r = rnd(seed); yMax = yMax || im.h * 0.6; for (let i = 0; i < Math.round(im.w * im.h / 160); i++) { const x = r() * im.w, y = r() * yMax, tw = ((i * 7 + t) % 11) === 0, b = 0.35 + r() * 0.5;
  im.px(x, y, C.white, tw ? 1 : b); if (tw) { im.px(x - 1, y, C.white, 0.6); im.px(x + 1, y, C.white, 0.6); im.px(x, y - 1, C.white, 0.6); im.px(x, y + 1, C.white, 0.6); } } }
function disc(im, cx, cy, r, c, a) { for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) { const d = Math.sqrt(x * x + y * y); if (d <= r) im.px(cx + x, cy + y, c, (a == null ? 1 : a) * Math.min(1, r - d + 0.6)); } }
function glow(im, cx, cy, r, c, a) { for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) { const d = Math.sqrt(x * x + y * y) / r; if (d < 1) im.px(cx + x, cy + y, c, a * (1 - d) * (1 - d)); } }
function moon(im, cx, cy, r, c) { glow(im, cx, cy, r * 3, c, 0.25); disc(im, cx, cy, r, c); const d = lerp(c, [0, 0, 0], 0.18); disc(im, cx - r * 0.3, cy - r * 0.2, Math.max(1, r * 0.25), d); disc(im, cx + r * 0.35, cy + r * 0.3, Math.max(1, r * 0.18), d); }
function hills(im, y, c, seed, amp) { for (let x = 0; x < im.w; x++) { const h = Math.round(y - amp * (Math.sin(x * 0.07 + seed) * 0.6 + Math.sin(x * 0.19 + seed * 2) * 0.4)); for (let yy = h; yy < im.h; yy++) im.px(x, yy, c); } }
function ground(im, y, c1, c2, seed) { const r = rnd(seed || 3); im.rect(0, y, im.w, im.h - y, c1); for (let x = 0; x < im.w; x++) { im.px(x, y, c2); if (r() < 0.3) im.px(x, y - 1, c2); } for (let k = 0; k < im.w * (im.h - y) / 10; k++) im.px(r() * im.w, y + 2 + r() * (im.h - y), c2, 0.5); }
function rays(im, cx, cy, t, c, a, n) { n = n || 12; const R = Math.max(im.w, im.h); for (let y = 0; y < im.h; y++) for (let x = 0; x < im.w; x++) { const dx = x - cx, dy = y - cy, ang = Math.atan2(dy, dx) + t, s = ((ang / (Math.PI * 2) * n) % 1 + 1) % 1; if (s < 0.5) { const d = Math.sqrt(dx * dx + dy * dy) / R; im.px(x, y, c, a * Math.max(0, 1 - d * 1.2)); } } }
function sparkle(im, x, y, c, size) { size = size || 1; im.px(x, y, c); for (let k = 1; k <= size; k++) { const a = 1 - (k - 1) / (size + 1); im.px(x - k, y, c, a); im.px(x + k, y, c, a); im.px(x, y - k, c, a); im.px(x, y + k, c, a); } }
function heart(im, x, y, c, z) { z = z || 1; ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'].forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] === 'X') im.rect(x + i * z - 3.5 * z, y + j * z - 3 * z, z, z, (i === 1 && j === 1) ? C.white : c); }); }
function halo(im, cx, y, c) { glow(im, cx, y, 9, c, 0.5); for (let x = -6; x <= 6; x++) { const e = Math.abs(x) >= 5; im.px(cx + x, y + (e ? 0 : -1), c); if (!e) im.px(cx + x, y + 1, c); } im.px(cx - 7, y, c); im.px(cx + 7, y, c); }
function tomb(im, x, y, w, h, c, txt) { const cd = lerp(c, [0, 0, 0], 0.35), cl = lerp(c, C.white, 0.25); for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const r = w / 2, dy = j < r ? r - j : 0, dx = i + 0.5 - r; if (dy && dx * dx + dy * dy > r * r) continue; im.px(x + i, y + j, i === 0 || j === 0 ? cl : i === w - 1 ? cd : c); }
  if (txt) { const s = T(txt); let xx = x + Math.round((w - textW(s, 1)) / 2); for (const ch of s) { const g = GL[ch], gw = glyphW(ch), gx = glyphX0(ch); for (let r = 0; r < 7; r++) for (let cc = gx; cc < gx + gw; cc++) if (g[r * 5 + cc] === '1') im.px(xx + cc - gx, y + Math.round(w / 2) + r - 2, cd); xx += gw + 1; } } }
function egg(im, cx, by, wob, crack, base, z) { z = z || 2; /* a 12x15 egg, zoomed; wob tilts it; crack 0..3 */
  const sh = [4, 6, 8, 8, 10, 10, 10, 12, 12, 12, 12, 12, 10, 10, 8], H = sh.length;
  for (let j = 0; j < H; j++) { const wd = sh[j], tilt = wob * (H - j) / H; for (let i = 0; i < wd; i++) { const edge = i === 0 || i === wd - 1 || j === 0 || j === H - 1, c = edge ? [60, 40, 50] : lerp(base, C.white, (i < wd / 3 && j < H / 2) ? 0.45 : (i > wd * 0.7 ? -0.0 : 0));
    im.rect(cx + (-wd / 2 + i + tilt) * z, by + (-H + j) * z, z, z, i > wd * 0.72 && !edge ? lerp(c, [0, 0, 0], 0.15) : c); } }
  const cr = [[-3, 6], [-2, 5], [-1, 6], [0, 5], [1, 6], [2, 5], [3, 6], [4, 7]];
  if (crack > 0) cr.slice(0, Math.min(cr.length, crack * 3)).forEach(([dx, dy]) => im.rect(cx + (dx + wob / 2) * z, by + (-H + dy) * z, z, z, [40, 24, 30])); }
/** flying bits: n particles from (x, y), launched at frame f0; t = current frame. */
function burst(im, x, y, t, f0, seed, n, cols, o) { o = o || {}; const k = t - f0; if (k < 0 || k > (o.life || 18)) return; const r = rnd(seed);
  for (let i = 0; i < n; i++) { const a = (o.a0 == null ? 0 : o.a0) + r() * (o.spread == null ? Math.PI * 2 : o.spread), v = (o.v || 2) * (0.4 + r() * 0.8), c = cols[i % cols.length], g = o.g == null ? 0.12 : o.g, sz = o.size || 1;
    const px = x + Math.cos(a) * v * k, py = y + Math.sin(a) * v * k + g * k * k, fade = 1 - k / (o.life || 18); if (sz > 1) im.rect(px, py, sz, sz, c, Math.min(1, fade * 1.5)); else im.px(px, py, c, Math.min(1, fade * 1.5)); } }
function confetti(im, t, seed, n) { const r = rnd(seed), cols = [C.gold, C.pink, C.cyan, C.green, C.white, C.purple, C.orange]; for (let i = 0; i < n; i++) { const x = (r() * im.w + Math.sin((t + i) * 0.3) * 3) % im.w, sp = 0.6 + r() * 1.2, y = ((r() * im.h * 1.5 + t * sp) % (im.h + 10)) - 8, c = cols[i % cols.length];
  im.px(x, y, c); if ((t + i) % 3) im.px(x + 1, y, c); } }
function speedLines(im, cx, cy, t, c, a) { const r = rnd(t * 13 + 1), R = Math.max(im.w, im.h); for (let i = 0; i < 26; i++) { const ang = r() * Math.PI * 2, r0 = R * (0.35 + r() * 0.2); for (let d = r0; d < R; d += 1) im.px(cx + Math.cos(ang) * d, cy + Math.sin(ang) * d, c, a * (d - r0) / (R - r0)); } }
function hpBar(im, x, y, w, frac, c) { im.rect(x - 1, y - 1, w + 2, 6, [0, 0, 0]); im.rect(x, y, w, 4, [60, 20, 30]); im.rect(x, y, Math.round(w * Math.max(0, Math.min(1, frac))), 4, c || C.red); im.rect(x, y, Math.round(w * Math.max(0, Math.min(1, frac))), 1, C.white, 0.35); }
function name(p) { return p ? ((p.name || 'PET') + ' #' + p.id) : ''; }

/* ---------------------------------------------------------------- scenes (each returns { frames, delays }) */
const W1 = 112, H1 = 80, W2 = 176;
const out0 = () => ({ frames: [], delays: [] });
function push(A, im, d, sh) { A.frames.push(sh ? shake(im, sh[0], sh[1]) : im); A.delays.push(d); }
const jit = (f, a) => [Math.round(Math.sin(f * 2.1) * a), Math.round(Math.cos(f * 1.7) * a * 0.6)];
/* rarity colours for captions */
const TIER_C = [[C.white, [200, 200, 210]], [C.green, [60, 170, 60]], [C.cyan, [40, 120, 255]], [C.goldL, C.gold]];

/** hatch: the egg wobbles harder and harder, cracks, flash, the pet bursts out to god rays and confetti. */
function hatch(S, E, o) { o = o || {}; const A = out0(), gy = H1 - 10, cx = W1 >> 1, tc = TIER_C[o.tier == null ? 3 : o.tier] || TIER_C[3], rc = o.tier === 3 || o.tier == null ? C.gold : tc[1];
  const scene = f => { const im = new Img(W1, H1); sky(im, [14, 10, 44], [86, 36, 110], gy); stars(im, 3, f, gy - 20); moon(im, 92, 14, 5, [255, 240, 210]); hills(im, gy - 6, [40, 22, 66], 1, 4); ground(im, gy, [44, 96, 54], C.grassL, 5); return im; };
  for (let f = 0; f < 24; f++) { const im = scene(f), lvl = f < 8 ? 1 : f < 16 ? 2 : 3, wob = (f % 4 < 2 ? -1 : 1) * lvl * (f % 2 ? 0.5 : 1), cr = f < 10 ? 0 : f < 16 ? 1 : f < 21 ? 2 : 3;
    shadow(im, cx, gy, 14, 0.5); glow(im, cx, gy - 16, 22, rc, 0.08 + f * 0.012);
    if (E) pet(im, E, 0, cx, gy, { shear: wob * 2, fx: (x, y, c) => cr && y > 7 && y < 11 && ((x + y * 2) % 4 === 0) && x > 6 && x < 24 - (3 - cr) * 4 ? [40, 24, 30] : c }); else egg(im, cx, gy, wob, cr, [236, 228, 200], 2);
    if (lvl >= 2) burst(im, cx, gy - 18, f, f - (f % 4), f, 4, [C.goldL, C.white], { v: 1.2, life: 4, g: 0 });
    pop(im, o.top0 || 'WHAT IS IT?!', cx, 4, f, 2, { z: 2 });
    push(A, im, f === 0 ? 40 : f < 16 ? 7 : 5, lvl === 3 ? jit(f, 1) : null); }
  for (let f = 0; f < 3; f++) { const im = new Img(W1, H1, C.white); if (f) { wash(im, C.goldL, 0.4); glow(im, cx, gy - 20, 60, rc, 0.6); } push(A, im, 4); }
  for (let f = 0; f < 34; f++) { const im = scene(f + 24); rays(im, cx, gy - 22, f * 0.06, rc, 0.32, 14); glow(im, cx, gy - 20, 40, rc, 0.25);
    const sq = [[1.5, 0.5], [0.75, 1.35], [1.15, 0.85], [0.95, 1.08], [1.02, 0.98]][f] || [1, 1], jump = f < 6 ? Math.round(Math.sin(f / 5 * Math.PI) * 10) : Math.round(Math.abs(Math.sin(f * 0.35)) * 2);
    shadow(im, cx, gy, 16 - jump / 2, 0.5);
    burst(im, cx, gy - 14, f, 0, 77, 10, [[236, 228, 200], [200, 190, 160]], { v: 2.2, a0: -Math.PI, spread: Math.PI, g: 0.25, life: 16, size: 2 });
    burst(im, cx, gy - 24, f, 0, 91, 26, [C.goldL, C.white, rc, C.pink], { v: 2.6, g: 0.05, life: 22 });
    pet(im, S, f, cx, gy - jump, { sx: sq[0], sy: sq[1] });
    if (f > 8) confetti(im, f, 13, 26);
    for (let k = 0; k < 3; k++) { const a = f * 0.25 + k * 2.1; sparkle(im, cx + Math.cos(a) * 30, gy - 26 + Math.sin(a) * 18, k % 2 ? C.white : C.goldL, 1 + (f + k) % 2); }
    pop(im, o.top || 'LEGENDARY!', cx, 3, f, 2, { z: 2, c: tc[0], c2: tc[1], wave: 1 });
    pop(im, o.bottom, cx, H1 - 9, f, 8, { z: 1, up: true });
    push(A, im, f === 33 ? 220 : 6, f < 4 ? jit(f, 2) : null); }
  return A; }

/** rise: lightning over the cemetery, the ground shakes, the zombie claws out and glows. */
function rise(S, o) { o = o || {}; const A = out0(), gy = H1 - 9, cx = W1 / 2 - 6, tint = o.tint || C.toxic;
  const scene = (f, flash) => { const im = new Img(W1, H1); sky(im, flash ? [120, 160, 140] : [6, 14, 12], flash ? [200, 230, 210] : [34, 66, 50], gy); stars(im, 11, f, 30); moon(im, 88, 15, 7, [220, 255, 200]);
    [[6, 10, 13], [24, 8, 11], [70, 9, 12], [100, 8, 10]].forEach(([x, w, h]) => tomb(im, x, gy - h - 4, w, h, [40, 60, 54])); hills(im, gy - 3, [24, 38, 32], 2, 2);
    for (let i = 0; i < 3; i++) { const y = gy - 6 - i * 5; for (let x = 0; x < W1; x++) im.px(x, y + Math.sin((x + f * 2 * (i + 1)) * 0.08) * 1.5, [180, 220, 200], 0.08); }
    ground(im, gy, [50, 36, 34], C.dirtL, 9); tomb(im, cx + 24, gy - 22, 15, 22, [130, 136, 150], 'RIP'); return im; };
  for (let f = 0; f < 46; f++) { const flash = f === 6 || f === 8, im = scene(f, flash), up = ease((f - 10) / 16), oy = gy + Math.round((1 - up) * 70), mound = f < 30;
    if (flash) { let x = 30; for (let y = 0; y < gy - 20; y++) { x += (rnd(f * 99 + y)() - 0.5) * 3; im.px(x, y, C.white); im.px(x + 1, y, [200, 255, 255]); } }
    if (mound) for (let x = -20; x <= 20; x++) { const h = Math.round(4 * Math.cos(x / 20 * Math.PI / 2)); for (let y = 0; y < h; y++) im.px(cx + x, gy - y, C.dirt); }
    if (f >= 10) { if (f > 26) { glow(im, cx, gy - 30, 34, tint, 0.18 + 0.08 * Math.sin(f)); aura(im, S, f, cx, oy, {}, tint, 0.35 + 0.2 * Math.sin(f * 0.8)); }
      pet(im, S, f, cx, oy, { clipY: gy - 1, fx: (x, y, c) => lerp(c, tint, 0.38) }); }
    if (f >= 2 && f < 30) burst(im, cx, gy - 1, f, f - (f % 3), f * 7, 8, [C.dirt, C.dirtL, [70, 50, 40]], { v: 1.6, a0: -Math.PI, spread: Math.PI, g: 0.2, life: 8, size: f > 12 ? 2 : 1 });
    if (f > 26) { const r = rnd(f); for (let k = 0; k < 4; k++) im.px(cx - 24 + r() * 48, gy - 10 - r() * 40, tint, 0.8); }
    pop(im, o.top || "IT'S ALIVE!!", W1 >> 1, 3, f, 27, { z: 2, c: tint, c2: lerp(tint, [0, 0, 0], 0.4), wave: 1 });
    pop(im, o.bottom, W1 >> 1, H1 - 9, f, 32, { z: 1, up: true });
    push(A, im, f === 45 ? 220 : f < 10 ? 8 : 6, f < 28 ? jit(f, f < 10 ? 1 : 2) : null); }
  return A; }

/** miracle: a grey dead pet, the clouds part, a beam of light, colour floods back, halo. */
function miracle(S, o) { o = o || {}; const A = out0(), gy = H1 - 9, cx = W1 >> 1;
  for (let f = 0; f < 46; f++) { const im = new Img(W1, H1), lit = ease((f - 6) / 12); sky(im, lerp([20, 22, 40], [120, 140, 220], lit), lerp([50, 50, 70], [255, 220, 170], lit), gy); if (lit < 0.6) stars(im, 5, f, 40);
    for (let k = 0; k < 6; k++) { const side = k % 2 ? 1 : -1, x = cx + side * (12 + lit * 40) + side * k * 6, y = 6 + (k >> 1) * 5; for (let i = -9; i <= 9; i++) for (let j = -3; j <= 3; j++) if (i * i / 81 + j * j / 9 < 1) im.px(x + i, y + j, lerp([60, 60, 80], C.white, lit), 0.9); }
    ground(im, gy, [60, 80, 60], [90, 120, 80], 4);
    const beam = ease((f - 8) / 8); if (beam > 0) { for (let y = 0; y < gy; y++) for (let x = -16; x <= 16; x++) im.px(cx + x, y, C.goldL, (0.45 - Math.abs(x) * 0.025) * beam); rays(im, cx, gy - 20, f * 0.05, C.goldL, 0.15 * beam, 16); }
    const col = ease((f - 18) / 10), float = Math.round(Math.sin(Math.min(1, Math.max(0, (f - 16) / 20)) * Math.PI) * 8);
    shadow(im, cx, gy, 14, 0.4);
    pet(im, S, f, cx, gy - float, { fx: (x, y, c) => lerp(grey(c), c, col) });
    if (f >= 30) halo(im, cx, gy - float - (S.bb.y1 - S.bb.y0 + 1) * 2 - 4, C.gold);
    if (f >= 18) for (let k = 0; k < 6; k++) { const a = f * 0.3 + k * 1.05, r = 26 - (f - 18) * 0.3; sparkle(im, cx + Math.cos(a) * r, gy - 26 + Math.sin(a) * r * 0.6, k % 2 ? C.white : C.goldL, 1); }
    if (f === 30 || f === 31) wash(im, C.white, f === 30 ? 0.8 : 0.4);
    burst(im, cx, gy - 30, f, 30, 41, 26, [C.goldL, C.white, C.pinkL], { v: 2.4, g: 0.04, life: 16 });
    pop(im, o.top || 'MIRACLE!!', cx, 3, f, 30, { z: 2, c: C.goldL, c2: C.gold, wave: 1 });
    pop(im, o.bottom || 'BACK FROM THE DEAD', cx, H1 - 9, f, 34, { z: 1, up: true });
    push(A, im, f === 45 ? 220 : 6); }
  return A; }

/** dust: storm, lightning strikes, the pet crumbles and blows away. Press F. */
function dust(S, o) { o = o || {}; const A = out0(), gy = H1 - 9, cx = W1 / 2 - 8, sp0 = S[0], bb = S.bb, bw = bb.x1 - bb.x0 + 1, bh = bb.y1 - bb.y0 + 1, r = rnd(bw * 131 + 7), drift = [];
  for (let j = 0; j < bw * bh * 4; j++) drift.push({ t: 16 + (((j % (bw * 2)) / (bw * 2)) * 10) + r() * 8, vx: 0.8 + r() * 2.2, vy: -0.8 + r() * 1.2 });
  for (let f = 0; f < 48; f++) { const strike = f === 14 || f === 15, im = new Img(W1, H1); sky(im, strike ? [200, 200, 255] : [20, 18, 30], strike ? [255, 255, 255] : [60, 56, 74], gy);
    const rr = rnd(f * 5 + 1); for (let k = 0; k < 40; k++) { const x = (rr() * W1 + f * 3) % W1, y = (rr() * gy + f * 6) % gy; im.px(x, y, [150, 160, 200], 0.5); im.px(x - 1, y - 2, [150, 160, 200], 0.3); }
    ground(im, gy, [44, 40, 46], [70, 64, 70], 8); tomb(im, cx + 30, gy - 20, 14, 20, C.stone, f > 36 ? 'RIP' : '');
    if (strike) { let x = cx + 4; for (let y = 0; y < gy - 30; y++) { x += (rnd(y * 17 + f)() - 0.5) * 4; for (let w = -1; w <= 1; w++) im.px(x + w, y, w ? [180, 220, 255] : C.white); } }
    const fade = ease((f - 8) / 10), ix = Math.round(cx - bw), iy = gy - bh * 2;
    for (let y = 0; y < bh * 2; y++) for (let x = 0; x < bw * 2; x++) { const sx = bb.x0 + (x >> 1), sy = bb.y0 + (y >> 1), sp = S[f % S.length], j = sy * sp.w + sx; if (!sp.m[j]) continue; const q = drift[y * bw * 2 + x];
      const c = lerp([sp.d[j * 4], sp.d[j * 4 + 1], sp.d[j * 4 + 2]], [150, 140, 130], fade); const tr = f < 12 ? (f % 2 ? 1 : 0) : 0;
      if (f < q.t) im.px(ix + x + tr, iy + y, c); else { const k = f - q.t, X = ix + x + q.vx * k * 1.6, Y = iy + y + q.vy * k + 0.08 * k * k; if (Y < gy && k < 14) im.px(X, Y, lerp(c, [170, 160, 150], Math.min(1, k / 4)), 1 - k / 14); } }
    if (f > 30) for (let x = -8; x <= 8; x++) { const h = Math.max(0, Math.round(2 * Math.cos(x / 8 * Math.PI / 2))); for (let y = 0; y < h; y++) im.px(cx + x, gy - 1 - y, [150, 140, 130]); }
    if (strike) wash(im, C.white, 0.35);
    pop(im, o.top || 'RIP', W1 >> 1, 3, f, 34, { z: 3, c: [210, 210, 220], c2: [140, 140, 160] });
    pop(im, o.bottom || 'PRESS F', W1 >> 1, H1 - 9, f, 38, { z: 1, up: true });
    push(A, im, f === 47 ? 230 : 6, strike || (f > 14 && f < 18) ? jit(f, 2) : null); }
  return A; }

/** breed: pink swamp sunset, the two hop together, a beating heart, the egg drops in. */
function breed(Pa, Pb, E, o) { o = o || {}; const A = out0(), W = W2, gy = H1 - 10, cx = W >> 1;
  for (let f = 0; f < 50; f++) { const im = new Img(W, H1); sky(im, [70, 30, 90], [255, 140, 150], gy); disc(im, cx, gy - 18, 16, [255, 210, 120]); glow(im, cx, gy - 18, 40, [255, 180, 120], 0.25);
    for (let x = 0; x < W; x++) { im.px(x, gy - 2, [255, 170, 160], 0.4); }
    hills(im, gy - 4, [90, 40, 80], 3, 3); ground(im, gy, [40, 90, 70], [80, 150, 100], 6);
    for (let k = 0; k < 7; k++) { const x = 6 + k * 23, h = 10 + (k * 7) % 8; for (let y = 0; y < h; y++) im.px(x + Math.sin((y + f * 0.5) * 0.3) * (y / h), gy - y, [30, 70, 50]); im.rect(x - 1, gy - h - 3, 3, 4, [120, 70, 40]); }
    const neon = f % 9 === 4 ? 0.35 : 1; text(im, "GOOBY'S MOTEL", cx, 3, { z: 1, c: C.pinkL, c2: C.pink, o: [80, 0, 40], alpha: neon });
    const walk = ease(f / 16) * 0.5 - (f >= 28 ? ease((f - 28) / 6) * 0.5 : 0), ha = Math.abs(Math.sin(f * 0.6)) * (f < 16 ? 4 : 0), ax = 26 + walk * 20, bx = W - 26 - walk * 20;
    shadow(im, ax, gy, 14, 0.35); shadow(im, bx, gy, 14, 0.35);
    pet(im, Pa, f, ax, gy - ha, {}); pet(im, Pb, f, bx, gy - Math.abs(Math.sin(f * 0.6 + 1)) * (f < 16 ? 4 : 0), { flip: true });
    if (f >= 14 && f < 30) { const beat = (f % 4 < 2) ? 3 : 2; heart(im, cx, 30, C.pink, beat); }
    if (f >= 4) for (let k = 0; k < 7; k++) { const t = (f - 4 + k * 5) % 30, x = cx - 30 + k * 10 + Math.sin((f + k) * 0.4) * 3, y = gy - 10 - t * 1.6; if (t < 26) heart(im, x, y, k % 2 ? C.pinkL : C.pink, 1); }
    if (f === 30 || f === 31) wash(im, C.pinkL, f === 30 ? 0.8 : 0.4);
    if (f >= 30) { const k = f - 30, drop = k < 8 ? easeIn(k / 8) : 1, bounce = k >= 8 && k < 14 ? Math.round(Math.sin((k - 8) / 6 * Math.PI) * 6) : 0, ey = Math.round(gy - (1 - drop) * 60) - bounce;
      glow(im, cx, gy - 14, 24, C.goldL, 0.35); shadow(im, cx, gy, 9, 0.4);
      if (E) pet(im, E, 0, cx, ey, { z: 2 }); else egg(im, cx, ey, (k % 4) - 1.5, 0, [236, 228, 200], 2);
      burst(im, cx, gy - 4, f, 38, 23, 14, [C.goldL, C.white, C.pink], { v: 2, a0: -Math.PI, spread: Math.PI, g: 0.1, life: 14 }); confetti(im, f, 5, 30); }
    pop(im, o.top || "IT'S A MATCH!", cx, 13, f, 30, { z: 2, c: C.pinkL, c2: C.pink, wave: 1 });
    pop(im, o.bottom, cx, H1 - 9, f, 36, { z: 1, up: true });
    push(A, im, f === 49 ? 220 : 6, f === 30 || f === 38 ? jit(f, 2) : null); }
  return A; }

/** devour: the zombie creeps up, lunges, CHOMP, the Mythic is sucked in as purple light, the zombie is cured. */
function devour(Z, M, o) { o = o || {}; const A = out0(), W = W2, gy = H1 - 9, mx = W - 34;
  for (let f = 0; f < 50; f++) { const im = new Img(W, H1); sky(im, [16, 8, 30], [70, 30, 90], gy); stars(im, 2, f, 40); moon(im, W >> 1, 16, 8, [230, 200, 255]); hills(im, gy - 4, [30, 16, 44], 4, 3); ground(im, gy, [40, 30, 44], [70, 50, 80], 2);
    const lunge = f < 12 ? Math.sin(f * 0.5) * 2 : ease((f - 12) / 5) * 48, zx = 34 + lunge, eaten = ease((f - 19) / 14), cured = ease((f - 36) / 8);
    if (f >= 12 && f < 18) speedLines(im, zx, gy - 20, f, C.white, 0.5);
    if (eaten < 1) { const mf = f < 18 ? (f % 2 ? 1 : 0) : 0; glow(im, mx, gy - 20, 26, C.purple, 0.25); shadow(im, mx, gy, 14, 0.4);
      pet(im, M, f, mx + mf, gy, { fx: (x, y, c) => (((x * 7 + y * 3) % 10) / 10 < eaten ? null : lerp(c, C.purple, eaten)) });
      if (f < 18) text(im, '!', mx, 14, { z: 2, c: C.red }); }
    if (f >= 19 && f < 36) { const r = rnd(f * 9); for (let k = 0; k < 24; k++) { const t = r(), sx = mx - 10 + r() * 24, sy = gy - 40 + r() * 36, tx = zx + 8, ty = gy - 26; im.px(sx + (tx - sx) * t, sy + (ty - sy) * t, k % 3 ? C.purple : C.purpleL); } }
    const grow = f >= 19 ? 1 + 0.15 * Math.min(1, (f - 19) / 14) * (1 - cured * 0.5) : 1;
    if (f >= 19) { glow(im, zx, gy - 22, 30, lerp(C.purple, C.goldL, cured), 0.3); aura(im, Z, f, zx, gy, { sx: grow, sy: grow }, lerp(C.purple, C.goldL, cured), 0.4); }
    shadow(im, zx, gy, 15, 0.4); pet(im, Z, f, zx, gy, { sx: grow, sy: grow, fx: (x, y, c) => lerp(c, C.green, 0.4 * (1 - cured)) });
    if (f >= 18 && f < 23) { wash(im, C.white, f === 18 ? 0.7 : 0.15); text(im, 'CHOMP!', zx + 26, 22, { z: 2, c: C.goldL, c2: C.orange }); }
    if (f >= 36) tomb(im, mx - 7, gy - 22, 16, 22, [150, 120, 200], 'RIP');
    if (cured > 0) for (let k = 0; k < 4; k++) sparkle(im, zx - 14 + rnd(f * 3 + k)() * 28, gy - 44 + rnd(f * 5 + k)() * 30, C.goldL, 1);
    pop(im, o.top || 'OM NOM NOM', W >> 1, 3, f, 19, { z: 2, c: C.purpleL, c2: C.purple, wave: 1 });
    pop(im, o.bottom || 'ZOMBIE CURED!', W >> 1, H1 - 9, f, 38, { z: 1, up: true });
    push(A, im, f === 49 ? 220 : 6, f >= 18 && f < 24 ? jit(f, 3) : null); }
  return A; }

/** rage: unleashed (red) or full power (toxic green): pulsing aura, speed lines, shaking. */
function rage(S, o) { o = o || {}; const c = o.color || C.red, A = out0(), gy = H1 - 9, cx = W1 >> 1;
  for (let f = 0; f < 36; f++) { const im = new Img(W1, H1), beat = f % 6 < 2 ? 1 : 0, pulse = 0.5 + 0.5 * Math.sin(f / 6 * Math.PI * 2);
    sky(im, lerp([10, 0, 4], lerp(c, [0, 0, 0], 0.7), 0.6), lerp(c, [0, 0, 0], 0.45 - beat * 0.15), H1); rays(im, cx, gy - 22, f * 0.12, c, 0.22 + beat * 0.1, 10); speedLines(im, cx, gy - 22, f, C.white, 0.25);
    ground(im, gy, [30, 10, 14], lerp(c, [0, 0, 0], 0.5), 7);
    const z = 1 + beat * 0.06; glow(im, cx, gy - 22, 36, c, 0.25 + pulse * 0.2); aura(im, S, f, cx, gy, { sx: z, sy: z }, c, 0.45 + pulse * 0.35);
    pet(im, S, f, cx + (f % 2 ? 1 : -1), gy, { sx: z, sy: z, fx: (x, y, cc) => lerp(cc, c, 0.2 + pulse * 0.2) });
    burst(im, cx, gy - 20, f, f - (f % 6), f, 10, [c, C.white], { v: 2.2, g: 0, life: 6 });
    text(im, o.top || 'UNLEASHED', cx, 3 + beat, { z: 2, c: beat ? C.white : lerp(c, C.white, 0.4), c2: c, wave: 1, t: f });
    if (f > 8) text(im, o.bottom || 'RUN.', cx, H1 - 9, { z: 1 });
    push(A, im, f === 35 ? 160 : 6, jit(f, 1 + beat)); }
  return A; }

/** shine: a new Mythic (or Legendary) on a stage of turning god rays, sparkles orbiting, crown of light. */
function shine(S, o) { o = o || {}; const A = out0(), gy = H1 - 10, cx = W1 >> 1, c = o.color || C.gold;
  for (let f = 0; f < 40; f++) { const im = new Img(W1, H1); sky(im, [20, 10, 50], [90, 40, 140], H1); stars(im, 9, f, H1); rays(im, cx, gy - 22, f * 0.05, c, 0.3, 16); glow(im, cx, gy - 22, 44, c, 0.3);
    for (let x = -30; x <= 30; x++) { const k = 1 - Math.abs(x) / 31; im.px(cx + x, gy, lerp([60, 40, 90], c, 0.4 * k)); im.px(cx + x, gy + 1, [40, 26, 66]); } im.rect(0, gy + 2, W1, H1 - gy - 2, [30, 20, 52]);
    const bob = Math.round(Math.sin(f / 40 * Math.PI * 4) * 2), b = pet(im, S, f, cx, gy - 1 - bob, {});
    if (o.halo !== false) halo(im, cx, b.top - 4, C.gold);
    for (let k = 0; k < 8; k++) { const a = f / 40 * Math.PI * 2 * 2 + k * Math.PI / 4, rx = 34, ry = 12; sparkle(im, cx + Math.cos(a) * rx, gy - 22 + Math.sin(a) * ry, k % 2 ? C.white : C.goldL, (f + k) % 3 === 0 ? 2 : 1); }
    if (f < 2) wash(im, C.white, f ? 0.4 : 0.8);
    pop(im, o.top || 'NEW MYTHIC!', cx, 3, f, 0, { z: 2, c: C.goldL, c2: C.gold, wave: 1 });
    pop(im, o.bottom, cx, H1 - 8, f, 4, { z: 1, up: true });
    push(A, im, f === 39 ? 200 : 6); }
  return A; }
/** idle: the pet on a quiet night (no caption unless given). */
function idle(S, o) { o = o || {}; return shine(S, Object.assign({ halo: false, top: o.top || ' ', color: C.purpleL }, o)); }

/** grind: the Meat Grinder. The pet sweats over the hopper, drops in, the machine shakes and spits sausages (+1 MEAT), golden one last. */
function grind(S, o) { o = o || {}; const A = out0(), W = 128, H = 108, gy = H - 8, gx = 40, T0 = 64, steel = [168, 176, 192], steelL = [220, 226, 236], steelD = [86, 90, 108];
  const wall = (im, f) => { for (let y = 0; y < gy; y++) for (let x = 0; x < W; x++) { const tx = x % 12, ty = y % 12; im.px(x, y, tx === 0 || ty === 0 ? [150, 170, 190] : ((x / 12 | 0) + (y / 12 | 0)) % 2 ? [226, 234, 240] : [200, 220, 236]); }
    for (let x = 0; x < W; x++) { im.px(x, gy - 18, [120, 30, 40]); im.px(x, gy - 17, [160, 40, 50]); }
    const on = f % 10 !== 3; im.rect(84, 34, 40, 13, [40, 10, 20]); text(im, 'MEAT', 104, 37, { z: 1, c: on ? [255, 90, 110] : [120, 50, 60], o: [40, 10, 20] }); if (on) glow(im, 104, 40, 22, [255, 60, 90], 0.25);
    im.rect(0, gy, W, H - gy, [90, 60, 50]); for (let x = 0; x < W; x += 8) im.rect(x, gy, 1, H - gy, [70, 46, 40]); };
  const machine = (im, f, sh) => { const sx = sh ? (f % 2 ? 1 : -1) : 0, sy = sh ? (f % 3 === 0 ? -1 : 0) : 0, X = gx + sx, Y = sy;
    for (let j = 0; j < 14; j++) { const half = 20 - j; for (let x = -half; x <= half; x++) im.px(X + x, Y + T0 + j, j === 0 ? steelL : Math.abs(x) >= half - 1 ? steelD : x < -half / 2 ? steelL : steel); }
    im.rect(X - 12, Y + T0 + 14, 25, 18, steel); im.rect(X - 12, Y + T0 + 14, 25, 2, steelL); im.rect(X + 11, Y + T0 + 14, 2, 18, steelD); im.rect(X - 12, Y + T0 + 31, 25, 1, steelD);
    [[-9, 17], [9, 17], [-9, 28], [9, 28]].forEach(([x, y]) => { im.px(X + x, Y + T0 + y, steelD); im.px(X + x + 1, Y + T0 + y, steelL); });
    im.rect(X + 13, Y + T0 + 18, 14, 8, steel); im.rect(X + 13, Y + T0 + 18, 14, 2, steelL); im.rect(X + 26, Y + T0 + 16, 3, 12, steelD); for (let k = 0; k < 4; k++) im.px(X + 27, Y + T0 + 18 + k * 3, [40, 40, 50]);
    const a = f * (sh ? 1.3 : 0.4), hx = X - 17 + Math.round(Math.cos(a) * 7), hy = Y + T0 + 22 + Math.round(Math.sin(a) * 7);
    im.rect(X - 18, Y + T0 + 20, 6, 5, steelD); for (let t = 0; t <= 8; t++) im.rect(X - 15 + (hx - X + 15) * t / 8, Y + T0 + 22 + (hy - Y - T0 - 22) * t / 8, 2, 2, steelD); disc(im, hx, hy, 2, C.red);
    im.rect(X - 10, T0 + 32, 4, gy - T0 - 32, steelD); im.rect(X + 7, T0 + 32, 4, gy - T0 - 32, steelD); };
  const link = (im, x, y, gold, z) => { z = z || 2; const c = gold ? C.gold : C.meat, l = gold ? C.goldL : C.meatL, d = gold ? C.goldD : [140, 50, 50]; im.rect(x + z, y, 6 * z, 4 * z, c); im.rect(x, y + z, 8 * z, 2 * z, c); im.rect(x + z, y + 3 * z, 6 * z, z, d); im.rect(x + 2 * z, y + z, 3 * z, z, l); im.rect(x - z, y + 2 * z, z, z, d); im.rect(x + 8 * z, y + 2 * z, z, z, d); };
  const N = 60, F0 = 14, gold = o.gold !== false, nS = gold ? 6 : 5;
  for (let f = 0; f < N; f++) { const im = new Img(W, H); wall(im, f); const g = f - F0, sh = g >= 9 && g < 30;
    if (g < 10) { const top = T0 + 2, y = g < 0 ? top + (f % 6 < 3 ? -1 : 0) : Math.round(top + easeIn(g / 9) * 50); const b = pet(im, S, f, gx + (g < 0 && f % 4 < 2 ? 1 : 0), y, { clipY: T0 + 1 });
      if (g < 0) { im.px(b.x + b.w + 2, b.top + 6, C.cyan); im.rect(b.x + b.w + 1, b.top + 7, 3, 3, C.cyan); text(im, '?!', b.x + b.w + 8, b.top - 4, { z: 1 }); } }
    machine(im, f, sh);
    if (sh) { burst(im, gx, T0, f, f - (f % 4), f * 3, 12, [C.meat, C.meatL, [255, 200, 200]], { v: 1.8, a0: -Math.PI, spread: Math.PI, g: 0.18, life: 8, size: 2 }); for (let k = 0; k < 3; k++) glow(im, gx - 10 + k * 10, T0 - 6 - ((f + k * 3) % 8), 5, C.white, 0.3); }
    let goldX = -1, goldY = 0;
    for (let k = 0; k < nS; k++) { const age = g - (14 + k * 4); if (age < 0) continue; const tx = W - 22 - (k % 3) * 18, ty = gy - 8 - Math.floor(k / 3) * 7, ox = gx + 29, oy = T0 + 18, t = Math.min(1, age / 6);
      const x = ox + (tx - ox) * t, y = oy + (ty - oy) * t - Math.sin(t * Math.PI) * 14, isG = gold && k === nS - 1; link(im, x, y, isG, 2); if (isG) { goldX = x + 8; goldY = y + 4; }
      if (age < 10 && !isG) text(im, '+1', tx + 8, ty - 10 - age, { z: 1, alpha: 1 - age / 10 }); }
    if (goldX >= 0 && f > N - 16) { rays(im, goldX, goldY, f * 0.1, C.gold, 0.18, 12); for (let k = 0; k < 4; k++) sparkle(im, goldX - 10 + rnd(f * 7 + k)() * 20, goldY - 8 + rnd(f * 11 + k)() * 12, C.goldL, 1 + (f + k) % 2); }
    pop(im, o.top || 'GRIND TIME', W >> 1, 3, f, F0, { z: 2, c: [255, 120, 130], c2: C.red, wave: 1 });
    if (gold && f > N - 16) pop(im, o.bottom || 'GOLDEN SAUSAGE!', W >> 1, 30, f, N - 15, { z: 1, c: C.goldL, c2: C.gold });
    push(A, im, f === N - 1 ? 230 : g < 0 ? 8 : 6, sh ? [0, 0] : null); }
  return A; }

/** raid boss scenes. phase: 'open' (it rises, HP bar fills), 'hit' (damage, bar drops to pct), 'kill' (explodes), 'escape' (flies off). */
function raid(B, o) { o = o || {}; const A = out0(), W = W1 + 16, gy = H1 - 6, cx = W >> 1, ph = o.phase || 'open', pct = o.pct == null ? 1 : o.pct, N = ph === 'open' ? 44 : 46, bh = B.bb.y1 - B.bb.y0 + 1;
  for (let f = 0; f < N; f++) { const im = new Img(W, H1), flash = (ph === 'open' && (f === 5 || f === 7)) || (ph === 'kill' && f >= 20 && f < 23);
    sky(im, flash ? [255, 200, 200] : [30, 4, 10], flash ? [255, 255, 255] : [130, 20, 30], gy); stars(im, 4, f, 30);
    if (ph !== 'escape') rays(im, cx, gy - bh / 2, f * 0.04, [255, 60, 40], 0.18, 12);
    for (let x = 0; x < W; x++) { const h = 4 + Math.round(3 * Math.abs(Math.sin(x * 0.3 + f * 0.5))); for (let y = 0; y < h; y++) im.px(x, gy - y, lerp(C.orange, C.red, y / h), 0.7); }
    ground(im, gy, [40, 10, 14], [90, 20, 24], 3);
    let by = gy, alpha = 1, fx = null, bx = cx;
    if (ph === 'open') { by = gy + Math.round((1 - ease((f - 4) / 18)) * (bh + 4)); }
    if (ph === 'hit') { const hit = f % 8 < 2; bx += hit ? (f % 2 ? 3 : -3) : 0; if (f % 8 === 0) fx = (x, y, c) => lerp(c, C.white, 0.45); }
    if (ph === 'kill') { if (f < 20) { bx += f % 2 ? 2 : -2; if (f % 4 < 2) fx = (x, y, c) => lerp(c, C.white, 0.5); } else alpha = 0; }
    if (ph === 'escape') { by = gy - Math.round(easeIn((f - 12) / 24) * 120); }
    if (alpha) { glow(im, bx, by - bh / 2, bh, [255, 120, 80], 0.35); aura(im, B, 0, bx, by, { z: 1, clipY: gy }, [255, 220, 180], 0.55); const b = pet(im, B, 0, bx, by, { z: 1, clipY: gy, fx: fx || ((x, y, c) => lerp(c, [255, 230, 210], 0.12)) }); if (ph === 'hit' && f % 8 < 3) { burst(im, bx + (f % 16 < 8 ? -8 : 8), by - bh / 2, f, f - (f % 8), f, 14, [C.goldL, C.white, C.orange], { v: 2.4, g: 0.05, life: 6 }); text(im, '-' + (o.dmg || 69), bx + 22, by - bh / 2 - 8 - (f % 8) * 2, { z: 1, c: C.goldL }); } }
    if (ph === 'kill' && f >= 20 && f < 30) { const R = (f - 20) * 7; for (let a = 0; a < 64; a++) { const t = a / 64 * Math.PI * 2; im.px(cx + Math.cos(t) * R, gy - bh / 2 + Math.sin(t) * R * 0.7, C.white, 1 - (f - 20) / 10); im.px(cx + Math.cos(t) * (R - 1), gy - bh / 2 + Math.sin(t) * (R - 1) * 0.7, C.goldL, 0.8 - (f - 20) / 12); } }
    if (ph === 'kill' && f >= 20) { burst(im, cx, gy - bh / 2, f, 20, 7, 60, [C.red, C.orange, C.goldL, C.white, [80, 160, 80]], { v: 3, g: 0.08, life: 24, size: 2 }); if (f > 24) confetti(im, f, 21, 40); }
    let frac = pct; if (ph === 'open') frac = ease((f - 14) / 16); if (ph === 'hit') frac = (o.from == null ? Math.min(1, pct + 0.1) : o.from) + (pct - (o.from == null ? Math.min(1, pct + 0.1) : o.from)) * ease(f / 30); if (ph === 'kill') frac = Math.max(0, (o.from || 0.05) * (1 - ease(f / 18)));
    hpBar(im, 10, H1 - 12 + 4, W - 20, frac, frac < 0.15 ? [255, 60, 60] : frac < 0.5 ? C.orange : C.red); text(im, 'HP', 10, H1 - 20 + 4, { z: 1 });
    const top = o.top || (ph === 'open' ? 'RAID BOSS!' : ph === 'kill' ? 'DEFEATED!' : ph === 'escape' ? 'IT ESCAPED' : pct <= 0.1 ? 'FINISH HIM!' : 'HIT IT!');
    pop(im, top, cx, 3, f, ph === 'open' ? 14 : ph === 'kill' ? 21 : 2, { z: 2, c: ph === 'kill' ? C.goldL : C.white, c2: ph === 'kill' ? C.gold : [255, 120, 120], wave: 1 });
    pop(im, o.bottom, cx, 21, f, ph === 'open' ? 18 : 6, { z: 1 });
    if (flash) wash(im, C.white, 0.3);
    push(A, im, f === N - 1 ? 220 : 6, (ph === 'open' && f < 22) || (ph === 'kill' && f >= 18 && f < 26) ? jit(f, 2) : null); }
  return A; }

/** banner: the XCPETS logo bouncing on rays, with a big caption (halvings, sell-outs, season news, any post without a pet). */
let LOGO = null;
function banner(o) { o = o || {}; const A = out0(), W = W1 + 16, cx = W >> 1, c = o.color || C.gold; if (!LOGO) LOGO = imageSprite(path.join(ROOT, 'img/logo.png'), 44, 44);
  for (let f = 0; f < 36; f++) { const im = new Img(W, H1); sky(im, lerp(c, [0, 0, 0], 0.85), lerp(c, [0, 0, 0], 0.55), H1); rays(im, cx, 44, f * 0.06, c, 0.25, 14); glow(im, cx, 44, 44, c, 0.3);
    const sq = [[1.4, 0.6], [0.8, 1.25], [1.1, 0.9], [0.97, 1.04]][f] || [1, 1], hop = Math.round(Math.abs(Math.sin(f / 36 * Math.PI * 4)) * 3);
    pet(im, LOGO, 0, cx, 66 - hop, { z: 1, sx: sq[0], sy: sq[1] });
    confetti(im, f, 31, 20);
    pop(im, o.top || 'XCPETS', cx, 3, f, 0, { z: 2, c: C.white, c2: lerp(c, C.white, 0.4), wave: 1 });
    pop(im, o.bottom, cx, H1 - 10, f, 3, { z: 1, up: true });
    push(A, im, f === 35 ? 200 : 6, f < 3 ? jit(f, 2) : null); }
  return A; }

/** lineup: several pets in one picture on a stage with a title. */
function lineup(sets, o) { o = o || {}; const n = Math.min(6, sets.length), cols = n <= 3 ? n : 3, rows = Math.ceil(n / cols), cw = 72, ch = 70, W = cols * cw + 8, H = rows * ch + 24, im = new Img(W, H);
  sky(im, [20, 10, 50], [110, 50, 120], H); stars(im, 1, 0, H); rays(im, W / 2, H / 2, 0.2, C.gold, 0.18, 18);
  sets.slice(0, n).forEach((S, i) => { const x = 4 + (i % cols) * cw + cw / 2, y = 22 + ((i / cols) | 0) * ch + ch - 4; glow(im, x, y - 24, 30, C.gold, 0.2); for (let k = -26; k <= 26; k++) { im.px(x + k, y, [80, 50, 30]); im.px(x + k, y + 1, [50, 30, 20]); }
    pet(im, S, 0, x, y, {}); const r = rnd(i * 5 + 3); for (let k = 0; k < 3; k++) sparkle(im, x - 24 + r() * 48, y - 60 + r() * 50, C.goldL, 1 + (k % 2)); });
  text(im, o.top || 'LEGENDARY HAUL!', W / 2, 4, { z: 2, c: C.goldL, c2: C.gold });
  return im; }

/* ---------------------------------------------------------------- entry */
function anim(a) { const w = a.frames[0].w, s = Math.max(3, Math.min(6, Math.floor(640 / w))); return { type: 'animation', name: 'hatchbot.gif', file: gif(a.frames, a.delays, s) }; }
const BOSS = {};
function bossSet(art) { if (!art) return null; if (BOSS[art] !== undefined) return BOSS[art]; const f = path.join(ROOT, 'img/raids', String(art).replace(/[^A-Z0-9_]/gi, '') + '.png'); BOSS[art] = fs.existsSync(f) ? imageSprite(f, 60, 60) : null; return BOSS[art]; }
/** event(ctx, w, ev): ev = { kind, id, ids: [a, b], egg, top, bottom, ... }. Returns a file for Telegram, or null when it cannot be drawn. */
function event(ctx, w, ev) {
  const k = ev.kind, cap = { top: ev.top, bottom: ev.bottom };
  if (k === 'banner') return anim(banner(Object.assign({}, cap, { color: ev.color && C[ev.color] })));
  if (k === 'raid') { const B = bossSet(ev.art); return B ? anim(raid(B, Object.assign({}, cap, { phase: ev.phase, pct: ev.pct, from: ev.from, dmg: ev.dmg }))) : anim(banner(Object.assign({ color: C.red }, cap))); }
  load(ctx); const pet0 = id => w.byId[id];
  const set = (id, o) => { const p = pet0(id); if (!p || !p.art) return null; const s = spriteSet(ctx, w, p, o); return s && s.length ? s : null; };
  const nm = id => T(name(pet0(id))).slice(0, 22);
  if (k === 'lineup') { const sets = (ev.ids || []).map(id => set(id)).filter(Boolean); return sets.length ? { type: 'photo', name: 'hatchbot.png', file: png(lineup(sets, cap), 3) } : null; }
  if (k === 'breed' || k === 'devour') { const [a, b] = ev.ids || []; const Pa = set(a), Pb = set(b); if (!Pa || !Pb) return null;
    if (k === 'devour') return anim(devour(Pa, Pb, cap));
    let E = null; if (ev.egg && pet0(ev.egg)) try { E = set(ev.egg, { stage: 0 }); } catch (e) { E = null; }
    return anim(breed(Pa, Pb, E, Object.assign({ bottom: ev.egg ? 'NEW EGG #' + ev.egg : 'LOVE IN THE SWAMP' }, cap))); }
  const p = pet0(ev.id), S = set(ev.id, k === 'hatch' ? { stage: Math.max(1, (p || {}).stage | 0) } : null); if (!S) return null; /* a fresh pet is still an Egg: the hatch shows the Hatchling it becomes */
  const bottom = cap.bottom || nm(ev.id), tier = p ? (p.tier | 0) : 3;
  if (k === 'hatch') { let E = null; try { E = set(ev.id, { stage: 0 }); } catch (e) { E = null; } return anim(hatch(S, E, Object.assign({}, cap, { bottom, tier, top: cap.top || ['COMMON', 'UNCOMMON', 'RARE!', 'LEGENDARY!'][tier] }))); }
  if (k === 'rise') return anim(rise(S, Object.assign({}, cap, { bottom, tint: ev.mythic ? C.purple : null, top: cap.top || (ev.mythic ? 'MYTHIC ZOMBIE!' : null) })));
  if (k === 'miracle') return anim(miracle(S, Object.assign({}, cap, { bottom: cap.bottom || nm(ev.id) + ' LIVES!' })));
  if (k === 'dust') return anim(dust(S, Object.assign({}, cap, { bottom: cap.bottom || nm(ev.id) })));
  if (k === 'grind') return anim(grind(S, Object.assign({}, cap, { gold: ev.gold !== false })));
  if (k === 'rage') return anim(rage(S, Object.assign({}, cap, ev.color === 'green' ? { color: C.toxic, top: cap.top || 'FULL POWER', bottom: cap.bottom || 'ZOMBIE MODE' } : { color: C.red })));
  if (k === 'shine') return anim(shine(S, Object.assign({}, cap, { bottom, halo: ev.halo !== false, color: ev.color && C[ev.color] })));
  return anim(idle(S, cap));
}
module.exports = { load, event, spriteSet, png, gif, readPng, imageSprite, Img, EXTRA, text, textW, _scenes: { idle, shine, hatch, rise, miracle, dust, breed, devour, rage, grind, raid, banner, lineup } };
