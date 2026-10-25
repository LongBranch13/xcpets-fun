/* looks-draw (2026-10-24, DISPLAY ONLY, no rule change, no gate): draws the cosmetic 'looks' (Flame tiers placed with pet:aura:ID:on, and the
 * Mythic quest looks) on the pet's own 32x32 pixel frames, so they show everywhere a pet is painted through V2Render.petFrames (pet page,
 * My Pets cards, pet card modal, pickers, Spam City cards, the t/<id>.png token generator, GIFs).
 * WHICH looks: exactly V2Rules.shownLooks(w, p), the same list the look chips show: one look per type; looks placed with pet:aura come first
 * (auraPlace fills highest Flame tier first), then the pet's own quest looks in the order they were earned (first earned keeps the slot).
 * LAYER ORDER (bottom to top): background -> BACK (Aurora backdrop / Holo wings, only on background pixels, behind the pet) -> pet + gear ->
 * SKIN (Galaxy skin: the main body colour recoloured to a starfield) -> FOIL (Rainbow / Black / Gold holo: a pixel sheen band that sweeps the
 * pet + gear) -> AURA (Flame / Lightning / Neon Trail / Spell Sparkles: animated pixels on the background around the outline) -> TOP (Laurels /
 * Halo / Gold-foil crown, on the top of the silhouette, so it sits on top of any headwear; the Halo floats one row above).
 * Galaxy skin and a foil are different types in the rules, so both can show: the sheen runs over the galaxy skin.
 * Every colour is a flat palette pixel (no smoothing); animation = 4 frames at the site's 300 ms tick. */
