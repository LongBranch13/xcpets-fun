/* XCPETS Pet Cemetery v2 (scene Oct 28 2026; cemetery loop Oct 29 2026). The scene is display only; the finder and zombies read the replayed world (V.cemGraves / V.cemView).
 * 1) THE SCENE: an 8-bit perspective graveyard. Thousands of generic headstones (not tied to any pet) recede in rows toward one vanishing
 *    point and fade into fog under a full moon. Same build as the other place scenes: one 320x180 pixel canvas scaled by V2Sharp, a hint bar,
 *    tap Mort for a small card, RAF paused off screen and while the tab is hidden, prefers-reduced-motion = one still frame.
 *    Speed: the whole stone field is drawn ONCE into an offscreen 320x180 layer (a few ms); each frame only blits it and moves sky, fog and Mort.
 * 2) THE LIST: every dead pet from every player, built from the site's own api/pets.json (fetched and cut down to dead rows inside a Web Worker,
 *    so the 30+ MB file never parses on the page thread). Until it arrives (or if it fails) the replayed chain world fills the list.
 *    Sorts: newest death, oldest (hatch block), rarest tier, most powerful (Vigor+Spark+Grit+Zoom+Luck, the Ranking sum), most gear, longest lived.
 *    Filters: species, tier, meals. Find a grave (#, name, species, owner), My graves, #tomb-ID / ?id= deep links, paging for thousands of graves.
 * 3) THE ALTAR (Oct 28 2026 evening; live behind the cemetery gate Oct 29): a stone altar with candles on the grass beside the path. Tap it for a card; every grave in the list has
 *    "Raise at the altar", which loads js/v2-cemetery-altar.js (+ css/cemetery-altar.css, same ?v=) on demand and opens the mock seance panel.
 *    hooks('lit') turns the candles green while the panel is open; flare() makes them jump when an offering lands. Still no rule and no burn. */
