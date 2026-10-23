#!/usr/bin/env node
/* COMMUNITY PET CHECK (owner standing rule, Oct 22 2026 10:15 PM CT: "community pets must ALWAYS work for hybrids and gear").
 * Dev tooling only, not loaded by any page. For every community pet (nakamoto, wizard, kek, funtrump) it checks, in a Node vm with the repo's scripts:
 *   1. SPRITE   stages 0..5 x 4 idle frames render (32x32, no NaN, no magenta key pixels, not blank).
 *   2. HYBRIDS  the pet as SHAPE and as COLOUR/FEATURE with every other root (13 species + the other community pets), head and side feature,
 *               stages 0..5 x 4 frames: no throw, no blank frame (>= 30 non-background pixels), no broken pixels; plus 3-way hybrids
 *               (pet with every pair rotation of two other roots, all three role orders).
 *   3. GEAR     every gear id (V2Rules.GEAR_BY_ID + the pet's signature piece) x stages 1..5 on the player pet through V2Render.framesWith:
 *               no throw, draws something (pixels differ from bare), stays inside 32x32, no broken pixels. Pieces a pet never draws BY DESIGN
 *               (Lord Kek's nemes replaces Headwear; pieces V2Rules.eligible() never gives this species, e.g. the Wizard-only staff or
 *               Chud's beard on Nakamoto) are reported as 'by design', not failures.
 * Usage: node tools/community-pet-check.js [--pet kek] [--repo DIR] [--json out.json] [--quick]
 * Exit code 1 if anything fails. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const A = process.argv.slice(2), opt = k => { const i = A.indexOf(k); return i >= 0 ? A[i + 1] : null; }, has = k => A.includes(k);
const ROOT = path.resolve(opt('--repo') || path.join(__dirname, '..'));
const SCRIPTS = ['rjs/config.js', 'rjs/pet-core.js', 'rjs/game-core.js', 'rjs/bonus-gear.js', 'rjs/real-core.js', 'rjs/chain.js', '@LIVE', 'js/pet-core.js', 'js/bonus-gear.js', 'js/v2-gear.js', 'js/v2-fit.js',
  'js/kek-sprite.js', 'js/wizard-sprite.js', 'js/funtrump-sprite.js', 'js/v2-rules.js', 'js/block-hashes.js', 'js/v2-render.js'];
function load() { const st = {}, ls = { getItem: k => st[k] || null, setItem: (k, v) => { st[k] = String(v); }, removeItem: k => { delete st[k]; } };
  const el = () => ({ getContext: () => null, style: {}, setAttribute() {}, appendChild() {}, addEventListener() {}, classList: { add() {}, remove() {}, toggle() {} } });
  const win = { console: { log() {}, warn() {}, error() {}, info() {} }, localStorage: ls, sessionStorage: ls, location: { search: '', hostname: 'xcpets.fun', href: 'https://xcpets.fun/', pathname: '/' }, navigator: { userAgent: 'node' },
    setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {}, requestAnimationFrame: () => 0, URLSearchParams, URL, TextEncoder, TextDecoder, fetch: () => Promise.reject(new Error('offline')) };
  win.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: el, addEventListener() {}, body: null, documentElement: { style: {} }, readyState: 'complete' };
  win.addEventListener = () => {}; win.window = win; win.self = win; win.globalThis = win; const c = vm.createContext(win), loaded = [];
  for (const f of SCRIPTS) { if (f === '@LIVE') { vm.runInContext("window.LiveEngine={RealCore:window.RealCore,Chain:window.Chain&&window.Chain.Chain,CFG:window.XCPETS_CONFIG};", c); continue; }
    const p = path.join(ROOT, f); if (!fs.existsSync(p)) continue; try { vm.runInContext(fs.readFileSync(p, 'utf8'), c, { filename: f }); loaded.push(f); } catch (e) { loaded.push(f + ' (load error: ' + e.message + ')'); } }
  return { c, loaded }; }
const { c: ctx, loaded } = load(), P = ctx.PetCore, V = ctx.V2Rules, R = ctx.V2Render;
const SPECIES = ['pepe', 'wojak', 'chud', 'bobo', 'mumu', 'snibby', 'dodo', 'kevin', 'peepo', 'sarutobi', 'doge', 'lenny', 'nakamoto'];
const PETS = { nakamoto: { sprite: null }, wizard: { sprite: 'WizardSprite' }, kek: { sprite: 'KekSprite', designSkip: { head: 'nemes is part of him (Headwear never drawn)' }, sig: 'kek-card' },
  funtrump: { sprite: 'FuntrumpSprite', sig: 'ft-hairspray' } };
const STAGES = has('--quick') ? [0, 3, 5] : [0, 1, 2, 3, 4, 5];
function check(img, bg) { if (!img || !img.data) return 'no image'; const d = img.data; if ((img.width || 32) !== 32 || d.length !== 4096) return 'size ' + d.length;
  let n = 0; for (let j = 0; j < 1024; j++) { const r = d[j * 4], g = d[j * 4 + 1], b = d[j * 4 + 2]; if ([r, g, b].some(v => typeof v !== 'number' || isNaN(v))) return 'NaN pixel';
    if (r === 255 && g === 0 && b === 255 && !(bg && bg[0] === 255 && bg[2] === 255)) return 'magenta key pixel at ' + (j & 31) + ',' + (j >> 5);
    if (!bg || Math.abs(r - bg[0]) + Math.abs(g - bg[1]) + Math.abs(b - bg[2]) > 6) n++; } return n < 30 ? 'blank (' + n + ' px)' : null; }
function bgOf(img) { const d = img.data; return [d[0], d[1], d[2]]; } /* corner pixel = background on every sprite */
function baseArt(sp) { const a = sp === 'nakamoto' ? P.characterPet('nakamoto', { tier: 'legendary' }) : P.generate({ blockHash: '00'.repeat(32), petId: 'community-pet-check', blockHeight: 972700 });
  a.species = sp; a.background = 'solid'; a.bgColor = '#2a3a2e'; a.pattern = 'none'; ['band', 'armor', 'cape', 'weapon', 'crown'].forEach(k => a[k] = 'none'); return a; }
