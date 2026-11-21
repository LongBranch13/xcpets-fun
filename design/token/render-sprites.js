/* Headless dump of the current XCPETS sprites for the FUN.D token art.
 * Uses the same loader order as tools/lib/load-rules.js and the live renderer
 * (V2Render.framesWith / each species sprite's frames()). Prints JSON on stdout.
 * No network, no wallet, no canvas. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..', '..');

function load(extra) {
  const st = {};
  const ls = { getItem: k => st[k] || null, setItem: (k, v) => { st[k] = String(v); }, removeItem: k => { delete st[k]; } };
  const win = {
    console: { log() {}, warn() {}, error() {}, info() {} },
    localStorage: ls, sessionStorage: ls,
    location: { search: '', hostname: 'xcpets.fun', href: 'https://xcpets.fun/' },
    navigator: { userAgent: 'node' },
    setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
    requestAnimationFrame: () => 0, cancelAnimationFrame() {},
    URLSearchParams, URL, TextEncoder, TextDecoder, Uint8ClampedArray,
    ImageData: function ImageData(d, w, h) { this.data = d; this.width = w; this.height = h; },
    MutationObserver: function () { this.observe = function () {}; },
    fetch: () => Promise.reject(new Error('offline'))
  };
  win.document = {
    hidden: false, readyState: 'loading',
    getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
    createElement: () => ({ getContext: () => null, style: {}, appendChild() {} }),
    addEventListener() {}, head: { appendChild() {} }, body: { appendChild() {} },
    documentElement: { style: {} }
  };
  win.addEventListener = () => {}; win.window = win; win.self = win;
  const ctx = vm.createContext(win);
  const files = ['rjs/config.js', 'rjs/pet-core.js', 'rjs/game-core.js', 'rjs/bonus-gear.js', 'rjs/real-core.js', 'rjs/chain.js', '@LIVE', 'js/pet-core.js', 'js/bonus-gear.js', 'js/v2-gear.js', 'js/v2-fit.js', 'js/v2-rules.js', 'js/block-hashes.js'].concat(extra);
  for (const f of files) {
    if (f === '@LIVE') { vm.runInContext('window.LiveEngine={RealCore:window.RealCore}', ctx); continue; }
    const p = path.join(ROOT, f);
    if (fs.existsSync(p)) vm.runInContext(fs.readFileSync(p, 'utf8'), ctx, { filename: f });
  }
  return ctx;
}

const c = load([
  'js/wizard-sprite.js', 'js/kek-sprite.js', 'js/funtrump-sprite.js', 'js/homer-sprite.js',
  'js/rabbit-sprite.js', 'js/djpepe-sprite.js', 'js/viking-sprite.js', 'js/dragon-sprite.js',
  'js/bo-sprite.js', 'js/rarepigeon-sprite.js', 'js/jackson-sprite.js', 'js/contest-sprite.js',
  'js/v2-render.js'
]);
const R = c.V2Render, PC = c.PetCore, BG = '#ff00fe';
const NONE = { band: 'none', crown: 'none', armor: 'none', cape: 'none', weapon: 'none', shades: false };

function pack(fr) {
  const f = fr && (fr[0] || fr);
  if (!f || !f.data) throw new Error('empty frame');
  return { w: f.width || 32, h: f.height || 32, data: Array.from(f.data) };
}
function core(id, stage) {
  const kit = ((c.V2Gear.CAST_KITS || {})[id] || []).slice();
  const art = Object.assign(PC.characterPet(id, { tier: 'legendary', bgColor: BG }), NONE, { background: 'solid', bgColor: BG, pattern: 'none' });
  const extra = id === 'peepo' ? ['v2-honk'] : [];
  return pack(R.framesWith(art, stage, kit, extra, 5));
}

const W = c.WizardSprite;
/* Bitcoin Wizard, Mythic, blue player palette. Hat + Bitcoin staff. The raised-fist flame is replaced
 * by the renderer's spellbook grip (WizardSprite.draw draws the flame only when that hand is empty).
 * Staff coin uses the renderer's own red-bitcoin override (O/o -> #e11d2e / #9b0f1c). Orange hair stays. */
const wizard = pack(W.frames(5, BG, {
  head: W.WIZARD_HAT,
  weapon: { item: 'sig-wizard-staff', label: 'Bitcoin staff', cols: ['#9a4a12', '#e11d2e'] },
  hand: { item: 'spellbook', label: 'spell book', cols: ['#5b2a86', '#ffd23f'] }
}, { pal: { O: '#e11d2e', o: '#9b0f1c' } }));

const out = {};
const cores = {
  'pepe-s5': ['pepe', 5], 'wojak-s3': ['wojak', 3], 'chud-s5': ['chud', 5], 'chad-s5': ['chad', 5],
  'bobo-s5': ['bobo', 5], 'mumu-s5': ['mumu', 5], 'snibby-s5': ['snibby', 5], 'dodo-s5': ['dodo', 5],
  'kevin-s5': ['kevin', 5], 'peepo-s5': ['peepo', 5], 'sarutobi-s5': ['sarutobi', 5], 'doge-s5': ['doge', 5],
  'lenny-s5': ['lenny', 5], 'nakamoto-s5': ['nakamoto', 5]
};
for (const [name, spec] of Object.entries(cores)) out[name] = core(spec[0], spec[1]);
out['wizard-mythic'] = wizard;
out['kek-mythic'] = pack(c.KekSprite.frames(5, BG, { hand: c.KekSprite.KEK_CARD }, {}));
out['funtrump-mythic'] = pack(c.FuntrumpSprite.frames(5, BG, {}, { look: 'hoodie' }));
out['homer-mythic'] = pack(c.HomerSprite.frames(5, BG, c.HomerSprite.HP_DONUT ? { hand: c.HomerSprite.HP_DONUT } : {}, {}));
out['rabbit-mythic'] = pack(c.RabbitSprite.frames(5, BG, {}, {}));
out['djpepe-mythic'] = pack(c.DjPepeSprite.frames(5, BG, {}, {}));
out['viking-mythic'] = pack(c.VikingSprite.frames(5, BG, {}, {}));
out['dragon-mythic'] = pack(c.DragonSprite.frames(5, BG, {}, {}));
out['bojackson-mythic'] = pack(c.ContestSprite.frames('bojackson', 5, BG, {}));
out['rarepigeon-mythic'] = pack(c.ContestSprite.frames('rarepigeon', 5, BG, {}));
out['jacksonpepe-mythic'] = pack(c.ContestSprite.frames('jacksonpepe', 5, BG, {}));

const font = require(path.join(ROOT, 'js/papers-font.js'))['8'];
process.stdout.write(JSON.stringify({ sprites: out, font: { w: font.w, h: font.h, oy: font.oy, adv: font.adv, g: font.g } }));
