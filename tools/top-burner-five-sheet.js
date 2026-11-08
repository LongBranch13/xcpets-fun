#!/usr/bin/env node
/* Contact sheet, close-ups, arena / pet-card / gear stills for the five top-burner pets.
 *   node tools/top-burner-five-sheet.js [outDir] */
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'previews', 'top-burner-five-1107'));
const S = require(path.join(ROOT, 'js', 'topburner-sprites.js'));
const Wiz = require(path.join(ROOT, 'js', 'wizard-sprite.js'));
const Drag = require(path.join(ROOT, 'js', 'dragon-sprite.js'));
const st = {}, ls = { getItem: k => st[k] || null, setItem: (k, v) => { st[k] = String(v); }, removeItem: k => { delete st[k]; } };
const win = { console, localStorage: ls, sessionStorage: ls, location: { search: '' }, navigator: { userAgent: 'node' }, document: { getElementById: () => null, documentElement: { style: {} } }, Uint8ClampedArray, Uint8Array };
win.window = win; const ctx = vm.createContext(win);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'v2-zombie-look.js'), 'utf8'), ctx, { filename: 'v2-zombie-look.js' });
const Z = ctx.V2ZombieLook;
const IDS = S.IDS, STAGES = S.STAGES;
const BG = [27, 36, 48], SAND = [196, 164, 106], ARENA = [18, 14, 34], CARD = [13, 17, 23];
function png(w, h, rgba) { const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; for (let x = 0; x < w; x++) { const s = (y * w + x) * 4, d = y * (w * 4 + 1) + 1 + x * 4; raw[d] = rgba[s]; raw[d + 1] = rgba[s + 1]; raw[d + 2] = rgba[s + 2]; raw[d + 3] = rgba[s + 3] == null ? 255 : rgba[s + 3]; } }
  const crc32 = b => { let c, t = crc32.t; if (!t) { t = crc32.t = new Int32Array(256); for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } } c = -1; for (let i = 0; i < b.length; i++) c = t[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
  const chunk = (type, data) => { const l = Buffer.alloc(4), td = Buffer.concat([Buffer.from(type), data]), cr = Buffer.alloc(4); l.writeUInt32BE(data.length); cr.writeUInt32BE(crc32(td)); return Buffer.concat([l, td, cr]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]); }
function canvas(w, h, rgb) { const d = new Uint8Array(w * h * 4); for (let i = 0; i < d.length; i += 4) { d[i] = rgb[0]; d[i + 1] = rgb[1]; d[i + 2] = rgb[2]; d[i + 3] = 255; } return d; }
function blit(dst, dw, fr, dx, dy, scale, key) { const sw = fr.width || 32, sh = fr.height || 32, s = scale || 1;
  for (let y = 0; y < sh * s; y++) for (let x = 0; x < sw * s; x++) { const X = dx + x, Y = dy + y; if (X < 0 || Y < 0 || X >= dw) continue; const si = ((y / s | 0) * sw + (x / s | 0)) * 4, di = (Y * dw + X) * 4;
    if (key && fr.data[si] === key[0] && fr.data[si + 1] === key[1] && fr.data[si + 2] === key[2]) continue;
    dst[di] = fr.data[si]; dst[di + 1] = fr.data[si + 1]; dst[di + 2] = fr.data[si + 2]; dst[di + 3] = 255; } }
function glyph(dst, dw, ch, x, y, rgb) { const F = { A: '01110 10001 10001 11111 10001 10001', B: '11110 10001 11110 10001 10001 11110', C: '01111 10000 10000 10000 10000 01111', D: '11110 10001 10001 10001 10001 11110', E: '11111 10000 11110 10000 10000 11111', F: '11111 10000 11110 10000 10000 10000', G: '01111 10000 10011 10001 10001 01110', H: '10001 10001 11111 10001 10001 10001', I: '11111 00100 00100 00100 00100 11111', J: '00111 00010 00010 00010 10010 01100', K: '10001 10010 11100 10010 10001 10001', L: '10000 10000 10000 10000 10000 11111', M: '10001 11011 10101 10001 10001 10001', N: '10001 11001 10101 10011 10001 10001', O: '01110 10001 10001 10001 10001 01110', P: '11110 10001 10001 11110 10000 10000', Q: '01110 10001 10001 10101 10010 01101', R: '11110 10001 10001 11110 10010 10001', S: '01111 10000 01110 00001 00001 11110', T: '11111 00100 00100 00100 00100 00100', U: '10001 10001 10001 10001 10001 01110', V: '10001 10001 10001 10001 01010 00100', W: '10001 10001 10101 10101 10101 01010', X: '10001 01010 00100 00100 01010 10001', Y: '10001 10001 01010 00100 00100 00100', Z: '11111 00010 00100 01000 10000 11111', ' ': '00000 00000 00000 00000 00000 00000', '1': '00100 01100 00100 00100 00100 01110', '2': '01110 10001 00010 00100 01000 11111', '3': '11110 00001 01110 00001 00001 11110', '4': '10010 10010 11111 00010 00010 00010', '5': '11111 10000 11110 00001 10001 01110', '6': '01110 10000 11110 10001 10001 01110', '7': '11111 00001 00010 00100 01000 01000', '8': '01110 10001 01110 10001 10001 01110', '9': '01110 10001 01111 00001 00001 01110', '0': '01110 10001 10001 10001 10001 01110', '-': '00000 00000 11111 00000 00000 00000' };
  const rows = (F[ch] || F[' ']).split(' '); rows.forEach((r, yy) => { for (let xx = 0; xx < r.length; xx++) if (r[xx] === '1') { const di = ((y + yy) * dw + x + xx) * 4; dst[di] = rgb[0]; dst[di + 1] = rgb[1]; dst[di + 2] = rgb[2]; } }); }
