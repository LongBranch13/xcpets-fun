#!/usr/bin/env node
/* weird-looks-1128 tests (display only): js/weird-looks.js picks the right look per pet, V2Render tags frames with it, the sprite changes in
 * rareHatchFrames keep Tiny / Giant / Backwards / Inverted pixel-identical to before, Two-headed now fills its 64 px scene (with room for the
 * Mythic aura) and Ghost blends into its backdrop instead of punching a hole through the card, and every page that draws pets loads the file
 * before js/v2-render.js (frames are cached, so a late load would leave the first pets untagged).
 *   node tools/weird-looks-test.js */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert'), cp = require('child_process');
const ROOT = path.resolve(__dirname, '..'), rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
function ctxWith(renderSrc) {
  const store = {}, ls = { getItem: k => store[k] || null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  const el = () => ({ style: {}, appendChild() {}, setAttribute() {}, addEventListener() {}, getContext: () => null, classList: { add() {}, remove() {}, toggle() {} } });
  const doc = { createElement: el, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, head: null, documentElement: el(), body: el() };
  const win = { console: { log() {}, warn() {}, error() {}, info() {} }, localStorage: ls, sessionStorage: ls, document: doc, location: { search: '', hostname: 'xcpets.fun', href: 'https://xcpets.fun/' }, navigator: { userAgent: 'node' }, setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {}, requestAnimationFrame: () => 0, MutationObserver: function () { this.observe = () => {}; }, URLSearchParams, URL, TextEncoder, TextDecoder };
  win.window = win; win.self = win; win.globalThis = win; const ctx = vm.createContext(win);
  for (const f of ['rjs/config.js', 'rjs/pet-core.js', 'rjs/game-core.js', 'rjs/bonus-gear.js', 'js/pet-core.js', 'js/bonus-gear.js', 'js/v2-gear.js', 'js/v2-fit.js', 'js/v2-rules.js', 'js/species-registry.js', 'js/weird-looks.js'])
    vm.runInContext(rd(f), ctx, { filename: f });
  vm.runInContext(renderSrc, ctx, { filename: 'js/v2-render.js' });
  return ctx;
}
let pass = 0; const t = (name, fn) => { fn(); pass++; console.log('ok', name); };
const now = ctxWith(rd('js/v2-render.js')), R = now.V2Render, WL = now.V2Weird;
let before = null; try { before = ctxWith(cp.execSync('git show 71043d373c95733173ed42259a13a42c635c9ac2:js/v2-render.js', { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 << 20 })).V2Render; } catch (e) { console.log('skip: the last main before these looks (71043d3) is not in this clone'); }

/* ---------------- which look ---------------- */
const rh = (kind, extra) => ({ art: { rareHatch: Object.assign({ version: 1, kind, block: 975000 }, extra || {}) } });
t('every weird hatch but Giant gets its look', () => { ['tiny', 'two-headed', 'inverted', 'ghost', 'backwards', 'wrong-egg'].forEach(k => assert.strictEqual(WL.infoOf(Object.assign({ id: 1, species: 'pepe' }, rh(k))).k, k)); assert.strictEqual(WL.infoOf(Object.assign({ id: 1 }, rh('giant'))), null); });
t('Legends and Gods are not weird', () => ['djpepe', 'wizard', 'kek', 'god'].forEach(k => assert.strictEqual(WL.infoOf(Object.assign({ id: 1 }, rh(k))), null)));
t('wrong egg carries the egg it came from', () => { const i = WL.infoOf(Object.assign({ id: 9, species: 'sarutobi' }, rh('wrong-egg', { expected: 'snibby', actual: 'sarutobi' }))); assert.strictEqual(i.exp, 'snibby'); assert.strictEqual(i.act, 'sarutobi'); });
t('mutations and throwbacks', () => { assert.strictEqual(WL.infoOf({ id: 2, mutation: { kind: 'glitch' } }).k, 'glitch'); const p = WL.infoOf({ id: 3, mutation: { kind: 'palette', set: 'goldrush' } }); assert.strictEqual(p.k, 'palette'); assert.strictEqual(p.set, 'goldrush');
  ['frost', 'socks', 'oddeyes'].forEach(s => assert.strictEqual(WL.infoOf({ id: 4, shows: s }).k, 'throwback')); assert.strictEqual(WL.infoOf({ id: 5, shows: 'nope' }), null); });
t('a weird hatch wins over a mutation; dead and released pets get nothing', () => { assert.strictEqual(WL.infoOf(Object.assign({ id: 6, mutation: { kind: 'glitch' } }, rh('ghost'))).k, 'ghost'); assert.strictEqual(WL.infoOf(Object.assign({ id: 7, dead: true }, rh('ghost'))), null); assert.strictEqual(WL.infoOf({ id: 8, released: true, mutation: { kind: 'glitch' } }), null); });
t('tag marks every frame with plain properties (copies keep them)', () => { const fr = [{ data: 1 }, { data: 2 }]; WL.tag(fr, Object.assign({ id: 1 }, rh('tiny'))); assert(fr.every(f => f.wl && f.wl.k === 'tiny')); const c = Object.assign({}, fr[0]); assert.strictEqual(c.wl.k, 'tiny'); const n = [{ data: 1 }]; WL.tag(n, { id: 1 }); assert(!('wl' in n[0])); });

/* ---------------- sprites ---------------- */
const PC = now.PetCore; const arts = {};
for (let i = 0; i < 3000 && Object.keys(arts).length < 6; i++) { const a = PC.generate({ blockHash: '00'.repeat(32), petId: 'wl' + i, blockHeight: 980000 }); if (!a.hybrid && !arts[a.species]) arts[a.species] = a; }
const SPEC = Object.keys(arts).slice(0, 4);
function frames(Rx, sp, kind, stage) { const art = Object.assign({}, arts[sp], { rareHatch: { version: 1, kind, block: 975000 } }); const p = { id: 1, species: sp, stage, art };
  const fr = Rx.framesWith(art, stage, []); return Rx.rareHatchFrames(fr, p, { items: [], byId: {} }, { rareKey: (bg) => Rx.framesWith(Object.assign({}, art, { background: 'solid', bgColor: bg, pattern: 'none' }), stage, []) }); }
const same = (a, b) => a.length === b.length && a.every((f, i) => Buffer.compare(Buffer.from(f.data), Buffer.from(b[i].data)) === 0 && (!f.rareScene) === (!b[i].rareScene) && (!f.rareScene || Buffer.compare(Buffer.from(f.rareScene.data), Buffer.from(b[i].rareScene.data)) === 0));
if (before) t('Tiny, Giant, Backwards, Inverted, Wrong egg: same pixels as before', () => SPEC.forEach(sp => ['tiny', 'giant', 'backwards', 'inverted', 'wrong-egg'].forEach(k => assert(same(frames(R, sp, k, 3), frames(before, sp, k, 3)), sp + ' ' + k))));
t('Tiny and Giant frames say where the pet sits', () => SPEC.forEach(sp => { const b = frames(R, sp, 'tiny', 3)[0].wlBox; assert(b && b[2] - b[0] < 0.5 && b[3] <= 1, sp + ' ' + b); const g = frames(R, sp, 'giant', 3)[0].wlBox; assert(g && g[2] - g[0] > 0.5, sp + ' ' + g); }));
t('Two-headed fills its 64 px scene and leaves room for the aura', () => SPEC.forEach(sp => { const f = frames(R, sp, 'two-headed', 3)[0], b = f.wlBox; assert(f.rareScene, 'scene');
  const w = (b[2] - b[0]) * 64, h = (b[3] - b[1]) * 64; assert(w >= 40 || h >= 40, sp + ' too small: ' + w + 'x' + h); assert(b[0] * 64 >= 2.9 && b[2] * 64 <= 61.1, sp + ' no margin: ' + b.map(x => x * 64)); }));
/* (the old Two-headed was about 26 px wide in its 64 px scene; the check above asks for 40) */
t('Ghost stays opaque on the card (blended into its backdrop), pale and see-through', () => SPEC.forEach(sp => { const g = frames(R, sp, 'ghost', 3)[0].data, n = frames(R, sp, 'inverted', 3), base = R.framesWith(arts[sp], 3, [])[0].data; let a = 0, changed = 0;
  for (let q = 0; q < 1024; q++) { if (g[q * 4 + 3] !== 255 && base[q * 4 + 3] === 255) a++; if (g[q * 4] !== base[q * 4] || g[q * 4 + 1] !== base[q * 4 + 1]) changed++; } assert.strictEqual(a, 0, sp + ' alpha holes'); assert(changed > 60, sp + ' barely changed'); assert(n.length); }));

/* ---------------- pages ---------------- */
t('every page that loads v2-render.js loads weird-looks.js first, same token everywhere', () => { const pages = fs.readdirSync(ROOT).filter(f => f.endsWith('.html')).concat(['templates/game.html']); const toks = new Set(); let n = 0;
  pages.forEach(p => { const s = rd(p); let i = -1; while ((i = s.indexOf('js/v2-render.js?v=', i + 1)) >= 0) { if (/rel="prefetch"/.test(s.slice(Math.max(0, i - 60), i))) continue; const w = s.lastIndexOf('js/weird-looks.js?v=', i); assert(w >= 0 && i - w < 260, p + ': weird-looks.js must come just before v2-render.js'); const m = /js\/weird-looks\.js\?v=([0-9a-f]+)/.exec(s.slice(w)); assert(m, p); toks.add(m[1]); n++; } });
  assert(n >= 20, 'pages found: ' + n); assert.strictEqual(toks.size, 1, 'tokens: ' + [...toks]); });
console.log('ALL PASS (' + pass + ')');
