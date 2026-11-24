/* GROYPER sprite (PREVIEW, community pet #7, Nov 24 2026): the fat smug frog from the owner's own drawing (sitting, fingers steepled under the chin,
 * half-lidded side-eye, wide orange lips, dark rear leg with a webbed foot stretched out). Loaded with the other community sprites, but the rules use it
 * only once ACTIVATE_GROYPER_BLOCK is set (null = off). Original 8-bit art, hand-placed pixels traced from the owner's reference; just the character
 * (no card frame, sky, text, symbols or stats). Faces right, like the drawing.
 * Same API as RabbitSprite: draw(stage, frame, gear) -> 32x32 key grid; render(stage, frame, bg, gear, opts) -> {width,height,data:[RGBA]};
 * frames(stage, bg, gear, opts) -> 4 frames; anchors(stage, frame). Stages 0 Egg..5 Mythic. Idle: 0 sit, 1 a slow smug breath (head and chest rise
 * 1px), 2 blink, 3 the side-eye (pupils slide over) with a finger tap. Egg = a speckled green egg with his smug eyes peeking through the crack.
 * Hatchling still has a little tadpole tail; Elder is heavier with droopier lids and a few warts; Mythic = Elder + the shared gold rim.
 * opts.pal recolours by palette key (hybrids: skin G/g/h, lips L/l, belly c/C, leg D/d). */
