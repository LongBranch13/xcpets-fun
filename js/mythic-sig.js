/* MYTHIC SIGNATURES (branch funtrump-shine-1102, owner Nov 2 2026 [pt2692u]; deployed Nov 2 2026 after owner OK 10:52 PM CT). Display only: no rule, stat or replay change.
 * Every 1 of 1 / former community pet (and every Mythic FUNTRUMP / Nakamoto) gets its own 8-bit Mythic effect, drawn on the pet's own 32x32 frames:
 * the pet's pixels stay on top (effects live on the background, behind the pet), except the FUNTRUMP gold sweep which brightens the pet itself.
 * Never the fire aura, the grant flame crown or the edition gold frame. The electric outline (aura5) keeps drawing on top as today.
 * Switch: on by default; ?sig=off turns it off for that page view. */
(function (root) {
  var N = 32, NF = 8;
  function hex(h) { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
  function mix(a, b, t) { return [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)]; }
  function hsh(a, b) { var h = (a * 374761393 + b * 668265263) >>> 0; h = (h ^ (h >>> 13)) * 1274126177 >>> 0; return (h ^ (h >>> 16)) >>> 0; }
  function kind(p) { if (!p || p.stage !== 5 || p.dead || p.released) return null; var sp = String(p.species || ''), a = p.art || {}, h = a.hybrid || p.hybrid;
    if (sp === 'hyb3:nakamoto:wizard:kek') return 'kekamozard'; if (sp === 'hyb3:nakamoto:kek:funtrump' && p.supreme) return 'don';
    if (a.species === 'funtrump' || sp === 'funtrump' || (h && h.shape === 'funtrump')) return 'goldshine';
    if (sp === 'nakamoto' || a.species === 'nakamoto') return 'matrix';
    var K = { kek: 'kekglow', wizard: 'arcane', homer: 'donut', rabbit: 'clockwork', viking: 'frost', bojackson: 'bo', rarepigeon: 'feathers', starlordkek: 'cosmic', gooby: 'goo', lukespam: 'spam' };
    return K[sp] || K[a.species] || null; }
  /* masks from two keyed renders: pet = same pixel in both */
  function masks(A, B) { var pet = new Uint8Array(N * N), d1 = new Uint8Array(N * N), d2 = new Uint8Array(N * N), bb = { x0: N, x1: -1, y0: N, y1: -1 };
    for (var p = 0; p < N * N; p++) { var i = p * 4; if (A[i] === B[i] && A[i + 1] === B[i + 1] && A[i + 2] === B[i + 2]) { pet[p] = 1; var x = p & 31, y = p >> 5; bb.x0 = Math.min(bb.x0, x); bb.x1 = Math.max(bb.x1, x); bb.y0 = Math.min(bb.y0, y); bb.y1 = Math.max(bb.y1, y); } }
    var at = function (m, x, y) { return x >= 0 && y >= 0 && x < N && y < N && m[y * N + x]; };
    for (p = 0; p < N * N; p++) { if (pet[p]) continue; var x2 = p & 31, y2 = p >> 5; if (at(pet, x2 + 1, y2) || at(pet, x2 - 1, y2) || at(pet, x2, y2 + 1) || at(pet, x2, y2 - 1)) d1[p] = 1; }
    for (p = 0; p < N * N; p++) { if (pet[p] || d1[p]) continue; var x3 = p & 31, y3 = p >> 5; if (at(d1, x3 + 1, y3) || at(d1, x3 - 1, y3) || at(d1, x3, y3 + 1) || at(d1, x3, y3 - 1)) d2[p] = 1; }
    return { pet: pet, d1: d1, d2: d2, bb: bb }; }
  var FX = {};
  /* FUNTRUMP: gold that really shines. A bright diagonal shimmer band sweeps across him, a 4-point glint pops at the top corner, a warm gold glow pulses. */
  FX.goldshine = function (o, M, f) { var ph = (f / NF) * 52 - 10, gl = hex('#fff6c8'), gold = hex('#ffd23f'), deep = hex('#ffb300'), pulse = 0.45 + 0.25 * Math.sin(f / NF * 6.283);
    for (var p = 0; p < N * N; p++) { var x = p & 31, y = p >> 5, c = [o[p * 4], o[p * 4 + 1], o[p * 4 + 2]], d = (x + y) - ph, out = null;
      if (M.pet[p]) { var ad = Math.abs(d); if (ad < 1) out = mix(c, gl, 0.75); else if (ad < 2.5) out = mix(c, gl, 0.4); }
      else if (M.d1[p]) out = mix(c, gold, pulse); else if (M.d2[p]) out = mix(c, deep, pulse * 0.45);
      if (out) { o[p * 4] = out[0]; o[p * 4 + 1] = out[1]; o[p * 4 + 2] = out[2]; } }
    var gx = M.bb.x1 - 1, gy = M.bb.y0 + 1, s = f % 4 === 1 ? 2 : f % 4 === 2 ? 1 : 0; if (s) put(o, M, gx, gy, '#ffffff', true, s); if (f % 4 === 3) put(o, M, M.bb.x0 + 2, M.bb.y0 + 6, '#ffffff', true, 1); };
  /* Nakamoto: green 8-bit code rain falling behind him. */
  FX.matrix = function (o, M, f) { var head = hex('#d8ffd8'), g1 = hex('#39ff14'), g2 = hex('#13a83a');
    for (var x = 0; x < N; x++) { var sp = 1 + (hsh(x, 7) % 3), off = hsh(x, 3) % 40, len = 5 + hsh(x, 9) % 5, hy = ((f * sp * 5 + off) % 44) - 6;
      if (hsh(x, 11) % 3 === 0) continue;
      for (var y = 0; y < N; y++) { var p = y * N + x; if (M.pet[p]) continue; var k = hy - y; if (k < 0 || k > len) continue; if (k > 0 && hsh(x * 5 + y, f >> 1) % 4 === 0) continue; /* glyph gaps flicker */
        var c = [o[p * 4], o[p * 4 + 1], o[p * 4 + 2]], out = k === 0 ? head : mix(c, k < 2 ? g1 : g2, Math.max(0.25, 1 - k / (len + 1)));
        o[p * 4] = out[0]; o[p * 4 + 1] = out[1]; o[p * 4 + 2] = out[2]; } } };
  function put(o, M, x, y, col, star, s) { var c = hex(col), pts = [[0, 0]]; if (star) for (var i = 1; i <= (s || 1); i++) pts.push([i, 0], [-i, 0], [0, i], [0, -i]);
    pts.forEach(function (d) { var X = x + d[0], Y = y + d[1]; if (X < 0 || Y < 0 || X >= N || Y >= N || M.pet[Y * N + X]) return; var q = (Y * N + X) * 4; o[q] = c[0]; o[q + 1] = c[1]; o[q + 2] = c[2]; }); }
  function glow(o, M, col, a1, a2) { var c = hex(col); for (var p = 0; p < N * N; p++) { var t = M.d1[p] ? a1 : M.d2[p] ? a2 : 0; if (!t) continue; var m = mix([o[p * 4], o[p * 4 + 1], o[p * 4 + 2]], c, t); o[p * 4] = m[0]; o[p * 4 + 1] = m[1]; o[p * 4 + 2] = m[2]; } }
  function frog(o, M, x, y) { [[0, 0, '#3fbf3f'], [1, 0, '#3fbf3f'], [2, 0, '#3fbf3f'], [0, -1, '#ffffff'], [2, -1, '#ffffff'], [1, 1, '#2a8a2a']].forEach(function (d) { put(o, M, x + d[0], y + d[1], d[2]); }); }
  var pul = function (f, a, b) { return a + (b - a) * (0.5 + 0.5 * Math.sin(f / NF * 6.283)); };
  /* spots around the pet for sparkles: fixed per kind, in the open background */
  function spots(M, n, seed) { var out = [], tries = 0; while (out.length < n && tries++ < 400) { var x = 1 + hsh(seed, tries) % 29, y = 1 + hsh(tries, seed) % 27, p = y * N + x; if (M.pet[p] || M.d1[p]) continue; if (out.some(function (q) { return Math.abs(q[0] - x) + Math.abs(q[1] - y) < 6; })) continue; out.push([x, y]); } return out; }
  /* Lord Kek: green Kek glow + frog sparkles */
  FX.kekglow = function (o, M, f) { glow(o, M, '#5aff5a', pul(f, 0.35, 0.7), pul(f, 0.1, 0.3)); spots(M, 5, 41).forEach(function (s, i) { var ph = (f + i * 3) % NF; if (i % 2 === 0) { if (ph < 4) frog(o, M, s[0], s[1]); } else if (ph < 3) put(o, M, s[0], s[1], ph === 1 ? '#ffffff' : '#b6ff7a', true, ph === 1 ? 2 : 1); }); };
  /* Lord Kekamozard: the Kek glow + frog sparkles, plus wizard stars */
  FX.kekamozard = function (o, M, f) { FX.kekglow(o, M, f); orbit(o, M, f, ['#9b7bff', '#5ad6ff'], 2); };
  function orbit(o, M, f, cols, n) { var cx = (M.bb.x0 + M.bb.x1) / 2, cy = (M.bb.y0 + M.bb.y1) / 2, rx = (M.bb.x1 - M.bb.x0) / 2 + 2.5, ry = (M.bb.y1 - M.bb.y0) / 2 + 1.5;
    for (var i = 0; i < n; i++) { var a = f / NF * 6.283 + i * 6.283 / n, x = Math.round(cx + Math.cos(a) * rx), y = Math.round(cy + Math.sin(a) * ry); put(o, M, x, y, cols[i % cols.length], true, 1); put(o, M, x, y, '#ffffff'); } }
  /* Wizard: arcane violet glow, three orbiting stars */
  FX.arcane = function (o, M, f) { glow(o, M, '#9b7bff', pul(f, 0.3, 0.6), 0.15); orbit(o, M, f, ['#c8a8ff', '#5ad6ff', '#ffd23f'], 3); };
  /* Homer: a pink frosted donut ring with turning sprinkles, behind him */
  FX.donut = function (o, M, f) { var cx = (M.bb.x0 + M.bb.x1) / 2, cy = (M.bb.y0 + M.bb.y1) / 2, rx = (M.bb.x1 - M.bb.x0) / 2 + 2.6, ry = (M.bb.y1 - M.bb.y0) / 2 + 2.2, SPR = ['#ffffff', '#5ad6ff', '#ffd23f', '#7cff6b', '#ff5a5a'];
    for (var p = 0; p < N * N; p++) { if (M.pet[p]) continue; var x = p & 31, y = p >> 5, dx = (x - cx) / rx, dy = (y - cy) / ry, r = Math.sqrt(dx * dx + dy * dy), w = 1.6 / Math.min(rx, ry), col = null;
      if (Math.abs(r - 1) < w) { var a = Math.round((Math.atan2(dy, dx) + 3.1416) / 6.283 * 40); col = (a + f) % 5 === 0 ? SPR[(a >> 2) % SPR.length] : (r > 1 + w * 0.3 ? '#d9904a' : '#ff7eb6'); }
      else if (Math.abs(r - 1) < w * 1.7) col = '#b0703a';
      if (col) { var c = hex(col); o[p * 4] = c[0]; o[p * 4 + 1] = c[1]; o[p * 4 + 2] = c[2]; } } };
  /* The White Rabbit (PREVIEW, whiterabbit-community; no live White Rabbit can exist while V2Rules.ACTIVATE_RABBIT_BLOCK is null): a gold clock face behind him,
   * 12 tick marks, a hand sweeping once per loop (he is late), and a trail of breadcrumbs lighting up one by one along the ground, leading down the rabbit hole. */
  FX.clockwork = function (o, M, f) { var cx = (M.bb.x0 + M.bb.x1) / 2, cy = (M.bb.y0 + M.bb.y1) / 2, rx = (M.bb.x1 - M.bb.x0) / 2 + 2.6, ry = (M.bb.y1 - M.bb.y0) / 2 + 2.2, w = 1.3 / Math.min(rx, ry), ha = f / NF * 6.283 - 1.571, i;
    glow(o, M, '#fff1a8', pul(f, 0.25, 0.45), 0.1);
    for (var p = 0; p < N * N; p++) { if (M.pet[p]) continue; var x = p & 31, y = p >> 5, dx = (x - cx) / rx, dy = (y - cy) / ry, r = Math.sqrt(dx * dx + dy * dy), col = null;
      if (Math.abs(r - 1) < w) col = r > 1 ? '#c98a00' : '#ffd23f';
      else if (r < 1 - w) { var a = Math.atan2(dy, dx), da = Math.abs(((a - ha) % 6.283 + 9.425) % 6.283 - 3.1416); if (da < 0.09 && r > 0.25) col = '#fff6c2'; }
      if (col) { var c = hex(col); o[p * 4] = c[0]; o[p * 4 + 1] = c[1]; o[p * 4 + 2] = c[2]; } }
    for (i = 0; i < 12; i++) { var t = i * 0.5236, tx = Math.round(cx + Math.cos(t) * (rx + 1.6)), ty = Math.round(cy + Math.sin(t) * (ry + 1.6)); put(o, M, tx, ty, i % 3 === 0 ? '#ffffff' : '#fff1a8'); }
    for (i = 0; i < 7; i++) { var bx = 2 + i * 4, by = 30 - (i % 2); if (i <= f % NF) put(o, M, bx, by, i === f % NF ? '#ffffff' : '#ffd23f'); } };
  /* Ragnar the Viking: ice-blue frost glow, slow snowflakes */
  FX.frost = function (o, M, f) { glow(o, M, '#9fe8ff', pul(f, 0.35, 0.6), 0.2); for (var i = 0; i < 6; i++) { var x = 2 + hsh(i, 5) % 28, y = (hsh(i, 6) % 32 + f * 2) % 34 - 1; put(o, M, x, y, '#eafcff', i % 2 === 0, 1); } };
  /* Bo Jackson: speed lines streaking past and a baseball orbiting (Bo Knows) */
  FX.bo = function (o, M, f) { glow(o, M, '#ff8a1f', pul(f, 0.25, 0.5), 0.1); for (var i = 0; i < 5; i++) { var y = 3 + hsh(i, 2) % 26, x0 = 31 - ((f * 6 + hsh(i, 4)) % 44); for (var k = 0; k < 4; k++) put(o, M, x0 + k, y, k ? '#ffe0b0' : '#ffffff'); }
    var cx = (M.bb.x0 + M.bb.x1) / 2, cy = (M.bb.y0 + M.bb.y1) / 2, a = f / NF * 6.283, x = Math.round(cx + Math.cos(a) * ((M.bb.x1 - M.bb.x0) / 2 + 3)), y2 = Math.round(cy + Math.sin(a) * ((M.bb.y1 - M.bb.y0) / 2 + 2));
    put(o, M, x, y2, '#ffffff'); put(o, M, x + 1, y2, '#ffffff'); put(o, M, x, y2 + 1, '#ffffff'); put(o, M, x + 1, y2 + 1, '#d83a3a'); };
  /* Rarepigeon: neck-shimmer glow (purple / green) and feathers drifting down */
  FX.feathers = function (o, M, f) { glow(o, M, f % 2 ? '#b07bff' : '#6bffc8', 0.45, 0.15); for (var i = 0; i < 5; i++) { var x = 2 + hsh(i, 8) % 27 + (((f + i) % 4) < 2 ? 0 : 1), y = (hsh(i, 9) % 32 + f * 1.5 | 0) % 34 - 1; put(o, M, x, y, '#f4f4f4'); put(o, M, x + 1, y, '#b8b8c8'); } };
  /* Star-Lord Kek: a twinkling starfield with a magenta / cyan cosmic glow */
  FX.cosmic = function (o, M, f) { glow(o, M, f % 2 ? '#ff5ad6' : '#5ad6ff', pul(f, 0.35, 0.6), 0.15); spots(M, 9, 77).forEach(function (s, i) { var ph = (f + i) % 4; if (ph === 0) put(o, M, s[0], s[1], '#ffffff', true, 1); else if (ph === 1) put(o, M, s[0], s[1], '#ffe9a8'); }); };
  /* Gooby: blue goo glow with drips sliding down */
  FX.goo = function (o, M, f) { glow(o, M, '#4aa8ff', 0.55, 0.25); for (var i = 0; i < 4; i++) { var x = M.bb.x0 + 1 + hsh(i, 12) % Math.max(1, M.bb.x1 - M.bb.x0 - 1), y = M.bb.y0 + 4 + ((f * 2 + hsh(i, 13)) % 22); put(o, M, x, y, '#4aa8ff'); put(o, M, x, y + 1, '#2a6ad8'); } };
  /* Luke Spam Junior: little 8-bit envelopes (spam mail) floating up, pink glow */
  FX.spam = function (o, M, f) { glow(o, M, '#ff7eb6', pul(f, 0.3, 0.55), 0.12); for (var i = 0; i < 4; i++) { var x = 2 + hsh(i, 14) % 26, y = 31 - ((f * 2 + hsh(i, 15)) % 34); [[0, 0], [1, 0], [2, 0], [0, 1], [2, 1]].forEach(function (d) { put(o, M, x + d[0], y + d[1], '#ffffff'); }); put(o, M, x + 1, y + 1, '#ff5a8a'); } };
  /* Don Kekamoto (Top Holder): the FUNTRUMP gold shine plus gold coins raining */
  FX.don = function (o, M, f) { FX.goldshine(o, M, f); for (var i = 0; i < 4; i++) { var x = 2 + hsh(i, 16) % 27, y = (hsh(i, 17) % 32 + f * 3) % 35 - 2; put(o, M, x, y, '#ffd23f'); put(o, M, x + 1, y, '#ffb300'); put(o, M, x, y + 1, '#ffb300'); put(o, M, x + 1, y + 1, '#c48a00'); } };
  /* apply(frames, A, B, k): 8 frames with the effect (base frames repeat; their bob keeps its timing). A/B = the same frames on #ff00fe / #00ff01. */
  function apply(fr, A, B, k) { if (!FX[k] || !fr || !fr.length) return fr; var out = [];
    for (var f = 0; f < NF; f++) { var i = f % fr.length, src = fr[i].data, M = masks((A[i] || A[0]).data, (B[i] || B[0]).data), o = new Uint8ClampedArray(src.length); for (var q = 0; q < src.length; q++) o[q] = src[q];
      FX[k](o, M, f); out.push({ width: N, height: N, data: Array.prototype.slice.call(o) }); }
    return out; }
  var OFF = (function () { try { return /[?&]sig=off/.test(root.location.search || ''); } catch (e) { return false; } })();
  /* hook (preview): wrap V2Render.petFrames for Mythic signature pets; the keyed renders come from petFramesRaw like mythFx's */
  function hook() { var R = root.V2Render; if (!R || R._sig || OFF) return; R._sig = true; var base = R.petFrames, raw = R.petFramesRaw, cache = typeof WeakMap !== "undefined" ? new WeakMap() : new Map();
    R.petFrames = function (p, w, extra) { var fr = base(p, w, extra), k = kind(p); if (!k) return fr; var key = p.id + '|' + k + '|' + (fr && fr.length) + '|' + (p.art && p.art.bgColor);
      var hit = cache.get(fr); if (hit) return hit;
      try { var kf = function (bg) { return raw(Object.assign({}, p, { mutation: null, shows: null, art: Object.assign({}, p.art, { background: 'solid', bgColor: bg, pattern: 'none' }) }), w, Object.assign({}, extra || {}, { noHunger: true })); };
        var out = apply(fr, kf('#ff00fe'), kf('#00ff01'), k); if (R.mythFx) { var o2 = R.mythFx(out, function (bg) { var z = kf(bg); return out.map(function (_, i) { return z[i % z.length]; }); }); out = o2 || out; }
        cache.set(fr, out); return out; } catch (e) { return fr; } }; }
  root.MythSig = { kind: kind, apply: apply, masks: masks, FX: FX, NF: NF, hook: hook };
  if (root.V2Render) hook(); else if (root.addEventListener) root.addEventListener('DOMContentLoaded', hook);
})(typeof window !== 'undefined' ? window : this);
