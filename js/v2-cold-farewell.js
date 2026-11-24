/* XCPETS v2: COMMUNITY PET FAREWELLS for pet #6 (The White Rabbit) and #7 (Groyper). DISPLAY ONLY, no rule is read or changed.
 * One scene maker for every later community pet, the same frame as the Wizard / Lord Kek / Homer Pepe farewells: 160x90 pixel canvas x4, 30 fps,
 * 4 beats (360 frames, ~12 s), one caption at a time:
 *   0-89    COMMUNITY PET: the Mythic pet (its own sprite at stage 5, Cold Storage loadout) centre stage, burn counter climbing to its total;
 *   90-179  the pet's own line, it moves right to the frost vault (the Rabbit hops, Groyper slides over on his lily pad: too comfy to hop);
 *   180-269 Into Cold Storage: vault door closes, frost, earlier community pets as ice silhouettes inside;
 *   270-359 white flash, "Mythic. Kept cold forever.", the pet's own egg drops ("<name> eggs: 1 in 777"), footer = opts.next (only when the page passes one).
 * Trigger = the pet's chain record (w.rabbitMythic / w.groyperMythic); autoplay once per browser keyed by that record's tx, only for a returning visitor;
 * ?preview=rabbit / ?preview=groyper plays it on demand. Replaces the old js/v2-rabbit-farewell.js preview (never loaded by a page).
 * window.V2ColdFarewell = { make }, window.V2RabbitFarewell, window.V2GroyperFarewell = { draw, play, maybeAutoplay, FRAMES, SEEN_KEY, seen, previewRequested } */
