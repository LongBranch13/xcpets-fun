'use strict';
/* Contact sheets for Honk clown hair. Offline. Does not touch rules or live data.
 *   node tools/clown-hair-sheet.js before <png>
 *   node tools/clown-hair-sheet.js after <png>
 * before = one shared overlay with gaps between the puffs (the look the owner rejected).
 * after  = per species, per stage, puffs overlapped into one mass.
 */
const fs = require('fs'), path = require('path'), vm = require('vm'), zlib = require('zlib');
const ROOT = path.resolve(__dirname, '..');
const SCRIPTS = ['rjs/config.js', 'rjs/pet-core.js', 'rjs/game-core.js', 'rjs/bonus-gear.js', 'rjs/real-core.js', 'rjs/chain.js', '@LIVE',
  'js/pet-core.js', 'js/bonus-gear.js', 'js/v2-gear.js', 'js/v2-fit.js', 'js/v2-rules.js',
  'js/wizard-sprite.js', 'js/kek-sprite.js', 'js/funtrump-sprite.js', 'js/homer-sprite.js', 'js/viking-sprite.js',
  'js/rabbit-sprite.js', 'js/djpepe-sprite.js', 'js/dragon-sprite.js', 'js/jackson-sprite.js', 'js/bo-sprite.js',
  'js/rarepigeon-sprite.js', 'js/contest-sprite.js', 'js/v2-bg.js', 'js/v2-looks.js', 'js/v2-clown-hair.js', 'js/v2-render.js'];
