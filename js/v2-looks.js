/* looks-draw REAL (2026-10-24, owner 7:05 PM CT: "we had real looking stuff planned for this"). DISPLAY ONLY: no rule change, no gate, replay SAME.
 * The pet sprite stays 32x32 pixel art; the 13 cosmetic looks are rendered as realistic high-res effects (device resolution, not 32x32)
 * on an overlay canvas laid over the sprite canvas: holo foils = iridescent foil + specular sweep + sparkle glints (shine follows the pointer /
 * phone tilt, slow idle sweep otherwise), crown / laurels / halo = metallic gold and light with specular highlights, holo wings = iridescent
 * shimmering wings, galaxy skin = nebula + star field masked to the pet's silhouette, auras = smooth glowing fire / electric / neon / spell
 * particles, aurora = aurora-borealis backdrop.
 * WHICH looks: exactly V2Rules.shownLooks(w, p): one look per type; looks placed with pet:aura first (highest Flame tier first), then quest
 * looks in earned order. LAYERS (bottom to top): background -> BACK (aurora / holo wings, only where the background shows, so behind the pet)
 * -> pet + gear (pixel) -> SKIN (galaxy) -> FOIL (rainbow / black / gold holo) -> AURA (flame / lightning / neon trail / spell sparkles) -> TOP
 * (laurels / halo / gold-foil crown). Galaxy and foil are separate types, so both can show (foil over galaxy).
 * One renderer (a per-pixel JS "shader") does both the live overlay and static bakes (t/<id>.png token images, Node), so they always match.
 * PERF: overlays render only while on screen (IntersectionObserver), at most MAX_LIVE animate at once (others keep their last frame), ~24 fps,
 * resolution capped (192 px on cards, 320 px on big canvases), particles capped at 24 per pet, paused when the tab is hidden,
 * prefers-reduced-motion = one still frame (no sweep, no particles moving). */
