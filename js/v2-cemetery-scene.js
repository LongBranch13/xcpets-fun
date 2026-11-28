/* XCPETS Pet Cemetery v2 (scene Oct 28 2026; cemetery loop Oct 29 2026). The scene is display only.
 * 1) THE SCENE: an 8-bit perspective graveyard. Thousands of generic headstones (not tied to any pet) recede in rows toward one vanishing
 *    point and fade into fog under a full moon. Same build as the other place scenes: one 320x180 pixel canvas scaled by V2Sharp, a hint bar,
 *    tap Mort for a small card, RAF paused off screen and while the tab is hidden, prefers-reduced-motion = one still frame.
 *    Speed: the whole stone field is drawn ONCE into an offscreen 320x180 layer (a few ms); each frame only blits it and moves sky, fog and Mort.
 * 2) THE LIST: counts plus one page of graves (24 on a phone, 60 on a desktop) from the paged index (GET /xp/v1/graves) or, if that
 *    index is not published yet, from compact rows of pets already in memory (js/v2-grave-index.js). The page does not call V.cemGraves
 *    for the whole world. Opening a grave, or Raise at the altar, loads that one pet (V.cemView).
 *    Sorts: newest death, oldest (hatch block), rarest tier, most powerful (Vigor+Spark+Grit+Zoom+Luck, the Ranking sum), most gear, longest lived.
 *    Filters: species, tier, meals. Find a grave (#, name, species, owner), My graves, #tomb-ID / ?id= deep links, paging for thousands of graves.
 * 3) THE ALTAR (Oct 28 2026 evening; live behind the cemetery gate Oct 29): a stone altar with candles on the grass beside the path. Tap it for a card; every grave in the list has
 *    "Raise at the altar", which loads js/v2-cemetery-altar.js (+ css/cemetery-altar.css, same ?v=) on demand and opens the mock seance panel.
 *    hooks('lit') turns the candles green while the panel is open; flare() makes them jump when an offering lands. Still no rule and no burn. */
