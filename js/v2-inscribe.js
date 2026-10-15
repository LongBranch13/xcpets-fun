/* XCPETS demo v2: INSCRIPTIONS (2026-10-14). MOCK ONLY: nothing is signed, broadcast or sent to a wallet; ids are fake.
 * Core (node + browser): integer-only auto-shrink to the 385 KB inscription cap (nearest-neighbour; never a fractional scale), then a reduced palette (fallback only); PNG encoder hook (still images only; GIF removed); quality score (PSNR vs the original); fee estimate (KB/4 vbytes).
 * UI (browser only): window.V2InscribeUI = preview modal + mock commit/reveal + lineage, used by the pet page and the Inscriptions page. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(); else root.V2Inscribe = factory();
})(this, function () {
  'use strict';
  var CAP = 385 * 1024, HOSTED_CAP = 4 * 1024 * 1024, COMMIT_VB = 154, REVEAL_OVERHEAD_VB = 120, MIN_PIXEL_SCALE = 4;
  function frame(w, h, data) { return { w: w, h: h, data: data || new Uint8ClampedArray(w * h * 4) }; }
  /** detectBlock(frames): the largest s (<=16) such that every frame is made of s×s solid blocks (upscaled pixel art) -> lossless /s. */
  function detectBlock(frames) {
    var f0 = frames[0];
    for (var s = 16; s >= 2; s--) { if (f0.w % s || f0.h % s) continue; var ok = true;
      for (var k = 0; k < frames.length && ok; k++) { var d = frames[k].data, w = frames[k].w;
        for (var y = 0; y < f0.h && ok; y++) for (var x = 0; x < f0.w; x++) { var bx = x - x % s, by = y - y % s, i = (y * w + x) * 4, j = (by * w + bx) * 4;
          if (d[i] !== d[j] || d[i + 1] !== d[j + 1] || d[i + 2] !== d[j + 2]) { ok = false; break; } } }
      if (ok) return s; }
    return 1; }
  function scaleUp(f, k) { if (k === 1) return f; var o = frame(f.w * k, f.h * k), x, y;
    for (y = 0; y < o.h; y++) for (x = 0; x < o.w; x++) { var i = ((y / k | 0) * f.w + (x / k | 0)) * 4, j = (y * o.w + x) * 4; o.data[j] = f.data[i]; o.data[j + 1] = f.data[i + 1]; o.data[j + 2] = f.data[i + 2]; o.data[j + 3] = f.data[i + 3]; }
    return o; }
  function scaleDown(f, d) { if (d === 1) return f; var o = frame(Math.floor(f.w / d), Math.floor(f.h / d)), x, y; // nearest: top-left of each d×d block
    for (y = 0; y < o.h; y++) for (x = 0; x < o.w; x++) { var i = (y * d * f.w + x * d) * 4, j = (y * o.w + x) * 4; o.data[j] = f.data[i]; o.data[j + 1] = f.data[i + 1]; o.data[j + 2] = f.data[i + 2]; o.data[j + 3] = f.data[i + 3]; }
    return o; }
  /** palette(frames, max): exact colours if <= max, else median cut. Returns { pal: [[r,g,b]...], map: fn(r,g,b)->index } */
  function palette(frames, max) {
    var cnt = {}, keys = [], i, k;
    frames.forEach(function (f) { for (i = 0; i < f.data.length; i += 4) { k = (f.data[i] << 16) | (f.data[i + 1] << 8) | f.data[i + 2]; if (!(k in cnt)) { cnt[k] = 0; keys.push(k); } cnt[k]++; } });
    var pal;
    if (keys.length <= max) pal = keys.map(function (q) { return [q >> 16 & 255, q >> 8 & 255, q & 255]; });
    else { var boxes = [keys.map(function (q) { return [q >> 16 & 255, q >> 8 & 255, q & 255, cnt[q]]; })];
      while (boxes.length < max) { var bi = -1, best = -1, ch = 0;
        boxes.forEach(function (b, n) { if (b.length < 2) return; for (var c = 0; c < 3; c++) { var lo = 255, hi = 0; b.forEach(function (p) { lo = Math.min(lo, p[c]); hi = Math.max(hi, p[c]); }); if (hi - lo > best) { best = hi - lo; bi = n; ch = c; } } });
        if (bi < 0 || best <= 0) break; var b = boxes[bi].sort(function (p, q) { return p[ch] - q[ch]; }), tot = b.reduce(function (a, p) { return a + p[3]; }, 0), acc = 0, cut = 1;
        for (var m = 0; m < b.length - 1; m++) { acc += b[m][3]; if (acc >= tot / 2) { cut = m + 1; break; } }
        boxes.splice(bi, 1, b.slice(0, cut), b.slice(cut)); }
      pal = boxes.map(function (b) { var t = 0, s = [0, 0, 0]; b.forEach(function (p) { t += p[3]; s[0] += p[0] * p[3]; s[1] += p[1] * p[3]; s[2] += p[2] * p[3]; }); return [Math.round(s[0] / t), Math.round(s[1] / t), Math.round(s[2] / t)]; }); }
    var memo = {};
    function map(r, g, b) { var q = (r << 16) | (g << 8) | b; if (q in memo) return memo[q]; var bi = 0, bd = 1e9; for (var n = 0; n < pal.length; n++) { var dr = r - pal[n][0], dg = g - pal[n][1], db = b - pal[n][2], dd = dr * dr + dg * dg + db * db; if (dd < bd) { bd = dd; bi = n; } } return (memo[q] = bi); }
    return { pal: pal, map: map, unique: keys.length };
  }
  function indexed(frames, P) { return frames.map(function (f) { var o = new Uint8Array(f.w * f.h); for (var i = 0, p = 0; i < f.data.length; i += 4, p++) o[p] = P.map(f.data[i], f.data[i + 1], f.data[i + 2]); return o; }); }
  // GIF encoder REMOVED 2026-10-14 (Jake): inscriptions are STILL images only (PNG). Animated pets inscribe one chosen frame.
  // ---------------------------------------------------------------- PNG (needs a deflate: node zlib.deflateSync; the browser page passes canvas.toDataURL)
  var CRC = (function () { var t = []; for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc(b) { var c = 0xffffffff; for (var i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
  function encodePNG(f, maxColors, deflate) {
    var P = palette([f], Math.min(256, maxColors || 256)), ix = indexed([f], P)[0], raw = new Uint8Array((f.w + 1) * f.h), out = [];
    for (var y = 0; y < f.h; y++) { raw[y * (f.w + 1)] = 0; raw.set(ix.subarray(y * f.w, (y + 1) * f.w), y * (f.w + 1) + 1); }
    function chunk(type, data) { var len = data.length, tb = [type.charCodeAt(0), type.charCodeAt(1), type.charCodeAt(2), type.charCodeAt(3)], all = new Uint8Array(4 + len); all.set(tb); all.set(data, 4);
      var c = crc(all); out.push(len >>> 24 & 255, len >>> 16 & 255, len >>> 8 & 255, len & 255); for (var i = 0; i < all.length; i++) out.push(all[i]); out.push(c >>> 24 & 255, c >>> 16 & 255, c >>> 8 & 255, c & 255); }
    out.push(137, 80, 78, 71, 13, 10, 26, 10);
    chunk('IHDR', new Uint8Array([f.w >>> 24 & 255, f.w >>> 16 & 255, f.w >>> 8 & 255, f.w & 255, f.h >>> 24 & 255, f.h >>> 16 & 255, f.h >>> 8 & 255, f.h & 255, 8, 3, 0, 0, 0]));
    var pl = new Uint8Array(P.pal.length * 3); P.pal.forEach(function (p, i) { pl[i * 3] = p[0]; pl[i * 3 + 1] = p[1]; pl[i * 3 + 2] = p[2]; }); chunk('PLTE', pl);
    chunk('IDAT', deflate(raw)); chunk('IEND', new Uint8Array(0)); return { bytes: new Uint8Array(out), colors: P.pal.length, unique: P.unique }; }
  // ---------------------------------------------------------------- quality
  /** psnr(orig frames, result frames, upFactor): result brought back to the original size (nearest, integer), frames matched by time. */
  function quality(orig, res, back) {
    var se = 0, n = 0;
    orig.forEach(function (o, i) { var r = res[Math.min(res.length - 1, Math.floor(i * res.length / orig.length))];
      for (var y = 0; y < o.h; y++) for (var x = 0; x < o.w; x++) { var rx = back.up ? Math.floor(x * back.k) : Math.floor(x / back.d), ry = back.up ? Math.floor(y * back.k) : Math.floor(y / back.d);
        rx = Math.min(r.w - 1, rx); ry = Math.min(r.h - 1, ry); var i1 = (y * o.w + x) * 4, i2 = (ry * r.w + rx) * 4;
        for (var c = 0; c < 3; c++) { var d = o.data[i1 + c] - r.q[i2 + c]; se += d * d; } n += 3; } });
    var mse = se / n; return mse === 0 ? 99 : Math.min(99, 10 * Math.log10(255 * 255 / mse)); }
  /** shrink(src, opts): src = { frames:[ONE frame], pixelArt: bool }. STILL PNG ONLY: more than one frame throws. opts.encodePNG(frame, maxColors) -> {bytes} is required.
   * Order: integer scale (pixel art: x16 down to x4; lossless block detect first) -> reduced palette (only if a PNG somehow exceeds the cap) -> smaller integer scale. */
  function shrink(src, opts) {
    opts = opts || {}; if (!src || !src.frames || src.frames.length !== 1) throw new Error('inscriptions are still images only: pass exactly one frame (no GIF / animation)');
    if (typeof opts.encodePNG !== 'function') throw new Error('inscriptions are PNG only: opts.encodePNG is required');
    var cap = opts.cap || CAP, frames0 = src.frames, s0 = detectBlock(frames0), native = frames0.map(function (f) { return scaleDown(f, s0); });
    var nw = native[0].w, trims = [], tries = 0;
    function enc(fr, colors) { tries++; return opts.encodePNG(fr[0], colors); }
    var maxUp = src.pixelArt ? Math.max(1, Math.min(16, Math.floor(512 / nw))) : 1, minUp = src.pixelArt ? Math.min(maxUp, MIN_PIXEL_SCALE) : 1;
    var scales = []; for (var k = maxUp; k >= minUp; k--) scales.push({ up: true, k: k });
    var lastScales = []; for (k = minUp - 1; k >= 1; k--) lastScales.push({ up: true, k: k }); for (var d = 2; d <= 16 && nw / d >= 16; d++) lastScales.push({ up: false, d: d });
    function render(sc, fr) { return fr.map(function (f) { return sc.up ? scaleUp(f, sc.k) : scaleDown(f, sc.d); }); }
    var colorSteps = [256, 128, 64, 32, 16, 8], best = null;
    function attempt(sc, colors, why) { var r = render(sc, native), e = enc(r, colors); var res = { bytes: e.bytes, kb: e.bytes.length / 1024, scale: sc, frames: 1, colors: e.colors, unique: e.unique, frameData: r, why: why };
      if (!best || e.bytes.length < best.bytes.length) best = res; return e.bytes.length <= cap ? res : null; }
    var hit = null, i, sc = scales[scales.length - 1];
    for (i = 0; i < scales.length && !hit; i++) hit = attempt(scales[i], 256, i ? 'scale' : 'none');
    for (i = 1; i < colorSteps.length && !hit; i++) hit = attempt(sc, colorSteps[i], 'palette'); // fallback only: a 32x32 pet PNG never gets here
    for (i = 0; i < lastScales.length && !hit; i++) hit = attempt(lastScales[i], colorSteps[colorSteps.length - 1], 'small-scale');
    var r = hit || best;
    if (s0 > 1) trims.push('lossless: source was ' + s0 + 'x upscaled pixel art, stored at native ' + nw + 'px first');
    if (r.scale.up && r.scale.k < maxUp) trims.push('integer scale x' + maxUp + ' -> x' + r.scale.k);
    if (!r.scale.up) trims.push('integer downscale 1/' + r.scale.d + ' (nearest)');
    if (r.colors < Math.min(256, r.unique)) trims.push('palette ' + r.unique + ' -> ' + r.colors + ' colours');
    var q = r.frameData.map(function (f) { var P = palette([f], r.colors), o = new Uint8ClampedArray(f.data.length); for (var i2 = 0; i2 < f.data.length; i2 += 4) { var p = P.pal[P.map(f.data[i2], f.data[i2 + 1], f.data[i2 + 2])]; o[i2] = p[0]; o[i2 + 1] = p[1]; o[i2 + 2] = p[2]; o[i2 + 3] = 255; } return { w: f.w, h: f.h, q: o }; });
    var tot = r.scale.up ? r.scale.k / s0 : 1 / (r.scale.d * s0);
    var score = quality(frames0, q, tot >= 1 ? { up: true, k: tot } : { up: false, d: 1 / tot });
    return { ok: r.bytes.length <= cap && isStillPNG(r.bytes), bytes: r.bytes, kb: Math.round(r.kb * 10) / 10, format: 'png', width: r.frameData[0].w, height: r.frameData[0].h,
      scale: r.scale.up ? 'x' + r.scale.k : '1/' + r.scale.d, integerScale: true, block: s0, frames: 1, framesIn: 1, colors: r.colors, colorsIn: r.unique, trims: trims, psnr: Math.round(score * 10) / 10, tries: tries, frameData: r.frameData }; }
  // ---------------------------------------------------------------- NAME STAMP (2026-10-14): the pet's own name in a 3x5 pixel font, baked into the 32px art
  // BEFORE the integer upscale (crisp, ~0.1-0.3 KB). Text comes ONLY from the pet record (sanitised); the caller picks just the position.
  var FONT = { A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111', F: '111100110100100', G: '011100101101011', H: '101101111101101',
    I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100',
    Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010', U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101',
    Y: '101101010010010', Z: '111001010100111', '0': '010101101101010', '1': '010110010010111', '2': '110001010100111', '3': '110001010001110', '4': '101101111001001',
    '5': '111100110001110', '6': '011100110101010', '7': '111001010010010', '8': '010101010101010', '9': '010101011001110', ' ': '000000000000000', '.': '000000000000010',
    '-': '000000111000000', '!': '010010010000010', '?': '110001010000010', "'": '010010000000000', '#': '101111101111101', '_': '000000000000111', '…': '000000000000101' };
  var NAME_POS = ['top', 'bottom', 'none'] /* default 'top': across 13 species x stages 0-5 the top band covers ~9x fewer sprite pixels than the bottom (feet / ground shadow) */, NAME_MAX_IN = 24, NAME_COLS = 32;
  /* Name fit (2026-10-14 fix: names overflowed / were cut to 6 chars). The 3x5 font is already the smallest legible pixel size, so the fit order is:
   * 1 line of up to 8 chars (31 px wide inside the 32 px art) -> word-wrap to 2 lines of 8 -> ellipsis on line 2 as last resort. Never wider than the art. */
  var LINE_CH = 8, MAX_LINES = 2;
  function cleanName(name) { var t = String(name == null ? '' : name); t = t.normalize ? t.normalize('NFKD') : t;
    return t.toUpperCase().split('').filter(function (c) { return c !== '…' && Object.prototype.hasOwnProperty.call(FONT, c); }).join('').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX_IN); }
  /** nameLines(name): the stamped lines (each <= 8 chars, at most 2). */
  function nameLines(name) { var t = cleanName(name); if (!t) return []; if (t.length <= LINE_CH) return [t];
    var words = t.split(' '), lines = [], cur = '';
    words.forEach(function (wd) { while (wd.length > LINE_CH) { if (cur) { lines.push(cur); cur = ''; } lines.push(wd.slice(0, LINE_CH)); wd = wd.slice(LINE_CH); } // hard-break a long word
      if (!wd) return; var t2 = cur ? cur + ' ' + wd : wd; if (t2.length <= LINE_CH) cur = t2; else { lines.push(cur); cur = wd; } });
    if (cur) lines.push(cur);
    if (lines.length > MAX_LINES) { var last = lines.slice(MAX_LINES - 1).join(' '); lines = lines.slice(0, MAX_LINES - 1).concat([last.slice(0, LINE_CH - 1).replace(/\s+$/, '') + '…']); }
    return lines; }
  /** sanitizeName(name): printable font chars only, uppercased, spaces collapsed, capped at 24; the stamped text (lines joined by a space). */
  function sanitizeName(name) { return nameLines(name).join(' '); }
  /** stampName(frame, name, pos): new 32x32 frame with a dark plate band (7 rows per line, 13 for two) + white 3x5 text at 'top' or 'bottom'; 'none' -> unchanged copy. */
  function stampName(f, name, pos) { var o = frame(f.w, f.h, new Uint8ClampedArray(f.data)); if (pos === 'none' || f.w !== 32 || f.h !== 32) return o;
    var L = nameLines(name); if (!L.length) return o; var rows = 1 + 6 * L.length, y0 = pos === 'top' ? 0 : 32 - rows;
    function set(x, y, c) { if (x < 0 || y < 0 || x > 31 || y > 31) return; var i = (y * 32 + x) * 4; o.data[i] = c[0]; o.data[i + 1] = c[1]; o.data[i + 2] = c[2]; o.data[i + 3] = 255; }
    var wmax = Math.max.apply(null, L.map(function (l) { return l.length * 4 - 1; })), px0 = Math.floor((32 - wmax) / 2);
    for (var y = y0; y < y0 + rows; y++) for (var x = Math.max(0, px0 - 2); x <= Math.min(31, px0 + wmax + 1); x++) set(x, y, [0x1a, 0x10, 0x20]); // name plate
    L.forEach(function (t, li) { var w = t.length * 4 - 1, x0 = Math.floor((32 - w) / 2);
      t.split('').forEach(function (ch, k) { var g = FONT[ch]; for (var r = 0; r < 5; r++) for (var c = 0; c < 3; c++) if (g[r * 3 + c] === '1') set(x0 + k * 4 + c, y0 + 1 + li * 6 + r, [0xff, 0xf1, 0xe8]); }); });
    return o; }
  // ---------------------------------------------------------------- PETS-ONLY lock (2026-10-14). The demo is client-only: this is UX + tamper resistance, NOT security;
  // real enforcement needs the indexer/server to re-derive the art from the pet id and refuse anything else.
  var ALLOWED_FORMATS = ['png', 'jpeg', 'webp']; // allowed on-chain formats; the demo always renders PNG. GIF / animation: never.
  /** isStillPNG(bytes): PNG signature and NO animation chunk (acTL = APNG). */
  function isStillPNG(b) { if (!b || b.length < 33) return false; var sig = [137, 80, 78, 71, 13, 10, 26, 10]; for (var i = 0; i < 8; i++) if (b[i] !== sig[i]) return false;
    for (var p = 8; p + 8 <= b.length;) { var len = (b[p] << 24 >>> 0) + (b[p + 1] << 16) + (b[p + 2] << 8) + b[p + 3], t = String.fromCharCode(b[p + 4], b[p + 5], b[p + 6], b[p + 7]);
      if (t === 'acTL' || t === 'fcTL') return false; if (t === 'IEND') return true; p += 12 + len; } return false; }
  function isGIF(b) { return !!b && b.length >= 6 && b[0] === 71 && b[1] === 73 && b[2] === 70; }
  /** payloadError(bytes): null when the bytes are a single still PNG, else a clear message (GIF / APNG / anything else rejected). */
  function payloadError(b) { if (isGIF(b)) return 'GIF / animated payloads are not accepted: inscriptions are still PNG images only.'; if (!isStillPNG(b)) return 'Only a still PNG rendered from your pet can be inscribed (animated PNG / other bytes rejected).'; return null; }
  var REQ_KEYS = ['petId', 'frame', 'feeRate', 'stuck', 'nameStamp']; // nameStamp = position only ('top' default | 'bottom' | 'none'); the TEXT always comes from the pet
  /** checkRequest(req, world, owner): the SINGLE entry-point validator. req = { petId: positive integer, frame?: integer, feeRate?, stuck? } and NOTHING else
   * (no image / dataURL / url / bytes / frames). The pet must exist in the demo world, be owned by owner, and be alive. -> { ok, pet } | { ok:false, error } */
  function checkRequest(req, world, owner) {
    if (!req || typeof req !== 'object' || Array.isArray(req)) return { ok: false, error: 'Bad request: expected { petId }.' };
    var extra = Object.keys(req).filter(function (k) { return REQ_KEYS.indexOf(k) < 0; });
    if (extra.length) return { ok: false, error: 'Rejected: only pets can be inscribed and the image is always rendered from the pet. Not accepted: ' + extra.join(', ') + '.' };
    var id = req.petId;
    if (typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0) return { ok: false, error: 'Rejected: pet id must be a positive whole number (got ' + JSON.stringify(id) + ').' };
    if (req.frame !== undefined && (typeof req.frame !== 'number' || !Number.isInteger(req.frame) || req.frame < 0 || req.frame > 63)) return { ok: false, error: 'Rejected: frame must be a whole number >= 0.' };
    if (req.nameStamp !== undefined && NAME_POS.indexOf(req.nameStamp) < 0) return { ok: false, error: 'Rejected: name stamp must be one of ' + NAME_POS.join(' / ') + ' (the name itself always comes from the pet).' };
    if (req.feeRate !== undefined && (typeof req.feeRate !== 'number' || !isFinite(req.feeRate) || req.feeRate < 1 || req.feeRate > 500)) return { ok: false, error: 'Rejected: fee rate must be 1-500 sat/vB.' };
    var pet = world && world.pets ? world.pets.filter(function (p) { return p.id === id; })[0] : null;
    if (!pet) return { ok: false, error: 'Rejected: pet #' + id + ' does not exist.' };
    if (pet.owner !== owner) return { ok: false, error: 'Rejected: pet #' + id + ' is not yours.' };
    if (pet.dead || pet.released) return { ok: false, error: 'Rejected: pet #' + id + ' is ' + (pet.dead ? 'dead' : 'released') + '.' };
    return { ok: true, pet: pet }; }
  /** imageHash(bytes): fingerprint used to re-check the art before commit and before reveal. */
  function imageHash(b) { var h1 = 0x811c9dc5, h2 = crc(b); for (var i = 0; i < b.length; i++) { h1 ^= b[i]; h1 = Math.imul(h1, 0x01000193) >>> 0; } return b.length.toString(16) + '-' + h1.toString(16) + '-' + h2.toString(16); }
  /** fee estimate: commit + reveal; reveal witness = bytes/4 vbytes (witness discount) + overhead. */
  function fee(bytes, satvb) { var vb = COMMIT_VB + REVEAL_OVERHEAD_VB + Math.ceil(bytes / 4); return { vbytes: vb, sats: Math.ceil(vb * satvb), btc: Math.ceil(vb * satvb) / 1e8 }; }
  function isTaproot(addr) { return /^bc1p[02-9ac-hj-np-z]{58}$/.test(String(addr || '')); }
  /** registry helpers over the demo state (S.insc = [{n, id, kind, petId, gid, label, parents:[id], ...}]) */
  function nextNumber(list) { return (list || []).reduce(function (m, x) { return Math.max(m, x.n || 0); }, 0) + 1; }
  function ofPet(list, petId) { return (list || []).filter(function (x) { return x.kind === 'pet' && String(x.petId) === String(petId) && x.status === 'inscribed'; }); }
  function latestOfPet(list, petId) { var l = ofPet(list, petId); return l.length ? l[l.length - 1] : null; }
  /** parentsFor(list, pet): both parents inscribed -> their latest inscription ids (in A, B order); else [] */
  function parentsFor(list, pet) { if (!pet || !pet.parents || pet.parents.length < 2) return []; var a = latestOfPet(list, pet.parents[0]), b = latestOfPet(list, pet.parents[1]); return a && b ? [a.id, b.id] : []; }
  function record(list, o) { if (!o || o.kind !== 'pet' || o.format !== 'png' || !Number.isSafeInteger(o.petId) || o.petId <= 0) throw new Error('record: pets-only, still PNG only');
    var n = nextNumber(list), per = o.kind === 'pet' ? ofPet(list, o.petId).length + 1 : (list || []).filter(function (x) { return x.kind === o.kind && x.gid === o.gid; }).length + 1;
    var r = Object.assign({ n: n, perPet: per, status: 'inscribed' }, o); list.push(r); return r; }
  return { CAP: CAP, HOSTED_CAP: HOSTED_CAP, frame: frame, detectBlock: detectBlock, scaleUp: scaleUp, scaleDown: scaleDown, palette: palette, encodePNG: encodePNG,
    shrink: shrink, isStillPNG: isStillPNG, isGIF: isGIF, payloadError: payloadError, checkRequest: checkRequest, sanitizeName: sanitizeName, nameLines: nameLines, stampName: stampName, NAME_POS: NAME_POS, FONT: FONT, imageHash: imageHash, ALLOWED_FORMATS: ALLOWED_FORMATS, REQ_KEYS: REQ_KEYS, fee: fee, isTaproot: isTaproot, nextNumber: nextNumber, ofPet: ofPet, latestOfPet: latestOfPet, parentsFor: parentsFor, record: record, crc: crc };
});
