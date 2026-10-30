/* XCPETS Pet Cemetery: THE GRAVESTONE (option C "bones, skulls and candles", picked by the owner Oct 29 2026).
 * One 8-bit stone for every grave: grave finder cards (52 by 62), the grave detail on a dead pet's page (60 by 74).
 * An R.I.P. slab on a dirt mound with bones and skulls, the pet carved into the stone in shaded relief (from its own sprite),
 * candles in the rarity colour (2 for Common up to 5 for Legendary) with tiny flickering flames, and flowers in the rarity colour.
 * Grave states: crumbled (cracks, a chipped corner, a candle gone per crumble), hunted (clawed and bloodied, the mound dug up,
 * candles knocked over), dust (failed resurrection: the slab broken, a dust pile, candles out and smoking), halo (brought back:
 * a halo over a pale relief: raised once, it rests for good), open (an altar is open: green flames, a faint green glow). Display only: reads art, never the rules. */
(function () {
  'use strict';
  var TC = ['#9aa3b5', '#4fd18b', '#4f9dff', '#ffc93c'], RM = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  var PF = { R: '110101110101101', I: '111010010010111', P: '110101110100100', '.': '000000000000010' }, MK = {}, LIVE = [], timer = 0, io = null;
  function hex(h) { return [parseInt(h.substr(1, 2), 16), parseInt(h.substr(3, 2), 16), parseInt(h.substr(5, 2), 16)]; }
  function mix(a, b, k) { a = hex(a); b = hex(b); return 'rgb(' + a.map(function (v, i) { return Math.round(v + (b[i] - v) * k); }).join(',') + ')'; }
  function R(x, c, a, b, w, h) { x.fillStyle = c; x.fillRect(a, b, w, h); }
  function rnd(i) { var v = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); }
  /* the pet's silhouette + colours, keyed off a magenta background */
  function mask(art, stage) { var k = (art && (art.dna || art.id || '')) + '|' + stage + '|' + (art && art.species); if (MK[k]) return MK[k]; var d = null;
    try { var a2 = Object.assign({}, art, { background: 'solid', bgColor: '#ff00ff', pattern: 'none' });
      if (window.V2Render && V2Render.framesWith) d = V2Render.framesWith(a2, stage, [])[0].data; else d = PetCore.render(a2, { stage: stage, frame: 0, gearOverride: {} }).data; } catch (e) { d = null; }
    var m = [], col = [], on = 0; if (d) { var kr = d[0], kg = d[1], kb = d[2], mag = 0; for (var q = 0; q < 1024; q++) if (d[q * 4] === 255 && d[q * 4 + 1] === 0 && d[q * 4 + 2] === 255) mag++; if (mag > 60) { kr = 255; kg = 0; kb = 255; }
      for (var k2 = 0; k2 < 1024; k2++) { var j = k2 * 4, o = d[j + 3] > 0 && !(Math.abs(d[j] - kr) < 8 && Math.abs(d[j + 1] - kg) < 8 && Math.abs(d[j + 2] - kb) < 8); m.push(o); col.push([d[j], d[j + 1], d[j + 2]]); if (o) on++; } }
    if (on > 900 || on < 8) { m = []; col = []; for (var z = 0; z < 1024; z++) { m.push(false); col.push([0, 0, 0]); } }
    var keys = Object.keys(MK); if (keys.length > 300) delete MK[keys[0]]; return (MK[k] = { m: m, c: col }); }
  function at(M, x, y) { return x >= 0 && y >= 0 && x < 32 && y < 32 && M.m[y * 32 + x]; }
  function carve(x, M, ox, oy, dark, lip, light, fade) { for (var y = 0; y < 32; y++) for (var xx = 0; xx < 32; xx++) if (at(M, xx, y)) { var c = M.c[y * 32 + xx], L = (c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11) / 255, q = L < 0.22 ? 0 : L < 0.45 ? 0.35 : L < 0.7 ? 0.6 : 0.85;
      R(x, mix(dark, light, Math.min(1, q + (fade || 0))), ox + xx, oy + y, 1, 1); if (!at(M, xx + 1, y) || !at(M, xx, y + 1)) R(x, lip, ox + xx, oy + y, 1, 1); } }
  function slab(x, X, Y, W, H, fill, edge, hi, sh) { R(x, '#000', X - 1, Y + 3, W + 2, H - 2); R(x, '#000', X + 1, Y + 1, W - 2, 2); R(x, '#000', X + 3, Y - 1, W - 6, 2);
    R(x, fill, X, Y + 3, W, H - 3); R(x, fill, X + 1, Y + 1, W - 2, 2); R(x, fill, X + 3, Y, W - 6, 1); R(x, hi, X, Y + 3, 1, H - 3); R(x, hi, X + 3, Y, W - 6, 1); R(x, sh, X + W - 3, Y + 3, 3, H - 3); R(x, edge, X, Y + H - 2, W, 2); }
  function ptxt(x, s, cx, y, c) { var w = s.length * 4 - 1, a = Math.round(cx - w / 2); for (var k = 0; k < s.length; k++) { var g = PF[s[k]]; if (!g) continue; for (var q = 0; q < 15; q++) if (g[q] === '1') R(x, c, a + k * 4 + q % 3, y + Math.floor(q / 3), 1, 1); } }
  function bone(x, a, b) { R(x, '#e6dfc4', a, b, 7, 1); R(x, '#e6dfc4', a - 1, b - 1, 2, 1); R(x, '#e6dfc4', a - 1, b + 1, 2, 1); R(x, '#e6dfc4', a + 6, b - 1, 2, 1); R(x, '#e6dfc4', a + 6, b + 1, 2, 1); }
  function skull(x, a, b) { R(x, '#000', a - 1, b - 1, 8, 8); R(x, '#ece6cf', a, b, 6, 5); R(x, '#ece6cf', a + 1, b + 5, 4, 2); R(x, '#111', a + 1, b + 2, 2, 2); R(x, '#111', a + 4, b + 2, 1, 2); R(x, '#111', a + 3, b + 4, 1, 1); R(x, '#b8b09a', a + 5, b, 1, 5); }
  function crack(x, a, b, n, dir, c) { for (var k = 0; k < n; k++) { R(x, c || '#2e3038', a, b, 1, 1); b++; if (k % 2) a += dir; } }
  /* the stone without its flames (cached); returns the candle list for the flame pass */
  function base(o, W, H) { var c = document.createElement('canvas'); c.width = W; c.height = H; var x = c.getContext('2d'), i = Math.max(0, Math.min(3, o.tier | 0)), t = TC[i], st = o.state || '', cr = Math.min(3, o.crumbles | 0), M = mask(o.art, o.stage == null ? 3 : o.stage), big = H > 66, k;
    if (o.bg !== false) { R(x, '#14121f', 0, 0, W, H); for (k = 0; k < 10; k++) R(x, '#2a2742', (k * 31) % W, (k * 11) % (H - 24), 1, 1); }

    if (st === 'halo' && o.bg !== false) { x.save(); x.globalAlpha = 0.14; R(x, '#fff3b0', 6, 0, W - 12, H - 16); x.restore(); }
    var gx = 9, gy = 4 + (big ? 2 : 0), gw = W - 18, gh = H - 22 - (big ? 2 : 0), ox = Math.round(W / 2 - 16), oy = gy + 10 + (big ? Math.round((gh - 46) / 2) : 0);
    if (o.open && o.bg !== false) { /* an altar is open: a faint green glow hugging the stone (stepped, 8-bit) */ x.save(); x.globalAlpha = 0.13; R(x, '#7dff6a', gx - 3, gy + 3, gw + 6, gh - 3); R(x, '#7dff6a', gx - 1, gy, gw + 2, 3); R(x, '#7dff6a', gx + 2, gy - 2, gw - 4, 2); x.globalAlpha = 0.08; R(x, '#7dff6a', gx - 5, gy + 6, gw + 10, gh - 6); x.restore(); }
    if (st === 'dust') { /* the slab snapped: the lower half stands, the top half lies on the mound */
      var cut = gy + Math.round(gh * 0.45); slab(x, gx, gy, gw, gh, '#8a8e98', '#5e626c', '#b0b4bc', '#6e727c');
      x.clearRect(gx - 1, gy - 1, gw + 2, cut - gy + 1); if (o.bg !== false) R(x, '#14121f', gx - 1, gy - 1, gw + 2, cut - gy + 1); for (k = 0; k < gw + 2; k += 2) { x.clearRect(gx - 1 + k, cut, 2, 1 + (k % 4 ? 1 : 0) + (k % 6 ? 0 : 1)); if (o.bg !== false) R(x, '#14121f', gx - 1 + k, cut, 2, 1 + (k % 4 ? 1 : 0) + (k % 6 ? 0 : 1)); }
      x.save(); x.beginPath(); x.rect(0, cut + 2, W, H); x.clip(); carve(x, M, ox, oy, '#55585f', '#b0b4bc', '#8a8e98', 0.25); x.restore();
      for (k = 0; k < gw + 2; k += 2) R(x, '#000', gx - 1 + k, cut + 1 + (k % 4 ? 1 : 0) + (k % 6 ? 0 : 1), 2, 1);
    } else {
      var fill = st === 'hunted' ? '#8e929c' : '#9a9ea8'; slab(x, gx, gy, gw, gh, fill, '#6a6e7a', '#c8ccd4', '#7c808c');
      ptxt(x, 'R.I.P.', W / 2, gy + 4, '#3a3d45');
      /* halo: it was raised once and rests for good with its halo, the relief worn pale */
      carve(x, M, ox, oy, st === 'halo' ? '#6a6e7a' : '#45484f', st === 'halo' ? '#eef0f4' : '#d2d6de', st === 'halo' ? '#b8bcc6' : '#9a9ea8', st === 'hunted' ? 0.1 : st === 'halo' ? 0.2 : 0);
      if (cr || st === 'hunted') { crack(x, gx + 6, gy + 6, 7, 1); if (cr > 1 || st === 'hunted') crack(x, gx + gw - 9, gy + gh - 16, 6, -1); if (cr > 2 || st === 'hunted') crack(x, gx + Math.round(gw / 2) + 3, gy + 1, 5, 1);
        x.clearRect(gx + gw - 3, gy - 1, 5, 4); x.clearRect(gx + gw - 1, gy + 3, 2, 2); if (o.bg !== false) { R(x, '#14121f', gx + gw - 3, gy - 1, 5, 4); R(x, '#14121f', gx + gw - 1, gy + 3, 2, 2); } R(x, '#000', gx + gw - 4, gy + 2, 1, 2); R(x, '#000', gx + gw - 2, gy + 4, 1, 2); /* chipped corner */ }
      if (st === 'hunted') { for (k = 0; k < 3; k++) for (var q = 0; q < 9; q++) R(x, '#3a2a2a', gx + 6 + k * 3 + Math.floor(q / 3), gy + gh - 22 + q, 1, 1); /* claw marks */
        [[gx + 5, gy + gh - 12, 3, 2], [gx + 7, gy + gh - 10, 1, 4], [gx + gw - 10, gy + 16, 2, 2], [gx + gw - 9, gy + 18, 1, 3], [gx + 12, gy + gh - 4, 4, 1]].forEach(function (s) { R(x, '#8a1010', s[0], s[1], s[2], s[3]); });
        R(x, '#c42020', gx + 5, gy + gh - 12, 1, 1); R(x, '#c42020', gx + gw - 10, gy + 16, 1, 1); }
    }
    /* dirt mound */ for (k = 0; k < W; k++) { var h = Math.round(9 + Math.sin(k / W * Math.PI) * 7); R(x, '#3a2716', k, H - h, 1, h); R(x, '#55391f', k, H - h, 1, 1); } for (k = 0; k < 20; k++) R(x, '#2a1c10', (k * 13) % W, H - 3 - (k * 7) % 7, 1, 1);
    if (st === 'hunted') { /* dug open */ var hx = Math.round(W / 2 - 9); R(x, '#000', hx, H - 12, 18, 6); R(x, '#120b06', hx + 1, H - 11, 16, 5); R(x, '#55391f', hx - 2, H - 13, 3, 2); R(x, '#55391f', hx + 17, H - 13, 3, 2); R(x, '#6b4a2a', hx + 4, H - 13, 2, 1); }
    if (st === 'hunted') { R(x, '#8a1010', 14, H - 7, 4, 1); R(x, '#8a1010', W - 20, H - 9, 3, 1); R(x, '#c42020', 15, H - 7, 1, 1); }
    if (st === 'dust') { /* the fallen top half on the mound, and a dust pile */ var tx = 4, ty = H - 15; R(x, '#000', tx - 1, ty - 1, 22, 8); R(x, '#8a8e98', tx, ty, 20, 6); R(x, '#b0b4bc', tx, ty, 20, 1); R(x, '#6e727c', tx, ty + 4, 20, 2); ptxt(x, 'R.I.P.', tx + 10, ty + 1, '#3a3d45');
      for (k = 0; k < 22; k++) { var dx = Math.round(W / 2 + 4 + (rnd(k) - 0.5) * 16), dy = H - 9 - Math.floor(rnd(k + 9) * (4 - Math.abs(dx - W / 2 - 4) / 4)); R(x, k % 3 ? '#a8a49a' : '#cfcabd', dx, Math.max(H - 14, dy), 1, 1); } }
    bone(x, 6, H - 8); bone(x, W - 16, H - 6); if (st !== 'dust') skull(x, 3, H - 15); skull(x, W - 11, H - 13); if (i >= 2 && st !== 'hunted') skull(x, W / 2 - 3, H - 9);
    /* candles: count grows with rarity, wax in the rarity colour; a crumble takes one; hunted = knocked over */ var n = Math.max(1, 2 + i - cr), L = [];
    for (var cI = 0; cI < n; cI++) { var cx = Math.round(10 + cI * (W - 20) / (n - 1 || 1)), ch = 4 + ((cI * 3) % 3), cy = H - 11 - (Math.abs(cI - (n - 1) / 2) < 1 ? 2 : 0); if (Math.abs(cx - W / 2) < 9 && n > 2) cy = H - 6; if (n === 1) cx = 12;
      if (st === 'hunted') { if (cI % 2) { R(x, '#000', cx - 3, cy - 2, ch + 2, 3); R(x, mix(t, '#ffffff', 0.25), cx - 2, cy - 1, ch, 1); continue; } }
      R(x, '#000', cx - 2, cy - ch - 1, 4, ch + 1); R(x, mix(t, '#ffffff', 0.25), cx - 1, cy - ch, 2, ch); R(x, '#333', cx, cy - ch - 1, 1, 1); L.push([cx, cy - ch]); }
    /* flowers in the rarity colour (wilted grey on a hunted or dusted grave) */ for (k = 0; k < i + 1; k++) { var fx = gx + 4 + k * 6, fc = st === 'hunted' || st === 'dust' ? '#6e6a62' : t; if (st === 'dust' && fx < 26) continue;
      R(x, '#3f7a34', fx, gy + gh + 1, 1, 3); R(x, fc, fx - 1, gy + gh, 3, 1); R(x, fc, fx, gy + gh - 1, 1, 3); }
    if (st === 'halo') { var hcx = Math.round(W / 2), hy = 1; R(x, '#000', hcx - 7, hy, 14, 4); R(x, '#ffc93c', hcx - 6, hy + 1, 12, 2); x.clearRect(hcx - 4, hy + 2, 8, 1); if (o.bg !== false) R(x, '#14121f', hcx - 4, hy + 2, 8, 1); R(x, '#fff3b0', hcx - 5, hy + 1, 3, 1); }
    return { c: c, L: L, lit: st !== 'dust' && st !== 'hunted', green: !!o.open, halo: st === 'halo', smoke: st === 'dust' };
  }
  function frame(cv, B, tm) { var x = cv.getContext('2d'); x.clearRect(0, 0, cv.width, cv.height); flames(x, B, tm, 0, 0); }
  function flames(x, B, tm, dx, dy) { var rm = !!RM.matches, f = rm ? 0 : Math.floor((tm || 0) / 150); x.imageSmoothingEnabled = false; x.drawImage(B.c, dx, dy); x.save(); x.translate(dx, dy);
    B.L.forEach(function (p, k) { var cx = p[0], top = p[1];
      if (B.lit) { var col = B.green ? '#7dff6a' : B.halo ? '#fff3b0' : '#ffd166', core = B.green ? '#e6ffd8' : '#fff3b0', s = (f + k) % 3, sw = s === 2 ? 1 : 0, hh = s === 1 ? 3 : 2;
        x.save(); x.globalAlpha = 0.13 + (s === 1 ? 0.05 : 0); R(x, col, cx - 3, top - 6, 6, 6); R(x, col, cx - 2, top - 7, 4, 1); x.restore();
        R(x, col, cx - 1 + sw, top - hh - 1, 1, hh); R(x, core, cx, top - 2, 1, 1); if (s === 1) R(x, col, cx - 1, top - 4, 1, 1); }
      else if (B.smoke && !rm) { var kk = (((tm || 0) / 1800) + k * 0.37) % 1; x.save(); x.globalAlpha = (1 - kk) * 0.5; R(x, '#8a8896', cx + Math.round(Math.sin((tm || 0) / 500 + k) * kk * 2), Math.round(top - 2 - kk * 9), 1, 1); x.restore(); } }); x.restore(); }
  /* paint the stone (no night background) into another canvas, e.g. beside the altar; the caller's own frame loop keeps it flickering */
  var PC = {}; function paintAt(x, o, dx, dy, tm, W, H) { W = W || 52; H = H || 62; var k = [o.art && (o.art.dna || o.art.species), o.stage, o.tier, o.state, o.crumbles, !!o.open, W, H].join('|');
    if (!PC[k]) { var ks = Object.keys(PC); if (ks.length > 40) delete PC[ks[0]]; PC[k] = base(Object.assign({}, o, { bg: false }), W, H); } flames(x, PC[k], tm, dx, dy); }
  function tick() { var tm = performance.now(); LIVE = LIVE.filter(function (e) { return e.cv.isConnected; }); LIVE.forEach(function (e) { if (e.vis) frame(e.cv, e.B, tm); }); if (!LIVE.length || RM.matches) { clearInterval(timer); timer = 0; } }
  /* draw the stone into a canvas (its width/height pick the card or detail size) and keep its flames flickering while it is on screen */
  function draw(cv, o) { if (!cv || !o) return; var B = base(o, cv.width, cv.height), e = null; for (var k = 0; k < LIVE.length; k++) if (LIVE[k].cv === cv) e = LIVE[k];
    if (!e) { e = { cv: cv, B: B, vis: true }; LIVE.push(e); if (window.IntersectionObserver) { io = io || new IntersectionObserver(function (es) { es.forEach(function (en) { LIVE.forEach(function (q) { if (q.cv === en.target) q.vis = en.isIntersecting; }); }); }); io.observe(cv); } } else e.B = B;
    frame(cv, B, performance.now()); if (!timer && !RM.matches) timer = setInterval(tick, 150); }
  window.V2Gravestone = { draw: draw, paintAt: paintAt, TC: TC };
})();
