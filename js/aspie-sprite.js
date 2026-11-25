/* ASPIE sprite (PREVIEW, Nov 25 2026). Jake: "instead of a homer from the grinder we make a pet specific to the grinder as the reward. It should be aspie"
 * and "we make her a pet in the game like all the other pets but you have to grind to get her". Look approved by Jake Nov 25 2026 from his reference
 * pictures: messy honey-brown hair with an orange streak, sleepy half-lidded brown eyes, rosy freckled cheeks, a small smug smile, blue tee, black
 * shorts, white socks, blue sneakers. Original 8-bit art, hand-placed pixels. Only the Meat Grinder makes her (rules gate in V2Rules; null = OFF).
 * Same API as GroyperSprite / RabbitSprite: draw(stage, frame, gear) -> 32x32 key grid; render(stage, frame, bg, gear, opts) -> {width,height,data:[RGBA]};
 * frames(stage, bg, gear, opts) -> 4 frames; anchors(stage, frame). Stages 0 Egg..5 Mythic. Idle: 0 stand, 1 a little bounce (feet stay down),
 * 2 blink, 3 the smug glance (pupils slide to the side). Egg = a cream egg with blue speckles, a tuft of her hair on top and her sleepy eyes in the crack.
 * Elder = an open navy hoodie over the tee, a taller tuft and tired eye bags. Mythic = Elder + the shared gold rim.
 * Keys (hybrids recolour with opts.pal): hair H/h/O (the 'top' part), skin S/s, eyes E/P, mouth m, cheeks c/f, tee B/b, hoodie D/d, shorts K, socks W,
 * shoes U/u. Signature Grip: the meat cleaver (gear id 'as-cleaver'). */
