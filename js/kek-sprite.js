/* Lord Kek sprite (DRAFT, branch lord-kek, 2026-10-20): Community pet #3 candidate. NOT loaded by any page and NOT used by any rule.
 * Same frame format and API as WizardSprite (32x32, {data: RGBA}, 4-frame bob, ink outline, gold Mythic rim).
 * Reference: design/ref/lord-kek-card.jpg ("Lord Kek, Ruler of All Pepes"): green Pepe on a throne, blue/gold striped nemes,
 * gold Egyptian wings, Eye of Horus. Base sprite is a bare Pepe (Pepe-style heavy-lidded eyes + wide lips, like pet-core 'pepe');
 * the nemes is a signature Headwear gear piece drawn by the gear layer (like the Wizard Hat). Throne from Elder, wings + Eye of Horus at Mythic.
 * Community palette = the card's lapis/gold nemes; player palette (after Cold Storage) = red/gold nemes, so lapis stays the community badge. */
(function (root, factory) { if (typeof module === 'object' && module.exports) module.exports = factory(); else root.KekSprite = factory(); })(this, function () {
  'use strict';
  var N = 32, PAL = { n: '#14200f', G: '#5aa83c', g: '#3d7a2a', h: '#86cf5e', E: '#f4f4ee', P: '#111111', k: '#2e5e22', m: '#7a3426', l: '#b5533c',
    B: '#c8342c', b: '#8a1f1a', y: '#ffd23f', o: '#c49a1a', T: '#6b3f1f', t: '#4a2a12', A: '#ffc93c', w: '#ffffff', c: '#2bb5c8' };
  var PAL_COMMUNITY = { B: '#2a4fbf', b: '#1a3380' };                       // lapis nemes stripes, as on the card
  /** NEMES: signature Headwear piece (display only, NOT in the gear pool). */
  var NEMES = { slot: 'head', item: 'kek-nemes', label: 'Nemes of Kek', tier: 'legendary', legendary: true, signature: true, stats: 'Signature · cosmetic (no stats, like other ★ hats)' };
  function isNemes(x) { return !!(x && x.item === 'kek-nemes'); }
  var STAGES = ['Egg', 'Hatchling', 'Juvenile', 'Adult', 'Elder', 'Mythic'];
  /* per stage: head half-width / height, body half-width / height */
  var DIM = [null, { hw: 6, hh: 6, bw: 4, bh: 4 }, { hw: 7, hh: 6, bw: 5, bh: 6 }, { hw: 8, hh: 7, bw: 7, bh: 7 }, { hw: 8, hh: 7, bw: 7, bh: 8 }, { hw: 8, hh: 7, bw: 7, bh: 8 }];
  function grid() { var g = []; for (var i = 0; i < N; i++) g.push(new Array(N).fill(null)); return g; }
  function set(g, x, y, k) { if (x >= 0 && y >= 0 && x < N && y < N) g[y][x] = k; }
  function rect(g, x0, y0, w, h, k) { for (var y = y0; y < y0 + h; y++) for (var x = x0; x < x0 + w; x++) set(g, x, y, k); }
  function hline(g, x0, x1, y, k) { for (var x = x0; x <= x1; x++) set(g, x, y, k); }
  function outline(g) { var o = g.map(function (r) { return r.slice(); }); for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) if (!g[y][x]) {
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(function (d) { var X = x + d[0], Y = y + d[1]; return X >= 0 && Y >= 0 && X < N && Y < N && g[Y][X] && g[Y][X] !== 'y' && g[Y][X] !== 'A'; })) o[y][x] = 'n'; } return o; }
  function hexRgb(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
  /* Eye of Horus, 7x4, top-left (x, y) */
  function horus(g, x, y) { hline(g, x + 1, x + 5, y, 'n'); hline(g, x, x + 6, y + 1, 'E'); set(g, x + 3, y + 1, 'n'); set(g, x + 2, y + 1, 'n'); set(g, x, y + 1, 'n'); hline(g, x + 1, x + 5, y + 2, 'n');
    set(g, x + 2, y + 3, 'n'); set(g, x + 5, y + 3, 'n'); set(g, x + 6, y + 3, 'n'); }
  /* nemes headdress: striped cap above the eyes, gold brow band, lappets down both sides, uraeus at the front */
  function nemes(g, cx, top, hw, low) {
    for (var j = 0; j < 4; j++) { var w = hw - 2 + j; hline(g, cx - w, cx + w - 1, top - 4 + j, j % 2 ? 'y' : 'B'); }
    hline(g, cx - hw, cx + hw - 1, top, 'y');                                                    // brow band
    for (var r = top + 1; r <= low; r++) { var k = (r - top) % 2 ? 'B' : 'y'; set(g, cx - hw - 1, r, k); set(g, cx - hw - 2, r, k); set(g, cx + hw, r, k); set(g, cx + hw + 1, r, k); }
    set(g, cx - 1, top - 5, 'y'); set(g, cx, top - 5, 'o'); set(g, cx - 1, top - 6, 'o');      // uraeus
  }
  function draw(stage, frame, gear, opts) {
    var g = grid(), bob = [0, -1, -1, 0][frame || 0], Gr = gear || {};
    function kind(sl) { return Gr[sl] ? String(Gr[sl].label || Gr[sl].item || '').toLowerCase() : ''; }
    function col(sl, i) { var x = Gr[sl], c = x && x.cols; return (c && (c[i || 0] || c[0])) || (i ? '#c49a1a' : '#ffd23f'); }
    if (stage === 0) { // egg: green egg, striped nemes band, Eye of Horus on the front
      for (var y = 0; y < 18; y++) { var hw = Math.round(Math.sqrt(Math.max(0, 1 - Math.pow((y - 9.5) / 9.5, 2))) * (y < 9 ? 7 : 8)); for (var x = 16 - hw; x < 16 + hw; x++) { var e0 = x - 16;
        set(g, x, 11 + y + bob, e0 <= -hw + 1 && y > 2 ? 'h' : e0 >= hw - 2 ? 'g' : 'G'); } }
      for (var s = 0; s < 3; s++) { var yy = 15 + s + bob; for (var x1 = 0; x1 < N; x1++) if (g[yy][x1]) g[yy][x1] = s === 1 ? 'B' : 'y'; }
      horus(g, 13, 21 + bob);
      if (isNemes(Gr.head)) nemes(g, 16, 11 + bob, 5, 15 + bob);
      return outline(g);
    }
    var D = DIM[stage], cx = 16, bodyEnd = 27 + bob, bodyTop = bodyEnd - D.bh + 1, headBot = bodyTop + 1, headTop = headBot - D.hh + 1;
    // Mythic wings behind everything (the card's gold Egyptian wings)
    if (stage === 5) for (var d = 0; d < 6; d++) { var t0 = headTop - 1 - d, b0 = bodyTop + 5 - Math.round(d * 0.8);
      for (var yw = t0; yw <= b0; yw++) { var kw = (yw - t0) % 3 === 2 ? 'o' : d === 5 && yw > t0 + 1 ? 'o' : 'y'; if (yw === b0 && d % 2) kw = 'c'; set(g, cx - 10 - d, yw, kw); set(g, cx + 9 + d, yw, kw); } }
    // throne from Elder: tall back, gold trim, seat and legs
    if (stage >= 4) { rect(g, cx - 10, headTop + 2, 20, bodyEnd - headTop - 1, 'T'); hline(g, cx - 10, cx + 9, headTop + 2, 'y'); for (var yt = headTop + 2; yt <= bodyEnd; yt++) { set(g, cx - 10, yt, 'y'); set(g, cx + 9, yt, 'y'); }
      rect(g, cx - 11, bodyEnd - 2, 22, 2, 't'); hline(g, cx - 11, cx + 10, bodyEnd - 2, 'y'); set(g, cx - 10, bodyEnd + 1, 't'); set(g, cx + 9, bodyEnd + 1, 't'); set(g, cx - 10, bodyEnd + 2, 't'); set(g, cx + 9, bodyEnd + 2, 't'); }
    // back gear (cape) behind the body
    if (Gr.back) { var kc = col('back'), kd = col('back', 1); for (var jb = 0; jb < D.bh; jb++) { var wb = D.bw + 1 + Math.round(jb / 3); for (var xb = cx - wb; xb < cx + wb; xb++) set(g, xb, bodyTop + jb, (xb + jb) % 4 === 0 ? kd : kc); } }
    // body: seated pear shape, lit left edge, shaded right
    for (var j = 0; j < D.bh; j++) { var w = Math.min(D.bw, D.bw - 2 + j); for (var x2 = cx - w; x2 < cx + w; x2++) set(g, x2, bodyTop + j, x2 === cx - w ? 'h' : x2 >= cx + w - 2 ? 'g' : 'G'); }
    // feet / knees and hands on knees
    hline(g, cx - D.bw - 1, cx - 2, bodyEnd + 1, 'G'); hline(g, cx + 1, cx + D.bw, bodyEnd + 1, 'g');
    var hy = bodyEnd - 2; set(g, cx - D.bw - 1, hy, 'G'); set(g, cx - D.bw - 1, hy + 1, 'G'); set(g, cx + D.bw, hy, 'g'); set(g, cx + D.bw, hy + 1, 'g');
    // head: wide rounded Pepe head
    for (var r = 0; r < D.hh; r++) { var ins = (r === 0 || r === D.hh - 1) ? 1 : 0; for (var x3 = cx - D.hw + ins; x3 < cx + D.hw - ins; x3++) set(g, x3, headTop + r, x3 <= cx - D.hw + ins ? 'h' : x3 >= cx + D.hw - ins - 1 ? 'g' : 'G'); }
    // eye bulges on top + heavy lids + whites + pupils looking right (pet-core Pepe look)
    var ew = stage === 1 ? 4 : 5, ex = [cx - ew - 1, cx + 1];
    ex.forEach(function (x0) { hline(g, x0 + 1, x0 + ew - 2, headTop - 1, 'G'); hline(g, x0, x0 + ew - 1, headTop, 'k'); hline(g, x0, x0 + ew - 1, headTop + 1, 'E'); hline(g, x0 + 1, x0 + ew - 2, headTop + 2, 'E');
      set(g, x0 + ew - 2, headTop + 1, 'P'); set(g, x0 + ew - 3, headTop + 1, 'P'); if (stage >= 2) set(g, x0 + ew - 2, headTop + 2, 'P'); });
    // mouth: wide brown lips (smug) across the lower head
    var my = headBot - 1; hline(g, cx - D.hw + 2, cx + D.hw - 3, my - 1, 'm'); hline(g, cx - D.hw + 2, cx + D.hw - 3, my, 'l'); set(g, cx - D.hw + 1, my - 2, 'm'); set(g, cx + D.hw - 2, my - 2, 'm');
    // gold usekh collar from Adult (lapis dots), Eye of Horus pectoral at Mythic
    if (stage >= 3) { var cw = D.bw - 1; hline(g, cx - cw, cx + cw - 1, bodyTop + 1, 'y'); hline(g, cx - cw + 1, cx + cw - 2, bodyTop + 2, 'o'); for (var xc = cx - cw + 1; xc < cx + cw; xc += 2) set(g, xc, bodyTop + 1, 'B'); }
    if (stage === 5) { set(g, cx - 1, bodyTop + 3, 'c'); set(g, cx, bodyTop + 3, 'c'); }
    // body gear (outfit): a shendyt kilt / tunic in the piece's colours over the lap
    if (Gr.body) { var b0c = col('body'), b1c = col('body', 1); for (var jk = Math.floor(D.bh / 2); jk < D.bh; jk++) { var wk = D.bw; for (var xk = cx - wk; xk < cx + wk; xk++) set(g, xk, bodyTop + jk, (xk - cx) % 3 === 0 ? b1c : b0c); }
      if (/armor|armour|plate|mail|chest/.test(kind('body'))) { var wa = D.bw - 2; rect(g, cx - wa, bodyTop + 2, wa * 2, 2, b0c); hline(g, cx - wa, cx + wa - 1, bodyTop + 2, b1c); } }
    // head gear
    if (isNemes(Gr.head)) nemes(g, cx, headTop - 1, D.hw - 1, headBot + 2);
    else if (Gr.head) { var hc = col('head'), hd = col('head', 1), hk = kind('head');
      if (/crown|tiara/.test(hk)) { hline(g, cx - 4, cx + 3, headTop - 2, hc); for (var ci = cx - 4; ci <= cx + 3; ci += 2) set(g, ci, headTop - 3, hc); set(g, cx, headTop - 2, hd); }
      else if (!/band|hachimaki|halo|visor/.test(hk)) { rect(g, cx - 4, headTop - 4, 8, 3, hc); hline(g, cx - 6, cx + 5, headTop - 1, hd); }
      else hline(g, cx - D.hw + 1, cx + D.hw - 2, headTop - 1, hc); }
    // grip piece in the right hand (viewer's left)
    if (Gr.hand) { var ak = kind('hand'), a0 = col('hand'), a1 = col('hand', 1), hx = cx - D.bw - 2;
      if (/crook|flail/.test(ak)) { for (var tc = 0; tc < 8; tc++) set(g, hx, hy - tc, tc % 2 ? 'y' : 'B'); set(g, hx - 1, hy - 8, 'y'); set(g, hx - 2, hy - 7, 'y'); }
      else if (/mug|cup|coffee|tea|bowl/.test(ak)) { rect(g, hx - 2, hy - 2, 3, 3, a0); hline(g, hx - 2, hx, hy - 2, a1); }
      else if (/sword|staff|stick|dagger|wand|torch|spear|candle|bat|banner|flag/.test(ak)) { for (var t = 0; t < 7; t++) set(g, hx, hy - 1 - t, t > 4 ? a1 : a0); }
      else rect(g, hx - 2, hy - 2, 3, 3, a0); }
    if (Gr.feet) { var f0 = col('feet'), f1 = col('feet', 1); hline(g, cx - D.bw - 1, cx - 2, bodyEnd + 1, f0); hline(g, cx + 1, cx + D.bw, bodyEnd + 1, f1); }
    if (Gr.face) { var gk = kind('face'), g0 = col('face');
      if (/tear/.test(gk)) set(g, ex[0] + 1, headTop + 3, g0);
      else if (/shade|sunglass|goggle|visor|laser|beam/.test(gk)) { hline(g, ex[0], ex[1] + ew - 1, headTop + 1, g0); hline(g, ex[0], ex[1] + ew - 1, headTop + 2, g0); }
      else set(g, cx + 2, my - 2, g0); }
    var o = outline(g);
    if (stage === 5) { var o2 = o.map(function (row) { return row.slice(); });
      for (var ry = 0; ry < 30; ry++) for (var rx = 0; rx < N; rx++) if (!o[ry][rx] && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(function (dd) { var X = rx + dd[0], Y = ry + dd[1]; return X >= 0 && Y >= 0 && X < N && Y < N && o[Y][X] === 'n'; })) o2[ry][rx] = 'A';
      o = o2; horus(o, 12, 1 + (frame === 1 || frame === 2 ? 1 : 0)); }
    return o;
  }
  /** render(stage, frame, bg, gear?, opts?) -> { width, height, data: [RGBA...] }; opts.community = lapis community palette */
  function render(stage, frame, bg, gear, opts) { var g = draw(stage, frame, gear, opts), d = [], Bg = hexRgb(bg || '#142018'), P = opts && opts.community ? Object.assign({}, PAL, PAL_COMMUNITY) : PAL;
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) { var k = g[y][x], c = k ? hexRgb(P[k] || k) : Bg; d.push(c[0], c[1], c[2], 255); } return { width: N, height: N, data: d }; }
  function frames(stage, bg, gear, opts) { return [0, 1, 2, 3].map(function (f) { return render(stage, f, bg, gear, opts); }); }
  return { STAGES: STAGES, PAL: PAL, PAL_COMMUNITY: PAL_COMMUNITY, NEMES: NEMES, render: render, frames: frames, draw: draw };
});
