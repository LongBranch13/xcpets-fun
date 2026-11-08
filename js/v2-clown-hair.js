/* Honk: clown hair. Display only. Not in any roll pool (rules files are untouched).
 * Drawn when a render passes overlay id 'v2-honk'.
 * Four round puffs, yellow-green-blue-red, overlapped into one solid mass, plus a round red nose.
 * Fit is per species and per growth stage: placement, width, shape, and whether native hair is replaced.
 * KEVIN: the wig replaces his grey hair. Dodo and the other side-views are fitted to the skull, not the beak.
 */
(function (root, factory) { if (typeof module === 'object' && module.exports) module.exports = factory(); else root.V2ClownHair = factory(); })(this, function () {
  'use strict';
  var ID = 'v2-honk';
  var INK = [26, 16, 32];
  var PUFF = [
    { b: [232, 168, 16], h: [255, 228, 120] },
    { b: [32, 176, 48], h: [150, 240, 120] },
    { b: [36, 92, 228], h: [140, 186, 255] },
    { b: [214, 28, 36], h: [255, 128, 116] }
  ];
  var NOSE = { b: [226, 12, 22], h: [255, 96, 88], d: [150, 8, 16] };
  /* Hand fit. Stage order is Egg, Hatchling, Juvenile, Adult, Elder, Mythic.
   * w = skull-width scale, sink = rows of head the wig may cover above the eyes,
   * dx/dy = extra shift, boost = side-puff size vs the middle, hang = extra side-puff drop,
   * noseDy/noseR/noseDx = clown nose, mode 0 = sit on top, 1 = replace native hair, 2 = under eyestalks,
   * up = also cover thin bits above the skull (crest, curls, hat, bangs). */
  var B = { w: 1, sink: 2, dx: 0, dy: 0, boost: 1.2, hang: 0, noseDy: 3, noseR: 2, noseDx: 0, mode: 0, up: 0, drape: 0 };
  function S(over, st) { var o = Object.assign({}, B, over); o.st = st || null; return o; }
  function T(a, b, c, d, e, f) { return [a, b, c, d, e, f]; }
  var SPEC = {
    pepe: S({ w: 1.06, sink: 2, boost: 1.22, noseDy: 3, noseR: 2 }, T({ w: 0.9, sink: 1, noseR: 1 }, { w: 1.0, sink: 1 }, { w: 1.04, sink: 2 }, { w: 1.08, sink: 2 }, { w: 1.08, sink: 2 }, { w: 1.1, sink: 2, noseR: 2 })),
    wojak: S({ w: 0.74, sink: 1, dx: 1, boost: 1.16, noseDy: 4, noseR: 2 }, T({ w: 0.7, noseR: 1, dx: 0 }, { w: 0.72, dx: 1 }, { w: 0.74, dx: 1 }, { w: 0.76, dx: 1, sink: 1 }, { w: 0.76, dx: 1 }, { w: 0.78, dx: 1, sink: 2 })),
    chud: S({ w: 0.78, sink: 2, dx: 1, boost: 1.16, noseDy: 4, mode: 1, hair: 'chud', up: 1 }, T({ w: 0.72, noseR: 1, dx: 0 }, { w: 0.76, dx: 1 }, { w: 0.78, dx: 1 }, { w: 0.8, dx: 1, sink: 2 }, { w: 0.8, dx: 1 }, { w: 0.82, dx: 1 })),
    chad: S({ w: 0.8, sink: 2, dx: 1, boost: 1.16, noseDy: 4, mode: 1, hair: 'chad', up: 1 }, T({ w: 0.74, noseR: 1 }, { w: 0.78 }, { w: 0.8 }, { w: 0.82, sink: 2 }, { w: 0.84, up: 1 }, { w: 0.84 })),
    bobo: S({ w: 0.7, sink: 2, boost: 1.18, noseDy: 3 }, T({ w: 0.66, noseR: 1 }, { w: 0.68 }, { w: 0.7 }, { w: 0.72, sink: 2 }, { w: 0.72 }, { w: 0.74, sink: 2 })),
    mumu: S({ w: 0.66, sink: 1, dy: 0, boost: 1.14, noseDy: 3, noseR: 2 }, T({ w: 0.62, noseR: 1 }, { w: 0.64 }, { w: 0.66 }, { w: 0.68, sink: 1 }, { w: 0.68 }, { w: 0.7, sink: 2 })),
    snibby: S({ w: 0.42, sink: 0, boost: 1.15, noseDy: 1, noseR: 1, mode: 2, dy: 0 }, T({ w: 0.4, noseR: 1 }, { w: 0.4 }, { w: 0.42 }, { w: 0.44 }, { w: 0.46 }, { w: 0.48 })),
    dodo: S({ w: 0.92, sink: 1, dx: -1, dy: -1, boost: 1.28, noseDx: 3, noseDy: 1, noseR: 2, up: 1 }, T({ w: 0.8, noseR: 1, noseDx: 2, dx: 0 }, { w: 0.86, dx: -1, noseDx: 2 }, { w: 0.9, dx: -1, noseDx: 3 }, { w: 0.94, dx: -1, noseDx: 3, dy: -1 }, { w: 0.96, dx: -1, noseDx: 4 }, { w: 0.98, dx: -2, noseDx: 4, dy: -1 })),
    kevin: S({ w: 1.12, sink: 2, boost: 1.28, hang: 0, noseDy: 3, noseR: 2, mode: 1, hair: 'kevin', drape: 0, up: 1 }, T({ w: 1.0, noseR: 1 }, { w: 1.06 }, { w: 1.1 }, { w: 1.14, sink: 2 }, { w: 1.16, sink: 2 }, { w: 1.18, sink: 2 })),
    peepo: S({ w: 0.92, sink: 1, dy: 0, boost: 1.2, noseDy: 4, noseR: 2 }, T({ w: 0.84, noseR: 1 }, { w: 0.88, dy: 0 }, { w: 0.9 }, { w: 0.94, sink: 1 }, { w: 0.94 }, { w: 0.96, sink: 1 })),
    sarutobi: S({ w: 0.68, sink: 2, boost: 1.16, noseDy: 3 }, T({ w: 0.62, noseR: 1 }, { w: 0.66 }, { w: 0.68 }, { w: 0.7, sink: 2 }, { w: 0.7 }, { w: 0.72 })),
    doge: S({ w: 0.72, sink: 1, dx: 1, boost: 1.22, noseDx: -3, noseDy: 2, noseR: 2 }, T({ w: 0.66, noseR: 1, noseDx: -2 }, { w: 0.7, dx: 1, noseDx: -2 }, { w: 0.72, noseDx: -3 }, { w: 0.74, dx: 1, noseDx: -3 }, { w: 0.76, noseDx: -3 }, { w: 0.76, dx: 1, noseDx: -4 })),
    lenny: S({ w: 0.9, sink: 2, boost: 1.2, noseDy: 4, noseR: 2 }, T({ w: 0.82, noseR: 1, sink: 1 }, { w: 0.86, sink: 1 }, { w: 0.9, sink: 2 }, { w: 0.92, sink: 2 }, { w: 0.94, sink: 2 }, { w: 0.96, sink: 2, noseR: 2 })),
    nakamoto: S({ w: 0.96, sink: 2, dx: -1, boost: 1.18, noseDy: 4, mode: 1, hair: 'naka', up: 1 }, T({ w: 0.86, noseR: 1, dx: 0, mode: 0, up: 0 }, { w: 0.9, dx: -1, mode: 1 }, { w: 0.94, mode: 1 }, { w: 0.98, sink: 2, mode: 1 }, { w: 1.05, sink: 2, mode: 1, up: 1 }, { w: 1.06, sink: 2, mode: 1, up: 1 })),
    wizard: S({ w: 0.86, sink: 0, dy: 0, boost: 1.12, noseDy: 3, noseR: 2, mode: 1, hair: 'wizard', up: 1 }, T({ w: 0.7, noseR: 1, up: 0, mode: 0 }, { w: 0.8, up: 1 }, { w: 0.84, up: 1 }, { w: 0.88, up: 1 }, { w: 0.9, up: 1 }, { w: 0.92, up: 1, sink: 0 })),
    kek: S({ w: 1.02, sink: 2, dy: -1, boost: 1.16, noseDy: 3, up: 1 }, T({ w: 0.9, noseR: 1, dy: 0 }, { w: 0.96, dy: -1 }, { w: 1.0, dy: -1 }, { w: 1.04, sink: 2 }, { w: 1.06, sink: 2 }, { w: 1.08, sink: 2, dy: -1 })),
    funtrump: S({ w: 1.15, sink: 1, dx: -3, boost: 1.22, noseDy: 3, mode: 1, hair: 'ft', up: 1 }, T({ w: 0.9, noseR: 1, dx: -1, mode: 0 }, { w: 1.05, dx: -2, mode: 1 }, { w: 1.12, dx: -3 }, { w: 1.18, dx: -3 }, { w: 1.22, dx: -4 }, { w: 1.26, dx: -4, sink: 1 })),
    homer: S({ w: 0.98, sink: 2, dx: 0, dy: -1, boost: 1.28, noseDx: 2, noseDy: 3, noseR: 2, up: 1 }, T({ w: 0.86, noseR: 1, noseDx: 1, dy: 0 }, { w: 0.92, dy: -1, noseDx: 1 }, { w: 0.96, dy: -1, noseDx: 2 }, { w: 1.0, dy: -1, noseDx: 2 }, { w: 1.02, dy: -1, noseDx: 2 }, { w: 1.04, dy: -1, noseDx: 2, sink: 2 })),
    rabbit: S({ w: 0.86, sink: 2, boost: 1.14, noseDy: 3 }, T({ w: 0.78, noseR: 1 }, { w: 0.82 }, { w: 0.86 }, { w: 0.88, sink: 2 }, { w: 0.9 }, { w: 0.9, sink: 2 })),
    djpepe: S({ w: 1.2, sink: 2, dy: 0, boost: 1.16, noseDy: 3, up: 1, mode: 1, hair: 'dj' }, T({ w: 0.9, noseR: 1, up: 0, mode: 0 }, { w: 1.1, up: 1 }, { w: 1.16, up: 1 }, { w: 1.22, sink: 2 }, { w: 1.24, sink: 2 }, { w: 1.26, sink: 2 })),
    viking: S({ w: 0.82, sink: 1, boost: 1.16, noseDy: 3, up: 1 }, T({ w: 0.74, noseR: 1, up: 0 }, { w: 0.78, up: 1 }, { w: 0.82 }, { w: 0.84, sink: 1 }, { w: 0.86 }, { w: 0.88, sink: 1 })),
    orangedragon: S({ w: 0.7, sink: 1, dx: 1, boost: 1.2, noseDx: 2, noseDy: 2, noseR: 2 }, T({ w: 0.64, noseR: 1 }, { w: 0.68, dx: 1 }, { w: 0.7, noseDx: 2 }, { w: 0.72, dx: 1, noseDx: 2 }, { w: 0.74 }, { w: 0.76, dx: 1 })),
    jacksonpepe: S({ w: 1.15, sink: 2, boost: 1.18, noseDy: 3, mode: 1, hair: 'jp', up: 1 }, T({ w: 0.9, noseR: 1, mode: 0, up: 0 }, { w: 1.08, mode: 1 }, { w: 1.12 }, { w: 1.16, sink: 2 }, { w: 1.18, sink: 2 }, { w: 1.2, sink: 2 })),
    bojackson: S({ w: 0.88, sink: 2, boost: 1.16, noseDy: 3 }, T({ w: 0.78, noseR: 1 }, { w: 0.84 }, { w: 0.88 }, { w: 0.9 }, { w: 0.92 }, { w: 0.94 })),
    rarepigeon: S({ w: 0.76, sink: 1, boost: 1.18, noseDy: 2, noseR: 2 }, T({ w: 0.68, noseR: 1 }, { w: 0.72 }, { w: 0.76 }, { w: 0.78 }, { w: 0.8 }, { w: 0.82 })),
    starlordkek: S({ w: 0.9, sink: 2, boost: 1.16, noseDy: 3 }, T({ w: 0.8, noseR: 1 }, { w: 0.86 }, { w: 0.9 }, { w: 0.92 }, { w: 0.94 }, { w: 0.96 })),
    gooby: S({ w: 0.84, sink: 2, boost: 1.16, noseDy: 3 }, T({ w: 0.74, noseR: 1 }, { w: 0.8 }, { w: 0.84 }, { w: 0.86 }, { w: 0.88 }, { w: 0.9 })),
    lukespam: S({ w: 0.84, sink: 2, boost: 1.16, noseDy: 3 }, T({ w: 0.74, noseR: 1 }, { w: 0.8 }, { w: 0.84 }, { w: 0.86 }, { w: 0.88 }, { w: 0.9 }))
  };
  function fitFor(sp, stage, uniform) {
    if (uniform) return Object.assign({}, B, { w: 1, sink: 1, boost: 1, noseDy: 3, noseR: stage ? 2 : 1 });
    var s = SPEC[sp] || SPEC.pepe, o = Object.assign({}, s), st = s.st && s.st[stage];
    if (st) Object.keys(st).forEach(function (k) { o[k] = st[k]; });
    o.mode = o.mode || 0; return o;
  }
  function hex(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
  function dist(a, b) { return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]); }
  function near(c, h, d) { return dist(c, hex(h)) <= (d == null ? 26 : d); }
  function isInk(c) { return c[0] < 36 && c[1] < 24 && c[2] < 44 && c[1] + 6 < c[0]; }
  function hairFn(name) {
    if (name === 'kevin') return function (c, y, m) { if (near(c, '#958a87', 28) || near(c, '#83746d', 28) || near(c, '#6b5751', 32)) return y <= m.eyeY + 8; if (y < m.eyeTop && near(c, '#894a28', 36)) return true; return false; };
    if (name === 'chud') return function (c, y, m) { return y <= m.eyeY + 1 && (near(c, '#1d1b22', 22) || near(c, '#45414f', 28)); };
    if (name === 'chad') return function (c, y, m) { return y <= m.eyeY + 1 && (near(c, '#baa066', 32) || near(c, '#f3dc97', 32) || near(c, '#987b46', 32)); };
    if (name === 'naka') return function (c, y, m) { if (y > m.eyeY + 2) return false; if (c[1] > c[0] + 12 && c[1] > c[2] + 12) return false; if (near(c, '#cd0000', 30) || near(c, '#c1291c', 30)) return false; return near(c, '#555555', 24) || near(c, '#888888', 24) || near(c, '#7f7f7f', 24) || near(c, '#4a4a4a', 22) || near(c, '#c8c8c8', 30); };
    if (name === 'wizard') return function (c, y, m) { if (y > m.eyeTop) return false; return near(c, '#1f5ff0', 30) || near(c, '#1440b0', 30) || near(c, '#7fb2ff', 36) || near(c, '#8a4fd8', 30) || near(c, '#5b2ea6', 30) || near(c, '#c49cff', 36) || near(c, '#f08a24', 30) || near(c, '#c8631a', 30); };
    if (name === 'ft') return function (c, y, m) { if (y > m.eyeY + 1) return false; return near(c, '#a9743f', 22) || near(c, '#cf9a62', 22) || near(c, '#e6bd85', 22) || near(c, '#f6e2b4', 22); };
    if (name === 'dj') return function (c, y, m) { if (y > m.eyeTop + 1) return false; if (c[0] > 220 && c[1] > 220 && c[2] > 220) return true; return near(c, '#141418', 18) || near(c, '#2a2a2e', 16); };
    if (name === 'jp') return function (c, y, m) { if (y > m.eyeY + 2 || m.eye[y * 32 + (m._x || 0)]) return false; return c[0] > 200 && c[1] > 200 && c[2] > 190; };
    return null;
  }
  function spOf(art) { return art && art.hybrid && art.hybrid.shape ? art.hybrid.shape : (art && art.species) || 'pepe'; }
  function pix(d, x, y) { var i = (y * 32 + x) * 4; return [d[i], d[i + 1], d[i + 2]]; }
  function isBg(c, bg) { return Math.abs(c[0] - bg[0]) + Math.abs(c[1] - bg[1]) + Math.abs(c[2] - bg[2]) < 46; }
  function spriteBox(sp, stage, frame) {
    var A = null, g = window;
    try {
      if (sp === 'homer' && g.HomerSprite) A = g.HomerSprite.anchors(stage, frame);
      else if (sp === 'rabbit' && g.RabbitSprite) A = g.RabbitSprite.anchors(stage, frame);
      else if (sp === 'funtrump' && g.FuntrumpSprite) A = g.FuntrumpSprite.anchors(stage, frame, 'suit');
      else if (sp === 'djpepe' && g.DjPepeSprite) A = g.DjPepeSprite.anchors(stage, frame);
      else if (sp === 'viking' && g.VikingSprite) A = g.VikingSprite.anchors(stage, frame);
      else if (sp === 'orangedragon' && g.DragonSprite) A = g.DragonSprite.anchors(stage, frame);
    } catch (e) { A = null; }
    if (!A) return null;
    if (A.fx0 != null && A.fx1 > A.fx0 && A.fx0 >= 0 && A.fx1 < 32 && A.fy0 >= 0 && A.fy0 < 32) return { l: A.fx0, r: A.fx1, skullTop: A.fy0, top: A.top != null && A.top >= 0 && A.top < 32 ? A.top : A.fy0, eyeY: A.ey >= 0 && A.ey < 32 ? A.ey : A.fy0 + 2, eyeX0: A.ex0, eyeX1: A.ex1 };
    if (A.ey != null && A.ey >= 0 && A.ey < 32 && A.ex0 != null && A.ex1 != null && A.ex1 >= A.ex0 && A.ex1 < 32) return { eyeY: A.ey, eyeX0: A.ex0, eyeX1: A.ex1, onlyEyes: 1 };
    return null;
  }
  function coreBox(art, stage, frame) {
    var PC = window.PetCore, BG = window.BonusGear;
    if (!PC || !BG || !art || art.hybrid) return null;
    var sp = null, i; for (i = 0; i < PC.SPECIES.length; i++) if (PC.SPECIES[i].id === art.species) sp = PC.SPECIES[i];
    if (!sp || !sp.map) return null;
    try {
      var key = Object.assign({}, art, { background: 'solid', bgColor: '#ff00ff', pattern: 'none', eyes: 'classic', shades: false });
      delete key.bgV2; var o = { stage: stage, frame: frame, gearOverride: {}, openEyes: true };
      var bare = PC.render(key, o), star = PC.render(Object.assign({}, key, { eyes: 'star', openEyes: true }), o);
      return BG.anchors(bare, star, sp);
    } catch (e) { return null; }
  }
  function measure(d, art, stage, frame) {
    var bg = [d[0], d[1], d[2]], x, y, i, on = new Uint8Array(1024);
    var minX = 99, maxX = -1, minY = 99, maxY = -1;
    for (y = 0; y < 32; y++) for (x = 0; x < 32; x++) { if (x >= 27 && y < 5) continue; i = (y * 32 + x) * 4; if (isBg([d[i], d[i + 1], d[i + 2]], bg)) continue; on[y * 32 + x] = 1; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
    if (maxX < 0) return null;
    var eye = new Uint8Array(1024), eyeTop = 99, eyeBot = -1, eyeX0 = 99, eyeX1 = -1, eyeN = 0, sx = 0, sy = 0;
    var ca = coreBox(art, stage, frame);
    if (ca && (ca.eyeL || ca.eyeR)) [ca.eyeL, ca.eyeR].forEach(function (e) { if (!e) return; e[2].forEach(function (q) { var p = q[1] * 32 + q[0]; if (p >= 0 && p < 1024) { eye[p] = 1; eyeN++; sx += q[0]; sy += q[1]; if (q[1] < eyeTop) eyeTop = q[1]; if (q[1] > eyeBot) eyeBot = q[1]; if (q[0] < eyeX0) eyeX0 = q[0]; if (q[0] > eyeX1) eyeX1 = q[0]; } }); });
    if (!eyeN) { for (y = minY; y < Math.min(28, minY + Math.round((maxY - minY) * 0.62)); y++) for (x = minX; x <= maxX; x++) { var c = pix(d, x, y); var white = c[0] > 220 && c[1] > 220 && c[2] > 200; var gold = c[0] > 230 && c[1] > 180 && c[2] < 90; if (white || gold) { eye[y * 32 + x] = 1; eyeN++; sx += x; sy += y; if (y < eyeTop) eyeTop = y; if (y > eyeBot) eyeBot = y; if (x < eyeX0) eyeX0 = x; if (x > eyeX1) eyeX1 = x; } } }
    var eyeY = eyeN ? Math.round(sy / eyeN) : minY + Math.max(2, Math.round((maxY - minY) * 0.28));
    if (eyeTop > 40) { eyeTop = eyeY; eyeBot = eyeY; }
    var sb = spriteBox(spOf(art), stage, frame);
    /* a white cap or swept white hair is not a pair of eyes */
    if (eyeX1 - eyeX0 > 8) { eye = new Uint8Array(1024); eyeN = 0; eyeTop = 99; eyeBot = -1; eyeX0 = 99; eyeX1 = -1;
      if (sb && sb.eyeY >= 0) { eyeY = sb.eyeY; eyeTop = sb.eyeY; eyeBot = sb.eyeY; eyeX0 = sb.eyeX0 != null ? sb.eyeX0 : Math.round(sb.l + 2); eyeX1 = sb.eyeX1 != null ? sb.eyeX1 : Math.round(sb.r - 2); }
      else { eyeY = minY + Math.max(2, Math.round((maxY - minY) * 0.34)); eyeTop = eyeY; eyeBot = eyeY; eyeX0 = minX + 3; eyeX1 = maxX - 3; }
      for (y = eyeTop; y <= eyeBot + 1; y++) for (x = eyeX0; x <= eyeX1; x++) if (y >= 0 && y < 32 && x >= 0 && x < 32 && on[y * 32 + x]) eye[y * 32 + x] = 1; }
    if (sb && sb.eyeY != null && sb.eyeY >= 0 && !eyeN) { eyeY = sb.eyeY; eyeTop = sb.eyeY; eyeBot = sb.ey1 != null ? sb.ey1 : sb.eyeY; if (sb.eyeX0 != null) { eyeX0 = sb.eyeX0; eyeX1 = sb.eyeX1; } }
    function row(y0) { var l = 99, r = -1, n = 0; if (y0 < 0 || y0 > 31) return null; for (var x0 = 0; x0 < 32; x0++) if (on[y0 * 32 + x0]) { n++; if (x0 < l) l = x0; if (x0 > r) r = x0; } return n ? { l: l, r: r, w: r - l + 1 } : null; }
    var cx = eyeN ? sx / eyeN : (sb && sb.l != null ? (sb.l + sb.r) / 2 : (minX + maxX) / 2);
    var face = row(eyeY) || row(eyeTop) || { l: minX, r: maxX, w: maxX - minX + 1 };
    var left = cx - face.l, right = face.r - cx;
    if (right > left * 1.7 && left > 1) face = { l: face.l, r: Math.round(cx + left * 1.2), w: 0 }; 
    if (left > right * 1.7 && right > 1) face = { l: Math.round(cx - right * 1.2), r: face.r, w: 0 };
    face.l = Math.max(0, face.l); face.r = Math.min(31, face.r); face.w = face.r - face.l + 1;
    var skullTop = eyeY, y2;
    for (y2 = eyeY; y2 >= minY; y2--) { var rw = row(y2); if (!rw) break; var ov = !(rw.r < face.l || rw.l > face.r); if (!ov || rw.w < Math.max(3, face.w * 0.42)) break; skullTop = y2; }
    var wide = null; for (y2 = eyeBot + 1; y2 <= Math.min(31, eyeBot + 7); y2++) { var rb = row(y2); if (rb && (!wide || rb.w > wide.w)) wide = rb; }
    var stalks = !!(wide && face.w > 0 && wide.w > face.w * 1.7 && eyeTop <= minY + 2);
    var m = { bg: bg, on: on, eye: eye, minX: minX, maxX: maxX, minY: minY, maxY: maxY, eyeY: eyeY, eyeTop: eyeTop, eyeBot: eyeBot, eyeX0: eyeX0, eyeX1: eyeX1, cx: cx, l: face.l, r: face.r, skullTop: skullTop, top: minY, stalks: stalks, hairBottom: eyeY };
    if (sb && sb.skullTop != null && !sb.onlyEyes) { m.l = sb.l; m.r = sb.r; m.skullTop = sb.skullTop; m.top = Math.min(sb.top, minY); m.cx = (sb.l + sb.r) / 2; if (sb.eyeY != null && sb.eyeY >= 0) m.eyeY = sb.eyeY; }
    if (stalks && wide) { m.l = wide.l; m.r = wide.r; m.cx = (wide.l + wide.r) / 2; m.skullTop = eyeBot + 1; }
    return m;
  }
  function expandHair(d, m, fn) {
    if (!fn) return; var x, y, i, l = m.l, r = m.r, t = m.top, b = m.eyeY;
    for (y = 0; y < 32; y++) for (x = 0; x < 32; x++) { if (!m.on[y * 32 + x] || m.eye[y * 32 + x]) continue; m._x = x; var c = pix(d, x, y); if (isInk(c)) continue; if (!fn(c, y, m)) continue; if (x < l) l = x; if (x > r) r = x; if (y < t) t = y; if (y > b) b = y; }
    m.l = l; m.r = r; m.top = Math.min(m.top, t); m.hairBottom = b; m.cx = (l + r) / 2;
  }
  function inside(x, y, cx, cy, rx, ry) { if (rx < 0.8 || ry < 0.8) return false; var dx = x + 0.5 - cx, dy = y + 0.5 - cy; return (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1; }
  function put(d, x, y, c) { if (x < 0 || y < 0 || x > 31 || y > 31) return; var i = (y * 32 + x) * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255; }
  function layout(m, fit, gaps) {
    var span = Math.max(8, Math.min(28, Math.round((m.r - m.l + 1) * fit.w)));
    var eyeTop = m.eyeTop != null ? m.eyeTop : m.eyeY;
    var eyeBot = m.eyeBot != null && m.eyeBot >= 0 ? m.eyeBot : m.eyeY;
    var boost = fit.boost || 1.2, overlap = gaps ? -1 : 2;
    /* width of four circles = 4*rxS + 4*rxM - 3*overlap (left cap + gaps + right cap) */
    var rxM = (span + 3 * overlap) / (4 * boost + 4);
    var rxS = rxM * boost;
    if (rxM < 2) { rxM = 2; rxS = Math.max(2, 2 * boost); }
    var below = (fit.mode === 2 || m.stalks) && fit.mode !== 1;
    var seat = below ? (eyeBot + 1 + (fit.dy || 0) + rxM * 2) : Math.min(eyeTop - 1, m.skullTop + (fit.sink || 0)) + (fit.dy || 0);
    var room = below ? Math.max(4, 28 - (eyeBot + 1)) : Math.max(4, seat + 1);
    var maxR = room / 2;
    if (rxS > maxR) { var k = maxR / rxS; rxS *= k; rxM *= k; }
    rxS = Math.max(1.6, rxS); rxM = Math.max(1.6, rxM);
    var width = 4 * rxS + 4 * rxM - 3 * overlap;
    var left = m.cx + (fit.dx || 0) - width / 2;
    var xs = [left + rxS];
    xs.push(xs[0] + rxS + rxM - overlap);
    xs.push(xs[1] + rxM + rxM - overlap);
    xs.push(xs[2] + rxM + rxS - overlap);
    var rxs = [rxS, rxM, rxM, rxS];
    var hang = fit.hang || 0;
    var rys = [rxS + hang, rxM, rxM, rxS + hang];
    var cy = below ? (eyeBot + 1 + (fit.dy || 0) + rxM) : (seat - rxM);
    var cys = [cy + hang * 0.5, cy, cy, cy + hang * 0.5];
    if (fit.up && !below) { var want = m.top - (cy - rxM); if (want < -1) { var up = Math.min(rxM * 0.4, -want); cys = cys.map(function (v) { return v + up * 0; }); } }
    if (fit.drape && m.hairBottom > cy) { rys[0] = Math.max(rys[0], Math.min(m.hairBottom - cys[0], rxS + 4)); rys[3] = Math.max(rys[3], Math.min(m.hairBottom - cys[3], rxS + 4)); }
    var i, minX = 99, maxX = -99, minY = 99, maxY = -99;
    for (i = 0; i < 4; i++) { minX = Math.min(minX, xs[i] - rxs[i]); maxX = Math.max(maxX, xs[i] + rxs[i]); minY = Math.min(minY, cys[i] - rys[i]); maxY = Math.max(maxY, cys[i] + rys[i]); }
    var sx = 0, sy = 0;
    if (maxX - minX > 30) { var sh = 30 / (maxX - minX); for (i = 0; i < 4; i++) { rxs[i] *= sh; rys[i] *= sh; } minX = 99; maxX = -99; for (i = 0; i < 4; i++) { xs[i] = m.cx + (xs[i] - (m.cx + (fit.dx || 0))) * sh; minX = Math.min(minX, xs[i] - rxs[i]); maxX = Math.max(maxX, xs[i] + rxs[i]); } }
    if (minX < 0) sx = -minX; else if (maxX > 31) sx = 31 - maxX;
    if (minY < 0) sy = -minY;
    for (i = 0; i < 4; i++) { xs[i] += sx; cys[i] += sy; }
    return { xs: xs, cys: cys, rxs: rxs, rys: rys };
  }
  function nearest(x, y, wig, d) {
    var best = PUFF[0].b, bd = 99, r, yy, xx, i;
    for (r = 1; r <= 6 && bd > 8; r++) for (yy = y - r; yy <= y + r; yy++) for (xx = x - r; xx <= x + r; xx++) { if (xx < 0 || yy < 0 || xx > 31 || yy > 31) continue; i = yy * 32 + xx; if (!wig[i]) continue; var dd = Math.abs(xx - x) + Math.abs(yy - y); if (dd < bd) { bd = dd; best = pix(d, xx, yy); } }
    return best;
  }
  function paint(d, art, stage, frame, opts) {
    opts = opts || {}; var sp = spOf(art), fit = fitFor(sp, stage, opts.uniform), gaps = !!opts.gaps;
    var m = measure(d, art, stage, frame); if (!m) return null;
    var saved = []; var p, i; for (p = 0; p < 1024; p++) if (m.eye[p]) saved.push(p, d[p * 4], d[p * 4 + 1], d[p * 4 + 2]);
    if (fit.mode === 1 && !opts.uniform) expandHair(d, m, hairFn(fit.hair));
    var L = layout(m, fit, gaps), wig = new Uint8Array(1024), x, y;
    function stamp(ix) { var col = PUFF[ix]; for (y = 0; y < 32; y++) for (x = 0; x < 32; x++) { if (x >= 27 && y < 5) continue; if (!inside(x, y, L.xs[ix], L.cys[ix], L.rxs[ix], L.rys[ix])) continue; if (m.eye[y * 32 + x]) continue; var dx = x + 0.5 - L.xs[ix], dy = y + 0.5 - L.cys[ix], q = (dx * dx) / (L.rxs[ix] * L.rxs[ix]) + (dy * dy) / (L.rys[ix] * L.rys[ix]); var c = (dx < -0.2 && dy < -0.2 && q < 0.45) ? col.h : col.b; put(d, x, y, c); wig[y * 32 + x] = ix + 1; } }
    for (i = 0; i < 4; i++) stamp(i);
    var fn = !gaps && fit.mode === 1 ? hairFn(fit.hair) : null;
    if (fn) for (y = 0; y < 32; y++) for (x = 0; x < 32; x++) { i = y * 32 + x; if (!m.on[i] || m.eye[i] || wig[i]) continue; m._x = x; var c0 = pix(d, x, y); if (isInk(c0)) continue; if (!fn(c0, y, m)) continue; put(d, x, y, nearest(x, y, wig, d)); wig[i] = 5; }
    function sealRow() { var y0, x0, a, b; for (y0 = 0; y0 < 32; y0++) { a = -1; for (x0 = 0; x0 < 32; x0++) { if (wig[y0 * 32 + x0]) { if (a >= 0 && x0 - a > 1) { for (b = a + 1; b < x0; b++) { if (b >= 27 && y0 < 5) continue; var c = pix(d, b, y0); if (!isBg(c, m.bg)) continue; put(d, b, y0, nearest(b, y0, wig, d)); wig[y0 * 32 + b] = 5; } } a = x0; } } } }
    if (!gaps) { sealRow(); sealRow(); }
    if (!gaps) { var edge = []; for (y = 0; y < 32; y++) for (x = 0; x < 32; x++) { if (!wig[y * 32 + x]) continue; [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (q) { var X = x + q[0], Y = y + q[1]; if (X < 0 || Y < 0 || X > 31 || Y > 31 || wig[Y * 32 + X]) return; if (X >= 27 && Y < 5) return; var c3 = pix(d, X, Y); if (!isBg(c3, m.bg)) return; edge.push(Y * 32 + X); }); } edge.forEach(function (p) { if (wig[p]) return; var x0 = p % 32, y0 = (p / 32) | 0, nW = 0; [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(function (q) { var X = x0 + q[0], Y = y0 + q[1]; if (X >= 0 && Y >= 0 && X < 32 && Y < 32 && wig[Y * 32 + X]) nW++; }); if (nW >= 2) { put(d, x0, y0, nearest(x0, y0, wig, d)); wig[p] = 5; } else put(d, x0, y0, INK); });
      for (y = 0; y < 32; y++) for (x = 1; x < 31; x++) { i = y * 32 + x; var c4 = pix(d, x, y); if (dist(c4, INK) > 12) continue; var Lft = 0, Rgt = 0, t; for (t = x - 1; t >= 0 && t >= x - 4; t--) { var cl = pix(d, t, y); if (isPuff(cl)) { Lft = 1; break; } if (isBg(cl, m.bg)) break; } for (t = x + 1; t < 32 && t <= x + 4; t++) { var cr = pix(d, t, y); if (isPuff(cr)) { Rgt = 1; break; } if (isBg(cr, m.bg)) break; } if (Lft && Rgt) { put(d, x, y, nearest(x, y, wig, d)); wig[i] = 5; } } }
    for (i = 0; i < saved.length; i += 4) { var q = saved[i] * 4; d[q] = saved[i + 1]; d[q + 1] = saved[i + 2]; d[q + 2] = saved[i + 3]; }
    var nr = Math.max(1, fit.noseR | 0), nx = Math.round(m.cx + (fit.noseDx || 0)), ny = (fit.mode === 2 || m.stalks) ? (m.eyeBot + 2) : (m.eyeY + (fit.noseDy || 3));
    var guard = 0; while (guard++ < 6 && (nx < 0 || nx > 31 || ny < 0 || ny > 31 || (!m.on[ny * 32 + nx] && !wig[ny * 32 + nx]))) { nx += nx < m.cx ? 1 : -1; }
    for (y = ny - nr - 1; y <= ny + nr + 1; y++) for (x = nx - nr - 1; x <= nx + nr + 1; x++) { if (!inside(x, y, nx, ny, nr + 0.15, nr + 0.15)) continue; if (y < 0 || x < 0 || x > 31 || y > 31 || m.eye[y * 32 + x]) continue; var dx = x + 0.5 - nx, dy = y + 0.5 - ny, el = (dx * dx + dy * dy) / ((nr + 0.15) * (nr + 0.15)); var nc = el > 0.72 ? NOSE.d : (dx < -0.2 && dy < -0.2 && el < 0.35 ? NOSE.h : NOSE.b); put(d, x, y, nc); wig[y * 32 + x] = 4; }
    if (!gaps) { for (y = 0; y < 32; y++) { var prev = -1; for (x = 0; x < 32; x++) { i = y * 32 + x; if (wig[i]) { if (prev >= 0 && x - prev > 1) { for (var b = prev + 1; b < x; b++) { if (!isBg(pix(d, b, y), m.bg)) continue; put(d, b, y, nearest(b, y, wig, d)); wig[y * 32 + b] = 5; } } prev = x; } } } }
    return { sp: sp, fit: fit, m: m, wig: wig };
  }
  function apply(frames, art, stage, opts) {
    return (frames || []).map(function (img, f) { var src = img && img.data; if (!src || src.length < 4096) return img; var data = new Uint8ClampedArray(src.length); data.set(src); paint(data, art, stage | 0, f, opts); return Object.assign({}, img, { data: data }); });
  }
  function isPuff(c) { return near(c, '#e8a810', 42) || near(c, '#20b030', 42) || near(c, '#245ce4', 46) || near(c, '#d61c24', 40) || near(c, '#ffe478', 36) || near(c, '#96f078', 40) || near(c, '#8cbaff', 40) || near(c, '#ff8074', 36); }
  function problems(data, bg) {
    var out = [], x, y, i, gaps = 0, puff = 0;
    var wig = new Uint8Array(1024);
    for (i = 0; i < 1024; i++) { var c = [data[i * 4], data[i * 4 + 1], data[i * 4 + 2]]; if (isPuff(c)) { wig[i] = 1; puff++; } }
    for (y = 0; y < 32; y++) for (x = 1; x < 31; x++) { i = y * 32 + x; if (wig[i]) continue; var c2 = [data[i * 4], data[i * 4 + 1], data[i * 4 + 2]]; if (!isBg(c2, bg)) continue; if (wig[i - 1] && wig[i + 1]) gaps++; }
    if (gaps) out.push('gaps ' + gaps);
    if (puff < 18) out.push('thin ' + puff);
    return out;
  }
  return { ID: ID, apply: apply, paint: paint, fitFor: fitFor, measure: measure, problems: problems, SPEC: SPEC };
});
