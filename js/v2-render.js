/* XCPETS v2 shared rendering (every page): pet frames with v2 gear, STANDALONE 8-bit gear icons, and the
 * click-to-equip gear picker. LOCAL ONLY: no network. Needs PetCore, BonusGear, V2Gear, V2Rules. */
(function () {
  'use strict';
  var V = window.V2Rules;
  V2Gear.install(BonusGear);
  BonusGear.DEFS['v2-black-eye'] = BonusGear.DEFS['v2-black-eye'] || { slot: 'face', tier: 0, label: 'Black eye', at: 'eyes', map: ['VV.......', 'VnV......', '.VV......'] };
  /* black eye fit (2026-10-15, Jake: on Dodo it sat on the back of the head): traced on the real eye pixels of this species/stage/frame (drawEyeGear 'shiner'),
   * a bruise ring around the viewer-right eye, like eyewear; the old fixed 'eyes'-anchor map is only the fallback when no eye can be found. */
  BonusGear.DEFS['v2-black-eye'].v2eye = { s: 'shiner' };
  BonusGear.DEFS['v2-rumble-crown'] = BonusGear.DEFS['v2-rumble-crown'] || { slot: 'head', tier: 3, label: 'Rumble crown', at: 'head', dy: -1, map: ['y.y.y', 'yyyyy', 'yQyQy'] };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  /* Unfreeze hotfix (2026-10-14): with thousands of pets the old 300 ms tick repainted EVERY animated canvas (on screen or not, allocating a
   * new ImageData each time) and animate() re-filtered the whole list per canvas (O(n^2) on render). Now: ImageData cached per frame,
   * animate() is O(1) (Map), and the tick only repaints canvases that are connected AND on screen (IntersectionObserver), never when the tab is hidden. */
  var idCache = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
  function imgOf(img) { var d = idCache && idCache.get(img); if (!d) { d = new ImageData(new Uint8ClampedArray(img.data), 32, 32); if (idCache && img && typeof img === 'object') idCache.set(img, d); } return d; }
  function paint(c, img) { c.getContext('2d').putImageData(imgOf(img), 0, 0); }
  var animated = new Map(), seen = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(function (es) { es.forEach(function (e) { var a = animated.get(e.target); if (a) a.vis = e.isIntersecting; }); }) : null;
  setInterval(function () { if (typeof document !== 'undefined' && document.hidden) return;
    animated.forEach(function (a, c) { if (!c.isConnected) { animated.delete(c); if (seen) seen.unobserve(c); return; } if (seen && !a.vis) return; a.f = (a.f + 1) % a.fr.length; paint(c, a.fr[a.f]); }); }, 300);
  function animate(c, fr) { paint(c, fr[0]); if (fr.length > 1) { var o = animated.get(c); animated.set(c, { fr: fr, f: 0, vis: o ? o.vis : !seen }); if (seen && !o) seen.observe(c); } else if (animated.has(c)) { animated.delete(c); if (seen) seen.unobserve(c); } return c; }

  // ---------------------------------------------------------------- v2 face spots (2026-10-14): nose + mouth found on the ACTUAL bare sprite
  /** faceSpots(bareImg, a) -> { ey, ex, nose:{x0,x1,y0,y1}|null, mouth:{x,y,src} }. bareImg = the gear-less render on the magenta key; a = BonusGear.anchors().
   * mouth: first row under the eyes with >= 2 mouth-pink (#e04060) silhouette pixels near the face centre; else the first dark run (>= 3 px)
   * under the eyes / nose; else a per-species fallback. nose: dark (#1a1020) pixels between the eyes and the row above the mouth, near the centre. */
  var FACE_FALLBACK = { /* rows below the eye line when nothing is detected (eyeless poses, beaks, masks) */ dodo: { nose: 2, mouth: 4 }, wojak: { nose: 3, mouth: 5 }, chud: { nose: 3, mouth: 5 } };
  function faceSpots(img, a, species) {
    var d = img.data, px = function (x, y) { var i = (y * 32 + x) * 4; return [d[i], d[i + 1], d[i + 2]]; };
    var isC = function (x, y, c) { if (x < 0 || y < 0 || x > 31 || y > 31 || !a.isSil(x, y)) return false; var p = px(x, y); return Math.abs(p[0] - c[0]) + Math.abs(p[1] - c[1]) + Math.abs(p[2] - c[2]) < 24; };
    var PINK = [0xe0, 0x40, 0x60], INK = [0x1a, 0x10, 0x20], eL = a.eyeL, eR = a.eyeR, ey, ex, eyePx = {};
    [eL, eR].forEach(function (e) { if (e) e[2].forEach(function (q) { eyePx[q[0] + ',' + q[1]] = 1; }); });
    if (eL && eR) { ey = Math.round((eL[1] + eR[1]) / 2); ex = (eL[0] + eR[0]) / 2; }
    else if (eL || eR) { var e1 = eL || eR; ey = e1[1]; ex = e1[0] + (e1[0] < 16 ? 3 : -3); }
    else { ey = a.minY + Math.round((a.maxY - a.minY) * 0.35); ex = (a.minX + a.maxX) / 2; }
    var fb = FACE_FALLBACK[species] || { nose: 3, mouth: 5 }, mouth = null, nose = null, x, y;
    for (y = ey + 2; y <= Math.min(28, ey + 12) && !mouth; y++) { var xs = []; for (x = Math.round(ex - 7); x <= Math.round(ex + 7); x++) if (isC(x, y, PINK)) xs.push(x);
      if (xs.length >= 2) mouth = { x: Math.round(xs.reduce(function (s, v) { return s + v; }, 0) / xs.length), y: y, src: 'pink' }; }
    function noseIn(y0, y1) { var b = null; for (var yy = y0; yy <= y1; yy++) for (var xx = Math.round(ex - 3); xx <= Math.round(ex + 3); xx++) if (isC(xx, yy, INK) && !eyePx[xx + ',' + yy] && a.isSil(xx - 1, yy) && a.isSil(xx + 1, yy) && a.isSil(xx, yy - 1) && a.isSil(xx, yy + 1)) { /* interior dark pixels only (not the outline) */
      b = b || { x0: 99, x1: -1, y0: 99, y1: -1 }; b.x0 = Math.min(b.x0, xx); b.x1 = Math.max(b.x1, xx); b.y0 = Math.min(b.y0, yy); b.y1 = Math.max(b.y1, yy); } return b; }
    if (mouth) nose = noseIn(ey + 2, mouth.y - 2);
    else { // no pink: mouth = first dark run >= 3 under the eyes; anything dark above it (and below the eyes) is the nose
      // dark runs (>= 3 px) under the eyes, grouped by touching rows: one group = the mouth line; two or more = nose (first) + mouth (last; e.g. Bobo)
      var runs = [], yMax = Math.min(28, ey + Math.max(5, Math.round((a.maxY - a.minY) * 0.3))); // stay on the face (not the body / feet lines)
      for (y = ey + 2; y <= yMax; y++) { var run = 0, best = null; for (x = Math.round(ex - 6); x <= Math.round(ex + 6) + 1; x++) { if (isC(x, y, INK) && !eyePx[x + ',' + y]) { run++; if (run >= 3) best = [x - run + 1, x]; } else run = 0; }
        if (best) runs.push({ y: y, x0: best[0], x1: best[1] }); }
      var groups = []; runs.forEach(function (r) { var g = groups[groups.length - 1]; if (g && r.y - g[g.length - 1].y <= 1) g.push(r); else groups.push([r]); });
      groups = groups.slice(0, 3);
      if (groups.length) { var mg = groups.length > 1 ? groups[groups.length - 1] : groups[0], mr = mg[0]; mouth = { x: Math.round((mr.x0 + mr.x1) / 2), y: mr.y, src: groups.length > 1 ? 'line+nose' : 'line' }; }
      if (mouth) nose = noseIn(ey + 2, mouth.y - 2);
      if (!mouth) mouth = { x: Math.round(ex), y: Math.min(28, ey + fb.mouth), src: 'fallback' }; }
    if (species === 'dodo' && (eL || eR)) { // beak = the dodo's nose: red pixels just right of the eye; the ring goes through the beak's upper edge
      var ee = eR || eL, bk = null; for (y = ee[1] - 1; y <= ee[1] + 3; y++) for (x = ee[0] + 1; x < 32; x++) { if (!a.isSil(x, y)) continue; var q = px(x, y); if (q[0] >= 0xa0 && q[1] < 0x70 && q[2] < 0x70) {
        bk = bk || { x0: 99, x1: -1, y0: 99, y1: -1 }; bk.x0 = Math.min(bk.x0, x); bk.x1 = Math.max(bk.x1, x); bk.y0 = Math.min(bk.y0, y); bk.y1 = Math.max(bk.y1, y); } }
      if (bk) { nose = bk; nose.beak = true; ex = bk.x1 - 3; if (mouth.y <= bk.y1 + 1) mouth = { x: Math.round((bk.x0 + bk.x1) / 2), y: bk.y1 + 1, src: 'beak' }; } }
    return { ey: ey, ex: ex, nose: nose, mouth: mouth, fallbackNoseY: Math.min(mouth.y - 2, ey + fb.nose) };
  }
  /** fit audit 2026-10-14 (v2 only; bonus-gear.js untouched): keep held/hat maps inside the 32x32 canvas. Hands sit at armor row + 2, which pushes tall
   * held pieces off the bottom on bottom-heavy sprites (Wojak, KEVIN...); tall hats on big Mythic heads poke off the top. We hand BonusGear.apply a view of
   * the anchors that lifts the hand row / lowers the head top just enough. */
  /* core pieces redrawn v2-side (2026-10-14, Jake; pet-core / token art untouched): drawn as v2 overlays on the detected head instead of pet-core's crown map.
   * Laurel wreath: two leafy green branches (paired leaves, light M / dark m) curving up round the crown, open at the top, tied with a gold knot at the front. */
  var CORE_OVERLAY = { laurel: { slot: 'crown', tier: 0, label: 'Laurel wreath', at: 'head', dy: 4, v2core: true,
    map: ['.M.........M.', 'Mm.........mM', 'mM.........Mm', 'Mm.........mM', '.mM.......Mm.', '..mMm.g.mMm..'] } };
  var HAT_SIT = { 'pimp-hat': 1, 'hard-hat': 2, 'mcd-visor': 1, 'based-cap': 1, 'short-hat': 1, 'moon-cap': 1, 'shell-helm': 2, 'bino-hat': 1, 'party-hat': 1, 'smug-cap': 1,
    'v2-wojak-hat': 1, 'v2-chud-hat': 1, 'v2-bobo-hat': 1, 'v2-mumu-hat': 1, 'v2-snibby-hat': 1, 'v2-dodo-hat': 1, 'v2-kevin-hat': 1, 'v2-doge-hat': 1, 'v2-sarutobi-hat': 1, 'v2-lenny-hat': 1, 'v2-peepo-hat': 1 };
  function fitAnchors(id, a) { var d = BonusGear.DEFS[id]; if (!d || !d.map || !d.map.length || !a) return a; var h = d.map.length;
    if (d.at === 'handR' || d.at === 'handL') { var r0 = a.row, row = function (r) { var y = r0(r); return r === a.gear.armor[0] ? Math.min(y, 32 - h + Math.floor(h / 2) - 2) : y; };
      // the hand sits at the body's edge on the rows the piece covers (not the widest point of the sprite, e.g. Dodo's beak), so it never floats in the air
      var hy = row(a.gear.armor[0]) + 2, y0, mx = -1, mn = 99, x, y;
      /* gear-fit 2026-10-16 (owner approved): Nakamoto's bust-style body (Hatchling-Adult only) ends above the armour row, so low held pieces hung below it;
       * keep the held piece's bottom on the body's lowest rows. */
      if (a.spId === 'nakamoto' && a.stage >= 1 && a.stage <= 3 && hy + Math.ceil(h / 2) > a.maxY) { var hy2 = Math.max(a.minY + h, a.maxY - Math.ceil(h / 2)); row = (function (r1, d1) { return function (r) { return r === a.gear.armor[0] ? r1(r) - d1 : r1(r); }; })(row, hy - hy2); hy = hy2; }
      y0 = hy - Math.floor(h / 2);
      for (y = Math.max(0, y0); y < Math.min(a.maxY - 1, y0 + h); y++) for (x = 0; x < 32; x++) if (a.isSil(x, y)) { mx = Math.max(mx, x); mn = Math.min(mn, x); }
      var v = Object.assign({}, a, { row: row }); if (mx >= 0 && d.at === 'handR' && mx < a.maxX - 1) v.maxX = mx + 1; if (mn < 99 && d.at === 'handL' && mn > a.minX + 1) v.minX = mn - 1; return v; }
    if (d.at === 'tallR') { var tm = -1, ty; for (ty = 28 - h; ty < Math.min(a.maxY - 1, 28); ty++) for (var tx = 0; tx < 32; tx++) if (a.isSil(tx, ty)) tm = Math.max(tm, tx);
      if (tm >= 0 && tm < a.maxX - 1) return Object.assign({}, a, { maxX: tm + 1 }); }
    if (d.at === 'head' && HAT_SIT[id] != null) { /* hat-height pass 2026-10-14 (Jake): brimmed / cone / cap hats rest ON the head: the brim row sits HAT_SIT[id] rows into
       * the topmost silhouette pixel under the hat's bottom-row columns (dy used to sink them into the head, e.g. Pepe's hat between his eyes). Crowns, headsets,
       * bands and the snug beanie are untouched. The view keeps the hat's horizontal centre (headCx reads isSil at minY+1..3, so isSil is shifted with minY). */
      var hcx = 16, sx0 = 0, n0 = 0, yy, xx; for (yy = a.minY + 1; yy <= a.minY + 3; yy++) for (xx = 0; xx < 32; xx++) if (a.isSil(xx, yy)) { sx0 += xx; n0++; } if (n0) hcx = Math.round(sx0 / n0) + 0.5;
      var w = d.map[0].length, hx0 = Math.floor(hcx - w / 2), last = d.map[h - 1], crown = 99;
      for (xx = 0; xx < w; xx++) if (last[xx] !== '.') for (yy = 0; yy < 32; yy++) if (a.isSil(hx0 + xx, yy)) { crown = Math.min(crown, yy); break; }
      var k = crown < 99 ? a.minY + (d.dy || 0) - (crown + HAT_SIT[id]) : 0, base = a.minYTop != null ? a.minYTop : a.minY; if (k < 0) k = 0;
      var t2 = base - k - h + 1 + (d.dy || 0); if (t2 < 0) k += t2; /* never off the top (constant across frames) */
      if (k > 0) { var src = a; return Object.assign({}, a, { minY: a.minY - k, isSil: function (x2, y2) { return src.isSil(x2, y2 + k); } }); } }
    if (d.at === 'head') { /* hat-bob fix 2026-10-14: clamp from the highest head top across the animation (a.minYTop) so the shift is constant and tall hats bob with the head */ var top = (a.minYTop != null ? a.minYTop : a.minY) - h + 1 + (d.dy || 0); if (top < 0) return Object.assign({}, a, { minY: a.minY - top }); }
    return a; }
  /** where a v2 face piece goes: 'v2mouth' (grill: centred on the mouth row, never above the nose) / 'v2nose' (hoop through the nose's right edge). */
  function facePos(at, map, sp) {
    var w = map[0].length, h = map.length, n = sp.nose, m = sp.mouth;
    if (at === 'v2mouth') return [m.x - Math.floor(w / 2), Math.max(m.y, n ? n.y1 + 1 : 0)];
    // polish pass: septum pieces hang from the nose bottom (centred on the nose); a stud sits on the nose's right edge; the cig's bottom row is the mouth row, starting at the mouth
    var noM = !n && m && m.src !== 'fallback', ncx = n ? Math.round((n.x0 + n.x1) / 2) : noM ? m.x : Math.round(sp.ex), nyb = n ? n.y1 : noM ? m.y - 2 : sp.fallbackNoseY; /* redraw-3 2026-10-14 (Jake): no detected nose (Doge, Nakamoto) -> the nose sits just above the mouth */
    if (at === 'v2septum') return [ncx - Math.floor(w / 2), Math.max(n ? n.y0 : 0, Math.min(nyb, m.y - h))]; /* redraw-3: the hoop's bottom row stays ABOVE the mouth row (it used to hang over the mouth on Wojak/Chud) */
    if (at === 'v2stud') { var r = map.map(function (row) { return row.replace(/\.+$/, '').length; }), rw = Math.max.apply(null, r); return [(n ? n.x1 : Math.round(sp.ex) + 1) - rw + 1, n ? n.y0 : nyb - 1]; }
    if (at === 'v2cig') return [m.x, m.y - h + 1];
    // nose ring: hoop hooked through the nose's right edge, bottom row level with the nose bottom (+1), never down into the mouth row
    var x = n && n.beak ? n.x1 - 1 : n ? Math.min(n.x1, Math.round(sp.ex) + 3) : noM ? m.x + 1 : Math.round(sp.ex) + 1, yb = n ? n.y1 : noM ? m.y - 1 : sp.fallbackNoseY + 1; /* redraw-3: hoop bottom = nose bottom row (was +1, touching the mouth) */
    yb = Math.min(yb, m.y - 1); return [x, yb - h + 1];
  }
  /** drawFace: paints only on face pixels (inside the silhouette, never over the eyes): a piece can never float off the head or blind the pet. */
  /* face polish 2026-10-14 (Jake): the Gold grill spans the WHOLE detected mouth (corner to corner on the mouth row), teeth gG.. on top, solid gold below. */
  function mouthSpan(img, sp, a) { var d = img.data, m = sp.mouth, y = m.y, px = function (x) { var i = (y * 32 + x) * 4; return [d[i], d[i + 1], d[i + 2]]; };
    var isM = function (x) { if (x < 0 || x > 31 || !a.isSil(x, y)) return false; var c = px(x); return (c[0] > 0xc0 && c[1] < 0x70 && c[2] > 0x40 && c[2] < 0x90) || (c[0] + c[1] + c[2] < 0x70) || (c[0] > 0xa0 && c[1] < 0x50 && c[2] < 0x50); };
    var x0 = m.x, x1 = m.x; if (!isM(m.x)) return null; while (isM(x0 - 1) && a.isSil(x0 - 2, y)) x0--; while (isM(x1 + 1) && a.isSil(x1 + 2, y)) x1++; return x1 - x0 >= 2 ? [x0, x1] : null; }
  function drawFace(id, img, sp, a) { var d = typeof id === 'string' ? BonusGear.DEFS[id] : id;
    if (id === 'v2-gold-grill' && a) { var ms = mouthSpan(img, sp, a); if (ms) { var tw = ms[1] - ms[0] + 1, t0 = '', t1 = ''; for (var ti = 0; ti < tw; ti++) { t0 += ti % 2 ? 'G' : 'g'; t1 += 'g'; } d = Object.assign({}, d, { map: [t0, t1] }); sp = Object.assign({}, sp, { mouth: Object.assign({}, sp.mouth, { x: ms[0] + Math.floor(tw / 2) }) }); } }
    var p = facePos(d.at, d.map, sp), C = BonusGear.COLORS, eye = {}, painted = 0;
    if (a) [a.eyeL, a.eyeR].forEach(function (e) { if (e) e[2].forEach(function (q) { eye[q[0] + ',' + q[1]] = 1; }); });
    /* stud fallback (2026-10-16): if the stud would paint nothing (e.g. Nakamoto Juvenile: no nose, the spot lands on his glasses/eye row),
     * put it one row under the eye line, beside the centre of the mouth (the nose spot). Only used when the normal spot paints nothing. */
    for (var pass = 0; pass < 2; pass++) { if (pass === 1) { if (painted || d.at !== 'v2stud' || !sp.mouth) break; p = [Math.round(sp.mouth.x) + 1, Math.max((sp.ey || 0) + 1, sp.mouth.y - 2)]; }
    d.map.forEach(function (row, j) { for (var i = 0; i < row.length; i++) { var k = row[i]; if (k === '.') continue; var x = p[0] + i, y = p[1] + j; if (x < 0 || y < 0 || x > 31 || y > 31) continue;
      if (a && ((!d.free && !a.isSil(x, y)) || eye[x + ',' + y])) continue; if (/^v2(septum|nose)$/.test(d.at) && sp.mouth && y >= sp.mouth.y) continue; /* redraw-3: nose rings never paint on/below the mouth row */ /* d.free (the cig): may stick out past the face, still never over an eye */
      var c = C[k].replace('#', ''), q = (y * 32 + x) * 4; img.data[q] = parseInt(c.slice(0, 2), 16); img.data[q + 1] = parseInt(c.slice(2, 4), 16); img.data[q + 2] = parseInt(c.slice(4, 6), 16); painted++; } }); }
    return p; }
  /* mouth-held pieces (Fetch Stick, id 'stick', 2026-10-16, owner approved): the map's longest row lies ON the detected mouth row, centred on the mouth (faceSpots: pink
   * lips, dark mouth line, or the fallback rows). Dodo: the stick is held in the beak corner (beak bottom row, starting at the beak's face-side edge).
   * Never paints over the eyes; clipped to the canvas. Replaces BonusGear's fixed 'eye line + 4' spot (bonus-gear.js untouched). */
  function drawMouthHeld(d, img, sp, a) { var m = d.map, w = m[0].length, C = BonusGear.COLORS, eye = {}, main = 0, best = -1;
    m.forEach(function (row, j) { var n = row.replace(/\./g, '').length; if (n > best) { best = n; main = j; } });
    [a.eyeL, a.eyeR].forEach(function (e) { if (e) e[2].forEach(function (q) { eye[q[0] + ',' + q[1]] = 1; }); });
    var my = sp.mouth ? sp.mouth.y : sp.ey + 4, mx = sp.mouth ? sp.mouth.x : Math.round(sp.ex);
    if (sp.nose && sp.nose.beak) { my = sp.nose.y1; mx = sp.nose.x0 + Math.floor(w / 2) - 1; }
    var x0 = Math.max(0, Math.min(32 - w, mx - Math.floor(w / 2) + (d.dx || 0))), y0 = my - main;
    m.forEach(function (row, j) { for (var i = 0; i < row.length; i++) { var k = row[i]; if (k === '.' || !C[k]) continue; var x = x0 + i, y = y0 + j; if (x < 0 || y < 0 || x > 31 || y > 31 || eye[x + ',' + y]) continue;
      var c = C[k].replace('#', ''), q = (y * 32 + x) * 4; img.data[q] = parseInt(c.slice(0, 2), 16); img.data[q + 1] = parseInt(c.slice(2, 4), 16); img.data[q + 2] = parseInt(c.slice(4, 6), 16); img.data[q + 3] = 255; } }); }
  /* eye anchors (2026-10-16): stages whose expression closes the eyes (Wojak/Chud Mythic, Mumu Adult...) left eye gear (Beam eyes) with no anchor;
   * if the star-eye pass finds no eye pixels, re-render it with the eyes open (render option openEyes) so the piece knows where the eyes are. */
  function eyeRender(eyes, o) { var r = PetCore.render(eyes, o), d = r.data;
    for (var i = 0; i < d.length; i += 4) if (d[i] === 255 && (d[i + 1] === 210 && d[i + 2] === 63 || d[i + 1] === 241 && d[i + 2] === 168)) return r;
    return PetCore.render(eyes, Object.assign({}, o, { openEyes: true })); }
  function isV2Face(id) { var d = BonusGear.DEFS[id]; return !!(d && /^v2(nose|mouth|septum|stud|cig)$/.test(d.at)); }
  /** eye-gear fit (2026-10-14, v2 only): draw glasses / mask / eye bags around the detected eyes (BonusGear star-eye pixels) so they track every
   * species, stage and pose. Lenses cover the eye box, frame rims it, bridge joins the lenses, arms run to the head edge. Eyeless poses fall back to the map. */
  function drawEyeGear(img, a, d, sp) { var g = d.v2eye, C = BonusGear.COLORS, D = img.data, E = [a.eyeL, a.eyeR].filter(Boolean);
    if (!E.length && g.s === 'bags') { // closed (^ ^) eyes: bags go one row under the first dark interior marks on each side of the face
      var ink = function (x, y) { var q = (y * 32 + x) * 4; return a.isSil(x - 1, y) && a.isSil(x + 1, y) && D[q] + D[q + 1] + D[q + 2] < 200; }, cxm = (a.minX + a.maxX) / 2, done = 0;
      [-1, 1].forEach(function (sd) { for (var yy = a.minY + 3; yy < a.minY + Math.round((a.maxY - a.minY) * 0.6); yy++) { var xs = []; for (var xx = 0; xx < 32; xx++) if ((xx - cxm) * sd > 0 && ink(xx, yy)) xs.push(xx); if (xs.length) { var yb = yy; while (xs.some(function (v) { return ink(v, yb + 1) || ink(v - 1, yb + 1) || ink(v + 1, yb + 1); })) yb++; for (var k = Math.min.apply(null, xs); k <= Math.max.apply(null, xs); k++) put(k, yb + 2, g.f); done++; return; } } });
      return done ? true : false; }
    /* eyewear fix 2026-10-14 (Jake): Wojak + Chud. Their eyes are small dark dots low on a tall head, and some poses (Wojak s2/s5, Chud s5) give no
     * star-eye anchors, so the generic guess (head top + 5) put glasses on the forehead. For these two, find the eyes as the first row (from 40% of
     * the head height down) with dark marks on BOTH sides of the face centre, and box them. */
    var spid = a.spId || (sp && sp.id), FIT2 = spid === 'wojak' || spid === 'chud', dk = function (x2, y2) { if (!a.isSil(x2, y2)) return false; var q = (y2 * 32 + x2) * 4; return D[q] + D[q + 1] + D[q + 2] < 150; };
    if (!E.length && FIT2 && g.s !== 'bags') { var cxm2 = Math.round((a.minX + a.maxX) / 2), y2;
      for (y2 = a.minY + Math.round((a.maxY - a.minY) * 0.4); y2 < a.minY + Math.round((a.maxY - a.minY) * 0.7); y2++) {
        var Ls = [], Rs = []; for (var x3 = a.minX + 2; x3 <= a.maxX - 2; x3++) if (dk(x3, y2) && a.isSil(x3 - 1, y2) && a.isSil(x3 + 1, y2)) (x3 < cxm2 ? Ls : Rs).push([x3, y2]);
        var run = function (L2) { var m = 0, r2 = 0; L2.forEach(function (q, k2) { r2 = k2 && q[0] === L2[k2 - 1][0] + 1 ? r2 + 1 : 1; m = Math.max(m, r2); }); return m; }; // eye dots, not a glasses frame / brow line
        if (Ls.length && Rs.length && run(Ls) <= 3 && run(Rs) <= 3) { E = [[0, y2, Ls], [0, y2, Rs]]; break; } } }
    if (!E.length) { // eyeless pose (closed / ^^ eyes): two lens boxes guessed from the head width at the usual eye row
      var gy = Math.min(a.minY + 5, a.minY + Math.round((a.maxY - a.minY) * 0.3)), lo = 99, hi = -1, gx; for (gx = 0; gx < 32; gx++) if (a.isSil(gx, gy)) { lo = Math.min(lo, gx); hi = Math.max(hi, gx); } if (hi < 0) return false;
      var hw = hi - lo + 1, lw = Math.max(2, Math.round(hw * 0.22)), mid = (lo + hi) / 2, gap = Math.max(1, Math.round(hw * 0.08)), px = []; [Math.floor(mid - gap / 2) - lw + 1, Math.ceil(mid + gap / 2)].forEach(function (x0) { for (var i = 0; i < lw; i++) { px.push([x0 + i, gy]); px.push([x0 + i, gy + 1]); } });
      E = [[0, gy, px.slice(0, lw * 2)], [0, gy, px.slice(lw * 2)]]; }
    function put(x, y, k) { if (!k || x < 0 || y < 0 || x > 31 || y > 31 || !a.isSil(x, y)) return; var c = C[k].replace('#', ''), q = (y * 32 + x) * 4; D[q] = parseInt(c.slice(0, 2), 16); D[q + 1] = parseInt(c.slice(2, 4), 16); D[q + 2] = parseInt(c.slice(4, 6), 16); }
    var B = E.map(function (e) { var b = { x0: 99, x1: -1, y0: 99, y1: -1 }; e[2].forEach(function (q) { b.x0 = Math.min(b.x0, q[0]); b.x1 = Math.max(b.x1, q[0]); b.y0 = Math.min(b.y0, q[1]); b.y1 = Math.max(b.y1, q[1]); }); return b; }).sort(function (p, q) { return p.x0 - q.x0; });
    var x, y, eyeAt = {}; if (a.eyeL || a.eyeR) E.forEach(function (e) { e[2].forEach(function (q) { eyeAt[q[0] + ',' + q[1]] = 1; }); });
    if (g.s === 'shiner') { var sb = B[B.length - 1]; /* bruise ring hugging the eye box: dark purple, deeper under the eye; the eye pixels themselves stay */
      for (y = sb.y0 - 1; y <= sb.y1 + 1; y++) for (x = sb.x0 - 1; x <= sb.x1 + 1; x++) { if (eyeAt[x + ',' + y] || (x >= sb.x0 && x <= sb.x1 && y >= sb.y0 && y <= sb.y1)) continue; put(x, y, y === sb.y1 + 1 ? 'n' : 'V'); }
      for (x = sb.x0; x <= sb.x1; x++) if (!eyeAt[x + ',' + (sb.y1 + 2)]) put(x, sb.y1 + 2, 'V'); return; }
    if (g.s === 'bags') { B.forEach(function (b) { for (x = b.x0; x <= b.x1; x++) put(x, b.y1 + 1, g.f); }); return; }
    var ecy = Math.round(E.reduce(function (t, e) { return t + e[1]; }, 0) / E.length), top = Math.max(ecy - 1, Math.min.apply(null, B.map(function (b) { return b.y0; }))) - (g.up || 0), bot = Math.min(ecy + 1, Math.max.apply(null, B.map(function (b) { return b.y1; }))) + (g.drop || 0); // lenses stay on the eye line (tall eyes, e.g. Peepo, are not boxed whole)
    if (spid === 'chud' && (g.s === 'glasses' || g.s === 'visor')) { /* Chud's built-in dark-framed glasses: equipped eyewear covers them whole (no double frame) */
      var bx0 = B[0].x0, bx1 = B[B.length - 1].x1, cx2 = Math.round((bx0 + bx1) / 2), rowDark = function (yy) { var n2 = 0; for (var xx = bx0; xx <= bx1; xx++) if (dk(xx, yy)) n2++; return n2 >= (bx1 - bx0 + 1) * 0.5; };
      while (top - 1 > a.minY && rowDark(top - 1) && ecy - top < 2) top--; while (bot + 1 < a.maxY && rowDark(bot + 1) && bot - ecy < 3) bot++;
      if (bot - top < 2) bot = Math.min(bot + 1, ecy + 2);
      B.forEach(function (b, n) { if (n === 0) { while (b.x0 - 1 > a.minX && dk(b.x0 - 1, ecy - 1)) b.x0--; } else { while (b.x1 + 1 < a.maxX && dk(b.x1 + 1, ecy - 1)) b.x1++; } }); }
    if (FIT2 && B.length === 2) { /* Wojak + Chud (Jake 2026-10-14): both lenses exactly the same size, each centred on its own eye */
      var cxs = E.slice().sort(function (p, q) { return p[2][0][0] - q[2][0][0]; }).map(function (e) { var xs = e[2].map(function (q) { return q[0]; }); return (Math.min.apply(null, xs) + Math.max.apply(null, xs)) / 2; }),
        lw2 = Math.max(B[0].x1 - B[0].x0 + 1, B[1].x1 - B[1].x0 + 1);
      if (spid === 'wojak' && lw2 < 3) lw2 = 3;
      lw2 = Math.max(2, Math.min(lw2, Math.floor(cxs[1] - cxs[0]) - 1)); // lenses never overlap: a 1 px bridge stays between them, so each can sit centred on its eye
      B.forEach(function (b, n) { b.x0 = Math.round(cxs[n] - (lw2 - 1) / 2); b.x1 = b.x0 + lw2 - 1; });
      if (B[0].x1 >= B[1].x0) { var mid2 = Math.floor((cxs[0] + cxs[1]) / 2); B[0].x1 = mid2 - 1; B[0].x0 = B[0].x1 - lw2 + 1; B[1].x0 = mid2 + 1; B[1].x1 = B[1].x0 + lw2 - 1; }
      var mL = 0, mR = 0; while (a.isSil(B[0].x0 - mL - 1, ecy)) mL++; while (a.isSil(B[1].x1 + mR + 1, ecy)) mR++;
      if (g.wide) g = Object.assign({}, g, { wide: Math.max(0, Math.min(g.wide, mL - 1, mR - 1)) }); /* same widening both sides, never clipped by a narrow head */ }
    if (g.s === 'mask') { var mx0 = B[0].x0 - 2, mx1 = B[B.length - 1].x1 + 2; for (y = top - 1; y <= bot + 1; y++) for (x = mx0; x <= mx1; x++) { if (eyeAt[x + ',' + y]) continue; put(x, y, (y === top - 1 || y === bot + 1 || x === mx0 || x === mx1) ? g.f : g.l[1]); } return; }
    if (g.s === 'visor') { var vx0 = B[0].x0 - 1, vx1 = B[B.length - 1].x1 + 1; for (y = top; y <= bot; y++) for (x = vx0; x <= vx1; x++) put(x, y, g.l[1]);
      for (x = vx0 - 1; x <= vx1 + 1; x++) { put(x, top - 1, g.f); put(x, bot + 1, g.f); } for (y = top; y <= bot; y++) { put(vx0 - 1, y, g.f); put(vx1 + 1, y, g.f); }
      for (x = vx0 - 2; x >= 0 && a.isSil(x, top); x--) put(x, top, g.f); for (x = vx1 + 2; x <= 31 && a.isSil(x, top); x++) put(x, top, g.f); return; }
    /* face polish 2026-10-14 (Jake): eye-traced brows / side-eye / blush / brow piercing / ninja mask (they used to be fixed maps on a guessed eye row) */
    var putAny = function (x2, y2, k) { if (!k || x2 < 0 || y2 < 0 || x2 > 31 || y2 > 31) return; var c = C[k].replace('#', ''), q = (y2 * 32 + x2) * 4; D[q] = parseInt(c.slice(0, 2), 16); D[q + 1] = parseInt(c.slice(2, 4), 16); D[q + 2] = parseInt(c.slice(4, 6), 16); D[q + 3] = 255; };
    var putF = function (x2, y2, k) { if (!eyeAt[x2 + ',' + y2]) put(x2, y2, k); };
    if (g.s === 'sideeye') { /* classic Doge side-eye: white sclera over each eye box, pupils pushed to the right edge, a raised brow above each eye (outer end up) */
      B.forEach(function (b, n) { var y0 = Math.max(top, b.y0), y1 = Math.min(bot, Math.max(b.y1, y0 + 1)); for (y = y0; y <= y1; y++) { for (x = b.x0 - 1; x <= b.x1; x++) put(x, y, 'w'); put(b.x1, y, 'n'); }
        for (x = b.x0 - 1; x <= b.x1; x++) put(x, y0 - 2, g.f || 'n'); put(n ? b.x1 + 1 : b.x0 - 2, y0 - 3, g.f || 'n'); }); return; }
    if (g.s === 'brows') { /* smug brows: one angled stroke just above each eye, high at the outer end, dipping toward the nose; never on the eye */
      B.forEach(function (b, n) { var y0 = b.y0, w = b.x1 - b.x0 + 3; for (var i = 0; i < w; i++) { var xx = n ? b.x1 + 1 - i : b.x0 - 1 + i; putF(xx, y0 - 2 + (i >= Math.ceil(w / 2) ? 1 : 0), g.f || 'n'); } }); return; }
    if (g.s === 'blush') { /* soft cheek blush: a 3x1 pink patch (rose corner) under and just outside each eye */
      /* redraw-3 2026-10-14 (Jake): centred under each eye and only on light skin (Wojak's narrow head, Chud's glasses + beard) */ var lit = function (x2, y2) { if (x2 < 0 || y2 < 0 || x2 > 31 || y2 > 31 || !a.isSil(x2, y2) || eyeAt[x2 + ',' + y2]) return false; var q2 = (y2 * 32 + x2) * 4, bs = a.bareAt ? a.bareAt(x2, y2).split(',').map(Number) : [D[q2], D[q2 + 1], D[q2 + 2]]; return bs[0] + bs[1] + bs[2] > 260; };
      B.forEach(function (b, n) { var cx = Math.round((b.x0 + b.x1) / 2), xs = n ? [cx, cx + 1] : [cx - 1, cx], yy = -1; for (var dy = 1; dy <= 3 && yy < 0; dy++) if (xs.every(function (xx) { return lit(xx, b.y1 + dy); })) yy = b.y1 + dy; if (yy < 0) yy = b.y1 + 2; /* dark-skinned faces (Bobo, Dodo, Nakamoto): old row */
        xs.forEach(function (xx, i) { put(xx, yy, (n ? i === 1 : i === 0) ? 'k' : 'K'); }); }); return; }
    if (g.s === 'piercing') { /* eyebrow piercing: two silver studs at the outer end of the pet's left brow (viewer-right eye), on the brow line above the eye */
      var pb = B[B.length - 1]; put(pb.x1, pb.y0 - 2, 's'); put(pb.x1 + 1, pb.y0 - 1, 's'); return; }
    if (g.s === 'ninja') { /* cloth band below the eyes over nose + mouth, contoured to the head width on every row, a fold line, two tails flying off the back of the head */
      /* redraw-3 2026-10-14 (Jake): it was a 3-row band across the middle of the face (cut between nose and mouth). Now a proper lower-face mask: from the row under the eyes down past the mouth (max 6 rows), contoured per row */
      var ny0 = bot + 1, my = sp && sp.mouth ? sp.mouth.y + 1 : ny0 + 3, rows3 = []; for (y = ny0; y <= Math.min(my, ny0 + 5); y++) rows3.push(y); var lx = 99, fold = rows3[Math.floor(rows3.length / 2)];
      var cl = B[0].x0 - 3, cr = B[B.length - 1].x1 + 3, edge = true; /* redraw-3: clamp to the face (eyes +3 px): wide heads/bodies (Doge) no longer get a full-width block */
      rows3.forEach(function (yy, j) { var l = 99, r = -1; for (x = 0; x < 32; x++) if (a.isSil(x, yy)) { l = Math.min(l, x); r = Math.max(r, x); } if (r < 0) return; if (l < cl) { l = cl; if (j === 0) edge = false; } r = Math.min(r, cr); lx = Math.min(lx, l);
        for (x = l; x <= r; x++) if (!eyeAt[x + ',' + yy]) put(x, yy, yy === fold && (x - l) % 4 === 2 ? g.l[0] : g.f); });
      if (lx < 99 && edge) { putAny(lx - 1, ny0, g.f); putAny(lx - 2, ny0 + 1, g.f); putAny(lx - 1, ny0 + 1, g.f); putAny(lx - 3, ny0 + 2, g.f); } return; }
    if (g.s === 'laser') { /* redraw-2 (Jake): the restored 2-row Laser eyes, eye-traced: top row red over each eye box with a white core, second row red under it;
       * from the pet's left eye (viewer-right) both rows fire right to the canvas edge, past the head. Same 2-row weight as before, never thicker. */
      B.forEach(function (b, n) { var ly = Math.max(top, Math.round((b.y0 + b.y1) / 2) - 0), last = n === B.length - 1;
        for (x = b.x0; x <= b.x1; x++) { putAny(x, ly, x === b.x0 + 1 ? 'w' : 'R'); if (x > b.x0) putAny(x, ly + 1, 'R'); }
        if (last) for (x = b.x1 + 1; x <= 31; x++) { putAny(x, ly, 'R'); putAny(x, ly + 1, 'R'); } }); return; }
    if (g.s === 'tear') { /* redraw-2: Single tear: one drop under the pet's right eye (viewer-left), light top, deep middle, light tail, on the cheek only */
      var tb = B[0], tx = tb.x0 + Math.floor((tb.x1 - tb.x0) / 2); putF(tx, tb.y1 + 1, 'c'); putF(tx, tb.y1 + 2, 'C'); putF(tx, tb.y1 + 3, 'c'); return; }
    if (g.s === 'monocle') { var m = g.side === 'L' ? B[0] : B[B.length - 1], cxo = g.side === 'L' ? m.x0 - 1 : m.x1 + 1; /* side 'L' (2026-10-14): the pet's right eye = viewer-left; chain trails from the outer edge down the cheek */
      for (x = m.x0 - 1; x <= m.x1 + 1; x++) { put(x, top - 1, g.f); put(x, bot + 1, g.f); } for (y = top; y <= bot; y++) { put(m.x0 - 1, y, g.f); put(m.x1 + 1, y, g.f); }
      for (y = bot + 2; y <= bot + 4; y++) put(cxo, y, g.f); return; }
    if (FIT2) drawEyeGear.last = { sp: spid, lenses: B.map(function (b) { return { x0: b.x0 - (g.wide || 0), x1: b.x1 + (g.wide || 0), w: b.x1 - b.x0 + 1 + 2 * (g.wide || 0) }; }), eyes: E.map(function (e) { var xs = e[2].map(function (q) { return q[0]; }); return (Math.min.apply(null, xs) + Math.max.apply(null, xs)) / 2; }).sort(function (p, q) { return p - q; }) }; // test hook
    B.forEach(function (b) { var x0 = b.x0 - (g.wide || 0), x1 = b.x1 + (g.wide || 0);
      for (y = top; y <= bot; y++) for (x = x0; x <= x1; x++) put(x, y, y === top ? g.l[0] : g.l[1]);
      for (y = top; y <= bot; y++) { put(x0 - 1, y, g.f); put(x1 + 1, y, g.f); }
      for (x = x0 - 1; x <= x1 + 1; x++) put(x, top - 1, g.f); for (x = x0; x <= x1; x++) put(x, bot + 1, g.f); });
    if (B.length > 1) for (x = B[0].x1 + 1 + (g.wide || 0); x <= B[1].x0 - 1 - (g.wide || 0); x++) put(x, top - 1, g.f);
    var L = B[0].x0 - 2 - (g.wide || 0), R = B[B.length - 1].x1 + 2 + (g.wide || 0); for (x = L; x >= 0 && a.isSil(x, top); x--) put(x, top, g.f); for (x = R; x <= 31 && a.isSil(x, top); x++) put(x, top, g.f);
    if (g.brows) B.forEach(function (b, n) { var x0 = b.x0 - (g.wide || 0), x1 = b.x1 + (g.wide || 0); if (n) { put(x1, top - 2, g.brows); put(x1 + 1, top - 2, g.brows); } else { put(x0 - 1, top - 2, g.brows); put(x0, top - 2, g.brows); } }); }
  /** wojak fix 2026-10-14 (v2 only): knit beanie traced from the head silhouette, so it hugs every stage/pose: covers the dome down to a rib cuff
   * 4 rows below the crown (never lower than 4 rows above the eyes), 1 px proud of the skull on the cuff, face untouched. */
  function drawSnugBeanie(img, a) { var C = BonusGear.COLORS, K = C.Z, R = C.j || C.d, d = img.data || img, y0 = a.minY, ey = a.eyeL ? a.eyeL[1] : a.eyeR ? a.eyeR[1] : 99, y1 = Math.min(y0 + 3, ey - 4), y, x;
    function span(y) { var lo = 99, hi = -1; for (var x = 0; x < 32; x++) if (a.isSil(x, y)) { lo = Math.min(lo, x); hi = Math.max(hi, x); } return hi < 0 ? null : [lo, hi]; }
    function put(x, y, c) { if (x < 0 || y < 0 || x > 31 || y > 31 || !c) return; var q = (y * 32 + x) * 4, h = typeof c === 'string' ? c : null; if (h) { d[q] = parseInt(h.substr(1, 2), 16); d[q + 1] = parseInt(h.substr(3, 2), 16); d[q + 2] = parseInt(h.substr(5, 2), 16); } else { d[q] = c[0]; d[q + 1] = c[1]; d[q + 2] = c[2]; } d[q + 3] = 255; }
    var top = span(y0); if (!top || y1 < y0) return img; var mid = (top[0] + top[1]) / 2;
    for (x = Math.ceil(mid - 1); x <= Math.floor(mid + 1); x++) put(x, y0 - 1, K); // folded crown
    for (y = y0; y <= y1; y++) { var s = span(y); if (!s) continue; var cuff = y >= y1 - 1, lo = s[0] - (cuff ? 1 : 0), hi = s[1] + (cuff ? 1 : 0);
      for (x = lo; x <= hi; x++) put(x, y, cuff && (x & 1) ? R : K); }
    return img; }
  /** frames for a pet wearing an explicit list of item ids (core items via gearOverride, overlays via BonusGear.apply) */
  /** headband pass 2026-10-14 (Jake): every v2 headband-type piece (kind 'band' worn on the head) uses the RED HEADBAND's fit as the reference: the pixels
   * pet-core's red-headband covers on this exact species/stage/frame (forehead rows + knot) are repainted with the piece's own band rows (pattern tiled across
   * the forehead); the piece's ornament rows (horns, feathers, clips, tails) keep their column offsets from the band's centre, just above / below it. */
  function bandLikeRed(img, key, stage, f, bare, d) {
    var rh = PetCore.render(key, { stage: stage, frame: f, gearOverride: { band: 'red-headband' } }).data, bd = bare.data, D = img.data, C = BonusGear.COLORS, x, y, rows = {};
    for (y = 0; y < 32; y++) for (x = 0; x < 32; x++) { var i = (y * 32 + x) * 4; if (rh[i] !== bd[i] || rh[i + 1] !== bd[i + 1] || rh[i + 2] !== bd[i + 2]) (rows[y] = rows[y] || []).push(x); }
    var ys = Object.keys(rows).map(Number).sort(function (p, q) { return p - q; }); if (!ys.length) return false;
    var m = d.map, w = m[0].length, full = m.map(function (r) { return r.indexOf('.') < 0; }), b0 = full.indexOf(true), b1 = full.lastIndexOf(true); if (b0 < 0) { b0 = 0; b1 = 0; }
    var main = ys.reduce(function (p, q) { return rows[q].length > rows[p].length ? q : p; }, ys[0]), mx0 = Math.min.apply(null, rows[main]), mx1 = Math.max.apply(null, rows[main]), cx = Math.floor((mx0 + mx1 + 1) / 2);
    var put = function (x2, y2, k) { if (!k || k === '.' || !C[k] || x2 < 0 || y2 < 0 || x2 > 31 || y2 > 31) return; var c = C[k].replace('#', ''), q = (y2 * 32 + x2) * 4; D[q] = parseInt(c.slice(0, 2), 16); D[q + 1] = parseInt(c.slice(2, 4), 16); D[q + 2] = parseInt(c.slice(4, 6), 16); D[q + 3] = 255; };
    var fy0 = ys[0], fy1 = ys[ys.length - 1], nb = b1 - b0 + 1;
    ys.forEach(function (yy) { var r = m[b0 + Math.min(nb - 1, Math.round((yy - fy0) * (nb - 1) / Math.max(1, fy1 - fy0)))]; rows[yy].forEach(function (xx) { put(xx, yy, r.charAt(((xx - mx0) % w + w) % w)); }); });
    for (var k = 0; k < m.length; k++) { if (k >= b0 && k <= b1) continue; var ty = k < b0 ? fy0 - (b0 - k) : fy1 + (k - b1);
      for (x = 0; x < w; x++) { var ch = m[k].charAt(x); if (ch === '.') continue; var tx = cx - Math.floor(w / 2) + x; if (k > b1 && !bd[(ty * 32 + tx) * 4 + 3]) continue; put(tx, ty, ch); } }
    return true; }
  /* Doge black eye (2026-10-14): the battle-loser 'v2-black-eye' overlay lands on the 'eyes' anchor, which on Doge's
   * 3/4-view face is the gap between his eyes. v2 moves the shiner onto Doge's right eye (viewer's right) per stage (DOGE_SHINER dx/dy) (the shiner keeps its own pupil),
   * matching how it surrounds the eye on Pepe and the others. Other species are unchanged. */
  var DOGE_SHINER = {}; /* 2026-10-15: retired, the eye-traced shiner lands on Doge's real eye */ /* 2026-10-14: his RIGHT eye as seen by the viewer */
  function framesWith(art, stage, itemIds, extraOv, cap, baseGo) {
    var fb = framesWith0(art, stage, itemIds, extraOv, cap, baseGo), k = (extraOv || []).indexOf('v2-black-eye'), off = DOGE_SHINER[stage];
    if (k < 0 || !art || art.species !== 'doge' || !off) return fb;
    var ov2 = extraOv.slice(); ov2.splice(k, 1); var fa = framesWith0(art, stage, itemIds, ov2, cap, baseGo);
    return fb.map(function (f, n) { var A = fa[n] ? fa[n].data : f.data, B = f.data, d = new Uint8ClampedArray(A), x, y;
      for (y = 0; y < 32; y++) for (x = 0; x < 32; x++) { var i = (y * 32 + x) * 4; if (A[i] === B[i] && A[i + 1] === B[i + 1] && A[i + 2] === B[i + 2]) continue;
        var X = x + off[0], Y = y + off[1]; if (X < 0 || Y < 0 || X > 31 || Y > 31) continue; var j = (Y * 32 + X) * 4;
        d[j] = B[i]; d[j + 1] = B[i + 1]; d[j + 2] = B[i + 2]; d[j + 3] = 255; }
      return Object.assign({}, f, { data: d }); }); }
  function framesWith0(art, stage, itemIds, extraOv, cap, baseGo) {
    itemIds = (itemIds || []).map(function (id) { return V.resolveItem ? V.resolveItem(id) : id; }); 
    if (art) { var roots0 = V.hybridRoots ? V.hybridRoots(art.hybrid ? art.hybrid.key : art.species) : [art.species], LK = V.SPECIES_LOCK || { 'lenny-monocle': { sp: 'lenny' } }; /* species-locked pieces (Lenny monocle; KEVIN name tag) never draw on other species */
      itemIds = itemIds.filter(function (id) { var L = LK[id]; return !L || roots0.indexOf(L.sp) >= 0 || (L.from != null && V.eligBlock && (V.eligBlock() || 0) < L.from); }); } /* retired ids (Heart crown, swan mask, Laser eyes) render as their current item */
    var go = Object.assign({}, baseGo || {}), ov = (extraOv || []).slice(); /* baseGo: optional gear override that must actually be drawn */
    (itemIds || []).forEach(function (id) { var it = V.GEAR_BY_ID[id]; if (!it) return; if (it.src === 'core' && !CORE_OVERLAY[id]) go[it.coreSlot] = it.id; else { if (CORE_OVERLAY[id] && !BonusGear.DEFS[id]) BonusGear.DEFS[id] = CORE_OVERLAY[id]; ov.push(it.id); } });
    stage = Math.max(0, stage); var F = window.V2Fit;
    // Fit pass (2026-10-14): base-game capes + armour are drawn by V2Fit (flowing capes behind the body; armour in the torso box), not pet-core
    var fitCape = null, fitArmor = null;
    if (F && stage > 0) { ov.forEach(function (id) { if (F.isCape(id)) fitCape = id; }); if (go.cape && F.isCape(go.cape)) { if (!fitCape) fitCape = go.cape; delete go.cape; }
      if (go.armor) { fitArmor = PetCore.ARMORS.filter(function (x) { return x.id === go.armor; })[0] || null; if (fitArmor) delete go.armor; } }
    if (fitCape) ov = ov.filter(function (id) { return !F.isCape(id); });
    var fr = art.hybrid ? V.hybridFrames(art, { stage: stage, gearOverride: go, gearCap: cap }) : PetCore.renderFrames(art, { stage: stage, gearOverride: go, gearCap: cap }); // hybrids: assembled art + badge
    if ((ov.length || fitCape || fitArmor) && stage > 0) { var sp = PetCore.SPECIES.filter(function (s) { return s.id === art.species; })[0];
      var key = Object.assign({}, art, { background: 'solid', bgColor: '#ff00ff', pattern: 'none' }), eyes = Object.assign({}, key, { eyes: 'star' }), KB = [255, 0, 255];
      var order = ['back', 'body', 'feet', 'hand', 'head', 'face']; // z-order: cape (behind) < outfit/armour < feet < held < headwear < face
      ov.sort(function (a, b) { return order.indexOf((V.GEAR_BY_ID[a] || BonusGear.DEFS[a] || {}).slot) - order.indexOf((V.GEAR_BY_ID[b] || BonusGear.DEFS[b] || {}).slot); });
      var minYTop = Math.min.apply(null, fr.map(function (_, f) { var o = { stage: stage, frame: f, gearOverride: {} }; return BonusGear.anchors(PetCore.render(key, o), eyeRender(eyes, o), sp).minY; }));
      fr.forEach(function (img, f) { var o = { stage: stage, frame: f, gearOverride: {} }, bare = PetCore.render(key, o); var a = BonusGear.anchors(bare, eyeRender(eyes, o), sp); a.minYTop = minYTop; a.spId = art.species; a.stage = stage;
        var geared = PetCore.render(key, { stage: stage, frame: f, gearOverride: go, gearCap: cap }), gd = geared.data, bd = bare.data;
        a.isFg = function (x, y) { if (x < 0 || y < 0 || x > 31 || y > 31) return false; var i = (y * 32 + x) * 4; return a.isSil(x, y) || Math.abs(gd[i] - KB[0]) + Math.abs(gd[i + 1] - KB[1]) + Math.abs(gd[i + 2] - KB[2]) > 40; };
        var arm = PetCore.render(key, { stage: stage, frame: f, gearOverride: { armor: 'gold' } }).data; // where pet-core puts armour (face-safe torso seed)
        a.armorAt = function (x, y) { var i = (y * 32 + x) * 4; return arm[i] !== bd[i] || arm[i + 1] !== bd[i + 1] || arm[i + 2] !== bd[i + 2]; };
        a.bareAt = function (x, y) { var i = (y * 32 + x) * 4; return bd[i] + ',' + bd[i + 1] + ',' + bd[i + 2]; };
        var fpr = PetCore.render(key, { stage: stage, frame: f, gearOverride: {}, faceProbe: true }).data; /* marked face skin (Sarutobi small maps, 2026-10-16): armour/outfits never cover it */
        a.isFaceSkin = function (x, y) { if (x < 0 || y < 0 || x > 31 || y > 31) return false; var i = (y * 32 + x) * 4; return fpr[i] === 255 && fpr[i + 1] === 0 && fpr[i + 2] === 254; };
        a.isGear = function (x, y) { var i = (y * 32 + x) * 4; return gd[i] !== bd[i] || gd[i + 1] !== bd[i + 1] || gd[i + 2] !== bd[i + 2]; };
        if (fitCape) F.cape(img, a, fitCape, f);
        if (fitArmor) F.armor(img, a, fitArmor);
        // headwear redo (2026-10-14): headwear never hides the eyes. Snapshot before the first head piece, restore the eye pixels after the last one
        // (face pieces such as shades come after and may still cover them).
        var eyePx = [].concat(a.eyeL ? a.eyeL[2] : [], a.eyeR ? a.eyeR[2] : []), headSnap = null, slotOf = function (id) { return (V.GEAR_BY_ID[id] || BonusGear.DEFS[id] || {}).slot; };
        function restoreEyes() { if (!headSnap) return; eyePx.forEach(function (q) { var i = (q[1] * 32 + q[0]) * 4; img.data[i] = headSnap[i]; img.data[i + 1] = headSnap[i + 1]; img.data[i + 2] = headSnap[i + 2]; }); headSnap = null; }
        ov.forEach(function (id) { if (slotOf(id) === 'head' && !headSnap) headSnap = new Uint8ClampedArray(img.data); else if (slotOf(id) !== 'head' && headSnap) restoreEyes();
          try { var d = BonusGear.DEFS[id], it = V.GEAR_BY_ID[id] || {};
          if (F && it.slot === 'body' && d && d.map && d.at === 'chest' && !d.fitSil) F.outfit(img, a, d.map, BonusGear.COLORS); else if (isV2Face(id)) drawFace(id, img, faceSpots(bare, a, art.species), a); else if (d && d.at === 'mouth' && d.map && d.slot !== 'face') drawMouthHeld(d, img, faceSpots(bare, a, art.species), a); else if (d && d.v2snug) drawSnugBeanie(img, a); else if (d && d.kind === 'band' && d.at === 'head' && d.map && bandLikeRed(img, key, stage, f, bare, d)) { /* fitted like the Red headband */ } else if (d && d.v2eye && drawEyeGear(img, a, d, d.v2eye.s === 'ninja' ? faceSpots(bare, a, art.species) : null) !== false) { /* traced */ } else BonusGear.apply(id, img, fitAnchors(id, a), f); if (d && d.v2cig && ov.indexOf('v2-wojak-cig') < 0) { restoreEyes(); drawFace(d.v2cig, img, faceSpots(bare, a, art.species), a); } } catch (e) {} }); restoreEyes(); }); }
    return fr;
  }
  /* Counterparty logo override (2026-10-14): pet-core's 'xcp' / 'bxmix' backgrounds draw a 5x5 X-in-a-circle glyph.
   * v2 swaps it for the real Counterparty mark (infinity loop, from counterparty.io/favicon.svg) as a 9x5 pixel infinity glyph, same tint, same
   * 10px grid. pet-core.js is untouched; only pets hatched at/after the cutoff are repainted, so pre-cutoff pets look exactly like live. */
  var OLD_XCP = ['.###.', '#.#.#', '##.##', '#.#.#', '.###.'], CP_LOGO = ['.##...##.', '#..#.#..#', '#...#...#', '#..#.#..#', '.##...##.'];
  function cpHex(c) { c = String(c || '#000000').replace('#', ''); return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)]; }
  function cpMix(a, b, t) { return [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)]; }
  function cpLogo(img, art) { var bg = art && art.background; if (bg !== 'xcp' && bg !== 'bxmix') return img;
    var base = cpHex(art.bgColor), ink = cpMix(base, [0x33, 0xd6, 0xff], 0.22), d = new Uint8ClampedArray(img.data), x, y;
    function is(i, c) { return d[i] === c[0] && d[i + 1] === c[1] && d[i + 2] === c[2]; } function put(i, c) { d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; }
    for (var cy = 0; cy < 32; cy += 10) for (var cx = 0; cx < 32; cx += 10) { if (bg === 'bxmix' && !((cx / 10 + cy / 10) % 2)) continue;
      for (y = 0; y < 5; y++) for (x = 0; x < 5; x++) { var X = cx + 2 + x, Y = cy + 2 + y, i = (Y * 32 + X) * 4; if (X < 32 && Y < 32 && OLD_XCP[y].charAt(x) === '#' && is(i, ink)) put(i, base); }
      for (y = 0; y < 5; y++) for (x = 0; x < 9; x++) { var X2 = cx + x, Y2 = cy + 2 + y, j = (Y2 * 32 + X2) * 4; if (X2 < 32 && Y2 < 32 && CP_LOGO[y].charAt(x) === '#' && is(j, base)) put(j, ink); } }
    return Object.assign({}, img, { data: d }); }
  /* Hotfix 2 (2026-10-14): first-load freeze. worn(w, id) = V.wornOf via a per-world index (a replayed world is cached and not mutated
   * by the UI); petFrames results are cached by pet look (id, stage, worn gear, black eye, crown, art), so re-renders / sort toggles reuse
   * them; lazy(c, make[, still]) draws a grid sprite only when its canvas scrolls near the screen. */
  var wornIx = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
  function worn(w, id) { if (!wornIx || !w || !w.items) return V.wornOf(w, id); var ix = wornIx.get(w);
    if (!ix) { ix = {}; Object.keys(w.items).forEach(function (k) { var g = w.items[k]; if (g.on != null) (ix[g.on] = ix[g.on] || []).push(g); }); wornIx.set(w, ix); }
    return (ix[id] || []).slice(); }
  var frCache = new Map(), FR_MAX = 6000;
  function frKey(p, w, extra) { return p.id + '|' + p.stage + '|' + worn(w, p.id).map(function (g) { return g.item; }).join(',') + '|' + !!(p.blackEye || (extra && extra.blackEye)) + '|' + !!p.crowned + '|' + p.hatchBlock + '|' + JSON.stringify(p.art) + '|h' + (extra && extra.noHunger ? 0 : hungerDays(p, w)); }
  function petFramesC(p, w, extra) { var k = frKey(p, w, extra), f = frCache.get(k); if (f) return f; f = petFrames(p, w, extra); if (frCache.size >= FR_MAX) frCache.clear(); frCache.set(k, f); return f; }
  var lazyQ = new Map(), lazyObs = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(function (es) { es.forEach(function (e) { if (!e.isIntersecting) return; var j = lazyQ.get(e.target); if (!j) return; lazyQ.delete(e.target); lazyObs.unobserve(e.target); j(); }); }, { rootMargin: '300px' }) : null;
  function lazy(c, make, still) { var run = function () { var fr = make(); if (still) paint(c, fr[0]); else animate(c, fr); }; if (!lazyObs) return run(); lazyQ.set(c, run); lazyObs.observe(c); }
  function petFrames(p, w, extra) { var fr = petFrames0(p, w, extra), cut = V.CUTOFF_BLOCK || 971500, hd = extra && extra.noHunger ? 0 : hungerDays(p, w);
    if (hd) fr = hungerLook(fr, p, w, extra, hd);
    return p && p.art && p.hatchBlock > cut ? fr.map(function (f, i) { return window.V2Bg ? V2Bg.apply(f, p.art, i, cpLogo) : cpLogo(f, p.art); }) : fr; }
  function petFrames0(p, w, extra) {
    var ids = worn(w, p.id).map(function (g) { return g.item; }), ov = [];
    if (p.blackEye || (extra && extra.blackEye)) ov.push('v2-black-eye'); if (p.crowned) ov.push('v2-rumble-crown');
    return framesWith(p.art, p.stage, ids, ov);
  }
  /* Hunger look (2026-10-16, visual only): an unfed pet's sprite deteriorates day by day, derived from the rules' own clock
   * (deathBlock = (day(lastFed)+NEGLECT_DAYS+1)*BLOCKS_PER_DAY, so day(lastFed) = deathBlock/BPD - NEGLECT_DAYS - 1). Days unfed = day(tip) - day(lastFed),
   * capped at 7. Mythic (deathBlock null), dead and released pets are never touched; a meal moves lastFed, so the look resets. No rule changes. */
  function hungerDays(p, w) { if (!p || p.dead || p.released || p.mythicCare || p.deathBlock == null || !w || w.tip == null) return 0;
    var B = V.BLOCKS_PER_DAY || 144, N = V.NEGLECT_DAYS || 7, d = V.day(w.tip) - (Math.round(p.deathBlock / B) - N - 1); return d > 0 ? Math.min(7, d) : 0; }
  /* hunger palette (2026-10-16 sprite cleanup): faded colours snap to these; blotches use HP entries too */
  var HP = [[38, 40, 44], [70, 74, 66], [96, 104, 84], [118, 130, 96], [96, 168, 56], [70, 130, 40], [150, 190, 70], [146, 152, 128], [178, 182, 160], [210, 212, 192], [236, 236, 222], [150, 96, 80], [196, 140, 120]];
  function snapHP(r, g, b) { var best = HP[0], bd = 1e9; for (var i = 0; i < HP.length; i++) { var c = HP[i], dd = (c[0] - r) * (c[0] - r) + (c[1] - g) * (c[1] - g) + (c[2] - b) * (c[2] - b); if (dd < bd) { bd = dd; best = c; } } return best; }
  function hungerLook(fr, p, w, extra, days) { if (!days) return fr;
    var mp = Object.assign({}, p, { art: Object.assign({}, p.art, { background: 'solid', bgColor: '#ff00fe', pattern: 'none' }) }), mk = petFrames0(mp, w, extra), t = days / 7;
    return fr.map(function (f, fi) { var m = (mk[fi] || mk[0]).data, s = f.data, d = new s.constructor(s), o = Object.assign({}, f, { data: d }), i, x, y, minX = 32, maxX = -1, minY = 32, sil = [];
      var isS = function (q) { return !(m[q] === 255 && m[q + 1] === 0 && m[q + 2] === 254); };
      for (y = 0; y < 32; y++) for (x = 0; x < 32; x++) { i = (y * 32 + x) * 4; if (!isS(i)) continue; sil.push(i); if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; }
      var de = Math.min(0.8, 0.12 + t * 0.7), gr = Math.max(0, t - 0.15) * 0.45, dim = days >= 5 ? (days - 4) * 0.07 : 0;
      sil.forEach(function (q) { var r = d[q], g = d[q + 1], b = d[q + 2], L = 0.3 * r + 0.59 * g + 0.11 * b;
        r += (L - r) * de; g += (L - g) * de; b += (L - b) * de;           /* washed out */
        r += (118 - r) * gr; g += (150 - g) * gr; b += (78 - b) * gr;        /* sickly green cast */
        r *= 1 - dim; g *= 1 - dim; b *= 1 - dim;                            /* dull, low energy */
        var c = snapHP(r, g, b); d[q] = c[0]; d[q + 1] = c[1]; d[q + 2] = c[2]; }); /* 2026-10-16: snapped to the fixed hunger palette (nothing off-palette) */
      function put(x, y, c) { if (x < 0 || y < 0 || x > 31 || y > 31) return; var q = (y * 32 + x) * 4; d[q] = c[0]; d[q + 1] = c[1]; d[q + 2] = c[2]; d[q + 3] = 255; }
      if (days >= 3 && maxX >= 0) { var sx = Math.min(31, maxX + 1), sy = minY + 3 + (fi % 2), SW = [150, 210, 255], SH = [235, 250, 255]; /* sweat drop, bobbing with the frames */
        put(sx, sy, SH); put(sx, sy + 1, SW); put(sx, sy + 2, SH); put(sx + 1, sy + 2, SW); put(sx, sy + 3, SW); put(sx + 1, sy + 3, SW);
        if (days >= 6) { var lx = Math.max(0, minX - 1); put(lx, sy + 1, SH); put(lx, sy + 2, SW); put(lx, sy + 3, SW); } }
      if (days >= 4) { var n = Math.round(sil.length * (days - 3) * 0.018), h = (p.id * 2654435761) >>> 0, SK = [[96, 168, 56], [70, 130, 40], [150, 190, 70]]; /* sick blotches */
        var inS = {}; sil.forEach(function (q) { inS[q] = 1; }); n = Math.max(1, Math.round(n / 4)); /* 2x2 blotches, inside the silhouette only */
        for (var k = 0; k < n && sil.length; k++) { h = (h * 1103515245 + 12345) >>> 0; var q = sil[h % sil.length], c = SK[(h >>> 8) % 3]; [0, 4, 128, 132].forEach(function (o) { if (inS[q + o]) { d[q + o] = c[0]; d[q + o + 1] = c[1]; d[q + o + 2] = c[2]; } }); } }
      if (days >= 6) for (x = minX; x <= maxX; x++) { var top = -1; for (y = 0; y < 32; y++) if (isS((y * 32 + x) * 4)) { top = y; break; } /* droop: the top line sags */
        if (top >= 0 && Math.floor((x - minX) / 3 + fi) % 2 === 0) { /* droop in 3px chunks */ var q2 = (top * 32 + x) * 4, q3 = ((top + 1) * 32 + x) * 4; d[q2] = d[q3]; d[q2 + 1] = d[q3 + 1]; d[q2 + 2] = d[q3 + 2]; } }
      return o; }); }
  // ---------------------------------------------------------------- standalone gear icons (the piece alone, not on a pet)
  var iconCache = {}, NONE = { band: 'none', armor: 'none', cape: 'none', weapon: 'none', crown: 'none' };
  function bare(sp) { return Object.assign(PetCore.characterPet(sp, { tier: 'common', bgColor: '#000000' }), { background: 'solid', bgColor: '#000000', pattern: 'none' }); }
  /** itemIcon(itemId) -> ImageData-like {data} 32x32: renders the piece on a pet, keeps ONLY the pixels the piece changed,
   * crops them and centres them (integer-scaled) on a dark tile. Works for core, bonus and v2 pieces alike. */
  function itemIcon(id) {
    if (iconCache[id]) return iconCache[id];
    var it = V.GEAR_BY_ID[id] || {}, art = bare(it.origin && it.origin !== 'nakamoto' ? it.origin : 'pepe'), go = Object.assign({}, NONE), with_;
    var base = PetCore.render(art, { stage: 5, frame: 0, gearOverride: go, gearCap: 5 });
    if (it.src === 'core') { var g2 = Object.assign({}, go); g2[it.coreSlot] = id; with_ = PetCore.render(art, { stage: 5, frame: 0, gearOverride: g2, gearCap: 5 }); }
    else { with_ = { data: new Uint8ClampedArray(base.data) }; var sp = PetCore.SPECIES.filter(function (s) { return s.id === art.species; })[0];
      var key = Object.assign({}, art, { bgColor: '#ff00ff' }), eyes = Object.assign({}, key, { eyes: 'star' }), o = { stage: 5, frame: 0, gearOverride: go, gearCap: 5 };
      try { var kb = PetCore.render(key, o), an = BonusGear.anchors(kb, eyeRender(eyes, o), sp); an.spId = art.species; if (isV2Face(id)) drawFace(id, with_, faceSpots(kb, an, art.species), an); else if (BonusGear.DEFS[id] && BonusGear.DEFS[id].v2snug) drawSnugBeanie(with_, an); else if (BonusGear.DEFS[id] && BonusGear.DEFS[id].v2eye && drawEyeGear(with_, an, BonusGear.DEFS[id], BonusGear.DEFS[id].v2eye.s === 'ninja' ? faceSpots(kb, an, art.species) : null) !== false) { /* traced */ } else BonusGear.apply(id, with_, fitAnchors(id, an), 0); var dd = BonusGear.DEFS[id]; if (dd && dd.v2cig) drawFace(dd.v2cig, with_, faceSpots(kb, an, art.species), an); } catch (e) {} }
    var x0 = 32, y0 = 32, x1 = -1, y1 = -1, mask = [];
    for (var y = 0; y < 32; y++) for (var x = 0; x < 32; x++) { var i = (y * 32 + x) * 4, d = base.data[i] !== with_.data[i] || base.data[i + 1] !== with_.data[i + 1] || base.data[i + 2] !== with_.data[i + 2];
      mask.push(d); if (d) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } }
    var out = new Uint8ClampedArray(32 * 32 * 4); for (var k = 0; k < 32 * 32; k++) { out[k * 4] = 20; out[k * 4 + 1] = 32; out[k * 4 + 2] = 24; out[k * 4 + 3] = 255; }
    if (x1 >= 0) { var w = x1 - x0 + 1, h = y1 - y0 + 1, sc = Math.max(1, Math.min(3, Math.floor(28 / Math.max(w, h)))), ox = Math.floor((32 - w * sc) / 2), oy = Math.floor((32 - h * sc) / 2);
      for (var yy = 0; yy < h; yy++) for (var xx = 0; xx < w; xx++) { if (!mask[(y0 + yy) * 32 + x0 + xx]) continue; var s = ((y0 + yy) * 32 + x0 + xx) * 4;
        for (var a = 0; a < sc; a++) for (var b = 0; b < sc; b++) { var t = ((oy + yy * sc + a) * 32 + ox + xx * sc + b) * 4; out[t] = with_.data[s]; out[t + 1] = with_.data[s + 1]; out[t + 2] = with_.data[s + 2]; } } }
    return (iconCache[id] = { data: out, empty: x1 < 0 });
  }
  function iconCanvas(id, cls) { var c = document.createElement('canvas'); c.width = c.height = 32; c.className = cls || 'gicon'; paint(c, itemIcon(id)); return c; }
  // ---------------------------------------------------------------- click-to-equip picker
  var TID = ['common', 'uncommon', 'rare', 'legendary'];
  /** gearPicker(box, {world, owner, pet, onEquip(op), onEquipMany(ops, msg)?, onMsg(text)}): slot-name buttons; clicking one opens a grid of that slot's pieces as
   * standalone icons. Click an equippable icon to equip on this pet; others say why not. Free: no burn (a local equip op). */
  function gearPicker(box, o) {
    var w = o.world, p = o.pet, open = box.getAttribute('data-open') || '';
    var worn = {}; V.wornOf(w, p.id).forEach(function (g) { worn[g.slot] = g; });
    // compact (pet pop-up): only slots with gear on, or unlocked slots where an owned piece could be worn; unwearable pieces are hidden (no reasons shown)
    var usable = function (x) { return x.check.worn || (x.check.ok && x.owned > 0); };
    var slots = o.compact ? V.V2_SLOTS.filter(function (sl) { return worn[sl] || (p.openSlots.indexOf(sl) >= 0 && !p.dead && V.pickerPieces(w, o.owner, p.id, sl).some(usable)); }) : V.V2_SLOTS;
    if (o.compact && open && slots.indexOf(open) < 0) open = '';
    if (o.compact && !slots.length) { box.innerHTML = '<p class="small muted">No gear to wear yet.</p>'; return; }
    var h = '<div class="gp-slots" role="tablist" aria-label="Gear slots">' + slots.map(function (sl) { var locked = p.openSlots.indexOf(sl) < 0, g = worn[sl];
      return '<button type="button" class="gp-slot' + (open === sl ? ' on' : '') + (locked ? ' locked' : '') + '" data-gslot="' + sl + '" role="tab" aria-selected="' + (open === sl) + '"><b>' + V.slotLabel(sl) + '</b><span class="small">' + (locked ? 'locked' : g ? esc(g.label) : 'empty') + '</span></button>'; }).join('') + '</div>';
    /* Unequip all (2026-10-19): one free local action that takes every worn piece off this pet (same op as "Take off", gid null, per slot); all go to the bag */
    /* unequip-owner-fix (2026-10-19): owner only. Same check as equip/unequip (equipCheck), feed and Release: a wallet is connected, it owns the pet, the pet is not released.
     * The community pet (Bitcoin Wizard, auto-equips) has no owner, so this also hides it there unless it is owner-controlled by the connected wallet. */
    var ownsP = function () { var q = (o.world && o.world.byId && o.world.byId[p.id]) || p; return !!o.owner && q.owner === o.owner && !q.released; };
    var wornSlots = Object.keys(worn), canOffAll = wornSlots.length && !p.dead && ownsP(), asking = box.getAttribute('data-offall') === '1' && canOffAll;
    if (canOffAll) h += '<div class="gp-offall">' + (asking ? '<span class="small">' + (wornSlots.length === 1 ? 'Take the 1 piece off #' + p.id + '? It goes' : 'Take all ' + wornSlots.length + ' pieces off #' + p.id + '? They go') + ' back to your bag (free).</span> <button type="button" class="q" data-offyes="1">Yes, take them off</button> <button type="button" class="q" data-offno="1">Cancel</button>'
      : '<button type="button" class="q" data-offall="1" title="Take every piece off this pet at once. Free; they go back to your bag.">Unequip all (' + wornSlots.length + ')</button>') + '</div>';
    h += '<div class="gp-grid-wrap" id="gpWrap"></div><div class="small gp-msg" aria-live="polite"></div>';
    box.innerHTML = h;
    var oa = box.querySelector('[data-offall]'), oy = box.querySelector('[data-offyes]'), on = box.querySelector('[data-offno]');
    var notOwner = function () { box.removeAttribute('data-offall'); say('Only the owner can take gear off #' + p.id + '. Connect the wallet that owns it.', true); };
    if (oa) oa.onclick = function () { if (!ownsP()) return notOwner(); box.setAttribute('data-offall', '1'); gearPicker(box, o); };
    if (on) on.onclick = function () { box.removeAttribute('data-offall'); gearPicker(box, o); };
    if (oy) oy.onclick = function () { if (!ownsP()) return notOwner(); box.removeAttribute('data-offall'); var ops = wornSlots.map(function (sl) { return { kind: 'equip', owner: o.owner, petId: p.id, slot: sl, gid: null }; }), m = 'Took ' + ops.length + ' piece' + (ops.length === 1 ? '' : 's') + ' off #' + p.id + ': back in your bag';
      if (o.onEquipMany) o.onEquipMany(ops, m); else ops.forEach(function (op, i) { o.onEquip(op, i === ops.length - 1 ? m : ''); }); };
    var wrap = box.querySelector('.gp-grid-wrap'), msg = box.querySelector('.gp-msg');
    function say(t, bad) { msg.textContent = t; msg.className = 'small gp-msg' + (bad ? ' warn' : ''); }
    if (open) {
      var pcs = V.pickerPieces(w, o.owner, p.id, open), locked = p.openSlots.indexOf(open) < 0; if (o.compact) pcs = pcs.filter(usable);
      wrap.innerHTML = '<div class="gp-head small"><b>' + V.slotLabel(open) + '</b>' + (o.compact ? '' : ' · ' + pcs.length + ' pieces · ' + pcs.filter(function (x) { return x.owned; }).length + ' owned' + (locked ? ' · <span class="warn">slot locked: capacity ' + p.capacity + '/6 (grows with age + care)</span>' : '')) +
        (worn[open] && !p.dead ? ' <button type="button" class="q" data-goff="1">Take off ' + esc(worn[open].label) + '</button>' : '') + '</div><div class="gp-grid"></div>';
      var grid = wrap.querySelector('.gp-grid');
      pcs.forEach(function (x) { var b = document.createElement('button'); b.type = 'button';
        b.className = 'gp-item t' + x.tier + (x.check.worn ? ' worn' : x.check.ok ? ' ok' : ' no');
        b.title = x.label + ' · ' + V.TIER_LABELS[x.tier] + (x.legendary ? ' · legendary' : '') + (V.lockHint && V.lockHint(x.id) ? ' · ' + V.lockHint(x.id) : '') + ' · ' + (x.check.worn ? 'worn' : x.check.ok ? 'click to equip' : o.compact ? 'not available' : 'cannot equip: ' + x.check.why) + ' · own ' + x.owned + ' (' + x.free + ' free)';
        b.setAttribute('aria-label', b.title); b.dataset.gid = x.id;
        b.appendChild(iconCanvas(x.id));
        b.insertAdjacentHTML('beforeend', '<span class="gp-n">' + (x.owned ? '×' + x.owned : '') + '</span>' + (x.legendary ? '<span class="gp-star">★</span>' : '') + (x.check.worn ? '<span class="gp-on">ON</span>' : ''));
        b.onclick = function () {
          var c = V.equipCheck(o.world, o.owner, p.id, x.id);
          if (!c.ok && o.compact) return; if (!c.ok) return say(x.label + ': ' + (c.worn ? 'already worn by #' + p.id : 'can\'t equip — ' + c.why), !c.worn);
          o.onEquip({ kind: 'equip', owner: o.owner, petId: p.id, slot: open, gid: c.gid }, 'Equipped ' + x.label + ' on #' + p.id + (c.from ? ' (moved from #' + c.from + ')' : ''));
        };
        grid.appendChild(b); });
      var off = wrap.querySelector('[data-goff]'); if (off) off.onclick = function () { o.onEquip({ kind: 'equip', owner: o.owner, petId: p.id, slot: open, gid: null }, 'Took ' + worn[open].label + ' off #' + p.id); };
    }
    box.querySelectorAll('[data-gslot]').forEach(function (b) { b.onclick = function () { box.setAttribute('data-open', open === b.dataset.gslot ? '' : b.dataset.gslot); gearPicker(box, o); }; });
    if (o.msg) say(o.msg);
  }
  /** communityFrames(w): the community pet Nakamoto (Mythic) wearing its community-roll gear (newest roll per slot); no gear => the plain sprite as before. */
  /** itemCols(id): the two most common body colours of a gear icon (skips the background and the dark ink outline), for the Wizard overlays. Display only. */
  var colCache = {};
  function itemCols(id) { if (colCache[id]) return colCache[id]; var out = [];
    try { var im = itemIcon(id), d = im.data, n = {}, bg = d[0] + ',' + d[1] + ',' + d[2];
      for (var i = 0; i < d.length; i += 4) { if (d[i + 3] < 128) continue; var k = d[i] + ',' + d[i + 1] + ',' + d[i + 2]; if (k === bg || d[i] + d[i + 1] + d[i + 2] < 90) continue; n[k] = (n[k] || 0) + 1; }
      out = Object.keys(n).sort(function (a, b) { return n[b] - n[a]; }).slice(0, 2).map(function (k) { return '#' + k.split(',').map(function (v) { return ('0' + Number(v).toString(16)).slice(-2); }).join(''); }); } catch (e) { }
    return (colCache[id] = out); }
  /** wizardGear(w): the community pet's worn community-roll pieces in the WizardSprite gear format ({slot: {label, item, cols}}). */
  function wizardGear(w) { var g = (w && w.community && w.community.gear) || {}, o = {}; (V.V2_SLOTS || []).forEach(function (sl) { if (g[sl]) { var c = itemCols(g[sl].item).slice(), m = /\b(gold|golden|silver|brown|black|white|red|green|blue|midnight|purple|pink|orange|iron|wooden|denim)\b/i.exec(g[sl].label || ''); if (m) c.unshift(WORD_COL[m[1].toLowerCase()]); o[sl] = { label: g[sl].label, item: g[sl].item, cols: c }; } });
    /* Wizard Hat (2026-10-19): his signature Headwear piece, always worn while the community Headwear slot is empty; a community roll for
     * Headwear replaces it (newest roll wins). Synthetic, display only: never added to w.community.gear, so replay/gear state is unchanged. */
    if (!o.head && window.WizardSprite && WizardSprite.WIZARD_HAT) o.head = WizardSprite.WIZARD_HAT; return o; }
  var WORD_COL = { gold: '#ffd23f', golden: '#ffd23f', silver: '#c9ced8', brown: '#8a5a2b', black: '#2a2630', white: '#f2f2f2', red: '#d8433a', green: '#3ddc84', blue: '#2f6fe0', midnight: '#2a3170', purple: '#8a4fd8', pink: '#ff8fc8', orange: '#f7931a', iron: '#8a8f99', wooden: '#9a6a3a', denim: '#3b5ba8' };
  /** communityFrames(w): the Bitcoin Wizard (after the switch) at its stage wearing its community-roll gear; before it, Nakamoto as below. */
  function communityFrames(w) { var c = w && w.community; if (c && c.returned && window.WizardSprite) return WizardSprite.frames(c.wizardStage || 0, '#2a3a2e', c.wizardStage > 0 ? wizardGear(w) : { head: WizardSprite.WIZARD_HAT }, { community: true }); /* purple = community-pet-only palette */
    return nakaFrames(w); }
  function nakaFrames(w) { var NG = window.GenPetCore || PetCore, live = window.PetCore; if (V2Gear.reworkNakamoto) V2Gear.reworkNakamoto(NG);
    var nk = Object.assign(NG.characterPet('nakamoto', { tier: 'legendary' }), { band: 'none', crown: 'none', armor: 'none', cape: 'none', weapon: 'none', background: 'solid', bgColor: '#2a3a2e', pattern: 'none' });
    var ids = w && V.communityGear ? V.communityGear(w) : [];
    if (!ids.length) return [0, 1, 2, 3].map(function (f) { return NG.render(nk, { stage: 5, frame: f, gearOverride: {} }); });
    window.PetCore = NG; try { return framesWith(nk, 5, ids, [], 6); } finally { window.PetCore = live; } }
  /** communityGearText(w): 'Headwear: X · Grip: Y' (or '' when Nakamoto has no community gear yet). */
  function communityGearText(w) { var g = (w && w.community && w.community.gear) || {}; return (V.V2_SLOTS || []).filter(function (s) { return g[s]; }).map(function (s) { return V.slotLabel(s) + ': ' + g[s].label + (g[s].legendary ? ' ★' : ''); }).join(' · '); }
  /** communityWearing(w): 'Wearing: Headwear: X · …' or 'Wearing: no gear yet' (always shown for the community pet). */
  function communityWearing(w) { var t = communityGearText(w), c = w && w.community, g = (c && c.gear) || {};
    if (c && c.returned && !g.head && window.WizardSprite) t = 'Headwear: Wizard Hat ★ (signature)' + (t ? ' · ' + t : ''); /* synthetic signature piece, display only */
    return 'Wearing: ' + (t || 'no gear yet'); }
  /** familyHtml(w, p): the family line for the pet popup AND the public pet page (2026-10-15, Jake). Parents linked ('none (hatched from a mint)' for
   * minted pets), every breeding partner with block and the resulting egg/pet linked, breedings n/max (+ cooldown). Display only. */
  /* family-tree-fix (2026-10-19, display only): dead / released parents, partners and children are marked (🪦 / released); 'Bred with' is grouped by
   * partner with a count, and after FAM_SHOW children the rest fold away behind a 'Show all' toggle (reads well at 390px). */
  var FAM_SHOW = 6;
  function goneOf(q) { return !q ? '' : q.released ? 'released' : q.dead ? 'dead' : ''; }
  function goneMark(q) { var g = goneOf(q); return g === 'dead' ? ' <span class="fgone" title="Died">🪦</span>' : g === 'released' ? ' <span class="fgone">(released)</span>' : ''; }
  function familyHtml(w, p, tip) { var V2 = window.V2Rules, L = function (id) { var q = w.byId[id]; return '<a href="pet.html?id=' + id + '"' + (goneOf(q) ? ' class="fgonelink"' : '') + '>' + (q ? esc(q.name) + ' ' : '') + '#' + id + '</a>' + goneMark(q); }, out = [];
    out.push('<b>Parents:</b> ' + (p.parents && p.parents.length ? p.parents.map(L).join(' × ') + ' <span class="muted">(bred at block ' + Number(p.hatchBlock).toLocaleString('en-US') + ')</span>' : 'none (hatched from a mint)'));
    var groups = [], byMate = {}, nKids = 0;
    (p.children || []).forEach(function (cid) { var c = w.byId[cid]; if (!c || !c.parents) return; var mate = c.parents.filter(function (x) { return String(x) !== String(p.id); })[0], k = String(mate);
      if (!byMate[k]) { byMate[k] = { mate: mate, kids: [] }; groups.push(byMate[k]); } byMate[k].kids.push(c); nKids++; });
    if (!groups.length) out.push('<b>Bred with:</b> nobody yet');
    else { var shown = 0, gh = groups.map(function (g) { var first = shown;
        var ks = g.kids.map(function (c, i) { var hide = shown++ >= FAM_SHOW; return '<span class="fbkid' + (hide ? ' fmore' : '') + '">' + (i ? ', ' : '') + '<a href="pet.html?id=' + c.id + '" title="block ' + Number(c.hatchBlock).toLocaleString('en-US') + '"' + (goneOf(c) ? ' class="fgonelink"' : '') + '>' + (c.stage === 0 ? 'Egg ' : '') + '#' + c.id + ' ' + esc(c.name) + '</a>' + goneMark(c) + '</span>'; });
        var hid = ks.filter(function (x) { return x.indexOf('fbkid fmore') >= 0; }).length, vis = ks.length - hid;
        return '<div class="fbgroup' + (first >= FAM_SHOW ? ' fmore' : '') + '">' + (g.mate != null ? L(g.mate) : '?') + ' <span class="fbcount">×' + g.kids.length + '</span>: ' + ks.join('') +
          (hid && vis ? ' <span class="fbless muted">+' + hid + ' more</span>' : '') + '</div>'; }).join('');
      out.push('<b>Bred with:</b> ' + groups.length + ' partner' + (groups.length === 1 ? '' : 's') + ', ' + nKids + ' ' + (nKids === 1 ? 'child' : 'children') + '<div class="fbred">' + gh +
        (nKids > FAM_SHOW ? '<button type="button" class="fbtoggle" onclick="this.parentNode.classList.toggle(\'open\')"><span class="fbmore">Show all ' + nKids + ' children ▾</span><span class="fbfew">Show fewer ▴</span></button>' : '') + '</div>'); }
    if (p.carried && p.carried.length) out.push('<b>Carries:</b> ' + p.carried.map(function (c) { return esc(V2 && V2.speciesLabel ? V2.speciesLabel(c.species) : c.species) + ' traits from ' + L(c.from) + ' <span class="muted">(' + esc(String(c.stat).toUpperCase()) + ' ' + c.value + ' floor for its future children)</span>'; }).join(' · '));
    var cd = V2 && p.lastBreed != null && tip != null && tip - p.lastBreed < V2.BREED_COOLDOWN ? ' · cooldown ' + (V2.BREED_COOLDOWN - (tip - p.lastBreed)) + ' blocks' : '';
    out.push('<b>Breedings:</b> ' + (p.breeds || 0) + (V2 && V2.breedCapOn && V2.breedCapOn(tip) ? '/' + V2.BREED_MAX : '') + cd);
    return '<div class="small famline">' + out.map(function (x) { return '<div>' + x + '</div>'; }).join('') + '</div>'; }
  /** bredFrom(w, p, jump): '💞 Bred from #A Name × #B Name' chip for any bred pet/egg (p.parents); '' otherwise. jump adds data-jump for in-page jumps. Display only. */
  function bredFrom(w, p, jump) { if (!p || !p.parents || p.parents.length < 2) return ''; var L = function (id) { var q = w.byId[id]; return '<a href="pet.html?id=' + id + '"' + (jump ? ' data-jump="' + id + '"' : '') + '>#' + id + (q ? ' ' + esc(q.name) : '') + '</a>'; };
    return '<span class="chip origin bred bredfrom">💞 Bred from ' + L(p.parents[0]) + ' × ' + L(p.parents[1]) + '</span>'; }
  /** communityStats(w, rowsN): the home page community-pet readout numbers (same formulas as v2-pages.js front()), for the play page. Display only. */
  function communityStats(w, rowsN) { var V = window.V2Rules, c = w.community, T = V.WIZARD_THRESHOLDS, N = V.STAGE_NAMES, wiz = !!c.returned, st = c.petStage;
    var lo = wiz ? T[st] : 0, hi = wiz && st < 5 ? T[st + 1] : null, fed = wiz ? c.wizardFed : 0;
    return { stage: N[st], fed: Math.floor(wiz ? c.wizardFed : c.burned), next: hi ? Math.ceil(hi - fed - 1e-6) : null, nextName: hi ? N[st + 1] : null, pct: hi ? Math.min(100, 100 * (fed - lo) / (hi - lo)) : 100, burns: rowsN, pets: w.pets.length }; }
  /** careTarget(w, p, tip): the care line pet p is actually growing toward, from the SAME per-pet thresholds the rules engine stages it with
   * (V2Rules.petThresholds: species scale + the owner's Mythic discount; the community pet keeps its own scale). Display only (2026-10-19, build mythic-target-fix):
   * every care target / Mythic line / progress bar uses this so the My Pets card, detail panel and pet page agree. pct = care toward Mythic, capped at 100. */
  function careTarget(w, p, tip) { var V = window.V2Rules, th = V.petThresholds ? V.petThresholds(w, p, tip) : V.thresholdsFor(p.species, tip), base = V.thresholdsFor(p.species, tip);
    return { th: th, mythic: th[5], discount: th[5] < base[5], pct: Math.min(100, 100 * p.care / th[5]) }; }
  window.V2Render = { careTarget: careTarget, communityStats: communityStats, communityWearing: communityWearing, wizardGear: wizardGear, bredFrom: bredFrom, communityFrames: communityFrames, communityGearText: communityGearText, drawSnugBeanie: drawSnugBeanie, drawEyeGear: drawEyeGear, fitAnchors: fitAnchors, drawFace: drawFace, faceSpots: faceSpots, facePos: facePos, isV2Face: isV2Face, paint: paint, animate: animate, framesWith: framesWith, petFrames: petFramesC, petFramesRaw: petFrames, hungerDays: hungerDays, worn: worn, lazy: lazy, itemIcon: itemIcon, cpLogo: cpLogo, iconCanvas: iconCanvas, gearPicker: gearPicker, esc: esc, TID: TID, familyHtml: familyHtml };
})();
/* Launch (Jake 2026-10-14): "Share to Telegram" + branching family tree (parents + grandparents) on the pet detail dialog and pet page. Opens t.me/share with the pet's deep link (pet.html?id=N) and a short brag. */
(function () {
  if (typeof document === 'undefined' || !document.addEventListener) return;
  var TL = ['Common', 'Uncommon', 'Rare', 'Legendary'];
  function shareUrl(p) { var V = window.V2Rules, base = location.href.replace(/[^\/]*([?#].*)?$/, ''), link = base + 'pet.html?id=' + p.id;
    var sp = V && V.speciesLabel ? V.speciesLabel(p.species) : p.species, text = 'Meet ' + (p.name || ('#' + p.id)) + ' #' + p.id + ': a ' + (TL[p.tier] || '') + ' ' + sp + ' (' + (p.stageName || '') + ') on XCPETS. Burned with love. 🔥 @XCPets';
    return 'https://t.me/share/url?url=' + encodeURIComponent(link) + '&text=' + encodeURIComponent(text); }
  function button(p) { var a = document.createElement('a'); a.className = 'btn tgshare'; a.target = '_blank'; a.rel = 'noopener'; a.href = shareUrl(p); a.textContent = '📣 Share to Telegram'; a.setAttribute('data-pet', p.id); return a; }
  function petById(id) { try { return window.V2Mock.world().byId[id]; } catch (e) { return null; } }
  /* Share image (Jake 2026-10-15, UI only): renders the pet card to a PNG (crisp nearest-neighbour sprite + name/#id/tier/species/stage) and shares the FILE
   * via navigator.share({files}) when canShare allows; otherwise copies the PNG to the clipboard (ClipboardItem) and downloads it. Toast says which happened. */
  function cardCanvas(p) { var W = 1200, H = 1200, c = document.createElement('canvas'); c.width = W; c.height = H; var g = c.getContext('2d'), V = window.V2Rules;
    var TCOL = ['#9aa3b5', '#4fd18b', '#4f9dff', '#ffc93c'], col = TCOL[p.tier] || '#3ddc84';
    g.fillStyle = '#0d1117'; g.fillRect(0, 0, W, H); g.fillStyle = '#18221b'; g.fillRect(16, 16, W - 32, H - 32); g.strokeStyle = col; g.lineWidth = 10; g.strokeRect(21, 21, W - 42, H - 42);
    var s = document.createElement('canvas'); s.width = s.height = 32; try { var w = window.V2Mock.world(); window.V2Render.paint(s, window.V2Render.petFrames(p, w)[0]); } catch (e) {}
    g.imageSmoothingEnabled = false; g.drawImage(s, 152, 40, 896, 896); /* 32px sprite x28 nearest-neighbour */
    var sp = V && V.speciesLabel ? V.speciesLabel(p.species) : p.species, F = "'Press Start 2P', monospace"; g.textAlign = 'center'; g.fillStyle = '#ffffff';
    g.font = '48px ' + F; g.fillText(((p.name || '') + ' #' + p.id).slice(0, 22), W / 2, 1010);
    g.fillStyle = col; g.font = '32px ' + F; g.fillText((TL[p.tier] || '') + ' ' + sp + ' · ' + (p.stageName || ''), W / 2, 1072);
    g.fillStyle = '#3ddc84'; g.font = '24px ' + F; g.fillText('xcpets.fun', W / 2, 1140); return c; }
  function toast(msg) { var t = document.createElement('div'); t.className = 'shtoast'; t.textContent = msg; t.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#18221b;color:#fff;border:2px solid #3ddc84;border-radius:10px;padding:10px 16px;z-index:99999;font-size:14px;max-width:90vw;text-align:center';
    document.body.appendChild(t); setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 4000); }
  /* Pet share (Jake 2026-10-15): row sits under the stats (pet page #stats, play dialog #dStats). Share image = native share sheet with the PNG file
   * + text + pet URL when navigator.canShare({files}) (mobile: pick X / Telegram / ...); else copy PNG to clipboard + download (as before).
   * Post on X = copy PNG (ClipboardItem) then open x.com/intent/post with text + url; no clipboard -> download + toast. Save image = download. */
  function petLink(p) { return location.href.replace(/[^\/]*([?#].*)?$/, '') + 'pet.html?id=' + p.id; }
  function shortText(p) { return (p.name || ('#' + p.id)) + ' #' + p.id + ' on XCPETS'; }
  function withBlob(p, fn) { cardCanvas(p).toBlob(function (blob) { if (!blob) { toast('Could not make the image'); return; } fn(blob, 'xcpets-' + p.id + '.png'); }, 'image/png'); }
  function download(blob, name) { var url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.parentNode.removeChild(a); setTimeout(function () { URL.revokeObjectURL(url); }, 10000); }
  function copyPng(blob) { return window.ClipboardItem && navigator.clipboard && navigator.clipboard.write ? navigator.clipboard.write([new window.ClipboardItem({ 'image/png': blob })]) : Promise.reject(new Error('no clipboard')); }
  function shareImage(p) { var link = petLink(p), text = shortText(p) + ' 🔥 @XCPets';
    withBlob(p, function (blob, name) { var file = null; try { file = new File([blob], name, { type: 'image/png' }); } catch (e) {}
      if (file && navigator.canShare && navigator.share && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], text: text + ' ' + link, url: link }).then(function () { toast('Image shared'); }, function (e) { if (!e || e.name !== 'AbortError') fallback(); }); return; }
      fallback();
      function fallback() { download(blob, name); copyPng(blob).then(function () { toast('Image copied to clipboard and downloaded'); }, function () { toast('Image downloaded'); }); } }); }
  function postX(p) { /* (2026-10-16) open the X intent right away with text + link (no blank tab), then try to put the card image on the clipboard; never auto-downloads */
    var intent = 'https://x.com/intent/post?text=' + encodeURIComponent(shortText(p) + ' @XCPets') + '&url=' + encodeURIComponent(petLink(p));
    window.open(intent, '_blank', 'noopener');
    withBlob(p, function (blob) { copyPng(blob).then(function () { toast('Image copied: paste it into your post (Ctrl/Cmd+V)'); }, function () { toast('Tip: use 💾 Save image to attach the pet card to your post'); }); }); }
  function saveImage(p) { withBlob(p, function (blob, name) { download(blob, name); toast('Image saved'); }); }
  function btn(cls, label, aria, fn, p) { var b = document.createElement('button'); b.type = 'button'; b.className = 'btn ' + cls; b.textContent = label; b.title = aria; b.setAttribute('aria-label', aria); b.setAttribute('data-pet', p.id); b.onclick = function () { fn(p); }; return b; }
  function imgButton(p) { return btn('imgshare', '🖼️ Share image', 'Share the pet card image', shareImage, p); }
  function shareRow(p) { var d = document.createElement('p'); d.className = 'petshare'; d.setAttribute('data-pet', p.id);
    [imgButton(p), btn('xshare', '𝕏 Post on X', 'Post on X with the pet card image', postX, p), button(p), btn('ghost saveimg', '💾 Save image', 'Download the pet card image', saveImage, p)].forEach(function (b, i) { if (i) d.appendChild(document.createTextNode(' ')); d.appendChild(b); });
    return d; }
  window.XCPShare = { cardCanvas: cardCanvas, shareImage: shareImage, postX: postX, saveImage: saveImage, shareRow: shareRow };
  var TC = ['common', 'uncommon', 'rare', 'legendary'];
  /* family-tree-fix (2026-10-19, display only). Chart layout: ancestors ABOVE the pet (parents, grandparents; the ancestor block is drawn as the old
   * top-down tree flipped with scaleY(-1), nodes flipped back), the pet, then its own children as a row UNDER it (so a parent with no parents of its own,
   * e.g. #891 or #4248, no longer gets an empty box). A grandparent that has parents of its own gets a '+ older ancestors' link to its own page.
   * Dead / released pets: greyed sprite + 🪦 / 'released'. More than FT_SHOW children fold behind a '+N more' toggle. Legendary/Uncommon boxes use dark text. */
  var FT_SHOW = 6;
  function goneOf(q) { return !q ? '' : q.released ? 'released' : q.dead ? 'dead' : ''; }
  function node(t, opts) { opts = opts || {}; var w = null, p = null; try { w = window.V2Mock.world(); p = w.byId[t.id]; } catch (e) {}
    var g = goneOf(p), d = document.createElement('div'); d.className = 'ftnode tier-' + (TC[t.tier] || '') + (g ? ' ftgone ft-' + g : '') + (opts.self ? ' ftself' : '');
    if (opts.older) { var o = document.createElement('a'); o.className = 'ftolder'; o.href = 'pet.html?id=' + t.id; o.textContent = '+ older ancestors'; o.title = 'Open #' + t.id + ' to see its parents'; d.appendChild(o); }
    var c = document.createElement('canvas'); c.width = c.height = 32; c.className = 'ftsprite';
    try { window.V2Render.paint(c, window.V2Render.petFrames(p, w)[0]); } catch (e) {}
    var sp = window.V2Rules && window.V2Rules.speciesLabel ? window.V2Rules.speciesLabel(t.species) : t.species, a = document.createElement('a'); a.href = 'pet.html?id=' + t.id; a.appendChild(c);
    var s = document.createElement('span'); s.innerHTML = '<b></b><br><span class="muted"></span>'; s.firstChild.textContent = (p && p.stage === 0 && opts.kid ? 'Egg ' : '') + (t.name || '') + ' #' + t.id; s.lastChild.textContent = sp + ' · ' + (TL[t.tier] || ''); a.appendChild(s);
    if (g) { var m = document.createElement('span'); m.className = 'ftgonetag'; m.textContent = g === 'dead' ? '🪦 died' : 'released'; a.appendChild(m); a.title = g === 'dead' ? 'This pet died' : 'This pet was released'; }
    d.appendChild(a); return d; }
  function hasParents(id) { try { var q = window.V2Mock.world().byId[id]; return !!(q && q.parents && q.parents.length); } catch (e) { return false; } }
  function branch(t, lvl) { var li = document.createElement('li'); li.appendChild(node(t, { self: lvl === 0, older: lvl === 2 && hasParents(t.id) }));
    if (lvl < 2 && t.parents && t.parents.length) { var ul = document.createElement('ul'); t.parents.forEach(function (x) { if (x) ul.appendChild(branch(x, lvl + 1)); }); li.appendChild(ul); } return li; }
  function kidsRow(w, p) { var kids = (p.children || []).map(function (id) { return w.byId[id]; }).filter(Boolean); if (!kids.length) return null;
    var box = document.createElement('div'); box.className = 'ftkids'; var h = document.createElement('div'); h.className = 'ftkidshead small muted'; h.textContent = kids.length === 1 ? 'Child' : 'Children (' + kids.length + ')'; box.appendChild(h);
    var row = document.createElement('div'); row.className = 'ftkidsrow';
    kids.forEach(function (k, i) { var n = node({ id: k.id, name: k.name, species: k.species, tier: k.tier }, { kid: true }); if (i >= FT_SHOW) n.classList.add('ftmore'); row.appendChild(n); });
    box.appendChild(row);
    if (kids.length > FT_SHOW) { var b = document.createElement('button'); b.type = 'button'; b.className = 'fttoggle'; b.innerHTML = '<span class="fbmore">+' + (kids.length - FT_SHOW) + ' more ▾</span><span class="fbfew">Show fewer ▴</span>'; b.onclick = function () { box.classList.toggle('open'); }; box.appendChild(b); }
    return box; }
  function chart(id) { var V = window.V2Rules, w; try { w = window.V2Mock.world(); } catch (e) { return null; } var t = V && V.familyTree && V.familyTree(w, id, 2); if (!t) return null;
    var p = w.byId[id], box = document.createElement('div'); box.className = 'ftchart'; var anc = t.parents && t.parents.length, kids = kidsRow(w, p);
    if (!anc && !kids) return box; /* no parents and no children: the family line under it says 'Parents: none (hatched from a mint)' (2026-10-15) */
    if (anc) { var up = document.createElement('div'); up.className = 'ftup'; var ul = document.createElement('ul'); ul.appendChild(branch(t, 0)); up.appendChild(ul); box.appendChild(up); }
    else { var me = document.createElement('div'); me.className = 'ftme'; me.appendChild(node(t, { self: true })); box.appendChild(me); }
    if (kids) box.appendChild(kids);
    return box; }
  function trees() { document.querySelectorAll('ul.tree').forEach(function (u) { if (u.parentNode && u.parentNode.closest && u.parentNode.closest('ul.tree')) return; var m = /#(\d+)/.exec(u.textContent); var c = m && chart(+m[1]); if (c) u.parentNode.replaceChild(c, u); }); }
  var LINE = '#6b5';
  function css() { if (!document.getElementById('ftcss')) { var st = document.createElement('style'); st.id = 'ftcss'; st.textContent = '.ftchart{overflow-x:auto;padding:6px 0}.ftchart ul{display:flex;justify-content:center;padding:14px 0 0;margin:0;position:relative;list-style:none}.ftchart>ul,.ftup>ul{padding-top:0}.ftchart li{display:flex;flex-direction:column;align-items:center;position:relative;padding:14px 4px 0}.ftchart>ul>li,.ftup>ul>li{padding-top:0}.ftchart li::before,.ftchart li::after{content:"";position:absolute;top:0;width:50%;height:14px;border-top:2px solid #6b5;}.ftchart li::before{right:50%}.ftchart li::after{left:50%;border-left:2px solid #6b5}.ftchart li:only-child::before,.ftchart li:only-child::after{border-top:0}.ftchart li:first-child::before,.ftchart li:last-child::after{border-top:0}.ftchart li:last-child::before{border-right:2px solid #6b5;border-top:2px solid #6b5;width:50%}.ftchart li:last-child::after{border:0}.ftchart li:first-child::after{border-top:2px solid #6b5}.ftchart>ul>li::before,.ftchart>ul>li::after,.ftup>ul>li::before,.ftup>ul>li::after{display:none}.ftchart ul ul::before{content:"";position:absolute;top:0;left:50%;height:14px;border-left:2px solid #6b5}.ftchart ul ul{padding-top:28px}.ftchart ul ul::before{height:14px}.ftnode a{display:flex;flex-direction:column;align-items:center;text-decoration:none;color:inherit;border:2px solid #444;border-radius:6px;padding:4px 6px;background:rgba(0,0,0,.25);font-size:11px;text-align:center;min-width:72px}.ftsprite{width:48px;height:48px;image-rendering:pixelated}.ftnode.tier-rare a{border-color:#4af}.ftnode.tier-legendary a{border-color:#fb3}.ftnode.tier-uncommon a{border-color:#5c5}'
      /* family-tree-fix additions */
      + '.ftup{transform:scaleY(-1)}.ftup ul ul::before{height:28px}.ftup .ftnode{transform:scaleY(-1)}.ftchart .ftnode{display:flex;flex-direction:column;align-items:center;background:none}.ftchart .ftnode.tier-common a{background:#737a88}.ftchart .ftnode.tier-rare a{background:#3b76bf}'
      + '.ftchart .ftnode.tier-legendary a{background:#ffc93c;color:#1a1020}.ftchart .ftnode.tier-legendary a .muted{color:#4a3200}.ftchart .ftnode.tier-uncommon a{background:#4fd18b;color:#0d1a12}.ftchart .ftnode.tier-uncommon a .muted{color:#173d27}.ftnode.tier-rare a .muted,.ftnode.tier-common a .muted{color:rgba(255,255,255,.88)}'
      + '.ftnode.ftself a{box-shadow:0 0 0 2px #fff}.ftchart .ftnode.ftgone a{background:#55555c;color:#e8e8ec;border-color:#888;border-style:dashed}.ftchart .ftnode.ftgone a .muted{color:#d0d0d6}.ftnode.ftgone .ftsprite{filter:grayscale(1);opacity:.55}.ftgonetag{display:block;margin-top:2px;font-size:10px;font-weight:bold;background:#1a1020;color:#fff;border-radius:4px;padding:1px 5px}'
      + '.ftchart .ftnode a.ftolder{display:block;font-size:11px;margin:0 0 3px;padding:0;min-width:0;border:0;background:none;color:#7fd;white-space:nowrap;text-decoration:underline}'
      + '.ftme{display:flex;justify-content:center}.ftkids{position:relative;padding-top:18px;text-align:center}.ftkids::before{content:"";position:absolute;top:0;left:50%;height:16px;border-left:2px solid #6b5}.ftkidshead{margin:0 0 4px}.ftkidsrow{display:flex;flex-wrap:wrap;justify-content:center;gap:6px;border-top:2px solid #6b5;padding-top:8px;margin:0 auto;width:fit-content;max-width:min(640px,100%)}.ftkids:not(.open) .ftmore{display:none}'
      + '.fttoggle,.fbtoggle{margin:6px auto 0;display:block;background:none;border:1px solid #6b5;color:inherit;border-radius:6px;padding:3px 10px;font:inherit;font-size:12px;cursor:pointer}.fbtoggle{margin:4px 0 0}.fttoggle .fbfew,.fbtoggle .fbfew,.open>.fttoggle .fbmore,.open>.fbtoggle .fbmore{display:none}.open>.fttoggle .fbfew,.open>.fbtoggle .fbfew{display:inline}'
      + '.famline .fbred{margin:2px 0 0}.fbgroup{margin:2px 0 2px 10px;overflow-wrap:anywhere}.fbcount{font-weight:bold;color:#ffc93c}.fbred:not(.open) .fmore{display:none}.fbred.open .fbless{display:none}.fgone{white-space:nowrap}.fgonelink{opacity:.8}'
      + '@media(max-width:520px){.ftnode a{min-width:56px;font-size:10px}.ftsprite{width:32px;height:32px}.ftchart li{padding-left:2px;padding-right:2px}.ftkidsrow{gap:4px}.fbgroup{margin-left:4px}}'; (document.head || document.body).appendChild(st); } }
  function inject() { trees();
    var st = document.getElementById('stats'), m = /[?&]id=(\d+)/.exec(location.search);
    if (st && document.getElementById('page') && m && !document.querySelector('.petshare[data-pet="' + m[1] + '"]')) { var p = petById(+m[1]); if (p) { st.parentNode.insertBefore(shareRow(p), st.nextSibling); } }
    var ds = document.getElementById('dStats'), idm = ds && document.getElementById('dTitle') && /#(\d+)/.exec(document.getElementById('dTitle').textContent);
    if (ds && !document.getElementById('page') && idm) { var cur = ds.parentNode.querySelector('.petshare');
      if (cur && cur.getAttribute('data-pet') !== idm[1]) { cur.parentNode.removeChild(cur); cur = null; }
      if (!cur) { var q = petById(+idm[1]); if (q) ds.parentNode.insertBefore(shareRow(q), ds.nextSibling); } }
  }
  function start() { css(); new MutationObserver(inject).observe(document.body, { childList: true, subtree: true }); inject(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
