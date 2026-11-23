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
 * lineup (several pets in one picture). */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), zlib = require('zlib');
const ROOT = path.resolve(__dirname, '..');
/* the sprite scripts pet.html loads, in its order (same list as tools/token-meta.js EXTRA) */
const EXTRA = ['js/wizard-sprite.js', 'js/kek-sprite.js', 'js/funtrump-sprite.js', 'js/homer-sprite.js', 'js/rabbit-sprite.js', 'js/djpepe-sprite.js', 'js/viking-sprite.js', 'js/dragon-sprite.js', 'js/bo-sprite.js', 'js/rarepigeon-sprite.js', 'js/jackson-sprite.js', 'js/contest-sprite.js', 'js/dan-sprite.js', 'js/v2-bg.js', 'js/v2-looks.js', 'js/v2-clown-hair.js', 'js/v2-render.js'];

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

/* GIF: one global palette for all frames (pixel art has few colours; above 256 the colours are rounded until they fit). */
function palette(frames) {
  for (const sh of [0, 1, 2, 3, 4]) {
    const map = new Map(), m = 255 << sh & 255;
    for (const f of frames) for (let i = 0; i < f.d.length; i += 4) { const k = ((f.d[i] & m) << 16) | ((f.d[i + 1] & m) << 8) | (f.d[i + 2] & m); if (!map.has(k)) { map.set(k, map.size); if (map.size > 256) break; } }
    if (map.size <= 256) return { map, mask: m };
  }
  throw new Error('too many colours');
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
  s = s || 1; const w = frames[0].w, h = frames[0].h, W = w * s, H = h * s, { map, mask } = palette(frames);
  let bits = 1; while ((1 << bits) < map.size) bits++; const n = 1 << bits, minCode = Math.max(2, bits);
  const B = []; const u16 = v => B.push(v & 255, v >> 8 & 255);
  B.push(...Buffer.from('GIF89a')); u16(W); u16(H); B.push(0x80 | (bits - 1), 0, 0);
  const pal = new Array(n * 3).fill(0); map.forEach((i, k) => { pal[i * 3] = k >> 16 & 255; pal[i * 3 + 1] = k >> 8 & 255; pal[i * 3 + 2] = k & 255; }); B.push(...pal);
  B.push(0x21, 0xff, 11, ...Buffer.from('NETSCAPE2.0'), 3, 1, 0, 0, 0);
  frames.forEach((f, fi) => { const dl = Array.isArray(delays) ? delays[fi] : delays;
    B.push(0x21, 0xf9, 4, 0x04, 0, 0, 0, 0); B[B.length - 4] = dl & 255; B[B.length - 3] = dl >> 8 & 255;
    B.push(0x2c); u16(0); u16(0); u16(W); u16(H); B.push(0);
    const ix = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (((y / s) | 0) * w + ((x / s) | 0)) * 4; ix[y * W + x] = map.get(((f.d[i] & mask) << 16) | ((f.d[i + 1] & mask) << 8) | (f.d[i + 2] & mask)); }
    const data = lzw(ix, minCode); B.push(minCode);
    for (let i = 0; i < data.length; i += 255) { const c = data.slice(i, i + 255); B.push(c.length, ...c); }
    B.push(0); });
  B.push(0x3b);
  return Buffer.from(B);
}

/* ---------------------------------------------------------------- canvas */
function Img(w, h, bg) { this.w = w; this.h = h; this.d = new Uint8ClampedArray(w * h * 4); if (bg) this.fill(bg); }
Img.prototype.fill = function (c) { for (let i = 0; i < this.d.length; i += 4) { this.d[i] = c[0]; this.d[i + 1] = c[1]; this.d[i + 2] = c[2]; this.d[i + 3] = 255; } return this; };
Img.prototype.copy = function () { const o = new Img(this.w, this.h); o.d.set(this.d); return o; };
Img.prototype.px = function (x, y, c, a) { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= this.w || y >= this.h || !c) return; const i = (y * this.w + x) * 4; a = a == null ? 1 : a;
  this.d[i] = c[0] * a + this.d[i] * (1 - a); this.d[i + 1] = c[1] * a + this.d[i + 1] * (1 - a); this.d[i + 2] = c[2] * a + this.d[i + 2] * (1 - a); this.d[i + 3] = 255; };
