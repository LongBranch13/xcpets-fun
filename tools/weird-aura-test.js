/* Weird Mythic auras (js/mythic-sig.js WFX, owner Nov 28 2026: 'weird mythic pets need individual auras').
 * Runs the real effects on made-up frames (no browser): every weird kind gets its own aura, never touches a pet pixel, keeps a Giant /
 * Two-headed 64 px scene, and wins over a species signature. Also the hook: looks (wings...) ride along to the new frames, and a pet
 * with a placed aura look shows that one, not a second one. node tools/weird-aura-test.js */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const ROOT = path.resolve(__dirname, '..');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('ok   ' + m); } else { fail++; console.log('FAIL ' + m); } };

function load(R, L) {
  const win = { location: { search: '' }, addEventListener() {}, V2Render: R, V2Looks: L };
  win.window = win; const c = vm.createContext(win);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/species-registry.js'), 'utf8'), c);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/mythic-sig.js'), 'utf8'), c);
  return c;
}
/* a frame of size S: a pet blob (box) on a backdrop colour */
function frame(S, bg, box) { const d = new Uint8ClampedArray(S * S * 4);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const i = (y * S + x) * 4, inP = x >= box[0] && x <= box[2] && y >= box[1] && y <= box[3];
    const c = inP ? [200, 120, 40] : bg; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255; }
  return d; }
function set(S, box, bgReal) { const real = frame(S, bgReal, box), A = frame(S, [255, 0, 254], box), B = frame(S, [0, 255, 1], box);
  if (S === 32) return { fr: [{ width: 32, height: 32, data: real }], A: [{ data: A }], B: [{ data: B }] };
  const th = d => { const t = new Uint8ClampedArray(4096); for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) for (let k = 0; k < 4; k++) t[(y * 32 + x) * 4 + k] = d[(y * 128 + x * 2) * 4 + k]; return t; };
  return { fr: [{ width: 32, height: 32, data: th(real), rareScene: { width: 64, height: 64, data: real, worldPixelScale: 1 } }], A: [{ data: th(A), rareScene: { width: 64, height: 64, data: A } }], B: [{ data: th(B), rareScene: { width: 64, height: 64, data: B } }] }; }

const c = load(null, null), S = c.MythSig;
ok(S && S.WFX && S.WEIRD, 'js/mythic-sig.js exports the weird auras');
const kinds = ['tiny', 'giant', 'two-headed', 'inverted', 'ghost', 'backwards', 'wrong-egg'];
const seen = new Set();
kinds.forEach(k => {
  const fx = S.WEIRD[k]; ok(fx && typeof S.WFX[fx] === 'function', k + ': has its own aura (' + fx + ')'); if (!fx) return;
  ok(!seen.has(fx), k + ': aura not shared with another kind'); seen.add(fx);
  const big = k === 'giant' || k === 'two-headed', N = big ? 64 : 32, box = big ? [14, 20, 50, 61] : [10, 9, 21, 26], s = set(N, box, [40, 50, 70]);
  const out = S.apply(s.fr, s.A, s.B, fx);
  ok(out.length === S.NF, k + ': ' + S.NF + ' animation frames');
  let petSame = true, changed = 0, sizeOk = true; const frames = new Set();
  out.forEach(f => { const sc = big ? f.rareScene : f; if (!sc || (sc.width || 32) !== N || sc.data.length !== N * N * 4 || f.data.length !== 4096) sizeOk = false;
    const d = sc ? sc.data : f.data, key = Array.from(d).join(','); frames.add(key);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const i = (y * N + x) * 4, inP = x >= box[0] && x <= box[2] && y >= box[1] && y <= box[3];
      if (inP && (d[i] !== 200 || d[i + 1] !== 120 || d[i + 2] !== 40)) petSame = false; if (!inP && (d[i] !== 40 || d[i + 1] !== 50 || d[i + 2] !== 70)) changed++; } });
  ok(sizeOk, k + ': frame sizes kept' + (big ? ' (64 px scene + 32 px thumbnail)' : ''));
  ok(petSame, k + ': never paints over the pet');
  ok(changed > out.length * 20, k + ': the aura shows around the pet (' + changed + ' px over ' + out.length + ' frames)');
  ok(frames.size >= 4, k + ': it moves (' + frames.size + ' different frames)');
});
/* kind(): weird Mythics only, and the weirdness wins over a species signature */
const pet = (sp, stage, rh) => ({ id: 1, species: sp, stage, art: { species: sp, rareHatch: rh } });
ok(S.kind(pet('pepe', 5, { version: 1, kind: 'ghost' })) === S.WEIRD.ghost, 'a Ghost Mythic gets the ghost aura');
ok(S.kind(pet('pepe', 4, { version: 1, kind: 'ghost' })) === null, 'a Ghost that is not Mythic yet gets none');
ok(S.kind(pet('nakamoto', 5, { version: 1, kind: 'tiny' })) === S.WEIRD.tiny, 'a Tiny Nakamoto Mythic gets the tiny aura, not a second one');
ok(S.kind(pet('nakamoto', 5, null)) === 'matrix', 'a plain Nakamoto keeps its own signature');
ok(S.kind(pet('pepe', 5, { version: 1, kind: 'kek' })) === null, 'a Legend hatch (not weird) is unchanged');

