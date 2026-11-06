/* PENGUIN sprite (PREVIEW, branch penguin-community, Nov 4 2026): community pet #8 candidate, after Groyper. NOT loaded by any page; rules would use it
 * only once ACTIVATE_PENGUIN_BLOCK is set (null = off). ORIGINAL 8-bit house-style design (not a copy of any existing character): chibi baby emperor
 * penguin, front view, fluffy light-grey down with a fuzzy edge, scribbly black head cap, white face, small dark eyes, tiny yellow beak, orange feet,
 * flippers raised holding a gold Bitcoin coin in each (Juvenile+) and a little coin stack (Elder+). No text or logos. Same API as GroyperSprite. Stages 0 Egg..5 Mythic,
 * 4 idle frames (stand, 1px bob, blink, waddle lean). Mythic = shared Mythic gold rim only (no fire aura, no flame crown, no edition frame). */
(function (root, factory) { if (typeof module === 'object' && module.exports) module.exports = factory(); else root.PenguinSprite = factory(); })(this, function () {
  'use strict';
  var N = 32, PAL = { n: '#1a1020', G: '#c9ccd4', S: '#a4a8b4', F: '#e6e8ee', K: '#22202a', W: '#ffffff', E: '#1a1020', B: '#ffcc22', b: '#d89a10', O: '#f08a24', C: '#ffc93c', c: '#c98a00', A: '#ffc93c', Q: '#f4f6fa' };
  var STAGES = ['Egg', 'Hatchling', 'Juvenile', 'Adult', 'Elder', 'Mythic'], SKIN = { G: 1, S: 1, F: 1 }, SUIT = { G: 1 };
  var SCALE = [0.6, 0.62, 0.74, 0.86, 0.94, 1.0];
  function hexRgb(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
  function el(x, y, cx, cy, rx, ry) { var a = (x - cx) / rx, b = (y - cy) / ry; return a * a + b * b; }
  function hash(x, y) { var h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  /* key at an ADULT-space point (ground 28.5) */
  function keyAt(X, Y, s, f) { var k = null, lean = f === 3 ? (Y > 18 ? 0.8 : -0.4) : 0, x = X - lean;
    var bd = el(x, Y, 16, 21.0, 8.6, 7.4); if (bd < 1.08 && Y < 28.4) { if (bd < 1) k = x < 10.5 ? 'S' : 'G'; else if (hash(Math.round(X), Math.round(Y)) > 0.55) k = 'S'; } // fluffy down, fuzzy rim
    if (bd < 0.6 && hash(Math.round(X * 2), Math.round(Y * 2)) > 0.86) k = 'F';                                       // fluff speckles
    var up = s >= 2, wv = f === 3 ? 0.8 : 0; if (up ? (el(x - (Y - 17) * 0.5, Y, 7.2, 15.8 - wv, 1.6, 3.6) < 1 || el(x + (Y - 17) * 0.5, Y, 24.8, 15.8 + wv, 1.6, 3.6) < 1) : (el(x, Y, 7.6, 21.2, 1.8, 4.0) < 1 || el(x, Y, 24.4, 21.2, 1.8, 4.0) < 1)) k = 'S'; // flippers (raised in a happy cheer from Juvenile on)
    if (Y > 27.6 && Y < 29.2 && (Math.abs(x - 12.6) < 2.0 || Math.abs(x - 19.4) < 2.0)) k = 'O';                     // feet
    var hd = el(x, Y, 16, 11.2, 8.2, 7.0); if (hd < 1.1) { if (hd < 1 || hash(Math.round(X), Math.round(Y) + 7) > 0.5) k = 'K'; } // black cap, scribbly edge
    if (Y < 5.8 && Math.abs(x - 15.2 + (Y - 4) * 0.6) < 0.6 && Y > 2.4) k = 'K';                                       // scribble tuft
    if (Y < 5.0 && Math.abs(x - 18.2 - (Y - 4) * 0.7) < 0.6 && Y > 3.0) k = 'K';
    if (el(x, Y, 13.0, 12.6, 3.4, 3.6) < 1 || el(x, Y, 19.0, 12.6, 3.4, 3.6) < 1 || el(x, Y, 16, 14.8, 4.6, 2.4) < 1) k = 'W'; // white face (two cheeks)
    if (Math.abs(x - 16) < 1.1 && Y > 13.4 && Y < 15.2) k = Y > 14.4 ? 'b' : 'B';                                    // tiny beak
    if (s >= 2) [[5.4, 11.0 - wv], [26.6, 11.0 + wv]].forEach(function (c) { var cr = el(x, Y, c[0], c[1], 2.4, 2.4); if (cr < 1) { k = cr > 0.55 ? 'c' : 'C'; if (Math.abs(x - c[0]) < 0.5 && Math.abs(Y - c[1]) < 1.3) k = 'c'; } }); // a gold Bitcoin coin held up in each flipper
    if (s >= 4) [[4.6, 27.6], [4.6, 26.4], [5.8, 28.2]].forEach(function (p) { if (Math.abs(X - p[0]) < 1.6 && Math.abs(Y - p[1]) < 0.55) k = Y > p[1] ? 'c' : 'C'; }); // coin stack
    return k; }
  function stampEyes(g, s, f) { var t = SCALE[s], dy = f === 1 ? -1 : 0, P2 = function (X, Y) { return [Math.round(15.5 + (X - 15.5) * t - 0.5), Math.round(28.5 + (Y - 28.5) * t - 0.5) + dy]; };
    [[13.2, 11.6], [18.8, 11.6]].forEach(function (e) { var p = P2(e[0], e[1]); if (f === 2) { g[p[1]][p[0]] = 'E'; if (s >= 3) g[p[1]][p[0] + 1] = 'E'; return; }
      g[p[1]][p[0]] = 'E'; if (s >= 3) { g[p[1] - 1][p[0]] = 'E'; g[p[1] - 1][p[0] + 1] = 'Q'; g[p[1]][p[0] + 1] = 'E'; } }); }
  function egg(f) { var g = [], dy = f === 1 ? -1 : 0; for (var y = 0; y < N; y++) { g.push([]); for (var x = 0; x < N; x++) { var yy = y - dy + 0.5, xx = x + 0.5, k = null;
        if (el(xx, yy, 16, 19.5, 7.4, 8.8) < 1) { k = xx < 12 ? 'S' : 'G'; if (yy < 15.5 + Math.sin(xx * 1.7) * 0.9) k = 'K'; if (el(xx, yy, 13.4, 17.2, 1.4, 1.8) < 1) k = 'F';
          if (yy > 22.6 && yy < 25.4 && Math.abs(xx - 16) < 2.6) { k = el(xx, yy, 16, 24, 2.6, 1.4) < 0.5 ? 'C' : 'c'; } } // a coin pressed into the shell
        g[y].push(k); } }
    if (f !== 2) [[13, 13], [18, 13]].forEach(function (p) { g[p[1] + dy][p[0]] = 'W'; }); return g; }
  function outline(g) { var o = g.map(function (r) { return r.slice(); });
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) if (!g[y][x] && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(function (q) { var X = x + q[0], Y = y + q[1]; return X >= 0 && Y >= 0 && X < N && Y < N && g[Y][X] && g[Y][X] !== 'n'; })) o[y][x] = 'n';
    return o; }
  function base(stage, frame) { var s = Math.max(0, Math.min(5, stage | 0)), f = ((frame | 0) % 4 + 4) % 4, g;
    if (s === 0) g = egg(f);
    else { var t = SCALE[s], dy = f === 1 ? -1 : 0; g = [];
      for (var y = 0; y < N; y++) { g.push([]); for (var x = 0; x < N; x++) { var sx = 15.5 + (x + 0.5 - 15.5) / t, sy = 28.5 + (y - dy + 0.5 - 28.5) / t; g[y].push(y - dy > 29 ? null : keyAt(sx, sy, s, f)); } }
      stampEyes(g, s, f); }
    var o = outline(g);
    if (s === 5) { var o2 = o.map(function (r) { return r.slice(); }); /* shared Mythic gold rim (same as every Mythic; not an edition frame) */
      for (var ry = 0; ry < 30; ry++) for (var rx = 0; rx < N; rx++) if (!o[ry][rx] && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(function (q) { var X = rx + q[0], Y = ry + q[1]; return X >= 0 && Y >= 0 && X < N && Y < N && o[Y][X] === 'n'; })) o2[ry][rx] = 'A';
      o = o2; }
    return o; }
  function anchors(stage, frame) { var t = SCALE[Math.max(1, Math.min(5, stage | 0))], bob = frame === 1 ? -1 : 0, P2 = function (X, Y) { return [Math.round(15.5 + (X - 15.5) * t - 0.5), Math.round(28.5 + (Y - 28.5) * t - 0.5) + bob]; };
    if (!stage) return { fx0: 9, fx1: 23, fy0: 11, fy1: 20, ex0: 12, ex1: 19, ey: 13, ey1: 13, bx0: 9, bx1: 23, by0: 20, by1: 28 };
    var h0 = P2(8, 4), h1 = P2(24, 17), e0 = P2(13.2, 11.6), e1 = P2(18.8, 11.6), b0 = P2(8, 15), b1 = P2(24, 28);
    return { top: h0[1], fx0: h0[0], fy0: h0[1], fx1: h1[0], fy1: h1[1], ex0: e0[0], ex1: e1[0] + 1, ey: e0[1], ey1: e0[1], bx0: b0[0], by0: b0[1], bx1: b1[0], by1: b1[1] }; }
  /* gear: preview draws generic slot shapes only (no penguin gear batch yet; signature item = open question, e.g. the Bitcoin coin as a Grip piece) */
  function draw(stage, frame, gear) { var g = base(stage, frame), Gr = gear || {}; if (!stage || !Object.keys(Gr).length) return g;
    var A = anchors(stage, frame); function set(x, y, k) { if (x >= 0 && y >= 0 && x < N && y < N && k) g[y][x] = k; }
    function col(sl, i) { var c = Gr[sl] && Gr[sl].cols; return (c && (c[i || 0] || c[0])) || (i ? '#c98a00' : '#ffd23f'); }
    if (Gr.head) for (var xh = A.fx0 + 2; xh <= A.fx1 - 3; xh++) { set(xh, A.fy0 - 1, col('head')); set(xh, A.fy0, col('head', 1)); }
    if (Gr.face) for (var xe = A.ex0 - 1; xe <= A.ex1; xe++) set(xe, A.ey, col('face'));
    return g; }
  function render(stage, frame, bg, gear, opts) { var g = draw(stage, frame, gear), P = Object.assign({}, PAL, (opts && opts.pal) || {}), B = hexRgb(typeof bg === 'string' ? bg : '#142018'), d = [];
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) { var k = g[y][x], c = k ? hexRgb(P[k] || k) : B; d.push(c[0], c[1], c[2], 255); } return { width: N, height: N, data: d }; }
  function frames(stage, bg, gear, opts) { return [0, 1, 2, 3].map(function (f) { return render(stage, f, bg, gear, opts); }); }
  return { STAGES: STAGES, PAL: PAL, PAL_COMMUNITY: {}, SKIN: SKIN, SUIT: SUIT, render: render, frames: frames, draw: draw, anchors: anchors };
});
