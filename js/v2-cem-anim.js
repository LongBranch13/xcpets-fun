/* XCPETS cemetery animations (branch cemetery-animations, owner Oct 30 2026 7:27 PM CT [pt2341u]: "There should be animation for that and I didn't
 * see an animation when Nezu was raised after that block confirmed" / "We always need animations for things").
 * Before this file the only rise animation was the altar's pre-burn mock ("See the rise" button in js/v2-cemetery-altar.js); nothing watched the
 * replayed world for CONFIRMED cemetery results, so the seance that raised #2 at block 973864 confirmed with no animation at all.
 *
 * DISPLAY ONLY: reads w.log / pet zombie records after replay; never touches rules, tags, burns, costs or the replay (js/v2-rules.js unchanged).
 * One 128x80 pixel scene, whole pixels, scaled by a whole number (image-rendering: pixelated), stepped at 10 frames a second (no tweening).
 * Tap / click / any key skips. prefers-reduced-motion: one still key frame. Pixel text is the site's "Press Start 2P".
 *   raise            the grave's candles flare, the ground cracks, a claw, then the zombie climbs out          (log kind 'raise')
 *   resurrect-win    suspense roll (chance, the roll number vs the number it must be under), WIN: light + halo, alive again   ('resurrect')
 *   resurrect-fail   same roll, FAIL: the zombie crumbles to dust                                              ('resurrect')
 *   zmeal            the zombie eats the pets one by one, hunger bar fills, burp                                ('zfeed')
 *   feral            hunger ran out: red eyes, red flash                                         (no log line: cemView(...).feral)
 *   crumble / hunted the zombie sinks back into its grave (unfed) / is laid to rest by a hunter         ('crumble' / 'hunt')
 *   pledge           pets / gear pledged to its Resurrection are drawn into the candle circle one by one, the points
 *                    counter ticks up to the new total and the live chance shows (owner 7:54 PM CT "should have animation")   ('rpl')
 * Each confirmed event plays ONCE per browser (localStorage 'xcpets-cem-anim-seen-<address>', keyed by the event's tx), for the wallet whose
 * zombie / grave / pets it is. First visit: only events from the last 432 blocks auto-play (same idea as the fight / breed cut-off).
 * Preview any time (never marks anything seen): ?anim=raise|resurrect-win|resurrect-fail|zmeal|feral|crumble|pledge[&pet=ID][&eat=ID.ID.ID] */
