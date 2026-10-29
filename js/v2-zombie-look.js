/* v2-zombie-look (PREVIEW ONLY, cemetery-v2-view, owner Oct 29 2026 'needs to be way more zombie looking and dead looking').
 * One pure pixel pass that turns a pet's 32x32 frame into its risen-zombie version, shared by My Pets (js/v2-zombies.js) and the seance rise
 * (js/v2-cemetery-altar.js), so both show the same dead pet. 8-bit only: whole pixels, small fixed palette, nothing smoothed.
 *  - rotting grey-green skin (desaturated, a hint of the species' own colour kept), mottled with darker decay patches and a few pustules
 *  - hollow black eye sockets: one tiny glowing pupil, and the other eye X'd out with thread, or an empty socket (picked by pet id)
 *  - lips and tongue go to dead gum; a crooked jaw with teeth (one missing) or a crooked stitched mouth (by pet id); green drool drips
 *  - exposed ribs (bone bars in a torn cavity) low on the body, or a bare skull patch when the body is too small
 *  - a bite torn out of the top (ear / head) and a ragged notch at a lower edge; a 1 px head slouch toward one side
 *  - two flies and stink waves that move frame to frame, grave dirt on the feet and a dirt smudge on the ground
 * The silhouette changes (bites, slouch) are applied to the keyed copies too, so the Mythic aura traces the zombie, not the old outline.
 * Nothing here touches rules, burns, replay or pet-core: it only edits pixels handed to it. */
