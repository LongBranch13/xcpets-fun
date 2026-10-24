/* XCPETS Token Press animation (token-press, owner Oct 24 2026). DISPLAY ONLY: an 8-bit machine presses the pet and spits out a token card.
 * 160x112 logical pixels, 12 fps stepped frames, drawn from t (ms) so any frame can be rendered (frameAt). Pets are the pixel sprites
 * img/theme/sp-<species>.png (never smoothed). play(canvas, pet, {asset}) -> Promise when done; tap skips; reduced motion = last frame. */
(function () {
  'use strict';
  var W = 160, H = 112, DUR = 3600, FPS = 12;
  var IMG = {}; function img(src, cb) { if (!IMG[src]) { var i = new Image(); i.onload = function () { if (cb) cb(); }; i.src = src; IMG[src] = i; } return IMG[src].complete && IMG[src].naturalWidth ? IMG[src] : null; }
  function spSrc(p) { var s = String((p && p.species) || 'pepe').replace(/^hyb3?:/, '').split(':')[0].replace(/[^a-z]/g, '') || 'pepe'; return 'img/theme/sp-' + s + '.png'; }
  function px(x, c, a, b, w, h) { x.fillStyle = c; x.fillRect(Math.round(a), Math.round(b), Math.round(w), Math.round(h)); }
  var F = { '0': '111101101101111', '1': '010110010010111', '2': '111001111100111', '3': '111001111001111', '4': '101101111001001', '5': '111100111001111', '6': '111100111101111', '7': '111001001001001', '8': '111101111101111', '9': '111101111001111',
    'T': '111010010010010', 'O': '111101101101111', 'K': '101101110101101', 'E': '111100111100111', 'N': '111101101101101', '!': '010010010000010', '#': '101111101111101', 'P': '111101111100100', 'R': '111101110101101', 'S': '111100111001111', ' ': '000000000000000', 'X': '101101010101101', 'C': '111100100100111', 'A': '111101111101101', 'I': '111010010010111', 'D': '110101101101110' };
  function txt(x, s, ox, oy, c, k) { k = k || 1; s = String(s).toUpperCase(); for (var i = 0; i < s.length; i++) { var g = F[s[i]] || F[' ']; for (var j = 0; j < 15; j++) if (g[j] === '1') px(x, c, ox + (i * 4 + (j % 3)) * k, oy + Math.floor(j / 3) * k, k, k); } }
  var TIERC = ['#9a9a9a', '#4fd18b', '#4aa3ff', '#E8B33A'], SPARK = ['#ff5ec7', '#ffd84a', '#5effb0', '#5ec2ff', '#FAFAF5'];
  function ease(a) { return a <= 0 ? 0 : a >= 1 ? 1 : 1 - (1 - a) * (1 - a); }
  function seg(t, a, b) { return Math.max(0, Math.min(1, (t - a) / (b - a))); }
  /* frameAt(canvas, t, pet, opts): draws the frame for time t (ms), stepped to 12 fps */
  function frameAt(cv, t, pet, o) { o = o || {}; var x = cv.getContext('2d'); if (cv.width !== W) { cv.width = W; cv.height = H; } x.imageSmoothingEnabled = false;
    t = Math.floor(Math.min(DUR, Math.max(0, t)) / (1000 / FPS)) * (1000 / FPS);
    var sp = img(spSrc(pet), o.onload), tier = (pet && (pet.stage >= 5 || pet.mythicCare)) ? 3 : (pet && pet.tier) || 0;
    /* wall + floor (Spam City colours) */
    px(x, '#3D3640', 0, 0, W, 86); for (var i = 0; i < W; i += 20) px(x, '#2B2730', i, 0, 1, 86); px(x, '#D62028', 0, 84, W, 3);
    for (var fy = 87; fy < H; fy += 6) for (var fx = 0; fx < W; fx += 6) px(x, ((fx + fy) / 6) % 2 ? '#bdbdbd' : '#8d8d8d', fx, fy, 6, 6);
    /* phases */
    var slide = ease(seg(t, 0, 700)), down = seg(t, 700, 1150), hold = seg(t, 1150, 1500), up = seg(t, 1500, 1900), spit = ease(seg(t, 1900, 2700)), glow = seg(t, 2700, DUR);
    var shake = (t > 1100 && t < 1500) ? ((Math.floor(t / 83) % 2) ? 1 : -1) : 0;
    /* conveyor */
    px(x, '#100E14', 4, 74, 104, 10); px(x, '#5A5A5A', 5, 75, 102, 8); var belt = Math.floor(t / 83) % 6; for (i = 0; i < 102; i += 6) px(x, '#2a2a2a', 5 + ((i + belt) % 102), 76, 2, 6);
    for (i = 0; i < 5; i++) { px(x, '#100E14', 10 + i * 22, 82, 6, 6); px(x, '#cfcfcf', 12 + i * 22, 84, 2, 2); }
    /* machine body */
    var mx = 40 + shake, my = 8; px(x, '#100E14', mx - 1, my - 1, 52, 30); px(x, '#D62028', mx, my, 50, 28); px(x, '#8F141A', mx, my + 22, 50, 6); px(x, '#E8B33A', mx + 4, my + 4, 42, 9); txt(x, 'TOKEN', mx + 6, my + 6, '#100E14'); txt(x, 'PRESS', mx + 26, my + 6, '#100E14');
    /* lights */ for (i = 0; i < 4; i++) px(x, (Math.floor(t / 250) + i) % 4 === 0 || (down > 0 && down < 1) ? SPARK[i] : '#4a2a2a', mx + 8 + i * 10, my + 16, 4, 3);
    /* gears */ var gr = Math.floor(t / 125) % 2; px(x, '#cfcfcf', mx + 52, my + 8, 8, 8); px(x, '#5A5A5A', mx + 54, my + 10, 4, 4); px(x, '#cfcfcf', mx + 51 + gr * 9, my + 11, 1, 2); px(x, '#cfcfcf', mx + 55, my + 7 + gr * 9, 2, 1);
    /* legs */ px(x, '#100E14', mx + 2, my + 28, 6, 46); px(x, '#5A5A5A', mx + 3, my + 28, 4, 46); px(x, '#100E14', mx + 42, my + 28, 6, 46); px(x, '#5A5A5A', mx + 43, my + 28, 4, 46);
    /* ram + plate */ var ram = 4 + Math.round((down - up) * (hold > 0 || up > 0 ? 1 : 1) * 30); if (up > 0) ram = 4 + Math.round((1 - up) * 30); else if (down > 0) ram = 4 + Math.round(down * 30);
    px(x, '#cfcfcf', mx + 22, my + 28, 6, ram); px(x, '#100E14', mx + 9, my + 28 + ram, 32, 6); px(x, '#E8B33A', mx + 10, my + 29 + ram, 30, 4);
    /* pet: slides in, gets pressed flat, then is gone into the machine */
    var petX = Math.round(-26 + slide * 78), petH = 24;
    if (down > 0) { var top = my + 34 + ram; petH = Math.max(3, Math.min(24, 74 - top)); }
    if (up > 0) petH = 3 + Math.round(up * 0);
    if (sp && up < 1) { if (up > 0) x.globalAlpha = 1 - up; x.drawImage(sp, petX, 74 - petH, 24, petH); x.globalAlpha = 1; }
    if (t > 1100 && t < 1600) for (i = 0; i < 8; i++) { var a = i * 0.785, r = 6 + (Math.floor(t / 83) % 3) * 4; px(x, SPARK[i % 5], 64 + Math.cos(a) * r * 1.6, 70 + Math.sin(a) * r * 0.6, 2, 2); }
    /* output slot + token card */
    px(x, '#100E14', 104, 52, 10, 24); px(x, '#2a2a2a', 105, 53, 8, 22);
    if (spit > 0) { var cw = 30, ch = 42, cx = 104 + Math.round(spit * 16), cy = 30 - Math.round(Math.sin(spit * Math.PI) * 10), k = glow > 0 ? (Math.floor(t / 166) % 2) : 0;
      px(x, '#000', cx - 1, cy - 1, cw + 2, ch + 2); px(x, k ? '#ffd84a' : TIERC[tier], cx, cy, cw, ch); px(x, '#FAFAF5', cx + 2, cy + 2, cw - 4, ch - 4); px(x, '#1a2630', cx + 3, cy + 3, cw - 6, 22);
      if (sp) x.drawImage(sp, cx + 5, cy + 4, 20, 20); txt(x, '#' + (pet ? pet.id : ''), cx + 3, cy + 28, '#100E14'); px(x, '#E8B33A', cx + 3, cy + 35, cw - 6, 4); px(x, '#100E14', cx + 4, cy + 36, 2, 2); }
    if (glow > 0) { for (i = 0; i < 10; i++) { var gx = 108 + ((i * 23 + Math.floor(t / 83) * 3) % 50), gy = 10 + ((i * 17 + Math.floor(t / 83) * 2) % 60); px(x, SPARK[i % 5], gx, gy, (i % 3) ? 1 : 2, (i % 3) ? 1 : 2); }
      if (Math.floor(t / 250) % 2 === 0 || glow > 0.6) { px(x, '#100E14', 4, 92, 70, 13); px(x, '#E8B33A', 5, 93, 68, 11); txt(x, 'TOKEN!', 9, 95, '#100E14', 2); } } }
  function play(cv, pet, o) { o = o || {}; var RM = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    return new Promise(function (res) { var t0 = 0, done = false, skip = function () { done = true; };
      cv.addEventListener('click', skip, { once: true });
      if (RM) { frameAt(cv, DUR, pet, { onload: function () { frameAt(cv, DUR, pet); } }); return res(); }
      function step(n) { if (!t0) t0 = n; var t = done ? DUR : n - t0; frameAt(cv, t, pet, o); if (t >= DUR) return res(); requestAnimationFrame(step); }
      requestAnimationFrame(step); }); }
  window.V2PressAnim = { play: play, frameAt: frameAt, DUR: DUR, FPS: FPS, W: W, H: H };
})();
