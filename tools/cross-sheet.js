'use strict';
/* tools/cross-sheet.js  (offline, no network, never touches live data)
 *
 *   node tools/cross-sheet.js <species> [outDir]   new-character sheet: <species> as a hybrid body with every other root's
 *                                                  colours + parts and every body wearing <species>, stages 1-5, plus Bo/RP marks,
 *                                                  palettes, glitch, frost, socks, odd eyes; ends with the Dynast anchor check
 *                                                  for that body.
 *   add --fix to the species form to also switch on the hybrid-audit fix gate (ACTIVATE_HYBRID_FIX_BLOCK).
 *   node tools/cross-sheet.js --dynast [outDir]    Dynast "Ancestor Channel" check on EVERY body (17 roots) and the common
 *                                                  live hybrid shapes, stages 1-5, all 4 ancestors at every key frame.
 *
 * Writes <outDir>/flags.txt, tile JSON (for a labelled sheet) and an unlabelled PNG grid. Exit 1 when any hard flag fires.
 * Gates are switched on in this process only (rules are loaded into a sandbox); the repo files are not changed.
 *
 * Dynast flags (each is a hard flag):
 *   ANCHOR   anchor eyes missing, outside the silhouette, below the mouth, or in the lower body
 *   LASER    glow pixel not on an eye pixel; beam / spark pixel on the pet; an eye with no beam leaving it (k>=1)
 *   SHADES   shades cover <70% of the eye pixels, sit outside the eye band, touch the mouth, or float off the face;
 *            airborne shades touching the pet
 *   PIGEON   missing; perched bird touching the pet, not resting on the head top, off the head, landing below the eyes;
 *            sitting bird below the eyes; flying bird / heart touching the pet; clipped sprite
 *   BALL     missing; ball / speed lines / sparks on the pet; clipped sprite
 *   BADGE    any effect pixel in the badge corner (x>=26, y<5)
 */
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto'), zlib = require('zlib');
const ROOT = process.env.XC_REPO || path.resolve(__dirname, '..');
const SCRIPTS = ['rjs/config.js', 'rjs/pet-core.js', 'rjs/game-core.js', 'rjs/bonus-gear.js', 'rjs/real-core.js', 'rjs/chain.js', '@LIVE', 'js/pet-core.js', 'js/bonus-gear.js', 'js/v2-gear.js', 'js/v2-fit.js', 'js/v2-rules.js',
  'js/wizard-sprite.js', 'js/kek-sprite.js', 'js/funtrump-sprite.js', 'js/homer-sprite.js', 'js/viking-sprite.js', 'js/bo-sprite.js', 'js/rarepigeon-sprite.js', 'js/contest-sprite.js', 'js/block-hashes.js', 'js/v2-bg.js', 'js/v2-looks.js', 'js/v2-render.js'];
