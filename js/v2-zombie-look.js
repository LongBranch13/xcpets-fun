/* v2-zombie-look (cemetery loop, display only, owner Oct 29 2026 'needs to be way more zombie looking and dead looking').
 * One pure pixel pass that turns a pet's 32x32 frame into its risen-zombie version, shared by My Pets (js/v2-zombies.js) and the seance rise
 * (js/v2-cemetery-altar.js), so both show the same dead pet. 8-bit only: whole pixels, small fixed palette, nothing smoothed.
 * Redrawn Nov 23 2026 (owner: 'zombie sprites need work'; the old pass made every pet the same noisy olive blob): the pet stays itself, just dead.
 *  - its main skin colour (found round the eyes) turns rot-green, Pepe-green skins turn grey-teal; every pixel keeps its lightness, so the face reads
 *  - clothes, hair, wings and the Mythic rim keep their own colours, faded; whites go dingy; the dark outline stays crisp
 *  - eyes: dark sockets with a 2-3 px glowing green eye (red when feral); one eye stitched shut on some pets (by pet id). Community pets drawn
 *    from their own sprite files (Homer Pepe, Kek, FUNTRUMP...) keep their own eyes: yellowed whites, glowing pupils
 *  - a toothy jaw (one tooth missing) or a stitched-shut mouth, a short drool drip (blood when feral), one stitched scar, a bite out of an ear
 *  - no random speckle, rot patches, ribs, dirt, flies or stink lines any more (the old extras and head slouch only run when asked for)
 * The silhouette change (the bite) is applied to the keyed copies too, so the Mythic aura traces the zombie, not the old outline.
 * Nothing here touches rules, burns, replay or pet-core: it only edits pixels handed to it. */
