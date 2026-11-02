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
 * Later batches (same rules: display only, once per browser):
 *   sold/bought/listed/closed   market trades (batch 3)        gift-in/gift-out/swap   gifts and swaps (batch 6)
 *   gear      a paid gear roll: the piece lands on the pet or in the bag, tier ring colour (batch 4)
 *   hunt-won  my pet hunts a zombie: the zombie sinks, a grave rises (+1 spin, badge)     hunt-lost  black eye, nothing else lost (batch 5)
 *   altar     my pledge to a Resurrection altar: pets + gear fly into the candle-lit tomb (batch 5)
 *   arrival   a 1-of-1 / contest / Burn Lord grant egg of mine lands on a gold beam with its gear (batch 7)
 *   grant     a Founder kit or Kekistan flag grant drops into my bag by parachute crate (batch 7)
 * Each confirmed event plays ONCE per browser (localStorage 'xcpets-life-seen-<address>', keyed by tx, or pet + stage / pet + death block); several new
 * events of one kind play as ONE scene. First visit: only the last FIRST_WINDOW blocks play. Stage-ups are found by comparing each live pet's stage
 * with the stage this browser saw last time ('xcpets-life-st-<address>').
 * Preview any time (never marks anything seen): ?anim=hatch|hatch-bulk|feed|feed-many|stage|mythic|starve|birth-cross|birth-alike|gear|sold|bought|listed|closed|gift-in|gift-out|swap|hunt-won|hunt-lost|altar|arrival|grant[&pet=ID][&seance=1][&src=flag][&egg=0] */