function load() {
  const st = {}, ls = { getItem: k => st[k] || null, setItem: (k, v) => { st[k] = String(v); }, removeItem: k => { delete st[k]; } };
  const el = () => ({ getContext: () => null, style: {}, setAttribute() {}, appendChild() {}, addEventListener() {}, classList: { add() {}, remove() {}, toggle() {} } });
  const nop = function () { return { observe() {}, disconnect() {} }; };
  const win = { console: { log() {}, warn() {}, error() {}, info() {} }, localStorage: ls, sessionStorage: ls, location: { search: '', hostname: 'xcpets.fun', href: 'https://xcpets.fun/', pathname: '/' }, navigator: { userAgent: 'node' },
    setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {}, requestAnimationFrame: () => 0, URLSearchParams, URL, TextEncoder, TextDecoder, fetch: () => Promise.reject(new Error('offline')), Uint8ClampedArray, Map, WeakMap, Set, MutationObserver: nop, ResizeObserver: nop, IntersectionObserver: nop };
  win.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: el, addEventListener() {}, body: null, documentElement: { style: {} }, readyState: 'complete', head: { appendChild() {} } };
  win.addEventListener = () => {}; win.window = win; win.self = win; win.globalThis = win; const c = vm.createContext(win);
  for (const f of SCRIPTS) {
    if (f === '@LIVE') { vm.runInContext('window.LiveEngine={RealCore:window.RealCore,Chain:window.Chain&&window.Chain.Chain,CFG:window.XCPETS_CONFIG};', c); continue; }
    const p = path.join(ROOT, f); if (fs.existsSync(p)) vm.runInContext(fs.readFileSync(p, 'utf8'), c, { filename: f });
  }
  return { c, P: c.PetCore, V: c.V2Rules, R: c.V2Render };
}
const L = load(), { P, V, R } = L;
const H = s => crypto.createHash('sha256').update(String(s)).digest('hex');
const BLK = 974100;
const ROOTS = P.SPECIES.map(s => s.id).concat(['wizard', 'kek', 'funtrump', 'homer', 'viking']);
const BG = '#1b1e27'; // a plain dark site tile (not a marker colour, so the Dynast effect renders)
function baseArt(sp, seed) {
  const a = sp === 'nakamoto' ? P.characterPet('nakamoto', { tier: 'legendary' }) : P.generate({ blockHash: seed ? H('art' + seed) : '00'.repeat(32), petId: 'cross-sheet', blockHeight: 972700 });
  a.species = sp; a.eyes = 'classic'; a.shades = false; a.background = 'solid'; a.bgColor = '#ff00fe'; a.pattern = 'none'; delete a.bgV2;
  ['band', 'armor', 'cape', 'weapon', 'crown', 'hat', 'eyewear', 'held', 'neck', 'face'].forEach(k => { if (k in a) a[k] = 'none'; });
  if (sp === 'funtrump') { a.ftLook = 'suit'; a.tierIndex = 2; } if (sp === 'homer') a.tierIndex = 2; return a;
}
const keyed = a => Object.assign({}, a, { background: 'solid', bgColor: '#ff00fe', pattern: 'none' });
const onBg = a => Object.assign({}, a, { background: 'solid', bgColor: BG, pattern: 'none' });
const frames = (art, st) => R.framesWith(keyed(art), st, [], []);
const petFrames = p => R.petFramesRaw(Object.assign({}, p, { hatchBlock: 0, art: keyed(p.art) }), { pets: [], byId: {}, gear: [], items: [], tip: BLK }, { noHunger: true, noLooks: true });
const isKey = (d, j) => Math.abs(d[j * 4] - 255) < 3 && d[j * 4 + 1] < 3 && Math.abs(d[j * 4 + 2] - 254) < 3;
const badge = j => (j >> 5) < 5 && (j & 31) >= 26;
function stats(img) {
  const d = img.data, on = new Uint8Array(1024); let px = 0; for (let j = 0; j < 1024; j++) { if (isKey(d, j) || badge(j)) continue; on[j] = 1; px++; }
  const seen = new Uint8Array(1024), comps = [];
  for (let j = 0; j < 1024; j++) { if (!on[j] || seen[j]) continue; const s = [j]; let n = 0; seen[j] = 1; while (s.length) { const q = s.pop(); n++; const x = q & 31, y = q >> 5; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx > 31 || ny > 31) continue; const m = ny * 32 + nx; if (on[m] && !seen[m]) { seen[m] = 1; s.push(m); } } } comps.push(n); }
  comps.sort((a, b) => b - a); return { px, comps, on };
}
function diff(a, b, t) { t = t || 40; let n = 0; for (let j = 0; j < 1024; j++) { if (badge(j)) continue; const s = Math.abs(a.data[j * 4] - b.data[j * 4]) + Math.abs(a.data[j * 4 + 1] - b.data[j * 4 + 1]) + Math.abs(a.data[j * 4 + 2] - b.data[j * 4 + 2]); if (s > t) n++; } return n; }
const lum = (r, g, b) => 0.3 * r + 0.59 * g + 0.11 * b;
function fillContrast(img, on) {
  const d = img.data, h = {}; for (let j = 0; j < 1024; j++) { if (!on[j]) continue; const k = ((d[j * 4] >> 3) << 10) | ((d[j * 4 + 1] >> 3) << 5) | (d[j * 4 + 2] >> 3); h[k] = (h[k] || 0) + 1; }
  const top = Object.entries(h).sort((a, b) => b[1] - a[1]).map(([k]) => { k = +k; return [(k >> 10) << 3, ((k >> 5) & 31) << 3, (k & 31) << 3]; });
  const Ls = top.map(c => lum(...c)), fill = top.find(c => lum(...c) > 60) || top[0], dark = Math.min(...Ls);
  return { fillLum: fill ? Math.round(lum(...fill)) : 0, gap: fill ? Math.round(lum(...fill) - dark) : 0 };
}
function planFor(key, over, hex) { const p = V.hybridPlan(hex || H('plan:' + key), key, BLK); p.eyes = 'classic'; return Object.assign(p, over || {}); }
const hybArt = (plan, seed) => Object.assign(baseArt(plan.shape, seed), { species: plan.shape, hybrid: plan });
// PNG + tiles
function crc32(b) { let c, r = 0xffffffff; for (let n = 0; n < b.length; n++) { c = (r ^ b[n]) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; r = (r >>> 8) ^ c; } return (r ^ 0xffffffff) >>> 0; }
function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h); for (let y = 0; y < h; y++) Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]), c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
function dumpTiles(file, title, cols, tiles, rows) {
  fs.writeFileSync(file, JSON.stringify({ title, cols, rows: rows || null, tiles: tiles.map(t => ({ label: t.label || '', flag: t.flag || '', rgba: Buffer.from(Array.from(t.img.data)).toString('base64') })) }));
  // unlabelled grid, 2 px per pixel, red border = flagged
  const S = 2, T = 32 * S + 4, n = tiles.length, rws = Math.ceil(n / cols), W = cols * T, Hh = rws * T, out = new Uint8Array(W * Hh * 4);
  for (let i = 0; i < out.length; i += 4) { out[i] = 14; out[i + 1] = 16; out[i + 2] = 22; out[i + 3] = 255; }
  tiles.forEach((t, i) => { const ox = (i % cols) * T, oy = Math.floor(i / cols) * T;
    if (t.flag) for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) if (x < 2 || y < 2 || x >= T - 2 || y >= T - 2) { const o = ((oy + y) * W + ox + x) * 4; out[o] = 230; out[o + 1] = 40; out[o + 2] = 50; }
    for (let y = 0; y < 32 * S; y++) for (let x = 0; x < 32 * S; x++) { const j = ((y / S | 0) * 32 + (x / S | 0)) * 4, o = ((oy + 2 + y) * W + ox + 2 + x) * 4; out[o] = t.img.data[j]; out[o + 1] = t.img.data[j + 1]; out[o + 2] = t.img.data[j + 2]; } });
  fs.writeFileSync(file.replace(/\.json$/, '.png'), png(W, Hh, out));
}

