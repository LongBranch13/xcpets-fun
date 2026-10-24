/* XCPETS v2: LORD KEK FAREWELL (kek-farewell-v2, owner approved Oct 24 2026 12:09 AM CT; design /workspace/xcpets/design/lord-kek-farewell-research.md).
 * Same frame as the Bitcoin Wizard farewell (js/v2-wizard-farewell.js): 160x90 pixel canvas x4, 420 frames at 30 fps (~14 s), one caption at a time,
 * burn counter, frost vault, white flash, egg drop, footer. 6 beats: COMMUNITY PET (Mythic Lord Kek on his throne) -> ~Godhead~ (Eye of Horus,
 * pyramid, rising coins) -> 7 sacred artifacts flare, LORDKEK defeated -> Into Cold Storage (Nakamoto + Wizard silhouettes inside) -> flash,
 * 'Mythic. Kept cold forever.' -> STARLORDKEK (the one who defeated him) 'the real and only LORD' + a Lord Kek egg; the last sub-line hands off to
 * the NEXT community pet (FUNTRUMP, read by the caller from V2Rules.ACTIVATE_FUNTRUMP_BLOCK), never to Starlord Kek.
 * Triggered by CHAIN STATE (w.kekMythic), autoplays once per browser (seen-flag keyed by the trigger tx) for returning visitors only,
 * 'Watch the farewell' in Cold Storage replays it, ?preview=kek previews it. Reduced motion: one static frame. DISPLAY ONLY (no rule reads it).
 * window.V2KekFarewell = { draw, play, maybeAutoplay, FRAMES, SEEN_KEY, seen, previewRequested } */
