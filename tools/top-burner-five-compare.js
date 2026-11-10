#!/usr/bin/env node
/* Compare sheets: each growth stage beside its concept jpg.
 *   node tools/top-burner-five-compare.js [outDir] */
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib'), { execFileSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'design/art/top-burner-five/out'));
const S = require(path.join(ROOT, 'js/topburner-sprites.js'));
const ART = path.join(ROOT, 'design/art/top-burner-five');
const STAGES = S.STAGES, IDS = S.IDS;
function readPng(p) {
  const data = fs.readFileSync(p); let i = 8, w, h, color, idat = Buffer.alloc(0);
  while (i < data.length) { const ln = data.readUInt32BE(i); const typ = data.slice(i + 4, i + 8).toString(); const chunk = data.slice(i + 8, i + 8 + ln); i += 12 + ln;
    if (typ === 'IHDR') { w = chunk.readUInt32BE(0); h = chunk.readUInt32BE(4); color = chunk[9]; } else if (typ === 'IDAT') idat = Buffer.concat([idat, chunk]); else if (typ === 'IEND') break; }
  const raw = zlib.inflateSync(idat), bpp = color === 6 ? 4 : 3, stride = w * bpp; let pos = 0, prev = Buffer.alloc(stride), rows = [];
  const paeth = (a, b, c) => { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; };
  for (let y = 0; y < h; y++) { const filt = raw[pos++]; const row = Buffer.from(raw.slice(pos, pos + stride)); pos += stride;
    if (filt === 1) for (let x = 0; x < stride; x++) row[x] = (row[x] + (x >= bpp ? row[x - bpp] : 0)) & 255;
    else if (filt === 2) for (let x = 0; x < stride; x++) row[x] = (row[x] + prev[x]) & 255;
    else if (filt === 3) for (let x = 0; x < stride; x++) row[x] = (row[x] + (((x >= bpp ? row[x - bpp] : 0) + prev[x]) >> 1)) & 255;
    else if (filt === 4) for (let x = 0; x < stride; x++) row[x] = (row[x] + paeth(x >= bpp ? row[x - bpp] : 0, prev[x], x >= bpp ? prev[x - bpp] : 0)) & 255;
    rows.push(row); prev = row; }
  const px = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const o = x * bpp, d = (y * w + x) * 4; px[d] = rows[y][o]; px[d + 1] = rows[y][o + 1]; px[d + 2] = rows[y][o + 2]; px[d + 3] = 255; }
  return { w, h, data: px };
}
function png(w, h, rgba) { const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; for (let x = 0; x < w; x++) { const s = (y * w + x) * 4, d = y * (w * 4 + 1) + 1 + x * 4; raw[d] = rgba[s]; raw[d + 1] = rgba[s + 1]; raw[d + 2] = rgba[s + 2]; raw[d + 3] = rgba[s + 3] == null ? 255 : rgba[s + 3]; } }
  const crc32 = b => { let c, t = crc32.t; if (!t) { t = crc32.t = new Int32Array(256); for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } } c = -1; for (let i = 0; i < b.length; i++) c = t[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
  const chunk = (type, data) => { const l = Buffer.alloc(4), td = Buffer.concat([Buffer.from(type), data]), cr = Buffer.alloc(4); l.writeUInt32BE(data.length); cr.writeUInt32BE(crc32(td)); return Buffer.concat([l, td, cr]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]); }
function canvas(w, h, rgb) { const d = new Uint8Array(w * h * 4); for (let i = 0; i < d.length; i += 4) { d[i] = rgb[0]; d[i + 1] = rgb[1]; d[i + 2] = rgb[2]; d[i + 3] = 255; } return d; }
function blitSrc(dst, dw, src, dx, dy, dw2, dh2) { const sw = src.w, sh = src.h;
  for (let y = 0; y < dh2; y++) for (let x = 0; x < dw2; x++) { const X = dx + x, Y = dy + y; if (X < 0 || Y < 0 || X >= dw) continue; const sx = Math.min(sw - 1, (x * sw / dw2) | 0), sy = Math.min(sh - 1, (y * sh / dh2) | 0), si = (sy * sw + sx) * 4, di = (Y * dw + X) * 4;
    dst[di] = src.data[si]; dst[di + 1] = src.data[si + 1]; dst[di + 2] = src.data[si + 2]; dst[di + 3] = 255; } }
function blit(dst, dw, fr, dx, dy, scale) { const s = scale || 1;
  for (let y = 0; y < 32 * s; y++) for (let x = 0; x < 32 * s; x++) { const X = dx + x, Y = dy + y; if (X < 0 || Y < 0) continue; const si = (((y / s) | 0) * 32 + ((x / s) | 0)) * 4, di = (Y * dw + X) * 4; dst[di] = fr.data[si]; dst[di + 1] = fr.data[si + 1]; dst[di + 2] = fr.data[si + 2]; dst[di + 3] = 255; } }
