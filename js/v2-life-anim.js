/* XCPETS life animations (branch pixel-anims-1031, owner Oct 31 2026 4:50 PM CT [pt2513u]: "Do them all" = an 8-bit animation for every game event
 * that had none). Batch 1: hatching, feeding, stage-ups (+ a bigger Mythic scene) and starvation death.
 * DISPLAY ONLY: reads the replayed world (w.log, pets) after replay; never touches rules, tags, burns, costs or the replay.
 * LAZY: js/v2.js injects this file only when there is something to show (or a ?anim= preview), so first page load is unchanged.
 * Same pixel set-up as js/v2-cem-anim.js: one 128x80 scene, whole pixels scaled by a whole number (image-rendering: pixelated), 10 frames a second.
 * Tap / click / any key skips. prefers-reduced-motion: one still key frame, closes after 3 s (the hatch scene is skipped and the review opens).
 *   hatch    eggs wobble, crack, flash, the pets pop out (rarest first, up to 5 shown; big boxes fast-forward)   (js/v2.js nextReveal, before #packBox)
 *   feed     a bowl drops in, munch, hearts float up, the care bar ticks up (up to 5 pets shown, "+N more")     (log kind 'feed', mine)
 *   stage    old look and new look flicker, burst, the new stage name                                           (my pet's stage went up)
 *   mythic   a bigger scene: light, rays and stars, the pet rises, "MYTHIC! NEVER STARVES"                       (my pet reached Mythic)
 *   starve   the pet droops beside its empty bowl, fades to a ghost, its grave rises                             (my pet died unfed)
 * Each confirmed event plays ONCE per browser (localStorage 'xcpets-life-seen-<address>', keyed by tx, or pet + stage / pet + death block); several new
 * events of one kind play as ONE scene. First visit: only the last FIRST_WINDOW blocks play. Stage-ups are found by comparing each live pet's stage
 * with the stage this browser saw last time ('xcpets-life-st-<address>').
 * Preview any time (never marks anything seen): ?anim=hatch|hatch-bulk|feed|feed-many|stage|mythic|starve[&pet=ID] */
