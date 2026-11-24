/* XCPETS Raid Boss living scene (living-scenes, Nov 22 2026: "every place opens on an animated scene, the way Spam City does").
 * DISPLAY ONLY. It never decides, composes or signs anything: it draws what js/v2-raid.js already read from the replay (V2Rules.raidInfo).
 * One 320x180 pixel canvas (V2Sharp scaling like the motel and the cemetery). It paints AT ONCE from art alone (no world needed): the pit, the
 * crowd and a boss in the fog. When the raid data arrives it shows the real boss, a community HP bar, who hit last and the blocks left, and
 * your pets' recent hits hop in and strike with pop-up damage numbers. States: wait (silhouette + "next boss" sign), live, won (boss down,
 * confetti), escaped (boss flies off). Tap the boss = jump to the attack box. RAF pauses off screen and in hidden tabs;
 * prefers-reduced-motion (or ?motion=off) = one still frame.
 * API: V2RaidScene.mount(canvas) then V2RaidScene.set(state); state = { mode: 'wait'|'live'|'won'|'escaped', boss: { name, art }, hp, left,
 *   blocksLeft, nextIn, hits: [{ petId, name, sp, hit, crit }] } (newest last). V2RaidScene.demo() plays a fake raid (mockups / previews only). */
(function () {
  'use strict';
  var W = 320, H = 180, RM = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  function reduced() { return !!RM.matches || /[?&]motion=off/.test(location.search); }
  var IMG = {}; function img(src) { if (!IMG[src]) { var i = new Image(); i.onload = function () { if (!S.raf) frame(performance.now()); }; i.src = src; IMG[src] = i; } var o = IMG[src]; return o.complete && o.naturalWidth ? o : null; }
  var BASE = window.XCPETS_IMG_BASE || '';
  function src(p) { var M = window.XCPETS_IMG_MAP; return (M && M[p]) || BASE + p; } /* XCPETS_IMG_MAP: inlined art for offline mockups */
  var SP = ['pepe', 'kek', 'doge', 'peepo', 'wojak', 'chud', 'bobo', 'mumu', 'lenny', 'snibby', 'sarutobi', 'dodo', 'kevin', 'wizard'];
  function spSrc(sp) { sp = String(sp || 'pepe').replace(/^hyb3?:/, '').split(':')[0].replace(/[^a-z]/g, ''); if (SP.indexOf(sp) < 0) sp = 'pepe'; return src('img/theme/sp-' + sp + '.png'); }
  function px(x, c, a, b, w, h) { x.fillStyle = c; x.fillRect(a | 0, b | 0, w | 0, h | 0); }
  function fmt(n) { n = Math.round(n || 0); return n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + 'M' : n >= 1e4 ? Math.round(n / 1e3) + 'K' : n.toLocaleString('en-US'); }
  function txt(x, s, a, b, col, size, align, sh) { x.font = (size || 8) + 'px "Press Start 2P", monospace'; x.textAlign = align || 'left'; x.textBaseline = 'top';
    if (sh !== false) { x.fillStyle = '#1a0d1f'; x.fillText(s, a + 1, b + 1); } x.fillStyle = col; x.fillText(s, a, b); }
  var S = { c: null, x: null, k: 1, raf: 0, vis: true, st: { mode: 'load' }, pops: [], hop: [], shake: 0, flash: 0, seen: 0, t0: 0, conf: [], hpShow: 1, onBoss: null, demoT: 0 };
  /* the arena, drawn ONCE into an offscreen 320x180 layer (a few ms); each frame blits it and animates fire, lava, crowd, boss and pets on top */
  var BG = null, VIG = null, ARCH = [], PIL = [];
  for (var ai = 0; ai < 7; ai++) { ARCH.push(14 + ai * 44); PIL.push(ai * 44 + 3); } PIL.push(7 * 44 + 3);
  function rnd(s) { return function () { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; }
  function buildBg() { var c = document.createElement('canvas'); c.width = W; c.height = H; var x = c.getContext('2d'), R = rnd(7), i, j;
    /* sky: banded night with dithered seams, blood moon, stars, far spires */
    var g = ['#0d0614', '#140a1c', '#1d0d26', '#2b1030', '#3d1434', '#561a30'];
    for (i = 0; i < 6; i++) px(x, g[i], 0, i * 11, W, 11);
    for (i = 1; i < 6; i++) for (var dx = 0; dx < W; dx += 2) px(x, g[i], dx + ((i & 1)), i * 11 - 1, 1, 1);
    for (i = 0; i < 55; i++) { var sx = R() * W, sy = R() * 46, br = R(); px(x, br < .2 ? '#fff4d6' : br < .5 ? '#c9a8d8' : '#6a4a7a', sx, sy, 1, 1); if (br < .06) { px(x, '#fff4d6', sx - 1, sy, 3, 1); px(x, '#fff4d6', sx, sy - 1, 1, 3); } }
    var mx = 268, my = 40; for (var r = 22; r > 15; r -= 2) { x.fillStyle = 'rgba(255,80,60,' + (0.05 + (22 - r) * 0.012) + ')'; x.beginPath(); x.arc(mx, my, r, 0, 7); x.fill(); }
    x.fillStyle = '#d8442e'; x.beginPath(); x.arc(mx, my, 13, 0, 7); x.fill(); x.fillStyle = '#f0653f'; x.beginPath(); x.arc(mx - 2, my - 2, 10, 0, 7); x.fill();
    [[-4, -3, 3], [4, 2, 2], [-1, 5, 2], [5, -5, 1]].forEach(function (k) { x.fillStyle = '#c23a28'; x.beginPath(); x.arc(mx + k[0], my + k[1], k[2], 0, 7); x.fill(); });
    px(x, '#2b1030', mx - 20, my + 6, 18, 2); px(x, '#2b1030', mx - 10, my + 8, 26, 2); px(x, '#3d1434', mx + 4, my - 9, 20, 2);
    var spires = [[18, 38], [40, 30], [58, 42], [96, 34], [118, 24], [140, 40], [190, 36], [214, 28], [236, 44], [292, 32], [310, 40]];
    spires.forEach(function (q) { px(x, '#1a0a20', q[0] - 5, q[1], 10, 60); px(x, '#1a0a20', q[0] - 2, q[1] - 6, 4, 6); px(x, '#1a0a20', q[0] - 1, q[1] - 10, 2, 4); if (R() < .6) px(x, '#ffb03a', q[0] - 1, q[1] + 8 + R() * 10, 2, 2); });
    px(x, '#1a0a20', 0, 52, W, 12);
    /* colosseum wall: bricks, crenellations, pillars and arches */
    px(x, '#3a2340', 0, 58, W, 56);
    for (j = 0; j < 14; j++) { var by2 = 58 + j * 4; for (i = (j & 1) * 5; i < W; i += 10) { px(x, '#2a1630', i, by2, 1, 4); } px(x, '#2a1630', 0, by2 + 3, W, 1); }
    for (i = 0; i < W; i += 10) { px(x, '#3a2340', i, 53, 6, 5); px(x, '#4d3055', i, 53, 6, 1); }
    px(x, '#4d3055', 0, 58, W, 1);
    ARCH.forEach(function (ax) { /* arch opening with depth */
      px(x, '#120814', ax, 72, 32, 40); px(x, '#120814', ax + 3, 68, 26, 4); px(x, '#120814', ax + 7, 65, 18, 3); px(x, '#120814', ax + 12, 63, 8, 2);
      px(x, '#24122a', ax, 72, 3, 40); px(x, '#24122a', ax + 3, 68, 3, 4); /* inner shade, left */
      px(x, '#5e3a64', ax + 12, 61, 8, 2); px(x, '#5e3a64', ax + 6, 63, 6, 2); px(x, '#5e3a64', ax + 20, 63, 6, 2); px(x, '#6e4876', ax + 14, 61, 4, 1); /* keystone */
      /* the crowd: three rows of heads in the arch */
      for (var rr = 0; rr < 3; rr++) for (var k = 0; k < 4; k++) { var hx = ax + 2 + k * 7 + (rr & 1) * 3, hy = 80 + rr * 9, col = ['#5a2f4e', '#4a3060', '#603040', '#3e3a5a'][(k + rr + ax) & 3];
        if (hx > ax + 27) continue; px(x, col, hx, hy + 4, 6, 8); px(x, col, hx + 1, hy, 4, 4); } });
    PIL.forEach(function (pxl) { px(x, '#4d3055', pxl - 3, 60, 8, 54); px(x, '#6e4876', pxl - 3, 60, 1, 54); px(x, '#2a1630', pxl + 4, 60, 1, 54); px(x, '#6e4876', pxl - 4, 58, 10, 3); px(x, '#6e4876', pxl - 4, 106, 10, 3); });
    /* banners between arches */
    [1, 3, 5, 7].forEach(function (n) { var bx = PIL[n] - 5; if (n === 7) bx -= 1; px(x, '#c9a227', bx - 1, 60, 12, 2); px(x, '#8a1424', bx, 62, 10, 22); px(x, '#a3182c', bx + 1, 62, 3, 22); px(x, '#8a1424', bx, 84, 4, 3); px(x, '#8a1424', bx + 6, 84, 4, 3);
      px(x, '#ffd84a', bx + 3, 68, 4, 4); px(x, '#1a0d1f', bx + 4, 69, 1, 1); px(x, '#1a0d1f', bx + 6, 69, 1, 1); px(x, '#ffd84a', bx + 3, 73, 4, 1); px(x, '#c9a227', bx, 62, 10, 1); });
    px(x, '#24122a', 0, 112, W, 3); px(x, '#5e3a64', 0, 111, W, 1);
    /* arena floor: warm stone in perspective */
    for (var row = 0; row < 8; row++) { var y = 115 + row * (4 + row), hh = 4 + row, base = row % 2 ? '#5a4552' : '#634b5a'; px(x, base, 0, y, W, hh); px(x, '#3e2c3a', 0, y, W, 1);
      var step = 12 + row * 5; for (var cx = (row % 2) * (step / 2); cx < W; cx += step) { px(x, '#3e2c3a', cx, y, 1, hh); if (R() < .3) px(x, '#715868', cx + 2, y + 1, 3, 1); } }
    /* the boss platform: a raised round dais */
    x.fillStyle = '#2a1a26'; x.beginPath(); x.ellipse(160, 144, 76, 17, 0, 0, 7); x.fill();
    x.fillStyle = '#7a6070'; x.beginPath(); x.ellipse(160, 141, 72, 15, 0, 0, 7); x.fill();
    x.fillStyle = '#8c7282'; x.beginPath(); x.ellipse(160, 140, 66, 12, 0, 0, 7); x.fill();
    for (i = 0; i < 18; i++) { var aa = i / 18 * Math.PI * 2; px(x, '#5a4552', 160 + Math.cos(aa) * 69, 141 + Math.sin(aa) * 14, 1, 2); }
    x.strokeStyle = '#a58c9a'; x.lineWidth = 1; x.beginPath(); x.ellipse(160, 140, 50, 8, 0, 0, 7); x.stroke();
    /* rune circle on the dais */
    for (i = 0; i < 12; i++) { var ra = i / 12 * Math.PI * 2; px(x, '#5e3a64', 160 + Math.cos(ra) * 42, 140 + Math.sin(ra) * 7, 2, 1); }
    BG = c;
    /* vignette */
    var v = document.createElement('canvas'); v.width = W; v.height = H; var vx = v.getContext('2d'), gr = vx.createRadialGradient(160, 100, 70, 160, 100, 210);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(8,2,12,.7)'); vx.fillStyle = gr; vx.fillRect(0, 0, W, H); VIG = v; }
  /* the pet's OWN sprite (stage, colours, gear) like the Spam City cages, keyed background; the stock species portrait is the fallback */
  var PF = { w: null, m: {} };
  function petImg(p, t) { var R = window.V2Render, w = S.st.w; if (!p || !w || !R || !R.petFrames || !R.spriteCanvas) return null; if (PF.w !== w) { PF.w = w; PF.m = {}; }
    var k = p.id + '|' + p.species + '|' + p.stage, fr = PF.m[k];
    if (fr === undefined) { fr = null; try { var mp = Object.assign({}, p, { art: Object.assign({}, p.art, { background: 'keyed', bgColor: '#ff00fe', pattern: 'none' }) }), F = R.petFrames(mp, w, { noHunger: true });
        if (F && F.length) fr = F.map(function (q) { return R.spriteCanvas(q, true); }); } catch (e) { fr = null; } PF.m[k] = fr; }
    return fr && fr.length ? fr[reduced() ? 0 : Math.floor((t || 0) / 300) % fr.length] : null; }
  /* ---- state */
  function set(st) { st = st || { mode: 'wait' }; var old = S.st || {}, hits = st.hits || [];
    if (old.boss && st.boss && old.boss.art === st.boss.art && st.mode === 'live' && hits.length > S.seen) { /* new hits since the last state: queue them */
      hits.slice(Math.max(S.seen, hits.length - 5)).forEach(function (h, i) { queueHit(h, i * 900); }); }
    if (st.mode === 'won' && old.mode === 'live') { S.conf = []; for (var i = 0; i < 60; i++) S.conf.push({ x: 160 + (Math.random() - .5) * 40, y: 70, vx: (Math.random() - .5) * 3, vy: -Math.random() * 3 - 1, c: ['#ffd84a', '#ff5ec7', '#5effb0', '#5ec2ff'][i % 4] }); }
    S.seen = hits.length; S.st = st; if (!S.hop.length) seatPets(); kick(); }
  var SLOT = [34, 286, 66, 254, 98, 222];
  function seatPets() { var hits = (S.st.hits || []).slice(-6); S.hop = hits.map(function (h, i) { return { h: h, x: SLOT[i % 6], y: 140 + (i % 2) * 6, t: -1 }; }); }
  function queueHit(h, delay) { var slot = S.hop.filter(function (p) { return p.h.petId === h.petId; })[0];
    if (!slot) { if (S.hop.length >= 6) S.hop.shift(); var i = S.hop.length; slot = { h: h, x: SLOT[i % 6], y: 140 + (i % 2) * 6, t: -1 }; S.hop.push(slot); S.hop.forEach(function (p, j) { p.x = SLOT[j]; p.y = 140 + (j % 2) * 6; }); }
    slot.h = h; slot.t = performance.now() + delay; slot.replay = 0; }
  /* between real hits, a seated attacker re-plays its own last hit now and then (grey number, no sound, the HP bar does not move) */
  function idle(now) { if (S.st.mode !== 'live' || !S.hop.length || now < (S.nextIdle || 0)) return; S.nextIdle = now + 3200 + Math.random() * 2600;
    if (S.hop.some(function (p) { return p.t > 0; })) return; var p = S.hop[Math.floor(Math.random() * S.hop.length)]; p.t = now; p.replay = 1; }
  /* ---- draw */
  function bossImg() { var b = S.st.boss; return b && b.art ? img(src('img/raids/' + b.art + '.png')) : null; }
  function draw(t) { var x = S.x; if (!x) return; if (window.V2Sharp) V2Sharp.begin(x, S.k); else { x.setTransform(S.k, 0, 0, S.k, 0, 0); x.imageSmoothingEnabled = false; }
    var rm = reduced(), st = S.st, mode = st.mode || 'wait', f = rm ? 0 : t, i; if (!rm) idle(t);
    if (!BG) buildBg(); x.drawImage(BG, 0, 0);
    /* torches on the pillars: flame + warm light on the wall */
    var lit = mode === 'won' ? '255,216,74' : '255,120,40';
    [PIL[1], PIL[3], PIL[5], PIL[7] - 1].forEach(function (tx, n) { var fl = rm ? 0 : Math.floor(f / 100 + n * 2) % 3, ty = 86;
      var gl = x.createRadialGradient(tx + 1, ty - 4, 1, tx + 1, ty - 4, 22 + fl * 2); gl.addColorStop(0, 'rgba(' + lit + ',.30)'); gl.addColorStop(1, 'rgba(' + lit + ',0)'); x.fillStyle = gl; x.fillRect(tx - 24, ty - 30, 50, 50);
      px(x, '#2b1928', tx - 1, ty, 4, 8); px(x, '#6e4876', tx - 2, ty - 1, 6, 2);
      px(x, '#ff5a1f', tx - 2, ty - 7 - fl, 6, 7 + fl); px(x, '#ffb03a', tx - 1, ty - 6 - fl, 4, 5 + fl); px(x, '#fff1a0', tx, ty - 3, 2, 3); });
    /* the crowd: eyes blink, heads bounce when a hit lands, gold eyes on a win */
    var cheer = S.flash > 0 || mode === 'won';
    ARCH.forEach(function (ax, i) { for (var rr = 0; rr < 3; rr++) for (var k = 0; k < 4; k++) { var hx = ax + 2 + k * 7 + (rr & 1) * 3; if (hx > ax + 27) continue;
      var up = cheer && ((k + rr + i + Math.floor(f / 120)) & 1) ? 2 : 0, ey = 81 + rr * 9 - up, bl = Math.floor(f / 170 + i * 7 + k * 3 + rr) % 29 === 0;
      if (up) { var col = ['#5a2f4e', '#4a3060', '#603040', '#3e3a5a'][(k + rr + ax) & 3]; px(x, col, hx + 1, ey - 1, 4, 4); }
      if (!bl) { var ec = mode === 'won' ? '#ffd84a' : rr === 0 ? '#ff5a4a' : '#c23a5a'; px(x, ec, hx + 1, ey + 1, 1, 1); px(x, ec, hx + 3, ey + 1, 1, 1); } } });
    /* lava seam around the dais: pulses, brighter on a hit */
    var pulse = rm ? .7 : .55 + Math.sin(f / 500) * .2 + (S.flash > 0 ? .3 : 0);
    x.strokeStyle = 'rgba(255,90,31,' + pulse.toFixed(2) + ')'; x.lineWidth = 2; x.beginPath(); x.ellipse(160, 145, 78, 18, 0, 0.1, Math.PI - 0.1); x.stroke();
    x.strokeStyle = 'rgba(255,216,120,' + (pulse * .6).toFixed(2) + ')'; x.lineWidth = 1; x.beginPath(); x.ellipse(160, 145, 78, 18, 0, 0.3, Math.PI - 0.3); x.stroke();
    /* the boss */
    var bi = bossImg(), bob = rm ? 0 : Math.round(Math.sin(f / 420) * 2), sh = S.shake > 0 ? Math.round((Math.random() - .5) * 4) : 0, bx = 160, base = 141;
    if (mode === 'escaped') base -= Math.min(160, ((f - (S.escT || (S.escT = f))) / 25));
    if (mode === 'live' || mode === 'load' || mode === 'wait') { /* aura behind the boss */
      var au = x.createRadialGradient(bx, base - 50, 6, bx, base - 50, 70), ac = mode === 'live' ? '255,60,90' : '150,90,200';
      au.addColorStop(0, 'rgba(' + ac + ',' + (0.28 + (rm ? 0 : Math.sin(f / 600) * .06)).toFixed(2) + ')'); au.addColorStop(1, 'rgba(' + ac + ',0)'); x.fillStyle = au; x.fillRect(bx - 80, base - 125, 160, 130); }
    if (bi) { var hgt = 108 + (rm ? 0 : Math.round(Math.sin(f / 420) * 1)), wid = Math.round(bi.naturalWidth / bi.naturalHeight * hgt);
      x.fillStyle = 'rgba(0,0,0,.45)'; x.beginPath(); x.ellipse(bx, base, wid / 2 - 6, 5, 0, 0, 7); x.fill();
      x.save(); if (mode === 'won') { x.translate(bx, base); x.rotate(-0.22); x.translate(-bx, -base); x.globalAlpha = 0.9; }
      if (mode === 'wait' || mode === 'load') x.filter = 'brightness(0)';
      else if (mode === 'won') x.filter = 'grayscale(1) brightness(.6)';
      else if (S.flash > 0) x.filter = 'brightness(2.6)';
      x.drawImage(bi, Math.round(bx - wid / 2) + sh, base - hgt + bob, wid, hgt); x.filter = 'none'; x.restore();
      if (mode === 'wait') { var q = Math.floor(f / 400) % 2; txt(x, '?', bx, base - 66 - q, '#ff5a4a', 16, 'center'); }
    } else { /* no boss yet: a horned shape in the fog with red eyes */
      x.fillStyle = 'rgba(0,0,0,.45)'; x.beginPath(); x.ellipse(bx, base, 34, 5, 0, 0, 7); x.fill();
      var sy0 = base + bob; x.fillStyle = '#0b0510';
      x.beginPath(); x.ellipse(bx, sy0 - 34, 30, 36, 0, 0, 7); x.fill(); x.beginPath(); x.ellipse(bx, sy0 - 76, 17, 15, 0, 0, 7); x.fill();
      x.beginPath(); x.ellipse(bx - 34, sy0 - 46, 12, 22, -0.5, 0, 7); x.fill(); x.beginPath(); x.ellipse(bx + 34, sy0 - 46, 12, 22, 0.5, 0, 7); x.fill();
      x.beginPath(); x.moveTo(bx - 14, sy0 - 84); x.lineTo(bx - 26, sy0 - 104); x.lineTo(bx - 6, sy0 - 88); x.fill(); x.beginPath(); x.moveTo(bx + 14, sy0 - 84); x.lineTo(bx + 26, sy0 - 104); x.lineTo(bx + 6, sy0 - 88); x.fill();
      if (Math.floor(f / 1900) % 6 !== 0) { var eg = x.createRadialGradient(bx, sy0 - 78, 1, bx, sy0 - 78, 14); eg.addColorStop(0, 'rgba(255,59,47,.45)'); eg.addColorStop(1, 'rgba(255,59,47,0)'); x.fillStyle = eg; x.fillRect(bx - 16, sy0 - 92, 32, 28);
        px(x, '#ff3b2f', bx - 9, sy0 - 79, 5, 2); px(x, '#ff3b2f', bx + 4, sy0 - 79, 5, 2); px(x, '#ffd0a0', bx - 8, sy0 - 79, 1, 1); px(x, '#ffd0a0', bx + 5, sy0 - 79, 1, 1); } }
    /* Lord Kek vs Moloch: the champion stands on the left and every hit is his strike */
    var ch = st.boss && st.boss.champion && mode !== 'wait' ? img(src('img/raids/' + st.boss.champion + '.png')) : null;
    if (ch) { var chh = 74, chw = Math.round(ch.naturalWidth / ch.naturalHeight * chh), lunge = S.flash > 0 ? 8 : 0; px(x, 'rgba(0,0,0,.35)', 40, 137, chw - 8, 5); x.drawImage(ch, 36 + lunge, 140 - chh + bob, chw, chh); }
    /* embers rising from the lava */
    if (!rm) for (i = 0; i < 14; i++) { var life = ((f / (14 + (i % 5) * 3)) + i * 37) % 90, ex2 = 82 + ((i * 53) % 156) + Math.sin((f / 400) + i) * 3, ey3 = 150 - life;
      px(x, life > 60 ? '#ff5a1f' : life > 25 ? '#ffb03a' : '#fff1a0', ex2, ey3, 1, life < 20 ? 2 : 1); }
    /* fog band */
    var fa = mode === 'wait' || mode === 'load' ? .10 : .045; for (i = 0; i < 6; i++) { var fx = ((f / (70 + i * 23)) + i * 70) % (W + 140) - 70; x.fillStyle = 'rgba(210,180,230,' + fa + ')'; x.beginPath(); x.ellipse(fx, 128 + (i % 3) * 7, 46, 6, 0, 0, 7); x.fill(); x.beginPath(); x.ellipse(fx + 20, 125 + (i % 3) * 7, 26, 4, 0, 0, 7); x.fill(); }
    /* hit sparks */
    S.parts = (S.parts || []).filter(function (q) { q.x += q.vx; q.y += q.vy; q.vy += 0.12; q.l--; if (q.l > 0) px(x, q.c, q.x, q.y, q.l > 10 ? 2 : 1, q.l > 10 ? 2 : 1); return q.l > 0; });
    if (S.burst && !rm) { var bt = (performance.now() - S.burst.t) / 260; if (bt < 1) { x.strokeStyle = 'rgba(255,244,214,' + (1 - bt).toFixed(2) + ')'; x.lineWidth = 2; for (i = 0; i < 8; i++) { var ba = i * Math.PI / 4 + .3, r1 = 6 + bt * 18, r2 = r1 + 8;
      x.beginPath(); x.moveTo(S.burst.x + Math.cos(ba) * r1, S.burst.y + Math.sin(ba) * r1); x.lineTo(S.burst.x + Math.cos(ba) * r2, S.burst.y + Math.sin(ba) * r2); x.stroke(); } } else S.burst = null; }
    /* attacking pets */
    S.hop.forEach(function (p, n) { var own = petImg(p.h.pet, f), im = own || img(spSrc(p.h.sp)), tt = p.t > 0 ? f - p.t : -1, dx = 0, dy = 0;
      if (!rm && tt >= 0 && tt < 700) { var u = tt / 700, toward = (bx - p.x) * 0.55; dx = Math.round(toward * Math.sin(u * Math.PI)); dy = -Math.round(Math.sin(u * Math.PI) * 26);
        if (tt > 330 && !p.struck) { p.struck = 1; strike(p.h, !!p.replay); } }
      else if (tt >= 700) { p.t = -1; p.struck = 0; }
      else dy = rm ? 0 : -(Math.floor(f / 260 + n) % 4 === 0 ? 1 : 0);
      px(x, 'rgba(0,0,0,.35)', p.x - 8, p.y + 15, 16, 3);
      if (im) { var z = own ? 30 : 24; x.drawImage(im, p.x - z / 2 + dx, p.y + 16 - z + dy, z, z); } else px(x, '#4fd18b', p.x - 6 + dx, p.y + dy, 12, 12); });
    /* damage pops */
    S.pops = S.pops.filter(function (q) { var a = (performance.now() - q.t) / 1100; if (a > 1 || rm) return false; var y = q.y - a * 26;
      txt(x, '-' + fmt(q.v), q.x, y, q.rp ? '#b9aed0' : q.crit === 3 ? '#ff5ec7' : q.crit === 2 ? '#ffd84a' : '#fff4d6', q.crit > 1 ? 10 : 8, 'center');
      if (q.crit > 1 && a < .6) txt(x, q.crit + ' TIMES!', q.x, y - 11, '#ffd84a', 6, 'center'); return true; });
    /* confetti */
    if (mode === 'won' && !rm) S.conf.forEach(function (c) { c.x += c.vx; c.y += c.vy; c.vy += 0.05; if (c.y > 182) { c.y = -4; c.vy = Math.random(); } px(x, c.c, c.x, c.y, 2, 2); });
    if (VIG) x.drawImage(VIG, 0, 0); if (S.flash > 3) { x.fillStyle = 'rgba(255,240,220,.18)'; x.fillRect(0, 0, W, H); }
    hud(x, f, st, mode);
    if (S.shake > 0) S.shake--; if (S.flash > 0) S.flash--; }
  function strike(h, replay) { var hx = 160 + (Math.random() - .5) * 30, hy = 75 + (Math.random() - .5) * 30; S.burst = { x: hx, y: hy, t: performance.now() }; S.parts = S.parts || [];
    for (var i = 0; i < (replay ? 6 : 16); i++) { var a = Math.random() * Math.PI * 2, v = 1 + Math.random() * 2.2; S.parts.push({ x: hx, y: hy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1, l: 14 + Math.random() * 10 | 0, c: ['#fff4d6', '#ffd84a', '#ff5a4a', '#ff5ec7'][i & 3] }); }
    S.pops.push({ v: h.hit, crit: h.crit || 1, x: 160 + (Math.random() - .5) * 40, y: 70, t: performance.now(), rp: replay }); S.shake = replay ? 4 : h.crit > 1 ? 14 : 8; S.flash = replay ? 2 : 5;
    if (replay) return; S.last = h; try { if (window.V2Sfx && V2Sfx.hit) V2Sfx.hit(); } catch (e) { } }
  function hud(x, f, st, mode) { var b = st.boss || {}, name = String(b.name || (mode === 'wait' ? 'A NEW BOSS' : 'RAID BOSS')).toUpperCase();
    /* name plate */
    px(x, 'rgba(26,13,31,.82)', 3, 3, W - 6, 24); px(x, '#c9a227', 3, 3, W - 6, 1); px(x, '#7a5a14', 3, 26, W - 6, 1);
    txt(x, name.length > 26 ? name.slice(0, 25) + '.' : name, 8, 6, '#fff4d6', 8);
    if (mode === 'load') { txt(x, 'READING THE CHAIN' + '...'.slice(0, 1 + Math.floor(f / 400) % 3), 8, 17, '#ffc93c', 6); }
    else if (mode === 'wait') { txt(x, st.nextIn != null ? 'ARRIVES IN ' + fmt(st.nextIn) + ' BLOCKS' : 'WAITING FOR THE NEXT BOSS', 8, 17, '#ffc93c', 6); }
    else { /* HP bar, segmented, with a white damage trail */
      var pct = st.hp ? Math.max(0, Math.min(1, st.left / st.hp)) : 0; S.hpShow += (pct - S.hpShow) * 0.06; if (Math.abs(S.hpShow - pct) < .002) S.hpShow = pct;
      var bw = W - 16 - 44, by = 17; px(x, '#1a0d1f', 7, by - 1, bw + 2, 8); px(x, '#fff4d6', 8, by, Math.round(bw * Math.max(pct, S.hpShow)), 7);
      var col = pct > .6 ? '#3ddc5a' : pct > .3 ? '#f2c81e' : pct > .1 ? '#ff3b2f' : (Math.floor(f / 250) % 2 ? '#ff1a3a' : '#ffe14a');
      px(x, col, 8, by, Math.round(bw * pct), 6); px(x, 'rgba(255,255,255,.35)', 8, by, Math.round(bw * pct), 2);
      for (var s = 1; s < 20; s++) px(x, '#1a0d1f', 8 + Math.round(bw * s / 20), by, 1, 6);
      txt(x, mode === 'won' ? 'DOWN!' : mode === 'escaped' ? 'GONE' : Math.ceil(pct * 100) + '%', W - 8, by - 1, mode === 'won' ? '#ffd84a' : '#fff4d6', 7, 'right'); }
    /* bottom ticker: last hit / blocks left / result */
    var line = '', col2 = '#fff4d6', h = S.last || (st.hits && st.hits[st.hits.length - 1]);
    if (mode === 'live') line = (h ? 'LAST HIT: #' + h.petId + ' -' + fmt(h.hit) : 'NO HITS YET. BE FIRST!') + (st.blocksLeft != null ? '  -  ' + fmt(st.blocksLeft) + ' BLOCKS LEFT' : '');
    else if (mode === 'won') { line = 'DEFEATED!' + (st.killPet ? ' FINAL BLOW #' + st.killPet : ''); col2 = '#ffd84a'; }
    else if (mode === 'escaped') { line = 'IT ESCAPED. NO LOOT THIS TIME.'; col2 = '#ff9a8a'; }
    else if (mode === 'load') line = 'THE BOSS IS IN THE FOG...';
    else line = 'TAP THE BOSS TO LEARN HOW RAIDS WORK';
    px(x, 'rgba(26,13,31,.78)', 0, H - 13, W, 13); txt(x, line, W / 2, H - 10, col2, 6, 'center', false);
    if (mode === 'live' && !reduced() && Math.floor(f / 600) % 2) txt(x, 'TAP TO ATTACK', 160, 40, '#ffc93c', 6, 'center'); }
  /* ---- loop */
  function frame(t) { S.raf = 0; if (!S.c) return; draw(t); if (!reduced() && S.vis && !document.hidden) S.raf = requestAnimationFrame(frame); }
  function kick() { if (!S.c) return; if (!S.raf) { if (reduced()) draw(0); else S.raf = requestAnimationFrame(frame); } }
  function fit() { var c = S.c; if (!c) return; if (window.V2Sharp) S.k = V2Sharp.fit(c, W, H); else { var r = c.getBoundingClientRect(), d = window.devicePixelRatio || 1; S.k = Math.max(1, Math.min(8, Math.ceil((r.width || W) * d / W))); c.width = W * S.k; c.height = H * S.k; c.style.imageRendering = 'pixelated'; } }
  function mount(c, opt) { if (!c || !c.getContext) return; S.c = c; S.x = c.getContext('2d'); S.onBoss = opt && opt.onBoss; fit();
    if (!c.dataset.rs) { c.dataset.rs = '1';
      window.addEventListener('resize', function () { fit(); kick(); });
      c.addEventListener('click', function (e) { var r = c.getBoundingClientRect(), lx = (e.clientX - r.left) / r.width * W, ly = (e.clientY - r.top) / r.height * H;
        if (lx > 100 && lx < 220 && ly > 30 && ly < 145) { if (S.onBoss) S.onBoss(S.st); }
        else S.hop.forEach(function (p) { if (Math.abs(lx - p.x) < 12 && Math.abs(ly - p.y - 4) < 14) location.href = 'pet.html?id=' + p.h.petId; }); });
      if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { S.vis = es[0].isIntersecting; if (S.vis) kick(); }).observe(c);
      document.addEventListener('visibilitychange', function () { if (!document.hidden) kick(); });
      if (RM.addEventListener) RM.addEventListener('change', kick); }
    kick(); }
  /* demo raid for mockups and previews (never used with real data) */
  function demo(boss) { var hits = [], left = 412000, n = 0, names = ['Kakilu', 'Bokopo', 'Newo', 'Chimi', 'Zurupip', 'Wonoon'];
    var st = { mode: 'live', boss: boss || { name: 'Dragon Kek', art: 'DRAGONKEK' }, hp: 1000000, left: left, blocksLeft: 211, hits: hits };
    function more() { if (!S.c) return; var crit = Math.random() < .2 ? (Math.random() < .25 ? 3 : 2) : 1, hit = Math.round((4000 + Math.random() * 16000) * crit);
      hits.push({ petId: 1200 + (n * 37) % 900, name: names[n % 6], sp: SP[(n * 5) % SP.length], hit: hit, crit: crit }); n++; st.left = Math.max(0, st.left - hit);
      set(Object.assign({}, st, { hits: hits.slice() })); S.demoT = setTimeout(more, 1400 + Math.random() * 900); }
    S.demo = 1; set(st); clearTimeout(S.demoT); S.demoT = setTimeout(more, 600); }
  window.V2RaidScene = { mount: mount, set: set, demo: demo, _state: function () { return S; } };
  /* raid.html: paint at once (before the chain is read); js/v2-raid.js calls set() with the real raid. Tap the boss = the attack box. */
  function boot() { var c = document.getElementById('rsCanvas'); if (!c) return; var p = document.getElementById('raidPanel'); if (p) p.classList.add('rs-on');
    mount(c, { onBoss: function () { if (window.V2Raid && V2Raid.attack && document.getElementById('rdGo')) return V2Raid.attack(); /* attack-tap (Nov 24 2026): TAP TO ATTACK attacks (or asks for a pet first) instead of only scrolling */ var a = document.querySelector('#raidBox .rd-atk') || document.querySelector('#raidBox .rd-how') || document.getElementById('raidBox'); if (!a) return;
      if (a.tagName === 'DETAILS') a.open = true; a.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' }); } });
    if (/[?&]raiddemo=1\b/.test(location.search)) demo(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