/* the hook: looks carried, a placed aura look wins */
const INFO = new WeakMap(), L = { info: f => INFO.get(f) || null, carry: (a, b) => { const i = INFO.get(a); if (i) INFO.set(b, i); return b; } };
const s32 = set(32, [10, 9, 21, 26], [40, 50, 70]);
function R(looks) { return { petFrames: () => { const fr = [{ width: 32, height: 32, data: s32.fr[0].data }]; if (looks) INFO.set(fr[0], { by: looks }); return fr; },
  petFramesRaw: (p) => p.art.bgColor === '#ff00fe' ? s32.A : s32.B }; }
const r1 = R({ back: 'wings' }), c1 = load(r1, L); c1.MythSig.hook();
const f1 = r1.petFrames(pet('pepe', 5, { version: 1, kind: 'inverted' }), {});
ok(f1.length === 8 && f1.every(f => L.info(f) && L.info(f).by.back === 'wings'), 'a weird Mythic keeps its Wings look on every aura frame');
const r2 = R({ aura: 'flame-aura' }), c2 = load(r2, L); c2.MythSig.hook();
const f2 = r2.petFrames(pet('pepe', 5, { version: 1, kind: 'inverted' }), {});
ok(f2.length === 1 && Array.from(f2[0].data).join() === Array.from(s32.fr[0].data).join() && L.info(f2[0]).by.aura === 'flame-aura', 'a placed aura look shows alone (no weird aura on top)');
const r3 = R({ back: 'wings' }), c3 = load(r3, L); c3.MythSig.hook();
const f3 = r3.petFrames(pet('nakamoto', 5, null), {});
ok(f3.length === 8 && f3.every(f => L.info(f) && L.info(f).by.back === 'wings'), 'a signature Mythic (Nakamoto) keeps its Wings look (was dropped before Nov 28 2026)');

/* plain frame tags (js/weird-looks.js f.wl / f.wlBox) ride along to the new frames */
const r4 = { petFrames: () => [{ width: 32, height: 32, data: s32.fr[0].data, wl: { kind: 'ghost' }, wlBox: [0.1, 0.2, 0.8, 0.9] }], petFramesRaw: (p) => p.art.bgColor === '#ff00fe' ? s32.A : s32.B }, c4 = load(r4, L); c4.MythSig.hook();
const f4 = r4.petFrames(pet('pepe', 5, { version: 1, kind: 'ghost' }), {});
ok(f4.length === 8 && f4.every(f => f.wl && f.wl.kind === 'ghost' && f.wlBox && f.wlBox[3] === 0.9 && f.data.length === 4096), 'frame tags (wl, wlBox) are kept on every aura frame');
console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