(function (root) {
  'use strict';
  var W = 160, H = 90, S = 4, FRAMES = 420, GOAL = 6906900, SEEN_KEY = 'xcpets-v2-kek-farewell-seen';
  var C = { bg: '#141a2e', bg2: '#1b2240', ink: '#e8f0ff', dim: '#6f7fa8', gold: '#ffc93c', gold2: '#c98a12', gold3: '#7a4f0a', lapis: '#2a4fbf', lapis2: '#1a3380',
    ice: '#9fe8ff', ice2: '#33d6ff', ice3: '#e9fbff', stone: '#4b5563', stone2: '#2f3742', cyan: '#33d6ff', red: '#ff2a2a', red2: '#a3121a' };
  var ART = ['#ff5a5a', '#ffb13c', '#ffe45a', '#6dff7a', '#3cd6ff', '#7a8cff', '#e27aff'];
  function px(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); }
  function coin(ctx, x, y) { px(ctx, x - 2, y - 2, 5, 5, C.gold2); px(ctx, x - 1, y - 1, 3, 3, C.gold); }
  function star(ctx, x, y, c) { px(ctx, x, y - 1, 1, 3, c); px(ctx, x - 1, y, 3, 1, c); }
  /* sprite(): a {width,height,data} frame at scale s; pixels equal to the frame's corner (its background) are skipped; tint = draw as a silhouette */
  function sprite(ctx, img, x, y, s, alpha, tint) { if (!img) return; ctx.globalAlpha = alpha == null ? 1 : alpha; var d = img.data;
    for (var j = 0; j < img.height; j++) for (var i = 0; i < img.width; i++) { var k = 4 * (j * img.width + i); if (d[k + 3] === 0) continue; if (d[k] === d[0] && d[k + 1] === d[1] && d[k + 2] === d[2]) continue;
      ctx.fillStyle = tint || ('rgb(' + d[k] + ',' + d[k + 1] + ',' + d[k + 2] + ')'); ctx.fillRect(x + i * s, y + j * s, Math.ceil(s), Math.ceil(s)); } ctx.globalAlpha = 1; }
  function vault(ctx, t, open, frost) { px(ctx, 112, 40, 38, 37, C.stone2); px(ctx, 113, 41, 36, 35, C.stone); px(ctx, 113, 41, 36, 3, C.ice); px(ctx, 112, 38, 38, 3, C.ice3);
    for (var i = 0; i < 6; i++) px(ctx, 114 + i * 6, 44, 2, 2 + (i % 3), C.ice3);
    var dw = Math.round(24 * open); px(ctx, 119, 50, 24, 26, '#0b1220'); if (dw < 24) { px(ctx, 119 + dw, 50, 24 - dw, 26, C.stone2); px(ctx, 121 + dw, 60, 2, 4, C.gold); }
    if (frost) { ctx.globalAlpha = frost; px(ctx, 119, 50, 24, 26, C.ice); ctx.globalAlpha = 1; } px(ctx, 108, 76, 46, 2, C.ice2); }
  /* Lord Kek's throne: gold-framed back with lapis nemes stripes, wing finials, stepped dais */
  function throne(ctx, x, a) { ctx.globalAlpha = a; px(ctx, x, 24, 44, 46, '#1a1006'); px(ctx, x + 1, 25, 42, 44, C.gold2); px(ctx, x + 3, 27, 38, 40, '#3a2408');
    for (var i = 0; i < 6; i++) px(ctx, x + 5 + i * 6, 29, 3, 36, i % 2 ? C.lapis2 : C.lapis);
    px(ctx, x + 3, 27, 38, 2, C.gold); px(ctx, x - 3, 22, 8, 4, C.gold); px(ctx, x + 39, 22, 8, 4, C.gold); px(ctx, x - 2, 21, 3, 1, '#fff3c0'); px(ctx, x + 43, 21, 3, 1, '#fff3c0');
    px(ctx, x - 4, 69, 52, 4, C.gold2); px(ctx, x - 4, 69, 52, 1, C.gold); px(ctx, x - 7, 73, 58, 4, C.gold3); px(ctx, x - 7, 73, 58, 1, C.gold2); ctx.globalAlpha = 1; }
  /* Eye of Horus + pyramid glyphs (pixel), pulsing gold */
  function pyramid(ctx, cx, top, a) { ctx.globalAlpha = a; for (var r = 0; r < 18; r++) { px(ctx, cx - r, top + r, 2 * r + 1, 1, r % 4 === 3 ? C.gold2 : C.gold); } px(ctx, cx - 18, top + 18, 37, 1, C.gold3);
    eye(ctx, cx - 5, top + 7); ctx.globalAlpha = 1; }
  function eye(ctx, x, y) { px(ctx, x + 1, y, 9, 1, '#1a1006'); px(ctx, x, y + 1, 11, 3, '#fff8e0'); px(ctx, x + 4, y + 1, 3, 3, C.lapis2); px(ctx, x + 5, y + 2, 1, 1, '#000');
    px(ctx, x + 1, y + 4, 9, 1, '#1a1006'); px(ctx, x + 4, y + 5, 1, 3, '#1a1006'); px(ctx, x + 7, y + 5, 1, 2, '#1a1006'); px(ctx, x + 8, y + 7, 3, 1, '#1a1006'); px(ctx, x - 1, y - 1, 3, 1, '#1a1006'); }
  /* a generic sacred artifact: faceted gem on a little gold mount; lit = 0..1, flare = 0..1 burst */
  function artifact(ctx, x, y, c, lit, flare) { if (flare > 0) { ctx.globalAlpha = flare * 0.8; px(ctx, x - 6, y, 13, 1, '#ffffff'); px(ctx, x, y - 6, 1, 13, '#ffffff'); px(ctx, x - 3, y - 3, 7, 7, c); ctx.globalAlpha = 1; }
    ctx.globalAlpha = 0.35 + 0.65 * lit; px(ctx, x - 2, y + 3, 5, 1, C.gold2); px(ctx, x - 1, y - 3, 3, 1, c); px(ctx, x - 2, y - 2, 5, 4, c); px(ctx, x - 1, y + 2, 3, 1, c); px(ctx, x - 1, y - 2, 1, 1, '#ffffff');
    if (lit > 0.5) { ctx.globalAlpha = 0.25 * lit; px(ctx, x - 4, y - 4, 9, 9, c); } ctx.globalAlpha = 1; }
  /* STARLORDKEK (from the Series 13 card): green Pepe brow + eyes over a black Vader-style mask, red eyes, white fur collar, black cloak, dark armour,
   * gloved hands on the hilt of a sword planted point-down. 30x46 grid, ink outline, drawn at scale s. */
  var SLK = (function () { var w = 30, h = 46, g = [], i, y, x; for (i = 0; i < h; i++) g.push(new Array(w).fill(0));
    function set(x, y, c) { if (x >= 0 && y >= 0 && x < w && y < h) g[y][x] = c; } function hl(a, b, y, c) { for (var q = a; q <= b; q++) set(q, y, c); }
    for (y = 18; y < 46; y++) { var hw = Math.min(14, 8 + Math.floor((y - 18) / 4)); hl(15 - hw, 14 + hw, y, y % 7 === 0 ? 'k' : 'K'); set(15 - hw, y, 'q'); set(14 + hw, y, 'q'); }   // cloak
    for (y = 19; y < 33; y++) hl(10, 19, y, 'a'); for (y = 19; y < 33; y += 3) hl(11, 18, y, 'A'); for (y = 20; y < 33; y++) set(15, y, 'A');                                  // armour
    for (y = 15; y < 21; y++) { var fw = 10 - Math.abs(y - 17); hl(15 - fw - 1, 14 + fw + 1, y, (x = (y * 7) % 3) ? 'W' : 'w'); } for (x = 4; x < 26; x += 3) set(x, 18 + (x % 2), 'w');    // fur collar
    for (y = 2; y < 9; y++) { var bw = y < 4 ? 5 : 7; hl(15 - bw, 14 + bw, y, 'G'); set(15 - bw, y, 'h'); } hl(9, 12, 1, 'G'); hl(17, 20, 1, 'G');                                 // green Pepe brow + eye bulges
    hl(9, 12, 5, 'E'); hl(17, 20, 5, 'E'); set(11, 5, 'R'); set(12, 5, 'R'); set(19, 5, 'R'); set(20, 5, 'R'); hl(9, 12, 4, 'k'); hl(17, 20, 4, 'k');                           // lids + red eyes
    for (y = 7; y < 16; y++) { var mw = y < 9 ? 8 : y < 14 ? 8 : 6; hl(15 - mw, 14 + mw, y, 'M'); } hl(7, 22, 7, 'm'); for (y = 10; y < 15; y++) { set(12, y, 'm'); set(15, y, 'm'); set(18, y, 'm'); } // mask + grille
    hl(11, 19, 9, 'R'); hl(12, 18, 9, 'r');                                                                                                                                   // red visor glint
    for (y = 25; y < 46; y++) { set(14, y, 'S'); set(15, y, 's'); } set(14, 45, 0); hl(10, 19, 24, 'X'); hl(10, 19, 23, 'x'); for (y = 17; y < 23; y++) { set(14, y, 'T'); set(15, y, 'T'); } hl(13, 16, 16, 'S'); // sword
    for (y = 19; y < 23; y++) { hl(12, 13, y, 'N'); hl(16, 17, y, 'N'); }                                                                                                   // gloves on the hilt
    var o = g.map(function (r) { return r.slice(); }); for (y = 0; y < h; y++) for (x = 0; x < w; x++) if (!g[y][x] && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(function (d) { var X = x + d[0], Y = y + d[1]; return X >= 0 && Y >= 0 && X < w && Y < h && g[Y][X]; })) o[y][x] = 'n';
    return { w: w, h: h, g: o }; })();
  var SLK_PAL = { n: '#000000', K: '#15151c', k: '#24242f', q: '#34344a', a: '#3a3f4a', A: '#5b6270', W: '#f2f2f2', w: '#c9c9d2', G: '#5aa83c', h: '#86cf5e', E: '#2a0a0a', R: '#ff2a2a', r: '#ff8a8a',
    M: '#0d0d12', m: '#4a4a58', S: '#d7dde6', s: '#8b95a5', X: '#8b95a5', x: '#c0c6d0', T: '#6b4a2a', N: '#222228' };
  function starlord(ctx, x, y, s, a) { ctx.globalAlpha = a; for (var j = 0; j < SLK.h; j++) for (var i = 0; i < SLK.w; i++) { var k = SLK.g[j][i]; if (!k) continue; ctx.fillStyle = SLK_PAL[k]; ctx.fillRect(x + i * s, y + j * s, Math.ceil(s), Math.ceil(s)); } ctx.globalAlpha = 1; }
  var Q = [];
  function text(s, x, y, c, size) { Q.push([s, x, y, c, size]); }
  function flushText(ctx) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.lineJoin = 'round';
    Q.forEach(function (q) { var fs = q[4] >= 9 ? 32 : q[4] >= 7 ? 22 : q[4] >= 5 ? 18 : 16; ctx.font = 'bold ' + fs + 'px monospace'; var m = ctx.measureText(q[0]), wd = (m && m.width) || 0, cx = Math.round(q[1] * S), y0 = Math.round(q[2] * S);
      ctx.globalAlpha = 0.72; ctx.fillStyle = '#05080a'; ctx.fillRect(Math.round(cx - wd / 2 - 8), y0 - 4, Math.round(wd + 16), fs + 10); ctx.globalAlpha = 1;
      ctx.lineWidth = 4; ctx.strokeStyle = '#000'; ctx.strokeText(q[0], cx, y0); ctx.fillStyle = q[3]; ctx.fillText(q[0], cx, y0); }); Q = []; }
  function fmt(n) { return Math.round(n).toLocaleString('en-US'); }
  /** draw(ctx, t, sp): sp = { kek: [Mythic Lord Kek frames, LORDKEK card in hand], egg: [Lord Kek egg frames], nakamoto: [frames], wizard: [frames], total, next: 'FUNTRUMP …' } */
  function draw(ctx, t, sp) { Q = []; sp = sp || {}; ctx.setTransform(S, 0, 0, S, 0, 0); ctx.imageSmoothingEnabled = false;
    var raise = 50, god = 170, walk = 260, flash = 300, slk = 330, hand = 378, total = sp.total || GOAL;
    px(ctx, 0, 0, W, H, C.bg); for (var s = 0; s < 22; s++) { var sx = (s * 37 + 11) % W, sy = (s * 23 + 5) % 52; if ((s + (t >> 3)) % 3) px(ctx, sx, sy, 1, 1, C.dim); }
    px(ctx, 0, 77, W, 13, C.bg2);
    if (t >= slk) { var ga = Math.min(1, (t - slk) / 30); for (var r = 6; r > 0; r--) { ctx.globalAlpha = ga * 0.09 * (7 - r) / 2; ctx.fillStyle = r % 2 ? C.red2 : C.red; ctx.beginPath(); ctx.arc(86, 48, r * 7, 0, 7); ctx.fill(); }
      ctx.globalAlpha = 1; for (var ry = 0; ry < 12; ry++) { var ang = ry / 12 * 6.283 + t / 60; ctx.globalAlpha = ga * 0.35; px(ctx, 86 + Math.cos(ang) * 36, 48 + Math.sin(ang) * 30, 2, 2, C.red); } ctx.globalAlpha = 1; }
    var open = t < walk ? 0 : t < flash ? Math.min(1, (t - walk) / 14) : Math.max(0, 1 - (t - flash) / 8), frost = t >= flash ? Math.min(0.55, (t - flash) / 30) : 0;
    vault(ctx, t, open, frost);
    if (open > 0.5) { var bob = (t >> 4) % 2; if (sp.nakamoto) sprite(ctx, sp.nakamoto[(t >> 3) % sp.nakamoto.length], 120, 58 + bob, 0.5, 0.75, '#0f2a3a'); if (sp.wizard) sprite(ctx, sp.wizard[(t >> 3) % sp.wizard.length], 130, 57 + (1 - bob), 0.5, 0.75, '#1a2a4a'); }
    throne(ctx, 14, t < walk ? 1 : t < slk ? 0.85 : 0.55);
    // Lord Kek: seated at 1.5x (48 px) on the throne, dims as he is defeated, then walks into the vault, shrinking to fit the door
    var kx = 12, ky = 24, ks = 1.5, ka = 1;
    if (t >= raise && t < god) ky -= (t >> 3) % 2;
    if (t >= god + 70 && t < walk) ka = 1 - 0.45 * Math.min(1, (t - god - 70) / 20) + ((t >> 2) % 2) * 0.08;
    if (t >= walk) { var u = Math.min(1, (t - walk) / 34); kx = 12 + u * 108; ks = 1.5 - u * 0.85; ky = 24 + u * (76 - 24 - 32 * ks - 0) + u * (32 * 1.5 - 32 * 1.5); ky = 76 - 32 * ks - (1 - u) * 4 + ((t >> 2) % 2 && u < 1 ? -1 : 0); ka = 0.55 + 0.45 * (1 - u) ; if (t > walk + 30) ka *= Math.max(0, 1 - (t - walk - 30) / 8); }
    if (t < flash && sp.kek && ka > 0) sprite(ctx, sp.kek[(t >> 3) % sp.kek.length], kx, ky, ks, ka);
    // ~Godhead~: pyramid + Eye of Horus glow, coins rise off the throne
    if (t >= raise && t < god + 20) { var pa = Math.min(1, (t - raise) / 20) * (t > god ? Math.max(0, 1 - (t - god) / 20) : 1) * (0.75 + 0.25 * Math.sin(t / 5)); pyramid(ctx, 86, 26, pa); eye(ctx, 31, 17);
      for (var k = 0; k < 9; k++) { var v = ((t - raise) / 45 + k / 9) % 1; if (t - raise < k * 5) continue; var cx2 = 22 + k * 4 + Math.sin(v * 6 + k) * 4, cy2 = 62 - v * 56; if (v < 0.4) star(ctx, cx2, cy2, C.gold); else coin(ctx, cx2, cy2); } }
    // 7 sacred artifacts in an arc, flaring one by one
    if (t >= god && t < walk + 10) { var fa = t >= walk ? 1 - (t - walk) / 10 : 1; ctx.globalAlpha = fa;
      for (var n = 0; n < 7; n++) { var on = god + 8 + n * 9, ang2 = Math.PI * (1.05 + n * 0.15), ax = 86 + Math.cos(ang2) * 26, ay = 50 + Math.sin(ang2) * 26;
        if (t < god + n * 3) continue; var lit = t < on ? 0 : 1, fl = t >= on && t < on + 10 ? 1 - (t - on) / 10 : 0; artifact(ctx, ax, ay + (t >> 4) % 2 * (n % 2), ART[n], lit * fa, fl * fa);
        if (t >= god + 72 && t < god + 90) { ctx.globalAlpha = 0.6 * fa; px(ctx, Math.min(ax, 36), Math.min(ay, 44), Math.abs(ax - 36), 1, ART[n]); ctx.globalAlpha = fa; } } ctx.globalAlpha = 1; }
    // STARLORDKEK rises in the red glow; a Lord Kek egg drops onto the empty throne
    if (t >= slk) { var sa = Math.min(1, (t - slk) / 24); starlord(ctx, 67, 21 + Math.round((1 - sa) * 8), 1.25, sa);
      var ea = Math.min(1, Math.max(0, (t - slk - 20) / 24)), ef = sp.egg ? sp.egg[(t >> 3) % sp.egg.length] : null; if (ea > 0) sprite(ctx, ef, 20, 37 - Math.round((1 - ea) * 14), 1.0, ea); }
    var cap = t < raise ? 'COMMUNITY PET' : t < god ? '~Godhead~' : t < walk ? 'A sacrifice of 7 sacred artifacts has been made' : t < flash ? 'Into Cold Storage' : t < slk ? 'Mythic. Kept cold forever.' : 'the real and only LORD';
    text(cap, 80, 4, C.gold, t < raise ? 9 : 5);
    if (t < raise) text('₿ ' + fmt(total) + ' burned', 80, 15, '#ffffff', 7);
    else if (t < god) text('All Pepes worship Lord Kek', 80, 13, '#ffffff', 5);
    else if (t < walk) { if (t >= god + 64) text('and LORDKEK has been defeated.', 80, 13, '#ffffff', 5); }
    else if (t < slk) text('₿ ' + fmt(total) + ' burned', 80, 13, '#ffffff', 5);
    else text(t < hand || !sp.next ? 'After the great victory over LORDKEK' : sp.next, 80, 13, t < hand || !sp.next ? '#ffffff' : C.ice2, 5);
    if (t >= flash && t < flash + 14) { ctx.setTransform(S, 0, 0, S, 0, 0); ctx.globalAlpha = 1 - (t - flash) / 14; px(ctx, 0, 0, W, H, '#ffffff'); ctx.globalAlpha = 1; }
    text('Every XCPETS burn counted', 80, 80, C.cyan, 4);
    flushText(ctx); }
  function seenTx() { try { return localStorage.getItem(SEEN_KEY); } catch (e) { return null; } }
  function previewRequested() { try { return new URLSearchParams(location.search).get('preview') === 'kek'; } catch (e) { return false; } }
  function reduced() { try { return window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }
  function play(o) { o = o || {}; var ov = document.createElement('div'); ov.className = 'reveal on returnov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'Lord Kek farewell');
    ov.innerHTML = '<div class="box wide" style="text-align:center"><canvas width="' + W * S + '" height="' + H * S + '" class="returncv" style="width:' + W * S + 'px;max-width:100%;image-rendering:pixelated"></canvas>' +
      '<p class="small muted retinfo"></p><div class="row" style="justify-content:center"><button class="btn retclose" type="button">Close</button></div></div>';
    ov.querySelector('.retinfo').textContent = o.info || ''; document.body.appendChild(ov); var cv = ov.querySelector('canvas'), ctx = cv.getContext('2d'), t = 0, stop = false, last = 0;
    function esc(e) { if (e.key === 'Escape') done(); }
    function done() { if (stop) return; stop = true; document.removeEventListener('keydown', esc); ov.remove(); if (o.onDone) o.onDone(); }
    ov.querySelector('.retclose').onclick = done; ov.addEventListener('click', function (e) { if (e.target === ov) done(); }); document.addEventListener('keydown', esc); ov.querySelector('.retclose').focus();
    if (reduced()) { draw(ctx, 400, o.sprites); return { el: ov, close: done }; }
    (function step(ts) { if (stop) return; if (!last || ts - last >= 33) { last = ts || 0; draw(ctx, Math.min(t, FRAMES - 1), o.sprites); t++; } if (t < FRAMES + 60) requestAnimationFrame(step); else setTimeout(function () { if (!stop) done(); }, 4000); })();
    return { el: ov, close: done }; }
  /** maybeAutoplay(w, o, returning): ?preview=kek plays; else once per browser after w.kekMythic, only for a returning visitor (else just mark seen). */
  function maybeAutoplay(w, o, returning) { if (previewRequested()) { play(o); return true; } var x = w && w.kekMythic; if (!x) return false;
    var key = String(x.tx || x.block); if (seenTx() === key) return false; try { localStorage.setItem(SEEN_KEY, key); } catch (e) { } if (!returning) return false; play(o); return true; }
  root.V2KekFarewell = { W: W, H: H, S: S, FRAMES: FRAMES, SEEN_KEY: SEEN_KEY, draw: draw, play: play, maybeAutoplay: maybeAutoplay, seen: seenTx, previewRequested: previewRequested };
})(typeof window !== 'undefined' ? window : this);
