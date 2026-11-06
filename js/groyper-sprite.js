/* GROYPER sprite (PREVIEW, branch groyper-community, Nov 4 2026): community pet #7 candidate, after the White Rabbit. NOT loaded by any page yet; the rules
 * would use it only once ACTIVATE_GROYPER_BLOCK is set (null = off). Original 8-bit art, no logos or text: the fat smug frog sitting in 3/4 view, facing right,
 * big round green body, fingers steepled under his chin, sly half-lidded side glance, wide orange lips, one leg stretched out along the ground.
 * Same API as RabbitSprite / HomerSprite: draw(stage, frame, gear) -> 32x32 key grid; render(stage, frame, bg, gear, opts) -> {width,height,data:[RGBA]};
 * frames(stage, bg, gear, opts) -> 4 frames; anchors(stage, frame). Stages 0 Egg..5 Mythic, 4 idle frames (stand, 1px bob, blink, finger tap: the steepled
 * fingers lift one pixel). Evolution = size + heavier lids + Elder under-eye wrinkles + the shared Mythic gold rim. Rare and Legendary share one look.
 * v2 'needs more smug' (Nov 4): heavier drooping lids, side-glance pupils, lopsided smirk curling up on the right, one raised brow, lean back + chin up.
 *   v3 (Nov 4): v1 face is default again; new defined steepled hands (opts.hands:'v1' for the old ones).
 *   opts.smug: 'v1' (default) | 'A' (smugger) | 'B' (max smug).
 * No fire aura, no flame crown, no edition frame. opts.pal recolours by palette key (skin G/S/D/H, lips L/l). */