(function (root, factory) { if (typeof module === 'object' && module.exports) module.exports = factory(); else root.GroyperSprite = factory(); })(this, function () {
  'use strict';
  var N = 32, PAL = { n: '#1a1020', G: '#6aa83a', g: '#4f8a2a', h: '#8cc85a', F: '#8cc85a', D: '#3f6a1e', d: '#2f5216', E: '#ffffff', P: '#1a1020',
    L: '#ff7a14', l: '#c4550a', c: '#72b040', C: '#548f2c', A: '#ffc93c', y: '#ffd23f', o: '#c98a00', '#': '#ffffff' };
  var STAGES = ['Egg', 'Hatchling', 'Juvenile', 'Adult', 'Elder', 'Mythic'];
  var SKIN = { G: 1, g: 1, h: 1, F: 1 }, SUIT = { c: 1, C: 1 };
  /** GP_PAD: his SIGNATURE Footwear (gear id 'gp-lily-pad', ★ tier 3, Groyper + Groyper hybrids; gated by ACTIVATE_GROYPER_BLOCK in V2Rules): he sits on it. Display record. */
  var GP_PAD = { slot: 'feet', item: 'gp-lily-pad', label: 'Lily pad', tier: 'legendary', legendary: true, signature: true, exclusive: 'groyper' };
  /* his own gear colours (lily pad, cattail, bucket hat, cocoa mug, lily crown) */
  var GPC = { Q: '#3f9a3a', q: '#2c6e2a', V: '#6cc35a', U: '#ff9ec4', u: '#ffd8ea', K: '#8a5a2e', k: '#5e3a1a', T: '#c8b07a', t: '#94804e', W: '#e8eef4',
    Y: '#ffd23f', h2: '#e8d8a8' };
  /* Hand-drawn stage grids (frame 0). Keys: n ink, G/g/h skin, F fingers, E eye white, P pupil, L/l lips, D/d rear leg. Ground row 29. */
  var GRID = {
    0: [
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "..............nnnn..............",
      "............nnhhhhnn............",
      "...........nhhhhGhhhn...........",
      "..........nhhhhGGhhhGn..........",
      "..........nhhhhhhhhhGn..........",
      ".........nhhhnhhhhnhhGn.........",
      ".........nhhnnnhhnnnhnn.........",
      "........nnnnnPEnnnPEnnnn........",
      "........nGnnnnnnnnnnnnGn........",
      "........nhGnhGGnGGnhGGGn........",
      "........nhhhGGhhhhhGGhgn........",
      "........nhhhhhhhhhhhhhgn........",
      "........nhhGGhhhhhhhhGgn........",
      "........nhhGGhhhhhhGGhgn........",
      "........nhhhhhhhhhGGhhgn........",
      "........nhhhhhhhhhhhhggn........",
      ".........nhhhhhhhhhhhgn.........",
      ".........nhGGhhhhhhhggn.........",
      "..........nhhhhhhhhggn..........",
      "...........nnhhhhggnn...........",
      ".............nnnnnn.............",
      "................................",
      "................................",
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
      "...............nnn.nnn..........",
      "..............nhGGnhGGn.........",
      ".............nhGnnnGnnnn........",
      ".............nGnEPEnEPEn........",
      "............nhGGnnnGnnnGn.......",
      "............nGGGGGGGGGLLn.......",
      "...........nhGGLLLLLLLLln.......",
      "...........nGGGGllllllln........",
      "..........nhGGGGGGnnnnn.........",
      "..........nGGGGGGnhnhnGn........",
      ".........nGGgGGGGGnnnnGGn.......",
      ".........nGGGggGGGGGnGGGn.......",
      "..nnn....ngGGGGgGGGGnGGGn.......",
      ".nGGGnn..ngGGGGGGGGnGGGGn.......",
      "..nnGGGnnnggGGGGGGnGGGGGn.n.....",
      "....nnGGGGgggGGGGnGGGGGnndn.....",
      "......nnngggggGGnGGGGGnDDn......",
      ".........nnnnnggnnGnGnDDn.......",
      "..............nn.nnnnnnn........",
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
      "...............nnn.nnn..........",
      "..............nhGGnhGGn.........",
      ".............nhGGGGGGGGn........",
      "............nhGnnnGnnnnn........",
      "............nGGnEPEnEPEn........",
      "...........nhGGGnnnGnnnGn.......",
      "..........nhGGGGGGGGGGGLn.......",
      ".........nhGGGLLLLLLLLLLn.......",
      "........nhGGGGGlLLLLLLln........",
      "........nGGGGGGGllllllln........",
      ".......nhGGGGGGGGnnnnnn.........",
      ".......nGGGGGGGGnhnhnhn.........",
      "......nGGgGGGGGGGnhnhnhGn.......",
      "......nGGGgGGGGGGGnnnnnGGn......",
      "......nGGGGggGGGGGGGGnGGGn......",
      "......ngGGGGGgggGGGGnGGGGn......",
      "......ngGGGGGGGGGGGnGGGGGn......",
      "......nggGGGGGGGGGnGGGGGGn..n.n.",
      ".......nggGGGGGGGnGGGGGGnnndnd..",
      "........nggGGGGGnGGGGGGnnDDDDn..",
      ".........ngggGGnGGGGGnnDDDDDn...",
      "..........nnnggnnGnGnnDDDDDn....",
      ".............nn..nnnnnnnnnn.....",
      "................................",
      "................................"],
    3: [
      "................................",
      "................................",
      "................................",
      "................................",
      "..............nnnn..nnnn........",
      ".............nhhGGnnhhGGn.......",
      "............nhGGGGGGGGGGGn......",
      "...........nhGGnnnnGGnnnnn......",
      "..........nhGGnEPEEnnEPEEn......",
      "..........nGGGGnnnnGGnnnnGn.....",
      ".........nhGGGGGGGGGGGGGGGLn....",
      "........nhGGGLLLLLLLLLLLLLLn....",
      ".......nhGGGGlLLLLLLLLLLLln.....",
      "......nhGGGGGGllllllllllnn......",
      ".....nhGGGGGGGGnnnnnnnnn........",
      ".....nGGGGGGGGGGnhhnhhnhn.......",
      "....nGGGGGGGGGGnhhnhhnhhGn......",
      "....nGGGGGGGGGGGnhhnhhnhGGn.....",
      "...nGGgGGGGGGGGGGnnnnnnGGGn.....",
      "...nGGGgGGGGGGGGGGGGGnGGGGn.....",
      "...nGGGGggGGGGGGGGGGGnGGGGGn....",
      "...nGGGGGGgggggGGGGGnGGGGGGn....",
      "...ngGGGGGGGGGGGGGGnGGGGGGGn....",
      "...ngGGGGGGGGGGGGGnGGGGGGGGn.n.n",
      "...nggGGGGGGGGGGGnGGGGGGGGGnndnd",
      "....nggGGGGGGGGGnGGGGGGGGGnnDDDn",
      ".....nggGGGGGGGnGGGGGGGGGnDDDDn.",
      "......nggggGGGnGGGGGGGGnnDDDDDn.",
      ".......nnnngggnnGnGnGnnDDDDDDn..",
      "...........nnn..nnnnnnnnnnnnn...",
      "................................",
      "................................"] };
  /* belly patch (hybrid belly colour + body gear land here): an ellipse inside the body for each stage [cx, cy, rx, ry] */
  var BELLY = { 1: [14.5, 24.5, 2.8, 2.3], 2: [13, 22.5, 4.2, 3.4], 3: [13, 21.5, 5.4, 4.3], 4: [12.5, 21.5, 5.8, 4.5], 5: [12.5, 21.5, 5.8, 4.5] };
  /* breath line: rows above it rise 1px on frame 1 (head + chest), the seat and feet stay put */
  var BREATH = { 1: 22, 2: 20, 3: 18, 4: 18, 5: 18 };
  function grid(rows) { return rows.map(function (r) { return r.split('').map(function (k) { return k === '.' ? null : k; }); }); }
  function elder() { var A = grid(GRID[3]), x, y;
    '............nhGgggGGgggGGn......'.split('').forEach(function (k, i) { A[6][i] = k === '.' ? null : k; });    // heavier brows
    '..........nhGGnnPEEnnnPEEn......'.split('').forEach(function (k, i) { A[8][i] = k === '.' ? null : k; });    // droopier lids, deeper side-eye
    for (y = 15; y <= 27; y++) { var f = A[y].indexOf('n'); if (f > 1) { var r = A[y].slice(1, f + 1).concat(['G'], A[y].slice(f + 1)); A[y] = r; } } // a pixel fatter
    [[8, 17], [7, 23], [12, 25], [10, 20], [24, 21]].forEach(function (p) { if (A[p[1]][p[0]] === 'G') A[p[1]][p[0]] = 'g'; });                    // warts
    [[9, 17], [8, 24]].forEach(function (p) { if (A[p[1]][p[0]] === 'G') A[p[1]][p[0]] = 'h'; });
    return A; }
  function el(x, y, cx, cy, rx, ry) { var a = (x - cx) / rx, b = (y - cy) / ry; return a * a + b * b; }
  function hexRgb(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
  function stage0(s) { var g = s >= 4 ? elder() : grid(GRID[s]), B = BELLY[s];
    if (B) for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) if (el(x + 0.5, y + 0.5, B[0], B[1], B[2], B[3]) < 1) { var k = g[y][x]; if (k === 'G' || k === 'h') g[y][x] = 'c'; else if (k === 'g') g[y][x] = 'C'; }
    /* fingers: the light pixels under the lips are his steepled fingers (own key F, same colour) */
    var lipY = -1; for (var y2 = 0; y2 < N; y2++) if (g[y2].indexOf('l') >= 0) lipY = y2;
    for (var y3 = lipY + 1; y3 > 0 && y3 < Math.min(N, lipY + 6); y3++) for (var x3 = 12; x3 < N; x3++) if (g[y3][x3] === 'h' && s > 0) g[y3][x3] = 'F';
    return g; }
  var CACHE = {};
  function base(stage, frame) { var s = Math.max(0, Math.min(5, stage | 0)), f = ((frame | 0) % 4 + 4) % 4, key = s + ':' + f; if (CACHE[key]) return CACHE[key].map(function (r) { return r.slice(); });
    var g = stage0(s), x, y;
    if (s === 0) { /* egg: a little hop on 1, a wobble on 3 */
      if (f === 1) { g.shift(); g.push(new Array(N).fill(null)); }
      if (f === 3) g = g.map(function (r, yy) { return yy < 20 ? [null].concat(r.slice(0, N - 1)) : r; }); }
    else if (f === 1) { var L = BREATH[s], o = g.map(function (r) { return r.slice(); }); for (y = 0; y < L; y++) g[y] = o[y + 1].slice(); }
    if (f === 2) for (y = 0; y < N; y++) for (x = 0; x < N; x++) if (g[y][x] === 'E' || g[y][x] === 'P') g[y][x] = s === 0 ? 'n' : 'g';
    if (f === 3 && s > 0) { /* side-eye: each eye's pupil slides to the far end of its white */
      for (y = 0; y < N; y++) { var row = g[y]; for (x = 0; x < N; x++) { if (row[x] !== 'E' && row[x] !== 'P') continue; var x1 = x; while (x1 + 1 < N && (row[x1 + 1] === 'E' || row[x1 + 1] === 'P')) x1++;
          var pi = -1; for (var q = x; q <= x1; q++) if (row[q] === 'P') pi = q; if (pi >= 0) { row[pi] = 'E'; row[pi - x < (x1 - x) / 2 ? x1 : x] = 'P'; } x = x1; } }
      /* finger tap: the top finger row shifts one pixel */
      for (y = 0; y < N; y++) { var fx = g[y].indexOf('F'); if (fx >= 0) { for (x = fx; x < N && (g[y][x] === 'F' || g[y][x] === 'n'); x++) {} var seg = g[y].slice(fx, x); if (seg.length > 2) { seg.unshift(seg.pop()); for (var z = 0; z < seg.length; z++) g[y][fx + z] = seg[z]; } break; } } }
    if (s === 5) { var o2 = g.map(function (r) { return r.slice(); }); /* shared Mythic gold rim */
      for (y = 0; y < 31; y++) for (x = 0; x < N; x++) if (!g[y][x] && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(function (d) { var X = x + d[0], Y = y + d[1]; return X >= 0 && Y >= 0 && X < N && Y < N && g[Y][X] === 'n'; })) o2[y][x] = 'A';
      g = o2; }
    CACHE[key] = g.map(function (r) { return r.slice(); }); return g; }
  /** anchors(stage, frame): measured on his own frame: head box (eye bulges to the lips), eyes, belly patch, fingers, ground. */
  function anchors(stage, frame) { var g = base(stage, frame === 2 || frame === 3 ? 0 : frame), a = { fy0: 99, fy1: -1, fx0: 99, fx1: -1, by0: 99, by1: -1, bx0: 99, bx1: -1, ey: -1, ey1: -1, ex0: 99, ex1: -1, top: 99, gy: -1, hx0: 99, hx1: -1, hy0: 99, hy1: -1, lx1: -1 }, lipB = -1;
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) { var k = g[y][x]; if (!k || k === 'A') continue; a.top = Math.min(a.top, y); if (y <= 29) a.gy = Math.max(a.gy, y);
      if (SUIT[k]) { a.by0 = Math.min(a.by0, y); a.by1 = Math.max(a.by1, y); a.bx0 = Math.min(a.bx0, x); a.bx1 = Math.max(a.bx1, x); }
      if (k === 'E' || k === 'P') { if (a.ey < 0) a.ey = y; a.ey1 = y; a.ex0 = Math.min(a.ex0, x); a.ex1 = Math.max(a.ex1, x); }
      if (k === 'F') { a.hx0 = Math.min(a.hx0, x); a.hx1 = Math.max(a.hx1, x); a.hy0 = Math.min(a.hy0, y); a.hy1 = Math.max(a.hy1, y); }
      if (k === 'L' || k === 'l') { lipB = Math.max(lipB, y); a.lx1 = Math.max(a.lx1, x); } }
    /* head box: from the top of the eye bulges down to the lips, across the head's own width at eye level */
    a.fy0 = a.top; a.fy1 = lipB >= 0 ? lipB : a.top + 8; var ey = a.ey >= 0 ? a.ey : a.top + 3;
    for (var x2 = 0; x2 < N; x2++) if (g[ey][x2] && g[ey][x2] !== 'A') { a.fx0 = Math.min(a.fx0, x2); a.fx1 = Math.max(a.fx1, x2); }
    if (a.fx0 === 99) { a.fx0 = 10; a.fx1 = 22; }
    if (a.by0 === 99) { a.by0 = Math.max(0, a.fy1 + 2); a.by1 = Math.min(29, a.fy1 + 8); a.bx0 = a.fx0; a.bx1 = a.fx1; }
    if (a.ey < 0) { a.ey = a.fy0 + 3; a.ey1 = a.ey; a.ex0 = a.fx0 + 2; a.ex1 = a.fx1 - 2; }
    if (a.hx0 === 99) { a.hx0 = a.fx1 - 6; a.hx1 = a.fx1 - 1; a.hy0 = a.fy1 + 1; a.hy1 = a.fy1 + 3; } return a; }
  function lift(g, n) { for (var i = 0; i < n; i++) { g.shift(); g.push(new Array(N).fill(null)); } return g; }
  function liftA(A, n) { ['fy0', 'fy1', 'by0', 'by1', 'ey', 'ey1', 'top', 'gy', 'hy0', 'hy1'].forEach(function (k) { A[k] -= n; }); return A; }
  function draw(stage, frame, gear) {
    var g = base(stage, frame), Gr = gear || {}; stage = Math.max(0, Math.min(5, stage | 0));
    if (stage === 0 || !Object.keys(Gr).length) return g;
    var pad = Gr.feet && Gr.feet.item === 'gp-lily-pad' ? 2 : 0; /* he sits ON his lily pad: lifted 2px so the pad shows under him */
    if (pad) g = lift(g, pad);
    var A = pad ? liftA(anchors(stage, frame), pad) : anchors(stage, frame), orig = g.map(function (r) { return r.slice(); }), put = {}, wing = frame % 2;
    function set(x, y, k) { if (x >= 0 && y >= 0 && x < N && y < N && k) { g[y][x] = k; put[y * N + x] = 1; } }
    function under(x, y, k) { if (x >= 0 && y >= 0 && x < N && y < N && !g[y][x]) set(x, y, k); }
    function stamp(T, x0, y0, onlyEmpty) { for (var yy = 0; yy < T.length; yy++) for (var xx = 0; xx < T[yy].length; xx++) { var q = T[yy][xx]; if (q === '.') continue; var c = GPC[q] || q; if (onlyEmpty) under(x0 + xx, y0 + yy, c); else set(x0 + xx, y0 + yy, c); } }
    function kind(sl) { return Gr[sl] ? String(Gr[sl].label || Gr[sl].item || '').toLowerCase() : ''; }
    function col(sl, i) { var x = Gr[sl], c = x && x.cols; return (c && (c[i || 0] || c[0])) || (i ? '#c98a00' : '#ffd23f'); }
    function iid(sl) { return Gr[sl] && Gr[sl].item; }
    var fw = A.fx1 - A.fx0 + 1, cx = Math.round((A.fx0 + A.fx1) / 2);
    /* Drip (back): drawn behind him, out from both sides of the body */
    if (Gr.back) { var c0 = col('back'), c1 = col('back', 1); for (var yb = A.fy1; yb <= Math.min(29, A.gy); yb++) { var fl = Math.round((yb - A.fy1) / 4);
      var L1 = g[yb].findIndex(function (k) { return !!k; }); if (L1 < 0) continue; for (var d = 1; d <= 1 + fl; d++) under(L1 - d, yb, d === 1 + fl ? c1 : c0); } }
    if (Gr.body) { var b0 = col('body'), b1 = col('body', 1), arm = /armor|armour|plate|mail|chest/.test(kind('body'));
      for (var y2 = A.by0; y2 <= A.by1; y2++) for (var x2 = A.bx0; x2 <= A.bx1; x2++) if (SUIT[g[y2][x2]]) set(x2, y2, arm ? ((y2 - A.by0) % 3 === 0 ? b1 : b0) : ((x2 - A.bx0) % 3 === 0 ? b1 : b0)); }
    if (iid('feet') === 'gp-lily-pad') { /* SIGNATURE: a big lily pad under him (notch on the left, a little pink flower on the right); he sits on it */
      var px0 = Math.max(0, A.bx0 - 4), px1 = Math.min(N - 1, px0 + Math.max(18, fw + 10)), pc = (px0 + px1) / 2, pr = (px1 - px0) / 2 + 0.5;
      for (var yp = A.gy - 1; yp <= Math.min(31, A.gy + 2); yp++) for (var xp = px0; xp <= px1; xp++) { var e = el(xp + 0.5, yp + 0.5, pc + 0.5, A.gy + 0.9, pr, 1.9); if (e >= 1) continue; if (Math.abs(xp - (px0 + 3)) < 1 && yp <= A.gy + 1) continue; /* the notch */
        var kq = e > 0.62 ? GPC.q : (((xp - pc) * 0.6 + (yp - A.gy)) % 3 === 0 ? GPC.V : GPC.Q); if (!g[yp][xp] || (yp > A.gy)) set(xp, yp, kq); else if (yp === A.gy && (g[yp][xp] === 'n')) {} }
      stamp(['.U.', 'UuU', '.U.'], Math.min(N - 3, px1 - 3), A.gy - 2, true); }
    else if (Gr.feet) { var f0 = col('feet'), f1 = col('feet', 1); for (var fy = A.gy - 1; fy <= A.gy; fy++) for (var fx = 0; fx < N; fx++) { var kf = orig[fy][fx]; if (SKIN[kf] || kf === 'D' || kf === 'd' || SUIT[kf]) set(fx, fy, fy === A.gy ? f1 : f0); } }
    if (Gr.face) { var gk = kind('face'), g0 = col('face'), g1 = col('face', 1), eA = A.ey, eB = A.ey1;
      if (/shade|sunglass|goggle|visor|laser|beam|glass|monocle|mask/.test(gk)) { for (var xe = A.ex0 - 1; xe <= A.ex1 + 1; xe++) for (var yy = eA - 1; yy <= eB; yy++) { var ko = orig[yy][xe]; if (ko === 'E' || ko === 'P' || (ko === 'n' && yy >= eA - 1)) set(xe, yy, yy === eA - 1 ? g1 : ((xe + yy) % 3 ? g0 : g1)); } }
      else if (/tear/.test(gk)) set(A.ex0 + 1, A.ey1 + 1, g0);
      else if (/cig|pipe|cigar|joint|straw|lolli/.test(gk)) { var my = A.fy1 - 1; set(A.lx1 + 1, my, g0); set(A.lx1 + 2, my, g0); set(A.lx1 + 3, my - (wing ? 1 : 0), g1); }
      else { set(A.ex0 - 1, A.ey1 + 1, g0); set(A.ex1 + 1, A.ey1 + 1, g0); } }
    if (Gr.head) { var hk = kind('head'), h0 = col('head'), h1 = col('head', 1), ht = A.top;
      if (iid('head') === 'gp-lily-crown') { /* raiser top-3 prize: a gold crown with a lily-green gem, sits between his eye bulges */ stamp(['Y...Y...Y', 'YY.YVY.YY', 'YYYYYYYYY', 'ooooooooo'], cx - 4, Math.max(0, ht - 3), false); }
      else if (iid('head') === 'gp-bucket-hat') { var bw = Math.max(9, fw - 2), bx = cx - (bw >> 1); var hb = Math.max(2, ht); for (var yh0 = hb - 2; yh0 <= hb; yh0++) for (var xh0 = bx + 2; xh0 < bx + bw - 2; xh0++) set(xh0, yh0, yh0 === hb ? GPC.t : GPC.T); for (var xr = bx; xr < bx + bw; xr++) set(xr, hb + 1, GPC.t); }
      else if (/crown|tiara/.test(hk)) { for (var xc = A.fx0 + 3; xc <= A.fx1 - 3; xc++) { set(xc, ht - 1, h0); if ((xc - A.fx0) % 2) set(xc, ht - 2, h0); } set(cx, ht - 1, h1); }
      else if (/band|hachimaki|halo|bandana|headband/.test(hk)) { for (var xh = A.fx0 + 1; xh <= A.fx1 - 1; xh++) set(xh, /halo/.test(hk) ? Math.max(0, ht - 2) : ht + 2, h0); }
      else { var hh = fw > 10 ? 3 : 2; for (var yh = ht - hh + 1; yh <= ht + 1; yh++) for (var xk = A.fx0 + 2; xk <= A.fx1 - 2; xk++) set(xk, yh, (yh === ht - hh + 1 && (xk === A.fx0 + 2 || xk === A.fx1 - 2)) ? null : h0);
        for (var xb3 = A.fx0 + 1; xb3 <= A.fx1 - 1 + (/cap|visor/.test(hk) ? 2 : 0); xb3++) set(xb3, ht + 2, h1); } }
    if (Gr.weapon) { var wx = Math.min(29, A.bx1 + 6), wy = Math.min(28, A.gy - 1); set(wx, wy, 'o'); set(wx, wy - 1, 'n'); set(wx - 1, wy - 2, 'y'); set(wx, wy - 2, 'y'); set(wx + 1, wy - 2, 'y'); for (var tb = 3; tb < 12; tb++) set(wx, wy - tb, tb === 11 ? '#ffffff' : (tb % 3 ? '#c8d0da' : '#ffffff')); }
    if (Gr.hand) { /* held in the steeple: the item sits just past his fingertips */ var hx = Math.min(29, A.hx1 + 2), hy = A.hy1, ak = kind('hand'), a0 = col('hand'), a1 = col('hand', 1);
      if (iid('hand') === 'gp-cocoa-mug') { stamp(['.W.W..', 'W.W...', 'TTTT..', 'TkkTTT', 'TkkT.T', 'TTTTTT', 'tttt..'], hx - 1, hy - 5, false); }
      else if (iid('hand') === 'gp-cattail') { for (var tc = 0; tc < 12; tc++) { var ty = hy - tc + 1; if (tc < 6) set(hx, ty, GPC.q); else if (tc < 11) { set(hx, ty, GPC.K); set(hx + 1, ty, GPC.k); } else set(hx, ty, GPC.q); } set(hx - 1, hy - 2, GPC.Q); set(hx - 2, hy - 3, GPC.Q); }
      else if (/mug|cup|coffee|tea|bowl|beer|drink/.test(ak)) { for (var xm = hx; xm <= hx + 2; xm++) for (var ym = hy - 2; ym <= hy; ym++) set(xm, ym, a0); set(hx + 1, hy - 2, a1); set(hx + 2, hy - 2, a1); }
      else if (/sword|staff|stick|dagger|wand|torch|spear|candle|bat|banner|flag|axe|hammer|pole|rod|lance|scepter|sceptre/.test(ak)) { for (var t = 0; t < 8; t++) set(hx, hy - t + 1, t > 5 ? a1 : a0); }
      else { for (var xq = hx; xq <= hx + 2; xq++) for (var yq = hy - 2; yq <= hy; yq++) set(xq, yq, a0); set(hx + 1, hy - 1, a1); } }
    Object.keys(put).forEach(function (j) { j = +j; var x = j % N, y = (j / N) | 0; if (!g[y][x]) return; [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (q) { var X = x + q[0], Y = y + q[1]; if (X >= 0 && Y >= 0 && X < N && Y < N && !g[Y][X] && !orig[Y][X]) g[Y][X] = 'n'; }); });
    return g; }
  function render(stage, frame, bg, gear, opts) { var g = draw(stage, frame, gear), P = Object.assign({}, PAL, (opts && opts.pal) || {}), B = hexRgb(typeof bg === 'string' ? bg : '#2a3a2e'), d = [];
    if (Array.isArray(bg)) B = bg.slice(0, 3);
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) { var k = g[y][x], c = k ? hexRgb(P[k] || k) : B; d.push(c[0], c[1], c[2], 255); } return { width: N, height: N, data: d }; }
  function frames(stage, bg, gear, opts) { return [0, 1, 2, 3].map(function (f) { return render(stage, f, bg, gear, opts); }); }
  return { GP_PAD: GP_PAD, GPC: GPC, STAGES: STAGES, PAL: PAL, PAL_COMMUNITY: {}, SKIN: SKIN, SUIT: SUIT, render: render, frames: frames, draw: draw, anchors: anchors };
});