function text(dst, dw, s, x, y, rgb) { let cx = x; for (const ch of s.toUpperCase()) { glyph(dst, dw, ch, cx, y, rgb); cx += 6; } }
function save(name, w, h, d) { fs.writeFileSync(path.join(OUT, name), png(w, h, d)); console.log(name, w + 'x' + h); }
function zombie(id, stage) { const src = S.render(id, stage, 0, '#1b2430').data, ka = S.render(id, stage, 0, '#ff00fe').data, kb = S.render(id, stage, 0, '#00ff01').data;
  const z = Z.frame(src, ka, kb, 11, 1, 4, {}); return { width: 32, height: 32, data: z.img }; }
const GEAR = { head: { label: 'cap', cols: ['#d8433a', '#7a1820'] }, body: { label: 'wrap', cols: ['#2f6fe0', '#1a3a80'] }, back: { label: 'cape', cols: ['#3ddc84', '#145c38'] }, feet: { label: 'boots', cols: ['#6a3a1a'] }, hand: { label: 'stick', cols: ['#8a5a2b', '#c8c8d0'] }, face: { label: 'glasses', cols: ['#141018'] } };
fs.mkdirSync(OUT, { recursive: true });
/* contact sheet: 5 pets x 6 stages, frame 0, plus the blink frame under each */
const SC = 8, pad = 8, lab = 14, cell = 32 * SC;
const CW = pad + 90 + 6 * (cell + pad), CH = pad + (IDS.length * (cell * 2 + 28 + pad));
const sheet = canvas(CW, CH, [12, 16, 22]);
text(sheet, CW, 'TOP BURNER FIVE', pad, 2, [230, 236, 244]);
IDS.forEach((id, row) => { const y0 = 16 + row * (cell * 2 + 28 + pad); text(sheet, CW, S.NAMES[id], pad, y0 + 8, [230, 236, 244]);
  for (let st = 0; st < 6; st++) { const x = 90 + st * (cell + pad); text(sheet, CW, STAGES[st], x, y0, [154, 168, 184]);
    blit(sheet, CW, S.render(id, st, 0, '#1b2430'), x, y0 + 12, SC);
    blit(sheet, CW, S.render(id, st, 2, '#1b2430'), x, y0 + 12 + cell + 4, SC); } });