function load() {
  const st = {}, ls = { getItem: k => st[k] || null, setItem: (k, v) => { st[k] = String(v); }, removeItem: k => { delete st[k]; } };
  const el = () => ({ getContext: () => null, style: {}, setAttribute() {}, appendChild() {}, addEventListener() {}, classList: { add() {}, remove() {}, toggle() {} } });
  const nop = function () { return { observe() {}, disconnect() {} }; };
  const win = { console: console, localStorage: ls, sessionStorage: ls, location: { search: '', hostname: 'xcpets.fun', href: 'https://xcpets.fun/', pathname: '/' }, navigator: { userAgent: 'node' },
    setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {}, requestAnimationFrame: () => 0, URLSearchParams, URL, TextEncoder, TextDecoder, fetch: () => Promise.reject(new Error('offline')), Uint8ClampedArray, Map, WeakMap, Set, MutationObserver: nop, ResizeObserver: nop, IntersectionObserver: nop };
  win.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: el, addEventListener() {}, body: null, documentElement: { style: {} }, readyState: 'complete', head: { appendChild() {} } };
  win.addEventListener = () => {}; win.window = win; win.self = win; win.globalThis = win;
  const c = vm.createContext(win);
  for (const f of SCRIPTS) {
    if (f === '@LIVE') { vm.runInContext('window.LiveEngine={RealCore:window.RealCore,Chain:window.Chain&&window.Chain.Chain,CFG:window.XCPETS_CONFIG};', c); continue; }
    const p = path.join(ROOT, f); if (fs.existsSync(p)) vm.runInContext(fs.readFileSync(p, 'utf8'), c, { filename: f });
  }
  return c;
}
const G = load(), P = G.PetCore, R = G.V2Render, H = G.V2ClownHair;
const BG = '#14101c';
const ORDER = [['pepe', 'PEPE'], ['wojak', 'WOJAK'], ['chud', 'CHUD'], ['chad', 'CHAD'], ['bobo', 'BOBO'], ['mumu', 'MUMU'], ['snibby', 'SNIBBY'], ['dodo', 'DODO'], ['kevin', 'KEVIN'], ['peepo', 'PEEPO'], ['sarutobi', 'SARUTOBI'], ['doge', 'DOGE'], ['lenny', 'LENNY'], ['nakamoto', 'NAKAMOTO'], ['wizard', 'WIZARD'], ['kek', 'LORD KEK'], ['funtrump', 'FUNTRUMP'], ['homer', 'HOMER'], ['rabbit', 'RABBIT'], ['djpepe', 'DJ PEPE'], ['viking', 'VIKING'], ['orangedragon', 'DRAGON'], ['jacksonpepe', 'OLD HICKORY'], ['bojackson', 'BO JACKSON'], ['rarepigeon', 'RAREPIGEON'], ['starlordkek', 'STAR-LORD'], ['gooby', 'GOOBY'], ['lukespam', 'LUKE SPAM']];
const STAGES = ['EGG', 'HATCH', 'JUV', 'ADULT', 'ELDER', 'MYTHIC'];
const FEAT = [['kevin', 'KEVIN'], ['dodo', 'DODO'], ['homer', 'HOMER']];
function baseArt(sp) {
  const a = sp === 'nakamoto' ? P.characterPet('nakamoto', { tier: 'legendary' }) : P.generate({ blockHash: 'ab'.repeat(32), petId: 'honk-' + sp, blockHeight: 972700 });
  a.species = sp; a.eyes = 'classic'; a.shades = false; a.background = 'solid'; a.bgColor = BG; a.pattern = 'none'; delete a.bgV2;
  ['band', 'armor', 'cape', 'weapon', 'crown', 'hat', 'eyewear', 'held', 'neck', 'face'].forEach(k => { if (k in a) a[k] = 'none'; });
  if (sp === 'funtrump') { a.ftLook = 'suit'; a.tierIndex = 2; }
  if (sp === 'homer') a.tierIndex = 2;
  return a;
}
function frameOf(sp, stage, mode) {
  const art = baseArt(sp);
  let fr;
  try { fr = R.framesWith(art, stage, [], mode === 'after' ? ['v2-honk'] : []); }
  catch (e) { return { err: String(e && e.message || e) }; }
  const img = fr && fr[0];
  if (!img || !img.data) return { err: 'no frame' };
  if (mode === 'before') return { img: H.apply([img], art, stage, { gaps: true, uniform: true })[0], art: art };
  return { img: img, art: art };
}
const FONT = {};
function glyph(ch, rows) { FONT[ch] = rows; }
glyph('A', ['01110', '10001', '10001', '11111', '10001', '10001', '10001']);
glyph('B', ['11110', '10001', '10001', '11110', '10001', '10001', '11110']);
glyph('C', ['01111', '10000', '10000', '10000', '10000', '10000', '01111']);
glyph('D', ['11110', '10001', '10001', '10001', '10001', '10001', '11110']);
glyph('E', ['11111', '10000', '10000', '11110', '10000', '10000', '11111']);
glyph('F', ['11111', '10000', '10000', '11110', '10000', '10000', '10000']);
glyph('G', ['01111', '10000', '10000', '10111', '10001', '10001', '01111']);
glyph('H', ['10001', '10001', '10001', '11111', '10001', '10001', '10001']);
glyph('I', ['11111', '00100', '00100', '00100', '00100', '00100', '11111']);
glyph('J', ['00111', '00010', '00010', '00010', '00010', '10010', '01100']);
glyph('K', ['10001', '10010', '10100', '11000', '10100', '10010', '10001']);
glyph('L', ['10000', '10000', '10000', '10000', '10000', '10000', '11111']);
glyph('M', ['10001', '11011', '10101', '10101', '10001', '10001', '10001']);
glyph('N', ['10001', '11001', '10101', '10011', '10001', '10001', '10001']);
glyph('O', ['01110', '10001', '10001', '10001', '10001', '10001', '01110']);
glyph('P', ['11110', '10001', '10001', '11110', '10000', '10000', '10000']);
glyph('Q', ['01110', '10001', '10001', '10001', '10101', '10010', '01101']);
glyph('R', ['11110', '10001', '10001', '11110', '10100', '10010', '10001']);
glyph('S', ['01111', '10000', '10000', '01110', '00001', '00001', '11110']);
glyph('T', ['11111', '00100', '00100', '00100', '00100', '00100', '00100']);
glyph('U', ['10001', '10001', '10001', '10001', '10001', '10001', '01110']);
glyph('V', ['10001', '10001', '10001', '10001', '10001', '01010', '00100']);
glyph('W', ['10001', '10001', '10001', '10101', '10101', '10101', '01010']);
glyph('X', ['10001', '10001', '01010', '00100', '01010', '10001', '10001']);
glyph('Y', ['10001', '10001', '01010', '00100', '00100', '00100', '00100']);
glyph('Z', ['11111', '00001', '00010', '00100', '01000', '10000', '11111']);
glyph('0', ['01110', '10001', '10011', '10101', '11001', '10001', '01110']);
glyph('1', ['00100', '01100', '00100', '00100', '00100', '00100', '01110']);
glyph('2', ['01110', '10001', '00001', '00010', '00100', '01000', '11111']);
glyph('3', ['11110', '00001', '00001', '01110', '00001', '00001', '11110']);
glyph('4', ['00010', '00110', '01010', '10010', '11111', '00010', '00010']);
glyph('5', ['11111', '10000', '11110', '00001', '00001', '10001', '01110']);
glyph('6', ['00110', '01000', '10000', '11110', '10001', '10001', '01110']);
glyph('7', ['11111', '00001', '00010', '00100', '01000', '01000', '01000']);
glyph('8', ['01110', '10001', '10001', '01110', '10001', '10001', '01110']);
glyph('9', ['01110', '10001', '10001', '01111', '00001', '00010', '01100']);
glyph('-', ['00000', '00000', '00000', '11111', '00000', '00000', '00000']);
glyph(' ', ['00000', '00000', '00000', '00000', '00000', '00000', '00000']);
function text(out, W, x, y, s, rgb) {
  s = String(s).toUpperCase(); let cx = x;
  for (const ch of s) { const g = FONT[ch] || FONT[' ']; for (let r = 0; r < g.length; r++) for (let c = 0; c < g[r].length; c++) if (g[r][c] === '1') { const X = cx + c, Y = y + r; if (X >= 0 && Y >= 0 && X < W) { const o = (Y * W + X) * 4; out[o] = rgb[0]; out[o + 1] = rgb[1]; out[o + 2] = rgb[2]; out[o + 3] = 255; } } cx += 6; }
}
function crc32(b) { let c, r = 0xffffffff; for (let n = 0; n < b.length; n++) { c = (r ^ b[n]) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; r = (r >>> 8) ^ c; } return (r ^ 0xffffffff) >>> 0; }
function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]), c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
function blit(out, W, img, ox, oy, sc) {
  const d = img.data; for (let y = 0; y < 32 * sc; y++) for (let x = 0; x < 32 * sc; x++) { const j = ((y / sc | 0) * 32 + (x / sc | 0)) * 4, o = ((oy + y) * W + ox + x) * 4; out[o] = d[j]; out[o + 1] = d[j + 1]; out[o + 2] = d[j + 2]; out[o + 3] = 255; }
}
function sheet(mode, file) {
  const sc = 4, cell = 32 * sc, gap = 10, lab = 100, head = 22, featSc = 6, featCell = 32 * featSc;
  const cols = 6, rows = ORDER.length, featRows = FEAT.length;
  const W = lab + cols * (featCell + gap) + gap, gridH = head + rows * (cell + gap + 6);
  const featH = 36 + featRows * (featCell + 20);
  const Hh = 16 + featH + 12 + gridH + 8;
  const out = new Uint8Array(W * Hh * 4);
  for (let i = 0; i < out.length; i += 4) { out[i] = 12; out[i + 1] = 14; out[i + 2] = 22; out[i + 3] = 255; }
  const title = mode === 'before' ? 'BEFORE  GAPS BETWEEN PUFFS  ONE OVERLAY' : 'AFTER  SOLID PUFFS  FIT PER SPECIES AND STAGE';
  text(out, W, 8, 6, title, [255, 220, 120]);
  text(out, W, 8, 28, 'KEVIN REPLACES HIS HAIR    DODO FITS THE SKULL    HOMER', [180, 210, 255]);
  const notes = [];
  FEAT.forEach((row, ri) => {
    const y = 48 + ri * (featCell + 20);
    text(out, W, 8, y + 8, row[1], [255, 255, 255]);
    STAGES.forEach((name, s) => {
      const x = lab + s * (featCell + gap);
      text(out, W, x, y - 2, name, [160, 170, 190]);
      const got = frameOf(row[0], s, mode);
      if (got.err) { notes.push(row[0] + ' s' + s + ' ' + got.err); return; }
      blit(out, W, got.img, x, y + 10, featSc);
      const bg = [got.img.data[0], got.img.data[1], got.img.data[2]];
      const pr = H.problems(got.img.data, bg);
      if (pr.length && mode === 'after') notes.push(row[0] + ' s' + s + ' ' + pr.join(','));
    });
  });
  const y0 = 16 + featH;
  text(out, W, 8, y0, 'EVERY SPECIES  EVERY STAGE', [255, 220, 120]);
  STAGES.forEach((name, s) => text(out, W, lab + s * (cell + gap), y0 + 14, name, [160, 170, 190]));
  ORDER.forEach((row, ri) => {
    const y = y0 + head + ri * (cell + gap + 6);
    text(out, W, 6, y + 8, row[1], [230, 230, 240]);
    for (let s = 0; s < 6; s++) {
      const x = lab + s * (cell + gap);
      const got = frameOf(row[0], s, mode);
      if (got.err) { notes.push(row[0] + ' s' + s + ' ' + got.err); continue; }
      blit(out, W, got.img, x, y, sc);
      if (mode === 'after') { const bg = [got.img.data[0], got.img.data[1], got.img.data[2]]; const pr = H.problems(got.img.data, bg); if (pr.length) notes.push(row[0] + ' s' + s + ' ' + pr.join(',')); }
    }
  });
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, png(W, Hh, out));
  fs.writeFileSync(file.replace(/\.png$/, '.txt'), notes.join('\n') + (notes.length ? '\n' : 'ok\n'));
  console.log(mode, file, 'notes', notes.length);
  notes.slice(0, 40).forEach(n => console.log(' ', n));
}
const mode = process.argv[2] || 'after', file = process.argv[3] || path.join('/tmp', 'clown-' + mode + '.png');
if (!H) { console.error('V2ClownHair missing'); process.exit(1); }
sheet(mode, file);