(function () {
  'use strict';
  var RAMP = [[22, 27, 19], [40, 50, 34], [60, 72, 51], [82, 96, 68], [106, 118, 86], [134, 146, 106], [164, 172, 128], [188, 192, 152]];
  var C = { line: [12, 15, 10], hole: [5, 6, 5], rim: [30, 36, 26], pupil: [200, 255, 120], pupil2: [110, 214, 72], thread: [196, 186, 146], threadD: [120, 110, 84],
    eye: [222, 214, 150], eyeD: [178, 166, 104], seam: [44, 30, 34],
    gum: [70, 34, 42], gumD: [40, 18, 24], tooth: [226, 218, 186], toothD: [170, 160, 128], mouth: [16, 8, 8], bone: [230, 222, 192], boneD: [166, 156, 124], cav: [38, 16, 20],
    flesh: [128, 54, 48], fleshD: [84, 32, 30], rot: [52, 46, 34], rotD: [36, 32, 24], pus: [168, 180, 88], drool: [150, 210, 92], droolL: [214, 255, 150],
    blood: [140, 18, 22], bloodL: [214, 46, 40], fpupil: [255, 72, 52], fpupil2: [196, 28, 24],
    dirt: [[74, 54, 36], [94, 70, 48], [52, 37, 26], [112, 86, 58]], fly: [10, 10, 12], wing: [200, 210, 220], stink: [132, 156, 60], stinkL: [176, 196, 92] };
  function hsh(a, b, c) { var h = (a * 374761393 + b * 668265263 + (c | 0) * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; h ^= h >>> 16; return (h >>> 0) / 4294967296; }
  function lum(r, g, b) { return 0.3 * r + 0.59 * g + 0.11 * b; }
  function q8(v) { v = Math.max(0, Math.min(255, Math.round(v))); return v - (v & 7); }
  function rampAt(l) { var t = Math.max(0, Math.min(1, (l - 30) / 200)) * (RAMP.length - 1), i = Math.min(RAMP.length - 2, Math.floor(t)), f = t - i, a = RAMP[i], b = RAMP[i + 1];
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]; }
  /* L = { c: rgba body layer (Uint8ClampedArray 4096), m: 1 body / 2 drawn extra (not part of the silhouette) } */
  function put(L, x, y, col, kind) { if (x < 0 || y < 0 || x > 31 || y > 31) return; var q = y * 32 + x, j = q * 4; L.c[j] = col[0]; L.c[j + 1] = col[1]; L.c[j + 2] = col[2]; L.c[j + 3] = 255; if (kind || !L.m[q]) L.m[q] = kind || 2; }
  function on(L, x, y) { return x >= 0 && y >= 0 && x < 32 && y < 32 && L.m[y * 32 + x] === 1; }
  function inner(L, x, y) { return on(L, x, y) && on(L, x - 1, y) && on(L, x + 1, y) && on(L, x, y - 1) && on(L, x, y + 1); }
  function bbox(m) { var b = { x0: 32, y0: 32, x1: -1, y1: -1 }; for (var q = 0; q < 1024; q++) if (m[q] === 1) { var x = q & 31, y = q >> 5; if (x < b.x0) b.x0 = x; if (x > b.x1) b.x1 = x; if (y < b.y0) b.y0 = y; if (y > b.y1) b.y1 = y; } b.W = b.x1 - b.x0 + 1; b.H = b.y1 - b.y0 + 1; return b; }

  /* eyes: small isolated dark blobs inside the face (pupils / dot eyes, never the outline), alone or sitting in a light eye-white blob;
   * the best pair at about the same height wins. Falls back to a mirrored single eye, then to fixed spots. */
  function comps(L, b, test, lim) { var seen = new Uint8Array(1024), out = [];
    for (var q = 0; q < 1024; q++) { if (seen[q] || L.m[q] !== 1 || (q >> 5) > lim || !test(q)) continue; var st = [q], bx = { x0: 32, y0: 32, x1: -1, y1: -1, n: 0, edge: false }; seen[q] = 1;
      while (st.length) { var c = st.pop(), x = c & 31, y = c >> 5; bx.n++; if (x < bx.x0) bx.x0 = x; if (x > bx.x1) bx.x1 = x; if (y < bx.y0) bx.y0 = y; if (y > bx.y1) bx.y1 = y;
        for (var d = 0; d < 4; d++) { var nx = x + (d === 0 ? 1 : d === 1 ? -1 : 0), ny = y + (d === 2 ? 1 : d === 3 ? -1 : 0); if (nx < 0 || ny < 0 || nx > 31 || ny > 31) { bx.edge = true; continue; } var n = ny * 32 + nx;
          if (L.m[n] !== 1) { bx.edge = true; continue; } if (!seen[n] && test(n) && ny <= lim) { seen[n] = 1; st.push(n); } } }
      out.push(bx); } return out; }
  function eyes(src, L, b) { var lim = b.y0 + Math.round(b.H * 0.62), lm = function (q) { var j = q * 4; return lum(src[j], src[j + 1], src[j + 2]); };
    var dark = comps(L, b, function (q) { return lm(q) < 72; }, lim).filter(function (c) { return !c.edge && c.n <= 12 && c.x1 - c.x0 <= 4 && c.y1 - c.y0 <= 3 && c.y0 > b.y0; });
    var white = comps(L, b, function (q) { var j = q * 4, r = src[j], g = src[j + 1], bl = src[j + 2]; return lm(q) > 168 && Math.max(r, g, bl) - Math.min(r, g, bl) < 70; }, lim).filter(function (c) { return c.n >= 2 && c.n <= 36 && c.x1 - c.x0 <= 8 && c.y1 - c.y0 <= 5; });
    var cand = dark.map(function (d) { var e = { x0: d.x0, x1: d.x1, y0: d.y0, y1: d.y1, sc: 1 }; white.forEach(function (w) { var cx = (d.x0 + d.x1) / 2, cy = (d.y0 + d.y1) / 2;
        if (cx >= w.x0 - 1 && cx <= w.x1 + 1 && cy >= w.y0 - 1 && cy <= w.y1 + 1) { e.x0 = Math.min(e.x0, w.x0); e.x1 = Math.max(e.x1, w.x1); e.y0 = Math.min(e.y0, w.y0); e.y1 = Math.max(e.y1, w.y1); e.sc = 2; } }); return e; });
    var best = null, bs = -1; for (var i = 0; i < cand.length; i++) for (var k = i + 1; k < cand.length; k++) { var A = cand[i], B = cand[k], dy = Math.abs((A.y0 + A.y1) - (B.y0 + B.y1)) / 2, dx = Math.abs((A.x0 + A.x1) - (B.x0 + B.x1)) / 2;
      if (dy > 2.5 || dx < 3) continue; if (A.x1 >= B.x0 && B.x1 >= A.x0) continue; var sc = A.sc + B.sc - dy * 0.3 - ((A.y0 + B.y0) / 2 - b.y0) / b.H; if (sc > bs) { bs = sc; best = [A, B]; } }
    var out = best ? best.sort(function (a, c) { return a.x0 - c.x0; }) : cand.length ? [cand.sort(function (a, c) { return c.sc - a.sc; })[0]] : [];
    if (out.length === 1) { var e = out[0], cx = b.x0 + b.W / 2, w = e.x1 - e.x0, mid = (e.x0 + e.x1) / 2, nx0 = Math.round(2 * cx - mid - w / 2); /* side view or a lost eye: mirror it */
      if (Math.abs(mid - cx) > 3 && nx0 > b.x0 && nx0 + w < b.x1) { out.push({ x0: nx0, x1: nx0 + w, y0: e.y0, y1: e.y1, guess: true }); out.sort(function (a, c) { return a.x0 - c.x0; }); } }
    if (!out.length) { var ey = b.y0 + Math.round(b.H * 0.3), ew = Math.max(2, Math.round(b.W * 0.12)); [0.3, 0.62].forEach(function (f) { var ex = b.x0 + Math.round(b.W * f); out.push({ x0: ex, x1: ex + ew - 1, y0: ey, y1: ey + 1, guess: true }); }); }
    out.forEach(function (e) { if (e.x1 - e.x0 < 2) { var c = Math.round((e.x0 + e.x1) / 2); e.x0 = c - 1; e.x1 = c + 1; } if (e.y1 - e.y0 < 1) e.y1 = e.y0 + 1; }); return out; }

  /* colour helpers: the dead look keeps each pixel's lightness (so the face, outline and shading still read) and only moves its hue / saturation */
  function toHsl(r, g, b) { r /= 255; g /= 255; b /= 255; var mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, h = 0, s = 0, d = mx - mn;
    if (d > 0) { s = d / (1 - Math.abs(2 * l - 1) || 1); h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; if (h < 0) h += 360; } return [h, Math.min(1, s), l, d]; } /* d: chroma, so near-whites (high HSL saturation, tiny chroma) count as neutral */
  function fromHsl(h, s, l) { h = ((h % 360) + 360) % 360; l = Math.max(0, Math.min(1, l)); s = Math.max(0, Math.min(1, s)); var c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2, r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; } else if (h < 120) { r = x; g = c; } else if (h < 180) { g = c; b = x; } else if (h < 240) { g = x; b = c; } else if (h < 300) { r = x; b = c; } else { r = c; b = x; }
    return [q8((r + m) * 255 + 4), q8((g + m) * 255 + 4), q8((b + m) * 255 + 4)]; }
  function hueGap(a, b) { var d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; }
  function set(L, q, col) { var j = q * 4; L.c[j] = col[0]; L.c[j + 1] = col[1]; L.c[j + 2] = col[2]; }

  /* zombie-clean (owner Nov 23 2026 'zombie sprites need work': the old pass turned every pet into the same noisy olive blob).
   * Now: the pet stays itself, just dead. Its main skin colour turns rot-green (Pepe-green pets go a grey-teal so they still change), clothes, hair and
   * the Mythic rim keep their own colours but faded, whites go dingy, the outline stays crisp. On top, a few clean pixel-art marks only:
   * glowing eyes (green; red when feral) in dark sockets or in the pet's own eyes, a stitched or toothy mouth, one stitched scar, a bite out of an ear,
   * and a short drool drip. No random speckle, rot patches, ribs, dirt, flies or head shift any more. */
  function zombifyLayer(src, L, id, fi, nf, opt) {
    var b = bbox(L.m); if (b.x1 < 0) return null; var i, q, x, y, j, H = b.H, W = b.W, v = Math.abs(id | 0), side = v & 1 ? 1 : -1, F = !!opt.feral;
    var E = opt.eyes && opt.eyes.length ? opt.eyes.map(function (e) { return { x0: e.x0, x1: e.x1, y0: e.y0, y1: e.y1, cells: e.cells || null }; }) : eyes(src, L, b);
    var own = E.length && E.every(function (e) { return e.cells; }), eyeQ = {}; /* own: the sprite told us its real eye pixels (community pets) */
    if (own) E.forEach(function (e) { e.cells.E.concat(e.cells.P).forEach(function (c) { eyeQ[c] = 1; }); });
    /* 1. find the main skin colour: the commonest strong hue (head counts double), or "pale" when a pale neutral skin wins (Wojak, the White Rabbit) */
    var hist = new Float64Array(25), tot = 0;
    for (q = 0; q < 1024; q++) { if (L.m[q] !== 1 || eyeQ[q]) continue; j = q * 4; var s0 = toHsl(src[j], src[j + 1], src[j + 2]), wt = (q >> 5) < b.y0 + H * 0.6 ? 2 : 1; tot += wt;
      if (E.some(function (e) { var ex = q & 31, ey = q >> 5; return ex >= e.x0 - 3 && ex <= e.x1 + 3 && ey >= e.y0 - 2 && ey <= e.y1 + 3; })) wt *= 3; /* skin is what sits round the eyes (FUNTRUMP's hair is bigger than his face) */
      if (s0[2] < 0.16) continue; if (s0[1] > 0.2 && s0[3] >= 0.1) hist[Math.floor(s0[0] / 15) % 24] += wt; else if (s0[2] > 0.6 && (s0[1] <= 0.2 || s0[3] < 0.1)) hist[24] += wt; }
    var bi = -1, bv = 0; for (i = 0; i < 24; i++) { var sm = hist[i] + 0.6 * (hist[(i + 23) % 24] + hist[(i + 1) % 24]); if (sm > bv) { bv = sm; bi = i; } }
    var pale = hist[24] > bv, skinH = bi * 15 + 7.5, hs = 0, hc = 0, hn = 0, ss = 0, skinS = 0.5, green, TH, TS; /* the skin's real hue: circular mean of the strong pixels near the peak */
    if (!pale) { for (q = 0; q < 1024; q++) { if (L.m[q] !== 1 || eyeQ[q]) continue; j = q * 4; var s1 = toHsl(src[j], src[j + 1], src[j + 2]); if (s1[1] > 0.2 && s1[3] >= 0.1 && s1[2] >= 0.16 && hueGap(s1[0], skinH) <= 22) { var w1 = E.some(function (e) { var ex = q & 31, ey = q >> 5; return ex >= e.x0 - 3 && ex <= e.x1 + 3 && ey >= e.y0 - 2 && ey <= e.y1 + 3; }) ? 1 : 0.05; hs += w1 * Math.sin(s1[0] * Math.PI / 180); hc += w1 * Math.cos(s1[0] * Math.PI / 180); hn += w1; ss += w1 * s1[1]; } }
      if (hn) { skinH = Math.atan2(hs, hc) * 180 / Math.PI; if (skinH < 0) skinH += 360; skinS = ss / hn; } }
    green = !pale && skinH >= 70 && skinH <= 170; TH = green ? 168 : 96; TS = green ? 0.2 : 0.3;
    if (!pale && bv < tot * 0.08) skinH = -999; /* no clear skin: everything is treated as clothes (faded) */
    /* 2. recolour, keeping lightness */
    for (q = 0; q < 1024; q++) { if (L.m[q] !== 1) continue; j = q * 4; var r = src[j], g = src[j + 1], bl = src[j + 2], l = lum(r, g, bl); y = q >> 5;
      if (eyeQ[q]) continue;
      if (l < 42) { set(L, q, C.line); continue; }
      if (r > 140 && r - g > 60 && r - bl > 30 && y > b.y0 + H * 0.35 && y < b.y0 + H * 0.8 && skinH !== -999 && hueGap(toHsl(r, g, bl)[0], skinH) > 25) { set(L, q, l > 120 ? C.gum : C.gumD); continue; } /* lips, tongue: dead gum */
      var t = toHsl(r, g, bl), x = q & 31, rimPx = !on(L, x - 1, y) || !on(L, x + 1, y) || !on(L, x, y - 1) || !on(L, x, y + 1), /* the Mythic gold rim sits on the silhouette edge: never skin */
        isSkin = !rimPx && (pale ? ((t[1] <= 0.2 || t[3] < 0.1) && t[2] > 0.6) || (t[1] < 0.45 && t[2] > 0.55 && hueGap(t[0], 30) < 35) : (t[1] > 0.12 && t[3] >= 0.06 && hueGap(t[0], skinH) <= 16 && Math.abs(t[1] - skinS) < 0.24)); /* same hue AND about the same strength: FUNTRUMP's hair is his skin's hue, but duller */
      if (isSkin) { set(L, q, fromHsl(TH + (t[2] - 0.5) * 16, TS * (0.8 + 0.4 * Math.min(1, t[1] + 0.3)), 0.1 + t[2] * 0.8)); continue; }
      if (t[1] < 0.15 || t[3] < 0.08) { set(L, q, t[2] > 0.72 ? fromHsl(52, 0.2, t[2] * 0.86) : fromHsl(100, 0.08, t[2] * 0.9)); continue; } /* whites go dingy, greys go a touch green */
      set(L, q, fromHsl(t[0], t[1] * 0.5, 0.05 + t[2] * 0.82)); } /* clothes, hair, the Mythic rim: own colour, faded */
    /* 3. eyes */
    var ev = v % 3, glow = F ? C.fpupil : C.pupil, glow2 = F ? C.fpupil2 : C.pupil2, eb = 0;
    if (own) E.forEach(function (e) { eb = Math.max(eb, e.y1); var ey1 = -1; e.cells.E.forEach(function (c) { ey1 = Math.max(ey1, c >> 5); });
        e.cells.E.forEach(function (c) { var jj = c * 4; if (L.m[c] !== 1 || lum(src[jj], src[jj + 1], src[jj + 2]) < 150) return; set(L, c, (c >> 5) === ey1 ? C.eyeD : C.eye); });
        e.cells.P.forEach(function (c, n) { if (L.m[c] !== 1) return; set(L, c, n % 2 && fi % 2 ? glow2 : glow); }); });
    else E.forEach(function (e, n) { var x0 = e.x0, x1 = e.x1, y0 = e.y0, y1 = e.y1; eb = Math.max(eb, y1);
      for (y = y0 - 1; y <= y1 + 1; y++) for (x = x0 - 1; x <= x1 + 1; x++) { if (!on(L, x, y)) continue; var edge = x < x0 || x > x1 || y < y0 || y > y1; j = (y * 32 + x) * 4; if (edge) { if (L.c[j] + L.c[j + 1] > 60) put(L, x, y, C.rim, 1); } else put(L, x, y, C.hole, 1); }
      var mode = !F && E.length === 2 && ev === 1 && n === 1 ? 'x' : 'pupil', cx = Math.round((x0 + x1) / 2 + (n ? -0.3 : 0.3)), cy = Math.round((y0 + y1) / 2);
      if (mode === 'pupil') { put(L, cx, cy, glow, 1); if (x1 - x0 >= 2) put(L, cx + (n ? -1 : 1), cy, glow2, 1); if (y1 - y0 >= 2) put(L, cx, cy - 1, glow2, 1); } /* a 2-3 px glowing eye */
      else { var s = Math.min(x1 - x0, y1 - y0 + 1, 3); for (var tt = 0; tt <= s; tt++) { put(L, x0 + tt, y0 + tt, C.thread, 1); put(L, x0 + s - tt, y0 + tt, C.thread, 1); } } }); /* one eye stitched shut */
    /* 4. mouth (only where we placed the eyes ourselves; community pets keep their own mouth, gone to dead gum): teeth with one missing, or stitched shut */
    var ecx = E.length ? Math.round(E.reduce(function (a, e) { return a + (e.x0 + e.x1) / 2; }, 0) / E.length) : b.x0 + (W >> 1);
    var my = Math.min(b.y0 + Math.round(H * 0.74), Math.max(eb + 3, b.y0 + Math.round(H * 0.55))), mw = Math.max(4, Math.min(8, Math.round(W * 0.3))), mx0 = ecx - (mw >> 1), mx1 = mx0 + mw - 1;
    var stitched = v % 4 === 3, miss = mx0 + 1 + (v % Math.max(1, mw - 2));
    if (!own) for (x = mx0; x <= mx1; x++) { if (!inner(L, x, my) || !on(L, x, my + 1)) continue;
      if (stitched) { put(L, x, my, C.mouth, 1); if ((x - mx0) % 2 === 1) { put(L, x, my - 1, C.thread, 1); put(L, x, my + 1, C.thread, 1); } }
      else { put(L, x, my, x === miss || x === mx0 || x === mx1 ? C.mouth : C.tooth, 1); put(L, x, my + 1, C.mouth, 1); } }
    /* drool (or blood when feral) from one mouth corner; its length moves with the frame */
    if (!own) { var dl = [2, 3, 3, 2][fi % 4] + (F ? 1 : 0), dx = side > 0 ? mx0 + 1 : mx1 - 1, dy0 = my + 2;
      for (i = 0; i < dl; i++) if (dy0 + i < 32) put(L, dx, dy0 + i, i === dl - 1 ? (F ? C.bloodL : C.droolL) : (F ? C.blood : C.drool), L.m[(dy0 + i) * 32 + dx] === 1 ? 1 : 2); }
    /* 5. one stitched scar on the head, away from the bite: a dark seam with 3 cross stitches */
    var hx = side > 0 ? b.x0 + Math.round(W * 0.3) : b.x0 + Math.round(W * 0.7), hy = b.y0 + Math.max(1, Math.round(H * 0.1)), clear = true;
    for (i = 0; i < 4; i++) if (!inner(L, hx, hy + i) || eyeQ[(hy + i) * 32 + hx]) clear = false;
    if (clear) for (i = 0; i < 4; i++) { put(L, hx, hy + i, C.seam, 1); if (i % 2 === 0) { if (inner(L, hx - 1, hy + i)) put(L, hx - 1, hy + i, C.thread, 1); if (inner(L, hx + 1, hy + i)) put(L, hx + 1, hy + i, C.thread, 1); } }
    /* 6. a bite out of the top on the bite side (an ear tip or the head), edged with outline so it stays crisp */
    var best = -1, bestY = 99; for (x = side > 0 ? b.x1 : b.x0; side > 0 ? x >= b.x0 + W * 0.55 : x <= b.x0 + W * 0.45; x -= side) { for (y = b.y0; y <= b.y1; y++) if (on(L, x, y)) { if (y < bestY) { bestY = y; best = x; } break; } }
    var cut = []; if (best >= 0) [[0, 0], [side, 0], [0, 1], [-side, 0]].forEach(function (d) { cut.push([best + d[0], bestY + d[1]]); });
    cut.forEach(function (p2) { if (on(L, p2[0], p2[1])) { var q2 = p2[1] * 32 + p2[0]; L.m[q2] = 0; L.c[q2 * 4 + 3] = 0; } });
    cut.forEach(function (p2) { [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) { var nx = p2[0] + d[0], ny = p2[1] + d[1]; if (on(L, nx, ny)) put(L, nx, ny, C.line, 1); }); });
    if (best >= 0 && on(L, best, bestY + 2)) put(L, best, bestY + 2, C.flesh, 1);
    return { b: b, my: my, E: E };
  }
  /* slouch: the head rows (top 40%) lean 1 px to the bite side; done on colour and mask together */
  function slouch(L, b, side) { var cutY = b.y0 + Math.round(b.H * 0.4), y, x, c2 = new Uint8ClampedArray(L.c), m2 = new Uint8Array(L.m);
    for (y = b.y0; y < cutY; y++) for (x = 0; x < 32; x++) { var sx = x - side, q = y * 32 + x; if (sx < 0 || sx > 31) { m2[q] = 0; c2[q * 4 + 3] = 0; continue; } var s = y * 32 + sx; m2[q] = L.m[s]; for (var k = 0; k < 4; k++) c2[q * 4 + k] = L.c[s * 4 + k]; }
    L.c = c2; L.m = m2; return cutY; }
  /* flies, stink waves and ground dirt: only on the full picture, never part of the silhouette */
  function extras(L, b, fi, nf, v, opt) { var i, a, x, y;
    for (i = 0; i < 2; i++) { a = (fi / Math.max(1, nf)) * Math.PI * 2 * (i ? -1 : 1) + i * 2.4 + v; x = Math.round(b.x0 + b.W / 2 + Math.cos(a) * (b.W / 2 + 1)); y = Math.round(Math.max(1, b.y0 - 2) + Math.sin(a) * 2 + (i ? 3 : 0));
      x = Math.max(1, Math.min(30, x)); y = Math.max(1, Math.min(30, y)); put(L, x, y, C.fly, 2); put(L, x + ((fi + i) % 2 ? 1 : -1), y - 1, C.wing, 2); }
    var sw = [0, 1, 1, 0, -1, -1];
    [b.x0 - 2, b.x1 + 2].forEach(function (sx, n) { if (sx < 0 || sx > 31) return; var base = b.y0 + Math.round(b.H * 0.25) - (fi % 3);
      for (var k = 0; k < 6; k++) { y = base + k; var xx = sx + sw[(k + fi + n * 3) % 6]; if (y < 0 || y > 31 || xx < 0 || xx > 31 || L.m[y * 32 + xx] === 1) continue; if ((k + n) % 4 === 3) continue; put(L, xx, y, k < 2 ? C.stinkL : C.stink, 2); } });
    if (opt && opt.ground !== false && b.y1 < 31) for (x = b.x0 + 1; x < b.x1; x++) if (hsh(x, b.y1, v + 12) < 0.55) put(L, x, b.y1 + 1, C.dirt[Math.floor(hsh(x, 0, v + 13) * 4)], 2); }

  /* frame: the full frame (any background); ka / kb: the same pet keyed on two solid colours (pixels equal in both = the pet).
   * Returns new { img, ka, kb } data arrays (the inputs are not changed). */
  /* the pet's real eye spots: the same star-eye render the gear anchors use (render only; pet-core untouched). null when it can't tell (hybrids, eyeless) */
  /* the pet's real eye pixels, read from the species sprite map the game draws (E / P cells), with the game's own stage scale,
   * centring, bob and left/right eye split (same maths as PetCore spriteBox + placeSprite; pet-core itself is untouched).
   * One socket per eye cluster, at most 4x3, centred on the cluster. null for hybrids, eggs or species without eye cells. */
  var SCALE = [0, 0.62, 0.78, 0.9, 1, 1], BOB = [0, -1, -1, 0];
  function gameEyes(art, stage, fi) { var own = spriteEyes(art, stage, fi); if (own) return own; try { var P = window.PetCore; if (!P || !art || art.hybrid || !P.SPECIES || !stage) return null;
      var sp = null; for (var i = 0; i < P.SPECIES.length; i++) if (P.SPECIES[i].id === art.species) sp = P.SPECIES[i]; if (!sp) return null;
      var st = Math.max(1, Math.min(5, stage | 0)), map = (sp.stageMaps && sp.stageMaps[st]) || sp.map; if (!map || !map.length) return null;
      var W = map[0].length, H = map.length, s = SCALE[st], w = Math.max(4, Math.round(W * s)), h = Math.max(4, Math.round(H * s)), x0 = 16 - Math.round(w / 2), y0 = 28 - h + BOB[(fi || 0) % 4];
      var sm = sp.small && sp.small[st] && sp.small[st].length === h && sp.small[st][0].length === w ? sp.small[st] : null, split = sp.eyeSplit != null ? x0 + Math.floor(sp.eyeSplit * w / W) : 16, S = [null, null];
      for (var dy = 0; dy < h; dy++) for (var dx = 0; dx < w; dx++) { var ch = sm ? (sm[dy] || '').charAt(dx) || '.' : map[Math.floor((dy + 0.5) * H / h)].charAt(Math.floor((dx + 0.5) * W / w));
        if (ch !== 'E' && ch !== 'P') continue; var x = x0 + dx, y = y0 + dy, k = x < split ? 0 : 1, e = S[k] || (S[k] = { x0: 32, x1: -1, y0: 32, y1: -1 });
        e.x0 = Math.min(e.x0, x); e.x1 = Math.max(e.x1, x); e.y0 = Math.min(e.y0, y); e.y1 = Math.max(e.y1, y); }
      S = S.filter(Boolean); if (!S.length) return null;
      return S.map(function (e) { var cx = (e.x0 + e.x1) / 2, cy = (e.y0 + e.y1) / 2, ww = Math.max(2, Math.min(4, e.x1 - e.x0 + 1)), hh = Math.max(2, Math.min(3, e.y1 - e.y0 + 1)), a = Math.round(cx - (ww - 1) / 2), c = Math.round(cy - (hh - 1) / 2);
        return { x0: a, x1: a + ww - 1, y0: c, y1: c + hh - 1 }; }); } catch (e) { return null; } }
  /* community pets (Homer Pepe, Kek, FUNTRUMP, the Viking...) draw from their own sprite files, which mark eye whites 'E' and pupils 'P' on the same
   * 32x32 grid as the frame. Their eyes are kept as they are (dingy whites, glowing pupils) instead of guessed sockets. Two biggest eye clusters at most. */
  var OWN = { homer: 'HomerSprite', kek: 'KekSprite', funtrump: 'FuntrumpSprite', djpepe: 'DjPepeSprite', viking: 'VikingSprite', orangedragon: 'DragonSprite', rabbit: 'RabbitSprite', wizard: 'WizardSprite' };
  function spriteEyes(art, stage, fi) { try { var g = art && !art.hybrid && OWN[art.species] && window[OWN[art.species]]; if (!g || typeof g.draw !== 'function') return null;
      var m = g.draw(Math.max(0, Math.min(5, stage | 0)), (fi | 0) % 4, {}); if (!m || !m.length) return null; var seen = {}, cl = [];
      for (var y = 0; y < 32; y++) for (var x = 0; x < 32; x++) { var k = (m[y] || [])[x]; if ((k !== 'E' && k !== 'P') || seen[y * 32 + x]) continue; var st = [[x, y]], c = { E: [], P: [], x0: 32, x1: -1, y0: 32, y1: -1 }; seen[y * 32 + x] = 1;
        while (st.length) { var p = st.pop(), px = p[0], py = p[1], kk = m[py][px]; c[kk].push(py * 32 + px); c.x0 = Math.min(c.x0, px); c.x1 = Math.max(c.x1, px); c.y0 = Math.min(c.y0, py); c.y1 = Math.max(c.y1, py);
          for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) { var nx = px + dx, ny = py + dy, nk = nx >= 0 && ny >= 0 && nx < 32 && ny < 32 ? (m[ny] || [])[nx] : null; if ((nk === 'E' || nk === 'P') && !seen[ny * 32 + nx]) { seen[ny * 32 + nx] = 1; st.push([nx, ny]); } } }
        cl.push(c); }
      cl.sort(function (a, b) { return (b.E.length + b.P.length) - (a.E.length + a.P.length); }); var n0 = cl.length ? cl[0].E.length + cl[0].P.length : 0;
      cl = cl.slice(0, 2).filter(function (c) { return c.E.length + c.P.length >= Math.max(1, n0 / 3); }); if (!cl.length) return null;
      if (cl.length === 2 && Math.abs((cl[0].y0 + cl[0].y1) - (cl[1].y0 + cl[1].y1)) > 6) cl = [cl[0]];
      return cl.map(function (c) { if (!c.P.length) { c.P = c.E.filter(function (q) { return (q >> 5) === Math.round((c.y0 + c.y1) / 2) && Math.abs((q & 31) - (c.x0 + c.x1) / 2) < 1; }); c.E = c.E.filter(function (q) { return c.P.indexOf(q) < 0; }); }
        return { x0: c.x0, x1: c.x1, y0: c.y0, y1: c.y1, cells: { E: c.E, P: c.P } }; }); } catch (e) { return null; } }
  function starEyes(art, stage, fi) { try { var P = window.PetCore; if (!P || !art || art.hybrid || typeof P.render !== 'function') return null;
      var k = Object.assign({}, art, { background: 'solid', bgColor: '#ff00ff', pattern: 'none', eyes: 'star' }), o = { stage: stage, frame: fi || 0, gearOverride: {} }, out = null;
      for (var t = 0; t < 2 && !out; t++) { var d = P.render(k, t ? Object.assign({}, o, { openEyes: true }) : o).data, S = [null, null];
        for (var q = 0; q < 1024; q++) { var j = q * 4; if (d[j] === 255 && (d[j + 1] === 210 && d[j + 2] === 63 || d[j + 1] === 241 && d[j + 2] === 168)) { var x = q & 31, y = q >> 5, s = x < 16 ? 0 : 1, e = S[s] || (S[s] = { x0: 32, x1: -1, y0: 32, y1: -1 });
            e.x0 = Math.min(e.x0, x); e.x1 = Math.max(e.x1, x); e.y0 = Math.min(e.y0, y); e.y1 = Math.max(e.y1, y); } }
        S = S.filter(Boolean); if (S.length) out = S.map(function (e) { /* a socket is at most 4x3, centred on the star */ var cx = (e.x0 + e.x1) / 2, cy = (e.y0 + e.y1) / 2, w = Math.min(4, e.x1 - e.x0 + 1), h = Math.min(3, e.y1 - e.y0 + 1);
          var x0 = Math.round(cx - (w - 1) / 2), y0 = Math.round(cy - (h - 1) / 2); return { x0: x0, x1: x0 + w - 1, y0: y0, y1: y0 + h - 1 }; }); }
      return out; } catch (e) { return null; } }

  function frame(src, ka, kb, id, fi, nf, opt) { opt = opt || {}; var L = { c: new Uint8ClampedArray(4096), m: new Uint8Array(1024) }, q, j, k;
    for (q = 0; q < 1024; q++) { j = q * 4; if (ka[j] === kb[j] && ka[j + 1] === kb[j + 1] && ka[j + 2] === kb[j + 2] && (ka[j + 3] > 0)) { L.m[q] = 1; for (k = 0; k < 4; k++) L.c[j + k] = src[j + k]; } }
    var r = zombifyLayer(src, L, id, fi, nf, opt); if (!r) return null; var side = Math.abs(id | 0) & 1 ? 1 : -1;
    if (opt.slouch === true) slouch(L, r.b, side); var b = bbox(L.m); if (opt.extras === true) extras(L, b, fi, nf, Math.abs(id | 0), opt);
    var bgFill = function (out, kc) { for (q = 0; q < 1024; q++) { j = q * 4; if (kc) { out[j] = kc[j]; out[j + 1] = kc[j + 1]; out[j + 2] = kc[j + 2]; out[j + 3] = kc[j + 3]; } } };
    /* background under the old pet: the nearest pixel in the same row that was never pet (so a moved or bitten edge shows the tile, not a hole) */
    var img = new Uint8ClampedArray(src), orig = new Uint8Array(1024); for (q = 0; q < 1024; q++) { j = q * 4; orig[q] = ka[j] === kb[j] && ka[j + 1] === kb[j + 1] && ka[j + 2] === kb[j + 2] ? 1 : 0; }
    /* the warm 1 px rim some tiles draw around the pet: lifted off (filled like the background) and redrawn dull and patchy around the zombie's own outline */
    var rimN = 0; if (opt.rim === true) for /* zombie-clean 1123: off by default; the zombie keeps the pet's exact outline now, so the tile's own rim (Homer's ring) stays as drawn */ (q = 0; q < 1024; q++) { if (orig[q]) continue; j = q * 4; var rx = q & 31, ry = q >> 5, near = false;
      for (var oy = -1; oy <= 1 && !near; oy++) for (var ox = -1; ox <= 1; ox++) { var nx = rx + ox, ny = ry + oy; if (nx >= 0 && ny >= 0 && nx < 32 && ny < 32 && orig[ny * 32 + nx] === 1) { near = true; break; } }
      if (near && src[j] > 130 && src[j] - src[j + 2] > 50 && src[j + 1] > 70) { orig[q] = 3; rimN++; } }
    for (q = 0; q < 1024; q++) { if (!orig[q]) continue; var x = q & 31, y = q >> 5, s = -1; for (var d = 1; d < 32 && s < 0; d++) { if (x - d >= 0 && !orig[y * 32 + x - d]) s = y * 32 + x - d; else if (x + d < 32 && !orig[y * 32 + x + d]) s = y * 32 + x + d; }
      j = q * 4; if (s >= 0) { for (k = 0; k < 4; k++) img[j + k] = src[s * 4 + k]; } }
    if (rimN > 8) for (q = 0; q < 1024; q++) { if (L.m[q] === 1) continue; var ax = q & 31, ay = q >> 5, adj = false;
      for (var oy2 = -1; oy2 <= 1 && !adj; oy2++) for (var ox2 = -1; ox2 <= 1; ox2++) { var mx2 = ax + ox2, my2 = ay + oy2; if (mx2 >= 0 && my2 >= 0 && mx2 < 32 && my2 < 32 && L.m[my2 * 32 + mx2] === 1) { adj = true; break; } }
      if (!adj) continue; var rc = [92, 100, 60]; /* one clean dull rim (was patchy) */ j = q * 4; img[j] = rc[0]; img[j + 1] = rc[1]; img[j + 2] = rc[2]; img[j + 3] = 255; }
    var A = new Uint8ClampedArray(ka), B = new Uint8ClampedArray(kb), kA = ka.slice(0, 4), kB = kb.slice(0, 4);
    for (q = 0; q < 1024; q++) { j = q * 4; if (orig[q] === 1) { for (k = 0; k < 4; k++) { A[j + k] = kA[k]; B[j + k] = kB[k]; } } }
    for (q = 0; q < 1024; q++) { if (!L.m[q]) continue; j = q * 4; for (k = 0; k < 4; k++) img[j + k] = L.c[j + k]; if (L.m[q] === 1) for (k = 0; k < 4; k++) { A[j + k] = L.c[j + k]; B[j + k] = L.c[j + k]; } }
    void bgFill; return { img: img, ka: A, kb: B, box: b }; }
  /* one keyed (transparent background) canvas-sized RGBA, for the seance rise: same pass, transparent where not pet */
  function transparent(rgba, id, fi, nf, opt) { var ka = new Uint8ClampedArray(rgba), kb = new Uint8ClampedArray(rgba), q, j;
    for (q = 0; q < 1024; q++) { j = q * 4; if (rgba[j + 3] < 128) { ka[j] = 255; ka[j + 1] = 0; ka[j + 2] = 254; ka[j + 3] = 255; kb[j] = 0; kb[j + 1] = 255; kb[j + 2] = 1; kb[j + 3] = 255; } }
    var r = frame(ka, ka, kb, id, fi, nf, Object.assign({ ground: false }, opt || {})); if (!r) return null; var out = new Uint8ClampedArray(4096);
    for (q = 0; q < 1024; q++) { j = q * 4; var keyBg = r.img[j] === 255 && r.img[j + 1] === 0 && r.img[j + 2] === 254; if (keyBg) continue; out[j] = r.img[j]; out[j + 1] = r.img[j + 1]; out[j + 2] = r.img[j + 2]; out[j + 3] = 255; }
    return { data: out, box: r.box }; }
  /* no smug hand (owner Oct 29 2026 [pt2182u] 'Maybe we don't have the mythic smug hand on zombies'): pet-core draws the Mythic hand-to-chin pose from
   * each species' pose map at stage 5 (rjs/pet-core.js + js/pet-core.js, not edited). noHand(fn) runs fn with every species' pose map lifted off the
   * loaded PetCore copies and puts them back right after, so only renders made inside it (the zombie's frames and their keyed copies) lose the hand.
   * Real Mythics, replay and the rules never pass through here. Synchronous only; nested calls are safe. */
  var handDepth = 0, handSaved = null;
  function coresWithSpecies() { var out = []; try { [window.PetCore, window.GenPetCore].forEach(function (P) { if (P && P.SPECIES && out.indexOf(P) < 0) out.push(P); }); } catch (e) {} return out; }
  function noHand(fn, self, args) { if (handDepth++ === 0) { handSaved = []; coresWithSpecies().forEach(function (P) { (P.SPECIES || []).forEach(function (sp) {
          if (sp && sp.pose) { handSaved.push([sp, sp.pose]); sp.pose = null; } }); }); }
    try { return fn.apply(self, args || []); }
    finally { if (--handDepth === 0 && handSaved) { handSaved.forEach(function (e) { e[0].pose = e[1]; }); handSaved = null; } } }
  window.V2ZombieLook = { gameEyes: gameEyes, spriteEyes: spriteEyes, starEyes: starEyes, frame: frame, transparent: transparent, PAL: C, extras: extras, noHand: noHand };
})();