(function (root) {
  'use strict';
  var INFO = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function fract(x) { return x - Math.floor(x); }
  function hash(x, y) { var h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  function vnoise(x, y) { var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    var a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
  function fbm(x, y) { return 0.55 * vnoise(x, y) + 0.3 * vnoise(x * 2.1 + 5.2, y * 2.1 + 1.3) + 0.15 * vnoise(x * 4.3 + 9.1, y * 4.3 + 3.7); }
  /* iridescent palette (thin-film look): cos palette */
  function irid(t, o) { var p = 6.2832 * t; o[0] = 0.5 + 0.5 * Math.cos(p); o[1] = 0.5 + 0.5 * Math.cos(p - 2.1); o[2] = 0.5 + 0.5 * Math.cos(p - 4.2); return o; }
  var TYPES = ['back', 'galaxy', 'foil', 'aura', 'top'];
  function byType(looks) { var by = {}; (looks || []).forEach(function (L) { if (L && L.type && !by[L.type]) by[L.type] = L.id; }); return by; }
  /** info(fr, A, B, looks): silhouette masks from the two keyed renders (equal pixels = pet + gear) + geometry; one per frame. */
  function geom(a, b) { var m = new Uint8Array(1024), p, x, y; for (p = 0; p < 1024; p++) { var i = p * 4; if (a[i] === b[i] && a[i + 1] === b[i + 1] && a[i + 2] === b[i + 2]) m[p] = 1; }
    var x0 = 32, x1 = -1, y0 = 32, y1 = -1; for (p = 0; p < 1024; p++) if (m[p]) { x = p & 31; y = p >> 5; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) return null;
    var yh = y0; for (y = y0; y <= y1; y++) { var cn = 0; for (x = 0; x < 32; x++) cn += m[y * 32 + x]; if (cn >= 4) { yh = y; break; } }
    var r2 = Math.min(31, yh + 1), sx = 0, sn = 0, rx0 = 32, rx1 = -1; for (x = 0; x < 32; x++) if (m[r2 * 32 + x]) { sx += x; sn++; if (x < rx0) rx0 = x; if (x > rx1) rx1 = x; }
    /* signed distance on the 32 grid (pixel centres), brute force once per mask: outside > 0, inside < 0 */
    var edge = []; for (p = 0; p < 1024; p++) { x = p & 31; y = p >> 5; var e = 0; if (m[p]) { if (x === 0 || x === 31 || y === 0 || y === 31 || !m[p - 1] || !m[p + 1] || !m[p - 32] || !m[p + 32]) e = 1; } if (e) edge.push(x, y); }
    var sd = new Float32Array(34 * 34); for (y = -1; y < 33; y++) for (x = -1; x < 33; x++) { var best = 1e9; for (var k = 0; k < edge.length; k += 2) { var dx = edge[k] - x, dy = edge[k + 1] - y, dd = dx * dx + dy * dy; if (dd < best) best = dd; }
      var inn = x >= 0 && y >= 0 && x < 32 && y < 32 && m[y * 32 + x]; sd[(y + 1) * 34 + x + 1] = inn ? -Math.sqrt(best) - 0.5 : Math.sqrt(best) - 0.5; }
    var cnt = {}, top = null, tn = 0; for (p = 0; p < 1024; p++) if (m[p]) { var i2 = p * 4, L = 0.3 * a[i2] + 0.59 * a[i2 + 1] + 0.11 * a[i2 + 2]; if (L < 48) continue; var k2 = a[i2] + ',' + a[i2 + 1] + ',' + a[i2 + 2]; cnt[k2] = (cnt[k2] || 0) + 1; if (cnt[k2] > tn) { tn = cnt[k2]; top = [a[i2], a[i2 + 1], a[i2 + 2]]; } }
    return { m: m, sd: sd, x0: x0, x1: x1, y0: y0, y1: y1, yh: yh, cx: sn ? sx / sn : 16, hw: sn ? rx1 - rx0 + 1 : 8, cy: (y0 + y1) / 2, body: top || [128, 128, 128] }; }
  function attachInfo(fr, A, B, looks, seed) { if (!INFO || !looks || !looks.length) return fr; var by = byType(looks), key = TYPES.map(function (t) { return by[t] || ''; }).join('|');
    var gs = A.map(function (f, i) { return geom(f.data, (B[i] || B[0]).data); });
    fr.forEach(function (f, i) { var g = gs[i % gs.length]; if (g && f && typeof f === 'object') INFO.set(f, { by: by, key: key, g: g, seed: (seed | 0) % 997 }); });
    return fr; }
  function infoOf(img) { return INFO && img ? INFO.get(img) || null : null; }
  function sdAt(g, X, Y) { /* bilinear signed distance at sprite coords (pixel centre = i + 0.5) */ var x = clamp(X - 0.5, -1, 32), y = clamp(Y - 0.5, -1, 32), xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
    var i = (yi + 1) * 34 + xi + 1, s = g.sd; if (xi < -1 || yi < -1 || xi > 31 || yi > 31) return 9; var a = s[i], b = s[i + 1], c = s[i + 34], d = s[i + 35]; return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy; }
  var tmp = [0, 0, 0], tmp2 = [0, 0, 0];
  /** render(img32, info, S, t, ptr, out): full composite (pixel sprite, nearest, + effects) into out (S*S*4). ptr = [x,y] 0..1 or null. */
  function render(img, info, S, t, ptr, out) {
    var src = img.data, by = info.by, g = info.g, seed = info.seed, k = 32 / S, still = ptr === false;
    var shine = ptr ? ptr[0] * 1.3 - 0.15 + ptr[1] * 0.25 : fract(t * 0.07 + seed * 0.013) * 1.8 - 0.4; /* foil light position */
    var back = by.back, gal = by.galaxy, foil = by.foil, aura = by.aura, top = by.top, B = g.body;
    for (var py = 0; py < S; py++) { var Y = (py + 0.5) * k, iy = Y | 0, v = py / S;
      for (var px = 0; px < S; px++) { var X = (px + 0.5) * k, ix = X | 0, u = px / S, si = (iy * 32 + ix) * 4, o = (py * S + px) * 4;
        var r = src[si] / 255, gg = src[si + 1] / 255, b = src[si + 2] / 255, inside = g.m[iy * 32 + ix] === 1, d = 9;
        if (!inside || aura) d = sdAt(g, X, Y);
        if (!inside) {
          if (back === 'aurora') { /* aurora borealis: night sky + flowing curtains with vertical rays */
            r = r * 0.35 + 0.01; gg = gg * 0.35 + 0.03; b = b * 0.35 + 0.09; var ac = 0;
            for (var c = 0; c < 3; c++) { var yc = 5 + c * 4.5 + 2.6 * Math.sin(X * 0.21 + t * 0.5 + c * 1.7) + 1.2 * Math.sin(X * 0.53 - t * 0.8 + c); var dy = Y - yc;
              var ray = 0.55 + 0.45 * fbm(X * 0.9 + c * 7, t * 0.6 + c), curt = dy < 0 ? Math.exp(-dy * dy * 1.6) : Math.exp(-dy * 0.22) * (dy < 14 ? 1 : 0); var I = curt * ray * (0.9 - c * 0.18);
              r += I * (0.15 + 0.5 * Math.max(0, -dy) / 3 * (c === 2 ? 1 : 0.3)); gg += I * (0.95 - 0.25 * c); b += I * (0.45 + 0.2 * c); ac += I; }
            var st = hash(px, py + seed); if (st > 0.996 - ac * 0.003) { var tw = 0.5 + 0.5 * Math.sin(t * 3 + st * 50); r += tw * 0.7; gg += tw * 0.7; b += tw * 0.8; }
          } else if (back === 'holo-wings') { /* iridescent wings behind the body, flapping */
            var fl = still ? 0 : Math.sin(t * 3.2) * 0.18, wy = g.cy - 1;
            for (var s2 = -1; s2 <= 1; s2 += 2) { var wx = (X - g.cx) * s2 - g.hw * 0.25, wyy = Y - wy; if (wx < 0) continue; var ang = Math.atan2(-wyy, wx) - 0.45 - fl, rad = Math.sqrt(wx * wx + wyy * wyy);
              var reach = 13.5 * (0.55 + 0.45 * Math.cos(ang * 1.25)) * (Math.abs(ang) < 1.35 ? 1 : 0), fe = Math.abs(Math.sin(ang * 4.5)); reach *= 0.8 + 0.2 * fe;
              if (rad < reach) { var e = rad / reach; irid(e * 0.9 + ang * 0.25 + shine * 0.6 + t * 0.03, tmp); var sh = 0.6 + 0.4 * Math.pow(Math.max(0, Math.cos((ang - shine * 1.5) * 2)), 6), vein = 0.82 + 0.18 * Math.cos(rad * 2.2 + ang * 9);
                var al = clamp((reach - rad) * 1.2, 0, 1) * 0.92; r = r * (1 - al) + al * (tmp[0] * 0.7 + 0.35) * vein * sh; gg = gg * (1 - al) + al * (tmp[1] * 0.7 + 0.35) * vein * sh; b = b * (1 - al) + al * (tmp[2] * 0.7 + 0.4) * vein * sh;
                if (reach - rad < 0.35) { r += 0.35; gg += 0.35; b += 0.4; } } } } }
        else {
          var L = 0.3 * r + 0.59 * gg + 0.11 * b;
          if (gal === 'galaxy-skin') { var dr = src[si] - B[0], dg = src[si + 1] - B[1], db = src[si + 2] - B[2];
            if (dr * dr + dg * dg + db * db < 8100) { var shade = clamp(L / (0.3 * B[0] / 255 + 0.59 * B[1] / 255 + 0.11 * B[2] / 255 + 0.01), 0.55, 1.3), n = fbm(X * 0.28 + t * 0.03, Y * 0.28), n2 = fbm(X * 0.5 + 11, Y * 0.5 - t * 0.02);
              r = (0.05 + 0.55 * n * n + 0.35 * n2 * n2 * n2) * shade; gg = (0.03 + 0.12 * n + 0.15 * n2 * n2) * shade; b = (0.16 + 0.6 * n + 0.2 * n2) * shade;
              var sv = hash(px * 3 + 1, py * 7 + seed); if (sv > 0.985) { var tw2 = still ? 1 : 0.6 + 0.4 * Math.sin(t * 4 + sv * 90); r += tw2; gg += tw2; b += tw2; } } }
          if (foil) { /* holo foil: thin-film iridescence + moving specular band + sparkle glints */
            var ph = u * 0.9 + v * 0.55 - shine * 0.8, band = Math.exp(-Math.pow((u + v * 0.6) - shine * 1.1, 2) * 60), Lm = 0.3 * r + 0.59 * gg + 0.11 * b;
            var ink = Lm < 0.16, keep = ink ? 0.92 : 0.62; /* dark outline / eye pixels keep the sprite readable */
            if (foil === 'rainbow-holo') { irid(ph * 1.6 + L * 0.5, tmp); var fa = (1 - keep) * (0.7 + band * 0.8); r = r * (1 - fa) + tmp[0] * fa * (0.55 + Lm); gg = gg * (1 - fa) + tmp[1] * fa * (0.55 + Lm); b = b * (1 - fa) + tmp[2] * fa * (0.55 + Lm); }
            else if (foil === 'black-holo') { irid(ph * 1.3 + 0.5, tmp); var dk = ink ? 1 : 0.42; r = r * dk * 0.55 + (ink ? 0 : tmp[0] * 0.22 * (0.35 + band * 2)); gg = gg * dk * 0.55 + (ink ? 0 : tmp[1] * 0.22 * (0.35 + band * 2)); b = b * dk * 0.6 + (ink ? 0 : tmp[2] * 0.28 * (0.35 + band * 2)); }
            else if (!ink) { var gl = 0.25 + Lm * 0.85 + 0.1 * Math.sin(ph * 9); r = r * 0.3 + gl * 0.8; gg = gg * 0.3 + gl * 0.6; b = b * 0.3 + gl * 0.2; }
            if (!ink) { r += band * 0.32; gg += band * 0.32; b += band * 0.36; }
            var gh = hash((px / 3) | 0, ((py / 3) | 0) + seed * 7); if (gh > 0.94) { var gp = Math.max(0, 1 - Math.abs(fract(gh * 13 + shine * 1.5) - 0.5) * 6); var cxp = (px % 3) - 1, cyp = (py % 3) - 1; var star = (cxp === 0 || cyp === 0) ? (cxp === 0 && cyp === 0 ? 1 : 0.5) : 0; var gv = gp * star * 1.2; r += gv; gg += gv; b += gv; } } }
        if (aura && d > 0 && d < 8) {
          if (aura === 'flame-aura') { var up = clamp((g.cy - Y) / 12 + 0.6, 0.3, 1.6), fn = fbm(X * 0.45, Y * 0.32 + t * 2.6) , fi = Math.exp(-d / (1.3 + 1.6 * up * fn)) * (0.55 + 0.9 * fn) * up;
            fi = clamp(fi * 1.4 - 0.25, 0, 1.4); r += fi * 1.0; gg += fi * fi * 0.62; b += fi * fi * fi * 0.25; }
          else if (aura === 'lightning-aura') { var glow = Math.exp(-d / 1.1) * 0.55; r += glow * 0.25; gg += glow * 0.6; b += glow * 1.0;
            var en = vnoise(X * 0.55 + t * 5.3, Y * 0.55 - t * 4.1), arc = Math.abs(en - 0.5); if (d < 5 && arc < 0.035) { var ai = (1 - arc / 0.035) * (1 - d / 5) * 1.6; r += ai * 0.8; gg += ai * 0.95; b += ai; } }
          else if (aura === 'neon-trail') { var tr = 0; for (var q = 1; q <= 6; q++) { var dd2 = sdAt(g, X + q * 1.4, Y); if (dd2 < 0.5) { tr = Math.max(tr, (1 - q / 7)); } } var ng = Math.exp(-d / 0.9) * 0.6; var hue = fract(Y / 32 * 1.5 - t * 0.25);
            irid(hue * 0.35 + 0.75, tmp); var I2 = ng + tr * 0.75 * (0.75 + 0.25 * Math.sin(Y * 1.7 + t * 6)); r += I2 * (tmp[0] * 0.6 + 0.5); gg += I2 * (tmp[1] * 0.5 + 0.15); b += I2 * (tmp[2] * 0.6 + 0.6); }
          else if (aura === 'spell-sparkles') { var sg = Math.exp(-d / 1.4) * 0.35; r += sg * 0.75; gg += sg * 0.45; b += sg * 1.0; } }
        out[o] = clamp(r, 0, 1) * 255; out[o + 1] = clamp(gg, 0, 1) * 255; out[o + 2] = clamp(b, 0, 1) * 255; out[o + 3] = 255; } }
    /* particles (capped at 24) splatted with a soft glow */
    var parts = [];
    if (aura === 'spell-sparkles') for (var i = 0; i < 18; i++) { var hh = hash(i, seed + 3), a0 = hh * 6.283 + t * (0.4 + hh * 0.5), rr = g.hw * 0.55 + 5 + 3 * hash(i, 9), life = fract(t * 0.5 + hh * 7);
      parts.push([g.cx + Math.cos(a0) * rr, g.cy + Math.sin(a0) * rr * 0.9, 1.3 + hh, Math.sin(life * 3.1416), [0.85, 0.6, 1.0], 1]); }
    if (aura === 'flame-aura') for (var j = 0; j < 14; j++) { var h2 = hash(j, seed + 5), lf = fract(t * (0.5 + h2 * 0.4) + h2 * 3), ex = g.x0 + h2 * (g.x1 - g.x0 + 1) + Math.sin(t * 3 + j) * 1.2;
      parts.push([ex, g.y1 - lf * (g.y1 - g.y0 + 8), 0.6 + h2 * 0.5, (1 - lf) * 0.9, [1, 0.55, 0.15], 0]); }
    if (aura === 'lightning-aura') for (var j2 = 0; j2 < 6; j2++) { var h3 = hash(j2, seed + Math.floor(t * 6)), aa = h3 * 6.283; parts.push([g.cx + Math.cos(aa) * (g.hw * 0.6 + 3), g.cy + Math.sin(aa) * (g.y1 - g.y0) * 0.55, 0.8, 0.9, [0.6, 0.85, 1], 1]); }
    if (foil) { /* a few large lens glints near the shine line */ for (var j3 = 0; j3 < 3; j3++) { var h4 = hash(j3, seed + 11); var gx = g.x0 + h4 * (g.x1 - g.x0), gy = g.y0 + hash(j3, 4) * (g.y1 - g.y0); var near = Math.exp(-Math.pow((gx + gy * 0.6) / 32 - shine * 1.1, 2) * 30); if (near > 0.2 && g.m[(gy | 0) * 32 + (gx | 0)]) parts.push([gx, gy, 1.6, near, [1, 1, 1], 1]); } }
    parts.slice(0, 24).forEach(function (P) { splat(out, S, P[0], P[1], P[2], P[3], P[4], P[5]); });
    if (top) drawTop(out, S, g, top, t, shine, still);
    return out; }
  function add(out, o, c, a) { out[o] = Math.min(255, out[o] + c[0] * a * 255); out[o + 1] = Math.min(255, out[o + 1] + c[1] * a * 255); out[o + 2] = Math.min(255, out[o + 2] + c[2] * a * 255); }
  function splat(out, S, X, Y, R, A, col, starry) { if (A <= 0.01) return; var k = S / 32, cx = X * k, cy = Y * k, rr = R * k * 2.2, x0 = Math.max(0, Math.floor(cx - rr)), x1 = Math.min(S - 1, Math.ceil(cx + rr)), y0 = Math.max(0, Math.floor(cy - rr)), y1 = Math.min(S - 1, Math.ceil(cy + rr));
    for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) { var dx = (x - cx) / (R * k), dy = (y - cy) / (R * k), d2 = dx * dx + dy * dy, a = Math.exp(-d2 * 2.2) * 0.9;
      if (starry) a += (Math.exp(-dy * dy * 40) * Math.exp(-Math.abs(dx) * 1.6) + Math.exp(-dx * dx * 40) * Math.exp(-Math.abs(dy) * 1.6)) * 0.7; a *= A; if (a < 0.01) continue; var o = (y * S + x) * 4; add(out, o, col, a); add(out, o, [1, 1, 1], a * a * 0.6); } }
  /* metallic gold: brightness ramp by surface normal + specular that follows the light */
  function gold(n, spec, o3) { var b = clamp(0.35 + 0.65 * n, 0, 1); o3[0] = 0.55 + 0.45 * b; o3[1] = 0.33 + 0.5 * b; o3[2] = 0.08 + 0.2 * b; o3[0] += spec; o3[1] += spec * 0.95; o3[2] += spec * 0.75; return o3; }
  function blend(out, o, c, a) { out[o] = out[o] * (1 - a) + clamp(c[0], 0, 1) * 255 * a; out[o + 1] = out[o + 1] * (1 - a) + clamp(c[1], 0, 1) * 255 * a; out[o + 2] = out[o + 2] * (1 - a) + clamp(c[2], 0, 1) * 255 * a; }
  function drawTop(out, S, g, id, t, shine, still) { var k = S / 32, c3 = [0, 0, 0], ty = g.y0, cx = g.cx;
    if (id === 'gold-crown') { var w = Math.max(6, Math.min(9, g.hw * 0.7)), h = 4.2, baseY = ty + 1.2, x0 = (cx - w / 2) * k, x1 = (cx + w / 2) * k, yb = baseY * k, yt = (baseY - h) * k;
      for (var y = Math.max(0, Math.floor(yt)); y <= Math.min(S - 1, Math.ceil(yb)); y++) for (var x = Math.max(0, Math.floor(x0)); x <= Math.min(S - 1, Math.ceil(x1)); x++) {
        var fx = (x - x0) / (x1 - x0), fy = (yb - y) / (yb - yt); /* 0 bottom .. 1 top */ var tip = 0.42 + 0.58 * Math.pow(Math.abs(Math.cos(fx * Math.PI * 2)), 1.6); if (fy > tip || fy < 0 || fx < 0 || fx > 1) continue;
        var band = fy < 0.3, nrm = band ? 0.75 - Math.abs(fy - 0.15) * 3 : 0.45 + 0.5 * Math.cos((fx - 0.5) * 3) * (1 - fy * 0.4), spec = Math.pow(Math.max(0, 1 - Math.abs(fx - shine) * 3.5), 6) * 0.9 + (band && Math.abs(fy - 0.2) < 0.05 ? 0.25 : 0);
        gold(nrm, spec, c3); var edge = Math.min(fy, tip - fy, fx, 1 - fx) * (yb - yt); var a = clamp(edge * 1.5, 0, 1); var o = (y * S + x) * 4; blend(out, o, c3, a);
        if (band) { for (var gi = 0; gi < 3; gi++) { var gx = 0.2 + gi * 0.3, gdx = (fx - gx) * (x1 - x0), gdy = (fy - 0.15) * (yb - yt), gr = k * 0.75; if (gdx * gdx + gdy * gdy < gr * gr) { var gc = gi === 1 ? [0.85, 0.08, 0.2] : [0.1, 0.35, 0.95]; var hl = gdx < 0 && gdy > 0 ? 0.5 : 0; blend(out, o, [gc[0] + hl, gc[1] + hl, gc[2] + hl], 0.95); } } } }
      for (var j = 0; j < 3; j++) splat(out, S, cx - w / 2 + (j + 0.5) * w / 3 + (j === 1 ? 0 : 0), baseY - h * (j === 1 ? 1 : 0.95), 0.5, 0.5 + 0.5 * Math.sin(t * 2 + j * 2), [1, 0.95, 0.7], 1); }
    else if (id === 'halo') { var hy = Math.max(1.6, ty - 2.2), rx = Math.max(4, g.hw * 0.42), ry = 1.25;
      for (var y2 = Math.max(0, Math.floor((hy - 4) * k)); y2 <= Math.min(S - 1, Math.ceil((hy + 4) * k)); y2++) for (var x2 = Math.max(0, Math.floor((cx - rx - 4) * k)); x2 <= Math.min(S - 1, Math.ceil((cx + rx + 4) * k)); x2++) {
        var ex = (x2 / k - cx) / rx, ey = (y2 / k - hy) / ry, rr = Math.sqrt(ex * ex + ey * ey), dring = Math.abs(rr - 1) * Math.min(rx, ry * 3), core = Math.exp(-dring * dring * 9), glow = Math.exp(-dring * 0.9) * 0.45 * (0.85 + 0.15 * Math.sin(t * 2));
        var ang = Math.atan2(ey, ex), spec = Math.pow(Math.max(0, Math.cos(ang - (shine - 0.5) * 4 + 1.6)), 12) * core; var o2 = (y2 * S + x2) * 4;
        add(out, o2, [1, 0.85, 0.45], glow); blend(out, o2, [1, 0.88, 0.5 + spec * 0.5], clamp(core * 1.2, 0, 1)); add(out, o2, [1, 1, 1], spec * 0.9); } }
    else if (id === 'laurels') { var lcy = (g.y0 + g.y1) / 2 + 1.5, R = Math.min(15.6, Math.max(9, (g.x1 - g.x0) / 2 + 2.2)); cx = (g.x0 + g.x1) / 2;
      for (var s0 = -1; s0 <= 1; s0 += 2) for (var j = 0; j <= 80; j++) { var a0 = Math.PI * (-0.36 + j * 0.0088), sx0 = cx - R * Math.cos(a0) * s0, sy0 = lcy - R * Math.sin(a0) + 2.2, px0 = Math.round(sx0 * k), py0 = Math.round(sy0 * k), rad = Math.max(1, Math.round(k * 0.28));
        for (var yy = -rad; yy <= rad; yy++) for (var xx = -rad; xx <= rad; xx++) { var X = px0 + xx, Y = py0 + yy; if (X < 0 || Y < 0 || X >= S || Y >= S || xx * xx + yy * yy > rad * rad) continue; gold(0.55 - yy / (rad + 1) * 0.3, 0, c3); blend(out, (Y * S + X) * 4, c3, 1); } }
      for (var s = -1; s <= 1; s += 2) for (var i = 0; i < 12; i++) { var a = Math.PI * (-0.34 + i * 0.058), ax = Math.cos(a) * s, ay = -Math.sin(a) * 1.0, lx = cx + R * ax * -1, lyy = lcy + R * ay + 2.2;
        var side = i % 2 ? 1 : -1, tx = Math.sin(a) * s * -1, tyv = -Math.cos(a) * 1.0, tl = Math.sqrt(tx * tx + tyv * tyv); tx /= tl; tyv /= tl; /* tangent, pointing up the wreath */
        var nx = -tyv * side, ny = tx * side, la = Math.atan2(tyv + ny * 0.9, tx + nx * 0.9), L = 2.3 - i * 0.08, Wd = 0.85 - i * 0.03; lx += nx * 1.0 + tx * 1.1; lyy += ny * 1.0 + tyv * 1.1;
        var bx0 = Math.floor((lx - 2.2) * k), bx1 = Math.ceil((lx + 2.2) * k), by0 = Math.floor((lyy - 2.2) * k), by1 = Math.ceil((lyy + 2.2) * k);
        for (var y3 = Math.max(0, by0); y3 <= Math.min(S - 1, by1); y3++) for (var x3 = Math.max(0, bx0); x3 <= Math.min(S - 1, bx1); x3++) { var dx = x3 / k - lx, dy = y3 / k - lyy, ca = Math.cos(la), sa = Math.sin(la), p = dx * ca + dy * sa, q = -dx * sa + dy * ca;
          var wq = Wd * (1 - Math.pow(p / L, 2)); if (Math.abs(p) > L || Math.abs(q) > wq) continue; var e = Math.abs(q) / (wq + 1e-3); var nrm = 0.95 - e * 0.45 + (q * side > 0 ? -0.2 : 0.15), spec = Math.pow(Math.max(0, 1 - Math.abs((x3 / S) - shine) * 4), 5) * 0.8 * (1 - e); gold(nrm, spec, c3); if (e < 0.12) { c3[0] *= 0.72; c3[1] *= 0.7; c3[2] *= 0.6; }
          blend(out, (y3 * S + x3) * 4, c3, clamp((1 - e) * 5, 0, 1)); } } } }
  /* ---------------- live overlays (browser) ---------------- */
  var STILL = (function () { try { return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; } })();
  var MAX_LIVE = 8, FPS = 24, live = typeof Set !== 'undefined' ? new Set() : null, ptr = null, tilt = null, raf = 0, last = 0, listening = false;
  var vis = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(function (es) { es.forEach(function (e) { var o = e.target._lkx; if (o) { o._vis = e.isIntersecting; if (o._vis) kick(); } }); }) : null;
  var ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(function (es) { es.forEach(function (e) { place(e.target); }); }) : null;
  function place(c) { var o = c._lkx; if (!o) return; var w = c.offsetWidth, h = c.offsetHeight; o.style.display = w ? '' : 'none'; if (!w) return; o.style.left = c.offsetLeft + 'px'; o.style.top = c.offsetTop + 'px'; o.style.width = w + 'px'; o.style.height = h + 'px';
    var cs = root.getComputedStyle ? getComputedStyle(c) : null; if (cs) { o.style.borderRadius = cs.borderRadius; o.style.borderLeftWidth = cs.borderLeftWidth; o.style.borderTopWidth = cs.borderTopWidth; o.style.borderRightWidth = cs.borderRightWidth; o.style.borderBottomWidth = cs.borderBottomWidth; o.style.borderStyle = 'solid'; o.style.borderColor = 'transparent'; o.style.boxSizing = cs.boxSizing; o.style.padding = cs.padding; }
    var dpr = Math.min(2, root.devicePixelRatio || 1), cap = w >= 240 ? 320 : 192, S = Math.max(64, Math.min(cap, Math.round(w * dpr / 32) * 32)); if (o.width !== S) { o.width = o.height = S; o._id = null; o._dirty = 1; } o._pos = c.offsetLeft + ',' + c.offsetTop + ',' + w; }
  function detach(c) { var o = c._lkx; if (!o) return; if (o.parentNode) o.parentNode.removeChild(o); c._lkx = null; if (ro) ro.unobserve(c); if (vis) vis.unobserve(c); if (live) live.delete(c); }
  /** attach(canvas, frame32): called from V2Render.paint for every painted frame. */
  function attach(c, img) { if (!c || c.nodeType !== 1 || typeof document === 'undefined') return; var info = infoOf(img);
    if (!info) { if (c._lkx) detach(c); return; } if (!c.parentNode) return;
    var o = c._lkx; if (!o || !o.isConnected || o.parentNode !== c.parentNode) { if (o) detach(c); o = document.createElement('canvas'); o.className = 'lkx'; o.setAttribute('aria-hidden', 'true');
      o.style.cssText = 'position:absolute;pointer-events:none;image-rendering:auto;margin:0;background:transparent;box-shadow:none;outline:0;'; c.parentNode.insertBefore(o, c.nextSibling); c._lkx = o; o._c = c; o._vis = !vis; place(c); if (ro) ro.observe(c); if (vis) vis.observe(c); if (live) live.add(c); listen(); }
    else if (o._pos !== c.offsetLeft + ',' + c.offsetTop + ',' + c.offsetWidth) place(c);
    if (o._img !== img) { o._img = img; o._info = info; o._dirty = 1; } kick(); }
  function draw(o, t) { var S = o.width; if (!S || !o._img) return; var x = o.getContext('2d'); if (!o._id) o._id = x.createImageData(S, S);
    var p = null; if (!STILL) { var r = o.getBoundingClientRect(); if (ptr && r.width) { var px = (ptr[0] - r.left) / r.width, py = (ptr[1] - r.top) / r.height; if (px > -0.3 && px < 1.3 && py > -0.3 && py < 1.3) p = [clamp(px, 0, 1), clamp(py, 0, 1)]; } if (!p && tilt) p = tilt; }
    render(o._img, o._info, S, STILL ? 1.3 : t, STILL ? false : p, o._id.data); x.putImageData(o._id, 0, 0); o._dirty = 0; }
  function tick(now) { raf = 0; if (!live || (typeof document !== 'undefined' && document.hidden)) return; if (now - last < 1000 / FPS) { raf = requestAnimationFrame(tick); return; } last = now; var t = now / 1000, n = 0, any = false;
    live.forEach(function (c) { var o = c._lkx; if (!o || !c.isConnected) { detach(c); return; } if (!o._vis && !onScreen(o)) return; if (STILL) { if (o._dirty) draw(o, t); return; } if (n < MAX_LIVE || o._dirty) { draw(o, t); n++; any = true; } });
    if (any && !STILL) raf = requestAnimationFrame(tick); }
  function onScreen(o) { var r = o.getBoundingClientRect(); return r.width > 0 && r.bottom > 0 && r.right > 0 && r.top < (root.innerHeight || 0) && r.left < (root.innerWidth || 0); }
  function kick() { if (!raf && typeof requestAnimationFrame !== 'undefined') raf = requestAnimationFrame(tick); }
  function listen() { if (listening || typeof root.addEventListener !== 'function') return; listening = true;
    root.addEventListener('pointermove', function (e) { if (e.pointerType === 'touch') return; ptr = [e.clientX, e.clientY]; }, { passive: true });
    document.addEventListener('pointerleave', function () { ptr = null; }, { passive: true });
    root.addEventListener('deviceorientation', function (e) { if (e.gamma == null) return; tilt = [0.5 + clamp(e.gamma, -30, 30) / 60, 0.5 + clamp((e.beta || 45) - 45, -30, 30) / 60]; }, { passive: true });
    document.addEventListener('visibilitychange', kick); }
  /** bake(frame32, size, t) -> RGBA (size*size*4) still of the realistic effect (token PNGs, GIFs, papers); null when the frame has no looks. */
  function bake(img, size, t) { var info = infoOf(img); if (!info) return null; size = size || 128; var out = new Uint8ClampedArray(size * size * 4); render(img, info, size, t == null ? 1.3 : t, t == null ? [0.42, 0.35] : null, out); return out; }
  root.V2Looks = { attachInfo: attachInfo, info: infoOf, attach: attach, detach: detach, render: render, bake: bake, STILL: STILL };
})(typeof window !== 'undefined' ? window : this);