(function () {
  'use strict';
  var W = 128, H = 80, FPS = 10, GY = 62, CX = 64;
  var C = { ol: '#16141f', s1: '#9a9ea8', s2: '#c8ccd4', s3: '#7c808c', s4: '#525560', zg: '#7dff6a', zg2: '#3f8f35', gold: '#ffc93c', gold2: '#fff3b0',
    b1: '#8c1216', b2: '#c41e24', b3: '#e8343a', b4: '#ff6a5e', d1: '#2a1d14', d2: '#3e2a18', d3: '#523822', hole: '#0e0a08', sky: ['#0b0a1f', '#141233', '#1d1a44', '#262150', '#342e5e'], wax: '#e8e0c8', bone: '#efe6d2' };
  var LEN = { raise: 46, 'resurrect-win': 72, 'resurrect-fail': 72, zmeal: 60, feral: 30, crumble: 38, hunted: 38, pledge: 66 };
  var KEY_F = { raise: 40, 'resurrect-win': 64, 'resurrect-fail': 66, zmeal: 54, feral: 20, crumble: 32, hunted: 32, pledge: 60 };
  var FIRST_WINDOW = 432;
  function reduced() { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }
  function rnd(seed) { var s = (seed >>> 0) || 1; return function () { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 10000) / 10000; }; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function px(g, x, y, c, w, h) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w || 1, h || w || 1); }
  function disc(g, cx, cy, r, c, ry) { ry = ry || r; for (var y = -ry; y <= ry; y++) for (var x = -r; x <= r; x++) if ((x * x) / (r * r || 1) + (y * y) / (ry * ry || 1) <= 1) px(g, cx + x, cy + y, c); }
  function ring(g, cx, cy, r, c, ry) { ry = ry || r; var n = Math.max(10, Math.round(r * 7)); for (var i = 0; i < n; i++) { var a = i / n * Math.PI * 2; px(g, cx + Math.cos(a) * r, cy + Math.sin(a) * ry, c); } }
  function text(g, s, x, y, c, size, align) { g.save(); g.font = (size || 8) + 'px "Press Start 2P", monospace'; g.textAlign = align || 'center'; g.textBaseline = 'top';
    if (c !== C.ol) { g.fillStyle = C.ol; g.fillText(s, Math.round(x) + 1, Math.round(y) + 1); } g.fillStyle = c; g.fillText(s, Math.round(x), Math.round(y)); g.restore(); }
  /* ---- sprites: the pet's own 32x32 pixel art on a keyed background (only the pet moves, never its square tile) ---- */
  var SPR = {};
  function R() { return window.V2Render || null; }
  function Z() { return window.V2ZombieLook || null; }
  function keyedRGBA(p) { var r = R(); if (!r || !p || !p.art || typeof r.framesWith !== 'function') return null; var c = document.createElement('canvas'); c.width = c.height = 32;
    r.paint(c, r.framesWith(Object.assign({}, p.art, { background: 'solid', bgColor: '#ff00ff', pattern: 'none' }), p.stage, [])[0]);
    var d = c.getContext('2d').getImageData(0, 0, 32, 32), a = d.data; for (var i = 0; i < a.length; i += 4) if (a[i] > 240 && a[i + 1] < 16 && a[i + 2] > 240) a[i + 3] = 0;
    /* edge pixels blended with the magenta key (a pink fringe) also go: only where they touch a keyed pixel, so pink pets keep their colour */
    var kill = []; for (var q = 0; q < 1024; q++) { var j = q * 4; if (!a[j + 3] || !(a[j] - a[j + 1] > 60 && a[j + 2] - a[j + 1] > 50)) continue; var x = q % 32, y = (q / 32) | 0;
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(function (d) { var X = x + d[0], Y = y + d[1]; return X < 0 || Y < 0 || X > 31 || Y > 31 || !a[(Y * 32 + X) * 4 + 3]; })) kill.push(j); }
    kill.forEach(function (j) { a[j + 3] = 0; }); return a; }
  function toCanvas(a) { var c = document.createElement('canvas'); c.width = c.height = 32; var id = c.getContext('2d').createImageData(32, 32); id.data.set(a); c.getContext('2d').putImageData(id, 0, 0); c.rgba = a; return c; }
  function fallback(mode) { var a = new Uint8ClampedArray(4096), col = mode === 'live' ? [232, 200, 150] : [90, 160, 80];
    function put(x, y, k) { var j = (y * 32 + x) * 4; a[j] = k[0]; a[j + 1] = k[1]; a[j + 2] = k[2]; a[j + 3] = 255; }
    for (var y = 10; y < 32; y++) for (var x = 10; x < 22; x++) if (y > 12 || (x > 11 && x < 20)) put(x, y, col);
    put(13, 15, mode === 'feral' ? [255, 40, 40] : [20, 20, 20]); put(18, 15, mode === 'feral' ? [255, 40, 40] : [20, 20, 20]); return toCanvas(a); }
  function sprite(p, mode, fi) { mode = mode || 'live'; fi = fi || 0; var k = (p ? p.id : 0) + ':' + mode + ':' + (mode === 'live' ? 0 : fi % 4); if (SPR[k]) return SPR[k]; var out = null;
    try { if (mode === 'live') { var a = keyedRGBA(p); out = a ? toCanvas(a) : null; }
      else { var z = Z(); if (z && p && p.art) { var run = function () { return keyedRGBA(p); }, base = z.noHand ? z.noHand(run) : run();
          var E = (z.gameEyes && z.gameEyes(p.art, p.stage, fi % 4)) || (z.starEyes ? z.starEyes(p.art, p.stage, fi % 4) : null);
          var r = base && z.transparent(base, p.id, fi % 4, 4, { ground: false, eyes: E, feral: mode === 'feral' }); out = r ? toCanvas(r.data) : null; } } } catch (e) { out = null; }
    if (!out) out = fallback(mode); SPR[k] = out; return out; }
  function topY(spr) { var a = spr.rgba; if (!a) return 8; for (var y = 0; y < 32; y++) for (var x = 0; x < 32; x++) if (a[(y * 32 + x) * 4 + 3]) return y; return 8; }
  function drawSpr(g, spr, x, y, clipY, alpha) { g.save(); if (clipY != null) { g.beginPath(); g.rect(0, 0, W, clipY); g.clip(); } if (alpha != null) g.globalAlpha = alpha; g.drawImage(spr, Math.round(x), Math.round(y)); g.restore(); }
  function silhouette(g, spr, x, y, col) { var a = spr.rgba; if (!a) return; for (var q = 0; q < 1024; q++) if (a[q * 4 + 3]) px(g, x + (q % 32), y + ((q / 32) | 0), col); }
  /* ---- the cemetery set (same palette as the cemetery scene / altar) ---- */
  function sky(g, f, tint) { for (var i = 0; i < 5; i++) px(g, 0, i * 13, C.sky[i], W, 13); var r = rnd(7); for (var s = 0; s < 22; s++) { var sx = r() * W, sy = r() * 40; if ((s + (f >> 2)) % 7) px(g, sx, sy, s % 3 ? '#cfd3ff' : '#ffffff'); }
    disc(g, 106, 12, 5, C.gold2); px(g, 104, 10, '#e8dc9a', 2); px(g, 108, 14, '#e8dc9a'); px(g, 0, 50, '#2b2650', W, 12);
    for (var t = 0; t < 4; t++) { var hx = 6 + t * 30; px(g, hx, 46, '#211d3d', 10, 16); px(g, hx + 2, 43, '#211d3d', 6, 3); } /* far graves */
    if (tint) { g.save(); g.globalAlpha = Math.min(1, Math.abs(tint)); px(g, 0, 0, tint > 0 ? C.zg2 : C.b1, W, GY); g.restore(); } }
  function ground(g, sx) { sx = sx || 0; px(g, sx, GY, C.d2, W, 1); px(g, sx, GY + 1, C.d1, W, H - GY); var r = rnd(19); for (var i = 0; i < 40; i++) px(g, sx + r() * W, GY + 2 + r() * (H - GY - 2), i % 3 ? C.d3 : '#1a120c'); }
  function stone(g, sx, crack) { var x = CX - 9 + sx, y = 34; px(g, x, y + 3, C.ol, 18, GY - y - 3); px(g, x + 2, y, C.ol, 14, 4); px(g, x + 1, y + 1, C.ol, 16, 3);
    px(g, x + 1, y + 4, C.s1, 16, GY - y - 4); px(g, x + 3, y + 1, C.s1, 12, 3); px(g, x + 1, y + 4, C.s2, 2, GY - y - 4); px(g, x + 15, y + 4, C.s3, 2, GY - y - 4);
    px(g, x + 8, y + 6, C.s4, 2, 9); px(g, x + 5, y + 9, C.s4, 8, 2); if (crack) { px(g, x + 12, y + 2, C.ol, 1, 4); px(g, x + 11, y + 6, C.ol, 1, 3); px(g, x + 12, y + 9, C.ol, 1, 3); } }
  function mound(g, sx, open) { var cx = CX + sx; if (open) { disc(g, cx, GY + 1, 14, C.d3, 3); disc(g, cx, GY + 1, 11, C.hole, 2); } else { disc(g, cx, GY, 14, C.d3, 3); disc(g, cx, GY - 1, 11, C.d2, 2); } }
  var CANDLES = [[30, GY - 2], [44, GY + 6], [84, GY + 6], [98, GY - 2]];
  function candles(g, flare, f) { CANDLES.forEach(function (c, i) { var x = c[0], y = c[1], fl = ((f + i) % 3 === 0) ? 1 : 0, h = 2 + Math.round(flare * 5) + fl;
      if (flare > 0.05) { var gr = 3 + Math.round(flare * 6), gx = x + 1, gy = y - 7 - h / 2; g.save(); g.globalAlpha = 0.45 + 0.2 * fl; for (var dy = -gr; dy <= gr; dy++) for (var dx = -gr; dx <= gr; dx++) if (dx * dx + dy * dy <= gr * gr && ((dx + dy + f) & 1) === 0) px(g, gx + dx, gy + dy, dx * dx + dy * dy < gr * gr / 4 ? C.gold2 : C.gold); g.restore(); } /* dithered 8-bit glow, no soft alpha blob */
      px(g, x - 1, y - 7, C.ol, 5, 8); px(g, x, y - 6, C.wax, 3, 6); px(g, x + 2, y - 6, '#bfb59a', 1, 6);
      px(g, x, y - 7 - h, C.gold, 3, h); px(g, x + 1, y - 8 - h, C.gold2, 1, 2); if (flare > 0.5) px(g, x + 1, y - 5 - h, '#ffffff', 1, Math.max(1, h - 3)); }); }
  var CRACK = [[0, 0], [-3, 1], [-6, 1], [-9, 3], [-12, 4], [-15, 6], [-19, 7], [-23, 9]];
  function cracks(g, k, sx) { for (var side = -1; side <= 1; side += 2) for (var i = 0; i < Math.min(k, CRACK.length); i++) { var c = CRACK[i]; px(g, CX + sx + side * -c[0], GY + 1 + c[1] + (side > 0 ? (i % 2) : 0), C.hole, 2, 1);
      if (i === k - 1) px(g, CX + sx + side * -c[0], GY + c[1], C.zg, 1, 1); } }
  function chips(g, t, seed, cx, cy, n, col) { var r = rnd(seed); for (var i = 0; i < (n || 12); i++) { var vx = (r() - 0.5) * 3.2, vy = -1.5 - r() * 2.4, x = cx + vx * t, y = cy + vy * t + 0.32 * t * t;
      if (y < GY + 4) px(g, x, y, (col || [C.d3, C.d2, '#6b4a2c'])[i % 3], i % 4 ? 1 : 2); } }
  function blood(g, t, seed, cx, cy) { chips(g, t, seed, cx, cy, 10, [C.b2, C.b3, C.b1]); }
  function bones(g, x, y) { px(g, x, y, C.bone, 5, 1); px(g, x - 1, y - 1, C.bone); px(g, x - 1, y + 1, C.bone); px(g, x + 5, y - 1, C.bone); px(g, x + 5, y + 1, C.bone); }
  function halo(g, cx, y, f) { var b = (f >> 1) % 2; ring(g, cx, y - b, 6, C.gold, 1); ring(g, cx, y - b, 5, C.gold2, 1); }
  function sparkle(g, f, seed, cx, cy, spread) { var r = rnd(seed + (f >> 1)); for (var i = 0; i < 6; i++) { var x = cx + (r() - 0.5) * spread, y = cy + (r() - 0.5) * spread * 0.7; px(g, x, y, C.gold2); px(g, x - 1, y, C.gold); px(g, x + 1, y, C.gold); px(g, x, y - 1, C.gold); px(g, x, y + 1, C.gold); } }
  /* ---- frame painters: paint(g, ev, f, pets) draws frame f from scratch ---- */
  function raiseF(g, ev, f, P) { var flare = clamp((f - 3) / 5, 0, 1), shake = f >= 10 && f < 26 ? (f % 2 ? 1 : -1) : 0, open = f >= 18;
    sky(g, f, f >= 6 ? 0.08 + 0.06 * (f % 2) : 0); stone(g, shake, f >= 14); ground(g, shake); mound(g, shake, open); cracks(g, clamp(f - 8, 0, 8), shake);
    if (f >= 12 && f < 32) chips(g, f - 12, 3, CX, GY - 1); if (f >= 20 && f < 34) chips(g, f - 20, 11, CX, GY - 1, 8);
    var spr = sprite(P.pet, 'zombie', f >> 2), ty = topY(spr);
    if (f >= 15 && f < 22) { var hy = GY - clamp(f - 15, 0, 5); px(g, CX - 5, hy, C.zg2, 2, GY - hy + 1); px(g, CX - 6, hy - 1, C.zg, 1, 2); px(g, CX - 4, hy - 2, C.zg, 1, 2); px(g, CX - 3, hy - 1, C.zg, 1, 2); }
    var rise = clamp((f - 20) / 14, 0, 1), sy = GY + 2 - ty - Math.round(rise * (32 - ty)) * 1; sy = Math.round(sy / 2) * 2; if (f >= 20) drawSpr(g, spr, CX - 16, f >= 34 ? GY - 31 + ((f >> 1) % 2) : sy, GY + 1);
    candles(g, flare, f); if (f >= 36) text(g, 'RISEN!', CX, 6, (f >> 1) % 2 ? C.zg : C.gold2, 8); }
  function rollShown(ev, f) { if (f >= 40) return ev.roll; var step = f < 26 ? 1 : f < 34 ? 2 : 3, k = Math.floor(f / step); return Math.floor(rnd(9000 + k * 31 + (ev.roll | 0))() * 10000); }
  function resF(g, ev, f, P) { var win = ev.kind === 'resurrect-win', need = ev.need | 0, n = rollShown(ev, f), drum = f >= 28 && f < 40, shake = drum ? (f % 2 ? 1 : -1) : 0;
    sky(g, f, 0); stone(g, 0, !win && f >= 46); ground(g, 0); mound(g, 0, true); candles(g, f < 40 ? 0.35 + (drum ? 0.3 : 0) : win ? 1 : 0.1, f);
    var zs = sprite(P.pet, 'zombie', f >> 2), ls = sprite(P.pet, 'live', 0), ty = topY(ls), x0 = CX - 16 + shake, y0 = GY - 31;
    if (f < 44) drawSpr(g, zs, x0, y0);
    else if (win) { var bt = clamp((f - 44) / 6, 0, 1); var bw = 6 + Math.round(bt * 2) * 2; for (var by = 0; by < GY; by++) for (var bx = -bw; bx < bw; bx++) if (((bx + by + (f >> 1)) & 1) === 0 || Math.abs(bx) < bw / 3) px(g, CX + bx, by, Math.abs(bx) < bw / 3 ? C.gold2 : C.gold); /* dithered 8-bit light beam */
      var mix = clamp(Math.floor((f - 46) / 2) / 4, 0, 1); if (mix < 1) drawSpr(g, zs, x0, y0, null, 1 - mix); if (mix > 0) drawSpr(g, ls, x0, y0, null, mix);
      if (f >= 52) halo(g, CX, y0 + ty - 3, f); if (f >= 50) sparkle(g, f, 5, CX, y0 + 14, 46); if (f >= 58) text(g, 'ALIVE AGAIN!', CX, GY + 6, C.gold2, 8); }
    else { if (f < 46) silhouette(g, zs, x0, y0, '#ffffff'); else dustPet(g, zs, x0, y0, f - 46); if (f >= 58) text(g, 'DUST', CX, GY + 6, C.s2, 8); }
    /* the roll panel */ px(g, 6, 3, C.ol, 116, 25); px(g, 7, 4, '#221d38', 114, 23); px(g, 7, 4, C.s4, 114, 1);
    text(g, 'CHANCE ' + (need / 100).toFixed(2) + '%', CX, 6, C.gold2, 5); var col = f >= 40 ? (win ? C.zg : C.b4) : '#ffffff';
    text(g, 'ROLL ' + String(n).padStart(4, '0'), 36, 14, (f >= 40 && (f >> 1) % 2) ? C.gold2 : col, 5); text(g, '< ' + need, 100, 14, C.zg, 5);
    var bw = 104, gx = 12, gwid = Math.max(1, Math.round(need / 10000 * bw)); px(g, gx, 22, C.s4, bw, 3); px(g, gx, 22, C.zg2, gwid, 3); px(g, gx + gwid, 21, C.zg, 1, 5);
    var mx = gx + Math.round(n / 10000 * (bw - 1)); px(g, mx - 1, 20, C.ol, 3, 7); px(g, mx, 21, f >= 40 ? col : '#ffffff', 1, 5);
    if (f >= 40 && f < 50) text(g, win ? 'WIN!' : 'FAIL', CX, 34, win ? C.zg : C.b3, 8); }
  function dustPet(g, spr, x0, y0, t) { var a = spr.rgba; if (!a) return; var r = rnd(77), grey = [C.s3, C.s4, C.s1, '#6a6458'];
    for (var q = 0; q < 1024; q++) { var j = q * 4; if (!a[j + 3]) { r(); continue; } var x = q % 32, y = (q / 32) | 0, rr = r(), d = t - (y / 5) - rr * 3;
      if (d <= 0) { px(g, x0 + x, y0 + y, 'rgb(' + a[j] + ',' + a[j + 1] + ',' + a[j + 2] + ')'); continue; }
      var fy = Math.min(GY - 1 - (q % 3), y0 + y + 0.18 * d * d), fx = x0 + x + d * (0.5 + rr) * 0.9; px(g, fx, fy, grey[q % 4]); } }
  function zmealF(g, ev, f, P) { var vs = P.victims.slice(0, 3), n = P.victims.length, per = 13, s0 = 8, endF = s0 + vs.length * per;
    sky(g, f, 0); ground(g, 0); var spr = sprite(P.pet, f < endF ? 'zombie' : 'zombie', f >> 2), ate = clamp(Math.floor((f - s0) / per) + (((f - s0) % per) >= 6 ? 1 : 0), 0, vs.length), cur = Math.floor((f - s0) / per), t = (f - s0) % per;
    var VX = [64, 84, 104], zx = 8; if (f >= s0 && cur < vs.length) zx = VX[cur] - 30 + (t < 4 ? Math.round(t * 2) - 8 : t < 8 ? 0 : -Math.round((t - 7))); else if (f >= endF) zx = VX[vs.length - 1] - 38;
    if (f >= s0 && cur < vs.length && t < 4) zx = (cur ? VX[cur - 1] - 38 : 8) + Math.round((VX[cur] - 30 - (cur ? VX[cur - 1] - 38 : 8)) * t / 4);
    vs.forEach(function (v, i) { var x = VX[i], gone = i < ate, now = i === cur && t >= 4 && t < 6; if (gone) { if (i === cur && t < 12) blood(g, t - 6, 31 + i, x + 8, GY - 8); bones(g, x + 4, GY + 2 + (i % 2)); return; }
      var shiver = f % 2 && !now ? 1 : 0, vsp = sprite(v, 'live', 0); if (now) { g.save(); g.globalAlpha = 1; } g.drawImage(vsp, 0, 0, 32, 32, x + shiver, GY - 16, 16, 16); if (now) { g.restore(); px(g, x, GY - 16, '#ffffff', 16, 16); g.save(); g.globalAlpha = 0.6; g.drawImage(vsp, 0, 0, 32, 32, x, GY - 16, 16, 16); g.restore(); }
      if ((f + i) % 4 < 2) px(g, x + 13, GY - 18, '#27e1ff', 1, 2); });
    drawSpr(g, spr, zx, GY - 31 + (f >= endF ? (f >> 1) % 2 : 0));
    if (f >= s0 && cur < vs.length && t >= 4 && t < 7) text(g, 'CHOMP!', VX[cur] + 4, 30, C.b4, 5);
    var hunger = clamp(0.18 + 0.82 * (n ? ate / vs.length : 1), 0, 1); text(g, 'HUNGER', 6, 4, C.s2, 5, 'left'); px(g, 41, 4, C.ol, 42, 7); px(g, 42, 5, '#1a1d14', 40, 5); px(g, 42, 5, hunger >= 1 ? C.zg : '#8aa04c', Math.round(40 * hunger), 5);
    if (n > 3) text(g, '+' + (n - 3) + ' MORE', 122, 4, C.b4, 5, 'right');
    if (f >= endF + 2) { px(g, zx + 26, GY - 40, '#ffffff', 26, 11); px(g, zx + 26, GY - 29, '#ffffff', 3, 3); text(g, 'BURP', zx + 39, GY - 37, C.ol, 6); }
    if (f >= endF + 6) text(g, 'FULL!', 104, 14, C.zg, 7); }
  function feralF(g, ev, f, P) { var on = f >= 6, shake = on && f < 20 ? (f % 2 ? 1 : -1) : 0; sky(g, f, on ? -(0.1 + 0.08 * (f % 2)) : 0); stone(g, 0, false); ground(g, 0); mound(g, 0, true); candles(g, 0.05, f);
    var spr = sprite(P.pet, on ? 'feral' : 'zombie', f >> 1); drawSpr(g, spr, CX - 16 + shake, GY - 31);
    if (on && f % 4 < 2) { px(g, 0, 0, C.b1, W, 2); px(g, 0, H - 2, C.b1, W, 2); px(g, 0, 0, C.b1, 2, H); px(g, W - 2, 0, C.b1, 2, H); }
    if (f >= 8) text(g, 'FERAL!', CX, 8, (f >> 1) % 2 ? C.b3 : C.b4, 8); if (f >= 12) text(g, 'ANYONE CAN HUNT IT', CX, 20, C.s2, 5); }
  function crumbleF(g, ev, f, P) { var hunted = ev.kind === 'hunted', sink = clamp((f - 8) / 16, 0, 1); sky(g, f, 0); stone(g, 0, false); ground(g, 0); mound(g, 0, f < 26); candles(g, 0.05, f);
    var spr = sprite(P.pet, hunted ? 'zombie' : 'feral', f >> 2), y = GY - 31 + Math.round(sink * 30 / 2) * 2; if (sink < 1) drawSpr(g, spr, CX - 16 + (f < 8 && f % 2 ? 1 : 0), y, GY + 1);
    if (hunted && f >= 2 && f < 8) { for (var i = 0; i < 14; i++) px(g, CX + 14 - i * 2 + (f - 2) * 2, GY - 34 + i * 2, '#ffffff', 2, 1); }
    if (f >= 8 && f < 30) chips(g, (f - 8) % 11, 5 + Math.floor((f - 8) / 11), CX, GY, 10, [C.s3, C.d3, C.s4]); if (f >= 26) mound(g, 0, false);
    if (f >= 24) text(g, hunted ? 'LAID TO REST' : 'BACK TO THE GRAVE', CX, 10, C.s2, 5); }
  /* pledge: the items stand around the candle circle; each in turn lifts, spirals into the zombie and bursts gold while the points tick up */
  var PSLOT = [[6, GY - 19], [106, GY - 19], [10, GY + 1], [102, GY + 1]];
  function gearIcon(g, x, y, sz) { var u = Math.max(1, Math.round(sz / 8)); px(g, x + 2 * u, y, C.ol, 4 * u, 8 * u); px(g, x, y + 2 * u, C.ol, 8 * u, 4 * u); px(g, x + 2 * u, y + u, C.gold, 4 * u, 6 * u); px(g, x + u, y + 2 * u, C.gold, 6 * u, 4 * u); px(g, x + 3 * u, y + 2 * u, C.gold2, 2 * u, 2 * u); }
  function pledgeF(g, ev, f, P) { var items = P.victims.map(function (v) { return { pet: v }; }).concat((ev.gear || []).map(function (gid) { return { gid: gid }; })), sh = items.slice(0, 4), n = items.length;
    var s0 = 8, per = sh.length ? Math.min(12, Math.floor(40 / sh.length)) : 12, endF = s0 + sh.length * per, steps = ev.steps || [], last = steps.length ? steps[steps.length - 1] : { pts: ev.pts1 | 0, ch: ev.ch1 || 0 };
    var done = clamp(Math.floor((f - s0) / per) + (((f - s0) % per) >= per - 2 ? 1 : 0), 0, sh.length), cur = Math.floor((f - s0) / per), t = (f - s0) % per;
    var stepAt = function (k) { if (k <= 0) return { pts: ev.pts0 | 0, ch: ev.ch0 || 0 }; if (k >= sh.length) return last; var st = steps[Math.min(steps.length - 1, k - 1)]; return st || last; };
    var a = stepAt(done - (f >= s0 && cur < sh.length && t >= per - 2 ? 1 : 0)), b = stepAt(done), tick = f >= endF ? 1 : (t >= per - 2 ? clamp((t - (per - 2) + 1) / 2, 0, 1) : 1), pts = Math.round(a.pts + (b.pts - a.pts) * tick), ch = f >= endF ? last.ch : b.ch;
    if (f >= endF) pts = last.pts;
    sky(g, f, f >= s0 ? 0.05 + 0.04 * (f % 2) : 0); ground(g, 0); var gl = clamp(0.25 + 0.75 * (f < s0 ? 0 : done / Math.max(1, sh.length)), 0, 1);
    for (var q = 0; q < 28; q++) { var an = q / 28 * Math.PI * 2 + f * 0.06; if ((q + (f >> 1)) % 2) px(g, CX + Math.cos(an) * 36, GY + 1 + Math.sin(an) * 6, gl > 0.6 ? C.gold : '#9a7a2a'); } /* the circle on the ground */
    candles(g, gl, f); var zs = sprite(P.pet, 'zombie', f >> 2); drawSpr(g, zs, CX - 16 + (f >= s0 && t >= per - 2 && cur < sh.length ? (f % 2 ? 1 : -1) : 0), GY - 31);
    sh.forEach(function (it, i) { var sx = PSLOT[i][0], sy = PSLOT[i][1]; if (i < done && !(i === cur && t >= per - 2)) return; var k = i === cur && f >= s0 ? t : -1;
      var x = sx, y = sy, sz = 16, wob = (f + i) % 4 < 2 ? 1 : 0;
      if (k >= 0) { var u = clamp(k / (per - 2), 0, 1), lift = Math.min(1, u * 3), ang = u * Math.PI * 1.5 * (sx < CX ? 1 : -1), r0 = 1 - u, tx = CX - 8, ty = GY - 24;
        x = tx + (sx - tx) * r0 * Math.cos(ang) - (sy - ty) * r0 * Math.sin(ang) * 0.4; y = ty + (sy - ty - 8 * lift) * r0 + Math.sin(ang) * 6 * r0; sz = Math.max(4, Math.round((16 - 12 * u) / 2) * 2); wob = 0;
        for (var tr = 1; tr < 4; tr++) px(g, x + sz / 2 - tr * (sx < CX ? -2 : 2), y + sz / 2 + tr, tr % 2 ? C.gold : C.gold2); }
      if (k >= per - 2) { sparkle(g, f, 40 + i, CX, GY - 18, 26); disc(g, CX, GY - 18, 3 + (k - per + 2) * 2, C.gold2); return; }
      if (it.pet) { var vsp = sprite(it.pet, 'live', 0); g.drawImage(vsp, 0, 0, 32, 32, Math.round(x), Math.round(y - wob), sz, sz); } else gearIcon(g, Math.round(x), Math.round(y - wob), sz);
      if (k < 0 && (f + i) % 6 < 3) px(g, sx + 7, sy - 3, C.gold2, 2, 1); });
    /* the points panel */ var MIN = ev.min || 25, bw = 76; px(g, 26, 2, C.ol, 76, 21); px(g, 27, 3, '#221d38', 74, 19);
    text(g, 'POINTS ' + pts + '/' + MIN, CX, 5, pts >= MIN ? C.zg : C.gold2, 5); px(g, 30, 12, C.s4, 68, 3); px(g, 30, 12, pts >= MIN ? C.zg2 : C.gold, Math.round(68 * clamp(pts / MIN, 0, 1)), 3);
    text(g, 'CHANCE ' + Math.round(ch * 100) + '%', CX, 16, '#ffffff', 5);
    if (f >= s0 && cur < sh.length && t >= per - 2) { var add = Math.max(0, stepAt(cur + 1).pts - stepAt(cur).pts); text(g, '+' + add, CX + 22, GY - 34 - (t - per + 2) * 2, C.gold2, 6); }
    if (n > 4 && f < endF + 2) text(g, '+' + (n - 4) + ' MORE', 4, 26, C.gold, 5, 'left');
    if (f >= endF + 2) { if ((f >> 1) % 2 || f >= endF + 8) halo(g, CX, GY - 33, f); text(g, 'PLEDGED!', CX, 28, (f >> 1) % 2 ? C.gold2 : C.gold, 7); }
    if (f >= endF + 8) text(g, last.pts >= MIN ? 'READY TO RESURRECT' : 'NEEDS ' + (MIN - last.pts) + ' MORE', CX, GY + 8, last.pts >= MIN ? C.zg : C.s2, 5); }
  function ptsOf(x) { var V = window.V2Rules, Pt = (V && V.CEM && V.CEM.POINTS) || [1, 3, 10, 33]; return Pt[Math.max(0, Math.min(3, (x && x.tier) | 0))]; }
  var PAINT = { raise: raiseF, 'resurrect-win': resF, 'resurrect-fail': resF, zmeal: zmealF, feral: feralF, crumble: crumbleF, hunted: crumbleF, pledge: pledgeF };
  function pets(ev, w) { var by = (w && w.byId) || {}; return { pet: by[ev.id] || ev.pet || null, victims: (ev.victims || []).map(function (id) { return by[id] || { id: id }; }) }; }
  function paint(c, ev, f, w) { var g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.clearRect(0, 0, W, H); (PAINT[ev.kind] || raiseF)(g, ev, f, pets(ev, w)); }
  function nm(p, id) { return '#' + (p ? p.id : id) + (p && p.name ? ' ' + p.name : ''); }
  function caption(ev, P) { var n = nm(P.pet, ev.id), b = ev.block ? ' · block ' + Number(ev.block).toLocaleString('en-US') : '';
    switch (ev.kind) { case 'raise': return '🧟 ' + n + ' rose from the grave!' + b;
      case 'resurrect-win': return '😇 ' + n + ' is ALIVE again! Rolled ' + ev.roll + ', needed under ' + ev.need + b;
      case 'resurrect-fail': return '🪦 ' + n + ': Resurrection failed. Rolled ' + ev.roll + ', needed under ' + ev.need + '. Dust forever' + b;
      case 'zmeal': return '🍖 ' + n + ' ate ' + P.victims.length + ' pet' + (P.victims.length === 1 ? '' : 's') + ' (' + P.victims.slice(0, 6).map(function (v) { return '#' + v.id; }).join(', ') + (P.victims.length > 6 ? ', …' : '') + '). Hunger full' + b;
      case 'feral': return '👁️ ' + n + ' went FERAL. Anyone can hunt it now; feed it pets at the altar to calm it';
      case 'crumble': return '🪦 ' + n + ' crumbled back into its grave (unfed). It can be raised again' + b;
      case 'hunted': return '🗡️ ' + n + ' was hunted and laid to rest' + b;
      case 'pledge': var cnt = P.victims.length + (ev.gear || []).length, L = ev.steps && ev.steps.length ? ev.steps[ev.steps.length - 1] : { pts: ev.pts1 | 0, ch: ev.ch1 || 0 };
        return '😇 ' + cnt + ' pledged to the Resurrection of ' + n + (P.victims.length ? ' (' + P.victims.slice(0, 6).map(function (v) { return '#' + v.id; }).join(', ') + (P.victims.length > 6 ? ', …' : '') + ')' : '') + ' · ' + L.pts + ' of ' + (ev.min || 25) + ' points · ' + Math.round(L.ch * 100) + '% chance' + b; } return n; }
  function css() { if (document.getElementById('caCss')) return; var s = document.createElement('style'); s.id = 'caCss';
    s.textContent = '.ca-ov{position:fixed;inset:0;z-index:100010;background:rgba(10,8,22,.88);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;cursor:pointer;padding:12px;box-sizing:border-box}' +
      '.ca-ov canvas{image-rendering:pixelated;image-rendering:crisp-edges;border:4px solid #000;box-shadow:4px 4px 0 #000;background:#0b0a1f;max-width:100%}' +
      '.ca-cap{font-family:inherit;color:#b9ff9a;font-size:17px;text-align:center;text-shadow:2px 2px 0 #000;max-width:92vw;line-height:1.35}.ca-skip{color:#bbb;font-size:12px}';
    document.head.appendChild(s); }
  var BUSY = null;
  /* play(ev, {w, done}) -> {end, canvas, frame(k)}; ev = {kind, id, victims, roll, need, block, tx} */
  function play(ev, o) { o = o || {}; css(); var w = o.w || (window.V2Mock && V2Mock.world && V2Mock.world()), P = pets(ev, w), N = LEN[ev.kind] || 40;
    var ov = document.createElement('div'); ov.className = 'ca-ov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'Cemetery: ' + ev.kind); ov.dataset.anim = ev.kind;
    var sc = Math.max(2, Math.min(6, Math.floor(Math.min(window.innerWidth - 40, 640) / W))), c = document.createElement('canvas'); c.width = W; c.height = H; c.style.width = W * sc + 'px'; c.style.height = H * sc + 'px';
    var cap = document.createElement('div'); cap.className = 'ca-cap'; cap.textContent = caption(ev, P); var skip = document.createElement('div'); skip.className = 'ca-skip'; skip.textContent = 'Tap to skip';
    ov.appendChild(c); ov.appendChild(cap); ov.appendChild(skip); document.body.appendChild(ov); var f = 0, tm = null, ended = false;
    function end() { if (ended) return; ended = true; clearInterval(tm); window.removeEventListener('keydown', end); ov.remove(); BUSY = null; if (o.done) try { o.done(); } catch (e) {} if (window.V2AnimDone) try { V2AnimDone(); } catch (e) {} }
    ov.addEventListener('click', end); window.addEventListener('keydown', end); BUSY = { end: end };
    var draw = function (k) { try { paint(c, ev, k, w); } catch (e) { if (window.console) console.warn('cem anim', e); } };
    try { if (window.V2SFX && ev.kind === 'raise' && V2SFX.rise) V2SFX.rise(); } catch (e) {}
    if (reduced() || o.still) { draw(KEY_F[ev.kind] || N - 1); skip.textContent = 'Tap to close'; if (!o.still) tm = setInterval(end, 3000); return { end: end, canvas: c, frame: draw }; }
    draw(0); tm = setInterval(function () { f++; if (f >= N + 12) return end(); if (f < N) draw(f); }, 1000 / FPS); /* the last frame holds ~1.2 s */
    return (API.last = { end: end, canvas: c, frame: function (k) { clearInterval(tm); draw(k); } }); }
  /* ---- confirmed events for one wallet, from the replayed world ---- */
  function zrec(p, tx) { if (!p) return null; if (p.zombie && (!tx || p.zombie.tx === tx)) return p.zombie; var L = p.zPast || []; for (var i = L.length - 1; i >= 0; i--) if (!tx || L[i].tx === tx) return L[i]; return p.zombie || null; }
  function mine(p, z, ME) { return !!ME && !!((p && p.owner === ME) || (z && (z.by === ME || z.prevOwner === ME))); }
  function fromLog(w, l, ME) { var p = w.byId[l.petId], m, z;
    if (l.kind === 'raise') { z = zrec(p, l.tx); return mine(p, z, ME) ? { kind: 'raise', id: l.petId, block: l.block, tx: l.tx, key: 'raise:' + l.tx } : null; }
    if (l.kind === 'zfeed') { z = zrec(p); m = /\((#[\d, #]+)\)/.exec(l.msg || ''); var ids = m ? m[1].replace(/#/g, '').split(/,\s*/).map(Number) : [];
      return mine(p, z, ME) || ids.some(function (id) { var v = w.byId[id]; return v && v.owner === ME; }) ? { kind: 'zmeal', id: l.petId, victims: ids, block: l.block, tx: l.tx, key: 'zfeed:' + l.tx } : null; }
    if (l.kind === 'resurrect') { z = zrec(p); m = /roll (\d+), needed under (\d+)/.exec(l.msg || ''); if (!m) return null; var ok = /ALIVE again/.test(l.msg);
      return mine(p, z, ME) ? { kind: ok ? 'resurrect-win' : 'resurrect-fail', id: l.petId, roll: +m[1], need: +m[2], block: l.block, tx: l.tx, key: 'res:' + l.tx } : null; }
    if (l.kind === 'crumble') { z = zrec(p); return mine(p, z, ME) ? { kind: 'crumble', id: l.petId, block: l.block, key: 'crumble:' + l.petId + ':' + l.block } : null; }
    if (l.kind === 'hunt' && (m = /hunted #(\d+): laid to rest/.exec(l.msg || ''))) { var zp = w.byId[+m[1]]; z = zrec(zp); return mine(zp, z, ME) && !(w.byId[l.petId] && w.byId[l.petId].owner === ME) ? { kind: 'hunted', id: +m[1], block: l.block, tx: l.tx, key: 'hunted:' + l.tx } : null; }
    if (l.kind === 'rpl') return rplEvent(w, l, ME);
    return null; }
  /* rpl / rplg log lines carry only the count; the pledged items are the zombie's own z.rpl entries in order (cemHandle pushes them as it logs) */
  function rplEvent(w, l, ME) { var p = w.byId[l.petId], z = p && p.zombie, V = window.V2Rules; if (!p || !z || !mine(p, z, ME) || !V || !V.cemResInfo) return null;
    var L = w.log.filter(function (x) { return x.kind === 'rpl' && x.petId === p.id && x.block >= (z.raisedAt || 0); }), at = 0, me = -1;
    for (var i = 0; i < L.length; i++) { var c = +((/pledged (\d+)/.exec(L[i].msg || '') || [])[1] || 0); if (L[i] === l) { me = at; break; } at += c; }
    var cnt = +((/pledged (\d+)/.exec(l.msg || '') || [])[1] || 0); if (me < 0 || !cnt || me + cnt > (z.rpl || []).length) return { kind: 'pledge', id: p.id, victims: [], pts1: +((/\((\d+) points\)/.exec(l.msg || '') || [])[1] || 0), block: l.block, tx: l.tx, key: 'rpl:' + l.tx };
    return Object.assign(pledgeSteps(w, p, z.rpl.slice(0, me), z.rpl.slice(me, me + cnt), l.block), { block: l.block, tx: l.tx, key: 'rpl:' + l.tx }); }
  function pledgeSteps(w, p, before, add, b) { var V = window.V2Rules, info = function (E) { try { return V.cemResInfo(w, { id: p.id, owner: p.owner, tier: p.tier, zombie: { rpl: E } }, b); } catch (e) { return { points: 0, chance: 0 }; } };
    var i0 = info(before), sh = add.slice(0, 4), steps = sh.map(function (e, k) { var r = info(before.concat(add.slice(0, k + 1))); return { pts: r.points, ch: r.chance }; }), fin = info(before.concat(add));
    if (steps.length) steps[steps.length - 1] = { pts: fin.points, ch: fin.chance };
    return { kind: 'pledge', id: p.id, victims: add.filter(function (e) { return e.id != null; }).map(function (e) { return e.id; }), gear: add.filter(function (e) { return e.gid; }).map(function (e) { return e.gid; }), pts0: i0.points, ch0: i0.chance, steps: steps, min: (V.CEM && V.CEM.RES_MIN) || 25 }; }
  var KINDS = { raise: 1, zfeed: 1, resurrect: 1, crumble: 1, hunt: 1, rpl: 1 };
  function seenKey(ME) { return 'xcpets-cem-anim-seen-' + ME; }
  function collect(w, ME, tip) { if (!w || !w.log || !ME) return []; tip = tip || w.tip || 0; var k = seenKey(ME), seen = null; try { seen = JSON.parse(localStorage.getItem(k)); } catch (e) {} var first = !seen; seen = seen || {}; var out = [], dirty = first;
    function add(ev) { if (!ev || seen[ev.key]) return; seen[ev.key] = 1; dirty = true; if (first && tip - (ev.block || tip) > FIRST_WINDOW) return; out.push(ev); }
    w.log.forEach(function (l) { if (KINDS[l.kind]) try { add(fromLog(w, l, ME)); } catch (e) {} });
    var V = window.V2Rules; if (V && V.cemView) (w.pets || []).forEach(function (p) { var z = p.zombie; if (!z || z.end || !mine(p, z, ME)) return; try { var v = V.cemView(w, p, tip + 1); if (v && v.feral) add({ kind: 'feral', id: p.id, block: z.feralAt, key: 'feral:' + p.id + ':' + z.tx + ':' + (z.fedAt || z.raisedAt) }); } catch (e) {} });
    if (dirty) try { localStorage.setItem(k, JSON.stringify(seen)); } catch (e) {}
    return out; }
  /* ?anim=… preview (any page that loads this file and the replayed world); never marks anything seen */
  function previewKind() { try { var q = new URLSearchParams(location.search).get('anim'); return q && PAINT[q] ? q : null; } catch (e) { return null; } }
  function previewEvent(w, ME) { var kind = previewKind(); if (!kind) return null; var q = new URLSearchParams(location.search), by = (w && w.byId) || {}, id = +q.get('pet') || 0;
    if (!by[id]) id = by[2] ? 2 : ((w && w.pets || []).filter(function (p) { return p.owner === ME; })[0] || (w && w.pets && w.pets[0]) || { id: 0 }).id;
    var eat = (q.get('eat') || '').split('.').map(Number).filter(function (x) { return by[x]; }); if (!eat.length) eat = by[23568] ? [23568] : []; if (eat.length < 3) (w && w.pets || []).some(function (p) { if (p.id !== id && eat.indexOf(p.id) < 0 && !p.zombie && p.alive !== false) eat.push(p.id); return eat.length >= 3; });
    var need = 2500, z = by[id] && by[id].zombie;
    if (kind === 'pledge' && by[id]) { var pe = Object.assign(pledgeSteps(w, by[id], (z && z.rpl) || [], eat.slice(0, Math.max(3, eat.length)).map(function (x) { return { id: x }; }).concat((q.get('gear') || '').split('.').filter(Boolean).map(function (g) { return { gid: 'g' + g.replace(/^g/, '') }; })), (w && w.tip) || 0), { block: (w && w.tip) || 0, preview: true });
      if (pe.steps.length && pe.steps[pe.steps.length - 1].pts === pe.pts0) { var pp = pe.pts0; pe.steps = pe.steps.map(function (st, k) { pp += ptsOf(by[pe.victims[k]] || { tier: 0 }); return { pts: pp, ch: Math.min(0.65, 0.05 + 0.6 * pp / (pp + 100)) }; }); } return pe; } /* preview only: pets the rules would refuse still show their tier points */
    return { kind: kind, id: id, victims: eat, roll: kind === 'resurrect-fail' ? 6342 : 1873, need: need, block: (z && (kind === 'zmeal' ? z.fedAt : z.raisedAt)) || (w && w.tip) || 0, preview: true }; }
  var PV = false;
  function preview(w, ME, o) { if (PV) return false; var ev = previewEvent(w, ME); if (!ev) return false; PV = true; setTimeout(function () { play(ev, Object.assign({ w: w }, o || {})); }, 400); return true; }
  /* standalone watcher for pages without v2.js's animation queue (cemetery.html): plays the new events one after another */
  var WQ = [];
  function watch(w, ME, tip) { if (preview(w, ME)) return; collect(w, ME, tip).forEach(function (ev) { WQ.push(ev); }); next(); }
  function next() { if (BUSY || !WQ.length) return; var ev = WQ.shift(); setTimeout(function () { play(ev, { done: function () { setTimeout(next, 400); } }); }, 500); }
  var API = window.V2CemAnim = { last: null, play: play, paint: paint, collect: collect, watch: watch, preview: preview, previewKind: previewKind, caption: function (ev, w) { return caption(ev, pets(ev, w)); },
    busy: function () { return !!BUSY; }, LEN: LEN, KEY_F: KEY_F, W: W, H: H, FPS: FPS, KINDS: Object.keys(PAINT) };
})();