(function (root, factory) { if (typeof module === 'object' && module.exports) module.exports = factory(); else root.GroyperSprite = factory(); })(this, function () {
  'use strict';
  var N = 32, PAL = { n: '#1a1020', G: '#6f9c16', S: '#557c0e', D: '#3e5a09', H: '#8bbd2a', L: '#ff7a14', l: '#c4550a', E: '#ffffff', P: '#1a1020', A: '#ffc93c' };
  var STAGES = ['Egg', 'Hatchling', 'Juvenile', 'Adult', 'Elder', 'Mythic'];
  var SKIN = { G: 1, S: 1, D: 1, H: 1 }, SUIT = { H: 1 };
  var SMUG = 0; /* smug level: 0 = v1 preview (default, owner Nov 4 'v1 is still best'), 1 = v2 A, 2 = v2 B max smug; opts.smug overrides */
  /* v3 hands (default): crisp steepled fingers stamped on the scaled grid: separate finger pixels whose tips touch at the top, dark ink outline, light highlight. opts.hands:'v1' = old blob hands */
  var HANDS_BIG = ['...n...', '..nHn..', '.nHnHn.', 'nHGnHGn', 'nGGnGGn', '.nn.nn.'], HANDS_SMALL = ['..n..', '.nHn.', 'nHnHn', '.n.n.'];
  function stampHands(g, s, f) { var t = SCALE[s], dy = (f === 1 ? -1 : 0) + (f === 3 ? -1 : 0), pat = s < 2 ? HANDS_SMALL : HANDS_BIG, w = pat[0].length;
    var cx = Math.round(15.5 + (21.2 - 15.5) * t - 0.5), cy = Math.round(28.5 + (16.8 - 28.5) * t - 0.5) + dy, x0 = cx - (w >> 1), y0 = cy - (s < 2 ? 0 : 1);
    for (var j = 0; j < pat.length; j++) for (var i = 0; i < w; i++) { var c = pat[j][i], X = x0 + i, Y = y0 + j; if (c !== '.' && X >= 0 && Y >= 0 && X < N && Y < N) g[Y][X] = c; } }
  function lvl(o) { var v = o && o.smug; return v === 'B' || v === 2 ? 2 : v === 'A' || v === 1 ? 1 : v === 0 || v === 'v1' ? 0 : SMUG; }
  var SCALE = [0.6, 0.6, 0.72, 0.85, 0.94, 1.0];
  function hexRgb(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
  function el(x, y, cx, cy, rx, ry) { var a = (x - cx) / rx, b = (y - cy) / ry; return a * a + b * b; }
  /* key at an ADULT-space point (ground 28.5); later rules overwrite earlier ones */
  function keyAt(X0, Y0, s, f, L) { var k = null, tap = f === 3 ? -0.8 : 0, X = X0, Y = Y0; L = L || 0;
    /* smug lean (v2): the upper body leans back (left) and the chin tips up; the legs stay planted */
    var lean = function () { X = X0 + (Y0 < 24 ? L * 0.55 * (24 - Y0) / 12 : 0); Y = Y0 + (Y0 < 19.5 ? L * 0.45 : 0); };
    if (Y > 25.6 && Y < 28.6 && X > 17 && X < 28.6) k = (Y > 27.6 ? 'D' : 'S');                                            // stretched leg (far, darker)
    if (el(X, Y, 29.0, 26.4, 1.3, 2.2) < 1 && Y < 28.6) k = 'D';                                                             // its foot, toes up
    if (Y > 24.0 && Y < 25.0 && (Math.abs(X - 28.4) < 0.5 || Math.abs(X - 30.0) < 0.5)) k = 'D';                             // two toe tips
    lean();
    if (el(X, Y, 12.8, 20.4, 10.0, 8.4) < 1) k = (X < 6.6 || Y > 27.0 ? 'S' : 'G');                                          // the big round body
    if (el(X, Y, 19.4, 22.6, 4.2, 3.6) < 1) k = (X > 22.4 || Y > 25.2 ? 'S' : 'G');                                          // near knee drawn up
    var kd = el(X, Y, 19.4, 22.6, 4.2, 3.6); if (kd < 1 && kd > 0.62 && X < 21.0 && Y < 23.2) k = 'n';                          // knee contour line
    if (el(X, Y, 21.0, 27.9, 2.6, 0.9) < 1) k = 'S';                                                                          // near foot
    if (el(X, Y, 18.0, 10.6, 7.2, 5.0) < 1) k = (X < 12.0 ? 'S' : 'G');                                                      // head
    if (el(X, Y, 15.4, 6.8, 2.6, 2.0) < 1 || el(X, Y, 21.0, 7.0, 2.4, 1.9) < 1) k = 'G';                                     // eye bumps
    if (el(X, Y, 21.2, 16.8 + tap, 3.0, 1.5) < 1) k = (Y < 16.4 + tap ? 'H' : 'G');                                          // steepled fingers under the chin
    var hd = el(X, Y, 21.2, 16.8 + tap, 3.0, 1.5); if (hd < 1 && hd > 0.55 && Y > 16.8 + tap) k = 'n';                       // finger outline
    if (Math.abs(X - 21.2) < 0.45 && Y > 15.6 + tap && Y < 18.2 + tap) k = 'n';                                               // the finger seam
    if (el(X, Y, 16.4, 17.8, 3.0, 1.0) < 1 && X < 19.0) k = 'G';                                                              // forearm
    if (Y > 13.0 && Y < 15.0 && X > 13.6 && X < 25.4) { var sag = (X - 19.4) * (X - 19.4) / 40 - L * 0.07 * (X - 19.4); if (Y > 13.0 + sag * 0.3 && Y < 15.0 - sag * 0.6) k = (Y > 14.0 - sag * 0.2 ? 'l' : 'L'); } // wide smug orange lips
    if (Y > 13.0 && Y < 13.8 && X > 23.6 && X < 25.2) k = 'L';                                                                 // the lip corner curling up
    if (L >= 1 && Y > 12.2 && Y < 13.2 && X > 24.4 && X < 25.8) k = 'L';                                                    // v2: lopsided smirk, the right corner curls higher
    if (L >= 2 && Y > 11.2 && Y < 12.3 && X > 25.0 && X < 26.4) k = 'L';                                                    // B: curls higher still
    if (L >= 1 && Y > 13.6 && Y < 15.0 && X > 13.4 && X < 15.4) k = 'G';                                                    // v2: the left side of the mouth stays flat and short
    return k; }
  /* sly half-lidded eyes, stamped on the scaled grid so they stay crisp: lid row (skin), white row with the pupil looking right */
  function stampEyes(g, s, f, L) { L = L || 0; var t = SCALE[s], dy = f === 1 ? -1 : 0, P2 = function (X, Y) { return [Math.round(15.5 + (X - 15.5) * t - 0.5), Math.round(28.5 + (Y - 28.5) * t - 0.5) + dy]; };
    var w = (s < 2 ? 2 : 3) + (L >= 2 && s >= 2 ? 1 : 0); [[15.2, 9.4], [20.6, 9.6]].forEach(function (e, ei) { var p = P2(e[0] - L * 0.55 * (24 - e[1]) / 12, e[1] - L * 0.45), x0 = p[0] - (w >> 1), y0 = p[1];
      for (var xx = 0; xx < w; xx++) { var X = x0 + xx; if (X < 0 || X >= N) continue;
        if (y0 - 1 >= 0) g[y0 - 1][X] = 'n';                                                                    // heavy upper lid line
        if (L >= 1 && y0 - 2 >= 0) g[y0 - 2][X] = 'D';                                                       // v2: heavy drooping lid over the top half
        if (f === 2) { g[y0][X] = 'n'; continue; }
        g[y0][X] = xx === w - 1 ? 'P' : (L >= 2 && xx === 0 ? 'n' : 'E'); }                                    // B: lid droops over the inner corner
      if (L >= 1 && ei === 1) { var by = y0 - 3 - (L >= 2 && s >= 2 ? 1 : 0); for (var bx = 1; bx <= w; bx++) { var Y2 = by - (bx === w && s >= 2 ? 1 : 0); if (Y2 >= 0 && x0 + bx < N) g[Y2][x0 + bx] = 'n'; } } // one raised brow (near eye)                                                                  // side glance: pupil in the right corner
      if (s >= 4 && y0 + 1 < N) { g[y0 + 1][x0] = 'S'; g[y0 + 1][x0 + w - 1] = 'S'; } }); }                     // Elder+: tired, smug under-eye folds
  function egg(f, L) { L = L || 0; var g = [], dy = f === 1 ? -1 : 0; for (var y = 0; y < N; y++) { g.push([]); for (var x = 0; x < N; x++) { var yy = y - dy + 0.5, xx = x + 0.5, k = null;
        if (el(xx, yy, 16, 19.5, 7.6, 8.8) < 1) { k = xx < 12 ? 'S' : 'G'; if (el(xx, yy, 13.4, 14.4, 1.6, 2.0) < 1) k = 'H';
          if (yy > 21.6 && yy < 23.4 && xx > 11 && xx < 22) { var sg = (xx - 16.5) * (xx - 16.5) / 30; if (yy > 21.6 + sg * 0.4 - L * 0.08 * (xx - 16.5)) k = yy > 22.5 - L * 0.06 * (xx - 16.5) ? 'l' : 'L'; } if (L >= 1 && el(xx, yy, 22.2, 21.0 - (L - 1) * 0.6, 0.9, 0.9 + (L - 1) * 0.5) < 1) k = 'L'; }  // an orange smirk across the shell
        g[y].push(k); } }
    if (L >= 1) [[14, 17], [19, 17]].forEach(function (p, i) { var Y = p[1] + dy; g[Y - 2][p[0]] = 'D'; g[Y - 2][p[0] + 1] = 'D'; if (i === 1) { var b = Y - 3 - (L >= 2 ? 1 : 0); g[b][p[0]] = 'n'; g[b][p[0] + 1] = 'n'; g[b - 1][p[0] + 2] = 'n'; } });
    if (f !== 2 && L >= 2) [[14, 17], [19, 17]].forEach(function (p) { var Y = p[1] + dy; g[Y - 1][p[0]] = 'n'; g[Y - 1][p[0] + 1] = 'n'; g[Y - 1][p[0] + 2] = 'n'; g[Y][p[0]] = 'n'; g[Y][p[0] + 1] = 'E'; g[Y][p[0] + 2] = 'P'; });
    else if (f !== 2) [[14, 17], [19, 17]].forEach(function (p) { var Y = p[1] + dy; g[Y - 1][p[0]] = 'n'; g[Y - 1][p[0] + 1] = 'n'; g[Y][p[0]] = 'E'; g[Y][p[0] + 1] = 'P'; }); // two sly eyes peek out
    else [[14, 17], [19, 17]].forEach(function (p) { var Y = p[1] + dy; g[Y][p[0]] = 'n'; g[Y][p[0] + 1] = 'n'; });
    return g; }
  function outline(g) { var o = g.map(function (r) { return r.slice(); });
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) if (!g[y][x] && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(function (q) { var X = x + q[0], Y = y + q[1]; return X >= 0 && Y >= 0 && X < N && Y < N && g[Y][X] && g[Y][X] !== 'n'; })) o[y][x] = 'n';
    return o; }
  function base(stage, frame, L, HV) { HV = HV == null ? 1 : HV; L = L == null ? SMUG : L; var s = Math.max(0, Math.min(5, stage | 0)), f = ((frame | 0) % 4 + 4) % 4, g;
    if (s === 0) g = egg(f, L);
    else { var t = SCALE[s], dy = f === 1 ? -1 : 0; g = [];
      for (var y = 0; y < N; y++) { g.push([]); for (var x = 0; x < N; x++) { var sx = 15.5 + (x + 0.5 - 15.5) / t, sy = 28.5 + (y - dy + 0.5 - 28.5) / t; g[y].push(y - dy > 29 ? null : keyAt(sx, sy, s, f, L)); } }
      stampEyes(g, s, f, L); if (HV) stampHands(g, s, f); }
    var o = outline(g);
    if (s === 5) { var o2 = o.map(function (r) { return r.slice(); }); /* shared Mythic gold rim (same as every Mythic; not an edition frame) */
      for (var ry = 0; ry < 30; ry++) for (var rx = 0; rx < N; rx++) if (!o[ry][rx] && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(function (q) { var X = rx + q[0], Y = ry + q[1]; return X >= 0 && Y >= 0 && X < N && Y < N && o[Y][X] === 'n'; })) o2[ry][rx] = 'A';
      o = o2; }
    return o; }
  function anchors(stage, frame) { var g = base(stage, frame === 2 || frame === 3 ? 0 : frame), a = { top: 99, gy: -1, ey: -1, ey1: -1, ex0: 99, ex1: -1, fx0: 99, fx1: -1, fy0: 99, fy1: -1, bx0: 99, bx1: -1, by0: 99, by1: -1 };
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) { var k = g[y][x]; if (!k || k === 'A') continue; a.top = Math.min(a.top, y); a.gy = Math.max(a.gy, y);
      if (k === 'E' || k === 'P') { if (a.ey < 0) a.ey = y; a.ey1 = y; a.ex0 = Math.min(a.ex0, x); a.ex1 = Math.max(a.ex1, x); }
      if (SUIT[k]) { a.by0 = Math.min(a.by0, y); a.by1 = Math.max(a.by1, y); a.bx0 = Math.min(a.bx0, x); a.bx1 = Math.max(a.bx1, x); } }
    if (stage > 0) { var t = SCALE[Math.max(1, Math.min(5, stage | 0))], bob = frame === 1 ? -1 : 0, P2 = function (X, Y) { return [Math.round(15.5 + (X - 15.5) * t - 0.5), Math.round(28.5 + (Y - 28.5) * t - 0.5) + bob]; };
      var h0 = P2(10.8, 5.0), h1 = P2(25.2, 15.6); a.fx0 = h0[0]; a.fy0 = h0[1]; a.fx1 = h1[0]; a.fy1 = h1[1]; var b0 = P2(4, 16), b1 = P2(22, 27); a.bx0 = b0[0]; a.by0 = b0[1]; a.bx1 = b1[0]; a.by1 = b1[1]; }
    else { a.fx0 = 9; a.fx1 = 23; a.fy0 = 11; a.fy1 = 20; a.bx0 = 9; a.bx1 = 23; a.by0 = 20; a.by1 = 28; }
    if (a.ey < 0) { a.ey = a.fy0 + 3; a.ey1 = a.ey; a.ex0 = a.fx0 + 3; a.ex1 = a.fx1 - 3; } return a; }
  /* gear: preview draws the generic slot shapes only (no Groyper gear batch yet; signature item is an open question) */
  function draw(stage, frame, gear, opts) { var g = base(stage, frame, lvl(opts), opts && opts.hands === 'v1' ? 0 : 1), Gr = gear || {}; if (!stage || !Object.keys(Gr).length) return g;
    var A = anchors(stage, frame); function set(x, y, k) { if (x >= 0 && y >= 0 && x < N && y < N && k) g[y][x] = k; }
    function col(sl, i) { var c = Gr[sl] && Gr[sl].cols; return (c && (c[i || 0] || c[0])) || (i ? '#c98a00' : '#ffd23f'); }
    if (Gr.head) for (var xh = A.fx0 + 2; xh <= A.fx1 - 3; xh++) { set(xh, A.fy0 - 1, col('head')); set(xh, A.fy0, col('head', 1)); }
    if (Gr.face) for (var xe = A.ex0 - 1; xe <= A.ex1; xe++) set(xe, A.ey, col('face'));
    return g; }
  function render(stage, frame, bg, gear, opts) { var g = draw(stage, frame, gear, opts), P = Object.assign({}, PAL, (opts && opts.pal) || {}), B = hexRgb(typeof bg === 'string' ? bg : '#142018'), d = [];
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) { var k = g[y][x], c = k ? hexRgb(P[k] || k) : B; d.push(c[0], c[1], c[2], 255); } return { width: N, height: N, data: d }; }
  function frames(stage, bg, gear, opts) { return [0, 1, 2, 3].map(function (f) { return render(stage, f, bg, gear, opts); }); }
  return { STAGES: STAGES, PAL: PAL, PAL_COMMUNITY: {}, SKIN: SKIN, SUIT: SUIT, render: render, frames: frames, draw: draw, anchors: anchors };
});
