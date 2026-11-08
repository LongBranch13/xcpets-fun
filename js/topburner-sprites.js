/* TOP BURNER FIVE (1 of 1, PREVIEW). Gate stays null until the owner says go.
 * In-game 32x32 sprites matched to design/art/top-burner-five/concept-*.jpg:
 *   yeti        roaring, both arms up, shaggy white, slate face, googly eyes, toothy maw, dark claws
 *   sasquatch   tall shaggy brown, arms out, grey-white beard, warm smile, open hands
 *   greypepe    grey alien Pepe, heavy lids, glossy black eyes, orange lips, green glow, UFO as an effect
 *   chupacabra  fanged spiny crouch, almond eyes, spots, white claws
 *   starman     white suit, gold visor, shoulder flag, one arm waving. No car, no earth.
 * Bold shapes, hard ink outline, three tones. No fire aura, no flame crown, no gold edition frame.
 * Bitcoin, when it appears anywhere in this set, is red (#e11d2e), never orange. These five carry no coin.
 * Egg through Mythic. Frames: rest, bob, blink, action. Gear uses o (wrap), F (boots), E/P (eyes stay clear). */
(function (root, factory) { if (typeof module === 'object' && module.exports) module.exports = factory(); else root.TopBurnerSprites = factory(); })(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
  var N = 32, STAGES = ['Egg', 'Hatchling', 'Juvenile', 'Adult', 'Elder', 'Mythic'];
  var IDS = ['yeti', 'sasquatch', 'greypepe', 'chupacabra', 'starman'];
  var NAMES = { yeti: 'Abominable Snowman', sasquatch: 'Sasquatch', greypepe: 'GreyPepe Alien', chupacabra: 'Chupacabra', starman: 'Starman' };
  var PAL = {
    yeti: { n: '#141820', W: '#f7f9fc', w: '#d4dce8', d: '#8e9dae', H: '#ffffff', M: '#3c4d64', m: '#243044', E: '#f7fbff', P: '#101218', G: '#161c28', X: '#fffaf4', C: '#2a3444', c: '#eef3f8', o: '#f4f7fb', F: '#2c3848', K: '#ffffff' },
    sasquatch: { n: '#1a120c', W: '#8f5c34', w: '#6b4226', d: '#3c2616', S: '#c48a58', s: '#a56c40', B: '#ebe6dc', b: '#b7aea0', E: '#f8f4ee', P: '#1a120c', m: '#7a3830', X: '#fffaf4', C: '#d7a06c', c: '#8a5a38', o: '#a06a40', F: '#4a301c', K: '#fff8ee', H: '#c9a070' },
    greypepe: { n: '#10141c', W: '#c8cfd6', w: '#9aa3ac', d: '#5c666e', I: '#eef3f7', E: '#0c0e12', P: '#ffffff', m: '#d2652a', M: '#a84c1e', o: '#8e989f', F: '#3e484e', C: '#b7c0c8', g: '#3ef0b4', j: '#14685a', Q: '#9ee0d8', U: '#8a939c', u: '#4a545c', L: '#e8fff8', K: '#ffffff' },
    chupacabra: { n: '#140e12', W: '#93b47c', w: '#6e8c5e', d: '#3c4a34', I: '#d5e4c4', q: '#16120e', K: '#f2f6ea', E: '#f7fff8', P: '#0c0e10', m: '#4a1818', X: '#f6f0dc', C: '#f4f2ea', c: '#d8d4c8', o: '#7f9a68', F: '#241c16', G: '#10140e' },
    starman: { n: '#12141c', W: '#f7f8fa', w: '#d5dce6', d: '#3e4654', I: '#232830', A: '#e2a23a', a: '#8a5818', E: '#fff6d8', P: '#5a3c10', Q: '#f4f6f8', F: '#1c222c', o: '#e7eef4', Z: '#c1121f', N: '#1d3f8a', U: '#ffffff', K: '#fff8e4' }
  };
  var LID = { yeti: 'm', sasquatch: 's', greypepe: 'd', chupacabra: 'd', starman: 'a' };
  function grid() { var g = []; for (var i = 0; i < N; i++) g.push(new Array(N).fill(null)); return g; }
  function set(g, x, y, k) { if (k && x >= 0 && y >= 0 && x < N && y < N) g[y][x] = k; }
  function clone(g) { return g.map(function (r) { return r.slice(); }); }
  function stamp(cmds) { var g = grid(); cmds.forEach(function (c) { var y = c[0], x = c[1], s = c[2]; for (var i = 0; i < s.length; i++) if (s[i] !== '.') set(g, x + i, y, s[i]); }); return g; }
  function shift(g, dy, dx) { var o = grid(); dx = dx || 0; for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) if (g[y][x]) set(o, x + dx, y + dy, g[y][x]); return o; }
  function outline(g) { var o = g.map(function (r) { return r.slice(); }); for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) if (!g[y][x]) {
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(function (d) { var X = x + d[0], Y = y + d[1]; return X >= 0 && Y >= 0 && X < N && Y < N && g[Y][X]; })) o[y][x] = 'n'; } return o; }
  function hexRgb(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
  function deadRgb(rgb) { var L = 0.3 * rgb[0] + 0.59 * rgb[1] + 0.11 * rgb[2]; return [Math.round(L * 0.45 + 48), Math.round(L * 0.47 + 46), Math.round(L * 0.4 + 42)]; }
  function eyeTop(g) { var ey = 99, top = 99, y, x; for (y = 0; y < N; y++) for (x = 0; x < N; x++) { if (g[y][x] && g[y][x] !== 'g' && g[y][x] !== 'j' && y < top) top = y; if ((g[y][x] === 'E' || g[y][x] === 'P') && y < ey) ey = y; } return { ey: ey === 99 ? 10 : ey, top: top === 99 ? 2 : top }; }
  function gearOn(g, gear, a) {
    var Gr = gear || {}; if (!Gr.head && !Gr.face && !Gr.body && !Gr.back && !Gr.feet && !Gr.hand && !Gr.weapon) return;
    function col(sl, i, d) { var it = Gr[sl]; return (it && it.cols && (it.cols[i] || it.cols[0])) || d; }
    var ey = a.ey, top = a.top, cx = 15;
    if (Gr.head) { var hc = col('head', 0, '#c0303a'), hd = col('head', 1, '#7a1820');
      var hat0 = top >= 3 ? top - 3 : 0, hat1 = top >= 3 ? top - 1 : Math.min(2, top + 2);
      for (var hy = hat0; hy <= hat1; hy++) hline(g, cx - 3, cx + 3, hy, hy === hat1 ? hd : hc); }
    if (Gr.body) { var bc = col('body', 0, '#2f6fe0'), bd = col('body', 1, '#1a3a80');
      for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) if (g[y][x] === 'o') g[y][x] = (x + y) % 3 === 0 ? bd : bc; }
    if (Gr.feet) { var fc = col('feet', 0, '#6a3a1a'); for (var y2 = 0; y2 < N; y2++) for (var x2 = 0; x2 < N; x2++) if (g[y2][x2] === 'F') g[y2][x2] = fc; }
    if (Gr.back) { var kc = col('back', 0, '#3ddc84'), kd = col('back', 1, '#145c38');
      for (var y3 = ey + 2; y3 < N - 2; y3++) { var left = 99; for (var x3 = 0; x3 < N; x3++) if (g[y3][x3] && g[y3][x3] !== 'g' && g[y3][x3] !== 'j') { left = x3; break; } if (left === 99 || left < 2) continue; set(g, left - 1, y3, y3 % 2 ? kd : kc); set(g, left - 2, y3, kd); } }
    if (Gr.face) { var gc = col('face', 0, '#141018'); hline(g, cx - 5, cx - 2, ey - 1, gc); hline(g, cx + 2, cx + 5, ey - 1, gc); }
    if (Gr.hand || Gr.weapon) { var hy2 = Math.min(N - 4, Math.max(6, ey + 8));
      if (Gr.hand) { var wc = col('hand', 0, '#8a5a2b'); for (var t = 0; t < 6; t++) set(g, 2, hy2 - t, t < 2 ? wc : col('hand', 1, '#c8c8d0')); }
      if (Gr.weapon) { var w1 = col('weapon', 0, '#9a4a12'); for (var t2 = 0; t2 < 7; t2++) set(g, N - 3, hy2 - t2, t2 === 6 ? '#c1121f' : w1); } }
  }
  function hline(g, x0, x1, y, k) { for (var x = x0; x <= x1; x++) set(g, x, y, k); }
  function bbox(g, skip) { var x0 = 99, y0 = 99, x1 = -1, y1 = -1; for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) if (g[y][x] && !skip[g[y][x]]) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; } return { x0: x0, y0: y0, x1: x1, y1: y1 }; }
  function scaleInto(src, tw, th, x0, y0) { var b = bbox(src, { g: 1, j: 1, Q: 1, U: 1, u: 1, L: 1 }); var sw = b.x1 - b.x0 + 1, sh = b.y1 - b.y0 + 1, g = grid();
    var feat = { E: 1, P: 1, X: 1, C: 1, c: 1, A: 1, B: 1, m: 1, M: 1, Z: 1, N: 1, K: 1 };
    for (var y = 0; y < th; y++) { var sy0 = b.y0 + Math.floor(y * sh / th), sy1 = Math.max(sy0, b.y0 + Math.floor((y + 1) * sh / th) - 1);
      for (var x = 0; x < tw; x++) { var sx0 = b.x0 + Math.floor(x * sw / tw), sx1 = Math.max(sx0, b.x0 + Math.floor((x + 1) * sw / tw) - 1), pick = null, any = null;
        for (var sy = sy0; sy <= sy1; sy++) for (var sx = sx0; sx <= sx1; sx++) { var k = src[sy][sx]; if (!k) continue; any = k; if (feat[k]) pick = k; }
        if (pick || any) g[y0 + y][x0 + x] = pick || any; } } return g; }
  function blink(g, lid) { var o = clone(g); for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) if (o[y][x] === 'E' || o[y][x] === 'P') o[y][x] = lid; return o; }
  function moveKeys(g, pred, dy, dx, fill) { var pts = []; for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) if (g[y][x] && pred(g[y][x], x, y)) pts.push([x, y, g[y][x]]);
    pts.forEach(function (p) { g[p[1]][p[0]] = fill || null; }); pts.forEach(function (p) { set(g, p[0] + dx, p[1] + dy, p[2]); }); }
  function addGlow(outlined, body) { var skin = { W: 1, w: 1, d: 1, I: 1, o: 1, m: 1, M: 1, E: 1, P: 1, C: 1, F: 1 }; var o = clone(outlined);
    function skinBeside(x, y) { return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(function (d) { var X = x + d[0], Y = y + d[1]; return X >= 0 && Y >= 0 && X < N && Y < N && skin[body[Y][X]]; }); }
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) if (!o[y][x]) { if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(function (d) { var X = x + d[0], Y = y + d[1]; return X >= 0 && Y >= 0 && X < N && Y < N && o[Y][X] === 'n' && skinBeside(X, Y); })) o[y][x] = 'g'; }
    return o; }
  function ufo(g, x, y, big, lights) { set(g, x + 2, y, 'Q'); set(g, x + 3, y, 'Q'); if (big) { set(g, x + 1, y, 'Q'); set(g, x + 4, y, 'Q'); set(g, x + 2, y - 1, 'Q'); set(g, x + 3, y - 1, 'Q'); }
    hline(g, x, x + (big ? 6 : 5), y + 1, 'U'); set(g, x, y + 1, 'u'); set(g, x + (big ? 6 : 5), y + 1, 'u');
    if (lights) { set(g, x + 1, y + 2, 'L'); set(g, x + 3, y + 2, 'L'); set(g, x + 5, y + 2, big ? 'L' : 'U'); } else { set(g, x + 1, y + 2, 'u'); set(g, x + 3, y + 2, 'u'); } }

  /* Mythic rest poses. Hand-placed, concept silhouette, readable at 32. */
  var YETI = [
    [0, 14, 'KHHK'], [1, 13, 'HHHHHH'], [2, 14, 'HWHH'],
    [1, 1, 'c.c'], [2, 0, 'CCCC'], [3, 0, 'CWCW'], [4, 1, 'WWC'],
    [1, 28, 'c.c'], [2, 27, 'CCCC'], [3, 27, 'WCWC'], [4, 28, 'CWW'],
    [5, 1, 'WWWd'], [6, 1, 'WWWd'], [7, 2, 'WWWd'], [8, 2, 'WWd'], [9, 2, 'WWd'], [10, 3, 'WWd'], [11, 3, 'WWWd'], [12, 3, 'WWWd'], [13, 4, 'WWd'],
    [5, 27, 'dWWW'], [6, 27, 'dWWW'], [7, 27, 'dWWW'], [8, 28, 'dWW'], [9, 28, 'dWW'], [10, 27, 'dWWW'], [11, 26, 'dWWW'], [12, 26, 'dWWW'], [13, 26, 'dWW'],
    [3, 11, 'WWWWWWWWWW'], [4, 9, 'WWWWWWWWWWWWWW'], [5, 8, 'WW'], [5, 22, 'WW'],
    [6, 8, 'W'], [6, 23, 'W'], [14, 6, 'WW'], [14, 24, 'WW'],
    [6, 10, 'WWMMMMMMMMWW'], [7, 10, 'mm'], [7, 19, 'mm'], [7, 15, 'MM'],
    [8, 10, 'EEE'], [8, 18, 'EEE'], [9, 10, 'EPE'], [9, 18, 'EPE'], [10, 10, 'EEE'], [10, 18, 'EEE'],
    [8, 13, 'MMM'], [9, 14, 'MM'], [10, 13, 'MMM'], [11, 10, 'MMMMMMMMMMMM'], [12, 10, 'GGGGGGGGGGGG'], [13, 11, 'XGXGXGXGXG'], [14, 11, 'GGGGGGGGGG'], [15, 12, 'XGXGXGX'],
    [11, 8, 'WWW'], [11, 21, 'WWW'], [12, 7, 'WWW'], [12, 22, 'WWW'], [15, 7, 'WWWW'], [15, 21, 'WWWW'],
    [16, 5, 'WWWWWWWWWWWWWWWWWWWWWW'], [17, 4, 'WWWWwwwwwwwwwwwwwwWWW'], [18, 4, 'WWWWwwwwwwwwwwwwwwWWW'], [17, 9, 'oooooooo'], [18, 9, 'oooooooo'], [19, 5, 'WWwwwwwwwwwwwwwwwwWW'],
    [20, 6, 'WWddddddddddddddddWW'], [21, 6, 'WWWWWWWWWWWWWWWWWWWW'],
    [22, 7, 'WWWWWWW'], [22, 18, 'WWWWWWW'], [23, 6, 'WWWWWWWW'], [23, 18, 'WWWWWWWW'],
    [24, 5, 'WWWWWWWWW'], [24, 18, 'WWWWWWWWW'], [25, 4, 'WWWWWWWWWW'], [25, 18, 'WWWWWWWWWW'],
    [26, 3, 'WWWWWWWWWWC'], [26, 18, 'CWWWWWWWWWW'], [27, 2, 'WWWWWWWWWWc'], [27, 19, 'cWWWWWWWWWW'],
    [28, 2, 'CWWWWWWWWW'], [28, 20, 'WWWWWWWWWC'], [29, 1, 'FcFcFF'], [29, 25, 'FFcFcF'],
    [30, 2, 'c.c'], [30, 27, 'c.c'],
    [5, 0, 'H'], [8, 1, 'H'], [12, 2, 'H'], [16, 3, 'H'], [19, 3, 'W'], [17, 28, 'H'], [21, 27, 'W'], [10, 28, 'H']
  ];
  var HARRY = [
    [0, 13, 'dWWd'], [1, 12, 'WWWWWWWW'], [2, 11, 'WWWWWWWWWW'], [3, 12, 'WSSSSSSW'], [4, 12, 'WSSSSSSW'],
    [4, 13, 'dd'], [4, 17, 'dd'], [5, 13, 'EPE'], [5, 17, 'EPE'], [6, 13, 'SSSSSS'], [7, 13, 'SmmmmS'], [7, 14, 'XX'], [7, 17, 'XX'], [8, 14, 'mmmm'],
    [8, 11, 'BBBBBBBBBB'], [9, 11, 'BBBBBBBBBB'], [10, 12, 'BBBBBBBB'], [11, 13, 'bBBBbb'],
    [9, 4, 'C.c.C'], [9, 23, 'C.c.C'], [10, 2, 'CCC'], [10, 26, 'CCC'], [11, 2, 'Cc'], [11, 28, 'cC'],
    [10, 5, 'WdWdW'], [10, 22, 'WdWdW'], [11, 5, 'WdWdWd'], [11, 21, 'WdWdWd'], [12, 6, 'WdWdW'], [12, 21, 'WdWdW'],
    [12, 11, 'WWooooWW'], [13, 10, 'WWWooooWWW'], [14, 10, 'WWooooooWW'], [15, 10, 'WWooooooWW'], [16, 10, 'WWWddddWWW'],
    [17, 11, 'WdWdWdWd'], [18, 11, 'WdWdWdWd'], [19, 11, 'dWdWdWdW'], [20, 11, 'WdWdWdWd'], [21, 11, 'dWdWdWdW'],
    [22, 10, 'WWd'], [22, 19, 'dWW'], [23, 10, 'WWd'], [23, 19, 'dWW'], [24, 9, 'WWWd'], [24, 19, 'dWWW'],
    [25, 9, 'dWWd'], [25, 19, 'dWWd'], [26, 9, 'WWWd'], [26, 19, 'dWWW'], [27, 8, 'WWWWd'], [27, 19, 'dWWWW'],
    [28, 7, 'WWWWWd'], [28, 19, 'dWWWWW'], [29, 6, 'CWWWWc'], [29, 20, 'cWWWWC'], [30, 5, 'CcCc'], [30, 22, 'cCcC'],
    [2, 11, 'd'], [3, 11, 'W'], [6, 11, 'd'], [12, 9, 'd'], [14, 9, 'W'], [16, 20, 'd'], [18, 10, 'H'], [20, 20, 'd'], [23, 9, 'H'], [26, 22, 'H'], [1, 15, 'K']
  ];
  var PEPE = [
    [3, 4, 'WWWW'], [3, 10, 'WWWWW'], [3, 17, 'WWW'],
    [4, 3, 'WWWWWWWWWWWWWWWWW'], [5, 2, 'WWWWWWWWWWWWWWWWWW'], [6, 2, 'WWW'], [6, 17, 'WWWW'],
    [6, 5, 'dddddddddd'], [7, 4, 'dd'], [7, 16, 'ddd'],
    [8, 3, 'WEEEEEEWWEEEEEEW'], [9, 3, 'WEEEEEEWWEEEEEEW'], [10, 4, 'EEEEEEEWWEEEEEE'],
    [8, 5, 'PP'], [8, 13, 'PP'], [9, 6, 'P'], [9, 14, 'P'], [9, 4, 'I'], [9, 12, 'I'],
    [11, 3, 'WWWWWWWWWWWWWWWW'], [12, 4, 'WWWmmmmmmmmWWW'], [13, 5, 'mmmmmmmmmm'], [14, 6, 'MMMMMMMM'], [14, 5, 'm'], [14, 14, 'm'],
    [15, 8, 'WWWW'], [16, 8, 'WooW'], [17, 7, 'WWooWW'], [18, 7, 'WWooWW'], [19, 7, 'WWooWW'],
    [20, 7, 'WWwwWW'], [21, 7, 'WWddWW'], [22, 6, 'WW'], [22, 12, 'WW'], [23, 5, 'WWW'], [23, 12, 'WWW'],
    [24, 4, 'CWW'], [24, 13, 'WWC'], [25, 4, 'FF'], [25, 14, 'FF'], [26, 5, 'F'], [26, 14, 'F'],
    [15, 4, 'CC'], [15, 15, 'CC'], [16, 3, 'C'], [16, 16, 'C'],
    [4, 6, 'I'], [4, 14, 'I'], [5, 8, 'd'], [11, 16, 'I']
  ];
  var CHUPA = [
    [0, 13, 'K'], [0, 17, 'K'], [1, 12, 'qKq'], [1, 16, 'KqK'], [2, 11, 'qWWKq'], [2, 18, 'K'],
    [3, 10, 'qWWWWWWWq'], [4, 9, 'qWWWWWWWWK'], [5, 9, 'WW'], [5, 20, 'WqK'],
    [5, 10, 'qq'], [5, 17, 'qq'], [6, 10, 'EEEEE'], [6, 17, 'EEEEE'], [7, 10, 'EPPPE'], [7, 17, 'EPPPE'], [8, 11, 'EEE'], [8, 18, 'EEE'],
    [6, 12, 'P'], [6, 19, 'P'],
    [9, 10, 'WWddddddWW'], [10, 9, 'GGGGGGGGGG'], [11, 10, 'XGXGXGXGX'], [12, 10, 'XGXGXGXGX'], [13, 11, 'mmmmmmmm'],
    [6, 22, 'qK'], [7, 23, 'qWK'], [8, 23, 'qWK'], [9, 24, 'qK'], [10, 24, 'qWK'], [11, 25, 'qK'], [12, 25, 'qK'], [13, 26, 'K'], [14, 26, 'q'],
    [12, 2, 'C.C'], [13, 1, 'CCC'], [14, 1, 'cCc'], [15, 3, 'WWW'], [14, 5, 'WW'], [13, 6, 'WW'], [12, 8, 'WW'],
    [14, 16, 'WWWWW'], [16, 16, 'WWWW'], [17, 17, 'WW'], [15, 16, 'C.C.C'], [16, 15, 'c'], [16, 19, 'c'], [16, 21, 'C'],
    [13, 12, 'WWo'], [14, 10, 'WWWooWWW'], [15, 10, 'WWWooWWW'], [16, 11, 'WWooWW'], [17, 12, 'WooW'], [18, 12, 'dddd'],
    [14, 12, 'q'], [16, 14, 'q'], [16, 20, 'q'], [18, 9, 'q'], [19, 18, 'q'], [21, 8, 'q'], [23, 22, 'q'], [25, 6, 'q'], [24, 24, 'q'],
    [18, 6, 'WWWWW'], [19, 5, 'WWWWWW'], [20, 5, 'WWWWWW'], [21, 4, 'CWWWWC'], [22, 5, 'WWWW'],
    [18, 18, 'WWWWW'], [19, 19, 'WWWWWW'], [20, 20, 'WWWWW'], [21, 21, 'WWWWW'], [22, 22, 'WWWW'],
    [23, 4, 'WWWWW'], [24, 3, 'WWWWWW'], [25, 2, 'WWWWWWW'], [26, 2, 'CWWWWWC'], [27, 3, 'cCcCc'], [28, 4, 'c.c'],
    [23, 20, 'WWWW'], [24, 21, 'WWWWW'], [25, 22, 'WWWWWW'], [26, 23, 'CWWWWC'], [27, 24, 'cCcCc'], [28, 26, 'c.c'],
    [4, 14, 'K'], [8, 9, 'I'], [11, 22, 'd'], [20, 10, 'd'],
    [15, 16, 'C.C.C'], [16, 17, 'c.c.c']
  ];
  var STAR = [
    [1, 3, 'QQ'], [2, 2, 'QQQQ'], [3, 3, 'QQQ'], [4, 4, 'WWW'], [5, 5, 'WWW'], [6, 6, 'WWW'], [7, 7, 'WW'], [8, 8, 'WW'],
    [2, 13, 'WWWWWW'], [3, 12, 'WWWWWWWW'], [4, 11, 'WWWWWWWWWW'], [5, 11, 'WWW'], [5, 18, 'WWW'],
    [6, 11, 'WW'], [6, 19, 'WW'], [7, 11, 'WW'], [7, 19, 'WW'], [8, 12, 'WWWWWWWW'], [9, 13, 'WWWWWW'],
    [5, 14, 'AAAA'], [6, 13, 'AAAAAA'], [7, 13, 'AAAAAA'], [8, 14, 'aaaa'],
    [5, 14, 'EK'], [6, 14, 'EE'], [6, 18, 'P'], [7, 17, 'a'],
    [6, 21, 'dd'], [7, 21, 'Idd'], [8, 21, 'ddd'], [9, 21, 'Wdd'], [10, 21, 'dd'], [11, 20, 'd'], [12, 20, 'I'],
    [10, 10, 'WWWWWWWWW'], [11, 10, 'WWooooWWW'], [12, 11, 'WooooooW'], [13, 11, 'WWddddWW'], [14, 12, 'WWWWWW'],
    [8, 19, 'NUN'], [9, 19, 'ZZZ'], [10, 19, 'UUU'],
    [12, 19, 'W'], [13, 19, 'WWW'], [14, 20, 'QQQ'], [15, 20, 'QQ'],
    [15, 11, 'WW'], [15, 17, 'WW'], [16, 10, 'WWWW'], [16, 17, 'WWWW'], [17, 10, 'WWWW'], [17, 17, 'WWWW'],
    [18, 10, 'WWW'], [18, 18, 'WWW'], [19, 9, 'WWWW'], [19, 18, 'WWWW'], [20, 9, 'WWWW'], [20, 18, 'WWWW'],
    [21, 8, 'QWWW'], [21, 18, 'WWWQ'], [22, 8, 'FF'], [22, 20, 'FF'], [23, 8, 'FF'], [23, 20, 'FF'],
    [1, 4, 'Q'], [3, 2, 'Q'], [9, 22, 'I']
  ];

  function eggOf(id, frame) {
    var bob = frame === 1 ? -1 : 0, blinkF = frame === 2, act = frame === 3, g = grid(), y = 12 + bob;
    if (id === 'yeti') {
      stamp([
        [y - 6, 14, 'HH'], [y - 5, 12, 'WWWWWW'], [y - 4, 10, 'WWMMMMWW'], [y - 3, 10, blinkF ? 'WWmmmmWW' : 'WWEPEPEW'],
        [y - 2, 10, 'WWMMMMWW'], [y - 1, 11, act ? 'GGGGGG' : 'WGGGGW'], [y, 12, 'XGXGX'], [y + 1, 9, 'WWWWWWWWWW'],
        [y + 2, 8, 'WWWWWWWWWWWW'], [y + 3, 8, 'WWWwooooWWWW'], [y + 4, 9, 'WWWWWWWWWW'], [y + 5, 11, 'WWWWWW'],
        [y - 4, 8, 'C'], [y - 4, 22, 'C'], [y + 4, 7, 'c'], [y + 4, 23, 'c']
      ]).forEach(function (row, yy) { row.forEach(function (k, x) { if (k) g[yy][x] = k; }); });
    } else if (id === 'sasquatch') {
      stamp([
        [y - 5, 12, 'WWWWWW'], [y - 4, 11, 'WSSSSSW'], [y - 3, 11, blinkF ? 'WSmmmmW' : 'WSEEPESW'], [y - 2, 11, 'WSXXSSW'],
        [y - 1, 11, 'BBBBBB'], [y, 12, 'BBBB'], [y + 1, 10, 'WWWWWWWW'], [y + 2, 9, 'WWWWWWWWWW'], [y + 3, 9, 'WWWoooooWW'],
        [y + 4, 10, 'WWWWWWWW'], [y + 5, 12, 'WWWW'], [y + 2, 8, 'C'], [y + 2, 22, 'C']
      ]).forEach(function (row, yy) { row.forEach(function (k, x) { if (k) g[yy][x] = k; }); });
    } else if (id === 'greypepe') {
      stamp([
        [y - 6, 10, 'WW'], [y - 6, 16, 'WWW'], [y - 5, 8, 'WWWWWWWWWW'], [y - 4, 7, 'WWddddddWW'],
        [y - 3, 7, blinkF ? 'WWddddddWW' : 'WEEEEEEEEW'], [y - 2, 8, blinkF ? 'dddddd' : 'EPP..PPE'],
        [y - 1, 8, 'mmmmmmmm'], [y, 9, 'MMMMMM'], [y + 1, 12, 'WooW'], [y + 2, 11, 'WWooWW'], [y + 3, 11, 'WWWW'],
        [y - 7, 22, 'QQ'], [y - 6, 21, lights(act) ], [y - 5, 22, 'LL']
      ]).forEach(function (row, yy) { row.forEach(function (k, x) { if (k) g[yy][x] = k; }); });
    } else if (id === 'chupacabra') {
      stamp([
        [y - 7, 13, 'qKq'], [y - 6, 12, 'qWWWq'], [y - 5, 11, 'WWWWWW'], [y - 4, 11, blinkF ? 'WddddW' : 'WEEPEW'],
        [y - 3, 11, 'WXXXXW'], [y - 2, 12, 'mmmm'], [y - 1, 10, 'WWWWWWWW'], [y, 9, 'WWWoWWW'], [y + 1, 9, 'WWwwWWW'],
        [y + 2, 10, 'WWWWWW'], [y + 3, 8, 'C'], [y + 3, 22, 'C'], [y - 5, 20, 'qK'], [y - 4, 21, 'q'], [y, 18, 'q']
      ]).forEach(function (row, yy) { row.forEach(function (k, x) { if (k) g[yy][x] = k; }); });
    } else {
      stamp([
        [y - 5, 12, 'WWWWWW'], [y - 4, 11, 'WWWWWWWW'], [y - 3, 11, blinkF ? 'WWaaaaWW' : 'WWAAAAWW'],
        [y - 2, 12, blinkF ? 'aaaa' : 'AEEA'], [y - 1, 11, 'WWWWWWWW'], [y, 12, 'WWooWW'], [y + 1, 11, 'WWWWWWWW'],
        [y + 2, 12, 'WWWW'], [y + 3, 11, 'FF'], [y + 3, 18, 'FF'], [y, 10, 'ZU'], [y + 1, 10, 'NZ'], [y - 4, 20, 'd']
      ]).forEach(function (row, yy) { row.forEach(function (k, x) { if (k) g[yy][x] = k; }); });
    }
    return g;
  }
  function lights(on) { return on ? 'ULULU' : 'UuUuU'; }

  function mythic(id) {
    if (id === 'yeti') return stamp(YETI);
    if (id === 'sasquatch') return stamp(HARRY);
    if (id === 'greypepe') return stamp(PEPE);
    if (id === 'chupacabra') return stamp(CHUPA);
    return stamp(STAR);
  }
  function actOn(id, g) {
    var o = clone(g);
    if (id === 'yeti') {
      moveKeys(o, function (k, x, y) { return (k === 'C' || k === 'c') && y < 8; }, -2, 0, 'W');
      var ys = []; for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) if (o[y][x] === 'G' || o[y][x] === 'X') ys.push(y);
      if (ys.length) { var yb = Math.max.apply(null, ys); for (var x2 = 0; x2 < N; x2++) if (o[yb][x2] === 'G' || o[yb][x2] === 'X') { set(o, x2, yb + 1, o[yb][x2] === 'X' ? 'G' : 'X'); set(o, x2, yb + 2, 'G'); } }
    } else if (id === 'sasquatch') {
      moveKeys(o, function (k, x, y) { return (k === 'C' || k === 'c' || k === 'W' || k === 'd' || k === 'H') && x >= 21 && y <= 12; }, -3, 0, null);
    } else if (id === 'greypepe') {
      var lip = []; for (var y3 = 0; y3 < N; y3++) for (var x3 = 0; x3 < N; x3++) if (o[y3][x3] === 'm' || o[y3][x3] === 'M') lip.push([x3, y3]);
      lip.sort(function (a, b) { return b[0] - a[0]; }); lip.slice(0, 4).forEach(function (p) { o[p[1]][p[0]] = 'W'; set(o, p[0], p[1] - 1, 'm'); });
    } else if (id === 'chupacabra') {
      moveKeys(o, function (k, x) { return (k === 'C' || k === 'c') && x < 14; }, -1, -3, 'W');
    } else {
      moveKeys(o, function (k, x, y) { return k === 'Q' && x < 10 && y < 8; }, -2, -1, null);
      return shift(o, -1, 0);
    }
    return o;
  }
  function fit(id, stage, g) {
    if (stage === 5) return g;
    var b = bbox(g, {}); var sh = b.y1 - b.y0 + 1, sw = b.x1 - b.x0 + 1;
    var th = [0, 17, 21, 25, 28, 31][stage];
    var tw = Math.max(8, Math.round(th * sw / sh));
    if (tw > 30) { tw = 30; th = Math.max(12, Math.round(30 * sh / sw)); }
    if (id === 'greypepe') { tw = Math.min(tw, 22); x0 = 1; }
    var x0 = Math.max(1, Math.floor((30 - tw) / 2));
    var y0 = Math.max(1, 30 - th);
    return scaleInto(g, tw, th, x0, y0);
  }
  function finish(g, gear, glow) { var body = clone(g); gearOn(g, gear, eyeTop(g)); var o = outline(g); if (glow) o = addGlow(o, body); return o; }

  function draw(id, stage, frame, gear) {
    frame = frame || 0; stage = stage || 0;
    var g;
    if (!stage) g = eggOf(id, frame);
    else {
      g = mythic(id);
      if (frame === 3) g = actOn(id, g);
      g = fit(id, stage, g);
      if (frame === 2) g = blink(g, LID[id]);
      if (frame === 1) g = shift(g, -1, 0);
      if (id === 'greypepe') {
        var big = stage >= 3, ux = 25, uy = frame === 3 ? 1 : 2;
        ufo(g, ux, uy + (frame === 1 ? -1 : 0), big, frame !== 2);
      }
    }
    return finish(g, stage ? gear : null, id === 'greypepe');
  }
  function render(id, stage, frame, bg, gear, opts) { var g = draw(id, stage, frame, gear), pal = PAL[id], dead = opts && opts.dead, d = [], Bg = hexRgb(bg || '#1b2430');
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) { var k = g[y][x], c = null;
      if (k) { var hex = k.charAt(0) === '#' ? k : pal[k]; c = hex ? hexRgb(hex) : null; if (c && dead && k !== 'n') c = deadRgb(c); } if (!c) c = Bg;
      d.push(c[0], c[1], c[2], 255); } return { width: N, height: N, data: d }; }
  function frames(id, stage, bg, gear, opts) { return [0, 1, 2, 3].map(function (f) { return render(id, stage, f, bg, gear, opts); }); }
  function anchors(id, stage, frame) { var g = draw(id, stage, frame || 0, {}), ey = -1, x0 = 99, x1 = -1;
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) { var k = g[y][x]; if (k === 'E' || k === 'P') { if (ey < 0) ey = y; if (y === ey) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); } } } return { ey: ey, ex0: x0, ex1: x1 }; }
  function has(id) { return IDS.indexOf(id) >= 0; }
  return { IDS: IDS, NAMES: NAMES, STAGES: STAGES, PAL: PAL, draw: draw, render: render, frames: frames, anchors: anchors, has: has };
});