(function (root) {
  'use strict';
  function hx(c) { c = c.replace('#', ''); return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)]; }
  function mix(a, b, t) { return [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)]; }
  function H(a, b, c) { var h = Math.imul(a + 1, 73856093) ^ Math.imul(b + 1, 19349663) ^ Math.imul(c + 7, 83492791); h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); return (h ^ (h >>> 15)) >>> 0; }
  var INK = hx('#1a1020');
  var TYPES = ['back', 'galaxy', 'foil', 'aura', 'top'];
  function lum(c) { return 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]; }
  function apply(fr, A, B, looks, seed) {
    if (!looks || !looks.length || !fr || !fr.length) return fr;
    var by = {}; looks.forEach(function (L) { if (L && L.type && !by[L.type]) by[L.type] = L.id; });
    var L0 = fr.length, N = L0 >= 4 ? L0 : (4 % L0 === 0 ? 4 : L0 * 4), out = [], s = (seed | 0) % 9973, body = null;
    for (var k = 0; k < N; k++) {
      var src = fr[k % L0].data, a = (A[k % L0] || A[0]).data, b = (B[k % L0] || B[0]).data, D = new Uint8ClampedArray(src), m = new Uint8Array(1024), p, x, y;
      for (p = 0; p < 1024; p++) { var i = p * 4; if (a[i] === b[i] && a[i + 1] === b[i + 1] && a[i + 2] === b[i + 2]) m[p] = 1; }
      var bb = { x0: 32, x1: -1, y0: 32, y1: -1 };
      for (p = 0; p < 1024; p++) if (m[p]) { x = p & 31; y = p >> 5; if (x < bb.x0) bb.x0 = x; if (x > bb.x1) bb.x1 = x; if (y < bb.y0) bb.y0 = y; if (y > bb.y1) bb.y1 = y; }
      if (bb.x1 < 0) { out.push(fr[k % L0]); continue; }
      var yh = bb.y0; for (y = bb.y0; y <= bb.y1; y++) { var cn = 0; for (x = 0; x < 32; x++) cn += m[y * 32 + x]; if (cn >= 4) { yh = y; break; } }
      var r2 = Math.min(31, yh + 1), sx = 0, sn = 0, rx0 = 32, rx1 = -1; for (x = 0; x < 32; x++) if (m[r2 * 32 + x]) { sx += x; sn++; if (x < rx0) rx0 = x; if (x > rx1) rx1 = x; }
      var cx = sn ? Math.round(sx / sn) : 16, hw = sn ? rx1 - rx0 + 1 : 8;
      /* distance (Chebyshev, up to 4) from the silhouette, for background pixels */
      var dist = new Uint8Array(1024); for (p = 0; p < 1024; p++) dist[p] = m[p] ? 0 : 9;
      for (var it = 1; it <= 4; it++) for (p = 0; p < 1024; p++) { if (dist[p] !== 9) continue; x = p & 31; y = p >> 5;
        for (var dy = -1; dy <= 1 && dist[p] === 9; dy++) for (var dx = -1; dx <= 1; dx++) { var X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X > 31 || Y > 31) continue; if (dist[Y * 32 + X] === it - 1) { dist[p] = it; break; } } }
      var get = function (x, y) { var i = (y * 32 + x) * 4; return [D[i], D[i + 1], D[i + 2]]; };
      var put = function (x, y, c) { if (x < 0 || y < 0 || x > 31 || y > 31) return; var i = (y * 32 + x) * 4; D[i] = c[0]; D[i + 1] = c[1]; D[i + 2] = c[2]; D[i + 3] = 255; };
      var bgPut = function (x, y, c) { if (x < 0 || y < 0 || x > 31 || y > 31 || m[y * 32 + x]) return; put(x, y, c); };
      var isInk = function (p) { var i = p * 4; return lum([src[i], src[i + 1], src[i + 2]]) < 48; };
      /* ---- BACK ---- */
      if (by.back === 'aurora') { var AC = [hx('#3cff9a'), hx('#3ad6ff'), hx('#b46bff')], WV = [0, 1, 1, 2, 2, 1, 1, 0];
        for (var rb = 0; rb < 3; rb++) for (x = 0; x < 32; x++) { var ry = 2 + rb * 4 + WV[(x + k + rb * 3) % 8]; bgPut(x, ry, mix(get(x, ry), AC[rb], 0.6)); bgPut(x, ry + 1, mix(get(x, ry + 1), AC[rb], 0.3)); } }
      if (by.back === 'holo-wings') { var WG = ['......####', '....##abb#', '..##abbcc#', '.#abbccaa#', '#abccaabb#', '#bccaabb#.', '.#aabb##..', '..####....'];
        var HP = [hx('#ff9be8'), hx('#9be8ff'), hx('#c9a6ff'), hx('#fff6a8')], wy = Math.min(24, yh + 3) - (k % 2);
        [-1, 1].forEach(function (side) { var ax = side < 0 ? bb.x0 + 3 : bb.x1 - 3;
          for (var r = 0; r < WG.length; r++) for (var c = 0; c < 10; c++) { var ch = WG[r].charAt(c); if (ch === '.') continue; var px = side < 0 ? ax - 9 + c : ax + 9 - c, py = wy + r;
            bgPut(px, py, ch === '#' ? INK : HP[('abc'.indexOf(ch) + k + (side < 0 ? 0 : 1)) % 4]); } }); }
      /* ---- SKIN: galaxy ---- */
      if (by.galaxy === 'galaxy-skin') {
        if (!body) { var hist = {}, best = null, bn = 0; for (p = 0; p < 1024; p++) { if (!m[p] || isInk(p)) continue; var q = p * 4, c0 = [src[q], src[q + 1], src[q + 2]], l0 = lum(c0); if (l0 > 225) continue; var key = c0.join(','); hist[key] = (hist[key] || 0) + 1; if (hist[key] > bn) { bn = hist[key]; best = c0; } } body = best || [128, 128, 128]; }
        var bl = lum(body), GD = hx('#1c1048'), GM = hx('#33207a'), GL = hx('#5a3fb0'), ST = hx('#ffffff'), SG = hx('#ffd86b'), NP = hx('#c04fd0');
        for (p = 0; p < 1024; p++) { if (!m[p]) continue; var j = p * 4, c1 = [src[j], src[j + 1], src[j + 2]], dd = Math.abs(c1[0] - body[0]) + Math.abs(c1[1] - body[1]) + Math.abs(c1[2] - body[2]); if (dd > 90) continue;
          x = p & 31; y = p >> 5; var l1 = lum(c1), h1 = H(x, y, s), col = l1 < bl - 12 ? GD : l1 > bl + 12 ? GL : GM;
          if (h1 % 11 === 0) col = (h1 + k) % 3 ? ST : GL; else if (h1 % 23 === 1) col = SG; else if (h1 % 17 === 2) col = NP; put(x, y, col); } }
      /* ---- FOIL ---- */
      if (by.foil) { var f = by.foil, pos = ((k * 20 + 24) % 80) - 8;
        for (p = 0; p < 1024; p++) { if (!m[p] || isInk(p)) continue; x = p & 31; y = p >> 5; var c2 = get(x, y), d2 = Math.abs(x + y - pos), band = d2 <= 1 ? 2 : d2 <= 3 ? 1 : 0;
          if (f === 'rainbow-holo') { var RB = [hx('#ff5a5a'), hx('#ffb43c'), hx('#fff05a'), hx('#5aff8c'), hx('#5ac8ff'), hx('#b45aff')], rc = RB[((x + y) >> 1) % 6]; put(x, y, mix(c2, rc, band === 2 ? 0.6 : band ? 0.35 : 0.12)); }
          else if (f === 'black-holo') { var dk = mix(c2, hx('#120c1c'), 0.5); put(x, y, band ? mix(dk, (x + y) % 2 ? hx('#3cf0ff') : hx('#ff4cd8'), band === 2 ? 0.6 : 0.3) : dk); }
          else if (f === 'gold-holo') { var gt = mix(c2, hx('#d4a020'), 0.32); put(x, y, band ? mix(gt, hx('#fff1a0'), band === 2 ? 0.7 : 0.35) : gt); } } }
      /* ---- AURA ---- */
      var A1 = by.aura;
      if (A1 === 'flame-aura') { var FR = [hx('#ff3d1f'), hx('#ff8a1f'), hx('#ffc83a'), hx('#fff07a')];
        for (p = 0; p < 1024; p++) { var dp = dist[p]; if (dp < 1 || dp > 3) continue; x = p & 31; y = p >> 5; if (y > bb.y1 - 1) continue;
          var v = H(x, y + k, s) % 10, up = y < (bb.y0 + bb.y1) / 2;
          if (dp === 1 && v < 7) bgPut(x, y, FR[v % 2 + (up ? 1 : 0)]); else if (dp === 2 && up && v < 4) bgPut(x, y, FR[(v % 2) + 2]); else if (dp === 3 && up && v === 0) bgPut(x, y, FR[3]); }
        for (var e = 0; e < 3; e++) { var ex = bb.x0 + H(e, 1, s) % Math.max(1, bb.x1 - bb.x0 + 1), ey = bb.y0 + 2 - ((k + e * 2) % 5) - 1; bgPut(ex, ey, FR[(e + k) % 2 + 2]); } }
      if (A1 === 'lightning-aura') { var LW = hx('#ffffff'), LB = hx('#7fe3ff'), LD = hx('#2a8cff');
        for (p = 0; p < 1024; p++) if (dist[p] === 1 && H(p, k, s) % 6 === 0) bgPut(p & 31, p >> 5, LB);
        for (var bo = 0; bo < 3; bo++) { var cand = []; for (p = 0; p < 1024; p++) if (dist[p] === 2 && (p >> 5) < bb.y1 - 2) cand.push(p); if (!cand.length) break;
          var st = cand[H(bo, k, s) % cand.length], bx = st & 31, by2 = st >> 5, dir = bx < cx ? -1 : 1;
          for (var z = 0; z < 5; z++) { bgPut(bx, by2, z % 2 ? LB : LW); bgPut(bx + dir, by2, LD); if (z % 2) bx += dir; by2 += 1; } } }
      if (A1 === 'neon-trail') { var NC = [hx('#ff3cf0'), hx('#3cf0ff')], rows = [yh + 3, Math.round((yh + bb.y1) / 2), bb.y1 - 3];
        rows.forEach(function (ry, ri) { if (ry < 0 || ry > 31) return; var sx0 = -1; for (var xx = 0; xx < 32; xx++) if (m[ry * 32 + xx]) { sx0 = xx; break; } if (sx0 < 0) return;
          for (var t = 1; t <= 10; t++) { var tx = sx0 - t; if ((tx + k * 2 + ri) % 4 === 3) continue; if (tx < 0) break; bgPut(tx, ry, mix(get(tx, ry), NC[ri % 2], t < 4 ? 0.95 : t < 7 ? 0.6 : 0.35)); } }); }
      if (A1 === 'spell-sparkles') { var SW = hx('#ffffff'), SP = hx('#c08bff'), SY = hx('#ffe36b'), cs = []; for (p = 0; p < 1024; p++) if (dist[p] >= 2 && dist[p] <= 4) cs.push(p);
        for (var sp = 0; sp < 5 && cs.length; sp++) { var ph = (k + sp) % 4, q2 = cs[H(sp, (k + sp) >> 2, s) % cs.length], qx = q2 & 31, qy = q2 >> 5;
          if (ph === 3) continue; bgPut(qx, qy, ph === 1 ? SW : sp % 2 ? SY : SP); if (ph === 1) { bgPut(qx - 1, qy, SP); bgPut(qx + 1, qy, SP); bgPut(qx, qy - 1, SP); bgPut(qx, qy + 1, SP); } } }
      /* ---- TOP ---- */
      var T = by.top;
      if (T === 'laurels') { var LG = hx('#4caf50'), LDk = hx('#2e7d32'), LY = hx('#ffd23f'), half = Math.max(3, Math.min(7, Math.round(hw / 2))), lx = cx - half - 1, rx = cx + half + 1;
        [[lx, 1, 1], [lx, 0, 0], [lx + 1, -1, 1], [lx + 2, -1, 0], [lx + 1, 0, 2], [rx, 1, 1], [rx, 0, 0], [rx - 1, -1, 1], [rx - 2, -1, 0], [rx - 1, 0, 2], [cx, -1, 2]].forEach(function (L) { var yy = Math.max(0, yh) + L[1]; put(L[0], yy, L[2] === 2 ? LY : L[2] ? LDk : LG); }); }
      if (T === 'halo') { var HY = (k % 2) ? hx('#fff4a0') : hx('#ffe56b'), HO = hx('#e0a800'), hy = Math.max(1, yh - 3), hh = Math.max(3, Math.min(5, Math.round(hw / 2) - 1));
        for (x = cx - hh + 1; x <= cx + hh - 1; x++) { put(x, hy - 1, HY); put(x, hy + 1, HO); } put(cx - hh, hy, HY); put(cx + hh, hy, HO); }
      if (T === 'gold-crown') { var CM = ['y.y.y.y', 'yyyyyyy', 'yrybyry', 'ddddddd'], CC = { y: hx('#ffd23f'), d: hx('#c08a10'), r: hx('#e8344a'), b: hx('#3a7bff') }, ct = Math.max(0, yh - 4), cl = cx - 3, cell = {};
        for (var r3 = 0; r3 < 4; r3++) for (var c3 = 0; c3 < 7; c3++) if (CM[r3].charAt(c3) !== '.') cell[(ct + r3) * 32 + cl + c3] = 1;
        Object.keys(cell).forEach(function (pk) { pk = +pk; var px = pk & 31, py = pk >> 5; [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(function (o) { var X = px + o[0], Y = py + o[1]; if (X < 0 || Y < 0 || X > 31 || Y > 31) return; var q = Y * 32 + X; if (!cell[q] && !m[q]) put(X, Y, INK); }); });
        for (r3 = 0; r3 < 4; r3++) for (c3 = 0; c3 < 7; c3++) { var chh = CM[r3].charAt(c3); if (chh === '.') continue; put(cl + c3, ct + r3, (r3 === 1 && c3 === (k * 2) % 7) ? hx('#fffbe0') : CC[chh]); } }
      out.push({ width: 32, height: 32, data: D });
    }
    return out; }
  root.V2Looks = { apply: apply, TYPES: TYPES };
})(typeof window !== 'undefined' ? window : this);