(function (root) {
  'use strict';
  var W = 160, H = 90, S = 4, FRAMES = 360;
  var C = { bg: '#141a2e', ink: '#e8f0ff', dim: '#6f7fa8', gold: '#ffc93c', ice: '#9fe8ff', ice2: '#33d6ff', ice3: '#e9fbff', stone: '#4b5563', stone2: '#2f3742', floor: '#0e1324' };
  function px(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); }
  function sprite(ctx, img, x, y, s, alpha, tint) { if (!img) return; ctx.globalAlpha = alpha == null ? 1 : alpha; var d = img.data;
    for (var j = 0; j < img.height; j++) for (var i = 0; i < img.width; i++) { var k = 4 * (j * img.width + i); if (d[k] === d[0] && d[k + 1] === d[1] && d[k + 2] === d[2]) continue;
      ctx.fillStyle = tint || ('rgb(' + d[k] + ',' + d[k + 1] + ',' + d[k + 2] + ')'); ctx.fillRect(x + i * s, y + j * s, Math.ceil(s), Math.ceil(s)); } ctx.globalAlpha = 1; }
  function vault(ctx, open, frost) { px(ctx, 112, 40, 38, 37, C.stone2); px(ctx, 113, 41, 36, 35, C.stone); px(ctx, 112, 38, 38, 3, C.ice3);
    var dw = Math.round(24 * open); px(ctx, 119, 50, 24, 26, '#0b1220'); if (dw < 24) px(ctx, 119 + dw, 50, 24 - dw, 26, C.stone2);
    if (frost) { ctx.globalAlpha = frost; px(ctx, 119, 50, 24, 26, C.ice); ctx.globalAlpha = 1; } px(ctx, 108, 76, 46, 2, C.ice2); }
  function textWidth(ctx, s, size) { if (!ctx.measureText) return String(s).length * size; ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.font = (size * S) + 'px "Press Start 2P", monospace'; var w = ctx.measureText(s).width / S; ctx.restore(); return w; }
  function wrap(ctx, s, size, maxW) { var words = String(s).split(' '), lines = [], cur = '';
    words.forEach(function (w) { var t = cur ? cur + ' ' + w : w; if (textWidth(ctx, t, size) <= maxW) cur = t; else { if (cur) lines.push(cur); cur = w; } }); if (cur) lines.push(cur); return lines.length ? lines : ['']; }
  /* sky captions stay above y=36 (the pet's head starts near y=44); footer captions stay inside the floor bar (y=79..90), under the feet */
  function text(ctx, s, x, y, c, size, band) { if (!ctx.fillText || !s) return; size = size || 6; var maxW = W - 8, lines = wrap(ctx, s, size, maxW), lh = size + 2;
    if (band === 'foot') { while (lines.length > 1 && (lines.length - 1) * (size + 1) + size > 10 && size > 3) { size--; lines = wrap(ctx, s, size, maxW); } lh = size + 1; var y0 = 88 - (lines.length - 1) * lh; if (y0 - size < 79) y0 = 79 + size; y = y0; }
    else { while (y + (lines.length - 1) * lh > 32 && size > 4) { size--; lh = size + 2; lines = wrap(ctx, s, size, maxW); } }
    ctx.fillStyle = c; ctx.font = size + 'px "Press Start 2P", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    lines.forEach(function (ln, i) { ctx.fillText(ln, Math.round(x), Math.round(y + i * lh)); }); }
  function reduced() { try { return root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }
  /** make(cfg): cfg = { key ('rabbit'), name ('White Rabbit'), rec ('rabbitMythic'), line (beat 2 caption), eggLine, move ('hop' | 'slide'), eggs: function () -> 4 egg frames } */
  function make(cfg) {
    var SEEN_KEY = 'xcpets-v2-' + cfg.key + '-farewell-seen', EGGS = null;
    function eggs() { if (!EGGS && cfg.eggs) { try { EGGS = cfg.eggs(); } catch (e) { EGGS = null; } } return EGGS; }
    function previewRequested() { try { return new URLSearchParams(root.location.search).get('preview') === cfg.key; } catch (e) { return false; } }
    function seenTx() { try { return root.localStorage.getItem(SEEN_KEY); } catch (e) { return null; } }
    /** draw(ctx, t, o): frame t (0..FRAMES-1). o = { frames (4 Mythic frames), ghosts: [frames of earlier community pets], total, next } */
    function draw(ctx, t, o) { o = o || {}; var fr = o.frames || [], f = fr[(t >> 3) % 4] || fr[0], total = o.total || 0;
      px(ctx, 0, 0, W, H, C.bg); px(ctx, 0, 78, W, 12, C.floor);
      if (t < 180) { var go = t < 90 ? 0 : Math.min(1, (t - 90) / 80), x = 64 + go * 50, bump = t < 90 ? 0 : (cfg.move === 'slide' ? 0 : Math.round(Math.abs(Math.sin(t / 5)) * 3)); vault(ctx, 1, 0);
        if (cfg.move === 'slide' && t >= 90 && go < 1) { ctx.globalAlpha = 0.5; px(ctx, x - 26 - ((t >> 1) % 4), 76, 6, 1, C.ice2); px(ctx, x - 34 - ((t >> 1) % 4), 77, 4, 1, C.ice2); ctx.globalAlpha = 1; } /* a little wake behind the sliding lily pad */
        sprite(ctx, f, x - 16, 46 - bump, 1, 1);
        text(ctx, t < 90 ? 'COMMUNITY PET' : cfg.line, 80, 14, t < 90 ? C.gold : C.ink, 6, 'sky');
        text(ctx, Math.floor(total * Math.min(1, t / 80)).toLocaleString('en-US') + ' burned', 80, 86, C.dim, 5, 'foot'); }
      else if (t < 270) { var k = (t - 180) / 90; vault(ctx, 1 - Math.min(1, k * 1.6), Math.max(0, k * 1.6 - 1) * 0.8);
        (o.ghosts || []).forEach(function (g, i) { sprite(ctx, g && g[0], 121 + i * 4, 52, 0.5, 0.35 + 0.4 * (1 - Math.min(1, k * 1.6)), C.ice); });
        if (k < 0.6) sprite(ctx, f, 115, 46, 1, 1 - k / 0.6); text(ctx, 'Into Cold Storage', 80, 14, C.ice, 6, 'sky'); }
      else { var q = (t - 270) / 90; vault(ctx, 0, 0.8); if (q < 0.15) { ctx.globalAlpha = 1 - q / 0.15; px(ctx, 0, 0, W, H, '#ffffff'); ctx.globalAlpha = 1; }
        var E = eggs(), ef = E && E[(t >> 3) % E.length]; if (ef) sprite(ctx, ef, 46, Math.min(44, 16 + q * 40), 1, 1);
        text(ctx, 'Mythic. Kept cold forever.', 80, 12, C.ice3, 5, 'sky'); text(ctx, cfg.eggLine, 80, 22, C.gold, 5, 'sky');
        if (o.next) text(ctx, o.next, 80, 86, C.dim, 5, 'foot'); } }
    function play(o) { o = o || {}; var ov = root.document.createElement('div'); ov.className = 'reveal on returnov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', cfg.name + ' farewell');
      ov.innerHTML = '<div class="box wide" style="text-align:center"><canvas width="' + W * S + '" height="' + H * S + '" class="returncv" style="width:100%;max-width:' + (W * S) + 'px;height:auto;image-rendering:pixelated;display:block;margin:0 auto"></canvas>' +
        '<p class="small muted retinfo"></p><div class="row" style="justify-content:center"><button class="btn retclose" type="button">Close</button></div></div>';
      ov.querySelector('.retinfo').textContent = o.info || ''; root.document.body.appendChild(ov); var cv = ov.querySelector('canvas'), ctx = cv.getContext('2d'), t = 0, stop = false, last = 0;
      function esc(e) { if (e.key === 'Escape') done(); }
      function done() { if (stop) return; stop = true; root.document.removeEventListener('keydown', esc); ov.remove(); if (o.onDone) o.onDone(); }
      ov.querySelector('.retclose').onclick = done; ov.addEventListener('click', function (e) { if (e.target === ov) done(); }); root.document.addEventListener('keydown', esc); ov.querySelector('.retclose').focus();
      ctx.setTransform(S, 0, 0, S, 0, 0); ctx.imageSmoothingEnabled = false;
      if (reduced()) { draw(ctx, FRAMES - 1, o.sprites || o); return { el: ov, close: done }; }
      (function step(ts) { if (stop) return; if (!last || ts - last >= 33) { last = ts || 0; ctx.setTransform(S, 0, 0, S, 0, 0); ctx.imageSmoothingEnabled = false; draw(ctx, Math.min(t, FRAMES - 1), o.sprites || o); t++; } if (t < FRAMES + 60) root.requestAnimationFrame(step); else setTimeout(function () { if (!stop) done(); }, 4000); })();
      return { el: ov, close: done }; }
    /** maybeAutoplay(w, o, returning): ?preview=<key> plays; else once per browser after w[rec], only for a returning visitor (else just mark seen). */
    function maybeAutoplay(w, o, returning) { if (previewRequested()) { play(o); return true; } var x = w && w[cfg.rec]; if (!x) return false;
      var key = String(x.tx || x.block); if (seenTx() === key) return false; try { root.localStorage.setItem(SEEN_KEY, key); } catch (e) { } if (!returning) return false; play(o); return true; }
    return { draw: draw, play: play, maybeAutoplay: maybeAutoplay, FRAMES: FRAMES, SEEN_KEY: SEEN_KEY, W: W, H: H, S: S, seen: seenTx, previewRequested: previewRequested }; }
  var bg = C.bg;
  var api = { make: make,
    rabbit: make({ key: 'rabbit', name: 'White Rabbit', rec: 'rabbitMythic', line: 'I\'m late... I\'m a Mythic!', eggLine: 'White Rabbit eggs: 1 in 777', move: 'hop',
      eggs: function () { return root.RabbitSprite ? root.RabbitSprite.frames(0, bg, {}, {}) : null; } }),
    groyper: make({ key: 'groyper', name: 'Groyper', rec: 'groyperMythic', line: 'Told you I was comfy.', eggLine: 'Groyper eggs: 1 in 777', move: 'slide',
      eggs: function () { return root.GroyperSprite ? root.GroyperSprite.frames(0, bg, {}, {}) : null; } }) };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.V2ColdFarewell = api; root.V2RabbitFarewell = api.rabbit; root.V2GroyperFarewell = api.groyper; }
})(typeof window !== 'undefined' ? window : this);