Img.prototype.rect = function (x0, y0, w, h, c, a) { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) this.px(x, y, c, a); };
/** draw a sprite {w,h,d,m}: m marks the pet's own pixels (the rest is its tile background). opts: { cut: draw pet pixels only, fx(x, y, rgb) -> rgb|null, clipY } */
Img.prototype.sprite = function (sp, ox, oy, o) { o = o || {};
  for (let y = 0; y < sp.h; y++) for (let x = 0; x < sp.w; x++) { const j = y * sp.w + x; if (o.cut && !sp.m[j]) continue; if (o.clipY != null && oy + y > o.clipY) continue;
    let c = [sp.d[j * 4], sp.d[j * 4 + 1], sp.d[j * 4 + 2]]; if (o.fx) { c = o.fx(x, y, c, j); if (!c) continue; } this.px(ox + x, oy + y, c, o.alpha); } };

/* ---------------------------------------------------------------- pet sprites */
const KEY = '#ff00fe';
function flat(fr) { const a = fr.rareScene || fr; return { w: a.width || 32, h: a.height || 32, d: a.data }; }
/** spriteSet(ctx, w, p, opts): the pet's animation frames as the site draws them, each with a mask of the pet's own pixels. */
function spriteSet(ctx, w, p, o) {
  o = o || {}; const R = ctx.V2Render, q = o.stage != null ? Object.assign({}, p, { stage: o.stage }) : p, ex = { noHunger: true };
  const real = R.petFramesRaw(q, w, ex).map(flat);
  let keyed = null; try { keyed = R.petFramesRaw(Object.assign({}, q, { hatchBlock: 0, mutation: null, shows: null, art: Object.assign({}, q.art, { background: 'solid', bgColor: KEY, pattern: 'none' }) }), w, ex).map(flat); } catch (e) { keyed = null; }
  return real.map((f, i) => { const m = new Uint8Array(f.w * f.h), k = keyed && keyed[i % keyed.length];
    for (let j = 0; j < m.length; j++) m[j] = k && k.w === f.w ? (Math.abs(k.d[j * 4] - 255) + k.d[j * 4 + 1] + Math.abs(k.d[j * 4 + 2] - 254) > 24 ? 1 : 0) : 1;
    return { w: f.w, h: f.h, d: f.d, m }; });
}