(function () {
  'use strict';
  /* living-rest-1107: pages other than play.html never called V2Split.rest(), so the first paint
   * only had owner page 0 (24 living pets). This waits for the same 5,000-pet background load
   * play.html uses, then fetches Discard-pile ids that are still missing. It does not call loadBoard. */
  (function () {
    if (window.xcpLivingFill) return;
    function world() { try { return window.V2Mock && V2Mock.world && V2Mock.world(); } catch (e) { return null; } }
    function restDone(w) {
      if (!w) return false;
      if (w._full) return true;
      var pg = w._pages;
      if (!pg || !(pg.pages > 1)) return true;
      var cap = (window.V2Split && V2Split.AUTO_CAP) || 5000;
      var screen = (window.V2Split && V2Split.SCREEN_PAGES) || 7;
      var got = pg.got || 1;
      if ((pg.n || 0) > 0 && (pg.n || 0) <= cap) return got >= (pg.pages || 1);
      return got >= Math.min(screen, pg.pages || 1);
    }
    function discIds(me) { return V2Own.pileOrder(me); } /* this browser's Discard pile, in its order (V2Own: the one reader of that list) */
    function discardMiss(me) {
      var w = world(), by = (w && w.byId) || {}, ids = discIds(me), miss = [], i;
      for (i = 0; i < ids.length; i++) if (!by[ids[i]]) miss.push(ids[i]);
      return miss;
    }
    function ensureIds(ids) {
      if (!ids.length || !window.V2Split || !V2Split.ensurePet) return Promise.resolve(world());
      var i = 0, n = 0;
      return new Promise(function (res) {
        function pump() {
          if (i >= ids.length && !n) return res(world());
          while (n < 4 && i < ids.length) {
            n++;
            V2Split.ensurePet(ids[i++]).then(function () { n--; pump(); }, function () { n--; pump(); });
          }
        }
        pump();
      });
    }
    var job = null, fillJob = null;
    function livingRest() {
      if (job) return job;
      if (window.V2Split && V2Split.rest) { try { V2Split.rest(); } catch (e) {} }
      job = new Promise(function (res) {
        var last = '', moved = false, still = 0, n = 0, t0 = Date.now();
        function finish(w) { job = null; res(w); }
        function tick() {
          var w = world();
          if (restDone(w)) return finish(w);
          var pg = w && w._pages;
          var sig = (pg ? (pg.got || 1) : 0) + ':' + ((w && w.pets && w.pets.length) || 0) + ':' + (w && w._full ? 1 : 0);
          if (sig !== last) { if (last) moved = true; last = sig; still = 0; } else still++;
          n++;
          if (!moved && Date.now() - t0 > 3000) return finish(w); /* Nov 27 2026: was 1.5 s; on a slow phone the next owner page often takes longer, and the Feed / altar / gift lists then opened with only the first pages of a big wallet */
          if (moved && still >= 60) return finish(w);
          if (n > 240) return finish(w);
          setTimeout(tick, 250);
        }
        tick();
      });
      return job;
    }
    function livingFill(me) {
      var key = me || '';
      if (fillJob && fillJob.key === key) return fillJob.p;
      var p = livingRest().then(function () {
        var miss = discardMiss(me);
        if (!miss.length) return world();
        return ensureIds(miss);
      });
      fillJob = { key: key, p: p };
      var clear = function () { if (fillJob && fillJob.p === p) fillJob = null; };
      p.then(clear, clear);
      return p;
    }
    window.xcpRestDone = restDone;
    window.xcpDiscardMiss = discardMiss;
    window.xcpLivingRest = livingRest;
    window.xcpLivingFill = livingFill;
  })();
  /* /living-rest-1107 */
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
  /* cem-raise-easy (Nov 24 2026): the REST sign hangs over the right gate post (it sat on the fence rails and looked cut off at the edge) */
  function board(x) { var bx = 282, by = 98; px(x, '#3e2a18', bx + 11, by + 12, 2, 7); px(x, '#000', bx - 1, by - 1, 26, 15); px(x, '#6b4a2a', bx, by, 24, 13); x.font = '4px "Press Start 2P", monospace'; x.textAlign = 'center'; x.fillStyle = '#f3e2b8';
    x.fillText(S.total > 999 ? Math.round(S.total / 100) / 10 + 'K' : String(S.total), bx + 12, by + 6); x.fillText('REST', bx + 12, by + 11); x.textAlign = 'left'; }
  /* tap tags: a small pixel label that bobs under the altar and the candle circle, so both read as things to press */
  function tag(x, s, cx, y, t, hv, col) { x.font = '4px "Press Start 2P", monospace'; var w = Math.ceil(x.measureText(s).width) + 6, a = Math.round(cx - w / 2), b = y + (reduced() || hv ? 0 : Math.round(Math.sin(t / 380)));
    px(x, '#000', a - 1, b - 1, w + 2, 9); px(x, hv ? '#ffc93c' : col, a, b, w, 7); px(x, '#000', Math.round(cx) - 1, b - 3, 3, 2); px(x, hv ? '#ffc93c' : col, Math.round(cx), b - 2, 1, 2);
    x.fillStyle = '#140f24'; x.textAlign = 'center'; x.fillText(s, Math.round(cx), b + 5.5); x.textAlign = 'left'; }
  function outline(x, a, b, w, h) { x.strokeStyle = '#ffc93c'; x.lineWidth = 1; x.strokeRect(a + 0.5, b + 0.5, w - 1, h - 1); }
  function mort(x, t) { var m = MORT, sw = reduced() ? 0 : Math.round(Math.sin(t / 500)), hv = S.hov === 'mort' || S.sel === 'mort';
    px(x, '#000', m.x - 5, m.y - 26, 12, 27); px(x, '#3a3046', m.x - 4, m.y - 16, 10, 15); px(x, '#c9a27a', m.x - 3, m.y - 23, 8, 7); px(x, '#000', m.x - 1, m.y - 20, 1, 1); px(x, '#000', m.x + 3, m.y - 20, 1, 1); px(x, '#8c8c96', m.x - 3, m.y - 17, 8, 2);
    px(x, '#1c1824', m.x - 5, m.y - 26, 12, 3); px(x, '#1c1824', m.x - 3, m.y - 29, 8, 3); px(x, '#2a2232', m.x - 4, m.y - 1, 4, 2); px(x, '#2a2232', m.x + 2, m.y - 1, 4, 2);
    var lx = m.x + 9, ly = m.y - 12 + sw; px(x, '#000', lx - 1, ly - 1, 6, 8); px(x, '#ffd166', lx, ly + 1, 4, 5); px(x, '#fff3b0', lx + 1, ly + 2, 2, 2); x.save(); x.globalAlpha = 0.1; px(x, '#ffd166', lx - 4, ly - 4, 12, 14); x.restore();
    if (hv) outline(x, m.x - 7, m.y - 31, 22, 33); S.hits.push({ x: m.x - 7, y: m.y - 31, w: 22, h: 33, k: 'mort' }); }
  function bubble(x, s, bx, by) { x.font = '5px "Press Start 2P", monospace'; var w = Math.ceil(x.measureText(s).width) + 8; bx = Math.max(2, Math.min(W - w - 2, bx)); px(x, '#000', bx + 1, by + 1, w, 11); px(x, '#fff8e1', bx, by, w, 11); px(x, '#fff8e1', bx + 4, by + 11, 3, 3); x.fillStyle = '#1b1b1b'; x.fillText(s, bx + 4, by + 8); return { x: bx, y: by, w: w + 1, h: 14 }; }
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
    if (hv) outline(x, C.cx - C.r - 11, C.cy - 22, C.r * 2 + 22, 35); tag(x, 'MY ZOMBIES', C.cx, C.cy + 13, t + 600, hv, '#c9ffb0'); S.hits.push({ x: C.cx - C.r - 11, y: C.cy - 22, w: C.r * 2 + 22, h: 44, k: 'seance' }); }
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
    if (hv) outline(x, a.x - 3, a.y - 9, a.w + 6, a.h + 10); tag(x, 'RAISE', a.x + a.w / 2, a.y + 34, t, hv, '#fff3b0'); S.hits.push({ x: a.x - 3, y: a.y - 9, w: a.w + 6, h: a.h + 10, k: 'altar' }); }
  function draw(t) { var x = S.x; if (!x) return; if (window.V2Sharp) V2Sharp.begin(x, S.k); else x.imageSmoothingEnabled = false; S.hits = [];
    if (!S.sky) S.sky = buildSky(); if (!S.layer) S.layer = buildLayer();
    sky(x, t); x.drawImage(S.layer, 0, HZ, W, H - HZ, 0, HZ, W, H - HZ); fog(x, t); wisps(x, t); gate(x); board(x); seance(x, t); altar(x, t); mort(x, t);
    if (!reduced() && t - S.lt > 12000) { S.lt = t; S.line = (S.line + 1) % LINES.length; } var top = []; if (S.say || (!reduced() && t - S.lt < 4000)) top.push(bubble(x, S.say || LINES[S.line], MORT.x - 6, MORT.y - 64));
    if (window.V2Sharp && V2Sharp.top) V2Sharp.top(S.c, W, top); /* scene-top: Mort's words stay above the Doom Week / Halloween decoration layers */
    if (!reduced() && !S.off && !S.hid) S.raf = requestAnimationFrame(draw); else S.raf = 0; }
  function kick() { if (S.x && !S.raf) draw(performance.now()); }
  function card(k) { var el = document.getElementById('cemCard'); if (!el) return; if (!k) { el.hidden = true; return; } el.hidden = false;
    if (k === 'mort') el.innerHTML = '<b class="cc-h">🏮 Mort, the caretaker</b><p class="small">Keeps the grass short and the gate shut. A pet ends up here after 7 days with no meal. Mythic pets never starve. Every grave is in the list below. Feed yours on <a href="play.html">Play</a>.</p>';
    if (k === 'seance') el.innerHTML = '<b class="cc-h">🕯️ The candle circle</b><p class="small">Your zombies gather here. Keep them fed, collect halo points, and bring them back as Gods.</p>';
    if (k === 'altar') { var on = !!S.cemOn; el.innerHTML = '<b class="cc-h">🕯️ The altar</b><p class="small">Pick a grave below and press <b>Raise it</b>. Sacrifice pets from your Discard pile (and spare gear) to bring it back as your zombie: more and rarer sacrifices, more power, up to 3 times what it had when it died.' + (on ? '' : ' Raising opens when the cemetery loop goes live; until then the finder is read-only.') + '</p>' + (on ? '<button type="button" class="btn" id="cemAltGo">🕯️ Open the altar for the first grave you can raise</button>' : ''); var go = document.getElementById('cemAltGo'); if (go) go.onclick = function () { if (S.openAltar) S.openAltar(); }; } }
  function at(c, e) { var r = c.getBoundingClientRect(), mx = (e.clientX - r.left) * W / r.width, my = (e.clientY - r.top) * H / r.height, hs = S.hits.filter(function (q) { return mx >= q.x && mx < q.x + q.w && my >= q.y && my < q.y + q.h; }); return hs.length ? hs[hs.length - 1] : null; }
  /** mount(w, dead): draws the scene into #cemScene; dead = the page's dead list (only its length is used: the stones are generic). */
  function mount(w, dead) { var box = document.getElementById('cemScene'); if (!box) return; S.total = dead ? dead.length : 0; S.sel = null;
    var c = box.querySelector('canvas'); if (!c) { box.innerHTML = '<canvas width="' + W + '" height="' + H + '" role="img" aria-label="The XCPETS Pet Cemetery at night: endless rows of gravestones fading into fog under a full moon, a stone altar with candles on the grass beside the path, a seance circle of six candles in a rune ring, Mort the caretaker at the gate"></canvas><div class="cem-hint small">🕯️ Tap the altar to raise a pet · 🧟 tap the candles for your zombies · 🏮 tap Mort for how it works</div>';
      c = box.querySelector('canvas');
      if (window.IntersectionObserver) new IntersectionObserver(function (es) { var off = !es[0].isIntersecting; if (off === S.off) return; S.off = off; if (!off) kick(); else { cancelAnimationFrame(S.raf); S.raf = 0; } }, { threshold: 0 }).observe(c);
      document.addEventListener('visibilitychange', function () { S.hid = document.hidden; if (S.hid) { cancelAnimationFrame(S.raf); S.raf = 0; } else kick(); });
      if (RM.addEventListener) RM.addEventListener('change', function () { cancelAnimationFrame(S.raf); S.raf = 0; kick(); });
      c.addEventListener('mousemove', function (e) { var h = at(c, e), v = h ? h.k : null; if (v !== S.hov) { S.hov = v; c.style.cursor = v ? 'pointer' : ''; if (reduced()) draw(performance.now()); } });
      c.addEventListener('mouseleave', function () { S.hov = null; if (reduced()) draw(performance.now()); });
      c.addEventListener('click', function (e) { var h = at(c, e), v = h ? h.k : null; S.sel = v; S.say = v === 'mort' ? LINES[(S.line = (S.line + 1) % LINES.length)] : null; if (v === 'altar') S.flT = performance.now(); card(v); draw(performance.now());
        /* cem-raise-easy (Nov 24 2026, Jake: tapping the altar or the circle of candles "does nothing"): the altar opens Raise and scrolls to the graves,
         * the candle circle opens My zombies (Gods when you have none), Mort opens "How the Cemetery works". */
        if (v && S.act && S.act[v]) S.act[v](); }); }
    S.c = c; S.x = c.getContext('2d'); if (window.V2Sharp) { S.k = V2Sharp.fit(c, W, H); if (!S.rs) { S.rs = 1; V2Sharp.watch(function () { if (!S.c) return; var k0 = S.k; S.k = V2Sharp.fit(S.c, W, H); if (S.k !== k0) { cancelAnimationFrame(S.raf); S.raf = 0; kick(); } }); } }
    cancelAnimationFrame(S.raf); S.raf = 0; draw(performance.now()); }
  function hooks(state) { S.hook = state === 'lit' ? 'lit' : 'off'; kick(); }
  function flare() { S.flT = performance.now(); kick(); }

  /* ------------------------------------------------------------------ the list ------------------------------------------------------------------ */
  var TL = ['Common', 'Uncommon', 'Rare', 'Legendary'], TID = ['common', 'uncommon', 'rare', 'legendary'];
  /* grave finder: sort and filter run on the compact index (one page painted). Opening a grave loads V.cemView for that pet.
   * cemetery-rarity-1103: each sort does what its label says. Rarity score is filled in when that grave is opened.
   * "⚡ Most powerful" (was "Most power at death") is the power sort. */
  var SORTS = [['rarest', '💎 Rarest first'], ['newest', 'Newest graves'], ['oldest', 'Longest dead'], ['easiest', 'Easiest to raise'], ['strongest', '⚡ Most powerful'], ['gear', 'Most gear'], ['lived', 'Longest lived'], ['id', 'Pet number']];
  /* rarity rank, same tier logic as the hatch review (js/pet-sort.js, hatch-review-tiers-1103): Mythic (a stage, shown above every tier), then
   * Legendary, Rare, Uncommon, Common (the hatch tier, art.tierIndex). The game has no Epic tier. Inside a rank: 💎 Rarity score, then power. */
  var RK_LABEL = { 4: 'Mythic', 3: 'Legendary', 2: 'Rare', 1: 'Uncommon', 0: 'Common' }, RK_ID = { 4: 'mythic', 3: 'legendary', 2: 'rare', 1: 'uncommon', 0: 'common' };
  function hatchTier(wp, g) { var t = wp && wp.art && wp.art.tierIndex != null ? wp.art.tierIndex : g.tier; return Math.max(0, Math.min(3, t | 0)); }
  function rankOf(wp, g) { return g.mythic || (wp && (wp.stage >= 5 || wp.mythicCare)) ? 4 : hatchTier(wp, g); }
  function rarMap(w) { var m = {}; try { if (window.PetScore && PetScore.rarityAll) PetScore.rarityAll(w).forEach(function (r) { if (isFinite(r.bits)) m[r.id] = r; }); } catch (e) { } return m; }
  function rarChip(p) { return '<div class="cv2-rar"><span class="chip cv2-rk rk-' + RK_ID[p.rank] + '" title="Rarity: ' + RK_LABEL[p.rank] + (p.rank === 4 ? ' (Mythic stage, above every hatch tier)' : ' hatch tier') + '">' + (p.rank === 4 ? '💜 ' : '') + RK_LABEL[p.rank] + '</span>' +
    (p.rbits >= 0 ? ' <span class="chip cv2-rbits" title="Trait rarity: how unusual this pet\'s species, eyes, pattern, background, cheeks, mutation and throwback trait are across every pet">💎 Rarity ' + p.rbits.toFixed(1) + (p.oneIn ? ' · 1 in ' + p.oneIn : '') + '</span>' : '') + '</div>'; }
  var SORTF = {
    rarest: function (a, c) { return c.rank - a.rank || c.rbits - a.rbits || c.power - a.power || a.id - c.id; },
    newest: function (a, c) { return c.died - a.died || a.id - c.id; },
    oldest: function (a, c) { return a.died - c.died || a.id - c.id; },
    easiest: function (a, c) { return (c.raisable - a.raisable) || a.need - c.need || c.af - a.af || a.id - c.id; },
    strongest: function (a, c) { return c.power - a.power || a.id - c.id; },
    gear: function (a, c) { return c.gear - a.gear || c.power - a.power || a.id - c.id; },
    lived: function (a, c) { return life(c) - life(a) || a.id - c.id; },
    id: function (a, c) { return a.id - c.id; } };
  var LOC = SORTF; /* cemetery-rarity-1103: these eight sorts stay in the page. The paged index uses the same order. */
  var DAYS = [['', 'Any time'], ['0-1', '0 to 1 days'], ['2-7', '2 to 7 days'], ['8-30', '8 to 30 days'], ['31-', 'Over 30 days']];
  var DIFF = { easy: 'Easy', medium: 'Medium', hard: 'Hard', closed: 'Closed' };
  var STATE = { resting: 'Resting: only its owner can raise it for 3 days', hunted: 'Hunted: laid to rest for good', dust: 'Turned to dust', halo: 'Resurrected: rests with its halo' };
  function tm(n) { return window.V2CemGuide ? V2CemGuide.time(n) : n + ' blocks'; } /* cem-guide: blocks as plain time (1 block is about 10 minutes) */
  function life(p) { return p.born != null && p.died != null ? p.died - p.born : -1; }
  function art(n, s, l) { return window.V2CemArt ? V2CemArt.img(n, s, l) : ''; }
  /* cem-zcard (Nov 22 2026): one look per state and one main button. State: FED (green), HUNGRY (feral within a day, gold), FERAL (red),
   * CURED (Mythic-fed, violet). Two bars: food (time left before it goes feral, then before it crumbles) and halo points toward a Resurrection.
   * Your zombie: the main button is Feed when it is feral or hungry, Resurrect when it has the points, else Add halo points; the others sit
   * beside it as small buttons. Someone else's: Hunt only when it is FERAL (cemHuntWhy), else when it can be hunted. Same burns as before. */
  function zstate(v) { return v.mfed ? ['cured', 'CURED'] : v.feral ? ['feral', 'FERAL'] : v.hungerLeft <= 144 ? ['hungry', 'HUNGRY'] : ['fed', 'FED']; }
  function zcardHtml(o, p) { var w = o.w, b = o.b, V = o.V, R = o.R, ME = o.ME, on = o.on, fmt = o.fmt, sa = o.sa, CE = V.CEM || {};
    var v = V.cemView(w, p, b), mine = ME && p.owner === ME, res = v.res || { points: 0, chance: 0 }, PTS = CE.POINTS || [1, 3, 10, 33], st0 = zstate(v), min = res.min || CE.RES_MIN || 25, per = V.cemRunsOn && V.cemRunsOn(b) ? 'pet' : 'burn';
    var FER = CE.FERAL || 432, CRU = CE.CRUMBLE || 432, food = v.mfed ? 100 : v.feral ? Math.round(100 * Math.max(0, v.crumbleIn) / CRU) : Math.round(100 * Math.max(0, v.hungerLeft) / FER);
    var foodTxt = v.mfed ? 'Never hungry' : v.feral ? 'Starving · dust (gone forever) in ' + tm(v.crumbleIn) : 'Feral in ' + tm(v.hungerLeft);
    var pts = res.points + (res.bonus || 0), ready = res.points >= min, haloPct = Math.min(100, Math.round(100 * res.points / min));
    var feed = function (main) { return '<button type="button" class="btn' + (main ? '' : ' ghost cv2-small') + '" data-zsac="zfeed" data-z="' + p.id + '" title="Sacrifice pets from your Discard pile to it, gone for good">🍖 Feed it' + (main ? ' <small>' + fmt(V.cemCost(w, 'zmeal', b)) + '</small>' : '') + '</button>'; };
    var halo = function (main) { return '<button type="button" class="btn' + (main ? '' : ' ghost cv2-small') + '" data-zsac="rpl" data-z="' + p.id + '" title="Sacrifice pets: Common ' + PTS[0] + ', Uncommon ' + PTS[1] + ', Rare ' + PTS[2] + ', Legendary ' + PTS[3] + ' halo points (gear: on its card in My Pets)">' + art('halo', 12) + ' Add halo points' + (main ? ' <small>' + fmt(V.cemCost(w, 'rpl', b)) + '</small>' : '') + '</button>'; };
    var resB = function (main) { return '<button type="button" class="btn' + (main ? ' cv2-gold' : ' ghost cv2-small') + '" data-res="' + p.id + '"' + (ready ? '' : ' disabled title="Needs ' + min + ' halo points"') + '>😇 Resurrect · ' + Math.round(res.chance * 100) + '%' + (main ? ' <small>' + fmt(V.cemCost(w, 'resurrect', b)) + '</small>' : '') + '</button>'; };
    var acts = '', why = '';
    if (on && mine) {
      if (v.feral || (!v.mfed && v.hungerLeft <= 144)) { acts = feed(true) + halo(false) + (ready ? resB(false) : ''); why = v.feral ? '<b>Anyone can hunt it now.</b> If their pet wins, the zombie becomes theirs. Feed it to make it safe.' : 'Feed it within ' + tm(v.hungerLeft) + ' or it goes feral and can be hunted.'; }
      else if (ready) { acts = resB(true) + halo(false) + (v.mfed ? '' : feed(false));
        /* honest-mg-copy + mg-odds-ceiling: on a violet (Mythic) grave the roll is one try and the odds stop at the rules' ceiling. */
        var cl = p.mgDead && window.V2MgRoad ? V2MgRoad.capLine(w, p, b) : '';
        why = '<b>' + Math.round(res.chance * 100) + '% chance.</b> Win: it lives again as a God, for good. Miss: it turns to dust. ' + (cl || 'More halo points, better odds.') + (p.mgDead && window.V2MgRoad ? '<br>⚠️ ' + V2MgRoad.riskLine(p) : ''); }
      else { acts = halo(true) + (v.mfed ? '' : feed(false)); why = (min - res.points) + ' more halo point' + (min - res.points === 1 ? '' : 's') + ' to try a Resurrection: a Rare gives ' + PTS[2] + ', a Legendary ' + PTS[3] + '.'; } }
    /* cem-unleash: the Mythic God path on the card. The burn itself stays on the zombie's My Pets card, which holds the live-tip safety checks. */
    if (on && mine && V.mgView && !v.mfed) { var mv = null; try { mv = V.mgView(w, p, b); } catch (e) { mv = null; }
      if (mv && mv.unleash) why += '<br>💜 <b>Unleashed:</b> it eats one of your Mythics in ' + tm(mv.unleash.left) + '.';
      /* mg-fast-world: without w.cem.mg this page cannot see a pending unleash or the 30-day wallet gap, so it must not
       * offer the burn (the rules would reject it and the XCPETS would be spent for nothing). */
      else if (mv && v.feral && (!mv.unleashWhy || (/no Mythic it could eat/.test(mv.unleashWhy) && V.mgSafeOn && V.mgSafeOn(b) && w.pets.some(function (q) { return q.owner === ME && q.mgSafe === ME && V.mgEdibleWhy(w, q, ME, b) === 'kept safe by you'; }))) && !(window.V2MgRoad && !V2MgRoad.mgReady(w))) { acts += '<a class="btn ghost cv2-small cv2-violet" href="play.html#act-unleash-' + p.id + '" title="It eats one of your Mythics held 30 days, is cured for good, and the Mythic leaves a violet grave you can raise into a Mythic God. ' + (V.mgSafeOn && V.mgSafeOn(b) ? 'Tick 🛡️ Safe on the Mythics you want to keep.' : 'Once every 30 days.') + ' Opens the Unleash check on Play.">💜 Unleash on a Mythic</a>'; } }
    else if (on && !mine) {
      if (ME && v.feral && !v.mfed) { acts = '<button type="button" class="btn cv2-red" data-hunt="' + p.id + '">⚔️ Hunt it <small>' + fmt(V.cemCost(w, 'hunt', b)) + '</small></button>'; why = '<b>Feral:</b> win the fight and this zombie is yours.'; }
      else why = v.mfed ? 'Cured by a Mythic meal: it can never be hunted.' : v.feral ? 'Feral: connect a wallet to hunt it.' : 'Fed, so it can’t be hunted. It goes feral in ' + tm(v.hungerLeft) + ' unless its owner feeds it.'; }
    return '<div class="tomb ztomb zs-' + st0[0] + (v.feral ? ' feral' : '') + '" id="zombie-' + p.id + '"><canvas width="32" height="32" data-z="' + p.id + '" role="img" aria-label="zombie #' + p.id + '"></canvas>' +
      '<h4><a href="pet.html?id=' + p.id + '">' + esc(p.name || '#' + p.id) + '</a> <span class="muted">#' + p.id + '</span></h4>' +
      '<div class="cv2-zrow"><span class="cv2-state s-' + st0[0] + '">' + st0[1] + '</span> <span class="cv2-lvl">' + esc(String(v.milestone || '').toUpperCase()) + ' · ⚡ ' + fmt(v.power) + '</span></div>' +
      '<div class="small muted" title="Power compared with when it died; it can grow to ' + v.cap + ' times">' + v.times.toFixed(2) + '× its death power (max ' + v.cap + '×)</div>' +
      (R.eraChip ? R.eraChip(w, p) : '') +
      '<div class="cv2-bar cv2-food' + (v.feral ? ' bad' : st0[0] === 'hungry' ? ' warn' : '') + '" role="img" aria-label="' + esc(foodTxt) + '" title="' + esc(foodTxt) + (v.mfed ? '' : ' (' + fmt(v.feral ? v.crumbleIn : v.hungerLeft) + ' blocks)') + '"><i style="width:' + food + '%"></i><em>' + esc(foodTxt) + '</em></div>' +
      (v.mfed && !res.min ? '' : '<div class="cv2-bar cv2-halobar" role="img" aria-label="Halo points ' + res.points + ' of ' + min + '"><i style="width:' + haloPct + '%"></i><em>Halo ' + res.points + (res.bonus ? ' + ' + res.bonus : '') + ' / ' + min + (ready ? ' · ready' : '') + '</em></div>') +
      (why ? '<p class="small cv2-why">' + why + '</p>' : '') + (acts ? '<div class="cv2-zact">' + acts + '</div>' : '') +
      '<div class="small muted cv2-zown">owner ' + esc(sa(p.owner)) + (mine ? ' (you)' : '') + (v.by && v.by !== p.owner ? ' · raised by ' + esc(sa(v.by)) : '') + (v.meals ? ' · ' + v.meals + ' meal' + (v.meals === 1 ? '' : 's') : '') + '</div></div>'; }
  /** page(ctx): the whole cemetery page body (called by js/v2-pages.js cemetery()). ctx = { w, M, R, V, ME, fmt, shortAddr } */
  function page(ctx) { if (window.xcpLivingRest) window.xcpLivingRest(); var w = ctx.w, M = ctx.M, R = ctx.R, V = ctx.V, ME = ctx.ME, fmt = ctx.fmt, sa = ctx.shortAddr, $ = function (id) { return document.getElementById(id); };
    var b = (w.tip || (M.state && M.state().tip) || 0) + 1, on = V.cemOn ? V.cemOn(b) : false, pub = on && V.cemPublic(b), CE = V.CEM || {}, gate = V.cemeteryGate ? V.cemeteryGate() : null;
    ctx.b = b; S.cemOn = on; css(); artJs(function () { if (st.ready) { zombies(); paint(); } });
    guideJs(function () { if (window.V2CemGuide) V2CemGuide.mount($('status'), V); if (st.ready) zombies(); }); /* cem-guide (Nov 22 2026): the cycle picture, plain times */
    var GI = window.V2GraveIndex, phone = window.matchMedia && matchMedia('(max-width: 640px)').matches, PER = GI ? GI.per() : (phone ? 24 : 60);
    var st = { q: '', mine: false, sort: 'strongest', sp: '', tier: '', stage: '', days: '', diff: 'easy', raisable: true, meals: '', open: false, page: 0, list: [], index: null, remote: '', matched: 0, source: '' }, tombs = $('tombs');
    mount(w, []);
    var zs = document.createElement('section'); zs.className = 'cv2-zombies'; zs.id = 'cemZombies'; tombs.parentNode.insertBefore(zs, tombs);
    var bar = document.createElement('div'); bar.className = 'uxp-find cemfind cemv2bar'; bar.id = 'cemFinder';
    var opt = function (L, cur) { return L.map(function (s) { return '<option value="' + s[0] + '"' + (s[0] === cur ? ' selected' : '') + '>' + s[1] + '</option>'; }).join(''); };
    /* cem-raise-easy (Nov 24 2026, Jake: "the ui is not great here when finding pets to raise from the dead as zombies"): the Raise door is now
     * three steps in pictures, then big shelf tabs (the same idea as the pet picker players liked): Best picks, Strongest, Rarest, Just died, Mine.
     * One search box. Sort, species, rarity and the rest are folded under "More filters". Same ids and handlers as before. Display only. */
    bar.innerHTML = '<h3 class="cv2-fh">🕯️ Raise a zombie</h3>' +
      '<ol class="cv2-how3" aria-label="How raising works"><li><b>1</b>' + (art('grave', 24) || '🪦') + '<span>Pick a grave<small>any player’s</small></span></li><li><b>2</b>' + (art('candle', 24) || '🕯️') + '<span>Sacrifice pets<small>from your Discard pile</small></span></li><li><b>3</b>' + (art('zombie', 24) || '🧟') + '<span>It rises<small>as YOUR zombie</small></span></li></ol>' +
      '<div class="cv2-shelves" role="group" aria-label="Which graves to show">' +
      '<button type="button" class="cv2-shelf" id="cemEasiest" aria-pressed="false">⭐ Best picks<small>easy + strong</small></button>' +
      '<button type="button" class="cv2-shelf" id="cemPower" aria-pressed="false">⚡ Strongest<small>most power</small></button>' +
      '<button type="button" class="cv2-shelf" id="cemRarest" aria-pressed="false">💎 Rarest<small>Mythic first</small></button>' +
      '<button type="button" class="cv2-shelf" id="cemFresh" aria-pressed="false">🪦 Just died<small>last 2 days</small></button>' +
      (ME ? '<button type="button" class="cv2-shelf" id="cemMine" aria-pressed="false">🫵 My graves<small>your dead pets</small></button>' : '') + '</div>' +
      '<div class="cv2-row cv2-search"><input id="cemFind" type="search" placeholder="🔎 Name, #number, species or owner" aria-label="Search graves" autocomplete="off"><button type="button" class="btn" id="cemGo">Find</button></div>' +
      '<details class="cv2-more"><summary>⚙️ More filters: sort, species, rarity, stage, days dead, difficulty, meals</summary>' +
      '<div class="cv2-row cv2-sel cv2-main" role="group" aria-label="Sort and filter graves"><label class="small">↕️ Sort <xc-select id="cemSort">' + opt(SORTS, st.sort) + '</xc-select></label>' +
      '<label class="small">🐾 Species <xc-select id="cemSp"><option value="">All species</option></xc-select></label>' +
      '<label class="small">💎 Rarity <xc-select id="cemTier"><option value="">All rarities</option>' + TL.map(function (t, i) { return '<option value="' + i + '">' + t + '</option>'; }).join('') + '</xc-select></label></div>' +
      '<div class="cv2-row cv2-sel">' +
      '<label class="small">Stage <xc-select id="cemStage"><option value="">All stages</option></xc-select></label>' +
      '<label class="small">Days dead <xc-select id="cemDays">' + opt(DAYS, '') + '</xc-select></label>' +
      '<label class="small">Difficulty <xc-select id="cemDiff"><option value="">Any</option><option value="easy">Easy (Common+ offering)</option><option value="medium">Medium (Uncommon+)</option><option value="hard">Hard (Rare+)</option><option value="closed">Closed graves</option></xc-select></label>' +
      '<label class="small">Meals <xc-select id="cemMeals"><option value="">All graves</option><option value="fed">Fed at least once</option><option value="nf">Never fed</option></xc-select></label>' +
      '<label class="small cv2-chk"><input type="checkbox" id="cemRaisable"> Raisable only</label></div>' +
      '<div class="cv2-row cv2-quick"><button type="button" class="q" id="cemOpen" aria-pressed="false">' + art('candle', 12) + ' Open altars only</button><button type="button" class="q" id="cemClear">↺ Back to best picks</button></div></details>' +
      '<p class="small muted" id="cemMsg" aria-live="polite"></p>';
    tombs.parentNode.insertBefore(bar, tombs);
    var pg = function (id) { var d = document.createElement('div'); d.className = 'cv2-pager'; d.id = id; return d; }, pTop = pg('cemPagerTop'), pBot = pg('cemPager'); tombs.parentNode.insertBefore(pTop, tombs); tombs.parentNode.insertBefore(pBot, tombs.nextSibling);
    function opts() { var n = {}, lab = {}, sg = {}, c0 = st.counts || { species: {}, stages: {} };
      Object.keys(c0.species || {}).forEach(function (k) { n[k] = c0.species[k]; lab[k] = k === '__hyb' ? 'Hybrids' : (V.speciesLabel ? V.speciesLabel(k) : k); });
      Object.keys(c0.stages || {}).forEach(function (k) { sg[k] = (V.STAGE_NAMES && V.STAGE_NAMES[k]) || ('Stage ' + k); });
      var s = $('cemSp'), cur = s.value; s.innerHTML = '<option value="">All species</option>' + Object.keys(n).sort(function (a, c) { return a === '__hyb' ? 1 : c === '__hyb' ? -1 : String(lab[a]).localeCompare(lab[c]); }).map(function (k) { return '<option value="' + esc(k) + '">' + esc(lab[k]) + ' (' + fmt(n[k]) + ')</option>'; }).join(''); s.value = cur; if (s.value !== cur) s.value = '';
      var t = $('cemStage'), c2 = t.value; t.innerHTML = '<option value="">All stages</option>' + Object.keys(sg).sort(function (a, c) { return a - c; }).map(function (k) { return '<option value="' + k + '">' + esc(sg[k]) + '</option>'; }).join(''); t.value = c2; if (t.value !== c2) t.value = ''; }
    function gateLine() { return on ? (pub ? '' : ' 🧪 Owner test: until launch only grave #' + CE.OWNER_GRAVE + ' can be raised, by the owner wallet.') : ' 🕯️ Raising the dead opens at block ' + (gate == null ? '(set at launch)' : fmt(gate)) + '; until then the finder is read-only.'; }
    function graveCount() { return st.total || (st.index ? st.index.length : 0); }
    function status() { $('status').textContent = fmt(graveCount()) + ' grave' + (graveCount() === 1 ? '' : 's') + ' from every player. Any of them can be raised as your zombie.' + gateLine() + (V.retireDeadBanner ? ' ' + V.retireDeadBanner() : ''); }
    function canRaise(p) { if (!on || !p || !p.raisable) return false; var wp = w.byId && w.byId[p.id]; if (p.restOwner) return !!(ME === p.restOwner && wp && !V.cemGraveWhy(w, wp, ME, b)); if (!pub) return p.id === CE.OWNER_GRAVE && ME === CE.OWNER; if (wp && V.cemGraveWhy && V.cemGraveWhy(w, wp, ME, b)) return false; return true; }
    function headStart(wp) { return wp && V.mythicHeadStart ? V.mythicHeadStart(w, wp, b) : null; }
    function hsText(hs) { return 'Owner\'s head start: only the last owner ' + esc(sa(hs.owner)) + (ME && ME === hs.owner ? ' (you)' : '') + ' can raise this Mythic for ' + tm(hs.left) + ' more.'; }
    function hsHtml(hs) { if (!hs) return ''; var mine = ME && ME === hs.owner; return '<div class="cv2-hs" role="status">' + hsText(hs) + (mine ? '' : ' <span class="cv2-hs-stop">A seance from another wallet does not count, so this page will not send one.</span>') + '</div>'; }
    function tomb(p) { var wp = w.byId && w.byId[p.id], gl = wp && R.graveCount && R.graveCount(w, wp) ? R.graveLine(w, wp) : '', lf = life(p), v = p.open && wp && V.cemView ? V.cemView(w, wp, b) : null, hs = headStart(wp);
      var badge = p.state ? '<span class="cv2-diff d-closed">' + art(p.state === 'halo' ? 'halo' : p.state, 12) + ' ' + STATE[p.state] + '</span>' : '<span class="cv2-diff d-' + p.diff + '" title="Needs at least 1 ' + esc(p.needLabel) + ' offering">' + art(p.diff, 12) + ' ' + DIFF[p.diff] + ' · needs ' + esc(p.needLabel) + '</span>';
      /* cem-raise-easy (Nov 24 2026): one look per card: the stone, the name, what it needs, its power, and one big Raise button.
       * Rarity score, owner, lived/hatched/died blocks and the burial line moved under "More about this grave". */
      var need = p.state ? badge : '<span class="cv2-need d-' + p.diff + '" title="Sacrifice at least 1 ' + esc(p.needLabel) + ' pet to start raising it">' + art(p.diff, 12) + ' Needs 1 <b>' + esc(p.needLabel) + '</b> sacrifice</span>';
      return '<div class="tomb gtomb' + (p.mythic ? ' tomb-mythic' : '') + (p.state ? ' tomb-' + p.state : '') + (p.open ? ' tomb-open' : '') + '" id="tomb-' + p.id + '"><canvas class="gstone" width="52" height="62" data-id="' + p.id + '" role="img" aria-label="gravestone of #' + p.id + (p.state ? ', ' + esc(STATE[p.state]) : '') + '"></canvas>' +
        '<h4><a href="pet.html?id=' + p.id + '">' + esc(p.name) + '</a> <span class="muted">#' + p.id + '</span></h4>' +
        '<div class="small">' + esc(p.spl) + ' · <span class="pill tier tier-' + (p.resurrected ? 'god' : TID[p.tier]) + '">' + (p.resurrected ? 'God' : p.rank === 4 ? 'Mythic' : TL[p.tier]) + '</span>' + (p.mythic ? ' · 💜 Mythic grave' : '') + '</div>' +
        '<div class="cv2-power">⚡ ' + fmt(p.power) + ' <small>power</small> · 💀 ' + fmt(p.days) + ' <small>day' + (p.days === 1 ? '' : 's') + ' dead</small></div>' +
        '<div class="small cv2-badges">' + need + '</div>' +
        (v && v.altar && !v.altar.seance ? '<div class="small cv2-pool">' + art('candle', 12) + ' Altar open · closes in ' + tm(v.altar.closesIn) + ' · top giver ' + esc(sa(v.altar.top || '')) + (v.altar.top === ME ? ' (you)' : '') + '</div>' : '') +
        hsHtml(hs) +
        (canRaise(p) ? '<button type="button" class="btn cv2-raise" data-raise="' + p.id + '">' + art('shovel', 12) + ' ' + (p.open ? 'Join the raising' : 'Raise it') + '</button>' : p.raisable && on && !pub ? '<div class="small muted cv2-lock">🧪 Owner test: ' + (p.id === CE.OWNER_GRAVE ? 'only the owner wallet can raise this grave' : 'only grave #' + CE.OWNER_GRAVE + ' can be raised for now') + '</div>' : '') +
        '<details class="cv2-tmore"><summary>More about this grave</summary>' + rarChip(p) + (wp && R.eraChip ? R.eraChip(w, wp) : '') +
        '<div class="small">reached ' + esc(p.stageName) + ' · 🎒 ' + fmt(p.gear) + ' gear' + (p.raisable && p.af < 1 ? ' · grave strength ' + Math.round(p.af * 100) + '%' : '') + (p.crumbles ? ' · crumbled ' + p.crumbles + ' time' + (p.crumbles === 1 ? '' : 's') : '') + '</div>' +
        '<div class="small muted tombowner" title="' + esc(p.owner) + '" style="overflow-wrap:anywhere">owner ' + esc(sa(p.owner)) + (ME && p.owner === ME ? ' (you)' : '') + ' · ⏳ ' + (lf >= 0 ? '~' + fmt(Math.floor(lf / 144)) + ' day' + (Math.floor(lf / 144) === 1 ? '' : 's') + ' lived' : '?') + '</div>' +
        (p.restUntil ? '<div class="small">Its owner can raise it again from block ' + fmt(p.restUntil) + ' · comes back at its death power</div>' : '') + '<div class="died">🥚 hatched ' + (p.born != null ? 'block ' + fmt(p.born) : '?') + '<br>🪦 died at block ' + fmt(p.died) + '</div>' + (gl ? '<div class="small buried">' + gl + '</div>' : '') + '</details></div>'; }
    /* risen zombies: hunger, feral, crumble countdown; Hunt (anyone, feral only), zombie feed / Resurrection (owner only) */
    function syncWorld() { var nw = ctx.M && ctx.M.world ? ctx.M.world() : null; if (nw) { w = nw; ctx.w = nw; } return w; }
    function myLiving() { return ME ? V2Own.living(w, ME, { zombies: false }) : []; }
    function huntWait() { syncWorld(); if (!(window.xcpLivingFill && window.xcpRestDone)) return false; return !xcpRestDone(w) || !!(window.xcpDiscardMiss && xcpDiscardMiss(ME).length); }
    function zcard(p) { return zcardHtml({ w: w, b: b, V: V, R: R, ME: ME, on: on, fmt: fmt, sa: sa }, p); } /* pet-page-zombies: the card is module level (zcardHtml) so pet.html shows the same one */
    /* cem-doors (Nov 22 2026, Jake: "all the workings there need to be more intuitive"): four doors, one job each. Raise = the grave finder,
     * My zombies = yours (most urgent first), Hunt = other players' FERAL zombies (the only ones a hunt can take), Gods = brought back.
     * A "Do this next" card above the doors names the one most urgent thing for the connected wallet. Display only: every button is the one
     * the zombie cards already had. The open door is kept for this tab (sessionStorage). */
    var DOORS = [['raise', '🕯️ Raise', 'pick a grave'], ['mine', '🧟 My zombies', ''], ['hunt', '⚔️ Hunt', ''], ['gods', '😇 Gods', 'brought back']];
    var door = (function () { try { return sessionStorage.getItem('xcpets-cem-door') || ''; } catch (e) { return ''; } })();
    var doorBar = document.createElement('div'); doorBar.className = 'cv2-doors'; doorBar.id = 'cemDoors'; doorBar.setAttribute('role', 'tablist'); doorBar.setAttribute('aria-label', 'What do you want to do?');
    var nextBox = document.createElement('div'); nextBox.className = 'cv2-next'; nextBox.id = 'cemNext'; nextBox.hidden = true;
    zs.parentNode.insertBefore(nextBox, zs); zs.parentNode.insertBefore(doorBar, zs);
    function setDoor(k, user) { door = k; if (user) { try { sessionStorage.setItem('xcpets-cem-door', k); } catch (e) {} }
      var raise = k === 'raise'; zombies(); }
    function into(el) { if (el && el.scrollIntoView) el.scrollIntoView({ block: 'start', behavior: reduced() ? 'auto' : 'smooth' }); }
    S.act = { altar: function () { setDoor('raise', true); into($('cemFinder')); },
      seance: function () { var mine = ME ? zAll().filter(function (p) { return p.owner === ME; }).length : 0; setDoor(mine ? 'mine' : 'gods', true); into(doorBar); },
      mort: function () { var h = $('cemHow'); if (h) { h.open = true; into(h); } } };
    doorBar.addEventListener('click', function (e) { var t = e.target.closest('[data-door]'); if (t) setDoor(t.getAttribute('data-door'), true); });
    function zAll() { return w.pets.filter(function (p) { return V.isZ(p); }); }
    /* Gods (Nov 24 2026, fastcheck): a fast page holds only some pets, so counting Gods from w.pets showed 0, 2 or 6 of 19. The server's summary
     * lists every living God (w._gods); a God the page has loaded (or one newer than the summary) comes from the page's own pets. */
    function gods() { var seen = {}, out = [];
      w.pets.forEach(function (p) { if (p.resurrected && !p.dead) { seen[p.id] = 1; out.push(p); } });
      (w._gods || []).forEach(function (g) { var p = w.byId && w.byId[g.id]; if (seen[g.id] || (p && (p.dead || !p.resurrected))) return; seen[g.id] = 1; out.push(p || { id: g.id, name: g.name, owner: g.owner, resurrected: { block: g.block } }); });
      return out.sort(function (a, c) { return c.resurrected.block - a.resurrected.block || a.id - c.id; }); }
    function urgent(Z) { var best = null; Z.forEach(function (p) { var v = V.cemView(w, p, b), r = v.res || {}, min = r.min || CE.RES_MIN || 25, u = null;
        if (v.mfed) u = r.points >= min ? { k: 'res', n: 3, p: p, v: v } : null;
        else if (v.feral) u = { k: 'feral', n: 0, p: p, v: v, t: v.crumbleIn };
        else if (v.hungerLeft <= 144) u = { k: 'hungry', n: 1, p: p, v: v, t: v.hungerLeft };
        else if (r.points >= min) u = { k: 'res', n: 2, p: p, v: v };
        if (u && (!best || u.n < best.n || (u.n === best.n && (u.t || 0) < (best.t || 0)))) best = u; }); return best; }
    function nextCard(mine) { if (!ME || !on) { nextBox.hidden = true; return; } var u = urgent(mine), feed = function (p) { return '<button type="button" class="btn" data-zsac="zfeed" data-z="' + p.id + '">🍖 Feed ' + esc(p.name || '#' + p.id) + '</button>'; }, h = '', img = '';
      if (u) { var nm = esc(u.p.name || '#' + u.p.id), r = u.v.res || {}; img = art(u.k === 'res' ? 'halo' : u.k === 'feral' ? 'feral' : 'zombie', 48);
        if (u.k === 'feral') h = '<p class="cv2-next-k">⚠ Do this next</p><b class="cv2-next-h">' + nm + ' is FERAL. Anyone can hunt it and take it from you.</b><p class="small">Feed it a Discarded pet and it is safe again. It turns back into a grave in ' + tm(u.v.crumbleIn) + '.</p><div class="cv2-next-acts">' + feed(u.p) + '</div>';
        else if (u.k === 'hungry') h = '<p class="cv2-next-k">⏳ Do this next</p><b class="cv2-next-h">' + nm + ' goes feral in ' + tm(u.v.hungerLeft) + '.</b><p class="small">Feed it a Discarded pet before then, or other players can hunt it.</p><div class="cv2-next-acts">' + feed(u.p) + '</div>';
        else h = '<p class="cv2-next-k">😇 Ready</p><b class="cv2-next-h">' + nm + ' has ' + r.points + ' halo points: it can try a Resurrection (' + Math.round((r.chance || 0) * 100) + '% chance).</b><p class="small">Win: it lives again as a God, for good. Miss: it turns to dust. More halo points, better odds.</p><div class="cv2-next-acts"><button type="button" class="btn" data-door="mine">🧟 Open My zombies</button></div>'; }
      else if (!mine.length) { img = art('candle', 48); h = '<p class="cv2-next-k">🕯️ Start here</p><b class="cv2-next-h">Raise your first zombie.</b><p class="small">Pick an easy grave, then sacrifice a pet from your Discard pile at the altar. The zombie is yours.</p><div class="cv2-next-acts"><button type="button" class="btn" id="cemNextEasy">🕯️ Show easy graves</button></div>'; }
      nextBox.hidden = !h; if (!h) { nextBox.innerHTML = ''; return; } nextBox.className = 'cv2-next' + (u && u.k === 'feral' ? ' bad' : u && u.k === 'hungry' ? ' warn' : '');
      nextBox.innerHTML = '<div class="cv2-next-ico">' + img + '</div><div class="cv2-next-t">' + h + '</div>';
      var ez = $('cemNextEasy'); if (ez) ez.onclick = function () { setDoor('raise', true); var q = $('cemEasiest'); if (q) q.click(); var f = $('cemFinder'); if (f) f.scrollIntoView({ block: 'start', behavior: 'smooth' }); }; }
    nextBox.addEventListener('click', function (e) { var t = e.target.closest('[data-door]'); if (t) setDoor(t.getAttribute('data-door'), true);
      var sc = e.target.closest('[data-zsac]'); if (sc) { var zid = +sc.getAttribute('data-z'); sacJs(function () { syncWorld(); if (window.V2CemSacrifice) V2CemSacrifice.open({ kind: 'zfeed', z: zid, w: w, V: V, R: R, ME: ME, b: b, send: function (L, title) { go(L, title); } }); }); } });
    function zombies() { var Z = zAll(), C = w.cem || {}, HB = C.huntedBy || {}, top = Object.keys(HB).sort(function (a, c) { return HB[c] - HB[a]; }).slice(0, 5);
      var vw = {}; Z.forEach(function (p) { vw[p.id] = V.cemView(w, p, b); });
      Z.sort(function (a, c) { var x = vw[a.id], y = vw[c.id]; return (y.feral - x.feral) || (x.crumbleIn - y.crumbleIn) || a.id - c.id; });
      var H = gods();
      var mine = ME ? Z.filter(function (p) { return p.owner === ME; }) : [], prey = Z.filter(function (p) { return p.owner !== ME && vw[p.id].feral && !vw[p.id].mfed; }), calm = Z.filter(function (p) { return p.owner !== ME && !(vw[p.id].feral && !vw[p.id].mfed); });
      var need = mine.filter(function (p) { return vw[p.id].feral || (!vw[p.id].mfed && vw[p.id].hungerLeft <= 144); }).length;
      if (!door) door = need ? 'mine' : 'raise';
      var sub = { raise: fmt(graveCount()) + ' graves', mine: ME ? (mine.length ? fmt(mine.length) + (need ? ' · ' + need + ' need' + (need === 1 ? 's' : '') + ' you' : '') : 'none yet') : 'connect a wallet', hunt: prey.length ? fmt(prey.length) + ' feral now' : 'none feral now', gods: fmt(H.length) + ' brought back' };
      doorBar.innerHTML = DOORS.map(function (d) { return '<button type="button" role="tab" class="cv2-door' + (d[0] === 'mine' && need ? ' alert' : '') + '" data-door="' + d[0] + '" aria-selected="' + (d[0] === door) + '">' + d[1] + '<small>' + esc(sub[d[0]] || d[2]) + '</small></button>'; }).join('');
      nextCard(mine);
      ['cemFinder', 'cemPagerTop', 'cemPager', 'tombs', 'cemDetail', 'cemResume'].forEach(function (id) { var el = $(id); if (el) el.classList.toggle('cv2-off', door !== 'raise'); }); zs.classList.toggle('cv2-off', door === 'raise'); /* a class, not [hidden]: .tombs and the finder set display */
      var rule = '<p class="small muted">A zombie needs a meal every ' + tm(CE.FERAL || 432) + '. Without one it goes FERAL: anyone can hunt it, and ' + tm(CE.CRUMBLE || 432) + ' later it crumbles back into a grave.</p>', list = [], html = '';
      if (door === 'mine') { list = mine; html = '<h3>🧟 My zombies <span class="small muted">(' + fmt(mine.length) + ')</span></h3>' + rule + (mine.length ? '<div class="tombs">' + mine.map(zcard).join('') + '</div>' : '<p class="cv2-empty">' + (ME ? 'No zombies yet. Open <button type="button" class="linkish" data-door="raise">🕯️ Raise</button>, pick a grave and sacrifice a pet from your Discard pile.' : 'Connect XCP Wallet to see your zombies.') + '</p>'); }
      else if (door === 'hunt') { list = prey.concat(calm); html = '<h3>⚔️ Hunt <span class="small muted">(' + fmt(prey.length) + ' feral)</span></h3><p class="small">Only a FERAL (starving) zombie can be hunted. Pick your fighter: win and the zombie is yours' + (V.huntRulesOn && V.huntRulesOn(b) ? '' : '') + ', plus a saved Pepe Wheel spin once a day. Lose and your pet gets a black eye.</p>' +
          (top.length ? '<p class="small cv2-hunters">' + art('hunter', 16) + ' <b>Zombie Hunters:</b> ' + top.map(function (a) { return esc(sa(a)) + (a === ME ? ' (you)' : '') + ' · ' + HB[a]; }).join(' · ') + '</p>' : '') +
          (prey.length ? '<div class="tombs">' + prey.map(zcard).join('') + '</div>' : '<p class="cv2-empty">No feral zombies right now. Check back: any zombie that misses its meal for ' + tm(CE.FERAL || 432) + ' turns feral.</p>') +
          (calm.length ? '<details class="cv2-calm" id="cemCalm"><summary>Other players’ zombies that are fed (' + fmt(calm.length) + '): can’t be hunted yet</summary><div class="tombs"></div></details>' : ''); list = prey; }
      else if (door === 'gods') { html = '<h3>' + art('halo', 16) + ' Gods: brought back <span class="small muted">(' + fmt(H.length) + ')</span></h3><p class="small muted">A zombie that wins its Resurrection lives again with a halo, for good (power ceiling ' + CE.CAP_RES + ' times). Gods only breed with other Gods. A miss turns the zombie to dust.</p>' +
          (H.length ? '<div class="cv2-halos">' + H.slice(0, 60).map(function (p) { return '<a class="cv2-halo" href="pet.html?id=' + p.id + '">' + art('halo', 12) + ' ' + esc(p.name || '#' + p.id) + ' <span class="muted">#' + p.id + ' · block ' + fmt(p.resurrected.block) + (ME && p.owner === ME ? ' · yours' : '') + '</span></a>'; }).join('') + '</div>' : '<p class="cv2-empty">No Gods yet. Be the first.</p>') +
          '<p><a class="btn ghost cem-pantheon" href="pantheon.html">🌕 The Pantheon: 21 seats for 21 Mythic Gods</a></p>'; }
      zs.innerHTML = html;
      /* hunt-fast (Nov 24 2026): the fed zombies other players own are drawn only when that fold is opened (each card is a full zombie check) */
      var cd = $('cemCalm'); if (cd) cd.addEventListener('toggle', function () { if (!cd.open || cd._done) return; cd._done = 1; var box = cd.querySelector('.tombs'); box.innerHTML = calm.map(zcard).join('');
        calm.forEach(function (p) { var c = box.querySelector('canvas[data-z="' + p.id + '"]'); if (c && p.art && R.lazy) R.lazy(c, function () { return R.framesWith(p.art, Math.max(5, p.stage), []); }, true); }); });
      list.forEach(function (p) { var c = zs.querySelector('canvas[data-z="' + p.id + '"]'); if (c && p.art && R.lazy) R.lazy(c, function () { return R.framesWith(p.art, Math.max(5, p.stage), []); }, true); }); }
    zs.addEventListener('click', function (e) { var t = e.target.closest('[data-door]'); if (t) setDoor(t.getAttribute('data-door'), true);
      var sc = e.target.closest('[data-zsac]'); if (sc) { var zid = +sc.getAttribute('data-z'), kind = sc.getAttribute('data-zsac'); sacJs(function () { syncWorld(); if (window.V2CemSacrifice) V2CemSacrifice.open({ kind: kind, z: zid, w: w, V: V, R: R, ME: ME, b: b, send: function (L, title) { go(L, title); } }); }); } });
    /* cemetery-handoff (Nov 1 2026): zombie meal / Resurrection pledge / Resurrection / hunt are signed right here (V2CemeteryAltar.sendPlans, same
     * send guard as play.html) instead of a redirect to play.html#cem-...; the old link stays only as a fallback if the altar file fails to load */
    function go(L, title) { var tags = L.map(function (p) { return p.tag; }); altarJs(function () { if (window.V2CemeteryAltar && V2CemeteryAltar.sendPlans) V2CemeteryAltar.sendPlans(title, L.map(function (p) { return V.cemPetAmount ? V.cemPetAmount(w, p, b) : p; }), ctx); else location.href = 'play.html#cem-' + encodeURIComponent(tags.join('~')); }); }
    zs.addEventListener('click', function (e) { var t = e.target.closest('[data-hunt],[data-zfeed],[data-rpl],[data-res]'); if (!t || t.disabled) return; var z;
      if ((z = t.getAttribute('data-hunt'))) { var pend = huntWait(); window.V2HuntPicker.open({ w: w, V: V, R: R, me: ME, zombie: +z, block: b, pets: myLiving(), pending: pend, send: go }); if (pend && window.xcpLivingFill) window.xcpLivingFill(ME).then(function () { syncWorld(); var d = document.getElementById('huntPicker'); if (d && d._fill) d._fill(myLiving(), w); }); }
      else if ((z = t.getAttribute('data-zfeed'))) { var f = +zs.querySelector('[data-fpick="' + z + '"]').value, zf = +z; sgGo(w, f, 'feed it to zombie #' + zf, function () { go([V.cemPlan(w, 'zfeed', zf, [f], b)], '🍖 Zombie meal for #' + zf); }); }
      else if ((z = t.getAttribute('data-rpl'))) { var r = +zs.querySelector('[data-rpick="' + z + '"]').value, zr = +z; sgGo(w, r, 'pledge it to the Resurrection of #' + zr, function () { go([V.cemPlan(w, 'rpl', zr, [r], b)], '😇 Resurrection offering for #' + zr); }); }
      else if ((z = t.getAttribute('data-res'))) go([V.cemPlan(w, 'resurrect', +z, null, b)], '😇 Resurrection of #' + z); });
    function pager(el, pages) { if (pages <= 1) { el.innerHTML = ''; return; } var bt = function (k, t, dis) { return '<button type="button" class="q" data-pg="' + k + '"' + (dis ? ' disabled' : '') + '>' + t + '</button>'; };
      el.innerHTML = bt('first', '⏮ First', !st.page) + bt('prev', '◀ Prev', !st.page) + '<label class="small">Page <input type="number" min="1" max="' + pages + '" value="' + (st.page + 1) + '" data-pgin aria-label="Page number"> of ' + fmt(pages) + '</label>' + bt('next', 'Next ▶', st.page >= pages - 1) + bt('last', 'Last ⏭', st.page >= pages - 1); }
    function paint() { var pages = Math.max(1, Math.ceil((st.matched || 0) / PER)); st.page = Math.max(0, Math.min(st.page, pages - 1)); var L = st.list || [];
      tombs.innerHTML = L.length ? L.map(tomb).join('') : '<p class="muted small">No grave matches. Try a pet number, a name, a species or a full owner address, or clear a filter.</p>';
      stoneJs(function () { L.forEach(function (p) { var wp = w.byId && w.byId[p.id], c = tombs.querySelector('canvas[data-id="' + p.id + '"]'); if (c && c.isConnected) window.V2Gravestone.draw(c, { art: wp && wp.art, stage: wp ? wp.stage : p.stage, tier: p.tier, state: p.state, crumbles: p.crumbles, open: !!p.open, mythic: !!p.mythic }); }); });
      pager(pTop, pages); pager(pBot, pages); }
    function ask() { var dd = st.days ? st.days.split('-') : null, q = { page: st.page, per: PER, sort: st.sort, tier: st.tier, stage: st.stage, diff: st.diff, raisable: !!st.raisable, open: !!st.open, mine: !!st.mine, owner: ME || '', sp: st.sp, meals: st.q.trim() ? '' : st.meals, text: st.q };
      if (dd) { q.minDays = +dd[0]; if (dd[1] !== '') q.maxDays = +dd[1]; } return q; }
    function showPage(out) { st.list = out.rows || []; st.matched = out.matched || 0; if (out.page != null) st.page = out.page; if (out.total != null) st.total = out.total; S.total = st.total || st.matched;
      var q = st.q.trim(); $('cemMsg').innerHTML = fmt(st.matched) + ' grave' + (st.matched === 1 ? '' : 's') + (q ? ' for "' + esc(q) + '"' : '') + ' · sorted ' + esc((SORTS.filter(function (s) { return s[0] === st.sort; })[0] || SORTS[0])[1].replace(/^[^A-Za-z]+/, '').toLowerCase()) + (st.matched > PER ? ' · page ' + fmt(st.page + 1) + ' of ' + fmt(Math.ceil(st.matched / PER)) : '');
      quick(); paint(); }
    function apply(keepPage, done) { if (!keepPage) st.page = 0; var q = ask();
      function finish(out) { showPage(out); if (done) done(); }
      if (st.remote && GI && GI.fetchPage) { var ticket = st.ticket = (st.ticket || 0) + 1; GI.fetchPage(st.remote, q).then(function (out) { if (ticket !== st.ticket) return; st.fails = 0; finish(out); }).catch(function () { if (ticket === st.ticket) remoteFail(done); }); return; }
      if (!st.index || !GI) return; finish(GI.query(st.index, q)); }
    /* cem-raise-easy (Nov 24 2026, Jake: "0 pets showing" while the Raise door said 102,216 graves): when the server's grave list did not answer,
     * the page fell back to the pets already in memory, and a fast-loaded page holds no dead pets, so the list came up empty. Now it waits and asks
     * again (with a Try now button), and after three misses it loads every grave on this device first (V2Split.ensureDead) before it lists them. */
    function remoteFail(done) { st.fails = (st.fails || 0) + 1; clearTimeout(st.rt);
      if (st.fails < 3) { $('cemMsg').textContent = ''; tombs.innerHTML = '<p class="cv2-empty cv2-wait">🕯️ The grave list is slow to answer right now. Trying again… <button type="button" class="btn ghost cv2-small" id="cemRetry">Try now</button></p>';
        st.rt = setTimeout(function () { apply(true, done); }, 5000); var r = $('cemRetry'); if (r) r.onclick = function () { clearTimeout(st.rt); apply(true, done); }; return; }
      st.remote = ''; st.source = 'world'; tombs.innerHTML = '<p class="cv2-empty cv2-wait">🕯️ Digging up every grave on this device. This takes about a minute…</p>';
      var go = function () { syncWorld(); localIndex(function () { apply(true, done); }); }; if (window.V2Split && V2Split.ensureDead) V2Split.ensureDead().then(go, go); else go(); }
    function quick() { var set = function (id, v) { var e = $(id); if (e) e.setAttribute('aria-pressed', !!v); };
      var base = !st.tier && !st.stage && !st.days && !st.sp && !st.meals && !st.q;
      set('cemPower', st.sort === 'strongest' && base && !st.diff && !st.open && !st.mine); set('cemRarest', st.sort === 'rarest' && st.raisable && base && !st.diff && !st.mine); set('cemEasiest', st.sort === 'strongest' && st.diff === 'easy' && st.raisable && base && !st.mine); set('cemFresh', st.sort === 'newest' && st.days === '0-1' && !st.mine); set('cemOpen', !!st.open); set('cemMine', !!st.mine); }
    function sync() { $('cemSort').value = st.sort; $('cemTier').value = st.tier; $('cemStage').value = st.stage; $('cemDays').value = st.days; $('cemDiff').value = st.diff; $('cemRaisable').checked = st.raisable; $('cemSp').value = st.sp; $('cemMeals').value = st.meals; $('cemFind').value = st.q; }
    function reset() { st.tier = st.stage = st.days = st.diff = st.sp = st.meals = st.q = ''; st.raisable = false; st.open = false; st.mine = false; }
    function onPager(e) { var t = e.target.closest('[data-pg]'); if (!t) return; var pages = Math.ceil((st.matched || 0) / PER) || 1, k = t.getAttribute('data-pg'); st.page = k === 'first' ? 0 : k === 'last' ? pages - 1 : k === 'prev' ? st.page - 1 : st.page + 1; apply(true); if (this === pBot) pTop.scrollIntoView({ block: 'start' }); }
    function onPgIn(e) { if (!e.target.hasAttribute('data-pgin')) return; var v = parseInt(e.target.value, 10); if (v > 0) { st.page = v - 1; apply(true); } }
    [pTop, pBot].forEach(function (el) { el.addEventListener('click', onPager); el.addEventListener('change', onPgIn); });
    /* "Raise at the altar": load the altar module on first use, then open the seance panel for that grave (hidden until the gate; owner test: grave #2, owner wallet) */
    /* owner's raise flow (Oct 29 2026 8:35 PM CT), step 1: click a gravestone to begin raising that dead pet (the whole stone, not only the button) */
    function graveById(id) { var i, L = st.list || []; for (i = 0; i < L.length; i++) if (+L[i].id === +id) return L[i]; L = st.index || []; for (i = 0; i < L.length; i++) if (+L[i].id === +id) return L[i]; var p = w.byId && w.byId[id]; return p && p.dead ? { id: p.id, raisable: 1, owner: p.owner, name: p.name } : null; }
    function showDetail(id, again) { var box = $('cemDetail'); if (!box) { box = document.createElement('div'); box.id = 'cemDetail'; box.className = 'small cv2-detail'; tombs.parentNode.insertBefore(box, tombs); }
      var p = w.byId && w.byId[id]; if (!p && !again && id !== 1765 && window.V2Split && V2Split.ensurePet) { V2Split.ensurePet(id).then(function () { w = ctx.M && ctx.M.world ? ctx.M.world() : w; ctx.w = w; showDetail(id, 1); }); return; }
      if (!p || p.id === 1765 || !V.cemView) { box.innerHTML = '<p>Grave #' + fmt(id) + '</p>'; return; }
      var v = V.cemView(w, p, b), bits = '';
      try { if (window.PetScore && PetScore.rarity) { var sc = PetScore.rarity(w, p); if (sc && isFinite(sc.bits)) bits = ' · 💎 Rarity ' + sc.bits.toFixed(1); } } catch (e) {} /* Nov 28 2026: read .bits of the score record, which has none (rarityBits), so the grave detail never showed it */
      var hs = headStart(p); box.innerHTML = '<p><b>' + esc(p.name || ('#' + id)) + ' #' + id + '</b> · ' + esc(V.petSpeciesLabel ? V.petSpeciesLabel(p) : p.species) + ' · died at block ' + fmt(p.deathBlock) + (v && v.grave ? ' · ' + (v.state || 'open') : '') + (v && v.altar ? ' · altar closes in ' + fmt(v.altar.closesIn) + ' blocks' : '') + (v && v.why ? ' · ' + esc(v.why) : '') + bits + (R.graveCount && R.graveCount(w, p) ? ' · ' + R.graveLine(w, p) : '') + '</p>' + hsHtml(hs); }
    tombs.addEventListener('click', function (e) { var bt = e.target.closest('[data-raise]'), tb = e.target.closest('.tomb'); if (tb && !e.target.closest('a,details')) { var tid = tb.id && tb.id.indexOf('tomb-') === 0 ? +tb.id.slice(5) : 0; if (tid) showDetail(tid); }
      if (e.target.closest('details')) return; if (!bt && tb && !e.target.closest('a,button,select,xc-select,input,label')) bt = tb.querySelector('[data-raise]'); if (!bt) return; var id = +bt.getAttribute('data-raise'), g = graveById(id); showDetail(id); if (!g || !canRaise(g)) return;
      bt.disabled = true; altarJs(function () { bt.disabled = false; if (window.V2CemeteryAltar) V2CemeteryAltar.open(g, ctx); }); });
    S.openAltar = function () { var g = (st.list || []).filter(canRaise)[0] || (st.index || []).filter(canRaise)[0]; if (g) altarJs(function () { if (window.V2CemeteryAltar) V2CemeteryAltar.open(g, ctx); }); };
    var inp = $('cemFind'), tmr; inp.oninput = function () { clearTimeout(tmr); tmr = setTimeout(function () { st.q = inp.value; apply(); }, 200); };
    inp.onkeydown = function (e) { if (e.key === 'Enter') { clearTimeout(tmr); st.q = inp.value; apply(); } };
    $('cemGo').onclick = function () { clearTimeout(tmr); st.q = inp.value; apply(); };
    if ($('cemMine')) $('cemMine').onclick = function () { reset(); st.mine = true; st.sort = 'newest'; sync(); apply(); };
    function best() { reset(); st.sort = 'strongest'; st.diff = 'easy'; st.raisable = true; sync(); apply(); }
    $('cemPower').onclick = function () { reset(); st.sort = 'strongest'; sync(); apply(); };
    $('cemRarest').onclick = function () { reset(); st.sort = 'rarest'; st.raisable = true; sync(); apply(); };
    $('cemEasiest').onclick = best;
    $('cemFresh').onclick = function () { reset(); st.sort = 'newest'; st.days = '0-1'; sync(); apply(); };
    $('cemOpen').onclick = function () { var o = !st.open; reset(); st.open = o; st.sort = 'rarest'; sync(); apply(); };
    $('cemClear').onclick = best;
    $('cemSort').onchange = function () { st.sort = this.value; apply(); }; $('cemSp').onchange = function () { st.sp = this.value; apply(); }; $('cemTier').onchange = function () { st.tier = this.value; apply(); }; $('cemMeals').onchange = function () { st.meals = this.value; apply(); };
    $('cemStage').onchange = function () { st.stage = this.value; apply(); }; $('cemDays').onchange = function () { st.days = this.value; apply(); }; $('cemDiff').onchange = function () { st.diff = this.value; apply(); }; $('cemRaisable').onchange = function () { st.raisable = this.checked; apply(); };
    function deep() { var d = (location.hash.match(/^#tomb-(\d+)$/) || [])[1] || new URLSearchParams(location.search).get('id'); if (!d) return false;
      inp.value = '#' + d; st.q = '#' + d; apply(true, function () { var e = $('tomb-' + d); if (e) { e.scrollIntoView({ block: 'center' }); e.classList.add('flash'); } showDetail(+d); }); return true; }
    window.addEventListener('hashchange', deep);
    function afterIndex() { opts(); status(); zombies(); st.ready = true; resumeNote(); window.__cemV2 = { src: st.source, n: graveCount(), page: PER, block: b - 1, on: on, pub: pub, indexMs: st.indexMs || 0 };
      /* rest() publishes owner pages and would drop zombies loaded first. Load them after the living pets settle. */
      function zLoad() { if (!(window.V2Split && V2Split.loadZombies)) return; V2Split.loadZombies(function (got, total) { var s = $('status'); if (s) s.textContent = 'Reading risen zombies… ' + got + (total ? ' / ' + total : ''); }).then(function () { syncWorld(); status(); zombies(); }, function () {}); }
      /* hunt-fast (Nov 24 2026): zombies load right away. They used to wait for every page of the wallet's living pets first (a minute or more
       * on a big wallet), because an owner-page publish dropped them; since PR 198 pets added from outside the owner list are kept on every
       * publish. After the living pets settle the lists repaint once more. */
      zLoad(); if (window.xcpLivingRest) window.xcpLivingRest().then(function () { syncWorld(); status(); zombies(); }, function () {});
      if (!graveCount()) { tombs.innerHTML = '<p class="muted">No pets have died yet. Pets starve after 7 full days with no meal: feed yours on <a href="play.html">Play</a>.</p>'; return; } if (!deep()) apply(); }
    function localIndex(done) { if (!GI) { tombs.innerHTML = '<p class="muted">The grave index did not load.</p>'; return; }
      var t0 = (window.performance && performance.now) ? performance.now() : Date.now(); st.index = GI.compact(w, b, V); st.counts = GI.countsOf(st.index); st.total = st.index.length; st.source = 'world'; S.total = st.total;
      st.indexMs = Math.round(((window.performance && performance.now) ? performance.now() : Date.now()) - t0); if (done) done(); else afterIndex(); }
    function startIndex() { var sync = GI && GI.base ? GI.base() : ''; function local() { var go = function () { w = ctx.M && ctx.M.world ? ctx.M.world() : w; ctx.w = w; localIndex(); }; if (window.V2Split && V2Split.ensureDead) V2Split.ensureDead().then(go, go); else go(); } if (!sync || !GI.counts) return local();
      GI.counts(sync).then(function (c) { if (!c || c.dead == null) return local(); st.remote = sync; st.counts = c; st.total = c.dead; st.source = 'index'; S.total = c.dead; afterIndex(); }).catch(function () { local(); }); }
    startIndex();
    /* Nov 22 2026: newer game data repaints this page in place. Without a hook v2-chain.js reloaded the whole page a few seconds after it opened. */
    if (M && M.onFresh) M.onFresh(function () { syncWorld(); b = (w.tip || b - 1) + 1; ctx.b = b; if (!st.ready) return;
      var re = function () { try { opts(); status(); zombies(); apply(true); } catch (e) { try { console.warn('[cemetery] repaint', e); } catch (x) {} } };
      if (st.source === 'world') localIndex(re); else re(); });
    /* cemetery-handoff: an offering saved in this browser (not yet sent, or stopped half way) gets a note at the top of the list with an Open button */
    function resumeNote() { if (!ME) return; var o = {}; try { o = JSON.parse(localStorage.getItem('xcpets-cem-build-v1-' + ME) || '{}') || {}; } catch (e) { o = {}; }
      var ids = Object.keys(o).filter(function (k) { var x = o[k]; return x && Date.now() - (x.at || 0) < 24 * 3600e3 && ((x.offered && x.offered.length) || (x.run && x.run.left && x.run.left.length)); });
      var old = $('cemResume'); if (old) old.remove(); if (!ids.length) return; var m = $('cemMsg'); if (!m) return; var d = document.createElement('p'); d.id = 'cemResume'; d.className = 'small cem-resume';
      d.innerHTML = '🕯️ Unsent offering saved in this browser: ' + ids.map(function (k) { var x = o[k]; return '<button type="button" class="q" data-resume="' + esc(k) + '">Open #' + esc(k) + ' ' + esc(x.name || '') + ' (' + ((x.offered || []).length) + ' pet' + ((x.offered || []).length === 1 ? '' : 's') + ')</button>'; }).join(' ');
      m.parentNode.insertBefore(d, m); d.onclick = function (e) { var bt = e.target.closest('[data-resume]'); if (!bt) return; var id = +bt.getAttribute('data-resume'), g = graveById(id); if (!g || !canRaise(g)) { bt.disabled = true; bt.title = 'This grave can no longer be raised'; return; } showDetail(id); altarJs(function () { if (window.V2CemeteryAltar) V2CemeteryAltar.open(g, ctx); }); }; }
  }
  /* cem-guide: v2-cem-guide.js needs the badges (V2CemArt) first; both load once with this script's ?v token */
  function guideJs(cb) { if (window.V2CemGuide) return cb(); var v = ver(), add = function (src, done) { var sc = document.createElement('script'); sc.src = src + (v ? '?' + v : ''); sc.onload = done; document.head.appendChild(sc); };
    var go = function () { add('js/v2-cem-guide.js', cb); }; if (window.V2CemArt) go(); else { var t = setInterval(function () { if (window.V2CemArt) { clearInterval(t); go(); } }, 50); setTimeout(function () { clearInterval(t); }, 20000); } }
  /* cem-sacrifice (step 4): the feed / halo-points sheet, loaded on first use with this script's ?v token */
  function sacJs(cb) { if (window.V2CemSacrifice) return cb(); var v = ver(), sc = document.createElement('script'); sc.src = 'js/v2-cem-sacrifice.js' + (v ? '?' + v : ''); sc.onload = cb; document.head.appendChild(sc); }
  function artJs(cb) { if (window.V2CemArt) return; if (document.getElementById('cemArtJs')) return; var v = ver(), sc = document.createElement('script'); sc.id = 'cemArtJs'; sc.src = 'js/v2-cemetery-art.js' + (v ? '?' + v : ''); sc.onload = cb; document.head.appendChild(sc); }
  /* THE gravestone (option C, owner's pick Oct 29 2026): loaded once, then every finder card draws its stone */
  function stoneJs(cb) { if (window.V2Gravestone) return cb(); (S.gsQ = S.gsQ || []).push(cb); if (S.gsQ.length > 1) return; var v = ver(), sc = document.createElement('script'); sc.src = 'js/v2-gravestone.js' + (v ? '?' + v : '');
    sc.onload = function () { var q = S.gsQ; S.gsQ = []; q.forEach(function (f) { f(); }); }; sc.onerror = function () { S.gsQ = []; }; document.head.appendChild(sc); }
  /* sac-guard (Nov 23 2026): a single pet picked for a zombie meal or a pledge is checked for Gods, Mythics, Legendaries, Wizards, stars and recent meals first */
  function sgGo(w, id, verb, then) { if (!window.V2SacGuard || !(id > 0)) return then(); V2SacGuard.check({ w: w, ids: [id], me: (window.V2UI && V2UI.ME) || '', verb: verb, onGo: function (keep) { if (keep.length) then(); } }); }
  function ver() { var me = document.querySelector('script[src*="v2-cemetery-scene.js"]'); return me ? (me.getAttribute('src').split('?')[1] || '') : ''; }
  function altarJs(cb) { if (window.V2CemeteryAltar) return cb(); (S.altQ = S.altQ || []).push(cb); if (S.altQ.length > 1) return; var v = ver();
    if (!document.getElementById('cemAltCss')) { var l = document.createElement('link'); l.rel = 'stylesheet'; l.id = 'cemAltCss'; l.href = 'css/cemetery-altar.css' + (v ? '?' + v : ''); document.head.appendChild(l); }
    var sc = document.createElement('script'); sc.src = 'js/v2-cemetery-altar.js' + (v ? '?' + v : ''); sc.onload = function () { var q = S.altQ; S.altQ = []; q.forEach(function (f) { f(); }); }; sc.onerror = function () { S.altQ = []; }; document.head.appendChild(sc); }
  function css() { if (document.getElementById('cemV2Css')) return; var me = document.querySelector('script[src*="v2-cemetery-scene.js"]'), v = me ? (me.getAttribute('src').split('?')[1] || '') : '', l = document.createElement('link');
    l.rel = 'stylesheet'; l.id = 'cemV2Css'; l.href = 'css/cemetery-v2.css' + (v ? '?' + v : ''); document.head.appendChild(l); }
  /* pet-page-zombies (Nov 23 2026, Jake: "should they really be different?"): one pet page for every pet. pet.html shows a risen zombie's
   * cemetery card (food bar, halo bar, Feed / Add halo points / Resurrect, Hunt for other players' feral zombies) and signs right there with
   * the same sheets and the same guarded send as cemetery.html. zombieBox(el, id, ctx), ctx = { M, R, V, ME, fmt, shortAddr }. UI only. */
  function zombieBox(el, id, ctx) { if (!el || !ctx || !ctx.M || !ctx.M.world) return; var V = ctx.V, R = ctx.R, ME = ctx.ME, w = ctx.M.world(), p = w && w.byId && w.byId[id];
    if (!p || !V || !V.isZ || !V.isZ(p) || !V.cemView) { el.innerHTML = ''; el.hidden = true; return; }
    var b = (w.tip || 0) + 1, on = V.cemOn ? V.cemOn(b) : false, sa = ctx.shortAddr || function (a) { a = String(a || ''); return a.length > 16 ? a.slice(0, 6) + '…' + a.slice(-4) : a; };
    ctx.w = w; ctx.b = b; css(); var redo = function () { if (el.isConnected) zombieBox(el, id, ctx); }; if (!window.V2CemArt) artJs(redo); if (!window.V2CemGuide && !zombieBox.guide) { zombieBox.guide = 1; guideJs(redo); } /* plain times + badges, once */
    /* mg-road (Nov 25 2026): the step panel above the card, so a player on the road to Mythic God always sees where they are. */
    var road = ''; try { if (window.V2MgRoad) road = V2MgRoad.html(w, p, ME, b); } catch (e) { road = ''; }
    el.hidden = false; el.innerHTML = '<h3 class="pc-qh">🧟 Zombie care</h3>' + road + '<div class="cv2-zombies cv2-one">' + zcardHtml({ w: w, b: b, V: V, R: R, ME: ME, on: on, fmt: ctx.fmt, sa: sa }, p) + '</div>';
    var c = el.querySelector('canvas[data-z="' + p.id + '"]'); if (c && p.art && R.lazy) R.lazy(c, function () { return R.petFrames ? R.petFrames(p, w) : R.framesWith(p.art, Math.max(5, p.stage), []); }, true);
    var own = el.querySelector('.cv2-zown'); if (own) own.remove(); /* the pet page already names the owner */
    if (!document.getElementById('cemAltar')) { var host = document.createElement('section'); host.id = 'cemAltar'; host.className = 'cem-altar'; host.hidden = true; host.setAttribute('aria-label', 'Sign the zombie burns'); el.parentNode.insertBefore(host, el.nextSibling); }
    if (ME && p.owner === ME && window.xcpLivingRest) window.xcpLivingRest(); /* the Discard pile pets the Feed sheet lists */
    if (el._zbox) { el._zbox.ctx = ctx; return; } el._zbox = { ctx: ctx };
    function cur() { var C = el._zbox.ctx; C.w = C.M.world(); C.b = (C.w.tip || 0) + 1; return C; }
    function go(L, title) { var C = cur(), tags = L.map(function (q) { return q.tag; }); altarJs(function () { if (window.V2CemeteryAltar && V2CemeteryAltar.sendPlans) V2CemeteryAltar.sendPlans(title, L.map(function (q) { return C.V.cemPetAmount ? C.V.cemPetAmount(C.w, q, C.b) : q; }), C); else location.href = 'play.html#cem-' + encodeURIComponent(tags.join('~')); }); }
    function mine(C) { return C.ME ? (C.w.pets || []).filter(function (q) { return V2Own.isLiving(q, C.ME, { zombies: false }); }) : []; }
    function fill(C) { return C.ME && window.xcpLivingFill ? window.xcpLivingFill(C.ME).then(function () { return cur(); }, function () { return cur(); }) : Promise.resolve(C); }
    function busy(t, on) { if (!t) return; t.disabled = on; t.classList.toggle('cv2-busy', on); }
    el.addEventListener('click', function (e) { var t = e.target.closest('[data-zsac],[data-hunt],[data-res]'); if (!t || t.disabled) return; e.preventDefault(); var C = cur(), z = +(t.getAttribute('data-z') || t.getAttribute('data-hunt') || t.getAttribute('data-res'));
      if (t.hasAttribute('data-res')) return go([C.V.cemPlan(C.w, 'resurrect', z, null, C.b)], '😇 Resurrection of #' + z);
      busy(t, true); var kind = t.getAttribute('data-zsac');
      fill(C).then(function (C2) { busy(t, false);
        if (kind) return sgJs(function () { sacJs(function () { if (window.V2CemSacrifice) V2CemSacrifice.open({ kind: kind, z: z, w: C2.w, V: C2.V, R: C2.R, ME: C2.ME, b: C2.b, send: go }); }); });
        var pick = function () { if (window.V2HuntPicker) V2HuntPicker.open({ w: C2.w, V: C2.V, R: C2.R, me: C2.ME, zombie: z, block: C2.b, pets: mine(C2), pending: false, send: go }); };
        huntJs(pick); }); }); }
  /* sac-guard (Gods and Mythics are never sacrificed, Jake Nov 23): js/v2-sac-guard.js checks every pick in the Feed / halo sheet; loaded here when the page lacks it */
  function sgJs(cb) { if (window.V2SacGuard) return cb(); var v = ver(), sc = document.createElement('script'); sc.src = 'js/v2-sac-guard.js' + (v ? '?' + v : ''); sc.onload = cb; sc.onerror = cb; document.head.appendChild(sc); }
  /* the hunter picker (js/v2-hunt-picker.js + the shared js/v2-pick.js and css/hunt-picker.css), loaded on first use outside cemetery.html */
  function huntJs(cb) { if (window.V2HuntPicker) return cb(); var v = ver(), add = function (src, done) { var sc = document.createElement('script'); sc.src = src + (v ? '?' + v : ''); sc.onload = done; sc.onerror = done; document.head.appendChild(sc); };
    if (!document.querySelector('link[href*="hunt-picker.css"]')) { var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'css/hunt-picker.css' + (v ? '?' + v : ''); document.head.appendChild(l); }
    var pk = function () { add('js/v2-hunt-picker.js', cb); }; if (window.V2Pick) pk(); else add('js/v2-pick.js', pk); }
  window.V2CemeteryScene = { mount: mount, hooks: hooks, flare: flare, page: page, zombieBox: zombieBox, ALTAR: ALTAR, SEANCE: SEANCE, _state: function () { return S; }, _select: function (k) { S.sel = k; card(k); kick(); } };
})();
