/* Before/after contact sheets for the gear-fit pass. Before frames were captured
 * in /tmp/gear-before.json from the pre-change renderer. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), zlib = require('zlib');
const { load } = require('../../tools/lib/load-rules');
const before = JSON.parse(fs.readFileSync('/tmp/gear-before.json', 'utf8'));
const extra = ['js/wizard-sprite.js', 'js/kek-sprite.js', 'js/funtrump-sprite.js', 'js/homer-sprite.js', 'js/rabbit-sprite.js', 'js/djpepe-sprite.js', 'js/viking-sprite.js', 'js/dragon-sprite.js', 'js/bo-sprite.js', 'js/rarepigeon-sprite.js', 'js/jackson-sprite.js', 'js/contest-sprite.js'];
const c = load(extra);
c.setInterval = () => 0; c.document.readyState = 'loading'; c.document.head = { appendChild() {} };
vm.runInContext(fs.readFileSync(path.join(__dirname, '../../js/v2-render.js'), 'utf8'), c, { filename: 'v2-render.js' });
const PC = c.PetCore, R = c.V2Render;
function art(id) { let a; try { a = Object.assign({}, PC.characterPet(id, { bgColor: '#ff00fe', background: 'solid' })); } catch (e) { a = { species: id, eyes: 'classic', tier: 'legendary', pattern: 'none' }; } a.species = id; a.background = 'solid'; a.bgColor = '#ff00fe'; a.pattern = 'none'; return a; }
function bufOf(data) { const b = Buffer.alloc(4096); for (let i = 0; i < 4096; i++) b[i] = data[i] & 255; return b; }
function after(id, st, item) { const a = art(id); return bufOf(R.framesWith(a, st, item ? [item] : [], [], 5)[0].data); }
function fromB64(s) { return Buffer.from(s, 'base64'); }
const FONT = { A: ['.#.', '#.#', '###', '#.#', '#.#'], B: ['##.', '#.#', '##.', '#.#', '##.'], C: ['.##', '#..', '#..', '#..', '.##'], D: ['##.', '#.#', '#.#', '#.#', '##.'], E: ['###', '#..', '##.', '#..', '###'], F: ['###', '#..', '##.', '#..', '#..'], G: ['.##', '#..', '#.#', '#.#', '.##'], H: ['#.#', '#.#', '###', '#.#', '#.#'], I: ['###', '.#.', '.#.', '.#.', '###'], J: ['.##', '..#', '..#', '#.#', '.#.'], K: ['#.#', '##.', '#..', '##.', '#.#'], L: ['#..', '#..', '#..', '#..', '###'], M: ['#.#', '###', '#.#', '#.#', '#.#'], N: ['###', '#.#', '#.#', '#.#', '#.#'], O: ['.#.', '#.#', '#.#', '#.#', '.#.'], P: ['##.', '#.#', '##.', '#..', '#..'], R: ['##.', '#.#', '##.', '#.#', '#.#'], S: ['.##', '#..', '.#.', '..#', '##.'], T: ['###', '.#.', '.#.', '.#.', '.#.'], U: ['#.#', '#.#', '#.#', '#.#', '###'], V: ['#.#', '#.#', '#.#', '#.#', '.#.'], W: ['#.#', '#.#', '#.#', '###', '#.#'], X: ['#.#', '#.#', '.#.', '#.#', '#.#'], Y: ['#.#', '#.#', '.#.', '.#.', '.#.'], Z: ['###', '..#', '.#.', '#..', '###'], '0': ['.#.', '#.#', '#.#', '#.#', '.#.'], '1': ['.#.', '##.', '.#.', '.#.', '###'], '2': ['##.', '..#', '.#.', '#..', '###'], '3': ['##.', '..#', '##.', '..#', '##.'], '4': ['#.#', '#.#', '###', '..#', '..#'], '5': ['###', '#..', '##.', '..#', '##.'], '6': ['.#.', '#..', '##.', '#.#', '.#.'], '7': ['###', '..#', '.#.', '.#.', '.#.'], '8': ['.#.', '#.#', '.#.', '#.#', '.#.'], '9': ['.#.', '#.#', '.##', '..#', '.#.'], ' ': ['...', '...', '...', '...', '...'], '-': ['...', '...', '###', '...', '...'] };
const INK = [244, 236, 220], MUTED = [168, 160, 150], RED = [214, 40, 64], PAPER = [22, 18, 32], SCALE = 3;
function pngOf(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  const crcTable = pngOf.t || (pngOf.t = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; } return t; })());
  function crc32(buf) { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
  function chunk(type, data) { const t = Buffer.from(type), len = Buffer.alloc(4); len.writeUInt32BE(data.length); const cc = Buffer.alloc(4); cc.writeUInt32BE(crc32(Buffer.concat([t, data]))); return Buffer.concat([len, t, data, cc]); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
function text(dst, dw, dh, str, x, y, rgb, scale) { let cx = x; String(str || '').toUpperCase().split('').forEach(ch => { const g = FONT[ch] || FONT[' ']; for (let row = 0; row < 5; row++) for (let col = 0; col < 3; col++) if (g[row][col] === '#') for (let oy = 0; oy < scale; oy++) for (let ox = 0; ox < scale; ox++) { const X = cx + col * scale + ox, Y = y + row * scale + oy; if (X < 0 || Y < 0 || X >= dw || Y >= dh) continue; const i = (Y * dw + X) * 4; dst[i] = rgb[0]; dst[i + 1] = rgb[1]; dst[i + 2] = rgb[2]; dst[i + 3] = 255; } cx += 4 * scale; }); }
function blit(dst, dw, dh, src, dx, dy) { for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) { const si = (y * 32 + x) * 4, key = src[si] > 250 && src[si + 1] < 8 && src[si + 2] > 248; const r = key ? 28 : src[si], g = key ? 22 : src[si + 1], b = key ? 40 : src[si + 2]; for (let oy = 0; oy < SCALE; oy++) for (let ox = 0; ox < SCALE; ox++) { const X = dx + x * SCALE + ox, Y = dy + y * SCALE + oy; if (X < 0 || Y < 0 || X >= dw || Y >= dh) continue; const i = (Y * dw + X) * 4; dst[i] = r; dst[i + 1] = g; dst[i + 2] = b; dst[i + 3] = 255; } } }
function same(a, b) { if (!a || !b || a.length !== b.length) return false; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; }
const CELL = 32 * SCALE + 8, LABEL = 150;
function sheet(title, rows) {
  const W = LABEL + CELL * 2 + 16, H = 36 + rows.length * (CELL + 8) + 8;
  const dst = Buffer.alloc(W * H * 4);
  for (let i = 0; i < dst.length; i += 4) { dst[i] = PAPER[0]; dst[i + 1] = PAPER[1]; dst[i + 2] = PAPER[2]; dst[i + 3] = 255; }
  text(dst, W, H, title, 8, 8, INK, 2);
  text(dst, W, H, 'BEFORE', LABEL, 22, MUTED, 1);
  text(dst, W, H, 'AFTER', LABEL + CELL, 22, INK, 1);
  rows.forEach((row, i) => {
    const y = 36 + i * (CELL + 8);
    text(dst, W, H, row.label, 6, y + 8, INK, 1);
    text(dst, W, H, row.sub || '', 6, y + 20, MUTED, 1);
    const key = row.id + '|' + row.stage + '|' + (row.item || '');
    const b = before[key] && before[key] !== 'ERR' ? fromB64(before[key]) : null;
    let af; try { af = after(row.id, row.stage, row.item); } catch (e) { af = null; }
    if (b) blit(dst, W, H, b, LABEL, y);
    if (af) blit(dst, W, H, af, LABEL + CELL, y);
    if (b && af && same(b, af)) text(dst, W, H, 'SAME', LABEL + CELL, y + 32 * SCALE + 2, MUTED, 1);
    else if (b && af) text(dst, W, H, 'MOVED', LABEL + CELL, y + 32 * SCALE + 2, RED, 1);
  });
  return pngOf(W, H, dst);
}
const ST = { 1: 'Hatch', 3: 'Adult', 5: 'Mythic' };
function rows(list) { return list.map(r => ({ id: r[0], stage: r[1], item: r[2], label: r[0].toUpperCase() + ' ' + ST[r[1]], sub: String(r[2]).replace(/^v2-/, '').slice(0, 18) })); }
const peepo = [];
['v2-gold-nose-ring', 'v2-septum-chain', 'v2-diamond-stud', 'nose-ring', 'v2-peepo-hat', 'party-hat', 'pimp-hat', 'bino-hat', 'v2-peepo-band', 'v2-crown-tin', 'gold-crown'].forEach(it => [1, 3, 5].forEach(st => peepo.push(['peepo', st, it])));
const head = [
  ['wojak', 3, 'v2-wojak-hat'], ['wojak', 3, 'v2-wojak-band'], ['wojak', 3, 'gold-crown'], ['wojak', 3, 'v2-crown-tin'],
  ['chud', 3, 'v2-chud-band'], ['chad', 3, 'red-headband'], ['mumu', 3, 'v2-mumu-hat'], ['mumu', 3, 'v2-mumu-band'],
  ['snibby', 3, 'v2-snibby-hat'], ['snibby', 3, 'v2-snibby-band'], ['doge', 3, 'v2-doge-hat'], ['doge', 3, 'v2-doge-band'],
  ['dodo', 3, 'v2-crown-tin'], ['kevin', 3, 'v2-kevin-band'], ['nakamoto', 3, 'v2-nakamoto-band'],
  ['sarutobi', 5, 'v2-sarutobi-hat'], ['kek', 3, 'red-headband'], ['kek', 3, 'gold-crown'],
  ['viking', 3, 'red-headband'], ['djpepe', 3, 'dj-headphones'], ['djpepe', 3, 'red-headband'],
  ['bojackson', 3, 'gold-crown'], ['wizard', 3, 'red-headband'], ['pepe', 3, 'v2-pepe-hat']
];
const face = [
  ['peepo', 3, 'v2-gold-nose-ring'], ['peepo', 1, 'v2-gold-nose-ring'], ['doge', 3, 'v2-gold-nose-ring'],
  ['pepe', 3, 'v2-gold-nose-ring'], ['mumu', 3, 'v2-gold-nose-ring'], ['lenny', 3, 'v2-gold-nose-ring'],
  ['snibby', 3, 'v2-gold-nose-ring'], ['peepo', 3, 'v2-gold-grill'], ['bobo', 3, 'v2-gold-grill'],
  ['djpepe', 3, 'v2-gold-nose-ring'], ['orangedragon', 3, 'v2-gold-nose-ring'], ['kek', 3, 'v2-gold-nose-ring'],
  ['chud', 3, 'v2-chud-bluelight'], ['kevin', 3, 'sig-kevin-face']
];
const rest = [
  ['kevin', 3, 'v2-kevin-band'], ['nakamoto', 3, 'red-scarf'], ['funtrump', 3, 'red-scarf'], ['homer', 3, 'red-scarf'],
  ['snibby', 3, 'sig-snibby-body'], ['doge', 3, 'sig-doge-body'],
  ['peepo', 3, 'sig-peepo-held'], ['pepe', 3, 'sig-pepe-held'], ['wojak', 3, 'sig-wojak-held'],
  ['funtrump', 5, 'ft-skateboard'], ['homer', 3, 'hp-slippers'], ['pepe', 3, 'v2-pepe-band']
];
const outDir = __dirname, artDir = '/opt/cursor/artifacts/gear-fit';
fs.mkdirSync(artDir, { recursive: true });
const files = [
  ['peepo-before-after.png', 'PEEPO BEFORE / AFTER', peepo],
  ['head-before-after.png', 'HEADWEAR BEFORE / AFTER', head],
  ['face-before-after.png', 'FACE BEFORE / AFTER', face],
  ['neck-body-grip-before-after.png', 'NECK BODY GRIP BEFORE / AFTER', rest]
];
// unchanged control: Pepe's own hat should stay put
const ctrlB = fromB64(before['pepe|3|v2-pepe-hat']);
const ctrlA = after('pepe', 3, 'v2-pepe-hat');
let diff = 0; for (let i = 0; i < ctrlB.length; i++) if (ctrlB[i] !== ctrlA[i]) diff++;
console.log('pepe hat adult changed pixels', diff);
files.forEach(f => { const png = sheet(f[1], rows(f[2])); fs.writeFileSync(path.join(outDir, f[0]), png); fs.writeFileSync(path.join(artDir, f[0]), png); console.log(f[0], png.length); });
