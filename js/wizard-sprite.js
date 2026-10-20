/* Community pet sprite (v2): 6 hand-drawn 8-bit stages, 32x32, same frame format as PetCore.render ({data: RGBA array}).
 * Reference art (blue robe + pointed hat, grey beard, wooden staff with an orange ₿ orb). Few colours, ink outline, 4-frame bob.
 * Redraw (2026-10-19, owner: "a little too triangular"): a real character instead of one cone: soft hat with a curled tip and a round brim,
 * a proper head (face, ears, eyes, nose, brows), rounded shoulders, sleeves and hands, a rounded beard, a belted robe and shoes.
 * Hat redraw (2026-10-19, owner: "make it POINTY like a classic wizard hat"): tall sharp cone with a bent-over tip and a wide brim (see hat()). */
(function (root, factory) { if (typeof module === 'object' && module.exports) module.exports = factory(); else root.WizardSprite = factory(); })(this, function () {
  'use strict';
  var N = 32, PAL = { n: '#1a1020', B: '#1f5ff0', b: '#1440b0', c: '#7fb2ff', R: '#1f5ff0', r: '#1440b0', h: '#7fb2ff', S: '#f2c48d', s: '#d9975f', p: '#f09a86',
    G: '#9c9ca8', g: '#74747f', W: '#e6e6ee', w: '#ffffff', L: '#9a4a12', l: '#6a2e08', O: '#f7931a', o: '#c46a00', y: '#ffd23f', k: '#0f1530', A: '#ffc93c',
    F: '#2e2a36', f: '#57505f', X: '#ffffff', H: '#f08a24', J: '#c8631a', m: '#7a3b2a' }; /* meme redraw: F fist ink, X robe/hat white streaks, H/J orange hair, m smile */
  /* COMMUNITY palette variant (2026-10-19, owner): the Bitcoin Wizard is drawn in purples only while he is the COMMUNITY pet (opts.community).
   * Player-hatched Wizards (after the community pet reaches Mythic, standing new-species rule) keep the normal blue reference palette above,
   * so the purple robe stays the community pet's badge. Only robe/body/hat tones change; ink, skin, beard, staff and gold stay. */
  var PAL_COMMUNITY = { B: '#8a4fd8', b: '#5b2ea6', c: '#c49cff', R: '#8a4fd8', r: '#5b2ea6', h: '#c49cff' };
  /** WIZARD_HAT: the signature Headwear piece as a gear record (display only, NOT in the gear pool / rolled gear state). */
  var WIZARD_HAT = { slot: 'head', item: 'wizard-hat', label: 'Wizard Hat', tier: 'legendary', legendary: true, signature: true, stats: 'Signature · cosmetic (no stats, like other ★ hats)' };
  function isHat(x) { return !!(x && x.item === 'wizard-hat'); }
  var STAGES = ['Egg', 'Hatchling', 'Juvenile', 'Adult', 'Elder', 'Mythic'];
  /* MEME REDRAW (2026-10-20, owner: "match the Magic Internet Money meme"): blue robe with white scribble streaks, a floppy hat leaning
   * forward-left, an oversized square peach head (dot eyes, smile, pink nose, loose orange hair at the back), a wide grey wedge beard,
   * the left fist raised holding a flame, a long staff tilted up-right with a big orange ₿ coin, the orange 'Join us' sign low at the
   * bottom-left (no text: ink squiggles), the robe swooping into a zigzag tail that runs into a FLYING CARPET under him, and a thick wobbly
   * hand-drawn ink outline. Still a 32x32 pixel grid with a small palette.
   * per stage: head w/h, robe height, shoulder half-width, hem flare, beard length / top half-width, coin radius, tail length, hat height, sign w/h */
  var DIM = [null,
    { hw: 8, hh: 7, body: 6, sh: 3, fl: 2, bl: 0, bw: 0, coin: 0, tail: 3, hat: 6, sw: 6, sgh: 3 },
    { hw: 9, hh: 7, body: 8, sh: 4, fl: 2, bl: 4, bw: 3, coin: 2, tail: 4, hat: 6, sw: 8, sgh: 4 },
    { hw: 10, hh: 8, body: 10, sh: 4, fl: 3, bl: 7, bw: 4, coin: 3, tail: 6, hat: 7, sw: 9, sgh: 5 },
    { hw: 10, hh: 8, body: 11, sh: 5, fl: 3, bl: 8, bw: 5, coin: 3, tail: 6, hat: 7, sw: 10, sgh: 5 },
    { hw: 10, hh: 8, body: 11, sh: 5, fl: 3, bl: 9, bw: 5, coin: 3, tail: 7, hat: 7, sw: 10, sgh: 5 }];
  function grid() { var g = []; for (var i = 0; i < N; i++) g.push(new Array(N).fill(null)); return g; }
  function set(g, x, y, k) { if (x >= 0 && y >= 0 && x < N && y < N) g[y][x] = k; }
  function get(g, x, y) { return x >= 0 && y >= 0 && x < N && y < N ? g[y][x] : null; }
  function rect(g, x0, y0, w, h, k) { for (var y = y0; y < y0 + h; y++) for (var x = x0; x < x0 + w; x++) set(g, x, y, k); }
  function hline(g, x0, x1, y, k) { for (var x = x0; x <= x1; x++) set(g, x, y, k); }
  function line(g, x0, y0, x1, y1, k) { var n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1; for (var i = 0; i <= n; i++) set(g, Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), k); }
  function hsh(x, y) { var h = (x * 374761393 + y * 668265263) >>> 0; h = ((h ^ (h >>> 13)) * 1274126177) >>> 0; return (h ^ (h >>> 16)) >>> 0; }
  /* thick wobbly outline: 1px ink ring, then extra ink on ~1 in 3 ring pixels pushed one more pixel out (seeded by position, so the line
   * "boils" a little between bob frames like a crude hand-drawn line). Gold ('y') sparkles/fringe stay un-outlined. */
  function outline(g, wob) { var o = grid(); for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) { o[y][x] = g[y][x]; if (!g[y][x]) {
    var nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(function (d) { var X = x + d[0], Y = y + d[1]; return X >= 0 && Y >= 0 && X < N && Y < N && g[Y][X] && g[Y][X] !== 'y'; }); if (nb) o[y][x] = 'n'; } }
    if (wob) { var o2 = o.map(function (r) { return r.slice(); }); for (var y2 = 0; y2 < N; y2++) for (var x2 = 0; x2 < N; x2++) if (o[y2][x2] === 'n' && !g[y2][x2] && hsh(x2, y2) % 3 === 0)
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) { var X = x2 + d[0], Y = y2 + d[1]; if (X >= 0 && Y >= 0 && X < N && Y < N && !o[Y][X] && !(g[y2 - d[1]] && g[y2 - d[1]][x2 - d[0]])) o2[Y][X] = 'n'; }); o = o2; }
    return o; }
  /* big orange ₿ coin: filled disc, darker rim on the lower right, a white ₿ bar, a highlight */
  function orb(g, x, y, r) { for (var j = -r; j <= r; j++) for (var i = -r; i <= r; i++) if (i * i + j * j <= r * r + 1) set(g, x + i, y + j, (i + j >= r) ? 'o' : 'O');
    set(g, x - r + 1, y - r + 1, 'y'); if (r >= 2) { set(g, x, y - 1, 'w'); set(g, x, y, 'w'); set(g, x, y + 1, 'w'); set(g, x + 1, y - 1, 'w'); set(g, x + 1, y + 1, 'w'); if (r >= 3) { set(g, x, y - 2, 'w'); set(g, x, y + 2, 'w'); } } }
  function hexRgb(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
  function shade(c, f) { var v = hexRgb(PAL[c] || c); return '#' + v.map(function (x) { var y = Math.max(0, Math.min(255, Math.round(x * f))); return (y < 16 ? '0' : '') + y.toString(16); }).join(''); }
  /* floppy meme hat (Wizard Hat gear piece): a soft cone that bends forward-LEFT (tip drooping past the face), a wobbly brim sitting on the
   * brow, white scribble streaks; a gold star from Adult. x0..x1 = head columns, faceY = head top row. */
  function hat(g, x0, x1, faceY, H, stage, k, kd, kh) {
    var w = x1 - x0 + 1, lean = stage >= 3 ? 7 : 5, baseY = faceY - 1;
    hline(g, x0 - 2, x1 + 1, baseY, k); set(g, x0 - 2, baseY, kh); set(g, x1 + 1, baseY, kd); hline(g, x0 - 1, x1, faceY, kd);               // brim + its dark underside
    for (var j = 1; j <= H; j++) { var u = j / H, hw = Math.max(0, Math.round((w / 2 + 0.5) * (1 - u))), off = Math.round(lean * u * u), c0 = Math.round((x0 + x1) / 2) - off;
      for (var x = c0 - hw; x <= c0 + hw; x++) set(g, x, baseY - j, x >= c0 + hw ? kd : x <= c0 - hw && hw ? kh : k); }
    var tx = Math.round((x0 + x1) / 2) - lean, ty = baseY - H; set(g, tx - 1, ty + 1, k); set(g, tx - 2, ty + 2, kd);                                 // tip flops down-left
    [[1, 2], [-1, 3], [0, 4]].forEach(function (q, i) { var sx = Math.round((x0 + x1) / 2) + q[0] - Math.round(lean * Math.pow(q[1] / H, 2)), sy = baseY - q[1]; if (get(g, sx, sy) === k && i < (stage >= 2 ? 3 : 1)) set(g, sx, sy, 'X'); });
    if (stage >= 3) { var syy = baseY - 2, sxx = x1 - 2; set(g, sxx, syy, 'y'); if (stage >= 4) { set(g, sxx - 1, syy, 'y'); set(g, sxx + 1, syy, 'y'); set(g, sxx, syy - 1, 'y'); set(g, sxx, syy + 1, 'y'); } }
  }
  /* flying carpet (owner ask): robe-blue rug with a light border, white streaks, gold fringe on the left and the robe's zigzag on the right */
  function carpet(g, xl, xr, y, k, kd, kh) { for (var x = xl; x <= xr; x++) { set(g, x, y, kh); set(g, x, y + 1, (x + y) % 4 === 0 ? 'X' : k); set(g, x, y + 2, kd); }
    for (var f = 0; f < 3; f++) set(g, xl - 1, y + f, 'y'); set(g, xl - 2, y, 'y'); set(g, xl - 2, y + 2, 'y');
    set(g, xr + 1, y + 1, k); set(g, xr + 1, y + 2, kd); set(g, xr + 2, y + 2, kd); set(g, xr + 1, y, kh); }
  function flame(g, x, y, big) { set(g, x, y, 'O'); set(g, x + 1, y, 'O'); set(g, x, y - 1, 'y'); set(g, x + 1, y - 1, 'O'); set(g, x, y - 2, 'y'); if (big) { set(g, x - 1, y - 1, 'o'); set(g, x + 1, y - 2, 'y'); set(g, x + 1, y - 3, 'y'); set(g, x - 1, y - 3, 'O'); } }
  /* gear (optional, display only): { head|face|back|hand|body|feet: { label, item, cols: ['#hex', '#hex'] } }. Anchors: head = head top row
   * (faceY) / columns fx..fx+fw-1; face = eye row faceY+3; back = behind the robe; body = robe recolour; hand = the RAISED fist (hx, hy; the
   * piece replaces the flame); feet = two shoes on the carpet under the hem. */
  function draw(stage, frame, gear) {
    var g = grid(), bob = [0, -1, -1, 0][frame || 0], G = gear || {};
    function kind(sl) { return G[sl] ? String(G[sl].label || G[sl].item || '').toLowerCase() : ''; }
    function col(sl, i) { var x = G[sl], c = x && x.cols; return (c && (c[i || 0] || c[0])) || (i ? '#c49a1a' : '#ffd23f'); }
    if (stage === 0) { // egg: a lumpy blue egg with white scribbles and a ₿ coin, the floppy hat on top, riding a little carpet
      carpet(g, 8, 23, 28 + bob, 'B', 'b', 'c');
      for (var y = 0; y < 16; y++) { var hw = Math.round(Math.sqrt(Math.max(0, 1 - Math.pow((y - 8.5) / 9, 2))) * (y < 8 ? 7 : 8)); for (var x = 16 - hw; x < 16 + hw; x++) { var e0 = x - 16;
        set(g, x, 12 + y + bob, e0 <= -hw + 1 && y > 2 ? 'c' : e0 >= hw - 2 ? 'b' : 'B'); } }
      [[11, 16], [12, 17], [20, 18], [21, 19], [13, 23], [14, 24], [19, 24]].forEach(function (q) { set(g, q[0], q[1] + bob, 'X'); });
      if (isHat(G.head)) hat(g, 11, 20, 13 + bob, 8, 1, 'B', 'b', 'c'); orb(g, 16, 20 + bob, 2); return outline(g, true);
    }
    var D = DIM[stage], cx = 15, cy = 27 + bob, shY = cy - D.body, faceY = shY - D.hh + 1, fw = D.hw, fx = cx - Math.floor(fw / 2), fe = fx + fw - 1;
    var bc = stage >= 4 ? 'W' : 'G', bs = stage >= 4 ? 'G' : 'g';
    function half(j) { return D.sh + Math.round(D.fl * j / Math.max(1, D.body - 1)) - (j === 0 ? 1 : 0); }
    // cape / back piece behind everything
    if (G.back && G.back.item === 'wiz-star-cloak') { for (var jc = 0; jc < D.body; jc++) { var hc2 = half(jc) + 2; for (var xc = cx - hc2 - 1; xc <= cx + hc2; xc++) set(g, xc, shY + jc, ((xc * 7 + jc * 3) % 9 === 0) ? 'y' : (xc + jc) % 5 === 0 ? '#2a3170' : '#1b1f4a'); } }
    else if (G.back) { var kc = col('back'), kd = col('back', 1);
      if (/cape|cloak|blanket|net|wing|mantle|robe/.test(kind('back'))) { for (var j2 = 0; j2 < D.body; j2++) { var h2 = half(j2) + (j2 < 2 ? 1 : 2); for (var x2 = cx - h2 - 1; x2 <= cx + h2; x2++) set(g, x2, shY + j2, (x2 + j2) % 4 === 0 ? kd : kc); } }
      else { rect(g, cx + D.sh + 1, shY, 3, 4, kc); set(g, cx + D.sh + 2, shY + 1, kd); } }
    // flying carpet under him (robe colours; the robe tail runs into it)
    carpet(g, cx - D.sw - 2, cx + D.tail + D.sh + 3, cy + 1, 'B', 'b', 'c');
    // robe: wedge from rounded shoulders, lit left edge, shaded right edge; right side swoops into a zigzag tail along the carpet
    for (var j = 0; j < D.body; j++) { var hj = half(j), yy = shY + j;
      for (var x3 = cx - hj - 1; x3 <= cx + hj; x3++) { var ed = x3 - cx; set(g, x3, yy, ed <= -hj ? 'h' : ed >= hj - 1 ? 'r' : 'R'); } }
    var tr = Math.min(4, D.body - 2); for (var t0 = 0; t0 < tr; t0++) { var ty = cy - tr + 1 + t0, ext = Math.round(D.tail * (t0 + 1) / tr), base = cx + half(ty - shY);
      for (var x6 = base; x6 <= base + ext; x6++) set(g, x6, ty, (x6 === base + ext) ? 'r' : ((x6 + ty) % 3 === 0 ? 'r' : 'R')); }
    var zx = cx + half(D.body - 1) + D.tail; set(g, zx + 1, cy, 'r'); set(g, zx + 2, cy - 1, 'R'); set(g, zx + 3, cy, 'r'); if (stage >= 3) { set(g, zx + 2, cy - 2, 'r'); }  // zigzag tip
    // white scribble streaks over the robe (seeded, so every Wizard of a stage looks the same)
    for (var sy = shY + 1; sy <= cy; sy++) for (var sx = 0; sx < N; sx++) if (get(g, sx, sy) === 'R' && hsh(sx * 3 + stage, sy) % 7 === 0) { set(g, sx, sy, 'X'); if (get(g, sx + 1, sy - 1) === 'R') set(g, sx + 1, sy - 1, 'X'); }
    if (stage === 5) { var hh = half(D.body - 1); hline(g, cx - hh, cx + hh - 1, cy, 'y'); }                                // Mythic: gold hem
    // right hand on the staff; long staff tilted up-right to the big ₿ coin (a short flame wand for the Hatchling)
    var rhx = cx + half(4) + 1, rhy = shY + 4; set(g, rhx - 1, rhy, 'r'); set(g, rhx, rhy, 'S'); set(g, rhx, rhy + 1, 's');
    if (D.coin) { var ox = Math.min(N - 1 - D.coin, cx + 11), oy = Math.max(D.coin, faceY - 1 + (stage === 2 ? 2 : 0)); line(g, cx + 2, cy, ox - 1, oy + D.coin, 'L');
      line(g, cx + 3, cy, ox, oy + D.coin, 'l'); orb(g, ox, oy, D.coin); set(g, rhx, rhy, 'S'); }
    else { line(g, rhx + 1, rhy, rhx + 3, rhy - 4, 'L'); orb(g, rhx + 4, rhy - 6, 1); }
    // raised left arm (sleeve) up to a black fist (the Grip anchor)
    var hx = Math.max(2, fx - 5), hy = faceY + 2, ax0 = cx - half(1) - 1, ay0 = shY + 1;
    line(g, ax0, ay0, hx, hy + 2, 'h'); line(g, ax0 + 1, ay0, hx + 1, hy + 2, 'R'); line(g, ax0 + 1, ay0 + 1, hx + 2, hy + 2, 'r'); line(g, ax0 + 2, ay0 + 1, hx + 2, hy + 3, 'r');
    set(g, hx, hy, 'F'); set(g, hx + 1, hy, 'f'); set(g, hx, hy + 1, 'F'); set(g, hx + 1, hy + 1, 'F');
    if (!G.hand) flame(g, hx, hy - 1, stage >= 3);
    // oversized square head: loose orange hair at the back, ear, dot eyes, pink nose, smile
    for (var r0 = 0; r0 < D.hh; r0++) hline(g, fx, fe, faceY + r0, 'S');
    set(g, fe, faceY + D.hh - 1, 's'); hline(g, fx, fx + 1, faceY + D.hh - 1, 's');
    for (var hr = 1; hr < D.hh; hr++) { set(g, fx - 1, faceY + hr, hr % 2 ? 'H' : 'J'); if (hr > 1 && hr < D.hh - 1) set(g, fx, faceY + hr, 'H');  }   // hair at the back
    hline(g, fx, fe, faceY, 'H');                                                                                         // hairline (hat brim covers it)
    set(g, fx + 2, faceY + 3, 's');                                                                                       // ear
    var ex = fx + 4; set(g, ex, faceY + 2, 'k'); set(g, ex + 3, faceY + 2, 'k');                                          // dot eyes
    set(g, ex + 2, faceY + 3, 'p'); if (fw >= 10) set(g, ex + 2, faceY + 4, 'p');                                         // pink nose
    var my = faceY + (fw >= 10 ? 5 : 4); set(g, ex, my, 'm'); hline(g, ex + 1, ex + 3, my + 1 > faceY + D.hh - 1 ? my : my, 'm'); set(g, ex + 4, my - 1, 'm');  // smile
    // wide grey wedge beard from the jaw down the chest (Hatchling: no beard)
    if (D.bl) { var by0 = my + 1; for (var k2 = 0; k2 < D.bl; k2++) { var bw = Math.max(0, Math.round(D.bw * (1 - k2 / D.bl))), bcx = ex + 2 - Math.round(k2 / 4);
        for (var x5 = bcx - bw - 1; x5 <= bcx + bw; x5++) set(g, x5, by0 + k2, x5 >= bcx + bw && bw > 0 ? bs : (k2 === D.bl - 1 || (x5 + k2) % 5 === 0) ? bs : bc); }
      set(g, ex - 1, my, bc); set(g, ex + 4, my, bc); set(g, ex + 5, my, bc); }
    // 'Join us' sign low at the bottom-left, in front of the robe (orange board, ink squiggle 'letters'; sprites carry no text)
    var sx0 = cx - D.sw - 1, sy0 = cy - D.sgh + 1; rect(g, sx0, sy0, D.sw, D.sgh, 'O'); hline(g, sx0, sx0 + D.sw - 1, sy0 + D.sgh - 1, 'o');
    for (var q = 0; q < D.sw - 2; q++) if (D.sgh >= 4 ? (q % 4 !== 3) : (q % 2 === 0)) set(g, sx0 + 1 + q, sy0 + 1 + (D.sgh >= 4 ? (q % 2) : 0), 'F');
    if (D.sgh >= 5) { set(g, sx0 + 2, sy0 + 3, 'F'); set(g, sx0 + D.sw - 3, sy0 + 3, 'F'); }
    if (G.body && G.body.item === 'wiz-star-robe') { for (var sy1 = shY; sy1 <= cy; sy1++) for (var sx1 = 0; sx1 < N; sx1++) { var q1 = g[sy1][sx1]; if ((q1 === 'R' || q1 === 'r' || q1 === 'h') && (sx1 * 5 + sy1 * 3) % 7 === 0) g[sy1][sx1] = 'y'; } } /* Star robe */
    // Outfits recolour the robe, tail and sleeve (not the hat or carpet); the white streaks become a light tone of the piece
    if (G.body && G.body.item !== 'wiz-star-robe') { var b0 = col('body'), b1 = col('body', 1), bd = shade(b1, 0.85), bl = shade(b0, 1.15); for (var by = 0; by < N; by++) for (var bx = 0; bx < N; bx++) { var q0 = g[by][bx]; if (q0 === 'R') g[by][bx] = b0; else if (q0 === 'r') g[by][bx] = bd; else if (q0 === 'h') g[by][bx] = bl; else if (q0 === 'X' && by >= shY && by <= cy) g[by][bx] = bl; }
      if (/armor|armour|plate|mail|chest/.test(kind('body'))) { hline(g, cx - half(1), cx + half(1) - 1, shY + 1, b1); set(g, cx - half(2), shY + 2, bl); set(g, cx + half(2) - 1, shY + 2, bl); } }
    // head: floppy Wizard Hat, or the orange hair + another Headwear piece
    if (isHat(G.head)) hat(g, fx, fe, faceY, D.hat, stage, 'B', 'b', 'c');
    else { hline(g, fx, fe, faceY - 1, 'H'); hline(g, fx + 1, fe - 1, faceY - 2, 'J'); set(g, fx + 3, faceY - 2, 'H'); set(g, fe - 2, faceY - 1, 'J');
      if (G.head) { var hk = kind('head'), hc = col('head'), hd = col('head', 1);
        if (/crown|tiara/.test(hk)) { hline(g, fx, fe, faceY - 2, hc); for (var ci = fx; ci <= fe; ci += 2) set(g, ci, faceY - 3, hc); set(g, fx + Math.floor(fw / 2), faceY - 2, hd); }
        else if (!/band|hachimaki|halo|visor/.test(hk) && /hat|cap|beanie|helmet|hood|bucket|fedora|beret|bowl|newsboy/.test(hk)) { rect(g, fx, faceY - 3, fw, 2, hc); rect(g, fx + 1, faceY - 5, fw - 2, 2, hc); hline(g, fx - 1, fe + 1, faceY - 1, hd); }
        else { hline(g, fx - 1, fe, faceY + 1, hc); set(g, fx + Math.floor(fw / 2), faceY + 1, hd); set(g, fe + 1, faceY + 2, hc); } } }   // headband-style (across the brow)
    // Grip piece in the raised fist (replaces the flame)
    if (G.hand) { var ak = kind('hand'), a0 = col('hand'), a1 = col('hand', 1);
      if (G.hand.item === 'wiz-paint-staff') { [[0, 1], [1, 2], [0, 3], [-1, 4], [0, 5], [1, 6]].forEach(function (q) { set(g, hx + q[0], hy - q[1], 'L'); }); set(g, hx - 1, hy - 7, 'w'); set(g, hx, hy - 7, 'w'); set(g, hx + 1, hy - 7, 'w'); set(g, hx, hy - 8, 'w'); set(g, hx, hy - 6, 'c'); }
      else if (/sign|join/.test(ak)) { rect(g, hx - 2, hy - 5, 6, 4, '#f4ecd8'); hline(g, hx - 1, hx, hy - 4, 'n'); hline(g, hx + 2, hx + 2, hy - 4, 'n'); hline(g, hx - 1, hx + 2, hy - 3, 'n'); set(g, hx, hy - 1, 'L'); }
      else if (/orb|crystal/.test(ak)) { orb(g, hx + 1, hy - 3, 2); set(g, hx, hy - 4, 'w'); }
      else if (/book|spell/.test(ak)) { rect(g, hx - 1, hy - 3, 4, 3, '#5b2a86'); hline(g, hx - 1, hx + 2, hy - 3, '#ffd23f'); set(g, hx, hy - 2, '#ffd23f'); }
      else if (/mug|cup|coffee|tea|bowl|bucket/.test(ak)) { rect(g, hx - 1, hy - 3, 3, 3, a0); hline(g, hx - 1, hx + 1, hy - 3, a1); set(g, hx - 2, hy - 2, a1); set(g, hx, hy - 1, shade(a0, 0.8)); }
      else if (/sword|staff|stick|dagger|wand|quill|torch|rocket|shiv|mallet|pole|spear|candle|bat|banner|flag/.test(ak)) { for (var t = 0; t < 6; t++) set(g, hx, hy - 1 - t, t > 3 ? a1 : a0); }
      else rect(g, hx - 1, hy - 3, 3, 3, a0);
      set(g, hx, hy, 'F'); set(g, hx + 1, hy, 'F'); }
    // Footwear: two shoes on the carpet under the hem
    if (G.feet) { var f0 = col('feet'), f1 = col('feet', 1); [[cx - 4, cx - 2], [cx + 1, cx + 3]].forEach(function (r) { for (var x4 = r[0]; x4 <= r[1]; x4++) { set(g, x4, cy, f0); set(g, x4, cy + 1, x4 === r[0] || x4 === r[1] ? f1 : f0); } }); }
    // Guise (face) piece, on the eye row
    if (G.face) { var gk = kind('face'), g0 = col('face'), g1 = col('face', 1);
      if (/tear/.test(gk)) { set(g, ex, faceY + 3, g0); }
      else if (/shade|sunglass|goggle|visor|laser|beam/.test(gk)) hline(g, ex - 1, ex + 4, faceY + 2, g0);
      else if (/glass|lens|monocle|specs|eye/.test(gk)) { set(g, ex - 1, faceY + 2, g0); set(g, ex + 1, faceY + 2, g0); set(g, ex + 2, faceY + 2, g0); set(g, ex + 4, faceY + 2, g0); }
      else if (/mask|bandana|scarf/.test(gk)) hline(g, fx + 1, fe, my, g0);
      else { set(g, ex + 4, faceY + 3, g0); set(g, ex + 5, faceY + 3, g1); } }
    var o = outline(g, true);
    if (stage === 5) { /* gold Mythic rim (same treatment as every Mythic pet): one gold pixel ring around the ink outline */ var o2 = o.map(function (r) { return r.slice(); });
      for (var ry = 0; ry < N; ry++) for (var rx = 0; rx < N; rx++) if (!o[ry][rx] && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(function (d) { var X = rx + d[0], Y = ry + d[1]; return X >= 0 && Y >= 0 && X < N && Y < N && o[Y][X] === 'n'; })) o2[ry][rx] = 'A'; o = o2; }
    if (stage === 5) [[1, 1], [28, 14], [1, 14], [29, 22], [9, 1]].forEach(function (p, i) { if ((i + (frame || 0)) % 2 === 0 && !o[p[1]][p[0]]) { set(o, p[0], p[1], 'y'); if (!o[p[1]][p[0] + 1]) set(o, p[0] + 1, p[1], 'y'); } });
    return o;
  }
  /** render(stage, frame, bg, gear?) -> { width, height, data: [RGBA...] } */
  function render(stage, frame, bg, gear, opts) { var g = draw(stage, frame, gear), d = [], B = hexRgb(bg || '#142018'), P = opts && opts.community ? Object.assign({}, PAL, PAL_COMMUNITY) : PAL;
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) { var k = g[y][x], c = k ? hexRgb(P[k] || k) : B; d.push(c[0], c[1], c[2], 255); } return { width: N, height: N, data: d }; }
  function frames(stage, bg, gear, opts) { return [0, 1, 2, 3].map(function (f) { return render(stage, f, bg, gear, opts); }); }
  return { STAGES: STAGES, PAL: PAL, PAL_COMMUNITY: PAL_COMMUNITY, WIZARD_HAT: WIZARD_HAT, render: render, frames: frames, draw: draw };
});