(function () {
  'use strict';
  var W = 128, H = 80, FPS = 10, GY = 64, CX = 64, FIRST_WINDOW = 432, FIRST_FEED = 36;
  var C = { ol: '#16141f', gold: '#ffc93c', gold2: '#fff3b0', heart: '#ff4f7a', heart2: '#ffb3c6', grass: '#3f8f35', grass2: '#7dff6a', dirt: '#523822', dirt2: '#3e2a18',
    shell: '#f4ecd8', shell2: '#c9bfa6', bowl: '#3d8bff', bowl2: '#1b4fa6', food: '#e8a03a', food2: '#a8641e', s1: '#9a9ea8', s2: '#c8ccd4', s3: '#7c808c', s4: '#525560',
    sky: ['#1b1440', '#25195a', '#33206e', '#452a7e', '#5a3488'], night: ['#0b0a1f', '#141233', '#1d1a44', '#262150', '#342e5e'], cyan: '#7fe8ff', pink: '#ff8fd8', violet: '#b58cff' };
  var TC = ['#cfd6dd', '#4fc06b', '#3d8bff', '#ffcf3a'], TN = ['COMMON', 'UNCOMMON', 'RARE', 'LEGENDARY'];
  var STAGES = ['EGG', 'HATCHLING', 'JUVENILE', 'ADULT', 'ELDER', 'MYTHIC'];
  var LEN = { birth: 58, god: 60, hatch: 46, 'hatch-bulk': 30, feed: 40, stage: 40, mythic: 64, starve: 48 }, KEY_F = { birth: 52, god: 54, hatch: 40, 'hatch-bulk': 26, feed: 30, stage: 34, mythic: 58, starve: 44 };
  function reduced() { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }
  function rnd(seed) { var s = (seed >>> 0) || 1; return function () { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 10000) / 10000; }; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function px(g, x, y, c, w, h) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w || 1, h || w || 1); }
  function disc(g, cx, cy, r, c, ry) { ry = ry || r; for (var y = -ry; y <= ry; y++) for (var x = -r; x <= r; x++) if ((x * x) / (r * r || 1) + (y * y) / (ry * ry || 1) <= 1) px(g, cx + x, cy + y, c); }
  function ring(g, cx, cy, r, c, ry) { ry = ry || r; var n = Math.max(10, Math.round(r * 7)); for (var i = 0; i < n; i++) { var a = i / n * Math.PI * 2; px(g, cx + Math.cos(a) * r, cy + Math.sin(a) * ry, c); } }
  function text(g, s, x, y, c, size, align) { g.save(); g.font = (size || 8) + 'px "Press Start 2P", monospace'; g.textAlign = align || 'center'; g.textBaseline = 'top';
    g.fillStyle = C.ol; g.fillText(s, Math.round(x) + 1, Math.round(y) + 1); g.fillStyle = c; g.fillText(s, Math.round(x), Math.round(y)); g.restore(); }
  /* ---- sprites: the pet's own 32x32 art on a keyed background (bare: no gear, no looks) ---- */
  var SPR = {};
  function keyed(p, stage) { var r = window.V2Render; if (!r || !p || !p.art || typeof r.framesWith !== 'function') return null; var c = document.createElement('canvas'); c.width = c.height = 32;
    r.paint(c, r.framesWith(Object.assign({}, p.art, { background: 'solid', bgColor: '#ff00ff', pattern: 'none' }), stage, [])[0]);
    var d = c.getContext('2d').getImageData(0, 0, 32, 32), a = d.data; for (var i = 0; i < a.length; i += 4) if (a[i] > 240 && a[i + 1] < 16 && a[i + 2] > 240) a[i + 3] = 0;
    var kill = []; for (var q = 0; q < 1024; q++) { var j = q * 4; if (!a[j + 3] || !(a[j] - a[j + 1] > 60 && a[j + 2] - a[j + 1] > 50)) continue; var x = q % 32, y = (q / 32) | 0;
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(function (d) { var X = x + d[0], Y = y + d[1]; return X < 0 || Y < 0 || X > 31 || Y > 31 || !a[(Y * 32 + X) * 4 + 3]; })) kill.push(j); }
    kill.forEach(function (j) { a[j + 3] = 0; }); return a; }
  function toCanvas(a) { var c = document.createElement('canvas'); c.width = c.height = 32; var id = c.getContext('2d').createImageData(32, 32); id.data.set(a); c.getContext('2d').putImageData(id, 0, 0); c.rgba = a; return c; }
  function fallback() { var a = new Uint8ClampedArray(4096), col = [120, 200, 110]; function put(x, y, k) { var j = (y * 32 + x) * 4; a[j] = k[0]; a[j + 1] = k[1]; a[j + 2] = k[2]; a[j + 3] = 255; }
    for (var y = 12; y < 32; y++) for (var x = 10; x < 22; x++) if (y > 14 || (x > 11 && x < 20)) put(x, y, col); put(13, 17, [20, 20, 20]); put(18, 17, [20, 20, 20]); return toCanvas(a); }
  function stageOf(p) { return p ? (p.ascended ? 5 : p.stage | 0) : 1; }
  function sprite(p, stage) { if (stage == null) stage = stageOf(p); var k = (p ? p.id : 0) + ':' + stage; if (SPR[k]) return SPR[k]; var out = null;
    try { var a = keyed(p, stage); out = a ? toCanvas(a) : null; } catch (e) { out = null; } if (!out) out = fallback(); SPR[k] = out; return out; }
  function topY(spr) { var a = spr.rgba; if (!a) return 8; for (var y = 0; y < 32; y++) for (var x = 0; x < 32; x++) if (a[(y * 32 + x) * 4 + 3]) return y; return 8; }
  function drawSpr(g, spr, x, y, alpha) { g.save(); if (alpha != null) g.globalAlpha = alpha; g.drawImage(spr, Math.round(x), Math.round(y)); g.restore(); }
  function silhouette(g, spr, x, y, col, every) { var a = spr.rgba; if (!a) return; for (var q = 0; q < 1024; q++) if (a[q * 4 + 3] && (!every || ((q % 32) + ((q / 32) | 0)) % every === 0)) px(g, x + (q % 32), y + ((q / 32) | 0), col); }
  function dither(g, spr, x, y, level) { var a = spr.rgba; if (!a) return; var c = spr.getContext('2d'); /* 8-bit fade: keep 1 of every (level) pixels in a fixed checker pattern */
    for (var q = 0; q < 1024; q++) { if (!a[q * 4 + 3]) continue; var X = q % 32, Y = (q / 32) | 0; if (level > 1 && ((X + Y * 3) % level) !== 0) continue; px(g, x + X, y + Y, 'rgb(' + a[q * 4] + ',' + a[q * 4 + 1] + ',' + a[q * 4 + 2] + ')'); } }
  function tierOf(p) { var t = p && p.art ? p.art.tierIndex | 0 : 0; return clamp(t, 0, 3); }
  /* ---- the sets ---- */
  function skyBands(g, cols, f, stars) { for (var i = 0; i < 5; i++) px(g, 0, i * 13, cols[i], W, 13); px(g, 0, 65, cols[4], W, 15); if (!stars) return; var r = rnd(7); for (var s = 0; s < stars; s++) { var sx = r() * W, sy = r() * 44; if ((s + (f >> 2)) % 7) px(g, sx, sy, s % 3 ? '#cfd3ff' : '#ffffff'); } }
  function hills(g) { for (var x = 0; x < W; x++) { var h = 6 + Math.round(4 * Math.sin(x / 13) + 2 * Math.sin(x / 5)); px(g, x, GY - h, '#2a1f55', 1, h); } }
  function grass(g, sx) { sx = sx || 0; px(g, 0, GY, C.grass, W, 2); px(g, 0, GY + 2, C.dirt, W, H - GY - 2); var r = rnd(19); for (var i = 0; i < 36; i++) px(g, sx + r() * W, GY + 3 + r() * (H - GY - 3), i % 3 ? C.dirt2 : '#6b4a2c');
    for (var x = 0; x < W; x += 3) px(g, x + sx, GY - 1, (x % 2) ? C.grass2 : C.grass, 1, 1); }
  function nest(g, cx) { disc(g, cx, GY, 13, '#8a5a2b', 3); disc(g, cx, GY - 1, 10, '#b07a3a', 2); for (var i = -11; i <= 11; i += 3) px(g, cx + i, GY - 2 + (i & 1), '#e0b060', 2, 1); }
  /* an egg 10x13, tier coloured spots, crack level k 0..4 */
  function egg(g, cx, by, t, k, tilt) { var x = cx - 5 + (tilt || 0), y = by - 13, base = t === 3 ? '#fff1c2' : C.shell, sh = t === 3 ? '#e8c060' : C.shell2, spot = TC[t];
    var rows = [[3, 4], [2, 6], [1, 8], [1, 8], [0, 10], [0, 10], [0, 10], [0, 10], [0, 10], [0, 10], [1, 8], [1, 8], [3, 4]];
    rows.forEach(function (r, i) { px(g, x + r[0] - 1, y + i, C.ol, r[1] + 2, 1); }); px(g, x + 2, y - 1, C.ol, 6, 1); px(g, x + 2, y + 13, C.ol, 6, 1);
    rows.forEach(function (r, i) { px(g, x + r[0], y + i, base, r[1], 1); px(g, x + r[0] + r[1] - 2, y + i, sh, 2, 1); });
    px(g, x + 3, y + 4, spot, 2, 2); px(g, x + 6, y + 8, spot, 2, 2); px(g, x + 2, y + 9, spot, 1, 1); px(g, x + 3, y + 1, '#ffffff', 1, 2);
    var CR = [[5, 5], [4, 6], [5, 7], [6, 6], [7, 7], [3, 7], [2, 6], [8, 6]]; for (var i = 0; i < Math.min(CR.length, k * 2); i++) px(g, x + CR[i][0], y + CR[i][1], C.ol, 1, 1); }
  function shellBits(g, cx, by, t, seed) { var r = rnd(seed); for (var i = 0; i < 8; i++) { var vx = (r() - 0.5) * 3, vy = -1.2 - r() * 2, x = cx + vx * t, y = by - 8 + vy * t + 0.3 * t * t; if (y < GY + 2) px(g, x, y, i % 2 ? C.shell : C.shell2, 2, 2); } }
  function sparkle(g, f, seed, cx, cy, spread, col, col2) { var r = rnd(seed + (f >> 1)); for (var i = 0; i < 6; i++) { var x = cx + (r() - 0.5) * spread, y = cy + (r() - 0.5) * spread * 0.7; px(g, x, y, col2 || C.gold2); px(g, x - 1, y, col || C.gold); px(g, x + 1, y, col || C.gold); px(g, x, y - 1, col || C.gold); px(g, x, y + 1, col || C.gold); } }
  function heart(g, x, y, c, c2) { px(g, x, y, c, 2, 2); px(g, x + 3, y, c, 2, 2); px(g, x - 1, y + 1, c, 7, 2); px(g, x, y + 3, c, 5, 1); px(g, x + 1, y + 4, c, 3, 1); px(g, x + 2, y + 5, c, 1, 1); px(g, x, y + 1, c2 || C.heart2, 1, 1); }
  function bowl(g, cx, y, food) { px(g, cx - 7, y, C.ol, 14, 1); px(g, cx - 7, y + 1, C.bowl, 14, 2); px(g, cx - 6, y + 3, C.bowl, 12, 1); px(g, cx - 5, y + 4, C.bowl2, 10, 1); px(g, cx - 7, y + 1, '#8fc1ff', 14, 1);
    for (var i = 0; i < food; i++) px(g, cx - 5 + (i * 3) % 10, y - 1 - ((i / 4) | 0), i % 2 ? C.food : C.food2, 2, 2); }
  function bar(g, x, y, w, a, b, col) { px(g, x - 1, y - 1, C.ol, w + 2, 5); px(g, x, y, C.s4, w, 3); px(g, x, y, col || C.grass2, Math.round(w * clamp(b, 0, 1)), 3); if (b > a) px(g, x + Math.round(w * clamp(b, 0, 1)) - 1, y, '#ffffff', 1, 3); }
  function rays(g, cx, cy, f, cols, n) { for (var i = 0; i < n; i++) { var a = i / n * Math.PI * 2 + f * 0.06; for (var r = 8; r < 90; r += 2) if (((r >> 1) + i) % 2 === 0) px(g, cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.8, cols[i % cols.length]); } }
  /* ---- frame painters ---- */
  function slotsX(n) { var m = Math.min(n, 5), gap = m > 1 ? Math.min(26, 104 / (m - 1)) : 0, x0 = CX - gap * (m - 1) / 2; var out = []; for (var i = 0; i < m; i++) out.push(Math.round(x0 + gap * i)); return out; }
  function hatchF(g, ev, f, P) { var bulk = ev.kind === 'hatch-bulk', sp = bulk ? 0.6 : 1, list = P.list, xs = slotsX(list.length || 1);
    skyBands(g, C.sky, f, 18); hills(g); grass(g);
    var wob = Math.round(10 * sp), crk = Math.round(18 * sp), pop = Math.round(24 * sp);
    if (bulk) { var r = rnd(5); for (var b = 0; b < 14; b++) { var bx = 6 + r() * 116, bt = r() * 6 | 0; if (Math.abs(bx - CX) < 60 && b < 10) continue; if (f < pop + bt) egg(g, bx, GY + 1, 0, clamp(f - wob - bt, 0, 4), f % 2 ? 1 : 0); else shellBits(g, bx, GY, f - pop - bt, b); } }
    xs.forEach(function (x, i) { var p = list[i], t = tierOf(p), d = bulk ? 0 : i * 2, ff = f - d; nest(g, x);
      if (ff < pop) { var tilt = ff >= 2 && ff < crk ? ((ff >> 1) % 2 ? 1 : -1) * (ff > wob ? 2 : 1) : 0; egg(g, x, GY - 1, t, clamp(Math.floor((ff - wob) / 2), 0, 4), tilt);
        if (ff >= crk && ff < pop) { silhouette(g, sprite(p), x - 16, GY - 33, '#ffffff', 2); px(g, x - 7, GY - 16, '#ffffff', 14, 14); } }
      else { var s = sprite(p), ty = topY(s), up = ff - pop, jy = up < 6 ? [0, 6, 9, 10, 9, 6][up] : 0; drawSpr(g, s, x - 16, GY - 32 - jy + (up >= 6 ? 0 : 0)); shellBits(g, x, GY - 2, up, i + 3);
        px(g, x - 6, GY - 3, C.shell, 4, 2); px(g, x + 3, GY - 3, C.shell, 4, 2); if (up >= 4 && t >= 1) sparkle(g, f, i * 9 + t, x, GY - 22 + ty / 2, 26, TC[t], '#ffffff'); } });
    if (f >= pop + 6) { var best = list[0], t0 = tierOf(best); text(g, bulk ? (ev.n.toLocaleString('en-US') + ' EGGS!') : 'HATCHED!', CX, 4, (f >> 1) % 2 ? C.gold2 : '#ffffff', 8);
      text(g, (list.length > 1 ? 'BEST: ' : '') + TN[t0], CX, 15, TC[t0], 5); if (ev.n > xs.length) text(g, '+' + (ev.n - xs.length).toLocaleString('en-US') + ' MORE', CX, GY + 6, '#ffffff', 5); } }
  function feedF(g, ev, f, P) { var list = P.list, xs = slotsX(list.length || 1); skyBands(g, C.sky, f, 10); hills(g); grass(g);
    xs.forEach(function (x, i) { var p = list[i], s = sprite(p), d = i, ff = f - d, by = GY - 3, drop = clamp(ff, 0, 5), bob = ff >= 7 && ff < 28 ? ((ff >> 1) % 2) : 0;
      drawSpr(g, s, x - 16, GY - 33 + bob * 2); var food = ff < 7 ? 8 : clamp(8 - Math.floor((ff - 7) / 2.5), 0, 8); bowl(g, x + 9, ff < 5 ? by - (5 - drop) * 6 : by, food);
      if (bob && ff % 4 === 1) { px(g, x + 5 + (ff % 3), GY - 10, C.food, 1, 1); px(g, x + 12, GY - 8 - (ff % 2), C.food2, 1, 1); }
      for (var h = 0; h < 3; h++) { var hs = ff - 10 - h * 5; if (hs >= 0 && hs < 16) heart(g, x - 6 + h * 5 + ((hs >> 2) % 2), GY - 30 - hs * 1.5, hs > 12 ? C.heart2 : C.heart); } });
    var lead = list[0], c = P.care || { a: 0.4, b: 0.6 }, k = clamp((f - 12) / 14, 0, 1), cur = c.a + (c.b - c.a) * k; text(g, 'CARE', 8, 4, '#ffffff', 5, 'left'); bar(g, 32, 5, 88, c.a, cur, c.mythic ? C.violet : C.grass2);
    if (f >= 26) { text(g, list.length > 1 || ev.n > 1 ? 'FED ' + ev.n.toLocaleString('en-US') + '!' : 'YUM!', CX, 14, (f >> 1) % 2 ? C.gold2 : '#ffffff', 8); if (ev.n > xs.length) text(g, '+' + (ev.n - xs.length).toLocaleString('en-US') + ' MORE', CX, GY + 6, '#ffffff', 5); }
    else if (f >= 12) text(g, '+1 MEAL', CX, 14, C.grass2, 5); }
  function stageF(g, ev, f, P) { var p = P.list[0], to = ev.to != null ? ev.to : stageOf(p), from = Math.max(0, to - 1), a = sprite(p, from), b = sprite(p, to), x = CX - 16, y = GY - 33;
    skyBands(g, C.sky, f, 16); hills(g); grass(g);
    var flick = f >= 8 && f < 22, show = f < 8 ? a : flick ? (((f - 8) >> (f < 15 ? 1 : 0)) % 2 ? b : a) : b;
    if (flick) { silhouette(g, show, x, y, (f % 2) ? '#ffffff' : C.cyan); }
    else drawSpr(g, show, x, y + (f < 8 ? ((f >> 1) % 2) : 0));
    if (f >= 22 && f < 32) { ring(g, CX, y + 18, (f - 22) * 4 + 6, C.cyan); ring(g, CX, y + 18, (f - 22) * 4 + 2, '#ffffff'); }
    if (f >= 22) sparkle(g, f, 3, CX, y + 16, 50, C.cyan, '#ffffff');
    if (f >= 24) { text(g, 'GREW!', CX, 4, (f >> 1) % 2 ? C.gold2 : '#ffffff', 8); text(g, STAGES[to] || '', CX, GY + 6, C.cyan, 6); if (ev.n > 1) text(g, '+' + (ev.n - 1) + ' MORE', CX, 15, '#ffffff', 5); }
    else text(g, STAGES[from] + ' >', CX, 4, '#ffffff', 5); }
  function mythicF(g, ev, f, P) { var p = P.list[0], a = sprite(p, 4), b = sprite(p, 5), x = CX - 16, rise = clamp((f - 14) / 16, 0, 1), y = GY - 33 - Math.round(rise * 8);
    skyBands(g, C.night, f, 30); if (f >= 10) rays(g, CX, y + 16, f, [C.violet, C.cyan, C.pink, '#ffffff'], 12); hills(g); grass(g);
    if (f >= 6) { var bw = clamp(f - 6, 0, 8); for (var by = 0; by < GY; by++) for (var bx = -bw; bx <= bw; bx++) if (((bx + by + (f >> 1)) & 1) === 0 || Math.abs(bx) < bw / 3) px(g, CX + bx, by, Math.abs(bx) < bw / 3 ? '#ffffff' : C.cyan); }
    if (f < 14) drawSpr(g, a, x, GY - 33); else if (f < 30) { if (f % 2) silhouette(g, b, x, y, '#ffffff'); else drawSpr(g, f < 22 ? a : b, x, y); } else drawSpr(g, b, x, y + ((f >> 2) % 2));
    if (f >= 28) { sparkle(g, f, 11, CX, 30, 110, C.violet, '#ffffff'); sparkle(g, f, 23, CX, 30, 90, C.cyan, '#ffffff'); }
    if (f >= 32) { text(g, 'MYTHIC!', CX, 4, ['#ffffff', C.cyan, C.pink, C.violet][(f >> 1) % 4], 8); }
    if (f >= 40) { px(g, 14, GY + 4, C.ol, 100, 12); text(g, 'NEVER STARVES', CX, GY + 6, '#ffffff', 5); }
    if (f >= 44 && ev.n > 1) text(g, '+' + (ev.n - 1) + ' MORE', CX, 15, '#ffffff', 5); }
  function starveF(g, ev, f, P) { var p = P.list[0], s = sprite(p), x = CX - 22, y0 = GY - 33, droop = clamp(Math.floor((f - 4) / 3), 0, 3);
    skyBands(g, C.night, f, 14); hills(g); grass(g); bowl(g, CX + 10, GY - 3, 0);
    if (f < 8 && (f >> 1) % 2) text(g, '?', CX + 10, GY - 18, '#ffffff', 6);
    var stoneY = GY - clamp(Math.round((f - 22) * 1.6), 0, 22); if (f >= 22) { var sx = CX - 30; px(g, sx, stoneY, C.ol, 16, GY - stoneY); px(g, sx + 1, stoneY + 1, C.s1, 14, GY - stoneY - 1); px(g, sx + 1, stoneY + 1, C.s2, 2, GY - stoneY - 1);
      if (GY - stoneY > 10) { px(g, sx + 7, stoneY + 4, C.s4, 2, 7); px(g, sx + 4, stoneY + 6, C.s4, 8, 2); } disc(g, sx + 8, GY + 1, 11, C.dirt, 2); }
    if (f < 14) drawSpr(g, s, x, y0 + droop);
    else if (f < 26) dither(g, s, x, y0 + 3 - (f - 14), [1, 2, 2, 3, 3, 4, 4, 5, 6, 7, 8, 9][f - 14]);
    else if (f < 40) silhouette(g, s, x, y0 - 12 - (f - 26) * 2, '#cfd6ff', 4);
    if (f >= 32) { text(g, 'R.I.P.', CX, 4, C.s2, 8); text(g, '#' + (p ? p.id : ev.id), CX, 15, '#ffffff', 5); if (ev.n > 1) text(g, '+' + (ev.n - 1) + ' MORE', CX, GY + 6, '#ffffff', 5); } }
  /* ---- batch 2: special births (the six rare hybrid tiers, twins, God-born) and a resurrected pet becoming a God ---- */
  var BT = { seraph: { t: 'SERAPH!', sub: 'HYBRID OF TWO GODS', c: '#ffffff', c2: C.cyan, sky: 'sky' }, dynast: { t: 'DYNAST!', sub: 'ANCESTOR CHANNEL', c: C.violet, c2: C.cyan, sky: 'night' },
    chimera: { t: 'CHIMERA!', sub: 'SIX BLOODLINES', c: '#ff6b6b', c2: '#6bff9a', sky: 'night' }, gravekin: { t: 'GRAVEKIN!', sub: 'BORN OF THE GRAVE', c: '#7dff9a', c2: '#cfd6ff', sky: 'night' },
    heirloom: { t: 'HEIRLOOM!', sub: 'TWO PURE LINES', c: '#7dff6a', c2: '#ffb3c6', sky: 'sky' }, gemini: { t: 'GEMINI!', sub: 'TWIN STARS', c: C.pink, c2: C.cyan, sky: 'night' },
    godborn: { t: 'GOD-BORN!', sub: 'CHILD OF TWO GODS', c: '#ffffff', c2: '#cfe9ff', sky: 'sky' }, twins: { t: 'TWINS!', sub: 'TWO EGGS, ONE BURN', c: C.pink, c2: '#ffffff', sky: 'sky' } };
  var BIRTH_ORDER = ['seraph', 'dynast', 'chimera', 'gravekin', 'heirloom', 'gemini', 'godborn', 'twins'];
  function flipSpr(g, spr, x, y) { g.save(); g.translate(Math.round(x) + 32, Math.round(y)); g.scale(-1, 1); g.drawImage(spr, 0, 0); g.restore(); }
  function wing(g, cx, cy, side, f, c, c2) { var up = (f >> 1) % 2; for (var i = 0; i < 6; i++) { var len = 11 - i * 1.5, y = cy - 6 + i * 3 - (up ? 2 - i * 0.4 : 0); px(g, side > 0 ? cx : cx - len, y, C.ol, len + 1, 3); px(g, side > 0 ? cx : cx - len + 1, y + 1, i % 2 ? c2 : c, len - 1, 1); } }
  function halo(g, cx, y, c) { ring(g, cx, y, 8, C.ol, 3); ring(g, cx, y, 7, c, 2); ring(g, cx, y - 1, 7, '#ffffff', 2); }
  function cloud(g, cx, cy, c) { disc(g, cx, cy, 9, c || '#ffffff', 4); disc(g, cx - 8, cy + 1, 6, c || '#ffffff', 3); disc(g, cx + 8, cy + 1, 6, c || '#ffffff', 3); px(g, cx - 14, cy + 4, '#cfd6ff', 28, 1); }
  function stone(g, x, h) { px(g, x, GY - h, C.ol, 8, h); px(g, x + 1, GY - h + 1, C.s3, 6, h - 1); px(g, x + 3, GY - h + 2, C.s4, 2, 4); px(g, x + 2, GY - h + 3, C.s4, 4, 1); }
  function beam(g, x0, y0, x1, y1, f, c) { var n = 24; for (var i = 0; i < n; i++) if ((i + f) % 3 === 0) px(g, x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, c, 2, 2); }
  function birthF(g, ev, f, P) { var T = BT[ev.tier] || BT.twins, kids = P.list, par = P.par || [], two = kids.length > 1, xs = two ? [CX - 18, CX + 18] : [CX], pop = 20, up = f - pop;
    skyBands(g, T.sky === 'night' ? C.night : C.sky, f, T.sky === 'night' ? 28 : 14); if (ev.tier === 'gravekin') { stone(g, 8, 10); stone(g, 22, 7); stone(g, 100, 9); stone(g, 113, 12); }
    if (ev.tier === 'heirloom' && f >= 8) { var gh = clamp((f - 8) * 3, 0, 46); px(g, CX - 2, GY - gh, '#6b4a2c', 4, gh); [[-1, 18], [1, 26], [-1, 34], [1, 40]].forEach(function (b, i) { if (gh > b[1]) { var L = clamp(gh - b[1], 0, 16 - i * 2); px(g, b[0] < 0 ? CX - 2 - L : CX + 2, GY - b[1], '#6b4a2c', L, 2); if (L > 6) { disc(g, b[0] < 0 ? CX - 2 - L : CX + 2 + L, GY - b[1] - 2, 4, '#3f8f35', 3); px(g, b[0] < 0 ? CX - 2 - L : CX + 2 + L, GY - b[1] - 3, T.c2, 2, 2); } } }); disc(g, CX, GY - gh - 2, 7, '#3f8f35', 5); }
    if (ev.tier === 'seraph' || ev.tier === 'godborn') { if (f >= 14) rays(g, CX, GY - 20, f, ['#ffffff', T.c2], 10); }
    hills(g); grass(g); if (ev.tier === 'godborn' && f >= pop) { cloud(g, CX - 34, GY - 2); cloud(g, CX + 34, GY - 2); }
    /* the two parents watch from above, a dotted beam each into the egg */
    par.slice(0, 2).forEach(function (q, i) { var sx = i ? W - 34 : 2, a = sprite(q), on = ev.tier !== 'dynast' || up < 0 || ((f >> 2) % 2) === i; if (f < 4) return;
      if (f < 10) silhouette(g, a, sx, 2, T.c, 3); else if (on) drawSpr(g, a, sx, 2); else silhouette(g, a, sx, 2, T.c, 2);
      if (f >= 6 && (up < 0 || ev.tier === 'dynast') && on) beam(g, sx + 16, 26, CX, up < 0 ? GY - 8 : GY - 20, f, i ? T.c2 : T.c); });
    if (up < 0) { xs.forEach(function (x, i) { nest(g, x); var t = tierOf(kids[i]), tilt = f >= 6 ? ((f >> 1) % 2 ? 1 : -1) * (f > 12 ? 2 : 1) : 0; egg(g, x, GY - 1, t, clamp(Math.floor((f - 10) / 2), 0, 4), tilt);
        if (f >= 16) { silhouette(g, sprite(kids[i]), x - 16, GY - 33, T.c, 2); px(g, x - 7, GY - 16, '#ffffff', 14, 14); } }); return birthText(g, ev, f, T, false); }
    if (up < 3) { for (var yy = 0; yy < H; yy++) for (var xx = 0; xx < W; xx++) if (((xx + yy) % (up + 2)) === 0) px(g, xx, yy, '#ffffff'); }
    xs.forEach(function (x, i) { var p = kids[i], s = sprite(p), jy = up < 6 ? [0, 6, 9, 10, 9, 6][up] : ((f >> 2) % 2), y = GY - 32 - jy; nest(g, x);
      if (ev.tier === 'gravekin') { var rise = clamp(16 - up * 2, 0, 16); y = GY - 32 + rise; for (var m = 0; m < 26; m++) if ((m * 7 + f) % 5 < 2) px(g, x - 14 + (m * 5) % 28, GY - 4 - ((m * 3 + f) % 22), T.c, 2, 1); }
      if (ev.tier === 'seraph') { wing(g, x - 9, y + 18, -1, f, '#ffffff', T.c2); wing(g, x + 9, y + 18, 1, f, '#ffffff', T.c2); }
      if (ev.tier === 'gemini' && i === 1) flipSpr(g, s, x - 16, y); else drawSpr(g, s, x - 16, y);
      if (ev.tier === 'seraph' || ev.tier === 'godborn') halo(g, x, y + topY(s) - 4 - (ev.tier === 'godborn' ? clamp(10 - up, 0, 10) : 0), ev.tier === 'godborn' ? '#fff3b0' : T.c2);
      if (ev.tier === 'chimera') [['#ff6b6b', 0], ['#6bff9a', 2.09], ['#6b9bff', 4.19]].forEach(function (o) { var a = o[1] + f * 0.35, r = clamp(26 - up, 15, 26); for (var tr = 0; tr < 4; tr++) px(g, x + Math.cos(a - tr * 0.18) * r, y + 18 + Math.sin(a - tr * 0.18) * r * 0.55, tr ? o[0] : '#ffffff', tr ? 1 : 3, tr ? 1 : 3); }); });
    if (ev.tier === 'gemini') { var gc = (f >> 1) % 2 ? T.c : T.c2; px(g, CX - 4, 22, gc, 9, 1); px(g, CX - 4, 32, gc, 9, 1); px(g, CX - 2, 23, gc, 1, 9); px(g, CX + 2, 23, gc, 1, 9); }
    if (up >= 4) sparkle(g, f, 17, CX, GY - 20, two ? 90 : 60, T.c, T.c2); birthText(g, ev, f, T, true); }
  function birthText(g, ev, f, T, born) { if (!born) { if (f >= 6) text(g, 'SOMETHING STIRS...', CX, GY + 6, T.c2, 5); return; } var up = f - 20; if (up < 6) return;
    text(g, T.t, CX, 4, (f >> 1) % 2 ? T.c : '#ffffff', 8); text(g, T.sub, CX, GY + 6, T.c2, 5); if (ev.n > 1) text(g, '+' + (ev.n - 1) + ' MORE', CX, 15, '#ffffff', 5); }
  function godF(g, ev, f, P) { var p = P.list[0], s = sprite(p, 5), dawn = clamp((f - 8) / 20, 0, 1), rise = clamp((f - 16) / 14, 0, 1), y = GY - 32 - Math.round(rise * 10), x = CX - 16;
    var bands = C.night.map(function (c, i) { return dawn < 0.5 ? c : ['#3a2a6e', '#5a3c8a', '#8a5aa0', '#c08ab0', '#e8b8c0'][i]; }); skyBands(g, bands, f, dawn < 0.5 ? 26 : 8);
    if (f >= 18) rays(g, CX, y + 14, f, ['#ffffff', C.cyan, '#cfe9ff'], 14); if (f >= 10) { var bw = clamp(f - 10, 0, 7); for (var by = 0; by < GY; by++) for (var bx = -bw; bx <= bw; bx++) if (((bx + by + (f >> 1)) & 1) === 0 || Math.abs(bx) < bw / 3) px(g, CX + bx, by, Math.abs(bx) < bw / 3 ? '#ffffff' : '#cfe9ff'); }
    hills(g); grass(g); stone(g, 10, 10); stone(g, 108, 12); if (f < 16) { stone(g, CX - 4, 11 - (f >> 2)); } cloud(g, 22, 18 - (rise * 4)); cloud(g, 106, 14 - (rise * 4));
    if (f >= 22) { wing(g, CX - 9, y + 18, -1, f, '#ffffff', C.cyan); wing(g, CX + 9, y + 18, 1, f, '#ffffff', C.cyan); }
    if (f < 16) dither(g, s, x, GY - 20 + (16 - f), [9, 8, 7, 6, 6, 5, 5, 4, 4, 3, 3, 2, 2, 2, 1, 1][f]); else if (f < 24 && f % 2) silhouette(g, s, x, y, '#ffffff'); else drawSpr(g, s, x, y + (f >= 34 ? (f >> 2) % 2 : 0));
    if (f >= 24) halo(g, CX, y + topY(s) - 4 - clamp(30 - f, 0, 6), '#fff3b0'); if (f >= 26) sparkle(g, f, 31, CX, 30, 100, C.cyan, '#ffffff');
    if (f >= 30) { text(g, 'GOD!', CX, 4, (f >> 1) % 2 ? '#ffffff' : C.cyan, 8); px(g, 22, GY + 4, C.ol, 84, 12); text(g, 'RISEN + MYTHIC', CX, GY + 6, '#ffffff', 5); } }
  var PAINT = { birth: birthF, god: godF, hatch: hatchF, 'hatch-bulk': hatchF, feed: feedF, stage: stageF, mythic: mythicF, starve: starveF };
  function pets(ev, w) { var by = (w && w.byId) || {}, L = (ev.ids || []).slice(0, 5).map(function (id) { return by[id] || { id: id }; }); return { list: L, care: ev.care || null, par: ev.kind === 'birth' && L[0] && L[0].parents ? L[0].parents.map(function (id) { return by[id]; }).filter(Boolean) : [] }; }
  function paint(c, ev, f, w) { var g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.clearRect(0, 0, W, H); (PAINT[ev.kind] || feedF)(g, ev, f, pets(ev, w)); }
  function nm(p, id) { return '#' + (p ? p.id : id) + (p && p.name ? ' ' + p.name : ''); }
  function more(n, shown) { return n > shown ? ' and ' + (n - shown).toLocaleString('en-US') + ' more' : ''; }
  function caption(ev, w) { var P = pets(ev, w), p = P.list[0], n = nm(p, ev.ids && ev.ids[0]), b = ev.block ? ' · block ' + Number(ev.block).toLocaleString('en-US') : '';
    switch (ev.kind) {
      case 'hatch': case 'hatch-bulk': return '🥚 ' + (ev.n > 1 ? ev.n.toLocaleString('en-US') + ' eggs hatched! Best: ' + n + ' (' + TN[tierOf(p)].toLowerCase() + ')' : n + ' hatched (' + TN[tierOf(p)].toLowerCase() + ')');
      case 'feed': return '🍖 ' + (ev.n > 1 ? 'Fed ' + ev.n.toLocaleString('en-US') + ' pets: ' + n + more(ev.n, 1) : 'Fed ' + n) + b;
      case 'stage': return '✨ ' + n + ' grew to ' + (STAGES[ev.to] || '').charAt(0) + (STAGES[ev.to] || '').slice(1).toLowerCase() + (ev.n > 1 ? '. ' + (ev.n - 1) + ' more pets grew a stage' : '');
      case 'mythic': return '🌈 ' + n + ' reached MYTHIC: it never starves now' + (ev.n > 1 ? '. ' + (ev.n - 1) + ' more pets reached Mythic' : '');
      case 'birth': { var T = BT[ev.tier] || BT.twins, lab = T.t.replace('!', '').toLowerCase(); lab = lab.charAt(0).toUpperCase() + lab.slice(1);
        return (ev.tier === 'twins' ? '👯 Twins! ' + n + ' and ' + nm(P.list[1], ev.ids[1]) + ' hatched from one breed burn' : ev.tier === 'godborn' ? '😇 ' + n + ' is God-born: a child of two Gods' : ev.tier === 'gemini' ? '♊ Gemini twins! ' + n + ' and ' + nm(P.list[1], ev.ids[1]) + ' (rare hybrid tier)' : '🌟 ' + n + ' was born ' + (/^[AEIOUH]/.test(lab) ? 'an ' : 'a ') + lab + ' (rare hybrid tier: ' + T.sub.toLowerCase() + ')') + (ev.n > 1 ? '. ' + (ev.n - 1) + ' more special births' : ''); }
      case 'god': return '👼 ' + n + ' became a God: risen from the Pet Cemetery and Mythic' + (ev.n > 1 ? '. ' + (ev.n - 1) + ' more new Gods' : '');
      case 'starve': return '🪦 ' + n + ' starved (7 days unfed) and went to the Pet Cemetery' + (ev.n > 1 ? '. ' + (ev.n - 1) + ' more pets starved' : '') + b; }
    return ''; }
  function css() { if (document.getElementById('laCss')) return; var s = document.createElement('style'); s.id = 'laCss';
    s.textContent = '.la-ov{position:fixed;inset:0;z-index:100010;background:rgba(10,8,22,.88);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;cursor:pointer;padding:12px;box-sizing:border-box;overflow:hidden}' +
      '.la-ov canvas{image-rendering:pixelated;image-rendering:crisp-edges;border:4px solid #000;box-shadow:4px 4px 0 #000;background:#1b1440;max-width:100%}' +
      '.la-cap{font-family:inherit;color:#fff3b0;font-size:17px;text-align:center;text-shadow:2px 2px 0 #000;max-width:92vw;line-height:1.35;overflow-wrap:anywhere}.la-skip{color:#bbb;font-size:12px}';
    document.head.appendChild(s); }
  var BUSY = null, API;
  /* play(ev, {w, done, still}) -> {end, canvas, frame(k)}; ev = {kind, ids, n, to, care, block, key} */
  function play(ev, o) { o = o || {}; css(); var w = o.w || (window.V2Mock && V2Mock.world && V2Mock.world()), N = LEN[ev.kind] || 40;
    var ov = document.createElement('div'); ov.className = 'la-ov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', caption(ev, w)); ov.dataset.anim = ev.kind;
    var sc = Math.max(2, Math.min(6, Math.floor(Math.min(window.innerWidth - 40, 640) / W))), c = document.createElement('canvas'); c.width = W; c.height = H; c.style.width = W * sc + 'px'; c.style.height = H * sc + 'px';
    var cap = document.createElement('div'); cap.className = 'la-cap'; cap.textContent = caption(ev, w); var skip = document.createElement('div'); skip.className = 'la-skip'; skip.textContent = 'Tap to skip';
    ov.appendChild(c); ov.appendChild(cap); ov.appendChild(skip); document.body.appendChild(ov); var f = 0, tm = null, ended = false;
    function key(e) { if (e) { e.preventDefault(); e.stopPropagation(); } end(); }
    function end() { if (ended) return; ended = true; clearInterval(tm); document.removeEventListener('keydown', key, true); ov.remove(); BUSY = null; if (o.done) try { o.done(); } catch (e) { } if (!o.noQueue && window.V2AnimDone) try { V2AnimDone(); } catch (e) { } }
    ov.addEventListener('click', function () { end(); }); document.addEventListener('keydown', key, true); BUSY = { end: end };
    var draw = function (k) { try { paint(c, ev, k, w); } catch (e) { if (window.console) console.warn('life anim', e); } };
    if (reduced() || o.still) { draw(KEY_F[ev.kind] || N - 1); skip.textContent = 'Tap to close'; if (!o.still) tm = setInterval(end, 3000); return (API.last = { end: end, canvas: c, frame: draw }); }
    draw(0); tm = setInterval(function () { f++; if (f >= N + 12) return end(); if (f < N) draw(f); }, 1000 / FPS); /* the last frame holds ~1.2 s */
    return (API.last = { end: end, canvas: c, frame: function (k) { clearInterval(tm); draw(k); } }); }
  /* ---- hatch: called by js/v2.js nextReveal before the #packBox review opens. ids = the eggs of one hatch burn. Reduced motion: nothing, done() at once. */
  function rank(w, ids) { var by = (w && w.byId) || {}; return ids.slice().sort(function (a, b) { var A = by[a], B = by[b]; return tierOf(B) - tierOf(A) || a - b; }); }
  function specialOf(w, p) { if (!p || !p.art) return null; var R = window.V2Rules; if (p.art.rareTier && BT[p.art.rareTier]) return p.art.rareTier;
    try { if (R && R.godBornOf && R.godBornOf(w, p)) return 'godborn'; } catch (e) { } return p.twinOf && w.byId[p.twinOf] ? 'twins' : null; }
  /* the special births among the hatched eggs -> one 'birth' event for the most special (twins / Gemini show both twins) */
  function birthOf(w, ids) { var sp = [], seen = {}; ids.slice(0, 3000).forEach(function (id) { var p = w.byId[id], t = specialOf(w, p); if (!t || seen[id]) return; seen[id] = 1; if (p.twinOf) seen[p.twinOf] = 1; sp.push({ p: p, t: t }); });
    if (!sp.length) return null; sp.sort(function (a, b) { return BIRTH_ORDER.indexOf(a.t) - BIRTH_ORDER.indexOf(b.t) || tierOf(b.p) - tierOf(a.p) || a.p.id - b.p.id; }); var top = sp[0];
    return { kind: 'birth', tier: top.t, ids: (top.t === 'twins' || top.t === 'gemini') && top.p.twinOf ? [Math.min(top.p.id, top.p.twinOf), Math.max(top.p.id, top.p.twinOf)] : [top.p.id], n: sp.length }; }
  function hatch(w, ids, done) { done = done || function () { }; if (!ids || !ids.length || reduced() || BUSY) { done(); return; }
    var n = ids.length, best = ids.length > 400 ? rank(w, ids.slice(0, 0).concat(ids.filter(function (id) { var p = w.byId[id]; return p && tierOf(p) >= 2; }).slice(0, 400))) : rank(w, ids); if (!best.length) best = ids.slice(0, 5);
    var bev = null; try { bev = birthOf(w, ids); } catch (e) { bev = null; }
    var then = bev ? function () { if (reduced()) return done(); play(bev, { w: w, done: done, noQueue: true }); } : done;
    if (bev && n <= 2 && (n === 1 || bev.ids.length === 2)) return then(); /* one special egg (or one twin pair): its birth scene has the cracking egg already */
    play({ kind: n > 12 ? 'hatch-bulk' : 'hatch', ids: best.slice(0, n > 12 ? 3 : 5), n: n }, { w: w, done: then, noQueue: true }); }
  /* ---- confirmed events for one wallet, from the replayed world ---- */
  function seenKey(ME) { return 'xcpets-life-seen-' + ME; } function stKey(ME) { return 'xcpets-life-st-' + ME; }
  function careOf(w, p, tip, careAt) { var R = window.V2Rules; try { var th = R.petThresholds(w, p, tip), s = R.stageFor(careAt, th); if (s >= 5) return { a: 1, b: 1, mythic: true };
      var lo = th[s], hi = th[s + 1], m = R.mealFor(careAt - 1, p.species, tip, th), b4 = careAt - m; if (!(m > 0) || b4 + R.mealFor(b4, p.species, tip, th) !== careAt) b4 = careAt - (hi - lo) * 0.15;
      return { a: clamp((b4 - lo) / (hi - lo), 0, 1), b: clamp((careAt - lo) / (hi - lo), 0, 1) }; } catch (e) { return null; } }
  function collect(w, ME, tip) { if (!w || !w.log || !ME) return []; tip = tip || w.tip || 0; var k = seenKey(ME), seen = null; try { seen = JSON.parse(localStorage.getItem(k)); } catch (e) { }
    var first = !seen; seen = seen || {}; var out = [], dirty = first, by = w.byId || {}, fed = [], fedSet = {}, fedB = 0, fedCare = null;
    function fresh(key, block, win) { if (seen[key]) return false; seen[key] = block || tip; dirty = true; return !(first && tip - (block || tip) > (win || FIRST_WINDOW)); }
    if (seen._m && w.log.length && w.log[w.log.length - 1].block < seen._m - 2000) seen = {}; /* a different chain / reset world: start over */
    w.log.forEach(function (l) { if (l.kind !== 'feed' || !l.tx || l.block < (seen._m || tip) - FIRST_WINDOW) return; /* first look marks 3 days seen but plays only the last few hours (fresh win) */ var ids = (l.petIds || [l.petId]).filter(function (id) { var p = by[id]; return p && p.owner === ME; }); if (!ids.length) return;
      if (!fresh('f:' + l.tx, l.block, FIRST_FEED)) return; ids.forEach(function (id) { if (!fedSet[id]) { fedSet[id] = 1; fed.push(id); } }); fedB = Math.max(fedB, l.block);
      if (ids.length === 1) { var cm = /\(care (\d+(?:\.\d+)?)\)/.exec(l.msg || ''); if (cm) fedCare = { id: ids[0], care: +cm[1] }; } });
    if (fed.length) { var lp = by[fed[0]]; out.push({ kind: 'feed', ids: fed.slice(0, 5), n: fed.length, block: fedB, care: careOf(w, lp, tip, fedCare && fedCare.id === fed[0] ? fedCare.care : lp.care) }); }
    /* stage-ups + Mythic: live pets' stages vs what this browser saw last time (compact "id.stage" list; Mythic and dead pets leave the list) */
    var prev = {}, hadSt = false; try { var raw = localStorage.getItem(stKey(ME)); if (raw != null) { hadSt = true; raw.split(',').forEach(function (x) { var q = x.split('.'); if (q[0]) prev[q[0]] = +q[1]; }); } } catch (e) { }
    var st = [], ups = [], myth = [];
    w.pets.forEach(function (p) { if (p.owner !== ME || p.released || p.community) return; var s = stageOf(p), was = prev[p.id];
      if (!p.dead && !p.zombie && s < 5) st.push(p.id + '.' + s);
      if (!hadSt || was == null || p.dead || s <= was) return; if (s >= 5) { if (!p.resurrected && fresh('m:' + p.id, tip)) myth.push(p.id); } else if (fresh('s:' + p.id + ':' + s, tip)) ups.push(p); });
    try { localStorage.setItem(stKey(ME), st.join(',')); } catch (e) { }
    if (ups.length) { ups.sort(function (a, b) { return stageOf(b) - stageOf(a) || tierOf(b) - tierOf(a) || a.id - b.id; }); out.push({ kind: 'stage', ids: [ups[0].id], to: stageOf(ups[0]), n: ups.length }); }
    if (myth.length) out.push({ kind: 'mythic', ids: rank(w, myth).slice(0, 1), n: myth.length });
    /* a resurrected pet at Mythic is a God (V2Rules stageLabelOf): once per pet; 'g:' keys are never pruned (a pet can grow into it long after its raise) */
    var gods = []; w.pets.forEach(function (p) { if (p.owner !== ME || p.dead || p.zombie || p.released || !p.resurrected || stageOf(p) < 5) return; if (fresh('g:' + p.id, p.resurrected.block > tip - FIRST_WINDOW ? p.resurrected.block : (first ? p.resurrected.block : tip))) gods.push(p.id); });
    if (gods.length) out.push({ kind: 'god', ids: rank(w, gods).slice(0, 1), n: gods.length });
    /* starvation: my pets that died unfed (not raised as zombies since), newest first */
    var dead = []; w.pets.forEach(function (p) { if (p.owner !== ME || !p.dead || p.released || p.zombie || p.deathBlock == null || p.deathBlock > tip) return; if (p.deathBlock < (seen._m || tip) - FIRST_WINDOW) return; if (fresh('d:' + p.id + ':' + p.deathBlock, p.deathBlock)) dead.push(p); });
    if (dead.length) { dead.sort(function (a, b) { return b.deathBlock - a.deathBlock || tierOf(b) - tierOf(a); }); out.push({ kind: 'starve', ids: [dead[0].id], n: dead.length, block: dead[0].deathBlock }); }
    if (seen._m !== tip) { seen._m = tip; dirty = true; Object.keys(seen).forEach(function (x) { if (x !== '_m' && x.charAt(0) !== 'g' && seen[x] < tip - FIRST_WINDOW - 144) delete seen[x]; }); } /* older keys can never come back (see the block filters above) */
    if (dirty) try { localStorage.setItem(k, JSON.stringify(seen)); localStorage.setItem(markKey(ME), String(tip)); } catch (e) { } return out; }
  function markKey(ME) { return 'xcpets-life-mark-' + ME; } /* js/v2.js reads this mark to decide, without this file, whether anything is newer (see lifeNeeded there) */
  function previewKind() { try { var q = new URLSearchParams(location.search).get('anim'); return q && (PAINT[q] || q === 'feed-many' || (q.indexOf('birth-') === 0 && BT[q.slice(6)])) ? q : null; } catch (e) { return null; } }
  function previewEvent(w, ME) { var kind = previewKind(); if (!kind) return null; var q = new URLSearchParams(location.search), by = (w && w.byId) || {}, id = +q.get('pet') || 0, all = (w && w.pets) || [];
    var mineL = all.filter(function (p) { return (!ME || p.owner === ME) && !p.released && !p.community && p.art; }); if (!mineL.length) mineL = all.filter(function (p) { return p.art && !p.community; });
    var alive = mineL.filter(function (p) { return !p.dead; }), pick = function (L, n) { L = L.slice().sort(function (a, b) { return tierOf(b) - tierOf(a) || b.stage - a.stage || a.id - b.id; }); return L.slice(0, n).map(function (p) { return p.id; }); };
    var ids = id && by[id] ? [id] : [];
    if (kind === 'hatch') return { kind: 'hatch', ids: ids.length ? ids : pick(alive, 1), n: 1 };
    if (kind === 'hatch-bulk') { var hb = ids.concat(pick(alive.filter(function (p) { return p.id !== id; }), 3 - ids.length)); return { kind: 'hatch-bulk', ids: hb, n: 144 }; }
    if (kind === 'feed') { var fp = ids.length ? by[ids[0]] : by[pick(alive.filter(function (p) { return p.stage < 5; }), 1)[0]]; return { kind: 'feed', ids: fp ? [fp.id] : [], n: 1, care: fp ? careOf(w, fp, w.tip || 0, fp.care) : null }; }
    if (kind === 'feed-many') { var fm = ids.concat(pick(alive.filter(function (p) { return p.id !== id && p.stage < 5; }), 5 - ids.length)), f0 = by[fm[0]]; return { kind: 'feed', ids: fm, n: 12, care: f0 ? careOf(w, f0, w.tip || 0, f0.care) : null }; }
    if (kind === 'stage') { var sp = ids.length ? by[ids[0]] : by[pick(alive.filter(function (p) { return p.stage >= 2 && p.stage < 5; }), 1)[0]] || by[pick(alive, 1)[0]]; return { kind: 'stage', ids: sp ? [sp.id] : [], to: sp ? Math.max(1, Math.min(4, stageOf(sp))) : 2, n: 1 }; }
    if (kind === 'mythic') return { kind: 'mythic', ids: ids.length ? ids : pick(alive.filter(function (p) { return stageOf(p) >= 5; }).concat(alive), 1), n: 1 };
    if (kind === 'god') { var gp = ids.length ? ids : pick(alive.filter(function (p) { return p.resurrected; }).concat(alive.filter(function (p) { return stageOf(p) >= 5; })).concat(alive), 1); return { kind: 'god', ids: gp.slice(0, 1), n: 1 }; }
    if (kind.indexOf('birth-') === 0) { var bt = kind.slice(6); if (!BT[bt]) return null; var two = bt === 'twins' || bt === 'gemini', cand = ids.length ? by[ids[0]] : null;
      if (!cand) { var withPar = alive.filter(function (p) { return p.parents && p.parents.length === 2; }), hit = withPar.filter(function (p) { return specialOf(w, p) === bt; }); cand = hit[0] || withPar.filter(function (p) { return two ? p.twinOf : true; }).sort(function (a, b) { return tierOf(b) - tierOf(a) || b.id - a.id; })[0] || alive[0]; }
      var bi = cand ? [cand.id] : []; if (two && cand) bi.push(cand.twinOf && by[cand.twinOf] ? cand.twinOf : (pick(alive.filter(function (p) { return p.id !== cand.id; }), 1)[0])); return { kind: 'birth', tier: bt, ids: bi, n: 1 }; }
    if (kind === 'starve') return { kind: 'starve', ids: ids.length ? ids : pick(mineL.filter(function (p) { return p.dead; }).concat(alive), 1), n: 1, block: id && by[id] ? by[id].deathBlock : null };
    return null; }
  var PV = false;
  function preview(w, ME, o) { if (PV) return false; var ev = previewEvent(w, ME); if (!ev) return false; PV = true; setTimeout(function () { play(ev, Object.assign({ w: w }, o || {})); }, 400); return true; }
  API = window.V2LifeAnim = { birthOf: birthOf, specialOf: specialOf, BIRTH_KINDS: BIRTH_ORDER, last: null, play: play, paint: paint, hatch: hatch, collect: collect, preview: preview, previewKind: previewKind, previewEvent: previewEvent, caption: caption,
    busy: function () { return !!BUSY; }, LEN: LEN, KEY_F: KEY_F, W: W, H: H, FPS: FPS, KINDS: Object.keys(PAINT) };
})();
