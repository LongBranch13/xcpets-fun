/* Next community pet (demo v2): 6 hand-drawn 8-bit stages, 32x32, same frame format as PetCore.render ({data: RGBA array}).
 * Reference art (blue robe + pointed hat, grey beard, wooden staff with an orange ₿ orb). Few colours, ink outline, 4-frame bob. */
(function (root, factory) { if (typeof module === 'object' && module.exports) module.exports = factory(); else root.WizardSprite = factory(); })(this, function () {
  'use strict';
  var N = 32, PAL = { n: '#1a1020', B: '#2f6fe0', b: '#1d48a8', c: '#7fb2ff', S: '#f2c48d', G: '#a9a9b3', g: '#7c7c88', w: '#ffffff', L: '#8a5a2b', O: '#f7931a', o: '#c46a00', y: '#ffd23f', k: '#0f1530' };
  var STAGES = ['Egg', 'Hatchling', 'Juvenile', 'Adult', 'Elder', 'Mythic'];
  function grid() { var g = []; for (var i = 0; i < N; i++) g.push(new Array(N).fill(null)); return g; }
  function set(g, x, y, k) { if (x >= 0 && y >= 0 && x < N && y < N) g[y][x] = k; }
  function rect(g, x0, y0, w, h, k) { for (var y = y0; y < y0 + h; y++) for (var x = x0; x < x0 + w; x++) set(g, x, y, k); }
  function tri(g, cx, top, h, half, k) { for (var j = 0; j < h; j++) { var hw = Math.round(half * (j + 1) / h); for (var x = cx - hw; x <= cx + hw; x++) set(g, x, top + j, k); } }
  function outline(g) { var o = grid(); for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) { o[y][x] = g[y][x]; if (!g[y][x]) {
    var nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(function (d) { var X = x + d[0], Y = y + d[1]; return X >= 0 && Y >= 0 && X < N && Y < N && g[Y][X] && g[Y][X] !== 'y'; }); if (nb) o[y][x] = 'n'; } } return o; }
  function orb(g, x, y, r) { for (var j = -r; j <= r; j++) for (var i = -r; i <= r; i++) if (i * i + j * j <= r * r + 1) set(g, x + i, y + j, 'O');
    if (r >= 2) { set(g, x, y - 1, 'w'); set(g, x, y, 'w'); set(g, x, y + 1, 'w'); set(g, x + 1, y - 1, 'o'); set(g, x + 1, y + 1, 'o'); } }
  function draw(stage, frame) {
    var g = grid(), bob = [0, -1, -1, 0][frame || 0];
    if (stage === 0) { // egg: blue robe-coloured egg with a pointed-hat crack and a tiny orange coin
      for (var y = 0; y < 18; y++) { var hw = Math.round(Math.sqrt(Math.max(0, 1 - Math.pow((y - 10) / 10, 2))) * 8); for (var x = 16 - hw; x < 16 + hw; x++) set(g, x, 10 + y + bob, y < 6 ? 'B' : y % 5 === 0 ? 'c' : 'b'); }
      tri(g, 16, 6 + bob, 6, 3, 'B'); orb(g, 16, 20 + bob, 2); return outline(g);
    }
    var s = [0, 0.55, 0.7, 0.85, 0.95, 1][stage], H = Math.round(26 * s), top = 29 - H + bob, cx = 15;
    var hatH = Math.round(H * 0.35), headY = top + hatH, headH = Math.max(3, Math.round(H * 0.18)), bodyY = headY + headH, bodyH = 29 + bob - bodyY;
    tri(g, cx, top, hatH, Math.round(4 * s) + 2, 'B'); rect(g, cx - Math.round(5 * s) - 2, headY - 1, Math.round(10 * s) + 5, 1, 'b'); // hat + brim
    if (stage >= 3) { set(g, cx - 1, top + 3, 'y'); set(g, cx + 1, top + Math.round(hatH / 2), 'y'); }
    rect(g, cx - Math.round(3 * s) - 1, headY, Math.round(6 * s) + 3, headH, 'S');                                   // face
    set(g, cx - 1, headY + 1, 'k'); set(g, cx + 2, headY + 1, 'k');                                                    // eyes
    tri(g, cx, bodyY - 1, Math.round(bodyH * (stage >= 4 ? 0.8 : 0.5)), Math.round(3 * s) + 1, 'G');                  // beard
    for (var j = 0; j < bodyH; j++) { var half = Math.round((3 + j * 0.45) * s) + 2; for (var x2 = cx - half; x2 <= cx + half; x2++) if (g[bodyY + j] && !g[bodyY + j][x2]) set(g, x2, bodyY + j, (x2 + j) % 7 === 0 ? 'c' : 'B'); }
    if (stage >= 2) { var sx = cx + Math.round(8 * s) + 2; for (var y2 = top + 4; y2 < 29 + bob; y2++) set(g, sx, y2, 'L'); orb(g, sx, top + 3, stage >= 4 ? 3 : 2); }     // staff + ₿ orb
    if (stage >= 3) set(g, cx - Math.round(6 * s) - 2, bodyY + 2, 'S');
    var o = outline(g);
    if (stage === 5) [[3, 5], [27, 9], [5, 18], [28, 22], [9, 3]].forEach(function (p, i) { if ((i + (frame || 0)) % 2 === 0) { set(o, p[0], p[1], 'y'); set(o, p[0] + 1, p[1], 'y'); set(o, p[0], p[1] + 1, 'y'); } });
    return o;
  }
  function hex(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
  /** render(stage, frame, bg) -> { width, height, data: [RGBA...] } */
  function render(stage, frame, bg) { var g = draw(stage, frame), d = [], B = hex(bg || '#142018');
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) { var k = g[y][x], c = k ? hex(PAL[k]) : B; d.push(c[0], c[1], c[2], 255); } return { width: N, height: N, data: d }; }
  function frames(stage, bg) { return [0, 1, 2, 3].map(function (f) { return render(stage, f, bg); }); }
  return { STAGES: STAGES, PAL: PAL, render: render, frames: frames, draw: draw };
});