/* ---------------------------------------------------------------- scenes */
const C = { night: [16, 14, 34], night2: [28, 24, 56], ground: [52, 40, 46], dirt: [92, 64, 52], grass: [56, 120, 60], stone: [140, 140, 156], stoneD: [90, 90, 110],
  gold: [255, 201, 60], goldL: [255, 240, 170], white: [255, 255, 255], pink: [255, 92, 150], red: [225, 29, 46], green: [120, 230, 90], purple: [170, 90, 255], swamp: [24, 52, 40], swamp2: [36, 76, 54], sky: [40, 36, 84] };
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const grey = c => { const l = 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]; return [l, l, l]; };
const rnd = seed => () => (seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296;
function stars(im, seed, t) { const r = rnd(seed); for (let i = 0; i < 18; i++) { const x = (r() * im.w) | 0, y = (r() * im.h * 0.55) | 0, tw = (i + t) % 5 === 0; im.px(x, y, tw ? C.white : [150, 150, 200]); } }
function sparkle(im, x, y, c, size) { size = size || 1; im.px(x, y, c); for (let k = 1; k <= size; k++) { im.px(x - k, y, c, 0.8); im.px(x + k, y, c, 0.8); im.px(x, y - k, c, 0.8); im.px(x, y + k, c, 0.8); } }
function heart(im, x, y, c) { ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'].forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] === 'X') im.px(x + i, y + j, c); }); }
function halo(im, cx, y, c) { for (let x = -5; x <= 5; x++) { const e = Math.abs(x) === 5; im.px(cx + x, y + (e ? 0 : -1), c); if (!e) im.px(cx + x, y + 1, c); } im.px(cx - 6, y, c); im.px(cx + 6, y, c); }
function grave(im, x, y, c) { const H = 12; for (let j = 0; j < H; j++) for (let i = 0; i < 10; i++) { if (j < 2 && (i === 0 || i === 9)) continue; im.px(x + i, y + j, (i === 0 || i === 9 || j === 0) ? C.stoneD : c); }
  im.rect(x + 3, y + 3, 4, 1, C.stoneD); im.rect(x + 4, y + 2, 2, 5, C.stoneD); }
function egg(im, cx, by, wob, crack, base) { /* a 12x15 egg; wob tilts it; crack 0..3 draws the crack */
  const sh = [4, 6, 8, 8, 10, 10, 10, 12, 12, 12, 12, 12, 10, 10, 8], H = sh.length;
  for (let j = 0; j < H; j++) { const wd = sh[j], tilt = Math.round(wob * (H - j) / H); for (let i = 0; i < wd; i++) { const x = cx - wd / 2 + i + tilt, edge = i === 0 || i === wd - 1 || j === 0 || j === H - 1;
    im.px(x, by - H + j, edge ? [60, 40, 50] : lerp(base, C.white, (i < wd / 3 && j < H / 2) ? 0.45 : 0)); } }
  const cr = [[-3, 6], [-2, 5], [-1, 6], [0, 5], [1, 6], [2, 5], [3, 6]];
  if (crack > 0) cr.slice(0, Math.min(cr.length, crack * 3)).forEach(([dx, dy]) => im.px(cx + dx + Math.round(wob / 2), by - H + dy, [40, 24, 30]));
}
const W0 = 48, H0 = 44, SCALE = 8;
function base(bg) { return new Img(W0, H0, bg); }
function place(sp) { return { x: ((W0 - sp.w) / 2) | 0, y: H0 - 4 - sp.h }; }

/* ---------------------------------------------------------------- animations */
function idle(S, o) { o = o || {}; const out = [], n = Math.max(8, S.length * 2);
  for (let f = 0; f < n; f++) { const sp = S[f % S.length], im = base(o.bg || C.night); if (o.starry !== false) stars(im, 7, f); const p = place(sp);
    im.rect(0, H0 - 4, W0, 4, o.floor || C.ground); im.sprite(sp, p.x, p.y, { cut: true });
    if (o.sparkle) { const r = rnd(f * 31 + 5); for (let k = 0; k < 4; k++) sparkle(im, p.x - 2 + r() * (sp.w + 4), p.y - 2 + r() * (sp.h + 2), k % 2 ? C.goldL : C.white, f % 2 + 1); }
    if (o.halo) halo(im, p.x + (sp.w >> 1), p.y - 1, C.gold);
    out.push(im); }
  return { frames: out, delays: 14 }; }
function hatch(S, eggSet) { const out = [], d = [], sp0 = S[0], p = place(sp0), ebase = eggSet ? null : [236, 228, 200];
  const eggFrame = (wob, crack) => { const im = base(C.night); stars(im, 3, out.length); im.rect(0, H0 - 4, W0, 4, C.ground);
    if (eggSet) { const e = eggSet[0]; im.sprite(e, p.x + wob, p.y, { cut: true, fx: (x, y, c) => (crack && y > 8 && y < 12 && (x + y) % 3 === 0 && x > 8 && x < 24) ? [40, 24, 30] : c }); }
    else egg(im, W0 >> 1, H0 - 4, wob, crack, ebase); return im; };
  [[0, 0, 40], [-1, 0, 8], [1, 0, 8], [-1, 1, 8], [1, 1, 8], [0, 2, 30], [-2, 2, 6], [2, 2, 6], [-2, 3, 6], [2, 3, 6], [0, 3, 20]].forEach(([wb, cr, dl]) => { out.push(eggFrame(wb, cr)); d.push(dl); });
  const flash = base(C.white); out.push(flash); d.push(6);
  for (let f = 0; f < 16; f++) { const sp = S[f % S.length], im = base(C.night); stars(im, 3, f); im.rect(0, H0 - 4, W0, 4, C.ground);
    const pop = f < 3 ? 3 - f : 0; im.sprite(sp, p.x, p.y + pop, { cut: true });
    const r = rnd(f * 17 + 1); if (f < 10) for (let k = 0; k < 6; k++) { const a = r() * 6.28, rad = 6 + f * 2; sparkle(im, (W0 >> 1) + Math.cos(a) * rad, p.y + 14 + Math.sin(a) * rad * 0.7, k % 2 ? C.gold : C.white, 1); }
    if (f < 6) { im.px(p.x + 4, H0 - 5, [236, 228, 200]); im.px(p.x + 5, H0 - 5, [236, 228, 200]); im.px(p.x + 26, H0 - 5, [236, 228, 200]); im.px(p.x + 27, H0 - 6, [236, 228, 200]); }
    out.push(im); d.push(f === 15 ? 120 : 12); }
  return { frames: out, delays: d }; }
function rise(S, o) { o = o || {}; const out = [], d = [], sp0 = S[0], p = place(sp0), gy = H0 - 6, tint = o.tint || [120, 200, 90];
  for (let f = 0; f < 22; f++) { const sp = S[f % S.length], im = base(C.night); stars(im, 11, f);
    im.rect(0, gy, W0, H0 - gy, C.ground); grave(im, W0 - 13, gy - 12, C.stone);
    const up = Math.min(1, f / 14), oy = Math.round(p.y + (1 - up) * (sp.h + 2)) - 2;
    im.sprite(sp, p.x - 6, oy, { cut: true, clipY: gy - 1, fx: (x, y, c) => lerp(c, tint, 0.45) });
    if (f > 2 && f < 16) { const r = rnd(f * 7); for (let k = 0; k < 5; k++) im.px(p.x - 6 + r() * sp.w, gy - 1 - r() * 3, C.dirt); }
    if (up >= 1) { const r = rnd(f); for (let k = 0; k < 3; k++) im.px(p.x - 8 + r() * (sp.w + 4), oy + r() * 10, tint, 0.7); }
    out.push(im); d.push(f === 21 ? 120 : f < 2 ? 30 : 10); }
  return { frames: out, delays: d }; }
function miracle(S) { const out = [], d = [], sp0 = S[0], p = place(sp0), cx = W0 >> 1;
  for (let f = 0; f < 22; f++) { const sp = S[f % S.length], im = base(C.night); stars(im, 5, f); im.rect(0, H0 - 4, W0, 4, C.ground);
    const beam = Math.min(1, f / 6), col = Math.max(0, Math.min(1, (f - 6) / 8));
    if (beam > 0) for (let y = 0; y < (H0 - 4) * beam; y++) for (let x = -9; x <= 9; x++) im.px(cx + x, y, C.goldL, (0.35 - Math.abs(x) * 0.03) * (f > 16 ? 0.5 : 1));
    im.sprite(sp, p.x, p.y - Math.round(col * 2), { cut: true, fx: (x, y, c) => lerp(grey(c), c, col) });
    if (f >= 12) halo(im, p.x + (sp.w >> 1), p.y - 3, C.gold);
    if (f >= 14) { const r = rnd(f * 13); for (let k = 0; k < 4; k++) sparkle(im, p.x + r() * sp.w, p.y + r() * sp.h, C.white, 1); }
    out.push(im); d.push(f === 21 ? 140 : 10); }
  return { frames: out, delays: d }; }
function dust(S) { const out = [], d = [], sp = S[0], p = place(sp), r = rnd(sp.w * 131 + 7), drift = [];
  for (let j = 0; j < sp.w * sp.h; j++) drift.push({ t: 4 + ((j % sp.w) / sp.w) * 6 + r() * 6, vx: 0.4 + r() * 1.6, vy: -0.6 + r() * 1.2 });
  for (let f = 0; f < 26; f++) { const im = base(C.night); stars(im, 9, f); im.rect(0, H0 - 4, W0, 4, C.ground); grave(im, 3, H0 - 16, C.stone);
    const fade = Math.min(1, f / 5);
    for (let j = 0; j < sp.w * sp.h; j++) { if (!sp.m[j]) continue; const x = j % sp.w, y = (j / sp.w) | 0, q = drift[j], c = lerp([sp.d[j * 4], sp.d[j * 4 + 1], sp.d[j * 4 + 2]], [150, 140, 130], fade);
      if (f < q.t) im.px(p.x + x + 4, p.y + y, c); else { const k = f - q.t, X = p.x + x + 4 + q.vx * k * 1.5, Y = p.y + y + q.vy * k + 0.25 * k * k; if (Y < H0 - 4 && k < 9) im.px(X, Y, [170, 160, 150], 1 - k / 9); } }
    out.push(im); d.push(f === 0 ? 50 : f === 25 ? 140 : 9); }
  return { frames: out, delays: d }; }
function breed(A, Bs, eggSet) { const out = [], d = [];
  const WW = W0 + 40, mk = () => { const im = new Img(WW, H0, C.swamp); for (let x = 0; x < WW; x += 1) im.px(x, H0 - 5 - ((x * 7) % 3 === 0 ? 1 : 0), C.swamp2); im.rect(0, H0 - 4, WW, 4, C.grass); return im; };
  for (let f = 0; f < 24; f++) { const im = mk(), a = A[f % A.length], b = Bs[f % Bs.length], ay = H0 - 4 - a.h, by = H0 - 4 - b.h;
    const near = Math.min(4, f / 2) | 0; im.sprite(a, 2 + near, ay, { cut: true }); im.sprite(b, WW - b.w - 2 - near, by, { cut: true, fx: null });
    const hy = 18 - Math.min(14, f), hx = (WW >> 1) - 3; if (f >= 3 && f < 16) heart(im, hx, hy, C.pink);
    if (f >= 16) { const e = eggSet ? eggSet[0] : null; if (e) im.sprite(e, (WW - e.w) >> 1, H0 - 4 - e.h + (f < 18 ? 2 : 0), { cut: true }); else egg(im, WW >> 1, H0 - 4, (f % 4) - 1, 0, [236, 228, 200]); const r = rnd(f * 3); for (let k = 0; k < 3; k++) sparkle(im, (WW >> 1) - 8 + r() * 16, 14 + r() * 14, C.goldL, 1); }
    out.push(im); d.push(f === 23 ? 140 : 12); }
  return { frames: out, delays: d }; }
function devour(Z, M) { const out = [], d = [], WW = W0 + 24;
  for (let f = 0; f < 24; f++) { const im = new Img(WW, H0, C.night); stars(im, 2, f); im.rect(0, H0 - 4, WW, 4, C.ground); const z = Z[f % Z.length], m = M[f % M.length];
    const lunge = f < 8 ? 0 : Math.min(10, f - 8); im.sprite(z, 2 + lunge, H0 - 4 - z.h, { cut: true, fx: (x, y, c) => lerp(c, C.green, 0.35) });
    const fade = Math.max(0, Math.min(1, (f - 10) / 8)); if (fade < 1) im.sprite(m, WW - m.w - 2, H0 - 4 - m.h, { cut: true, fx: (x, y, c) => (((x * 7 + y * 3) % 10) / 10 < fade ? null : lerp(c, C.purple, fade)) });
    if (f > 12) { const r = rnd(f * 9); for (let k = 0; k < 6; k++) im.px(WW - 20 + r() * 18, 8 + r() * 26, C.purple, 0.8); }
    if (f >= 18) grave(im, WW - 16, H0 - 16, [150, 120, 200]);
    out.push(im); d.push(f === 23 ? 140 : 10); }
  return { frames: out, delays: d }; }
function rage(S, o) { o = o || {}; const c = o.color || C.red, out = [];
  for (let f = 0; f < 12; f++) { const sp = S[f % S.length], im = base(C.night), p = place(sp), pulse = 0.25 + 0.25 * Math.sin(f / 12 * 6.28 * 2);
    stars(im, 4, f); im.rect(0, H0 - 4, W0, 4, C.ground);
    for (let y = 0; y < sp.h; y++) for (let x = 0; x < sp.w; x++) { const j = y * sp.w + x; if (!sp.m[j]) continue; for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= sp.w || yy >= sp.h || !sp.m[yy * sp.w + xx]) im.px(p.x + xx, p.y + yy, c, 0.5 + pulse); } }
    im.sprite(sp, p.x + (f % 2 ? 1 : 0), p.y, { cut: true, fx: (x, y, cc) => lerp(cc, c, pulse * 0.6) });
    out.push(im); }
  return { frames: out, delays: 9 }; }
