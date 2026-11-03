/* zgrave (cemetery-graves-1103, owner pick: "Spooky"): 8-bit pixel-art grave for the risen-zombie cards in the
   cemetery: dark slate with a tier glow, a crow, candles and fog; feral zombies go red.
   Pure decoration: draws a canvas BEHIND each .ztomb card; never touches game rules, data, or buttons. */
(function () {
  var look = 2;
  var P = 3; // css px per art pixel
  var css = document.createElement('link'); css.rel = 'stylesheet'; css.href = 'css/zgrave-preview.css?v=zg1103s'; document.head.appendChild(css);

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
  var SKULL = [' wwwww ', 'wwwwwww', 'wkwwwkw', 'wkwwwkw', 'wwwkwww', ' wwwww ', ' w w w '];
  var CROW = ['     kkk   ', '    kkkkk  ', '   kkkkkeyy', '  kkkkkkk  ', ' kkkkkkkk  ', 'kkkkkkkkk  ', 'kk kkkkkk  ', 'k   kkkk   ', '     y y   ', '    yy yy  '];

  var TIERS = { Risen: 0, Shambler: 1, Ghoul: 2, Revenant: 3, Dread: 4 };
  var ACC = ['#b9d4b4', '#9cf08a', '#7dff6a', '#6ff8de', '#d2b8ff'];

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

  /* ---------- apply to cards ---------- */
  var busy = false;
  function tierOf(card) { var z = card.querySelector('.zt'), t = z ? z.textContent : ''; for (var k in TIERS) if (t.indexOf(k) >= 0) return k; return 'Risen'; }
  function paint(card) { var W = card.clientWidth, H = card.clientHeight; if (!W || !H) return;
    var key = look + ':' + W + 'x' + H + ':' + card.className; if (card._zgKey === key) return; card._zgKey = key;
    var cv = card.querySelector(':scope > canvas.zgbg'); if (!cv) { busy = true; cv = document.createElement('canvas'); cv.className = 'zgbg'; cv.setAttribute('aria-hidden', 'true'); card.insertBefore(cv, card.firstChild); busy = false; }
    card.querySelectorAll(':scope > .zgflame').forEach(function (f) { f.remove(); });
    var cw = Math.ceil(W / P), chh = Math.ceil(H / P), id = +String(card.id).replace(/\D/g, '') || 1, tier = tierOf(card), ti = TIERS[tier], feral = card.classList.contains('feral'), acc = feral ? '#ff4d4d' : ACC[ti];
    var st = { id: id, r: rng(id * 7919 + look * 104729), tier: ti, dread: ti >= 4, feral: feral, accRGB: [parseInt(acc.substr(1, 2), 16), parseInt(acc.substr(3, 2), 16), parseInt(acc.substr(5, 2), 16)] };
    cv.width = cw; cv.height = chh; cv.style.width = cw * P + 'px'; cv.style.height = chh * P + 'px';
    var b = new Buf(cw, chh); draw2(b, st);
    var ctx = cv.getContext('2d'), img = ctx.createImageData(cw, chh); img.data.set(b.d); ctx.putImageData(img, 0, 0);
    card.style.setProperty('--zgc', acc); card.setAttribute('data-zm', tier.toLowerCase());
    (st.flames || []).forEach(function (f, i) { var s = document.createElement('i'); s.className = 'zgflame'; s.setAttribute('aria-hidden', 'true'); s.style.left = (f[0] * P - 4) + 'px'; s.style.top = (f[1] * P - 13) + 'px'; s.style.animationDelay = (-i * .37 - id % 5 * .21) + 's'; busy = true; card.appendChild(s); busy = false; });
  }
  var ro = window.ResizeObserver ? new ResizeObserver(function (es) { es.forEach(function (e) { paint(e.target); }); }) : null;
  function scan() { document.querySelectorAll('.ztomb').forEach(function (c) { c.classList.add('zg', 'zg' + look); if (!c._zgObs) { c._zgObs = 1; ro && ro.observe(c); } paint(c); }); }
  var t; function soon() { if (busy) return; clearTimeout(t); t = setTimeout(scan, 60); }
  new MutationObserver(function (ms) { if (ms.some(function (m) { return [].some.call(m.addedNodes, function (n) { return n.nodeType === 1 && !/zgbg|zgflame/.test(n.className || ''); }); })) soon(); }).observe(document.body, { childList: true, subtree: true });
  window.addEventListener('resize', soon);

  function boot() { scan(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
