/* MYTHIC SIGNATURES (branch funtrump-shine-1102, owner Nov 2 2026 [pt2692u]; deployed Nov 2 2026 after owner OK 10:52 PM CT). Display only: no rule, stat or replay change.
 * Every 1 of 1 / former community pet (and every Mythic FUNTRUMP / Nakamoto) gets its own 8-bit Mythic effect, drawn on the pet's own 32x32 frames:
 * the pet's pixels stay on top (effects live on the background, behind the pet), except the FUNTRUMP gold sweep which brightens the pet itself.
 * Never the fire aura, the grant flame crown or the edition gold frame. One aura per pet (owner Nov 27 2026: 'pets with special aura dont need 2 auras
 * overlapping'): a signature pet gets no electric outline (aura5) on top; its frames carry no Mythic outline info, so cards, papers and GIFs skip it too.
 * Switch: on by default; ?sig=off turns it off for that page view. */
(function (root) {
  var N = 32, NF = 8;
  function hex(h) { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
  function mix(a, b, t) { return [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)]; }
  function hsh(a, b) { var h = (a * 374761393 + b * 668265263) >>> 0; h = (h ^ (h >>> 13)) * 1274126177 >>> 0; return (h ^ (h >>> 16)) >>> 0; }
  function kind(p) { if (!p || p.stage !== 5 || p.dead || p.released) return null; var sp = String(p.species || ''), a = p.art || {}, h = a.hybrid || p.hybrid, rh = a.rareHatch;
    if (rh && rh.version === 1 && WEIRD.hasOwnProperty(rh.kind)) return WEIRD[rh.kind]; /* weird Mythics: their weirdness is the aura (wins over a species signature) */
    if (sp === 'hyb3:nakamoto:wizard:kek') return 'kekamozard'; if (sp === 'hyb3:nakamoto:kek:funtrump' && p.supreme) return 'don';
    if (a.species === 'funtrump' || sp === 'funtrump' || (h && h.shape === 'funtrump')) return 'goldshine';
    if (sp === 'nakamoto' || a.species === 'nakamoto') return 'matrix';
    var K = sigs(); /* species-registry: each species' sig in js/species-registry.js */
    return (K.hasOwnProperty(sp) && K[sp]) || (K.hasOwnProperty(a.species) && K[a.species]) || null; }
  var SIGS = null; function sigs() { return SIGS || (root.XcpSpecies ? (SIGS = root.XcpSpecies.map('sig')) : {}); }
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
  /* Groyper (PREVIEW, community pet #7; no live Groyper can exist while V2Rules.ACTIVATE_GROYPER_BLOCK is null): a comfy night pond. Two ripple rings
   * spread out from under him across the water one after the other, fireflies blink around him, and a soft lime glow breathes on his outline. */
  FX.pond = function (o, M, f) { var cx = (M.bb.x0 + M.bb.x1) / 2, wy = Math.min(30, M.bb.y1 + 1), i, p, x, y;
    glow(o, M, '#b6ff7a', pul(f, 0.2, 0.45), 0.1);
    for (p = 0; p < N * N; p++) { if (M.pet[p]) continue; x = p & 31; y = p >> 5; if (y < wy) continue; var c = hex(y === wy ? '#2f6f8f' : '#1f4f6a'); o[p * 4] = c[0]; o[p * 4 + 1] = c[1]; o[p * 4 + 2] = c[2]; } /* still pond water under him */
    [0, NF / 2].forEach(function (ph) { var t = ((f + ph) % NF) / NF, r = 3 + t * 15, col = t < 0.55 ? '#d8faff' : '#7fc8e0'; /* a ripple ring spreading out both ways */
      [-1, 1].forEach(function (sd) { for (var k = 0; k < 2; k++) { var X = Math.round(cx + sd * (r + k)), Y = wy + (k ? 1 : 0); put(o, M, X, Y, col); } }); });
    spots(M, 6, 93).forEach(function (s2, k) { var ph = (f + k * 3) % NF; if (s2[1] >= wy - 1) return; if (ph < 2) put(o, M, s2[0], s2[1], ph === 0 ? '#f4ff9a' : '#c8f060', ph === 0, 1); else if (ph < 4) put(o, M, s2[0], s2[1], '#8fc040'); }); /* fireflies */
    for (i = 0; i < 2; i++) { var lx = (i ? 26 : 1) + (((f >> 2) + i) % 2); put(o, M, lx, wy, '#3f9a3a'); put(o, M, lx + 1, wy, '#3f9a3a'); put(o, M, lx + 2, wy, '#2c6e2a'); } }; /* two little lily pads bobbing */
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
  /* WEIRD MYTHICS (owner Nov 28 2026: 'weird mythic pets need individual auras'). A weird hatch (Tiny, Giant, Two-headed, Inverted, Ghost, Backwards,
   * Wrong egg; js/v2-render.js rareHatchFrames) that reaches Mythic used to get no aura at all (Tiny, Giant, Two-headed, Backwards: skipped; Inverted,
   * Ghost: dropped when the shape was redrawn) or the plain electric one (Wrong egg). Each now has its own, drawn on the background around the
   * pet's real (reshaped) outline, so it never covers the pet: the masks come from the same weird render on two keyed backdrops. Giant and Two-headed
   * draw on their 64 px scene (and the 32 px thumbnail is rebuilt from it). Mythic gold + the weirdness's own colours. 8 frames, made once per pet. */
  var WEIRD = { tiny: 'wtiny', giant: 'wgiant', 'two-headed': 'wtwin', inverted: 'winvert', ghost: 'wghost', backwards: 'wrewind', 'wrong-egg': 'wegg' };
  /* masks for any size S: pet (same pixel on both backdrops), dist = steps from the pet (1..4, 0 = pet or far), bb */
  function masksN(A, B, S) { var n = S * S, pet = new Uint8Array(n), dist = new Uint8Array(n), bb = { x0: S, x1: -1, y0: S, y1: -1 }, p, x, y, q = [];
    for (p = 0; p < n; p++) { var i = p * 4; if (A[i] === B[i] && A[i + 1] === B[i + 1] && A[i + 2] === B[i + 2]) { pet[p] = 1; x = p % S; y = (p / S) | 0; if (x < bb.x0) bb.x0 = x; if (x > bb.x1) bb.x1 = x; if (y < bb.y0) bb.y0 = y; if (y > bb.y1) bb.y1 = y; q.push(p); } }
    for (var d = 1; d <= 4; d++) { var nx = []; q.forEach(function (p0) { var x0 = p0 % S, y0 = (p0 / S) | 0; [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (o) { var X = x0 + o[0], Y = y0 + o[1]; if (X < 0 || Y < 0 || X >= S || Y >= S) return; var r = Y * S + X; if (pet[r] || dist[r]) return; dist[r] = d; nx.push(r); }); }); q = nx; }
    return { S: S, pet: pet, dist: dist, bb: bb, cx: (bb.x0 + bb.x1) / 2, cy: (bb.y0 + bb.y1) / 2, hw: (bb.x1 - bb.x0) / 2, hh: (bb.y1 - bb.y0) / 2 }; }
  /* px: one background pixel (never the pet), a = blend 0..1 */
  function px(o, M, x, y, col, a) { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= M.S || y >= M.S) return; var p = y * M.S + x; if (M.pet[p]) return; var q = p * 4, c = typeof col === 'string' ? hex(col) : col; a = a == null ? 1 : a;
    o[q] = Math.round(o[q] + (c[0] - o[q]) * a); o[q + 1] = Math.round(o[q + 1] + (c[1] - o[q + 1]) * a); o[q + 2] = Math.round(o[q + 2] + (c[2] - o[q + 2]) * a); }
  function star(o, M, x, y, col, s) { px(o, M, x, y, '#ffffff'); for (var i = 1; i <= (s || 1); i++) { px(o, M, x + i, y, col); px(o, M, x - i, y, col); px(o, M, x, y + i, col); px(o, M, x, y - i, col); } }
  function halo(o, M, colOf, a1, a2, a3) { for (var p = 0; p < M.S * M.S; p++) { var d = M.dist[p], t = d === 1 ? a1 : d === 2 ? a2 : d === 3 ? (a3 || 0) : 0; if (!t) continue; var x = p % M.S, y = (p / M.S) | 0; px(o, M, x, y, colOf(x, y), t); } }
  function ring(o, M, rx, ry, col, a, step) { var n = Math.max(24, Math.round((rx + ry) * 3.2)); for (var i = 0; i < n; i++) { if (step && i % step) continue; var t = i / n * 6.283; px(o, M, M.cx + Math.cos(t) * rx, M.cy + Math.sin(t) * ry, col, a); } }
  /* open background spots (w x h free of the pet and its glow), fixed per seed */
  function spotsN(M, n, seed, w, h, top) { var out = [], tries = 0, S = M.S; w = w || 1; h = h || 1;
    while (out.length < n && tries++ < 600) { var x = 1 + hsh(seed, tries) % (S - w - 1), y = 1 + hsh(tries, seed) % (S - h - 1), ok = !(top && tries < 400 && y > M.cy); /* top: prefer above the middle */
      for (var yy = 0; yy < h && ok; yy++) for (var xx = 0; xx < w && ok; xx++) { var p = (y + yy) * S + x + xx; if (M.pet[p] || (M.dist[p] && M.dist[p] < 3) || (S === 32 && x + xx >= 26 && y + yy < 6)) ok = false; } /* never by the corner badge */
      if (!ok || out.some(function (q) { return Math.abs(q[0] - x) + Math.abs(q[1] - y) < S / 5; })) continue; out.push([x, y]); } return out; }
  function glyph(o, M, x, y, rows, cols) { rows.forEach(function (r, j) { for (var i = 0; i < r.length; i++) { var ch = r.charAt(i); if (cols[ch]) px(o, M, x + i, y + j, cols[ch]); } }); }
  var WFX = {};
  /* Tiny: SMOL BUT MIGHTY. Gold shrink-ray rings close in on the little guy, a gold glow, sparkles. */
  WFX.wtiny = function (o, M, f) { halo(o, M, function () { return '#ffd23f'; }, pul(f, 0.45, 0.8), pul(f, 0.15, 0.35));
    for (var k = 0; k < 2; k++) { var t = ((f / NF) + k / 2) % 1, g = 1 - t; ring(o, M, M.hw + 2.5 + g * 9, M.hh + 2 + g * 8, t > 0.7 ? '#fff6c8' : '#ffd23f', 0.35 + 0.6 * t, g > 0.6 ? 2 : 0); }
    spotsN(M, 4, 21).forEach(function (s, i) { var ph = (f + i * 2) % NF; if (ph < 2) star(o, M, s[0], s[1], '#ffe9a8', ph ? 0 : 1); }); };
  /* Giant: GROUND POUND. Every loop he stomps: the gold glow flares, a shockwave runs out along the ground, dust puffs and rocks fly. */
  WFX.wgiant = function (o, M, f) { var t = f / NF, gy = Math.min(M.S - 1, M.bb.y1 + 1), u = M.S / 32, i, k;
    halo(o, M, function () { return f < 2 ? '#fff1a8' : '#ffb300'; }, f < 2 ? 0.85 : pul(f, 0.35, 0.6), f < 2 ? 0.5 : 0.2, f < 2 ? 0.2 : 0);
    [-1, 1].forEach(function (sd) { var edge = sd < 0 ? M.bb.x0 : M.bb.x1, fx = edge + sd * (2 + t * 16 * u);
      for (k = 0; k < 4 * u; k++) { px(o, M, fx - sd * k, gy, k < u ? '#ffffff' : '#ffd23f', 1 - k / (5 * u)); px(o, M, fx - sd * k, gy - 1, '#ffd23f', 0.4 * (1 - k / (4 * u))); }
      for (i = 0; i < 3; i++) { var r = (1 + t * 3 + i * 0.6) * u * 0.8, px0 = edge + sd * (3 + i * 4) * u * 0.6, py0 = gy - 1 - t * 4 * u - i; /* dust puffs */
        for (var a = 0; a < 10; a++) { var an = a / 10 * 6.283; px(o, M, px0 + Math.cos(an) * r, py0 + Math.sin(an) * r * 0.7, '#efe2c4', 0.95 * (1 - t * 0.8)); } }
      var ry = gy - 2 - Math.round(Math.sin(t * 3.1416) * 8 * u), rx = edge + sd * (4 + t * 10) * u; /* a rock in the air */
      px(o, M, rx, ry, '#8a7a66'); px(o, M, rx + 1, ry, '#6a5a48'); px(o, M, rx, ry + 1, '#6a5a48'); }); };
  /* Two-headed: DOUBLE TROUBLE. One head glows magenta, the other cyan (they swap), and each head has its own spinning star. */
  WFX.wtwin = function (o, M, f) { var sw = f >= NF / 2, L = sw ? '#5ad6ff' : '#ff5ad6', R = sw ? '#ff5ad6' : '#5ad6ff';
    halo(o, M, function (x) { return x < M.cx ? L : R; }, pul(f, 0.5, 0.8), pul(f, 0.2, 0.4), 0.12);
    [[(M.bb.x0 + M.cx) / 2, -1], [(M.cx + M.bb.x1) / 2, 1]].forEach(function (h, i) { var a = f / NF * 6.283 * h[1] + i * 3.1416, r = Math.max(4, M.hw * 0.55);
      star(o, M, h[0] + Math.cos(a) * r, M.bb.y0 + 2 + Math.sin(a) * 3, i ? R : L, 1); }); };
  /* Inverted: UPSIDE-DOWN WORLD. The world around him turns to negative (a halo of inverted backdrop), an electric blue rim, and a VHS glitch line. */
  WFX.winvert = function (o, M, f) { var S = M.S, p, q;
    for (p = 0; p < S * S; p++) { var d = M.dist[p]; if (!d || d > (f % 4 === 2 ? 4 : 3)) continue; q = p * 4; o[q] = 255 - o[q]; o[q + 1] = 255 - o[q + 1]; o[q + 2] = 255 - o[q + 2]; }
    halo(o, M, function () { return '#3a6bff'; }, pul(f, 0.55, 0.85), 0, 0);
    if (f % 3 !== 1) { var y = M.bb.y0 + hsh(f, 5) % Math.max(1, M.bb.y1 - M.bb.y0), sh = 1 + f % 2, row = []; for (var x = 0; x < S; x++) { q = (y * S + x) * 4; row.push([o[q], o[q + 1], o[q + 2]]); }
      for (x = 0; x < S; x++) { var src = row[Math.min(S - 1, Math.max(0, x - sh))]; px(o, M, x, y, [Math.min(255, src[0] + 70), src[1], Math.min(255, src[2] + 70)], 0.8); } } };
  /* Ghost: BOO. A pale ectoplasm glow, wisps drifting up off him, and two little 8-bit ghosts bobbing around. */
  WFX.wghost = function (o, M, f) { var S = M.S, i;
    halo(o, M, function () { return '#b8fff0'; }, pul(f, 0.35, 0.6), pul(f, 0.12, 0.25), 0.06);
    for (i = 0; i < 7; i++) { var x = M.bb.x0 + hsh(i, 31) % Math.max(1, M.bb.x1 - M.bb.x0 + 1), life = ((f + hsh(i, 32) % NF) % NF) / NF, y = M.bb.y0 + 3 + (hsh(i, 33) % 6) - life * 10, sx = Math.sin(life * 6.283 + i) * 1.2;
      px(o, M, x + sx, y, '#e8fff8', 0.85 * (1 - life)); px(o, M, x + sx, y + 1, '#9fe8d8', 0.55 * (1 - life)); }
    var G = f % 2 ? ['.XX.', 'XoXo', 'XXXX', 'X.X.'] : ['.XX.', 'oXoX', 'XXXX', '.X.X'];
    spotsN(M, 2, 57, 4, 5).forEach(function (s, k) { var bob = Math.round(Math.sin((f + k * 4) / NF * 6.283)); if ((f + k * 3) % NF < 6) glyph(o, M, s[0], s[1] + bob, G, { X: '#effff9', o: '#1a2030' }); }); };
  /* Backwards: REWIND. Magenta and cyan after-images trail him like a moonwalk, and a blinking rewind sign. */
  WFX.wrewind = function (o, M, f) { var S = M.S, p, x, y, sh = 2 + (f % 2), cols = [['#ff5ad6', 0.6], ['#5ad6ff', 0.4], ['#ffd23f', 0.25]];
    halo(o, M, function () { return '#ffd23f'; }, pul(f, 0.3, 0.55), 0, 0);
    for (p = 0; p < S * S; p++) { if (M.pet[p] || M.dist[p] === 1) continue; x = p % S; y = (p / S) | 0;
      for (var k = 0; k < cols.length; k++) { var X = x - sh * (k + 1); if (X >= 0 && M.pet[y * S + X]) { px(o, M, x, y, cols[k][0], cols[k][1]); break; } } }
    if (f < NF / 2) { var sp = spotsN(M, 1, 88, 7, 3)[0]; if (sp) glyph(o, M, sp[0], sp[1], ['..X..X', '.XX.XX', '..X..X'], { X: f % 2 ? '#ffffff' : '#ffd23f' }); } };
  /* Wrong egg: NOT MY EGG. Cracked eggshell pieces orbit him and a gold question mark pops up. */
  WFX.wegg = function (o, M, f) { halo(o, M, function () { return '#ffd23f'; }, pul(f, 0.35, 0.65), pul(f, 0.1, 0.25), 0);
    for (var i = 0; i < 3; i++) { var a = f / NF * 6.283 + i * 2.094, x = M.cx + Math.cos(a) * (M.hw + 3), y = M.cy + Math.sin(a) * (M.hh * 0.75 + 2), up = i % 2;
      glyph(o, M, Math.round(x) - 1, Math.round(y) - 1, up ? ['X.X.', 'XsXX', '.XX.'] : ['.XX.', 'XXsX', '.X.X'], { X: '#fff3d6', s: '#c9a36b' }); }
    var q = spotsN(M, 1, 61, 3, 5, true)[0]; if (q && f % NF < 6) glyph(o, M, q[0], q[1] - (f % 2), ['XXX', '..X', '.XX', '...', '.X.'], { X: f % 4 < 2 ? '#ffd23f' : '#fff6c8' }); };
  /* applyW: 8 frames; a 64 px scene is drawn on its own pixels and its 32 px thumbnail rebuilt (same sampling as rareHatchFrames) */
  function applyW(fr, A, B, k) { if (!fr || !fr.length) return fr; var out = [], MS = {};
    for (var f = 0; f < NF; f++) { var i = f % fr.length, src = fr[i], a = A[i] || A[0], b = B[i] || B[0], sc = src.rareScene, big = !!(sc && a.rareScene && b.rareScene && sc.width === 64),
        S = big ? 64 : N, M = MS[i] || (MS[i] = masksN((big ? a.rareScene : a).data, (big ? b.rareScene : b).data, S)), d = (big ? sc : src).data, o = new Uint8ClampedArray(d.length);
      for (var q = 0; q < d.length; q++) o[q] = d[q];
      if (M.bb.x1 >= 0) WFX[k](o, M, f);
      if (!big) { out.push({ width: N, height: N, data: Array.prototype.slice.call(o) }); continue; }
      var th = new Array(N * N * 4); for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) for (var c = 0; c < 4; c++) th[(y * N + x) * 4 + c] = o[(y * 2 * 64 + x * 2) * 4 + c];
      out.push({ width: N, height: N, data: th, rareScene: { width: 64, height: 64, data: o, worldPixelScale: sc.worldPixelScale, primaryHead: sc.primaryHead } }); }
    return out; }
  /* apply(frames, A, B, k): 8 frames with the effect (base frames repeat; their bob keeps its timing). A/B = the same frames on #ff00fe / #00ff01. */
  function apply(fr, A, B, k) { if (WFX[k]) return applyW(fr, A, B, k); if (!FX[k] || !fr || !fr.length) return fr; var out = [];
    for (var f = 0; f < NF; f++) { var i = f % fr.length, src = fr[i].data, M = masks((A[i] || A[0]).data, (B[i] || B[0]).data), o = new Uint8ClampedArray(src.length); for (var q = 0; q < src.length; q++) o[q] = src[q];
      FX[k](o, M, f); out.push({ width: N, height: N, data: Array.prototype.slice.call(o) }); }
    return out; }
  var OFF = (function () { try { return /[?&]sig=off/.test(root.location.search || ''); } catch (e) { return false; } })();
  /* hook (preview): wrap V2Render.petFrames for Mythic signature pets; the keyed renders come from petFramesRaw like mythFx's */
  function hook() { var R = root.V2Render; if (!R || R._sig || OFF) return; R._sig = true; var base = R.petFrames, raw = R.petFramesRaw, cache = typeof WeakMap !== "undefined" ? new WeakMap() : new Map();
    R.petFrames = function (p, w, extra) { var fr = base(p, w, extra), k = kind(p); if (!k) return fr; var key = p.id + '|' + k + '|' + (fr && fr.length) + '|' + (p.art && p.art.bgColor);
      var hit = cache.get(fr); if (hit) return hit;
      try { var kfm = {}, kf = function (bg) { return kfm[bg] || (kfm[bg] = raw(Object.assign({}, p, { mutation: null, shows: null, art: Object.assign({}, p.art, { background: 'solid', bgColor: bg, pattern: 'none' }) }), w, Object.assign({}, extra || {}, { noHunger: true }))); }; /* each backdrop drawn once: apply and mythFx ask for the same two (a Mythic hybrid's drawing is ~0.4 s each) */
        var L = root.V2Looks, li = L && L.info ? L.info(fr[0]) : null, paid = !!(li && li.by && li.by.aura);
        /* one aura per pet (owner Nov 27 2026): the signature IS this pet's Mythic aura, no electric outline on top. A pet whose owner placed an aura
         * look (pet:aura, quest) shows that one instead. New frame objects drop the electric outline info, so the looks info (wings, skin, foil...) is
         * carried over by hand (before Nov 28 2026 it was dropped too: 79 Nakamoto / FUNTRUMP Mythics lost their earned Wings on cards). */
        var out = paid ? fr.map(function (f) { var g = { width: f.width || N, height: f.height || N, data: f.data }; if (f.rareScene) g.rareScene = f.rareScene; return g; }) : apply(fr, kf('#ff00fe'), kf('#00ff01'), k);
        if (L && L.carry) out.forEach(function (g, i) { L.carry(fr[i % fr.length], g); });
        cache.set(fr, out); return out; } catch (e) { return fr; } }; }
  root.MythSig = { kind: kind, apply: apply, masks: masks, FX: FX, WFX: WFX, WEIRD: WEIRD, NF: NF, hook: hook };
  if (root.V2Render) hook(); else if (root.addEventListener) root.addEventListener('DOMContentLoaded', hook);
})(typeof window !== 'undefined' ? window : this);
