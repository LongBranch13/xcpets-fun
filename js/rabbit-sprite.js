/* THE WHITE RABBIT sprite (PREVIEW, branch whiterabbit-community, Nov 4 2026): community pet #6 candidate. Loaded with the other community sprites, but the
 * rules use it only when ACTIVATE_RABBIT_BLOCK is set (null = off). Original 8-bit art, no logos or text: a white rabbit sitting up in 3/4 view, facing right,
 * long upright ears with pink insides, ruby eyes, pink nose, cream belly, a small red bow at the neck, cotton tail. Built for the blend of Alice's late rabbit,
 * "follow the white rabbit" and the breadcrumb riddle theme: the pocket watch is his SIGNATURE Grip (gear id 'wr-pocket-watch'), not part of the body.
 * Same API as HomerSprite: draw(stage, frame, gear) -> 32x32 key grid; render(stage, frame, bg, gear, opts) -> {width,height,data:[RGBA]};
 * frames(stage, bg, gear, opts) -> 4 frames; anchors(stage, frame). Stages 0 Egg..5 Mythic, 4 idle frames (1px bob on frame 1, blink on frame 2,
 * ear twitch on frame 3: the back ear tip folds forward). Evolution = size + ear length + Elder brow tufts + the shared Mythic gold rim.
 * opts.pal recolours by palette key (hybrids: fur W/S/s, accent N/u/B/b, belly c/C). */