function lineup(sets) { const n = Math.min(6, sets.length), cols = n <= 3 ? n : 3, rows = Math.ceil(n / cols), cw = 38, ch = 40, im = new Img(cols * cw + 4, rows * ch + 4, C.night);
  stars(im, 1, 0); sets.slice(0, n).forEach((S, i) => { const sp = S[0], x = 2 + (i % cols) * cw + ((cw - sp.w) >> 1), y = 2 + ((i / cols) | 0) * ch + (ch - 4 - sp.h);
    im.rect(2 + (i % cols) * cw + 2, 2 + ((i / cols) | 0) * ch + ch - 5, cw - 4, 2, C.ground); im.sprite(sp, x, y, { cut: true });
    const r = rnd(i * 5 + 3); for (let k = 0; k < 2; k++) sparkle(im, x + r() * sp.w, y + r() * sp.h * 0.6, C.goldL, 1); });
  return im; }

/* ---------------------------------------------------------------- entry */
function anim(a) { return { type: 'animation', name: 'hatchbot.gif', file: gif(a.frames, a.delays, SCALE) }; }
/** event(ctx, w, ev): ev = { kind, id, ids: [a, b], egg }. Returns a file for Telegram, or null when this pet cannot be drawn. */
function event(ctx, w, ev) {
  load(ctx); const pet = id => w.byId[id];
  const set = (id, o) => { const p = pet(id); if (!p || !p.art) return null; const s = spriteSet(ctx, w, p, o); return s && s.length ? s : null; };
  const k = ev.kind;
  if (k === 'lineup') { const sets = (ev.ids || []).map(id => set(id)).filter(Boolean); return sets.length ? { type: 'photo', name: 'hatchbot.png', file: png(lineup(sets), SCALE) } : null; }
  if (k === 'breed' || k === 'devour') { const [a, b] = ev.ids || []; const A = set(a), B = set(b); if (!A || !B) return null;
    if (k === 'devour') return anim(devour(A, B));
    let E = null; if (ev.egg && pet(ev.egg)) try { E = set(ev.egg, { stage: 0 }); } catch (e) { E = null; } return anim(breed(A, B, E)); }
  const S = set(ev.id, k === 'hatch' ? { stage: Math.max(1, (pet(ev.id) || {}).stage | 0) } : null); if (!S) return null; /* a fresh pet is still an Egg: the hatch shows the Hatchling it becomes */
  if (k === 'hatch') { let E = null; try { E = set(ev.id, { stage: 0 }); } catch (e) { E = null; } return anim(hatch(S, E)); }
  if (k === 'rise') return anim(rise(S, { tint: ev.mythic ? C.purple : null }));
  if (k === 'miracle') return anim(miracle(S));
  if (k === 'dust') return anim(dust(S));
  if (k === 'rage') return anim(rage(S, { color: ev.color === 'green' ? C.green : C.red }));
  if (k === 'shine') return anim(idle(S, { sparkle: true, halo: ev.halo }));
  return anim(idle(S));
}
module.exports = { load, event, spriteSet, png, gif, Img, EXTRA, SCALE, _scenes: { idle, hatch, rise, miracle, dust, breed, devour, rage, lineup } };
