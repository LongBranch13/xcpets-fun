/* XCPETS v2: HOMER PEPE FAREWELL (branch homerpepe-community, PREVIEW ONLY, Oct 26 2026). NOT loaded by any page yet; when Homer launches it plugs in
 * like js/v2-kek-farewell.js (trigger = chain state w.homerMythic, autoplay once per browser keyed by the trigger tx, ?preview=homer). DISPLAY ONLY.
 * Same frame as the Wizard / Lord Kek farewells: 160x90 pixel canvas x4, 30 fps. 4 beats (360 frames, ~12 s), one caption at a time:
 *   0-89    COMMUNITY PET: Mythic Homer Pepe (HomerSprite stage 5, character only) bobbing centre stage, burn counter climbing to his total;
 *   90-179  "Wait a minute... I'm a Mythic!" (his card line, adapted), he walks right to the frost vault;
 *   180-269 Into Cold Storage: vault door closes, frost, earlier community pets as ice silhouettes inside;
 *   270-359 white flash, "Mythic. Kept cold forever.", a Homer Pepe egg drops (1 in 777), footer hands off to the NEXT community pet (opts.next).
 * window.V2HomerFarewell = { draw, play, FRAMES, SEEN_KEY } */
(function (root) {
  'use strict';
  var W = 160, H = 90, S = 4, FRAMES = 360, SEEN_KEY = 'xcpets-v2-homer-farewell-seen';
  var C = { bg: '#141a2e', ink: '#e8f0ff', dim: '#6f7fa8', gold: '#ffc93c', ice: '#9fe8ff', ice2: '#33d6ff', ice3: '#e9fbff', stone: '#4b5563', stone2: '#2f3742', green: '#5aa83c', green2: '#3d7a2a' };
  function px(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); }
  function sprite(ctx, img, x, y, s, alpha, tint) { if (!img) return; ctx.globalAlpha = alpha == null ? 1 : alpha; var d = img.data;
    for (var j = 0; j < img.height; j++) for (var i = 0; i < img.width; i++) { var k = 4 * (j * img.width + i); if (d[k] === d[0] && d[k + 1] === d[1] && d[k + 2] === d[2]) continue;
      ctx.fillStyle = tint || ('rgb(' + d[k] + ',' + d[k + 1] + ',' + d[k + 2] + ')'); ctx.fillRect(x + i * s, y + j * s, Math.ceil(s), Math.ceil(s)); } ctx.globalAlpha = 1; }
  function vault(ctx, open, frost) { px(ctx, 112, 40, 38, 37, C.stone2); px(ctx, 113, 41, 36, 35, C.stone); px(ctx, 112, 38, 38, 3, C.ice3);
    var dw = Math.round(24 * open); px(ctx, 119, 50, 24, 26, '#0b1220'); if (dw < 24) px(ctx, 119 + dw, 50, 24 - dw, 26, C.stone2);
    if (frost) { ctx.globalAlpha = frost; px(ctx, 119, 50, 24, 26, C.ice); ctx.globalAlpha = 1; } px(ctx, 108, 76, 46, 2, C.ice2); }
  function egg(ctx, x, y) { px(ctx, x + 2, y, 6, 1, '#1a1020'); px(ctx, x + 1, y + 1, 8, 10, '#1a1020'); px(ctx, x + 2, y + 1, 6, 9, C.green); px(ctx, x + 3, y + 2, 2, 3, '#7cc55a'); px(ctx, x + 2, y + 8, 6, 1, '#ffffff'); }
  function text(ctx, s, x, y, c, size) { if (!ctx.fillText) return; ctx.fillStyle = c; ctx.font = (size || 6) + 'px "Press Start 2P", monospace'; ctx.textAlign = 'center'; ctx.fillText(s, x, y); }
  /** draw(ctx, t, o): frame t (0..FRAMES-1). o = { frames: HomerSprite.frames(5, bg) (4 frames), ghosts: [frames of earlier community pets], total, next } */
  function draw(ctx, t, o) { o = o || {}; var fr = o.frames || [], f = fr[(t >> 3) % 4] || fr[0], total = o.total || 0;
    px(ctx, 0, 0, W, H, C.bg); px(ctx, 0, 78, W, 12, '#0e1324');
    if (t < 180) { var walk = t < 90 ? 0 : Math.min(1, (t - 90) / 80), x = 64 + walk * 50; vault(ctx, 1, 0); sprite(ctx, f, x - 16, 46 - (t < 90 ? 0 : (t >> 2) % 2), 1, 1);
      text(ctx, t < 90 ? 'COMMUNITY PET' : 'Wait a minute... I\'m a Mythic!', 80, 14, t < 90 ? C.gold : C.ink, 6);
      text(ctx, Math.floor(total * Math.min(1, t / 80)).toLocaleString('en-US') + ' burned', 80, 86, C.dim, 5); }
    else if (t < 270) { var k = (t - 180) / 90; vault(ctx, 1 - Math.min(1, k * 1.6), Math.max(0, k * 1.6 - 1) * 0.8);
      (o.ghosts || []).forEach(function (g, i) { sprite(ctx, g && g[0], 121 + i * 6, 52, 0.5, 0.35 + 0.4 * (1 - Math.min(1, k * 1.6)), C.ice); });
      if (k < 0.6) sprite(ctx, f, 115, 46, 1, 1 - k / 0.6); text(ctx, 'Into Cold Storage', 80, 14, C.ice, 6); }
    else { var q = (t - 270) / 90; vault(ctx, 0, 0.8); if (q < 0.15) { ctx.globalAlpha = 1 - q / 0.15; px(ctx, 0, 0, W, H, '#ffffff'); ctx.globalAlpha = 1; }
      text(ctx, 'Mythic. Kept cold forever.', 80, 14, C.ice3, 6); egg(ctx, 60, Math.min(66, 20 + q * 120)); text(ctx, 'Homer Pepe eggs: 1 in 777', 80, 26, C.gold, 5);
      if (o.next) text(ctx, 'Next community pet: ' + o.next, 80, 86, C.dim, 5); } }
  function play(canvas, o) { var ctx = canvas.getContext('2d'); ctx.setTransform(S, 0, 0, S, 0, 0); ctx.imageSmoothingEnabled = false; var t = 0;
    (function step() { draw(ctx, t, o); if (++t < FRAMES && root.requestAnimationFrame) root.requestAnimationFrame(step); })(); }
  var api = { draw: draw, play: play, FRAMES: FRAMES, SEEN_KEY: SEEN_KEY, W: W, H: H };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.V2HomerFarewell = api;
})(typeof window !== 'undefined' ? window : this);