(function (root, factory) { if (typeof module === 'object' && module.exports) module.exports = factory(); else root.AspieSprite = factory(); })(this, function () {
  'use strict';
  var N = 32, PAL = { n: '#2a1a14', H: '#c98f3a', h: '#9a6526', O: '#f2b54a', S: '#fbe6cb', s: '#e6c39c', E: '#ffffff', P: '#7a3a12', m: '#5a2a1a',
    c: '#f3a39c', f: '#cf7d6a', B: '#2463e8', b: '#1745b0', D: '#1c2a52', d: '#121c38', K: '#262833', W: '#f4f4f4', U: '#2a4fb0', u: '#1a3070',
    z: '#f3ead6', Z: '#2463e8', A: '#ffc93c' };
  var STAGES = ['Egg', 'Hatchling', 'Juvenile', 'Adult', 'Elder', 'Mythic'];
  var SKIN = { S: 1, s: 1 }, SUIT = { B: 1, b: 1, D: 1, d: 1 }, HAIR = { H: 1, h: 1, O: 1 };
  /** AS_CLEAVER: her SIGNATURE Grip (gear id 'as-cleaver', ★ tier 3, Aspie + Aspie hybrids). Display record. */
  var AS_CLEAVER = { slot: 'hand', item: 'as-cleaver', label: 'Meat cleaver', tier: 'legendary', legendary: true, signature: true, exclusive: 'aspie' };
  var ASC = { G: '#c8d0da', g: '#8c96a4', R: '#6b4a2a', r: '#4a3020', Y: '#ffd23f', y: '#c98a00' };
  var GRID = {
    0: [
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "...............n.n..............",
      "..............nHnHn.............",
      ".............nnHHHnn............",
      "...........nnzzzzzzznn..........",
      "..........nzzzzZzzzzzzn.........",
      ".........nzzzzzzzzzZzzzn........",
      ".........nzZzzzzzzzzzzzn........",
      "........nzzzzzzzzzzzzzzzn.......",
      "........nznnnnnnnnnnnnnzn.......",
      "........nznEEPPnnnEEPPnzn.......",
      "........nzzzzzzzzzzzzzzzn.......",
      "........nzzzzzZzzzzzzZzzn.......",
      "........nzZzzzzzzzzzzzzzn.......",
      ".........nzzzzzzzZzzzzzn........",
      ".........nzzzzzzzzzzzzzn........",
      "..........nzzzzzzzzzzzn.........",
      "...........nnzzzzzzznn..........",
      ".............nnnnnnn............",
      "................................",
      "................................"],
    1: [
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "..............n..n..............",
      ".............nHnnHnn............",
      "...........nnHHHHHHHnn..........",
      "..........nHHOOOOOHHHHn.........",
      "..........nHHHHHHHHSHHn.........",
      ".........nHHHSSSSSSSSHHn........",
      ".........nHhHnnnSSnnnSHhn.......",
      ".........nHhSEPPSSEPPShhn.......",
      ".........nHhScfSSSSfcShhn.......",
      "........nHhhnSSSmmmSSnhhHn......",
      ".......nHHn..nnSSSSSnn..nHHn....",
      ".......nnn..nnBBBBBBnn...nnn....",
      "...........nSnBBBBBBnSn.........",
      "...........nnnKKKKKKnnn.........",
      ".............nSSnnSSn...........",
      ".............nUUnnUUn...........",
      "................................",
      "................................"],
    2: [
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "..............n...n.............",
      ".............nHnn.nHnn..........",
      "...........nnHHHHnHHHHnn........",
      "..........nHHHHHHHHHHHHHn.......",
      ".........nHHOOOOOOOHHHHHn.......",
      ".........nHHHHHHHHOOOHHHHn......",
      "........nHHHHHHHHHSSSSHHHn......",
      "........nHhHHnnnnSSSnnnnHhn.....",
      "........nHhHSEPPSSSSSEPPShn.....",
      "........nHhHScffSSSSSffcShn.....",
      ".......nHhhnSSSSSmSSmSSSnhHn....",
      "......nHHhn.nSSSSSmmmSSSnnhHHn..",
      "......nnnn...nnSSSSSSSSnn..nnnn.",
      ".............nnBBnnnnBBnn.......",
      "..........nnBBBBBBBBBBBBBnn.....",
      "..........nbBnBBBBBBBBBBnBbn....",
      "..........nSSnbBBBBBBBBbnSSn....",
      "...........nnnKKKKKKKKKKnnn.....",
      ".............nKKKnnnnKKKn.......",
      ".............nSSn....nSSn.......",
      ".............nWWn....nWWn.......",
      "............nUUUn....nUUUn......",
      "................................",
      "................................"],
    3: [
      "................................",
      "................................",
      "...............n...n............",
      ".............nnHn.nHnn..........",
      "...........nnHHHHnHHHHnn........",
      "..........nHHHHHHHHHHHHHn.......",
      ".........nHHHHHHHHHHHHHHHn......",
      "........nHHOOOOOOOOHHHHHHn......",
      "........nHHHHHHHHHOOOOHHHHn.....",
      ".......nHHHHHHHHHHHSSSHHHHn.....",
      ".......nHHhHHHHHHSSSSSSSHHhn....",
      ".......nHhHHnnnnSSSSSnnnnHhn....",
      ".......nHhHSEPPSSSSSSEPPShHn....",
      ".......nHhHSSPPSSSSSSSPPShHn....",
      ".......nHhHScffSSSSSSffcShhn....",
      "......nHhhnSSSSSSmSSSmSSSnhHn...",
      ".....nHHhn.nSSSSSSmmmSSSSnhHHn..",
      "....nHHhn...nnSSSSSSSSSnn.nhHHn.",
      "....nnnn......nnnSSSnnn....nnnn.",
      "...........nnBBBnnnnnBBBnn......",
      "........nBBBBBBBBBBBBBBBBBBn....",
      "........nbBnBBBBBBBBBBBBBnBbn...",
      "........nSSnbBBBBBBBBBBBbnSSn...",
      "........nSSnKKKKKKKKKKKKKnSSn...",
      ".........nnnKKKKKKKKKKKKKnnn....",
      "............nKKKKnnnKKKKn.......",
      "............nSSSn...nSSSn.......",
      "............nWWWn...nWWWn.......",
      "...........nUUUUn...nUUUUn......",
      "...........nuuuun...nuuuun......",
      "................................",
      "................................"] };
  function grid(rows) { return rows.map(function (r) { return r.split('').map(function (k) { return k === '.' ? null : k; }); }); }
  function elder() { var A = grid(GRID[3]), x, y, ey = -1;
    for (y = 0; y < N; y++) if (A[y].indexOf('P') >= 0) ey = y;
    for (x = 0; x < N; x++) if (A[ey + 1][x] === 'S' && (A[ey][x] === 'P')) A[ey + 1][x] = 's';                     // tired eye bags under the irises
    A[1][17] = 'n'; A[2][16] = 'n'; A[2][17] = 'H'; A[2][18] = 'n';                                                   // a taller messy tuft
    for (y = 0; y < N; y++) { var row = A[y], L = -1, R = -1; for (x = 0; x < N; x++) if (SUIT[row[x]]) { if (L < 0) L = x; R = x; }
      if (L < 0) continue; for (x = L; x <= R; x++) if (SUIT[row[x]] && (x - L < 3 || R - x < 3)) row[x] = (x - L < 3 ? (x - L === 1 ? 'd' : 'D') : (R - x === 1 ? 'd' : 'D')); } // open hoodie
    return A; }
  function hexRgb(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
  function stage0(s) { return s >= 4 ? elder() : grid(GRID[s]); }
  var CACHE = {};
  function base(stage, frame) { var s = Math.max(0, Math.min(5, stage | 0)), f = ((frame | 0) % 4 + 4) % 4, key = s + ':' + f; if (CACHE[key]) return CACHE[key].map(function (r) { return r.slice(); });
    var g = stage0(s), x, y;
    if (s === 0) { if (f === 1) { g.shift(); g.push(new Array(N).fill(null)); } if (f === 3) g = g.map(function (r, yy) { return yy < 22 ? [null].concat(r.slice(0, N - 1)) : r; }); }
    else if (f === 1) { /* bounce: everything above the socks rises 1px */ var o = g.map(function (r) { return r.slice(); }), L = 27; for (y = 0; y < N; y++) if (o[y].indexOf('W') >= 0) { L = y; break; } for (y = 0; y < L - 1; y++) g[y] = o[y + 1].slice(); g[L - 1] = o[L - 1].map(function (k, xx) { return o[L][xx] === 'W' || o[L][xx] === 'n' ? k : k; }); }
    if (f === 2) for (y = 0; y < N; y++) for (x = 0; x < N; x++) if (g[y][x] === 'E' || g[y][x] === 'P') g[y][x] = s === 0 ? 'n' : (g[y - 1] && g[y - 1][x] === 'n' ? 's' : 'S');
    if (f === 3 && s > 0) { for (y = 0; y < N; y++) { var row = g[y]; for (x = 0; x < N; x++) { if (row[x] !== 'E' && row[x] !== 'P') continue; var x1 = x; while (x1 + 1 < N && (row[x1 + 1] === 'E' || row[x1 + 1] === 'P')) x1++;
          var seg = row.slice(x, x1 + 1); if (seg.indexOf('E') >= 0 && seg.indexOf('P') >= 0) { var nP = seg.filter(function (k) { return k === 'P'; }).length; for (var q = x; q <= x1; q++) row[q] = q > x1 - nP ? 'P' : 'E'; } x = x1; } } }
    if (s === 5) { var o2 = g.map(function (r) { return r.slice(); }); for (y = 0; y < 31; y++) for (x = 0; x < N; x++) if (!g[y][x] && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(function (d) { var X = x + d[0], Y = y + d[1]; return X >= 0 && Y >= 0 && X < N && Y < N && g[Y][X] === 'n'; })) o2[y][x] = 'A'; g = o2; }
    CACHE[key] = g.map(function (r) { return r.slice(); }); return g; }
  /** anchors(stage, frame): head box (hair top to chin), eyes, tee box, hands (lowest skin pixels left/right of the tee), ground. */
  function anchors(stage, frame) { var g = base(stage, frame === 2 || frame === 3 ? 0 : frame), a = { fy0: 99, fy1: -1, fx0: 99, fx1: -1, by0: 99, by1: -1, bx0: 99, bx1: -1, ey: -1, ey1: -1, ex0: 99, ex1: -1, top: 99, gy: -1, my: -1, hx: -1, hy: -1, lhx: 99, lhy: -1 };
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) { var k = g[y][x]; if (!k || k === 'A') continue; a.top = Math.min(a.top, y); if (y <= 29) a.gy = Math.max(a.gy, y);
      if (SUIT[k]) { a.by0 = Math.min(a.by0, y); a.by1 = Math.max(a.by1, y); a.bx0 = Math.min(a.bx0, x); a.bx1 = Math.max(a.bx1, x); }
      if (k === 'E' || k === 'P') { if (a.ey < 0) a.ey = y; a.ey1 = y; a.ex0 = Math.min(a.ex0, x); a.ex1 = Math.max(a.ex1, x); }
      if (k === 'm') a.my = Math.max(a.my, y); }
    for (var y2 = 0; y2 < N; y2++) for (var x2 = 0; x2 < N; x2++) { var k2 = g[y2][x2]; if (!SKIN[k2] || a.by0 === 99 || y2 <= a.by0) continue; if (x2 > a.bx1 - 1) { if (y2 >= a.hy) { a.hy = y2; a.hx = x2; } } if (x2 < a.bx0 + 1) { if (y2 >= a.lhy) { a.lhy = y2; a.lhx = x2; } } }
    a.fy0 = a.top; a.fy1 = a.my >= 0 ? a.my + 1 : a.top + 10; var ey = a.ey >= 0 ? a.ey : a.top + 6;
    for (var x3 = 0; x3 < N; x3++) if (g[ey][x3] && g[ey][x3] !== 'A') { a.fx0 = Math.min(a.fx0, x3); a.fx1 = Math.max(a.fx1, x3); }
    if (a.fx0 === 99) { a.fx0 = 9; a.fx1 = 23; }
    if (a.by0 === 99) { a.by0 = a.fy1 + 2; a.by1 = Math.min(29, a.fy1 + 6); a.bx0 = a.fx0 + 2; a.bx1 = a.fx1 - 2; }
    if (a.hx < 0) { a.hx = a.bx1 + 1; a.hy = a.by1; } if (a.lhx === 99) { a.lhx = a.bx0 - 1; a.lhy = a.by1; }
    if (a.ey < 0) { a.ey = a.fy0 + 6; a.ey1 = a.ey; a.ex0 = a.fx0 + 3; a.ex1 = a.fx1 - 3; } return a; }
  function draw(stage, frame, gear) {
    var g = base(stage, frame), Gr = gear || {}; stage = Math.max(0, Math.min(5, stage | 0));
    if (stage === 0 || !Object.keys(Gr).length) return g;
    var A = anchors(stage, frame), orig = g.map(function (r) { return r.slice(); }), put = {}, wing = frame % 2;
    function set(x, y, k) { if (x >= 0 && y >= 0 && x < N && y < N && k) { g[y][x] = k; put[y * N + x] = 1; } }
    function under(x, y, k) { if (x >= 0 && y >= 0 && x < N && y < N && !g[y][x]) set(x, y, k); }
    function stamp(T, x0, y0) { for (var yy = 0; yy < T.length; yy++) for (var xx = 0; xx < T[yy].length; xx++) { var q = T[yy][xx]; if (q !== '.') set(x0 + xx, y0 + yy, ASC[q] || q); } }
    function kind(sl) { return Gr[sl] ? String(Gr[sl].label || Gr[sl].item || '').toLowerCase() : ''; }
    function col(sl, i) { var x = Gr[sl], c = x && x.cols; return (c && (c[i || 0] || c[0])) || (i ? '#c98a00' : '#ffd23f'); }
    function iid(sl) { return Gr[sl] && Gr[sl].item; }
    var cx = Math.round((A.fx0 + A.fx1) / 2), fw = A.fx1 - A.fx0 + 1;
    /* Drip (back): behind her, out from both sides of the body below the shoulders */
    if (Gr.back) { var c0 = col('back'), c1 = col('back', 1); for (var yb = A.by0 + 1; yb <= Math.min(29, A.gy - 1); yb++) { var fl = Math.round((yb - A.by0) / 4), row = g[yb], L1 = -1, R1 = -1;
        for (var xb = 0; xb < N; xb++) if (row[xb]) { if (L1 < 0) L1 = xb; R1 = xb; } if (L1 < 0) continue; for (var dd = 1; dd <= 1 + fl; dd++) { under(L1 - dd, yb, dd === 1 + fl ? c1 : c0); under(R1 + dd, yb, dd === 1 + fl ? c1 : c0); } } }
    /* Armor (body): recolours her tee (and hoodie) */
    if (Gr.body) { var b0 = col('body'), b1 = col('body', 1), arm = /armor|armour|plate|mail|chest/.test(kind('body'));
      for (var y2 = A.by0; y2 <= A.by1; y2++) for (var x2 = A.bx0; x2 <= A.bx1; x2++) if (SUIT[g[y2][x2]]) set(x2, y2, arm ? ((y2 - A.by0) % 3 === 0 ? b1 : b0) : ((x2 - A.bx0) % 3 === 0 ? b1 : b0)); }
    /* Footwear: recolours her sneakers */
    if (Gr.feet) { var f0 = col('feet'), f1 = col('feet', 1); for (var fy = 0; fy < N; fy++) for (var fx = 0; fx < N; fx++) { var kf = orig[fy][fx]; if (kf === 'U') set(fx, fy, f0); else if (kf === 'u') set(fx, fy, f1); } }
    /* Guise (face) */
    if (Gr.face) { var gk = kind('face'), g0 = col('face'), g1 = col('face', 1), eA = A.ey, eB = A.ey1;
      if (/shade|sunglass|goggle|visor|laser|beam|glass|monocle|mask/.test(gk)) { for (var xe = A.ex0 - 1; xe <= A.ex1 + 1; xe++) for (var yy = eA - 1; yy <= eB; yy++) { var ko = orig[yy][xe]; if (ko === 'E' || ko === 'P' || (ko === 'n' && yy === eA - 1) || ((ko === 'S' || ko === 's') && yy >= eA && xe > A.ex0 && xe < A.ex1)) set(xe, yy, yy === eA - 1 ? g1 : ((xe + yy) % 3 ? g0 : g1)); } }
      else if (/tear/.test(gk)) set(A.ex0 + 1, A.ey1 + 1, g0);
      else if (/cig|pipe|cigar|joint|straw|lolli/.test(gk)) { var my = A.my; set(cx + 4, my, g0); set(cx + 5, my, g0); set(cx + 6, my - (wing ? 1 : 0), g1); }
      else { set(A.ex0, A.ey1 + 2, g0); set(A.ex1, A.ey1 + 2, g0); } }
    /* Headwear: sits on her messy hair */
    if (Gr.head) { var hk = kind('head'), h0 = col('head'), h1 = col('head', 1), ht = A.top + 1;
      if (/crown|tiara/.test(hk)) { for (var xc = cx - 4; xc <= cx + 4; xc++) { set(xc, ht, h0); if ((xc - cx) % 2 === 0) set(xc, ht - 1, h0); } set(cx, ht, h1); }
      else if (/band|hachimaki|halo|bandana|headband/.test(hk)) { for (var xh = A.fx0 + 2; xh <= A.fx1 - 2; xh++) set(xh, /halo/.test(hk) ? Math.max(0, ht - 2) : ht + 4, h0); }
      else { var hw = Math.max(9, fw - 6), hx0 = cx - (hw >> 1); for (var yh = ht - 1; yh <= ht + 2; yh++) for (var xk = hx0; xk < hx0 + hw; xk++) set(xk, yh, (yh === ht - 1 && (xk === hx0 || xk === hx0 + hw - 1)) ? null : h0);
        for (var xb3 = hx0 - 1; xb3 <= hx0 + hw + (/cap|visor/.test(hk) ? 2 : 0); xb3++) set(xb3, ht + 3, h1); } }
    /* Grip (hand): held in her right hand (viewer's right) */
    if (Gr.hand) { var hx = Math.min(29, A.hx + 1), hy = A.hy, ak = kind('hand'), a0 = col('hand'), a1 = col('hand', 1);
      if (iid('hand') === 'as-cleaver') stamp(['nnnnn', 'nGGGn', 'nGGgn', 'nGGgn', 'nnRnn', '..R..', '..r..'], hx - 1, hy - 5);
      else if (/mug|cup|coffee|tea|bowl|beer|drink/.test(ak)) { for (var xm = hx; xm <= hx + 2; xm++) for (var ym = hy - 2; ym <= hy; ym++) set(xm, ym, a0); set(hx + 1, hy - 2, a1); set(hx + 2, hy - 2, a1); }
      else if (/sword|staff|stick|dagger|wand|torch|spear|candle|bat|banner|flag|axe|hammer|pole|rod|lance|scepter|sceptre|club|cane/.test(ak)) { for (var t = 0; t < 9; t++) set(hx, hy - t + 1, t > 6 ? a1 : a0); }
      else { for (var xq = hx; xq <= hx + 2; xq++) for (var yq = hy - 2; yq <= hy; yq++) set(xq, yq, a0); set(hx + 1, hy - 1, a1); } }
    Object.keys(put).forEach(function (j) { j = +j; var x = j % N, y = (j / N) | 0; if (!g[y][x]) return; [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (q) { var X = x + q[0], Y = y + q[1]; if (X >= 0 && Y >= 0 && X < N && Y < N && !g[Y][X] && !orig[Y][X]) g[Y][X] = 'n'; }); });
    return g; }
  function render(stage, frame, bg, gear, opts) { var g = draw(stage, frame, gear), P = Object.assign({}, PAL, (opts && opts.pal) || {}), B = hexRgb(typeof bg === 'string' ? bg : '#2a3a2e'), d = [];
    if (Array.isArray(bg)) B = bg.slice(0, 3);
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) { var k = g[y][x], c = k ? hexRgb(P[k] || k) : B; d.push(c[0], c[1], c[2], 255); } return { width: N, height: N, data: d }; }
  function frames(stage, bg, gear, opts) { return [0, 1, 2, 3].map(function (f) { return render(stage, f, bg, gear, opts); }); }
  return { AS_CLEAVER: AS_CLEAVER, ASC: ASC, STAGES: STAGES, PAL: PAL, SKIN: SKIN, SUIT: SUIT, HAIR: HAIR, render: render, frames: frames, draw: draw, anchors: anchors };
});
