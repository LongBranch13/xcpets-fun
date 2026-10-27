/* HOMER PEPE sprite (PREVIEW, branch homerpepe-community, Oct 26 2026): community pet #5 candidate. NOT loaded by any page; the rules use it only when
 * ACTIVATE_HOMER_BLOCK is set (null = off). Reference: design/ref/homer-pepe-card.jpg (the famous Rare Pepe card "HOMER PEPE", 1/1). Character only
 * (owner Oct 26 2026): no card frame, sky, clouds, card text, hearts, stats or rareness line anywhere in his art.
 * Look: Pepe-green skin on Homer Simpson's head shape (tall bald dome, two hair curls on top, side ear, forward muzzle), bulging close-set white eyes
 * with small dark pupils, a small narrow red-orange Pepe lip on a long muzzle, a short white collar (v3 Oct 26: smaller eyes/mouth, taller head, less shirt). Faces right (viewer's right), like the card.
 * Same API as KekSprite/FuntrumpSprite: draw(stage, frame, gear) -> 32x32 key grid; render(stage, frame, bg, gear, opts) -> {width,height,data:[RGBA]};
 * frames(stage, bg, gear, opts) -> 4 frames; anchors(stage, frame). Stages 0 Egg..5 Mythic, 4 idle frames (1px bob on frame 1, blink on frame 2).
 * Evolution = size + expression (Elder stubble shade on the muzzle) + the shared Mythic gold rim. No built-in hat: every gear slot is free.
 * opts.pal recolours by palette key (hybrids: skin G/g/h, shirt w/W/C, lips L/l). */