function planFor(key, want) { for (let i = 0; i < 400; i++) { const hx = require('crypto').createHash('sha256').update(key + ':' + i).digest('hex'), p = V.hybridPlan(hx, key, 972700);
  if (Object.keys(want).every(k => p[k] === want[k])) return p; } return null; }
const out = { repo: ROOT, loaded, pets: {} }; let fails = 0;
const only = opt('--pet'), roots = SPECIES.concat(['wizard', 'kek', 'funtrump']);
for (const pet of Object.keys(PETS).filter(p => !only || p === only)) {
  const cfg = PETS[pet], res = out.pets[pet] = { sprite: { ok: 0, fail: [] }, hybrids: { ok: 0, fail: [] }, hybrid3: { ok: 0, fail: [] }, gear: { ok: 0, fail: [], byDesign: 0 } };
  const S = cfg.sprite && ctx[cfg.sprite]; if (cfg.sprite && !S) { res.sprite.fail.push(cfg.sprite + ' not loaded'); fails++; continue; }
  /* 1. sprite */
  for (const st of [0, 1, 2, 3, 4, 5]) for (let f = 0; f < 4; f++) { let e; try { const img = S ? S.render(st, f, '#2a3a2e', {}, {}) : P.render(baseArt(pet), { stage: st, frame: f, gearOverride: {} }); e = check(img, bgOf(img)); } catch (x) { e = 'throw ' + x.message; }
    if (e) { res.sprite.fail.push('stage ' + st + ' f' + f + ': ' + e); fails++; } else res.sprite.ok++; }
  /* 2. hybrids: pet as shape, as colour (+ feature), head and side */
  for (const o of roots.filter(r => r !== pet)) for (const dir of ['shape', 'color']) for (const feat of ['head', 'side']) {
    const key = 'hyb:' + pet + ':' + o, want = dir === 'shape' ? { shape: pet, color: o, feature: feat } : { shape: o, color: pet, feature: feat }, plan = planFor(key, want);
    const tag = (dir === 'shape' ? pet + ' body x ' + o : o + ' body x ' + pet) + ' (' + feat + ')'; if (!plan) { res.hybrids.fail.push(tag + ': no plan'); fails++; continue; }
    const art = Object.assign(baseArt(plan.shape), { species: plan.shape, hybrid: plan, background: 'solid', bgColor: '#2a3a2e' });
    for (const st of STAGES) { let e; try { const fr = V.hybridFrames(art, { stage: st }); for (let f = 0; f < 4 && !e; f++) { const m = check(fr[f], [0x2a, 0x3a, 0x2e]); if (m) e = 'f' + f + ' ' + m; } } catch (x) { e = 'throw ' + x.message; }
      if (e) { res.hybrids.fail.push(tag + ' stage ' + st + ': ' + e); fails++; } else res.hybrids.ok++; } }
  /* 3-way: pet + two other roots (rotating pairs), every role order */
  const others = roots.filter(r => r !== pet);
  for (let i = 0; i < others.length; i++) { const tri = [pet, others[i], others[(i + 5) % others.length]], key = 'hyb3:' + tri.join(':');
    for (const ord of [[0, 1, 2], [1, 0, 2], [2, 1, 0]]) { const want = { shape: tri[ord[0]], color: tri[ord[1]], featSp: tri[ord[2]] }, plan = planFor(key, want), tag = key + ' ' + want.shape + '/' + want.color + '/' + want.featSp;
      if (!plan) { res.hybrid3.fail.push(tag + ': no plan'); fails++; continue; } const art = Object.assign(baseArt(plan.shape), { species: plan.shape, hybrid: plan, background: 'solid', bgColor: '#2a3a2e' });
      for (const st of [1, 3, 5]) { let e; try { const fr = V.hybridFrames(art, { stage: st }); for (let f = 0; f < 4 && !e; f++) { const m = check(fr[f], [0x2a, 0x3a, 0x2e]); if (m) e = 'f' + f + ' ' + m; } } catch (x) { e = 'throw ' + x.message; }
        if (e) { res.hybrid3.fail.push(tag + ' stage ' + st + ': ' + e); fails++; } else res.hybrid3.ok++; } } }
  /* 3. gear x stages (player pet, V2Render.framesWith = the same path cards use) */
  if (!R || !R.framesWith) { res.gear.fail.push('V2Render.framesWith not loaded'); fails++; continue; }
  const ids = Object.keys(V.GEAR_BY_ID).concat(cfg.sig && !V.GEAR_BY_ID[cfg.sig] ? [cfg.sig] : []), art = baseArt(pet);
  for (const id of ids) { const it = V.GEAR_BY_ID[id] || { slot: 'hand' }; for (const st of [1, 2, 3, 4, 5]) { let e, diff = 0;
    try { const a = R.framesWith(art, st, []), b = R.framesWith(art, st, [id]); for (let f = 0; f < 4 && !e; f++) { const m = check(b[f], bgOf(b[f])); if (m) { e = 'f' + f + ' ' + m; break; }
        for (let j = 0; j < 4096; j += 4) if (a[f].data[j] !== b[f].data[j] || a[f].data[j + 1] !== b[f].data[j + 1] || a[f].data[j + 2] !== b[f].data[j + 2]) diff++; } } catch (x) { e = 'throw ' + x.message; }
    if (!e && diff === 0) { if ((cfg.designSkip && cfg.designSkip[it.slot]) || (V.eligible && V.GEAR_BY_ID[id] && !V.eligible(id, pet))) { res.gear.byDesign++; continue; } e = 'not drawn (no pixel change)'; }
    if (e) { res.gear.fail.push(id + ' [' + it.slot + '] stage ' + st + ': ' + e); fails++; } else res.gear.ok++; } }
}
const W = (k, r) => k + ' ok ' + r.ok + (r.byDesign ? ' · by design ' + r.byDesign : '') + ' · FAIL ' + r.fail.length;
for (const p of Object.keys(out.pets)) { const r = out.pets[p]; console.log(p.padEnd(9), [W('sprite', r.sprite), W('hybrids', r.hybrids), W('3-way', r.hybrid3), W('gear', r.gear)].join(' | '));
  for (const k of ['sprite', 'hybrids', 'hybrid3', 'gear']) { const f = r[k].fail; f.slice(0, 8).forEach(x => console.log('   ✗ ' + k + ': ' + x)); if (f.length > 8) console.log('   … ' + (f.length - 8) + ' more ' + k + ' failures (see --json)'); } }
if (opt('--json')) fs.writeFileSync(opt('--json'), JSON.stringify(out, null, 1));
console.log(fails ? 'FAIL (' + fails + ')' : 'PASS'); process.exit(fails ? 1 : 0);
