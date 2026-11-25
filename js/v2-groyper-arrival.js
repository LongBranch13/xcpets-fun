/* XCPETS v2: GROYPER ARRIVAL (community pet #7, Nov 24 2026). DISPLAY ONLY, no rule change.
 * Same frame as the White Rabbit / Lord Kek arrivals: 160x90 pixel canvas x4, 30 fps, Press Start 2P, ONE caption at a time in the top band.
 * Night pond: fireflies blink, a lily pad drifts in, Groyper drops from above and lands on it with a splash ("Plop."), settles,
 * steeples his fingers and side-eyes the viewer ("Comfy."), then "Every burn feeds him" and "COMMUNITY PET #7". ~11 s (330 frames).
 * Plays once per player the first time the community pet is on screen while Groyper is the community pet (SEEN_KEY), ?preview=groyper-arrival
 * plays it on demand, "Replay arrival" link (LINK, class gpreplay). window.V2GroyperArrival = { draw, play, watch, bindReplay, FRAMES, SEEN_KEY, LINK } */
(function (root) {
  'use strict';
  var W = 160, H = 90, S = 4, FRAMES = 330, SEEN_KEY = 'xcpets-v2-groyper-arrival-seen';
  /* beat ends (exclusive): pond | pad drifts | plop | comfy | feeds | id */
  var B1 = 50, B2 = 105, B3 = 150, B4 = 215, B5 = 270;
  var C = { bg: '#0f1428', sky2: '#141c36', ink: '#e8f0ff', dim: '#6f7fa8', moon: '#f4f0d8', moon2: '#cfc8a8',
    water: '#163a4a', water2: '#1d4c5e', water3: '#2b6a7a', ripple: '#7fd0d8', reed: '#2c5a2a', reed2: '#3f7a32', cat: '#6a4422',
    pad: '#3f9a3a', pad2: '#2c6e2a', pad3: '#6cc35a', flower: '#ff9ec4', flower2: '#ffd8ea', fly: '#d8ff6a', gold: '#ffd23f', lips: '#ff7a14' };
  function px(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w || 1, h || 1); }
  function sprite(ctx, img, x, y, s, alpha) { if (!img) return; ctx.globalAlpha = alpha == null ? 1 : alpha; var d = img.data;
    for (var j = 0; j < img.height; j++) for (var i = 0; i < img.width; i++) { var k = 4 * (j * img.width + i); if (d[k] === d[0] && d[k + 1] === d[1] && d[k + 2] === d[2]) continue;
      ctx.fillStyle = 'rgb(' + d[k] + ',' + d[k + 1] + ',' + d[k + 2] + ')'; ctx.fillRect(Math.round(x + i * s), Math.round(y + j * s), Math.ceil(s), Math.ceil(s)); } ctx.globalAlpha = 1; }
  function caption(ctx, s, y, c, size) { if (!s || !ctx.fillText) return; size = size || 6;
    ctx.font = size + 'px "Press Start 2P", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    var m = ctx.measureText(s), wd = (m && m.width) || 0, cx = 80, yy = Math.round(y);
    ctx.globalAlpha = 0.55; px(ctx, Math.max(2, cx - wd / 2 - 4), yy - 2, Math.min(W - 4, wd + 8), size + 5, '#05080a'); ctx.globalAlpha = 1;
    ctx.lineWidth = 2; ctx.strokeStyle = '#000'; ctx.strokeText(s, cx, yy); ctx.fillStyle = c || C.ink; ctx.fillText(s, cx, yy); }
  var WATER_Y = 64;
  function backdrop(ctx, t) { px(ctx, 0, 0, W, H, C.bg); px(ctx, 0, 30, W, WATER_Y - 30, C.sky2);
    for (var s = 0; s < 16; s++) { var sx = (s * 37 + 11) % W, sy = (s * 13 + 4) % 40; if ((s + (t >> 4)) % 5) px(ctx, sx, sy, 1, 1, C.dim); }
    px(ctx, 128, 10, 10, 10, C.moon); px(ctx, 127, 12, 1, 6, C.moon); px(ctx, 138, 12, 1, 6, C.moon); px(ctx, 130, 9, 6, 1, C.moon); px(ctx, 130, 20, 6, 1, C.moon); px(ctx, 131, 13, 2, 2, C.moon2); px(ctx, 134, 16, 2, 1, C.moon2);
    /* far bank */ px(ctx, 0, WATER_Y - 4, W, 4, '#12301e'); for (var b = 0; b < W; b += 9) px(ctx, b, WATER_Y - 6 - ((b * 7) % 3), 6, 2, '#12301e');
    /* water with drifting light lines */ px(ctx, 0, WATER_Y, W, H - WATER_Y, C.water);
    for (var r = 0; r < 7; r++) { var ry = WATER_Y + 3 + r * 4, rx = ((r * 29 + t * (r % 2 ? 0.4 : -0.3)) % (W + 20) + W + 20) % (W + 20) - 20; px(ctx, rx, ry, 14, 1, C.water2); px(ctx, rx + 40, ry + 1, 8, 1, C.water2); }
    /* moon on the water */ ctx.globalAlpha = 0.5; for (var m = 0; m < 4; m++) px(ctx, 129 + ((t >> 3) + m) % 3, WATER_Y + 3 + m * 3, 8 - m, 1, C.moon); ctx.globalAlpha = 1;
    /* reeds + cattails, left and right */
    [[6, 0], [11, 3], [16, 1], [146, 2], [151, 0], [156, 4]].forEach(function (q, i) { var sway = Math.round(Math.sin(t / 18 + i) * 1); px(ctx, q[0] + sway, WATER_Y - 22 + q[1], 1, 22 - q[1] + 4, i % 2 ? C.reed2 : C.reed); if (i % 2 === 0) px(ctx, q[0] + sway - 1, WATER_Y - 26 + q[1], 3, 6, C.cat); }); }
  function fireflies(ctx, t, n) { for (var i = 0; i < (n || 7); i++) { var fx = 20 + ((i * 53 + t * 0.35 * (i % 2 ? 1 : -1)) % 120 + 120) % 120, fy = 30 + ((i * 17) % 26) + Math.sin(t / 9 + i) * 3, on = ((t >> 3) + i * 3) % 7 < 4;
    if (on) { px(ctx, fx, fy, 1, 1, C.fly); ctx.globalAlpha = 0.35; px(ctx, fx - 1, fy - 1, 3, 3, C.fly); ctx.globalAlpha = 1; } } }
  /* lily pad, centred at cx on the water line: wide oval with the notch on the left, a pink flower on the right */
  function lilyPad(ctx, cx, bob) { var y = WATER_Y - 1 + bob, rows = [[20, 0], [24, 1], [24, 2], [24, 3], [20, 4]];
    rows.forEach(function (r) { px(ctx, cx - r[0], y + r[1], r[0] * 2, 1, r[1] === 0 ? C.pad3 : r[1] === 4 ? C.pad2 : C.pad); });
    px(ctx, cx - 24, y + 1, 7, 3, C.water); px(ctx, cx - 18, y + 2, 3, 1, C.water); /* notch */
    px(ctx, cx - 8, y + 2, 6, 1, C.pad2); px(ctx, cx + 3, y + 1, 1, 3, C.pad2); px(ctx, cx + 8, y + 2, 7, 1, C.pad2); /* veins */
    px(ctx, cx + 17, y - 3, 4, 3, C.flower); px(ctx, cx + 16, y - 2, 1, 2, C.flower2); px(ctx, cx + 21, y - 2, 1, 2, C.flower2); px(ctx, cx + 18, y - 4, 2, 1, C.flower2); px(ctx, cx + 18, y - 2, 2, 1, C.gold); }
  function ring(ctx, cx, cy, r, a) { if (r <= 0) return; ctx.globalAlpha = a; for (var g = 0; g < 360; g += 12) { var rad = g * Math.PI / 180, y = cy + Math.sin(rad) * r * 0.3; if (y < WATER_Y) continue; px(ctx, cx + Math.cos(rad) * r, y, 2, 1, C.ripple); } ctx.globalAlpha = 1; }
  function splash(ctx, cx, k) { /* k 0..1: droplets fly up and out, then fall */ for (var i = 0; i < 8; i++) { var dir = (i - 3.5) / 3.5, h = Math.sin(k * Math.PI) * (8 + (i % 3) * 3);
    px(ctx, cx + dir * 18 * k, WATER_Y - 2 - h, 2, 2, i % 2 ? C.ripple : '#cfeff2'); } }
  /** draw(ctx, t, o): frame t. o = { frames: 4 Adult Groyper frames (bare, he sits on the scene's lily pad) } */
  function draw(ctx, t, o) { o = o || {}; t = Math.max(0, Math.min(FRAMES - 1, t | 0));
    var fr = o.frames || [], idle = fr[(t >> 3) % 4] || fr[0], sc = 1.4, size = 32 * sc, padX = 80, bob = Math.round(Math.sin(t / 10));
    backdrop(ctx, t); fireflies(ctx, t, t < B1 ? 9 : 6);
    var cap = '', capC = C.ink, capS = 6, seatY = WATER_Y - size + 1 + bob; /* he sits with his bottom on the pad */
    if (t < B1) { ring(ctx, 80, WATER_Y + 6, 6 + (t % 25) * 0.9, 0.6 - (t % 25) / 50); cap = 'Something stirs in the pond'; capC = C.ink; capS = 5; }
    else if (t < B2) { var u = (t - B1) / (B2 - B1), x = -20 + u * (padX + 20); lilyPad(ctx, x, bob); ring(ctx, x - 18, WATER_Y + 3, 4 + u * 6, 0.35); cap = 'A lily pad drifts in'; capC = C.pad3; capS = 5; }
    else if (t < B3) { var v = (t - B2) / (B3 - B2), fall = Math.min(1, v / 0.45), land = v >= 0.45; lilyPad(ctx, padX, land ? bob + (v < 0.6 ? 2 : 0) : bob);
      var y = land ? seatY + (v < 0.6 ? 2 : 0) : -size + (seatY + size) * fall * fall; sprite(ctx, fr[1] || idle, padX - size / 2, y, sc, 1);
      if (land) { var k = (v - 0.45) / 0.55; splash(ctx, padX, Math.min(1, k * 1.6)); ring(ctx, padX, WATER_Y + 3, 18 + k * 30, 0.7 * (1 - k)); ring(ctx, padX, WATER_Y + 3, 10 + k * 18, 0.6 * (1 - k)); cap = 'Plop.'; capC = C.ink; capS = 7; } }
    else if (t < B4) { lilyPad(ctx, padX, bob); var f3 = (t - B3) > 30 ? fr[3] || idle : idle; sprite(ctx, f3, padX - size / 2, seatY, sc, 1); cap = 'Comfy.'; capC = C.lips; capS = 7; }
    else if (t < B5) { lilyPad(ctx, padX, bob); sprite(ctx, idle, padX - size / 2, seatY, sc, 1); cap = 'Every burn feeds him'; capC = C.gold; capS = 5; }
    else { lilyPad(ctx, padX, bob); sprite(ctx, idle, padX - size / 2, seatY, sc, 1); var e = (t - B5) / (FRAMES - B5); ctx.globalAlpha = 0.25 + 0.2 * Math.sin(t / 6); ring(ctx, padX, WATER_Y + 3, 20, 0.5); ctx.globalAlpha = 1;
      cap = e < 0.45 ? 'GROYPER' : 'COMMUNITY PET #7'; capC = C.gold; capS = 6; }
    caption(ctx, cap, 6, capC, capS); }
  function reduced() { try { return root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }
  function seen() { try { return root.localStorage.getItem(SEEN_KEY) === '1'; } catch (e) { return false; } }
  function markSeen() { try { root.localStorage.setItem(SEEN_KEY, '1'); } catch (e) { } }
  function previewRequested() { try { return new URLSearchParams(root.location.search).get('preview') === 'groyper-arrival'; } catch (e) { return false; } }
  /** Default Adult Groyper, bare (the scene draws his lily pad). */
  function sprites() { if (!(root.GroyperSprite && root.GroyperSprite.frames)) return { frames: [] }; return { frames: root.GroyperSprite.frames(3, C.bg, {}, {}) }; }
  var open = null;
  function play(w, o) { o = o || {}; if (open) return open; markSeen(); var sp = o.sprites || (o.frames ? { frames: o.frames } : sprites()), doc = root.document;
    var ov = doc.createElement('div'); ov.className = 'reveal on returnov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'Groyper arrives');
    ov.innerHTML = '<div class="box wide" style="text-align:center"><canvas width="' + (W * S) + '" height="' + (H * S) + '" class="returncv" style="width:' + (W * S) + 'px;max-width:100%;image-rendering:pixelated"></canvas>' +
      '<p class="small muted retinfo">Groyper arrives</p><div class="row" style="justify-content:center"><button class="btn retclose" type="button">' + (reduced() ? 'Close' : 'Skip') + '</button></div></div>';
    doc.body.appendChild(ov); var cv = ov.querySelector('canvas'), ctx = cv.getContext('2d'), t = 0, stop = false, last = 0, btn = ov.querySelector('.retclose');
    function done() { if (stop) return; stop = true; doc.removeEventListener('keydown', esc2); ov.remove(); open = null; if (o.onDone) o.onDone(); }
    function esc2(e) { if (e.key === 'Escape') done(); }
    btn.onclick = done; ov.addEventListener('click', function (e) { if (e.target === ov) done(); }); doc.addEventListener('keydown', esc2); btn.focus();
    open = { el: ov, close: done };
    function paint(frame) { ctx.setTransform(S, 0, 0, S, 0, 0); ctx.imageSmoothingEnabled = false; draw(ctx, frame, sp); }
    if (reduced()) { paint(FRAMES - 1); return open; }
    (function step(ts) { if (stop) return; if (!last || ts - last >= 33) { last = ts || 0; paint(t); t++; if (t >= FRAMES) btn.textContent = 'Close'; } if (t < FRAMES) root.requestAnimationFrame(step); })();
    return open; }
  function bindReplay(scope, getW) { [].forEach.call((scope || root.document).querySelectorAll('.gpreplay'), function (a) { a.onclick = function (e) { e.preventDefault(); play(typeof getW === 'function' ? getW() : getW); }; }); }
  /** watch(el, getW): first time el is on screen while Groyper is the community pet, play once per player. */
  /* playtest Nov 25 2026: the arrival played the moment its card scrolled into view, even under an open sheet (Gift several pets,
   * Sign & burn), and covered its buttons. It now waits until no other pop-up is open. */
  function sheetUp() { return [].some.call(document.querySelectorAll('.reveal.on, .la-ov'), function (e) { return !e.classList.contains('returnov') && !!(e.offsetWidth || e.offsetHeight); }); /* a hidden sheet (calm mode) does not count */ }
  function playFree(w, getW) { if (sheetUp()) { setTimeout(function () { playFree(typeof getW === 'function' ? getW() : w, getW); }, 1500); return; } play(w); }
  function watch(el, getW) { if (!el || el.__gpArr) return; el.__gpArr = 1;
    var go = function () { var w = typeof getW === 'function' ? getW() : getW, c = w && w.community; if (!previewRequested() && !(c && c.current === 'groyper')) return false; if (seen() && !previewRequested()) return true; playFree(w, getW); return true; };
    if (previewRequested()) { setTimeout(go, 300); return; }
    if (!('IntersectionObserver' in root)) { go(); return; }
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting && go()) io.disconnect(); }); }, { threshold: 0.4 }); io.observe(el); }
  var api = { W: W, H: H, S: S, FRAMES: FRAMES, SEEN_KEY: SEEN_KEY, draw: draw, play: play, watch: watch, sprites: sprites, seen: seen, bindReplay: bindReplay,
    LINK: '<a href="#" class="small gpreplay">Replay arrival</a>' };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.V2GroyperArrival = api;
})(typeof window !== 'undefined' ? window : this);