/* ---------------- Dynast "Ancestor Channel" check ---------------- */
const DYN_PAIRS = [['kekamozard', 'bo'], ['kekamoto', 'rarepigeon']]; // 2 renders x 8 frames = all 4 ancestors at k0-3
const COMMON = [['kek', 'hyb:wizard:kek'], ['dodo', 'hyb:pepe:dodo'], ['peepo', 'hyb:kevin:peepo'], ['dodo', 'hyb:dodo:sarutobi'], ['dodo', 'hyb:dodo:doge'], ['kevin', 'hyb:snibby:kevin'], ['dodo', 'hyb:dodo:bobo'],
  ['doge', 'hyb:snibby:doge'], ['wizard', 'hyb:wizard:nakamoto'], ['pepe', 'hyb:wojak:pepe'], ['pepe', 'hyb:bobo:pepe'], ['mumu', 'hyb:mumu:bobo'], ['peepo', 'hyb:dodo:peepo']]; // most common live hybrids (snapshot 972901)
const kindOf = (sp, id) => ((V.HYBRID_PARTS[sp] || []).concat((V.HYBRID_PARTS_FIX || {})[sp] || []).find(d => d.id === id) || {}).kind;
function donorWith(S, test) { for (const c of ROOTS) { if (c === S) continue; const ds = (V._partsFor || V.partsFor)(S, c, BLK) || []; const d = ds.find(q => test(q.kind || kindOf(c, q.id), q.id)); if (d) return { sp: c, part: d.id, kind: d.kind || kindOf(c, d.id) }; } return null; }
function dynVariants(only) {
  const out = [];
  for (const S of ROOTS) { if (only && S !== only) continue; const col = S === 'pepe' ? 'wojak' : 'pepe', key = V.hybridKey(S, col);
    out.push({ body: S, name: 'pure ' + S, art: () => baseArt(S) });
    out.push({ body: S, name: S + ' body', art: () => hybArt(planFor(key, { shape: S, color: col, parts: [] })) });
    const de = donorWith(S, k => k === 'eyes'); if (de) out.push({ body: S, name: S + ' + ' + de.sp + ' ' + de.part, art: () => hybArt(planFor(V.hybridKey(S, de.sp), { shape: S, color: de.sp, parts: [{ sp: de.sp, part: de.part }] })) });
    const dt = donorWith(S, (k, id) => k === 'top' || /hat|hair|horn|ear|crest|hood/.test(id)); if (dt) out.push({ body: S, name: S + ' + ' + dt.sp + ' ' + dt.part, art: () => hybArt(planFor(V.hybridKey(S, dt.sp), { shape: S, color: dt.sp, parts: [{ sp: dt.sp, part: dt.part }] })) });
    out.push({ body: S, name: S + ' star eyes', art: () => { const a = hybArt(planFor(key, { shape: S, color: col, parts: [] })); a.hybrid.eyes = 'star'; a.eyes = 'star'; return a; } });
  }
  if (!only) COMMON.forEach(([S, key]) => out.push({ body: S, name: key.replace('hyb:', '') + ' as ' + S, art: () => hybArt(planFor(key, { shape: S }, H('common:' + key))) }));
  return out;
}
function dynCheck(log, base) {
  const fl = [], on = log.on, A = log.A, isOn = (x, y) => x >= 0 && y >= 0 && x < 32 && y < 32 && !!on[y * 32 + x];
  const by = {}; log.px.forEach(([x, y, r]) => (by[r] = by[r] || []).push([x, y]));
  const eyes = A.eyes || [], eyeSet = new Set(); eyes.forEach(e => e.px.forEach(q => eyeSet.add(q)));
  // anchor sanity
  let top = 99, bot = -1; for (let j = 0; j < 1024; j++) if (on[j] && !badge(j)) { top = Math.min(top, j >> 5); bot = Math.max(bot, j >> 5); }
  if (!eyes.length) fl.push('ANCHOR no eyes found');
  eyes.forEach((e, i) => { const off = e.px.filter(q => !on[q]).length; if (off) fl.push('ANCHOR eye' + i + ' ' + off + 'px off the silhouette');
    if (A.mouthTop != null && e.b >= A.mouthTop + 1) fl.push('ANCHOR eye' + i + ' below the mouth (eye b' + e.b + ' mouth ' + A.mouthTop + ')');
    if (e.cy > top + (bot - top) * 0.7) fl.push('ANCHOR eye' + i + ' in the lower body (y' + e.cy + ')'); });
  log.px.forEach(([x, y, r]) => { if (x >= 26 && y < 5) fl.push('BADGE ' + r + ' in the badge corner'); });
  const sprCount = (role, n) => (by[role] || []).length;
  if (log.anc === 'kekamozard') {
    (by.glow || []).forEach(([x, y]) => { if (!eyeSet.has(y * 32 + x)) fl.push('LASER glow off the eye at ' + x + ',' + y); });
    if (!(by.glow || []).length && eyes.length) fl.push('LASER no eye glow');
    (by.beam || []).concat(by.spark || []).forEach(([x, y]) => { if (isOn(x, y)) fl.push('LASER beam on the pet at ' + x + ',' + y); });
    if (log.k >= 1) eyes.forEach((e, i) => { const dirs = eyes.length === 2 ? [i === 0 ? -1 : 1] : A.face ? [A.face] : [-1, 1];
      dirs.forEach(dir => { let x = dir < 0 ? e.l - 1 : e.r + 1; while (x >= 0 && x <= 31 && isOn(x, e.cy)) x += dir; if (x < 0 || x > 31 || (x >= 26 && e.cy < 5)) return;
        if (!(by.beam || []).some(([bx, byy]) => bx === x && byy === e.cy)) fl.push('LASER eye' + i + ' has no beam leaving it (expected at ' + x + ',' + e.cy + ')'); }); });
  } else if (log.anc === 'kekamoto') {
    const sh = by.shades || [], air = by['shades-air'] || [];
    if (!sh.length && !air.length) fl.push('SHADES missing');
    air.forEach(([x, y]) => { if (isOn(x, y)) fl.push('SHADES airborne shades touch the pet at ' + x + ',' + y); });
    if (sh.length) { const set = new Set(sh.map(([x, y]) => y * 32 + x)), cov = eyes.reduce((n, e) => n + e.px.filter(q => set.has(q)).length, 0), tot = eyeSet.size;
      if (tot && cov / tot < 0.7) fl.push('SHADES cover ' + Math.round(100 * cov / tot) + '% of the eyes');
      const eT = Math.min(...eyes.map(e => e.t)), eB = Math.max(...eyes.map(e => e.b));
      sh.forEach(([x, y]) => { if (y < eT - 1 || y > eB + 1) fl.push('SHADES outside the eye band at ' + x + ',' + y); if (A.mouthTop != null && y >= A.mouthTop) fl.push('SHADES on the mouth at ' + x + ',' + y);
        let near = 0; for (let dx = -2; dx <= 2; dx++) if (isOn(x + dx, y)) near = 1; if (!near) fl.push('SHADES float off the face at ' + x + ',' + y); }); }
    (by.glint || []).forEach(([x, y]) => { if (isOn(x, y)) fl.push('SHADES glint on the pet at ' + x + ',' + y); });
  } else if (log.anc === 'rarepigeon') {
    const pg = by.pigeon || [], sit = by['pigeon-sit'] || [], fly = by['pigeon-air'] || [];
    if (log.k >= 2 && !pg.length && !sit.length) fl.push('PIGEON missing (landed)'); if (log.k < 2 && !fly.length) fl.push('PIGEON missing (flying)');
    const eT = eyes.length ? Math.min(...eyes.map(e => e.t)) : 99, eL = eyes.length ? Math.min(...eyes.map(e => e.l)) : 0, eR = eyes.length ? Math.max(...eyes.map(e => e.r)) : 31;
    if (pg.length) { pg.forEach(([x, y]) => { if (isOn(x, y)) fl.push('PIGEON perched bird on the pet at ' + x + ',' + y); });
      const feet = pg.filter(([x, y]) => isOn(x, y + 1)); if (!feet.length) fl.push('PIGEON not resting on the pet (floating)');
      const fx = pg.map(p => p[0]), cx = (Math.min(...fx) + Math.max(...fx)) / 2; if (cx < eL - 3 || cx > eR + 3) fl.push('PIGEON off the head (centre x' + cx + ', eyes ' + eL + '-' + eR + ')');
      if (feet.some(([x, y]) => y + 1 >= eT)) fl.push('PIGEON lands at/below the eyes'); }
    sit.forEach(([x, y]) => { if (isOn(x, y) && y >= eT - 1) fl.push('PIGEON sitting bird covers the eyes at ' + x + ',' + y); });
    fly.concat(by.heart || []).forEach(([x, y]) => { if (isOn(x, y)) fl.push('PIGEON flying bird/heart on the pet at ' + x + ',' + y); });
    if (log.perch) { const want = log.perch.sit ? 11 : [38, 18, 11][[7, 5, 4].indexOf(log.perch.w)]; const got = pg.length + sit.length; if (want && got < want) fl.push('PIGEON clipped (' + got + '/' + want + ' px)'); }
  } else if (log.anc === 'bo') {
    const b = by.ball || []; if (!b.length) fl.push('BALL missing');
    b.concat(by.speed || []).concat(by.spark || []).forEach(([x, y]) => { if (isOn(x, y)) fl.push('BALL ball/speed lines on the pet at ' + x + ',' + y); });
    if (log.ball) { const want = { '7x4': 21, '6x5': 18, '4x3': 8 }[log.ball.w + 'x' + log.ball.h]; if (want && b.length < want) fl.push('BALL clipped (' + b.length + '/' + want + ' px)'); }
  }
  return [...new Set(fl)];
}
function dynastRun(only, OUT) {
  V._setRareTiers(BLK); if (V._setHybridFix) V._setHybridFix(BLK);
  const vars = dynVariants(only), res = [], gridRows = [];
  for (const v of vars) for (let st = 1; st <= 5; st++) {
    const row = [];
    for (const pair of DYN_PAIRS) {
      let a; try { a = onBg(v.art()); } catch (e) { res.push({ v: v.name, st, flags: ['THROW art ' + e.message] }); continue; }
      a.rareTier = 'dynast'; a.dynast = pair; V._dynLog = [];
      let fr; try { fr = R.framesWith(a, st, [], []); } catch (e) { res.push({ v: v.name, st, flags: ['THROW render ' + e.message] }); V._dynLog = null; continue; }
      const logs = V._dynLog; V._dynLog = null;
      if (!fr || fr.length !== 8) res.push({ v: v.name, st, flags: ['FRAMES ' + (fr ? fr.length : 0) + ' frames, expected 8'] });
      for (let t = 0; t < 8; t++) { const lg = logs.find(l => l.t === t); const f = lg ? dynCheck(lg) : ['ANCHOR effect not painted (no anchor)'];
        res.push({ v: v.name, body: v.body, st, anc: pair[t < 4 ? 0 : 1], k: t % 4, flags: f }); row.push({ label: pair[t < 4 ? 0 : 1] + ' k' + (t % 4), img: fr[t], flag: f.length ? 1 : '' }); }
    }
    gridRows.push({ name: v.name + ' s' + st, body: v.body, st, tiles: row });
  }
  fs.writeFileSync(OUT + '/dynast-grid.json', JSON.stringify({ title: 'Dynast "Ancestor Channel": every body, stages 1-5 (cols: archmage lasers k0-3, Bo football k0-3, don shades k0-3, pigeon k0-3)',
    rows: gridRows.map(r => ({ name: r.name, body: r.body, st: r.st, tiles: r.tiles.map(t => ({ label: t.label, flag: t.flag, rgba: Buffer.from(Array.from(t.img.data)).toString('base64') })) })) }));
  dumpTiles(OUT + '/dynast-grid-raw.json', 'dynast grid (raw)', 16, [].concat(...gridRows.map(r => r.tiles)));
  return res;
}