(function (root, factory) { if (typeof module === 'object' && module.exports) module.exports = factory(); else root.RabbitSprite = factory(); })(this, function () {
  'use strict';
  var N = 32, PAL = { n: '#1a1020', W: '#f6f4fa', S: '#cfcadc', s: '#a8a2bc', u: '#ff9ec4', N: '#ff7fae', E: '#ffffff', R: '#d8203a', P: '#4a0612',
    c: '#fff1d6', m: '#fff1d6', C: '#e8d2a8', B: '#d8203a', b: '#8e1424', A: '#ffc93c', y: '#ffd23f', o: '#c98a00', Y: '#fff1a8', '#': '#ffffff' };
  var STAGES = ['Egg', 'Hatchling', 'Juvenile', 'Adult', 'Elder', 'Mythic'];
  var SKIN = { W: 1, S: 1, s: 1 }, SUIT = { c: 1, C: 1 }, EARS = { U: 1, u: 1 };
  /** WR_WATCH: his SIGNATURE Grip (gear id 'wr-pocket-watch', ★ tier 3, White Rabbit + White Rabbit hybrids; gated by ACTIVATE_RABBIT_BLOCK in V2Rules). Display record. */
  var WR_WATCH = { slot: 'hand', item: 'wr-pocket-watch', label: 'Gold pocket watch', tier: 'legendary', legendary: true, signature: true, exclusive: 'rabbit' };
  var WRC = { G: '#ffd23f', g: '#c98a00', H: '#fff1a8', F: '#fffbe8', h: '#1a1020', V: '#ffd23f', v: '#c98a00', K: '#5a2d1a', D: '#1a1020', d: '#2b3a2b', L: '#39ff14', Q: '#7fd0ff', q: '#3a7bd5', T: '#fff1d6', X: '#5a2d82', x: '#3a1a5a' };
  var SCALE = [0.62, 0.62, 0.74, 0.86, 0.94, 1.0], EARLEN = [0, 0.7, 0.82, 0.92, 1.0, 1.0];
  function hexRgb(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
  function el(x, y, cx, cy, rx, ry) { var a = (x - cx) / rx, b = (y - cy) / ry; return a * a + b * b; }
  /* ear: a slanted capsule from base (bx,by) up to tip; returns 0 none, 1 fur, 2 pink inside */
  function ear(x, y, bx, by, tx, ty, w) { var dx = tx - bx, dy = ty - by, L2 = dx * dx + dy * dy, t = ((x - bx) * dx + (y - by) * dy) / L2; if (t < -0.1 || t > 1.08) return 0;
    var tc = Math.max(0, Math.min(1, t)), px = bx + dx * tc, py = by + dy * tc, d = Math.sqrt((x - px) * (x - px) + (y - py) * (y - py)), ww = w * (t > 0.82 ? Math.sqrt(Math.max(0, 1 - (t - 0.82) / 0.26)) : 1);
    if (d > ww) return 0; return (d < ww - 0.95 && t > 0.08 && t < 0.92) ? 2 : 1; }
  /* key at an ADULT-space point (ground 28.5); later rules overwrite earlier ones */
  function keyAt(X, Y, stage, f) { var k = null, el2 = EARLEN[stage], twitch = f === 3;
    /* ears (back ear first, then front ear) */
    var e1 = ear(X, Y, 13.6, 7.6, 11.4 - (twitch ? -1.6 : 0), 7.6 - 5.9 * el2 + (twitch ? 1.2 : 0), 1.65), e2 = ear(X, Y, 17.4, 7.4, 18.4, 7.4 - 6.0 * el2, 1.75);
    if (e1) k = e1 === 2 ? 'u' : 'S'; if (e2) k = e2 === 2 ? 'u' : 'U';
    if (el(X, Y, 8.6, 25.2, 2.4, 2.2) < 1) k = (X < 8 ? 'S' : 'W');                                                      // cotton tail
    if (el(X, Y, 14.8, 22.6, 6.4, 6.4) < 1) k = (X < 11.4 ? 'S' : 'W');                                                  // body
    if (el(X, Y, 17.2, 23.2, 3.4, 4.6) < 1) k = (X > 19.6 || Y > 26.6 ? 'C' : 'c');                                     // belly
    if (el(X, Y, 20.6, 28.0, 3.2, 1.3) < 1 && Y < 29) k = (Y > 28.4 ? 'S' : 'W');                                       // front foot
    if (el(X, Y, 11.6, 28.1, 2.6, 1.1) < 1 && Y < 29) k = 'S';                                                           // back foot
    if (el(X, Y, 19.8, 20.6, 1.6, 1.3) < 1) k = (Y > 21.2 ? 'S' : 'W');                                                                     // paw
    if (el(X, Y, 16.4, 11.6, 6.2, 5.0) < 1) k = (X < 12.0 ? 'S' : 'W');                                                  // head
    if (el(X, Y, 21.4, 13.4, 2.4, 1.9) < 1) k = 'W';                                                                     // muzzle
    if (el(X, Y, 20.2, 14.6, 1.6, 0.9) < 1) k = 'm';                                                                     // cheek fluff
    if (el(X, Y, 23.3, 12.5, 1.0, 0.85) < 1) k = 'N';                                                                    // nose
    if (Y > 13.7 && Y < 14.5 && X > 21.8 && X < 23.4) k = 'n';                                                           // mouth
    if (Y >= 16.0 && Y <= 17.6 && X >= 15.0 && X <= 19.4) { var bw = Math.abs(X - 17.2); k = bw < 0.6 ? 'b' : (Math.abs(Y - 16.8) < 0.95 - (bw - 0.6) * 0.18 ? 'B' : k); } // red bow
    if (stage === 4 || stage === 5) { if (el(X, Y, 14.2, 7.2, 1.2, 0.5) < 1 || el(X, Y, 18.6, 7.2, 1.0, 0.5) < 1) k = 's'; }                     // Elder brow tufts
    /* eyes: stamped as pixel-art in base() (eyes v2, owner Nov 4 2026) */
    return k; }
  /* EYES v2 (owner Nov 4 2026 'eyes need work'): two identical, symmetric 8-bit eyes stamped per stage: ruby iris R, dark pupil P, one white
   * highlight pixel E top-left; blink (frame 2) = a closed ink line of the same width. Keys stay R/P/E (anchors + hybrid eye masks read them). */
  var EYE_T = { s: ['E', 'R'], m: ['ER', 'RP'], l: ['ER', 'RP'] }; /* v3 (owner Nov 4 2026 'too big, move up and left'): Baby 1x2, Child+ 2x2 */
  function stampEyes(g, s, f) { var t = SCALE[s], dy = f === 1 ? -1 : 0, T = s >= 3 ? EYE_T.l : s === 2 ? EYE_T.m : EYE_T.s, w = T[0].length, h = T.length, gap = s >= 3 ? 2 : s === 1 ? 2 : 1, sx = -1, sy = s >= 3 ? -2 : -1;
    var gx = function (X) { return 15.5 + (X - 15.5) * t - 0.5; }, gy = function (Y) { return 28.5 + (Y - 28.5) * t - 0.5 + dy; };
    var cx = Math.round((gx(14.6) + gx(19.3)) / 2), x0 = cx - Math.floor((2 * w + gap) / 2) + sx, y0 = Math.round(gy(11.0) - (h - 1) / 2) + sy;
    [x0, x0 + w + gap].forEach(function (ex) { for (var yy = 0; yy < h; yy++) for (var xx = 0; xx < w; xx++) { var Y = y0 + yy, X = ex + xx; if (Y < 0 || Y >= N || X < 0 || X >= N || !g[Y][X]) continue;
      g[Y][X] = f === 2 ? (yy === h - 1 ? 'n' : (g[Y][X] === 'S' ? 'S' : 'W')) : T[yy][xx]; } }); }
  function egg(f) { var g = [], dy = f === 1 ? -1 : 0; for (var y = 0; y < N; y++) { g.push([]); for (var x = 0; x < N; x++) { var yy = y - dy + 0.5, xx = x + 0.5, k = null;
        if (el(xx, yy, 16, 19.5, 7, 9) < 1) { k = xx < 12 ? 'S' : 'W'; if (el(xx, yy, 13.5, 14.5, 1.8, 2.4) < 1) k = 'E';
          var cd = el(xx, yy, 17, 21, 3.4, 3.4); if (cd < 1) { k = cd > 0.62 ? (xx + yy < 37.5 ? 'Y' : (xx + yy > 40.5 ? 'o' : 'y')) : 'c'; if (cd <= 0.62 && ((Math.abs(xx - 17) < 0.5 && yy < 21 && yy > 18.6) || (Math.abs(yy - 21) < 0.5 && xx > 17 && xx < 18.9 + (f === 3 ? 0.5 : 0)))) k = 'n'; }
          if (Math.abs(xx - 17) < 0.6 && yy > 16.6 && yy < 17.8) k = 'Y'; }                                                // a gold pocket-watch face on the shell
        g[y].push(k); } }
    [[12, 10], [13, 9], [19, 9], [20, 10]].forEach(function (p) { var Y = p[1] + dy + 1; if (Y >= 0 && !g[Y][p[0]]) g[Y][p[0]] = 'u'; });             // two ear tips poking out
    return g; }
  function outline(g) { var o = g.map(function (r) { return r.slice(); });
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) if (!g[y][x] && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(function (q) { var X = x + q[0], Y = y + q[1]; return X >= 0 && Y >= 0 && X < N && Y < N && g[Y][X] && g[Y][X] !== 'n'; })) o[y][x] = 'n';
    return o; }
  function base(stage, frame) { var s = Math.max(0, Math.min(5, stage | 0)), f = ((frame | 0) % 4 + 4) % 4, g;
    if (s === 0) g = egg(f);
    else { var t = SCALE[s], dy = f === 1 ? -1 : 0; g = [];
      for (var y = 0; y < N; y++) { g.push([]); for (var x = 0; x < N; x++) { var sx = 15.5 + (x + 0.5 - 15.5) / t, sy = 28.5 + (y - dy + 0.5 - 28.5) / t; var k = y - dy > 29 ? null : keyAt(sx, sy, s, f); g[y].push(k === 'U' ? 'W' : k); } } }
    if (s > 0) stampEyes(g, s, f);
    /* inner ear / eye seams: one ink pixel between the two ears where they touch */
    var o = outline(g);
    if (s > 0) { var o1 = o.map(function (r) { return r.slice(); }); for (var yy = 1; yy < N - 1; yy++) for (var xx = 1; xx < N - 1; xx++) if ((o[yy][xx] === 'R' || o[yy][xx] === 'E') && (o[yy - 1][xx] === 'W' || o[yy - 1][xx] === 'S')) o1[yy - 1][xx] = 'n'; o = o1; } /* a dark upper lid over each eye */
    if (s === 5) { var o2 = o.map(function (r) { return r.slice(); }); /* shared Mythic gold rim */
      for (var ry = 0; ry < 30; ry++) for (var rx = 0; rx < N; rx++) if (!o[ry][rx] && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(function (q) { var X = rx + q[0], Y = ry + q[1]; return X >= 0 && Y >= 0 && X < N && Y < N && o[Y][X] === 'n'; })) o2[ry][rx] = 'A';
      o = o2; }
    return o; }
  /** anchors(stage, frame): measured on his own frame (head, eyes, belly, ground), ears excluded, so gear lands on him at every stage. */
  function anchors(stage, frame) { var g = base(stage, frame === 2 || frame === 3 ? 0 : frame), a = { fy0: 99, fy1: -1, fx0: 99, fx1: -1, by0: 99, by1: -1, bx0: 99, bx1: -1, ey: -1, ey1: -1, ex0: 99, ex1: -1, top: 99, gy: -1 };
    var hy = 99; for (var y0 = 0; y0 < N && hy === 99; y0++) for (var x0 = 0; x0 < N; x0++) { var k0 = g[y0][x0]; if ((k0 === 'R' || k0 === 'P' || k0 === 'E')) { hy = y0; break; } }
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) { var k = g[y][x]; if (!k || k === 'A') continue; a.top = Math.min(a.top, y); if (y <= 29) a.gy = Math.max(a.gy, y);
            if (SUIT[k]) { a.by0 = Math.min(a.by0, y); a.by1 = Math.max(a.by1, y); a.bx0 = Math.min(a.bx0, x); a.bx1 = Math.max(a.bx1, x); }
      if ((k === 'R' || k === 'P' || k === 'E') && y < 24) { if (a.ey < 0) a.ey = y; a.ey1 = y; a.ex0 = Math.min(a.ex0, x); a.ex1 = Math.max(a.ex1, x); } }
    /* head box from his geometry (adult head ellipse x 10.2..22.6, y 6.6..16.6, through the stage scale and the bob), so the ears and the body never count as face */
    if (stage > 0) { var t = SCALE[Math.max(1, Math.min(5, stage | 0))], bob = frame === 1 ? -1 : 0, P2 = function (X, Y) { return [Math.round(15.5 + (X - 15.5) * t - 0.5), Math.round(28.5 + (Y - 28.5) * t - 0.5) + bob]; };
      var h0 = P2(10.4, 6.8), h1 = P2(22.4, 16.4); a.fx0 = h0[0]; a.fy0 = h0[1]; a.fx1 = h1[0]; a.fy1 = h1[1]; }
    if (a.fy0 === 99) { a.fy0 = 8; a.fy1 = 16; a.fx0 = 10; a.fx1 = 22; }
    if (a.by0 === 99) { a.by0 = Math.max(0, a.fy1 + 1); a.by1 = Math.min(29, a.fy1 + 6); a.bx0 = a.fx0; a.bx1 = a.fx1; }
    if (a.ey < 0) { a.ey = a.fy0 + 2; a.ey1 = a.ey; a.ex0 = a.fx0 + 2; a.ex1 = a.fx1 - 2; } return a; }
  function draw(stage, frame, gear) {
    var g = base(stage, frame), Gr = gear || {}; stage = Math.max(0, Math.min(5, stage | 0));
    if (stage === 0 || !Object.keys(Gr).length) return g;
    var A = anchors(stage, frame), orig = g.map(function (r) { return r.slice(); }), put = {}, dyb = frame === 1 ? -1 : 0;
    function set(x, y, k) { if (x >= 0 && y >= 0 && x < N && y < N && k) { g[y][x] = k; put[y * N + x] = 1; } }
    function under(x, y, k) { if (x >= 0 && y >= 0 && x < N && y < N && !g[y][x]) set(x, y, k); }
    function kind(sl) { return Gr[sl] ? String(Gr[sl].label || Gr[sl].item || '').toLowerCase() : ''; }
    function col(sl, i) { var x = Gr[sl], c = x && x.cols; return (c && (c[i || 0] || c[0])) || (i ? '#c98a00' : '#ffd23f'); }
    function iid(sl) { return Gr[sl] && Gr[sl].item; }
    var fw = A.fx1 - A.fx0 + 1, cx = Math.round((A.fx0 + A.fx1) / 2);
    if (Gr.back) { var c0 = col('back'), c1 = col('back', 1); for (var yb = A.by0 - 2; yb <= Math.min(29, A.by1); yb++) { var fl = Math.round((yb - A.by0 + 2) / 3);
      for (var d = 1; d <= 2 + fl; d++) { under(A.bx0 - 3 - d, yb, d === 2 + fl ? c1 : c0); under(A.bx1 + d, yb, d === 2 + fl ? c1 : c0); } } }
    if (iid('body') === 'wr-waistcoat') { for (var ys = A.by0; ys <= A.by1; ys++) for (var xs = A.bx0 - 2; xs <= A.bx1; xs++) if (SUIT[g[ys][xs]] || (xs >= A.bx0 - 2 && ys >= A.by0 && g[ys][xs] === 'W' && ys <= A.by1 - 1)) { var mid = Math.round((A.bx0 + A.bx1) / 2);
        set(xs, ys, xs === mid ? ((ys - A.by0) % 2 ? WRC.v : WRC.K) : (((xs + ys) % 4 === 0 || (xs - ys + 64) % 4 === 0) ? WRC.v : WRC.V)); } }
    else if (Gr.body) { var b0 = col('body'), b1 = col('body', 1), arm = /armor|armour|plate|mail|chest/.test(kind('body'));
      for (var y2 = A.by0; y2 <= A.by1; y2++) for (var x2 = A.bx0; x2 <= A.bx1; x2++) if (SUIT[g[y2][x2]]) set(x2, y2, arm ? ((y2 - A.by0) % 3 === 0 ? b1 : b0) : ((x2 - A.bx0) % 3 === 0 ? b1 : b0)); }
    if (Gr.feet) { var f0 = col('feet'), f1 = col('feet', 1); for (var fy = 0; fy < N; fy++) for (var fx = 0; fx < N; fx++) { var kf = orig[fy][fx]; if ((kf === 'W' || kf === 'S') && fy >= A.gy - 1 + (stage < 3 ? 0 : 0) && fy <= A.gy) set(fx, fy, fy === A.gy ? f1 : f0); } }
    if (Gr.face) { var gk = kind('face'), g0 = col('face'), g1 = col('face', 1); var eA = A.ey1 > A.ey ? A.ey + 1 : A.ey, eB = Math.max(eA, Math.min(A.ey1, A.ey + 2)); /* Baby: one eye row, the lenses sit on it */
      if (iid('face') === 'wr-shades') { for (var xe = A.ex0 - 1; xe <= A.ex1; xe++) for (var yy = eA; yy <= eB; yy++) set(xe, yy, yy === eA ? WRC.D : ((xe + yy) % 3 ? WRC.D : WRC.d)); set(A.ex0 - 2, eA, WRC.D); set(A.ex0 - 3, eA, WRC.D); }
      else if (/shade|sunglass|goggle|visor|laser|beam|glass|monocle|mask/.test(gk)) { for (var xe2 = A.ex0; xe2 <= A.ex1; xe2++) for (var yy2 = eA; yy2 <= eB; yy2++) set(xe2, yy2, yy2 === eA ? g0 : (xe2 % 2 ? g0 : g1)); }
      else if (/tear/.test(gk)) set(A.ex0 + 1, A.ey1 + 1, g0);
      else if (/cig|pipe|cigar|joint|straw|lolli/.test(gk)) { var my = Math.min(29, A.ey1 + 4); set(A.fx1 - 1, my, g0); set(A.fx1, my, g0); set(A.fx1 + 1, my, g1); }
      else { set(A.ex0 - 1, A.ey1 + 1, g0); set(A.ex1 + 1, A.ey1 + 1, g0); } }
    if (Gr.head) { var hk = kind('head'), h0 = col('head'), h1 = col('head', 1), ht = A.fy0;
      if (/crown|tiara/.test(hk)) { for (var xc = A.fx0 + 2; xc <= A.fx1 - 3; xc++) { set(xc, ht - 1, h0); if ((xc - A.fx0) % 2) set(xc, ht - 2, h0); } set(cx, ht - 1, h1); }
      else if (/band|hachimaki|halo|bandana|headband/.test(hk)) { for (var xh = A.fx0; xh <= A.fx1 - 2; xh++) set(xh, /halo/.test(hk) ? Math.max(0, A.top - 1) : ht + 1, h0); }
      else { var hh = fw > 9 ? 3 : 2; for (var yh = ht - hh + 1; yh <= ht + 1; yh++) for (var xk = A.fx0 + 1; xk <= A.fx1 - 3; xk++) set(xk, yh, (yh === ht - hh + 1 && (xk === A.fx0 + 1 || xk === A.fx1 - 3)) ? null : h0);
        for (var xb = A.fx0 - 1; xb <= A.fx1 - 2 + (/cap|visor/.test(hk) ? 2 : 0); xb++) set(xb, ht + 2, h1); } }
    if (Gr.weapon) { var wx = Math.min(29, A.bx1 + 3), wy = Math.min(28, A.by1 - 1); set(wx, wy, 'o'); set(wx, wy - 1, 'n'); set(wx - 1, wy - 2, 'y'); set(wx, wy - 2, 'y'); set(wx + 1, wy - 2, 'y'); for (var tb = 3; tb < 12; tb++) set(wx, wy - tb, tb === 11 ? 'W' : (tb % 3 ? '#c8d0da' : 'W')); }
    if (Gr.hand) { var hx = Gr.weapon ? Math.max(1, A.bx0 - 5) : Math.min(28, A.bx1 + 2), hy = Math.min(27, A.by0 + 3), ak = kind('hand'), a0 = col('hand'), a1 = col('hand', 1);
      if (iid('hand') === 'wr-pocket-watch') { var WT = ['..HG..', '.H..g.', '.HGGG.', 'HFFhFg', 'GFFhFg', 'GFhhFg', 'GFFFFg', '.gggg.'] /* gold v2: game gold #fff1a8 / #ffd23f / #c98a00, lit top-left */, tick = frame % 2; /* chain loop on top, the hand ticks between frames */
        for (var yw = 0; yw < 8; yw++) for (var xw = 0; xw < 6; xw++) { var q = WT[yw][xw]; if (q === '.') continue; if (tick && q === 'h' && yw === 3) q = 'F'; if (tick && yw === 4 && xw === 4) q = 'h'; set(hx - 2 + xw, hy - 6 + yw, WRC[q]); } }
      else if (iid('hand') === 'wr-drink-me') { var BT = ['.TT.', '.qq.', 'QQQQ', 'QqQQ', 'QQQQ', 'qqqq']; for (var yd = 0; yd < 6; yd++) for (var xd = 0; xd < 4; xd++) { var q2 = BT[yd][xd]; if (q2 !== '.') set(hx - 1 + xd, hy - 4 + yd, WRC[q2]); } }
      else if (/mug|cup|coffee|tea|bowl|beer|drink/.test(ak)) { for (var xm = hx; xm <= hx + 2; xm++) for (var ym = hy - 2; ym <= hy; ym++) set(xm, ym, a0); set(hx + 1, hy - 2, a1); set(hx + 2, hy - 2, a1); }
      else if (/sword|staff|stick|dagger|wand|torch|spear|candle|bat|banner|flag|axe|hammer|pole|rod|lance|scepter|sceptre/.test(ak)) { for (var t = 0; t < 8; t++) set(hx, hy - t, t > 5 ? a1 : a0); }
      else { for (var xq = hx; xq <= hx + 2; xq++) for (var yq = hy - 2; yq <= hy; yq++) set(xq, yq, a0); set(hx + 1, hy - 1, a1); } }
    Object.keys(put).forEach(function (j) { j = +j; var x = j % N, y = (j / N) | 0; if (!g[y][x]) return; [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (q) { var X = x + q[0], Y = y + q[1]; if (X >= 0 && Y >= 0 && X < N && Y < N && !g[Y][X] && !orig[Y][X]) g[Y][X] = 'n'; }); });
    return g; }
  function render(stage, frame, bg, gear, opts) { var g = draw(stage, frame, gear), P = Object.assign({}, PAL, (opts && opts.pal) || {}), B = hexRgb(typeof bg === 'string' ? bg : '#142018'), d = [];
    if (Array.isArray(bg)) B = bg.slice(0, 3);
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) { var k = g[y][x], c = k ? hexRgb(P[k] || k) : B; d.push(c[0], c[1], c[2], 255); } return { width: N, height: N, data: d }; }
  function frames(stage, bg, gear, opts) { return [0, 1, 2, 3].map(function (f) { return render(stage, f, bg, gear, opts); }); }
  return { WR_WATCH: WR_WATCH, WRC: WRC, STAGES: STAGES, PAL: PAL, PAL_COMMUNITY: {}, SKIN: SKIN, SUIT: SUIT, EARS: EARS, render: render, frames: frames, draw: draw, anchors: anchors };
});