(function () {
  'use strict';
  var RAMP = [[22, 27, 19], [40, 50, 34], [60, 72, 51], [82, 96, 68], [106, 118, 86], [134, 146, 106], [164, 172, 128], [188, 192, 152]];
  var C = { line: [12, 15, 10], hole: [5, 6, 5], rim: [30, 36, 26], pupil: [214, 255, 168], pupil2: [150, 214, 96], thread: [196, 186, 146], threadD: [120, 110, 84],
    gum: [70, 34, 42], gumD: [40, 18, 24], tooth: [226, 218, 186], toothD: [170, 160, 128], mouth: [16, 8, 8], bone: [230, 222, 192], boneD: [166, 156, 124], cav: [38, 16, 20],
    flesh: [128, 54, 48], fleshD: [84, 32, 30], rot: [52, 46, 34], rotD: [36, 32, 24], pus: [168, 180, 88], drool: [150, 210, 92], droolL: [214, 255, 150],
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

  function zombifyLayer(src, L, id, fi, nf, opt) {
    var b = bbox(L.m); if (b.x1 < 0) return null; var i, q, x, y, j, H = b.H, W = b.W, v = Math.abs(id | 0), side = v & 1 ? 1 : -1;
    var E = opt.eyes && opt.eyes.length ? opt.eyes.map(function (e) { return { x0: e.x0, x1: e.x1, y0: e.y0, y1: e.y1 }; }) : eyes(src, L, b);
    /* 1. skin: rot ramp by brightness, a little of the original colour kept so the species still reads; outlines go near black; lips/tongue go to dead gum */
    for (q = 0; q < 1024; q++) { if (L.m[q] !== 1) continue; j = q * 4; var r = src[j], g = src[j + 1], bl = src[j + 2], l = lum(r, g, bl); x = q & 31; y = q >> 5;
      if (l < 42) { L.c[j] = C.line[0]; L.c[j + 1] = C.line[1]; L.c[j + 2] = C.line[2]; continue; }
      var red = r > 140 && r - g > 60 && r - bl > 30;
      if (red && y > b.y0 + H * 0.35) { var gc = l > 120 ? C.gum : C.gumD; L.c[j] = gc[0]; L.c[j + 1] = gc[1]; L.c[j + 2] = gc[2]; continue; }
      var rp = rampAt(l * 1.02 + 8), k = 0.2; L.c[j] = q8(rp[0] * (1 - k) + r * k * 0.8); L.c[j + 1] = q8(rp[1] * (1 - k) + g * k * 0.8); L.c[j + 2] = q8(rp[2] * (1 - k) + bl * k * 0.7); }
    /* 2. decay patches (irregular blobs, fixed to the body so they don't swim when it bobs), speckle and pustules */
    var np = 3 + (v % 2);
    for (i = 0; i < np; i++) { var px0 = b.x0 + 2 + Math.floor(hsh(v, i, 11) * Math.max(1, W - 4)), py0 = b.y0 + 2 + Math.floor(hsh(v, i, 12) * Math.max(1, H - 4)), rr = 1.3 + hsh(v, i, 13) * 1.4;
      for (y = py0 - 3; y <= py0 + 3; y++) for (x = px0 - 3; x <= px0 + 3; x++) { if (!on(L, x, y)) continue; var dd = Math.sqrt((x - px0) * (x - px0) + (y - py0) * (y - py0)) + hsh(x - b.x0, y - b.y0, v) * 0.9;
        if (dd > rr) continue; j = (y * 32 + x) * 4; if (L.c[j] + L.c[j + 1] < 40) continue; var cc = dd < rr * 0.5 ? C.rotD : C.rot; L.c[j] = q8(L.c[j] * 0.35 + cc[0] * 0.65); L.c[j + 1] = q8(L.c[j + 1] * 0.35 + cc[1] * 0.65); L.c[j + 2] = q8(L.c[j + 2] * 0.35 + cc[2] * 0.65); } }
    for (q = 0; q < 1024; q++) { if (L.m[q] !== 1) continue; x = q & 31; y = q >> 5; var hv = hsh(x - b.x0, y - b.y0, v + 7); j = q * 4; if (L.c[j] + L.c[j + 1] < 40) continue;
      if (hv < 0.06) { L.c[j] = q8(L.c[j] * 0.72); L.c[j + 1] = q8(L.c[j + 1] * 0.7); L.c[j + 2] = q8(L.c[j + 2] * 0.74); } else if (hv > 0.985 && inner(L, x, y)) { L.c[j] = C.pus[0]; L.c[j + 1] = C.pus[1]; L.c[j + 2] = C.pus[2]; } }
    /* 3. eyes: hollow black sockets with a sunken rim; one tiny glowing pupil; the other X'd out with thread, or empty */
    var ev = v % 3, glow = fi % 2 ? C.pupil : C.pupil2, eb = 0;
    E.forEach(function (e, n) { var x0 = e.x0, x1 = e.x1, y0 = e.y0, y1 = e.y1; eb = Math.max(eb, y1);
      for (y = y0 - 1; y <= y1 + 1; y++) for (x = x0 - 1; x <= x1 + 1; x++) { if (!on(L, x, y)) continue; var edge = x < x0 || x > x1 || y < y0 || y > y1; j = (y * 32 + x) * 4; if (edge) { if (L.c[j] + L.c[j + 1] > 60) put(L, x, y, C.rim, 1); } else put(L, x, y, C.hole, 1); }
      var mode = E.length < 2 ? 'pupil' : ev === 0 ? 'pupil' : ev === 1 ? (n === 1 ? 'x' : 'pupil') : (n === 0 ? 'empty' : 'pupil');
      var cx = Math.round((x0 + x1) / 2 + (n ? -0.3 : 0.3)), cy = Math.round((y0 + y1) / 2 + (n ? 0 : 0.4));
      if (mode === 'pupil') { put(L, cx, cy, glow, 1); }
      else if (mode === 'x') { var s = Math.min(x1 - x0, y1 - y0 + 1, 3); for (var t = 0; t <= s; t++) { put(L, x0 + t, y0 + t, C.thread, 1); put(L, x0 + s - t, y0 + t, C.thread, 1); } }
      else { put(L, cx, y1 + 1, C.drool, 1); } /* empty socket: one wet pixel under it */ });
    /* 4. mouth: crooked jaw with teeth (one missing) or a crooked stitched slit; any old mouth below stays as dead gum */
    var ecx = E.length ? Math.round(E.reduce(function (a, e) { return a + (e.x0 + e.x1) / 2; }, 0) / E.length) : b.x0 + (W >> 1);
    var my = Math.min(b.y0 + Math.round(H * 0.74), Math.max(eb + 3, b.y0 + Math.round(H * 0.55))), mw = Math.max(4, Math.min(9, Math.round(W * 0.32))), mx0 = ecx - (mw >> 1), mx1 = mx0 + mw - 1, half = mx0 + (mw >> 1);
    var stitched = v % 4 === 3, miss = mx0 + 1 + (v % Math.max(1, mw - 2));
    for (x = mx0; x <= mx1; x++) { var yy = my + (x >= half ? 1 : 0); if (!on(L, x, yy) || !on(L, x, yy + 1)) continue;
      if (stitched) { put(L, x, yy, C.mouth, 1); if ((x - mx0) % 2 === 1) { put(L, x, yy - 1, C.thread, 1); put(L, x, yy + 1, C.threadD, 1); } }
      else { put(L, x, yy, x === miss ? C.mouth : ((x - mx0) % 2 ? C.toothD : C.tooth), 1); put(L, x, yy + 1, C.mouth, 1); if (on(L, x, yy + 2) && (x - mx0) % 3 === 0) put(L, x, yy + 2, C.toothD, 1); } }
    /* drool from the low corner (length moves with the frame) */
    var dl = [2, 3, 4, 3, 2, 4][fi % 6], dx = side > 0 ? mx0 : mx1, dy0 = my + 2 + (dx >= half ? 1 : 0);
    for (i = 0; i < dl; i++) put(L, dx, dy0 + i, i === dl - 1 ? C.droolL : C.drool, L.m[(dy0 + i) * 32 + dx] === 1 ? 1 : 2);
    /* 5. exposed ribs low on the body (opposite the drool), or a bare skull patch */
    var rh = 5, rw = Math.max(3, Math.min(5, Math.round(W * 0.2))), ry = Math.max(my + 4, b.y0 + Math.round(H * 0.7)), rx = side > 0 ? b.x1 - rw - Math.max(2, Math.round(W * 0.14)) : b.x0 + Math.max(2, Math.round(W * 0.14));
    if (ry + rh > b.y1) { ry = b.y1 - rh; } var ok = 0; for (y = ry; y < ry + rh; y++) for (x = rx; x < rx + rw; x++) if (inner(L, x, y)) ok++;
    if (ok >= rw * rh * 0.7 && ry > my + 2) { for (y = ry; y < ry + rh; y++) for (x = rx; x < rx + rw; x++) { if (!inner(L, x, y)) continue; var bar = (y - ry) % 2 === 0, endp = x === rx || x === rx + rw - 1;
        put(L, x, y, bar ? (endp ? C.boneD : C.bone) : C.cav, 1); }
      for (y = ry - 1; y <= ry + rh; y++) for (x = rx - 1; x <= rx + rw; x++) if ((y === ry - 1 || y === ry + rh || x === rx - 1 || x === rx + rw) && on(L, x, y) && hsh(x, y, v + 3) < 0.6) put(L, x, y, hsh(x, y, v + 4) < 0.5 ? C.flesh : C.fleshD, 1); }
    else { var sx = side > 0 ? b.x0 + Math.round(W * 0.22) : b.x1 - Math.round(W * 0.22) - 2, sy = b.y0 + Math.max(1, Math.round(H * 0.1)); /* bare skull */
      for (y = sy; y < sy + 2; y++) for (x = sx; x < sx + 3; x++) if (inner(L, x, y)) put(L, x, y, (x + y) % 3 ? C.bone : C.boneD, 1);
      [[-1, 0], [3, 0], [0, 2], [2, 2], [1, -1]].forEach(function (d) { if (on(L, sx + d[0], sy + d[1])) put(L, sx + d[0], sy + d[1], C.flesh, 1); }); }
    /* 6. a stitched scar across the head (the side away from the bite) */
    var hx = side > 0 ? b.x0 + Math.round(W * 0.3) : b.x0 + Math.round(W * 0.7), hy = b.y0 + Math.max(1, Math.round(H * 0.08));
    for (i = 0; i < 3; i++) { if (inner(L, hx, hy + i)) put(L, hx, hy + i, C.threadD, 1); if (i !== 1) { if (inner(L, hx - 1, hy + i)) put(L, hx - 1, hy + i, C.thread, 1); if (inner(L, hx + 1, hy + i)) put(L, hx + 1, hy + i, C.thread, 1); } }
    /* 7. grave dirt on the feet */
    for (q = 0; q < 1024; q++) { if (L.m[q] !== 1) continue; x = q & 31; y = q >> 5; if (y < b.y1 - 2) continue; var pr = y === b.y1 ? 0.75 : y === b.y1 - 1 ? 0.45 : 0.15; if (hsh(x, y - b.y1, v + 9) < pr) put(L, x, y, C.dirt[Math.floor(hsh(x, y, v + 10) * 4)], 1); }
    /* 8. torn: a bite out of the top on the bite side (an ear tip or the head), and a ragged notch at a lower edge */
    var best = -1, bestY = 99; for (x = side > 0 ? b.x1 : b.x0; side > 0 ? x >= b.x0 + W * 0.55 : x <= b.x0 + W * 0.45; x -= side) { for (y = b.y0; y <= b.y1; y++) if (on(L, x, y)) { if (y < bestY) { bestY = y; best = x; } break; } }
    var cut = []; if (best >= 0) [[0, 0], [side, 0], [0, 1], [side, 1], [-side, 0], [side * 2, 0], [side, 2]].forEach(function (d) { cut.push([best + d[0], bestY + d[1]]); });
    var ly = b.y0 + Math.round(H * 0.62), lx = -1; if (side > 0) { for (x = b.x0; x <= b.x1; x++) if (on(L, x, ly)) { lx = x; break; } } else { for (x = b.x1; x >= b.x0; x--) if (on(L, x, ly)) { lx = x; break; } }
    if (lx >= 0) [[0, 0], [0, 1], [side, 1], [0, 2], [0, -1]].forEach(function (d, n2) { if (n2 < 4 || v % 2) cut.push([lx + d[0], ly + d[1]]); });
    cut.forEach(function (p2) { if (on(L, p2[0], p2[1])) { var q2 = p2[1] * 32 + p2[0]; L.m[q2] = 0; L.c[q2 * 4 + 3] = 0; } });
    cut.forEach(function (p2) { [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) { var nx = p2[0] + d[0], ny = p2[1] + d[1]; if (on(L, nx, ny)) put(L, nx, ny, hsh(nx, ny, v + 5) < 0.45 ? C.flesh : C.line, 1); }); });
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
    if (opt.slouch !== false) slouch(L, r.b, side); var b = bbox(L.m); if (opt.extras !== false) extras(L, b, fi, nf, Math.abs(id | 0), opt);
    var bgFill = function (out, kc) { for (q = 0; q < 1024; q++) { j = q * 4; if (kc) { out[j] = kc[j]; out[j + 1] = kc[j + 1]; out[j + 2] = kc[j + 2]; out[j + 3] = kc[j + 3]; } } };
    /* background under the old pet: the nearest pixel in the same row that was never pet (so a moved or bitten edge shows the tile, not a hole) */
    var img = new Uint8ClampedArray(src), orig = new Uint8Array(1024); for (q = 0; q < 1024; q++) { j = q * 4; orig[q] = ka[j] === kb[j] && ka[j + 1] === kb[j + 1] && ka[j + 2] === kb[j + 2] ? 1 : 0; }
    /* the warm 1 px rim some tiles draw around the pet: lifted off (filled like the background) and redrawn dull and patchy around the zombie's own outline */
    var rimN = 0; if (opt.rim !== false) for (q = 0; q < 1024; q++) { if (orig[q]) continue; j = q * 4; var rx = q & 31, ry = q >> 5, near = false;
      for (var oy = -1; oy <= 1 && !near; oy++) for (var ox = -1; ox <= 1; ox++) { var nx = rx + ox, ny = ry + oy; if (nx >= 0 && ny >= 0 && nx < 32 && ny < 32 && orig[ny * 32 + nx] === 1) { near = true; break; } }
      if (near && src[j] > 130 && src[j] - src[j + 2] > 50 && src[j + 1] > 70) { orig[q] = 3; rimN++; } }
    for (q = 0; q < 1024; q++) { if (!orig[q]) continue; var x = q & 31, y = q >> 5, s = -1; for (var d = 1; d < 32 && s < 0; d++) { if (x - d >= 0 && !orig[y * 32 + x - d]) s = y * 32 + x - d; else if (x + d < 32 && !orig[y * 32 + x + d]) s = y * 32 + x + d; }
      j = q * 4; if (s >= 0) { for (k = 0; k < 4; k++) img[j + k] = src[s * 4 + k]; } }
    if (rimN > 8) for (q = 0; q < 1024; q++) { if (L.m[q] === 1) continue; var ax = q & 31, ay = q >> 5, adj = false;
      for (var oy2 = -1; oy2 <= 1 && !adj; oy2++) for (var ox2 = -1; ox2 <= 1; ox2++) { var mx2 = ax + ox2, my2 = ay + oy2; if (mx2 >= 0 && my2 >= 0 && mx2 < 32 && my2 < 32 && L.m[my2 * 32 + mx2] === 1) { adj = true; break; } }
      if (!adj) continue; var hr = hsh(ax, ay, 77), rc = hr < 0.15 ? null : hr < 0.6 ? [104, 102, 60] : [80, 80, 46]; if (!rc) continue; j = q * 4; img[j] = rc[0]; img[j + 1] = rc[1]; img[j + 2] = rc[2]; img[j + 3] = 255; }
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
  window.V2ZombieLook = { starEyes: starEyes, frame: frame, transparent: transparent, PAL: C, extras: extras, noHand: noHand };
})();
