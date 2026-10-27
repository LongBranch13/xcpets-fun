/* XCPETS v2 shared rendering (every page): pet frames with v2 gear, STANDALONE 8-bit gear icons, and the
 * click-to-equip gear picker. LOCAL ONLY: no network. Needs PetCore, BonusGear, V2Gear, V2Rules. */
(function () {
  'use strict';
  var V = window.V2Rules;
  V2Gear.install(BonusGear);
  BonusGear.DEFS['v2-black-eye'] = BonusGear.DEFS['v2-black-eye'] || { slot: 'face', tier: 0, label: 'Black eye', at: 'eyes', map: ['nVVn.....', 'VnnV.....', 'nVVn.....'] };
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
  function paint(c, img) { if (!img || !img.data || img.data.length !== 4096) { if (window.console) console.warn('paint: skipped a malformed frame'); return; } c.getContext('2d').putImageData(imgOf(img), 0, 0); if (MYTH_MODE || c._mfx) mythAttach(c, img); if (window.V2Looks && (c._lkx || V2Looks.info(img))) V2Looks.attach(c, img); } /* wiz-black-fix: never throw on a bad frame */
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
    var PINK = [0xe0, 0x40, 0x60], LIPRED = [0xcd, 0x00, 0x00], INK = [0x1a, 0x10, 0x20], eL = a.eyeL, eR = a.eyeR, ey, ex, eyePx = {};
    [eL, eR].forEach(function (e) { if (e) e[2].forEach(function (q) { eyePx[q[0] + ',' + q[1]] = 1; }); });
    if (eL && eR) { ey = Math.round((eL[1] + eR[1]) / 2); ex = (eL[0] + eR[0]) / 2; }
    else if (eL || eR) { var e1 = eL || eR; ey = e1[1]; ex = e1[0] + (e1[0] < 16 ? 3 : -3); }
    else { ey = a.minY + Math.round((a.maxY - a.minY) * 0.35); ex = (a.minX + a.maxX) / 2; }
    var fb = FACE_FALLBACK[species] || { nose: 3, mouth: 5 }, mouth = null, nose = null, x, y;
    for (y = ey + 2; y <= Math.min(28, ey + 12) && !mouth; y++) { var xs = []; for (x = Math.round(ex - 7); x <= Math.round(ex + 7); x++) if (isC(x, y, PINK) || isC(x, y, LIPRED)) xs.push(x); /* naka-face-card: Nakamoto's card-red lips count as the mouth */
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
      if (a.spId === 'nakamoto' && a.stage >= 1 && a.stage <= 3 && hy + Math.ceil(h / 2) > a.maxY - 1) { var hy2 = Math.max(a.minY + h, a.maxY - 1 - Math.ceil(h / 2)); /* audit fix 2026-10-20: one row higher, so long blades (Black Swan quill) stay on the body in the up frame */ row = (function (r1, d1) { return function (r) { return r === a.gear.armor[0] ? r1(r) - d1 : r1(r); }; })(row, hy - hy2); hy = hy2; }
      y0 = hy - Math.floor(h / 2);
      var yA = Math.max(0, y0); if (a.spId === 'nakamoto' && a.stage >= 1 && a.stage <= 3) yA = Math.max(yA, y0 + h - 4); /* audit fix 2026-10-20: on his bust body the wide head bobs into the piece's top rows in the up frame; fit the grip to the body rows only */
      for (y = yA; y < Math.min(a.maxY - 1, y0 + h); y++) for (x = 0; x < 32; x++) if (a.isSil(x, y)) { mx = Math.max(mx, x); mn = Math.min(mn, x); }
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
  /* CHUD'S BEARD (owner Oct 22 2026): fitted to THIS face. Moustache row over the mouth, the mouth row (mouth pixels stay visible), then the jaw rows
   * down to a tapered chin, all inside the face outline (1 px outline kept), with sideburns up the cheek edges; never on eye pixels. */
  function drawBeard(img, sp, a) { var D = img.data, m = sp.mouth, eye = {}, BR = [0x6b, 0x3e, 0x1c], DK = [0x48, 0x28, 0x10], HL = [0x8c, 0x56, 0x2a];
    [a.eyeL, a.eyeR].forEach(function (e) { if (e) e[2].forEach(function (q) { eye[q[0] + ',' + q[1]] = 1; }); });
    var px = function (x, y) { var i = (y * 32 + x) * 4; return [D[i], D[i + 1], D[i + 2]]; }, key = function (x, y) { return px(x, y).join(','); };
    var put = function (x, y, c) { if (x < 0 || y < 0 || x > 31 || y > 31 || eye[x + ',' + y] || !a.isSil(x, y)) return; var i = (y * 32 + x) * 4; D[i] = c[0]; D[i + 1] = c[1]; D[i + 2] = c[2]; };
    var run = function (y) { var c = Math.round(m.x); if (y < 0 || y > 31 || !a.isSil(c, y)) return null; var l = c, r = c; while (a.isSil(l - 1, y)) l--; while (a.isSil(r + 1, y)) r++; return [l, r]; };
    var dark = function (c) { return c[0] + c[1] + c[2] < 0x80; }, mouthy = function (c) { return dark(c) || (c[0] > 0xa0 && c[1] < 0x70); };
    /* the face skin = the commonest non-dark colours on the rows just above the mouth; the beard only replaces skin (never shirt, belly, eyes) */
    var cnt = {}; for (var ys = m.y - 3; ys <= m.y; ys++) { var rr0 = run(ys); if (!rr0) continue; for (var xs = rr0[0] + 1; xs < rr0[1]; xs++) { var c0 = px(xs, ys); if (!mouthy(c0) && !eye[xs + ',' + ys]) cnt[c0.join(',')] = (cnt[c0.join(',')] || 0) + 1; } }
    var skinK = Object.keys(cnt).sort(function (p, q) { return cnt[q] - cnt[p]; }).slice(0, 2), skin = {}; skinK.forEach(function (k) { if (cnt[k] >= 3) skin[k] = 1; });
    if (skinK[0]) { var sc = skinK[0].split(',').map(Number), dist = Math.abs(sc[0] - BR[0]) + Math.abs(sc[1] - BR[1]) + Math.abs(sc[2] - BR[2]); if (dist < 140) { /* brown-on-brown (Bobo, Mumu...): a darker beard; a dark face gets a lighter one */
      var lum = sc[0] + sc[1] + sc[2], k2 = lum > 300 ? 0.55 : null; if (k2) { BR = BR.map(function (n) { return Math.round(n * k2); }); HL = HL.map(function (n) { return Math.round(n * k2); }); DK = DK.map(function (n) { return Math.round(n * k2); }); }
      else { BR = [0x2c, 0x18, 0x0c]; HL = [0x4a, 0x2a, 0x14]; DK = [0x1e, 0x10, 0x08]; if (lum < 200) { BR = [0x9a, 0x62, 0x30]; HL = [0xb8, 0x7c, 0x40]; DK = [0x7a, 0x4a, 0x22]; } } } }
    var isSkin = function (x, y) { return skin[key(x, y)] && a.isSil(x - 1, y) && a.isSil(x + 1, y); };
    var full = a.spId === 'lenny' ? 1 : 0 /* owner Oct 22: a little fuller on Lenny */, hH = a.maxY - a.minY, depth = Math.max(2, Math.round(hH * 0.18)) + full, y0 = m.y - 1, yEnd = Math.min(31, m.y + depth), lastY = y0;
    var skinW = function (y) { var r = run(y), n = 0; if (r) for (var x = r[0]; x <= r[1]; x++) if (skin[key(x, y)]) n++; return n; }, w0 = Math.max(skinW(m.y), skinW(m.y - 1)), hwB = Math.max(3, Math.round(w0 / 2) + 1) + full;
    for (var y = y0; y <= yEnd; y++) { var r = run(y); if (!r) break; var any = false; if (y > m.y && (skinW(y) > w0 * 1.3 + 2 || (sp.chinY != null && y > sp.chinY))) break; /* the face ends: a wider skin row is the chest/belly (Sarutobi, Doge) */
      for (var x = r[0] + 1; x < r[1]; x++) { if (!isSkin(x, y) || Math.abs(x - m.x) > hwB) continue; if (y === y0 && Math.abs(x - m.x) > 3 + full && x > r[0] + 2 && x < r[1] - 2) continue; /* top row: moustache + sideburns only */
        put(x, y, (x + 2 * y) % 5 === 0 ? HL : BR); any = true; }
      if (!any && y > m.y) break; lastY = y; }
    for (var yb = y0 - 2; yb < y0; yb++) { var rs = run(yb); if (!rs) continue; [rs[0] + 1, rs[1] - 1].forEach(function (x2) { if (isSkin(x2, yb)) put(x2, yb, BR); }); } /* sideburns up the cheeks */
    var rl = run(lastY); if (rl) for (var x3 = rl[0] + 1; x3 < rl[1]; x3++) { var c3 = px(x3, lastY); if (c3[0] === BR[0] && c3[1] === BR[1] && c3[2] === BR[2] || c3[0] === HL[0] && c3[1] === HL[1]) put(x3, lastY, DK); } /* darker chin edge */
    return [m.x, m.y]; }
  function drawFace(id, img, sp, a) { var d = typeof id === 'string' ? BonusGear.DEFS[id] : id;
    if (d && d.beard && a) { var bx = (V && V.BEARD_EXCLUDE) || {}, bsp = String(a.spId || ''), bsh = /^hyb/.test(bsp) ? null : bsp; if (bsh && bx[bsh]) return [0, 0]; return drawBeard(img, sp, a); } /* excluded bodies never show it (the rules also block rolling / wearing) */
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
  /* arena-injury (2026-10-19, display only): battle scars shown while blackEye is on (same blackEyeUntil window). 1) a BOLD shiner: a 2 px bruise
   * around the viewer-right eye (deep purple inner ring, near-black outer ring on the sides and below, a lilac highlight at the top-left), so it
   * reads at 1x on a phone; the eye pixels stay. 2) a pixel head BANDAGE: a white forehead wrap (grey lower edge, red stripe, a loose tail at the
   * viewer-left edge) 2-3 rows above the eyes. It is drawn BEFORE worn headwear (extraOv comes first), so hats sit on top; injureAfter() re-draws it
   * over the hat brim only when the hat hid almost all of it, so both read. Used by every species / hybrid / stage and the player Bitcoin Wizard. */
  var INJ = { ring1: [112, 40, 168], ring2: [52, 14, 78], hi: [200, 160, 255], wrap: [244, 244, 236], wrapS: [190, 192, 184], red: [214, 16, 32] };
  function injure(img, isSil, B, a) { var D = img.data, shin = [], sb = B[B.length - 1], other = B.length > 1 ? B[0] : null, x, y, i, band = [];
    var inBox = function (b, X, Y) { return b && X >= b.x0 && X <= b.x1 && Y >= b.y0 && Y <= b.y1; };
    var px = function (X, Y, c, rec) { if (X < 0 || Y < 0 || X > 31 || Y > 31) return; i = (Y * 32 + X) * 4; D[i] = c[0]; D[i + 1] = c[1]; D[i + 2] = c[2]; D[i + 3] = 255; if (rec) band.push([X, Y, c]); };
    for (y = sb.y0 - 2; y <= sb.y1 + 2; y++) for (x = sb.x0 - 2; x <= sb.x1 + 2; x++) { if (inBox(sb, x, y) || inBox(other, x, y) || !isSil(x, y)) continue;
      var dd = Math.max(sb.x0 - x, x - sb.x1, sb.y0 - y, y - sb.y1); if (dd === 2 && y < sb.y0) continue; /* no outer ring on the brow */
      if (other && dd === 2 && x < sb.x0 && x <= other.x1 + 1) continue; /* keep a gap to the other eye */
      px(x, y, dd === 1 ? INJ.ring1 : INJ.ring2); shin.push([x, y, dd === 1 ? INJ.ring1 : INJ.ring2]); }
    if (isSil(sb.x0 - 1, sb.y0 - 1)) px(sb.x0 - 1, sb.y0 - 1, INJ.hi); else if (isSil(sb.x0, sb.y0 - 1)) px(sb.x0, sb.y0 - 1, INJ.hi);
    /* bandage: forehead rows above the eyes, across the head run that holds the face centre */
    var eTop = Math.min.apply(null, B.map(function (b) { return b.y0; })), cx = Math.round((B[0].x0 + sb.x1) / 2), rows = [];
    for (y = eTop - 3; y <= eTop - 2; y++) if (y >= 0 && isSil(cx, y)) rows.push(y);
    if (!rows.length) for (y = eTop - 4; y >= Math.max(0, eTop - 6); y--) if (isSil(cx, y)) { rows.push(y); break; }
    if (!rows.length) { /* eyes on stalks with nothing above them (Snibby): wrap the top of the head just under the shiner */
      var eBot = Math.max.apply(null, B.map(function (b) { return b.y1; }));
      for (y = eBot + 3; y <= Math.min(31, eBot + 7) && rows.length < 2; y++) { var wd = 0; for (x = B[0].x0 - 2; x <= sb.x1 + 2; x++) if (isSil(x, y)) wd++; if (wd >= 4 && (!rows.length || y === rows[0] + 1)) { rows.push(y); if (!isSil(cx, y)) cx = B[0].x0 + 1; } } }
    var lim0 = B[0].x0 - 4, lim1 = sb.x1 + 4;
    rows.forEach(function (Y, n) { var st = cx; for (var dx = 0; dx < 8 && !isSil(st, Y); dx++) st = isSil(cx - dx, Y) ? cx - dx : isSil(cx + dx, Y) ? cx + dx : st; var x0 = st, x1 = st; while (x0 - 1 >= lim0 && isSil(x0 - 1, Y)) x0--; while (x1 + 1 <= lim1 && isSil(x1 + 1, Y)) x1++;
      if (x0 < x1) { x0++; x1--; } /* keep the ink outline */
      for (var X = x0; X <= x1; X++) px(X, Y, n === rows.length - 1 && rows.length > 1 ? INJ.wrapS : INJ.wrap, true);
      var rs = x0 + Math.max(1, Math.round((x1 - x0) * 0.3)); px(rs, Y, INJ.red, true); if (n === 0 && rows.length === 1) px(rs + 1, Y, INJ.red, true);
      if (n === 0) { var tx = x0 - 2; px(tx, Y, INJ.wrap, true); if (!isSil(tx - 1, Y + 1)) px(tx - 1, Y + 1, INJ.wrap, true); } });
    if (a) { a._band = band; a._shin = shin; } if (window.__V2INJ) window.__V2INJ.push({ sb: sb, rows: rows, n: band.length }); return band; }
  function injureAfter(img, a) { var band = a && a._band, D = img.data, vis = 0, sh = (a && a._shin) || [], sv = 0;
    sh.forEach(function (q) { var i = (q[1] * 32 + q[0]) * 4; if (D[i] === q[2][0] && D[i + 1] === q[2][1] && D[i + 2] === q[2][2]) sv++; });
    if (sh.length && sv < Math.ceil(sh.length * 0.7)) sh.forEach(function (q) { var i = (q[1] * 32 + q[0]) * 4; D[i] = q[2][0]; D[i + 1] = q[2][1]; D[i + 2] = q[2][2]; D[i + 3] = 255; }); /* eyewear hid the bruise: it shows around the lens */
    if (!band || !band.length) return;
    band.forEach(function (q) { var i = (q[1] * 32 + q[0]) * 4; if (D[i] === q[2][0] && D[i + 1] === q[2][1] && D[i + 2] === q[2][2]) vis++; });
    var redVis = band.some(function (q) { var i = (q[1] * 32 + q[0]) * 4; return q[2] === INJ.red && D[i] === INJ.red[0] && D[i + 1] === INJ.red[1] && D[i + 2] === INJ.red[2]; });
    if (vis >= Math.min(4, band.length) && !redVis) { /* hat covers the red stripe: move it onto a wrap pixel that still shows */
      var wv = band.filter(function (q) { var i = (q[1] * 32 + q[0]) * 4; return q[2] === INJ.wrap && D[i] === INJ.wrap[0] && D[i + 1] === INJ.wrap[1] && D[i + 2] === INJ.wrap[2]; });
      if (wv.length) { var q0 = wv[Math.floor(wv.length / 3)], j = (q0[1] * 32 + q0[0]) * 4; D[j] = INJ.red[0]; D[j + 1] = INJ.red[1]; D[j + 2] = INJ.red[2]; return; } }
    if (vis >= Math.min(4, band.length) && redVis) return; /* hat hid the wrap: put it back over the brim so both read */
    band.forEach(function (q) { var i = (q[1] * 32 + q[0]) * 4; D[i] = q[2][0]; D[i + 1] = q[2][1]; D[i + 2] = q[2][2]; D[i + 3] = 255; }); }
  /* sprite-fixes 2026-10-20: which way each species' face looks (side-view sprites). Headband knots and tails go to the BACK of the head: pet-core and the
   * band fits put them on the viewer's right, which is the back for front/left-facers but the FRONT for right-facers (Wojak, Chud, Dodo). Rule: on a
   * right-facer, the band pixels that stick out past the right edge of the head are mirrored to the left edge. (The McDonald's visor facing on left-facers is
   * handled separately on branch naka-flag-fix; this table can feed it.) */
  var FACING = { wojak: 'right', chud: 'right', dodo: 'right', doge: 'left', nakamoto: 'left', kevin: 'left' };
  function isKnotBand(id) { var d = BonusGear.DEFS[id], it = V.GEAR_BY_ID[id] || {}; return !!(d && it.slot === 'head' && (d.at === 'ninja' || (d.kind === 'band' && d.at === 'head'))); }
  function knotToBack(D, before, a) { var ch = [], p, x, y, L = 99, R = -1; for (p = 0; p < 1024; p++) { var i = p * 4; if (D[i] !== before[i] || D[i + 1] !== before[i + 1] || D[i + 2] !== before[i + 2]) ch.push(p); }
    if (!ch.length) return; var y0 = 99, y1 = -1; ch.forEach(function (q) { y = (q / 32) | 0; y0 = Math.min(y0, y); y1 = Math.max(y1, y); });
    var cnt = {}, mr = -1; ch.forEach(function (q) { y = (q / 32) | 0; cnt[y] = (cnt[y] || 0) + 1; if (mr < 0 || cnt[y] > cnt[mr]) mr = y; });
    ch.forEach(function (q) { x = q % 32; y = (q / 32) | 0; if (y === mr && a.isSil(x, y)) { L = Math.min(L, x); R = Math.max(R, x); } }); if (R < 0) return; /* the band's own span across the head (its widest row) */
    var mv = ch.filter(function (q) { return q % 32 > R; }).map(function (q) { var i = q * 4; return [q, D[i], D[i + 1], D[i + 2], D[i + 3]]; });
    mv.forEach(function (m) { var i = m[0] * 4; D[i] = before[i]; D[i + 1] = before[i + 1]; D[i + 2] = before[i + 2]; D[i + 3] = before[i + 3]; });
    mv.forEach(function (m) { var X = L + R - m[0] % 32; if (X < 0) return; var i = (((m[0] / 32) | 0) * 32 + X) * 4; D[i] = m[1]; D[i + 1] = m[2]; D[i + 2] = m[3]; D[i + 3] = m[4]; }); }
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
    if (g.s === 'shiner') { injure(img, a.isSil, B, a); return; }
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
    if (g.s === 'monocle') { var m = g.side === 'L' ? B[0] : B[B.length - 1]; if (m.x1 - m.x0 < 2) { var mcx = Math.round((m.x0 + m.x1) / 2); m = { x0: mcx - 1, x1: mcx + 1, y0: m.y0, y1: m.y1 }; } /* audit fix 2026-10-20: a 1-2 px eye anchor (Nakamoto Juvenile) gets a full 3 px lens, so the ring sits on the eye, not beside it */ var cxo = g.side === 'L' ? m.x0 - 1 : m.x1 + 1; /* side 'L' (2026-10-14): the pet's right eye = viewer-left; chain trails from the outer edge down the cheek */
      for (x = m.x0 - 1; x <= m.x1 + 1; x++) { put(x, top - 1, g.f); put(x, bot + 1, g.f); } for (y = top; y <= bot; y++) { put(m.x0 - 1, y, g.f); put(m.x1 + 1, y, g.f); }
      if (!g.chain) { for (y = bot + 2; y <= bot + 4; y++) put(cxo, y, g.f); return; }
      /* sprite-leftovers 2026-10-20 (owner): a monocle ON A CHAIN drapes. The chain leaves the lens's lower outer corner, sags in a curve and clips onto the
       * chest at the body's centre line (armour row), links alternating light/dark gold; only on the pet (never in the air). Drawn once and moved with the
       * bounce (rigid, see isRigid). Every species/stage: anchors come from the traced eye and the body rows. */
      var ax = cxo, ay = bot + 1, sx2 = 0, sn2 = 0, cyc = Math.min(a.maxY - 2, Math.max(bot + 4, a.row(a.gear.armor[0]) + 1));
      for (x = 0; x < 32; x++) if (a.isSil(x, cyc)) { sx2 += x; sn2++; } var bx2 = sn2 ? Math.round(sx2 / sn2) : 16, by2 = cyc;
      var kx = ax + (bx2 - ax) * 0.15, ky = by2 + 2, seen = {}, n2 = 0;
      for (var t2 = 0; t2 <= 1.0001; t2 += 0.02) { var u2 = 1 - t2, px2 = Math.round(u2 * u2 * ax + 2 * u2 * t2 * kx + t2 * t2 * bx2), py2 = Math.round(u2 * u2 * ay + 2 * u2 * t2 * ky + t2 * t2 * by2); if (py2 > a.maxY - 1) py2 = a.maxY - 1;
        if (seen[px2 + ',' + py2] || (px2 === ax && py2 === ay)) continue; seen[px2 + ',' + py2] = 1; if (eyeAt[px2 + ',' + py2]) continue; put(px2, py2, n2++ % 2 ? g.f : (g.l2 || 'g')); }
      put(bx2, by2, g.f); return; }
    if (FIT2) drawEyeGear.last = { sp: spid, lenses: B.map(function (b) { return { x0: b.x0 - (g.wide || 0), x1: b.x1 + (g.wide || 0), w: b.x1 - b.x0 + 1 + 2 * (g.wide || 0) }; }), eyes: E.map(function (e) { var xs = e[2].map(function (q) { return q[0]; }); return (Math.min.apply(null, xs) + Math.max.apply(null, xs)) / 2; }).sort(function (p, q) { return p - q; }) }; // test hook
    B.forEach(function (b) { var x0 = b.x0 - (g.wide || 0), x1 = b.x1 + (g.wide || 0);
      for (y = top; y <= bot; y++) for (x = x0; x <= x1; x++) put(x, y, y === top ? g.l[0] : g.l[1]);
      for (y = top; y <= bot; y++) { put(x0 - 1, y, g.f); put(x1 + 1, y, g.f); }
      for (x = x0 - 1; x <= x1 + 1; x++) put(x, top - 1, g.f); for (x = x0; x <= x1; x++) put(x, bot + 1, g.f); });
    if (B.length > 1) for (x = B[0].x1 + 1 + (g.wide || 0); x <= B[1].x0 - 1 - (g.wide || 0); x++) put(x, top - 1, g.f);
    var L = B[0].x0 - 2 - (g.wide || 0), R = B[B.length - 1].x1 + 2 + (g.wide || 0); /* audit fix 2026-10-20: arms stop inside the head outline (the edge pixel stays) and run at most 3 px, so they never poke past the head/hair */ for (x = L; x >= L - 2 && a.isSil(x - 1, top); x--) put(x, top, g.f); for (x = R; x <= R + 2 && a.isSil(x + 1, top); x++) put(x, top, g.f);
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
  /* BO BABY MARK (branch bo-1of1): a child of Bo Jackson, and every later generation of his line (art.boMark), wears Bo's eye black. Looks only.
   * v2 placement (owner Oct 26 2026: 'pepe wojack nakamoto and other don't have the black in the correct spot under eyes'): the eyes are the REAL eye pixels
   * of this body/stage/frame: the keyed render's eye keys (eye, pupil, white, lens...) for PetCore species and hybrid shapes, or V2Rules._spriteEyes for the
   * sprite-drawn bodies. The eye pixels are split into the two eyes at the widest x gap; under each eye a dark stripe exactly as wide as that eye is painted
   * on the first row below the eye's lowest pixel whose pixels are face skin (glasses rims, ink lines, brows, the mouth and tears are skipped, so on
   * Nakamoto it lands under his wire-rims). Painted only inside the pet's own silhouette. */
  var BO_EYE_KEYS = { eye: 1, pupil: 1, white: 1, lens: 1, iris: 1, sclera: 1, shine: 1 }, BO_SKIP_KEYS = { ink: 1, mouth: 1, brow: 1, frame: 1, tear: 1, eye: 1, pupil: 1, white: 1, lens: 1, iris: 1, sclera: 1, shine: 1, glasses: 1 };
  function boEyeGroups(eyes) { var xs = eyes.map(function (j) { return j & 31; }).filter(function (x, i, A) { return A.indexOf(x) === i; }).sort(function (p, q) { return p - q; }), cut = null, gap = 1;
    for (var i = 1; i < xs.length; i++) if (xs[i] - xs[i - 1] > gap) { gap = xs[i] - xs[i - 1]; cut = xs[i]; }
    if (cut == null) return [eyes]; return [eyes.filter(function (j) { return (j & 31) < cut; }), eyes.filter(function (j) { return (j & 31) >= cut; })]; }
  function boMarkSpots(k, eyes) { var out = [], isEye = {}; eyes.forEach(function (j) { isEye[j] = 1; });
    boEyeGroups(eyes).forEach(function (L) { if (!L.length) return; var lx = 32, rx = -1, by = -1; L.forEach(function (j) { lx = Math.min(lx, j & 31); rx = Math.max(rx, j & 31); by = Math.max(by, j >> 5); });
      for (var y = by + 1; y <= by + 4 && y < 29; y++) { var row = []; for (var x = lx; x <= rx; x++) { var q = y * 32 + x; if (!k[q] || isEye[q] || BO_SKIP_KEYS[k[q]]) continue; row.push(q); }
        if (row.length * 2 >= rx - lx + 1) { out = out.concat(row); break; } } });
    return out; }
  function boStyleEyes(sh, art, o0, k) { var ka = Object.assign({}, art, { species: sh, background: 'solid', bgColor: '#ff00ff', pattern: 'none', crown: 'none', band: 'none', armor: 'none', cape: 'none', weapon: 'none' }), L, M = [], j, real = [];
    try { L = ['classic', 'beady', 'tinted', 'star', 'laser'].map(function (e) { return PetCore.render(Object.assign({}, ka, { eyes: e }), o0).data; }); } catch (e) { return []; }
    for (j = 0; j < 29 * 32; j++) if (L.some(function (D) { return D[j * 4] !== L[0][j * 4] || D[j * 4 + 1] !== L[0][j * 4 + 1] || D[j * 4 + 2] !== L[0][j * 4 + 2]; })) M.push(j);
    M.forEach(function (q) { if (k[q] === 'ink' || BO_EYE_KEYS[k[q]]) real.push(q); }); if (!real.length) return M;
    var on = {}; real.forEach(function (q) { on[q] = 1; }); real.slice().forEach(function (q) { var x = q & 31, y = q >> 5; [[-1, 1], [0, 1], [1, 1]].forEach(function (dd) { var n = (y + dd[1]) * 32 + x + dd[0]; if (x + dd[0] >= 0 && x + dd[0] < 32 && !on[n] && k[n] === 'ink' && M.indexOf(n) < 0) { on[n] = 1; real.push(n); } }); }); /* the ink tail of a drawn eye just below the style area (Wojak Mythic ^ ^) */
    return real; }
  function boMarkFrames(fr, art, stage) { if (!fr || !art || !art.boMark || stage < 1 || !V._keyedRender) return fr; var sh = art.hybrid ? art.hybrid.shape : art.species, INK = [0x12, 0x10, 0x16];
    return fr.map(function (img, f) { var k, o0 = { stage: stage, frame: f, gearOverride: {} }; try { k = V._keyedRender(sh, art, o0).keys; } catch (e) { return img; } if (!k) return img;
      var eyes = [], j, SE = V._spriteEyes ? V._spriteEyes(sh, o0) : null;
      var mT = 29; for (j = 0; j < 29 * 32; j++) if (k[j] === 'mouth') { mT = j >> 5; break; } /* eye keys at or below the mouth's top row are teeth (Chud's 'white'), not eyes */
      for (j = 0; j < mT * 32; j++) if (BO_EYE_KEYS[k[j]]) eyes.push(j);
      if (!eyes.length && SE) eyes = SE.list.filter(function (q) { return (q >> 5) < 29; });
      if (!eyes.length) eyes = boStyleEyes(sh, art, o0, k); /* closed / drawn-line eyes (Pepe Elder lids, Wojak Mythic): the pixels that change with the eye style alone */
      if (!eyes.length) return img;
      var spots = boMarkSpots(k, eyes); if (!spots.length) return img; var d = new (img.data.constructor === Array ? Array : Uint8ClampedArray)(img.data.length); for (j = 0; j < d.length; j++) d[j] = img.data[j];
      spots.forEach(function (q) { d[q * 4] = INK[0]; d[q * 4 + 1] = INK[1]; d[q * 4 + 2] = INK[2]; d[q * 4 + 3] = 255; });
      return Object.assign({}, img, { data: d }); }); }
  if (V) V._boMarkSpots = boMarkSpots;
  function framesWith(art, stage, itemIds, extraOv, cap, baseGo) { if (art && art.boMark) return boMarkFrames(framesWithB(art, stage, itemIds, extraOv, cap, baseGo), art, stage); return framesWithB(art, stage, itemIds, extraOv, cap, baseGo); }
  function framesWithB(art, stage, itemIds, extraOv, cap, baseGo) {
    if (art && window.ContestSprite && ContestSprite.SPECIES.indexOf(art.species) >= 0 && !art.hybrid) return contestFrames(art, stage, itemIds); /* contest eggs (branch contest-eggs, DRAFT; ContestSprite not loaded by any page yet = inert) */
    if (art && art.species === 'funtrump' && !art.hybrid && window.FuntrumpSprite) return ftPetFrames(art, stage, itemIds); /* player FUNTRUMP (branch funtrump-community, inert: none exist) */
    if (art && art.hybrid && art.hybrid.shape === 'funtrump' && window.FuntrumpSprite) return ftHybFrames(art, stage, itemIds); /* FUNTRUMP-body hybrid: FuntrumpSprite gear layer */
    if (art && art.species === 'kek' && !art.hybrid && window.KekSprite) return kekPetFrames(art, stage, itemIds); /* player Lord Kek (gated, after his Cold Storage) */
    if (art && art.hybrid && art.hybrid.shape === 'kek' && window.KekSprite) return kekHybFrames(art, stage, itemIds); /* Kek-BODY hybrid: KekSprite gear layer (PetCore has no Kek anchors) */
    if (art && art.hybrid && art.hybrid.shape === 'wizard' && window.WizardSprite) return wizardHybridFrames(art, stage, itemIds, extraOv); /* Wizard-bodied hybrid (wizard-hybrids branch) */
    if (art && art.species === 'wizard' && !art.hybrid && window.WizardSprite) return wizardPetFrames(art, stage, itemIds, extraOv); /* player Bitcoin Wizard (Cold Storage rules): blue palette, own sprite */
    var fb = framesWith0(art, stage, itemIds, extraOv, cap, baseGo), k = (extraOv || []).indexOf('v2-black-eye'), off = DOGE_SHINER[stage];
    if (k < 0 || !art || art.species !== 'doge' || !off) return fb;
    var ov2 = extraOv.slice(); ov2.splice(k, 1); var fa = framesWith0(art, stage, itemIds, ov2, cap, baseGo);
    return fb.map(function (f, n) { var A = fa[n] ? fa[n].data : f.data, B = f.data, d = new Uint8ClampedArray(A), x, y;
      for (y = 0; y < 32; y++) for (x = 0; x < 32; x++) { var i = (y * 32 + x) * 4; if (A[i] === B[i] && A[i + 1] === B[i + 1] && A[i + 2] === B[i + 2]) continue;
        var X = x + off[0], Y = y + off[1]; if (X < 0 || Y < 0 || X > 31 || Y > 31) continue; var j = (Y * 32 + X) * 4;
        d[j] = B[i]; d[j + 1] = B[i + 1]; d[j + 2] = B[i + 2]; d[j + 3] = 255; }
      return Object.assign({}, f, { data: d }); }); }
  /* naka-flag-fix 2026-10-20 (display only, owner): side-brim caps point the way the species faces. The McDonald's visor's brim is drawn to the right;
   * species that face LEFT (Nakamoto: bun at the back, on the right; Doge: snout left) wear a mirrored copy. Applies to every pet of that species
   * (hybrids use their body-shape species); front-facing and right-facing species are unchanged. */
  /* rarity-sort 2026-10-20 (owner): every side-brim cap follows the same rule (bill / brim drawn to one side): mirrored on left-facers, right-facers unchanged. */
  var BRIM_SIDE = { 'mcd-visor': 1, 'based-cap': 1, 'smug-cap': 1, 'v2-kevin-hat': 1, 'v2-dodo-newsboy': 1, 'v2-chud-hat': 1 };
  function facedId(id, art) { if (!BRIM_SIDE[id] || !art) return id; var sp = art.hybrid ? art.hybrid.shape : art.species; if (FACING[sp] !== 'left') return id; /* sprite-fixes V2Render.FACING (shared table) */
    var fid = id + '~faceL', d = BonusGear.DEFS[id]; if (!BonusGear.DEFS[fid] && d && d.map) { BonusGear.DEFS[fid] = Object.assign({}, d, { map: d.map.map(function (r) { return r.split('').reverse().join(''); }) }); if (HAT_SIT[id] != null) HAT_SIT[fid] = HAT_SIT[id]; }
    return BonusGear.DEFS[fid] ? fid : id; }
  /* naka-flag-fix 2026-10-20 (display only, owner): a back flag (at:'banner', pole on the left, cloth to its right at the top) was hidden behind wide
   * heads + headwear (e.g. Nakamoto Adult in a McDonald's visor). General rule for every pet: if any cloth pixel of the flag would be hidden by the pet or
   * its gear in any frame, slide the pet (body + all other gear, background stays put) right by the smallest step that shows the whole cloth (pole at
   * x 1, else x 0), never past x 30; if no step clears it fully, the step that hides the fewest cloth pixels. Pets whose flag already shows are unchanged. */
  function framesWith0(art, stage, itemIds, extraOv, cap, baseGo) {
    var full = framesWithCore(art, stage, itemIds, extraOv, cap, baseGo);
    if (!art || stage < 1 || !full.length || (art.species === 'kek' || art.species === 'wizard' || art.species === 'funtrump')) return full;
    var ids = (itemIds || []).map(function (id) { return V.resolveItem ? V.resolveItem(id) : id; }), all = ids.concat(extraOv || []), ban = null;
    all.forEach(function (id) { var it = V.GEAR_BY_ID[id], d = BonusGear.DEFS[(it && it.id) || id]; if (d && d.at === 'banner' && d.map) ban = (it && it.id) || id; });
    if (!ban) return full;
    var BN = BonusGear.DEFS[ban].map, W = BN[0].length, y0 = Math.max(0, 28 - BN.length + 1), C = BonusGear.COLORS, cloth = [], r, c;
    for (r = 0; r < BN.length && BN[r].length > 1; r++) for (c = 1; c < BN[r].length; c++) if (BN[r][c] !== '.') cloth.push([c, y0 + r, BN[r][c]]);
    var hexc = function (k) { var h = String(C[k] || '#000000').replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; };
    var sp = PetCore.SPECIES.filter(function (s) { return s.id === art.species; })[0], key = Object.assign({}, art, { background: 'solid', bgColor: '#ff00ff', pattern: 'none' });
    var px0 = Math.max(1, BonusGear.anchors(PetCore.render(key, { stage: stage, frame: 0, gearOverride: {} }), PetCore.render(key, { stage: stage, frame: 0, gearOverride: {} }), sp || PetCore.SPECIES[0]).minX - 2);
    var hidden0 = 0; full.forEach(function (img) { var n = 0; cloth.forEach(function (q) { var x = px0 + q[0], i = (q[1] * 32 + x) * 4, k = hexc(q[2]); if (x < 32 && (img.data[i] !== k[0] || img.data[i + 1] !== k[1] || img.data[i + 2] !== k[2])) n++; }); hidden0 = Math.max(hidden0, n); });
    if (!hidden0) return full;
    var rest = all.filter(function (id) { var it = V.GEAR_BY_ID[id]; return ((it && it.id) || id) !== ban; }), restIds = (itemIds || []).filter(function (id) { return rest.indexOf(V.resolveItem ? V.resolveItem(id) : id) >= 0; }), restOv = (extraOv || []).filter(function (id) { return rest.indexOf(id) >= 0; });
    var km = framesWithCore(key, stage, restIds, restOv, cap, baseGo), KB = [255, 0, 255];
    var fg = km.map(function (img) { var m = new Uint8Array(1024), i; for (i = 0; i < 1024; i++) m[i] = Math.abs(img.data[i * 4] - KB[0]) + Math.abs(img.data[i * 4 + 1] - KB[1]) + Math.abs(img.data[i * 4 + 2] - KB[2]) > 40 ? 1 : 0; return m; });
    var maxX = -1; fg.forEach(function (m) { for (var i = 0; i < 1024; i++) if (m[i]) maxX = Math.max(maxX, i % 32); });
    var best = null; [1, 0].forEach(function (bx) { for (var dx = 1; dx <= 30 - maxX; dx++) { var n = 0; fg.forEach(function (m) { var h = 0; cloth.forEach(function (q) { var x = bx + q[0] - dx; if (x >= 0 && x < 32 && m[q[1] * 32 + x]) h++; }); n = Math.max(n, h); });
      if (!best || n < best.n) best = { n: n, dx: dx, bx: bx }; if (!n) break; } });
    /* naka-combined 2026-10-20 (owner: "do whatever looks best"): wide pets (Doge, hybrids on wide bodies) whose cloth stays over a quarter hidden even after the
     * best slide get the flag drawn IN FRONT of the pet, unslid (pole at its usual spot). Only in that case; pets whose flag already shows are unchanged. */
    if ((best ? best.n : hidden0) * 4 > cloth.length) { /* on top of the normal render (flag already behind), so every other piece keeps its place */
      var cyMax = cloth.reduce(function (m2, q) { return Math.max(m2, q[1]); }, 0);
      return full.map(function (img, f) { var out = Object.assign({}, img, { data: new Uint8ClampedArray(img.data) }); BonusGear.apply(ban, out, { minX: 0, maxX: 31, minY: 0, maxY: 31, bannerX: px0, isSil: function (x2, y2) { return y2 > cyMax + 1; } }, f); return out; }); }
    if (!best || best.n >= hidden0) return full;
    var real = framesWithCore(art, stage, restIds, restOv, cap, baseGo), dx = best.dx;
    return real.map(function (img, f) { var bg = PetCore.render(art, { stage: stage, frame: f, bgOnly: true }).data, m = fg[f], d = new Uint8ClampedArray(bg), sm = new Uint8Array(1024), x, y;
      for (y = 0; y < 32; y++) for (x = dx; x < 32; x++) { var j = y * 32 + x - dx; if (!m[j]) continue; var i = y * 32 + x; sm[i] = 1; d[i * 4] = img.data[j * 4]; d[i * 4 + 1] = img.data[j * 4 + 1]; d[i * 4 + 2] = img.data[j * 4 + 2]; d[i * 4 + 3] = 255; }
      var out = Object.assign({}, img, { data: d }), a = { minX: 0, maxX: 31, minY: 0, maxY: 31, bannerX: best.bx, bannerBehind: true, isSil: function (x2, y2) { return x2 >= 0 && y2 >= 0 && x2 < 32 && y2 < 32 && !!sm[y2 * 32 + x2]; } };
      BonusGear.apply(ban, out, a, f); return out; }); }
  /* sprite-leftovers 2026-10-20 (owner): held cards and signs (any held piece whose map is a closed rectangle: Rare Pepe card, Satoshi Card, tickets,
   * Join us sign...) are drawn LAST, after headwear, face pieces and their ink outlines, so nothing of the pet or its other gear covers them. */
  function isBoard(id) { var d = BonusGear.DEFS[id], m = d && d.map; if (!m || !m.length || !/^hand/.test(d.at || '')) return false; var w = m[0].length, h = m.length;
    return m[0].indexOf('.') < 0 && m[h - 1].indexOf('.') < 0 && m.every(function (r) { return r.charAt(0) !== '.' && r.charAt(w - 1) !== '.'; }); }
  /* ...and they sit just outside the body: the board's own edge stops one pixel short of the pet's outline, so its ink frame lands ON the pet's outline
   * (one shared line) instead of the pet's outline running over the card's edge. Only as far as the canvas allows. */
  function boardOut(id, fa) { var d = BonusGear.DEFS[id], w = d.map[0].length, k; /* keeps a 1px margin for the board's ink at the canvas edge */
    if (d.at === 'handL') { k = Math.min(2, fa.minX - w + 2 - 1); return k > 0 ? Object.assign({}, fa, { minX: fa.minX - k }) : fa; }
    k = Math.min(2, 30 - (fa.maxX - 1 + w - 1)); return k > 0 ? Object.assign({}, fa, { maxX: fa.maxX + k }) : fa; }
  var Z_ORDER = ['back', 'body', 'feet', 'hand', 'head', 'face'];
  function zOf(id) { return isBoard(id) ? Z_ORDER.length : Z_ORDER.indexOf((V.GEAR_BY_ID[id] || BonusGear.DEFS[id] || {}).slot); }
  function framesWithCore(art, stage, itemIds, extraOv, cap, baseGo) {
    itemIds = (itemIds || []).map(function (id) { return V.resolveItem ? V.resolveItem(id) : id; }); 
    if (art) { var roots0 = V.hybridRoots ? V.hybridRoots(art.hybrid ? art.hybrid.key : art.species) : [art.species], LK = V.SPECIES_LOCK || { 'lenny-monocle': { sp: 'lenny' } }; /* species-locked pieces (Lenny monocle; KEVIN name tag) never draw on other species */
      if (art.hybrid) itemIds = itemIds.filter(function (id) { return id !== 'wizard-hat'; }); /* hat rule: hybrids wear parents' ★ pieces except the hat (Wizard Hat included) */
      itemIds = itemIds.filter(function (id) { var L = LK[id]; return !L || roots0.indexOf(L.sp) >= 0 || (L.from != null && V.eligBlock && (V.eligBlock() || 0) < L.from); }); } /* retired ids (Heart crown, swan mask, Laser eyes) render as their current item */
    var go = Object.assign({}, baseGo || {}), ov = (extraOv || []).slice(); /* baseGo: optional gear override that must actually be drawn */
    /* Chud's beard as a HYBRID PART (Oct 22 2026): a hybrid with part {sp:'chud', part:'beard'} gets the fitted beard drawn on its own face (same drawBeard as the old gear) */
    if (art && art.hybrid && Array.isArray(art.hybrid.parts) && art.hybrid.parts.some(function (q) { return q.sp === 'chud' && q.part === 'beard'; }) && !((V.BEARD_EXCLUDE || {})[art.hybrid.shape]) && !((V.BEARD_PART_EXCLUDE || {})[art.hybrid.shape]) && ov.indexOf('v2-chud-beard') < 0 && (itemIds || []).indexOf('v2-chud-beard') < 0) ov.push('v2-chud-beard');
    (itemIds || []).forEach(function (id) { var it = V.GEAR_BY_ID[id]; if (!it) return; if (it.src === 'core' && !CORE_OVERLAY[id]) go[it.coreSlot] = it.id; else { if (CORE_OVERLAY[id] && !BonusGear.DEFS[id]) BonusGear.DEFS[id] = CORE_OVERLAY[id]; ov.push(it.id); } });
    stage = Math.max(0, stage); var F = window.V2Fit;
    // Fit pass (2026-10-14): base-game capes + armour are drawn by V2Fit (flowing capes behind the body; armour in the torso box), not pet-core
    var fitCape = null, fitArmor = null;
    if (F && stage > 0) { ov.forEach(function (id) { if (F.isCape(id)) fitCape = id; }); if (go.cape && F.isCape(go.cape)) { if (!fitCape) fitCape = go.cape; delete go.cape; }
      if (go.armor) { fitArmor = PetCore.ARMORS.filter(function (x) { return x.id === go.armor; })[0] || null; if (fitArmor) delete go.armor; } }
    if (fitCape) ov = ov.filter(function (id) { return !F.isCape(id); });
    var fr = art.hybrid ? V.hybridFrames(art, { stage: stage, gearOverride: go, gearCap: cap }) : PetCore.renderFrames(art, { stage: stage, gearOverride: go, gearCap: cap }); // hybrids: assembled art + badge
    if ((ov.length || fitCape || fitArmor) && stage > 0) { var sp = PetCore.SPECIES.filter(function (s) { return s.id === art.species; })[0];
      var key = Object.assign({}, art, { background: 'solid', bgColor: '#ff00ff', pattern: 'none' }, art.eyes === 'laser' ? { eyes: 'classic' } : {}), eyes = Object.assign({}, key, { eyes: 'star' }), KB = [255, 0, 255]; /* sprite-fixes 2026-10-20: gear anchors are measured on a laser-free key (Laser-eye beams run to the canvas edges and used to stretch the silhouette: headset bar, feet, held pieces, hoodie off the edge); the drawn frames keep their lasers */
      var order = ['back', 'body', 'feet', 'hand', 'head', 'face']; // z-order: cape (behind) < outfit/armour < feet < held < headwear < face
      ov.sort(function (a, b) { return zOf(a) - zOf(b); }); /* sprite-leftovers 2026-10-20 (owner): flat held boards (cards, signs, tickets) go in front of everything */
      var minYTop = Math.min.apply(null, fr.map(function (_, f) { var o = { stage: stage, frame: f, gearOverride: {} }; return BonusGear.anchors(PetCore.render(key, o), eyeRender(eyes, o), sp).minY; }));
      /* sprite-fixes 2026-10-20 (rigid bounce): worn pieces on the head, face and body are drawn ONCE on frame 0 and then moved with the body's own bounce
       * (the shift that maps the bare frame onto frame 0), so they bob with the pet and keep their exact shape on every frame instead of being re-fitted per
       * frame (Obsidian armour not bobbing / reshaping, face pieces not following the 1px bounce, KEVIN/Lenny Mythic outfits flickering, Mythic tags and bands
       * stuck in place). Capes (sway), held pieces, footwear (planted) and Beam eyes (intended flicker) keep their per-frame drawing. */
      var RIGID_SLOT = { head: 1, face: 1, body: 1 }, RIGID_SKIP = { 'beam-eyes': 1 }, rigidD = {}, bare0 = null;
      function isRigid(id) { if (/^fit:/.test(id)) return true; var d2 = BonusGear.DEFS[id] || {}, s2 = (V.GEAR_BY_ID[id] || d2).slot; return (!!RIGID_SLOT[s2] || !!d2.v2eye) && !RIGID_SKIP[id]; } /* sprite-leftovers: pieces traced on the eyes (monocle on a chain, a held item) bob with the face too */
      function bounceDy(bd2) { if (!bare0) return null; var best = null; for (var s3 = -2; s3 <= 2; s3++) { var m3 = 0; for (var y3 = 0; y3 < 28; y3++) for (var x3 = 0; x3 < 32; x3++) { var Y3 = y3 - s3, i3 = (y3 * 32 + x3) * 4; if (Y3 < 0 || Y3 > 31) { if (bd2[i3] !== 255 || bd2[i3 + 2] !== 255) m3++; continue; } var j3 = (Y3 * 32 + x3) * 4; if (bd2[i3] !== bare0[j3] || bd2[i3 + 1] !== bare0[j3 + 1] || bd2[i3 + 2] !== bare0[j3 + 2]) m3++; } if (!best || m3 < best[1]) best = [s3, m3]; } return best[1] <= 40 ? best[0] : null; }
      function grab(before, after) { var out = []; for (var p3 = 0; p3 < 1024; p3++) { var i4 = p3 * 4; if (before[i4] !== after[i4] || before[i4 + 1] !== after[i4 + 1] || before[i4 + 2] !== after[i4 + 2] || before[i4 + 3] !== after[i4 + 3]) out.push(p3, after[i4], after[i4 + 1], after[i4 + 2], after[i4 + 3]); } return out; }
      function paste(dst, L3, dy3) { for (var q3 = 0; q3 < L3.length; q3 += 5) { var y5 = ((L3[q3] / 32) | 0) + dy3; if (y5 < 0 || y5 > 31) continue; var i5 = (y5 * 32 + L3[q3] % 32) * 4; dst[i5] = L3[q3 + 1]; dst[i5 + 1] = L3[q3 + 2]; dst[i5 + 2] = L3[q3 + 3]; dst[i5 + 3] = L3[q3 + 4]; } }
      fr.forEach(function (img, f) { var o = { stage: stage, frame: f, gearOverride: {} }, bare = PetCore.render(key, o); var a = BonusGear.anchors(bare, eyeRender(eyes, o), sp); a.minYTop = minYTop; a.spId = art.species; a.stage = stage;
        if (f === 0) bare0 = bare.data; var fdy = f === 0 ? 0 : bounceDy(bare.data);
        function rigidDraw(id, draw) { if (f > 0 && fdy != null && rigidD[id]) { paste(img.data, rigidD[id], fdy); return; } var kb = isKnotBand(id) && FACING[art.species] === 'right', snap = (f === 0 && isRigid(id)) || kb ? new Uint8ClampedArray(img.data) : null; draw(); if (kb) knotToBack(img.data, snap, a); if (snap && f === 0 && isRigid(id)) rigidD[id] = grab(snap, img.data); }
        var geared = PetCore.render(key, { stage: stage, frame: f, gearOverride: go, gearCap: cap }), gd = geared.data, bd = bare.data;
        a.isFg = function (x, y) { if (x < 0 || y < 0 || x > 31 || y > 31) return false; var i = (y * 32 + x) * 4; return a.isSil(x, y) || Math.abs(gd[i] - KB[0]) + Math.abs(gd[i + 1] - KB[1]) + Math.abs(gd[i + 2] - KB[2]) > 40; };
        var arm = PetCore.render(key, { stage: stage, frame: f, gearOverride: { armor: 'gold' } }).data; // where pet-core puts armour (face-safe torso seed)
        a.armorAt = function (x, y) { var i = (y * 32 + x) * 4; return arm[i] !== bd[i] || arm[i + 1] !== bd[i + 1] || arm[i + 2] !== bd[i + 2]; };
        a.bareAt = function (x, y) { var i = (y * 32 + x) * 4; return bd[i] + ',' + bd[i + 1] + ',' + bd[i + 2]; };
        var fpr = PetCore.render(key, { stage: stage, frame: f, gearOverride: {}, faceProbe: true }).data; /* marked face skin (Sarutobi small maps, 2026-10-16): armour/outfits never cover it */
        a.isFaceSkin = function (x, y) { if (x < 0 || y < 0 || x > 31 || y > 31) return false; var i = (y * 32 + x) * 4; return fpr[i] === 255 && fpr[i + 1] === 0 && fpr[i + 2] === 254; };
        a.isGear = function (x, y) { var i = (y * 32 + x) * 4; return gd[i] !== bd[i] || gd[i + 1] !== bd[i + 1] || gd[i + 2] !== bd[i + 2]; };
        if (fitCape) F.cape(img, a, fitCape, f);
        if (fitArmor) rigidDraw('fit:' + fitArmor.id, function () { F.armor(img, a, fitArmor); });
        // headwear redo (2026-10-14): headwear never hides the eyes. Snapshot before the first head piece, restore the eye pixels after the last one
        // (face pieces such as shades come after and may still cover them).
        var eyePx = [].concat(a.eyeL ? a.eyeL[2] : [], a.eyeR ? a.eyeR[2] : []), headSnap = null, slotOf = function (id) { return (V.GEAR_BY_ID[id] || BonusGear.DEFS[id] || {}).slot; };
        function restoreEyes() { if (!headSnap) return; eyePx.forEach(function (q) { var i = (q[1] * 32 + q[0]) * 4; img.data[i] = headSnap[i]; img.data[i + 1] = headSnap[i + 1]; img.data[i + 2] = headSnap[i + 2]; }); headSnap = null; }
        ov.forEach(function (id) { if (slotOf(id) === 'head' && !headSnap) headSnap = new Uint8ClampedArray(img.data); else if (slotOf(id) !== 'head' && headSnap) restoreEyes();
          try { var d = BonusGear.DEFS[id], it = V.GEAR_BY_ID[id] || {};
          rigidDraw(id, function () {
          if (F && it.slot === 'body' && d && d.map && d.at === 'chest' && !d.fitSil) F.outfit(img, a, d.map, BonusGear.COLORS); else if (isV2Face(id)) drawFace(id, img, faceSpots(bare, a, art.species), a); else if (d && d.at === 'mouth' && d.map && d.slot !== 'face') drawMouthHeld(d, img, faceSpots(bare, a, art.species), a); else if (d && d.v2snug) drawSnugBeanie(img, a); else if (d && d.kind === 'band' && d.at === 'head' && d.map && bandLikeRed(img, key, stage, f, bare, d)) { /* fitted like the Red headband */ } else if (d && d.v2eye && drawEyeGear(img, a, d, d.v2eye.s === 'ninja' ? faceSpots(bare, a, art.species) : null) !== false) { /* traced */ } else { var fid = facedId(id, art), fa = fitAnchors(fid, a); if (isBoard(fid)) fa = boardOut(fid, fa); BonusGear.apply(fid, img, fa, f); } if (d && d.v2cig && ov.indexOf('v2-wojak-cig') < 0) { restoreEyes(); drawFace(d.v2cig, img, faceSpots(bare, a, art.species), a); } }); } catch (e) {} }); restoreEyes(); injureAfter(img, a); }); }
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
  function frKey(p, w, extra) { return p.id + '|' + p.stage + '|' + worn(w, p.id).map(function (g) { return g.item; }).join(',') + '|' + !!(p.blackEye || (extra && extra.blackEye)) + '|' + !!p.crowned + '|' + p.hatchBlock + '|' + JSON.stringify(p.art) + '|h' + (extra && extra.noHunger ? 0 : hungerDays(p, w)) + '|L' + looksOf(p, w, extra).map(function (L) { return L.id; }).join(','); }
  function petFramesC(p, w, extra) { var k = frKey(p, w, extra), f = frCache.get(k); if (f) return f; f = petFrames(p, w, extra); if (frCache.size >= FR_MAX) frCache.clear(); frCache.set(k, f); return f; }
  var lazyQ = new Map(), lazyObs = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(function (es) { es.forEach(function (e) { if (!e.isIntersecting) return; var j = lazyQ.get(e.target); if (!j) return; lazyQ.delete(e.target); lazyObs.unobserve(e.target); j(); }); }, { rootMargin: '300px' }) : null;
  function lazy(c, make, still) { var run = function () { var fr = make(); if (still) paint(c, fr[0]); else animate(c, fr); }; if (!lazyObs) return run(); lazyQ.set(c, run); lazyObs.observe(c); }
  /* wiz-black-fix 2026-10-21 (display only): a frame is drawable only if it is a full 32x32 RGBA buffer. */
  function okFrames(fr) { return !!(fr && fr.length && fr.every(function (f) { return f && f.data && f.data.length === 4096; })); }
  /* mythic-look HOLO pass (2026-10-24, owner: 'no i mean the holo art etc not be pixel but a real looking holo' + 'real shine'; DESIGN OPTIONS, display only,
   * default OFF, not deployed). The pet sprite stays crisp pixel art: its pixels are NOT changed. A Mythic pet's frames are tagged (MYTH_INFO) with the
   * option + the pet/gear silhouette (two keyed renders, magenta / green: pixels equal in both = pet + gear), and paint() lays a smooth DOM/CSS effect
   * over the canvas: real holo foil (gradients + color-dodge/overlay/screen blends + foil texture), a glossy specular glare streak that follows the
   * pointer (or phone tilt) and sweeps on its own otherwise, and twinkling glitter. Works for every sprite path that paints through V2Render
   * (player pets incl. hybrids + all gear, Wizard/Kek/FUNTRUMP sprite pets, Cold Storage portraits). Only transform/opacity animate (GPU, phones);
   * off-screen overlays pause; prefers-reduced-motion => static shine. Switch ?mythic=a|b|c|d|aura1|aura2|aura3|aura4|aura5 (localStorage xcpets-mythic-look; ?mythic=off clears).
   * a = iridescent holo foil, b = glowing halo + light sparkles, c = iridescent aura + orbiting light stars, d = metallic gold-foil laurels; aura1-3 (TRACE pass, owner 2:20 AM CT 'i want it to trace the pet like it does now') = today's look where only the MATERIAL of today's Mythic rim line changes: the overlay is masked to exactly the rim pixels (same path/thickness/position, per frame) with holo colour, a white core thread, glints running along it and glitter; no halo (at most a tight drop-shadow): 1 subtle, 2 strong, 3 prism chrome; aura4 (rare holo card pull) = aura2's exact traced line with a brighter saturated shifting rainbow, a bold white light sweep running round the outline every 3.6 s, star glints sitting on rim pixels and a one-time sparkle burst when the card first shows (very tight glow, no halo); aura5 (owner: 'too much rainbow should be electricity maybe') = the same exact traced line as electricity: blue-white/cyan core with a tight glow, flickering crackle, small jagged lightning arcs jumping to random rim pixels, an occasional bright zap sweep round the outline and an electric flash + spark burst on first show (reduced motion: static bright electric line, no arcs/animation). No rule/replay change. */
  /* mythic-aura5-live 2026-10-24 (owner 'love it, send it'): the electric aura5 is the DEFAULT live look for every player Mythic (replaces the gold rim line, same trace).
   * ?mythic=off = opt-out for that page view; ?mythic=a|b|c|d|aura1-5 = preview for that page view only. Nothing is stored any more: the old
   * xcpets-mythic-look localStorage key from preview days is removed so it can never force another look. Community / Cold Storage pets keep today's look
   * (no aura overlay) unless a preview value is in the URL. */
  var MYTH_URL = (function () { try { var q = /[?&]mythic=([a-z0-9]+)/.exec((window.location && window.location.search) || ''); try { window.localStorage.removeItem('xcpets-mythic-look'); } catch (e) {} return q ? q[1] : null; } catch (e) { return null; } })();
  var MYTH_PREVIEW = /^([abcd]|aura[12345])$/.test(MYTH_URL || '') ? MYTH_URL : null;
  var MYTH_MODE = MYTH_URL === 'off' ? null : (MYTH_PREVIEW || 'aura5');
  var MYTH_STILL = (function () { try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; } })();
  var MYTH_INFO = typeof WeakMap !== 'undefined' ? new WeakMap() : null, MYTH_FI = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
  /* mythRimOf(a, b): today's live Mythic aura rim, pixel for pixel, from the two keyed renders. pet-core draws it as mix(bg, #ffd23f, .55) one ring
   * outside the ink outline (so it reads (255,116,149) on the magenta key and (140,230,35) on the green key); the Wizard / Lord Kek / FUNTRUMP sprites
   * draw it as the opaque palette gold #ffc93c ring around their ink outline (found by growing in from the background). Nothing else is touched. */
  function mythRimOf(a, b) { var r = new Uint8Array(1024), p, i, near = function (d, i, R, G, B) { return Math.abs(d[i] - R) <= 2 && Math.abs(d[i + 1] - G) <= 2 && Math.abs(d[i + 2] - B) <= 2; };
    for (p = 0; p < 1024; p++) { i = p * 4; if (near(a, i, 255, 116, 149) && near(b, i, 140, 230, 35)) r[p] = 1; }
    var bg = function (x, y) { if (x < 0 || y < 0 || x > 31 || y > 31) return true; var j = (y * 32 + x) * 4; return (a[j] !== b[j] || a[j + 1] !== b[j + 1] || a[j + 2] !== b[j + 2]) || r[y * 32 + x]; };
    for (var it = 0, ch = true; ch && it < 40; it++) { ch = false; for (p = 0; p < 1024; p++) { if (r[p]) continue; i = p * 4; if (a[i] !== 255 || a[i + 1] !== 201 || a[i + 2] !== 60 || b[i] !== 255 || b[i + 1] !== 201 || b[i + 2] !== 60) continue;
      var x = p & 31, y = p >> 5; if (bg(x + 1, y) || bg(x - 1, y) || bg(x, y + 1) || bg(x, y - 1)) { r[p] = 1; ch = true; } } }
    return r; }
  /* mythRimUrls(r): crisp hi-res masks of that same rim: line = every rim pixel as a full square (same path / thickness / position as today),
   * core = a thin centre thread joining neighbouring rim pixels (the white hot highlight inside the line). */
  function mythRimUrls(r) { var k = 'r' + r.k; if (mythMasks[k]) return mythMasks[k]; var S = 12, W = 32 * S, mk = function () { var c = document.createElement('canvas'); c.width = c.height = W; return c; };
    var L = mk(), lg = L.getContext('2d'), C = mk(), cg = C.getContext('2d'), on = function (x, y) { return x >= 0 && y >= 0 && x < 32 && y < 32 && r[y * 32 + x]; };
    lg.fillStyle = '#fff'; cg.strokeStyle = cg.fillStyle = '#fff'; cg.lineWidth = S * 0.2; cg.lineCap = 'round';
    for (var p = 0; p < 1024; p++) if (r[p]) { var x = p & 31, y = p >> 5, cx = (x + 0.5) * S, cy = (y + 0.5) * S; lg.fillRect(x * S, y * S, S, S);
      cg.beginPath(); cg.arc(cx, cy, S * 0.1, 0, 7); cg.fill();
      [[1, 0], [0, 1], [1, 1], [-1, 1]].forEach(function (d) { if (!on(x + d[0], y + d[1])) return; if (d[0] && d[1] && (on(x + d[0], y) || on(x, y + d[1]))) return;
        cg.beginPath(); cg.moveTo(cx, cy); cg.lineTo(cx + d[0] * S, cy + d[1] * S); cg.stroke(); }); }
    var out = { line: L.toDataURL(), core: C.toDataURL() }; if (Object.keys(mythMasks).length > 300) mythMasks = { _g: mythMasks._g }; mythMasks[k] = out; return out; }
  function mythFrame(c, img, info) { var o = c._mfx; if (!o || !info.rims) return; var r = info.rims[(MYTH_FI && MYTH_FI.get(img)) || 0] || info.rims[0]; if (c._mfxR === r.k) return; c._mfxR = r.k;
    var U = mythRimUrls(r); o.style.setProperty('--rl', 'url(' + U.line + ')'); o.style.setProperty('--rc', 'url(' + U.core + ')'); }
  function mythFx(fr, keyed, mode) { mode = mode || MYTH_MODE; if (!mode || !MYTH_INFO || !okFrames(fr) || typeof keyed !== 'function') return fr;
    var A, B; try { A = keyed('#ff00fe'); B = keyed('#00ff01'); } catch (e) { return fr; } if (!okFrames(A) || !okFrames(B)) return fr;
    var a = A[0].data, b = B[0].data, m = new Uint8Array(1024), bb = { x0: 32, x1: -1, y0: 32, y1: -1 }, key = mode;
    for (var p = 0; p < 1024; p++) { var i = p * 4; if (a[i] === b[i] && a[i + 1] === b[i + 1] && a[i + 2] === b[i + 2]) { m[p] = 1; var x = p & 31, y = p >> 5; if (x < bb.x0) bb.x0 = x; if (x > bb.x1) bb.x1 = x; if (y < bb.y0) bb.y0 = y; if (y > bb.y1) bb.y1 = y; } }
    if (bb.x1 < 0) return fr;
    if (/^aura/.test(mode) && MYTH_FI) { /* aura1-3 TRACE pass: the line is exactly today's Mythic rim pixels, found per frame (it bobs with the pet) */
      var rims = [], rk = mode, any = false;
      for (var f = 0; f < fr.length; f++) { var Af = (A[f] || A[0]).data, Bf = (B[f] || B[0]).data, r = mythRimOf(Af, Bf), s2 = '';
        for (p = 0; p < 1024; p += 32) { var rw = 0; for (var q2 = 0; q2 < 32; q2++) { rw = rw * 2 + r[p + q2] >>> 0; if (r[p + q2]) any = true; } s2 += '.' + rw.toString(36); }
        r.k = s2; rims.push(r); rk += '|' + s2; }
      if (!any) return fr; var ainfo = { mode: mode, m: m, bb: bb, key: rk, rims: rims };
      return fr.map(function (f, i) { var g = { width: 32, height: 32, data: f.data }; MYTH_INFO.set(g, ainfo); MYTH_FI.set(g, i); return g; }); }
    bb.yh = bb.y0; for (var yy = bb.y0; yy <= bb.y1; yy++) { var cnt = 0; for (var xx = 0; xx < 32; xx++) cnt += m[yy * 32 + xx]; if (cnt >= 4) { bb.yh = yy; break; } } /* head top (skips a lone badge/gear pixel) */
    for (p = 0; p < 1024; p += 32) { var row = 0; for (var q = 0; q < 32; q++) row = row * 2 + m[p + q] >>> 0; key += '.' + row.toString(36); }
    var info = { mode: mode, m: m, bb: bb, key: key };
    return fr.map(function (f) { var g = { width: 32, height: 32, data: f.data }; MYTH_INFO.set(g, info); return g; }); }
  var mythCss = false, mythLive = typeof Set !== 'undefined' ? new Set() : null, mythMasks = {}, mythUid = 0, mythPtr = null, mythTilt = null, mythRaf = 0;
  var mythVis = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(function (es) { es.forEach(function (e) { var o = e.target._mfx; if (o) o.classList.toggle('mfx-off', !e.isIntersecting); }); }) : null;
  function mythStyle() { if (mythCss || !document.head) return; mythCss = true; var s = document.createElement('style'); s.id = 'mfx-css';
    s.textContent = '.mfx{position:absolute;pointer-events:none;overflow:visible}.mfx>*{position:absolute;pointer-events:none}' +
      '.mfx .pm{inset:0;-webkit-mask-size:100% 100%;mask-size:100% 100%;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;overflow:hidden}' +
      '.mfx .holo{inset:0;background:linear-gradient(115deg,#ff3a6e,#ffb13a,#fff36a,#4dff9a,#3ad8ff,#7a6bff,#ff5ad8,#ff3a6e,#ffb13a,#fff36a,#4dff9a);background-size:400% 400%;mix-blend-mode:color-dodge;opacity:.38}' +
      '.mfx .holo2{inset:0;background:repeating-linear-gradient(65deg,rgba(255,255,255,.0) 0 2px,rgba(160,255,255,.35) 3px,rgba(255,160,255,.0) 5px),repeating-linear-gradient(-25deg,rgba(255,255,255,0) 0 3px,rgba(255,255,200,.22) 4px,rgba(255,255,255,0) 6px);mix-blend-mode:overlay;opacity:.8}' +
      '.mfx .glit{inset:0;background-size:24px 24px;mix-blend-mode:color-dodge;opacity:.9}' +
      '.mfx .gw{mix-blend-mode:overlay}.mfx .gw2{mix-blend-mode:screen;opacity:.4}.mfx .glare{top:-60%;bottom:-60%;width:46%;left:0;background:linear-gradient(100deg,rgba(255,255,255,0) 0%,rgba(255,255,255,.05) 28%,rgba(255,255,255,.55) 44%,rgba(255,255,255,.95) 50%,rgba(255,255,255,.55) 56%,rgba(255,255,255,.05) 72%,rgba(255,255,255,0) 100%);transform:translateX(-120%) rotate(12deg);will-change:transform}' +
      '.mfx .gloss{inset:0;background:radial-gradient(120% 70% at 30% 0%,rgba(255,255,255,.32),rgba(255,255,255,0) 60%);mix-blend-mode:screen}' +
      '.mfx .halo{border-radius:50%;border:2px solid rgba(255,244,190,.95);box-shadow:0 0 6px 2px rgba(255,214,80,.9),0 0 16px 6px rgba(255,190,40,.45),inset 0 0 5px 1px rgba(255,255,230,.8);background:radial-gradient(closest-side,rgba(255,230,120,0) 55%,rgba(255,230,120,.35) 80%,rgba(255,230,120,0));will-change:transform,opacity}' +
      '.mfx .hglow{border-radius:50%;background:radial-gradient(closest-side,rgba(255,236,150,.55),rgba(255,200,60,.18) 55%,rgba(255,200,60,0));mix-blend-mode:screen}' +
      '.mfx .spk{width:16%;aspect-ratio:1;margin:-8% 0 0 -8%;background:radial-gradient(closest-side,#fff 0,rgba(255,255,255,.95) 12%,rgba(255,230,140,.6) 30%,rgba(255,200,80,0) 70%);clip-path:polygon(50% 0,58% 42%,100% 50%,58% 58%,50% 100%,42% 58%,0 50%,42% 42%);filter:drop-shadow(0 0 2px #ffe680);opacity:0;transform:scale(.2);will-change:transform,opacity}' +
      '.mfx .aura{inset:-12%;-webkit-mask-size:100% 100%;mask-size:100% 100%;background:conic-gradient(from 0deg,#ff5ad8,#ffb13a,#fff36a,#4dff9a,#3ad8ff,#7a6bff,#ff5ad8);mix-blend-mode:screen;will-change:transform}' +
      '.mfx .auraw{inset:-12%;-webkit-mask-size:100% 100%;mask-size:100% 100%;overflow:hidden}.mfx .auraw>i{position:absolute;inset:-40%;background:conic-gradient(from 0deg,#ff5ad8,#ffb13a,#fff36a,#4dff9a,#3ad8ff,#7a6bff,#ff5ad8);will-change:transform}' +
      '.mfx .orbit{width:0;height:0}.mfx .orbit>b{position:absolute;left:0;top:0;animation:mfxOx 3.2s ease-in-out infinite alternate;will-change:transform}' +
      '.mfx .orbit>b>i{position:absolute;left:0;top:0;animation:mfxOy 3.2s ease-in-out infinite alternate;will-change:transform,opacity;width:var(--s);height:var(--s);margin:calc(var(--s)/-2) 0 0 calc(var(--s)/-2);border-radius:50%;background:radial-gradient(closest-side,#fff,rgba(255,255,255,.9) 25%,rgba(150,240,255,.5) 50%,rgba(150,240,255,0));box-shadow:0 0 6px 2px rgba(180,240,255,.7)}' +
      '.mfx .laurel{overflow:visible}' +
      '.mfx .al{inset:0}.mfx .ln{position:absolute;inset:0;-webkit-mask-image:var(--rl);mask-image:var(--rl);-webkit-mask-size:100% 100%;mask-size:100% 100%;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;overflow:hidden}' +
      '.mfx .ln.core{-webkit-mask-image:var(--rc);mask-image:var(--rc);background:#fff;opacity:.7}.mfx .ln>i{position:absolute;inset:-45%;will-change:transform}' +
      '.mfx .ln.holo>i{background:conic-gradient(from 0deg,#ff4fd8,#ff9a3c,#fff46a,#5dffa8,#3cdcff,#8a6bff,#ff4fd8,#ff9a3c,#fff46a,#5dffa8,#3cdcff,#8a6bff,#ff4fd8);animation:mfxSpin 7s linear infinite}' +
      '.mfx .ln.sheen{background:linear-gradient(115deg,rgba(255,255,255,0) 30%,rgba(255,255,255,.75) 45%,rgba(190,255,255,.35) 50%,rgba(255,255,255,0) 62%);background-size:300% 300%;mix-blend-mode:screen;animation:mfxHolo 3.2s ease-in-out infinite}' +
      '.mfx .ln.glint>i{background:conic-gradient(from 0deg,rgba(255,255,255,0) 0deg,rgba(255,255,255,0) 322deg,rgba(255,255,255,.75) 342deg,#fff 352deg,rgba(255,255,255,0) 360deg);animation:mfxSpin 2.6s linear infinite}' +
      '.mfx .ln.glint2>i{background:conic-gradient(from 180deg,rgba(255,255,255,0) 0deg,rgba(255,255,255,0) 330deg,rgba(255,250,215,.95) 350deg,rgba(255,255,255,0) 360deg);animation:mfxSpin 3.7s linear infinite reverse}' +
      '.mfx .ln.glit{background-size:9cqw 9cqw;mix-blend-mode:screen;animation:mfxGlit 1.5s linear infinite}' +
      '.mfx-aura1 .ln.holo>i{background:conic-gradient(from 0deg,#ffe08a,#ffc6e8,#c9f3ff,#d8ffc9,#fff1a8,#e6d2ff,#ffe08a);animation-duration:9s}.mfx-aura1 .ln.core{opacity:.45}.mfx-aura1 .ln.sheen{opacity:.6}.mfx-aura1 .ln.glit{opacity:.35}.mfx-aura1 .ln.glint{opacity:.8}' +
      '.mfx-aura2 .ln.holo{filter:saturate(1.35) brightness(1.1)}.mfx-aura2 .ln.core{opacity:.55}.mfx-aura2 .al{filter:drop-shadow(0 0 .45cqw rgba(255,255,255,.6))}' +
      '.mfx-aura4 .ln.holo{filter:saturate(2.2) contrast(1.15)}.mfx-aura4 .ln.holo>i{background:conic-gradient(from 0deg,#ff2bd6,#ff7a1a,#ffe600,#29ff7a,#00e5ff,#3d7bff,#b44dff,#ff2bd6,#ff7a1a,#ffe600,#29ff7a,#00e5ff,#3d7bff,#b44dff,#ff2bd6,#ff7a1a,#ffe600,#29ff7a,#00e5ff,#3d7bff,#b44dff,#ff2bd6);animation-duration:4s}'+'.mfx-aura4 .ln.hue{background:linear-gradient(90deg,#ff2bd6,#ffe600,#29ff7a,#00e5ff,#b44dff,#ff2bd6,#ffe600,#29ff7a);background-size:300% 100%;mix-blend-mode:hue;opacity:.5;animation:mfxHue 2.4s linear infinite}'+'.mfx-aura4 .ln.core{opacity:.32}.mfx-aura4 .ln.sheen{opacity:.5}.mfx-aura4 .ln.glint{opacity:.7}.mfx-aura4 .ln.glit{opacity:.8}.mfx-aura4 .al{filter:drop-shadow(0 0 .22cqw rgba(255,255,255,.55)) saturate(1.2)}'+'.mfx-aura4 .ln.sweep>i{inset:-60%;background:conic-gradient(from 0deg,rgba(255,255,255,0) 0deg,rgba(255,255,255,0) 290deg,rgba(255,255,255,.6) 325deg,#fff 345deg,#fff 357deg,rgba(255,255,255,0) 360deg);opacity:0;animation:mfxSweep4 3.6s cubic-bezier(.5,0,.5,1) infinite}'+'.mfx-aura4 .ln.flash{background:#fff;opacity:0;animation:mfxFlash4 1.1s ease-out 1 both}'+'.mfx-aura4 .sg{width:9cqw;height:9cqw;margin:-4.5cqw 0 0 -4.5cqw;filter:drop-shadow(0 0 .3cqw #fff);background:radial-gradient(closest-side,#fff 0,#fff 18%,rgba(255,255,255,.7) 34%,rgba(255,255,255,0) 72%);clip-path:polygon(50% 0,57% 43%,100% 50%,57% 57%,50% 100%,43% 57%,0 50%,43% 43%);opacity:0;animation:mfxTw4 2.8s ease-in-out infinite}'+'.mfx-aura4 .bs{width:8cqw;height:8cqw;margin:-4cqw 0 0 -4cqw;background:radial-gradient(closest-side,#fff 0,#fff 20%,var(--bc) 45%,rgba(255,255,255,0) 75%);clip-path:polygon(50% 0,58% 42%,100% 50%,58% 58%,50% 100%,42% 58%,0 50%,42% 42%);opacity:0;animation:mfxBurst4 1.5s cubic-bezier(.2,.7,.3,1) 1 both}'+'@keyframes mfxSweep4{0%{transform:rotate(0deg);opacity:0}5%{opacity:1}55%{opacity:1}60%{transform:rotate(360deg);opacity:0}100%{transform:rotate(360deg);opacity:0}}'+'@keyframes mfxHue{to{background-position:300% 0}}@keyframes mfxFlash4{0%{opacity:0}18%{opacity:.95}100%{opacity:0}}'+'@keyframes mfxTw4{0%,100%{opacity:0;transform:scale(.3) rotate(0deg)}45%{opacity:0;transform:scale(.3)}60%{opacity:1;transform:scale(1.15) rotate(45deg)}75%{opacity:0;transform:scale(.4) rotate(90deg)}}'+'@keyframes mfxBurst4{0%{opacity:0;transform:translate(0,0) scale(.2)}15%{opacity:1;transform:translate(calc(var(--dx)*.3),calc(var(--dy)*.3)) scale(1.4) rotate(20deg)}100%{opacity:0;transform:translate(var(--dx),var(--dy)) scale(.3) rotate(120deg)}}'+'@media (prefers-reduced-motion:reduce){.mfx-aura4 .ln.sweep,.mfx-aura4 .ln.flash,.mfx-aura4 .bs{display:none}.mfx-aura4 .sg{opacity:.95;transform:scale(.8)}.mfx-aura4 .sg:nth-of-type(even){opacity:0}}'+
      '.mfx-aura5 .ln.e5{background:linear-gradient(135deg,#7fe8ff,#e8fbff 30%,#3fc8ff 55%,#c8f4ff 80%,#5ad6ff)}'+'.mfx-aura5 .ln.core{opacity:.85;background:#fff}'+'.mfx-aura5 .ln.e5f{background:#dff8ff;opacity:0;mix-blend-mode:screen;animation:mfxFlk5 .9s steps(1,end) infinite}'+'.mfx-aura5 .ln.e5n>i{inset:-60%;background:repeating-conic-gradient(from 0deg,rgba(255,255,255,0) 0deg,rgba(255,255,255,0) 9deg,rgba(255,255,255,.95) 11deg,rgba(255,255,255,0) 13deg,rgba(255,255,255,0) 23deg);mix-blend-mode:screen;animation:mfxCrk5 .45s steps(3,end) infinite}'+'.mfx-aura5 .al{filter:drop-shadow(0 0 .35cqw rgba(140,230,255,.95)) drop-shadow(0 0 .9cqw rgba(60,170,255,.55))}'+'.mfx-aura5 .ln.sweep>i{inset:-60%;background:conic-gradient(from 0deg,rgba(255,255,255,0) 0deg,rgba(255,255,255,0) 300deg,rgba(150,235,255,.7) 335deg,#fff 350deg,#fff 357deg,rgba(255,255,255,0) 360deg);opacity:0;animation:mfxZap5 5.3s cubic-bezier(.6,0,.4,1) infinite}'+'.mfx-aura5 .ln.flash{background:#fff;opacity:0;animation:mfxFlash5 .9s steps(6,end) 1 both}'+'.mfx-aura5 .e5a{position:absolute;width:22cqw;height:22cqw;margin:-11cqw 0 0 -11cqw;overflow:visible;pointer-events:none;opacity:0;filter:drop-shadow(0 0 .4cqw #9feaff) drop-shadow(0 0 .9cqw rgba(70,180,255,.8));animation:mfxArc5 var(--d) steps(1,end) infinite;animation-delay:var(--w)}'+'.mfx-aura5 .e5s{position:absolute;width:2.2cqw;height:2.2cqw;margin:-1.1cqw 0 0 -1.1cqw;background:#fff;box-shadow:0 0 .8cqw .3cqw #7fe2ff;opacity:0;animation:mfxSpk5 .8s cubic-bezier(.2,.7,.3,1) 1 both}'+'@keyframes mfxFlk5{0%{opacity:0}12%{opacity:.55}16%{opacity:0}41%{opacity:.3}44%{opacity:0}70%{opacity:.7}73%{opacity:.1}76%{opacity:0}}'+'@keyframes mfxCrk5{0%{transform:rotate(0deg);opacity:.5}33%{transform:rotate(127deg);opacity:.9}66%{transform:rotate(251deg);opacity:.35}100%{transform:rotate(360deg);opacity:.5}}'+'@keyframes mfxZap5{0%{transform:rotate(0deg);opacity:0}3%{opacity:1}22%{opacity:1}25%{transform:rotate(360deg);opacity:0}100%{transform:rotate(360deg);opacity:0}}'+'@keyframes mfxFlash5{0%{opacity:0}15%{opacity:1}30%{opacity:.2}45%{opacity:.9}100%{opacity:0}}'+'@keyframes mfxArc5{0%{opacity:1}8%{opacity:.3}12%{opacity:1}24%{opacity:.6}28%{opacity:0}100%{opacity:0}}'+'@keyframes mfxSpk5{0%{opacity:0;transform:translate(0,0) scale(.5)}10%{opacity:1;transform:translate(calc(var(--dx)*.2),calc(var(--dy)*.2)) scale(1.3)}100%{opacity:0;transform:translate(var(--dx),var(--dy)) scale(.3)}}'+'@media (prefers-reduced-motion:reduce){.mfx-aura5 .ln.e5f,.mfx-aura5 .ln.e5n,.mfx-aura5 .ln.sweep,.mfx-aura5 .ln.flash,.mfx-aura5 .e5a,.mfx-aura5 .e5s{display:none}}'+
      '.mfx-aura3 .ln.holo>i{background:conic-gradient(from 0deg,#ffffff,#8fa3b8,#e9f9ff,#9ff0ff,#5b6b80,#f4e8ff,#c8a2ff,#ffffff,#7d8da2,#d6fff2,#ffd6f4,#ffffff);animation-duration:3.4s}.mfx-aura3 .ln.sheen{opacity:1}.mfx-aura3 .ln.core{opacity:.85}.mfx-aura3 .al{filter:drop-shadow(0 0 .45cqw rgba(190,240,255,.65))}' +
      '@keyframes mfxSweep{0%{transform:translateX(-140%) rotate(12deg)}55%,100%{transform:translateX(330%) rotate(12deg)}}' +
      '@keyframes mfxHolo{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}' +
      '@keyframes mfxGlit{0%{opacity:.25;background-position:0 0}20%{opacity:.95}40%{opacity:.4;background-position:7px 3px}60%{opacity:1}80%{opacity:.3;background-position:3px 9px}100%{opacity:.25;background-position:0 0}}' +
      '@keyframes mfxSpk{0%,100%{opacity:0;transform:scale(.2) rotate(0)}45%{opacity:1;transform:scale(1) rotate(45deg)}70%{opacity:.7;transform:scale(.6) rotate(70deg)}}' +
      '@keyframes mfxHalo{0%,100%{transform:translateY(0);opacity:.9}50%{transform:translateY(-6%);opacity:1}}' +
      '@keyframes mfxSpin{to{transform:rotate(360deg)}}@keyframes mfxPulse{0%,100%{opacity:.55}50%{opacity:.95}}' +
      '.mfx .glare{animation:mfxSweep 3.6s cubic-bezier(.45,.05,.35,1) infinite}.mfx .holo{animation:mfxHolo 6s ease-in-out infinite}.mfx .glit{animation:mfxGlit 1.7s linear infinite}.mfx .glit.g2{animation-duration:2.3s;animation-delay:-.8s;background-size:31px 31px}' +
      '.mfx .spk{animation:mfxSpk 2.4s ease-in-out infinite}.mfx .halo,.mfx .hglow{animation:mfxHalo 3s ease-in-out infinite}.mfx .auraw>i{animation:mfxSpin 5s linear infinite}.mfx .auraw{animation:mfxPulse 2.4s ease-in-out infinite}' +
      '@keyframes mfxOx{from{transform:translateX(calc(var(--rx)*-1))}to{transform:translateX(var(--rx))}}@keyframes mfxOy{from{transform:translateY(calc(var(--ry)*-1)) scale(.55);opacity:.55}to{transform:translateY(var(--ry)) scale(1.15);opacity:1}}' +
      '.mfx.ptr .glare{animation:none}.mfx.ptr .holo{animation:none}.mfx.mfx-off *{animation-play-state:paused!important}' +
      '@media (prefers-reduced-motion:reduce){.mfx *{animation:none!important}.mfx .ln.glint>i{transform:rotate(40deg)}.mfx .ln.glint2>i{transform:rotate(200deg)}.mfx .ln.sheen{background-position:50% 50%}.mfx .ln.glit{opacity:.5}.mfx .glare{transform:translateX(70%) rotate(12deg)}.mfx .spk{opacity:.9;transform:scale(.8)}.mfx .glit{opacity:.6}}';
    document.head.appendChild(s); }
  function mythGlitUrl() { if (mythMasks._g) return mythMasks._g; var c = document.createElement('canvas'); c.width = c.height = 48; var g = c.getContext('2d'), r = 7;
    for (var i = 0; i < 70; i++) { r = (r * 9301 + 49297) % 233280; var x = r / 233280 * 48; r = (r * 9301 + 49297) % 233280; var y = r / 233280 * 48; r = (r * 9301 + 49297) % 233280; var t = r / 233280;
      var gr = g.createRadialGradient(x, y, 0, x, y, 0.6 + t * 1.6); gr.addColorStop(0, 'rgba(255,255,255,' + (0.5 + t / 2) + ')'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(x - 3, y - 3, 6, 6); }
    return (mythMasks._g = c.toDataURL()); }
  function mythMaskUrls(info) { var k = info.key; if (mythMasks[k]) return mythMasks[k]; var c = document.createElement('canvas'); c.width = c.height = 32; var g = c.getContext('2d'), id = g.createImageData(32, 32);
    for (var p = 0; p < 1024; p++) if (info.m[p]) { id.data[p * 4] = id.data[p * 4 + 1] = id.data[p * 4 + 2] = 255; id.data[p * 4 + 3] = 255; } g.putImageData(id, 0, 0);
    var pet = c.toDataURL(), R = document.createElement('canvas'), S = 160, o = Math.round(S * 0.12 / 1.24); R.width = R.height = S; var h = R.getContext('2d'), sc = (S - 2 * o) / 32; h.imageSmoothingEnabled = false;
    h.shadowColor = '#fff'; h.shadowBlur = 9; for (var n = 0; n < 3; n++) h.drawImage(c, o, o, 32 * sc, 32 * sc); h.shadowBlur = 0; h.globalCompositeOperation = 'destination-out'; h.drawImage(c, o, o, 32 * sc, 32 * sc);
    var band = function (rad, soft) { var E = document.createElement('canvas'); E.width = E.height = S; var e = E.getContext('2d'); e.imageSmoothingEnabled = false; if (soft) { e.shadowColor = '#fff'; e.shadowBlur = soft; }
      for (var a = 0; a < 16; a++) e.drawImage(c, o + Math.cos(a / 8 * Math.PI) * rad * sc, o + Math.sin(a / 8 * Math.PI) * rad * sc, 32 * sc, 32 * sc);
      e.shadowBlur = 0; e.globalCompositeOperation = 'destination-out'; e.drawImage(c, o, o, 32 * sc, 32 * sc); return E.toDataURL(); };
    var out = { pet: pet, ring: R.toDataURL() }; var ks = Object.keys(mythMasks); if (ks.length > 300) mythMasks = { _g: mythMasks._g }; mythMasks[k] = out; return out; }
  function el(tag, cls, st) { var e = document.createElement(tag); if (cls) e.className = cls; if (st) e.setAttribute('style', st); return e; }
  function mythLaurel(side, uid) { var NS = 'http://www.w3.org/2000/svg', s = document.createElementNS(NS, 'svg'); s.setAttribute('viewBox', '0 0 20 60'); s.setAttribute('class', 'laurel');
    var gid = 'mfxg' + uid + side, wid = 'mfxw' + uid + side, leaves = '', i;
    for (i = 0; i < 7; i++) { var y = 54 - i * 7.2, x = 13 - Math.sin(i / 6 * 2.6) * 6; leaves += '<ellipse cx="' + (x - 3.2).toFixed(1) + '" cy="' + (y - 2).toFixed(1) + '" rx="3.6" ry="1.5" transform="rotate(-38 ' + (x - 3.2).toFixed(1) + ' ' + (y - 2).toFixed(1) + ')"/>' +
      '<ellipse cx="' + (x + 2.6).toFixed(1) + '" cy="' + (y - 3).toFixed(1) + '" rx="3.4" ry="1.4" transform="rotate(-62 ' + (x + 2.6).toFixed(1) + ' ' + (y - 3).toFixed(1) + ')"/>'; }
    var anim = MYTH_STILL ? '' : '<animateTransform attributeName="gradientTransform" type="translate" values="0 70;0 -70;0 -70" keyTimes="0;0.6;1" dur="3.2s" repeatCount="indefinite"/>';
    s.innerHTML = '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7a4a08"/><stop offset=".3" stop-color="#e8b23a"/><stop offset=".48" stop-color="#fff2b0"/><stop offset=".62" stop-color="#d79a22"/><stop offset="1" stop-color="#6a3e06"/></linearGradient>' +
      '<linearGradient id="' + wid + '" gradientUnits="userSpaceOnUse" x1="0" y1="20" x2="0" y2="34"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".95"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>' + anim + '</linearGradient></defs>' +
      '<g style="filter:drop-shadow(0 0 1.2px rgba(255,210,80,.9))"><path d="M14 58 C 4 44, 4 22, 13 4" fill="none" stroke="url(#' + gid + ')" stroke-width="1.6" stroke-linecap="round"/><g fill="url(#' + gid + ')" stroke="#5a3404" stroke-width=".35">' + leaves + '</g>' +
      '<g fill="url(#' + wid + ')" style="mix-blend-mode:screen"><path d="M14 58 C 4 44, 4 22, 13 4" fill="none" stroke="url(#' + wid + ')" stroke-width="1.6"/>' + leaves + '</g></g>';
    if (side === 'r') s.style.transform = 'scaleX(-1)'; return s; }
  /* aura4 extras: rainbow hue drift + white sweep + one-time flash on the traced line, star glints and the burst placed ON rim pixels (frame 0) */
  function mythAura4(o, al, info) { var r = (info.rims && info.rims[0]) || [], pts = [], P = function (v) { return (v / 32 * 100).toFixed(2) + '%'; }, cx = (info.bb.x0 + info.bb.x1 + 1) / 2, cy = (info.bb.y0 + info.bb.y1 + 1) / 2;
    [['ln hue', 0], ['ln sweep', 1], ['ln flash', 0]].forEach(function (q) { var e = el('div', q[0]); if (q[1]) e.appendChild(el('i')); al.appendChild(e); });
    for (var p = 0; p < 1024; p++) if (r[p]) pts.push([(p & 31) + 0.5, (p >> 5) + 0.5]); if (!pts.length) return;
    pts.sort(function (a, b) { return Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx); });
    var G = 7; for (var k = 0; k < G; k++) { var g = pts[Math.floor((k + 0.37) / G * pts.length)]; o.appendChild(el('div', 'sg', 'left:' + P(g[0]) + ';top:' + P(g[1]) + ';animation-delay:-' + (k * 0.83 % 2.8).toFixed(2) + 's')); }
    if (MYTH_STILL) return; var C = ['#ff4fd8', '#ffe600', '#29ff7a', '#00e5ff', '#b44dff', '#ff9a3c'], N = 18;
    for (k = 0; k < N; k++) { var b = pts[Math.floor(k / N * pts.length)], dx = b[0] - cx, dy = b[1] - cy, d = Math.sqrt(dx * dx + dy * dy) || 1;
      o.appendChild(el('div', 'bs', 'left:' + P(b[0]) + ';top:' + P(b[1]) + ';--bc:' + C[k % 6] + ';--dx:' + (dx / d * 5 / 32 * 100).toFixed(2) + 'cqw;--dy:' + (dy / d * 5 / 32 * 100).toFixed(2) + 'cqw;animation-delay:' + (0.15 + (k % 5) * 0.06).toFixed(2) + 's')); } }
  /* aura5 (electric): blue-white line + flicker/crackle + zap sweep + one-time flash, jagged arcs that hop to random rim pixels each cycle, spark burst */
  function mythAura5(o, al, info) { var r = (info.rims && info.rims[0]) || [], pts = [], P = function (v) { return (v / 32 * 100).toFixed(2) + '%'; }, cx = (info.bb.x0 + info.bb.x1 + 1) / 2, cy = (info.bb.y0 + info.bb.y1 + 1) / 2;
    for (var p = 0; p < 1024; p++) if (r[p]) pts.push([(p & 31) + 0.5, (p >> 5) + 0.5]); if (!pts.length || MYTH_STILL) return;
    [['ln e5f', 0], ['ln e5n', 1], ['ln sweep', 1], ['ln flash', 0]].forEach(function (q) { var e = el('div', q[0]); if (q[1]) e.appendChild(el('i')); al.appendChild(e); });
    var NS = 'http://www.w3.org/2000/svg', bolt = function (s) { var a = Math.random() * 6.283, L = 5 + Math.random() * 2.5, n = 4 + (Math.random() * 3 | 0), d = '', k, x, y, ox = 5 - Math.cos(a) * L / 2, oy = 5 - Math.sin(a) * L / 2;
        for (k = 0; k <= n; k++) { x = ox + Math.cos(a) * L * k / n + (k && k < n ? (Math.random() - 0.5) * 2.4 : 0); y = oy + Math.sin(a) * L * k / n + (k && k < n ? (Math.random() - 0.5) * 2.4 : 0); d += (k ? 'L' : 'M') + x.toFixed(2) + ' ' + y.toFixed(2); }
        s.innerHTML = '<path d="' + d + '" fill="none" stroke="#7fdcff" stroke-width=".85" stroke-linejoin="bevel"/><path d="' + d + '" fill="none" stroke="#fff" stroke-width=".4" stroke-linejoin="bevel"/>'; },
      hop = function (s) { var g = pts[Math.random() * pts.length | 0]; s.style.left = P(g[0]); s.style.top = P(g[1]); bolt(s); };
    for (var k = 0; k < 5; k++) { var s = document.createElementNS(NS, 'svg'); s.setAttribute('class', 'e5a'); s.setAttribute('viewBox', '0 0 10 10');
      s.style.setProperty('--d', (0.9 + Math.random() * 1.4).toFixed(2) + 's'); s.style.setProperty('--w', (Math.random() * 1.2).toFixed(2) + 's'); hop(s);
      s.addEventListener('animationiteration', function (e) { hop(e.currentTarget); }); o.appendChild(s); }
    var N = 16; for (k = 0; k < N; k++) { var b = pts[Math.floor((k + Math.random() * 0.6) / N * pts.length) % pts.length], dx = b[0] - cx, dy = b[1] - cy, dd = Math.sqrt(dx * dx + dy * dy) || 1, f = 4 + Math.random() * 4;
      o.appendChild(el('div', 'e5s', 'left:' + P(b[0]) + ';top:' + P(b[1]) + ';--dx:' + (dx / dd * f / 32 * 100).toFixed(2) + 'cqw;--dy:' + (dy / dd * f / 32 * 100).toFixed(2) + 'cqw;animation-delay:' + (0.05 + Math.random() * 0.25).toFixed(2) + 's')); } }
  function mythBuild(info) { var o = el('div', 'mfx mfx-' + info.mode), bb = info.bb, U = mythMaskUrls(info), P = function (v) { return (v / 32 * 100).toFixed(2) + '%'; }, uid = ++mythUid, mode = info.mode;
    var mk = function (cls, st) { var e = el('div', 'pm ' + cls, st); e.style.webkitMaskImage = e.style.maskImage = 'url(' + U.pet + ')'; return e; }, pm = [];
    var glit = 'background-image:url(' + mythGlitUrl() + ')';
    if (mode === 'aura5') { var al5 = el('div', 'al'); [['ln e5', 0], ['ln core', 0]].forEach(function (q) { al5.appendChild(el('div', q[0])); }); mythAura5(o, al5, info); o.appendChild(al5); return o; }
    if (/^aura/.test(mode)) { var al = el('div', 'al'); [['ln holo', 1], ['ln sheen', 0], ['ln core', 0], ['ln glint', 1], ['ln glint2', 1], ['ln glit', 0]].forEach(function (q) {
        if (mode === 'aura1' && /glint2/.test(q[0])) return; var e = el('div', q[0], /glit/.test(q[0]) ? glit : ''); if (q[1]) e.appendChild(el('i')); al.appendChild(e); });
      if (mode === 'aura4') mythAura4(o, al, info); o.appendChild(al); return o; }
    if (mode === 'a') { pm.push(mk('holo'), mk('holo2'), mk('glit', glit), mk('glit g2', glit)); } else pm.push(mk('glit', glit + ';opacity:.7'));
    pm.push(mk('gloss')); var gw = mk('gw'), gw2 = mk('gw2'); gw.appendChild(el('div', 'glare')); gw2.appendChild(el('div', 'glare')); pm.push(gw, gw2);
    var cx = (bb.x0 + bb.x1 + 1) / 2, w = bb.x1 - bb.x0 + 1, hgt = bb.y1 - bb.y0 + 1;
    if (mode === 'c') { var aw = el('div', 'auraw'); aw.style.webkitMaskImage = aw.style.maskImage = 'url(' + U.ring + ')'; aw.appendChild(el('i')); o.appendChild(aw); }
    pm.forEach(function (e) { o.appendChild(e); });
    if (mode === 'b') { var hw = Math.max(8, Math.min(16, w * 0.6)), hy = Math.max(0.4, bb.yh - 1.6);
      o.appendChild(el('div', 'hglow', 'left:' + P(cx - hw * 0.8) + ';width:' + P(hw * 1.6) + ';top:' + P(hy - 3) + ';height:' + P(8)));
      o.appendChild(el('div', 'halo', 'left:' + P(cx - hw / 2) + ';width:' + P(hw) + ';top:' + P(hy) + ';height:' + P(2.6)));
      [[bb.x0 - 2, bb.y0 + hgt * 0.3, 0], [bb.x1 + 2, bb.y0 + hgt * 0.15, 0.6], [bb.x1 + 1.5, bb.y0 + hgt * 0.65, 1.2], [bb.x0 - 1.5, bb.y0 + hgt * 0.75, 1.8], [cx + 3, bb.y0 + 2, 0.9], [cx - 5, bb.y0 + hgt * 0.5, 1.5]].forEach(function (q) {
        o.appendChild(el('div', 'spk', 'left:' + P(Math.max(1, Math.min(31, q[0]))) + ';top:' + P(Math.max(1, Math.min(31, q[1]))) + ';animation-delay:-' + q[2] + 's')); }); }
    if (mode === 'c') { var ob = el('div', 'orbit', 'left:' + P(cx) + ';top:' + P(bb.y0 + hgt * 0.45) + ';--rx:' + (Math.min(15, w / 2 + 3) / 32 * 100).toFixed(1) + 'cqw;--ry:' + (3.2 / 32 * 100).toFixed(1) + 'cqw;--s:9cqw');
        [0, -3.2].forEach(function (dl) { var b = el('b', '', 'animation-delay:' + dl + 's'), i = el('i', '', 'animation-delay:' + (dl - 1.6) + 's'); b.appendChild(i); ob.appendChild(b); }); o.appendChild(ob); }
    if (mode === 'd') { var lh = Math.min(16, hgt + 2); [['l', bb.x0 - 4.6], ['r', bb.x1 + 1.6]].forEach(function (q) { var s = mythLaurel(q[0], uid); s.setAttribute('style', (s.getAttribute('style') || '') + ';position:absolute;left:' + P(q[1]) + ';top:' + P(bb.y1 + 1 - lh) + ';width:' + P(lh / 3) + ';height:' + P(lh) + (q[0] === 'r' ? ';transform:scaleX(-1)' : '')); o.appendChild(s); }); }
    return o; }
  function mythPlace(c) { var o = c._mfx; if (!o) return; var w = c.offsetWidth, h = c.offsetHeight; o.style.display = w ? '' : 'none'; if (!w) return;
    o.style.left = c.offsetLeft + 'px'; o.style.top = c.offsetTop + 'px'; o.style.width = w + 'px'; o.style.height = h + 'px'; o.style.containerType = 'size'; o._pos = c.offsetLeft + ',' + c.offsetTop + ',' + w + ',' + h; try { var cr = c.getBoundingClientRect(), orr = o.getBoundingClientRect(), dx = cr.left - orr.left, dy = cr.top - orr.top; /* sub-pixel exact: the line must sit on the rim pixels */ if (Math.abs(dx) > 0.01) o.style.left = (c.offsetLeft + dx) + 'px'; if (Math.abs(dy) > 0.01) o.style.top = (c.offsetTop + dy) + 'px'; } catch (e) {}
    var orb = o.querySelector('.orbit'); if (orb && orb._r == null) orb._r = 1; if (orb) { var r2 = parseFloat(orb.getAttribute('data-r') || 0); } 
    mythFit(); }
  /* decorations (aura ring, orbit stars, laurels) may poke past the screen edge on phones: never let them create a sideways scroll */
  var mythFitRaf = 0; function mythFit() { if (mythFitRaf || typeof requestAnimationFrame === 'undefined') return; mythFitRaf = requestAnimationFrame(function () { mythFitRaf = 0; var W = document.documentElement.clientWidth; if (!W) return;
  if (typeof window !== 'undefined' && window.addEventListener) window.addEventListener('resize', function () { mythFit(); });
    document.querySelectorAll('.mfx').forEach(function (o) { var r = o.getBoundingClientRect(); if (!r.width) return; var room = Math.floor(Math.min(r.left + scrollX, W - r.right - scrollX) - 2);
      if (room < r.width * 0.3) { o.style.overflow = 'clip'; o.style.overflowClipMargin = Math.max(0, room) + 'px'; } else { o.style.overflow = ''; o.style.overflowClipMargin = ''; } }); }); }
  var mythRO = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(function (es) { es.forEach(function (e) { mythPlace(e.target); }); }) : null;
  function mythDetach(c) { var o = c._mfx; if (!o) return; if (o.parentNode) o.parentNode.removeChild(o); c._mfx = null; c._mfxKey = null; c._mfxR = null; if (mythRO) mythRO.unobserve(c); if (mythVis) mythVis.unobserve(c); if (mythLive) mythLive.delete(c); }
  /* bakes (papers / GIF / token papers) read the same per-frame rim the live electric outline traces */
  if (window.V2Looks && MYTH_INFO) window.V2Looks.myth = function (img) { var i = img && MYTH_INFO.get(img); if (!i || i.mode !== 'aura5' || !i.rims) return null; return { rim: i.rims[(MYTH_FI && MYTH_FI.get(img)) || 0] || i.rims[0], seed: (img.pid || 0) }; };
  function mythAttach(c, img) { if (!MYTH_INFO || !c || c.nodeType !== 1) return; var info = MYTH_INFO.get(img);
    if (!info) { if (c._mfx) mythDetach(c); return; } if (c._mfxKey === info.key && c._mfx && c._mfx.parentNode === c.parentNode && c._mfx.isConnected) { var o0 = c._mfx; if (o0._pos !== c.offsetLeft + ',' + c.offsetTop + ',' + c.offsetWidth + ',' + c.offsetHeight) mythPlace(c); /* follow layout shifts */ mythFrame(c, img, info); return; }
    if (!c.parentNode || typeof document === 'undefined') return; try { mythStyle(); if (c._mfx) mythDetach(c); var o = mythBuild(info); c._mfx = o; c._mfxKey = info.key; o._c = c;
      c._mfxR = null; c.parentNode.insertBefore(o, c.nextSibling); mythFrame(c, img, info); var ps = window.getComputedStyle ? getComputedStyle(c.offsetParent || c.parentNode) : null; mythPlace(c);
      if (mythRO) mythRO.observe(c); if (mythVis) mythVis.observe(c); if (mythLive) mythLive.add(c); mythListen(); } catch (e) { if (window.console) console.warn('mythic look failed', e); } }
  function mythTick() { mythRaf = 0; if (!mythLive) return; mythLive.forEach(function (c) { var o = c._mfx; if (!o || !c.isConnected) { mythDetach(c); return; } if (o.classList.contains('mfx-off')) return;
      var r = c.getBoundingClientRect(), fx = null; if (!r.width) return;
      if (mythPtr) { var px = (mythPtr[0] - r.left) / r.width, py = (mythPtr[1] - r.top) / r.height; if (px > -0.25 && px < 1.25 && py > -0.25 && py < 1.25) fx = [px, py]; }
      if (!fx && mythTilt) fx = mythTilt;
      var gl = o.querySelector('.glare'), ho = o.querySelector('.holo');
      if (fx) { o.classList.add('ptr'); var X = Math.max(-0.2, Math.min(1.2, fx[0])); if (gl) gl.style.transform = 'translateX(' + ((X * 2.6 - 1.15) * 100).toFixed(0) + '%) rotate(12deg)'; if (ho) ho.style.backgroundPosition = (X * 100).toFixed(0) + '% ' + (Math.max(0, Math.min(1, fx[1])) * 100).toFixed(0) + '%'; }
      else if (o.classList.contains('ptr')) { o.classList.remove('ptr'); if (gl) gl.style.transform = ''; if (ho) ho.style.backgroundPosition = ''; } }); }
  var mythListening = false;
  function mythListen() { if (mythListening || MYTH_STILL || typeof window.addEventListener !== 'function') return; mythListening = true; var q = function () { if (!mythRaf) mythRaf = (window.requestAnimationFrame || setTimeout)(mythTick); };
    window.addEventListener('pointermove', function (e) { if (e.pointerType === 'touch') return; mythPtr = [e.clientX, e.clientY]; q(); }, { passive: true });
    document.addEventListener('pointerleave', function () { mythPtr = null; q(); }, { passive: true });
    window.addEventListener('deviceorientation', function (e) { if (e.gamma == null) return; mythTilt = [0.5 + Math.max(-30, Math.min(30, e.gamma)) / 60, 0.5 + Math.max(-30, Math.min(30, (e.beta || 45) - 45)) / 60]; q(); }, { passive: true });
    window.addEventListener('scroll', q, { passive: true }); }
  /* BURN LORD EDITION LOOK (branch burn-lords): exclusive to the 5 Burn Lords grant pets (p.burnLord; never bred, never inherited). On every frame:
   * a flickering fire aura on the pet's outline and a gold frame (the flame crown on the head was removed Oct 26, 2026: owner rejected it, do not add it back) with n of 3 edition pips.
   * Silhouette per frame from two key renders (same trick as mythFx). Display only. */
  var BL_FIRE = [[255, 214, 64], [255, 140, 26], [222, 56, 28]], BL_GOLD = [255, 210, 63], BL_GOLD2 = [176, 120, 20], BL_INK = [20, 12, 6];
  function burnLordFx(fr, keyed, bl) { if (!okFrames(fr) || !bl) return fr; var A, B; try { A = keyed('#ff00fe'); B = keyed('#00ff01'); } catch (e) { return fr; } if (!okFrames(A) || !okFrames(B)) return fr;
    return fr.map(function (f, fi) { var a = (A[fi] || A[0]).data, b = (B[fi] || B[0]).data, d = new Uint8ClampedArray(f.data), m = new Uint8Array(1024), y0 = 32, x0 = 32, x1 = -1;
      for (var p = 0; p < 1024; p++) { var i = p * 4; if (a[i] === b[i] && a[i + 1] === b[i + 1] && a[i + 2] === b[i + 2]) { m[p] = 1; var x = p & 31, y = p >> 5; if (y < y0) y0 = y; if (x < x0) x0 = x; if (x > x1) x1 = x; } }
      var set = function (x, y, c) { if (x < 0 || y < 0 || x > 31 || y > 31) return; var j = (y * 32 + x) * 4; d[j] = c[0]; d[j + 1] = c[1]; d[j + 2] = c[2]; d[j + 3] = 255; };
      if (x1 >= 0) { /* fire aura: background pixels touching the silhouette, flicker by frame */
        for (var q = 0; q < 1024; q++) { if (m[q]) continue; var qx = q & 31, qy = q >> 5; if (qy > 28) continue; var nb = [q - 32, q + 32, qx > 0 ? q - 1 : -1, qx < 31 ? q + 1 : -1].some(function (n) { return n >= 0 && n < 1024 && m[n]; }); if (!nb) continue;
          var h = (qx * 7 + qy * 13 + fi * 5) % 6; if (h < 3) set(qx, qy, BL_FIRE[(h + (qy < 16 ? 0 : 1)) % 3]); }
      }
      /* gold frame (outer gold, inner dark line) + n gold pips bottom right */
      for (var t = 0; t < 32; t++) { set(t, 0, BL_GOLD); set(t, 31, BL_GOLD); set(0, t, BL_GOLD); set(31, t, BL_GOLD); }
      for (var u = 1; u < 31; u++) { set(u, 1, BL_GOLD2); set(u, 30, BL_GOLD2); set(1, u, BL_GOLD2); set(30, u, BL_GOLD2); }
      [0, 0, 31, 31].forEach(function (cx2, k) { set(cx2, k % 2 ? 31 : 0, BL_INK); });
      for (var e = 0; e < bl.of; e++) set(28 - e * 2, 30, e < bl.n ? BL_FIRE[0] : BL_INK);
      return Object.assign({}, f, { data: d }); }); }
  function petFrames(p, w, extra) { var fr = petFrames0(p, w, extra);
    if (p && (p.mutation || p.shows) && V.lookFx) try { var mk2 = petFrames0(Object.assign({}, p, { art: Object.assign({}, p.art, { background: 'solid', bgColor: '#ff00fe', pattern: 'none' }) }), w, extra); fr = V.lookFx(fr, mk2, p); } catch (e) { if (window.console) console.warn('breed look failed #' + p.id, e); } /* breeding v2: mutation + throwback looks */
    var bare = fr, cut = V.CUTOFF_BLOCK || 971500, hd = extra && extra.noHunger ? 0 : hungerDays(p, w);
    try { if (hd) fr = hungerLook(fr, p, w, extra, hd);
      fr = p && p.art && p.hatchBlock > cut ? fr.map(function (f, i) { return window.V2Bg ? V2Bg.apply(f, p.art, i, cpLogo) : cpLogo(f, p.art); }) : fr; } catch (e) { fr = null; if (window.console) console.warn('petFrames look step failed for #' + (p && p.id), e); }
    /* fail safe: if the hunger / background steps break a frame, draw the bare sprite instead of an empty (black) canvas */
    fr = okFrames(fr) ? fr : bare;
    if (MYTH_MODE && p && p.stage === 5 && !p.dead && !p.released) fr = mythFx(fr, function (bg) { var kf = petFrames0(Object.assign({}, p, { mutation: null, shows: null, art: Object.assign({}, p.art, { background: 'solid', bgColor: bg, pattern: 'none' }) }), w, extra); return fr.length === kf.length ? kf : fr.map(function (_, i) { return kf[i % kf.length]; }); }); /* mythic-look options */
    if (p && (p.burnLord || p.supreme || p.contest) && !p.dead) fr = burnLordFx(fr, function (bg) { return petFrames0(Object.assign({}, p, { mutation: null, shows: null, art: Object.assign({}, p.art, { background: 'solid', bgColor: bg, pattern: 'none' }) }), w, extra); }, p.burnLord || p.supreme || p.contest); /* Burn Lord edition look (also the 1 of 1 supreme eggs) */
    var lk = looksOf(p, w, extra); /* looks-draw REAL (display only): realistic look overlays on top of the pixel sprite, see js/v2-looks.js */
    if (lk.length) try { var lkKey = function (bg) { var kf = petFrames0(Object.assign({}, p, { mutation: null, shows: null, art: Object.assign({}, p.art, { background: 'solid', bgColor: bg, pattern: 'none' }) }), w, extra); return fr.map(function (_, i) { return kf[i % kf.length]; }); };
      var A0 = lkKey('#ff00fe'), B0 = lkKey('#00ff01'); window.V2Looks.attachInfo(fr, A0, B0, lk, p.id); } catch (e) { if (window.console) console.warn('looks failed #' + (p && p.id), e); }
    return fr; }
  function looksOf(p, w, extra) { if (extra && extra.looks && window.V2Looks) return extra.looks; /* look picker previews: draw exactly these looks */
    if (!p || p.released || !w || (extra && extra.noLooks) || !window.V2Looks || !V.shownLooks || !(p.flameLooks || p.questLooks || p.earn || w.lookCopies)) return [];
    try { return V.shownLooks(w, p) || []; } catch (e) { return []; } }
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
    return fr.map(function (f, fi) { var m = (mk[fi] || mk[0]).data, s = f.data, d = Array.isArray(s) ? s.slice() : new s.constructor(s) /* wiz-show-fix 2026-10-21: WizardSprite/KekSprite frames carry a plain Array; new Array(arr) made a 1-element array (blank sprite + ImageData error on hungry Wizards) */, o = Object.assign({}, f, { data: d }), i, x, y, minX = 32, maxX = -1, minY = 32, sil = [];
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
    var it = V.GEAR_BY_ID[id] || {}, art = bare(it.origin && it.origin !== 'nakamoto' && it.origin !== 'wizard' ? it.origin : 'pepe'), go = Object.assign({}, NONE), with_;
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
    if (p.dead) { box.innerHTML = '<p class="small muted">A pet in the Pet Cemetery can\'t wear gear.</p>'; return; } /* content-fixes 2026-10-19: dead pets (gear already back in the owner's bag) */
    if (o.compact && !slots.length) { box.innerHTML = '<p class="small muted">No gear to wear yet.</p>'; return; }
    var h = '<div class="gp-slots" role="tablist" aria-label="Gear slots">' + slots.map(function (sl) { var locked = p.openSlots.indexOf(sl) < 0, g = worn[sl];
      return '<button type="button" class="gp-slot' + (open === sl ? ' on' : '') + (locked ? ' locked' : '') + '" data-gslot="' + sl + '" role="tab" aria-selected="' + (open === sl) + '"><b>' + V.slotLabel(sl) + '</b><span class="small">' + (locked ? 'locked' : g ? esc(g.label) : 'empty') + '</span></button>'; }).join('') + '</div>';
    /* Unequip all (2026-10-19): one free local action that takes every worn piece off this pet (same op as "Take off", gid null, per slot); all go to your stock */
    /* unequip-owner-fix (2026-10-19): owner only. Same check as equip/unequip (equipCheck), feed and Release: a wallet is connected, it owns the pet, the pet is not released.
     * The community pet (Bitcoin Wizard, auto-equips) has no owner, so this also hides it there unless it is owner-controlled by the connected wallet. */
    /* address-lookup (2026-10-19): o.viewOnly (an address viewed without its wallet) shows the gear but never offers equip / take off / Unequip all */
    var ownsP = function () { var q = (o.world && o.world.byId && o.world.byId[p.id]) || p; return !o.viewOnly && !!o.owner && q.owner === o.owner && !q.released; };
    var wornSlots = Object.keys(worn), canOffAll = wornSlots.length && !p.dead && ownsP(), asking = box.getAttribute('data-offall') === '1' && canOffAll;
    if (canOffAll) h += '<div class="gp-offall">' + (asking ? '<span class="small">' + (wornSlots.length === 1 ? 'Take the 1 piece off #' + p.id + '? It goes' : 'Take all ' + wornSlots.length + ' pieces off #' + p.id + '? They go') + ' back to your stash (free).</span> <button type="button" class="q" data-offyes="1">Yes, take them off</button> <button type="button" class="q" data-offno="1">Cancel</button>'
      : '<button type="button" class="q" data-offall="1" title="Take every piece off this pet at once. Free; they go back to your stash.">Unequip all (' + wornSlots.length + ')</button>') + '</div>';
    h += '<div class="gp-grid-wrap" id="gpWrap"></div><div class="small gp-msg" aria-live="polite"></div>';
    box.innerHTML = h;
    var oa = box.querySelector('[data-offall]'), oy = box.querySelector('[data-offyes]'), on = box.querySelector('[data-offno]');
    var notOwner = function () { box.removeAttribute('data-offall'); say('Only the owner can take gear off #' + p.id + '. Connect the wallet that owns it.', true); };
    var viewMsg = function () { say('👀 View only: connect the XCP Wallet that owns #' + p.id + ' to change its gear.', true); if (o.onBlocked) o.onBlocked(); };
    if (oa) oa.onclick = function () { if (!ownsP()) return notOwner(); box.setAttribute('data-offall', '1'); gearPicker(box, o); };
    if (on) on.onclick = function () { box.removeAttribute('data-offall'); gearPicker(box, o); };
    if (oy) oy.onclick = function () { if (!ownsP()) return notOwner(); box.removeAttribute('data-offall'); var ops = wornSlots.map(function (sl) { return { kind: 'equip', owner: o.owner, petId: p.id, slot: sl, gid: null }; }), m = 'Took ' + ops.length + ' piece' + (ops.length === 1 ? '' : 's') + ' off #' + p.id + ': back in your stock';
      if (o.onEquipMany) o.onEquipMany(ops, m); else ops.forEach(function (op, i) { o.onEquip(op, i === ops.length - 1 ? m : ''); }); };
    var wrap = box.querySelector('.gp-grid-wrap'), msg = box.querySelector('.gp-msg');
    function say(t, bad) { msg.textContent = t; msg.className = 'small gp-msg' + (bad ? ' warn' : ''); }
    if (open) {
      var pcs = V.pickerPieces(w, o.owner, p.id, open), locked = p.openSlots.indexOf(open) < 0; if (o.compact) pcs = pcs.filter(usable);
      wrap.innerHTML = '<div class="gp-head small"><b>' + V.slotLabel(open) + '</b>' + (o.compact ? '' : ' · ' + pcs.length + ' pieces · ' + pcs.filter(function (x) { return x.owned; }).length + ' owned' + (locked ? ' · <span class="warn">slot locked: capacity ' + p.capacity + '/6 (grows with age + care)</span>' : '')) +
        (worn[open] && !p.dead && !o.viewOnly ? ' <button type="button" class="q" data-goff="1">Take off ' + esc(worn[open].label) + '</button>' : '') + '</div><div class="gp-grid"></div>';
      var grid = wrap.querySelector('.gp-grid');
      pcs.forEach(function (x) { var b = document.createElement('button'); b.type = 'button';
        b.className = 'gp-item t' + x.tier + (x.check.worn ? ' worn' : x.check.ok ? ' ok' : ' no');
        b.title = x.label + ' · ' + V.TIER_LABELS[x.tier] + (x.legendary ? ' · legendary' : '') + (V.lockHint && V.lockHint(x.id) ? ' · ' + V.lockHint(x.id) : '') + ' · ' + (x.check.worn ? 'worn' : x.check.ok ? 'click to equip' : o.compact ? 'not available' : 'cannot equip: ' + x.check.why) + ' · own ' + x.owned + ' (' + x.free + ' free)';
        b.setAttribute('aria-label', b.title); b.dataset.gid = x.id;
        b.appendChild(iconCanvas(x.id));
        b.insertAdjacentHTML('beforeend', '<span class="gp-n">' + (x.owned ? '×' + x.owned : '') + '</span>' + (x.legendary ? '<span class="gp-star">★</span>' : '') + (x.check.worn ? '<span class="gp-on">ON</span>' : ''));
        b.onclick = function () { if (o.viewOnly) return viewMsg();
          var c = V.equipCheck(o.world, o.owner, p.id, x.id);
          if (!c.ok && o.compact) return; if (!c.ok) return say(x.label + ': ' + (c.worn ? 'already worn by #' + p.id : 'can\'t equip — ' + c.why), !c.worn);
          o.onEquip({ kind: 'equip', owner: o.owner, petId: p.id, slot: open, gid: c.gid }, 'Equipped ' + x.label + ' on #' + p.id + (c.from ? ' (moved from #' + c.from + ')' : ''));
        };
        grid.appendChild(b); });
      var off = wrap.querySelector('[data-goff]'); if (off) off.onclick = function () { if (o.viewOnly) return viewMsg(); o.onEquip({ kind: 'equip', owner: o.owner, petId: p.id, slot: open, gid: null }, 'Took ' + worn[open].label + ' off #' + p.id); };
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
  /** wizardPetFrames: a player-hatched Bitcoin Wizard (species 'wizard', from the Cold Storage block) drawn by WizardSprite in the normal BLUE palette
   * (purple stays the community pet's), wearing its own worn pieces; the Wizard Hat piece draws the pointy hat. Mythic gets the gold rim like every Mythic. */
  function wizGearOf(ids) { var o = {}; (ids || []).forEach(function (id) { var it = V.GEAR_BY_ID[id] || (BonusGear.DEFS[id] ? { slot: BonusGear.DEFS[id].slot, label: BonusGear.DEFS[id].label } : null); if (!it) return;
      var sl = it.slot === 'weapon' ? 'hand' : it.slot; if (id === 'wizard-hat') { o.head = WizardSprite.WIZARD_HAT; return; } if (id === 'sig-wizard-staff') { o.weapon = { label: it.label, item: id, cols: ['#9a4a12', '#f7931a'] }; return; } /* Bitcoin staff: own weapon slot, right hand */
      var c = itemCols(id).slice(), m = /\b(gold|golden|silver|brown|black|white|red|green|blue|midnight|purple|pink|orange|iron|wooden|denim)\b/i.exec(it.label || ''); if (m) c.unshift(WORD_COL[m[1].toLowerCase()]); o[sl] = { label: it.label, item: id, cols: c }; });
    return o; }
  /** wizardHybridFrames: a hybrid whose body shape is the Wizard. Assembled by V2Rules.hybridRender (colours/feature from the other roots) with the
   * pet's worn pieces drawn by WizardSprite's gear layer (same anchors as a player Wizard). Hat rule: hybrids may wear their parents' ★ pieces EXCEPT
   * the hat, so the Wizard Hat is never drawn on a hybrid. Black eye + bandage traced on the Wizard eye cells, exactly like wizardPetFrames. */
  function wizardHybridFrames(art, stage, ids, extraOv) { var G = wizGearOf((ids || []).filter(function (id) { return id !== 'wizard-hat'; }));
    var fr = [0, 1, 2, 3].map(function (f) { return V.hybridRender(art, { stage: stage || 0, frame: f, wizGear: G }); });
    return wizardShiner(fr, stage, G, extraOv); }
  function wizardPetFrames(art, stage, ids, extraOv) { var G = wizGearOf(ids), fr = WizardSprite.frames(stage || 0, (art && art.bgColor) || '#2a3a2e', G, {});
    return wizardShiner(fr, stage, G, extraOv); }
  function wizardShiner(fr, stage, G, extraOv) {
    if ((extraOv || []).indexOf('v2-black-eye') < 0 || !WizardSprite.draw) return fr;
    /* arena-injury: the player Wizard wears the same shiner + bandage, traced on his 'k' eye cells; his hat stays on top (re-draw only if hidden) */
    return fr.map(function (f, n) { var g = WizardSprite.draw(stage || 0, n, G), g0 = WizardSprite.draw(stage || 0, n, {}), E = [], img = { width: 32, height: 32, data: new Uint8ClampedArray(f.data) };
      for (var y = 0; y < 32; y++) for (var x = 0; x < 32; x++) if (g0[y] && g0[y][x] === 'k' && y < 20) E.push({ x0: x, x1: x, y0: y, y1: y });
      if (!E.length) return f; E.sort(function (p, q) { return p.x0 - q.x0; }); E = [E[0], E[E.length - 1]];
      var sil = function (X, Y) { return X >= 0 && Y >= 0 && X < 32 && Y < 32 && !!(g0[Y] && g0[Y][X]); }, a = {}; injure(img, sil, E, a);
      var hat = function (X, Y) { return g[Y] && g0[Y] && g[Y][X] !== g0[Y][X]; }, keep = new Uint8ClampedArray(f.data);
      (a._band || []).forEach(function (q) { if (hat(q[0], q[1])) { var i = (q[1] * 32 + q[0]) * 4; img.data[i] = keep[i]; img.data[i + 1] = keep[i + 1]; img.data[i + 2] = keep[i + 2]; } });
      injureAfter(img, a); return Object.assign({}, f, { data: img.data }); }); }
  var WORD_COL = { gold: '#ffd23f', golden: '#ffd23f', silver: '#c9ced8', brown: '#8a5a2b', black: '#2a2630', white: '#f2f2f2', red: '#d8433a', green: '#3ddc84', blue: '#2f6fe0', midnight: '#2a3170', purple: '#8a4fd8', pink: '#ff8fc8', orange: '#f7931a', iron: '#8a8f99', wooden: '#9a6a3a', denim: '#3b5ba8' };
  /** communityGap(w) (owner rule Oct 19 2026): true when the community pet has gone into Cold Storage (the Bitcoin Wizard at Mythic, w.wizardMythic)
   * and no newer community pet exists yet. The spots then show the coming-soon placeholder (see comingSoonFrames). Display only. */
  function communityGap(w) { if (w && w.kekMythic && COMMUNITY_NEXT_NO < 4) setNextNo(4); /* after Lord Kek's Cold Storage: 'Community pet #4 coming soon' everywhere */ return !!(w && w.wizardMythic && !(w.community && w.community.nextPet)); }
  /** Coming-soon rule (owner, Oct 20 2026; replaces the show-nothing rule): during a communityGap the community spots STAY visible with an 8-bit
   * mystery egg + 'Community pet #N coming soon'. N = COMMUNITY_NEXT_NO (#1 Nakamoto, #2 Bitcoin Wizard, so the next is #3). Feed/gear stay disabled. Display only. */
  var COMMUNITY_NEXT_NO = 3, soonCache = null;
  /** setNextNo(n): after Lord Kek's Cold Storage (gated) the placeholder reads #4. Display only. */
  function setNextNo(n) { COMMUNITY_NEXT_NO = n; if (window.V2Render) window.V2Render.COMMUNITY_NEXT_NO = n; }
  function comingSoonText() { return 'Community pet #' + COMMUNITY_NEXT_NO + ' coming soon'; }
  function comingSoonFrames() { if (soonCache) return soonCache;
    var EGG = ['..........XXXXXXXXXXXX..........', '........XXooooooooooooXX........', '.......XooooooooooooooooX.......', '......XooooooooooooooooooX......', '.....XooooooooooooooooooooX.....', '....XooooooooooooooooooooooX....', '....XooooooooooooooooooooooX....', '...XooooooooooooooooooooooooX...', '...XooooooooooooooooooooooooX...', '...XooooooooooooooooooooooooX...', '..XooooooooooooooooooooooooooX..', '..XooooooooooooooooooooooooooX..', '..XooooooooooooooooooooooooooX..', '..XooooooooooooooooooooooooooX..', '..XooooooooooooooooooooooooooX..', '..XooooooooooooooooooooooooooX..', '..XooooooooooooooooooooooooooX..', '...XooooooooooooooooooooooooX...', '...XooooooooooooooooooooooooX...', '....XooooooooooooooooooooooX....', '.....XooooooooooooooooooooX.....', '......XXooooooooooooooooXX......', '........XXXXXXXXXXXXXXXX........'];
    var Q = ['.QQQQ.', 'QQ..QQ', '....QQ', '...QQ.', '..QQ..', '..QQ..', '......', '..QQ..', '..QQ..'];
    function fr(dy, qc) { var d = new Uint8ClampedArray(32 * 32 * 4), C = { bg: [42, 58, 46], X: [26, 16, 32], o: [58, 52, 78], h: [84, 76, 110], Q: qc, sh: [30, 42, 34] };
      function px(x, y, c) { if (x < 0 || y < 0 || x > 31 || y > 31) return; var i = (y * 32 + x) * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255; }
      for (var y = 0; y < 32; y++) for (var x = 0; x < 32; x++) px(x, y, C.bg);
      for (var sx = 9; sx < 23; sx++) px(sx, 29, C.sh); for (var sx2 = 7; sx2 < 25; sx2++) px(sx2, 30, C.sh);
      var top = 6 + dy; EGG.forEach(function (row, r) { for (var x = 0; x < 32; x++) { var ch = row[x]; if (ch === 'X') px(x, top + r, C.X); else if (ch === 'o') px(x, top + r, (x < 9 && r > 2 && r < 12) ? C.h : C.o); } });
      Q.forEach(function (row, r) { for (var x = 0; x < 6; x++) if (row[x] === 'Q') px(13 + x, top + 7 + r, C.Q); });
      return { data: d, width: 32, height: 32 }; }
    soonCache = [fr(0, [255, 210, 63]), fr(0, [255, 210, 63]), fr(-1, [255, 236, 150]), fr(0, [255, 210, 63])]; return soonCache; }
  /** wizardTop(w, n): the Bitcoin Wizard's top feeders recorded at Cold Storage (w.wizardMythic.top) as a short html list ('' if none). */
  function wizardTopHtml(w, esc, fmt) { var t = (w && w.wizardMythic && w.wizardMythic.top) || []; if (!t.length) return '';
    var sh = function (a) { a = String(a || ''); return a.length > 12 ? a.slice(0, 6) + '…' + a.slice(-4) : a; };
    return '<div class="small soon-top"><b>🏆 Bitcoin Wizard top ' + t.length + ' feeders</b><ol class="lb">' + t.map(function (x) { return '<li title="' + esc(x.address) + '">' + esc(sh(x.address)) + ' · ' + fmt(Math.floor(x.amount)) + '</li>'; }).join('') + '</ol></div>'; }
  /** showEl(el, on): hide/show an element completely (display:none beats any panel/grid display rule). */
  function showEl(el, on) { if (el) el.style.display = on ? '' : 'none'; }
  /** communityFrames(w): the Bitcoin Wizard (after the switch) at its stage wearing its community-roll gear; before it, Nakamoto as below. */
  /* LORD KEK (community pet #3, gated by V2Rules ACTIVATE_KEK_BLOCK, off by default): c.current === 'kek' only once the gate is reached.
   * He wears community rolls made from the gate on (the Wizard's old rolls stay in gearLog, unworn). His nemes is part of him: Headwear rolls are
   * recorded as usual but never drawn on him (owner Oct 20 ~6:07 PM CT). */
  function kekOn(w) { return !!(w && w.community && w.community.current === 'kek' && window.KekSprite); }
  function kekGear(w) { var V = window.V2Rules, gate = V.kekActivation ? V.kekActivation() : null, g = (w.community && w.community.gear) || {}, o = {};
    (V.V2_SLOTS || []).forEach(function (sl) { var x = g[sl]; if (x && sl !== 'head' && gate != null && x.block >= gate) { var c = itemCols(x.item).slice(); o[sl] = { label: x.label, item: x.item, cols: c }; } });
    return o; }
  /** kekHybFrames: a hybrid with the Kek body (gated). Base = V2Rules.hybridFrames (no PetCore gear: no Kek anchors); worn pieces are drawn by
   * KekSprite's gear layer and pasted where they differ from the bare Kek grid (same pixels a player Kek would show), so gear sits on his body. */
  function kekHybFrames(art, stage, ids) { var fr = V.hybridFrames(art, { stage: stage }), G = wizGearOf(ids); delete G.head; if ((ids || []).indexOf('kek-card') >= 0) G.hand = KekSprite.KEK_CARD;
    if (!Object.keys(G).length) return fr; var P = KekSprite.PAL;
    return fr.map(function (f, n) { var a = KekSprite.draw(stage || 0, n, G), z = KekSprite.draw(stage || 0, n, {}), d = new Uint8ClampedArray(f.data);
      for (var y = 0; y < 32; y++) for (var x = 0; x < 32; x++) { var k = a[y][x]; if (!k || k === z[y][x]) continue; var c = P[k] || k; if (c[0] !== '#') continue; var i = (y * 32 + x) * 4;
        d[i] = parseInt(c.slice(1, 3), 16); d[i + 1] = parseInt(c.slice(3, 5), 16); d[i + 2] = parseInt(c.slice(5, 7), 16); d[i + 3] = 255; }
      return { width: 32, height: 32, data: d }; }); }
  /** coldFrames(sp, ids, stage) (2026-10-20, owner): a community pet's Cold Storage portrait. Every community pet in Cold Storage shows at Mythic in
   * its full signature loadout (ARCHIVE entry .loadout in v2-pages.js, data only; Nakamoto is the bare exception). Sprite-sheet species are drawn
   * by their own sprite module in the community palette; the loadout goes through the same gear mapping as a player pet of that species. */
  /* FUNTRUMP (community pet #4; LIVE from V2Rules ACTIVATE_FUNTRUMP_BLOCK = 972,880): c.current === 'funtrump' only once
   * the gate is reached AND Lord Kek is in Cold Storage. His hair is part of him (Headwear sits on top of the fringe). Every slot is drawn by
   * FuntrumpSprite's gear layer (anchors measured on his own frames). Player FUNTRUMPs / FUNTRUMP-body hybrids use the same mapping (ftGearOf). */
  function ftOn(w) { return !!(w && w.community && w.community.current === 'funtrump' && window.FuntrumpSprite); }
  function ftGearOf(ids) { ids = ids || []; var G = wizGearOf(ids.filter(function (id) { return id !== 'ft-samurai-sword'; }));
    if (ids.indexOf('ft-hairspray') >= 0 && window.FuntrumpSprite) G.hand = FuntrumpSprite.FT_SPRAY; /* FUNTRUMP gear pieces: drawn by FuntrumpSprite by item id */
    if (ids.indexOf('ft-samurai-sword') >= 0) G.weapon = { label: 'Samurai sword', item: 'ft-samurai-sword', cols: ['#c8d0da', '#ffd23f'] }; return G; }
  function ftLookOf(art) { return (art && art.ftLook) || (art && art.tierIndex >= 3 ? 'hoodie' : 'suit'); }
  function ftGear(w) { var V = window.V2Rules, gate = V.ACTIVATE_FUNTRUMP_BLOCK, g = (w.community && w.community.gear) || {}, o = {};
    (V.V2_SLOTS || []).forEach(function (sl) { var x = g[sl]; if (x && gate != null && x.block >= gate) o[sl] = { label: x.label, item: x.item, cols: itemCols(x.item).slice() }; }); return o; }
  function ftPetFrames(art, stage, ids) { return FuntrumpSprite.frames(stage || 0, (art && art.bgColor) || '#1f2a44', ftGearOf(ids), { look: ftLookOf(art) }); } /* Rare = suit, Legendary = hoodie */
  function ftHybFrames(art, stage, ids) { var fr = V.hybridFrames(art, { stage: stage }), G = ftGearOf(ids); if (!Object.keys(G).length) return fr; var P = FuntrumpSprite.PAL;
    return fr.map(function (f, n) { var a = FuntrumpSprite.draw(stage || 0, n, G), z = FuntrumpSprite.draw(stage || 0, n, {}), d = new Uint8ClampedArray(f.data);
      for (var y = 0; y < 32; y++) for (var x = 0; x < 32; x++) { var k = a[y][x]; if (!k || k === z[y][x]) continue; var c = P[k] || k; if (c[0] !== '#') continue; var i = (y * 32 + x) * 4;
        d[i] = parseInt(c.slice(1, 3), 16); d[i + 1] = parseInt(c.slice(3, 5), 16); d[i + 2] = parseInt(c.slice(5, 7), 16); d[i + 3] = 255; }
      return { width: 32, height: 32, data: d }; }); }
  var COLD_SPRITES = { wizard: function () { return window.WizardSprite; }, kek: function () { return window.KekSprite; }, funtrump: function () { return window.FuntrumpSprite; } };
  function coldFrames(sp, ids, stage) { var S = COLD_SPRITES[sp] && COLD_SPRITES[sp](); if (!S) return null; var G = wizGearOf(ids);
    if (sp === 'funtrump') G = ftGearOf(ids);
    if (sp === 'kek') { delete G.head; if ((ids || []).indexOf('kek-card') >= 0 && S.KEK_CARD) G.hand = S.KEK_CARD; } /* same mapping as kekPetFrames */
    var fr = S.frames(stage, '#2a3a2e', G, { community: true }); return stage === 5 && MYTH_PREVIEW ? mythFx(fr, function (bg) { return S.frames(stage, bg, G, { community: true }); }, MYTH_PREVIEW) : fr; }
  function contestFrames(art, stage, ids) { var G = wizGearOf(ids); return ContestSprite.frames(art.species, stage || 0, (art && art.bgColor) || '#14101e', G); } /* contest pets: worn gear drawn by ContestSprite.gearLayer */
  function kekPetFrames(art, stage, ids) { var G = wizGearOf(ids); delete G.head; if ((ids || []).indexOf('kek-card') >= 0) G.hand = KekSprite.KEK_CARD; return KekSprite.frames(stage || 0, (art && art.bgColor) || '#2a3a2e', G, {}); }
  /** Card flavour (owner Q4): shown as a tap-to-see line on his card only, no game effect. */
  var KEK_CARD = 'Card: ⚔ 25 · 🛡 38 · ❤ 42 · Element: Eye · Rareness: ∞ · "All Pepes worship Lord Kek as the most powerful Pepe in existence. ~Godhead~" (flavour only)';
  function communityFrames(w) { var c = w && w.community; if (ftOn(w)) return FuntrumpSprite.frames(c.funtrumpStage || 0, '#1f2a44', ftGear(w), { community: true }); if (kekOn(w)) return KekSprite.frames(c.kekStage || 0, '#2a3a2e', kekGear(w), { community: true }); if (c && c.returned && window.WizardSprite) return WizardSprite.frames(c.wizardStage || 0, '#2a3a2e', c.wizardStage > 0 ? wizardGear(w) : { head: WizardSprite.WIZARD_HAT }, { community: true }); /* purple = community-pet-only palette */
    return nakaFrames(w); }
  function nakaFrames(w) { var NG = window.GenPetCore || PetCore, live = window.PetCore; if (V2Gear.reworkNakamoto) V2Gear.reworkNakamoto(NG);
    var nk = Object.assign(NG.characterPet('nakamoto', { tier: 'legendary' }), { band: 'none', crown: 'none', armor: 'none', cape: 'none', weapon: 'none', background: 'solid', bgColor: '#2a3a2e', pattern: 'none' });
    var ids = w && V.communityGear ? V.communityGear(w) : [];
    if (!ids.length) return [0, 1, 2, 3].map(function (f) { return NG.render(nk, { stage: 5, frame: f, gearOverride: {} }); });
    window.PetCore = NG; try { return framesWith(nk, 5, ids, [], 6); } finally { window.PetCore = live; } }
  /** communityGearText(w): 'Headwear: X · Grip: Y' (or '' when Nakamoto has no community gear yet). */
  function communityGearText(w) { var g = (w && w.community && w.community.gear) || {}; return (V.V2_SLOTS || []).filter(function (s) { return g[s]; }).map(function (s) { return V.slotLabel(s) + ': ' + g[s].label + (g[s].legendary ? ' ★' : ''); }).join(' · '); }
  /** communityWearing(w): 'Wearing: Headwear: X · …' or 'Wearing: no gear yet' (always shown for the community pet). */
  function communityWearing(w) { if (kekOn(w)) { var kg = kekGear(w), kt = Object.keys(kg).map(function (sl) { return kg[sl].label + (kg[sl].signature ? ' ★' : ''); }).join(' · '); return 'Wearing: ' + (kt || 'his nemes (part of him)'); }
    var t = communityGearText(w), c = w && w.community, g = (c && c.gear) || {};
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
    if (V2 && V2.breedsLeft) { var bl = V2.breedsLeft(p, tip); out.push('<b>Lifetime breeds:</b> <span class="brused' + (bl.left ? '' : ' brcap') + '">' + bl.used + '/' + bl.cap + '</span> used · ' + (bl.left ? bl.left + ' left' : 'no breeds left') + ' <span class="muted">(Gen ' + V2.genOf(w, p) + ')</span>'); }
    var xb = breedExtrasHtml(w, p); if (xb) out.push(xb);
    return '<div class="small famline">' + out.map(function (x) { return '<div>' + x + '</div>'; }).join('') + '</div>'; }
  /** breedExtrasHtml(w, p): breeding v2 display: traded body parts, mutation, throwback trait and breeder badges (display only). */
  function breedExtrasHtml(w, p) { var V2 = window.V2Rules; if (!V2 || !V2.breederBadges) return ''; var out = [];
    if (p.hybrid && p.hybrid.parts && p.hybrid.parts.length) out.push('<b>Traded parts:</b> ' + p.hybrid.parts.map(function (q) { return esc(V2.partLabel(q)); }).join(', '));
    if (p.mutation && V2.mutationLabel) { var ml = V2.mutationLabel(p.mutation).split(': '); out.push('<b>' + esc(ml[0]) + (ml[1] ? ':</b> ' + esc(ml[1]) : '</b>')); }
    if (p.shows && V2.hiddenLabel) out.push('<b>Throwback:</b> ' + esc(V2.hiddenLabel(p.shows)) + (p.shows === 'oddeyes' && p.oddEye && V2.ODD_EYE_COLOURS ? ' (' + esc(V2.ODD_EYE_COLOURS[p.oddEye.col % V2.ODD_EYE_COLOURS.length].id) + ')' : ''));
    if (p.supreme) out.push('<b>' + p.supreme.title + ':</b> <span class="chip brbadge">\uD83D\uDC51 1 of 1</span> <span class="muted">' + (p.supreme.id === 'bo' ? 'Bo Jackson, granted once as an egg' : 'one-time egg for the ' + (p.supreme.id === 'archmage' ? '#1 all-time XCPETS burner' : 'top XCPETS holder')) + ' at block ' + Number(p.supreme.gate).toLocaleString('en-US') + '. Feed it to hatch; it grows through every stage and its look is fixed' + (V2.grantBreedOn && V2.grantBreedOn((w && w.tip || 0) + 1) ? '; it can breed, fight and wear gear like any pet.' : ' and it can\'t breed.') + '</span>');
    if (p.contest) out.push('<b>' + esc(p.contest.title) + ':</b> <span class="chip brbadge">\uD83C\uDFC6 1 of 1</span> <span class="muted">one-time prize egg granted at block ' + Number(p.contest.gate).toLocaleString('en-US') + '. Feed it to hatch; it grows through every stage, breeds, fights and wears gear. Its babies are normal pets.</span>');
    if (p.burnLord) out.push('<b>Burn Lord edition:</b> <span class="chip brbadge">\uD83D\uDD25 ' + p.burnLord.n + ' of ' + p.burnLord.of + '</span> <span class="muted">one-time grant to the top ' + p.burnLord.of + ' burners (rank ' + p.burnLord.rank + ', ' + Math.round(p.burnLord.total).toLocaleString('en-US') + ' XCPETS burned to the end of block ' + Number(p.burnLord.gate).toLocaleString('en-US') + '). Granted as an egg: feed it to hatch; it grows through every stage, its look is fixed and it can\'t breed.</span>');
    var bd = V2.breederBadges(w, p); if (bd.length) out.push('<b>Badges:</b> ' + bd.map(function (x) { return '<span class="chip brbadge" title="' + esc(x.tip) + '">' + x.icon + ' ' + esc(x.name) + '</span>'; }).join(' '));
    return out.join('</div><div>'); }
  /** genChip(w, p): 'Gen N' chip (Gen 0 = hatched) plus 'n/6 breeds' for cards. Display only. */
  function genChip(w, p) { var V2 = window.V2Rules; if (!V2 || !V2.genOf) return ''; var bl = V2.breedsLeft(p, w && w.tip);
    return '<span class="chip gen" title="Generation (Gen 0 = hatched)">Gen ' + V2.genOf(w, p) + '</span>' + (p.stage >= 3 && !p.dead ? '<span class="chip brk" title="Lifetime breeds used (cap ' + bl.cap + ')">💞 ' + bl.used + '/' + bl.cap + '</span>' : ''); }
  /** bredFrom(w, p, jump): '💞 Bred from #A Name × #B Name' chip for any bred pet/egg (p.parents); '' otherwise. jump adds data-jump for in-page jumps. Display only. */
  function bredFrom(w, p, jump) { if (!p || !p.parents || p.parents.length < 2) return ''; var L = function (id) { var q = w.byId[id]; return '<a href="pet.html?id=' + id + '"' + (jump ? ' data-jump="' + id + '"' : '') + '>#' + id + (q ? ' ' + esc(q.name) : '') + '</a>'; };
    return '<span class="chip origin bred bredfrom">💞 Bred from ' + L(p.parents[0]) + ' × ' + L(p.parents[1]) + '</span>'; }
  /** communityStats(w, rowsN): the home page community-pet readout numbers (same formulas as v2-pages.js front()), for the play page. Display only. */
  function communityStats(w, rowsN) { var V = window.V2Rules, c = w.community, T = V.WIZARD_THRESHOLDS, N = V.STAGE_NAMES, wiz = !!c.returned, st = c.petStage;
    if (c.current === 'funtrump') { T = V.COMMUNITY_THRESHOLDS || T; var ff = c.funtrumpFed || 0, fh = st < 5 ? T[st + 1] : null; return { stage: N[st], fed: Math.floor(ff), next: fh ? Math.ceil(fh - ff - 1e-6) : null, nextName: fh ? N[st + 1] : null, pct: fh ? Math.min(100, 100 * (ff - T[st]) / (fh - T[st])) : 100, burns: rowsN, pets: w.pets.length }; } /* FUNTRUMP (gated, inert) */
    if (c.current === 'kek') { T = V.COMMUNITY_THRESHOLDS || T; var kf = c.kekFed || 0, kh = st < 5 ? T[st + 1] : null; return { stage: N[st], fed: Math.floor(kf), next: kh ? Math.ceil(kh - kf - 1e-6) : null, nextName: kh ? N[st + 1] : null, pct: kh ? Math.min(100, 100 * (kf - T[st]) / (kh - T[st])) : 100, burns: rowsN, pets: w.pets.length }; }
    var lo = wiz ? T[st] : 0, hi = wiz && st < 5 ? T[st + 1] : null, fed = wiz ? c.wizardFed : 0;
    return { stage: N[st], fed: Math.floor(wiz ? c.wizardFed : c.burned), next: hi ? Math.ceil(hi - fed - 1e-6) : null, nextName: hi ? N[st + 1] : null, pct: hi ? Math.min(100, 100 * (fed - lo) / (hi - lo)) : 100, burns: rowsN, pets: w.pets.length }; }
  /** careTarget(w, p, tip): the care line pet p is actually growing toward, from the SAME per-pet thresholds the rules engine stages it with
   * (V2Rules.petThresholds: species scale + the owner's Mythic discount; the community pet keeps its own scale). Display only (2026-10-19, build mythic-target-fix):
   * every care target / Mythic line / progress bar uses this so the My Pets card, detail panel and pet page agree. pct = care toward Mythic, capped at 100. */
  function careTarget(w, p, tip) { var V = window.V2Rules, th = V.petThresholds ? V.petThresholds(w, p, tip) : V.thresholdsFor(p.species, tip), base = V.thresholdsFor(p.species, tip);
    return { th: th, mythic: th[5], discount: th[5] < base[5], pct: Math.min(100, 100 * p.care / th[5]) }; }
  /* starve-warning (2026-10-19, owner option B 7:34 AM CT; replaces the burial-choice draft): display only, NO rule changes.
   * A living, non-Mythic, non-released, non-community pet that is neglected (3+ chain days unfed, V2Rules liveAt p.neglected) and wears gear gets a
   * starvation warning: countdown = the engine's own death block (liveAt: deathBlock = (day(last feed or hatch, or the live clock anchor) + NEGLECT_DAYS + 1) x 144)
   * minus the tip, at ~10 min a block, in days + hours (like the ranking NGMI board), the worn pieces, and the true rule: at death V2Rules finish() takes every
   * worn piece off and it stays with the owner (back in the bag). Feed = the existing feed flow (owner only); visitors / non-owners see it read-only.
   * The Bitcoin Wizard is not in w.pets and community pets are skipped. */
  function starveLeft(n) { var H = Math.round(n * 10 / 60), d = Math.floor(H / 24), h = H % 24;
    if (H < 1) return { long: (n * 10) + ' min', short: (n * 10) + 'm' };
    return { long: (d ? d + ' day' + (d === 1 ? '' : 's') : '') + (d && h ? ' ' : '') + (h ? h + ' h' : ''), short: (d ? d + 'd' : '') + (d && h ? ' ' : '') + (h ? h + 'h' : '') }; }
  function starveInfo(w, p) {
    if (!w || !p || w.tip == null || p.dead || p.released || p.community || p.mythicCare || !p.neglected || p.deathBlock == null || p.deathBlock <= w.tip) return null;
    var S = V.V2_SLOTS, g = V.wornOf(w, p.id).slice().sort(function (a, b) { return S.indexOf(a.slot) - S.indexOf(b.slot); }); if (!g.length) return null;
    var n = p.deathBlock - w.tip, L = starveLeft(n);
    return { blocks: n, at: p.deathBlock, left: L.long, short: L.short, unfed: hungerDays(p, w), gear: g, grave: p.graveGear != null, graveBlock: p.graveGear, graveTx: p.graveTx, graveLive: !!(V.graveOn && V.graveOn(w.tip)) }; }
  function fmtN(n) { return Number(n).toLocaleString('en-US'); }
  /** starveHtml(w, p, owner, o): the warning ('' when the pet does not qualify). owner = connected address ('' = none).
   *  o.feedHref: owner CTA is a link (pet.html -> play.html#pet-ID); otherwise it is a button wired by bindStarve to the existing feed flow. */
  function starveHtml(w, p, owner, o) {
    var b = starveInfo(w, p); if (!b) return ''; o = o || {};
    var own = !!owner && p.owner === owner && !p.released, n = b.gear.length, pcs = n + ' gear piece' + (n === 1 ? '' : 's'), bag = own ? 'your stash' : 'the owner\'s stash';
    var cta = own ? (p.hungry && p.nextMeal > 0 ? (o.feedHref ? '<a class="btn ico-flame" data-sfeed="1" href="' + esc(o.feedHref) + '">Feed #' + p.id + ' (' + fmtN(p.nextMeal) + ')</a>' : '<button type="button" class="btn ico-flame" data-sfeed="1">Feed #' + p.id + ' (' + fmtN(p.nextMeal) + ')</button>') + ' <span class="small muted">one meal resets the clock</span>' : '<span class="small muted">No meal is due right now.</span>')
      : '<span class="small">Only the owner can feed #' + p.id + '.</span>' + (!owner ? ' <span class="small">Your pet? <button type="button" class="q" data-sconn="1">Connect wallet</button> to feed it.</span>' : ' <span class="small muted">The connected wallet does not own #' + p.id + '.</span>');
    return '<div class="starve" data-starve="' + p.id + '" role="region" aria-label="Starvation warning for #' + p.id + '"><h3 class="sec" data-ico="skull">Starvation warning</h3>' +
      '<p class="bcount">💀 #' + p.id + ' dies of hunger in <b>~' + b.left + '</b> <span class="small muted">(' + fmtN(b.blocks) + ' block' + (b.blocks === 1 ? '' : 's') + ', at block ' + fmtN(b.at) + ')</span> unless it is fed.</p>' +
      '<p class="small">Neglected: ' + b.unfed + ' chain day' + (b.unfed === 1 ? '' : 's') + ' without a meal. Feed it to save it.</p>' +
      '<p class="small">It wears ' + pcs + ':</p><ul class="small bgear">' + b.gear.map(function (g) { return '<li>' + esc(V.slotLabel(g.slot)) + ': ' + esc(g.label) + (g.legendary ? ' ★' : '') + '</li>'; }).join('') + '</ul>' +
      (b.grave ? '<p class="small">If it dies, the gear it wears then stays on its grave (the owner chose this on chain). Pieces taken off before that go to ' + bag + '.</p>'
        : '<p class="small">If it dies, its gear comes back to ' + bag + ' automatically, so no gear is lost.</p>') +
      '<div class="scta">' + cta + '</div>' + graveRow(p, b, own, o) + '</div>'; }
  /* grave gear (2026-10-19, review branch): status for everyone; the owner gets Leave gear on the grave / Cancel, each one pet:grave burn signed in their own wallet
   * (V2Rules.gravePlan via the existing confirm flow; on pet.html a link to the pet on Play). Hidden before ACTIVATE_GRAVE_GEAR_BLOCK. */
  function graveRow(p, b, own, o) { if (!b.graveLive) return '';
    var st = b.grave ? '<b>on</b>: set at block ' + fmtN(b.graveBlock) + (b.graveTx ? ' (tx ' + esc(String(b.graveTx).slice(0, 8)) + '…)' : '') : '<b>off</b> (default: gear back to the stash)';
    var vo = !!(window.V2View && V2View.viewOnly()); /* address-lookup: view only hides the grave buttons too */
    var btn = !own || vo ? '' : o.feedHref ? ' <a class="q" data-sgrave="' + (b.grave ? 'off' : 'on') + '" href="' + esc(o.feedHref) + '">' + (b.grave ? 'Cancel on Play' : '🪦 Leave gear on the grave on Play') + '</a>'
      : ' <button type="button" class="q" data-sgrave="' + (b.grave ? 'off' : 'on') + '">' + (b.grave ? 'Cancel (gear back to your stash)' : '🪦 Leave gear on the grave') + '</button>';
    return '<p class="small sgrave">Grave gear: ' + st + '.' + btn + (own && !vo && !o.feedHref ? ' <span class="muted">One tiny burn (0.00000001 XCPETS + network fee) signed in your wallet.</span>' : '') + '</p>'; }
  /** bindStarve(root, w, p, owner, {feed()}): wires the Feed and Connect buttons inside root. */
  function bindStarve(root, w, p, owner, o) { if (!root) return; o = o || {};
    var own = function () { var q = (w && w.byId && w.byId[p.id]) || p; return !!owner && q.owner === owner && !q.released; };
    root.querySelectorAll('[data-starve="' + p.id + '"] button[data-sfeed]').forEach(function (b) { b.onclick = function () { if (!own()) return; if (o.feed) o.feed(); }; });
    root.querySelectorAll('[data-starve="' + p.id + '"] button[data-sgrave]').forEach(function (b) { b.onclick = function () { if (window.V2View && V2View.viewOnly()) return; if (!own()) return; if (o.grave) o.grave(b.getAttribute('data-sgrave') === 'on'); }; });
    root.querySelectorAll('[data-starve="' + p.id + '"] [data-sconn]').forEach(function (b) { b.onclick = function () { var c = document.getElementById('wconnect'); if (c) { try { c.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) { } c.click(); } else location.href = 'play.html'; }; }); }
  /** starveChip(w, p): small My Pets card badge. */
  function starveChip(w, p) { var b = starveInfo(w, p); if (!b) return '';
    return '<span class="chip warn schip" title="Neglected: dies of hunger in ~' + b.left + ' unless fed. Its ' + b.gear.length + ' gear piece' + (b.gear.length === 1 ? '' : 's') + ' would come back to your stash.">🪦 starves in ' + b.short + (b.grave ? ' · grave gear' : '') + '</span>'; }
  /** graveCount / graveLine (grave gear): a dead pet that kept its gear (the owner's on-chain choice). */
  function graveCount(w, p) { return p && p.dead ? V.wornOf(w, p.id).length : 0; }
  function graveLine(w, p) { var n = graveCount(w, p); return n ? '🪦 Buried with ' + n + ' gear piece' + (n === 1 ? '' : 's') : ''; }
  window.V2Render = { burnLordFx: burnLordFx, FACING: FACING, setNextNo: setNextNo, kekOn: kekOn, KEK_CARD: KEK_CARD, communityGap: communityGap, comingSoonFrames: comingSoonFrames, comingSoonText: comingSoonText, wizardTopHtml: wizardTopHtml, COMMUNITY_NEXT_NO: COMMUNITY_NEXT_NO, showEl: showEl, careTarget: careTarget, communityStats: communityStats, communityWearing: communityWearing, wizardGear: wizardGear, coldFrames: coldFrames, genChip: genChip, breedExtrasHtml: breedExtrasHtml, bredFrom: bredFrom, communityFrames: communityFrames, communityGearText: communityGearText, drawSnugBeanie: drawSnugBeanie, drawEyeGear: drawEyeGear, fitAnchors: fitAnchors, drawFace: drawFace, faceSpots: faceSpots, facePos: facePos, isV2Face: isV2Face, paint: paint, animate: animate, framesWith: framesWith, petFrames: petFramesC, petFramesRaw: petFrames, mythFx: mythFx, MYTH_MODE: MYTH_MODE, MYTH_PREVIEW: MYTH_PREVIEW, hungerDays: hungerDays, worn: worn, lazy: lazy, itemIcon: itemIcon, cpLogo: cpLogo, iconCanvas: iconCanvas, gearPicker: gearPicker, starveInfo: starveInfo, starveHtml: starveHtml, bindStarve: bindStarve, starveChip: starveChip, graveCount: graveCount, graveLine: graveLine, esc: esc, TID: TID, familyHtml: familyHtml };
})();
/* Launch (Jake 2026-10-14): "Share to Telegram" + branching family tree (parents + grandparents) on the pet detail dialog and pet page. Opens t.me/share with the pet's deep link (pet.html?id=N) and a short brag. */
(function () {
  if (typeof document === 'undefined' || !document.addEventListener) return;
  var TL = ['Common', 'Uncommon', 'Rare', 'Legendary'];
  /* content-fixes 2026-10-19: a dead pet is shared with cemetery wording, not a brag */
  function memorial(p) { var V = window.V2Rules, sp = V && V.speciesLabel ? V.speciesLabel(p.species) : p.species, t = TL[p.tier] || '';
    return 'Remembering ' + (p.name || ('#' + p.id)) + ' #' + p.id + ', ' + (/^[AEIOU]/.test(t) ? 'an ' : 'a ') + t + ' ' + sp + ', resting in the XCPETS Pet Cemetery.'; }
  function shareUrl(p) { var V = window.V2Rules, base = location.href.replace(/[^\/]*([?#].*)?$/, ''), link = base + 'pet.html?id=' + p.id;
    var sp = V && V.speciesLabel ? V.speciesLabel(p.species) : p.species, text = p.dead ? memorial(p) + ' 🪦 @XCPets' : 'Meet ' + (p.name || ('#' + p.id)) + ' #' + p.id + ': a ' + (TL[p.tier] || '') + ' ' + sp + ' (' + (p.stageName || '') + ') on XCPETS. Burned with love. 🔥 @XCPets';
    return 'https://t.me/share/url?url=' + encodeURIComponent(link) + '&text=' + encodeURIComponent(text); }
  /* P9 (wizard-story-short 2026-10-21): 'Share to Telegram' sends the pet's dancing GIF to the XCPets group, client-side only (no bot token in the site):
   * phones with file sharing -> the share sheet with the GIF (the player picks the XCPets group); otherwise the GIF downloads and t.me/xcpets opens
   * so it can be dropped into the group. The old t.me/share link stays as the href (no-JS fallback). */
  var TG_GROUP = 'https://t.me/xcpets';
  function button(p) { var a = document.createElement('a'); a.className = 'btn tgshare'; a.target = '_blank'; a.rel = 'noopener'; a.href = shareUrl(p); a.textContent = '📣 Share to Telegram'; a.setAttribute('data-pet', p.id);
    a.onclick = function (e) { e.preventDefault(); shareTelegram(p); }; return a; }
  function withGif(p, fn) { function go() { try { fn(window.XCPGif.petGif(p, window.V2Mock.world(), 8), 'xcpets-' + p.id + '.gif'); } catch (e) { toast('Could not make the GIF'); } }
    if (window.XCPGif) return go(); var t = document.createElement('script'); t.src = 'js/v2-gif.js?v=6560d20525'; t.onload = go; t.onerror = function () { toast('Could not load the GIF maker'); }; document.head.appendChild(t); }
  function shareTelegram(p) { var popup = null, phone = !!(navigator.canShare && navigator.share);
    if (!phone) popup = window.open('about:blank', '_blank'); /* opened inside the click so it is not blocked; pointed at the group once the GIF is saved */
    withGif(p, function (blob, name) { var file = null; try { file = new File([blob], name, { type: 'image/gif' }); } catch (e) {}
      if (file && phone && navigator.canShare({ files: [file] })) { navigator.share({ files: [file], text: shortText(p) + ' 🔥 @XCPets ' + petLink(p) }).then(function () { toast('Pick the XCPets group to send it'); }, function (e) { if (!e || e.name !== 'AbortError') desk(); }); return; }
      desk(); function desk() { download(blob, name); if (popup && !popup.closed) popup.location.href = TG_GROUP; else window.open(TG_GROUP, '_blank', 'noopener'); toast('GIF saved: drop it into the XCPets group'); } }); }
  function saveGif(p) { withGif(p, function (blob, name) { download(blob, name); toast('GIF saved'); }); }
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
  function shortText(p) { if (p.dead) return memorial(p); return (p.name || ('#' + p.id)) + ' #' + p.id + ' on XCPETS'; }
  function withBlob(p, fn) { cardCanvas(p).toBlob(function (blob) { if (!blob) { toast('Could not make the image'); return; } fn(blob, 'xcpets-' + p.id + '.png'); }, 'image/png'); }
  function download(blob, name) { var url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.parentNode.removeChild(a); setTimeout(function () { URL.revokeObjectURL(url); }, 10000); }
  function copyPng(blob) { return window.ClipboardItem && navigator.clipboard && navigator.clipboard.write ? navigator.clipboard.write([new window.ClipboardItem({ 'image/png': blob })]) : Promise.reject(new Error('no clipboard')); }
  function shareImage(p) { var link = petLink(p), text = shortText(p) + (p.dead ? ' 🪦 @XCPets' : ' 🔥 @XCPets');
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
  function imgButton(p) { return btn('imgshare savegif', '🎞️ Save GIF', 'Download the pet\'s dancing GIF', saveGif, p); } /* P7: was 'Share image' (share sheet / file save); now a direct GIF download */
  function shareRow(p) { var d = document.createElement('p'); d.className = 'petshare'; d.setAttribute('data-pet', p.id);
    [imgButton(p), btn('xshare', '𝕏 Post on X', 'Post on X with the pet card image', postX, p), button(p), btn('ghost saveimg', '💾 Save image', 'Download the pet card image', saveImage, p)].forEach(function (b, i) { if (i) d.appendChild(document.createTextNode(' ')); d.appendChild(b); });
    return d; }
  window.XCPShare = { saveGif: saveGif, shareTelegram: shareTelegram, cardCanvas: cardCanvas, shareImage: shareImage, postX: postX, saveImage: saveImage, shareRow: shareRow };
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