/* ---------------- main ---------------- */
const FIX = process.argv.includes('--fix'); /* proposal mode: also turn on the hybrid-audit fix gate (ACTIVATE_HYBRID_FIX_BLOCK) */
const args = process.argv.slice(2).filter(a => a !== '--fix'), DYN = args[0] === '--dynast', NEW = DYN ? null : args[0];
if (!DYN && !NEW) { console.error('usage: node tools/cross-sheet.js <species> [outDir] [--fix] | --dynast [outDir]'); process.exit(2); }
const OUT = args[1] || path.join(ROOT, 'out', DYN ? 'dynast-check' : 'cross-' + NEW); fs.mkdirSync(OUT, { recursive: true });
let res = [];
if (NEW) {
  if (!ROOTS.includes(NEW)) { console.error('unknown species ' + NEW + ' (roots: ' + ROOTS.join(' ') + ')'); process.exit(2); }
  if (FIX && V._setHybridFix) V._setHybridFix(BLK);
  if (NEW === 'viking' && V._setViking) V._setViking(BLK); /* the Viking line's own gate (viking-1of1): his hybrids carry the audited art fixes from it */
  const STAGES = [1, 2, 3, 4, 5], base = {};
  for (const S of ROOTS) for (const st of STAGES) { const f = frames(baseArt(S), st)[0]; base[S + st] = { img: f, s: stats(f) }; }
  for (const S of ROOTS) { const tiles = { 1: [], 3: [], 5: [] };
    for (const st of [1, 3, 5]) tiles[st].push({ label: S + ' (pure) s' + st, img: base[S + st].img });
    for (const Cc of ROOTS) { if (Cc === S || (S !== NEW && Cc !== NEW)) continue; const key = V.hybridKey(S, Cc), allowed = V.partsFor(S, Cc, BLK);
      for (const st of STAGES) {
        const mk = parts => frames(hybArt(planFor(key, { shape: S, color: Cc, parts })), st);
        let frAll, frNone; const r = { shape: S, color: Cc, stage: st, flags: [] };
        try { frAll = mk(allowed.map(d => ({ sp: Cc, part: d.id }))); frNone = mk([]); } catch (e) { r.flags.push('THROW ' + e.message); res.push(r); continue; }
        const s0 = stats(frAll[0]); if (frAll.some(f => stats(f).px < 30)) r.flags.push('BLANK frame');
        const bc = base[S + st].s.comps.filter(n => n >= 2).length; if (s0.comps.filter(n => n >= 2).length > bc) r.flags.push('FLOATING extra piece(s) ' + JSON.stringify(s0.comps.slice(1)));
        const pct = Math.round(100 * diff(frNone[0], base[S + st].img) / Math.max(1, base[S + st].s.px)); if (pct < 15) r.flags.push('COLOUR donor barely visible (' + pct + '%)');
        const fc = fillContrast(frNone[0], stats(frNone[0]).on); if (fc.gap < 45) r.flags.push('LOW CONTRAST fill vs outline (' + fc.gap + ')'); if (fc.fillLum < 70) r.flags.push('DARK fill (' + fc.fillLum + ')');
        for (const d of allowed) { const fr = mk([{ sp: Cc, part: d.id }]), n = diff(fr[0], frNone[0]); if (n < 6) r.flags.push('PART ' + Cc + ':' + d.id + ' not visible (' + n + ' px)');
          if (stats(fr[0]).comps.filter(n => n >= 2).length > bc) r.flags.push('PART ' + Cc + ':' + d.id + ' floats'); }
        if (!allowed.length) r.flags.push('NO PART from ' + Cc + ' on ' + S);
        const ap = Math.round(100 * diff(frAll[0], base[S + st].img) / Math.max(1, base[S + st].s.px)); if (ap < 12) r.flags.push('LOOKS LIKE PURE ' + S + ' (' + ap + '%)');
        res.push(r); if (tiles[st]) tiles[st].push({ label: V.hybridName(key) + ' ' + Cc + '>' + S, img: frAll[0], flag: r.flags.filter(f => !/^NO PART|DARK/.test(f)).length ? 1 : '' });
      } }
    if (tiles[1].length > 1) for (const st of [1, 3, 5]) dumpTiles(`${OUT}/shape-${S}-s${st}.json`, `shape ${S} times every colour donor, stage ${st}`, 9, tiles[st]);
  }
  { const a = baseArt(NEW), t = [];
    for (const st of [1, 3, 5]) { const f0 = frames(a, st)[0], fb = frames(Object.assign({}, a, { boMark: 1 }), st)[0], fr = frames(Object.assign({}, a, { rpMark: 1 }), st)[0], db = diff(f0, fb, 20), dr = diff(f0, fr, 20);
      t.push({ label: NEW + ' s' + st, img: f0 }, { label: 'bo ' + db + 'px', img: fb, flag: db < 4 ? 1 : '' }, { label: 'rp ' + dr + 'px', img: fr, flag: dr < 4 ? 1 : '' }); if (db < 4) res.push({ shape: NEW, stage: st, flags: ['BO MARK weak'] }); if (dr < 4) res.push({ shape: NEW, stage: st, flags: ['RP MARK weak'] }); }
    const p = { id: 1, owner: 'o', art: keyed(a), species: NEW, stage: 3, tier: 2, stats: {}, children: [], parents: [1, 2] }, f0 = petFrames(p)[0];
    const Ls = Object.keys(V.PALETTE_SETS).map(s => ({ k: 'pal:' + s, m: { mutation: { kind: 'palette', set: s, hue: 120, seed: 1 } } })).concat([{ k: 'glitch', m: { mutation: { kind: 'glitch', hue: 1, seed: 7 } } }, { k: 'frost', m: { shows: 'frost' } }, { k: 'socks', m: { shows: 'socks' } }, { k: 'oddeyes', m: { shows: 'oddeyes', oddEye: { eye: 0, col: 0 } } }]);
    Ls.forEach(l => { const q = Object.assign({}, p, l.m), fr = petFrames(q), f = V.lookFx(fr, fr, q)[0], d = diff(f0, f, 30), bad = (/pal/.test(l.k) && d < stats(f0).px * 0.25) || (/frost|socks/.test(l.k) && d < 5) || (l.k === 'oddeyes' && d < 2);
      t.push({ label: l.k + ' ' + d + 'px', img: f, flag: bad ? 1 : '' }); if (bad) res.push({ shape: NEW, stage: 3, flags: [l.k + ' weak (' + d + 'px)'] }); });
    if (!(V.HYBRID_PARTS[NEW] || []).length && !((V.HYBRID_PARTS_FIX || {})[NEW] || []).length) res.push({ shape: NEW, stage: 0, flags: ['NO HYBRID_PARTS entry: ' + NEW + ' never donates a part'] });
    dumpTiles(OUT + '/looks-' + NEW + '.json', NEW + ': Bo/RP marks, mutations, hidden traits', 12, t); }
}
const dres = dynastRun(NEW, OUT).map(r => Object.assign(r, { dyn: 1 }));
res = res.concat(dres);
const cnt = {}; res.forEach(r => r.flags.forEach(f => { const k = f.split(' ').slice(0, 3).join(' ').replace(/[\d,]+$/, '').trim(); cnt[k] = (cnt[k] || 0) + 1; }));
const HARD = /BLANK|THROW|FLOATING|floats|not visible|NO PART|NO HYBRID_PARTS|LOOKS LIKE PURE|weak|^ANCHOR|^LASER|^SHADES|^PIGEON|^BALL|^BADGE|^FRAMES/;
const hard = res.filter(r => r.flags.some(f => HARD.test(f) && !(r.dyn ? 0 : /^NO PART/.test(f) && NEW !== r.color && NEW !== r.shape)));
fs.writeFileSync(OUT + '/flags.txt', hard.map(r => (r.dyn ? '[dynast] ' + r.v + ' s' + r.st + ' ' + r.anc + ' k' + r.k : (r.color || '') + '>' + r.shape + ' s' + r.stage) + ': ' + r.flags.join(' | ')).join('\n') + '\n');
console.log(res.length + ' checks (' + dres.length + ' Dynast frames on ' + new Set(dres.map(r => r.v)).size + ' bodies/variants)');
console.log(JSON.stringify(cnt, null, 1));
console.log('hard flags: ' + hard.length + ' -> ' + OUT + '/flags.txt');
process.exitCode = hard.length ? 1 : 0;
