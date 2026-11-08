/* TOP BURNER FIVE (1 of 1, PREVIEW). Gate stays null until the owner says go.
 * Redrawn to the density of the Bitcoin Wizard and the Orange Dragon: the figure fills the
 * 32x32 frame, three or four tones per material, a hard ink outline, and a face you can
 * read at a glance. References (t3177ua0): Bumble, Harry, a grey Pepe, the upright cryptid,
 * a sleek astronaut. No car. No fire aura, no flame crown, no gold edition frame, no text. */
(function (root, factory) { if (typeof module === 'object' && module.exports) module.exports = factory(); else root.TopBurnerSprites = factory(); })(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
  var N = 32, STAGES = ['Egg', 'Hatchling', 'Juvenile', 'Adult', 'Elder', 'Mythic'];
  var IDS = ['yeti', 'sasquatch', 'greypepe', 'chupacabra', 'starman'];
  var NAMES = { yeti: 'Abominable Snowman', sasquatch: 'Sasquatch', greypepe: 'GreyPepe Alien', chupacabra: 'Chupacabra', starman: 'Starman' };
  var PAL = {
    yeti: { n: '#141820', W: '#f7f8fa', w: '#d5dbe3', d: '#a8b1bd', T: '#ffffff', M: '#3a4452', m: '#232a34', E: '#f4f7fb', P: '#101218', G: '#1a1e26', X: '#fbfaf6', C: '#2c3440', o: '#e7edf3', F: '#2c3440', K: '#d7e6f6' },
    sasquatch: { n: '#1a120e', W: '#8a5a34', w: '#6b4224', d: '#3e2616', T: '#c48a58', S: '#f0c8a0', s: '#d7a67c', B: '#efe8dc', b: '#cfc6b6', E: '#f7f4ee', P: '#1a120e', m: '#8a4038', X: '#fffaf4', C: '#4a301c', o: '#a06a40', F: '#2e1c12', K: '#fff6ea' },
    greypepe: { n: '#121418', W: '#b4bcc4', w: '#8e989f', d: '#3a424a', I: '#e4eaf0', E: '#0c0e12', P: '#ffffff', m: '#e2583a', o: '#9aa3ab', F: '#5c666e', C: '#6a727a', K: '#ffffff' },
    chupacabra: { n: '#140e10', W: '#8a9474', w: '#667056', d: '#3a342c', I: '#c6d0b0', E: '#07080c', P: '#f4fff0', q: '#1c1614', K: '#f4ecd0', C: '#1c1614', F: '#1c1614', o: '#748064', m: '#6a2828', G: '#f2f0ea' },
    starman: { n: '#121418', W: '#f7f8fa', w: '#d5dce4', d: '#3e4652', I: '#232830', A: '#e2a23a', a: '#b87a22', E: '#fff8e0', P: '#6a4818', Q: '#c5ced6', F: '#232830', o: '#5c6674', Z: '#c1121f', N: '#1d3f8a', U: '#ffffff', K: '#fff6d0' }
  };
  function grid() { var g = []; for (var i = 0; i < N; i++) g.push(new Array(N).fill(null)); return g; }
  function set(g, x, y, k) { if (k && x >= 0 && y >= 0 && x < N && y < N) g[y][x] = k; }
  function get(g, x, y) { return x >= 0 && y >= 0 && x < N && y < N ? g[y][x] : null; }
  function hline(g, x0, x1, y, k) { for (var x = x0; x <= x1; x++) set(g, x, y, k); }
  function disc(g, cx, cy, rx, ry, k) { for (var y = -ry; y <= ry; y++) for (var x = -rx; x <= rx; x++) if ((x * x) / (rx * rx + 0.3) + (y * y) / (ry * ry + 0.3) <= 1) set(g, cx + x, cy + y, k); }
  function outline(g) { var o = g.map(function (r) { return r.slice(); }); for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) if (!g[y][x]) {
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(function (d) { return get(g, x + d[0], y + d[1]); })) o[y][x] = 'n'; } return o; }
  function hexRgb(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
  function deadRgb(rgb) { var L = 0.3 * rgb[0] + 0.59 * rgb[1] + 0.11 * rgb[2]; return [Math.round(L * 0.45 + 48), Math.round(L * 0.47 + 46), Math.round(L * 0.4 + 42)]; }
  function tone(x, cx, y, light, mid, dark, hi) { if (x <= cx - 1 && (x + y) % 7 === 0) return hi; if (x >= cx + 2) return (x + y) % 3 === 0 ? dark : mid; return (x * 3 + y) % 5 === 0 ? mid : light; }
  function eyeTop(g) { var ey = 99, top = 99, y, x; for (y = 0; y < N; y++) for (x = 0; x < N; x++) { if (g[y][x] && y < top) top = y; if ((g[y][x] === 'E' || g[y][x] === 'P') && y < ey) ey = y; } return { ey: ey === 99 ? 10 : ey, top: top === 99 ? 2 : top }; }
  function gearOn(g, gear, a) {
    var Gr = gear || {}; if (!Gr.head && !Gr.face && !Gr.body && !Gr.back && !Gr.feet && !Gr.hand && !Gr.weapon) return;
    function col(sl, i, d) { var it = Gr[sl]; return (it && it.cols && (it.cols[i] || it.cols[0])) || d; }
    var ey = a.ey, top = a.top, cx = 15;
    if (Gr.head) { var hc = col('head', 0, '#c0303a'), hd = col('head', 1, '#7a1820');
      for (var hy = top - 4; hy <= top - 1; hy++) hline(g, cx - 4, cx + 4, hy, hy === top - 1 ? hd : hc); }
    if (Gr.body) { var bc = col('body', 0, '#2f6fe0'), bd = col('body', 1, '#1a3a80');
      for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) if (g[y][x] === 'o') g[y][x] = (x + y) % 3 === 0 ? bd : bc; }
    if (Gr.feet) { var fc = col('feet', 0, '#6a3a1a'); for (var y2 = 0; y2 < N; y2++) for (var x2 = 0; x2 < N; x2++) if (g[y2][x2] === 'F') g[y2][x2] = fc; }
    if (Gr.back) { var kc = col('back', 0, '#3ddc84'), kd = col('back', 1, '#145c38');
      for (var y3 = ey + 3; y3 < N - 2; y3++) { var left = 99; for (var x3 = 0; x3 < N; x3++) if (g[y3][x3]) { left = x3; break; } if (left === 99) continue; set(g, left - 1, y3, y3 % 2 ? kd : kc); set(g, left - 2, y3, kd); } }
    if (Gr.face) { var gc = col('face', 0, '#141018'); hline(g, cx - 6, cx - 2, ey - 1, gc); hline(g, cx + 2, cx + 6, ey - 1, gc); }
    if (Gr.hand || Gr.weapon) { var hx = 3, hy = Math.min(N - 3, ey + 8);
      if (Gr.hand) { var wc = col('hand', 0, '#8a5a2b'); for (var t = 0; t < 7; t++) set(g, hx, hy - t, t < 3 ? wc : col('hand', 1, '#c8c8d0')); }
      if (Gr.weapon) { var w1 = col('weapon', 0, '#9a4a12'); for (var t2 = 0; t2 < 8; t2++) set(g, N - 4, hy - t2, t2 === 7 ? col('weapon', 1, '#c1121f') : w1); } }
  }
  function finish(g, gear) { gearOn(g, gear, eyeTop(g)); return outline(g); }

  function yeti(stage, frame, gear) {
    var g = grid(), bob = [0, -1, -1, 0][frame || 0], blink = frame === 2, roar = frame === 3;
    var myth = stage === 5, elder = stage >= 4, big = stage >= 3, cx = 15;
    if (!stage) {
      disc(g, 16, 18 + bob, 8, 9, 'W'); disc(g, 18, 20 + bob, 3, 4, 'w');
      disc(g, 16, 16 + bob, 5, 4, 'M');
      if (!blink) { disc(g, 13, 16 + bob, 2, 2, 'E'); disc(g, 19, 16 + bob, 2, 2, 'E'); set(g, 13, 16 + bob, 'P'); set(g, 19, 16 + bob, 'P'); set(g, 12, 15 + bob, 'T'); }
      hline(g, 13, 19, 19 + bob, 'G'); hline(g, 14, 18, 20 + bob, 'X'); set(g, 15, 20 + bob, 'G'); set(g, 17, 20 + bob, 'G');
      set(g, 14, 8 + bob, 'T'); set(g, 16, 7 + bob, 'T'); set(g, 18, 8 + bob, myth ? 'K' : 'W'); set(g, 15, 6 + bob, 'T');
      return finish(g, null);
    }
    var bh = [0, 11, 14, 16, 17, 18][stage], bw = [0, 6, 7, 8, 9, 9][stage], foot = 30 + bob, top = foot - bh;
    for (var y = top; y <= foot; y++) { var t = (y - top) / bh, belly = (t > 0.32 && t < 0.78) ? (big ? 3 : 2) : 0, jag = (y & 1) ? 1 : 0, half = bw + belly + (big ? jag : 0);
      for (var x = cx - half; x <= cx + half; x++) { var k = tone(x, cx, y, 'W', 'w', 'd', 'T'); if (t > 0.38 && t < 0.75 && Math.abs(x - cx) < half - 2) k = (x + y) % 4 === 0 ? 'w' : 'o'; if (elder && (x + y) % 9 === 0) k = 'd'; set(g, x, y, k); } }
    hline(g, cx - bw - 1, cx - 2, foot + (roar ? 0 : 1), 'F'); hline(g, cx + 2, cx + bw + 1, foot + 1, 'F');
    set(g, cx - bw - 2, foot + 1, 'C'); set(g, cx + bw + 2, foot + 1, 'C'); set(g, cx - bw, foot + 1, 'C');
    var arm = [0, 4, 6, 8, 9, 10][stage], sh = top + 2;
    for (var a = 0; a < arm; a++) { var ax = cx - bw - 1 - (a < 3 ? a : 2), ay = sh + a; set(g, ax, ay, a === arm - 1 ? 'C' : tone(ax, cx, ay, 'W', 'w', 'd', 'T')); set(g, ax - 1, ay, 'd');
      set(g, cx + bw + 1 + (a < 3 ? a : 2), ay, a === arm - 1 ? 'C' : 'w'); }
    if (roar) { for (var r = 0; r < arm; r++) { set(g, cx - bw - 2, sh - r, r === arm - 1 ? 'C' : 'W'); set(g, cx - bw - 3, sh - r, 'd'); } set(g, cx - bw - 2, sh - arm, 'C'); }
    var hh = [0, 7, 8, 9, 9, 10][stage], hy = top + 1;
    disc(g, cx, hy - 1, bw + 1, hh >> 1, 'W');
    for (var s = 0; s < (myth ? 7 : big ? 5 : 3); s++) { var tx = cx - 3 + (s % 5), ty = hy - hh + (s % 3) - (myth ? 2 : 0); set(g, tx, ty, s === 0 && myth ? 'K' : 'T'); set(g, tx + ((s & 1) ? 2 : -1), ty - 1, myth && s < 2 ? 'K' : 'W'); }
    disc(g, cx, hy, bw - 1, big ? 4 : 3, 'M');
    var ey = hy - 1;
    if (blink) { hline(g, cx - 5, cx - 2, ey, 'm'); hline(g, cx + 2, cx + 5, ey, 'm'); }
    else { disc(g, cx - 4, ey, big ? 2 : 1, big ? 2 : 1, 'E'); disc(g, cx + 4, ey, big ? 2 : 1, big ? 2 : 1, 'E'); set(g, cx - 4, ey, 'P'); set(g, cx + 4, ey, 'P'); set(g, cx - 5, ey - 1, 'T'); set(g, cx + 3, ey - 1, 'T'); }
    var my = ey + (big ? 3 : 2), tw = roar ? bw - 1 : bw - 2;
    hline(g, cx - tw, cx + tw, my, 'G'); hline(g, cx - tw + 1, cx + tw - 1, my + 1, 'G');
    for (var th = cx - tw + 1; th <= cx + tw - 1; th++) if ((th - cx) % 2 === 0) set(g, th, my + 1, 'X');
    if (roar || myth) { hline(g, cx - tw + 2, cx + tw - 2, my + 2, 'G'); for (var th2 = cx - tw + 2; th2 <= cx + tw - 2; th2 += 2) set(g, th2, my + 2, 'X'); }
    return finish(g, gear);
  }

  function harry(stage, frame, gear) {
    var g = grid(), bob = [0, -1, -1, 0][frame || 0], blink = frame === 2, wave = frame === 3;
    var myth = stage === 5, elder = stage >= 4, big = stage >= 3, cx = 16;
    if (!stage) {
      disc(g, 16, 18 + bob, 8, 9, 'W'); disc(g, 18, 20 + bob, 3, 3, 'w');
      disc(g, 16, 16 + bob, 4, 3, 'S');
      if (!blink) { set(g, 14, 15 + bob, 'E'); set(g, 14, 16 + bob, 'P'); set(g, 18, 15 + bob, 'E'); set(g, 18, 16 + bob, 'P'); }
      hline(g, 13, 19, 18 + bob, 'B'); hline(g, 14, 18, 19 + bob, 'm'); set(g, 15, 19 + bob, 'X'); set(g, 17, 19 + bob, 'X');
      return finish(g, null);
    }
    var bh = [0, 12, 15, 18, 19, 20][stage], bw = [0, 4, 5, 5, 5, 6][stage], foot = 30 + bob, top = foot - bh;
    for (var y = top; y <= foot; y++) { var jag = (y & 1) && big ? 1 : 0, half = bw + jag;
      for (var x = cx - half; x <= cx + half; x++) set(g, x, y, tone(x, cx, y, 'W', 'w', 'd', 'T')); }
    if (big) for (var yb = top + 4; yb < top + 9; yb++) for (var xb = cx - 2; xb <= cx + 2; xb++) set(g, xb, yb, (xb + yb) % 3 === 0 ? 'w' : 'o');
    hline(g, cx - bw, cx - 1, foot + 1, 'F'); hline(g, cx + 1, cx + bw, foot + 1, 'F');
    var reach = [0, 3, 5, 7, 8, 9][stage], hang = [0, 5, 7, 9, 10, 11][stage], sy = top + 1;
    for (var i = 1; i <= reach; i++) { set(g, cx - bw - i, sy, 'W'); set(g, cx - bw - i, sy + 1, 'd'); set(g, cx + bw + i, sy, 'w'); set(g, cx + bw + i, sy + 1, 'd'); }
    var lx = cx - bw - reach, rx = cx + bw + reach;
    for (var h = 0; h < hang; h++) { set(g, lx, sy + 2 + h, h === hang - 1 ? 'C' : ((h & 1) ? 'w' : 'W')); set(g, lx - 1, sy + 2 + h, 'd'); set(g, lx + 1, sy + 3 + h, 'T'); set(g, rx, sy + 2 + h, h === hang - 1 ? 'C' : 'w'); set(g, rx + 1, sy + 2 + h, 'd'); }
    if (wave) { for (var wv = 0; wv < hang; wv++) { set(g, lx, sy - wv, wv === hang - 1 ? 'C' : 'W'); set(g, lx - 1, sy - wv, 'd'); set(g, lx + 1, sy - wv, 'T'); } }
    var hy = top - (big ? 2 : 1);
    disc(g, cx, hy, bw + 1, big ? 4 : 3, 'W');
    disc(g, cx, hy, bw - 1, big ? 3 : 2, 'S');
    var ey = hy - 1;
    if (blink) { hline(g, cx - 3, cx - 1, ey, 's'); hline(g, cx + 1, cx + 3, ey, 's'); }
    else { set(g, cx - 3, ey, 'E'); set(g, cx - 2, ey, 'E'); set(g, cx - 2, ey, 'P'); set(g, cx + 2, ey, 'E'); set(g, cx + 3, ey, 'E'); set(g, cx + 2, ey + (big ? 0 : 0), 'P'); set(g, cx - 3, ey - 1, 'T'); }
    hline(g, cx - 2, cx + 2, ey + 2, 'm'); set(g, cx - 1, ey + 2, 'X'); set(g, cx + 1, ey + 2, 'X');
    if (wave || myth) { set(g, cx - 3, ey + 2, 'm'); set(g, cx + 3, ey + 2, 'm'); }
    var beard = [0, 2, 3, 4, 5, 6][stage];
    for (var br = 0; br < beard; br++) { var hw = Math.max(2, (bw - 1) - (br > 2 ? 1 : 0)); for (var bx = cx - hw; bx <= cx + hw; bx++) set(g, bx, ey + 3 + br, (bx + br) % 3 === 0 ? 'b' : (myth && br === 0 ? 'K' : 'B')); }
    return finish(g, gear);
  }

  function pepe(stage, frame, gear) {
    var g = grid(), bob = [0, -1, -1, 0][frame || 0], blink = frame === 2, smirk = frame === 3;
    var myth = stage === 5, big = stage >= 3, cx = 16;
    if (!stage) {
      disc(g, 11, 16 + bob, 5, 4, 'W'); disc(g, 21, 16 + bob, 5, 4, 'W');
      hline(g, 8, 24, 18 + bob, 'W'); hline(g, 9, 23, 19 + bob, 'w');
      if (!blink) { hline(g, 9, 13, 16 + bob, 'E'); hline(g, 19, 23, 16 + bob, 'E'); set(g, 12, 16 + bob, 'P'); set(g, 20, 16 + bob, 'P'); hline(g, 9, 13, 15 + bob, 'd'); hline(g, 19, 23, 15 + bob, 'd'); }
      hline(g, 10, 22, 20 + bob, 'm'); set(g, 10, 21 + bob, 'm'); set(g, 22, 21 + bob, 'm');
      return finish(g, null);
    }
    var rx = [0, 5, 6, 7, 7, 8][stage], ry = [0, 4, 5, 5, 6, 6][stage], hy = 10 + bob;
    disc(g, cx - rx + 1, hy, rx, ry, 'W'); disc(g, cx + rx - 1, hy, rx, ry, 'W');
    disc(g, cx, hy + 2, rx + 2, ry - 1, 'W');
    for (var y = hy - ry; y <= hy + ry; y++) for (var x = cx - rx * 2; x <= cx + rx * 2; x++) if (get(g, x, y) === 'W' && x > cx + 1) set(g, x, y, tone(x, cx, y, 'W', 'w', 'd', 'I'));
    var ey = hy;
    hline(g, cx - rx - 1, cx - 2, ey - 2, 'd'); hline(g, cx + 2, cx + rx + 1, ey - 2, 'd');
    if (big) { hline(g, cx - rx, cx - 2, ey - 3, 'd'); hline(g, cx + 2, cx + rx, ey - 3, 'd'); }
    if (blink) { hline(g, cx - rx, cx - 2, ey, 'd'); hline(g, cx + 2, cx + rx, ey, 'd'); }
    else { hline(g, cx - rx, cx - 2, ey, 'E'); hline(g, cx - rx, cx - 2, ey + 1, 'E'); hline(g, cx + 2, cx + rx, ey, 'E'); hline(g, cx + 2, cx + rx, ey + 1, 'E');
      set(g, cx - 3, ey, 'P'); set(g, cx + rx - 1, ey, myth ? 'K' : 'P'); set(g, cx - rx + 1, ey, 'I'); }
    var my = ey + ry;
    hline(g, cx - rx - 1, cx + rx + 1, my, 'm');
    set(g, cx - rx - 1, my + (smirk ? -1 : 1), 'm'); set(g, cx + rx + 1, my + 1, 'm');
    if (smirk) set(g, cx + rx, my - 1, 'm');
    var body = [0, 4, 5, 6, 7, 7][stage];
    for (var b = 1; b <= body; b++) { var half = Math.max(2, rx - 1 - (b > 3 ? 1 : 0)); for (var bx = cx - half; bx <= cx + half; bx++) set(g, bx, my + b, b < 3 && Math.abs(bx - cx) < half - 1 ? 'o' : tone(bx, cx, b, 'W', 'w', 'd', 'I')); }
    hline(g, cx - 3, cx - 1, my + body + 1, 'F'); hline(g, cx + 1, cx + 3, my + body + 1, 'F');
    set(g, cx - rx - 2, my + 2, 'C'); set(g, cx + rx + 2, my + 2, 'C');
    return finish(g, gear);
  }

  function chupa(stage, frame, gear) {
    var g = grid(), bob = [0, -1, -1, 0][frame || 0], blink = frame === 2, swipe = frame === 3;
    var myth = stage === 5, big = stage >= 3, cx = 16;
    if (!stage) {
      disc(g, 16, 18 + bob, 7, 8, 'W'); disc(g, 19, 20 + bob, 2, 3, 'w');
      for (var s = 0; s < 4; s++) set(g, 13 + s * 2, 10 + bob - (s & 1), s === 3 ? 'K' : 'q');
      if (!blink) { hline(g, 12, 14, 17 + bob, 'E'); hline(g, 18, 20, 17 + bob, 'E'); set(g, 14, 17 + bob, 'P'); set(g, 18, 17 + bob, 'P'); }
      set(g, 14, 22 + bob, 'd'); set(g, 18, 21 + bob, 'd');
      return finish(g, null);
    }
    var bh = [0, 13, 16, 18, 19, 20][stage], bw = [0, 5, 6, 7, 8, 8][stage], foot = 30 + bob, top = foot - bh;
    for (var y = top; y <= foot - 4; y++) { var half = bw + ((y & 1) && big ? 1 : 0);
      for (var x = cx - half; x <= cx + half; x++) { var k = tone(x, cx, y, 'W', 'w', 'd', 'I'); if ((x * 3 + y * 5) % 11 === 0) k = 'd'; if (Math.abs(x - cx) < 2 && y > top + 3 && y < top + 8) k = 'o'; set(g, x, y, k); } }
    for (var leg = 0; leg < 4; leg++) { set(g, cx - bw + leg, foot - 4 + leg, 'w'); set(g, cx + bw - leg, foot - 4 + leg, 'd'); }
    hline(g, cx - bw - 1, cx - bw + 1, foot, 'F'); hline(g, cx + bw - 1, cx + bw + 1, foot, 'F'); set(g, cx - bw - 2, foot, 'C'); set(g, cx + bw + 2, foot, 'C');
    var spines = [0, 3, 4, 6, 7, 8][stage];
    for (var sp = 0; sp < spines; sp++) { var sx = cx - spines + sp * 2, sh = 3 + (sp % 3) + (myth ? 3 : stage >= 4 ? 1 : 0); for (var si = 0; si < sh; si++) set(g, sx, top - si, si === sh - 1 ? (myth || stage >= 4 ? 'K' : 'q') : 'q'); }
    function elderTip(st) { return st >= 4; }
    var hy = top + 2;
    disc(g, cx, hy + 1, bw, big ? 4 : 3, 'W');
    var ey = hy;
    var ew = big ? 5 : 3;
    if (blink) { hline(g, cx - ew - 1, cx - 1, ey, 'd'); hline(g, cx + 1, cx + ew + 1, ey, 'd'); }
    else { hline(g, cx - ew - 1, cx - 1, ey - 1, 'I'); hline(g, cx + 1, cx + ew + 1, ey - 1, 'I'); hline(g, cx - ew - 1, cx - 1, ey, 'E'); hline(g, cx - ew, cx - 2, ey + 1, 'E'); hline(g, cx + 1, cx + ew + 1, ey, 'E'); hline(g, cx + 2, cx + ew, ey + 1, 'E'); set(g, cx - 3, ey, 'P'); set(g, cx - 4, ey, 'P'); set(g, cx + 3, ey, myth ? 'K' : 'P'); set(g, cx + 4, ey, 'P'); }
    hline(g, cx - 2, cx + 2, ey + 3, 'm'); set(g, cx - 1, ey + 4, 'G'); set(g, cx + 1, ey + 4, 'G');
    var clawY = hy + (big ? 6 : 5);
    [[-1, 0], [-2, -1], [-3, 0], [-2, 1]].forEach(function (p) { set(g, cx - bw + p[0], clawY + p[1], 'C'); set(g, cx + bw - p[0], clawY + p[1], 'C'); });
    if (swipe) { [[-6, -2], [-8, -3], [-10, -2], [-7, -1], [-9, -4]].forEach(function (p) { set(g, cx + p[0], clawY + p[1], 'C'); }); }
    return finish(g, gear);
  }

  function starman(stage, frame, gear) {
    var g = grid(), bob = [0, -1, -1, 0][frame || 0], blink = frame === 2, float = frame === 3;
    var myth = stage === 5, big = stage >= 3, cx = 16;
    if (float) bob -= 2;
    if (!stage) {
      disc(g, 16, 16 + bob, 7, 8, 'W'); disc(g, 18, 18 + bob, 3, 3, 'w');
      hline(g, 11, 21, 16 + bob, 'A'); hline(g, 12, 20, 17 + bob, 'a');
      if (!blink) { set(g, 13, 16 + bob, 'E'); set(g, 14, 16 + bob, 'P'); set(g, 18, 16 + bob, 'E'); }
      set(g, 12, 20 + bob, 'N'); set(g, 13, 20 + bob, 'Z'); set(g, 12, 21 + bob, 'Z');
      return finish(g, null);
    }
    var bh = [0, 10, 12, 14, 15, 15][stage], bw = [0, 5, 6, 7, 7, 8][stage], foot = 30 + bob, top = foot - bh;
    for (var y = top; y <= foot; y++) { var shoulder = y < top + 3 ? 2 : 0, half = bw + shoulder;
      for (var x = cx - half; x <= cx + half; x++) { var k = x >= cx + half - 1 ? 'd' : x <= cx - half + 1 ? 'w' : 'W'; if (big && (x === cx - 2 || x === cx + 3) && y > top + 3 && y < foot - 2) k = 'd'; if (y > top + 3 && y < top + 8 && Math.abs(x - cx) <= 1) k = 'o'; if (x < cx - 1 && (x + y) % 6 === 0) k = 'w'; set(g, x, y, k); }
      if (big) { set(g, cx + half + 1, y, 'd'); set(g, cx + half + 2, y, 'I'); } }
    hline(g, cx - 3, cx - 1, foot + 1, 'F'); hline(g, cx + 1, cx + 3, foot + 1, 'F'); hline(g, cx - 3, cx - 1, foot, 'd'); hline(g, cx + 1, cx + 3, foot, 'd');
    for (var a = 0; a < (big ? 7 : 5); a++) { set(g, cx - bw - 2, top + 2 + a, a > 4 ? 'Q' : 'W'); set(g, cx - bw - 3, top + 3 + a, 'w'); set(g, cx + bw + 3, top + 2 + a, a > 4 ? 'Q' : 'd'); }
    if (float) { set(g, cx - bw - 2, top, 'Q'); set(g, cx - bw - 4, top - 1, 'Q'); set(g, cx + bw + 3, top - 1, 'Q'); }
    set(g, cx - bw - 1, top + 3, 'N'); set(g, cx - bw, top + 3, 'N'); set(g, cx - bw + 1, top + 3, 'U');
    set(g, cx - bw - 1, top + 4, 'Z'); set(g, cx - bw, top + 4, 'Z'); set(g, cx - bw + 1, top + 4, 'U');
    var hr = [0, 5, 6, 7, 7, 8][stage], hy = top - 2;
    disc(g, cx, hy, hr, big ? 5 : 4, 'W');
    disc(g, cx + 2, hy + 1, 2, 2, 'w');
    hline(g, cx - hr + 1, cx + hr - 1, hy + 1, 'A'); hline(g, cx - hr + 1, cx + hr - 1, hy + 2, 'a'); hline(g, cx - hr + 2, cx + hr - 2, hy, 'A');
    var gl = float ? cx + 1 : cx - hr + 3;
    if (!blink) { set(g, gl, hy + 1, 'E'); set(g, gl + 1, hy + 1, myth ? 'K' : 'E'); set(g, gl, hy, 'P'); }
    else { hline(g, cx - hr + 1, cx + hr - 1, hy + 1, 'I'); hline(g, cx - hr + 2, cx + hr - 2, hy + 2, 'I'); }
    if (myth) set(g, cx, hy - 4, 'K');
    return finish(g, gear);
  }

  function draw(id, stage, frame, gear) {
    if (id === 'yeti') return yeti(stage, frame, gear);
    if (id === 'sasquatch') return harry(stage, frame, gear);
    if (id === 'greypepe') return pepe(stage, frame, gear);
    if (id === 'chupacabra') return chupa(stage, frame, gear);
    if (id === 'starman') return starman(stage, frame, gear);
    return grid();
  }
  function render(id, stage, frame, bg, gear, opts) { var g = draw(id, stage, frame, gear), pal = PAL[id], dead = opts && opts.dead, d = [], Bg = hexRgb(bg || '#1b2430');
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) { var k = g[y][x], c = null;
      if (k) { var hex = pal[k]; c = hex ? hexRgb(hex) : null; if (c && dead && k !== 'n') c = deadRgb(c); } if (!c) c = Bg;
      d.push(c[0], c[1], c[2], 255); } return { width: N, height: N, data: d }; }
  function frames(id, stage, bg, gear, opts) { return [0, 1, 2, 3].map(function (f) { return render(id, stage, f, bg, gear, opts); }); }
  function anchors(id, stage, frame) { var g = draw(id, stage, frame || 0, {}), ey = -1, x0 = 99, x1 = -1;
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) { var k = g[y][x]; if (k === 'E' || k === 'P') { if (ey < 0) ey = y; if (y === ey) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); } } } return { ey: ey, ex0: x0, ex1: x1 }; }
  function has(id) { return IDS.indexOf(id) >= 0; }
  return { IDS: IDS, NAMES: NAMES, STAGES: STAGES, PAL: PAL, draw: draw, render: render, frames: frames, anchors: anchors, has: has };
});
