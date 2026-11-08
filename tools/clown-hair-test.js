'use strict';
/* Honk clown hair: solid puffs, Kevin's grey hair replaced, eyes kept. Display only. */
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const ROOT = path.resolve(__dirname, '..');
const SCRIPTS = ['rjs/config.js', 'rjs/pet-core.js', 'rjs/game-core.js', 'rjs/bonus-gear.js', 'rjs/real-core.js', 'rjs/chain.js', '@LIVE',
  'js/pet-core.js', 'js/bonus-gear.js', 'js/v2-gear.js', 'js/v2-fit.js', 'js/v2-rules.js',
  'js/wizard-sprite.js', 'js/kek-sprite.js', 'js/funtrump-sprite.js', 'js/homer-sprite.js', 'js/viking-sprite.js',
  'js/rabbit-sprite.js', 'js/djpepe-sprite.js', 'js/dragon-sprite.js', 'js/jackson-sprite.js', 'js/bo-sprite.js',
  'js/rarepigeon-sprite.js', 'js/contest-sprite.js', 'js/v2-bg.js', 'js/v2-looks.js', 'js/v2-clown-hair.js', 'js/v2-render.js'];
const st = {}, ls = { getItem: k => st[k] || null, setItem: (k, v) => { st[k] = String(v); }, removeItem: k => { delete st[k]; } };
const el = () => ({ getContext: () => null, style: {}, setAttribute() {}, appendChild() {}, addEventListener() {}, classList: { add() {}, remove() {}, toggle() {} } });
const nop = function () { return { observe() {}, disconnect() {} }; };
const win = { console: { log() {}, warn() {}, error() {} }, localStorage: ls, sessionStorage: ls, location: { search: '', hostname: 'xcpets.fun', href: 'https://xcpets.fun/', pathname: '/' }, navigator: { userAgent: 'node' },
  setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {}, requestAnimationFrame: () => 0, URLSearchParams, URL, TextEncoder, TextDecoder, fetch: () => Promise.reject(new Error('offline')), Uint8ClampedArray, Map, WeakMap, Set, MutationObserver: nop, ResizeObserver: nop, IntersectionObserver: nop };
win.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: el, addEventListener() {}, body: null, documentElement: { style: {} }, readyState: 'complete', head: { appendChild() {} } };
win.addEventListener = () => {}; win.window = win; win.self = win; win.globalThis = win;
const ctx = vm.createContext(win);
for (const f of SCRIPTS) {
  if (f === '@LIVE') { vm.runInContext('window.LiveEngine={RealCore:window.RealCore,Chain:window.Chain&&window.Chain.Chain,CFG:window.XCPETS_CONFIG};', ctx); continue; }
  const p = path.join(ROOT, f); if (fs.existsSync(p)) vm.runInContext(fs.readFileSync(p, 'utf8'), ctx, { filename: f });
}
const P = ctx.PetCore, R = ctx.V2Render, H = ctx.V2ClownHair, V = ctx.V2Rules;
assert(H && H.ID === 'v2-honk');
assert(!V.GEAR_BY_ID['v2-honk'], 'honk is not in the roll pool');
const SPECIES = P.SPECIES.map(s => s.id).concat(['wizard', 'kek', 'funtrump', 'homer', 'rabbit', 'djpepe', 'viking', 'orangedragon', 'jacksonpepe', 'bojackson', 'rarepigeon', 'starlordkek', 'gooby', 'lukespam']);
function art(sp) {
  const a = sp === 'nakamoto' ? P.characterPet('nakamoto', { tier: 'legendary' }) : P.generate({ blockHash: 'ab'.repeat(32), petId: 'honk-' + sp, blockHeight: 972700 });
  a.species = sp; a.eyes = 'classic'; a.shades = false; a.background = 'solid'; a.bgColor = '#14101c'; a.pattern = 'none'; delete a.bgV2;
  ['band', 'armor', 'cape', 'weapon', 'crown', 'hat', 'eyewear', 'held', 'neck', 'face'].forEach(k => { if (k in a) a[k] = 'none'; });
  if (sp === 'funtrump') { a.ftLook = 'suit'; a.tierIndex = 2; }
  if (sp === 'homer') a.tierIndex = 2;
  return a;
}
function grey(r, g, b) { const d = (h) => Math.abs(r - h[0]) + Math.abs(g - h[1]) + Math.abs(b - h[2]); return d([149, 138, 135]) < 28 || d([131, 116, 109]) < 28 || d([107, 87, 81]) < 22; }
let n = 0;
SPECIES.forEach(sp => {
  for (let s = 0; s < 6; s++) {
    const bare = R.framesWith(art(sp), s, [], []);
    const worn = R.framesWith(art(sp), s, [], ['v2-honk']);
    assert(bare[0] && worn[0], sp + ' s' + s);
    const bg = [worn[0].data[0], worn[0].data[1], worn[0].data[2]];
    const pr = H.problems(worn[0].data, bg);
    assert.strictEqual(pr.length, 0, sp + ' s' + s + ' ' + pr.join(','));
    if (sp === 'kevin' && s > 0) { let g = 0; const d = worn[0].data; for (let i = 0; i < d.length; i += 4) if (grey(d[i], d[i + 1], d[i + 2])) g++; assert.strictEqual(g, 0, 'kevin grey s' + s + ' ' + g); }
    n++;
  }
});
const pepe = R.framesWith(art('pepe'), 3, [], ['v2-honk'])[0].data;
let y = 0, g = 0, b = 0, r = 0, w = 0;
for (let i = 0; i < pepe.length; i += 4) { const R0 = pepe[i], G0 = pepe[i + 1], B0 = pepe[i + 2]; if (R0 > 200 && G0 > 140 && B0 < 80) y++; else if (G0 > 140 && R0 < 80 && B0 < 100) g++; else if (B0 > 160 && R0 < 80) b++; else if (R0 > 180 && G0 < 80 && B0 < 80) r++; else if (R0 > 230 && G0 > 230 && B0 > 230) w++; }
assert(y > 20 && g > 10 && b > 10 && r > 15, 'pepe rainbow ' + [y, g, b, r]);
assert(w > 4, 'pepe eyes stay');
const plain = R.framesWith(art('pepe'), 3, [], [])[0].data;
let same = true; for (let i = 0; i < plain.length; i++) if (plain[i] !== R.framesWith(art('pepe'), 3, [], [])[0].data[i]) same = false;
assert(same);
console.log('PASS clown hair', n, 'species-stages, pool untouched');
