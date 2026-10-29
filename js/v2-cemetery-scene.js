/* XCPETS Pet Cemetery v2 (branch cemetery-v2-view, PREVIEW ONLY; Oct 28 2026). Display only: no rule, burn or replay change.
 * 1) THE SCENE: an 8-bit perspective graveyard. Thousands of generic headstones (not tied to any pet) recede in rows toward one vanishing
 *    point and fade into fog under a full moon. Same build as the other place scenes: one 320x180 pixel canvas scaled by V2Sharp, a hint bar,
 *    tap Mort for a small card, RAF paused off screen and while the tab is hidden, prefers-reduced-motion = one still frame.
 *    Speed: the whole stone field is drawn ONCE into an offscreen 320x180 layer (a few ms); each frame only blits it and moves sky, fog and Mort.
 * 2) THE LIST: every dead pet from every player, built from the site's own api/pets.json (fetched and cut down to dead rows inside a Web Worker,
 *    so the 30+ MB file never parses on the page thread). Until it arrives (or if it fails) the replayed chain world fills the list.
 *    Sorts: newest death, oldest (hatch block), rarest tier, most powerful (Vigor+Spark+Grit+Zoom+Luck, the Ranking sum), most gear, longest lived.
 *    Filters: species, tier, meals. Find a grave (#, name, species, owner), My graves, #tomb-ID / ?id= deep links, paging for thousands of graves.
 * 3) THE ALTAR (preview, Oct 28 2026 evening): a stone altar with candles on the path in front. Tap it for a card; every grave in the list has
 *    "Raise at the altar", which loads js/v2-cemetery-altar.js (+ css/cemetery-altar.css, same ?v=) on demand and opens the mock seance panel.
 *    hooks('lit') turns the candles green while the panel is open; flare() makes them jump when an offering lands. Still no rule and no burn. */
