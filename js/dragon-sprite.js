/* ORANGE DRAGON sprite (1 of 1, PREVIEW, branch orange-dragon-1of1, owner Nov 4 2026: a 1 of 1 orange dragon egg for a player, recipient not known yet).
 * NOT used by any rule: V2Rules.ACTIVATE_DRAGON_BLOCK is null (OFF) and DRAGON_TO is a placeholder. Same frame format and API as VikingSprite
 * (32x32 key grid, render -> {width,height,data RGBA}, frames -> 4 idle frames, ink outline).
 * Egg (stage 0): orange scaled shell, two cream horn nubs and a spike ridge on top, a zig-zag crack with a warm amber glow INSIDE the crack only.
 *   Idle: f0 rest, f1 wobble left, f2 rest + crack glint, f3 wobble right.
 * Baby dragon (stages 1-5): orange scales, cream belly plates, horn nubs that grow, back spikes, wings that grow with the stage, curled tail.
 * No fire aura, no flame crown, no gold frame / rim, no flame halo. The Mythic look is brighter ember scales on the wings and spikes only. */
(function (root, factory) { if (typeof module === 'object' && module.exports) module.exports = factory(); else root.DragonSprite = factory(); })(this, function () {
  'use strict';
  var N = 32, PAL = { n: '#1a1420',
    O: '#f07a1e', o: '#c0520e', d: '#8a3608', L: '#ffa24a',          // orange scales: base, shade, deep shade, light
    C: '#f6e2b0', c: '#d8b878',                                        // cream belly / horns
    G: '#ffd24a', g: '#ff9a1a', Y: '#fff6c8',                          // warm crack glow: amber, deep amber, glint
    E: '#f4f2ea', P: '#141018', m: '#7a2a22',                          // eyes, mouth
    W: '#d85a14', w: '#9a3a0a', K: '#ffb86a',                          // wing membrane, wing bone, Mythic ember edge
    T: '#6a2a06' };                                                    // claws
  var STAGES = ['Egg', 'Hatchling', 'Juvenile', 'Adult', 'Elder', 'Mythic'];
  /* per stage: head half-width, head rows, body half-width, body rows, horn length, wing span, tail length */
  var DIM = [null, { hw: 5, hh: 6, bw: 4, bh: 5, hn: 1, wg: 0, tl: 2 }, { hw: 5, hh: 6, bw: 5, bh: 6, hn: 1, wg: 2, tl: 3 },
    { hw: 6, hh: 7, bw: 5, bh: 7, hn: 2, wg: 3, tl: 4 }, { hw: 6, hh: 7, bw: 6, bh: 8, hn: 2, wg: 4, tl: 5 }, { hw: 6, hh: 7, bw: 6, bh: 8, hn: 3, wg: 5, tl: 5 }];
  function grid() { var g = []; for (var i = 0; i < N; i++) g.push(new Array(N).fill(null)); return g; }
  function set(g, x, y, k) { if (x >= 0 && y >= 0 && x < N && y < N) g[y][x] = k; }
  function get(g, x, y) { return x >= 0 && y >= 0 && x < N && y < N ? g[y][x] : null; }
  function hline(g, x0, x1, y, k) { for (var x = x0; x <= x1; x++) set(g, x, y, k); }
  function mir(x) { return 31 - x; }
  function both(g, x, y, k) { set(g, x, y, k); set(g, mir(x), y, k); }
  function outline(g) { var o = g.map(function (r) { return r.slice(); }); for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) if (!g[y][x]) {
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(function (d) { var X = x + d[0], Y = y + d[1]; return X >= 0 && Y >= 0 && X < N && Y < N && g[Y][X]; })) o[y][x] = 'n'; } return o; }
  function hexRgb(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
  /* scale shading: scallop rows, lit left, shaded right */
  function scale(x, y, x0, x1) { var w = x1 - x0, t = (x - x0) / Math.max(1, w); if (t < 0.18) return 'L'; if (t > 0.8) return 'o';
    return ((y % 3 === 0) && ((x + (y % 6 === 0 ? 0 : 2)) % 4 === 0)) ? 'o' : 'O'; }
  function egg(frame) { var g = grid(), tilt = frame === 1 ? -1 : frame === 3 ? 1 : 0, glint = frame === 2;
    var top = 11, H = 18;
    for (var y = 0; y < H; y++) { var v = (y - 9) / 9, hw = Math.round(Math.sqrt(Math.max(0, 1 - v * v)) * (y < 9 ? 6.5 : 7.5)), sh = y < 6 ? tilt : y < 12 ? (tilt ? tilt : 0) * 0 : 0;
      var off = y < 7 ? tilt : 0, x0 = 16 - hw + off, x1 = 16 + hw - 1 + off;
      for (var x = x0; x <= x1; x++) set(g, x, top + y, scale(x, top + y, x0, x1)); }
    /* horn nubs + spike ridge on the crown of the shell */
    var t0 = top, cx = 16 + tilt;
    set(g, cx - 4, t0 + 1, 'C'); set(g, cx - 4, t0, 'c'); set(g, cx - 5, t0 - 1, 'c');
    set(g, cx + 3, t0 + 1, 'C'); set(g, cx + 3, t0, 'c'); set(g, cx + 4, t0 - 1, 'c');
    set(g, cx - 1, t0 - 1, 'C'); set(g, cx, t0 - 1, 'C'); set(g, cx - 1, t0 - 2, 'c');
    set(g, cx - 2, t0, 'C'); set(g, cx + 1, t0, 'C');
    /* belly band of cream scales low on the shell */
    for (var xb = 12; xb <= 19; xb++) if ((xb + 1) % 2) set(g, xb, top + 15, 'c');
    /* zig-zag crack with the warm glow inside it (glow never leaves the shell: no halo) */
    var crack = [[10, 19], [11, 18], [12, 19], [13, 20], [14, 19], [15, 18], [16, 19], [17, 20], [18, 19], [19, 18], [20, 19], [21, 20]];
    crack.forEach(function (p, i) { var x = p[0], y = p[1] + top - 11; if (!get(g, x, y)) return; set(g, x, y, i % 3 === 1 ? 'G' : 'g');
      if (get(g, x, y + 1) && i % 2 === 0) set(g, x, y + 1, 'd'); });
    /* small side fissure off the main crack */
    [[15, 17], [14, 16]].forEach(function (p) { if (get(g, p[0], p[1] + top - 11)) set(g, p[0], p[1] + top - 11, 'g'); });
    if (glint) { set(g, 16, 19 + top - 11, 'Y'); set(g, 15, 18 + top - 11, 'Y'); set(g, 12, 19 + top - 11, 'G'); set(g, 12, 14 + top - 11, 'Y'); }
    return outline(g); }
  function draw(stage, frame, gear, opts) {
    if (!stage) return egg(frame || 0);
    var g = grid(), bob = [0, -1, -1, 0][frame || 0], flap = frame === 1 || frame === 2 ? -1 : 0, D = DIM[stage], myth = stage === 5, cx = 16;
    var bodyEnd = 27 + bob, bodyTop = bodyEnd - D.bh + 1, headBot = bodyTop, headTop = headBot - D.hh + 1;
    /* wings behind the body (Juvenile+): bone along the top edge, membrane below, ember edge at Mythic */
    if (D.wg) for (var i = 0; i < D.wg + 2; i++) { var wx = cx - D.bw - 1 - i, wy = bodyTop + 1 - Math.floor(i * 0.8) + flap;
      set(g, wx, wy, 'w'); for (var j = 1; j <= Math.max(1, D.wg + 1 - i); j++) set(g, wx, wy + j, myth && j === Math.max(1, D.wg + 1 - i) ? 'K' : 'W');
      set(g, mir(wx), wy, 'w'); for (var j2 = 1; j2 <= Math.max(1, D.wg + 1 - i); j2++) set(g, mir(wx), wy + j2, myth && j2 === Math.max(1, D.wg + 1 - i) ? 'K' : 'W'); }
    /* tail curling out to the viewer's right */
    for (var t = 0; t < D.tl; t++) set(g, cx + D.bw + t, bodyEnd - Math.floor(t / 2), t % 2 ? 'o' : 'O');
    set(g, cx + D.bw + D.tl, bodyEnd - Math.floor(D.tl / 2) - 1, myth ? 'K' : 'L');
    /* body */
    for (var y = bodyTop; y <= bodyEnd; y++) { var w = y === bodyTop ? D.bw - 1 : D.bw; for (var x = cx - w; x < cx + w; x++) set(g, x, y, scale(x, y, cx - w, cx + w - 1)); }
    /* belly plates */
    for (var yb = bodyTop + 1; yb <= bodyEnd - 1; yb++) { var bw = D.bw - 2; for (var xb = cx - bw; xb < cx + bw; xb++) set(g, xb, yb, yb % 2 ? 'C' : 'c'); }
    /* feet + claws */
    hline(g, cx - D.bw + 1, cx - 2, bodyEnd + 1, 'o'); hline(g, cx + 1, cx + D.bw - 2, bodyEnd + 1, 'o'); set(g, cx - D.bw + 1, bodyEnd + 1, 'T'); set(g, cx + D.bw - 2, bodyEnd + 1, 'T');
    /* little arms */
    set(g, cx - D.bw, bodyTop + 2, 'O'); set(g, cx - D.bw, bodyTop + 3, 'T'); set(g, cx + D.bw - 1, bodyTop + 2, 'o'); set(g, cx + D.bw - 1, bodyTop + 3, 'T');
    /* head: rounded, a bit wider than the body, snout row at the bottom */
    for (var yh = headTop; yh <= headBot; yh++) { var r = yh - headTop, hw = r === 0 ? D.hw - 2 : r === 1 ? D.hw - 1 : D.hw; for (var xh = cx - hw; xh < cx + hw; xh++) set(g, xh, yh, scale(xh, yh, cx - hw, cx + hw - 1)); }
    var ey = headTop + 2, snY = headBot - 1;
    /* big baby eyes */
    set(g, cx - 4, ey, 'E'); set(g, cx - 3, ey, 'E'); set(g, cx - 3, ey + 1, 'P'); set(g, cx - 4, ey + 1, 'E');
    set(g, cx + 2, ey, 'E'); set(g, cx + 3, ey, 'E'); set(g, cx + 2, ey + 1, 'P'); set(g, cx + 3, ey + 1, 'E');
    /* snout: cream muzzle, two nostrils, small smile */
    hline(g, cx - 2, cx + 1, snY, 'C'); hline(g, cx - 3, cx + 2, snY + 1, 'c'); set(g, cx - 2, snY, 'd'); set(g, cx + 1, snY, 'd'); set(g, cx - 1, snY + 1, 'm'); set(g, cx, snY + 1, 'm');
    /* horn nubs (grow with stage) + a spike ridge on the crown */
    for (var h = 0; h < D.hn + 1; h++) { both(g, cx - D.hw + 2 - Math.floor(h / 2), headTop - 1 - h, h === D.hn ? 'c' : 'C'); }
    set(g, cx - 1, headTop - 1, myth ? 'K' : 'L'); set(g, cx, headTop - 1, 'o');
    /* back spikes down the shoulders (Adult+) */
    if (stage >= 3) { both(g, cx - D.bw, bodyTop - 1, myth ? 'K' : 'C'); }
    if (stage >= 4) { set(g, cx - 3, headTop + 1, 'L'); set(g, cx + 3, headTop + 4, 'o'); }   // Elder: a couple of weathered scales
    /* face gear (Guise) over the eye row, like the other 1 of 1 sprites */
    var Gr = gear || {}; if (Gr.face) { var gc = (Gr.face.cols && Gr.face.cols[0]) || '#141018'; hline(g, cx - 4, cx - 3, ey, gc); hline(g, cx + 2, cx + 3, ey, gc); }
    return outline(g); }
  function anchors(stage, frame) { if (!stage) return { ey: -1 }; var g = draw(stage, frame || 0, {}), ey = -1, x0 = 99, x1 = -1, my = -1;
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) { var k = g[y][x]; if (k === 'E' || k === 'P') { if (ey < 0) ey = y; if (y === ey) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); } } if (k === 'm' && my < 0) my = y; }
    return { ey: ey, ex0: x0, ex1: x1, my: my }; }
  function render(stage, frame, bg, gear, opts) { var g = draw(stage, frame, gear, opts), d = [], Bg = hexRgb(bg || '#1b2430'), P = Object.assign({}, PAL, (opts && opts.pal) || {});
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) { var k = g[y][x], c = k ? hexRgb(P[k] || k) : Bg; d.push(c[0], c[1], c[2], 255); } return { width: N, height: N, data: d }; }
  function frames(stage, bg, gear, opts) { return [0, 1, 2, 3].map(function (f) { return render(stage, f, bg, gear, opts); }); }
  return { STAGES: STAGES, PAL: PAL, DIM: DIM, render: render, frames: frames, draw: draw, anchors: anchors };
});
