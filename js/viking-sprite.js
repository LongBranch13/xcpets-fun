/* VIKING sprite (1 of 1, PREVIEW, branch viking-1of1, owner Oct 31 2026 "ok we have to make and give them a 1 of 1 Viking egg"). NOT used by any rule until
 * V2Rules.ACTIVATE_VIKING_BLOCK is set (null = OFF). Same frame format and API as KekSprite / HomerSprite (32x32 key grid, {data: RGBA}, 4-frame bob,
 * ink outline). 8-bit Norse warrior: steel horned helmet with a rivet band and nose guard, braided ginger beard with bronze beads, fjord-blue tunic,
 * fur cloak (Juvenile+), round painted shield (Adult+), bearded axe (Elder+), frost runes on helmet band, shield and axe edge (Mythic).
 * No fire aura, no flame crown, no gold frame / rim: the Mythic look is the frost runes only.
 * Keys used by V2Rules for hybrids: S/s/k skin, E/P eyes, m mouth, B/b/c/r beard, M/I/Q steel + H/h horns (the helmet = the 'top' part), T/t tunic.
 * The helmet is PART of him (like Lord Kek's nemes): Headwear gear is not drawn on the Viking; the other slots are (hand replaces the axe). */
(function (root, factory) { if (typeof module === 'object' && module.exports) module.exports = factory(); else root.VikingSprite = factory(); })(this, function () {
  'use strict';
  var N = 32, PAL = { n: '#1a1420',
    S: '#e0a07c', s: '#b87656', k: '#f2be98',                       // weathered skin
    E: '#f4f2ea', P: '#141018', m: '#7a2a22',                       // eyes, mouth
    B: '#cc5a1e', b: '#8a3410', c: '#ee8a3a', r: '#b07a3a',         // braided ginger beard + bronze beads
    M: '#9aa6b4', I: '#5f6b7a', Q: '#c3ccd6',                       // helmet steel
    H: '#e6d3a8', h: '#b39468',                                     // horns
    T: '#3580a8', t: '#24597a',                                     // fjord-blue tunic
    L: '#6b3f1f', l: '#b07a3a',                                     // belt + buckle
    F: '#8a6a4a', f: '#5e4430', G: '#b8946a',                       // fur cloak
    W: '#a0642e', w: '#6e4220', K: '#b8322a',                       // shield wood + red paint
    R: '#7a6248', O: '#4a3424',                                     // trousers, boots
    U: '#7fd8ff', Z: '#4a93b8' };                                   // frost runes (Mythic), egg highlight
  var STAGES = ['Egg', 'Hatchling', 'Juvenile', 'Adult', 'Elder', 'Mythic'];
  /* per stage: head half-width, helmet rows, body half-width, body rows, beard rows below the mouth, horn size */
  var DIM = [null, { hw: 5, hl: 3, bw: 4, bh: 5, bd: 1, hn: 1 }, { hw: 6, hl: 4, bw: 5, bh: 7, bd: 3, hn: 2 }, { hw: 7, hl: 5, bw: 6, bh: 9, bd: 4, hn: 3 },
    { hw: 7, hl: 5, bw: 7, bh: 9, bd: 5, hn: 3 }, { hw: 7, hl: 5, bw: 7, bh: 9, bd: 5, hn: 4 }];
  function grid() { var g = []; for (var i = 0; i < N; i++) g.push(new Array(N).fill(null)); return g; }
  function set(g, x, y, k) { if (x >= 0 && y >= 0 && x < N && y < N) g[y][x] = k; }
  function get(g, x, y) { return x >= 0 && y >= 0 && x < N && y < N ? g[y][x] : null; }
  function hline(g, x0, x1, y, k) { for (var x = x0; x <= x1; x++) set(g, x, y, k); }
  function mir(x) { return 31 - x; } /* mirror about the centre line 15.5 */
  function both(g, x, y, k) { set(g, x, y, k); set(g, mir(x), y, k); }
  function outline(g) { var o = g.map(function (r) { return r.slice(); }); for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) if (!g[y][x]) {
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(function (d) { var X = x + d[0], Y = y + d[1]; return X >= 0 && Y >= 0 && X < N && Y < N && g[Y][X]; })) o[y][x] = 'n'; } return o; }
  function hexRgb(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
  /* round shield centred (x, y), radius 2 (small) or 3; quartered red / wood, steel boss, frost rune at Mythic */
  function shield(g, x, y, R, myth) { for (var dy = -R; dy <= R; dy++) for (var dx = -R; dx <= R; dx++) { var d2 = dx * dx + dy * dy; if (d2 > R * R + R) continue;
      var rim = d2 > (R - 1) * (R - 1) + (R - 1); set(g, x + dx, y + dy, rim ? 'I' : (dx < 0) === (dy < 0) ? 'K' : (dx + dy) % 2 ? 'w' : 'W'); }
    set(g, x, y, 'Q'); if (R >= 3) { set(g, x - 1, y, 'I'); set(g, x, y - 1, 'I'); }
    if (myth) { set(g, x - 2, y - 1, 'U'); set(g, x + 2, y + 1, 'U'); set(g, x + 1, y - 2, 'U'); set(g, x - 1, y + 2, 'U'); } }
  /* horned helmet: dome rows top..rim, rivet band on the rim, nose guard, horns curving up from the sides */
  function helmet(g, cx, top, hw, hl, hn, myth) { var rim = top + hl - 1;
    var DW = hl - 1 === 2 ? [3, hw] : hl - 1 === 3 ? [3, hw - 1, hw] : [3, hw - 2, hw - 1, hw];
    for (var r = 0; r < hl - 1; r++) { var w = DW[r];
      for (var x = cx - w; x < cx + w; x++) set(g, x, top + r, x === cx - w + 1 || (x === cx - w && r > 0) ? 'Q' : x >= cx + w - 2 ? 'I' : 'M'); }
    for (var x2 = cx - hw; x2 < cx + hw; x2++) set(g, x2, rim, (x2 - cx + hw) % 3 === 1 ? (myth ? 'U' : 'Q') : 'I');      // rivet band (frost runes at Mythic)
    set(g, cx - 1, rim + 1, 'I'); set(g, cx, rim + 1, 'I');                                                           // nose guard
    /* horns: from the side of the dome, out and up */
    var bx = cx - hw - 1, by = rim - 1;
    var H = hn === 1 ? [[0, 0, 'H'], [-1, 0, 'H'], [-1, -1, 'h']]
      : hn === 2 ? [[0, 0, 'H'], [-1, 0, 'H'], [-1, -1, 'H'], [-2, -1, 'H'], [-2, -2, 'h'], [-1, -3, 'h']]
      : hn === 3 ? [[0, 0, 'H'], [-1, 0, 'H'], [-1, -1, 'H'], [-2, -1, 'H'], [-2, -2, 'H'], [-3, -2, 'H'], [-3, -3, 'H'], [-3, -4, 'h'], [-2, -5, 'h']]
      : [[0, 0, 'H'], [-1, 0, 'H'], [-1, -1, 'H'], [-2, -1, 'H'], [-2, -2, 'H'], [-3, -2, 'H'], [-3, -3, 'H'], [-4, -3, 'H'], [-4, -4, 'h'], [-4, -5, 'Q'], [-3, -6, 'Q']];
    H.forEach(function (p) { set(g, bx + p[0], by + p[1], p[2]); set(g, mir(bx + p[0]), by + p[1], p[2] === 'H' && p[1] === 0 ? 'h' : p[2]); }); }
  function draw(stage, frame, gear, opts) {
    var g = grid(), bob = [0, -1, -1, 0][frame || 0], Gr = gear || {}, cx = 16;
    function kind(sl) { return Gr[sl] ? String(Gr[sl].label || Gr[sl].item || '').toLowerCase() : ''; }
    function col(sl, i) { var x = Gr[sl], c = x && x.cols; return (c && (c[i || 0] || c[0])) || (i ? '#5f6b7a' : '#9aa6b4'); }
    if (stage === 0) { // egg: fjord-blue shell, little steel helmet cap with horns on top, round shield emblem on the front
      for (var y = 0; y < 17; y++) { var hw0 = Math.round(Math.sqrt(Math.max(0, 1 - Math.pow((y - 8.5) / 8.5, 2))) * (y < 8 ? 6.5 : 7.5)); for (var x = 16 - hw0; x < 16 + hw0; x++) { var e0 = x - 16;
        set(g, x, 12 + y + bob, e0 <= -hw0 + 1 && y > 2 ? 'Z' : e0 >= hw0 - 2 ? 't' : 'T'); } }
      for (var yc = 12; yc <= 15; yc++) for (var xc = 0; xc < N; xc++) if (get(g, xc, yc + bob)) set(g, xc, yc + bob, yc === 15 ? ((xc % 3) === 1 ? 'Q' : 'I') : xc < 14 ? 'Q' : xc > 18 ? 'I' : 'M');
      [[12, 13, 'H'], [11, 13, 'H'], [11, 12, 'H'], [10, 12, 'H'], [10, 11, 'h'], [10, 10, 'h']].forEach(function (p) { both(g, p[0], p[1] + bob, p[2]); });
      shield(g, 16, 21 + bob, 3, false);
      return outline(g);
    }
    var D = DIM[stage], myth = stage === 5, bodyEnd = 27 + bob, bodyTop = bodyEnd - D.bh + 1, headBot = bodyTop - 1,
      faceRows = 4, hh = D.hl + faceRows, headTop = headBot - hh + 1, rim = headTop + D.hl - 1, ey = rim + 1,
      noseY = ey + 1, musY = headBot - 1, mouthY = headBot, bw = D.bw;
    /* fur cloak behind (Juvenile+): drapes from the shoulders to the boots, wider than the body */
    if (stage >= 2 && !Gr.back) { for (var yb = bodyTop + 1; yb <= bodyEnd - 1; yb++) { var cw = bw + 1 + (yb - bodyTop > 3 ? 1 : 0); set(g, cx - cw - 1, yb, (yb % 2) ? 'f' : 'F'); set(g, mir(cx - cw - 1), yb, (yb % 2) ? 'F' : 'f'); if (stage >= 3) { set(g, cx - cw, yb, 'F'); set(g, mir(cx - cw), yb, 'f'); } } }
    else if (Gr.back) { var k0 = col('back'), k1 = col('back', 1); for (var yb2 = bodyTop + 1; yb2 <= bodyEnd - 1; yb2++) { var cw2 = bw + 1 + (yb2 - bodyTop > 3 ? 1 : 0); set(g, cx - cw2 - 1, yb2, yb2 % 2 ? k1 : k0); set(g, mir(cx - cw2 - 1), yb2, yb2 % 2 ? k0 : k1); set(g, cx - cw2, yb2, k0); set(g, mir(cx - cw2), yb2, k1); } }
    /* body: tunic (lit left, shaded right), belt, trousers, boots */
    var beltY = bodyEnd - (stage === 1 ? 2 : 3), tunicK = Gr.body ? col('body') : 'T', tunicD = Gr.body ? col('body', 1) : 't';
    for (var yy = bodyTop; yy <= bodyEnd; yy++) { var w = yy === bodyTop ? bw - 1 : bw;
      for (var x3 = cx - w; x3 < cx + w; x3++) { var kk = yy === beltY ? (x3 === cx - 1 || x3 === cx ? 'l' : 'L') : yy > beltY + (stage === 1 ? 0 : 1) ? (x3 === cx - 1 || x3 === cx ? null : 'R') : x3 >= cx + w - 2 ? tunicD : tunicK; if (kk) set(g, x3, yy, kk); } }
    var bootK = Gr.feet ? col('feet') : 'O'; hline(g, cx - bw + 1, cx - 2, bodyEnd + 1, bootK); hline(g, cx + 1, cx + bw - 2, bodyEnd + 1, bootK);
    /* fur collar on the shoulders (Juvenile+) */
    if (stage >= 2) { hline(g, cx - bw - 1, cx + bw, bodyTop, 'F'); for (var xf = cx - bw - 1; xf <= cx + bw; xf += 2) set(g, xf, bodyTop, 'G'); set(g, cx - bw - 1, bodyTop + 1, 'F'); set(g, cx + bw, bodyTop + 1, 'F'); }
    /* arms + hands */
    var handY = beltY - (stage === 1 ? 0 : 1), armTop = bodyTop + 1;
    for (var ya = armTop; ya < handY; ya++) { set(g, cx - bw - 1, ya, tunicK); set(g, cx + bw, ya, tunicD); }
    set(g, cx - bw - 1, handY, 'S'); set(g, cx + bw, handY, 's');
    /* head: face below the helmet */
    for (var yh = rim; yh <= headBot; yh++) { var wf = yh === headBot ? D.hw - 2 : D.hw - 1; for (var x4 = cx - wf; x4 < cx + wf; x4++) set(g, x4, yh, x4 === cx - wf ? 'k' : x4 >= cx + wf - 1 ? 's' : 'S'); }
    /* eyes either side of the nose guard (pupils inside), nose */
    set(g, cx - 3, ey, 'E'); set(g, cx - 2, ey, 'P'); set(g, cx + 1, ey, 'P'); set(g, cx + 2, ey, 'E');
    if (noseY > 0) { set(g, cx - 1, noseY, 's'); set(g, cx, noseY, 's'); }
    /* beard: mustache, mouth, full beard over the chest, two braids with bronze beads */
    var bk = function (x, y) { return (x + y) % 4 === 0 ? 'c' : (x - cx + 20 + y) % 3 === 0 && x >= cx ? 'b' : 'B'; };
    var mw = D.hw - 2; hline(g, cx - mw, cx + mw - 1, musY, 'B'); set(g, cx - mw, musY, 'c'); set(g, cx + mw - 1, musY, 'b');
    for (var xm = cx - mw; xm < cx + mw; xm++) set(g, xm, mouthY, xm === cx - 1 || xm === cx ? 'm' : bk(xm, mouthY));
    var by0 = mouthY + 1, bLen = D.bd;
    for (var yr = 0; yr < bLen; yr++) { var bw2 = Math.max(2, mw - Math.max(0, yr - 1)); for (var xb = cx - bw2; xb < cx + bw2; xb++) set(g, xb, by0 + yr, bk(xb, by0 + yr)); }
    if (stage >= 2) { var bxL = cx - 2, bxR = cx + 1, bt = by0 + bLen, bl = stage >= 4 ? 3 : 2;
      for (var yq = 0; yq < bl; yq++) { set(g, bxL, bt + yq, yq % 2 ? 'b' : 'B'); set(g, bxR, bt + yq, yq % 2 ? 'B' : 'b'); }
      set(g, bxL, bt + bl, myth ? 'Q' : 'r'); set(g, bxR, bt + bl, myth ? 'Q' : 'r'); }
    if (stage === 4) { set(g, cx - mw + 1, by0, 'c'); set(g, cx + mw - 2, by0 + 1, 'c'); }                                   // Elder: lighter streaks
    /* horned helmet (part of him: Headwear gear is not drawn) */
    helmet(g, cx, headTop, D.hw, D.hl, D.hn, myth);
    /* round shield on his left arm (viewer's left), Adult+ */
    if (stage >= 3) shield(g, cx - bw - 2, bodyTop + 4, 3, myth); else if (stage === 2) shield(g, cx - bw - 1, bodyTop + 4, 2, false);
    /* right hand (viewer's right): the bearded axe from Elder, or the held Grip piece */
    var hx = cx + bw + 1;
    if (Gr.hand) { var ak = kind('hand'), a0 = col('hand'), a1 = col('hand', 1);
      if (/sword|staff|stick|dagger|wand|torch|spear|candle|bat|banner|flag|axe|hammer|club|cane|rod/.test(ak)) { for (var t = 0; t < 8; t++) set(g, hx, handY - t, t > 5 ? a1 : a0); }
      else { set(g, hx, handY, a0); set(g, hx + 1, handY, a0); set(g, hx, handY - 1, a1); set(g, hx + 1, handY - 1, a0); set(g, hx, handY - 2, a0); } }
    else if (stage >= 4) { for (var th = handY + 1; th >= handY - 8; th--) set(g, hx, th, 'L');
      var ay = handY - 8; [[1, 0, 'M'], [1, 1, 'M'], [2, 1, 'Q'], [1, 2, 'M'], [2, 2, 'M'], [3, 2, myth ? 'U' : 'Q'], [1, 3, 'M'], [2, 3, 'M'], [3, 3, myth ? 'U' : 'Q'], [1, 4, 'I'], [2, 4, myth ? 'U' : 'Q']].forEach(function (p) { set(g, hx + p[0], ay + p[1], p[2]); }); }
    /* face gear (Guise): shades / mask over the eye row */
    if (Gr.face) { var gk = kind('face'), g0 = col('face');
      if (/tear/.test(gk)) set(g, cx - 3, ey + 1, g0);
      else if (/shade|sunglass|goggle|visor|laser|beam|glass|mask/.test(gk)) { hline(g, cx - 4, cx - 2, ey, g0); hline(g, cx + 1, cx + 3, ey, g0); }
      else set(g, cx + 3, ey + 1, g0); }
    return outline(g);
  }
  /** anchors(stage, frame): eye row + eye span and mouth row of the plain sprite (for V2Rules / V2Render). */
  function anchors(stage, frame) { if (!stage) return { ey: -1 }; var g = draw(stage, frame || 0, {}), ey = -1, x0 = 99, x1 = -1, my = -1;
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) { var k = g[y][x]; if (k === 'E' || k === 'P') { if (ey < 0) ey = y; if (y === ey) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); } } if (k === 'm' && my < 0) my = y; }
    return { ey: ey, ex0: x0, ex1: x1, my: my }; }
  /** render(stage, frame, bg, gear?, opts?) -> { width, height, data: [RGBA...] }; opts.pal recolours keys (hybrid shape) */
  function render(stage, frame, bg, gear, opts) { var g = draw(stage, frame, gear, opts), d = [], Bg = hexRgb(bg || '#1b2430'), P = Object.assign({}, PAL, (opts && opts.pal) || {});
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) { var k = g[y][x], c = k ? hexRgb(P[k] || k) : Bg; d.push(c[0], c[1], c[2], 255); } return { width: N, height: N, data: d }; }
  function frames(stage, bg, gear, opts) { return [0, 1, 2, 3].map(function (f) { return render(stage, f, bg, gear, opts); }); }
  return { STAGES: STAGES, PAL: PAL, DIM: DIM, render: render, frames: frames, draw: draw, anchors: anchors };
});