(function () {
  'use strict';
  var W = 320, H = 180, HZ = 74, VX = 160, F = 70, CAMH = 1.6, RM = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  var S = { c: null, x: null, k: 1, raf: 0, off: false, hid: false, layer: null, sky: null, hits: [], sel: null, hov: null, line: 0, lt: 0, hook: 'off', total: 0, say: null };
  var LINES = ['Evenin\u2019. Mind the mud.', 'Feed \u2019em daily. Spares me the shovel.', 'Seven days. That\u2019s all it takes.', 'Rows go on past the fog.',
    'Quiet tonight. Too quiet.', 'Lantern\u2019s for you, not them.', 'Rest in pixels, little ones.', 'I stopped counting stones.'];
  var ALTAR = { x: 138, y: 146, w: 45, h: 32 }, SEANCE = { cx: 272, cy: 158, r: 20 }, MORT = { x: 26, y: 170 };
  function reduced() { return !!RM.matches || !!window.__cemReduced; }
  function px(x, c, a, b, w, h) { x.fillStyle = c; x.fillRect(a, b, w, h); }
  function rnd(i) { var v = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  /* 8-bit fog ramp: 7 steps from moonlit stone to the fog colour, per tone (light face, dark side, outline) */
  var FOG = [0x8f, 0x91, 0xb0], RAMP = [];
  (function () { var base = [[0x7c, 0x80, 0x8c], [0x52, 0x55, 0x60], [0x16, 0x14, 0x22], [0x9a, 0x9e, 0xa8]];
    for (var s = 0; s < 7; s++) { var f = s / 6 * 0.92, row = []; base.forEach(function (b) { var c = b.map(function (v, i) { return Math.round(v + (FOG[i] * 0.42 - v) * f); }); row.push('rgb(' + c.join(',') + ')'); }); RAMP.push(row); } })();
  function fogStep(z) { return Math.min(6, Math.floor((1 - Math.exp(-z / 26)) * 7)); }
  /* the stone field, drawn once: rows from far to near, a path down the middle to the vanishing point */
  function buildLayer() { var c = document.createElement('canvas'); c.width = W; c.height = H; var x = c.getContext('2d'), n = 0;
    /* ground bands (darker near, fog-lit far) */
    for (var y = HZ; y < H; y++) { var z = F * CAMH / Math.max(0.5, y - HZ), t = 1 - Math.exp(-z / 22); var g = [Math.round(0x15 + (0x4a - 0x15) * t), Math.round(0x22 + (0x4c - 0x22) * t), Math.round(0x1b + (0x6a - 0x1b) * t)];
      g = g.map(function (v) { return v - v % 6; }); px(x, 'rgb(' + g.join(',') + ')', 0, y, W, 1); }
    for (var r = 0; r < 420; r++) { var gy = HZ + 6 + Math.floor(Math.pow(rnd(r + 7), 0.6) * (H - HZ - 6)); px(x, r % 3 ? '#1d3124' : '#11201a', Math.floor(rnd(r + 31) * W), gy, gy > 130 ? 2 : 1, 1); }
    /* the path: a strip of world width 1.4 down the middle */
    for (var py = HZ + 1; py < H; py++) { var pz = F * CAMH / (py - HZ), hw = Math.max(0.5, F * 0.75 / pz), st = fogStep(pz); px(x, ['#3e352c', '#463c33', '#4d453f', '#57504f', '#615b60', '#6a6672', '#737285'][st], Math.round(VX - hw), py, Math.max(1, Math.round(hw * 2)), 1); }
    var ROWS = 140;
    for (var i = ROWS - 1; i >= 0; i--) { var zz = 1.25 + i * 0.85 + i * i * 0.004, sY = HZ + F * CAMH / zz, lim = (VX + 30) * zz / F;
      for (var X = -54 + (i % 2) * 0.85; X <= 54; X += 1.7) { if (Math.abs(X) < 1.3) continue; if (Math.abs(X) > lim) continue;
        var j = i * 131 + Math.round(X * 10), jx = X + (rnd(j) - 0.5) * 0.5, sx = VX + F * jx / zz; if (sx < -20 || sx > W + 20) continue;
        if (rnd(j + 3) < 0.06) continue; /* a gap here and there */
        stoneAt(x, sx, sY, zz, j); n++; } }
    S.stones = n; return c; }
  function stoneAt(x, sx, sY, z, j) { var s = F / z, hgt = (0.75 + rnd(j + 5) * 0.35) * s, wid = (0.55 + rnd(j + 9) * 0.25) * s, R = RAMP[fogStep(z)], kind = Math.floor(rnd(j + 13) * 4), lean = rnd(j + 17) < 0.12 ? (rnd(j + 19) < 0.5 ? -1 : 1) : 0;
    var w = Math.max(1, Math.round(wid)), h = Math.max(1, Math.round(hgt)), a = Math.round(sx - w / 2), b = Math.round(sY - h);
    if (w <= 2 || h <= 2) { px(x, R[0], a, b, w, h); return; }
    if (kind === 3 && w >= 5) { /* a cross */ var bw = Math.max(1, Math.round(w / 3)); px(x, R[2], a + Math.round((w - bw) / 2) - 1, b - 1, bw + 2, h + 1); px(x, R[0], a + Math.round((w - bw) / 2), b, bw, h);
      var ay = b + Math.round(h * 0.25), ah = Math.max(1, Math.round(h / 6)); px(x, R[2], a - 1, ay - 1, w + 2, ah + 2); px(x, R[0], a, ay, w, ah); return; }
    var cap = kind === 2 ? 0 : Math.max(1, Math.round(w / 4)); /* 0/1 = rounded top, 2 = flat slab */
    px(x, R[2], a - 1, b + cap - 1, w + 2, h - cap + 1); if (cap) px(x, R[2], a + cap - 1, b - 1, w - cap * 2 + 2, cap + 1);
    px(x, R[0], a, b + cap, w, h - cap); if (cap) px(x, R[0], a + cap, b, w - cap * 2, cap);
    if (lean) px(x, R[2], lean < 0 ? a : a + w - 1, b + cap, 1, Math.max(1, Math.round(h / 3)));
    if (w >= 4) px(x, R[1], a + w - Math.max(1, Math.round(w / 4)), b + cap, Math.max(1, Math.round(w / 4)), h - cap); /* shade away from the moon */
    if (w >= 6 && h >= 8) { px(x, R[3], a, b + cap, 1, h - cap); var ly = b + cap + Math.round(h * 0.3); px(x, R[1], a + Math.round(w * 0.25), ly, Math.max(1, Math.round(w * 0.45)), 1); if (h >= 14) px(x, R[1], a + Math.round(w * 0.25), ly + Math.max(2, Math.round(h * 0.15)), Math.max(1, Math.round(w * 0.35)), 1); }
    if (h >= 10) px(x, '#0c1410', a - 1, b + h, w + 3, 1); /* foot shadow */ }
  function buildSky() { var c = document.createElement('canvas'); c.width = W; c.height = HZ + 2; var x = c.getContext('2d'), B = ['#0b0a1f', '#0e0c25', '#110f2b', '#141232', '#181539', '#1c1840', '#221d48', '#2a2452', '#342e5e'];
    for (var i = 0; i < B.length; i++) px(x, B[i], 0, Math.floor(i * HZ / B.length), W, Math.ceil(HZ / B.length) + 1);
    /* full moon with a stepped glow */ var mx = 244, my = 26; [[22, '#1f1b46'], [18, '#29245a'], [15, '#383274']].forEach(function (g) { disc(x, mx, my, g[0], g[1]); }); disc(x, mx, my, 12, '#fff1c4');
    px(x, '#eadba4', mx - 5, my - 4, 4, 3); px(x, '#eadba4', mx + 3, my + 2, 4, 4); px(x, '#eadba4', mx - 2, my + 5, 3, 2); px(x, '#eadba4', mx + 4, my - 6, 2, 2); px(x, '#fffbe6', mx - 7, my - 8, 3, 2);
    /* far hills and bare trees on the horizon */ for (var hx = 0; hx < W; hx += 2) { var hh = 5 + Math.round(Math.sin(hx / 27) * 3 + Math.sin(hx / 11) * 1.5); px(x, '#3c3868', hx, HZ - hh, 2, hh + 2); }
    [[28, 14], [70, 10], [292, 16], [214, 9]].forEach(function (t, k) { var tx = t[0], th = t[1]; px(x, '#24203f', tx, HZ - th, 2, th); for (var q = 0; q < 4; q++) { var by = HZ - th + 2 + q * 3, dir = q % 2 ? 1 : -1; px(x, '#24203f', dir > 0 ? tx + 2 : tx - 4 + q, by, 4 - q, 1); px(x, '#24203f', dir > 0 ? tx + 5 - q : tx - 5 + q, by - 1, 1, 1); } });
    return c; }
  function disc(x, cx, cy, r, col) { for (var dy = -r; dy <= r; dy++) { var hw = Math.round(Math.sqrt(r * r - dy * dy)); px(x, col, cx - hw, cy + dy, hw * 2, 1); } }
  function sky(x, t) { x.drawImage(S.sky, 0, 0); var rm = reduced();
    for (var s = 0; s < 50; s++) { var sx = Math.floor(rnd(s) * W), sy = Math.floor(rnd(s + 99) * (HZ - 16)); if (Math.abs(sx - 244) < 24 && sy < 50) continue; if (rm || Math.floor(t / 700 + s) % 9) px(x, s % 7 ? '#8d89c9' : '#fff6d8', sx, sy, 1, 1); }
    var cx = rm ? 120 : (t / 140) % (W + 90); x.save(); x.globalAlpha = 0.85; px(x, '#2a2456', Math.round(cx) - 60, 34, 50, 3); px(x, '#2a2456', Math.round(cx) - 50, 31, 30, 3); px(x, '#2a2456', Math.round(cx * 0.6 + 150) % (W + 70) - 40, 18, 36, 2); x.restore(); }
  function fog(x, t) { var rm = reduced(); x.save();
    /* a steady fog wall at the horizon (where the rows vanish) */ for (var i = 0; i < 10; i++) { x.globalAlpha = 0.34 - i * 0.032; px(x, '#8f91b0', 0, HZ - 3 + i * 2, W, 2); }
    /* drifting banks, slower and denser far away */ for (var b = 0; b < 7; b++) { var y = HZ + 3 + b * b * 2.2, sp = 70 + b * 25, len = 90 + b * 30, off = rm ? b * 53 : (t / sp + b * 77) % (W + len);
      x.globalAlpha = 0.11 - b * 0.009; px(x, '#c8c6e8', Math.round(off) - len, Math.round(y), len, 2 + (b >> 1)); px(x, '#c8c6e8', Math.round((off + W * 0.55) % (W + len)) - len, Math.round(y + 2), Math.round(len * 0.7), 2); }
    x.restore(); }
  function wisps(x, t) { if (reduced()) return; for (var i = 0; i < 5; i++) { var a = t / 1700 + i * 1.7, wx = Math.round(60 + i * 52 + Math.sin(a) * 14), wy = Math.round(118 + (i % 3) * 14 + Math.cos(a * 1.3) * 5), on = Math.sin(t / 400 + i * 2) > -0.2;
      if (on) { px(x, '#c9ffb0', wx, wy, 1, 1); x.save(); x.globalAlpha = 0.25; px(x, '#c9ffb0', wx - 1, wy - 1, 3, 3); x.restore(); } } }
  function gate(x) { /* near iron fence posts, both edges, framing the view */ for (var k = 0; k < 2; k++) { var gx = k ? W - 16 : 4; px(x, '#000', gx, 120, 12, 60); px(x, '#23202e', gx + 1, 121, 10, 59); px(x, '#3a3550', gx + 2, 121, 2, 59); px(x, '#000', gx - 1, 116, 14, 5); px(x, '#3a3550', gx, 117, 12, 3); }
    for (var r = 0; r < 2; r++) { var ry = 140 + r * 22; px(x, '#000', 16, ry, 22, 2); px(x, '#000', W - 38, ry, 22, 2); }
    for (var s = 0; s < 3; s++) { px(x, '#000', 20 + s * 7, 132, 2, 48); px(x, '#000', W - 34 + s * 7, 132, 2, 48); px(x, '#000', 19 + s * 7, 130, 4, 2); px(x, '#000', W - 35 + s * 7, 130, 4, 2); } }
  function board(x) { var bx = 270, by = 150; px(x, '#3e2a18', bx + 11, by + 12, 2, 18); px(x, '#000', bx - 1, by - 1, 26, 15); px(x, '#6b4a2a', bx, by, 24, 13); x.font = '4px "Press Start 2P", monospace'; x.textAlign = 'center'; x.fillStyle = '#f3e2b8';
    x.fillText(S.total > 999 ? Math.round(S.total / 100) / 10 + 'K' : String(S.total), bx + 12, by + 6); x.fillText('REST', bx + 12, by + 11); x.textAlign = 'left'; }
  function outline(x, a, b, w, h) { x.strokeStyle = '#ffc93c'; x.lineWidth = 1; x.strokeRect(a + 0.5, b + 0.5, w - 1, h - 1); }
  function mort(x, t) { var m = MORT, sw = reduced() ? 0 : Math.round(Math.sin(t / 500)), hv = S.hov === 'mort' || S.sel === 'mort';
    px(x, '#000', m.x - 5, m.y - 26, 12, 27); px(x, '#3a3046', m.x - 4, m.y - 16, 10, 15); px(x, '#c9a27a', m.x - 3, m.y - 23, 8, 7); px(x, '#000', m.x - 1, m.y - 20, 1, 1); px(x, '#000', m.x + 3, m.y - 20, 1, 1); px(x, '#8c8c96', m.x - 3, m.y - 17, 8, 2);
    px(x, '#1c1824', m.x - 5, m.y - 26, 12, 3); px(x, '#1c1824', m.x - 3, m.y - 29, 8, 3); px(x, '#2a2232', m.x - 4, m.y - 1, 4, 2); px(x, '#2a2232', m.x + 2, m.y - 1, 4, 2);
    var lx = m.x + 9, ly = m.y - 12 + sw; px(x, '#000', lx - 1, ly - 1, 6, 8); px(x, '#ffd166', lx, ly + 1, 4, 5); px(x, '#fff3b0', lx + 1, ly + 2, 2, 2); x.save(); x.globalAlpha = 0.1; px(x, '#ffd166', lx - 4, ly - 4, 12, 14); x.restore();
    if (hv) outline(x, m.x - 7, m.y - 31, 22, 33); S.hits.push({ x: m.x - 7, y: m.y - 31, w: 22, h: 33, k: 'mort' }); }
  function bubble(x, s, bx, by) { x.font = '5px "Press Start 2P", monospace'; var w = Math.ceil(x.measureText(s).width) + 8; bx = Math.max(2, Math.min(W - w - 2, bx)); px(x, '#000', bx + 1, by + 1, w, 11); px(x, '#fff8e1', bx, by, w, 11); px(x, '#fff8e1', bx + 4, by + 11, 3, 3); x.fillStyle = '#1b1b1b'; x.fillText(s, bx + 4, by + 8); }
  /* the altar: on the path in front, slab + body + base, four candles; carved marks on the face. hook 'lit' = green flames (seance open). */
  function altar(x, t) { var a = ALTAR, rm = reduced(), hv = S.hov === 'altar' || S.sel === 'altar', lit = S.hook === 'lit', fl = Math.max(0, 1 - (t - (S.flT || -1e9)) / 600);
    px(x, '#0c1410', a.x - 2, a.y + 30, a.w + 4, 3); px(x, '#16141f', a.x, a.y + 25, a.w, 6); px(x, '#6a6e7a', a.x + 1, a.y + 26, a.w - 2, 4); px(x, '#525560', a.x + 1, a.y + 29, a.w - 2, 1);
    px(x, '#16141f', a.x + 6, a.y + 9, a.w - 12, 17); px(x, '#7c808c', a.x + 7, a.y + 9, a.w - 14, 16); px(x, '#525560', a.x + a.w - 13, a.y + 9, 6, 16); px(x, '#9a9ea8', a.x + 7, a.y + 9, 1, 16);
    px(x, '#16141f', a.x + 2, a.y + 5, a.w - 4, 5); px(x, '#9a9ea8', a.x + 3, a.y + 6, a.w - 6, 3); px(x, '#c8ccd4', a.x + 3, a.y + 6, a.w - 6, 1);
    for (var m = 0; m < 4; m++) px(x, '#3a3550', a.x + 12 + m * 2, a.y + 13, 1, 6); for (var d = 0; d < 7; d++) px(x, '#3a3550', a.x + 11 + d, a.y + 18 - d, 1, 1);
    px(x, '#3a3550', a.x + 25, a.y + 13, 5, 1); px(x, '#3a3550', a.x + 27, a.y + 11, 1, 6);
    [[5, 7], [10, 5], [a.w - 11, 5], [a.w - 6, 7]].forEach(function (c, j) { var cx = a.x + c[0], h = c[1], cy = a.y + 6, f = rm ? 0 : Math.round((Math.sin(t / 90 + j * 2.1) + Math.sin(t / 53 + j)) / 2), big = Math.round(fl * 5) + (lit ? 1 : 0);
      px(x, '#16141f', cx - 1, cy - h - 1, 4, h + 1); px(x, '#e9e3d0', cx, cy - h, 2, h); px(x, '#b8b09a', cx + 1, cy - h, 1, h);
      var col = lit || fl > 0.1 ? '#7dff6a' : '#ffc93c', fh = 2 + big + f; x.save(); x.globalAlpha = (lit ? 0.22 : 0.12) + fl * 0.3; px(x, col, cx - 3 - big, cy - h - fh - 3, 8 + big * 2, fh + 5); x.restore();
      px(x, col, cx, cy - h - fh, 2, fh); px(x, lit || fl > 0.1 ? '#e6ffd8' : '#fff3b0', cx, cy - h - fh + 1, 1, Math.max(1, fh - 1)); });
    if (lit && !rm) { for (var s = 0; s < 6; s++) { var k = (t / 900 + s / 6) % 1, sx = a.x + a.w / 2 - 6 + ((s * 7) % 12) + Math.round(Math.sin(t / 300 + s) * 2); x.save(); x.globalAlpha = (1 - k) * 0.6; px(x, s % 2 ? '#7dff6a' : '#c9ffb0', sx, Math.round(a.y + 4 - k * 22), 1, 1); x.restore(); } }
    if (hv) outline(x, a.x - 2, a.y - 8, a.w + 4, a.h + 8); S.hits.push({ x: a.x - 2, y: a.y - 8, w: a.w + 4, h: a.h + 8, k: 'altar' }); }
  function draw(t) { var x = S.x; if (!x) return; if (window.V2Sharp) V2Sharp.begin(x, S.k); else x.imageSmoothingEnabled = false; S.hits = [];
    if (!S.sky) S.sky = buildSky(); if (!S.layer) S.layer = buildLayer();
    sky(x, t); x.drawImage(S.layer, 0, HZ, W, H - HZ, 0, HZ, W, H - HZ); fog(x, t); wisps(x, t); gate(x); board(x); altar(x, t); mort(x, t);
    if (!reduced() && t - S.lt > 12000) { S.lt = t; S.line = (S.line + 1) % LINES.length; } if (S.say || (!reduced() && t - S.lt < 4000)) bubble(x, S.say || LINES[S.line], MORT.x - 6, MORT.y - 46);
    if (!reduced() && !S.off && !S.hid) S.raf = requestAnimationFrame(draw); else S.raf = 0; }
  function kick() { if (S.x && !S.raf) draw(performance.now()); }
  function card(k) { var el = document.getElementById('cemCard'); if (!el) return; if (!k) { el.hidden = true; return; } el.hidden = false;
    if (k === 'mort') el.innerHTML = '<b class="cc-h">🏮 Mort, the caretaker</b><p class="small">Keeps the grass short and the gate shut. A pet ends up here after 7 full chain days (144 blocks each) with no meal. Mythic pets never starve. Every grave is in the list below. Feed yours on <a href="play.html">Play</a>.</p>';
    if (k === 'altar') el.innerHTML = '<b class="cc-h">🕯️ The altar <span class="alt-pv">PREVIEW</span></b><p class="small">Pick any grave below and press <b>Raise at the altar</b>. Offer your living pets (and spare gear) to bring it back as a zombie: more and rarer offerings, more power, up to 3 times what it died with. Preview only: nothing is burned.</p><button type="button" class="btn" id="cemAltGo">🕯️ Try it with the first grave</button>'; var go = document.getElementById('cemAltGo'); if (go) go.onclick = function () { if (S.openAltar) S.openAltar(); }; }
  function at(c, e) { var r = c.getBoundingClientRect(), mx = (e.clientX - r.left) * W / r.width, my = (e.clientY - r.top) * H / r.height, hs = S.hits.filter(function (q) { return mx >= q.x && mx < q.x + q.w && my >= q.y && my < q.y + q.h; }); return hs.length ? hs[hs.length - 1] : null; }
  /** mount(w, dead): draws the scene into #cemScene; dead = the page's dead list (only its length is used: the stones are generic). */
  function mount(w, dead) { var box = document.getElementById('cemScene'); if (!box) return; S.total = dead ? dead.length : 0; S.sel = null;
    var c = box.querySelector('canvas'); if (!c) { box.innerHTML = '<canvas width="' + W + '" height="' + H + '" role="img" aria-label="The XCPETS Pet Cemetery at night: endless rows of gravestones fading into fog under a full moon, a stone altar with candles on the path, Mort the caretaker at the gate"></canvas><div class="cem-hint small">👇 Every grave from every player is in the list below · tap Mort to say hi · 🕯️ tap the altar</div>';
      c = box.querySelector('canvas');
      if (window.IntersectionObserver) new IntersectionObserver(function (es) { var off = !es[0].isIntersecting; if (off === S.off) return; S.off = off; if (!off) kick(); else { cancelAnimationFrame(S.raf); S.raf = 0; } }, { threshold: 0 }).observe(c);
      document.addEventListener('visibilitychange', function () { S.hid = document.hidden; if (S.hid) { cancelAnimationFrame(S.raf); S.raf = 0; } else kick(); });
      if (RM.addEventListener) RM.addEventListener('change', function () { cancelAnimationFrame(S.raf); S.raf = 0; kick(); });
      c.addEventListener('mousemove', function (e) { var h = at(c, e), v = h ? h.k : null; if (v !== S.hov) { S.hov = v; c.style.cursor = v ? 'pointer' : ''; if (reduced()) draw(performance.now()); } });
      c.addEventListener('mouseleave', function () { S.hov = null; if (reduced()) draw(performance.now()); });
      c.addEventListener('click', function (e) { var h = at(c, e), v = h ? h.k : null; S.sel = v; S.say = v === 'mort' ? LINES[(S.line = (S.line + 1) % LINES.length)] : null; card(v); draw(performance.now()); }); }
    S.c = c; S.x = c.getContext('2d'); if (window.V2Sharp) { S.k = V2Sharp.fit(c, W, H); if (!S.rs) { S.rs = 1; V2Sharp.watch(function () { if (!S.c) return; var k0 = S.k; S.k = V2Sharp.fit(S.c, W, H); if (S.k !== k0) { cancelAnimationFrame(S.raf); S.raf = 0; kick(); } }); } }
    cancelAnimationFrame(S.raf); S.raf = 0; draw(performance.now()); }
  function hooks(state) { S.hook = state === 'lit' ? 'lit' : 'off'; kick(); }
  function flare() { S.flT = performance.now(); kick(); }

  /* ------------------------------------------------------------------ the list ------------------------------------------------------------------ */
  var TIERS = { Common: 0, Uncommon: 1, Rare: 2, Legendary: 3 }, TL = ['Common', 'Uncommon', 'Rare', 'Legendary'], TID = ['common', 'uncommon', 'rare', 'legendary'];
  var SORTS = [['new', 'Newest graves'], ['old', 'Oldest (hatch block)'], ['rare', 'Rarest tier'], ['power', 'Most powerful'], ['gear', 'Most gear'], ['lived', 'Longest lived']];
  /* the worker: fetch api/pets.json, keep only dead rows, send back small arrays (so the page thread never parses 30+ MB) */
  var WSRC = 'onmessage=function(e){fetch(e.data,{cache:"no-cache"}).then(function(r){if(!r.ok)throw new Error("HTTP "+r.status);return r.json();}).then(function(d){var o=[];(d.pets||[]).forEach(function(p){if(p.status!=="dead")return;var s=p.stats||{};o.push([p.id,p.name,p.species,p.speciesLabel||p.species,p.tier,p.stage,p.stageName,p.owner,(p.gear||[]).length,(s.vigor||0)+(s.spark||0)+(s.grit||0)+(s.zoom||0)+(s.luck||0),p.bornBlock,p.deathBlock,p.lastFedBlock,p.hybrid?1:0,p.rarityScore||0]);});postMessage({ok:1,block:d.blockHeight,count:d.count,rows:o});}).catch(function(err){postMessage({ok:0,err:String(err&&err.message||err)});});};';
  function loadJson(cb) { var done = false, fin = function (r) { if (!done) { done = true; cb(r); } };
    try { var u = URL.createObjectURL(new Blob([WSRC], { type: 'text/javascript' })), wk = new Worker(u); wk.onmessage = function (e) { fin(e.data); wk.terminate(); URL.revokeObjectURL(u); }; wk.onerror = function () { fin({ ok: 0, err: 'worker' }); };
      wk.postMessage(new URL('api/pets.json', location.href).href); setTimeout(function () { fin({ ok: 0, err: 'timeout' }); }, 90000); } catch (e) { fin({ ok: 0, err: 'no worker' }); } }
  function fromWorld(w, V, R) { return w.pets.filter(function (p) { return p.dead && !p.released; }).map(function (p) { var s = p.stats || {};
    return { id: p.id, name: p.name, species: p.species, spl: V.speciesLabel ? V.speciesLabel(p.species) : p.species, tier: p.tier | 0, stage: p.stage, stageName: p.stageName, owner: p.owner, gear: R.graveCount ? R.graveCount(w, p) : 0,
      power: ['vigor', 'spark', 'grit', 'zoom', 'luck'].reduce(function (a, k) { return a + (s[k] || 0); }, 0), born: p.hatchBlock, died: p.deathBlock, fed: p.lastFed, hybrid: V.isHybrid ? !!V.isHybrid(p.species) : false, rs: 0 }; }); }
  function fromRows(rows, w, R) { return rows.map(function (r) { var wp = w && w.byId ? w.byId[r[0]] : null, gc = wp && R.graveCount ? R.graveCount(w, wp) : 0;
    return { id: r[0], name: r[1], species: r[2], spl: r[3], tier: TIERS[r[4]] != null ? TIERS[r[4]] : 0, stage: r[5], stageName: r[6], owner: r[7], gear: Math.max(r[8], gc), power: r[9], born: r[10], died: r[11], fed: r[12], hybrid: !!r[13], rs: r[14] }; }); }
  var CMP = { new: function (a, b) { return (b.died || 0) - (a.died || 0) || b.id - a.id; }, old: function (a, b) { return (a.born == null ? 1e9 : a.born) - (b.born == null ? 1e9 : b.born) || a.id - b.id; },
    rare: function (a, b) { return b.tier - a.tier || b.rs - a.rs || b.power - a.power || a.id - b.id; }, power: function (a, b) { return b.power - a.power || b.tier - a.tier || a.id - b.id; },
    gear: function (a, b) { return b.gear - a.gear || b.power - a.power || a.id - b.id; }, lived: function (a, b) { return life(b) - life(a) || a.id - b.id; } };
  function life(p) { return p.born != null && p.died != null ? p.died - p.born : -1; }
  /** page(ctx): the whole cemetery page body (called by js/v2-pages.js cemetery()). ctx = { w, M, R, V, ME, fmt, shortAddr } */
  function page(ctx) { var w = ctx.w, M = ctx.M, R = ctx.R, V = ctx.V, ME = ctx.ME, fmt = ctx.fmt, sa = ctx.shortAddr, $ = function (id) { return document.getElementById(id); };
    css(); var all = fromWorld(w, V, R), src = 'chain', srcBlock = M.state().tip, phone = window.matchMedia && matchMedia('(max-width: 640px)').matches, PER = phone ? 24 : 60;
    var st = { q: '', mine: false, sort: 'new', sp: '', tier: '', meals: '', page: 0, list: [] }, tombs = $('tombs');
    mount(w, all);
    var bar = document.createElement('div'); bar.className = 'uxp-find cemfind cemv2bar';
    bar.innerHTML = '<div class="cv2-row"><label class="small" for="cemFind">Find a grave</label><input id="cemFind" type="search" placeholder="Pet #, name, species or owner" autocomplete="off"><button type="button" class="btn" id="cemGo">Find</button>' + (ME ? '<button type="button" class="btn ghost" id="cemMine" aria-pressed="false">My graves</button>' : '') + '</div>' +
      '<div class="cv2-row cv2-sel"><label class="small">Sort <select id="cemSort">' + SORTS.map(function (s) { return '<option value="' + s[0] + '">' + s[1] + '</option>'; }).join('') + '</select></label>' +
      '<label class="small">Species <select id="cemSp"><option value="">All species</option></select></label><label class="small">Tier <select id="cemTier"><option value="">All tiers</option>' + TL.map(function (t, i) { return '<option value="' + i + '">' + t + '</option>'; }).join('') + '</select></label>' +
      '<label class="small">Meals <select id="cemMeals"><option value="">All graves</option><option value="fed">Fed at least once</option><option value="nf">Never fed</option></select></label></div>' +
      '<p class="small muted" id="cemMsg" aria-live="polite"></p>';
    tombs.parentNode.insertBefore(bar, tombs);
    var pg = function (id) { var d = document.createElement('div'); d.className = 'cv2-pager'; d.id = id; return d; }, pTop = pg('cemPagerTop'), pBot = pg('cemPager'); tombs.parentNode.insertBefore(pTop, tombs); tombs.parentNode.insertBefore(pBot, tombs.nextSibling);
    function spOpts() { var n = {}, lab = {}; all.forEach(function (p) { var k = p.hybrid ? '__hyb' : p.species; n[k] = (n[k] || 0) + 1; lab[k] = p.hybrid ? 'Hybrids' : p.spl; });
      var s = $('cemSp'), cur = s.value; s.innerHTML = '<option value="">All species</option>' + Object.keys(n).sort(function (a, b) { return a === '__hyb' ? 1 : b === '__hyb' ? -1 : String(lab[a]).localeCompare(lab[b]); }).map(function (k) { return '<option value="' + esc(k) + '">' + esc(lab[k]) + ' (' + fmt(n[k]) + ')</option>'; }).join(''); s.value = cur; if (s.value !== cur) s.value = ''; }
    function status() { $('status').textContent = fmt(all.length) + ' pet' + (all.length === 1 ? '' : 's') + ' in the Pet Cemetery, from every player' + (src === 'json' ? ' (api/pets.json at block ' + fmt(srcBlock) + ')' : ' (replayed from ' + fmt(M.state().rows.length) + ' XCPETS burns' + (st.loading ? '; loading the full list…' : '') + ')') + '. A pet dies after 7 full chain days (144 blocks each) with no feed.'; }
    function tomb(p) { var wp = w.byId ? w.byId[p.id] : null, gl = wp && R.graveCount && R.graveCount(w, wp) ? R.graveLine(w, wp) : '', lf = life(p);
      return '<div class="tomb" id="tomb-' + p.id + '"><canvas width="32" height="32" data-id="' + p.id + '" role="img" aria-label="ghost of #' + p.id + '"></canvas><h4><a href="pet.html?id=' + p.id + '">' + esc(p.name) + '</a> <span class="muted">#' + p.id + '</span></h4>' +
        '<div class="small">' + esc(p.spl) + ' · <span class="pill tier tier-' + TID[p.tier] + '">' + TL[p.tier] + '</span> · reached ' + esc(p.stageName) + '</div>' +
        '<div class="small cv2-facts">⚡ ' + fmt(p.power) + ' power · 🎒 ' + fmt(p.gear) + ' gear · ⏳ ' + (lf >= 0 ? '~' + fmt(Math.floor(lf / 144)) + ' day' + (Math.floor(lf / 144) === 1 ? '' : 's') : '?') + '</div>' +
        '<div class="small muted tombowner" title="' + esc(p.owner) + '" style="overflow-wrap:anywhere">owner ' + esc(sa(p.owner)) + (ME && p.owner === ME ? ' (you)' : '') + '</div>' +
        '<div class="died">🥚 hatched ' + (p.born != null ? 'block ' + fmt(p.born) : '?') + '<br>🪦 died at block ' + fmt(p.died) + '</div>' + (gl ? '<div class="small buried">' + gl + '</div>' : '') +
        '<button type="button" class="btn cv2-raise" data-raise="' + p.id + '" title="Preview: open the seance for this grave">🕯️ Raise at the altar</button></div>'; }
    function pager(el, pages) { if (pages <= 1) { el.innerHTML = ''; return; } var b = function (k, t, dis) { return '<button type="button" class="q" data-pg="' + k + '"' + (dis ? ' disabled' : '') + '>' + t + '</button>'; };
      el.innerHTML = b('first', '⏮ First', !st.page) + b('prev', '◀ Prev', !st.page) + '<label class="small">Page <input type="number" min="1" max="' + pages + '" value="' + (st.page + 1) + '" data-pgin aria-label="Page number"> of ' + fmt(pages) + '</label>' + b('next', 'Next ▶', st.page >= pages - 1) + b('last', 'Last ⏭', st.page >= pages - 1); }
    function paint() { var pages = Math.max(1, Math.ceil(st.list.length / PER)); st.page = Math.max(0, Math.min(st.page, pages - 1)); var L = st.list.slice(st.page * PER, st.page * PER + PER);
      tombs.innerHTML = L.length ? L.map(tomb).join('') : '<p class="muted small">No grave matches. Try a pet number, a name, a species or a full owner address, or clear a filter.</p>';
      L.forEach(function (p) { var wp = w.byId ? w.byId[p.id] : null, c = tombs.querySelector('canvas[data-id="' + p.id + '"]'); if (c && wp && wp.art) R.lazy(c, function () { return R.framesWith(wp.art, wp.stage, []); }, true); });
      pager(pTop, pages); pager(pBot, pages); }
    function apply(keepPage) { var q0 = st.q.trim().toLowerCase(), exact = /^#\d+$/.test(q0), q = q0.replace(/^#/, ''), num = /^\d+$/.test(q), meals = q ? '' : st.meals;
      st.list = all.filter(function (p) { if (st.mine && p.owner !== ME) return false; if (st.sp && (st.sp === '__hyb' ? !p.hybrid : p.species !== st.sp || p.hybrid)) return false; if (st.tier !== '' && p.tier !== +st.tier) return false;
        if (meals === 'fed' && p.fed == null) return false; if (meals === 'nf' && p.fed != null) return false; if (!q) return true;
        return exact ? String(p.id) === q : num ? String(p.id).indexOf(q) === 0 : String(p.name).toLowerCase().indexOf(q) >= 0 || String(p.spl).toLowerCase().indexOf(q) >= 0 || String(p.owner).toLowerCase() === q || (q.length >= 6 && String(p.owner).toLowerCase().indexOf(q) >= 0); });
      st.list.sort(CMP[st.sort] || CMP.new); if (num) st.list.sort(function (a, b) { return (String(b.id) === q) - (String(a.id) === q); });
      if (!keepPage) st.page = 0; var n = st.list.length, hid = !q && st.meals === 'fed' ? all.filter(function (p) { return p.fed == null; }).length : 0;
      $('cemMsg').innerHTML = fmt(n) + ' grave' + (n === 1 ? '' : 's') + ' shown' + (q ? ' for "' + esc(st.q.trim()) + '"' : '') + (hid ? ' · ' + fmt(hid) + ' never-fed graves hidden (<button type="button" class="linkish" id="cemShowNf">show all</button>)' : '') + (q && st.meals ? ' · a search looks through every grave' : '');
      var sn = $('cemShowNf'); if (sn) sn.onclick = function () { st.meals = ''; $('cemMeals').value = ''; apply(); };
      paint(); }
    function onPager(e) { var t = e.target.closest('[data-pg]'); if (!t) return; var pages = Math.ceil(st.list.length / PER), k = t.getAttribute('data-pg'); st.page = k === 'first' ? 0 : k === 'last' ? pages - 1 : k === 'prev' ? st.page - 1 : st.page + 1; paint(); if (this === pBot) pTop.scrollIntoView({ block: 'start' }); }
    function onPgIn(e) { if (!e.target.hasAttribute('data-pgin')) return; var v = parseInt(e.target.value, 10); if (v > 0) { st.page = v - 1; paint(); } }
    [pTop, pBot].forEach(function (el) { el.addEventListener('click', onPager); el.addEventListener('change', onPgIn); });
    /* "Raise at the altar" (preview): load the altar module on first use, then open the seance panel for that grave */
    tombs.addEventListener('click', function (e) { var b = e.target.closest('[data-raise]'); if (!b) return; var id = +b.getAttribute('data-raise'), g = all.filter(function (p) { return p.id === id; })[0]; if (!g) return;
      b.disabled = true; altarJs(function () { b.disabled = false; if (window.V2CemeteryAltar) V2CemeteryAltar.open(g, ctx); }); });
    S.openAltar = function () { var g = st.list[0] || all[0]; if (g) altarJs(function () { if (window.V2CemeteryAltar) V2CemeteryAltar.open(g, ctx); }); };
    var inp = $('cemFind'), tmr; inp.oninput = function () { clearTimeout(tmr); tmr = setTimeout(function () { st.q = inp.value; apply(); }, 200); };
    inp.onkeydown = function (e) { if (e.key === 'Enter') { clearTimeout(tmr); st.q = inp.value; apply(); } };
    $('cemGo').onclick = function () { clearTimeout(tmr); st.q = inp.value; apply(); };
    if ($('cemMine')) $('cemMine').onclick = function () { st.mine = !st.mine; this.setAttribute('aria-pressed', st.mine); this.classList.toggle('on', st.mine); this.textContent = st.mine ? 'All graves' : 'My graves'; apply(); };
    $('cemSort').onchange = function () { st.sort = this.value; apply(); }; $('cemSp').onchange = function () { st.sp = this.value; apply(); }; $('cemTier').onchange = function () { st.tier = this.value; apply(); }; $('cemMeals').onchange = function () { st.meals = this.value; apply(); };
    function deep() { var d = (location.hash.match(/^#tomb-(\d+)$/) || [])[1] || new URLSearchParams(location.search).get('id'); if (!d || !all.some(function (p) { return String(p.id) === String(d); })) return false;
      inp.value = '#' + d; st.q = '#' + d; apply(true); var e = $('tomb-' + d); if (e) { e.scrollIntoView({ block: 'center' }); e.classList.add('flash'); } return true; }
    window.addEventListener('hashchange', deep);
    spOpts(); status(); if (!all.length) { tombs.innerHTML = '<p class="muted">No pets have died yet. Pets starve after 7 full days with no meal: feed yours on <a href="play.html">Play</a>.</p>'; } else if (!deep()) apply();
    st.loading = true; status();
    loadJson(function (r) { st.loading = false; if (r && r.ok && r.rows && r.rows.length) { all = fromRows(r.rows, w, R); src = 'json'; srcBlock = r.block; S.total = all.length; kick(); spOpts(); if (!deep()) apply(true); } status(); window.__cemV2 = { src: src, n: all.length, block: srcBlock, err: r && r.err }; });
    window.__cemV2 = { src: src, n: all.length, loading: true };
  }
  function ver() { var me = document.querySelector('script[src*="v2-cemetery-scene.js"]'); return me ? (me.getAttribute('src').split('?')[1] || '') : ''; }
  function altarJs(cb) { if (window.V2CemeteryAltar) return cb(); (S.altQ = S.altQ || []).push(cb); if (S.altQ.length > 1) return; var v = ver();
    if (!document.getElementById('cemAltCss')) { var l = document.createElement('link'); l.rel = 'stylesheet'; l.id = 'cemAltCss'; l.href = 'css/cemetery-altar.css' + (v ? '?' + v : ''); document.head.appendChild(l); }
    var sc = document.createElement('script'); sc.src = 'js/v2-cemetery-altar.js' + (v ? '?' + v : ''); sc.onload = function () { var q = S.altQ; S.altQ = []; q.forEach(function (f) { f(); }); }; sc.onerror = function () { S.altQ = []; }; document.head.appendChild(sc); }
  function css() { if (document.getElementById('cemV2Css')) return; var me = document.querySelector('script[src*="v2-cemetery-scene.js"]'), v = me ? (me.getAttribute('src').split('?')[1] || '') : '', l = document.createElement('link');
    l.rel = 'stylesheet'; l.id = 'cemV2Css'; l.href = 'css/cemetery-v2.css' + (v ? '?' + v : ''); document.head.appendChild(l); }
  window.V2CemeteryScene = { mount: mount, hooks: hooks, flare: flare, page: page, ALTAR: ALTAR, SEANCE: SEANCE, _state: function () { return S; }, _select: function (k) { S.sel = k; card(k); kick(); } };
})();
