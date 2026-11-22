/* living-scenes (Nov 22 2026): the Pantheon scene at the top of pantheon.html. DISPLAY ONLY (reads what js/v2-pantheon.js already shows).
 * One 320x180 pixel canvas: a full moon over a sky temple, 21 thrones on three cloud tiers (I-V on top, VI-XII, XIII-XXI). An empty throne is
 * pale stone; a filled one shows its Mythic God (the pet's own sprite) with a halo in the seat's light. The next open throne pulses.
 * It paints at once with empty thrones (no world needed); js/v2-pantheon.js calls V2PantheonScene.set({ w, seats }) once the chain is read.
 * Tap a throne = jump to that seat's card (#seat-N). Pauses off screen and in hidden tabs; one still frame with prefers-reduced-motion. */
(function () {
  'use strict';
  var W = 320, H = 180, RM = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  function reduced() { return !!RM.matches || /[?&]motion=off/.test(location.search); }
  function px(x, c, a, b, w, h) { x.fillStyle = c; x.fillRect(a | 0, b | 0, w | 0, h | 0); }
  function txt(x, s, a, b, col, size, align) { x.font = (size || 8) + 'px "Press Start 2P", monospace'; x.textAlign = align || 'left'; x.textBaseline = 'top';
    x.fillStyle = '#0b0820'; x.fillText(s, a + 1, b + 1); x.fillStyle = col; x.fillText(s, a, b); }
  function rnd(s) { return function () { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; }
  var ROMAN = 'I II III IV V VI VII VIII IX X XI XII XIII XIV XV XVI XVII XVIII XIX XX XXI'.split(' ');
  var LIGHT = { gold: '#ffd84a', silver: '#e6ecf8', azure: '#8cd2ff', dawn: '#ffc4a8' };
  /* throne positions: tier base y and x for each seat 1..21 */
  var SEAT = [], TIER = [[5, 76, 40], [7, 116, 38], [9, 158, 33]];
  (function () { var n = 0; TIER.forEach(function (t) { for (var i = 0; i < t[0]; i++) SEAT[++n] = { x: Math.round(160 + (i - (t[0] - 1) / 2) * t[2]), y: t[1] }; }); })();
  var S = { c: null, x: null, k: 1, raf: 0, vis: true, seats: [], w: null, loading: true, fresh: 0, bolt: 0, nextBolt: 4000 };
  function pal(n) { var G = window.V2MythicGod, s = G && G.SEATS && G.SEATS[n - 1]; return LIGHT[(s && s[2]) || 'gold'] || LIGHT.gold; }
  /* ---- static background, drawn once */
  var BG = null, CL = null;
  function buildBg() { var c = document.createElement('canvas'); c.width = W; c.height = H; var x = c.getContext('2d'), R = rnd(21), i;
    var g = ['#0b0820', '#120c2e', '#1a1240', '#241852', '#2e1f5e', '#3a2668', '#4a2f70'];
    for (i = 0; i < 7; i++) px(x, g[i], 0, i * 26, W, 26);
    for (i = 1; i < 7; i++) for (var dx = 0; dx < W; dx += 2) px(x, g[i], dx + (i & 1), i * 26 - 1, 1, 1);
    var mx = 160, my = 30; /* full moon with glow */
    for (var r = 34; r > 20; r -= 2) { x.fillStyle = 'rgba(255,236,170,' + (0.03 + (34 - r) * 0.006) + ')'; x.beginPath(); x.arc(mx, my, r, 0, 7); x.fill(); }
    x.fillStyle = '#fff2c4'; x.beginPath(); x.arc(mx, my, 19, 0, 7); x.fill(); x.fillStyle = '#f3dfa0'; x.beginPath(); x.arc(mx + 3, my + 3, 17, 0, 7); x.fill();
    x.fillStyle = '#fff6d6'; x.beginPath(); x.arc(mx - 2, my - 2, 16, 0, 7); x.fill();
    [[-6, -4, 3], [5, 3, 4], [-2, 7, 2], [8, -7, 2], [-9, 4, 2]].forEach(function (k) { x.fillStyle = '#e8d49a'; x.beginPath(); x.arc(mx + k[0], my + k[1], k[2], 0, 7); x.fill(); });
    /* temple: pediment and columns behind the top tier */
    px(x, '#3d3270', 52, 44, 216, 4); for (i = 0; i < 18; i++) px(x, '#3d3270', 60 + i * 5.6, 44 - i * 0.9, 200 - i * 11.2, 1);
    px(x, '#55489a', 52, 47, 216, 1);
    for (i = 0; i < 9; i++) { var cx = 58 + i * 25.5; px(x, '#2f2760', cx, 48, 8, 30); px(x, '#4a3f8a', cx, 48, 2, 30); px(x, '#1f1a44', cx + 7, 48, 1, 30); px(x, '#55489a', cx - 1, 48, 10, 2); }
    /* distant stars (static ones; twinkles are drawn live) */
    for (i = 0; i < 70; i++) { var sx = R() * W, sy = R() * 70, b = R(); if (Math.abs(sx - mx) < 26 && sy < 58) continue; px(x, b < .2 ? '#fff6d6' : b < .55 ? '#b7a6ff' : '#5b4a9a', sx, sy, 1, 1); }
    BG = c;
    /* one cloud band, tiled and drifted per tier */
    var cc = document.createElement('canvas'); cc.width = W * 2; cc.height = 22; var y = cc.getContext('2d'), Rc = rnd(5);
    for (i = 0; i < 40; i++) { var px0 = Rc() * W * 2, r0 = 5 + Rc() * 7, py0 = 12 + Rc() * 4; y.fillStyle = '#8f86c8'; y.beginPath(); y.arc(px0, py0 + 2, r0, 0, 7); y.fill(); }
    for (i = 0; i < 40; i++) { var px1 = Rc() * W * 2, r1 = 4 + Rc() * 6, py1 = 11 + Rc() * 3; y.fillStyle = '#d8d2f4'; y.beginPath(); y.arc(px1, py1, r1, 0, 7); y.fill(); }
    for (i = 0; i < 30; i++) { var px2 = Rc() * W * 2, r2 = 2 + Rc() * 4, py2 = 9 + Rc() * 3; y.fillStyle = '#f4f0ff'; y.beginPath(); y.arc(px2, py2, r2, 0, 7); y.fill(); }
    /* make the tile seamless: copy the left edge over the right */
    y.drawImage(cc, 0, 0, 24, 22, W, 0, 24, 22); CL = cc; }
  /* ---- pet sprites (same keyed approach as the raid scene) */
  var PF = { w: null, m: {} };
  /* some looks (rare scenes) keep the key colour after spriteCanvas: clear any leftover magenta */
  function unkey(c) { try { var g = c.getContext('2d'), d = g.getImageData(0, 0, c.width, c.height), a = d.data, hit = 0;
      for (var i = 0; i < a.length; i += 4) if (a[i] > 230 && a[i + 1] < 30 && a[i + 2] > 230) { a[i + 3] = 0; hit = 1; } if (hit) g.putImageData(d, 0, 0); } catch (e) { } return c; }
  function petImg(p, t) { var R = window.V2Render, w = S.w; if (!p || !w || !R || !R.petFrames || !R.spriteCanvas) return null; if (PF.w !== w) { PF.w = w; PF.m = {}; }
    var k = p.id + '|' + p.species + '|' + p.stage, fr = PF.m[k];
    if (fr === undefined) { fr = null; try { var mp = Object.assign(Object.create(Object.getPrototypeOf(p)), p, { art: Object.assign({}, p.art, { background: 'keyed', bgColor: '#ff00fe', pattern: 'none' }) }), F = R.petFrames(mp, w, { noHunger: true });
        if (F && F.length) fr = F.map(function (q) { return unkey(R.spriteCanvas(q, true)); }); } catch (e) { fr = null; } PF.m[k] = fr; }
    return fr && fr.length ? fr[reduced() ? 0 : Math.floor((t || 0) / 320) % fr.length] : null; }
  /* ---- a throne at (cx, base) */
  function throne(x, cx, by, on, n, t) { var gold = on ? '#e8b93a' : '#bdb4e6', hi = on ? '#fff0a0' : '#f4f0ff', lo = on ? '#8a5f12' : '#6f64a8', cush = on ? '#7a1f8a' : '#4a3f8a';
    px(x, lo, cx - 8, by - 4, 16, 4); px(x, gold, cx - 7, by - 5, 14, 2); /* base */
    px(x, gold, cx - 6, by - 22, 12, 17); px(x, hi, cx - 6, by - 22, 1, 17); px(x, lo, cx + 5, by - 22, 1, 17); /* back */
    px(x, gold, cx - 4, by - 25, 8, 3); px(x, gold, cx - 2, by - 27, 4, 2); px(x, hi, cx - 1, by - 27, 2, 1); /* crest */
    px(x, cush, cx - 4, by - 20, 8, 11); px(x, gold, cx - 8, by - 12, 3, 7); px(x, gold, cx + 5, by - 12, 3, 7); /* cushion, arms */
    px(x, cush, cx - 5, by - 9, 10, 3); }
  function cloud(x, y, off) { var o = ((off % (W)) + W) % W; x.drawImage(CL, o, 0, W, 22, 0, y, W, 22); }
  function draw(t) { var x = S.x; if (!x) return; if (window.V2Sharp && S.k) V2Sharp.begin(x, S.k); else { x.setTransform(S.k, 0, 0, S.k, 0, 0); x.imageSmoothingEnabled = false; }
    if (!BG) buildBg(); var f = reduced() ? 0 : t, i;
    x.drawImage(BG, 0, 0);
    /* moon rays, slowly turning */
    x.save(); x.globalAlpha = 0.07; x.fillStyle = '#ffeab0'; for (i = 0; i < 8; i++) { var a = f / 9000 + i * Math.PI / 4; x.beginPath(); x.moveTo(160, 30); x.lineTo(160 + Math.cos(a - .06) * 220, 30 + Math.sin(a - .06) * 220); x.lineTo(160 + Math.cos(a + .06) * 220, 30 + Math.sin(a + .06) * 220); x.fill(); } x.restore();
    /* twinkles */
    for (i = 0; i < 12; i++) { var sx = (i * 73 + 19) % W, sy = (i * 37 + 7) % 62, on = Math.sin(f / 500 + i * 1.7) > .6; if (Math.abs(sx - 160) < 26 && sy < 56) continue; if (on) { px(x, '#fff6d6', sx - 1, sy, 3, 1); px(x, '#fff6d6', sx, sy - 1, 1, 3); } }
    /* lightning now and then, far behind the temple */
    if (!reduced()) { if (f > S.nextBolt) { S.bolt = f; S.nextBolt = f + 6000 + Math.random() * 9000; S.bx = 30 + Math.random() * 260; }
      var ba = (f - S.bolt) / 260; if (ba >= 0 && ba < 1) { x.save(); x.globalAlpha = 1 - ba; px(x, 'rgba(200,190,255,.25)', 0, 0, W, 70); x.strokeStyle = '#fff6d6'; x.lineWidth = 1; x.beginPath(); var lx = S.bx, ly = 0; x.moveTo(lx, ly); while (ly < 46) { ly += 6; lx += (((ly * 7 + S.bx) | 0) % 7) - 3; x.lineTo(lx, ly); } x.stroke(); x.restore(); } }
    var seats = S.seats || [], filled = seats.length, next = filled < 21 ? filled + 1 : 0;
    for (var tr = 0; tr < 3; tr++) { var T = TIER[tr], first = tr === 0 ? 1 : tr === 1 ? 6 : 13;
      cloud(x, T[1] - 14, (tr & 1 ? -1 : 1) * f / (140 + tr * 40) + tr * 90);
      for (i = 0; i < T[0]; i++) { var n = first + i, P = SEAT[n], s = seats[n - 1], bob = reduced() ? 0 : Math.round(Math.sin(f / 900 + n) * 1);
        if (s) { var col = pal(n), gl = 0.35 + 0.2 * Math.sin(f / 600 + n);
          x.save(); x.globalAlpha = gl; x.fillStyle = col; x.beginPath(); x.ellipse(P.x, P.y - 14 + bob, 13, 15, 0, 0, 7); x.fill(); x.restore(); }
        throne(x, P.x, P.y + bob, !!s, n, f);
        if (s) { var im = petImg(s.pet, f + n * 90), sz = tr === 0 ? 24 : tr === 1 ? 22 : 20;
          if (im) x.drawImage(im, Math.round(P.x - sz / 2), Math.round(P.y + bob - 6 - sz), sz, sz);
          else { px(x, pal(n), P.x - 4, P.y + bob - 18, 8, 8); }
          x.save(); x.strokeStyle = pal(n); x.globalAlpha = .9; x.lineWidth = 1; x.beginPath(); x.ellipse(P.x, P.y + bob - 6 - sz - 2, 6, 2, 0, 0, 7); x.stroke(); x.restore(); }
        else if (n === next && !S.loading) { var pu = .4 + .4 * Math.sin(f / 300); x.save(); x.globalAlpha = pu; x.strokeStyle = '#fff0a0'; x.lineWidth = 1; x.strokeRect(P.x - 9.5, P.y + bob - 28.5, 19, 25); x.restore(); }
        if (tr === 0 || s || n === next) txt(x, ROMAN[n - 1], P.x, P.y + bob + 1, s ? '#fff0a0' : '#c4bedc', 5, 'center'); } }
    /* HUD */
    px(x, 'rgba(11,8,32,.78)', 0, 0, W, 13); txt(x, 'THE PANTHEON', 6, 3, '#f3dfa0', 7);
    txt(x, S.loading ? '...' : filled + ' / 21 SEATED', W - 6, 3, filled ? '#ffd84a' : '#c4bedc', 7, 'right');
    var line = S.loading ? 'THE GODS ARE GATHERING...' : filled ? (filled >= 21 ? 'THE PANTHEON IS COMPLETE' : 'TAP A GOD TO MEET THEM') : 'NO GOD YET. SEAT I AWAITS!';
    var last = seats[filled - 1]; if (!S.loading && last && Math.floor(f / 4000) % 2) line = 'NEWEST: ' + String(last.name || ('#' + last.petId)).toUpperCase().slice(0, 16) + ', SEAT ' + ROMAN[last.n - 1];
    px(x, 'rgba(11,8,32,.78)', 0, H - 12, W, 12); txt(x, line, W / 2, H - 9, '#f3dfa0', 6, 'center'); }
  /* ---- loop */
  function frame(t) { S.raf = 0; if (!S.c) return; draw(t); if (!reduced() && S.vis && !document.hidden) S.raf = requestAnimationFrame(frame); }
  function kick() { if (!S.c) return; if (!S.raf) { if (reduced()) draw(0); else S.raf = requestAnimationFrame(frame); } }
  function fit() { var c = S.c; if (!c) return; if (window.V2Sharp) S.k = V2Sharp.fit(c, W, H); else { var r = c.getBoundingClientRect(), d = window.devicePixelRatio || 1; S.k = Math.max(1, Math.min(8, Math.ceil((r.width || W) * d / W))); c.width = W * S.k; c.height = H * S.k; c.style.imageRendering = 'pixelated'; } }
  function mount(c) { if (!c || !c.getContext || S.c === c) return; S.c = c; S.x = c.getContext('2d'); fit();
    window.addEventListener('resize', function () { fit(); kick(); });
    c.addEventListener('click', function (e) { var r = c.getBoundingClientRect(), lx = (e.clientX - r.left) / r.width * W, ly = (e.clientY - r.top) / r.height * H;
      for (var n = 1; n <= 21; n++) { var P = SEAT[n]; if (Math.abs(lx - P.x) < 15 && ly > P.y - 34 && ly < P.y + 6) { location.hash = 'seat-' + n; return; } } });
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { S.vis = es[0].isIntersecting; if (S.vis) kick(); }).observe(c);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) kick(); });
    if (RM.addEventListener) RM.addEventListener('change', kick);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (reduced()) draw(0); });
    kick(); }
  /* seats: [{ n, petId, name, pet }] in seat order */
  function set(o) { o = o || {}; S.w = o.w || null; S.seats = (o.seats || []).slice(0, 21); S.loading = false; if (window.V2Sharp) fit(); if (reduced()) draw(0); else kick(); }
  window.V2PantheonScene = { mount: mount, set: set, SEAT: SEAT, _state: function () { return S; } };
  function boot() { var c = document.getElementById('pnScene'); if (c) mount(c); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