save('contact-sheet.png', CW, CH, sheet);
/* one growth sheet per pet: every stage left to right, egg through mythic, large and labeled above the sprite */
const SSC = 12, cellS = 32 * SSC;
IDS.forEach(id => {
  const sw = pad * 2 + 6 * (cellS + pad), sh = 28 + 16 + cellS + pad;
  const d = canvas(sw, sh, [12, 16, 22]);
  text(d, sw, S.NAMES[id], pad, 8, [244, 247, 251]);
  for (let st = 0; st < 6; st++) {
    const x = pad + st * (cellS + pad);
    text(d, sw, STAGES[st], x, 28, [154, 168, 184]);
    blit(d, sw, S.render(id, st, 0, '#1b2430'), x, 44, SSC);
  }
  save('stages-' + id + '.png', sw, sh, d);
  const CS = 10, cw = pad * 4 + 3 * 32 * CS, ch = 36 + 32 * CS + pad;
  const cd = canvas(cw, ch, [12, 16, 22]);
  text(cd, cw, S.NAMES[id] + '  VS  WIZARD  AND  DRAGON', pad, 8, [244, 247, 251]);
  const trio = [['WIZARD', Wiz.render(5, 0, '#1b2430')], [S.NAMES[id].toUpperCase(), S.render(id, 5, 0, '#1b2430')], ['DRAGON', Drag.render(5, 0, '#1b2430')]];
  trio.forEach((item, i) => { const x = pad + i * (32 * CS + pad); text(cd, cw, item[0].slice(0, 16), x, 22, [154, 168, 184]); blit(cd, cw, item[1], x, 36, CS); });
  save('compare-' + id + '.png', cw, ch, cd);
});
/* close-ups: adult and mythic, large, plus dead and risen under the adult */
IDS.forEach(id => { const S2 = 14, w = pad * 3 + 32 * S2 * 2, h = 36 + 32 * S2 + 8 + 32 * 6;
  const d = canvas(w, h, [12, 16, 22]); text(d, w, S.NAMES[id], pad, 8, [244, 247, 251]);
  text(d, w, 'ADULT', pad, 24, [154, 168, 184]); text(d, w, 'MYTHIC', pad * 2 + 32 * S2, 24, [154, 168, 184]);
  blit(d, w, S.render(id, 3, 0, '#1b2430'), pad, 36, S2);
  blit(d, w, S.render(id, 5, 0, '#1b2430'), pad * 2 + 32 * S2, 36, S2);
  const y = 36 + 32 * S2 + 8; text(d, w, 'DEAD', pad, y, [154, 168, 184]); text(d, w, 'RISEN', pad + 32 * 6 + 8, y, [154, 168, 184]);
  blit(d, w, S.render(id, 3, 0, '#1b2430', {}, { dead: true }), pad, y + 12, 6);
  blit(d, w, zombie(id, 3), pad + 32 * 6 + 8, y + 12, 6);
  save('closeup-' + id + '.png', w, h, d); });
/* arena, pet card, gear — one still per pet */
IDS.forEach(id => {
  const aw = 420, ah = 240, ad = canvas(aw, ah, ARENA);
  for (let y = 150; y < ah; y++) for (let x = 0; x < aw; x++) { const di = (y * aw + x) * 4; const band = ((y / 4) | 0) % 2; ad[di] = SAND[0] - band * 12; ad[di + 1] = SAND[1] - band * 10; ad[di + 2] = SAND[2] - band * 8; }
  for (let x = 20; x < 400; x += 28) { const di = (40 * aw + x) * 4; ad[di] = 255; ad[di + 1] = 209; ad[di + 2] = 102; } /* crowd dots, not a frame on the pet */
  const KEY = [255, 0, 254];
  blit(ad, aw, S.render(id, 4, 3, '#ff00fe'), 70, 78, 4, KEY);
  blit(ad, aw, S.render(id === 'starman' ? 'yeti' : 'starman', 3, 1, '#ff00fe'), 250, 90, 4, KEY);
  text(ad, aw, 'ARENA', 16, 16, [230, 236, 244]); text(ad, aw, S.NAMES[id], 16, 210, [18, 14, 34]);
  save('arena-' + id + '.png', aw, ah, ad);
  const cw = 480, ch = 560, cd = canvas(cw, ch, CARD);
  for (let y = 16; y < ch - 16; y++) for (let x = 16; x < cw - 16; x++) { const di = (y * cw + x) * 4; cd[di] = 24; cd[di + 1] = 34; cd[di + 2] = 27; }
  blit(cd, cw, S.render(id, 3, 0, '#18221b'), 48, 36, 12);
  text(cd, cw, S.NAMES[id], 24, 450, [255, 255, 255]); text(cd, cw, 'LEGENDARY  ADULT', 24, 470, [255, 201, 60]); text(cd, cw, 'XCPETS.FUN', 24, 500, [61, 220, 132]);
  save('card-' + id + '.png', cw, ch, cd);
  const gw = 520, gh = 280, gd = canvas(gw, gh, [12, 16, 22]);
  text(gd, gw, S.NAMES[id] + ' GEAR', 12, 8, [230, 236, 244]);
  blit(gd, gw, S.render(id, 3, 0, '#1b2430'), 16, 28, 6);
  blit(gd, gw, S.render(id, 3, 0, '#1b2430', GEAR), 250, 28, 6);
  text(gd, gw, 'BARE', 16, 230, [154, 168, 184]); text(gd, gw, 'CAPE CAP BOOTS', 250, 230, [154, 168, 184]);
  save('gear-' + id + '.png', gw, gh, gd);
});
console.log('wrote', OUT);
