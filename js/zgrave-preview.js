/* zgrave-preview (TEMPORARY preview, branch cemetery-graves-1103): 8-bit pixel-art looks for the risen-zombie
   grave cards in the cemetery. Off unless the URL has ?grave=1|2|3 -> no effect on the normal page.
   Pure decoration: draws a canvas BEHIND each .ztomb card; never touches game rules, data, or buttons. */
(function () {
  var m = /[?&]grave=([123])/.exec(location.search), look = m ? +m[1] : 0;
  if (!/[?&]grave=/.test(location.search)) return;
  var P = 3; // css px per art pixel
  var css = document.createElement('link'); css.rel = 'stylesheet'; css.href = 'css/zgrave-preview.css?v=zg1103'; document.head.appendChild(css);

  /* ---------- tiny helpers ---------- */
  function rng(seed) { var a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function Buf(w, h) { this.w = w; this.h = h; this.d = new Uint8ClampedArray(w * h * 4); }
  Buf.prototype.px = function (x, y, c, a) { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    var i = (y * this.w + x) * 4, d = this.d, al = a == null ? 1 : a; if (al >= 1) { d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255; return; }
    var da = d[i + 3] / 255, oa = al + da * (1 - al); if (oa <= 0) return;
    for (var k = 0; k < 3; k++) d[i + k] = (c[k] * al + d[i + k] * da * (1 - al)) / oa; d[i + 3] = oa * 255; };
  Buf.prototype.rect = function (x, y, w, h, c, a) { for (var j = 0; j < h; j++) for (var i = 0; i < w; i++) this.px(x + i, y + j, c, a); };
  function shade(c, k) { return [c[0] * k, c[1] * k, c[2] * k]; }
  function sprite(b, rows, x0, y0, pal, flip) { rows.forEach(function (r, y) { for (var x = 0; x < r.length; x++) { var ch = r[flip ? r.length - 1 - x : x]; if (pal[ch]) b.px(x0 + x, y0 + y, pal[ch]); } }); }

  /* mask + chamfer distance to the outside (for bevel, carved frame line) */
  function dist(mask, w, h) { var D = new Float32Array(w * h), BIG = 1e4, x, y, i;
    for (i = 0; i < w * h; i++) D[i] = mask[i] ? BIG : 0;
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) { i = y * w + x; if (!D[i]) continue; var v = D[i];
      v = Math.min(v, x ? D[i - 1] + 1 : 1, y ? D[i - w] + 1 : 1, (x && y) ? D[i - w - 1] + 1.4 : 1.4, (y && x < w - 1) ? D[i - w + 1] + 1.4 : 1.4); D[i] = v; }
    for (y = h - 1; y >= 0; y--) for (x = w - 1; x >= 0; x--) { i = y * w + x; if (!D[i]) continue; var u = D[i];
      u = Math.min(u, x < w - 1 ? D[i + 1] + 1 : 1, y < h - 1 ? D[i + w] + 1 : 1, (x < w - 1 && y < h - 1) ? D[i + w + 1] + 1.4 : 1.4, (x && y < h - 1) ? D[i + w - 1] + 1.4 : 1.4); D[i] = u; }
    return D; }

  /* paint a stone slab from a mask: dithered face, light top-left bevel, dark bottom-right, outline, carved inner line */
  function stone(b, mask, pal, r, frameAt) { var w = b.w, h = b.h, D = dist(mask, w, h);
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) { var i = y * w + x; if (!mask[i]) continue; var d = D[i], c;
      var n = r(), dither = ((x + y) & 1) ? 1 : 0;
      c = n < .12 ? pal.dk : n > .9 ? pal.lt : pal.base; if (dither && n > .55 && n < .62) c = pal.lt;
      var L = (x === 0 || !mask[i - 1]) || (y === 0 || !mask[i - w]), R = (x === w - 1 || !mask[i + 1]) || (y === h - 1 || !mask[i + w]);
      if (d < 1.2) c = pal.ol;
      else if (d < 2.3) { var lft = x > 1 && !mask[i - 2], up = y > 1 && !mask[i - 2 * w]; c = (lft || up) ? pal.hi : pal.sh; }
      if (frameAt && d >= frameAt && d < frameAt + 1) c = pal.sh;
      else if (frameAt && d >= frameAt + 1 && d < frameAt + 2) c = pal.hi;
      b.px(x, y, c); }
    return D; }
  function crack(b, mask, r, x, y, len, col, hi, glow) { var w = b.w;
    for (var k = 0; k < len; k++) { if (x < 0 || y < 0 || x >= w || y >= b.h || !mask[y * w + x]) break;
      if (glow) { b.px(x - 1, y, glow, .35); b.px(x + 1, y, glow, .35); }
      b.px(x, y, col); if (hi) b.px(x + 1, y + 1, hi, .7);
      y++; var q = r(); if (q < .3) x--; else if (q > .7) x++; if (r() < .12) { crack(b, mask, r, x + (r() < .5 ? -1 : 1), y, (len - k) >> 1, col, hi, glow); } } }
  function drips(b, r, topAt, n, col) { for (var k = 0; k < n; k++) { var x = 4 + (r() * (b.w - 8)) | 0, y = topAt(x) + 2, L = 2 + (r() * 6 | 0);
    for (var j = 0; j < L; j++) b.px(x, y + j, j === L - 1 ? shade(col, .7) : col); b.px(x, y + L, shade(col, .5)); } }
  function claw(b, r, x, y, col) { for (var s = 0; s < 3; s++) for (var j = 0; j < 7; j++) { b.px(x + s * 2 + (j >> 1), y + j, col); b.px(x + s * 2 + (j >> 1) + 1, y + j, [20, 0, 0], .6); } }
  var SKULL = [' wwwww ', 'wwwwwww', 'wkwwwkw', 'wkwwwkw', 'wwwkwww', ' wwwww ', ' w w w '];
  var BONE = ['ww    ww', ' wwwwww ', 'ww    ww'];
  var CROW = ['     kkk   ', '    kkkkk  ', '   kkkkkeyy', '  kkkkkkk  ', ' kkkkkkkk  ', 'kkkkkkkkk  ', 'kk kkkkkk  ', 'k   kkkk   ', '     y y   ', '    yy yy  '];

  var TIERS = { Risen: 0, Shambler: 1, Ghoul: 2, Revenant: 3, Dread: 4 };
  var ACC = ['#a9c3a4', '#8fe07f', '#7dff6a', '#5ff5d8', '#b48cff'];

  /* ---------- look 1: carved stone, cracks, moss, dirt mound ---------- */
  function draw1(b, st) { var w = b.w, h = b.h, r = st.r, cx = (w - 1) / 2, hw = (w - 5) / 2, archH = Math.min(16, Math.round(hw * .55)), base = h - 5;
    var mask = new Uint8Array(w * h), top = function (x) { var u = (x - cx) / hw; return Math.round(archH * (1 - Math.sqrt(Math.max(0, 1 - u * u)))); };
    for (var x = 2; x < w - 2; x++) for (var y = top(x); y < base; y++) mask[y * w + x] = 1;
    var pal = st.dread ? { base: [78, 80, 92], dk: [66, 68, 78], lt: [92, 95, 106], hi: [122, 126, 140], sh: [46, 47, 56], ol: [16, 16, 22] }
      : { base: [98, 102, 110], dk: [84, 88, 95], lt: [112, 116, 124], hi: [150, 155, 162], sh: [60, 63, 70], ol: [22, 23, 27] };
    if (st.feral) { pal.base = [92, 80, 82]; pal.dk = [78, 66, 68]; pal.lt = [104, 92, 94]; }
    stone(b, mask, pal, r, 4);
    if (st.dread || st.feral) { for (var y2 = 0; y2 < 7; y2++) for (var x2 = 0; x2 < 7 - y2; x2++) { var xx = w - 3 - x2, yy = top(w - 3) + y2 + 2; if (mask[yy * w + xx]) b.px(xx, yy, [0, 0, 0], 0); var ii = (yy * w + xx) * 4; b.d[ii + 3] = 0; } }
    var nc = 2 + st.tier + (st.feral ? 3 : 0), red = [255, 70, 60];
    for (var k = 0; k < nc; k++) { var sx = 4 + (r() * (w - 8)) | 0; crack(b, mask, r, sx, top(sx) + 1, 8 + (r() * 16 | 0), st.feral ? red : [30, 31, 36], st.feral ? null : pal.hi, st.feral ? [255, 40, 40] : null); }
    var moss = st.dread ? [[40, 70, 38], [56, 90, 44], [92, 70, 120]] : st.feral ? [[70, 66, 34], [92, 82, 40], [120, 40, 40]] : [[52, 112, 44], [80, 150, 56], [126, 196, 80]];
    for (var c = 0; c < 6 + st.tier; c++) { var mx = 2 + (r() * (w - 4)) | 0, my = c < 4 ? top(mx) : (base - 2 - (r() * 30 | 0)), rad = 2 + (r() * 3 | 0);
      if (c >= 4) mx = r() < .5 ? 2 + (r() * 3 | 0) : w - 3 - (r() * 3 | 0);
      for (var dy = -rad; dy <= rad; dy++) for (var dx = -rad - 1; dx <= rad + 1; dx++) { if (dx * dx + dy * dy * 2 > rad * rad + 1 || r() < .25) continue; var px = mx + dx, py = my + dy; if (!mask[py * w + px] && !(mask[(py + 1) * w + px])) continue;
        b.px(px, py, moss[dy < 0 ? 2 : (r() < .5 ? 1 : 0)]); } }
    if (st.feral) { drips(b, r, top, 4, [170, 20, 20]); claw(b, r, (w * .62) | 0, base - 16, [40, 8, 8]); }
    // dirt mound + grass
    var mcy = h + 3, mrx = w / 2 + 3, mry = 10;
    for (var y3 = h - 10; y3 < h; y3++) for (var x3 = 0; x3 < w; x3++) { var e = Math.pow((x3 - cx) / mrx, 2) + Math.pow((y3 - mcy) / mry, 2); if (e > 1) continue; var q = r();
      b.px(x3, y3, e > .86 ? [60, 40, 24] : q < .2 ? [58, 38, 22] : q > .85 ? [112, 80, 50] : [84, 58, 34]);
      if (e > .8 && e <= 1 && r() < .55) { var gh = 1 + (r() * 3 | 0); for (var g = 1; g <= gh; g++) b.px(x3, y3 - g, st.feral ? [86, 80, 40] : g === gh ? [120, 190, 70] : [62, 126, 46]); } }
    if (st.tier >= 3 || st.feral) sprite(b, SKULL, (w * .18) | 0, h - 8, { w: [214, 210, 196], k: st.feral ? [200, 20, 20] : [30, 26, 24] });
    else sprite(b, BONE, (w * .72) | 0, h - 5, { w: [214, 210, 196] });
  }

  /* ---------- look 2: spooky slate, glow, crow, candle, fog ---------- */
  function draw2(b, st) { var w = b.w, h = b.h, r = st.r, cx = (w - 1) / 2, sh = 12, hh = Math.max(18, Math.round((w - 4) * .34)), base = h - 4;
    var mask = new Uint8Array(w * h), top = function (x) { var dx = Math.abs(x - cx); if (dx < hh) return Math.round(sh - (sh - 1) * Math.sqrt(1 - Math.pow(dx / hh, 2))); var e = Math.min(x - 2, w - 3 - x); return e < 3 ? sh + (3 - e) : sh; };
    for (var x = 2; x < w - 2; x++) for (var y = top(x); y < base; y++) mask[y * w + x] = 1;
    var pal = st.dread ? { base: [44, 36, 66], dk: [36, 30, 56], lt: [54, 46, 80], hi: [92, 78, 130], sh: [24, 20, 38], ol: [8, 6, 14] }
      : { base: [38, 46, 60], dk: [32, 38, 50], lt: [46, 56, 72], hi: [76, 92, 112], sh: [20, 26, 34], ol: [6, 8, 12] };
    if (st.feral) pal = { base: [52, 32, 40], dk: [42, 26, 32], lt: [62, 40, 48], hi: [110, 60, 70], sh: [28, 16, 20], ol: [10, 4, 6] };
    stone(b, mask, pal, r, 3);
    var acc = st.accRGB; // faint glow seeping from cracks / runes on the face
    for (var k = 0; k < 2 + (st.tier >> 1) + (st.feral ? 2 : 0); k++) { var sx = 4 + (r() * (w - 8)) | 0; crack(b, mask, r, sx, top(sx) + 1, 6 + (r() * 12 | 0), shade(acc, .9), null, acc); }
    // ground strip
    for (var gx = 0; gx < w; gx++) for (var gy = base; gy < h; gy++) b.px(gx, gy, (r() < .3) ? [26, 40, 30] : [16, 26, 20]);
    for (var t = 0; t < w; t += 2) if (r() < .5) b.px(t, base - 1, [30, 52, 36]);
    // crow on the left shoulder (red eye when feral), flipped for odd ids
    var flip = st.id % 2 === 1, crowX = flip ? w - 2 - 11 - 2 : 4;
    sprite(b, CROW, crowX, sh - CROW.length + 2, { k: [10, 10, 14], e: st.feral ? [255, 40, 40] : [230, 220, 120], y: [190, 160, 60] }, flip);
    // candle(s) on the ground, bottom corner opposite the crow
    st.flames = [];
    var cxs = [flip ? 3 : w - 8]; if (st.dread || st.feral) cxs.push(flip ? w - 8 : 3);
    cxs.forEach(function (x0) { var cy = base - 7; b.rect(x0 - 1, base - 1, 6, 1, [200, 190, 160]); b.rect(x0, cy, 4, 7, [228, 218, 190]); b.rect(x0 + 3, cy, 1, 7, [170, 160, 136]); b.rect(x0, cy, 1, 7, [246, 240, 220]); b.px(x0 + 1, cy + 2, [246, 240, 220]); b.px(x0 + 1, cy - 1, [40, 30, 20]);
      for (var dy = -7; dy <= 5; dy++) for (var dx = -7; dx <= 8; dx++) { var dd = dx * dx + dy * dy; if (dd < 50 && ((dx + dy) & 1) && r() < .5) b.px(x0 + 1 + dx, cy - 2 + dy, [255, 190, 90], .12); }
      st.flames.push([x0 + 1.5, cy - 1]); });
    if (st.tier >= 3 || st.feral) sprite(b, SKULL, (cx - 3) | 0, base - 6, { w: [180, 186, 196], k: st.feral ? [230, 30, 30] : [20, 20, 30] });
    // fog band
    for (var fy = h - 13; fy < h; fy++) for (var fx = 0; fx < w; fx++) { var f = Math.sin(fx * .21 + st.id) + Math.sin(fx * .09 - fy * .4) + (fy - (h - 13)) / 5; if (f < 1) continue; var a = f > 2.4 ? .38 : f > 1.6 ? .24 : .12; if (((fx + fy) & 1) && a < .3) continue; b.px(fx, fy, [196, 206, 236], a); }
    if (st.feral) for (var e = 0; e < 2; e++) { var ex = (w * (.3 + .4 * e)) | 0, ey = h - 6; b.rect(ex, ey, 2, 1, [255, 50, 50]); b.rect(ex + 4, ey, 2, 1, [255, 50, 50]); }
  }

  /* ---------- look 3: gothic ogive + cross, iron fence ---------- */
  function draw3(b, st) { var w = b.w, h = b.h, r = st.r, cx = Math.floor(w / 2), apex = 17, archH = 14, hw = (w - 8) / 2, R = 1.6, sL = 3, sR = w - 4, base = h - 8;
    var mask = new Uint8Array(w * h), norm = Math.sqrt(R * R - (R - 1) * (R - 1)), top = function (x) { var xp = Math.min(x - sL, sR - x) / hw; if (xp < 0) return h; xp = Math.min(1, xp); return Math.round(apex + archH - archH * Math.sqrt(Math.max(0, R * R - Math.pow(R - xp, 2))) / norm); };
    for (var x = sL; x <= sR; x++) for (var y = top(x); y < base; y++) mask[y * w + x] = 1;
    // plinth steps
    for (var y1 = base; y1 < h - 4; y1++) for (var x1 = 1; x1 < w - 1; x1++) mask[y1 * w + x1] = 1;
    for (var y2 = h - 4; y2 < h; y2++) for (var x2 = 0; x2 < w; x2++) mask[y2 * w + x2] = 1;
    // cross (with ring)
    var cross = function (x, y) { return (x >= cx - 2 && x <= cx + 1 && y >= 1 && y < apex + 2) || (x >= cx - 6 && x <= cx + 5 && y >= 5 && y <= 8) || (Math.abs(Math.hypot(x - cx + .5, y - 6.5) - 4.6) < .8 && y < apex) || (x >= cx - 3 && x <= cx + 2 && y <= 2) || ((x === cx - 7 || x === cx + 6) && y >= 4 && y <= 9); };
    for (var yc = 0; yc < apex + 2; yc++) for (var xc = 0; xc < w; xc++) if (cross(xc, yc)) mask[yc * w + xc] = 1;
    var pal = st.dread ? { base: [56, 48, 68], dk: [46, 40, 58], lt: [66, 58, 80], hi: [104, 92, 124], sh: [32, 28, 42], ol: [10, 8, 14] }
      : { base: [70, 70, 78], dk: [58, 58, 66], lt: [82, 82, 90], hi: [120, 120, 132], sh: [40, 40, 48], ol: [12, 12, 16] };
    if (st.feral) pal = { base: [64, 48, 52], dk: [52, 38, 42], lt: [76, 58, 62], hi: [116, 84, 90], sh: [36, 24, 28], ol: [12, 6, 8] };
    stone(b, mask, pal, r, 4);
    // plinth seam lines
    for (var xs = 2; xs < w - 2; xs++) { b.px(xs, base, pal.ol); b.px(xs, h - 4, pal.ol); }
    var vine = st.feral ? [[96, 30, 30], [150, 40, 40]] : st.dread ? [[60, 40, 70], [110, 80, 140]] : [[44, 100, 40], [96, 170, 64]];
    if (st.feral) { for (var k = 0; k < 4; k++) { var sx = 6 + (r() * (w - 12)) | 0; crack(b, mask, r, sx, top(sx) + 1, 10 + (r() * 14 | 0), [255, 60, 50], null, [255, 30, 30]); } drips(b, r, top, 3, [170, 20, 20]); }
    // fence: posts every 4 art px, spear tips, two rails; bent posts when feral
    var ft = h - 14, iron = [20, 20, 26], ihi = [70, 70, 88], tip = st.feral ? [220, 40, 40] : st.dread ? [150, 120, 190] : [110, 110, 128];
    for (var fx = 1; fx < w - 1; fx += 4) { var bend = st.feral && r() < .35 ? (r() < .5 ? -1 : 1) : 0, end = fx < 3 || fx > w - 6;
      for (var fy = ft + 2; fy < h; fy++) { var off = (bend && fy < ft + 6) ? bend : 0; b.px(fx + off, fy, iron); if (end) b.px(fx + 1 + off, fy, ihi); }
      var tx = fx + bend; if (end) { b.rect(tx - 1, ft, 3, 2, iron); b.px(tx, ft - 1, ihi); } else { b.px(tx, ft, tip); b.px(tx - 1, ft + 1, iron); b.px(tx, ft + 1, tip); b.px(tx + 1, ft + 1, iron); } }
    for (var rx = 0; rx < w; rx++) { b.px(rx, ft + 3, iron); b.px(rx, h - 3, iron); if (rx % 2) b.px(rx, ft + 2, ihi, .5); }
    // ivy / dead thorny vines on fence and slab sides
    for (var v = 0; v < w * .5; v++) { var vx = r() * w | 0, vy = ft + 2 + (r() * 11 | 0); b.px(vx, vy, vine[r() < .6 ? 0 : 1]); if (!st.feral && !st.dread && r() < .4) b.px(vx + 1, vy - 1, vine[1]); if (st.dread && r() < .3) b.px(vx, vy - 1, [30, 20, 36]); }
    for (var s = 0; s < 2; s++) { var vx2 = s ? sR - 1 : sL + 1; for (var vy2 = base - 1; vy2 > base - 20 - st.tier * 3; vy2--) { vx2 += (r() < .3 ? (s ? -1 : 1) : 0) * (r() < .5 ? 1 : -1); if (vx2 < sL || vx2 > sR) continue; b.px(vx2, vy2, vine[0]); if (r() < .35) b.px(vx2 + (s ? -1 : 1), vy2, vine[1]); } }
    if (st.feral) { var rx2 = cx - 1; [[0, 0], [1, 1], [2, 0], [1, -1]].forEach(function (p) { b.px(rx2 + p[0], apex + archH + 4 + p[1], [255, 60, 50]); }); }
  }

  /* ---------- apply to cards ---------- */
  var DRAW = [null, draw1, draw2, draw3], busy = false;
  function tierOf(card) { var z = card.querySelector('.zt'), t = z ? z.textContent : ''; for (var k in TIERS) if (t.indexOf(k) >= 0) return k; return 'Risen'; }
  function paint(card) { if (!look) return; var W = card.clientWidth, H = card.clientHeight; if (!W || !H) return;
    var key = look + ':' + W + 'x' + H + ':' + card.className; if (card._zgKey === key) return; card._zgKey = key;
    var cv = card.querySelector(':scope > canvas.zgbg'); if (!cv) { busy = true; cv = document.createElement('canvas'); cv.className = 'zgbg'; cv.setAttribute('aria-hidden', 'true'); card.insertBefore(cv, card.firstChild); busy = false; }
    card.querySelectorAll(':scope > .zgflame').forEach(function (f) { f.remove(); });
    var cw = Math.ceil(W / P), chh = Math.ceil(H / P), id = +String(card.id).replace(/\D/g, '') || 1, tier = tierOf(card), ti = TIERS[tier], feral = card.classList.contains('feral'), acc = feral ? '#ff4d4d' : ACC[ti];
    var st = { id: id, r: rng(id * 7919 + look * 104729), tier: ti, dread: ti >= 4, feral: feral, accRGB: [parseInt(acc.substr(1, 2), 16), parseInt(acc.substr(3, 2), 16), parseInt(acc.substr(5, 2), 16)] };
    cv.width = cw; cv.height = chh; cv.style.width = cw * P + 'px'; cv.style.height = chh * P + 'px';
    var b = new Buf(cw, chh); DRAW[look](b, st);
    var ctx = cv.getContext('2d'), img = ctx.createImageData(cw, chh); img.data.set(b.d); ctx.putImageData(img, 0, 0);
    card.style.setProperty('--zgc', acc); card.setAttribute('data-zm', tier.toLowerCase());
    (st.flames || []).forEach(function (f, i) { var s = document.createElement('i'); s.className = 'zgflame'; s.setAttribute('aria-hidden', 'true'); s.style.left = (f[0] * P - 4) + 'px'; s.style.top = (f[1] * P - 13) + 'px'; s.style.animationDelay = (-i * .37 - id % 5 * .21) + 's'; busy = true; card.appendChild(s); busy = false; });
  }
  var ro = window.ResizeObserver ? new ResizeObserver(function (es) { es.forEach(function (e) { paint(e.target); }); }) : null;
  function scan() { document.querySelectorAll('.ztomb').forEach(function (c) { c.classList.add('zg', 'zg' + look); if (!c._zgObs) { c._zgObs = 1; ro && ro.observe(c); } paint(c); }); }
  var t; function soon() { if (busy) return; clearTimeout(t); t = setTimeout(scan, 60); }
  new MutationObserver(function (ms) { if (ms.some(function (m) { return [].some.call(m.addedNodes, function (n) { return n.nodeType === 1 && !/zgbg|zgflame/.test(n.className || ''); }); })) soon(); }).observe(document.body, { childList: true, subtree: true });
  window.addEventListener('resize', soon);

  /* temporary look switcher (preview only) */
  function bar() { var d = document.createElement('div'); d.className = 'zg-switch'; d.innerHTML = '<b>Grave look (preview):</b> ' + ['Now', '1 Stone', '2 Spooky', '3 Gothic'].map(function (n, i) {
      var u = new URL(location.href); u.searchParams.set('grave', String(i)); return '<a href="' + u.pathname.split('/').pop() + u.search + u.hash + '"' + (i === look ? ' aria-current="true"' : '') + '>' + n + '</a>'; }).join(' ');
    document.body.appendChild(d); }
  function boot() { bar(); scan(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
