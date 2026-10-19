/* Community pet sprite (v2): 6 hand-drawn 8-bit stages, 32x32, same frame format as PetCore.render ({data: RGBA array}).
 * Reference art (blue robe + pointed hat, grey beard, wooden staff with an orange ₿ orb). Few colours, ink outline, 4-frame bob.
 * Redraw (2026-10-19, owner: "a little too triangular"): a real character instead of one cone: soft hat with a curled tip and a round brim,
 * a proper head (face, ears, eyes, nose, brows), rounded shoulders, sleeves and hands, a rounded beard, a belted robe and shoes. */
(function (root, factory) { if (typeof module === 'object' && module.exports) module.exports = factory(); else root.WizardSprite = factory(); })(this, function () {
  'use strict';
  var N = 32, PAL = { n: '#1a1020', B: '#2f6fe0', b: '#1d48a8', c: '#7fb2ff', R: '#2f6fe0', r: '#1d48a8', h: '#7fb2ff', S: '#f2c48d', s: '#d9975f', p: '#f09a86',
    G: '#a9a9b3', g: '#7c7c88', W: '#e6e6ee', w: '#ffffff', L: '#8a5a2b', l: '#5e3b1a', O: '#f7931a', o: '#c46a00', y: '#ffd23f', k: '#0f1530' };
  /* COMMUNITY palette variant (2026-10-19, owner): the Bitcoin Wizard is drawn in purples only while he is the COMMUNITY pet (opts.community).
   * Player-hatched Wizards (after the community pet reaches Mythic, standing new-species rule) keep the normal blue reference palette above,
   * so the purple robe stays the community pet's badge. Only robe/body/hat tones change; ink, skin, beard, staff and gold stay. */
  var PAL_COMMUNITY = { B: '#8a4fd8', b: '#5b2ea6', c: '#c49cff', R: '#8a4fd8', r: '#5b2ea6', h: '#c49cff' };
  /** WIZARD_HAT: the signature Headwear piece as a gear record (display only, NOT in the gear pool / rolled gear state). */
  var WIZARD_HAT = { slot: 'head', item: 'wizard-hat', label: 'Wizard Hat', tier: 'legendary', legendary: true, signature: true, stats: 'Signature · cosmetic (no stats, like other ★ hats)' };
  function isHat(x) { return !!(x && x.item === 'wizard-hat'); }
  var STAGES = ['Egg', 'Hatchling', 'Juvenile', 'Adult', 'Elder', 'Mythic'];
  /* per stage: hat height, robe height, shoulder half-width, hem flare, beard length / half-width, staff orb radius */
  var DIM = [null, { hat: 6, body: 7, sh: 4, fl: 1, bl: 0, bw: 0, orb: 0 }, { hat: 7, body: 8, sh: 4, fl: 2, bl: 3, bw: 2, orb: 2 }, { hat: 8, body: 10, sh: 5, fl: 2, bl: 5, bw: 3, orb: 2 },
    { hat: 9, body: 11, sh: 5, fl: 3, bl: 7, bw: 3, orb: 3 }, { hat: 9, body: 11, sh: 5, fl: 3, bl: 8, bw: 3, orb: 3 }];
  function grid() { var g = []; for (var i = 0; i < N; i++) g.push(new Array(N).fill(null)); return g; }
  function set(g, x, y, k) { if (x >= 0 && y >= 0 && x < N && y < N) g[y][x] = k; }
  function get(g, x, y) { return x >= 0 && y >= 0 && x < N && y < N ? g[y][x] : null; }
  function rect(g, x0, y0, w, h, k) { for (var y = y0; y < y0 + h; y++) for (var x = x0; x < x0 + w; x++) set(g, x, y, k); }
  function hline(g, x0, x1, y, k) { for (var x = x0; x <= x1; x++) set(g, x, y, k); }
  function outline(g) { var o = grid(); for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) { o[y][x] = g[y][x]; if (!g[y][x]) {
    var nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(function (d) { var X = x + d[0], Y = y + d[1]; return X >= 0 && Y >= 0 && X < N && Y < N && g[Y][X] && g[Y][X] !== 'y'; }); if (nb) o[y][x] = 'n'; } } return o; }
  function orb(g, x, y, r) { for (var j = -r; j <= r; j++) for (var i = -r; i <= r; i++) if (i * i + j * j <= r * r + 1) set(g, x + i, y + j, 'O');
    set(g, x - r + 1, y - r + 1, 'y'); if (r >= 2) { set(g, x, y - 1, 'w'); set(g, x, y, 'w'); set(g, x, y + 1, 'w'); set(g, x + 1, y - 1, 'o'); set(g, x + 1, y + 1, 'o'); } }
  function hexRgb(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
  function shade(c, f) { var v = hexRgb(PAL[c] || c); return '#' + v.map(function (x) { var y = Math.max(0, Math.min(255, Math.round(x * f))); return (y < 16 ? '0' : '') + y.toString(16); }).join(''); }
  /* soft wizard hat: round brim, a cone with a rounded (convex) profile, gold band, tip curling to one side; star from Adult */
  function hat(g, cx, top, H, faceY, stage, k, kd, kh) {
    var cone = H - 2, base = stage >= 3 ? 4 : 3, curl = stage >= 3 ? 3 : 2;
    for (var j = 0; j < cone; j++) { var t = (j + 1) / cone, hw = Math.max(0, Math.round(base * Math.pow(t, 0.62))), off = Math.round(curl * Math.pow(1 - t, 2.2));
      for (var x = cx - hw + off; x <= cx + hw + off - 1 + (hw ? 1 : 0); x++) { var e = x - (cx + off), col = hw && e >= hw - 1 ? kd : hw && e <= -hw ? kh : k; set(g, x, top + j, col); } }
    set(g, cx + curl + 1, top + 1, kd);                                                                                   // drooping tip
    hline(g, cx - base, cx + base, faceY - 3, 'y');                                                                      // gold band
    hline(g, cx - base - 2, cx + base + 1, faceY - 2, k); set(g, cx + base + 1, faceY - 2, kd); set(g, cx - base - 2, faceY - 2, kh); // brim
    hline(g, cx - base - 1, cx + base, faceY - 1, kd);
    if (stage >= 3) { var sy = top + Math.round(cone * 0.55), sx = cx - 1; set(g, sx, sy, 'y'); if (stage >= 4) { set(g, sx - 1, sy, 'y'); set(g, sx + 1, sy, 'y'); set(g, sx, sy - 1, 'y'); set(g, sx, sy + 1, 'y'); } }
  }
  /* gear (optional, display only, 2026-10-19): { head|face|back|hand|body|feet: { label, item, cols: ['#hex', '#hex'] } } = the community pet's worn
   * community-roll pieces. Drawn as simple per-slot overlays; a Headwear piece replaces the wizard hat (grey hair shows under it). */
  function draw(stage, frame, gear) {
    var g = grid(), bob = [0, -1, -1, 0][frame || 0], G = gear || {};
    function kind(sl) { return G[sl] ? String(G[sl].label || G[sl].item || '').toLowerCase() : ''; }
    function col(sl, i) { var x = G[sl], c = x && x.cols; return (c && (c[i || 0] || c[0])) || (i ? '#c49a1a' : '#ffd23f'); }
    if (stage === 0) { // egg: a round blue egg in a little wizard hat, with a tiny orange coin
      for (var y = 0; y < 17; y++) { var hw = Math.round(Math.sqrt(Math.max(0, 1 - Math.pow((y - 9) / 9.5, 2))) * (y < 9 ? 7 : 8)); for (var x = 16 - hw; x < 16 + hw; x++) { var e0 = x - 16;
        set(g, x, 12 + y + bob, e0 <= -hw + 1 && y > 2 ? 'c' : e0 >= hw - 2 ? 'b' : 'B'); } }
      [[11, 16], [20, 19], [13, 23]].forEach(function (q) { set(g, q[0], q[1] + bob, 'c'); });
      if (isHat(G.head)) hat(g, 16, 4 + bob, 8, 12 + bob, 1, 'B', 'b', 'c'); orb(g, 16, 20 + bob, 2); return outline(g);
    }
    var D = DIM[stage], cx = 15, bodyEnd = 27 + bob, faceH = 6, faceY = bodyEnd - faceH - D.body + 2, top = faceY - D.hat, shY = faceY + faceH - 1;
    var fx = cx - 4, fw = 8;                                                                                              // face box (x, width)
    var bc = stage >= 4 ? 'W' : 'G', bs = stage >= 4 ? 'G' : 'g';                                                        // beard / brow colours
    function half(j) { return D.sh + Math.round(D.fl * j / Math.max(1, D.body - 1)) - (j === 0 ? 2 : j === 1 ? 1 : 0); }
    // cape / back piece behind everything
    if (G.back) { var kc = col('back'), kd = col('back', 1);
      if (/cape|cloak|blanket|net|wing|mantle|robe/.test(kind('back'))) { for (var j2 = 0; j2 < D.body; j2++) { var h2 = half(j2) + (j2 < 2 ? 1 : 2); for (var x2 = cx - h2 - 1; x2 <= cx + h2; x2++) set(g, x2, shY + j2, (x2 + j2) % 4 === 0 ? kd : kc); } }
      else { rect(g, cx - D.sh - 3, shY - 1, 3, 4, kc); set(g, cx - D.sh - 2, shY, kd); } }
    // robe: rounded shoulders, flared hem, lit left edge, shaded right side, belt
    for (var j = 0; j < D.body; j++) { var hj = half(j), yy = shY + j, last = j === D.body - 1;
      for (var x3 = cx - hj - 1; x3 <= cx + hj; x3++) { if (last && (x3 === cx - hj - 1 || x3 === cx + hj)) continue; var ed = x3 - cx;
        set(g, x3, yy, ed <= -hj ? 'h' : ed >= hj - 1 ? 'r' : 'R'); } }
    var beltY = shY + Math.round(D.body * 0.45); if (stage >= 2) { var bh = half(beltY - shY); hline(g, cx - bh, cx + bh - 1, beltY, 'L'); set(g, cx, beltY, 'y'); }
    if (stage === 5) { var hh = half(D.body - 1); hline(g, cx - hh, cx + hh - 1, bodyEnd, 'y'); }                     // Mythic: gold hem
    else if (stage >= 3) { var hh2 = half(D.body - 1); hline(g, cx - hh2, cx + hh2 - 1, bodyEnd, 'h'); }
    if (stage >= 3) [[-3, 3], [2, 6], [-2, 8]].forEach(function (q) { if (shY + q[1] < bodyEnd && get(g, cx + q[0], shY + q[1]) === 'R') set(g, cx + q[0], shY + q[1], 'y'); }); // robe stars
    // shoes peeking out under the hem
    var fy = bodyEnd + 1; hline(g, cx - 4, cx - 2, fy, 'l'); hline(g, cx + 1, cx + 3, fy, 'l');
    // left sleeve hanging down, hand at its end (holds the Grip piece)
    var aTop = shY + 1, aLen = Math.min(D.body - 2, stage === 1 ? 3 : 5), hx = 0, hy = 0;
    for (var a = 0; a < aLen; a++) { var ax = cx - half(a + 1) - 2; set(g, ax, aTop + a, a === aLen - 1 ? 'h' : 'r'); set(g, ax + 1, aTop + a, 'R'); if (a === aLen - 1) set(g, ax - 1, aTop + a, 'h'); }
    hx = cx - half(aLen) - 2; hy = aTop + aLen; set(g, hx, hy, 'S'); set(g, hx + 1, hy, 'S');
    // right sleeve reaching out to the staff (wand for a Hatchling)
    var sx = cx + D.sh + D.fl + 3, ry = shY + 2;
    hline(g, cx + half(2), sx - 2, ry, 'r'); hline(g, cx + half(3), sx - 2, ry + 1, 'r'); set(g, sx - 1, ry, 'S'); set(g, sx - 1, ry + 1, 'S');
    if (stage >= 2) { var oy = faceY - 2; for (var y2 = oy + D.orb + 1; y2 <= bodyEnd + 1; y2++) set(g, sx, y2, y2 % 3 === 0 ? 'l' : 'L'); orb(g, sx, oy, D.orb); }   // staff + ₿ orb
    else { for (var t0 = 0; t0 < 4; t0++) set(g, sx, ry + 1 - t0, 'L'); set(g, sx, ry - 3, 'y'); set(g, sx + 1, ry - 4, 'y'); }        // little wand
    // head: rounded face, ears, eyes, nose, cheeks / brows
    for (var r0 = 0; r0 < faceH; r0++) { var inset = r0 === faceH - 1 ? 1 : 0; hline(g, fx + inset, fx + fw - 1 - inset, faceY + r0, 'S'); }
    set(g, fx - 1, faceY + 2, 'S'); set(g, fx - 1, faceY + 3, 's'); set(g, fx + fw, faceY + 2, 'S'); set(g, fx + fw, faceY + 3, 's');     // ears
    set(g, cx - 2, faceY + 2, 'k'); set(g, cx + 1, faceY + 2, 'k');                                                      // eyes
    set(g, cx - 1, faceY + 3, 's'); set(g, cx, faceY + 3, 's');                                                          // nose
    if (stage <= 2) { set(g, cx - 3, faceY + 3, 'p'); set(g, cx + 2, faceY + 3, 'p'); }                                 // young cheeks
    if (stage >= 3) { hline(g, cx - 3, cx - 2, faceY + 1, bc); hline(g, cx + 1, cx + 2, faceY + 1, bc); }               // bushy brows
    // beard: moustache + a rounded beard over the chest (a smile for the beardless Hatchling)
    if (D.bl) { hline(g, cx - 3, cx + 2, faceY + 4, bc); set(g, cx - 4, faceY + 5, bc); set(g, cx + 3, faceY + 5, bc);
      for (var k2 = 0; k2 < D.bl; k2++) { var bw = Math.max(0, Math.round(D.bw * Math.sqrt(Math.max(0, 1 - Math.pow(k2 / D.bl, 2))) + 0.3)), by2 = faceY + 5 + k2;
        for (var x5 = cx - bw - 1; x5 <= cx + bw; x5++) set(g, x5, by2, x5 >= cx + bw - 0 && bw > 0 ? bs : (k2 === D.bl - 1 ? bs : bc)); }
      set(g, cx - 1, faceY + 5, 's'); set(g, cx, faceY + 5, 's'); }
    else { set(g, cx - 1, faceY + 4, 's'); set(g, cx, faceY + 4, 's'); }
    // Outfits recolour the robe and sleeves (not the hat)
    if (G.body) { var b0 = col('body'), b1 = col('body', 1), bd = shade(b1, 0.85), bl = shade(b0, 1.15); for (var by = 0; by < N; by++) for (var bx = 0; bx < N; bx++) { var q0 = g[by][bx]; if (q0 === 'R') g[by][bx] = b0; else if (q0 === 'r') g[by][bx] = bd; else if (q0 === 'h') g[by][bx] = bl; }
      if (/armor|armour|plate|mail|chest/.test(kind('body'))) { hline(g, cx - half(1), cx + half(1) - 1, shY + 1, b1); set(g, cx - half(2), shY + 2, bl); set(g, cx + half(2) - 1, shY + 2, bl); } }
    // head: hat, or grey hair + Headwear
    /* base sprite is hatless (grey hair); the Wizard Hat is a gear piece drawn here by the gear layer like any other Headwear */
    if (isHat(G.head)) hat(g, cx, top, D.hat, faceY, stage, 'B', 'b', 'c');
    else { hline(g, fx, fx + fw - 1, faceY - 1, 'G'); hline(g, fx + 1, fx + fw - 2, faceY - 2, 'G'); set(g, fx - 1, faceY, 'G'); set(g, fx - 1, faceY + 1, 'G'); set(g, fx + fw, faceY, 'G'); set(g, fx + fw, faceY + 1, 'G'); set(g, fx + 2, faceY - 2, 'g'); set(g, fx + 5, faceY - 1, 'g'); // hat off: grey wizard hair
      if (!G.head) { /* no headwear: just the hair */ } else { var hk = kind('head'), hc = col('head'), hd = col('head', 1);
      if (/crown|tiara/.test(hk)) { hline(g, fx - 1, fx + fw, faceY - 2, hc); for (var ci = fx - 1; ci <= fx + fw; ci += 2) set(g, ci, faceY - 3, hc); set(g, cx, faceY - 2, hd); }
      else if (!/band|hachimaki|halo|visor/.test(hk) && /hat|cap|beanie|helmet|hood|bucket|fedora|beret|bowl|newsboy/.test(hk)) { rect(g, fx - 1, faceY - 3, fw + 2, 2, hc); rect(g, fx, faceY - 5, fw, 2, hc); hline(g, fx - 2, fx + fw + 1, faceY - 1, hd); }
      else { hline(g, fx - 1, fx + fw, faceY - 1, hc); set(g, cx, faceY - 1, hd); set(g, fx + fw + 1, faceY, hc); } } }          // headband-style
    // Grip piece in the left hand
    if (G.hand) { var ak = kind('hand'), a0 = col('hand'), a1 = col('hand', 1);
      if (/mug|cup|coffee|tea|bowl|bucket/.test(ak)) { rect(g, hx - 2, hy - 2, 3, 3, a0); hline(g, hx - 2, hx, hy - 2, a1); set(g, hx - 3, hy - 1, a1); set(g, hx - 1, hy, shade(a0, 0.8)); }
      else if (/sword|staff|stick|dagger|wand|quill|torch|rocket|shiv|mallet|pole|spear|candle|bat|banner|flag/.test(ak)) { for (var t = 0; t < 6; t++) set(g, hx, hy - 1 - t, t > 3 ? a1 : a0); }
      else rect(g, hx - 2, hy - 2, 3, 3, a0);
      set(g, hx, hy, 'S'); set(g, hx + 1, hy, 'S'); }
    // Footwear
    if (G.feet) { var f0 = col('feet'), f1 = col('feet', 1); [[cx - 5, cx - 2], [cx + 1, cx + 4]].forEach(function (r) { for (var x4 = r[0]; x4 <= r[1]; x4++) { set(g, x4, fy, f0); set(g, x4, fy + 1, x4 === r[0] || x4 === r[1] ? f1 : f0); } }); }
    // Guise (face) piece
    if (G.face) { var gk = kind('face'), g0 = col('face'), g1 = col('face', 1);
      if (/tear/.test(gk)) { set(g, cx - 2, faceY + 3, g0); }
      else if (/shade|sunglass|goggle|visor|laser|beam/.test(gk)) hline(g, cx - 3, cx + 2, faceY + 2, g0);
      else if (/glass|lens|monocle|specs|eye/.test(gk)) { set(g, cx - 3, faceY + 2, g0); set(g, cx - 1, faceY + 2, g0); set(g, cx, faceY + 2, g0); set(g, cx + 2, faceY + 2, g0); }
      else if (/mask|bandana|scarf/.test(gk)) hline(g, fx, fx + fw - 1, faceY + 4, g0);
      else { set(g, cx + 2, faceY + 3, g0); set(g, cx + 3, faceY + 3, g1); } }
    var o = outline(g);
    if (stage === 5) [[3, 5], [27, 9], [5, 18], [28, 22], [9, 3]].forEach(function (p, i) { if ((i + (frame || 0)) % 2 === 0) { set(o, p[0], p[1], 'y'); set(o, p[0] + 1, p[1], 'y'); set(o, p[0], p[1] + 1, 'y'); } });
    return o;
  }
  /** render(stage, frame, bg, gear?) -> { width, height, data: [RGBA...] } */
  function render(stage, frame, bg, gear, opts) { var g = draw(stage, frame, gear), d = [], B = hexRgb(bg || '#142018'), P = opts && opts.community ? Object.assign({}, PAL, PAL_COMMUNITY) : PAL;
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) { var k = g[y][x], c = k ? hexRgb(P[k] || k) : B; d.push(c[0], c[1], c[2], 255); } return { width: N, height: N, data: d }; }
  function frames(stage, bg, gear, opts) { return [0, 1, 2, 3].map(function (f) { return render(stage, f, bg, gear, opts); }); }
  return { STAGES: STAGES, PAL: PAL, PAL_COMMUNITY: PAL_COMMUNITY, WIZARD_HAT: WIZARD_HAT, render: render, frames: frames, draw: draw };
});
