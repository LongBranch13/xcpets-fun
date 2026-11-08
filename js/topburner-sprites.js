/* TOP BURNER FIVE sprites (1 of 1 each, PREVIEW, branch top-burner-five-1107).
 * Gift eggs for the #1 all-time XCPETS burner. NOT granted until V2Rules.ACTIVATE_TOP_BURNER_FIVE_BLOCK
 * is set (null = OFF). Same 32x32 key grid, ink outline and 4-frame idle as VikingSprite / DragonSprite.
 * Frames: 0 rest, 1 bob, 2 blink or visor glint, 3 action (arm or quill). Starman is the suited
 * spaceman alone (owner t3174u: he does not need to be in the car). No fire aura, no flame
 * crown, no gold frame, no flame pixels. Bitcoin, if it is ever drawn, is red. No letters, no memes.
 * Dead: opts.dead greys the palette. Risen zombies are the shared V2ZombieLook pass (light eye + dark pupil). */
(function (root, factory) { if (typeof module === 'object' && module.exports) module.exports = factory(); else root.TopBurnerSprites = factory(); })(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
  var N = 32, STAGES = ['Egg', 'Hatchling', 'Juvenile', 'Adult', 'Elder', 'Mythic'];
  var IDS = ['yeti', 'sasquatch', 'greypepe', 'chupacabra', 'starman'];
  var NAMES = { yeti: 'Abominable Snowman', sasquatch: 'Sasquatch', greypepe: 'GreyPepe Alien', chupacabra: 'Chupacabra', starman: 'Starman' };
  var PAL = {
    yeti: { n: '#1a1420', W: '#f4f7fb', w: '#c5d0dc', d: '#8aa0b4', I: '#7ec8e3', i: '#d7f3ff', K: '#9ad7ff', E: '#f7f4ea', P: '#141018', m: '#7a4a55', o: '#e7eef6', F: '#d5dee8', H: '#f7f4ea', B: '#b9c6d4' },
    sasquatch: { n: '#1a1420', W: '#8d5a32', w: '#6b3e24', d: '#4a2918', I: '#c4a574', i: '#e7d3a1', K: '#e7d3a1', E: '#f4f2ea', P: '#141018', m: '#6a3030', o: '#c4a574', F: '#3a2418', H: '#a67c52', B: '#5c3a28' },
    greypepe: { n: '#1a1420', W: '#9aa3a8', w: '#6e777c', d: '#4a5258', I: '#c5ccd0', i: '#e8eef2', K: '#dfe7ff', E: '#0c0e12', P: '#f4f7fb', m: '#3a4148', o: '#8b949a', F: '#5c656c', H: '#c5ccd0', B: '#7d868c' },
    chupacabra: { n: '#1a1420', W: '#6a5344', w: '#4a382c', d: '#2c211c', I: '#8a7360', i: '#c9b8a4', K: '#efe6c8', E: '#f4f2ea', P: '#1a100c', V: '#c43838', m: '#4a1818', X: '#fbfaf2', o: '#5c4638', F: '#2a1c16', H: '#7a5a42', B: '#3a2a22', q: '#241c18' },
    starman: { n: '#1a1420', W: '#f2f4f6', w: '#b7c0c8', d: '#7d8792', I: '#1c2430', i: '#d7ecff', K: '#f7fbff', E: '#d7ecff', P: '#1c2430', m: '#8a939c', o: '#e6eaee', F: '#1a1420', H: '#f2f4f6', B: '#9aa3ad', R: '#c1121f', r: '#7a0c14', L: '#f25c69', Q: '#c5ccd4', U: '#f4f1ea' }
  };
  /* front-facing growth: head half-width, head rows, body half-width, body rows, arm length, foot half-width, horn, hunch */
  var FRONT = {
    yeti: [null,
      { hw: 4, hh: 5, bw: 3, bh: 4, arm: 2, fw: 2, horn: 0 },
      { hw: 5, hh: 6, bw: 4, bh: 6, arm: 3, fw: 3, horn: 1 },
      { hw: 6, hh: 7, bw: 5, bh: 8, arm: 4, fw: 4, horn: 2 },
      { hw: 6, hh: 7, bw: 6, bh: 9, arm: 5, fw: 4, horn: 3 },
      { hw: 7, hh: 8, bw: 6, bh: 9, arm: 5, fw: 5, horn: 4 }],
    sasquatch: [null,
      { hw: 4, hh: 5, bw: 3, bh: 4, arm: 4, fw: 2, horn: 0, hunch: 1 },
      { hw: 5, hh: 6, bw: 4, bh: 6, arm: 6, fw: 2, horn: 0, hunch: 1 },
      { hw: 5, hh: 6, bw: 5, bh: 8, arm: 8, fw: 2, horn: 0, hunch: 2 },
      { hw: 6, hh: 7, bw: 5, bh: 9, arm: 9, fw: 3, horn: 0, hunch: 2 },
      { hw: 6, hh: 7, bw: 6, bh: 9, arm: 9, fw: 3, horn: 0, hunch: 2 }],
    greypepe: [null,
      { hw: 5, hh: 6, bw: 3, bh: 3, arm: 2, fw: 1, horn: 0 },
      { hw: 6, hh: 7, bw: 3, bh: 4, arm: 2, fw: 1, horn: 0 },
      { hw: 7, hh: 8, bw: 4, bh: 5, arm: 3, fw: 2, horn: 0 },
      { hw: 7, hh: 8, bw: 4, bh: 5, arm: 3, fw: 2, horn: 0 },
      { hw: 8, hh: 9, bw: 4, bh: 5, arm: 3, fw: 2, horn: 0 }]
  };
  var BEAST = [null,
    { hx: 13, hy: 16, hr: 3, sn: 2, bx: 19, by: 21, rx: 4, ry: 3, q: 2, tl: 2, lg: 2 },
    { hx: 12, hy: 15, hr: 3, sn: 3, bx: 19, by: 21, rx: 5, ry: 3, q: 3, tl: 3, lg: 2 },
    { hx: 11, hy: 14, hr: 3, sn: 5, bx: 19, by: 20, rx: 6, ry: 4, q: 4, tl: 5, lg: 3 },
    { hx: 10, hy: 13, hr: 3, sn: 6, bx: 19, by: 20, rx: 6, ry: 4, q: 5, tl: 6, lg: 3 },
    { hx: 10, hy: 12, hr: 4, sn: 7, bx: 19, by: 20, rx: 7, ry: 4, q: 6, tl: 6, lg: 3 }];
  function grid() { var g = []; for (var i = 0; i < N; i++) g.push(new Array(N).fill(null)); return g; }
  function set(g, x, y, k) { if (x >= 0 && y >= 0 && x < N && y < N) g[y][x] = k || null; }
  function get(g, x, y) { return x >= 0 && y >= 0 && x < N && y < N ? g[y][x] : null; }
  function hline(g, x0, x1, y, k) { for (var x = x0; x <= x1; x++) set(g, x, y, k); }
  function fill(g, x0, x1, y0, y1, k) { for (var y = y0; y <= y1; y++) hline(g, x0, x1, y, k); }
  function outline(g) { var o = g.map(function (r) { return r.slice(); }); for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) if (!g[y][x]) {
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(function (d) { return get(g, x + d[0], y + d[1]); })) o[y][x] = 'n'; } return o; }
  function hexRgb(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
  function deadRgb(rgb) { var L = 0.3 * rgb[0] + 0.59 * rgb[1] + 0.11 * rgb[2]; return [Math.round(L * 0.45 + 48), Math.round(L * 0.47 + 46), Math.round(L * 0.4 + 42)]; }
  function oval(g, cx, cy, rx, ry, k, shade) { for (var y = -ry; y <= ry; y++) for (var x = -rx; x <= rx; x++) {
    if ((x * x) / (rx * rx + 0.4) + (y * y) / (ry * ry + 0.4) > 1) continue;
    set(g, cx + x, cy + y, (x > rx - 2 || y > ry - 1) ? shade : k); } }
  function eyePair(g, x0, x1, y, blink, white, pupil, glint) {
    if (blink) { hline(g, x0, x0 + 1, y, 'd'); hline(g, x1, x1 + 1, y, 'd'); return; }
    set(g, x0, y, white); set(g, x0 + 1, y, pupil); set(g, x1, y, white); set(g, x1 + 1, y, pupil);
    if (glint) set(g, x0, y, glint); }
  function shag(g, x, y, k) { set(g, x, y, k); }
  function egg(id, frame) {
    var g = grid(), tilt = frame === 1 ? -1 : frame === 3 ? 1 : 0, glint = frame === 2, top = 10, H = 16;
    var base = id === 'yeti' ? 'W' : id === 'sasquatch' ? 'W' : id === 'greypepe' ? 'W' : id === 'chupacabra' ? 'd' : 'W';
    var shade = id === 'yeti' ? 'w' : id === 'sasquatch' ? 'w' : id === 'greypepe' ? 'w' : id === 'chupacabra' ? 'B' : 'w';
    for (var y = 0; y < H; y++) { var v = (y - 8) / 8, hw = Math.round(Math.sqrt(Math.max(0, 1 - v * v)) * (y < 8 ? 6 : 7));
      var off = y < 6 ? tilt : 0; for (var x = 16 - hw + off; x <= 16 + hw - 1 + off; x++) set(g, x, top + y, x >= 16 + hw - 2 ? shade : base); }
    if (id === 'yeti') {
      set(g, 14 + tilt, top - 1, 'W'); set(g, 15 + tilt, top - 2, 'I'); set(g, 17 + tilt, top - 1, 'w'); set(g, 16 + tilt, top - 2, 'i');
      [[14, 18], [15, 19], [16, 18], [17, 19], [18, 18]].forEach(function (p, i) { set(g, p[0] + tilt, top + p[1] - 11, i % 2 ? 'I' : 'i'); });
      if (glint) set(g, 16 + tilt, top + 8, 'i');
    } else if (id === 'sasquatch') {
      [[14, 16], [15, 17], [16, 16], [18, 16], [19, 17], [20, 16]].forEach(function (p) { set(g, p[0], top + p[1] - 8, 'd'); });
      set(g, 15, top + 9, 'd'); set(g, 19, top + 9, 'd');
      if (glint) set(g, 16, top + 4, 'I');
    } else if (id === 'greypepe') {
      hline(g, 12, 15, top + 6, 'd'); hline(g, 17, 20, top + 6, 'd');
      set(g, 12, top + 6, 'K'); set(g, 17, top + 6, 'K');
      hline(g, 13, 19, top + 10, 'd');
      if (glint) { set(g, 13, top + 6, 'K'); set(g, 18, top + 6, 'K'); }
    } else if (id === 'chupacabra') {
      [[14, -1], [16, -2], [18, -1]].forEach(function (p) { set(g, p[0], top + p[1], 'q'); set(g, p[0], top + p[1] - 1, 'K'); });
      set(g, 15, top + 7, 'V'); set(g, 18, top + 7, 'V');
      if (glint) set(g, 16, top + 8, 'i');
    } else {
      /* white shell, a dark visor slit, no car and no red stripe */
      hline(g, 12, 20, top + 6, 'I'); hline(g, 13, 19, top + 7, 'I');
      set(g, 14, top + 6, glint ? 'K' : 'i'); set(g, 15, top + 6, 'E'); set(g, 16, top + 6, 'P');
      if (glint) set(g, 15, top + 6, 'K');
    }
    return outline(g);
  }
  function fur(id, x, cx, edge) { if (id === 'yeti') return x >= cx + edge - 2 ? 'd' : (x + edge) % 5 === 0 ? 'w' : 'W';
    if (id === 'sasquatch') return x >= cx + edge - 2 ? 'd' : (x + edge) % 3 === 0 ? 'd' : 'W';
    return x >= cx + edge - 2 ? 'd' : 'W'; }
  function front(id, stage, frame, gear) {
    var g = grid(), D = FRONT[id][stage], bob = [0, -1, -1, 0][frame || 0], blink = frame === 2, act = frame === 3, myth = stage === 5;
    var cx = 16, hunch = D.hunch || 0, bodyEnd = 27 + bob, bodyTop = bodyEnd - D.bh + 1, headBot = bodyTop - 1 + hunch;
    var headTop = headBot - D.hh + 1, bw = D.bw;
    /* shaggy side fur: yeti and sasquatch grow an extra tuft on every other row */
    for (var y = bodyTop; y <= bodyEnd; y++) { var jag = id === 'greypepe' ? 0 : (y % 2 === 0 ? 2 : 1);
      for (var x = cx - bw - jag; x <= cx + bw - 1 + jag; x++) { var edge = x <= cx - bw - 1 || x >= cx + bw;
        var k = !edge && y > bodyTop + 1 && y < bodyEnd - 1 && x > cx - bw + 1 && x < cx + bw - 2 ? 'o' : (edge && id === 'sasquatch' ? 'd' : fur(id, x, cx, bw + jag));
        set(g, x, y, k); } }
    /* feet, wider than the body on the yeti */
    var fw = D.fw, boot = id === 'greypepe' ? 'F' : 'F';
    hline(g, cx - bw - fw + 1, cx - 1, bodyEnd + 1, boot); hline(g, cx, cx + bw + fw - 2, bodyEnd + 1, boot);
    if (id === 'yeti') { set(g, cx - bw - fw, bodyEnd + 1, 'w'); set(g, cx + bw + fw - 1, bodyEnd + 1, 'd'); }
    if (id === 'sasquatch') { set(g, cx - bw - 1, bodyEnd + 2, 'F'); set(g, cx + 1, bodyEnd + 2, 'F'); set(g, cx - bw, bodyEnd + 2, 'd'); }
    /* arms. Frame 3 lifts the viewer's left arm (a wave / a reach), clear of the face. */
    var armTop = bodyTop + 1, handY = Math.min(N - 2, armTop + D.arm);
    var lx = cx - bw - (id === 'sasquatch' ? 3 : 2), rx = cx + bw + (id === 'sasquatch' ? 2 : 1);
    var armK = id === 'sasquatch' ? 'd' : 'w';
    for (var a = 0; a < D.arm; a++) { var ay = Math.min(N - 2, armTop + a); set(g, lx, ay, a === D.arm - 1 ? 'H' : armK); set(g, rx, ay, a === D.arm - 1 ? 'H' : armK); if (id === 'sasquatch' && a > 1) set(g, lx + 1, ay, 'B'); }
    if (act) { for (var a2 = 0; a2 < D.arm; a2++) set(g, lx, Math.min(N - 2, armTop + a2), null);
      for (var a3 = 0; a3 < D.arm; a3++) set(g, lx, Math.max(1, headTop + 2 - (D.arm - 1 - a3)), a3 === D.arm - 1 ? 'H' : armK); }
    /* head */
    for (var yh = headTop; yh <= headBot; yh++) { var inset = yh === headTop ? 1 : 0;
      for (var xh = cx - D.hw + inset; xh <= cx + D.hw - 1 - inset; xh++) set(g, xh, yh, fur(id, xh, cx, D.hw)); }
    if (id === 'yeti' || id === 'sasquatch') { hline(g, cx - D.hw, cx + D.hw - 1, headTop + 1, 'd'); } /* brow */
    var ey = headTop + Math.max(2, Math.floor(D.hh * 0.45));
    if (id === 'greypepe') {
      var ew = Math.min(4, D.hw - 1), ey0 = headTop + 2;
      for (var ex = 0; ex < ew; ex++) { set(g, cx - D.hw + 1 + ex, ey0, 'E'); set(g, cx + 1 + ex, ey0, 'E'); if (!blink && D.hh > 5) { set(g, cx - D.hw + 1 + ex, ey0 + 1, 'E'); set(g, cx + 1 + ex, ey0 + 1, 'E'); } }
      if (!blink) { set(g, cx - D.hw + 1, ey0, 'P'); set(g, cx + 1, ey0, 'P'); if (myth) { set(g, cx - D.hw + 2, ey0, 'K'); set(g, cx + 2, ey0, 'K'); } }
      else { hline(g, cx - D.hw + 1, cx - D.hw + ew, ey0, 'd'); hline(g, cx + 1, cx + ew, ey0, 'd'); }
      var my = ey0 + (D.hh > 5 && !blink ? 3 : 2);
      hline(g, cx - D.hw + 1, cx + D.hw - 2, my, 'm'); set(g, cx - 1, my + 1, 'm'); set(g, cx, my + 1, 'm');
      set(g, cx - D.hw, my, 'I'); set(g, cx + D.hw - 1, my, 'I'); /* cheeks, so the wide mouth reads as a frog */
      ey = ey0;
    } else {
      var gap = id === 'yeti' ? 1 : 0;
      eyePair(g, cx - 3, cx + 1 + gap, ey, blink, 'E', 'P', myth && id === 'yeti' ? 'i' : null);
      if (!blink && myth && id === 'sasquatch') { set(g, cx - 3, ey, 'i'); }
      set(g, cx - 1, ey + 1, 'd'); set(g, cx, ey + 1, 'd');
      hline(g, cx - 2, cx + 1, ey + 2, 'm');
    }
    /* horns (yeti only) and mythic frost / moon tips */
    if (id === 'yeti' && D.horn) { for (var hn = 1; hn <= D.horn; hn++) { set(g, cx - 1 - hn, headTop + 1 - hn, myth ? 'K' : 'I'); set(g, cx + hn, headTop + 1 - hn, myth ? 'K' : 'i'); } }
    if (myth && id === 'yeti') { set(g, cx, headTop, 'K'); set(g, cx - 1, headTop + 1, 'I'); }
    if (myth && id === 'sasquatch') { set(g, cx - D.hw, headTop, 'K'); set(g, cx + D.hw - 1, headTop, 'K'); set(g, lx, handY, 'I'); }
    if (stage >= 4 && id === 'yeti') { set(g, cx - 2, headBot, 'w'); set(g, cx + 1, headBot, 'd'); } /* elder beard tufts */
    if (id === 'sasquatch' && stage >= 3) { hline(g, cx - 2, cx + 1, headBot, 'd'); } /* heavier jaw */
    gearOn(g, gear, { kind: 'front', cx: cx, ey: ey, top: headTop, handX: act ? lx : rx, handY: act ? Math.max(1, headTop) : handY });
    return outline(g);
  }
  function beast(stage, frame, gear) {
    var g = grid(), H = BEAST[stage], bob = [0, -1, -1, 0][frame || 0], blink = frame === 2, act = frame === 3, myth = stage === 5;
    var hy = H.hy + bob, by = H.by + bob;
    /* tail to the right, then body, then the head so the snout stays in front */
    for (var t = 0; t < H.tl; t++) { var tx = H.bx + H.rx - 1 + t, ty = by + Math.round(t * 0.35); set(g, tx, ty, t % 2 ? 'w' : 'd'); if (t < H.tl - 1) set(g, tx, ty - 1, 'W'); }
    set(g, H.bx + H.rx + H.tl, by + Math.round(H.tl * 0.35), myth ? 'K' : 'd');
    for (var y = -H.ry; y <= H.ry; y++) for (var x = -H.rx; x <= H.rx; x++) if ((x * x) / (H.rx * H.rx + 0.4) + (y * y) / (H.ry * H.ry + 0.4) <= 1) set(g, H.bx + x, by + y, y > 0 ? 'o' : (x > H.rx - 2 ? 'd' : 'W'));
    /* quills. Frame 3 flicks the middle quill. */
    for (var q = 0; q < H.q; q++) { var qx = H.bx - H.rx + 2 + q * 2, qh = 2 + (q % 2) + (stage >= 4 ? 1 : 0), flick = act && q === Math.floor(H.q / 2) ? -1 : 0;
      for (var qi = 1; qi <= qh; qi++) set(g, qx, by - H.ry - qi + flick, qi === qh ? (myth ? 'K' : 'q') : 'd'); }
    /* legs + claws */
    for (var l = 1; l <= H.lg; l++) { set(g, H.bx - H.rx + 2, by + H.ry + l - 1, 'w'); set(g, H.bx + 1, by + H.ry + l - 1, 'd'); }
    set(g, H.bx - H.rx + 1, by + H.ry + H.lg, 'F'); set(g, H.bx + H.rx - 2, by + H.ry + H.lg, 'F');
    /* head + snout facing left */
    for (var yy = -H.hr; yy <= H.hr - 1; yy++) for (var xx = -H.hr; xx <= H.hr - 1; xx++) if (xx * xx + yy * yy <= H.hr * H.hr) set(g, H.hx + xx, hy + yy, yy < -1 ? 'I' : 'W');
    var sx = H.hx - H.hr - H.sn + 1, sy = hy;
    for (var s = sx; s < H.hx; s++) { set(g, s, sy - 1, 'W'); set(g, s, sy, s === sx ? 'd' : 'm'); set(g, s, sy + 1, 'w'); }
    if (stage >= 3) { set(g, sx + 1, sy, 'X'); set(g, sx + 3, sy, 'X'); } /* fangs, not text */
    var ey = hy - 2, ex = H.hx - 1;
    if (blink) hline(g, ex, ex + 1, ey, 'd');
    else { set(g, ex, ey, 'V'); set(g, ex + 1, ey, 'P'); set(g, ex, ey + 1, 'E'); if (myth) set(g, ex, ey - 1, 'K'); }
    /* ears */
    set(g, H.hx + 1, hy - H.hr, 'w'); set(g, H.hx + 2, hy - H.hr - 1, 'd');
    if (stage >= 4) set(g, H.hx - 1, hy + 1, 'd'); /* scar, elder */
    gearOn(g, gear, { kind: 'side', cx: H.hx, ey: ey, top: hy - H.hr, handX: H.bx - H.rx, handY: by + 1 });
    return outline(g);
  }
  /* Starman: the spaceman alone. White suit, dark visor, gloves and boots. No car, no wheels, no red stripe. */
  var SUIT = [null,
    { hw: 4, hh: 5, bw: 2, bh: 4, arm: 2 },
    { hw: 5, hh: 6, bw: 3, bh: 5, arm: 3 },
    { hw: 5, hh: 6, bw: 4, bh: 7, arm: 4 },
    { hw: 5, hh: 6, bw: 4, bh: 8, arm: 5 },
    { hw: 6, hh: 7, bw: 4, bh: 8, arm: 5 }];
  function starman(stage, frame, gear) {
    var g = grid(), D = SUIT[stage], bob = [0, -1, -1, 0][frame || 0], blink = frame === 2, act = frame === 3, myth = stage === 5, cx = 16;
    var bodyEnd = 27 + bob, bodyTop = bodyEnd - D.bh + 1, headBot = bodyTop, headTop = headBot - D.hh + 1;
    /* life-support pack on the back, from Juvenile up. It sits behind the suit and is not a cape. */
    if (stage >= 2) { for (var yb = bodyTop + 1; yb <= bodyEnd - 2; yb++) { set(g, cx + D.bw, yb, 'B'); set(g, cx + D.bw + 1, yb, 'd'); } set(g, cx + D.bw, bodyTop, 'Q'); }
    for (var y = bodyTop; y <= bodyEnd; y++) for (var x = cx - D.bw; x < cx + D.bw; x++) {
      var chest = y >= bodyTop + 2 && y <= bodyTop + 3 && x >= cx - 1 && x <= cx;
      set(g, x, y, chest ? 'o' : (x >= cx + D.bw - 2 ? 'w' : 'W')); }
    hline(g, cx - D.bw + 1, cx + D.bw - 2, bodyTop, 'Q'); /* neck ring */
    if (stage >= 4) { set(g, cx - 1, bodyEnd - 1, 'Q'); set(g, cx + 1, bodyEnd - 1, 'Q'); } /* knee rings */
    hline(g, cx - D.bw, cx - 1, bodyEnd + 1, 'F'); hline(g, cx, cx + D.bw - 1, bodyEnd + 1, 'F');
    var lx = cx - D.bw - 1, rx = cx + D.bw + (stage >= 2 ? 2 : 0), armTop = bodyTop + 1;
    for (var a = 0; a < D.arm; a++) { var ay = Math.min(N - 2, armTop + a); set(g, lx, ay, a === D.arm - 1 ? 'Q' : 'w'); set(g, rx, ay, a === D.arm - 1 ? 'Q' : 'w'); }
    if (act) { for (var a2 = 0; a2 < D.arm; a2++) set(g, lx, Math.min(N - 2, armTop + a2), null);
      for (var a3 = 0; a3 < D.arm; a3++) set(g, lx, Math.max(1, headTop + 1 - (D.arm - 1 - a3)), a3 === D.arm - 1 ? 'Q' : 'w'); }
    for (var yh = headTop; yh <= headBot; yh++) { var inset = yh === headTop ? 2 : yh === headTop + 1 ? 1 : 0;
      for (var xh = cx - D.hw + inset; xh <= cx + D.hw - 1 - inset; xh++) set(g, xh, yh, yh === headTop ? 'w' : 'W'); }
    var ey = headTop + Math.max(2, Math.floor(D.hh * 0.42));
    hline(g, cx - D.hw + 1, cx + D.hw - 2, ey, 'I');
    if (D.hh > 5) hline(g, cx - D.hw + 2, cx + D.hw - 3, ey + 1, 'I');
    if (blink) hline(g, cx - 2, cx + 1, ey, 'd');
    else { set(g, cx - 2, ey, 'E'); set(g, cx - 1, ey, 'P'); set(g, cx, ey, 'i'); if (myth) set(g, cx + 1, ey, 'K'); }
    if (myth) set(g, rx, bodyTop, 'i'); /* cold shoulder lamp, not a flame */
    gearOn(g, gear, { kind: 'front', cx: cx, ey: ey, top: headTop, handX: act ? lx : rx, handY: act ? Math.max(2, headTop + 1) : Math.min(N - 2, armTop + D.arm - 1) });
    return outline(g);
  }
  function gearOn(g, gear, a) {
    var Gr = gear || {}; if (!Gr.head && !Gr.face && !Gr.body && !Gr.back && !Gr.feet && !Gr.hand && !Gr.weapon) return;
    function col(sl, i, d) { var it = Gr[sl]; return (it && it.cols && (it.cols[i] || it.cols[0])) || d; }
    var ey = a.ey, top = a.top;
    if (Gr.head) { var hc = col('head', 0, '#c0303a'), hd = col('head', 1, '#7a1820');
      for (var hy = top - 3; hy <= top - 1; hy++) hline(g, a.cx - 3, a.cx + 2, hy, hy === top - 1 ? hd : hc);
      /* brim stops a full pixel above the eyes */
      if (top - 1 < ey - 1) hline(g, a.cx - 4, a.cx + 3, top, hd); }
    if (Gr.body) { var bc = col('body', 0, '#9aa4b0'), bd = col('body', 1, '#5a6470');
      for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) if (g[y][x] === 'o') g[y][x] = (x + y) % 4 === 0 ? bd : bc; }
    if (Gr.feet) { var fc = col('feet', 0, '#6a3a1a');
      for (var y2 = 0; y2 < N; y2++) for (var x2 = 0; x2 < N; x2++) if (g[y2][x2] === 'F') g[y2][x2] = fc; }
    if (Gr.back) { var kc = col('back', 0, '#c0303a'), kd = col('back', 1, '#7a1820'), seen = false;
      for (var y3 = ey + 2; y3 < N - 2; y3++) { var left = 99; for (var x3 = 0; x3 < N; x3++) if (g[y3][x3] && g[y3][x3] !== 'n') { left = x3; break; }
        if (left === 99) continue; seen = true; if (!get(g, left - 1, y3)) set(g, left - 1, y3, y3 % 2 ? kd : kc); if (!get(g, left - 2, y3)) set(g, left - 2, y3, kd); } }
    if (Gr.face && ey >= 0) { var gc = col('face', 0, '#141018');
      [[-1, 0], [2, 0], [0, -1], [1, -1]].forEach(function (p) { var x = a.cx + p[0], y = ey + p[1]; if (y < ey && get(g, x, y) !== 'E' && get(g, x, y) !== 'P' && get(g, x, y) !== 'V') set(g, x, y, gc); }); }
    if (Gr.hand || Gr.weapon) { var hx = Math.max(1, Math.min(N - 2, a.handX)), hy4 = Math.max(2, Math.min(N - 2, a.handY));
      if (Gr.hand) { var wc = col('hand', 0, '#8a5a2a'); for (var t = 0; t < 5; t++) if (get(g, hx, hy4 - t) !== 'E' && get(g, hx, hy4 - t) !== 'P') set(g, hx, hy4 - t, t < 2 ? wc : col('hand', 1, '#c8c8d0')); }
      if (Gr.weapon) { var wx = Math.min(N - 2, hx + 2), w1 = col('weapon', 0, '#9a4a12'); for (var t2 = 0; t2 < 7; t2++) set(g, wx, Math.max(0, hy4 - t2), t2 === 6 ? col('weapon', 1, '#c1121f') : w1); } }
  }
  function draw(id, stage, frame, gear, opts) {
    if (!PAL[id]) return grid();
    if (!stage) return egg(id, frame || 0);
    if (id === 'chupacabra') return beast(stage, frame, gear);
    if (id === 'starman') return starman(stage, frame, gear);
    return front(id, stage, frame, gear);
  }
  function render(id, stage, frame, bg, gear, opts) { var g = draw(id, stage, frame, gear, opts), pal = PAL[id], dead = opts && opts.dead, d = [], Bg = hexRgb(bg || '#1b2430');
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) { var k = g[y][x], c = null;
      if (k) c = k.charAt(0) === '#' ? hexRgb(k) : (pal[k] ? hexRgb(pal[k]) : null); if (c && dead && k !== 'n') c = deadRgb(c); if (!c) c = Bg;
      d.push(c[0], c[1], c[2], 255); } return { width: N, height: N, data: d }; }
  function frames(id, stage, bg, gear, opts) { return [0, 1, 2, 3].map(function (f) { return render(id, stage, f, bg, gear, opts); }); }
  function anchors(id, stage, frame) { var g = draw(id, stage, frame || 0, {}), ey = -1, x0 = 99, x1 = -1;
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) { var k = g[y][x]; if (k === 'E' || k === 'P' || k === 'V' || k === 'i' || k === 'K') { if (ey < 0 || (k === 'E' || k === 'P' || k === 'V')) { if (ey < 0) ey = y; if (y === ey) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); } } } }
    return { ey: ey, ex0: x0, ex1: x1 }; }
  function has(id) { return IDS.indexOf(id) >= 0; }
  return { IDS: IDS, NAMES: NAMES, STAGES: STAGES, PAL: PAL, draw: draw, render: render, frames: frames, anchors: anchors, has: has };
});