(function () {
  'use strict';
  var W = 320, H = 180, HZ = 74, VX = 160, F = 70, CAMH = 1.6, RM = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  var S = { c: null, x: null, k: 1, raf: 0, off: false, hid: false, layer: null, sky: null, hits: [], sel: null, hov: null, line: 0, lt: 0, hook: 'off', total: 0, say: null };
  var LINES = ['Evenin\u2019. Mind the mud.', 'Feed \u2019em daily. Spares me the shovel.', 'Seven days. That\u2019s all it takes.', 'Rows go on past the fog.',
    'Quiet tonight. Too quiet.', 'Lantern\u2019s for you, not them.', 'Rest in pixels, little ones.', 'I stopped counting stones.'];
  var ALTAR = { x: 58, y: 138, w: 45, h: 32 }, SEANCE = { cx: 232, cy: 158, r: 20 }, MORT = { x: 26, y: 170 };
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
    if (h >= 10) px(x, '#0c1410', a - 1, b + h, w + 3, 1); /* foot shadow */
    if (w >= 8 && h >= 12 && fogStep(z) <= 1) { /* the near rows carry THE gravestone's motifs (option C): a dirt mound, a bone, now and then a skull or a candle */
      px(x, '#2a1c10', a - 1, b + h - 1, w + 2, 2); px(x, '#3d2a18', a, b + h - 1, w, 1); if (rnd(j + 23) < 0.55) { px(x, '#cfc8b0', a + 1, b + h, 3, 1); px(x, '#cfc8b0', a, b + h - 1, 1, 1); px(x, '#cfc8b0', a + 4, b + h - 1, 1, 1); }
      if (rnd(j + 29) < 0.25) { px(x, '#000', a + w - 4, b + h - 4, 5, 4); px(x, '#d6d0bc', a + w - 3, b + h - 3, 3, 2); px(x, '#111', a + w - 3, b + h - 2, 1, 1); px(x, '#111', a + w - 1, b + h - 2, 1, 1); }
      else if (rnd(j + 31) < 0.3) { px(x, '#000', a + w + 1, b + h - 4, 3, 4); px(x, '#cfc9b8', a + w + 2, b + h - 3, 1, 3); px(x, '#ffd166', a + w + 2, b + h - 5, 1, 1); } } }
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
  /* the seance circle (restored Oct 29 2026 from the earlier scene art, drawing unchanged; moved right of the path so the REST sign stays clear): six candles round a moon stone, lit while a seance panel is open */
  /* shared 8-bit candle bits: a flickering flame (3 shapes), a stepped glow and a smoke thread that drifts up and fades */
  function flame(x, cx, top, t, i, col, core, big) { var rm = reduced(), k = rm ? 0 : Math.floor(t / 110 + rnd(i) * 7 + Math.sin(t / 370 + i) * 1.5) % 3, sw = rm ? 0 : [0, -1, 1][Math.floor(t / 190 + i * 3) % 3], fh = 3 + (k === 1 ? 1 : 0) + (big || 0);
    var B = big || 0; x.save(); x.globalAlpha = 0.07 + (k === 1 ? 0.03 : 0); glow(x, col, cx - 5 - B, top - fh - 5, 11 + 2 * B, fh + 9, 2); x.globalAlpha = 0.12; glow(x, col, cx - 3, top - fh - 3, 7, fh + 5, 1); x.restore();
    px(x, col, cx + (k === 2 ? sw : 0), top - fh, 1, 1); px(x, col, cx - 1 + sw * (k === 0 ? 1 : 0), top - fh + 1, 3, fh - 1); px(x, core, cx, top - fh + 2, 1, Math.max(1, fh - 2)); }
  function glow(x, c, a, b, w, h, r) { px(x, c, a + r, b, w - 2 * r, h); px(x, c, a, b + r, r, h - 2 * r); px(x, c, a + w - r, b + r, r, h - 2 * r); if (r > 1) { px(x, c, a + 1, b + 1, 1, h - 2); px(x, c, a + w - 2, b + 1, 1, h - 2); } } /* a rect with stepped corners */
  function smoke(x, cx, top, t, i, n) { if (reduced()) return; for (var s = 0; s < (n || 3); s++) { var k = ((t / 2600) + rnd(i * 7 + s) + s / (n || 3)) % 1, sy = Math.round(top - 5 - k * 16), sx = Math.round(cx + Math.sin(t / 600 + s * 2 + i) * (1 + k * 2));
      x.save(); x.globalAlpha = (1 - k) * 0.35; px(x, k < 0.5 ? '#8a8896' : '#5e5c6c', sx, sy, 1, k > 0.6 ? 2 : 1); x.restore(); } }
  /* the seance circle: on the grass right of the path; a rune ring etched into the turf, six candles with their own foot shadows, the moon stone in the middle.
   * hook 'lit' (seance open) = green fire and glowing runes; otherwise plain candle flames and runes that only catch the moon now and then. */
  var RUNES = [[5, 2, 5], [7, 2, 2], [2, 7, 2], [5, 5, 7], [7, 5, 7], [1, 7, 4], [4, 7, 1], [7, 1, 7]];
  function seance(x, t) { var C = SEANCE, lit = S.hook === 'lit', hv = S.hov === 'seance' || S.sel === 'seance', rm = reduced(), a, an, i;
    x.save(); x.globalAlpha = 0.55; for (a = -C.r - 11; a <= C.r + 11; a++) { var hw = Math.round(Math.sqrt(Math.max(0, 1 - a * a / ((C.r + 11) * (C.r + 11)))) * (C.r + 11) * 0.42); px(x, '#0c1410', C.cx + a, C.cy - hw + 1, 1, hw * 2); } x.restore(); /* trodden turf */
    for (a = 0; a < 84; a++) { an = a / 84 * Math.PI * 2; px(x, a % 2 ? '#0a120d' : '#24382a', Math.round(C.cx + Math.cos(an) * (C.r + 9)), Math.round(C.cy + Math.sin(an) * (C.r + 9) * 0.42), 1, 1); } /* outer etched groove */
    for (a = 0; a < 40; a++) { an = a / 40 * Math.PI * 2; px(x, '#2b2a3a', Math.round(C.cx + Math.cos(an) * C.r), Math.round(C.cy + Math.sin(an) * C.r * 0.42), 2, 1); }
    var gl = lit ? 0.6 + 0.3 * (rm ? 1 : Math.sin(t / 420)) : 0.45 + (rm ? 0 : 0.25 * Math.max(0, Math.sin(t / 1300))), rc = lit ? '#7dff6a' : '#8f84c8';
    for (i = 0; i < 8; i++) { an = i / 8 * Math.PI * 2 + Math.PI / 6 + 0.3; var rx = Math.round(C.cx + Math.cos(an) * (C.r + 5)) - 1, ry = Math.round(C.cy + Math.sin(an) * (C.r + 5) * 0.42) - 1, g = RUNES[i];
      for (var gy = 0; gy < 3; gy++) for (var gx = 0; gx < 3; gx++) if (g[gy] & (4 >> gx)) { px(x, '#0a120d', rx + gx, ry + gy + 1, 1, 1); x.save(); x.globalAlpha = gl; px(x, rc, rx + gx, ry + gy, 1, 1); x.restore(); } }
    if (lit) { x.save(); x.globalAlpha = 0.08 + (rm ? 0 : 0.04 * Math.sin(t / 300)); px(x, '#7dff6a', C.cx - C.r, C.cy - 8, C.r * 2, 16); x.restore(); }
    px(x, '#0c1410', C.cx - 9, C.cy + 3, 18, 2); px(x, '#000', C.cx - 8, C.cy - 3, 16, 7); px(x, '#56526a', C.cx - 7, C.cy - 2, 14, 5); px(x, '#6c6884', C.cx - 7, C.cy - 2, 14, 1); px(x, '#cfc9ff', C.cx - 2, C.cy - 1, 3, 3); px(x, '#56526a', C.cx - 1, C.cy - 1, 2, 2); /* moon stone */
    var HT = [6, 8, 5, 7, 6, 8], back = [], front = [];
    for (i = 0; i < 6; i++) { var b2 = i / 6 * Math.PI * 2 + 0.3; (Math.sin(b2) < 0 ? back : front).push(i); }
    back.concat(front).forEach(function (i) { var b = i / 6 * Math.PI * 2 + 0.3, cx = Math.round(C.cx + Math.cos(b) * C.r), cy = Math.round(C.cy + Math.sin(b) * C.r * 0.42), h = HT[i];
      px(x, '#0c1410', cx - 2, cy + 1, 6, 1); px(x, '#000', cx - 2, cy - h - 1, 5, h + 2); px(x, '#e8e0c8', cx - 1, cy - h, 3, h); px(x, '#b8b09a', cx + 1, cy - h, 1, h); px(x, '#fffbe8', cx - 1, cy - h, 1, 1);
      if (i % 2) px(x, '#e8e0c8', cx - 2, cy - h + 2, 1, 2); /* wax drip */ px(x, '#333', cx, cy - h - 2, 1, 2);
      flame(x, cx, cy - h - 2, t, i + 11, lit ? '#7dff6a' : '#ffc93c', lit ? '#e6ffd8' : '#fff3b0', lit ? 1 : 0); smoke(x, cx, cy - h - 6, t, i + 3, lit ? 3 : 2); });
    if (hv) outline(x, C.cx - C.r - 11, C.cy - 22, C.r * 2 + 22, 35); S.hits.push({ x: C.cx - C.r - 11, y: C.cy - 22, w: C.r * 2 + 22, h: 35, k: 'seance' }); }
  /* the altar: on the grass left of the path (Oct 29 2026: off the path, grounded with a contact shadow, trodden earth, grass tufts and a warm glow pool),
   * slab + body + base, four candles; carved marks on the face. hook 'lit' = green flames (seance open). */
  function altar(x, t) { var a = ALTAR, rm = reduced(), hv = S.hov === 'altar' || S.sel === 'altar', lit = S.hook === 'lit', fl = Math.max(0, 1 - (t - (S.flT || -1e9)) / 600), q;
    x.save(); x.globalAlpha = 0.5; for (q = -30; q <= 30; q++) { var hh = Math.round(Math.sqrt(1 - q * q / 900) * 5); px(x, '#0a120d', a.x + 22 + q, a.y + 31 - hh, 1, hh * 2); } x.restore(); /* trodden earth */
    x.save(); x.globalAlpha = (lit ? 0.12 : 0.07) + (rm ? 0 : 0.03 * Math.sin(t / 250)); glow(x, lit ? '#7dff6a' : '#ffc93c', a.x - 6, a.y + 25, a.w + 12, 10, 2); x.restore(); /* glow pool on the turf */
    px(x, '#05080a', a.x - 1, a.y + 31, a.w + 2, 2); px(x, '#0c1410', a.x - 3, a.y + 30, a.w + 6, 2); px(x, '#16141f', a.x, a.y + 25, a.w, 6); px(x, '#6a6e7a', a.x + 1, a.y + 26, a.w - 2, 4); px(x, '#525560', a.x + 1, a.y + 29, a.w - 2, 1);
    px(x, '#16141f', a.x + 6, a.y + 9, a.w - 12, 17); px(x, '#7c808c', a.x + 7, a.y + 9, a.w - 14, 16); px(x, '#525560', a.x + a.w - 13, a.y + 9, 6, 16); px(x, '#9a9ea8', a.x + 7, a.y + 9, 1, 16);
    px(x, '#16141f', a.x + 2, a.y + 5, a.w - 4, 5); px(x, '#9a9ea8', a.x + 3, a.y + 6, a.w - 6, 3); px(x, '#c8ccd4', a.x + 3, a.y + 6, a.w - 6, 1);
    for (var m = 0; m < 4; m++) px(x, '#3a3550', a.x + 12 + m * 2, a.y + 13, 1, 6); for (var d = 0; d < 7; d++) px(x, '#3a3550', a.x + 11 + d, a.y + 18 - d, 1, 1);
    px(x, '#3a3550', a.x + 25, a.y + 13, 5, 1); px(x, '#3a3550', a.x + 27, a.y + 11, 1, 6);
    if (lit) { x.save(); x.globalAlpha = 0.5 + (rm ? 0 : 0.3 * Math.sin(t / 380)); for (m = 0; m < 4; m++) px(x, '#7dff6a', a.x + 12 + m * 2, a.y + 13, 1, 6); for (d = 0; d < 7; d++) px(x, '#7dff6a', a.x + 11 + d, a.y + 18 - d, 1, 1); px(x, '#7dff6a', a.x + 25, a.y + 13, 5, 1); px(x, '#7dff6a', a.x + 27, a.y + 11, 1, 6); x.restore(); } /* the carved marks glow */
    [[2, '#2f5a3a'], [5, '#24452d'], [a.w - 4, '#2f5a3a'], [a.w - 8, '#24452d'], [14, '#24452d'], [a.w - 17, '#2f5a3a']].forEach(function (g, j) { var gx = a.x + g[0], h = 2 + (j % 3); px(x, g[1], gx, a.y + 31 - h, 1, h); px(x, g[1], gx + 1, a.y + 32 - h + 1, 1, h - 1); }); /* grass tufts over the base */
    px(x, '#3d6b45', a.x + 1, a.y + 25, 3, 1); px(x, '#3d6b45', a.x + a.w - 5, a.y + 24, 2, 2); /* moss */
    [[5, 7], [10, 5], [a.w - 11, 5], [a.w - 6, 7]].forEach(function (c, j) { var cx = a.x + c[0], h = c[1], cy = a.y + 6, big = Math.round(fl * 5) + (lit ? 1 : 0), col = lit || fl > 0.1 ? '#7dff6a' : '#ffc93c';
      px(x, '#16141f', cx - 1, cy - h - 1, 4, h + 1); px(x, '#e9e3d0', cx, cy - h, 2, h); px(x, '#b8b09a', cx + 1, cy - h, 1, h); if (j % 2) px(x, '#e9e3d0', cx - 1, cy - h + 2, 1, 2);
      flame(x, cx, cy - h, t, j + 31, col, lit || fl > 0.1 ? '#e6ffd8' : '#fff3b0', big); smoke(x, cx, cy - h - 4 - big, t, j + 21, 2); });
    if (lit && !rm) { for (var s = 0; s < 6; s++) { var k = (t / 900 + s / 6) % 1, sx = a.x + a.w / 2 - 6 + ((s * 7) % 12) + Math.round(Math.sin(t / 300 + s) * 2); x.save(); x.globalAlpha = (1 - k) * 0.6; px(x, s % 2 ? '#7dff6a' : '#c9ffb0', sx, Math.round(a.y + 4 - k * 22), 1, 1); x.restore(); } }
    if (hv) outline(x, a.x - 3, a.y - 9, a.w + 6, a.h + 10); S.hits.push({ x: a.x - 3, y: a.y - 9, w: a.w + 6, h: a.h + 10, k: 'altar' }); }
  function draw(t) { var x = S.x; if (!x) return; if (window.V2Sharp) V2Sharp.begin(x, S.k); else x.imageSmoothingEnabled = false; S.hits = [];
    if (!S.sky) S.sky = buildSky(); if (!S.layer) S.layer = buildLayer();
    sky(x, t); x.drawImage(S.layer, 0, HZ, W, H - HZ, 0, HZ, W, H - HZ); fog(x, t); wisps(x, t); gate(x); board(x); seance(x, t); altar(x, t); mort(x, t);
    if (!reduced() && t - S.lt > 12000) { S.lt = t; S.line = (S.line + 1) % LINES.length; } if (S.say || (!reduced() && t - S.lt < 4000)) bubble(x, S.say || LINES[S.line], MORT.x - 6, MORT.y - 46);
    if (!reduced() && !S.off && !S.hid) S.raf = requestAnimationFrame(draw); else S.raf = 0; }
  function kick() { if (S.x && !S.raf) draw(performance.now()); }
  function card(k) { var el = document.getElementById('cemCard'); if (!el) return; if (!k) { el.hidden = true; return; } el.hidden = false;
    if (k === 'mort') el.innerHTML = '<b class="cc-h">🏮 Mort, the caretaker</b><p class="small">Keeps the grass short and the gate shut. A pet ends up here after 7 full chain days (144 blocks each) with no meal. Mythic pets never starve. Every grave is in the list below. Feed yours on <a href="play.html">Play</a>.</p>';
    if (k === 'seance') el.innerHTML = '<b class="cc-h">🕯️ The seance circle</b><p class="small">Six candles round a moon stone. ' + (S.cemOn ? 'They light while a seance is open at the altar.' : 'They won\u2019t light. Not tonight.') + '</p>';
    if (k === 'altar') { var on = !!S.cemOn; el.innerHTML = '<b class="cc-h">🕯️ The altar</b><p class="small">Pick a grave in the finder below and press <b>Raise at the altar</b>. Offer your living pets (and spare gear) to bring it back as a zombie: more and rarer offerings, more power, up to 3 times what it died with. The top giver owns the zombie.' + (on ? '' : ' Raising opens when the cemetery loop goes live; until then the finder is read-only.') + '</p>' + (on ? '<button type="button" class="btn" id="cemAltGo">🕯️ Open the altar for the first grave you can raise</button>' : ''); var go = document.getElementById('cemAltGo'); if (go) go.onclick = function () { if (S.openAltar) S.openAltar(); }; } }
  function at(c, e) { var r = c.getBoundingClientRect(), mx = (e.clientX - r.left) * W / r.width, my = (e.clientY - r.top) * H / r.height, hs = S.hits.filter(function (q) { return mx >= q.x && mx < q.x + q.w && my >= q.y && my < q.y + q.h; }); return hs.length ? hs[hs.length - 1] : null; }
  /** mount(w, dead): draws the scene into #cemScene; dead = the page's dead list (only its length is used: the stones are generic). */
  function mount(w, dead) { var box = document.getElementById('cemScene'); if (!box) return; S.total = dead ? dead.length : 0; S.sel = null;
    var c = box.querySelector('canvas'); if (!c) { box.innerHTML = '<canvas width="' + W + '" height="' + H + '" role="img" aria-label="The XCPETS Pet Cemetery at night: endless rows of gravestones fading into fog under a full moon, a stone altar with candles on the grass beside the path, a seance circle of six candles in a rune ring, Mort the caretaker at the gate"></canvas><div class="cem-hint small">👇 Every grave from every player is in the list below · tap Mort to say hi · 🕯️ tap the altar</div>';
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
  var TL = ['Common', 'Uncommon', 'Rare', 'Legendary'], TID = ['common', 'uncommon', 'rare', 'legendary'];
  /* grave finder (owner, Oct 29 2026 6:49 PM CT): sort and filter by rarity, stage, days dead, raise difficulty, name / number; "Rarest first" quick pick.
   * Every grave fact comes from the replayed world through V.cemGraves (same block as the rules), so state and difficulty are exact. */
  var SORTS = [['rarest', 'Rarest first'], ['newest', 'Newest graves'], ['oldest', 'Longest dead'], ['easiest', 'Easiest to raise'], ['strongest', 'Strongest at death'], ['gear', 'Most gear'], ['lived', 'Longest lived'], ['id', 'Pet number']];
  var DAYS = [['', 'Any time'], ['0-1', '0 to 1 days'], ['2-7', '2 to 7 days'], ['8-30', '8 to 30 days'], ['31-', 'Over 30 days']];
  var DIFF = { easy: 'Easy', medium: 'Medium', hard: 'Hard', closed: 'Closed' };
  var STATE = { hunted: 'Hunted: laid to rest for good', dust: 'Turned to dust', halo: 'Resurrected: rests with its halo' };
  function life(p) { return p.born != null && p.died != null ? p.died - p.born : -1; }
  function art(n, s, l) { return window.V2CemArt ? V2CemArt.img(n, s, l) : ''; }
  /** page(ctx): the whole cemetery page body (called by js/v2-pages.js cemetery()). ctx = { w, M, R, V, ME, fmt, shortAddr } */
  function page(ctx) { var w = ctx.w, M = ctx.M, R = ctx.R, V = ctx.V, ME = ctx.ME, fmt = ctx.fmt, sa = ctx.shortAddr, $ = function (id) { return document.getElementById(id); };
    var b = (w.tip || (M.state && M.state().tip) || 0) + 1, on = V.cemOn ? V.cemOn(b) : false, pub = on && V.cemPublic(b), CE = V.CEM || {}, gate = V.cemeteryGate ? V.cemeteryGate() : null;
    ctx.b = b; S.cemOn = on; css(); artJs(function () { if (st.ready) { zombies(); paint(); } });
    function row(g) { var p = w.byId[g.id], s = p.zDeath || p.stats || {}; return { id: g.id, name: g.name || ('#' + g.id), species: g.species, spl: V.speciesLabel ? V.speciesLabel(g.species) : g.species, tier: g.tier, stage: g.stage, stageName: g.stageName, owner: g.owner,
      gear: R.graveCount ? R.graveCount(w, p) : 0, power: g.deathPower, born: p.hatchBlock, died: g.deathBlock, fed: p.lastFed, hybrid: V.isHybrid ? !!V.isHybrid(g.species) : false, days: g.daysDead, diff: g.diff, need: g.need, needLabel: g.needLabel, state: g.state, open: g.open, raisable: g.raisable, af: g.ageFactor, crumbles: g.crumbles }; }
    var all = V.cemGraves(w, b, { sort: 'id' }).map(row), phone = window.matchMedia && matchMedia('(max-width: 640px)').matches, PER = phone ? 24 : 60;
    var st = { q: '', mine: false, sort: 'rarest', sp: '', tier: '', stage: '', days: '', diff: '', raisable: false, meals: '', page: 0, list: [] }, tombs = $('tombs');
    mount(w, all);
    var zs = document.createElement('section'); zs.className = 'cv2-zombies'; zs.id = 'cemZombies'; tombs.parentNode.insertBefore(zs, tombs);
    var bar = document.createElement('div'); bar.className = 'uxp-find cemfind cemv2bar'; bar.id = 'cemFinder';
    var opt = function (L, cur) { return L.map(function (s) { return '<option value="' + s[0] + '"' + (s[0] === cur ? ' selected' : '') + '>' + s[1] + '</option>'; }).join(''); };
    bar.innerHTML = '<h3 class="cv2-fh">🔎 Grave finder</h3><div class="cv2-row"><label class="small" for="cemFind">Find a grave</label><input id="cemFind" type="search" placeholder="Pet #, name, species or owner" autocomplete="off"><button type="button" class="btn" id="cemGo">Find</button>' + (ME ? '<button type="button" class="btn ghost" id="cemMine" aria-pressed="false">My graves</button>' : '') + '</div>' +
      '<div class="cv2-row cv2-quick" role="group" aria-label="Quick picks"><button type="button" class="q" id="cemRarest" aria-pressed="false">💎 Rarest first</button><button type="button" class="q" id="cemEasiest" aria-pressed="false">' + art('easy', 12) + ' Easiest to raise</button><button type="button" class="q" id="cemFresh" aria-pressed="false">🪦 Freshest graves</button><button type="button" class="q" id="cemOpen" aria-pressed="false">' + art('candle', 12) + ' Open altars</button><button type="button" class="q" id="cemClear">↺ Clear filters</button></div>' +
      '<div class="cv2-row cv2-sel"><label class="small">Sort <select id="cemSort">' + opt(SORTS, st.sort) + '</select></label>' +
      '<label class="small">Rarity <select id="cemTier"><option value="">All rarities</option>' + TL.map(function (t, i) { return '<option value="' + i + '">' + t + '</option>'; }).join('') + '</select></label>' +
      '<label class="small">Stage <select id="cemStage"><option value="">All stages</option></select></label>' +
      '<label class="small">Days dead <select id="cemDays">' + opt(DAYS, '') + '</select></label>' +
      '<label class="small">Difficulty <select id="cemDiff"><option value="">Any</option><option value="easy">Easy (Common+ offering)</option><option value="medium">Medium (Uncommon+)</option><option value="hard">Hard (Rare+)</option><option value="closed">Closed graves</option></select></label>' +
      '<label class="small">Species <select id="cemSp"><option value="">All species</option></select></label>' +
      '<label class="small">Meals <select id="cemMeals"><option value="">All graves</option><option value="fed">Fed at least once</option><option value="nf">Never fed</option></select></label>' +
      '<label class="small cv2-chk"><input type="checkbox" id="cemRaisable"> Raisable only</label></div>' +
      '<p class="small muted" id="cemMsg" aria-live="polite"></p>';
    tombs.parentNode.insertBefore(bar, tombs);
    var pg = function (id) { var d = document.createElement('div'); d.className = 'cv2-pager'; d.id = id; return d; }, pTop = pg('cemPagerTop'), pBot = pg('cemPager'); tombs.parentNode.insertBefore(pTop, tombs); tombs.parentNode.insertBefore(pBot, tombs.nextSibling);
    function opts() { var n = {}, lab = {}, sg = {}; all.forEach(function (p) { var k = p.hybrid ? '__hyb' : p.species; n[k] = (n[k] || 0) + 1; lab[k] = p.hybrid ? 'Hybrids' : p.spl; sg[p.stage] = p.stageName; });
      var s = $('cemSp'), cur = s.value; s.innerHTML = '<option value="">All species</option>' + Object.keys(n).sort(function (a, c) { return a === '__hyb' ? 1 : c === '__hyb' ? -1 : String(lab[a]).localeCompare(lab[c]); }).map(function (k) { return '<option value="' + esc(k) + '">' + esc(lab[k]) + ' (' + fmt(n[k]) + ')</option>'; }).join(''); s.value = cur; if (s.value !== cur) s.value = '';
      var t = $('cemStage'), c2 = t.value; t.innerHTML = '<option value="">All stages</option>' + Object.keys(sg).sort(function (a, c) { return a - c; }).map(function (k) { return '<option value="' + k + '">' + esc(sg[k]) + '</option>'; }).join(''); t.value = c2; if (t.value !== c2) t.value = ''; }
    function gateLine() { return on ? (pub ? '' : ' 🧪 Owner test: until launch only grave #' + CE.OWNER_GRAVE + ' can be raised, by the owner wallet.') : ' 🕯️ Raising the dead opens at block ' + (gate == null ? '(set at launch)' : fmt(gate)) + '; until then the finder is read-only.'; }
    function status() { $('status').textContent = fmt(all.length) + ' grave' + (all.length === 1 ? '' : 's') + ' in the Pet Cemetery, from every player (replayed from ' + fmt(M.state().rows.length) + ' XCPETS burns). A pet dies after 7 full chain days (144 blocks each) with no feed.' + gateLine(); }
    function canRaise(p) { if (!on || !p.raisable) return false; if (!pub) return p.id === CE.OWNER_GRAVE && ME === CE.OWNER; return true; }
    function tomb(p) { var wp = w.byId[p.id], gl = wp && R.graveCount && R.graveCount(w, wp) ? R.graveLine(w, wp) : '', lf = life(p), v = p.open ? V.cemView(w, wp, b) : null;
      var badge = p.state ? '<span class="cv2-diff d-closed">' + art(p.state === 'halo' ? 'halo' : p.state, 12) + ' ' + STATE[p.state] + '</span>' : '<span class="cv2-diff d-' + p.diff + '" title="Needs at least 1 ' + esc(p.needLabel) + ' offering">' + art(p.diff, 12) + ' ' + DIFF[p.diff] + ' · needs ' + esc(p.needLabel) + '</span>';
      return '<div class="tomb gtomb' + (p.state ? ' tomb-' + p.state : '') + (p.open ? ' tomb-open' : '') + '" id="tomb-' + p.id + '"><canvas class="gstone" width="52" height="62" data-id="' + p.id + '" role="img" aria-label="gravestone of #' + p.id + (p.state ? ', ' + esc(STATE[p.state]) : '') + '"></canvas><h4><a href="pet.html?id=' + p.id + '">' + esc(p.name) + '</a> <span class="muted">#' + p.id + '</span></h4>' +
        '<div class="small">' + esc(p.spl) + ' · <span class="pill tier tier-' + (p.resurrected ? 'god' : TID[p.tier]) + '">' + (p.resurrected ? 'God' : TL[p.tier]) + '</span> · reached ' + esc(p.stageName) + '</div>' +
        '<div class="small cv2-badges">' + badge + '</div>' +
        '<div class="small cv2-facts">⚡ ' + fmt(p.power) + ' power · 🎒 ' + fmt(p.gear) + ' gear · 💀 ' + fmt(p.days) + ' day' + (p.days === 1 ? '' : 's') + ' dead' + (p.raisable && p.af < 1 ? ' · grave strength ' + Math.round(p.af * 100) + '%' : '') + (p.crumbles ? ' · crumbled ' + p.crumbles + ' time' + (p.crumbles === 1 ? '' : 's') : '') + '</div>' +
        '<div class="small muted tombowner" title="' + esc(p.owner) + '" style="overflow-wrap:anywhere">owner ' + esc(sa(p.owner)) + (ME && p.owner === ME ? ' (you)' : '') + ' · ⏳ ' + (lf >= 0 ? '~' + fmt(Math.floor(lf / 144)) + ' day' + (Math.floor(lf / 144) === 1 ? '' : 's') + ' lived' : '?') + '</div>' +
        '<div class="died">🥚 hatched ' + (p.born != null ? 'block ' + fmt(p.born) : '?') + '<br>🪦 died at block ' + fmt(p.died) + '</div>' + (gl ? '<div class="small buried">' + gl + '</div>' : '') +
        (v && v.altar ? '<div class="small cv2-pool">' + art('candle', 12) + ' Altar open · closes in ' + fmt(v.altar.closesIn) + ' blocks · top giver ' + esc(sa(v.altar.top || '')) + (v.altar.top === ME ? ' (you)' : '') + '</div>' : '') +
        (canRaise(p) ? '<button type="button" class="btn cv2-raise" data-raise="' + p.id + '">' + art('shovel', 12) + ' ' + (p.open ? 'Join the seance' : 'Raise at the altar') + '</button>' : p.raisable && on && !pub ? '<div class="small muted cv2-lock">🧪 Owner test: ' + (p.id === CE.OWNER_GRAVE ? 'only the owner wallet can raise this grave' : 'only grave #' + CE.OWNER_GRAVE + ' can be raised for now') + '</div>' : '') + '</div>'; }
    /* risen zombies: hunger, feral, crumble countdown; Hunt (anyone, feral only), zombie feed / Resurrection (owner only) */
    function myLiving() { return ME ? w.pets.filter(function (p) { return p.owner === ME && !p.dead && !p.released && !p.community && !V.isZ(p); }) : []; }
    function zcard(p) { var v = V.cemView(w, p, b), mine = ME && p.owner === ME, L = myLiving(), hp = Math.round(v.hunger * 100), res = v.res;
      var huntOpts = L.filter(function (a) { return !V.cemHuntWhy(w, a.id, p.id, ME, b); }), foodOpts = L.filter(function (a) { return !V.cemOfferWhy(w, a, ME, b); });
      var opt2 = function (A) { return A.map(function (a) { return '<option value="' + a.id + '">' + esc(a.name || '#' + a.id) + ' #' + a.id + ' · ' + TL[a.tier | 0] + '</option>'; }).join(''); };
      var acts = '';
      if (on && !mine && ME) { var hw0 = huntOpts.length ? null : (L.length ? V.cemHuntWhy(w, L[0].id, p.id, ME, b) : 'you need a living pet to hunt');
        acts += '<div class="cv2-zact">' + art('hunter', 12) + ' <label class="small">Hunter <select data-hpick="' + p.id + '"' + (hw0 ? ' disabled' : '') + '>' + opt2(huntOpts) + '</select></label> <button type="button" class="btn" data-hunt="' + p.id + '"' + (hw0 ? ' disabled title="' + esc(hw0) + '"' : '') + '>⚔️ Hunt · ' + fmt(V.cemCost(w, 'hunt', b)) + ' XCPETS</button>' + (hw0 ? ' <span class="small muted">' + esc(hw0) + '</span>' : '') + '</div>'; }
      if (on && mine) { acts += '<div class="cv2-zact"><a class="btn" href="play.html#pet-' + p.id + '">🍖 Feed it pets (pick on its card)</a> <span class="small muted">it eats pets you choose, used up for good · fee ' + fmt(V.cemCost(w, 'zmeal', b)) + ' XCPETS per burn</span></div>' +
        '<div class="cv2-zact"><a class="btn ghost" href="play.html#pet-' + p.id + '">' + art('halo', 12) + ' Pledge pets &amp; gear to its Resurrection (pick on its card)</a> <span class="small muted">tick as many as you like · fee ' + fmt(V.cemCost(w, 'rpl', b)) + ' XCPETS per burn</span></div>' +
        '<div class="cv2-zact"><button type="button" class="btn" data-res="' + p.id + '"' + (res.points < CE.RES_MIN ? ' disabled title="Needs ' + CE.RES_MIN + ' points"' : '') + '>😇 Resurrect · ' + fmt(V.cemCost(w, 'resurrect', b)) + ' XCPETS</button> <span class="small">' + res.points + (res.bonus ? ' + ' + res.bonus + ' Halloween' : '') + ' of ' + CE.RES_MIN + ' points · ' + Math.round(res.chance * 100) + '% chance; a miss turns it to dust</span></div>'; }
      return '<div class="tomb ztomb' + (v.feral ? ' feral' : '') + '" id="zombie-' + p.id + '"><canvas width="32" height="32" data-z="' + p.id + '" role="img" aria-label="zombie #' + p.id + '"></canvas><h4><a href="pet.html?id=' + p.id + '">' + esc(p.name || '#' + p.id) + '</a> <span class="muted">#' + p.id + '</span> ' + (v.feral ? art('feral', 16, 'feral') : '') + '</h4>' +
        '<div class="small"><b class="zt">🧟 the ' + esc(v.milestone) + '</b> · ⚡ ' + fmt(v.power) + ' power · ' + v.times.toFixed(2) + ' times its death stats (ceiling ' + v.cap + ' times)</div>' +
        '<div class="cv2-hunger" title="Hunger: feral in ' + fmt(v.hungerLeft) + ' blocks"><i style="width:' + hp + '%"></i></div>' +
        '<div class="small">' + (v.feral ? '<b class="cv2-feral">FERAL</b>: anyone can hunt it · crumbles to dust in ' + fmt(v.crumbleIn) + ' blocks' : '🍖 Feral in ' + fmt(v.hungerLeft) + ' blocks unless fed · crumbles in ' + fmt(v.crumbleIn)) + '</div>' +
        '<div class="small muted">raised by ' + esc(sa(v.by || '')) + ' · owner ' + esc(sa(p.owner)) + (mine ? ' (you)' : '') + (v.meals ? ' · ' + v.meals + ' meal' + (v.meals === 1 ? '' : 's') : '') + '</div>' + acts + '</div>'; }
    function zombies() { var Z = w.pets.filter(function (p) { return V.isZ(p); }), C = w.cem || {}, HB = C.huntedBy || {}, top = Object.keys(HB).sort(function (a, c) { return HB[c] - HB[a]; }).slice(0, 5);
      Z.sort(function (a, c) { var x = V.cemView(w, a, b), y = V.cemView(w, c, b); return (y.feral - x.feral) || (x.crumbleIn - y.crumbleIn) || a.id - c.id; });
      var H = w.pets.filter(function (p) { return p.resurrected && !p.dead; }).sort(function (a, c) { return c.resurrected.block - a.resurrected.block || a.id - c.id; });
      zs.hidden = !Z.length && !top.length && !H.length; if (zs.hidden) { zs.innerHTML = ''; return; }
      zs.innerHTML = '<h3>🧟 Risen zombies <span class="small muted">(' + fmt(Z.length) + ')</span></h3><p class="small muted">A zombie goes feral after ' + fmt(CE.FERAL) + ' blocks without a meal; feral zombies can be hunted by anyone, and crumble to dust ' + fmt(CE.CRUMBLE) + ' blocks later.</p>' +
        (top.length ? '<p class="small cv2-hunters">' + art('hunter', 16) + ' <b>Zombie Hunters:</b> ' + top.map(function (a) { return esc(sa(a)) + (a === ME ? ' (you)' : '') + ' · ' + HB[a]; }).join(' · ') + '</p>' : '') +
        '<div class="tombs">' + Z.map(zcard).join('') + '</div>' +
        (H.length ? '<h3>' + art('halo', 16) + ' Brought back <span class="small muted">(' + fmt(H.length) + ')</span></h3><p class="small muted">A Resurrection that succeeds makes the zombie a living pet again, with a halo for good (power ceiling ' + CE.CAP_RES + ' times). One that fails turns it to dust.</p><div class="cv2-halos">' +
          H.slice(0, 24).map(function (p) { return '<a class="cv2-halo" href="pet.html?id=' + p.id + '">' + art('halo', 12) + ' ' + esc(p.name || '#' + p.id) + ' <span class="muted">#' + p.id + ' · block ' + fmt(p.resurrected.block) + (ME && p.owner === ME ? ' · yours' : '') + '</span></a>'; }).join('') + '</div>' : '');
      Z.forEach(function (p) { var c = zs.querySelector('canvas[data-z="' + p.id + '"]'); if (c && p.art && R.lazy) R.lazy(c, function () { return R.framesWith(p.art, Math.max(5, p.stage), []); }, true); }); }
    function go(tags) { location.href = 'play.html#cem-' + encodeURIComponent(tags.join('~')); }
    zs.addEventListener('click', function (e) { var t = e.target.closest('[data-hunt],[data-zfeed],[data-rpl],[data-res]'); if (!t || t.disabled) return; var z;
      if ((z = t.getAttribute('data-hunt'))) { var a = +zs.querySelector('[data-hpick="' + z + '"]').value, why = V.cemHuntWhy(w, a, +z, ME, b); if (why) { t.title = why; return; } go([V.cemHuntPlan(w, a, +z, b).tag]); }
      else if ((z = t.getAttribute('data-zfeed'))) { var f = +zs.querySelector('[data-fpick="' + z + '"]').value; go([V.cemPlan(w, 'zfeed', +z, [f], b).tag]); }
      else if ((z = t.getAttribute('data-rpl'))) { var r = +zs.querySelector('[data-rpick="' + z + '"]').value; go([V.cemPlan(w, 'rpl', +z, [r], b).tag]); }
      else if ((z = t.getAttribute('data-res'))) go([V.cemPlan(w, 'resurrect', +z, null, b).tag]); });
    function pager(el, pages) { if (pages <= 1) { el.innerHTML = ''; return; } var bt = function (k, t, dis) { return '<button type="button" class="q" data-pg="' + k + '"' + (dis ? ' disabled' : '') + '>' + t + '</button>'; };
      el.innerHTML = bt('first', '⏮ First', !st.page) + bt('prev', '◀ Prev', !st.page) + '<label class="small">Page <input type="number" min="1" max="' + pages + '" value="' + (st.page + 1) + '" data-pgin aria-label="Page number"> of ' + fmt(pages) + '</label>' + bt('next', 'Next ▶', st.page >= pages - 1) + bt('last', 'Last ⏭', st.page >= pages - 1); }
    function paint() { var pages = Math.max(1, Math.ceil(st.list.length / PER)); st.page = Math.max(0, Math.min(st.page, pages - 1)); var L = st.list.slice(st.page * PER, st.page * PER + PER);
      tombs.innerHTML = L.length ? L.map(tomb).join('') : '<p class="muted small">No grave matches. Try a pet number, a name, a species or a full owner address, or clear a filter.</p>';
      stoneJs(function () { L.forEach(function (p) { var wp = w.byId[p.id], c = tombs.querySelector('canvas[data-id="' + p.id + '"]'); if (c && c.isConnected && wp && wp.art) window.V2Gravestone.draw(c, { art: wp.art, stage: wp.stage, tier: p.tier, state: p.state, crumbles: p.crumbles, open: !!p.open }); }); });
      pager(pTop, pages); pager(pBot, pages); }
    var LOC = { gear: function (a, c) { return c.gear - a.gear || c.power - a.power || a.id - c.id; }, lived: function (a, c) { return life(c) - life(a) || a.id - c.id; } };
    function apply(keepPage) { var q0 = st.q.trim().toLowerCase(), exact = /^#\d+$/.test(q0), q = q0.replace(/^#/, ''), num = /^\d+$/.test(q), meals = q ? '' : st.meals, dd = st.days ? st.days.split('-') : null;
      var Q = { tier: st.tier, stage: st.stage, diff: st.diff, raisable: st.raisable, sort: LOC[st.sort] ? 'id' : st.sort }; if (dd) { Q.minDays = +dd[0]; if (dd[1] !== '') Q.maxDays = +dd[1]; }
      var ids = {}, ord = {}; V.cemGraves(w, b, Q).forEach(function (g, i) { ids[g.id] = 1; ord[g.id] = i; });
      st.list = all.filter(function (p) { if (!ids[p.id]) return false; if (st.mine && p.owner !== ME) return false; if (st.open && !p.open) return false; if (st.sp && (st.sp === '__hyb' ? !p.hybrid : p.species !== st.sp || p.hybrid)) return false;
        if (meals === 'fed' && p.fed == null) return false; if (meals === 'nf' && p.fed != null) return false; if (!q) return true;
        return exact ? String(p.id) === q : num ? String(p.id).indexOf(q) === 0 : String(p.name).toLowerCase().indexOf(q) >= 0 || String(p.spl).toLowerCase().indexOf(q) >= 0 || String(p.owner).toLowerCase() === q || (q.length >= 6 && String(p.owner).toLowerCase().indexOf(q) >= 0); });
      st.list.sort(LOC[st.sort] || function (a, c) { return ord[a.id] - ord[c.id]; }); if (num) st.list.sort(function (a, c) { return (String(c.id) === q) - (String(a.id) === q); });
      if (!keepPage) st.page = 0; var n = st.list.length;
      $('cemMsg').innerHTML = fmt(n) + ' grave' + (n === 1 ? '' : 's') + ' shown' + (q ? ' for "' + esc(st.q.trim()) + '"' : '') + ' · sorted ' + esc((SORTS.filter(function (s) { return s[0] === st.sort; })[0] || SORTS[0])[1].toLowerCase()) + (q && st.meals ? ' · a search looks through every grave' : '');
      quick(); paint(); }
    function quick() { var set = function (id, v) { var e = $(id); if (e) e.setAttribute('aria-pressed', !!v); };
      var base = !st.tier && !st.stage && !st.days && !st.sp && !st.meals && !st.q;
      set('cemRarest', st.sort === 'rarest' && st.raisable && base && !st.diff); set('cemEasiest', st.sort === 'easiest' && st.raisable); set('cemFresh', st.sort === 'newest' && st.days === '0-1'); set('cemOpen', !!st.open); }
    function sync() { $('cemSort').value = st.sort; $('cemTier').value = st.tier; $('cemStage').value = st.stage; $('cemDays').value = st.days; $('cemDiff').value = st.diff; $('cemRaisable').checked = st.raisable; $('cemSp').value = st.sp; $('cemMeals').value = st.meals; $('cemFind').value = st.q; }
    function reset() { st.tier = st.stage = st.days = st.diff = st.sp = st.meals = st.q = ''; st.raisable = false; st.open = false; }
    function onPager(e) { var t = e.target.closest('[data-pg]'); if (!t) return; var pages = Math.ceil(st.list.length / PER), k = t.getAttribute('data-pg'); st.page = k === 'first' ? 0 : k === 'last' ? pages - 1 : k === 'prev' ? st.page - 1 : st.page + 1; paint(); if (this === pBot) pTop.scrollIntoView({ block: 'start' }); }
    function onPgIn(e) { if (!e.target.hasAttribute('data-pgin')) return; var v = parseInt(e.target.value, 10); if (v > 0) { st.page = v - 1; paint(); } }
    [pTop, pBot].forEach(function (el) { el.addEventListener('click', onPager); el.addEventListener('change', onPgIn); });
    /* "Raise at the altar": load the altar module on first use, then open the seance panel for that grave (hidden until the gate; owner test: grave #2, owner wallet) */
    /* owner's raise flow (Oct 29 2026 8:35 PM CT), step 1: click a gravestone to begin raising that dead pet (the whole stone, not only the button) */
    tombs.addEventListener('click', function (e) { var bt = e.target.closest('[data-raise]'), tb = e.target.closest('.tomb'); if (!bt && tb && !e.target.closest('a,button,select,input,label')) bt = tb.querySelector('[data-raise]'); if (!bt) return; var id = +bt.getAttribute('data-raise'), g = all.filter(function (p) { return p.id === id; })[0]; if (!g || !canRaise(g)) return;
      bt.disabled = true; altarJs(function () { bt.disabled = false; if (window.V2CemeteryAltar) V2CemeteryAltar.open(g, ctx); }); });
    S.openAltar = function () { var g = st.list.filter(canRaise)[0] || all.filter(canRaise)[0]; if (g) altarJs(function () { if (window.V2CemeteryAltar) V2CemeteryAltar.open(g, ctx); }); };
    var inp = $('cemFind'), tmr; inp.oninput = function () { clearTimeout(tmr); tmr = setTimeout(function () { st.q = inp.value; apply(); }, 200); };
    inp.onkeydown = function (e) { if (e.key === 'Enter') { clearTimeout(tmr); st.q = inp.value; apply(); } };
    $('cemGo').onclick = function () { clearTimeout(tmr); st.q = inp.value; apply(); };
    if ($('cemMine')) $('cemMine').onclick = function () { st.mine = !st.mine; this.setAttribute('aria-pressed', st.mine); this.classList.toggle('on', st.mine); this.textContent = st.mine ? 'All graves' : 'My graves'; apply(); };
    $('cemRarest').onclick = function () { reset(); st.sort = 'rarest'; st.raisable = true; sync(); apply(); };
    $('cemEasiest').onclick = function () { reset(); st.sort = 'easiest'; st.raisable = true; sync(); apply(); };
    $('cemFresh').onclick = function () { reset(); st.sort = 'newest'; st.days = '0-1'; sync(); apply(); };
    $('cemOpen').onclick = function () { var o = !st.open; reset(); st.open = o; st.sort = 'rarest'; sync(); apply(); };
    $('cemClear').onclick = function () { reset(); st.sort = 'rarest'; sync(); apply(); };
    $('cemSort').onchange = function () { st.sort = this.value; apply(); }; $('cemSp').onchange = function () { st.sp = this.value; apply(); }; $('cemTier').onchange = function () { st.tier = this.value; apply(); }; $('cemMeals').onchange = function () { st.meals = this.value; apply(); };
    $('cemStage').onchange = function () { st.stage = this.value; apply(); }; $('cemDays').onchange = function () { st.days = this.value; apply(); }; $('cemDiff').onchange = function () { st.diff = this.value; apply(); }; $('cemRaisable').onchange = function () { st.raisable = this.checked; apply(); };
    function deep() { var d = (location.hash.match(/^#tomb-(\d+)$/) || [])[1] || new URLSearchParams(location.search).get('id'); if (!d || !all.some(function (p) { return String(p.id) === String(d); })) return false;
      inp.value = '#' + d; st.q = '#' + d; apply(true); var e = $('tomb-' + d); if (e) { e.scrollIntoView({ block: 'center' }); e.classList.add('flash'); } return true; }
    window.addEventListener('hashchange', deep);
    opts(); status(); zombies(); st.ready = true; if (!all.length) { tombs.innerHTML = '<p class="muted">No pets have died yet. Pets starve after 7 full days with no meal: feed yours on <a href="play.html">Play</a>.</p>'; } else if (!deep()) apply();
    window.__cemV2 = { src: 'chain', n: all.length, block: b - 1, on: on, pub: pub };
  }
  function artJs(cb) { if (window.V2CemArt) return; if (document.getElementById('cemArtJs')) return; var v = ver(), sc = document.createElement('script'); sc.id = 'cemArtJs'; sc.src = 'js/v2-cemetery-art.js' + (v ? '?' + v : ''); sc.onload = cb; document.head.appendChild(sc); }
  /* THE gravestone (option C, owner's pick Oct 29 2026): loaded once, then every finder card draws its stone */
  function stoneJs(cb) { if (window.V2Gravestone) return cb(); (S.gsQ = S.gsQ || []).push(cb); if (S.gsQ.length > 1) return; var v = ver(), sc = document.createElement('script'); sc.src = 'js/v2-gravestone.js' + (v ? '?' + v : '');
    sc.onload = function () { var q = S.gsQ; S.gsQ = []; q.forEach(function (f) { f(); }); }; sc.onerror = function () { S.gsQ = []; }; document.head.appendChild(sc); }
  function ver() { var me = document.querySelector('script[src*="v2-cemetery-scene.js"]'); return me ? (me.getAttribute('src').split('?')[1] || '') : ''; }
  function altarJs(cb) { if (window.V2CemeteryAltar) return cb(); (S.altQ = S.altQ || []).push(cb); if (S.altQ.length > 1) return; var v = ver();
    if (!document.getElementById('cemAltCss')) { var l = document.createElement('link'); l.rel = 'stylesheet'; l.id = 'cemAltCss'; l.href = 'css/cemetery-altar.css' + (v ? '?' + v : ''); document.head.appendChild(l); }
    var sc = document.createElement('script'); sc.src = 'js/v2-cemetery-altar.js' + (v ? '?' + v : ''); sc.onload = function () { var q = S.altQ; S.altQ = []; q.forEach(function (f) { f(); }); }; sc.onerror = function () { S.altQ = []; }; document.head.appendChild(sc); }
  function css() { if (document.getElementById('cemV2Css')) return; var me = document.querySelector('script[src*="v2-cemetery-scene.js"]'), v = me ? (me.getAttribute('src').split('?')[1] || '') : '', l = document.createElement('link');
    l.rel = 'stylesheet'; l.id = 'cemV2Css'; l.href = 'css/cemetery-v2.css' + (v ? '?' + v : ''); document.head.appendChild(l); }
  window.V2CemeteryScene = { mount: mount, hooks: hooks, flare: flare, page: page, ALTAR: ALTAR, SEANCE: SEANCE, _state: function () { return S; }, _select: function (k) { S.sel = k; card(k); kick(); } };
})();
