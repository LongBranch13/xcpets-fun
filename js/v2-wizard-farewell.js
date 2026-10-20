/* XCPETS v2: BITCOIN WIZARD FAREWELL (Oct 19 2026; design /workspace/xcpets/design/bitcoin-wizard-story.md). Same frame as The Return (js/v2-return.js):
 * 160x90 pixel canvas x4, 420 frames at 30 fps (~14 s), one caption at a time, counter line, flash, new egg. Triggered by CHAIN STATE
 * (w.wizardMythic, found from burn history by V2Rules.replay), autoplays once per browser (seen-flag keyed by the trigger tx) for returning visitors only
 * (2026-10-16 rule: no full-screen autoplay for first visitors), 'Watch the farewell' replays it in Cold Storage, ?preview=wizard previews it any time.
 * Reduced motion: one static frame. window.V2Farewell = { draw, play, maybeAutoplay, FRAMES, SEEN_KEY, seen, previewRequested } */
(function (root) {
  'use strict';
  var W = 160, H = 90, S = 4, FRAMES = 420, GOAL = 6906900, SEEN_KEY = 'xcpets-v2-wizard-farewell-seen';
  var C = { bg: '#141a2e', bg2: '#1b2240', ink: '#e8f0ff', dim: '#6f7fa8', gold: '#ffc93c', gold2: '#c98a12', ice: '#9fe8ff', ice2: '#33d6ff', ice3: '#e9fbff', stone: '#4b5563', stone2: '#2f3742', cyan: '#33d6ff', sign: '#f4ecd8', post: '#8a5a2b' };
  function px(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); }
  function star(ctx, x, y, c) { px(ctx, x, y - 1, 1, 3, c); px(ctx, x - 1, y, 3, 1, c); }
  function coin(ctx, x, y) { px(ctx, x - 2, y - 2, 5, 5, C.gold2); px(ctx, x - 1, y - 1, 3, 3, C.gold); }
  function sprite(ctx, img, x, y, s, alpha) { if (!img) return; ctx.globalAlpha = alpha == null ? 1 : alpha; var d = img.data;
    for (var j = 0; j < img.height; j++) for (var i = 0; i < img.width; i++) { var k = 4 * (j * img.width + i); if (d[k + 3] === 0) continue; if (d[k] === d[0] && d[k + 1] === d[1] && d[k + 2] === d[2]) continue;
      ctx.fillStyle = 'rgb(' + d[k] + ',' + d[k + 1] + ',' + d[k + 2] + ')'; ctx.fillRect(x + i * s, y + j * s, Math.ceil(s), Math.ceil(s)); } ctx.globalAlpha = 1; }
  /* the JOIN US sign: cream board on a post, two ink word blocks (reads as text at this size) */
  function sign(ctx, x, base, tilt) { var top = base - 22; px(ctx, x + 6, top + 9, 2, 13 + (tilt || 0), C.post); px(ctx, x - 1, top - 1, 16, 11, '#1a1020'); px(ctx, x, top, 14, 9, C.sign);
    px(ctx, x + 2, top + 2, 4, 2, '#1a1020'); px(ctx, x + 7, top + 2, 5, 2, '#1a1020'); px(ctx, x + 3, top + 5, 3, 2, '#1a1020'); px(ctx, x + 7, top + 5, 2, 2, '#1a1020'); L.push(['JOIN US', x + 7, top + 4]); }
  function vault(ctx, t, open, frost) { px(ctx, 112, 40, 38, 37, C.stone2); px(ctx, 113, 41, 36, 35, C.stone); px(ctx, 113, 41, 36, 3, C.ice); px(ctx, 112, 38, 38, 3, C.ice3);
    for (var i = 0; i < 6; i++) px(ctx, 114 + i * 6, 44, 2, 2 + (i % 3), C.ice3);                           // icicles
    var dw = Math.round(24 * open); px(ctx, 119, 50, 24, 26, '#0b1220'); if (dw < 24) { px(ctx, 119 + dw, 50, 24 - dw, 26, C.stone2); px(ctx, 121 + dw, 60, 2, 4, C.gold); }
    if (frost) { ctx.globalAlpha = frost; px(ctx, 119, 50, 24, 26, C.ice); ctx.globalAlpha = 1; } px(ctx, 108, 76, 46, 2, C.ice2); }
  var Q = [], L = [];
  function text(s, x, y, c, size) { Q.push([s, x, y, c, size]); }
  function flushText(ctx) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.lineJoin = 'round';
    Q.forEach(function (q) { var fs = q[4] >= 9 ? 32 : q[4] >= 7 ? 22 : q[4] >= 5 ? 18 : 16; ctx.font = 'bold ' + fs + 'px monospace'; var m = ctx.measureText(q[0]), wd = (m && m.width) || 0, cx = Math.round(q[1] * S), y0 = Math.round(q[2] * S);
      ctx.globalAlpha = 0.72; ctx.fillStyle = '#05080a'; ctx.fillRect(Math.round(cx - wd / 2 - 8), y0 - 4, Math.round(wd + 16), fs + 10); ctx.globalAlpha = 1;
      ctx.lineWidth = 4; ctx.strokeStyle = '#000'; ctx.strokeText(q[0], cx, y0); ctx.fillStyle = q[3]; ctx.fillText(q[0], cx, y0); });
    L.forEach(function (l) { ctx.font = 'bold 9px monospace'; ctx.textBaseline = 'middle'; ctx.fillStyle = 'rgba(0,0,0,0)'; }); Q = []; L = []; }
  function fmt(n) { return Math.round(n).toLocaleString('en-US'); }
  /** draw(ctx, t, sp): sp = { wizard: [Mythic community frames], egg: [blue egg frames], nakamoto: [frames], total } */
  function draw(ctx, t, sp) { Q = []; L = []; sp = sp || {}; ctx.setTransform(S, 0, 0, S, 0, 0); ctx.imageSmoothingEnabled = false;
    px(ctx, 0, 0, W, H, C.bg); for (var s = 0; s < 22; s++) { var sx = (s * 37 + 11) % W, sy = (s * 23 + 5) % 52; if ((s + (t >> 3)) % 3) px(ctx, sx, sy, 1, 1, C.dim); }
    px(ctx, 0, 77, W, 13, C.bg2);
    var raise = 50, plant = 170, walk = 260, flash = 300, egg0 = 330, total = sp.total || GOAL;
    // Nakamoto waits inside the vault (silhouette), visible while the door is open
    var open = t < walk ? 0 : t < flash ? Math.min(1, (t - walk) / 14) : Math.max(0, 1 - (t - flash) / 8), frost = t >= flash ? Math.min(0.55, (t - flash) / 30) : 0;
    vault(ctx, t, open, frost); if (open > 0.6 && sp.nakamoto) sprite(ctx, sp.nakamoto[(t >> 3) % sp.nakamoto.length], 123, 52 + ((t >> 4) % 2), 0.5, 0.55);
    // the sign: at his feet, then planted upright at the left, where it stays
    var signX = t < plant ? 44 : 22, wizX = t < plant ? 20 : t < walk ? 20 + (t - plant) * 0.25 : 42 + (t - walk) * 2.0, wizA = t < flash - 6 ? 1 : 0;
    if (t < plant) { px(ctx, 40, 72, 16, 4, C.sign); px(ctx, 40, 72, 16, 1, '#1a1020'); } else sign(ctx, signX, 77, 0);
    if (wizA && wizX < 126 && sp.wizard) sprite(ctx, sp.wizard[(t >> 3) % sp.wizard.length], wizX, 38 + (t >= raise && t < plant ? -((t >> 3) % 2) : 0), 1.25, t > walk + 30 ? Math.max(0, 1 - (t - walk - 30) / 10) : 1);
    if (t >= raise && t < plant + 30) for (var k = 0; k < 7; k++) { var u = ((t - raise) / 40 + k / 7) % 1; if (t - raise < k * 5) continue; var x = 30 + k * 4 + Math.sin(u * 6 + k) * 4, y = 46 - u * 40;
      if (u < 0.5) star(ctx, x, y, C.gold); else coin(ctx, x, y); }                                    // stars pop off the robe and rise as coins
    var cap = t < raise ? 'COMMUNITY PET' : t < plant ? 'Magic Internet Money' : t < walk ? 'Join us.' : t < flash ? 'Into Cold Storage' : t < egg0 ? 'Mythic. Kept cold forever.' : 'A new egg appears…';
    text(cap, 80, 4, C.gold, t < raise ? 9 : 5);
    if (t < egg0) text('₿ ' + fmt(t < raise ? total : total) + ' burned', 80, t < raise ? 15 : 13, '#ffffff', 7);
    if (t >= flash && t < flash + 14) { ctx.setTransform(S, 0, 0, S, 0, 0); ctx.globalAlpha = 1 - (t - flash) / 14; px(ctx, 0, 0, W, H, '#ffffff'); ctx.globalAlpha = 1; }
    if (t >= egg0) { var a = Math.min(1, (t - egg0) / 30), ef = sp.egg ? sp.egg[(t >> 3) % sp.egg.length] : null; sprite(ctx, ef, 60, 32 - Math.round((1 - a) * 10), 1.25, a);
      if (t > egg0 + 30) text('Anyone can hatch one · Join us', 80, 13, '#ffffff', 5); }
    text('Every XCPETS burn counted', 80, 80, C.cyan, 4);
    flushText(ctx); }
  function seenTx() { try { return localStorage.getItem(SEEN_KEY); } catch (e) { return null; } }
  function previewRequested() { try { return new URLSearchParams(location.search).get('preview') === 'wizard'; } catch (e) { return false; } }
  function reduced() { try { return window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }
  function play(o) { o = o || {}; var ov = document.createElement('div'); ov.className = 'reveal on returnov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'Bitcoin Wizard farewell');
    ov.innerHTML = '<div class="box wide" style="text-align:center"><canvas width="' + W * S + '" height="' + H * S + '" class="returncv" style="width:' + W * S + 'px;max-width:100%;image-rendering:pixelated"></canvas>' +
      '<p class="small muted retinfo">' + (o.info || '') + '</p><div class="row" style="justify-content:center"><button class="btn retclose" type="button">Close</button></div></div>';
    document.body.appendChild(ov); var cv = ov.querySelector('canvas'), ctx = cv.getContext('2d'), t = 0, stop = false, last = 0;
    function done() { stop = true; ov.remove(); if (o.onDone) o.onDone(); }
    ov.querySelector('.retclose').onclick = done; ov.addEventListener('click', function (e) { if (e.target === ov) done(); });
    function esc(e) { if (e.key === 'Escape') { document.removeEventListener('keydown', esc); done(); } } document.addEventListener('keydown', esc);
    if (reduced()) { draw(ctx, 380, o.sprites); return { el: ov, close: done }; }
    (function step(ts) { if (stop) return; if (!last || ts - last >= 33) { last = ts || 0; draw(ctx, Math.min(t, FRAMES - 1), o.sprites); t++; } if (t < FRAMES + 60) requestAnimationFrame(step); else setTimeout(function () { if (!stop) done(); }, 4000); })();
    return { el: ov, close: done }; }
  /** maybeAutoplay(w, o, returning): ?preview=wizard plays; else once per browser after the trigger, only for a returning visitor (else just mark seen). */
  function maybeAutoplay(w, o, returning) { if (previewRequested()) { play(o); return true; } var x = w && w.wizardMythic; if (!x) return false;
    var key = String(x.tx || x.block); if (seenTx() === key) return false; try { localStorage.setItem(SEEN_KEY, key); } catch (e) { } if (!returning) return false; play(o); return true; }
  root.V2Farewell = { W: W, H: H, S: S, FRAMES: FRAMES, SEEN_KEY: SEEN_KEY, draw: draw, play: play, maybeAutoplay: maybeAutoplay, seen: seenTx, previewRequested: previewRequested };
})(typeof window !== 'undefined' ? window : this);