function glyph(dst, dw, ch, x, y, rgb) { const F = { A: '01110 10001 10001 11111 10001 10001', B: '11110 10001 11110 10001 10001 11110', C: '01111 10000 10000 10000 10000 01111', D: '11110 10001 10001 10001 10001 11110', E: '11111 10000 11110 10000 10000 11111', F: '11111 10000 11110 10000 10000 10000', G: '01111 10000 10011 10001 10001 01110', H: '10001 10001 11111 10001 10001 10001', I: '11111 00100 00100 00100 00100 11111', J: '00111 00010 00010 00010 10010 01100', K: '10001 10010 11100 10010 10001 10001', L: '10000 10000 10000 10000 10000 11111', M: '10001 11011 10101 10001 10001 10001', N: '10001 11001 10101 10011 10001 10001', O: '01110 10001 10001 10001 10001 01110', P: '11110 10001 10001 11110 10000 10000', R: '11110 10001 10001 11110 10010 10001', S: '01111 10000 01110 00001 00001 11110', T: '11111 00100 00100 00100 00100 00100', U: '10001 10001 10001 10001 10001 01110', V: '10001 10001 10001 10001 01010 00100', W: '10001 10001 10101 10101 10101 01010', X: '10001 01010 00100 00100 01010 10001', Y: '10001 10001 01010 00100 00100 00100', ' ': '00000 00000 00000 00000 00000 00000' };
  const rows = (F[ch] || F[' ']).split(' '); rows.forEach((r, yy) => { for (let xx = 0; xx < r.length; xx++) if (r[xx] === '1') { const di = ((y + yy) * dw + x + xx) * 4; dst[di] = rgb[0]; dst[di + 1] = rgb[1]; dst[di + 2] = rgb[2]; } }); }
function text(dst, dw, s, x, y, rgb) { let cx = x; for (const ch of String(s).toUpperCase()) { glyph(dst, dw, ch, cx, y, rgb); cx += 6; } }
fs.mkdirSync(OUT, { recursive: true });
const concepts = {};
IDS.forEach(id => { const jpg = path.join(ART, 'concept-' + id + '.jpg'); const tmp = path.join(OUT, '.tmp-' + id + '.png'); execFileSync('ffmpeg', ['-y', '-i', jpg, '-frames:v', '1', tmp], { stdio: 'ignore' }); concepts[id] = readPng(tmp); fs.unlinkSync(tmp); });
const BG = [12, 16, 22], LAB = [230, 236, 244], DIM = [154, 168, 184];
const paths = [];
IDS.forEach(id => {
  const CH = 300, SC = 8, cell = 32 * SC, pad = 10;
  const cw = Math.round(concepts[id].w * CH / concepts[id].h);
  const W = pad + cw + pad + 6 * (cell + pad), H = 28 + CH + pad;
  const d = canvas(W, H, BG);
  text(d, W, S.NAMES[id] + '  CONCEPT AND STAGES', pad, 8, LAB);
  blitSrc(d, W, concepts[id], pad, 26, cw, CH);
  for (let st = 0; st < 6; st++) { const x = pad + cw + pad + st * (cell + pad); text(d, W, STAGES[st], x, 26, DIM); blit(d, W, S.render(id, st, 0, '#1b2430'), x, 40, SC); }
  const name = 'compare-' + id + '.png'; fs.writeFileSync(path.join(OUT, name), png(W, H, d)); paths.push(name);
  STAGES.forEach((label, st) => {
    const S2 = 10, fr = 6, fw = 32 * fr, gap = 8;
    const cH = 32 * S2, cW = Math.round(concepts[id].w * cH / concepts[id].h);
    const w = pad * 2 + cW + pad + Math.max(32 * S2, 4 * (fw + gap));
    const h = 36 + cH + 20 + fw + pad;
    const cd = canvas(w, h, BG);
    text(cd, w, S.NAMES[id] + '  ' + label, pad, 8, LAB);
    text(cd, w, 'CONCEPT', pad, 24, DIM);
    blitSrc(cd, w, concepts[id], pad, 36, cW, cH);
    text(cd, w, 'STAGE', pad + cW + pad, 24, DIM);
    blit(cd, w, S.render(id, st, 0, '#1b2430'), pad + cW + pad, 36, S2);
    ['REST', 'BOB', 'BLINK', 'ACTION'].forEach((nm, f) => { const x = pad + cW + pad + f * (fw + gap); text(cd, w, nm, x, 36 + cH + 8, DIM); blit(cd, w, S.render(id, st, f, '#1b2430'), x, 36 + cH + 20, fr); });
    const fn = 'compare-' + id + '-' + label.toLowerCase() + '.png';
    fs.writeFileSync(path.join(OUT, fn), png(w, h, cd)); paths.push(fn);
  });
  const Z = 14, close = 32 * Z, cWide = pad * 2 + close, cTall = 28 + close;
  const md = canvas(cWide, cTall, BG);
  text(md, cWide, S.NAMES[id] + '  MYTHIC', pad, 8, LAB);
  blit(md, cWide, S.render(id, 5, 0, '#1b2430'), pad, 24, Z);
  const cn = 'compare-' + id + '-mythic-close.png';
  fs.writeFileSync(path.join(OUT, cn), png(cWide, cTall, md)); paths.push(cn);
});
console.log(paths.join('\n'));
console.log('wrote', OUT);