(function (root, factory) { if (typeof module === 'object' && module.exports) module.exports = factory(); else root.HomerSprite = factory(); })(this, function () {
  'use strict';
  var N = 32, PAL = { n: '#1a1020', G: '#5aa83c', g: '#468a2e', h: '#7cc55a', E: '#f4f4ee', P: '#111111', L: '#e0582e', l: '#a8331c',
    w: '#f4f4ee', W: '#ffffff', C: '#b9bcc4', A: '#ffc93c', y: '#ffd23f', o: '#c49a1a', B: '#e0582e', '#': '#ffffff' };
  var STAGES = ['Egg', 'Hatchling', 'Juvenile', 'Adult', 'Elder', 'Mythic'];
  var SKIN = { G: 1, g: 1, h: 1 }, SUIT = { w: 1, W: 1, C: 1 };
  /** HOMER_DONUT: signature Grip IDEA only (open design question; display record, NOT in any gear pool or BY_ID). */
  var HOMER_DONUT = { slot: 'hand', item: 'homer-donut', label: 'Pink-frosted donut (idea)', tier: 'legendary', legendary: true, signature: true, exclusive: 'homer', idea: true };
  var SCALE = [0.62, 0.64, 0.78, 0.9, 0.96, 1.0];
  function hexRgb(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
  function el(x, y, cx, cy, rx, ry) { var a = (x - cx) / rx, b = (y - cy) / ry; return a * a + b * b; }
  /* key at an ADULT-space point (ground 28.5); later rules overwrite earlier ones */
  /* HEAD: silhouette traced from design/ref/homer-pepe-card.jpg (v5, Oct 26 2026): card crop (95,75)-(235,250), 6.25 card px per sprite unit,
   * sampled at half-unit cells. '#' head skin, 'h' light muzzle, 'L' lip area, '.' empty. Origin (HX, HY) in adult space. The card pose already has
   * Homer's head tilted back (muzzle up, skull sloping down behind), which is the approved v4 tilt. */
  var HX = 4.5, HY = 3.0, HEAD = [".......########.................", ".....#############..............", "....################............", "...##################...........", "...###################..........", "..####################..........", ".######################.........", ".#######################........", ".#######################........", "########################........", "#########################.......", "#########################.......", "##########################......", "##########################......", ".#########################......", ".##########################.....", "..##########################....", "..###########################...", "..###########################...", "..###########################...", "..##########################....", "...#########################....", "....#########################...", "....#########################...", ".....########################...", ".....#####################h#....", ".....#############hhhhhhhhh#....", "....############hhhhhhhhhhhh#...", "....##########hhhhhhhhhhhhhhh...", "....#########hhhhhhhhhhhhhhhh#..", "....#########hhhhhhhhhhhhhhhh#..", ".....#######hhhhhhhhhhhhhhhhhh..", ".....######hhhhhhhhhhhhhhhhh##..", ".....######hhhh##hhhhhhhhhh#L...", ".....######hhh#LLLLLLLLLLLLLL...", ".....######hhhh#LLLLLLLLLL......", ".....######hhhhh##LLLLLLLL......", "....########hhhhhhhhhhhh#.......", ".....########hhhhhhhhhhh#.......", ".....########hhhhhhhhhh#........", "......#########hhhhhhh#.........", "........#########hhh###.........", "..........#############.........", "..............#########.........", ".................######.........", "..................#####.........", "..................#####.........", "...................####.........", "................................", "................................", "................................", "................................"];
  function head(x, y) { var i = Math.floor((x - HX) * 2), j = Math.floor((y - HY) * 2); if (j < 0 || j >= HEAD.length || i < 0 || i >= HEAD[j].length) return null; var c = HEAD[j][i]; return c === '.' ? null : c; }
  /* key at an ADULT-space point (ground 28.5); later rules overwrite earlier ones */
  var HK = 1.12, HX2 = 3.6, HY2 = 1.5; /* v6: the whole traced head scaled up evenly by HK (same proportions); v5 unit space -> adult space */
  function rim(x, y, cx, cy, rx, ry) { var q = 0.95 / HK; return el(x, y, cx, cy, rx - q, ry - q) >= 1; } /* one-pixel ink ring */
  function fwd(x, y) { return [HX2 + (x - HX) * HK, HY2 + (y - HY) * HK]; }
  var NOSE_DX = 1 / HK, LEX = 11.9; /* v9: left eye = mirror of the right eye's shape (2.6 x 3.0), sharing its outline */
  var NOSE = [18.4 + NOSE_DX, 15.5, 2.0, 1.7]; /* v9: nose centre moved out one sprite pixel */
  function inNose(x, y) { return el(x, y, NOSE[0], NOSE[1], NOSE[2], NOSE[3]) < 1; }
  function keyAt(X, Y, stage, blink) { var k = null, d, c, x = HX + (X - HX2) / HK, y = HY + (Y - HY2) / HK;   // x,y = point in the traced (v5) head space
    if (Y >= 24.5 && el(X, Y, 14.5, 31, 7, 7) < 1) k = (X > 19 ? 'C' : 'w');                                         // shirt (short, v3)
    if (Y < 25.6 && (c = head(x, y))) k = c === '#' ? (x < 7.4 || (y > 21 && x < 10) ? 'g' : 'G') : (y > 21.6 ? 'g' : 'h'); // traced head; light muzzle like the card, stubble shade on the chin
    if (Y >= 24 && Y <= 26.2) { var ax = Math.abs(X - 14.5); if (ax >= 0.9 && ax <= 1.0 + (26.2 - Y) * 1.3) k = (ax >= 1.0 + (26.2 - Y) * 1.3 - 0.8 ? 'C' : 'W'); } // collar points
    if (el(x, y, 12.0, 5.6, 2.2, 1.8) < 1 && head(x, y) === '#') k = 'h';                                              // dome shine
    if ((d = el(x, y, 6.6, 17.0, 1.35, 1.8)) < 1) k = (rim(x, y, 6.6, 17.0, 1.35, 1.8) ? 'n' : (Math.abs(x - 6.8) < 0.3 && Math.abs(y - 17.1) < 0.8 ? 'g' : 'G'));  // ear (card): own ink ring + inner fold, below the side hair
    var u = (x - 15.4) / 3.4, f = 20.5 - 0.9 * u * u - 0.25 * u;                                     // lip (card): long sagging smile (11.9,19.9)-(15.8,20.9)-(19.6,19.5)
    if (x >= 12.0 && x <= 18.8) { if (Math.abs(y - f) <= 0.6) k = 'L'; else if (y > f + 0.6 && y <= f + 1.0) k = 'l'; }
    if (inNose(x, y)) k = (rim(x, y, NOSE[0], NOSE[1], NOSE[2], NOSE[3]) ? 'g' : (el(x, y, NOSE[0] - 0.6, NOSE[1] - 0.5, 0.7, 0.5) < 1 ? 'h' : 'G'));  // Homer's nose (v9): one pixel further out, shaded skin edge, no ink ring
    [[LEX, 11.1, 2.6, 3.0], [16.5, 11.1, 2.6, 3.0]].forEach(function (e) { d = el(x, y, e[0], e[1], e[2], e[3]); if (d < 1) { k = rim(x, y, e[0], e[1], e[2], e[3]) ? 'n' : 'E'; if (blink && k === 'E') k = Math.abs(y - e[1]) < 0.6 ? 'n' : 'G';
        else if (k === 'E' && el(x, y, e[0] - 0.1, e[1] + 0.5, 0.85, 0.9) < 1) k = 'P'; } });                               // card eye sizes/centres; touching, one shared outline; small low navy pupils
    return k; }
  function curls(g, t, dy) { /* card hair: two curled strands off the top-left of the dome + zigzag side hair above the ear (ink), v5 space -> adult -> stage scale */
    var pts = [[7.2, 3.0], [6.4, 2.0], [7.4, 1.2],
               [10.0, 2.6], [10.6, 1.4], [11.6, 0.9], [12.4, 1.8],
               [5.3, 13.6], [6.1, 12.8], [6.9, 13.6], [7.7, 12.8]];
    pts.forEach(function (p) { var side = p[1] > 5; p = fwd(p[0], p[1]); var X = Math.round(15 + (p[0] - 15) * t - 0.5), Y = Math.round(28.5 + (p[1] - 28.5) * t - 0.5) + dy; if (t === 1 && Y < 1) Y = 1; if (X >= 0 && Y >= 0 && X < N && Y < N && (!g[Y][X] || g[Y][X] === 'n' || side)) g[Y][X] = 'n'; }); }
  function egg(f) { var g = [], dy = f === 1 ? -1 : 0; for (var y = 0; y < N; y++) { g.push([]); for (var x = 0; x < N; x++) { var yy = y - dy + 0.5, xx = x + 0.5, k = null;
        if (el(xx, yy, 16, 19.5, 7, 9) < 1) { k = 'G'; if (el(xx, yy, 13.5, 15, 2.2, 3) < 1) k = 'h'; if (el(xx, yy, 18.5, 22.5, 1.6, 1.4) < 1 || el(xx, yy, 12.5, 23.5, 1.2, 1.1) < 1 || el(xx, yy, 19.5, 16, 1.1, 1.1) < 1) k = 'g';
          if (yy > 24.2 && yy < 25.6) k = 'W'; }
        g[y].push(k); } }
    [[13, 10], [14, 9], [15, 10], [16, 9], [17, 8], [18, 9]].forEach(function (p) { var Y = p[1] + dy; if (Y >= 0 && !g[Y][p[0]]) g[Y][p[0]] = 'n'; });
    return g; }
  function outline(g, nm) { var o = g.map(function (r) { return r.slice(); });
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) if (!g[y][x] && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(function (q) { var X = x + q[0], Y = y + q[1]; return X >= 0 && Y >= 0 && X < N && Y < N && g[Y][X] && g[Y][X] !== 'n' && !(nm && nm[Y][X]); })) o[y][x] = 'n';
    return o; }
  function base(stage, frame) { var s = Math.max(0, Math.min(5, stage | 0)), f = ((frame | 0) % 4 + 4) % 4, g, nm = null;
    if (s === 0) g = egg(f);
    else { var t = SCALE[s], dy = f === 1 ? -1 : 0; g = []; nm = [];
      for (var y = 0; y < N; y++) { g.push([]); nm.push([]); for (var x = 0; x < N; x++) { var sx = 15 + (x + 0.5 - 15) / t, sy = 28.5 + (y - dy + 0.5 - 28.5) / t; g[y].push(y - dy > 29 ? null : keyAt(sx, sy, s, f === 2)); nm[y].push(y - dy <= 29 && !head(HX + (sx - HX2) / HK, HY + (sy - HY2) / HK) && inNose(HX + (sx - HX2) / HK, HY + (sy - HY2) / HK)); } }
    }
    var o = outline(g, nm); if (s > 0) curls(o, SCALE[s], f === 1 ? -1 : 0);
    if (s === 5) { var o2 = o.map(function (r) { return r.slice(); }); /* shared Mythic gold rim */
      for (var ry = 0; ry < 30; ry++) for (var rx = 0; rx < N; rx++) if (!o[ry][rx] && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(function (q) { var X = rx + q[0], Y = ry + q[1]; return X >= 0 && Y >= 0 && X < N && Y < N && o[Y][X] === 'n'; })) o2[ry][rx] = 'A';
      o = o2; }
    return o; }
  /** anchors(stage, frame): measured on his own frame (face, eyes, shirt, ground), so gear lands on him at every stage. */
  function anchors(stage, frame) { var g = base(stage, frame === 2 ? 0 : frame), a = { fy0: 99, fy1: -1, fx0: 99, fx1: -1, by0: 99, by1: -1, bx0: 99, bx1: -1, ey: -1, ey1: -1, ex0: 99, ex1: -1, top: 99 };
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) { var k = g[y][x]; if (!k || k === 'A') continue; a.top = Math.min(a.top, y);
      if (SKIN[k] && y < 20) { a.fy0 = Math.min(a.fy0, y); a.fy1 = Math.max(a.fy1, y); a.fx0 = Math.min(a.fx0, x); a.fx1 = Math.max(a.fx1, x); }
      if (SUIT[k]) { a.by0 = Math.min(a.by0, y); a.by1 = Math.max(a.by1, y); a.bx0 = Math.min(a.bx0, x); a.bx1 = Math.max(a.bx1, x); }
      if ((k === 'E' || k === 'P') && y < 24) { if (a.ey < 0) a.ey = y; a.ey1 = y; a.ex0 = Math.min(a.ex0, x); a.ex1 = Math.max(a.ex1, x); } }
    if (a.by0 === 99) { a.by0 = Math.max(0, a.fy1 - 3); a.by1 = Math.min(29, a.fy1 + 2); a.bx0 = a.fx0; a.bx1 = a.fx1; }
    if (a.ey < 0) { a.ey = a.fy0 + 2; a.ey1 = a.ey; a.ex0 = a.fx0 + 2; a.ex1 = a.fx1 - 2; } return a; }
  function draw(stage, frame, gear) {
    var g = base(stage, frame), Gr = gear || {}; stage = Math.max(0, Math.min(5, stage | 0));
    if (stage === 0 || !Object.keys(Gr).length) return g;
    var A = anchors(stage, frame), orig = g.map(function (r) { return r.slice(); }), put = {};
    function set(x, y, k) { if (x >= 0 && y >= 0 && x < N && y < N && k) { g[y][x] = k; put[y * N + x] = 1; } }
    function under(x, y, k) { if (x >= 0 && y >= 0 && x < N && y < N && !g[y][x]) set(x, y, k); }
    function kind(sl) { return Gr[sl] ? String(Gr[sl].label || Gr[sl].item || '').toLowerCase() : ''; }
    function col(sl, i) { var x = Gr[sl], c = x && x.cols; return (c && (c[i || 0] || c[0])) || (i ? '#c49a1a' : '#ffd23f'); }
    var fw = A.fx1 - A.fx0 + 1, cx = Math.round((A.fx0 + A.fx1) / 2);
    if (Gr.back) { var c0 = col('back'), c1 = col('back', 1); for (var yb = A.by0; yb <= Math.min(29, A.by1); yb++) { var fl = Math.round((yb - A.by0) / 3);
      for (var d = 1; d <= 2 + fl; d++) { under(A.bx0 - d, yb, d === 2 + fl ? c1 : c0); under(A.bx1 + d, yb, d === 2 + fl ? c1 : c0); } } }
    if (Gr.body) { var b0 = col('body'), b1 = col('body', 1), arm = /armor|armour|plate|mail|chest/.test(kind('body'));
      for (var y2 = A.by0; y2 <= A.by1; y2++) for (var x2 = A.bx0; x2 <= A.bx1; x2++) if (SUIT[g[y2][x2]]) set(x2, y2, arm ? ((y2 - A.by0) % 3 === 0 ? b1 : b0) : ((x2 - A.bx0) % 3 === 0 ? b1 : b0)); }
    if (Gr.feet) { var f0 = col('feet'), f1 = col('feet', 1), gy = Math.min(30, A.by1 + 1); for (var xf = A.bx0; xf <= A.bx1; xf++) { if (Math.abs(xf - (A.bx0 + A.bx1) / 2) < 1) continue; set(xf, gy, xf < (A.bx0 + A.bx1) / 2 ? f0 : f1); } }
    if (Gr.face) { var gk = kind('face'), g0 = col('face'), g1 = col('face', 1);
      if (/shade|sunglass|goggle|visor|laser|beam|glass|monocle|mask/.test(gk)) { for (var xe = A.ex0; xe <= A.ex1; xe++) for (var yy = A.ey + 1; yy <= Math.min(A.ey1 - 1, A.ey + 3); yy++) set(xe, yy, yy === A.ey + 1 ? g0 : (xe % 2 ? g0 : g1)); }
      else if (/tear/.test(gk)) set(A.ex0 + 1, A.ey1 + 1, g0);
      else if (/cig|pipe|cigar|joint|straw|lolli/.test(gk)) { var my = Math.min(29, A.ey1 + 4); set(A.fx1 - 1, my, g0); set(A.fx1, my, g0); set(A.fx1 + 1, my, g1); }
      else { set(A.ex0 - 1, A.ey1 + 1, g0); set(A.ex1 + 1, A.ey1 + 1, g0); } }
    if (Gr.head) { var hk = kind('head'), h0 = col('head'), h1 = col('head', 1), ht = A.fy0;
      if (/crown|tiara/.test(hk)) { for (var xc = A.fx0 + 2; xc <= A.fx1 - 4; xc++) { set(xc, ht - 1, h0); if ((xc - A.fx0) % 2) set(xc, ht - 2, h0); } set(cx - 1, ht - 1, h1); }
      else if (/band|hachimaki|halo|bandana|headband/.test(hk)) { for (var xh = A.fx0; xh <= A.fx1 - 3; xh++) set(xh, /halo/.test(hk) ? Math.max(0, A.top - 1) : ht + 2, h0); }
      else { var hh = fw > 9 ? 3 : 2; for (var yh = ht - hh + 1; yh <= ht + 1; yh++) for (var xk = A.fx0 + 1; xk <= A.fx1 - 4; xk++) set(xk, yh, (yh === ht - hh + 1 && (xk === A.fx0 + 1 || xk === A.fx1 - 4)) ? null : h0);
        for (var xb = A.fx0 - 1; xb <= A.fx1 - 3 + (/cap|visor/.test(hk) ? 3 : 0); xb++) set(xb, ht + 2, h1); } }
    if (Gr.weapon) { var wx = Math.min(29, A.bx1 + 3), wy = Math.min(28, A.by1 - 1); set(wx, wy, 'o'); set(wx, wy - 1, 'n'); set(wx - 1, wy - 2, 'y'); set(wx, wy - 2, 'y'); set(wx + 1, wy - 2, 'y'); for (var tb = 3; tb < 12; tb++) set(wx, wy - tb, tb === 11 ? 'W' : (tb % 3 ? '#c8d0da' : 'W')); }
    if (Gr.hand) { var hx = Gr.weapon ? Math.max(1, A.bx0 - 4) : Math.min(29, A.bx1 + 2), hy = Math.min(28, A.by1 - 1), ak = kind('hand'), a0 = col('hand'), a1 = col('hand', 1);
      if (/mug|cup|coffee|tea|bowl|beer|drink/.test(ak)) { for (var xm = hx; xm <= hx + 2; xm++) for (var ym = hy - 2; ym <= hy; ym++) set(xm, ym, a0); set(hx + 1, hy - 2, a1); set(hx + 2, hy - 2, a1); }
      else if (/sword|staff|stick|dagger|wand|torch|spear|candle|bat|banner|flag|axe|hammer|pole|rod|lance|scepter|sceptre/.test(ak)) { for (var t = 0; t < 8; t++) set(hx, hy - t, t > 5 ? a1 : a0); }
      else { for (var xq = hx; xq <= hx + 2; xq++) for (var yq = hy - 2; yq <= hy; yq++) set(xq, yq, a0); set(hx + 1, hy - 1, a1); } }
    Object.keys(put).forEach(function (j) { j = +j; var x = j % N, y = (j / N) | 0; if (!g[y][x]) return; [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (q) { var X = x + q[0], Y = y + q[1]; if (X >= 0 && Y >= 0 && X < N && Y < N && !g[Y][X] && !orig[Y][X]) g[Y][X] = 'n'; }); });
    return g; }
  function render(stage, frame, bg, gear, opts) { var g = draw(stage, frame, gear), P = Object.assign({}, PAL, (opts && opts.pal) || {}), B = hexRgb(bg || '#142018'), d = [];
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) { var k = g[y][x], c = k ? hexRgb(P[k] || k) : B; d.push(c[0], c[1], c[2], 255); } return { width: N, height: N, data: d }; }
  function frames(stage, bg, gear, opts) { return [0, 1, 2, 3].map(function (f) { return render(stage, f, bg, gear, opts); }); }
  return { HOMER_DONUT: HOMER_DONUT, STAGES: STAGES, PAL: PAL, PAL_COMMUNITY: {}, SKIN: SKIN, SUIT: SUIT, render: render, frames: frames, draw: draw, anchors: anchors };
});
