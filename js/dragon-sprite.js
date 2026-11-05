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
    W: '#4a1c0c', w: '#2a0e06', K: '#ffb86a',                          // dark bat-wing membrane, wing bone, Mythic ember edge
    T: '#6a2a06',                                                     // claws
    X: '#fbfaf2', V: '#ffd800' };                                     // teeth, yellow eye                                                    // claws
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
  /* hatched stages: side view facing the viewer's left, after the GAMESOFTRUMP Dragons Edition dragon (owner Nov 4 2026 'Use this dragon'): long
   * crocodile snout, open jaw with rows of white teeth, yellow eye, swept-back horns/crest, big dark bat wings, heavy body. ORANGE, not maroon. Dragon only:
   * no rider, no flag, no flames. Hatchling/Juvenile = chibi (big head, short snout, tiny teeth); Adult/Elder/Mythic = the full reference dragon. */
  var HD = [null,
    { bx: 18, by: 22, rx: 5, ry: 4, hx: 11, hy: 15, hr: 6, sn: 2, jaw: 1, wg: 4, tl: 4, cr: 2, lg: 2 },
    { bx: 18, by: 22, rx: 6, ry: 4, hx: 11, hy: 14, hr: 6, sn: 3, jaw: 1, wg: 6, tl: 5, cr: 3, lg: 2 },
    { bx: 19, by: 21, rx: 7, ry: 6, hx: 10, hy: 13, hr: 4, sn: 7, jaw: 2, wg: 9, tl: 6, cr: 4, lg: 3 },
    { bx: 19, by: 21, rx: 8, ry: 6, hx: 10, hy: 13, hr: 4, sn: 8, jaw: 3, wg: 10, tl: 6, cr: 5, lg: 3 },
    { bx: 19, by: 21, rx: 8, ry: 6, hx: 10, hy: 12, hr: 4, sn: 9, jaw: 3, wg: 11, tl: 6, cr: 6, lg: 3 }];
  function ell(g, cx, cy, rx, ry, f) { for (var y = -ry; y <= ry; y++) for (var x = -rx; x <= rx; x++) if ((x * x) / (rx * rx + 0.5) + (y * y) / (ry * ry + 0.5) <= 1) set(g, cx + x, cy + y, f(x, y)); }
  function sc(x, y, rx, ry) { if (y <= -ry + 1 && x < rx - 1) return 'L'; if (y >= ry - 1 || x >= rx - 1) return 'd'; if (y > 0) return 'o'; return (x + 2 * y) % 4 === 0 ? 'o' : 'O'; }
  function draw(stage, frame, gear, opts) {
    if (!stage) return egg(frame || 0);
    var g = grid(), H = HD[stage], bob = [0, -1, -1, 0][frame || 0], flap = frame === 1 || frame === 2 ? -1 : 0, myth = stage === 5, big = stage >= 3;
    var bx = H.bx, by = H.by + bob, hx = H.hx, hy = H.hy + bob;
    /* big bat wing behind: a filled fan from the shoulder up to the tip and back down to the trailing edge, scalloped between dark finger bones */
    var sx = bx - 2, sy = by - H.ry + 1, tipx = sx + Math.round(H.wg * 0.55), tipy = Math.max(1, sy - H.wg + flap), trx = sx + H.wg + 1, tr_y = sy + 1;
    function inTri(px, py, ax, ay, bx2, by2, cx2, cy2) { var d1 = (px - bx2) * (ay - by2) - (ax - bx2) * (py - by2), d2 = (px - cx2) * (by2 - cy2) - (bx2 - cx2) * (py - cy2), d3 = (px - ax) * (cy2 - ay) - (cx2 - ax) * (py - ay);
      return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0)); }
    var fingers = [0.35, 0.65, 1].map(function (f) { return [Math.round(tipx + (trx - tipx) * f), Math.round(tipy + (tr_y - tipy) * f)]; });
    for (var wy = tipy; wy <= tr_y + 1; wy++) for (var wx = sx; wx <= trx; wx++) if (inTri(wx, wy, sx, sy, tipx, tipy, trx, tr_y)) {
      var u = (wx - tipx) / Math.max(1, trx - tipx), sc0 = Math.round(Math.abs(Math.sin(u * Math.PI * 3)) * 2);
      if (wy > tipy + (tr_y - tipy) * u - sc0 + 1 || wx <= tipx + 0 || wy < tr_y - 0) set(g, wx, wy, 'W'); }
    for (var t = 0; t <= H.wg; t++) set(g, Math.round(sx + (tipx - sx) * t / H.wg), Math.round(sy + (tipy - sy) * t / H.wg), 'w');   // leading arm bone
    fingers.forEach(function (f) { for (var t2 = 0; t2 <= 6; t2++) { var fx = Math.round(tipx + (f[0] - tipx) * t2 / 6), fy = Math.round(tipy + (f[1] - tipy) * t2 / 6); set(g, fx, fy, 'w'); } if (myth) set(g, f[0], f[1], 'K'); });
    set(g, tipx, tipy - 1, myth ? 'K' : 'w');
    /* tail out to the right, tapering down, a spade tip */
    for (var k = 0; k < H.tl + 3; k++) { var tx = bx + H.rx - 1 + k, ty = by + 1 + Math.round(k * 0.45); set(g, tx, ty, k % 2 ? 'o' : 'd'); if (k < H.tl - 1) set(g, tx, ty - 1, 'O'); }
    var ex = bx + H.rx + H.tl + 2, ey0 = by + 1 + Math.round((H.tl + 2) * 0.45); set(g, ex + 1, ey0, myth ? 'K' : 'd'); set(g, ex, ey0 - 1, 'd');
    /* heavy body + belly plates */
    ell(g, bx, by, H.rx, H.ry, function (x, y) { return sc(x, y, H.rx, H.ry); });
    for (var bxp = bx - H.rx + 2; bxp <= bx + H.rx - 3; bxp++) set(g, bxp, by + H.ry - 1, bxp % 2 ? 'C' : 'c');
    /* legs + claws (front leg forward, back leg under the haunch) */
    for (var l = 1; l <= H.lg; l++) { set(g, bx - H.rx + 2, by + H.ry - 1 + l, 'o'); set(g, bx + H.rx - 3, by + H.ry - 1 + l, 'd'); }
    set(g, bx - H.rx + 1, by + H.ry - 1 + H.lg, 'T'); set(g, bx + H.rx - 4, by + H.ry - 1 + H.lg, 'T');
    /* neck */
    for (var n = 0; n < 4; n++) ell(g, hx + 2 + n, hy + 2 + n, big ? 2 : 3, 2, function (x, y) { return y > 0 ? 'o' : 'O'; });
    /* head (skull) */
    ell(g, hx, hy, H.hr, H.hr - (big ? 1 : 0), function (x, y) { return y < -1 && x < 1 ? 'L' : y > 1 ? 'o' : 'O'; });
    /* snout to the left: upper jaw, open mouth, lower jaw */
    var sxL = hx - H.hr - H.sn + 1, uy = hy - (big ? 1 : 0), my = uy + 1, ly = my + H.jaw;
    for (var x = sxL; x <= hx - 1; x++) { set(g, x, uy, x === sxL ? 'o' : 'O'); if (big) set(g, x, uy - 1, x < sxL + 2 ? null : (x % 3 ? 'O' : 'L')); }
    set(g, sxL + 1, uy - (big ? 1 : 0), 'd');                                                   // nostril
    for (var yy = my; yy < ly; yy++) for (var x2 = sxL + 1 + (yy - my); x2 <= hx - 1; x2++) set(g, x2, yy, 'm');   // open mouth
    for (var x3 = sxL + H.jaw; x3 <= hx; x3++) { set(g, x3, ly, 'o'); if (big) set(g, x3, ly + 1, x3 > sxL + H.jaw + 1 ? 'd' : null); }
    /* rows of sharp white teeth: upper teeth hang down, lower teeth point up */
    for (var x4 = sxL + 1; x4 <= hx - 2; x4 += (big ? 1 : 2)) { if ((x4 - sxL) % 2 === 1 || !big) set(g, x4, my, 'X'); }
    for (var x5 = sxL + H.jaw + 1; x5 <= hx - 2; x5 += 2) set(g, x5, ly - 1, H.jaw > 1 || !big ? 'X' : get(g, x5, ly - 1));
    /* yellow eye with a slit and a heavy brow */
    var eyx = hx - 1, eyy = hy - (big ? 2 : 1); set(g, eyx, eyy, 'V'); set(g, eyx + 1, eyy, 'V'); if (!big) { set(g, eyx, eyy + 1, 'V'); set(g, eyx + 1, eyy + 1, 'P'); } else set(g, eyx + 1, eyy, 'P');
    hline(g, eyx - 1, eyx + 2, eyy - 1, 'd');
    /* swept-back horns / crest from the back of the skull */
    for (var c = 0; c < H.cr; c++) { set(g, hx + 1 + c, hy - H.hr + 1 - Math.floor(c / 2), c === H.cr - 1 ? 'c' : 'C'); if (big && c > 0) set(g, hx + c, hy - H.hr + 2 - Math.floor(c / 2), 'c'); }
    for (var c2 = 0; c2 < Math.max(1, H.cr - 2); c2++) set(g, hx + 2 + c2, hy - H.hr + 3, 'c');
    /* spikes down the neck and back */
    for (var sp = 0; sp < (big ? 4 : 2); sp++) set(g, hx + 4 + sp * 2, hy + 1 + sp - (big ? 0 : 1) - 0 + (sp > 1 ? 1 : 0) - 1, myth ? 'K' : 'd');
    if (stage === 4) { set(g, hx - 2, hy + 1, 'd'); set(g, bx + 2, by - 1, 'L'); }                  // Elder: scarred scales
    var Gr = gear || {}; if (Gr.face) { var gc = (Gr.face.cols && Gr.face.cols[0]) || '#141018'; hline(g, eyx - 1, eyx + 2, eyy, gc); }
    return outline(g); }
  function anchors(stage, frame) { if (!stage) return { ey: -1 }; var g = draw(stage, frame || 0, {}), ey = -1, x0 = 99, x1 = -1, my = -1;
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) { var k = g[y][x]; if (k === 'E' || k === 'P') { if (ey < 0) ey = y; if (y === ey) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); } } if (k === 'm' && my < 0) my = y; }
    return { ey: ey, ex0: x0, ex1: x1, my: my }; }
  function render(stage, frame, bg, gear, opts) { var g = draw(stage, frame, gear, opts), d = [], Bg = hexRgb(bg || '#1b2430'), P = Object.assign({}, PAL, (opts && opts.pal) || {});
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) { var k = g[y][x], c = k ? hexRgb(P[k] || k) : Bg; d.push(c[0], c[1], c[2], 255); } return { width: N, height: N, data: d }; }
  function frames(stage, bg, gear, opts) { return [0, 1, 2, 3].map(function (f) { return render(stage, f, bg, gear, opts); }); }
  return { STAGES: STAGES, PAL: PAL, DIM: DIM, render: render, frames: frames, draw: draw, anchors: anchors };
});