(function () {
  'use strict';
  var W = 128, H = 80, FPS = 10, GY = 64, CX = 64, FIRST_WINDOW = 432, FIRST_FEED = 36;
  var C = { ol: '#16141f', gold: '#ffc93c', gold2: '#fff3b0', heart: '#ff4f7a', heart2: '#ffb3c6', grass: '#3f8f35', grass2: '#7dff6a', dirt: '#523822', dirt2: '#3e2a18',
    shell: '#f4ecd8', shell2: '#c9bfa6', bowl: '#3d8bff', bowl2: '#1b4fa6', food: '#e8a03a', food2: '#a8641e', s1: '#9a9ea8', s2: '#c8ccd4', s3: '#7c808c', s4: '#525560',
    sky: ['#1b1440', '#25195a', '#33206e', '#452a7e', '#5a3488'], night: ['#0b0a1f', '#141233', '#1d1a44', '#262150', '#342e5e'], cyan: '#7fe8ff', pink: '#ff8fd8', violet: '#b58cff' };
  var TC = ['#cfd6dd', '#4fc06b', '#3d8bff', '#ffcf3a'], TN = ['COMMON', 'UNCOMMON', 'RARE', 'LEGENDARY'];
  var STAGES = ['EGG', 'HATCHLING', 'JUVENILE', 'ADULT', 'ELDER', 'MYTHIC'];
  var LEN = { arrival: 54, grant: 46, 'hunt-won': 46, 'hunt-lost': 44, altar: 52, gear: 46, sold: 46, bought: 48, listed: 36, closed: 40, 'gift-in': 48, 'gift-out': 42, swap: 40, birth: 58, god: 60, hatch: 46, 'hatch-bulk': 30, feed: 40, stage: 40, mythic: 64, starve: 48 }, KEY_F = { arrival: 48, grant: 40, 'hunt-won': 40, 'hunt-lost': 38, altar: 46, gear: 40, sold: 42, bought: 44, listed: 32, closed: 36, 'gift-in': 44, 'gift-out': 38, swap: 36, birth: 52, god: 54, hatch: 40, 'hatch-bulk': 26, feed: 30, stage: 34, mythic: 58, starve: 44 };
  function reduced() { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }
  function rnd(seed) { var s = (seed >>> 0) || 1; return function () { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 10000) / 10000; }; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function px(g, x, y, c, w, h) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w || 1, h || w || 1); }
  function disc(g, cx, cy, r, c, ry) { ry = ry || r; for (var y = -ry; y <= ry; y++) for (var x = -r; x <= r; x++) if ((x * x) / (r * r || 1) + (y * y) / (ry * ry || 1) <= 1) px(g, cx + x, cy + y, c); }
  function ring(g, cx, cy, r, c, ry) { ry = ry || r; var n = Math.max(10, Math.round(r * 7)); for (var i = 0; i < n; i++) { var a = i / n * Math.PI * 2; px(g, cx + Math.cos(a) * r, cy + Math.sin(a) * ry, c); } }
  /* crisp-text-1101: the scene is drawn at k device pixels per scene pixel (k = whole number, set in paint). Text is drawn at device resolution
   * in a whole multiple of 8 px (Press Start 2P's own grid), at whole device pixels, with a hard one-font-pixel shadow (no blur, no sub-pixel ghost). */
  function text(g, s, x, y, c, size, align) { var k = g.__k || 1; g.save(); size = size || 8;
    if (k < 2) { g.font = size + 'px "Press Start 2P", monospace'; g.textAlign = align || 'center'; g.textBaseline = 'top'; g.fillStyle = C.ol; g.fillText(s, Math.round(x) + 1, Math.round(y) + 1); g.fillStyle = c; g.fillText(s, Math.round(x), Math.round(y)); g.restore(); return; }
    var want = size * k, fp = Math.max(8, Math.floor(want / 8) * 8); if (fp < want * 0.75) fp = Math.ceil(want / 8) * 8; var u = fp / 8;
    g.setTransform(1, 0, 0, 1, 0, 0); g.imageSmoothingEnabled = false; g.shadowBlur = 0; g.shadowColor = 'transparent'; g.font = fp + 'px "Press Start 2P", monospace'; g.textAlign = 'left'; g.textBaseline = 'top';
    var wd = Math.round(g.measureText(s).width / u) * u, X = Math.round(x * k) - (align === 'left' ? 0 : align === 'right' ? wd : Math.round(wd / 2 / u) * u), Y = Math.round(y * k);
    g.fillStyle = C.ol; g.fillText(s, X + u, Y + u); g.fillStyle = c; g.fillText(s, X, Y); g.restore(); }
  /* ---- sprites: the pet's own 32x32 art on a keyed background (bare: no gear, no looks) ---- */
  var SPR = {};
  function keyed(p, stage, ov) { var r = window.V2Render; if (!r || !p || !p.art || typeof r.framesWith !== 'function') return null; var c = document.createElement('canvas'); c.width = c.height = 32;
    r.paint(c, r.framesWith(Object.assign({}, p.art, { background: 'solid', bgColor: '#ff00ff', pattern: 'none' }), stage, ov || [])[0]);
    var d = c.getContext('2d').getImageData(0, 0, 32, 32), a = d.data; for (var i = 0; i < a.length; i += 4) if (a[i] > 240 && a[i + 1] < 16 && a[i + 2] > 240) a[i + 3] = 0;
    var kill = []; for (var q = 0; q < 1024; q++) { var j = q * 4; if (!a[j + 3] || !(a[j] - a[j + 1] > 60 && a[j + 2] - a[j + 1] > 50)) continue; var x = q % 32, y = (q / 32) | 0;
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(function (d) { var X = x + d[0], Y = y + d[1]; return X < 0 || Y < 0 || X > 31 || Y > 31 || !a[(Y * 32 + X) * 4 + 3]; })) kill.push(j); }
    kill.forEach(function (j) { a[j + 3] = 0; }); return a; }
  function toCanvas(a) { var c = document.createElement('canvas'); c.width = c.height = 32; var id = c.getContext('2d').createImageData(32, 32); id.data.set(a); c.getContext('2d').putImageData(id, 0, 0); c.rgba = a; return c; }
  function fallback() { var a = new Uint8ClampedArray(4096), col = [120, 200, 110]; function put(x, y, k) { var j = (y * 32 + x) * 4; a[j] = k[0]; a[j + 1] = k[1]; a[j + 2] = k[2]; a[j + 3] = 255; }
    for (var y = 12; y < 32; y++) for (var x = 10; x < 22; x++) if (y > 14 || (x > 11 && x < 20)) put(x, y, col); put(13, 17, [20, 20, 20]); put(18, 17, [20, 20, 20]); return toCanvas(a); }
  function stageOf(p) { return p ? (p.ascended ? 5 : p.stage | 0) : 1; }
  function sprite(p, stage, ov) { if (stage == null) stage = stageOf(p); var k = (p ? p.id : 0) + ':' + stage + (ov ? ':' + ov : ''); if (SPR[k]) return SPR[k]; var out = null;
    try { var a = keyed(p, stage, ov ? [ov] : null); out = a ? toCanvas(a) : null; } catch (e) { out = null; } if (!out) out = fallback(); SPR[k] = out; return out; }
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
    godborn: { t: 'GOD-BORN!', sub: 'CHILD OF TWO GODS', c: '#ffffff', c2: '#cfe9ff', sky: 'sky' },
    cross: { t: '1 OF 1!', sub: 'A CROSS ALL ITS OWN', c: '#b98cff', c2: '#7dff6a', sky: 'night' }, alike: { t: 'ALIKE!', sub: 'TWO OF THE SAME', c: '#7fe3ff', c2: '#ffb3c6', sky: 'sky' }, twins: { t: 'TWINS!', sub: 'TWO EGGS, ONE BURN', c: C.pink, c2: '#ffffff', sky: 'sky' } };
  var BIRTH_ORDER = ['seraph', 'dynast', 'chimera', 'gravekin', 'heirloom', 'gemini', 'godborn', 'cross', 'alike', 'twins'];
  /* batch 8 (branch allpets-crosses-1101, owner Nov 1 2026 7:36 PM CT, PREVIEW; both events need a rules gate that is null on main, so nothing plays live):
   *   birth-cross  a baby of a 1 of 1 with its own cross body (Bo or pigeon in the partner's colours, or a Viking / Kekamozard / Don mix): the two
   *                parents' colours braid into the egg, it hatches, the new body is named ("PEPE BO")
   *   birth-alike  look-alike twins: the two eggs hatch together, a scan line sweeps both, an equals sign blinks, "ALL BUT ITS EYES" names the one difference */
  var DEMO = {}; /* ?anim= preview only: stand-in pets built with the real rule functions when the world has none yet */
  function twoKids(t) { return t === 'twins' || t === 'gemini' || t === 'alike'; }
  function crossName(p) { var R = window.V2Rules; return p && p.art && p.art.cross && R && R.crossLabel ? R.crossLabel(p.art.cross) : ''; }
  function alikeSub(p, q) { var a = (p && p.twinAlike) || (q && q.twinAlike); return a ? 'ALL BUT ITS ' + String(a.trait).toUpperCase() : BT.alike.sub; }
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
    if (ev.tier === 'cross' && f >= 8 && up < 0) { var pc = par.map(function (q) { var a = sprite(q).rgba, cnt = {}, best = null; if (a) for (var j = 0; j < 1024; j++) if (a[j * 4 + 3]) { var k = a[j * 4] + ',' + a[j * 4 + 1] + ',' + a[j * 4 + 2]; if (a[j * 4] + a[j * 4 + 1] + a[j * 4 + 2] > 160) { cnt[k] = (cnt[k] || 0) + 1; if (!best || cnt[k] > cnt[best]) best = k; } } return best ? 'rgb(' + best + ')' : T.c; });
      for (var hb = 0; hb < 30; hb++) { var yb = 30 + hb, ph = hb * 0.45 - f * 0.5, wv = Math.round(Math.sin(ph) * 7); px(g, CX + wv, yb, hb % 4 === 0 ? '#ffffff' : (pc[0] || T.c), 2, 1); px(g, CX - wv, yb, hb % 4 === 2 ? '#ffffff' : (pc[1] || T.c2), 2, 1); } } /* the two parents' colours braid down into the egg */
    if (up < 0) { xs.forEach(function (x, i) { nest(g, x); var t = tierOf(kids[i]), tilt = f >= 6 ? ((f >> 1) % 2 ? 1 : -1) * (f > 12 ? 2 : 1) : 0; egg(g, x, GY - 1, t, clamp(Math.floor((f - 10) / 2), 0, 4), tilt);
        if (f >= 16) { silhouette(g, sprite(kids[i]), x - 16, GY - 33, T.c, 2); px(g, x - 7, GY - 16, '#ffffff', 14, 14); } }); return birthText(g, ev, f, T, false); }
    if (up < 3) { for (var yy = 0; yy < H; yy++) for (var xx = 0; xx < W; xx++) if (((xx + yy) % (up + 2)) === 0) px(g, xx, yy, '#ffffff'); }
    xs.forEach(function (x, i) { var p = kids[i], s = sprite(p), jy = up < 6 ? [0, 6, 9, 10, 9, 6][up] : ((f >> 2) % 2), y = GY - 32 - jy; nest(g, x);
      if (ev.tier === 'gravekin') { var rise = clamp(16 - up * 2, 0, 16); y = GY - 32 + rise; for (var m = 0; m < 26; m++) if ((m * 7 + f) % 5 < 2) px(g, x - 14 + (m * 5) % 28, GY - 4 - ((m * 3 + f) % 22), T.c, 2, 1); }
      if (ev.tier === 'seraph') { wing(g, x - 9, y + 18, -1, f, '#ffffff', T.c2); wing(g, x + 9, y + 18, 1, f, '#ffffff', T.c2); }
      if (ev.tier === 'gemini' && i === 1) flipSpr(g, s, x - 16, y); else drawSpr(g, s, x - 16, y);
      if (ev.tier === 'seraph' || ev.tier === 'godborn') halo(g, x, y + topY(s) - 4 - (ev.tier === 'godborn' ? clamp(10 - up, 0, 10) : 0), ev.tier === 'godborn' ? '#fff3b0' : T.c2);
      if (ev.tier === 'chimera') [['#ff6b6b', 0], ['#6bff9a', 2.09], ['#6b9bff', 4.19]].forEach(function (o) { var a = o[1] + f * 0.35, r = clamp(26 - up, 15, 26); for (var tr = 0; tr < 4; tr++) px(g, x + Math.cos(a - tr * 0.18) * r, y + 18 + Math.sin(a - tr * 0.18) * r * 0.55, tr ? o[0] : '#ffffff', tr ? 1 : 3, tr ? 1 : 3); }); });
    if (ev.tier === 'alike' && up >= 4) { var sx2 = CX - 34 + ((up - 4) * 4) % 76; if (up < 23) for (var sy = GY - 34; sy < GY; sy += 2) px(g, sx2, sy, '#ffffff', 1, 1); if ((f >> 2) % 2) { px(g, CX - 3, GY - 20, T.c, 7, 2); px(g, CX - 3, GY - 16, T.c, 7, 2); } } /* scan both twins, blink = */
    if (ev.tier === 'cross' && up >= 6) { for (var cr = 0; cr < 8; cr++) { var ca = cr / 8 * Math.PI * 2 + f * 0.2; px(g, CX + Math.cos(ca) * 22, GY - 18 + Math.sin(ca) * 10, cr % 2 ? T.c : T.c2, 2, 2); } } /* a ring of sparks round the new body */
    if (ev.tier === 'gemini') { var gc = (f >> 1) % 2 ? T.c : T.c2; px(g, CX - 4, 22, gc, 9, 1); px(g, CX - 4, 32, gc, 9, 1); px(g, CX - 2, 23, gc, 1, 9); px(g, CX + 2, 23, gc, 1, 9); }
    if (up >= 4) sparkle(g, f, 17, CX, GY - 20, two ? 90 : 60, T.c, T.c2); birthText(g, ev, f, T, true); }
  function birthText(g, ev, f, T, born) { if (!born) { if (f >= 6) text(g, 'SOMETHING STIRS...', CX, GY + 6, T.c2, 5); return; } var up = f - 20; if (up < 6) return;
    text(g, T.t, CX, 4, (f >> 1) % 2 ? T.c : '#ffffff', 8); text(g, ev.sub || T.sub, CX, GY + 6, T.c2, 5); if (ev.n > 1) text(g, '+' + (ev.n - 1) + ' MORE', CX, 15, '#ffffff', 5); }
  function godF(g, ev, f, P) { var p = P.list[0], s = sprite(p, 5), dawn = clamp((f - 8) / 20, 0, 1), rise = clamp((f - 16) / 14, 0, 1), y = GY - 32 - Math.round(rise * 10), x = CX - 16;
    var bands = C.night.map(function (c, i) { return dawn < 0.5 ? c : ['#3a2a6e', '#5a3c8a', '#8a5aa0', '#c08ab0', '#e8b8c0'][i]; }); skyBands(g, bands, f, dawn < 0.5 ? 26 : 8);
    if (f >= 18) rays(g, CX, y + 14, f, ['#ffffff', C.cyan, '#cfe9ff'], 14); if (f >= 10) { var bw = clamp(f - 10, 0, 7); for (var by = 0; by < GY; by++) for (var bx = -bw; bx <= bw; bx++) if (((bx + by + (f >> 1)) & 1) === 0 || Math.abs(bx) < bw / 3) px(g, CX + bx, by, Math.abs(bx) < bw / 3 ? '#ffffff' : '#cfe9ff'); }
    hills(g); grass(g); stone(g, 10, 10); stone(g, 108, 12); if (f < 16) { stone(g, CX - 4, 11 - (f >> 2)); } cloud(g, 22, 18 - (rise * 4)); cloud(g, 106, 14 - (rise * 4));
    if (f >= 22) { wing(g, CX - 9, y + 18, -1, f, '#ffffff', C.cyan); wing(g, CX + 9, y + 18, 1, f, '#ffffff', C.cyan); }
    if (f < 16) dither(g, s, x, GY - 20 + (16 - f), [9, 8, 7, 6, 6, 5, 5, 4, 4, 3, 3, 2, 2, 2, 1, 1][f]); else if (f < 24 && f % 2) silhouette(g, s, x, y, '#ffffff'); else drawSpr(g, s, x, y + (f >= 34 ? (f >> 2) % 2 : 0));
    if (f >= 24) halo(g, CX, y + topY(s) - 4 - clamp(30 - f, 0, 6), '#fff3b0'); if (f >= 26) sparkle(g, f, 31, CX, 30, 100, C.cyan, '#ffffff');
    if (f >= 30) { text(g, 'GOD!', CX, 4, (f >> 1) % 2 ? '#ffffff' : C.cyan, 8); px(g, 22, GY + 4, C.ol, 84, 12); text(g, 'RISEN + MYTHIC', CX, GY + 6, '#ffffff', 5); } }
  /* ---- batch 3: the shop (sold / bought / listed / closed), gifts and swaps. Data: w.listings (V2Rules addListing/applyMatch), w.giftLog (gift / swap / token move) */
  function stall(g, f, shut) { px(g, 30, 22, C.ol, 3, GY - 22); px(g, 95, 22, C.ol, 3, GY - 22); px(g, 31, 22, '#8a5a2b', 1, GY - 22); px(g, 96, 22, '#8a5a2b', 1, GY - 22);
    for (var i = 0; i < 12; i++) { var x = 26 + i * 6.5; px(g, x, 16, i % 2 ? '#ffffff' : '#e8414f', 7, 8); disc(g, x + 3, 24, 3, i % 2 ? '#ffffff' : '#e8414f', 2); } px(g, 26, 15, C.ol, 78, 1);
    if (shut) { var sh = Math.round(clamp(shut, 0, 1) * (GY - 40)); for (var y = 0; y < sh; y += 3) { px(g, 33, 27 + y, '#9aa3ad', 62, 2); px(g, 33, 29 + y, '#5c636b', 62, 1); } }
    px(g, 28, GY - 14, C.ol, 72, 14); px(g, 29, GY - 13, '#b07a3a', 70, 12); px(g, 29, GY - 13, '#e0b060', 70, 2); for (var k = 34; k < 98; k += 10) px(g, k, GY - 10, '#8a5a2b', 1, 9); }
  function coin(g, x, y, f) { var e = (f >> 1) % 4; px(g, x - (e === 2 ? 0 : 2), y - 2, C.ol, e === 2 ? 2 : 5, 5); px(g, x - (e === 2 ? 0 : 1), y - 1, C.gold, e === 2 ? 1 : 3, 3); if (e !== 2) px(g, x - 1, y - 1, C.gold2, 1, 1); }
  function tag(g, x, y, f, c) { var sw = (f >> 2) % 2; px(g, x + 2, y - 4, C.s2, 1, 4); px(g, x - 1 + sw, y, C.ol, 9, 6); px(g, x + sw, y + 1, c || '#ffffff', 7, 4); px(g, x + 1 + sw, y + 2, C.ol, 1, 1); }
  function box(g, x, y, c, c2, lid) { px(g, x - 9, y - 14, C.ol, 18, 14); px(g, x - 8, y - 13, c, 16, 12); px(g, x - 1, y - 13, c2, 2, 12); px(g, x - 8, y - 9, c2, 16, 2);
    var ly = y - 16 - (lid || 0); px(g, x - 10, ly, C.ol, 20, 4); px(g, x - 9, ly + 1, c, 18, 2); px(g, x - 1, ly, c2, 2, 4); px(g, x - 5, ly - 3, c2, 4, 3); px(g, x + 1, ly - 3, c2, 4, 3); }
  function banner(g, s, y, bg, fg, w0) { var w = w0 || 76; px(g, CX - w / 2 - 1, y - 1, C.ol, w + 2, 13); px(g, CX - w / 2, y, bg, w, 11); text(g, s, CX, y + 2, fg, 8); }
  function walk(f, a, b, n) { var k = clamp(f / n, 0, 1); return Math.round(a + (b - a) * k); }
  function hop(f) { return (f >> 1) % 2 ? 2 : 0; }
  function soldF(g, ev, f, P) { var p = P.list[0], s = sprite(p); skyBands(g, C.sky, f, 12); hills(g); grass(g); stall(g, f);
    var x = f < 12 ? CX - 16 : walk(f - 12, CX - 16, W + 4, 16), y = f < 12 ? GY - 46 : f < 16 ? GY - 46 + (f - 12) * 4 : GY - 32 - hop(f); if (x < W) drawSpr(g, s, x, y); if (f < 12) tag(g, CX + 10, GY - 30, f);
    var bag = clamp(Math.floor((f - 18) / 2), 0, 12); disc(g, 14, GY - 6, 7 + (bag >> 2), '#8a5a2b', 6 + (bag >> 2)); px(g, 11, GY - 14 - (bag >> 2), '#5a3a1b', 7, 3); text(g, '$', 14, GY - 10, C.gold, 5);
    for (var i = 0; i < 9; i++) { var t = f - 18 - i * 2; if (t >= 0 && t < 10) coin(g, 12 + ((i * 5) % 9), 4 + t * 5.5, f + i); }
    if (f >= 16) { var d = clamp(22 - f, 0, 6); banner(g, 'SOLD!', 3 - d * 3, '#e8414f', '#ffffff', 60); }
    if (f >= 28 && ev.amt) { px(g, 26, GY + 4, C.ol, 76, 12); text(g, '+' + ev.amt, CX, GY + 6, C.gold, 5); } if (f >= 30) sparkle(g, f, 23, 14, GY - 12, 26, C.gold, C.gold2); }
  function boughtF(g, ev, f, P) { var p = P.list[0], s = sprite(p); skyBands(g, C.sky, f, 12); hills(g); grass(g); stall(g, f);
    for (var i = 0; i < 6; i++) { var t = f - i * 2; if (t >= 0 && t < 12) coin(g, 4 + t * 7, GY - 20 - Math.sin(t / 11 * Math.PI) * 26, f + i); }
    var x = f < 18 ? CX - 16 : walk(f - 18, CX - 16, 4, 14), y = f < 18 ? GY - 46 : f < 22 ? GY - 46 + (f - 18) * 4 : GY - 32 - (f < 32 ? hop(f) : 0); drawSpr(g, s, x, y); if (f < 18) tag(g, CX + 10, GY - 30, f);
    for (var h = 0; h < 3; h++) { var hs = f - 32 - h * 4; if (hs >= 0 && hs < 14) heart(g, x + 8 + h * 6, y - 4 - hs, hs > 10 ? C.heart2 : C.heart); }
    if (f >= 30) { banner(g, 'NEW PET!', 3, C.bowl2, '#ffffff', 76); text(g, 'FROM THE SHOP', CX, GY + 6, C.gold2, 5); } }
  function listedF(g, ev, f, P) { var p = P.list[0], s = sprite(p); skyBands(g, C.sky, f, 12); hills(g); grass(g); stall(g, f);
    var x = f < 10 ? walk(f, W, CX + 18, 10) : CX - 16 + clamp(26 - (f - 10) * 6, 0, 34), y = f < 10 ? GY - 32 - hop(f) : f < 16 ? GY - 46 - [6, 10, 10, 8, 4, 0][f - 10] : GY - 46; drawSpr(g, s, x, y);
    if (f >= 18) { var dy = clamp(24 - f, 0, 6) * 4; tag(g, CX + 10, GY - 30 - dy, f, C.gold2); } if (f >= 22) { banner(g, 'LISTED!', 3, '#2f7a24', '#ffffff', 70); if (ev.amt) text(g, 'ASKS ' + ev.amt, CX, GY + 6, C.gold2, 5); } if (f >= 22) sparkle(g, f, 41, CX, GY - 30, 40, C.gold2, '#ffffff'); }
  function closedF(g, ev, f, P) { var p = P.list[0], s = sprite(p); skyBands(g, C.sky, f, 12); hills(g); grass(g);
    var x = f < 18 ? CX - 16 : walk(f - 18, CX - 16, -34, 16), y = f < 18 ? GY - 46 : f < 22 ? GY - 46 + (f - 18) * 4 : GY - 32 - hop(f); stall(g, f, f >= 12 ? (f - 12) / 14 : 0); drawSpr(g, s, x, y);
    if (f < 8) tag(g, CX + 10, GY - 30, f); else if (f < 16) tag(g, CX + 10, GY - 30 + (f - 8) * 4, f); if (f >= 26) { banner(g, 'OFF THE SHELF', 3, C.s4, '#ffffff', 112); text(g, 'STAYS WITH YOU', CX, GY + 6, '#ffffff', 5); } }
  function giftInF(g, ev, f, P) { var p = P.list[0], s = sprite(p), land = 16, by = f < land ? 6 + f * 3.6 : GY; skyBands(g, C.sky, f, 14); hills(g); grass(g);
    if (f < land) { ring(g, CX, by - 30, 12, '#ffffff', 6); px(g, CX - 12, by - 30, '#ffffff', 24, 1); for (var i = -1; i <= 1; i++) beam(g, CX + i * 11, by - 30, CX, by - 16, 0, C.s2); }
    var open = f - land - 6, wig = f >= land && open < 0 ? ((f >> 1) % 2 ? 1 : -1) : 0;
    if (open >= 0) { var r = clamp(open, 0, 6); drawSpr(g, s, CX - 16, GY - 32 - clamp(open * 3, 0, 18) + (open > 8 ? 18 - hop(f) : 0) - (open > 8 ? 18 : 0)); for (var c = 0; c < 14; c++) { var a = c / 14 * Math.PI * 2, rr = 6 + r * 4; px(g, CX + Math.cos(a) * rr, GY - 20 + Math.sin(a) * rr * 0.7 + open * 0.6, [C.heart, C.gold, C.cyan, C.grass2][c % 4], 2, 2); } }
    box(g, CX + wig, by, '#e8414f', C.gold, open >= 0 ? 10 + open * 4 : 0); if (open >= 6) { banner(g, 'A GIFT!', 3, '#e8414f', '#ffffff', 64); if (ev.who) text(g, 'FROM PLAYER #' + ev.who, CX, GY + 6, C.gold2, 5); else if (ev.n > 1) text(g, ev.n + ' PETS', CX, GY + 6, C.gold2, 5); }
    if (open >= 10) for (var h = 0; h < 3; h++) { var hs = open - 10 - h * 4; if (hs >= 0 && hs < 14) heart(g, CX - 10 + h * 8, GY - 40 - hs, hs > 10 ? C.heart2 : C.heart); } }
  function giftOutF(g, ev, f, P) { var p = P.list[0], s = sprite(p); skyBands(g, C.sky, f, 14); hills(g); grass(g);
    var drop = 12, fly = f - 24, by = f < drop ? 10 + f * 4.5 : GY - Math.max(0, fly) * 3.2; if (f < drop + 2) drawSpr(g, s, CX - 16, GY - 32 - (f < 8 ? hop(f) : 0));
    if (f >= 2) { if (fly >= 0) { [[-8, '#ff8fd8'], [0, C.cyan], [8, C.gold]].forEach(function (b) { var bx = CX + b[0], bt = by - 34; px(g, bx, bt + 6, C.s2, 1, 14 + (b[0] ? 2 : 0)); disc(g, bx, bt, 4, b[1], 5); px(g, bx - 2, bt - 3, '#ffffff', 1, 2); }); }
      if (f >= drop || f % 2 === 0) box(g, CX, Math.min(by, GY), '#3d8bff', C.gold, 0); }
    if (f >= 30) { banner(g, 'GIFTED!', 3, '#3d8bff', '#ffffff', 64); text(g, ev.who ? 'TO PLAYER #' + ev.who : 'SENT', CX, GY + 6, C.gold2, 5); if (ev.n > 1) text(g, '+' + (ev.n - 1) + ' MORE', CX, 16, '#ffffff', 5); }
    if (f >= 16 && f < 22) sparkle(g, f, 51, CX, GY - 10, 30, C.gold, '#ffffff'); }
  function swapF(g, ev, f, P) { var a = P.list[0], b = P.list[1] || P.list[0], sa = sprite(a), sb = sprite(b), t = clamp((f - 8) / 16, 0, 1), L = 18, R = W - 50;
    skyBands(g, C.sky, f, 14); hills(g); grass(g); var ax = Math.round(L + (R - L) * t), bx = Math.round(R - (R - L) * t), arc = Math.round(Math.sin(t * Math.PI) * 22);
    if (f >= 4 && f < 26) { for (var i = 0; i < 20; i++) if ((i + (f >> 1)) % 3 === 0) { var k = i / 19; px(g, L + 16 + (R - L) * k, GY - 40 - Math.sin(k * Math.PI) * 22, C.cyan, 2, 1); px(g, L + 16 + (R - L) * k, GY - 4 + Math.sin(k * Math.PI) * 0, C.pink, 2, 1); } }
    drawSpr(g, sa, ax, GY - 32 - arc - (f > 28 ? hop(f) : 0)); drawSpr(g, sb, bx, GY - 32 + (t > 0 && t < 1 ? 2 : 0) - (f > 28 ? hop(f + 1) : 0));
    if (f < 26) { text(g, '#' + a.id, ax + 16, GY - 40 - arc, C.cyan, 5); text(g, '#' + b.id, bx + 16, GY + 3, C.pink, 5); }
    if (f >= 12 && f < 20) sparkle(g, f, 61, CX, GY - 24, 30, C.cyan, C.pink);
    if (f >= 26) { banner(g, 'SWAP!', 3, '#7a3fd0', '#ffffff', 56); text(g, '#' + a.id + ' <-> #' + b.id, CX, GY + 6, C.gold2, 5); } }
  /* ---- batch 4: a paid gear roll lands (after the Pepe Wheel reveal): a capsule in the piece's tier colour drops, pops, the real piece flies onto the pet (or into its bag when the slot is locked) */
  var ICON = {};
  function icon(item) { if (!item) return null; if (ICON[item] !== undefined) return ICON[item]; var out = null;
    try { var c = window.V2Render && V2Render.iconCanvas ? V2Render.iconCanvas(item, '') : null; if (c) { var d = c.getContext('2d').getImageData(0, 0, c.width, c.height), a = d.data, n = c.width, bg = [a[0], a[1], a[2]], x0 = n, y0 = n, x1 = -1, y1 = -1;
        for (var q = 0; q < n * n; q++) { var j = q * 4; if (!a[j + 3] || (Math.abs(a[j] - bg[0]) + Math.abs(a[j + 1] - bg[1]) + Math.abs(a[j + 2] - bg[2]) < 6)) { a[j + 3] = 0; continue; } var X = q % n, Y = (q / n) | 0; if (X < x0) x0 = X; if (X > x1) x1 = X; if (Y < y0) y0 = Y; if (Y > y1) y1 = Y; }
        if (x1 >= 0) { out = document.createElement('canvas'); out.width = x1 - x0 + 1; out.height = y1 - y0 + 1; var t = document.createElement('canvas'); t.width = t.height = n; t.getContext('2d').putImageData(d, 0, 0); out.getContext('2d').drawImage(t, x0, y0, out.width, out.height, 0, 0, out.width, out.height); } } } catch (e) { out = null; }
    ICON[item] = out; return out; } /* the real piece's own pixels (V2Render.iconCanvas), background keyed out and cropped; drawn at whole-pixel scale */
  function piece(g, ev, x, y, big) { var t = clamp(ev.tier | 0, 0, 3), ic = icon(ev.item), w = ic ? ic.width : 6, h = ic ? ic.height : 6, r = Math.min(12, Math.round(Math.max(w, h) / 2) + 3);
    if (big) { disc(g, x, y, r + 1, C.ol); disc(g, x, y, r, TC[t]); disc(g, x, y, r - 1, '#2a1f55'); }
    if (ic) { g.save(); g.imageSmoothingEnabled = false; g.drawImage(ic, Math.round(x - w / 2), Math.round(y - h / 2)); g.restore(); } else { px(g, x - 3, y - 3, TC[t], 6, 6); px(g, x - 2, y - 2, C.ol, 4, 4); } }
  function bag(g, x, f) { px(g, x - 7, GY - 12, C.ol, 14, 12); px(g, x - 6, GY - 11, '#8a5a2b', 12, 10); px(g, x - 6, GY - 11, '#a8743a', 12, 2); px(g, x - 3, GY - 15, C.ol, 6, 4); px(g, x - 2, GY - 14, '#b07a3a', 4, 2); px(g, x - 1, GY - 7, C.s2, 2, 2); }
  function gearF(g, ev, f, P) { var p = P.list[0], s = sprite(p), t = clamp(ev.tier | 0, 0, 3), col = TC[t], px0 = CX - 30, py = GY - 32, cx = CX + 14, ty = topY(s); skyBands(g, C.sky, f, 14); hills(g); grass(g);
    var inBag = !!ev.bag, bx = CX + 44; if (inBag) bag(g, bx, f);
    if (f < 12) { var cy = -6 + f * 5.6; if (cy > GY - 6) cy = GY - 6; for (var k = 1; k < 4; k++) if (cy - k * 6 > 0) px(g, cx, cy - k * 6, k === 1 ? col : C.violet, 1, 3); disc(g, cx, cy, 6, C.ol); disc(g, cx, cy, 5, col); px(g, cx - 5, cy, C.ol, 11, 1); px(g, cx - 2, cy - 4, '#ffffff', 2, 2); }
    else if (f < 18) { var wb = (f % 2 ? 1 : -1) * (f < 16 ? 1 : 0); disc(g, cx + wb, GY - 6, 6, C.ol); disc(g, cx + wb, GY - 6, 5, col); px(g, cx - 5 + wb, GY - 6, C.ol, 11, 1); px(g, cx - 2 + wb, GY - 10, '#ffffff', 2, 2); }
    else if (f < 22) { var r0 = (f - 17) * 4; ring(g, cx, GY - 8, r0, col); ring(g, cx, GY - 8, r0 + 2, '#ffffff'); disc(g, cx - 4 - (f - 18), GY - 4, 4, col, 2); disc(g, cx + 4 + (f - 18), GY - 4, 4, col, 2); }
    var end = inBag ? { x: bx, y: GY - 16 } : { x: px0 + 16, y: py + ty + 2 };
    if (f >= 18 && f < 34) { var k2 = clamp((f - 24) / 8, 0, 1), rise = f < 24 ? (f - 18) * 3 : 18, x = cx + (end.x - cx) * k2, y = (GY - 10 - rise) + (end.y - (GY - 28)) * k2 - Math.sin(k2 * Math.PI) * 10;
      if (t >= 2 && f < 26) rays(g, x, y, f, [col, '#ffffff'], 8); piece(g, ev, x, y, k2 < 0.7); if (f >= 20 && f < 26) sparkle(g, f, 41, x, y, 22, col, '#ffffff'); }
    drawSpr(g, s, px0, py - (f >= 32 ? hop(f) : 0));
    if (f >= 34) { if (inBag) { piece(g, ev, bx, GY - 18 - ((f >> 2) % 2), false); } else piece(g, ev, end.x, end.y - (f >= 32 ? hop(f) : 0), false); sparkle(g, f, 23, inBag ? bx : px0 + 16, inBag ? GY - 18 : py + 12, 30, col, '#ffffff');
      banner(g, 'NEW GEAR!', 3, '#2a6f3a', '#ffffff', 80); text(g, TN[t], CX, 18, col, 5); if (p) text(g, '#' + p.id, px0 + 16, GY + 4, C.gold2, 5); } }
  /* ---- batch 5: the HUNTER's side of a zombie hunt (the zombie owner's side is js/v2-cem-anim.js 'hunted') and altar pledges (log kind 'pledge'; Resurrection pledges 'rpl' are v2-cem-anim's) ---- */
  function zspr(p, fi) { var k = (p ? p.id : 0) + ':z:' + (fi % 4); if (SPR[k]) return SPR[k]; var out = null, z = window.V2ZombieLook;
    try { if (z && z.transparent && p && p.art) { var run = function () { return keyed(p, p.stage); }, base = z.noHand ? z.noHand(run) : run(), E = (z.gameEyes && z.gameEyes(p.art, p.stage, fi % 4)) || (z.starEyes ? z.starEyes(p.art, p.stage, fi % 4) : null);
        var r = base && z.transparent(base, p.id, fi % 4, 4, { ground: false, eyes: E, feral: true }); out = r ? toCanvas(r.data) : null; } } catch (e) { out = null; }
    if (!out) { var a0 = sprite(p).rgba, a = new Uint8ClampedArray(4096); if (a0) { a.set(a0); for (var i = 0; i < 4096; i += 4) if (a[i + 3]) { var l = (a[i] + a[i + 1] + a[i + 2]) / 3; a[i] = l * 0.45; a[i + 1] = Math.min(255, l * 0.8 + 50); a[i + 2] = l * 0.4; } out = toCanvas(a); } else out = fallback(); }
    SPR[k] = out; return out; } /* the zombie look: V2ZombieLook when the page has it, else a green-grey tint of the pet's own pixels */
  function clipSpr(g, spr, x, y, clipY, alpha) { g.save(); g.beginPath(); g.rect(0, 0, W, clipY); g.clip(); if (alpha != null) g.globalAlpha = alpha; g.drawImage(spr, Math.round(x), Math.round(y)); g.restore(); }
  function tomb(g, x, h, c) { px(g, x - 7, GY - h, C.ol, 14, h); px(g, x - 6, GY - h + 1, c || C.s1, 12, h - 1); px(g, x - 6, GY - h + 1, C.s2, 2, h - 1); disc(g, x, GY - h + 1, 6, C.ol, 3); disc(g, x, GY - h + 1, 5, c || C.s1, 2);
    if (h > 10) { px(g, x - 1, GY - h + 3, C.s4, 2, 7); px(g, x - 3, GY - h + 5, C.s4, 6, 2); } }
  function candle(g, x, y, f, i) { px(g, x - 1, y - 5, C.ol, 3, 6); px(g, x, y - 4, C.shell, 1, 5); var fl = (f + i) % 3; px(g, x, y - 7 - (fl === 1 ? 1 : 0), C.gold, 1, 2); px(g, x, y - 8 - (fl === 1 ? 1 : 0), C.gold2, 1, 1); }
  function huntF(g, ev, f, P) { var a = P.list[0], z = P.list[1] || P.list[0], won = ev.kind === 'hunt-won', sa = sprite(a), zx = W - 46, zs = zspr(z, f >> 2);
    skyBands(g, C.night, f, 24); disc(g, 108, 12, 6, '#e8e4c8'); disc(g, 110, 11, 5, C.night[0]); hills(g); grass(g); tomb(g, 12, 12); tomb(g, 118, 9, C.s3);
    var hx = f < 8 ? 6 : f < 14 ? walk(f - 8, 6, CX - 30, 6) : CX - 30, hy = GY - 32 - (f < 8 ? hop(f) : 0);
    if (!won && f >= 18) { var k = clamp((f - 18) / 6, 0, 1); hx = Math.round(CX - 30 - k * 26); hy = GY - 32 - Math.round(Math.sin(k * Math.PI) * 10); sa = sprite(a, null, 'v2-black-eye'); }
    if (won && f >= 26) hy = GY - 32 - hop(f);
    /* the zombie: sways; won = sinks into the earth, a fresh grave rises in its place */
    var sink = won ? clamp((f - 18) / 14, 0, 1) : 0, zy = GY - 31 + Math.round(sink * 30 / 2) * 2 + (f % 4 < 2 ? 0 : 1);
    if (won && f >= 22) { disc(g, zx + 16, GY + 1, 12, C.dirt, 2); tomb(g, zx + 16, clamp(Math.round((f - 22) * 1.8), 0, 16)); }
    if (sink < 1) { if (won && f >= 18) clipSpr(g, zs, zx + (f < 22 && f % 2 ? 1 : 0), zy, GY + 1); else drawSpr(g, zs, zx + (f >= 14 && f < 18 ? 2 : 0), zy); }
    if (won && f >= 18 && f < 30) for (var m = 0; m < 10; m++) if ((m * 5 + f) % 4 < 2) px(g, zx + 6 + (m * 7) % 22, GY - 4 - ((m * 3 + f * 2) % 20), '#7dff9a', 1, 2);
    drawSpr(g, sa, hx, hy);
    if (f >= 14 && f < 19) { var sx = CX + 2; for (var i = 0; i < 12; i++) { px(g, sx - 8 + i * 1.5, GY - 34 + i * 2, '#ffffff', 2, 1); px(g, sx + 8 - i * 1.5, GY - 34 + i * 2, f % 2 ? C.gold2 : '#ffffff', 1, 1); } disc(g, sx, GY - 22, 2 + (f - 14), '#ffffff'); }
    if (!won && f >= 22) { var cx2 = hx + 16, cy2 = hy + topY(sa) - 3; for (var s = 0; s < 3; s++) { var an = f * 0.5 + s * 2.09; px(g, cx2 + Math.cos(an) * 8, cy2 + Math.sin(an) * 2.5, s % 2 ? C.gold2 : C.gold, 2, 2); } }
    if (f >= 30 && won) { banner(g, 'HUNTED!', 3, '#2f7a24', '#ffffff', 64); text(g, 'LAID TO REST', CX, 16, '#7dff9a', 5); if (ev.spin) { px(g, 20, GY + 4, C.ol, 88, 12); text(g, '+1 SPIN  HUNTER', CX, GY + 6, C.gold2, 5); } sparkle(g, f, 71, hx + 16, hy + 8, 30, C.gold, '#ffffff'); }
    if (f >= 28 && !won) { banner(g, 'BLACK EYE', 3, C.s4, '#ffffff', 84); text(g, 'NOTHING ELSE LOST', CX, GY + 6, '#ffffff', 5); }
    if (f < 8) text(g, 'HUNT!', CX, 6, (f >> 1) % 2 ? '#ffffff' : '#7dff9a', 6); }
  function altarF(g, ev, f, P) { var G = P.list[0], offer = P.list.slice(1, 4), gear = (ev.gear || []).slice(0, 3 - Math.min(offer.length, 2)), items = offer.map(function (p) { return { p: p }; }).concat(gear.map(function (it) { return { it: it }; })).slice(0, 4);
    skyBands(g, C.night, f, 26); hills(g); grass(g); var ax = CX + 26, glow = clamp((f - 12) / 24, 0, 1);
    if (f >= 10) { var rr = 10 + Math.round(glow * 6); ring(g, ax, GY - 1, rr + 6, C.violet, 3); ring(g, ax, GY - 1, rr, (f >> 1) % 2 ? C.cyan : C.violet, 2); }
    tomb(g, ax, 18); [[-16, 0], [-10, 3], [10, 3], [16, 0]].forEach(function (q, i) { candle(g, ax + q[0], GY + 1 + q[1] - 2, f, i); });
    var st = 8, np = items.filter(function (o) { return o.p; }).length; items.forEach(function (o, i) { var x0 = o.p ? -6 + i * 26 : 2 + np * 26 + (i - np) * 14, t0 = st + i * 7, t = f - t0, k = clamp(t / 10, 0, 1), x = x0 + (ax - 16 - x0) * k, y = GY - 32 - Math.sin(k * Math.PI) * 18 - k * 6;
      if (o.p) { var s = sprite(o.p); if (t < 0) drawSpr(g, s, x0, GY - 32 - (f >> 1) % 2 * (i % 2)); else if (t < 10) { if (t % 2) silhouette(g, s, x, y, C.violet, 2); else dither(g, s, x, y, 1 + (t >> 1)); } }
      else { var ix = x0 + 6, iy = GY - 12; if (t < 0) piece(g, { item: o.it, tier: 2 }, ix, iy - ((f >> 2) % 2), true); else if (t < 10) piece(g, { item: o.it, tier: 2 }, ix + (ax - ix) * k, iy - Math.sin(k * Math.PI) * 20, k < 0.6); }
      if (t >= 10 && t < 16) { ring(g, ax, GY - 22, (t - 9) * 3, C.gold2); sparkle(g, f, 81 + i, ax, GY - 22, 20, C.violet, '#ffffff'); } });
    if (G && f >= 30) silhouette(g, sprite(G), ax - 16, GY - 50 - ((f >> 2) % 2), '#cfd6ff', 3);
    if (f >= 34) { banner(g, 'PLEDGED!', 3, '#4a2a8a', '#ffffff', 70); text(g, 'ALTAR ON #' + (G ? G.id : ''), CX, 16, C.cyan, 5); if (ev.closes) { px(g, 10, GY + 4, C.ol, 108, 12); text(g, ev.seance ? 'SEANCE POOL OPEN' : 'CLOSES AT ' + Number(ev.closes).toLocaleString('en-US'), CX, GY + 6, C.gold2, 5); } } }
  var NOPE = /crown|frame|fire|flame|aura/i; /* the scenes never draw these pieces (captions still count them) */
  function shown(L) { return (L || []).filter(function (it) { return it && !NOPE.test(it) && iconOk(it); }); } /* and only pieces whose icon shows on the dark disc */
  var IOK = {}; function iconOk(it) { if (IOK[it] !== undefined) return IOK[it]; var c = icon(it), n = 0; try { if (c) { var a = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; for (var j = 0; j < a.length; j += 4) { var X = (j >> 2) % c.width; if (a[j + 3] > 128 && a[j] + a[j + 1] + a[j + 2] > 150 && Math.abs(X - c.width / 2) <= c.width / 8 + 1) n++; } } } catch (e) { n = 0; } return (IOK[it] = n >= 2); } /* bright pixels down the middle, so a split piece (cape halves) is not an empty disc */
  function arrivalF(g, ev, f, P) { var p = P.list[0], t = 3, land = 22, ey = f < 4 ? -16 : f < land ? -16 + (GY + 14) * clamp((f - 4) / (land - 4), 0, 1) : GY - 1, gear = shown(ev.gear).slice(0, 4), gx = [CX - 27, CX + 27, CX - 51, CX + 51];
    skyBands(g, C.night, f, 30); if (f >= land + 2) rays(g, CX, GY - 8, f, [C.gold, C.gold2, C.violet, '#ffffff'], 12); hills(g); grass(g);
    if (f >= 2 && f < land + 10) { var bw = f < land ? 5 : clamp(land + 10 - f, 0, 5); for (var by = 0; by < GY; by++) for (var bx = -bw; bx <= bw; bx++) if (((bx + by + (f >> 1)) & 1) === 0 || Math.abs(bx) < bw / 3) px(g, CX + bx, by, Math.abs(bx) < bw / 3 ? '#ffffff' : C.gold2); }
    nest(g, CX); var tilt = f >= land + 4 && f < land + 14 ? ((f >> 1) % 2 ? 1 : -1) : 0; egg(g, CX, Math.round(ey), t, 0, tilt);
    if (f < land) sparkle(g, f, 7, CX, ey - 10, 18, C.gold2, '#ffffff');
    if (f >= land && f < land + 8) { ring(g, CX, GY - 7, (f - land + 1) * 4, (f >> 1) % 2 ? C.gold2 : '#ffffff', (f - land + 1) * 2); }
    gear.forEach(function (it, i) { var t0 = land + 8 + i * 3, k = clamp((f - t0) / 5, 0, 1); if (f < t0) return; piece(g, { item: it, tier: 3 }, CX + (gx[i] - CX) * k, GY - 12 - Math.sin(k * Math.PI) * 14 - ((f >> 2) % 2) * (k === 1 ? 1 : 0), true); });
    if (f >= land + 6) sparkle(g, f, 41, CX, GY - 14, 60, C.gold, '#ffffff');
    if (f >= 30) { banner(g, ev.ed || '1 OF 1!', 3, '#6a3fb0', '#ffffff', ev.ed && ev.ed.length > 8 ? 92 : 64); if (ev.title) text(g, String(ev.title).toUpperCase().slice(0, 24), CX, 16, C.gold2, 5); }
    if (f >= 38) { px(g, 10, GY + 4, C.ol, 108, 12); text(g, ev.egg ? 'FEED IT TO HATCH' : 'IT IS YOURS', CX, GY + 6, '#ffffff', 5); } }
  function grantF(g, ev, f, P) { var land = 16, by = f < land ? 6 + f * 3.6 : GY, open = f - land - 6, items = shown(ev.items).slice(0, 4), m = items.length, xs = m > 1 ? items.map(function (x, i) { return CX - 39 + i * (78 / (m - 1)); }) : [CX];
    skyBands(g, C.sky, f, 14); hills(g); grass(g);
    if (f < land) { ring(g, CX, by - 30, 12, C.grass2, 6); px(g, CX - 12, by - 30, C.grass2, 24, 1); for (var i = -1; i <= 1; i++) beam(g, CX + i * 11, by - 30, CX, by - 16, 0, C.s2); }
    var wig = f >= land && open < 0 ? ((f >> 1) % 2 ? 1 : -1) : 0; box(g, CX + wig, by, '#2f7a3a', C.gold, open >= 0 ? clamp(10 + open * 4, 0, 26) : 0);
    items.forEach(function (it, i) { var t0 = open - i * 3, k = clamp(t0 / 6, 0, 1); if (t0 < 0) return; piece(g, { item: it, tier: 3 }, CX + (xs[i] - CX) * k, GY - 20 - k * 9 - Math.sin(k * Math.PI) * 10 + (k === 1 ? (f >> 2) % 2 : 0), true); });
    if (open >= 2) sparkle(g, f, 57, CX, GY - 30, 90, C.gold, C.grass2);
    if (open >= 8) { banner(g, 'GRANT!', 3, '#2f7a3a', '#ffffff', 60); if (ev.label) text(g, String(ev.label).toUpperCase().slice(0, 24), CX, 16, C.gold2, 5); }
    if (open >= 14) { px(g, 10, GY + 4, C.ol, 108, 12); text(g, ev.rolls ? '+' + ev.rolls + ' FREE ROLLS' : (ev.n || m) + ' PIECE' + ((ev.n || m) === 1 ? '' : 'S') + ' IN YOUR BAG', CX, GY + 6, '#ffffff', 5); } }
  var PAINT = { arrival: arrivalF, grant: grantF, 'hunt-won': huntF, 'hunt-lost': huntF, altar: altarF, gear: gearF, sold: soldF, bought: boughtF, listed: listedF, closed: closedF, 'gift-in': giftInF, 'gift-out': giftOutF, swap: swapF, birth: birthF, god: godF, hatch: hatchF, 'hatch-bulk': hatchF, feed: feedF, stage: stageF, mythic: mythicF, starve: starveF };
  function pets(ev, w) { var by = (w && w.byId) || {}, L = (ev.ids || []).slice(0, 5).map(function (id) { return by[id] || DEMO[id] || { id: id }; }); return { list: L, care: ev.care || null, par: ev.kind === 'birth' && L[0] && L[0].parents ? L[0].parents.map(function (id) { return by[id]; }).filter(Boolean) : [] }; }
  function paint(c, ev, f, w) { var g = c.getContext('2d'), k = Math.max(1, Math.round(c.width / W)); g.__k = k; g.setTransform(k, 0, 0, k, 0, 0); g.imageSmoothingEnabled = false; g.shadowBlur = 0; g.clearRect(0, 0, W, H); /* crisp-text-1101 */ (PAINT[ev.kind] || feedF)(g, ev, f, pets(ev, w)); }
  function nm(p, id) { return '#' + (p ? p.id : id) + (p && p.name ? ' ' + p.name : ''); }
  function more(n, shown) { return n > shown ? ' and ' + (n - shown).toLocaleString('en-US') + ' more' : ''; }
  function caption(ev, w) { var P = pets(ev, w), p = P.list[0], n = nm(p, ev.ids && ev.ids[0]), b = ev.block ? ' · block ' + Number(ev.block).toLocaleString('en-US') : '';
    switch (ev.kind) {
      case 'hatch': case 'hatch-bulk': return '🥚 ' + (ev.n > 1 ? ev.n.toLocaleString('en-US') + ' eggs hatched! Best: ' + n + ' (' + TN[tierOf(p)].toLowerCase() + ')' : n + ' hatched (' + TN[tierOf(p)].toLowerCase() + ')');
      case 'feed': return '🍖 ' + (ev.n > 1 ? 'Fed ' + ev.n.toLocaleString('en-US') + ' pets: ' + n + more(ev.n, 1) : 'Fed ' + n) + b;
      case 'stage': return '✨ ' + n + ' grew to ' + (STAGES[ev.to] || '').charAt(0) + (STAGES[ev.to] || '').slice(1).toLowerCase() + (ev.n > 1 ? '. ' + (ev.n - 1) + ' more pets grew a stage' : '');
      case 'mythic': return '🌈 ' + n + ' reached MYTHIC: it never starves now' + (ev.n > 1 ? '. ' + (ev.n - 1) + ' more pets reached Mythic' : '');
      case 'birth': { var T = BT[ev.tier] || BT.twins, lab = T.t.replace('!', '').toLowerCase(); lab = lab.charAt(0).toUpperCase() + lab.slice(1);
        if (ev.tier === 'cross') return '\u2728 ' + n + ' was born a 1 of 1 cross: ' + (crossName(P.list[0]) || 'a body all its own') + (ev.n > 1 ? '. ' + (ev.n - 1) + ' more special births' : '') + b;
        if (ev.tier === 'alike') return '\uD83D\uDC6F Look-alike twins! ' + n + ' and ' + nm(P.list[1], ev.ids[1]) + ' hatched from one breed burn, ' + (ev.sub || '').toLowerCase() + (ev.n > 1 ? '. ' + (ev.n - 1) + ' more special births' : '') + b;
        return (ev.tier === 'twins' ? '👯 Twins! ' + n + ' and ' + nm(P.list[1], ev.ids[1]) + ' hatched from one breed burn' : ev.tier === 'godborn' ? '😇 ' + n + ' is God-born: a child of two Gods' : ev.tier === 'gemini' ? '♊ Gemini twins! ' + n + ' and ' + nm(P.list[1], ev.ids[1]) + ' (rare hybrid tier)' : '🌟 ' + n + ' was born ' + (/^[AEIOUH]/.test(lab) ? 'an ' : 'a ') + lab + ' (rare hybrid tier: ' + T.sub.toLowerCase() + ')') + (ev.n > 1 ? '. ' + (ev.n - 1) + ' more special births' : ''); }
      case 'arrival': return '🎉 ' + n + ' arrived: ' + (ev.title ? ev.title + ', ' : '') + (ev.ed ? ev.ed.replace('!', '').toLowerCase() : '1 of 1') + (ev.ng ? ' + ' + ev.ng + ' gear piece' + (ev.ng === 1 ? '' : 's') : '') + (ev.egg ? '. Feed it to hatch' : '') + (ev.n > 1 ? '. ' + (ev.n - 1) + ' more prize eggs' : '') + b;
      case 'grant': return '📦 Grant: ' + (ev.label || 'gear') + ' (' + ev.n + ' piece' + (ev.n === 1 ? '' : 's') + (ev.rolls ? ' + ' + ev.rolls + ' free rolls' : ev.free ? ' + free rolls' : '') + ') is in your bag' + b;
      case 'hunt-won': return '🗡️ ' + n + ' hunted ' + nm(P.list[1], ev.ids[1]) + ' and laid it to rest for good' + (ev.spin ? ': +2% of its power, +1 saved spin, Zombie Hunter badge' : ' (hunt reward already taken today)') + (ev.n > 1 ? '. ' + (ev.n - 1) + ' more hunts won' : '') + b;
      case 'hunt-lost': return '🤕 ' + n + ' lost the hunt on ' + nm(P.list[1], ev.ids[1]) + ': a black eye, nothing else' + (ev.n > 1 ? '. ' + (ev.n - 1) + ' more hunts lost' : '') + b;
      case 'altar': { var cnt = [ev.np ? ev.np + ' pet' + (ev.np === 1 ? '' : 's') : '', ev.ng ? ev.ng + ' gear' : ''].filter(Boolean).join(' + ') || 'an offering';
        return '🕯️ ' + (ev.seance ? 'Seance pledge: ' : 'You pledged ') + cnt + ' to the altar on ' + n + (ev.seance ? ' (pool open)' : ev.closes ? ' (pool closes at block ' + Number(ev.closes).toLocaleString('en-US') + ')' : '') + (ev.n > 1 ? '. ' + (ev.n - 1) + ' more pledges' : '') + b; }
      case 'gear': return '🎲 ' + n + ' got ' + (ev.label || 'a new piece') + ' (' + TN[clamp(ev.tier | 0, 0, 3)].toLowerCase() + (ev.slot ? ', ' + ev.slot : '') + ') from a paid gear roll' + (ev.bag ? ': it went to the bag (slot locked)' : '') + (ev.n > 1 ? '. ' + (ev.n - 1) + ' more pieces came with it' : '');
      case 'sold': return '💰 SOLD! ' + n + ' went to a new home through the shop' + (ev.amt ? '. You got ' + ev.amt : '') + (ev.n > 1 ? '. ' + (ev.n - 1) + ' more sales' : '') + b;
      case 'bought': return '🛒 You bought ' + n + ' from the shop' + (ev.amt ? ' for ' + ev.amt : '') + (ev.n > 1 ? '. ' + (ev.n - 1) + ' more new pets from the shop' : '') + b;
      case 'listed': return '🏷️ ' + n + ' is in the shop' + (ev.sale ? ' (listing ' + ev.sale + ')' : '') + (ev.amt ? ', asking ' + ev.amt : '') + (ev.until ? ', open until block ' + Number(ev.until).toLocaleString('en-US') : '') + (ev.n > 1 ? '. ' + (ev.n - 1) + ' more listed' : '');
      case 'closed': return '📦 ' + (ev.sale ? 'Listing ' + ev.sale + ' closed: ' : '') + n + ' is off the shelf and stays with you' + (ev.n > 1 ? '. ' + (ev.n - 1) + ' more listings closed' : '') + b;
      case 'gift-in': return '🎁 ' + n + ' arrived as a gift' + (ev.who ? ' from player #' + ev.who : '') + (ev.n > 1 ? '. ' + (ev.n - 1) + ' more pets came with it' : '') + b;
      case 'gift-out': return '🎁 You gave ' + n + (ev.who ? ' to player #' + ev.who : ' away') + (ev.n > 1 ? '. ' + (ev.n - 1) + ' more pets went too' : '') + b;
      case 'swap': return '🔁 Swap done: you gave ' + n + ' and got ' + nm(P.list[1], ev.ids[1]) + (ev.n > 1 ? '. ' + (ev.n - 1) + ' more swaps' : '') + b;
      case 'god': return '👼 ' + n + ' became a God: risen from the Pet Cemetery and Mythic' + (ev.n > 1 ? '. ' + (ev.n - 1) + ' more new Gods' : '');
      case 'starve': return '🪦 ' + n + ' starved (7 days unfed) and went to the Pet Cemetery' + (ev.n > 1 ? '. ' + (ev.n - 1) + ' more pets starved' : '') + b; }
    return ''; }
  function css() { if (document.getElementById('laCss')) return; var s = document.createElement('style'); s.id = 'laCss';
    s.textContent = '.la-ov{position:fixed;inset:0;z-index:100010;background:rgba(10,8,22,.88);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;cursor:pointer;padding:12px;box-sizing:border-box;overflow:hidden}' +
      '.la-ov canvas{image-rendering:crisp-edges;image-rendering:pixelated;border:4px solid #000;box-shadow:4px 4px 0 #000;background:#1b1440;max-width:100%}' +
      '.la-cap{font-family:inherit;color:#fff3b0;font-size:17px;text-align:center;text-shadow:2px 2px 0 #000;max-width:92vw;line-height:1.35;overflow-wrap:anywhere}.la-skip{color:#bbb;font-size:12px}';
    document.head.appendChild(s); }
  var BUSY = null, API;
  /* play(ev, {w, done, still}) -> {end, canvas, frame(k)}; ev = {kind, ids, n, to, care, block, key} */
  function play(ev, o) { o = o || {}; css(); var w = o.w || (window.V2Mock && V2Mock.world && V2Mock.world()), N = LEN[ev.kind] || 40;
    var ov = document.createElement('div'); ov.className = 'la-ov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', caption(ev, w)); ov.dataset.anim = ev.kind;
    var sc = Math.max(2, Math.min(6, Math.floor(Math.min(window.innerWidth - 40, 640) / W))), c = document.createElement('canvas'), dpr = window.devicePixelRatio || 1, K = Math.max(1, Math.round(sc * dpr)); /* crisp-text-1101: whole device pixels per scene pixel */ c.width = W * K; c.height = H * K; c.style.width = W * K / dpr + 'px'; c.style.height = H * K / dpr + 'px';
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
    try { if (R && R.godBornOf && R.godBornOf(w, p)) return 'godborn'; } catch (e) { } if (p.art.cross) return 'cross';
    return p.twinOf && w.byId[p.twinOf] ? (p.twinAlike || w.byId[p.twinOf].twinAlike ? 'alike' : 'twins') : null; }
  /* the special births among the hatched eggs -> one 'birth' event for the most special (twins / Gemini show both twins) */
  function birthOf(w, ids) { var sp = [], seen = {}; ids.slice(0, 3000).forEach(function (id) { var p = w.byId[id], t = specialOf(w, p); if (!t || seen[id]) return; seen[id] = 1; if (p.twinOf) seen[p.twinOf] = 1; sp.push({ p: p, t: t }); });
    if (!sp.length) return null; sp.sort(function (a, b) { return BIRTH_ORDER.indexOf(a.t) - BIRTH_ORDER.indexOf(b.t) || tierOf(b.p) - tierOf(a.p) || a.p.id - b.p.id; }); var top = sp[0];
    var ev = { kind: 'birth', tier: top.t, ids: twoKids(top.t) && top.p.twinOf ? [Math.min(top.p.id, top.p.twinOf), Math.max(top.p.id, top.p.twinOf)] : [top.p.id], n: sp.length };
    if (top.t === 'cross') ev.sub = (crossName(top.p) + ' CROSS').toUpperCase(); if (top.t === 'alike') ev.sub = alikeSub(top.p, w.byId[top.p.twinOf]); return ev; }
  function hatch(w, ids, done) { done = done || function () { }; if (!ids || !ids.length || reduced() || BUSY) { done(); return; }
    var n = ids.length, best = ids.length > 400 ? rank(w, ids.slice(0, 0).concat(ids.filter(function (id) { var p = w.byId[id]; return p && tierOf(p) >= 2; }).slice(0, 400))) : rank(w, ids); if (!best.length) best = ids.slice(0, 5);
    var bev = null; try { bev = birthOf(w, ids); } catch (e) { bev = null; }
    var then = bev ? function () { if (reduced()) return done(); play(bev, { w: w, done: done, noQueue: true }); } : done;
    if (bev && n <= 2 && (n === 1 || bev.ids.length === 2)) return then(); /* one special egg (or one twin pair): its birth scene has the cracking egg already */
    play({ kind: n > 12 ? 'hatch-bulk' : 'hatch', ids: best.slice(0, n > 12 ? 3 : 5), n: n }, { w: w, done: then, noQueue: true }); }
  /* ---- batch 4: wins (js/v2.js notifyWins, V2Rules.newWins: already once per piece) -> one 'gear' event for the best piece a PAID roll (src 'roll') gave my pet, or null */
  function gearOf(w, wins, ME) { if (!w || !wins || !wins.length) return null; var by = w.byId || {}, L = wins.filter(function (x) { var p = x && x.rolledOn != null ? by[x.rolledOn] : null; return x && x.src === 'roll' && p && (!ME || p.owner === ME); }); if (!L.length) return null;
    var best = L[0]; L.forEach(function (x) { if ((x.legendary ? 4 : x.tier || 0) > (best.legendary ? 4 : best.tier || 0)) best = x; }); var it = (w.items || {})[best.gid] || {};
    return { kind: 'gear', ids: [best.rolledOn], n: L.length, item: best.item, label: best.label || best.item, tier: best.legendary ? 3 : best.tier | 0, slot: best.slotName || '', bag: it.bag != null && it.on !== best.rolledOn }; }
  function gearRoll(w, wins, ME, done) { done = done || function () { }; var ev = null; try { ev = gearOf(w, wins, ME); } catch (e) { ev = null; } if (!ev || reduced() || BUSY) { done(); return; } play(ev, { w: w, done: done, noQueue: true }); }
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
    /* the shop (w.listings), gifts + swaps (w.giftLog): one event per kind, newest first; first look plays only the last few hours (FIRST_FEED) */
    var R = window.V2Rules, lo = (seen._m || tip) - FIRST_WINDOW, mk = { sold: [], bought: [], listed: [], closed: [], 'gift-in': [], 'gift-out': [], swap: [] };
    function amtOf(S) { try { return R.saleAmountText(S.asset, S.price); } catch (e) { return ''; } }
    function who(a) { try { var n = R.playerNo(w, a); return n == null ? '' : R.playerCode(n); } catch (e) { return ''; } }
    (w.listings || []).forEach(function (S) { if (!S || (S.seller !== ME && S.buyer !== ME)) return; var A = { ids: [S.petId], sale: S.n, amt: amtOf(S) };
      if (S.status === 'sold' && S.soldBlock >= lo && S.soldBlock <= tip) { if (S.seller === ME && fresh('sd:' + S.n, S.soldBlock, FIRST_FEED)) mk.sold.push(Object.assign({ block: S.soldBlock }, A)); if (S.buyer === ME && fresh('bt:' + S.n, S.soldBlock, FIRST_FEED)) mk.bought.push(Object.assign({ block: S.soldBlock }, A)); }
      if (S.seller !== ME) return; var stt = ''; try { stt = R.saleState(w, S, tip + 1); } catch (e) { }
      if (S.block >= lo && fresh('ls:' + S.n, S.block, FIRST_FEED) && stt === 'open') mk.listed.push(Object.assign({ block: S.block, until: S.expire }, A));
      if (S.status === 'open' && (stt === 'ended' || stt === 'expired')) { var eb = stt === 'ended' && S.endBlock ? S.endBlock : S.expire + 1; if (eb >= lo && eb <= tip + 1 && fresh('cl:' + S.n, eb, FIRST_FEED)) mk.closed.push(Object.assign({ block: eb }, A)); } });
    var gtx = {}; (w.giftLog || []).forEach(function (gr) { if (!gr || gr.sale || gr.block < lo || gr.block > tip || (gr.from !== ME && gr.to !== ME) || gr.from === gr.to) return; var p = by[gr.petId]; if (p && p.burnedTo) return;
      var key = gr.swap ? 'sw:' + gr.swap : 'gf:' + gr.tx + ':' + (gr.to === ME ? 'i' : 'o'); (gtx[key] = gtx[key] || { key: key, block: gr.block, rows: [] }).rows.push(gr); });
    Object.keys(gtx).forEach(function (key) { var G = gtx[key], r0 = G.rows[0]; if (!fresh(key, G.block, FIRST_FEED)) return;
      if (r0.swap) { var gave = G.rows.filter(function (r) { return r.from === ME; })[0], got = G.rows.filter(function (r) { return r.to === ME; })[0]; mk.swap.push({ ids: [gave ? gave.petId : r0.petId, got ? got.petId : r0.petId], block: G.block, swap: r0.swap }); return; }
      var inn = r0.to === ME; mk[inn ? 'gift-in' : 'gift-out'].push({ ids: G.rows.map(function (r) { return r.petId; }), block: G.block, who: who(inn ? r0.from : r0.to) }); });
    ['sold', 'bought', 'gift-in', 'swap', 'gift-out', 'listed', 'closed'].forEach(function (kd) { var L = mk[kd]; if (!L.length) return; L.sort(function (a, b) { return b.block - a.block; });
      var n = L.reduce(function (s, e) { return s + e.ids.length; }, 0), e0 = L[0]; out.push(Object.assign({}, e0, { kind: kd, ids: kd === 'swap' ? e0.ids : e0.ids.slice(0, 1), n: kd === 'swap' ? L.length : n })); });
    /* batch 5: hunts MY pets made (w.cem.hunts, by = me) and my altar pledges (w.cem.altarList[].pledges whose tx logged kind 'pledge'; a seance that raised at once logs 'raise' and is skipped) */
    var CM = w.cem || {}, b5 = { 'hunt-won': [], 'hunt-lost': [], altar: [] }, pk = {};
    (CM.hunts || []).forEach(function (Hh) { if (!Hh || Hh.by !== ME || Hh.block < lo || Hh.block > tip || !fresh('hn:' + Hh.n, Hh.block, FIRST_FEED)) return; b5[Hh.won ? 'hunt-won' : 'hunt-lost'].push({ ids: [Hh.hunter, Hh.zombie], block: Hh.block, spin: !!Hh.spin }); });
    w.log.forEach(function (l) { if (l.kind === 'pledge' && l.tx && l.block >= lo) pk[l.tx] = l; });
    (CM.altarList || []).forEach(function (A) { (A.pledges || []).forEach(function (q) { if (!q || q.src !== ME || !q.tx || !pk[q.tx] || q.block > tip || !fresh('pl:' + q.tx, q.block, FIRST_FEED)) return; var pp = (q.pets || []).map(function (e) { return e.id; }), gg = (q.gear || []).map(function (e) { var it = (w.items || {})[e.gid]; return it && it.item; }).filter(Boolean);
      b5.altar.push({ ids: [A.grave].concat(pp.slice(0, 4)), np: pp.length, ng: (q.gear || []).length, gear: gg.slice(0, 3), block: q.block, closes: A.closesAt, seance: /^seance/.test(pk[q.tx].msg || '') }); }); });
    ['hunt-won', 'hunt-lost', 'altar'].forEach(function (kd) { var L = b5[kd]; if (!L.length) return; L.sort(function (a, b) { return b.block - a.block; }); out.push(Object.assign({}, L[0], { kind: kd, n: L.length })); });
    /* batch 7: 1-of-1 / edition prize eggs granted to me (p.supreme / p.contest / p.burnLord, hatchTx 'XCPETS:...', never bought or gifted in) and gear grants (founder kit, Kekistan flag) */
    var moved = {}; (w.giftLog || []).forEach(function (gr) { if (gr && gr.to === ME) moved[gr.petId] = 1; }); (w.listings || []).forEach(function (S) { if (S && S.buyer === ME) moved[S.petId] = 1; });
    var arr = []; w.pets.forEach(function (p) { var E = p && (p.supreme || p.contest || p.burnLord); if (!E || p.owner !== ME || moved[p.id] || p.released || p.hatchBlock == null || p.hatchBlock < lo || p.hatchBlock > tip || !/^XCPETS:/.test(p.hatchTx || '') || !fresh('ar:' + p.id, p.hatchBlock, FIRST_FEED)) return;
      var src = p.supreme && p.supreme.id, gg = []; if (src) Object.keys(w.items || {}).forEach(function (gid) { var it = w.items[gid]; if (it && it.src === src && it.owner === ME) gg.push(it.item); });
      arr.push({ ids: [p.id], block: p.hatchBlock, ed: p.burnLord ? 'BURN LORD ' + p.burnLord.n + '/' + p.burnLord.of : '1 OF 1!', title: (p.supreme && p.supreme.title) || (p.contest && p.contest.title) || (p.burnLord ? 'Burn Lord' : ''), gear: gg, ng: gg.length, egg: !p.lastFed && !(p.stage | 0) }); });
    if (arr.length) { arr.sort(function (a, b) { return b.block - a.block; }); out.push(Object.assign({}, arr[0], { kind: 'arrival', n: arr.length })); }
    var GR = { founder: 'Founder kit', 'ft-flag-grant': 'Kekistan flag' }, grs = {}; Object.keys(w.items || {}).forEach(function (gid) { var it = w.items[gid]; if (!it || it.owner !== ME || !GR[it.src]) return; var bk = it.src === 'founder' ? w.founderGranted : it.grantBlock; if (bk == null || bk < lo || bk > tip) return;
      (grs[it.src] = grs[it.src] || { kind: 'grant', src: it.src, label: GR[it.src], block: bk, items: [], n: 0, free: it.src === 'founder' }).n++; grs[it.src].items.push(it.item); });
    Object.keys(grs).sort(function (a, b) { return grs[b].block - grs[a].block; }).forEach(function (sk, i) { if (fresh('gr:' + sk, grs[sk].block, FIRST_FEED) && !out.some(function (o) { return o.kind === 'grant'; })) out.push(grs[sk]); });
    if (seen._m !== tip) { seen._m = tip; dirty = true; Object.keys(seen).forEach(function (x) { if (x !== '_m' && x.charAt(0) !== 'g' && seen[x] < tip - FIRST_WINDOW - 144) delete seen[x]; }); } /* older keys can never come back (see the block filters above) */
    if (dirty) try { localStorage.setItem(k, JSON.stringify(seen)); localStorage.setItem(markKey(ME), String(tip)); } catch (e) { } return out; }
  function markKey(ME) { return 'xcpets-life-mark-' + ME; } /* js/v2.js reads this mark to decide, without this file, whether anything is newer (see lifeNeeded there) */
  /* demoBirth: a real cross / look-alike pair when the world has one, else (gates null) stand-ins made by V2Rules.crossOf / twinAlike on copies of live pets.
   * ?anim=birth-cross[&body=rp][&pet=PARTNER]  ?anim=birth-alike[&pet=ID]. Preview only: the copies live in DEMO, never in the world. */
  function demoBirth(w, t, ids, alive, by) { var R = window.V2Rules, q = {}; try { new URLSearchParams(location.search).forEach(function (v, k) { q[k] = v; }); } catch (e) { }
    var real = alive.filter(function (p) { return specialOf(w, p) === t; })[0]; if (real && !ids.length) { var e0 = birthOf(w, [real.id]); if (e0) return e0; }
    if (!R) return null; var cp = function (o) { return JSON.parse(JSON.stringify(o)); };
    if (t === 'cross') { var body = q.body === 'rp' ? 'rarepigeon' : 'bojackson', O = alive.filter(function (p) { return p.species === body; })[0] || { id: -9, species: body, art: { species: body, tierIndex: 3, bgColor: '#14101e' } };
      var Q = (ids.length && by[ids[0]]) || alive.filter(function (p) { return p.species === 'pepe' && stageOf(p) >= 3; })[0] || alive.filter(function (p) { return p.species !== body; })[0]; if (!Q) return null;
      var x = R.crossOf ? R.crossOf(O, Q) : null; if (!x || !x.body) return null; var k = { id: -1, name: 'Baby', parents: [O.id, Q.id], stage: 1, tier: 3, species: Q.species, art: Object.assign(cp(Q.art), { cross: x, tierIndex: 3 }) };
      DEMO[-1] = k; if (O.id === -9) DEMO[-9] = O; return { kind: 'birth', tier: 'cross', ids: [-1], n: 1, sub: (R.crossLabel(x) + ' CROSS').toUpperCase() }; }
    var A = (ids.length && by[ids[0]]) || alive.filter(function (p) { return stageOf(p) >= 3 && p.parents && p.parents.length === 2; }).sort(function (a, b) { return tierOf(b) - tierOf(a) || b.id - a.id; })[0]; if (!A || !R.twinAlike) return null;
    var B = alive.filter(function (p) { return p.id !== A.id && p.species === A.species; })[0] || alive.filter(function (p) { return p.id !== A.id; })[0], a = Object.assign(cp(A), { id: -2, twinOf: -3, stage: 1 }), tw = Object.assign(cp(B), { id: -3, twinOf: -2, stage: 1, parents: A.parents });
    R.twinAlike(a, tw, String(A.id) + 'demo'); DEMO[-2] = a; DEMO[-3] = tw; return { kind: 'birth', tier: 'alike', ids: [-2, -3], n: 1, sub: alikeSub(a, tw) }; }
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
    if (kind === 'birth-cross' || kind === 'birth-alike') { var dm = demoBirth(w, kind.slice(6), ids, alive, by); if (dm) return dm; }
    if (kind.indexOf('birth-') === 0) { var bt = kind.slice(6); if (!BT[bt]) return null; var two = twoKids(bt), cand = ids.length ? by[ids[0]] : null;
      if (!cand) { var withPar = alive.filter(function (p) { return p.parents && p.parents.length === 2; }), hit = withPar.filter(function (p) { return specialOf(w, p) === bt; }); cand = hit[0] || withPar.filter(function (p) { return two ? p.twinOf : true; }).sort(function (a, b) { return tierOf(b) - tierOf(a) || b.id - a.id; })[0] || alive[0]; }
      var bi = cand ? [cand.id] : []; if (two && cand) bi.push(cand.twinOf && by[cand.twinOf] ? cand.twinOf : (pick(alive.filter(function (p) { return p.id !== cand.id; }), 1)[0])); return { kind: 'birth', tier: bt, ids: bi, n: 1 }; }
    if (/^(sold|bought|listed|closed|gift-in|gift-out)$/.test(kind)) return { kind: kind, ids: ids.length ? ids : pick(alive, 1), n: 1, amt: kind === 'closed' || /^gift/.test(kind) ? '' : '11 XCP', sale: 7, until: (w && w.tip || 0) + 1008, who: /^gift/.test(kind) ? '1F' : '' };
    if (kind === 'swap') { var s1 = ids.length ? ids : pick(alive, 1); return { kind: 'swap', ids: s1.concat(pick((function (L) { var sp0 = by[s1[0]] && by[s1[0]].species, o = L.filter(function (p) { return p.species !== sp0 && stageOf(p) >= 1; }); return o.length ? o : L; })(alive.filter(function (p) { return p.id !== s1[0]; })), 1)), n: 1, swap: 1 }; }
    if (kind === 'arrival') { var cand = ids.length ? by[ids[0]] : null; if (!cand) { var ed = all.filter(function (p) { return p.art && (p.supreme || p.contest || p.burnLord); }); cand = ed.filter(function (p) { return p.supreme && (p.supreme.id === 'bo' || p.supreme.id === 'rarepigeon'); })[0] || ed[0] || alive[0]; }
      var sid = cand && cand.supreme && cand.supreme.id, GL = (window.V2Gear && (sid === 'bo' ? V2Gear.BO_GEAR : sid === 'rarepigeon' ? V2Gear.RP_GEAR : null)) || [], ag = GL.map(function (x) { return x[0]; });
      return { kind: 'arrival', ids: cand ? [cand.id] : [], n: 1, ed: cand && cand.burnLord ? 'BURN LORD ' + cand.burnLord.n + '/' + cand.burnLord.of : '1 OF 1!', title: cand ? (cand.supreme && cand.supreme.title) || (cand.contest && cand.contest.title) || (cand.burnLord ? 'Burn Lord' : '') : '', gear: ag, ng: ag.length, egg: q.get('egg') !== '0', block: cand && cand.hatchBlock }; }
    if (kind === 'grant') { var flag = q.get('src') === 'flag', its7 = (w && w.items) || {}, fk = Object.keys(its7).filter(function (k) { return its7[k] && its7[k].src === (flag ? 'ft-flag-grant' : 'founder'); }), tx0 = fk.length && its7[fk[0]].founderTx, fl = fk.filter(function (k) { return flag || its7[k].founderTx === tx0; }).slice(0, flag ? 1 : 5).map(function (k) { return its7[k].item; });
      if (!fl.length) fl = flag ? ['ft-kek-flag'] : ['golden-sword', 'gold', 'goldcape', 'v2-gold-aviators']; return { kind: 'grant', src: flag ? 'ft-flag-grant' : 'founder', label: flag ? 'Kekistan flag' : 'Founder kit', items: fl, n: fl.length, rolls: flag ? 0 : 36, free: !flag, block: w && w.tip }; }
    if (kind === 'hunt-won' || kind === 'hunt-lost') { var h1 = ids.length ? ids : pick(alive, 1), zl = all.filter(function (p) { return p.zombie && p.art && p.id !== h1[0]; }), zp = zl[0] || all.filter(function (p) { return p.art && p.dead && p.id !== h1[0]; })[0] || alive.filter(function (p) { return p.id !== h1[0]; })[0];
      return { kind: kind, ids: h1.concat(zp ? [zp.id] : []), n: 1, spin: kind === 'hunt-won' }; }
    if (kind === 'altar') { var gv = all.filter(function (p) { return p.art && p.dead && !p.zombie && !p.released; }), G0 = gv[gv.length - 1] || alive[0], ofs = pick(alive.filter(function (p) { return !G0 || p.id !== G0.id; }), 2), it2 = (w && w.items) || {}, gk2 = Object.keys(it2).filter(function (k) { return it2[k] && it2[k].item && !/crown|frame|fire|flame|aura/i.test((it2[k].label || '') + ' ' + it2[k].item); });
      return { kind: 'altar', ids: (G0 ? [G0.id] : []).concat(ofs), np: ofs.length, ng: gk2.length ? 1 : 0, gear: gk2.length ? [it2[gk2[0]].item] : [], n: 1, closes: (w && w.tip || 0) + 144, seance: q.get('seance') === '1' }; }
    if (kind === 'gear') { var gp0 = ids.length ? ids : pick(alive, 1), its = (w && w.items) || {}, gk = Object.keys(its).filter(function (k) { return its[k] && its[k].item && !/crown|frame|fire|flame|aura/i.test((its[k].label || '') + ' ' + its[k].item); }) /* preview only: a plain piece */, tq = q.get('tier'), gt = tq != null && /^[0-3]$/.test(tq) ? +tq : 2;
      var gi = gk.filter(function (k) { return its[k].rolledOn === gp0[0] && (its[k].legendary ? 3 : its[k].tier | 0) === gt; })[0] || gk.filter(function (k) { return (its[k].legendary ? 3 : its[k].tier | 0) === gt; })[0] || gk[0], G = gi ? its[gi] : {};
      return { kind: 'gear', ids: gp0, n: 1, item: G.item || '', label: G.label || 'a new piece', tier: gt, slot: G.slot || '', bag: q.get('bag') === '1' }; }
    if (kind === 'starve') return { kind: 'starve', ids: ids.length ? ids : pick(mineL.filter(function (p) { return p.dead; }).concat(alive), 1), n: 1, block: id && by[id] ? by[id].deathBlock : null };
    return null; }
  var PV = false;
  function preview(w, ME, o) { if (PV) return false; var ev = previewEvent(w, ME); if (!ev) return false; PV = true; setTimeout(function () { play(ev, Object.assign({ w: w }, o || {})); }, 400); return true; }
  API = window.V2LifeAnim = { birthOf: birthOf, specialOf: specialOf, BIRTH_KINDS: BIRTH_ORDER, last: null, play: play, paint: paint, hatch: hatch, collect: collect, gearOf: gearOf, gearRoll: gearRoll, preview: preview, previewKind: previewKind, previewEvent: previewEvent, caption: caption,
    busy: function () { return !!BUSY; }, LEN: LEN, KEY_F: KEY_F, W: W, H: H, FPS: FPS, KINDS: Object.keys(PAINT) };
})();
